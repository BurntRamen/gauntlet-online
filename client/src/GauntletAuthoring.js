import { HelpProvider } from "./admin/AuthoringHelp";
import { PrivateAssetProvider, PrivateImage, PrivateAudio } from "./admin/PrivateAsset";
import useWorkshopContext from "./admin/useWorkshopContext";
import UnsavedChangesDialog from "./admin/UnsavedChangesDialog";
import "./admin/TestHarness.css";
import ContentBrowser, { BrowserControls, contentName } from "./admin/ContentBrowser";
import WorkshopShell, { WorkshopSection, WorkshopFacts } from "./admin/WorkshopShell";
import { useCallback, useEffect, useRef, useState } from "react";
import Validation from "./admin/WorkshopValidation";
import { displayValue as display, parseFieldValue, bufferTarget } from "./admin/workshopValues";
import { EditorSessionContext } from "./admin/EditorSession";
import WorkshopField from "./admin/WorkshopField";
import CatalogControls from "./admin/CatalogControls";
import WorkshopNavigation from "./admin/WorkshopNavigation";
import Preview from "./admin/WorkshopPreview";
import EncounterWorkshop from "./EncounterWorkshop";
import GauntletPlaytest from "./GauntletPlaytest";
import { EditionPrintings } from "./admin/PrintingWorkshop";
import DeckWorkshop from "./admin/DeckWorkshop";
import OfferWorkshop from "./admin/OfferWorkshop";
import CardWorkshop from "./admin/CardWorkshop";
import EngineWorkshop from "./admin/EngineWorkshop";
import AssetPicker from "./admin/AssetPicker";
import ReleaseReview from "./admin/ReleaseReview";
import RelatedContent from "./admin/RelatedContent";
import GauntletParaLeague from "./GauntletParaLeague";
import CompetitionWorkshop from "./admin/CompetitionWorkshop";
import WebsiteProseWorkshop from "./admin/WebsiteProseWorkshop";
import ProductionGuide from "./admin/ProductionGuide";
import ProductionPipeline from "./admin/ProductionPipeline";
import { useOperatorPreferences } from "./admin/OperatorPreferences";
const ENGINE_DOMAINS = ["rule-modifiers", "mechanics", "card-effects", "faction-effects", "encounter-mechanics", "game"];
function domainRows(state, domain) {
  const snapshot = state?.draft?.snapshot || state?.live;
  if (domain.startsWith("competition:") || domain.startsWith("para:")) return snapshot?.[domain.startsWith("para:") ? "paraLeague" : "competition"]?.[domain.split(":")[1]] || [];
  return (domain === "asset-library" ? state?.assetLibrary : domain === "rule-modifiers" ? snapshot?.studio?.modifiers : domain === "sets" ? state?.printingEditions || snapshot?.domains.sets : snapshot?.domains[domain]) || [];
}

export default function GauntletAuthoring({ request, area, initialDomain = null, revision, catalog, onPublished, guard, onNavigate, beforeNavigate, onExit, onStatus }) {
  const [state, setState] = useState(null);
  const guide = state?.guide || {};
  const help = guide.help || {};
  const operator = useOperatorPreferences();
  const task = operator?.preferences.task;
  const taskDefinition = guide.pipelines?.find(item => item.id === task?.id);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
  const [reviewError, setReviewError] = useState("");
  const [returnView, setReturnView] = useState(null);
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
  const [paraDirty, setParaDirty] = useState(false), [paraEditor, setParaEditor] = useState(0);
  const onParaDirty = useCallback(dirty => {
    if (dirty) bufferRevision.current ??= latest.current.state?.revision;
    else { definitionBase.current = null; if (!Object.keys(latest.current.buffers || {}).length) bufferRevision.current = null; }
    setParaDirty(dirty);
  }, []);
  const unsaved = Object.keys(buffers).length > 0 || paraDirty;
  const context = useWorkshopContext({
    initialTarget: { domain: initialDomain?.name || "cards", id: initialDomain?.id || null, section: initialDomain?.section, field: initialDomain?.field },
    dirty: unsaved || scenarioDirty, busy, onSave: saveDeparture, onDiscard: () => { if (definitionSession) definitionSession.discard?.(); else setParaEditor(value => value + 1); setCreation(null); setParaDirty(false); setBuffers({}); bufferBase.current = {}; bufferRevision.current = null; setScenario(null); setScenarioDirty(false); },
    beforeNavigate, onExit,
    onBusy: () => setNotice(help.workspaceBusy),
    onNavigate: (target) => {
      if (target.domain !== domainChoice || target.id !== selected) { setCreation(null); setScenario(null); setScenarioDirty(false); }
      if (target.domain.includes(":")) {
        const [kind, definitionDomain] = target.domain.split(":"), economy = kind === "para" && (["awards", "products", "entitlements"].includes(definitionDomain) || definitionDomain === "seasons" && (area === "Economy" || task?.id === "economy"));
        setDefinitionTarget({ kind, domain: definitionDomain, id: target.id, field: target.field });
        onNavigate?.(economy ? "Store & Economy" : "Competition", undefined, undefined, undefined, undefined, undefined, { internal: true, workspace: economy ? "Gold & Rewards" : kind === "competition" ? "Ranked & Gauntlet" : help.workspaceCopy1 });
        return;
      }
      const nextArea = target.domain === "offers" ? "Store & Economy" : "Content";
      onNavigate?.(nextArea, undefined, undefined, undefined, undefined, undefined, { internal: true });
    }
  });
  const { domain: domainChoice, id: selected } = context.target;
  useEffect(() => {
    if (domainChoice.includes(":")) context.navigate(context.target);
  // Restore a typed registry route after reload; ordinary moves already notify the parent.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainChoice]);
  const requestedTask = context.target.section?.startsWith("pipeline-") ? context.target.section.slice(9) : null;
  useEffect(() => {
    if (!requestedTask || !guide.pipelines?.some(item => item.id === requestedTask)) return;
    operator?.update({ task: { id: requestedTask, root: null } });
    context.navigate({ ...context.target, section: null });
  }, [requestedTask, guide.pipelines, operator, context]);
  useEffect(() => {
    if (taskDefinition && !task.root && taskDefinition.domain === domainChoice && selected) operator?.update({ task: { ...task, root: selected } });
  }, [taskDefinition, task, domainChoice, selected, operator]);
  const domain = domainChoice === "modes" ? "game" : domainChoice;
  const query = context.context.query || "";
  const setQuery = value => context.remember({ query: value });
  const leave = context.requestLeave;
  useEffect(() => { if (createdTarget && !busy && !unsaved) { context.navigate(createdTarget); setCreatedTarget(null); } }, [createdTarget, busy, unsaved, context]);
  useEffect(() => { if (guard) guard.current = leave; return () => { if (guard) guard.current = (action) => { action?.(); return true; }; }; }, [guard, leave]);
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
    let active = true; setReview(null); setReviewError("");
    request("/api/admin/workshops/review").then(value => { if (active && value.groups) setReview(value); }).catch(failure => { if (active) setReviewError(failure.message); });
    return () => { active = false; };
  }, [request, area, state]);
  useEffect(() => {
    if (!returnView?.returning || area !== returnView.area || (area === "Publishing" && review?.revision !== state?.revision)) return;
    window.scrollTo(0, returnView.scroll);
    (document.getElementById(area === "Publishing" ? "review-blockers" : "admin-validation") || document.getElementById("review-publish"))?.focus();
    setReturnView(null);
  }, [area, review, state?.revision, returnView]);
  function edit(key, value, saved) {
    if (!unsaved) bufferRevision.current = state.revision;
    if (!Object.hasOwn(buffers, key)) bufferBase.current[key] = display(saved);
    setReviewedConflicts(current => { const next = { ...current }; delete next[key]; return next; });
    const target = bufferTarget(key), definition = target && state.fields[target.domain]?.[target.id]?.[target.field];
    const savedText = definition?.type === "card-list" ? JSON.stringify(saved) : display(saved);
    setBuffers((current) => { const next = { ...current }; if (value === savedText) delete next[key]; else next[key] = value; return next; });
  }
  useEffect(() => {
    const row = domainRows(state, domain).find(row => row.id === selected);
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
  function inspect(nextDomain, id, field, explicitField, accepted) {
    const explicitSection = arguments.length >= 4 ? field : null;
    if (arguments.length >= 4) field = explicitField;
    if (nextDomain.startsWith("competition:") || nextDomain.startsWith("para:")) return context.navigate({ domain: nextDomain, id, field }, accepted);
    nextDomain = ({ "studio:mechanics": "mechanics", "studio:modifiers": "rule-modifiers" })[nextDomain] || nextDomain;
    const saved = context.target.domain === nextDomain && context.target.id === id ? context.target : context.contexts[nextDomain]?.target;
    const section = !field ? saved?.id === id ? saved.section : null : nextDomain === "cards" ? field === "effect" ? "mechanics" : "identity" : nextDomain === "encounters" ? field === "setup" || field === "opponentDeckId" || field === "ruleModifierId" ? "setup" : /audio|image|art/i.test(field) ? "assets" : "story" : nextDomain === "decks" ? field === "composition" ? "composition" : "details" : nextDomain === "offers" ? "details" : null;
    return context.navigate({ section: explicitSection || section, field, domain: nextDomain === "game" && id && id !== "shared-rules" ? "modes" : nextDomain, id }, accepted);
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
        const deploying = state.pending.phase === "deploying" && !state.publication?.dataOnly;
        const result = await request(deploying ? "/api/admin/authoring" : "/api/admin/authoring/reconcile", deploying ? undefined : { method: "POST", body: "{}" });
        if (active) { setState(result); if (!result.pending) onPublished(); }
      } catch (failure) { if (active) setError(failure.message); }
    }, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [state?.pending, state?.connectionRequired, state?.publication?.dataOnly, request, onPublished]);
  async function act(action, body = {}) {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await request(`/api/admin/authoring/${action}`, { method: ["draft", "record", "notes"].includes(action) ? "PATCH" : "POST", body: JSON.stringify({ expectedRevision: ["para-draft", "competition-draft", "studio-draft"].includes(action) ? bufferRevision.current ?? state.revision : state.revision, ...body }) });
      setState(result); if (!action.startsWith("assets/") || bufferRevision.current == null || bufferRevision.current === state.revision) bufferRevision.current = result.revision;
      if (action.startsWith("assets/")) setAssetPicker(current => current && ({ ...current, baseRevision: current.baseRevision === state.revision ? result.revision : current.baseRevision }));
      setPreview(result.preview || null); setConfirm(null);
      if (action === "publish" || action === "rollback") { setReleaseName(""); onPublished(); }
      setNotice(result.pending ? guide.publicationPending : ["para-draft", "competition-draft", "studio-draft"].includes(action) ? result.notice || help.workspaceDefinitionSaved : action === "assets/upload" ? help.workspaceImageUploaded : action === "assets/archive" ? help.workspaceAssetArchived : action === "create" ? help.workspaceContentCreated : action === "notes" ? help.workspaceNotesSaved : action === "draft" ? guide.fieldSaved : action === "publish" ? guide.published : action === "rollback" ? help.workspaceReleaseRestored : action === "discard" ? help.workspaceDraftDiscarded : action === "validate" ? help.workspaceDraftValidated : help.workspacePreviewReady);
      return result;
    } catch (failure) { setError(failure.message); if (failure.status === 409) await refresh(); if (action === "assets/upload") throw failure; return false; }
    finally { setBusy(false); }
  }
  if (!state) return <p role={error ? "alert" : "status"}>{error || help.workspaceCopy2}</p>;
  if (guide.workspaceVersion !== 1) return <p role="status">{help.workspaceCopy3}</p>;
  const DOMAINS = { ...guide.domains, game: "Website prose", sets: "Sets", decks: "Decks", offers: "Store", assets: "Collector artwork" };
  const snapshot = state.draft?.snapshot || state.live;
  const previewContent = preview || resolvedView;
  const rows = domainRows(state, domain).filter(entry => domainChoice !== "modes" || entry.id !== "shared-rules");
  const visibleRows = rows.filter(entry => domain !== "encounters" || !context.context.campaign || entry.campaignId === context.context.campaign).filter(entry => !context.context.faction || (entry.factionId || entry.composition?.factionId) === context.context.faction).filter((entry) => `${contentName(entry)} ${entry.id} ${entry.factionId || entry.composition?.factionId || ""}`.toLowerCase().includes(query.toLowerCase()));
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
    groups[groupKey] ||= { key: groupKey, domain: target.domain, id: target.id, row: savedRow, label: `${target.domain === "assets" ? "Printing" : (DOMAINS[target.domain] || target.domain).replace(/s$/, "")} · ${contentName(savedRow)}`, edits: [] };
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
  const saveDisabledReason = unavailableEdits.length ? help.workspaceRecordUnavailable : hasConflict ? help.workspaceConflictSave : scenarioDirty ? help.workspaceScenarioSave : creation ? help.workspaceCreationSave : groups.length + Number(notesDirty) + Number(paraDirty) > 1 ? help.workspaceSeparateScopes : paraDirty && !definitionSession ? help.workspaceDefinitionSave : null;
  const saveScope = groups.length === 1 && !notesDirty && !paraDirty ? `Saves ${groups[0].edits.length} changed fields on ${groups[0].label} to the shared draft. Published content is unchanged.` : notesDirty && !groups.length && row ? `Saves only the private notes for ${contentName(row)}. Published content is unchanged.` : definitionSession?.label ? `Saves ${definitionSession.label} to the shared draft.` : help.workspaceDepartureScope;
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
  const search = <><BrowserControls label={(DOMAINS[domain] || (domain === "asset-library" ? "media" : "rules")).toLowerCase()} rows={rows} snapshot={snapshot} query={query} onQuery={setQuery} filters={context.context} onFilters={context.remember} />{!creation && <div className="admin-browser-create">{creationControls}</div>}</>;
  const list = <ContentBrowser rows={visibleRows} total={rows.length} domain={domain} selected={row?.id} busy={busy} onSelect={id => inspect(domainChoice, id)} snapshot={snapshot} changes={state.changes} preview={previewContent} sort={context.context.sort} position={context.context.browserScroll} onPosition={browserScroll => context.remember({ browserScroll })} />;
  const presentation = previewContent && row && <Preview source={source} suit={suit} variantId={variantId} guide={guide} preview={previewContent} domain={domain} row={row} catalog={catalog} onClose={() => { setPreview(null); setResolvedView(null); }} />;
  const playtest = <GauntletPlaytest printingId={domain === "cards" ? snapshot.domains.assets.find(item => item.id === variantId && item.gameplayCardId === row?.id)?.id || row?.defaultVariantId : undefined} request={request} state={state} row={row} domain={domain} disabled={busy || unsaved || !metadata?.capabilities?.liveTests} onAuthoring={setState} session={session} onSession={setSession} onInspect={inspect} onBusy={setBusy} onRefresh={refresh} subjectTarget={context.target} metadata={metadata} scenario={scenario} onScenario={value => { setScenario(value); setScenarioDirty(true); }} onScenarioStarted={() => setScenarioDirty(false)} />;
  const reviewRelease = () => onNavigate("Publishing");
  const Editor = domainChoice === "modes" ? WebsiteProseWorkshop : ({ decks: DeckWorkshop, offers: OfferWorkshop, cards: CardWorkshop, encounters: EncounterWorkshop })[domain] || (ENGINE_DOMAINS.includes(domainChoice) ? EngineWorkshop : null);
  const inspectIssue = (...target) => leave(() => { setReturnView({ area, target: context.target, scroll: window.scrollY }); inspect(...target); });
  const beginCreation = (next, accepted) => context.navigate({ domain: next.domain }, () => { setCreation(next); accepted?.(); });
  const production = metadata?.capabilities?.productionGuide && <ProductionGuide request={request} domain={domain} id={row?.id} source={source} hash={state.draft?.hash || metadata?.hash} revision={state.revision} busy={busy} onInspect={inspect} onReview={reviewRelease} state={state} unsaved={unsaved} onCreate={beginCreation} />;
  const editorProps = {
    row, state: { ...state, localDirtyRecords, workshopMetadata: metadata, relationshipData: relationships, previewContent }, busy, unsaved, search, list, playtest,
    field: renderField, onInspect: inspect, onReview: reviewRelease, preview: presentation,
    section: context.target.section, onSection: section => context.navigate({ ...context.target, section }), context: context.context, onContext: context.remember
  };
  if (domainChoice === "modes") Object.assign(editorProps, { target: context.target, onTarget: context.navigate });
  if (domain === "cards") Object.assign(editorProps, { suit, onSuit: setSuit, variantId, onVariantChange: setVariantId,
    onCreatePrinting: sourceId => leave(() => setCreation({ domain: "assets", gameplayCardId: row.id, ...(sourceId ? { sourceId } : {}) })) });
  if (["decks", "offers"].includes(domain)) editorProps.fields = Object.keys(fields).map(renderField);
  if (domain === "decks") Object.assign(editorProps, { notes: buffers["private-notes"] ?? state.privateNotes?.[row?.id]?.value ?? "", onNotes: value => edit("private-notes", value, state.privateNotes?.[row?.id]?.value || ""), onSaveNotes: saveNotes });
  if (Editor === EngineWorkshop) Object.assign(editorProps, { act, onDirty: onParaDirty, onTest: (id, domain = "cards") => context.navigate({ domain, id, section: "test" }), target: context.target, onTarget: context.navigate });
  if (domain === "encounters") Object.assign(editorProps, { session, search: <>{search}<label className="admin-search">Campaign<select aria-label={help.workspaceCopy4} value={context.context.campaign || ""} onChange={event => context.remember({ campaign: event.target.value })}><option value="">{help.workspaceCopy5}</option>{snapshot.domains.campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.commanderName}</option>)}</select></label></> });
  return <HelpProvider value={guide.help}><PrivateAssetProvider request={request}><EditorSessionContext.Provider value={{ register: registerEditor, requestLeave: leave, target: context.target, focusRequest: initialDomain, production }}>
    <WorkshopNavigation target={context.target} focusRequest={initialDomain} ready={area !== "Publishing" && !domainChoice.includes(":")} />
    {context.pending && <UnsavedChangesDialog onKeep={context.cancel} onDiscard={context.discard} onSave={context.saveAndContinue} saving={context.saving || busy} saveLabel={saveScope} saveDisabledReason={saveDisabledReason} error={context.saveError}>{groups.length + Number(notesDirty) > 1 && <div className="admin-actions">{groups.map(group => <button disabled={busy || hasConflict} key={group.key} onClick={() => saveRecord(group)}>Save {group.label}</button>)}{notesDirty && <button disabled={busy || hasConflict} onClick={saveNotes}>{help.workspaceCopy6}</button>}</div>}</UnsavedChangesDialog>}
    {(area === "Publishing" || context.backCount > 0) && <button className="admin-context-back" onClick={area === "Publishing" ? () => context.navigate(context.target) : context.back}>{help.workspaceCopy7}</button>}
    {returnView && !returnView.returning && (area !== returnView.area || JSON.stringify(context.target) !== JSON.stringify(returnView.target)) && <button className="admin-context-back" onClick={() => leave(() => { setReturnView({ ...returnView, returning: true }); context.navigate(returnView.target); requestAnimationFrame(() => onNavigate(returnView.area)); })}>{returnView.area === "Publishing" ? help.workspaceCopy8 : help.workspaceCopy9}</button>}
    {assetPicker && <AssetPicker capacity={state.assetCapacity} provider={state.provider} request={request} busy={busy} onMigrate={state.writable && state.capabilities?.remoteMedia ? () => act("assets/migrate", {}) : null} onUpload={state.writable && state.capabilities?.[assetPicker.media === "audio" ? "audioUploads" : "imageUploads"] ? body => act("assets/upload", body) : null} onArchive={state.writable ? body => act("assets/archive", body) : null} library={state.assetLibrary || []} relationships={relationships} {...assetPicker} onSelect={value => { assetPicker.onSelect(value); bufferRevision.current = assetPicker.baseRevision; setAssetPicker(null); }} onClose={() => { if (!busy) setAssetPicker(null); }} />}

    {groups.length > 0 && <section className="admin-record-save" aria-label={help.workspaceCopy10}>{groups.map(group => <div key={group.key}><div><strong>{group.label}</strong><p className="admin-note">{group.edits.length}{help.workspaceCopy11}{group.edits.length === 1 ? "" : "s"}: {group.edits.map(edit => edit.definition.label).join(", ")}. {help.workspaceRecordBoundary}</p></div><button className="admin-primary" disabled={busy || !state.writable} onClick={() => saveRecord(group)}>{busy ? "Saving…" : "Save changes"}<span className="sr-only"> to {group.label}</span></button></div>)}{notesDirty && <p className="admin-note">{help.workspacePrivateNotes}</p>}</section>}
    {unavailableEdits.length > 0 && <div className="admin-alert"><p role="alert">{saveDisabledReason}</p><details><summary>{help.workspaceCopy12}</summary><pre>{JSON.stringify(Object.fromEntries(unavailableEdits), null, 2)}</pre></details></div>}
    {hasConflict && <section className="admin-alert admin-conflict" aria-label={help.workspaceCopy13}><h4>{help.workspaceCopy14}</h4><p>{help.workspaceConflictReview}{state.revision}.</p>{conflicts.map(edit => <article key={edit.key}><h5>{edit.definition.label}</h5><dl className="admin-conflict-values"><div><dt>{help.workspaceCopy15}</dt><dd>{bufferBase.current[edit.key] || "Empty"}</dd></div><div><dt>{help.workspaceCopy16}</dt><dd>{display(edit.saved) || "Empty"}</dd></div><div><dt>{help.workspaceCopy17}</dt><dd>{edit.value || "Empty"}</dd></div></dl><div className="admin-actions"><button disabled={busy} aria-pressed={reviewedConflicts[edit.key] === display(edit.saved)} onClick={() => setReviewedConflicts(current => ({ ...current, [edit.key]: display(edit.saved) }))}>Keep my {edit.definition.label.toLowerCase()}</button><button disabled={busy} onClick={() => clearBuffers([edit.key])}>Use shared {edit.definition.label.toLowerCase()}</button></div></article>)}{definitionSession && <details><summary>{help.workspaceCopy18}</summary><p>{help.workspaceCopy19}</p><pre>{JSON.stringify(definitionSession.saved, null, 2)}</pre><p>{help.workspaceCopy20}</p><pre>{JSON.stringify(definitionSession.local, null, 2)}</pre>{definitionConflict && <button disabled={busy} aria-pressed={definitionReviewed} onClick={() => setReviewedConflicts(current => ({ ...current, definition: JSON.stringify(definitionSession.saved) }))}>{help.workspaceCopy21}</button>}</details>}<button disabled={busy || unresolved.length > 0 || !definitionReviewed} onClick={() => { bufferRevision.current = state.revision; setReviewedConflicts({}); for (const edit of reviewEdits) bufferBase.current[edit.key] = display(edit.saved); definitionBase.current = definitionSession ? JSON.stringify(definitionSession.saved) : null; setNotice(guide.retryReady); }}>{help.workspaceCopy22}</button></section>}
    {state.authoringError && <p role="alert" className="admin-alert">{state.authoringError}</p>}
    {state.connectionRequired && <div className="admin-alert"><p role="alert">{guide.connectionRequired}</p><details><summary>{help.workspaceCopy23}</summary><p>{guide.connectionSetup}</p></details></div>}
    {!state.writable && !state.connectionRequired && !state.pending && !state.authoringError && <p role="alert" className="admin-alert">{guide.unavailable}</p>}
    {state.pending && <section className="admin-preview" aria-label={help.workspaceCopy24}><h4>{help.workspaceCopy25}{state.pending.phase.replaceAll("-", " ")}</h4><p>{guide.deploymentPending}</p>{state.pending.url && <a href={state.pending.url} target="_blank" rel="noreferrer">{help.workspaceCopy26}</a>}<div className="admin-actions"><button disabled={busy} onClick={() => act("reconcile")}>{help.workspaceCopy27}</button>{state.pending.phase !== "deploying" && <button disabled={busy} onClick={() => setConfirm({ action: "cancel-publication" })}>{help.workspaceCopy28}</button>}</div></section>}
    {projectionError && <p className="admin-note" role="status">{help.workspaceCopy29}{projectionError}</p>}{error && <p role="alert" className="admin-alert">{error}</p>}{notice && <p role="status" className="admin-good">{notice}</p>}

    {taskDefinition && <ProductionPipeline key={task.id} request={request} state={state} task={task} busy={busy} unsaved={unsaved}
      onRoot={id => leave(() => { operator.update({ task: { ...task, root: id } }); inspect(taskDefinition.domain, id); })}
      onClose={() => operator.update({ task: null })} onInspect={inspect} onCreate={beginCreation} onReview={reviewRelease} />}
    {creation && creationControls}
    {area === "Ranked & Gauntlet" ? <CompetitionWorkshop onSelect={(domain, id) => setCreatedTarget({ domain: "competition:" + domain, id })} initialTarget={definitionTarget?.kind === "competition" ? definitionTarget : null} key={paraEditor} state={state} act={act} busy={busy} onDirty={onParaDirty} /> : ["Para League & Economy", "Competition", "Economy"].includes(area) ? (state.para ? <GauntletParaLeague onSelect={(domain, id) => setCreatedTarget({ domain: "para:" + domain, id })} initialTarget={definitionTarget?.kind === "para" ? definitionTarget : null} key={`${paraEditor}-${area}`} scope={area} state={state} act={act} busy={busy} request={request} onDirty={onParaDirty} preview={preview} /> : <p role="status">{help.workspaceDefinitionsUnavailable}</p>) : area === "Publishing" ? <>
      <ReleaseReview onValidate={() => act("validate")} onPreview={() => act("preview")} state={state} review={review} error={reviewError} onRetry={refresh} busy={busy} unsaved={unsaved} onInspect={inspectIssue} releaseName={releaseName} onReleaseName={setReleaseName} onPublish={() => setConfirm({ action: "publish", label: releaseName })} onDiscard={() => setConfirm({ action: "discard" })} />
      <details className="admin-json"><summary>{help.workspaceCopy30}</summary><p>{guide.publishingHelp}</p><p>{help.workspaceCopy31}<code>{state.activeReleaseId}</code><br />{help.workspaceCopy32}{state.revision}<br />{state.storage}</p></details>
      <section className="admin-recovery" aria-label={help.workspaceCopy33}><h4>{help.workspaceCopy34}</h4><div className="admin-releases">{[...state.releases].reverse().map((release) => <article className="admin-source" key={release.id}><h5>{release.label} {release.id === state.activeReleaseId && <span className="admin-badge">Active</span>}</h5><p className="admin-note">{new Date(release.createdAt).toLocaleString()} · {release.compatible ? "Compatible" : help.workspaceCopy35}</p>{release.rollbackBlocked && <p className="admin-note">{release.rollbackBlocked}</p>}<details className="admin-json"><summary>{help.workspaceCopy36}</summary><code>{release.id}</code><p className="admin-note">SHA-256 {release.sha256}</p></details><button disabled={busy} onClick={async () => { try { const value = await request(`/api/admin/workshops/releases/${encodeURIComponent(release.id)}/review`); setReview(current => ({ ...current, comparison: value })); } catch (failure) { setError(failure.message); } }}>{help.workspaceCopy37}</button><button disabled={busy || unsaved || !state.writable || !!state.draft || !release.compatible || !!release.rollbackBlocked || release.id === state.activeReleaseId} onClick={() => setConfirm({ action: "rollback", releaseId: release.id, label: release.label })}>Restore {release.label}</button></article>)}</div>
      <details className="admin-json"><summary>{help.workspaceCopy38}</summary><pre>{JSON.stringify(state.activations, null, 2)}</pre></details></section>
    </> : <>

      {Editor ? <Editor key={Editor === EngineWorkshop ? paraEditor : undefined} {...editorProps} /> : <>
      <WorkshopShell name={domain === "asset-library" ? "Media Workshop" : (DOMAINS[domain] || "Content") + " Workshop"} title={row ? contentName(row) : "Choose an item"} selectionId={row?.id} busy={busy} search={search} list={list} status={<span>{unsaved ? help.workspaceCopy39 : state.draft ? "Saved draft" : "Live content"}</span>} actions={<>{domain === "asset-library" && <button onClick={() => setAssetPicker({ value: row?.id, media: row?.mediaType?.startsWith("audio/") ? "audio" : "image", clearLabel: null, baseRevision: state.revision, onSelect: id => inspect("asset-library", id) })}>{help.workspaceCopy40}</button>}<button onClick={reviewRelease}>{help.workspaceCopy41}</button></>} preview={presentation}>
        {row ? <><WorkshopSection id="workshop-details" title={domain === "asset-library" ? "Asset details" : "Record details"}><Validation guide={guide} validation={state.validation} domain={domain} id={row.id} />
          {domain === "asset-library" ? <><p>{row.description || row.source}</p>{row.mediaType?.startsWith("image/") ? <PrivateImage src={row.path} alt={contentName(row)} className="admin-art-preview" /> : <PrivateAudio src={row.path} label={contentName(row)} />}<WorkshopFacts values={{ "File type": row.mediaType, Version: row.version || help.workspaceCopy42, Dimensions: row.width ? row.width + " × " + row.height : "Not recorded", Availability: row.archived ? help.workspaceCopy43 : row.stage || "Available" }} /></> : !Object.keys(fields).length && <p>{guide.readOnly}</p>}
          {Object.keys(fields).map(renderField)}
          {domain === "sets" && <EditionPrintings state={state} setId={row.id} onInspect={inspect} />}
          </WorkshopSection><details className="admin-json"><summary>{help.workspaceCopy44}</summary><code>{row.id}</code><p className="admin-note">{help.workspaceCopy45}{catalog?.domains[domain]?.find(entry => entry.id === row.id)?.source || help.workspaceCopy46}{help.workspaceCopy47}{state.revision}</p><p className="admin-note">{guide.engineHelp}</p><pre>{JSON.stringify(Object.fromEntries(Object.entries(row).filter(([key]) => !Object.hasOwn(fields, key))), null, 2)}</pre></details>
        </> : <div className="admin-empty"><h4>{help.workspaceCopy48}</h4><p>{help.workspaceChooseContent}</p></div>}
      {domain === "assets" && <details className="admin-json"><summary>{help.workspaceCopy49}{state.live.engine.assetManifestVersion}</summary><pre>{JSON.stringify((state.assetLibrary || []).filter((asset) => asset.source === row?.art || asset.id === row?.art || asset.path === row?.art), null, 2)}</pre></details>}
      {row && !["sets", "assets", "asset-library"].includes(domain) && <details className="admin-editor-test"><summary>{help.workspaceCopy50}</summary>{playtest}</details>}{row && relationships && <WorkshopSection title="Related content" id="workshop-related"><RelatedContent data={relationships} domain={domain} id={row.id} onInspect={inspect} /></WorkshopSection>}
      {preview && !row && <p className="admin-good">{guide.previewSelection}</p>}
      </WorkshopShell>
      </>}
    </>}
    {domain === "encounters" && row && relationships && area !== "Publishing" && <RelatedContent data={relationships} domain={domain} id={row.id} onInspect={inspect} />}
    <div className="admin-shared-draft-tools">    <div className="admin-draft-bar"><div><strong>{state.draft ? `${changeCount} saved field change${changeCount === 1 ? "" : "s"}` : state.liveOnly ? help.workspaceCopy51 : help.workspaceCopy52}</strong><p className="admin-note">{unsaved ? help.workspaceUnsavedPreview : help.workspaceDraftBoundary}</p></div><div className="admin-actions" hidden={!state.draft}><button disabled={busy || unsaved || !state.draft || !state.writable} onClick={() => act("validate")}>{help.workspaceCopy53}</button><button disabled={busy || unsaved || !state.draft || !state.validation.valid || !state.writable} onClick={() => act("preview")}>{help.workspaceCopy54}</button></div></div>
    <details id="admin-validation" tabIndex={-1} className="admin-json admin-global-validation" open={!state.validation.valid} hidden={area !== "Publishing" && !state.draft && state.validation.valid}><summary>{help.workspaceCopy55}{state.validation.errors.length} errors · {state.validation.warnings.length} warnings</summary><Validation guide={guide} validation={state.validation} onInspect={inspectIssue} /></details></div>
    {confirm && <section ref={confirmationRef} tabIndex={-1} className="admin-confirm" aria-label={help.workspaceCopy56}><h4>{confirm.action === "publish" ? `Publish ${confirm.label}?` : confirm.action === "rollback" ? `Restore ${confirm.label}?` : confirm.action === "cancel-publication" ? "Cancel this publication?" : "Discard the shared draft?"}</h4><p>{confirm.action === "cancel-publication" ? guide.cancelHelp : confirm.action === "discard" ? guide.discardHelp : guide.publishHelp}</p><div className="admin-actions"><button disabled={busy} onClick={async () => { if (await act(confirm.action, confirm)) { if (confirm.action === "discard") setBuffers({}); } }}>Confirm {confirm.action}</button><button disabled={busy} onClick={() => setConfirm(null)}>Cancel</button></div></section>}
  </EditorSessionContext.Provider></PrivateAssetProvider></HelpProvider>;
}
