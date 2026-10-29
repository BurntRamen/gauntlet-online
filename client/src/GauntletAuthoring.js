import { HelpProvider } from "./admin/AuthoringHelp";
import { PrivateAssetProvider, PrivateImage } from "./admin/PrivateAsset";
import useWorkshopContext from "./admin/useWorkshopContext";
import UnsavedChangesDialog from "./admin/UnsavedChangesDialog";
import "./admin/TestHarness.css";
const ContentBrowser = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./admin/ContentBrowser"));
const BrowserControls = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./admin/ContentBrowser").then(module => ({ default: module.BrowserControls })));
const contentName = row => row.name || row.title || row.commanderName || row.label || row.source?.split("/").at(-1) || row.id;
const WorkshopShell = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./admin/WorkshopShell"));
const WorkshopSection = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./admin/WorkshopShell").then(module => ({ default: module.WorkshopSection })));
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import Validation from "./admin/WorkshopValidation";
import { displayValue as display, parseFieldValue, bufferTarget } from "./admin/workshopValues";
import { EditorSessionContext } from "./admin/EditorSession";
const WorkshopField = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./admin/WorkshopField"));
const CatalogControls = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./admin/CatalogControls"));
const WorkshopNavigation = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./admin/WorkshopNavigation"));
const Preview = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./admin/WorkshopPreview"));
const EncounterWorkshop = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./EncounterWorkshop"));
const GauntletPlaytest = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./GauntletPlaytest"));
const title = (row) => row.name || row.title || row.commanderName || row.id;
const EditionPrintings = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./admin/PrintingWorkshop").then(module => ({ default: module.EditionPrintings })));
const DeckWorkshop = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./admin/DeckWorkshop"));
const OfferWorkshop = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./admin/OfferWorkshop"));
const CardWorkshop = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./admin/CardWorkshop"));
const EngineWorkshop = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./admin/EngineWorkshop"));
const AssetPicker = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./admin/AssetPicker"));
const ReleaseReview = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./admin/ReleaseReview"));
const RelatedContent = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./admin/RelatedContent"));
const GauntletParaLeague = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./GauntletParaLeague"));
const CompetitionWorkshop = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./admin/CompetitionWorkshop"));
const ENGINE_DOMAINS = ["rule-modifiers", "mechanics", "card-effects", "faction-effects", "encounter-mechanics", "game"];

export default function GauntletAuthoring({ request, area, initialDomain = null, revision, catalog, onPublished, guard, onNavigate, beforeNavigate, onExit, onStatus }) {
  const [state, setState] = useState(null);
  const guide = state?.guide || {};
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [domainChoice, setDomainChoice] = useState(initialDomain?.name || "cards");
  const [selections, setSelections] = useState({});
  const [session, setSession] = useState(null);
  const [scenario, setScenario] = useState(null), [scenarioDirty, setScenarioDirty] = useState(false);
  const bufferRevision = useRef(null);
  const bufferBase = useRef({});
  const definitionBase = useRef(null);
  const [reviewedConflicts, setReviewedConflicts] = useState({});
  const [definitionSession, setDefinitionSession] = useState(null);
  const [definitionTarget, setDefinitionTarget] = useState(null);
  const registerEditor = useCallback(value => { if (value && definitionBase.current === null) definitionBase.current = JSON.stringify(value.saved); setDefinitionSession(value); }, []);
  const [metadata, setMetadata] = useState(null), [relationships, setRelationships] = useState(null), [review, setReview] = useState(null);
  const [projectionError, setProjectionError] = useState("");
  const [resolvedView, setResolvedView] = useState(null), [assetPicker, setAssetPicker] = useState(null);
  const [suit, setSuit] = useState("spades"), [variantId, setVariantId] = useState("");
  const latest = useRef(null);
  latest.current = { state, busy };

  const [buffers, setBuffers] = useState({});
  latest.current.buffers = buffers;
  const [preview, setPreview] = useState(null);
  const [releaseName, setReleaseName] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [creation, setCreation] = useState(null), [createdTarget, setCreatedTarget] = useState(null);
  const createTargetHandled = useRef(null);
  const confirmationRef = useRef(null);
  useEffect(() => {
    if (!confirm) return undefined;
    const trigger = document.activeElement;
    confirmationRef.current?.focus();
    confirmationRef.current?.scrollIntoView?.({ block: "center" });
    return () => { if (trigger?.isConnected) trigger.focus(); };
  }, [confirm]);
  const [notice, setNotice] = useState("");
  const domain = area === "Game" || domainChoice === "modes" ? "game" : domainChoice;
  const [paraDirty, setParaDirty] = useState(false), [paraEditor, setParaEditor] = useState(0);
  const onParaDirty = useCallback(dirty => {
    if (dirty) bufferRevision.current ??= latest.current.state?.revision;
    else { definitionBase.current = null; if (!Object.keys(latest.current.buffers || {}).length) bufferRevision.current = null; }
    setParaDirty(dirty);
  }, []);
  const unsaved = Object.keys(buffers).length > 0 || paraDirty;
  const selected = selections[domainChoice];
  const context = useWorkshopContext({
    initialTarget: { domain: initialDomain?.name || "cards", id: initialDomain?.id || null, section: initialDomain?.section, field: initialDomain?.field },
    dirty: unsaved || scenarioDirty, busy, onSave: saveDeparture, onDiscard: () => { if (definitionSession) definitionSession.discard?.(); else setParaEditor(value => value + 1); setCreation(null); setParaDirty(false); setBuffers({}); bufferBase.current = {}; bufferRevision.current = null; setScenario(null); setScenarioDirty(false); },
    beforeNavigate, onExit,
    onBusy: () => setNotice("Wait for the current operation to finish."),
    onNavigate: (target) => {
      if (target.domain !== domainChoice || target.id !== selected) { setCreation(null); setScenario(null); setScenarioDirty(false); }
      setDomainChoice(target.domain); setSelections(current => ({ ...current, [target.domain]: target.id }));
      const nextArea = target.domain === "offers" ? "Store & Economy" : "Content";
      if (area !== nextArea && !(area === "Design" && nextArea === "Content")) onNavigate?.(nextArea, undefined, undefined, undefined, undefined, undefined, { internal: true });
    }
  });
  const query = context.context.query || "";
  const setQuery = value => context.remember({ query: value });
  const leave = context.requestLeave;
  useEffect(() => { if (createdTarget && !busy && !unsaved) { context.navigate(createdTarget); setCreatedTarget(null); } }, [createdTarget, busy, unsaved, context]);
  useEffect(() => { if (guard) guard.current = leave; return () => { if (guard) guard.current = (action) => { action?.(); return true; }; }; }, [guard, leave]);
  useEffect(() => {
    setDomainChoice(context.target.domain);
    setSelections(current => ({ ...current, [context.target.domain]: context.target.id }));
  }, [context.target]);
  useEffect(() => {
    if (initialDomain) context.navigate({ domain: initialDomain.name, id: initialDomain.id || null, section: initialDomain.section, field: initialDomain.field });
  // Navigation requests come only from the guarded Admin parent.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDomain]);
  useEffect(() => {
    const capability = ({ encounters: "encounterCreation", factions: "factionCreation" })[context.target.domain] || "catalogCreation";
    if (context.target.section === "create" && createTargetHandled.current !== context.target && !creation && !unsaved && state?.writable && state.capabilities?.[capability] && ["cards", "sets", "decks", "offers", "encounters", "factions"].includes(context.target.domain)) { createTargetHandled.current = context.target; setCreation({ domain: context.target.domain }); }
  }, [context.target, creation, unsaved, state]);
  const source = state?.draft ? "draft" : "live";
  useEffect(() => {
    if (!state) return undefined;
    let active = true;
    setMetadata(null); setRelationships(null); setResolvedView(null); setProjectionError("");
    const expectedHash = state.draft?.hash;
    const suffix = `?source=${source}${expectedHash ? `&hash=${expectedHash}` : ""}`;
    Promise.allSettled([
      request(`/api/admin/workshops${suffix}`), request(`/api/admin/workshops/relationships${suffix}`), request(`/api/admin/workshops/presentation${suffix}`)
    ]).then(results => {
      if (!active) return;
      const failures = results.filter(result => result.status === "rejected");
      if (failures.length) setProjectionError(failures.map(result => result.reason.message).join(" · "));
      if (results[0].status === "fulfilled" && results[0].value.version === 1) setMetadata(results[0].value);
      if (results[1].status === "fulfilled" && results[1].value.nodes) setRelationships(results[1].value);
      if (results[2].status === "fulfilled" && results[2].value.resolved) setResolvedView(results[2].value.resolved);
    });
    return () => { active = false; };
  // Metadata is keyed to content, not publication bookkeeping receipts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, source, state?.draft?.hash, state?.activeReleaseId]);
  useEffect(() => {
    if (area !== "Publishing" || !state) return undefined;
    let active = true; setReview(null);
    request("/api/admin/workshops/review").then(value => { if (active && value.groups) setReview(value); }).catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [request, area, state]);
  function edit(key, value, saved) {
    if (!unsaved) bufferRevision.current = state.revision;
    if (!Object.hasOwn(buffers, key)) bufferBase.current[key] = display(saved);
    setReviewedConflicts(current => { const next = { ...current }; delete next[key]; return next; });
    const target = bufferTarget(key), definition = target && state.fields[target.domain]?.[target.id]?.[target.field];
    const savedText = definition?.type === "card-list" ? JSON.stringify(saved) : display(saved);
    setBuffers((current) => { const next = { ...current }; if (value === savedText) delete next[key]; else next[key] = value; return next; });
  }
  useEffect(() => {
    const snapshot = state?.draft?.snapshot || state?.live;
    const rows = domain === "asset-library" ? state?.assetLibrary : domain === "rule-modifiers" ? snapshot?.studio?.modifiers : domain === "sets" ? state?.printingEditions || snapshot?.domains.sets : snapshot?.domains[domain];
    const row = rows?.find(row => row.id === selected);
    onStatus?.({ domain: domainChoice, id: selected, name: row && contentName(row), source: state?.draft ? "Saved draft" : "Live content", busy, unsaved, savedChanges: state?.changes?.length || 0, writable: !!state?.writable, liveOnly: !!state?.liveOnly, loading: !state, selected: row || null, target: context.target });
  }, [onStatus, busy, unsaved, state, domain, domainChoice, selected, context.target]);
  async function refresh() {
    try { const data = await request("/api/admin/authoring"); if (data.liveOnly || latest.current.state?.liveOnly || data.revision >= (latest.current.state?.revision ?? 0)) { setState(data); setPreview((current) => current?.releaseId === `draft:${data.draft?.hash}` ? current : null); } }
    catch (failure) { setError(failure.message); }
  }
  useEffect(() => {
    if (!session) return;
    const check = () => { if (!document.hidden && !latest.current.busy) refresh(); };
    const timer = setInterval(check, 30000);
    window.addEventListener("focus", check);
    return () => { clearInterval(timer); window.removeEventListener("focus", check); };
  // Refresh retains local values and their original expected revision.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, request]);
  function inspect(nextDomain, id, field) {
    if (nextDomain.startsWith("competition:") || nextDomain.startsWith("para:")) return leave(() => {
      const [kind, definitionDomain] = nextDomain.split(":");
      const economy = kind === "para" && ["awards", "products", "entitlements"].includes(definitionDomain);
      setDefinitionTarget({ kind, domain: definitionDomain, id, field });
      onNavigate?.(economy ? "Store & Economy" : "Competition", undefined, undefined, undefined, undefined, undefined, { internal: true, workspace: economy ? "Gold & Rewards" : kind === "competition" ? "Ranked & Gauntlet" : "Para definitions" });
    });
    nextDomain = ({ "studio:mechanics": "mechanics", "studio:modifiers": "rule-modifiers" })[nextDomain] || nextDomain;
    const saved = context.target.domain === nextDomain && context.target.id === id ? context.target : context.contexts[nextDomain]?.target;
    const section = !field ? saved?.id === id ? saved.section : null : nextDomain === "cards" ? field === "effect" ? "mechanics" : "identity" : nextDomain === "encounters" ? field === "setup" || field === "opponentDeckId" || field === "ruleModifierId" ? "setup" : /audio|image|art/i.test(field) ? "assets" : "story" : nextDomain === "decks" ? field === "composition" ? "composition" : "details" : nextDomain === "offers" ? "details" : null;
    context.navigate({ section, field, domain: nextDomain === "game" && id && id !== "shared-rules" ? "modes" : nextDomain, id });
  }
  useEffect(() => {
    let active = true;
    request("/api/admin/authoring").then((data) => { if (active) { setState(data); setError(""); setPreview(null); } }).catch((failure) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [request, revision]);
  useEffect(() => {
    if (!state?.pending || state.connectionRequired || ["closed", "checks-failed", "merge-blocked"].includes(state.pending.phase)) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const deploying = state.pending.phase === "deploying";
        const result = await request(deploying ? "/api/admin/authoring" : "/api/admin/authoring/reconcile", deploying ? undefined : { method: "POST", body: "{}" });
        if (active) { setState(result); if (!result.pending) onPublished(); }
      } catch (failure) { if (active) setError(failure.message); }
    }, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [state?.pending, state?.connectionRequired, request, onPublished]);
  async function act(action, body = {}) {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await request(`/api/admin/authoring/${action}`, { method: ["draft", "record", "notes"].includes(action) ? "PATCH" : "POST", body: JSON.stringify({ expectedRevision: ["para-draft", "competition-draft", "studio-draft"].includes(action) ? bufferRevision.current ?? state.revision : state.revision, ...body }) });
      setState(result); if (!action.startsWith("assets/") || bufferRevision.current == null || bufferRevision.current === state.revision) bufferRevision.current = result.revision;
      if (action.startsWith("assets/")) setAssetPicker(current => current && ({ ...current, baseRevision: current.baseRevision === state.revision ? result.revision : current.baseRevision }));
      setPreview(result.preview || null); setConfirm(null);
      if (action === "publish" || action === "rollback") { setReleaseName(""); onPublished(); }
      setNotice(result.pending ? guide.publicationPending : ["para-draft", "competition-draft", "studio-draft"].includes(action) ? result.notice || "Definition saved to the shared draft." : action === "assets/upload" ? "Image uploaded privately. Choose its exact version, then save the artwork field." : action === "assets/archive" ? "Asset selection updated. Existing versions and references are retained." : action === "create" ? "New content saved to the shared draft. Configure, test and publish it when ready." : action === "notes" ? "Private notes saved. Published content is unchanged." : action === "draft" ? guide.fieldSaved : action === "publish" ? guide.published : action === "rollback" ? "Previous release restored for future games." : action === "discard" ? "Shared draft discarded." : action === "validate" ? "Draft validation completed." : "Saved draft preview is ready.");
      return result;
    } catch (failure) { setError(failure.message); if (failure.status === 409) await refresh(); if (action === "assets/upload") throw failure; return false; }
    finally { setBusy(false); }
  }
  if (!state) return <p role={error ? "alert" : "status"}>{error || "Loading authored content…"}</p>;
  if (!state.guide) return <p role="status">Admin update is deploying. Refresh admin shortly.</p>;
  const DOMAINS = { ...guide.domains, game: "Website prose", sets: "Sets", decks: "Decks", offers: "Store", assets: "Collector artwork" };
  const snapshot = state.draft?.snapshot || state.live;
  const rows = (domain === "asset-library" ? state.assetLibrary || [] : domain === "rule-modifiers" ? snapshot.studio?.modifiers || [] : domain === "sets" ? state.printingEditions || snapshot.domains.sets || [] : snapshot.domains[domain] || []).filter(entry => domainChoice !== "modes" || entry.id !== "shared-rules");
  const visibleRows = rows.filter(entry => domain !== "encounters" || !context.context.campaign || entry.campaignId === context.context.campaign).filter(entry => !context.context.faction || entry.factionId === context.context.faction).filter((entry) => `${contentName(entry)} ${entry.id} ${entry.factionId || ""}`.toLowerCase().includes(query.toLowerCase()));
  const row = rows.find((entry) => entry.id === selected);
  const fields = state.fields[domain]?.[row?.id] || {};
  const changeCount = state.changes.length;
  const recordGroups = Object.entries(buffers).reduce((groups, [key, value]) => {
    const target = bufferTarget(key);
    if (!target) return groups;
    const savedRow = snapshot.domains[target.domain]?.find(item => item.id === target.id);
    const definition = state.fields[target.domain]?.[target.id]?.[target.field];
    if (!savedRow || !definition) return groups;
    const groupKey = `${target.domain}:${target.id}`;
    groups[groupKey] ||= { key: groupKey, domain: target.domain, id: target.id, row: savedRow, label: `${target.domain === "assets" ? "Printing" : (DOMAINS[target.domain] || target.domain).replace(/s$/, "")} · ${title(savedRow)}`, edits: [] };
    groups[groupKey].edits.push({ key, field: target.field, definition, value, saved: savedRow[target.field] === undefined ? definition.defaultValue : savedRow[target.field] });
    return groups;
  }, {});
  const groups = Object.values(recordGroups);
  const unavailableEdits = Object.entries(buffers).filter(([key]) => key === "private-notes" ? !row : bufferTarget(key) && !groups.some(group => group.edits.some(edit => edit.key === key)));
  const localDirtyRecords = Object.fromEntries(groups.map(group => [group.key, true]));
  const notesDirty = Object.hasOwn(buffers, "private-notes");
  const hasConflict = unsaved && !state.liveOnly && bufferRevision.current !== state.revision;
  const reviewEdits = [...groups.flatMap(group => group.edits), ...(notesDirty ? [{ key: "private-notes", definition: { label: "Private notes" }, saved: state.privateNotes?.[row?.id]?.value || "", value: buffers["private-notes"] }] : [])];
  const conflicts = reviewEdits.filter(edit => bufferBase.current[edit.key] !== display(edit.saved));
  const unresolved = conflicts.filter(edit => reviewedConflicts[edit.key] !== display(edit.saved));
  const definitionConflict = paraDirty && definitionSession && definitionBase.current !== JSON.stringify(definitionSession.saved);
  const definitionReviewed = !definitionConflict || reviewedConflicts.definition === JSON.stringify(definitionSession.saved);
  const clearBuffers = keys => setBuffers(current => { const next = { ...current }; for (const key of keys) { delete next[key]; delete bufferBase.current[key]; } return next; });
  async function saveRecord(group) {
    if (!group || busy || !state.writable) return false;
    let changes;
    try { changes = group.edits.map(edit => ({ field: edit.field, value: parseFieldValue(edit.value, edit.definition, edit.saved) })); }
    catch (failure) { setError(`Check ${group.label}: ${failure.message}`); return false; }
    const result = await act("record", { domain: group.domain, id: group.id, changes, expectedRevision: bufferRevision.current ?? state.revision });
    if (!result) return false;
    clearBuffers(group.edits.map(edit => edit.key));
    setNotice(`${group.label} · ${changes.length} change${changes.length === 1 ? "" : "s"} saved to the shared draft. Live content is unchanged.`);
    return true;
  }
  async function saveNotes() {
    if (!row) return false;
    const result = await act("notes", { id: row.id, value: buffers["private-notes"], expectedRevision: bufferRevision.current ?? state.revision });
    if (result) clearBuffers(["private-notes"]);
    return !!result;
  }
  async function saveDeparture() {
    if (unavailableEdits.length || hasConflict || scenarioDirty || creation || groups.length + Number(notesDirty) + Number(paraDirty) > 1) return false;
    if (groups.length) return saveRecord(groups[0]);
    if (notesDirty) return saveNotes();
    if (paraDirty) return !!await definitionSession?.save();
    return !unsaved;
  }
  const saveDisabledReason = unavailableEdits.length ? "The edited record is unavailable in the shared draft. Keep editing to copy the retained values, or discard them." : hasConflict ? "Review the latest shared values before saving." : scenarioDirty ? "This unsaved test setup has no draft save. Keep editing to start it, or discard it." : creation ? "Keep editing to finish creating this record, or discard the creation form." : groups.length + Number(notesDirty) + Number(paraDirty) > 1 ? "These are separate save scopes. Save each named record below; private notes remain separate." : paraDirty && !definitionSession ? "Keep editing to save this definition in its editor." : null;
  const saveScope = groups.length === 1 && !notesDirty && !paraDirty ? `Saves ${groups[0].edits.length} changed fields on ${groups[0].label} to the shared draft. Published content is unchanged.` : notesDirty && !groups.length && row ? `Saves only the private notes for ${title(row)}. Published content is unchanged.` : definitionSession?.label ? `Saves ${definitionSession.label} to the shared draft.` : "Save the selected records, keep editing, or discard only this browser’s changes.";
  function renderField(field, overrides = {}) {
    const selectedDomain = overrides.domain || domain, selectedRow = overrides.row || row;
    if (!selectedRow) return null;
    const key = `${selectedDomain}:${selectedRow.id}:${field}`;
    return <WorkshopField key={key} onReset={() => clearBuffers([key])} field={field} state={{ ...state, workshopMetadata: metadata }} domain={selectedDomain} row={selectedRow} buffer={buffers[key]} busy={busy} onInspect={inspect} onAsset={picker => setAssetPicker({ ...picker, baseRevision: unsaved ? bufferRevision.current : state.revision })} renderContract={overrides.renderContract} onEdit={(value, saved) => edit(key, value, saved)} />;
  }
  const creationControls = state.capabilities?.[({ encounters: "encounterCreation", factions: "factionCreation" })[domain] || "catalogCreation"] && ["cards", "sets", "decks", "offers", "encounters", "factions"].includes(domain) && <CatalogControls domain={domain} row={row} state={state} effects={metadata?.cardEffects} disabled={busy || !state.writable} creation={creation} value={buffers["catalog-create"] ? JSON.parse(buffers["catalog-create"]) : {}} onEdit={values => edit("catalog-create", JSON.stringify(values), "")} onOpen={nextDomain => leave(() => setCreation({ domain: nextDomain }))} onDuplicate={() => leave(() => setCreation({ domain, sourceId: row.id }))} onCancel={() => leave(() => setCreation(null))} onCreate={async values => {
        const result = await act("create", { ...values, expectedRevision: bufferRevision.current ?? state.revision });
        if (result) { setBuffers({}); setCreation(null); const added = result.draft.snapshot.domains[values.domain].at(-1); if (values.domain === "assets") { setVariantId(added.id); setCreatedTarget({ domain: "cards", id: added.gameplayCardId, section: "artwork" }); } else setCreatedTarget({ domain: values.domain, id: added.id }); }
      }} />;
  const search = <><BrowserControls label={area === "Game" ? "modes" : (DOMAINS[domain] || (domain === "asset-library" ? "media" : "rules")).toLowerCase()} rows={rows} snapshot={snapshot} query={query} onQuery={setQuery} filters={context.context} onFilters={context.remember} />{!creation && <div className="admin-browser-create">{creationControls}</div>}</>;
  const list = <ContentBrowser rows={visibleRows} total={rows.length} domain={domain} selected={row?.id} busy={busy} onSelect={id => inspect(domainChoice, id)} snapshot={snapshot} changes={state.changes} preview={preview || resolvedView} sort={context.context.sort} />;
  const presentation = (preview || resolvedView) && row && <Preview source={source} suit={suit} variantId={variantId} guide={guide} preview={preview || resolvedView} domain={domain} row={row} catalog={catalog} onClose={() => { setPreview(null); setResolvedView(null); }} />;
  const playtest = <GauntletPlaytest printingId={domain === "cards" ? snapshot.domains.assets.find(item => item.id === variantId && item.gameplayCardId === row?.id)?.id || row?.defaultVariantId : undefined} request={request} state={state} row={row} domain={domain} disabled={busy || unsaved || !metadata?.capabilities?.liveTests} onAuthoring={setState} session={session} onSession={setSession} onInspect={inspect} onBusy={setBusy} onRefresh={refresh} subjectTarget={context.target} metadata={metadata} scenario={scenario} onScenario={value => { setScenario(value); setScenarioDirty(true); }} onScenarioStarted={() => setScenarioDirty(false)} />;
  return <HelpProvider value={guide.help}><PrivateAssetProvider request={request}><EditorSessionContext.Provider value={{ register: registerEditor, requestLeave: leave, target: context.target, focusRequest: initialDomain }}>
    <Suspense fallback={<p role="status">Loading workshop…</p>}>
    <WorkshopNavigation target={context.target} focusRequest={initialDomain} ready={domainChoice === context.target.domain && selected === context.target.id && area !== "Publishing"} />
    {context.pending && <UnsavedChangesDialog onKeep={context.cancel} onDiscard={context.discard} onSave={context.saveAndContinue} saving={context.saving || busy} saveLabel={saveScope} saveDisabledReason={saveDisabledReason} error={context.saveError}>{groups.length + Number(notesDirty) > 1 && <div className="admin-actions">{groups.map(group => <button disabled={busy || hasConflict} key={group.key} onClick={() => saveRecord(group)}>Save {group.label}</button>)}{notesDirty && <button disabled={busy || hasConflict} onClick={saveNotes}>Save private notes only</button>}</div>}</UnsavedChangesDialog>}
    {(area === "Publishing" || context.backCount > 0) && <button className="admin-context-back" onClick={area === "Publishing" ? () => context.navigate(context.target) : context.back}>Back to previous view</button>}
    {assetPicker && <AssetPicker capacity={state.assetCapacity} provider={state.provider} request={request} busy={busy} onUpload={state.writable && state.capabilities?.imageUploads ? body => act("assets/upload", body) : null} onArchive={state.writable ? body => act("assets/archive", body) : null} library={state.assetLibrary || []} relationships={relationships} {...assetPicker} onSelect={value => { assetPicker.onSelect(value); bufferRevision.current = assetPicker.baseRevision; setAssetPicker(null); }} onClose={() => { if (!busy) setAssetPicker(null); }} />}

    {groups.length > 0 && <section className="admin-record-save" aria-label="Save record changes">{groups.map(group => <div key={group.key}><div><strong>{group.label}</strong><p className="admin-note">{group.edits.length} unsaved field{group.edits.length === 1 ? "" : "s"}: {group.edits.map(edit => edit.definition.label).join(", ")}. Saves only this record to the shared draft.</p></div><button className="admin-primary" disabled={busy || !state.writable} onClick={() => saveRecord(group)}>{busy ? "Saving…" : "Save changes"}<span className="sr-only"> to {group.label}</span></button></div>)}{notesDirty && <p className="admin-note">Private deck notes are separate. Save them in Private notes.</p>}</section>}
    {unavailableEdits.length > 0 && <div className="admin-alert"><p role="alert">{saveDisabledReason}</p><details><summary>Retained local values</summary><pre>{JSON.stringify(Object.fromEntries(unavailableEdits), null, 2)}</pre></details></div>}
    {hasConflict && <section className="admin-alert admin-conflict" aria-label="Reconcile shared changes"><h4>The shared draft changed</h4><p>Your input is retained. Review each changed value before retrying against revision {state.revision}.</p>{conflicts.map(edit => <article key={edit.key}><h5>{edit.definition.label}</h5><dl className="admin-conflict-values"><div><dt>When editing began</dt><dd>{bufferBase.current[edit.key] || "Empty"}</dd></div><div><dt>Latest shared draft</dt><dd>{display(edit.saved) || "Empty"}</dd></div><div><dt>Your local value</dt><dd>{edit.value || "Empty"}</dd></div></dl><div className="admin-actions"><button disabled={busy} aria-pressed={reviewedConflicts[edit.key] === display(edit.saved)} onClick={() => setReviewedConflicts(current => ({ ...current, [edit.key]: display(edit.saved) }))}>Keep my {edit.definition.label.toLowerCase()}</button><button disabled={busy} onClick={() => clearBuffers([edit.key])}>Use shared {edit.definition.label.toLowerCase()}</button></div></article>)}{definitionSession && <details><summary>Compare definition values</summary><p>Latest shared definition</p><pre>{JSON.stringify(definitionSession.saved, null, 2)}</pre><p>Your local definition</p><pre>{JSON.stringify(definitionSession.local, null, 2)}</pre>{definitionConflict && <button disabled={busy} aria-pressed={definitionReviewed} onClick={() => setReviewedConflicts(current => ({ ...current, definition: JSON.stringify(definitionSession.saved) }))}>Keep my definition after comparison</button>}</details>}<button disabled={busy || unresolved.length > 0 || !definitionReviewed} onClick={() => { bufferRevision.current = state.revision; setReviewedConflicts({}); for (const edit of reviewEdits) bufferBase.current[edit.key] = display(edit.saved); definitionBase.current = definitionSession ? JSON.stringify(definitionSession.saved) : null; setNotice(guide.retryReady); }}>Use latest revision for retry</button></section>}
    {state.authoringError && <p role="alert" className="admin-alert">{state.authoringError}</p>}
    {state.connectionRequired && <div className="admin-alert"><p role="alert">{guide.connectionRequired}</p><details><summary>Connection setup details</summary><p>{guide.connectionSetup}</p></details></div>}
    {!state.writable && !state.connectionRequired && !state.pending && !state.authoringError && <p role="alert" className="admin-alert">{guide.unavailable}</p>}
    {state.pending && <section className="admin-preview" aria-label="Publication progress"><h4>Publication: {state.pending.phase.replaceAll("-", " ")}</h4><p>{guide.deploymentPending}</p>{state.pending.url && <a href={state.pending.url} target="_blank" rel="noreferrer">View publication in GitHub</a>}<div className="admin-actions"><button disabled={busy} onClick={() => act("reconcile")}>Check publication</button>{state.pending.phase !== "deploying" && <button disabled={busy} onClick={() => setConfirm({ action: "cancel-publication" })}>Cancel publication</button>}</div></section>}
    {projectionError && <p role="status" className="admin-note">Workshop reference data: {projectionError}</p>}{error && <p role="alert" className="admin-alert">{error}</p>}{notice && <p role="status" className="admin-good">{notice}</p>}

    {creation && creationControls}
    {area === "Ranked & Gauntlet" ? <CompetitionWorkshop initialTarget={definitionTarget?.kind === "competition" ? definitionTarget : null} key={paraEditor} state={state} act={act} busy={busy} onDirty={onParaDirty} /> : ["Para League & Economy", "Competition", "Economy"].includes(area) ? (state.para ? <GauntletParaLeague initialTarget={definitionTarget?.kind === "para" ? definitionTarget : null} key={`${paraEditor}-${area}`} scope={area} state={state} act={act} busy={busy} request={request} onDirty={onParaDirty} preview={preview} /> : <p role="status">Definitions are unavailable until shared authoring reconnects.</p>) : area === "Publishing" ? <>
      <p className="admin-lede">{guide.publishingHelp}</p>
      <details className="admin-json"><summary>{guide.releaseIdentity}</summary><p className="admin-note">Active release: <code>{state.activeReleaseId}</code><br />Draft revision: {state.revision}<br />{state.storage}</p></details>
      <ReleaseReview onValidate={() => act("validate")} onPreview={() => act("preview")} state={state} review={review} busy={busy} unsaved={unsaved} onInspect={inspect} releaseName={releaseName} onReleaseName={setReleaseName} onPublish={() => setConfirm({ action: "publish", label: releaseName })} onDiscard={() => setConfirm({ action: "discard" })} />
      <section className="admin-recovery" aria-label="Release recovery"><h4>Release history and rollback</h4><div className="admin-releases">{[...state.releases].reverse().map((release) => <article className="admin-source" key={release.id}><h5>{release.label} {release.id === state.activeReleaseId && <span className="admin-badge">Active</span>}</h5><p className="admin-note">{new Date(release.createdAt).toLocaleString()} · {release.compatible ? "Compatible" : "Engine incompatible"}</p>{release.rollbackBlocked && <p className="admin-note">{release.rollbackBlocked}</p>}<details className="admin-json"><summary>Advanced / Technical · release identity</summary><code>{release.id}</code><p className="admin-note">SHA-256 {release.sha256}</p></details><button disabled={busy} onClick={async () => { try { const value = await request(`/api/admin/workshops/releases/${encodeURIComponent(release.id)}/review`); setReview(current => ({ ...current, comparison: value })); } catch (failure) { setError(failure.message); } }}>Compare with live</button><button disabled={busy || unsaved || !state.writable || !!state.draft || !release.compatible || !!release.rollbackBlocked || release.id === state.activeReleaseId} onClick={() => setConfirm({ action: "rollback", releaseId: release.id, label: release.label })}>Restore {release.label}</button></article>)}</div>
      <details className="admin-json"><summary>Activation history</summary><pre>{JSON.stringify(state.activations, null, 2)}</pre></details></section>
    </> : <>
      {domain === "decks" ? <DeckWorkshop section={context.target.section} onSection={section => context.navigate({ ...context.target, section })} onSelectList={leave} unsaved={unsaved} onReview={() => onNavigate("Publishing")} row={row} state={{ ...state, relationshipData: relationships, previewContent: preview || resolvedView }} fields={Object.keys(fields).map(renderField)} list={list} search={search} playtest={playtest} onInspect={inspect} busy={busy} notes={buffers["private-notes"] ?? state.privateNotes?.[row?.id]?.value ?? ""} onNotes={value => edit("private-notes", value, state.privateNotes?.[row?.id]?.value || "")} onSaveNotes={saveNotes} /> : domain === "offers" ? <OfferWorkshop section={context.target.section} onSection={section => context.navigate({ ...context.target, section })} onSelectList={leave} unsaved={unsaved} busy={busy} onReview={() => onNavigate("Publishing")} row={row} state={{ ...state, relationshipData: relationships, previewContent: preview || resolvedView }} fields={Object.keys(fields).map(renderField)} list={list} search={search} onInspect={inspect} /> : domain === "cards" ? <CardWorkshop onCreatePrinting={sourceId => leave(() => setCreation({ domain: "assets", gameplayCardId: row.id, ...(sourceId ? { sourceId } : {}) }))} busy={busy} section={context.target.section} onSection={section => context.navigate({ ...context.target, section })} onSelectList={leave} row={row} state={{ ...state, localDirtyRecords, workshopMetadata: metadata, relationshipData: relationships, previewContent: preview || resolvedView }} field={renderField} preview={presentation} playtest={playtest} onInspect={inspect} onReview={() => onNavigate("Publishing")} search={search} list={list} unsaved={unsaved} suit={suit} onSuit={setSuit} variantId={variantId} onVariantChange={setVariantId} /> : ENGINE_DOMAINS.includes(domainChoice) && area !== "Game" ? <EngineWorkshop key={paraEditor} act={act} onDirty={onParaDirty} onTest={(id, domain = "cards") => context.navigate({ domain, id, section: "test" })} busy={busy} onSelectList={leave} state={{ ...state, workshopMetadata: metadata, relationshipData: relationships }} field={renderField} playtest={playtest} onInspect={inspect} onReview={() => onNavigate("Publishing")} context={context.context} onContext={context.remember} target={context.target} onTarget={target => context.navigate(target)} /> : domain === "encounters" ? <EncounterWorkshop busy={busy} onSection={section => context.navigate({ ...context.target, section })} section={context.target.section} context={context.context} onContext={context.remember} row={row} state={state} unsaved={unsaved} session={session} list={list} search={<>{search}<label className="admin-search">Campaign<select aria-label="Filter encounters by campaign" value={context.context.campaign || ""} onChange={event => context.remember({ campaign: event.target.value })}><option value="">All campaigns</option>{snapshot.domains.campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.commanderName}</option>)}</select></label></>} field={renderField} preview={presentation} playtest={playtest} onInspect={inspect} onSelectList={action => leave(action)} onReview={() => onNavigate("Publishing")} /> : <>
      <WorkshopShell name={domain === "asset-library" ? "Media Workshop" : (DOMAINS[domain] || "Content") + " Workshop"} title={row ? contentName(row) : "Choose an item"} selectionId={row?.id} busy={busy} search={search} list={list} status={<span>{unsaved ? "Unsaved in this browser" : state.draft ? "Saved draft" : "Live content"}</span>} actions={<>{domain === "asset-library" && <button onClick={() => setAssetPicker({ value: row?.id, media: row?.mediaType?.startsWith("audio/") ? "audio" : "image", clearLabel: null, baseRevision: state.revision, onSelect: id => inspect("asset-library", id) })}>Browse & upload media</button>}<button onClick={() => onNavigate("Publishing")}>Review release</button></>} preview={presentation}>
        {row ? <><WorkshopSection id="workshop-details" title={domain === "asset-library" ? "Asset details" : "Record details"}><Validation guide={guide} validation={state.validation} domain={domain} id={row.id} />
          {domain === "asset-library" ? <><p>{row.description || row.source}</p>{row.mediaType?.startsWith("image/") ? <PrivateImage src={row.path} alt={contentName(row)} className="admin-art-preview" /> : <audio controls preload="none" src={row.path} />}<dl className="design-facts">{Object.entries({ "File type": row.mediaType, Version: row.version || "Immutable source", Dimensions: row.width ? row.width + " × " + row.height : "Not recorded", Availability: row.archived ? "Archived · references retained" : row.stage || "Available" }).map(([key,value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></> : !Object.keys(fields).length && <p>{guide.readOnly}</p>}
          {Object.keys(fields).map(renderField)}
          {domain === "sets" && <EditionPrintings state={state} setId={row.id} onInspect={inspect} />}
          </WorkshopSection><details className="admin-json"><summary>Advanced / Technical · identity and source</summary><code>{row.id}</code><p className="admin-note">Source boundary: {catalog?.domains[domain]?.find(entry => entry.id === row.id)?.source || "Versioned content contract"} · Draft revision: {state.revision}</p><p className="admin-note">{guide.engineHelp}</p><pre>{JSON.stringify(Object.fromEntries(Object.entries(row).filter(([key]) => !Object.hasOwn(fields, key))), null, 2)}</pre></details>
        </> : <div className="admin-empty"><h4>Choose your next piece of content</h4><p>Search the library or select an item to inspect its saved values, preview, and connections.</p></div>}
      {domain === "assets" && <details className="admin-json"><summary>Asset manifest · {state.live.engine.assetManifestVersion}</summary><pre>{JSON.stringify((state.assetLibrary || []).filter((asset) => asset.source === row?.art || asset.id === row?.art || asset.path === row?.art), null, 2)}</pre></details>}
      {area === "Game" && <><h4>Starting state</h4><p className="admin-note">{guide.engineSource}</p><pre className="admin-protected">{JSON.stringify(state.live.engine, null, 2)}</pre></>}
      {row && !["sets", "assets", "asset-library"].includes(domain) && <details className="admin-editor-test"><summary>Test saved content</summary>{playtest}</details>}{row && relationships && <WorkshopSection title="Related content" id="workshop-related"><RelatedContent data={relationships} domain={domain} id={row.id} onInspect={inspect} /></WorkshopSection>}
      {preview && !row && <p className="admin-good">{guide.previewSelection}</p>}
      </WorkshopShell>
      </>}
    </>}
    {domain === "encounters" && row && relationships && area !== "Publishing" && <RelatedContent data={relationships} domain={domain} id={row.id} onInspect={inspect} />}
    <div className="admin-shared-draft-tools">    <div className="admin-draft-bar"><div><strong>{state.draft ? `${changeCount} saved field change${changeCount === 1 ? "" : "s"}` : state.liveOnly ? "Live content · shared draft unavailable" : "Live content · no draft"}</strong><p className="admin-note">{unsaved ? "Unsaved changes in this browser. Saved previews exclude these edits." : "Saved to the shared draft is separate from published and verified active."}</p></div><div className="admin-actions" hidden={!state.draft}><button disabled={busy || unsaved || !state.draft || !state.writable} onClick={() => act("validate")}>Validate draft</button><button disabled={busy || unsaved || !state.draft || !state.validation.valid || !state.writable} onClick={() => act("preview")}>Preview saved draft</button></div></div>
    <details className="admin-json admin-global-validation" open={!state.validation.valid} hidden={area !== "Publishing" && !state.draft && state.validation.valid}><summary>Global validation · {state.validation.errors.length} errors · {state.validation.warnings.length} warnings</summary><Validation guide={guide} validation={state.validation} /></details></div>
    {confirm && <section ref={confirmationRef} tabIndex={-1} className="admin-confirm" aria-label="Confirm content operation"><h4>{confirm.action === "publish" ? `Publish ${confirm.label}?` : confirm.action === "rollback" ? `Restore ${confirm.label}?` : confirm.action === "cancel-publication" ? "Cancel this publication?" : "Discard the shared draft?"}</h4><p>{confirm.action === "cancel-publication" ? guide.cancelHelp : confirm.action === "discard" ? guide.discardHelp : guide.publishHelp}</p><div className="admin-actions"><button disabled={busy} onClick={async () => { if (await act(confirm.action, confirm)) { if (confirm.action === "discard") setBuffers({}); } }}>Confirm {confirm.action}</button><button disabled={busy} onClick={() => setConfirm(null)}>Cancel</button></div></section>}
    </Suspense>
  </EditorSessionContext.Provider></PrivateAssetProvider></HelpProvider>;
}
