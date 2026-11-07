import { useCallback, useEffect, useRef, useState } from "react";
import { useOperatorPreferences } from "./OperatorPreferences";

const domains = new Set(["encounters", "cards", "sets", "rule-modifiers", "mechanics", "card-effects", "faction-effects", "encounter-mechanics", "game", "modes", "campaigns", "factions", "decks", "offers", "characters", "assets", "asset-library"]);
const filterKeys = ["query", "campaign", "sort", "faction", "type"];
const boundedFilters = values => Object.fromEntries(Object.entries(values || {}).filter(([name, value]) => filterKeys.includes(name) && typeof value === "string").map(([name, value]) => [name, value.slice(0, 240)]));
export function workshopTarget(value, fallback = { domain: "encounters", id: null }) {
  if (!value || !domains.has(value.domain)) return fallback;
  return { domain: value.domain, id: typeof value.id === "string" && value.id.length <= 240 ? value.id : null, ...(typeof value.field === "string" && /^[a-zA-Z][a-zA-Z0-9]{0,59}$/.test(value.field) ? { field: value.field } : {}), section: typeof value.section === "string" && /^[a-z-]{1,60}$/.test(value.section) ? value.section : null, ...(typeof value.cardId === "string" && value.cardId.length <= 240 ? { cardId: value.cardId } : {}) };
}
export function targetFromLocation(fallback) {
  const params = new URLSearchParams(window.location.search);
  return workshopTarget({ domain: params.get("workshop"), id: params.get("object"), section: params.get("section"), cardId: params.get("testCard"), field: params.get("field") }, fallback);
}

// One editing buffer belongs to the active object. Navigation stores context,
// never form values; server draft revisions remain the save authority.
export default function useWorkshopContext({ initialTarget, dirty, busy, onDiscard, onSave, onBusy, onNavigate, beforeNavigate, onExit }) {
  const operator = useOperatorPreferences();
  const [target, setTarget] = useState(() => targetFromLocation(initialTarget));
  const [contexts, setContexts] = useState(() => Object.fromEntries(Object.entries(operator?.preferences.filters || {}).filter(([key]) => domains.has(key)).map(([key, filters]) => [key, boundedFilters(filters)])));
  const preferenceFilters = operator?.preferences.filters;
  useEffect(() => {
    if (!preferenceFilters) return;
    // A preference reset updates the open browser too, while keeping in-memory
    // target/scroll context and never touching editor buffers.
    setContexts(previous => Object.fromEntries([...new Set([...Object.keys(previous), ...Object.keys(preferenceFilters)])].filter(key => domains.has(key)).map(key => [key, { ...Object.fromEntries(Object.entries(previous[key] || {}).filter(([name]) => !filterKeys.includes(name))), ...boundedFilters(preferenceFilters[key]) }])));
  }, [preferenceFilters]);
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false), [saveError, setSaveError] = useState("");
  const [backCount, setBackCount] = useState(0);
  const current = useRef({});
  current.current = { target, contexts, dirty, busy, onDiscard, onSave, onBusy, onNavigate, beforeNavigate, onExit, updatePreferences: operator?.update };
  const index = useRef(0), entries = useRef([]), restoring = useRef(null), mounted = useRef(true);
  const requestLeave = useCallback((action, preserveContext = false) => {
    if (current.current.busy) { current.current.onBusy?.(); return false; }
    let called = false, result;
    const proceed = () => {
      if (called) return result;
      called = true;
      if (current.current.busy) { current.current.onBusy?.(); return (result = false); }
      if (current.current.dirty && !preserveContext) { setSaveError(""); setPending({ action }); return (result = false); }
      action?.(); return (result = true);
    };
    // Callback guards may queue this continuation; boolean guards still work.
    if (current.current.beforeNavigate?.(proceed) === false) return false;
    return called ? result : proceed();
  }, []);
  const applyTarget = useCallback((next) => {
    setTarget(next);
    current.current.onNavigate?.(next);
  }, []);
  const remember = useCallback((values) => {
    const key = current.current.target.domain;
    setContexts((previous) => ({ ...previous, [key]: { ...previous[key], ...values } }));
    const filters = boundedFilters(values);
    if (Object.keys(filters).length) current.current.updatePreferences?.(previous => ({ filters: { ...previous.filters, [key]: { ...previous.filters[key], ...filters } } }));
  }, []);
  const savePosition = useCallback(() => {
    const previous = current.current.target;
    setContexts(values => ({ ...values, [previous.domain]: { ...values[previous.domain], target: previous, scroll: window.scrollY } }));
  }, []);
  const navigate = useCallback((value) => {
    const next = workshopTarget(value, current.current.target);
    return requestLeave(() => {
    if (JSON.stringify(next) === JSON.stringify(current.current.target)) {
      // The object may already be selected while Publishing hides its workshop.
      // Reopen that view without adding history or resetting its saved context.
      current.current.onNavigate?.(current.current.target);
      return;
    }
    const saved = current.current.contexts[next.domain];
    const scroll = next.domain !== current.current.target.domain && saved?.target?.id === next.id ? saved.scroll || 0 : 0;
    savePosition();
    entries.current[index.current] = { target: current.current.target, scroll: window.scrollY };
    index.current += 1; entries.current.length = index.current;
    entries.current.push({ target: next, scroll }); setBackCount(index.current);
    const url = new URL("/admin/gauntlet", window.location.origin);
    url.searchParams.set("workshop", next.domain);
    if (next.id) url.searchParams.set("object", next.id); else url.searchParams.delete("object");
    if (next.section) url.searchParams.set("section", next.section); else url.searchParams.delete("section");
    if (next.field) url.searchParams.set("field", next.field);
    if (next.cardId) url.searchParams.set("testCard", next.cardId); else url.searchParams.delete("testCard");
    window.history.pushState({ ...window.history.state, gauntletWorkshop: index.current, workshopTarget: next }, "", url);
    applyTarget(next);
    requestAnimationFrame(() => {
      if (mounted.current && current.current.target === next && !next.section && !next.field) {
        document.getElementById("workshop-context")?.focus({ preventScroll: true });
        if (next.id && window.innerWidth <= 750 && !scroll) document.getElementById("workshop-context")?.scrollIntoView?.({ block: "start" });
        else window.scrollTo(0, scroll);
      }
    });
    }, next.domain === current.current.target.domain && next.id === current.current.target.id);
  }, [applyTarget, requestLeave, savePosition]);
  useEffect(() => {
    mounted.current = true;
    entries.current = [{ target: current.current.target, scroll: window.scrollY }];
    window.history.replaceState({ ...window.history.state, gauntletWorkshop: 0, workshopTarget: current.current.target }, "");
    const pop = (event) => {
      // App's ordinary popstate listener must not replace Admin while a dirty
      // departure or its compensating history traversal is being resolved.
      if (restoring.current) {
        event.stopImmediatePropagation();
        const { delta, resume } = restoring.current;
        restoring.current = null;
        if (resume && mounted.current) window.history.go(delta);
        return;
      }
      const nextIndex = event.state?.gauntletWorkshop;
      const known = Number.isInteger(nextIndex) && entries.current[nextIndex];
      const delta = known ? nextIndex - index.current : -1;
      if (!delta) return;
      let deciding = true;
      const sameRecord = known && entries.current[nextIndex].target.domain === current.current.target.domain && entries.current[nextIndex].target.id === current.current.target.id;
      const accepted = requestLeave(() => {
        if (deciding || !mounted.current) return;
        // Discard may happen before the asynchronous bounce has completed.
        if (restoring.current) restoring.current.resume = true;
        else window.history.go(delta);
      }, sameRecord);
      deciding = false;
      if (!accepted) {
        event.stopImmediatePropagation();
        restoring.current = { delta, resume: false };
        window.history.go(-delta);
        return;
      }
      if (known) {
        savePosition();
        entries.current[index.current].scroll = window.scrollY;
        index.current = nextIndex; setBackCount(nextIndex);
        applyTarget(entries.current[nextIndex].target);
        requestAnimationFrame(() => { if (mounted.current && index.current === nextIndex) window.scrollTo(0, entries.current[nextIndex].scroll || 0); });
      } else current.current.onExit?.();
    };
    window.addEventListener("popstate", pop, true);
    return () => { mounted.current = false; window.removeEventListener("popstate", pop, true); };
  }, [applyTarget, requestLeave, savePosition]);
  useEffect(() => {
    if (!dirty && !busy) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  const discard = () => {
    if (saving || current.current.busy) return;
    const action = pending?.action;
    current.current.dirty = false; current.current.onDiscard(); setPending(null); action?.();
  };
  const saveAndContinue = async () => {
    if (saving || current.current.busy || !pending || !current.current.onSave) return;
    const action = pending.action;
    setSaving(true); setSaveError("");
    try {
      if (await current.current.onSave()) {
        current.current.dirty = false; setPending(null); action?.();
      } else setSaveError("Nothing was abandoned. Resolve the save issue, then try again or keep editing.");
    } catch (failure) { setSaveError(failure.message || "Saving failed. Your local changes are retained."); }
    finally { if (mounted.current) setSaving(false); }
  };
  return { target, navigate, requestLeave, pending, discard, saveAndContinue, saving, saveError, cancel: () => { if (!saving && !current.current.busy) setPending(null); }, remember,
    context: contexts[target.domain] || {}, contexts, backCount,
    // popstate knows the destination. Guarding here would interrupt same-record
    // section history before the destination can be compared.
    back: () => window.history.back() };
}
