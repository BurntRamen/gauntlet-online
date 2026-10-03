import { useCallback, useEffect, useRef, useState } from "react";

const domains = new Set(["encounters", "cards", "card-effects", "faction-effects", "encounter-mechanics", "game", "modes", "campaigns", "factions", "decks", "characters", "assets", "asset-library"]);
export function workshopTarget(value, fallback = { domain: "encounters", id: null }) {
  if (!value || !domains.has(value.domain)) return fallback;
  return { domain: value.domain, id: typeof value.id === "string" && value.id.length <= 240 ? value.id : null, section: typeof value.section === "string" && /^[a-z-]{1,60}$/.test(value.section) ? value.section : null, ...(typeof value.cardId === "string" && value.cardId.length <= 240 ? { cardId: value.cardId } : {}) };
}
export function targetFromLocation(fallback) {
  const params = new URLSearchParams(window.location.search);
  return workshopTarget({ domain: params.get("workshop"), id: params.get("object"), section: params.get("section"), cardId: params.get("testCard") }, fallback);
}

// One editing buffer belongs to the active object. Navigation stores context,
// never form values; server draft revisions remain the save authority.
export default function useWorkshopContext({ initialTarget, dirty, busy, onDiscard, onBusy, onNavigate, beforeNavigate, onExit }) {
  const [target, setTarget] = useState(() => targetFromLocation(initialTarget));
  const [contexts, setContexts] = useState({});
  const [pending, setPending] = useState(null);
  const [backCount, setBackCount] = useState(0);
  const current = useRef({});
  current.current = { target, contexts, dirty, busy, onDiscard, onBusy, onNavigate, beforeNavigate, onExit };
  const index = useRef(0), entries = useRef([]), restoring = useRef(null), mounted = useRef(true);
  const requestLeave = useCallback((action) => {
    if (current.current.busy) { current.current.onBusy?.(); return false; }
    if (current.current.beforeNavigate?.() === false) return false;
    if (current.current.dirty) { setPending({ action }); return false; }
    action?.(); return true;
  }, []);
  const applyTarget = useCallback((next) => {
    setTarget(next);
    current.current.onNavigate?.(next);
  }, []);
  const remember = useCallback((values) => {
    const key = current.current.target.domain;
    setContexts((previous) => ({ ...previous, [key]: { ...previous[key], ...values } }));
  }, []);
  const savePosition = useCallback(() => {
    const previous = current.current.target;
    setContexts(values => ({ ...values, [previous.domain]: { ...values[previous.domain], target: previous, scroll: window.scrollY } }));
  }, []);
  const navigate = useCallback((value) => requestLeave(() => {
    const next = workshopTarget(value, current.current.target);
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
    if (next.cardId) url.searchParams.set("testCard", next.cardId); else url.searchParams.delete("testCard");
    window.history.pushState({ ...window.history.state, gauntletWorkshop: index.current, workshopTarget: next }, "", url);
    applyTarget(next);
    requestAnimationFrame(() => {
      if (mounted.current && current.current.target === next && !next.section) {
        document.getElementById("workshop-context")?.focus({ preventScroll: true });
        window.scrollTo(0, scroll);
      }
    });
  }), [applyTarget, requestLeave, savePosition]);
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
      const accepted = requestLeave(() => {
        if (deciding || !mounted.current) return;
        // Discard may happen before the asynchronous bounce has completed.
        if (restoring.current) restoring.current.resume = true;
        else window.history.go(delta);
      });
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
    const action = pending?.action;
    current.current.dirty = false; current.current.onDiscard(); setPending(null); action?.();
  };
  return { target, navigate, requestLeave, pending, discard, cancel: () => setPending(null), remember,
    context: contexts[target.domain] || {}, contexts, backCount,
    back: () => requestLeave(() => window.history.back()) };
}
