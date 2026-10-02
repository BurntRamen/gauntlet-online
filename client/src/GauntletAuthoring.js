import EncounterWorkshop, { focusWorkshop } from "./EncounterWorkshop";
import GauntletContractFields from "./GauntletContractFields";
import GauntletPlaytest from "./GauntletPlaytest";
import { useEffect, useRef, useState } from "react";
import CampaignChapterBriefing from "./CampaignChapterBriefing";
import SpecialCardFace from "./SpecialCardFace";

const title = (row) => row.name || row.title || row.commanderName || row.id;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const display = (value) => Array.isArray(value) ? value.join("\n") : value && typeof value === "object" ? JSON.stringify(value, null, 2) : String(value ?? "");

function contractValue(value, fallback) { try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; } }

function Validation({ validation, domain, id, field, guide }) {
  const messages = [...validation.errors.map((entry) => ({ ...entry, severity: "Error" })), ...validation.warnings.map((entry) => ({ ...entry, severity: "Warning" }))]
    .filter((entry) => !domain || (entry.domain === domain && entry.id === id && (!field || entry.field === field)));
  if (!messages.length) return domain ? null : <p className="admin-good">{guide.validationPassed}</p>;
  return <ul className="admin-alert">{messages.map((entry, index) => <li key={index}><strong>{entry.severity}</strong> · {!domain && [entry.domain, entry.id, entry.field].filter(Boolean).join(" / ")} {entry.message}</li>)}</ul>;
}

function Preview({ preview, domain, row, catalog, onClose, guide }) {
  const manifest = preview.manifest;
  const metadata = domain === "factions" ? preview.factions?.[row.id] || row
    : domain === "characters" && row.kind === "faction-role" ? preview.factions?.[row.factionId]?.[row.role] || row : row;
  let factionId = row.factionId || row.id;
  let chapter;
  if (domain === "encounters") chapter = manifest.campaigns[factionId]?.chapters.find((entry) => entry.id === row.id);
  if (domain === "campaigns") chapter = manifest.campaigns[factionId]?.chapters[0];
  if (domain === "characters" && row.encounterId) chapter = manifest.campaigns[factionId]?.chapters.find((entry) => entry.id === row.encounterId);
  if (domain === "decks") {
    const match = Object.entries(manifest.campaigns).find(([, campaign]) => campaign.chapters.some((entry) => entry.deckTemplate?.id === row.id));
    if (match) { factionId = match[0]; chapter = match[1].chapters.find((entry) => entry.deckTemplate?.id === row.id); }
  }
  let card = domain === "cards" ? manifest.cards.find((entry) => entry.id === row.id) : domain === "assets" ? manifest.cards.find((entry) => entry.id === row.gameplayCardId) : null;
  if (domain === "assets" && card) {
    const variant = manifest.collectorVariants.find((entry) => entry.variantId === row.id);
    card = { ...card, collector: variant, presentation: variant?.presentation || card.presentation };
  }
  const art = domain === "assets" ? card?.presentation?.illustration || row.art : manifest.collectorVariants.find((entry) => entry.variantId === card?.defaultVariantId)?.art;
  return <section className="admin-preview" aria-label="Isolated draft preview">
    <div className="admin-title-row"><h4>Saved draft preview</h4><button onClick={onClose}>Close preview</button></div>
    <p className="admin-note">{guide.previewPurpose}</p>
    {chapter ? <CampaignChapterBriefing campaign={manifest.campaigns[factionId]} factionId={factionId} chapter={chapter} chapterIndex={manifest.campaigns[factionId].chapters.indexOf(chapter)} theme={{ primary: "#efc06e", border: "#73613e" }} difficulty={chapter.setup || catalog?.domains.encounters.find((entry) => entry.id === chapter.id)?.definition.runtime.difficulty || {}} completed unlocked canPlayAsPlayer={false} previewOnly audioEnabled={false} musicEnabled={false} onBack={onClose} />
      : card ? <><div className="admin-card-preview"><SpecialCardFace card={card} art={art} /></div><h4>{card.name}</h4><p>{card.text}</p><p className="admin-note">{guide.cardPreview}</p>{art && <img className="admin-art-preview" src={art} alt="Selected draft illustration" />}</>
      : <article><h4>{title(metadata)}</h4>{(metadata.cardImage || metadata.image || metadata.art || metadata.coverImage) && <img className="admin-art-preview" src={metadata.cardImage || metadata.image || metadata.art || metadata.coverImage} alt={title(metadata)} />}<p>{metadata.description || metadata.pitch || metadata.text}</p><p className="admin-note">{guide.metadataPreview}</p></article>}
  </section>;
}

export default function GauntletAuthoring({ request, area, initialDomain = null, revision, catalog, onPublished, guard, onNavigate }) {
  const [state, setState] = useState(null);
  const guide = state?.guide || {};
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [domainChoice, setDomainChoice] = useState(initialDomain?.name || "campaigns");
  const [selections, setSelections] = useState({});
  const [session, setSession] = useState(null);
  const bufferRevision = useRef(null);
  const dirty = useRef(false);
  const latest = useRef(null);
  latest.current = { state, busy };
  const [query, setQuery] = useState("");
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
  const domain = area === "Game" ? "game" : domainChoice;
  const unsaved = Object.keys(buffers).length > 0;
  const selected = selections[domain];
  dirty.current = unsaved;
  function leave() {
    if (busy) { setNotice("Wait for the current operation to finish."); return false; }
    if (dirty.current && !window.confirm(guide.unsavedPrompt)) return false;
    dirty.current = false; setBuffers({}); bufferRevision.current = null; return true;
  }
  useEffect(() => { if (guard) guard.current = leave; return () => { if (guard) guard.current = () => true; }; });
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);
  useEffect(() => { setDomainChoice(initialDomain?.name || "campaigns"); setQuery(""); }, [initialDomain]);
  function edit(key, value, saved) {
    if (!unsaved) bufferRevision.current = state.revision;
    setBuffers((current) => { const next = { ...current }; if (value === display(saved)) delete next[key]; else next[key] = value; return next; });
  }
  async function refresh() {
    try { const data = await request("/api/admin/authoring"); if (data.revision >= (latest.current.state?.revision ?? 0)) { setState(data); setPreview((current) => current?.releaseId === `draft:${data.draft?.hash}` ? current : null); } }
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
  function inspect(nextDomain, id) {
    if (!leave()) return;
    setDomainChoice(nextDomain); setSelections((current) => ({ ...current, [nextDomain]: id })); setQuery("");
    onNavigate("Content");
    requestAnimationFrame(() => focusWorkshop(nextDomain === "encounters" ? "workshop-context" : "admin-selected"));
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
  const rows = snapshot.domains[domain] || [];
  const visibleRows = rows.filter((entry) => `${title(entry)} ${entry.id} ${entry.factionId || ""}`.toLowerCase().includes(query.toLowerCase()));
  const row = rows.find((entry) => entry.id === selected);
  const live = state.live.domains[domain]?.find((entry) => entry.id === row?.id);
  const fields = state.fields[domain]?.[row?.id] || {};
  const changeCount = state.changes.length;
  const needsPlaytest = state.changes.some((change) => state.fields[change.domain]?.[change.id]?.[change.field]?.mechanical) && !state.draft?.playtestedHash;
  function renderField(field) {
    const definition = fields[field];
    if (!definition) return null;
            const key = `${domain}:${row.id}:${field}`, value = Object.hasOwn(buffers, key) ? buffers[key] : display(row[field]);
            const changed = !same(row[field], live[field]);
            return <form id={`admin-field-${field}`} className={`admin-field ${changed ? "is-changed" : ""}`} key={key} onSubmit={async (event) => {
              event.preventDefault();
              const parsed = definition.type === "object" ? JSON.parse(value) : definition.type === "integer" ? Number(value) : definition.type === "lines" || definition.type === "assets" ? value === "" ? [] : value.split("\n") : value;
              if (await act("draft", { domain, id: row.id, field, value: parsed, expectedRevision: bufferRevision.current ?? state.revision })) setBuffers((current) => { const next = { ...current }; delete next[key]; return next; });
            }}><div className="admin-title-row"><strong>{definition.label}</strong><span className="admin-badge">{Object.hasOwn(buffers, key) ? "Unsaved" : changed ? "Draft changed" : "Matches live"}</span></div><div className="admin-field-columns"><div className="admin-comparison"><details open={definition.type !== "object" && (domain !== "encounters" || changed)}><summary>{definition.type === "object" ? "Technical · live contract" : changed ? "Live value · changed in draft" : "Compare with live"}</summary><div className="admin-live-value" tabIndex={0} aria-label={`Current live ${definition.label.toLowerCase()}`}>{display(live[field]) || "—"}</div></details>{Object.hasOwn(buffers, key) && <details><summary>Saved shared draft value</summary><pre className="admin-protected">{display(row[field])}</pre></details>}</div><div><span>Draft {definition.label.toLowerCase()}</span>{definition.type === "object" ? <GauntletContractFields guide={guide} value={contractValue(value, live[field])} definition={definition} row={row} cards={snapshot.domains.cards} onInspect={inspect} disabled={busy || !state.writable} onChange={(next) => edit(key, JSON.stringify(next, null, 2), row[field])} /> : definition.type === "asset" || definition.type === "integer" ? <input aria-label={`Draft ${definition.label.toLowerCase()}`} type={definition.type === "integer" ? "number" : "text"} min={definition.min} max={definition.max} list={definition.type === "asset" ? `admin-assets-${definition.media}` : undefined} value={value} disabled={busy || !state.writable} onChange={(event) => edit(key, event.target.value, row[field])} /> : <textarea aria-label={`Draft ${definition.label.toLowerCase()}`} rows={definition.type === "lines" || definition.maxLength > 1000 ? 4 : 2} value={value} disabled={busy || !state.writable} onChange={(event) => edit(key, event.target.value, row[field])} />}</div></div>
              <p className="admin-note">{definition.note || ((definition.type === "lines" || definition.type === "assets") ? guide.linesHelp : definition.type === "asset" ? guide.assetHelp : definition.type === "integer" ? `Whole number from ${definition.min} to ${definition.max}.` : `Up to ${definition.maxLength} characters.`)}</p>
              <Validation guide={guide} validation={state.validation} domain={domain} id={row.id} field={field} /><div className="admin-actions"><button type="submit" disabled={busy || !state.writable || !Object.hasOwn(buffers, key)}>Save {definition.label.toLowerCase()} to draft</button><button type="button" disabled={busy || !state.writable || (!changed && !Object.hasOwn(buffers, key))} onClick={async () => { if (Object.hasOwn(buffers, key) && !window.confirm(guide.revertPrompt)) return; if (!changed || await act("draft", { domain, id: row.id, field, revert: true })) setBuffers((current) => { const next = { ...current }; delete next[key]; return next; }); }}>Revert {definition.label.toLowerCase()} to live</button></div></form>;
  }
  const search = <label className="admin-search">Search {area === "Game" ? "modes" : DOMAINS[domain].toLowerCase()}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, ID or faction" /></label>;
  const list = <div className="admin-object-list">{!visibleRows.length && <p role="status">No {area === "Game" ? "modes" : DOMAINS[domain].toLowerCase()}{guide.emptySearch}</p>}{visibleRows.map((entry) => <button key={entry.id} aria-label={`Inspect ${title(entry)}`} aria-pressed={row?.id === entry.id} onClick={() => { if (entry.id === selected || leave()) { setSelections((current) => ({ ...current, [domain]: entry.id })); requestAnimationFrame(() => focusWorkshop("workshop-context")); } }}><strong>{title(entry)}</strong><small>{domain === "encounters" ? snapshot.domains.campaigns.find((campaign) => campaign.id === entry.campaignId)?.commanderName : entry.id}</small>{state.changes.some((change) => change.domain === domain && change.id === entry.id) && <span className="admin-badge">Draft changed</span>}</button>)}</div>;
  const presentation = preview && row && <Preview guide={guide} preview={preview} domain={domain} row={row} catalog={catalog} onClose={() => setPreview(null)} />;
  const playtest = <GauntletPlaytest request={request} state={state} row={row} domain={domain} disabled={busy || unsaved || !state.writable} onAuthoring={setState} session={session} onSession={setSession} onInspect={inspect} onBusy={setBusy} onRefresh={refresh} />;
  const encounter = snapshot.domains.encounters.find((entry) => entry.id === selections.encounters);
  return <>
    {["image", "audio"].map((media) => <datalist id={`admin-assets-${media}`} key={media}>{(state.assetLibrary || []).filter((asset) => asset.mediaType.startsWith(`${media}/`)).map((asset) => <option key={asset.id} value={asset.id}>{asset.source}</option>)}</datalist>)}
    {encounter && (area !== "Content" || domain !== "encounters") && <button onClick={() => inspect("encounters", encounter.id)}>Return to {encounter.title} · Encounter Workshop</button>}
    <div className="admin-draft-bar"><div><strong>{state.draft ? `${changeCount} saved field change${changeCount === 1 ? "" : "s"}` : "Live content · no draft"}</strong><p className="admin-note">{guide.sharedDraft}{unsaved && "You have unsaved form values."}</p>{!state.draft && <p className="admin-note">{guide.noDraft}</p>}</div><div className="admin-actions"><button disabled={busy || unsaved || !state.draft || !state.writable} onClick={() => act("validate")}>Validate draft</button><button disabled={busy || unsaved || !state.draft || !state.validation.valid || !state.writable} onClick={() => act("preview")}>Preview saved draft</button></div></div>
    {unsaved && bufferRevision.current !== state.revision && <div className="admin-alert" role="alert"><p>{guide.conflict}</p><button onClick={() => { bufferRevision.current = state.revision; setNotice(guide.retryReady); }}>Use latest revision for retry</button></div>}
    {state.connectionRequired && <div className="admin-alert"><p role="alert">{guide.connectionRequired}</p><details><summary>Connection setup details</summary><p>{guide.connectionSetup}</p></details></div>}
    {!state.writable && !state.connectionRequired && !state.pending && <p role="alert" className="admin-alert">{guide.unavailable}</p>}
    {state.pending && <section className="admin-preview" aria-label="Publication progress"><h4>Publication: {state.pending.phase.replaceAll("-", " ")}</h4><p>{guide.deploymentPending}</p>{state.pending.url && <a href={state.pending.url} target="_blank" rel="noreferrer">View publication in GitHub</a>}<div className="admin-actions"><button disabled={busy} onClick={() => act("reconcile")}>Check publication</button>{state.pending.phase !== "deploying" && <button disabled={busy} onClick={() => setConfirm({ action: "cancel-publication" })}>Cancel publication</button>}</div></section>}
    {error && <p role="alert" className="admin-alert">{error}</p>}{notice && <p role="status" className="admin-good">{notice}</p>}
    <details className="admin-json" open={!state.validation.valid}><summary>Global validation · {state.validation.errors.length} errors · {state.validation.warnings.length} warnings</summary><Validation guide={guide} validation={state.validation} /></details>
    {area === "Publishing" ? <>
      <p className="admin-lede">{guide.publishingHelp}</p>
      <details className="admin-json"><summary>{guide.releaseIdentity}</summary><p className="admin-note">Active release: <code>{state.activeReleaseId}</code><br />Draft revision: {state.revision}<br />{state.storage}</p></details>
      <h4>Review draft changes</h4>{changeCount ? <div className="admin-table-wrap"><table><thead><tr><th>Object / field</th><th>Live</th><th>Draft</th></tr></thead><tbody>{state.changes.map((change) => <tr key={`${change.domain}:${change.id}:${change.field}`}><td>{change.domain} / {change.id}<br />{change.field}</td><td className="admin-value">{display(change.live)}</td><td className="admin-value">{display(change.draft)}</td></tr>)}</tbody></table></div> : <p>No saved changes to publish.</p>}
      {preview && <p className="admin-good">{guide.previewReady}</p>}
      {needsPlaytest && <p className="admin-note">{guide.playtestRequired}</p>}
      <label className="admin-search">Release name<input value={releaseName} maxLength={160} onChange={(event) => setReleaseName(event.target.value)} placeholder="Describe this publication" /></label>
      <div className="admin-actions"><button disabled={busy || unsaved || !state.writable || !changeCount || !state.validation.valid || !state.draft?.previewedHash || needsPlaytest || !releaseName.trim()} onClick={() => setConfirm({ action: "publish", label: releaseName })}>Publish release</button><button disabled={busy || !state.draft || !state.writable} onClick={() => setConfirm({ action: "discard" })}>Discard shared draft</button></div>
      <h4>Release history and rollback</h4><div className="admin-releases">{[...state.releases].reverse().map((release) => <article className="admin-source" key={release.id}><h5>{release.label} {release.id === state.activeReleaseId && <span className="admin-badge">Active</span>}</h5><p className="admin-note">{new Date(release.createdAt).toLocaleString()} · {release.compatible ? "Compatible" : "Engine incompatible"}</p><details className="admin-json"><summary>Advanced / Technical · release identity</summary><code>{release.id}</code><p className="admin-note">SHA-256 {release.sha256}</p></details><button disabled={busy || unsaved || !state.writable || !!state.draft || !release.compatible || release.id === state.activeReleaseId} onClick={() => setConfirm({ action: "rollback", releaseId: release.id, label: release.label })}>Restore {release.label}</button></article>)}</div>
      <details className="admin-json"><summary>Activation history</summary><pre>{JSON.stringify(state.activations, null, 2)}</pre></details>
    </> : <>
      {area === "Content" && <div className="admin-subnav" aria-label="Content types">{Object.entries(DOMAINS).map(([key, name]) => <button key={key} aria-pressed={domain === key} onClick={() => { if (key === domain || leave()) { setDomainChoice(key); setQuery(""); } }}>{name} <span>{snapshot.domains[key].length}</span></button>)}</div>}
      <p className="admin-note">{area === "Game" ? guide.gameHelp : guide.contentHelp}</p>
      {domain === "encounters" ? <EncounterWorkshop row={row} state={state} unsaved={unsaved} session={session} list={list} search={search} field={renderField} preview={presentation} playtest={playtest} onInspect={inspect} onSelectList={leave} onReview={() => onNavigate("Publishing")} /> : <>
      {search}<div className="admin-authoring-layout">{list}
        <section id="admin-selected" tabIndex={-1} className="admin-editor" aria-label="Selected content">{row ? <><p className="admin-note">{area === "Game" ? "Game" : DOMAINS[domain]} / {title(row)}</p><h4>{title(row)}</h4><details className="admin-json"><summary>Advanced / Technical · identity and source</summary><code>{row.id}</code><p className="admin-note">Source boundary: {catalog?.domains[domain]?.find((entry) => entry.id === row.id)?.source || "Versioned content contract"} · Draft revision: {state.revision}</p></details><Validation guide={guide} validation={state.validation} domain={domain} id={row.id} />
          {!Object.keys(fields).length && <p>{guide.readOnly}</p>}
          {Object.keys(fields).map(renderField)}
          <details className="admin-json"><summary>{guide.protectedFields}</summary><p className="admin-note">{guide.engineHelp}</p><pre>{JSON.stringify(Object.fromEntries(Object.entries(row).filter(([key]) => !Object.hasOwn(fields, key))), null, 2)}</pre></details>
        </> : <p>{guide.selectionPrompt}</p>}</section></div>
      {domain === "assets" && <details className="admin-json"><summary>Asset manifest · {state.live.engine.assetManifestVersion}</summary><pre>{JSON.stringify((state.assetLibrary || []).filter((asset) => asset.source === row?.art || asset.id === row?.art || asset.path === row?.art), null, 2)}</pre></details>}
      {area === "Game" && <><h4>Starting state</h4><p className="admin-note">{guide.engineSource}</p><pre className="admin-protected">{JSON.stringify(state.live.engine, null, 2)}</pre></>}
      {presentation}{playtest}
      {preview && !row && <p className="admin-good">{guide.previewSelection}</p>}
      </>}
    </>}
    {confirm && <section ref={confirmationRef} tabIndex={-1} className="admin-confirm" aria-label="Confirm content operation"><h4>{confirm.action === "publish" ? `Publish ${confirm.label}?` : confirm.action === "rollback" ? `Restore ${confirm.label}?` : confirm.action === "cancel-publication" ? "Cancel this publication?" : "Discard the shared draft?"}</h4><p>{confirm.action === "cancel-publication" ? guide.cancelHelp : confirm.action === "discard" ? guide.discardHelp : guide.publishHelp}</p><div className="admin-actions"><button disabled={busy} onClick={async () => { if (await act(confirm.action, confirm)) { if (confirm.action === "discard") setBuffers({}); } }}>Confirm {confirm.action}</button><button disabled={busy} onClick={() => setConfirm(null)}>Cancel</button></div></section>}
  </>;
}
