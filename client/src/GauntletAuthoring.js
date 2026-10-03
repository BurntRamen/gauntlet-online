
import WorkshopField, { displayValue as display } from "./admin/WorkshopField";
import WorkshopNavigation from "./admin/WorkshopNavigation";
import useWorkshopContext from "./admin/useWorkshopContext";
import UnsavedChangesDialog from "./admin/UnsavedChangesDialog";
import "./admin/TestHarness.css";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import Validation from "./admin/WorkshopValidation";


const Preview = lazy(() => import(/* webpackChunkName: "gauntlet-admin-preview" */ "./admin/WorkshopPreview"));
const EncounterWorkshop = lazy(() => import(/* webpackChunkName: "gauntlet-admin-encounters" */ "./EncounterWorkshop"));
const GauntletPlaytest = lazy(() => import(/* webpackChunkName: "gauntlet-admin-test" */ "./GauntletPlaytest"));
const title = (row) => row.name || row.title || row.commanderName || row.id;
const CardWorkshop = lazy(() => import(/* webpackChunkName: "gauntlet-admin-cards" */ "./admin/CardWorkshop"));
const EngineWorkshop = lazy(() => import(/* webpackChunkName: "gauntlet-admin-engine" */ "./admin/EngineWorkshop"));
const AssetPicker = lazy(() => import(/* webpackChunkName: "gauntlet-admin-assets" */ "./admin/AssetPicker"));
const ReleaseReview = lazy(() => import(/* webpackChunkName: "gauntlet-admin-review" */ "./admin/ReleaseReview"));
const RelatedContent = lazy(() => import(/* webpackChunkName: "gauntlet-admin-related" */ "./admin/RelatedContent"));
const ENGINE_DOMAINS = ["card-effects", "faction-effects", "encounter-mechanics", "game"];

export default function GauntletAuthoring({ request, area, initialDomain = null, revision, catalog, onPublished, guard, onNavigate, beforeNavigate, onExit }) {
  const [state, setState] = useState(null);
  const guide = state?.guide || {};
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [domainChoice, setDomainChoice] = useState(initialDomain?.name || (area === "Content" ? "campaigns" : "encounters"));
  const [selections, setSelections] = useState({});
  const [session, setSession] = useState(null);
  const [scenario, setScenario] = useState(null), [scenarioDirty, setScenarioDirty] = useState(false);
  const bufferRevision = useRef(null);
  const [metadata, setMetadata] = useState(null), [relationships, setRelationships] = useState(null), [review, setReview] = useState(null);
  const [projectionError, setProjectionError] = useState("");
  const [resolvedView, setResolvedView] = useState(null), [assetPicker, setAssetPicker] = useState(null);
  const [suit, setSuit] = useState("spades"), [variantId, setVariantId] = useState("");
  const latest = useRef(null);
  latest.current = { state, busy };

  const [buffers, setBuffers] = useState({});
  const [preview, setPreview] = useState(null);
  const [releaseName, setReleaseName] = useState("");
  const [confirm, setConfirm] = useState(null);
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
  const unsaved = Object.keys(buffers).length > 0;
  const selected = selections[domainChoice];
  const context = useWorkshopContext({
    initialTarget: { domain: initialDomain?.name || (area === "Content" ? "campaigns" : "encounters"), id: initialDomain?.id || null },
    dirty: unsaved || scenarioDirty, busy, onDiscard: () => { setBuffers({}); bufferRevision.current = null; setScenario(null); setScenarioDirty(false); },
    beforeNavigate, onExit,
    onBusy: () => setNotice("Wait for the current operation to finish."),
    onNavigate: (target) => { setScenario(null); setScenarioDirty(false); setDomainChoice(target.domain); setSelections(current => ({ ...current, [target.domain]: target.id })); onNavigate?.("Design"); }
  });
  const query = context.context.query || "";
  const setQuery = value => context.remember({ query: value });
  const leave = context.requestLeave;
  useEffect(() => { if (guard) guard.current = leave; return () => { if (guard) guard.current = (action) => { action?.(); return true; }; }; }, [guard, leave]);
  useEffect(() => {
    setDomainChoice(context.target.domain);
    setSelections(current => ({ ...current, [context.target.domain]: context.target.id }));
  }, [context.target]);
  useEffect(() => {
    if (initialDomain) context.navigate({ domain: initialDomain.name, id: initialDomain.id || null });
  // Navigation requests come only from the guarded Admin parent.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDomain]);
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
    setBuffers((current) => { const next = { ...current }; if (value === display(saved)) delete next[key]; else next[key] = value; return next; });
  }
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
  function inspect(nextDomain, id) { context.navigate({ domain: nextDomain === "game" && id && id !== "shared-rules" ? "modes" : nextDomain, id }); }
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
      const result = await request(`/api/admin/authoring/${action}`, { method: action === "draft" ? "PATCH" : "POST", body: JSON.stringify({ expectedRevision: state.revision, ...body }) });
      setState(result); bufferRevision.current = result.revision; setPreview(result.preview || null); setConfirm(null);
      if (action === "publish" || action === "rollback") { setReleaseName(""); onPublished(); }
      setNotice(result.pending ? guide.publicationPending : action === "draft" ? guide.fieldSaved : action === "publish" ? guide.published : action === "rollback" ? "Previous release restored for future games." : action === "discard" ? "Shared draft discarded." : action === "validate" ? "Draft validation completed." : "Saved draft preview is ready.");
      return true;
    } catch (failure) { setError(failure.message); if (failure.status === 409) await refresh(); return false; }
    finally { setBusy(false); }
  }
  if (!state) return <p role={error ? "alert" : "status"}>{error || "Loading authored content…"}</p>;
  if (!state.guide) return <p role="status">Admin update is deploying. Refresh admin shortly.</p>;
  const DOMAINS = guide.domains;
  const snapshot = state.draft?.snapshot || state.live;
  const rows = (snapshot.domains[domain] || []).filter(entry => domainChoice !== "modes" || entry.id !== "shared-rules");
  const visibleRows = rows.filter(entry => domain !== "encounters" || !context.context.campaign || entry.campaignId === context.context.campaign).filter((entry) => `${title(entry)} ${entry.id} ${entry.factionId || ""}`.toLowerCase().includes(query.toLowerCase()));
  const row = rows.find((entry) => entry.id === selected);
  const fields = state.fields[domain]?.[row?.id] || {};
  const changeCount = state.changes.length;
  function renderField(field, overrides = {}) {
    const selectedDomain = overrides.domain || domain, selectedRow = overrides.row || row;
    if (!selectedRow) return null;
    const key = `${selectedDomain}:${selectedRow.id}:${field}`;
    return <WorkshopField key={key} field={field} state={{ ...state, workshopMetadata: metadata }} domain={selectedDomain} row={selectedRow} buffer={buffers[key]} busy={busy} onInspect={inspect} onAsset={setAssetPicker} renderContract={overrides.renderContract}
      onEdit={(value, saved) => edit(key, value, saved)} onSave={async (value, revert = false) => {
        if (await act("draft", { domain: selectedDomain, id: selectedRow.id, field, value, revert, expectedRevision: bufferRevision.current ?? state.revision })) setBuffers(current => { const next = { ...current }; delete next[key]; return next; });
      }} />;
  }
  const search = <label className="admin-search">Search {area === "Game" ? "modes" : (DOMAINS[domain] || "rules").toLowerCase()}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, ID or faction" /></label>;
  const list = <div className="admin-object-list">{!visibleRows.length && <p role="status">No {area === "Game" ? "modes" : (DOMAINS[domain] || "rules").toLowerCase()}{guide.emptySearch}</p>}{visibleRows.map((entry) => <button key={entry.id} aria-label={`Inspect ${title(entry)}`} aria-pressed={row?.id === entry.id} onClick={() => inspect(domainChoice, entry.id)}><strong>{title(entry)}</strong><small>{domain === "encounters" ? snapshot.domains.campaigns.find((campaign) => campaign.id === entry.campaignId)?.commanderName : entry.id}</small>{state.changes.some((change) => change.domain === domain && change.id === entry.id) && <span className="admin-badge">Draft changed</span>}</button>)}</div>;
  const presentation = (preview || resolvedView) && row && <Preview source={source} suit={suit} variantId={variantId} guide={guide} preview={preview || resolvedView} domain={domain} row={row} catalog={catalog} onClose={() => { setPreview(null); setResolvedView(null); }} />;
  const playtest = <GauntletPlaytest request={request} state={state} row={row} domain={domain} disabled={busy || unsaved || !metadata?.capabilities?.liveTests} onAuthoring={setState} session={session} onSession={setSession} onInspect={inspect} onBusy={setBusy} onRefresh={refresh} subjectTarget={context.target} metadata={metadata} scenario={scenario} onScenario={value => { setScenario(value); setScenarioDirty(true); }} onScenarioStarted={() => setScenarioDirty(false)} />;
  const encounter = snapshot.domains.encounters.find((entry) => entry.id === selections.encounters);
  return <>
    <WorkshopNavigation target={context.target} />
    <Suspense fallback={<p role="status">Loading workshop…</p>}>
    {context.pending && <UnsavedChangesDialog onKeep={context.cancel} onDiscard={context.discard} />}
    {context.backCount > 0 && <button onClick={context.back}>Back to previous workspace</button>}
    {assetPicker && <AssetPicker library={state.assetLibrary || []} relationships={relationships} {...assetPicker} onSelect={value => { assetPicker.onSelect(value); setAssetPicker(null); }} onClose={() => setAssetPicker(null)} />}

    {encounter && (area === "Publishing" || domain !== "encounters") && <button onClick={() => inspect("encounters", encounter.id)}>Return to {encounter.title} · Encounter Workshop</button>}
    <div className="admin-draft-bar"><div><strong>{state.draft ? `${changeCount} saved field change${changeCount === 1 ? "" : "s"}` : state.liveOnly ? "Live content · shared draft unavailable" : "Live content · no draft"}</strong><p className="admin-note">{guide.sharedDraft}{unsaved && "You have unsaved form values."}</p>{!state.draft && !state.liveOnly && <p className="admin-note">{guide.noDraft}</p>}</div><div className="admin-actions"><button disabled={busy || unsaved || !state.draft || !state.writable} onClick={() => act("validate")}>Validate draft</button><button disabled={busy || unsaved || !state.draft || !state.validation.valid || !state.writable} onClick={() => act("preview")}>Preview saved draft</button></div></div>
    {unsaved && !state.liveOnly && bufferRevision.current !== state.revision && <div className="admin-alert" role="alert"><p>{guide.conflict}</p><button onClick={() => { bufferRevision.current = state.revision; setNotice(guide.retryReady); }}>Use latest revision for retry</button></div>}
    {state.authoringError && <p role="alert" className="admin-alert">{state.authoringError}</p>}
    {state.connectionRequired && <div className="admin-alert"><p role="alert">{guide.connectionRequired}</p><details><summary>Connection setup details</summary><p>{guide.connectionSetup}</p></details></div>}
    {!state.writable && !state.connectionRequired && !state.pending && !state.authoringError && <p role="alert" className="admin-alert">{guide.unavailable}</p>}
    {state.pending && <section className="admin-preview" aria-label="Publication progress"><h4>Publication: {state.pending.phase.replaceAll("-", " ")}</h4><p>{guide.deploymentPending}</p>{state.pending.url && <a href={state.pending.url} target="_blank" rel="noreferrer">View publication in GitHub</a>}<div className="admin-actions"><button disabled={busy} onClick={() => act("reconcile")}>Check publication</button>{state.pending.phase !== "deploying" && <button disabled={busy} onClick={() => setConfirm({ action: "cancel-publication" })}>Cancel publication</button>}</div></section>}
    {projectionError && <p role="status" className="admin-note">Workshop reference data: {projectionError}</p>}{error && <p role="alert" className="admin-alert">{error}</p>}{notice && <p role="status" className="admin-good">{notice}</p>}
    <details className="admin-json" open={!state.validation.valid}><summary>Global validation · {state.validation.errors.length} errors · {state.validation.warnings.length} warnings</summary><Validation guide={guide} validation={state.validation} /></details>
    {area === "Publishing" ? <>
      <p className="admin-lede">{guide.publishingHelp}</p>
      <details className="admin-json"><summary>{guide.releaseIdentity}</summary><p className="admin-note">Active release: <code>{state.activeReleaseId}</code><br />Draft revision: {state.revision}<br />{state.storage}</p></details>
      <ReleaseReview state={state} review={review} busy={busy} unsaved={unsaved} onInspect={inspect} releaseName={releaseName} onReleaseName={setReleaseName} onPublish={() => setConfirm({ action: "publish", label: releaseName })} onDiscard={() => setConfirm({ action: "discard" })} />
      <h4>Release history and rollback</h4><div className="admin-releases">{[...state.releases].reverse().map((release) => <article className="admin-source" key={release.id}><h5>{release.label} {release.id === state.activeReleaseId && <span className="admin-badge">Active</span>}</h5><p className="admin-note">{new Date(release.createdAt).toLocaleString()} · {release.compatible ? "Compatible" : "Engine incompatible"}</p><details className="admin-json"><summary>Advanced / Technical · release identity</summary><code>{release.id}</code><p className="admin-note">SHA-256 {release.sha256}</p></details><button disabled={busy} onClick={async () => { try { const value = await request(`/api/admin/workshops/releases/${encodeURIComponent(release.id)}/review`); setReview(current => ({ ...current, comparison: value })); } catch (failure) { setError(failure.message); } }}>Compare with live</button><button disabled={busy || unsaved || !state.writable || !!state.draft || !release.compatible || release.id === state.activeReleaseId} onClick={() => setConfirm({ action: "rollback", releaseId: release.id, label: release.label })}>Restore {release.label}</button></article>)}</div>
      <details className="admin-json"><summary>Activation history</summary><pre>{JSON.stringify(state.activations, null, 2)}</pre></details>
    </> : <>
      <nav className="admin-subnav" aria-label="Design workshops">{[["encounters", "Encounters"], ["cards", "Cards"], ["card-effects", "Engine / Rules"], ["campaigns", "Other content"]].map(([key, label]) => <button key={key} aria-pressed={key === "card-effects" ? ENGINE_DOMAINS.includes(domainChoice) : domainChoice === key} onClick={() => inspect(key, selections[key] || null)}>{label}</button>)}</nav>
      {!['encounters', 'cards', ...ENGINE_DOMAINS].includes(domainChoice) && <nav className="admin-subnav" aria-label="Other content types">{Object.entries(DOMAINS).filter(([key]) => !["cards", "encounters", "game"].includes(key)).concat([["modes", "Mode copy"]]).map(([key, label]) => <button key={key} aria-pressed={domainChoice === key} onClick={() => inspect(key, selections[key] || null)}>{label}</button>)}</nav>}
      <p className="admin-note">{area === "Game" ? guide.gameHelp : guide.contentHelp}</p>
      {domain === "cards" ? <CardWorkshop row={row} state={{ ...state, workshopMetadata: metadata, relationshipData: relationships, previewContent: preview || resolvedView }} field={renderField} preview={presentation} playtest={playtest} onInspect={inspect} onReview={() => onNavigate("Publishing")} search={search} list={list} unsaved={unsaved} suit={suit} onSuit={setSuit} variantId={variantId} onVariantChange={setVariantId} /> : ENGINE_DOMAINS.includes(domainChoice) && area !== "Game" ? <EngineWorkshop state={{ ...state, workshopMetadata: metadata, relationshipData: relationships }} field={renderField} playtest={playtest} onInspect={inspect} onReview={() => onNavigate("Publishing")} context={context.context} onContext={context.remember} target={context.target} onTarget={target => context.navigate(target)} /> : domain === "encounters" ? <EncounterWorkshop context={context.context} onContext={context.remember} row={row} state={state} unsaved={unsaved} session={session} list={list} search={<>{search}<label className="admin-search">Campaign<select aria-label="Filter encounters by campaign" value={context.context.campaign || ""} onChange={event => context.remember({ campaign: event.target.value })}><option value="">All campaigns</option>{snapshot.domains.campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.commanderName}</option>)}</select></label></>} field={renderField} preview={presentation} playtest={playtest} onInspect={inspect} onSelectList={action => leave(action)} onReview={() => onNavigate("Publishing")} /> : <>
      {domain === "asset-library" && <section><h4>Immutable asset</h4>{(state.assetLibrary || []).filter(asset => asset.id === selected).map(asset => <article key={asset.id}><p>{asset.source}</p>{asset.mediaType.startsWith("image/") ? <img src={asset.path} alt={asset.source} style={{ maxWidth: "100%", maxHeight: 260 }} /> : <audio controls preload="none" src={asset.path} />}<RelatedContent data={relationships} domain="asset-library" id={asset.id} onInspect={inspect} /><details><summary>Technical · identity and digest</summary><pre>{JSON.stringify(asset, null, 2)}</pre></details></article>)}</section>}{search}<div className="admin-authoring-layout">{list}
        <section id="admin-selected" tabIndex={-1} className="admin-editor" aria-label="Selected content">{row ? <><p className="admin-note">{area === "Game" ? "Game" : DOMAINS[domain]} / {title(row)}</p><h4>{title(row)}</h4><details className="admin-json"><summary>Advanced / Technical · identity and source</summary><code>{row.id}</code><p className="admin-note">Source boundary: {catalog?.domains[domain]?.find((entry) => entry.id === row.id)?.source || "Versioned content contract"} · Draft revision: {state.revision}</p></details><Validation guide={guide} validation={state.validation} domain={domain} id={row.id} />
          {!Object.keys(fields).length && <p>{guide.readOnly}</p>}
          {Object.keys(fields).map(renderField)}
          <details className="admin-json"><summary>{guide.protectedFields}</summary><p className="admin-note">{guide.engineHelp}</p><pre>{JSON.stringify(Object.fromEntries(Object.entries(row).filter(([key]) => !Object.hasOwn(fields, key))), null, 2)}</pre></details>
        </> : <p>{guide.selectionPrompt}</p>}</section></div>
      {domain === "assets" && <details className="admin-json"><summary>Asset manifest · {state.live.engine.assetManifestVersion}</summary><pre>{JSON.stringify((state.assetLibrary || []).filter((asset) => asset.source === row?.art || asset.id === row?.art || asset.path === row?.art), null, 2)}</pre></details>}
      {area === "Game" && <><h4>Starting state</h4><p className="admin-note">{guide.engineSource}</p><pre className="admin-protected">{JSON.stringify(state.live.engine, null, 2)}</pre></>}
      {presentation}{playtest}{row && relationships && <RelatedContent data={relationships} domain={domain} id={row.id} onInspect={inspect} />}
      {preview && !row && <p className="admin-good">{guide.previewSelection}</p>}
      </>}
    </>}
    {domain === "encounters" && row && relationships && area !== "Publishing" && <RelatedContent data={relationships} domain={domain} id={row.id} onInspect={inspect} />}
    {confirm && <section ref={confirmationRef} tabIndex={-1} className="admin-confirm" aria-label="Confirm content operation"><h4>{confirm.action === "publish" ? `Publish ${confirm.label}?` : confirm.action === "rollback" ? `Restore ${confirm.label}?` : confirm.action === "cancel-publication" ? "Cancel this publication?" : "Discard the shared draft?"}</h4><p>{confirm.action === "cancel-publication" ? guide.cancelHelp : confirm.action === "discard" ? guide.discardHelp : guide.publishHelp}</p><div className="admin-actions"><button disabled={busy} onClick={async () => { if (await act(confirm.action, confirm)) { if (confirm.action === "discard") setBuffers({}); } }}>Confirm {confirm.action}</button><button disabled={busy} onClick={() => setConfirm(null)}>Cancel</button></div></section>}
    </Suspense>
  </>;
}
