import GauntletContractFields from "./GauntletContractFields";
import GauntletPlaytest from "./GauntletPlaytest";
import { useEffect, useState } from "react";
import CampaignChapterBriefing from "./CampaignChapterBriefing";
import SpecialCardFace from "./SpecialCardFace";

const DOMAINS = { campaigns: "Campaigns", encounters: "Encounters", factions: "Factions", cards: "Cards", decks: "Decks", characters: "Characters / opponents", assets: "Assets" };
const SOURCE = { campaigns: "server/gameContent.js", encounters: "Versioned encounter setup and story", factions: "server/gameContent.js + shared/duel-rules/index.js", cards: "server/gameContent.js + shared/duel-rules/index.js", decks: "Encounter setup card plans", characters: "server/gameContent.js + server/index.js", assets: "Versioned, digest-verified asset manifest", game: "server/index.js + shared/duel-rules/index.js" };
const title = (row) => row.name || row.title || row.commanderName || row.id;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const display = (value) => Array.isArray(value) ? value.join("\n") : value && typeof value === "object" ? JSON.stringify(value, null, 2) : String(value ?? "");

function contractValue(value, fallback) { try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; } }

function Validation({ validation, domain, id, field }) {
  const messages = [...validation.errors.map((entry) => ({ ...entry, severity: "Error" })), ...validation.warnings.map((entry) => ({ ...entry, severity: "Warning" }))]
    .filter((entry) => !domain || (entry.domain === domain && entry.id === id && (!field || entry.field === field)));
  if (!messages.length) return domain ? null : <p className="admin-good">Validation passed. All values use supported content contracts.</p>;
  return <ul className="admin-alert">{messages.map((entry, index) => <li key={index}><strong>{entry.severity}</strong> · {!domain && [entry.domain, entry.id, entry.field].filter(Boolean).join(" / ")} {entry.message}</li>)}</ul>;
}

function Preview({ preview, domain, row, catalog, onClose }) {
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
    <p className="admin-note">Presentation preview. Use the separate draft playtest to exercise the saved mechanics in the production engine.</p>
    {chapter ? <CampaignChapterBriefing campaign={manifest.campaigns[factionId]} factionId={factionId} chapter={chapter} chapterIndex={manifest.campaigns[factionId].chapters.indexOf(chapter)} theme={{ primary: "#efc06e", border: "#73613e" }} difficulty={chapter.setup || catalog?.domains.encounters.find((entry) => entry.id === chapter.id)?.definition.runtime.difficulty || {}} completed unlocked canPlayAsPlayer={false} previewOnly audioEnabled={false} musicEnabled={false} onBack={onClose} />
      : card ? <><div className="admin-card-preview"><SpecialCardFace card={card} art={art} /></div><h4>{card.name}</h4><p>{card.text}</p><p className="admin-note">This card uses the published presentation contract. Changed labels or artwork are composed from this release’s references.</p>{art && <img className="admin-art-preview" src={art} alt="Selected draft illustration" />}</>
      : <article><h4>{title(metadata)}</h4>{(metadata.cardImage || metadata.image || metadata.art || metadata.coverImage) && <img className="admin-art-preview" src={metadata.cardImage || metadata.image || metadata.art || metadata.coverImage} alt={title(metadata)} />}<p>{metadata.description || metadata.pitch || metadata.text}</p><p className="admin-note">Metadata preview. This domain has no standalone player component.</p></article>}
  </section>;
}

export default function GauntletAuthoring({ request, area, revision, catalog, onPublished, onUnsavedChange }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [domainChoice, setDomainChoice] = useState("campaigns");
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [buffers, setBuffers] = useState({});
  const [preview, setPreview] = useState(null);
  const [releaseName, setReleaseName] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [notice, setNotice] = useState("");
  const domain = area === "Game" ? "game" : domainChoice;
  const unsaved = Object.keys(buffers).length > 0;
  useEffect(() => { onUnsavedChange?.(unsaved); }, [unsaved, onUnsavedChange]);
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
      setState(result); setPreview(result.preview || null); setConfirm(null);
      if (action === "publish" || action === "rollback") { setReleaseName(""); onPublished(); }
      setNotice(result.pending ? "Publication saved in GitHub. The live release changes after its checks, merge and deployment." : action === "draft" ? "Field saved to the shared draft. Live content is unchanged." : action === "publish" ? "Release published. Future games use this content." : action === "rollback" ? "Previous release restored for future games." : action === "discard" ? "Shared draft discarded." : action === "validate" ? "Draft validation completed." : "Saved draft preview is ready.");
      return true;
    } catch (failure) { setError(failure.message); return false; }
    finally { setBusy(false); }
  }
  if (!state) return <p role={error ? "alert" : "status"}>{error || "Loading authored content…"}</p>;
  const snapshot = state.draft?.snapshot || state.live;
  const rows = snapshot.domains[domain] || [];
  const row = rows.find((entry) => entry.id === selected);
  const live = state.live.domains[domain]?.find((entry) => entry.id === row?.id);
  const fields = state.fields[domain]?.[row?.id] || {};
  const changeCount = state.changes.length;
  const needsPlaytest = state.changes.some((change) => state.fields[change.domain]?.[change.id]?.[change.field]?.mechanical) && !state.draft?.playtestedHash;
  return <>
    {["image", "audio"].map((media) => <datalist id={`admin-assets-${media}`} key={media}>{(state.assetLibrary || []).filter((asset) => asset.mediaType.startsWith(`${media}/`)).map((asset) => <option key={asset.id} value={asset.id}>{asset.source}</option>)}</datalist>)}
    <div className="admin-draft-bar"><div><strong>{state.draft ? `${changeCount} saved field change${changeCount === 1 ? "" : "s"}` : "Live content · no draft"}</strong><p className="admin-note">One shared draft across Content and Game. Revision {state.revision}. {unsaved && "You have unsaved form values."}</p></div><div className="admin-actions"><button disabled={busy || unsaved} onClick={() => act("validate")}>Validate draft</button><button disabled={busy || unsaved || !state.draft || !state.validation.valid || !state.writable} onClick={() => act("preview")}>Preview saved draft</button></div></div>
    {state.connectionRequired && <p role="alert" className="admin-alert">GitHub authoring needs its repository connection. The server requires a credential limited to this repository with Contents and Pull requests write access and Checks and Commit statuses read access. No persistent server disk is needed.</p>}
    {!state.writable && !state.connectionRequired && !state.pending && <p role="alert" className="admin-alert">Authoring is unavailable. Check the configured content provider.</p>}
    {state.pending && <section className="admin-preview" aria-label="Publication progress"><h4>Publication: {state.pending.phase.replaceAll("-", " ")}</h4><p>The current deployed release stays active until the new deployment completes.</p>{state.pending.url && <a href={state.pending.url} target="_blank" rel="noreferrer">View publication in GitHub</a>}<div className="admin-actions"><button disabled={busy} onClick={() => act("reconcile")}>Check publication</button>{state.pending.phase !== "deploying" && <button disabled={busy} onClick={() => setConfirm({ action: "cancel-publication" })}>Cancel publication</button>}</div></section>}
    {error && <p role="alert" className="admin-alert">{error}</p>}{notice && <p role="status" className="admin-good">{notice}</p>}
    <details className="admin-json" open={!state.validation.valid}><summary>Global validation · {state.validation.errors.length} errors · {state.validation.warnings.length} warnings</summary><Validation validation={state.validation} /></details>
    {area === "Publishing" ? <>
      <p className="admin-lede">Validate and preview the saved draft, then publish one immutable release. GitHub publications and rollbacks take effect after deployment.</p>
      <p className="admin-note">Active release: <code>{state.activeReleaseId}</code><br />{state.storage}</p>
      <h4>Review draft changes</h4>{changeCount ? <div className="admin-table-wrap"><table><thead><tr><th>Object / field</th><th>Live</th><th>Draft</th></tr></thead><tbody>{state.changes.map((change) => <tr key={`${change.domain}:${change.id}:${change.field}`}><td>{change.domain} / {change.id}<br />{change.field}</td><td className="admin-value">{display(change.live)}</td><td className="admin-value">{display(change.draft)}</td></tr>)}</tbody></table></div> : <p>No saved changes to publish.</p>}
      {preview && <p className="admin-good">This saved draft has passed validation and is ready for presentation review in Content or Game.</p>}
      {needsPlaytest && <p className="admin-note">Playtest the saved mechanical draft in Content or Game before publishing.</p>}
      <label className="admin-search">Release name<input value={releaseName} maxLength={160} onChange={(event) => setReleaseName(event.target.value)} placeholder="Describe this publication" /></label>
      <div className="admin-actions"><button disabled={busy || unsaved || !state.writable || !changeCount || !state.validation.valid || !state.draft?.previewedHash || needsPlaytest || !releaseName.trim()} onClick={() => setConfirm({ action: "publish", label: releaseName })}>Publish release</button><button disabled={busy || !state.draft || !state.writable} onClick={() => setConfirm({ action: "discard" })}>Discard shared draft</button></div>
      <h4>Release history and rollback</h4><div className="admin-releases">{[...state.releases].reverse().map((release) => <article className="admin-source" key={release.id}><h5>{release.label} {release.id === state.activeReleaseId && <span className="admin-badge">Active</span>}</h5><code>{release.id}</code><p className="admin-note">{new Date(release.createdAt).toLocaleString()} · {release.compatible ? "Compatible" : "Engine incompatible"} · SHA-256 {release.sha256}</p><button disabled={busy || unsaved || !state.writable || !!state.draft || !release.compatible || release.id === state.activeReleaseId} onClick={() => setConfirm({ action: "rollback", releaseId: release.id, label: release.label })}>Restore {release.label}</button></article>)}</div>
      <details className="admin-json"><summary>Activation history</summary><pre>{JSON.stringify(state.activations, null, 2)}</pre></details>
    </> : <>
      {area === "Content" && <div className="admin-subnav" aria-label="Content types">{Object.entries(DOMAINS).map(([key, name]) => <button key={key} aria-pressed={domain === key} onClick={() => { setDomainChoice(key); setSelected(""); setQuery(""); }}>{name} <span>{snapshot.domains[key].length}</span></button>)}</div>}
      <p className="admin-note">{area === "Game" ? "Mode names and descriptions use the shared draft. Hand size uses the shared engine configuration. Starting life, deck slots and mode behavior remain engine-controlled." : "Edit authored fields below. Mechanics use finite, versioned contracts. Identities and executable handlers remain protected."}</p>
      <label className="admin-search">Search {area === "Game" ? "modes" : DOMAINS[domain].toLowerCase()}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, ID or faction" /></label>
      <div className="admin-authoring-layout"><div className="admin-object-list">{rows.filter((entry) => `${title(entry)} ${entry.id} ${entry.factionId || ""}`.toLowerCase().includes(query.toLowerCase())).map((entry) => <button key={entry.id} aria-label={`Inspect ${title(entry)}`} aria-pressed={row?.id === entry.id} onClick={() => setSelected(entry.id)}><strong>{title(entry)}</strong><small>{entry.id}</small>{state.changes.some((change) => change.domain === domain && change.id === entry.id) && <span className="admin-badge">Draft changed</span>}</button>)}</div>
        <section className="admin-editor" aria-label="Selected content">{row ? <><h4>{title(row)}</h4><code>{row.id}</code><p className="admin-note">Source boundary: {SOURCE[domain]}</p><Validation validation={state.validation} domain={domain} id={row.id} />
          {!Object.keys(fields).length && <p>This object controls engine behavior and is read-only.</p>}
          {Object.entries(fields).map(([field, definition]) => {
            const key = `${domain}:${row.id}:${field}`, value = Object.hasOwn(buffers, key) ? buffers[key] : display(row[field]);
            const changed = !same(row[field], live[field]);
            return <form className={`admin-field ${changed ? "is-changed" : ""}`} key={key} onSubmit={async (event) => {
              event.preventDefault();
              const parsed = definition.type === "object" ? JSON.parse(value) : definition.type === "integer" ? Number(value) : definition.type === "lines" || definition.type === "assets" ? value === "" ? [] : value.split("\n") : value;
              if (await act("draft", { domain, id: row.id, field, value: parsed })) setBuffers((current) => { const next = { ...current }; delete next[key]; return next; });
            }}><div className="admin-title-row"><strong>{definition.label}</strong><span className="admin-badge">{Object.hasOwn(buffers, key) ? "Unsaved" : changed ? "Draft changed" : "Matches live"}</span></div><div className="admin-field-columns"><div><small>Current live value</small><div className="admin-live-value" tabIndex={0} aria-label={`Current live ${definition.label.toLowerCase()}`}>{display(live[field]) || "—"}</div></div><div><span>Draft {definition.label.toLowerCase()}</span>{definition.type === "object" ? <GauntletContractFields value={contractValue(value, live[field])} definition={definition} row={row} cards={snapshot.domains.cards} disabled={busy || !state.writable} onChange={(next) => setBuffers((current) => ({ ...current, [key]: JSON.stringify(next) }))} /> : definition.type === "asset" || definition.type === "integer" ? <input aria-label={`Draft ${definition.label.toLowerCase()}`} type={definition.type === "integer" ? "number" : "text"} min={definition.min} max={definition.max} list={definition.type === "asset" ? `admin-assets-${definition.media}` : undefined} value={value} disabled={busy || !state.writable} onChange={(event) => setBuffers((current) => ({ ...current, [key]: event.target.value }))} /> : <textarea aria-label={`Draft ${definition.label.toLowerCase()}`} rows={definition.type === "lines" || definition.maxLength > 1000 ? 4 : 2} value={value} disabled={busy || !state.writable} onChange={(event) => setBuffers((current) => { const next = { ...current }; if (event.target.value === display(row[field])) delete next[key]; else next[key] = event.target.value; return next; })} />}</div></div>
              <p className="admin-note">{definition.note || ((definition.type === "lines" || definition.type === "assets") ? "One entry per line. Empty voice-file lines keep dialogue positions aligned." : definition.type === "asset" ? "Existing /assets/gauntlet/ reference; files are deployed with the client." : definition.type === "integer" ? `Whole number from ${definition.min} to ${definition.max}.` : `Up to ${definition.maxLength} characters.`)}</p>
              <Validation validation={state.validation} domain={domain} id={row.id} field={field} /><div className="admin-actions"><button type="submit" disabled={busy || !state.writable || !Object.hasOwn(buffers, key)}>Save {definition.label.toLowerCase()} to draft</button><button type="button" disabled={busy || !state.writable || (!changed && !Object.hasOwn(buffers, key))} onClick={async () => { if (!changed || await act("draft", { domain, id: row.id, field, revert: true })) setBuffers((current) => { const next = { ...current }; delete next[key]; return next; }); }}>Revert {definition.label.toLowerCase()} to live</button></div></form>;
          })}
          <details className="admin-json"><summary>Engine-controlled and derived fields · read-only</summary><p className="admin-note">These identities and unsupported mechanics require an engine change. Displayed rules text does not change an effect.</p><pre>{JSON.stringify(Object.fromEntries(Object.entries(row).filter(([key]) => !Object.hasOwn(fields, key))), null, 2)}</pre></details>
        </> : <p>Select an object to compare its live and draft fields.</p>}</section></div>
      {domain === "assets" && <details className="admin-json"><summary>Asset manifest · {state.live.engine.assetManifestVersion}</summary><pre>{JSON.stringify((state.assetLibrary || []).filter((asset) => asset.source === row?.art || asset.id === row?.art || asset.path === row?.art), null, 2)}</pre></details>}
      {area === "Game" && <><h4>Starting state</h4><p className="admin-note">Read-only · shared/duel-rules/index.js and server/index.js</p><pre className="admin-protected">{JSON.stringify(state.live.engine, null, 2)}</pre></>}
      {preview && row && <Preview preview={preview} domain={domain} row={snapshot.domains[domain].find((entry) => entry.id === row.id)} catalog={catalog} onClose={() => setPreview(null)} />}
      <GauntletPlaytest request={request} state={state} row={row} domain={domain} disabled={busy || unsaved || !state.writable} onAuthoring={setState} />
      {preview && !row && <p className="admin-good">Preview prepared. Select an object to inspect its saved presentation.</p>}
    </>}
    {confirm && <section className="admin-confirm" aria-label="Confirm content operation"><h4>{confirm.action === "publish" ? "Publish this reviewed draft?" : confirm.action === "rollback" ? `Restore ${confirm.label}?` : confirm.action === "cancel-publication" ? "Cancel this publication?" : "Discard the shared draft?"}</h4><p>{confirm.action === "cancel-publication" ? "Close the unmerged publication and keep the shared draft for further editing." : confirm.action === "discard" ? "This removes the saved draft for both administrators. Published releases remain available." : "This changes the active content for future games. Running games keep their captured content; historical evidence is unchanged."}</p><div className="admin-actions"><button disabled={busy} onClick={async () => { if (await act(confirm.action, confirm)) { if (confirm.action === "discard") setBuffers({}); } }}>Confirm {confirm.action}</button><button disabled={busy} onClick={() => setConfirm(null)}>Cancel</button></div></section>}
  </>;
}
