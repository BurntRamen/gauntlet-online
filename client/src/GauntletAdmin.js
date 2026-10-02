import { lazy, Suspense, useEffect, useRef, useState } from "react";
import "./GauntletAdmin.css";

const GauntletAuthoring = lazy(() => import(/* webpackChunkName: "gauntlet-admin-authoring" */ "./GauntletAuthoring"));
const AREAS = ["Overview", "Content", "Game", "Players", "Matches", "Publishing", "System"];
const DOMAINS = { campaigns: "Campaigns", encounters: "Encounters", factions: "Factions", cards: "Cards", decks: "Decks", characters: "Characters / opponents" };
const label = (value) => String(value).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").replace(/^./, (char) => char.toUpperCase());
const date = (value) => value ? new Date(value).toLocaleString() : "Not recorded";

function useAdminData(request, path, revision) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  useEffect(() => {
    let active = true;
    setState({ loading: true, data: null, error: "" });
    request(path).then((data) => { if (active) setState({ loading: false, data, error: "" }); })
      .catch((error) => { if (active) setState({ loading: false, data: null, error: error.message }); });
    return () => { active = false; };
  }, [request, path, revision]);
  return state;
}

function State({ state, children }) {
  if (state.loading) return <p role="status">Loading current data…</p>;
  if (state.error) return <p className="admin-alert" role="alert">{state.error}</p>;
  return children(state.data);
}

function Json({ value, title = "Inspect source projection" }) {
  return <details className="admin-json"><summary>{title}</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>;
}

function Facts({ values }) {
  return <dl className="admin-facts">{Object.entries(values).map(([key, value]) => <div key={key}><dt>{label(key)}</dt><dd>{value == null ? "Not recorded" : typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}</dd></div>)}</dl>;
}

function Issues({ issues = [] }) {
  return issues.length > 0 ? <ul className="admin-alert">{issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul> : <p className="admin-good">No failures reported by these checks.</p>;
}

function Overview({ catalog, request, revision, onSelect }) {
  const system = useAdminData(request, "/api/admin/system", revision);
  const recent = useAdminData(request, "/api/admin/matches", revision);
  return <>
    <p className="admin-lede">A current view of the product, its content and its evidence.</p>
    <State state={catalog}>{(data) => <>
      <Facts values={{ contentVersion: data.versions.content, registryRules: data.versions.registryRules, engineRules: data.versions.engineRules }} />
      <div className="admin-counts">{Object.entries(data.counts).map(([key, count]) => <button key={key} onClick={() => onSelect("Content")}><strong>{count}</strong><span>{DOMAINS[key]}</span></button>)}</div>
      <p className="admin-note">Counts describe the loaded registry and derived definitions. Decks count templates/plans; player-owned decks are under Players.</p>
      <h4>Available game entry points</h4><div className="admin-tags">{data.game.modes.map((mode) => <span key={mode.id}>{mode.name}</span>)}</div>
      <p className="admin-note">Availability is defined in code; there are no global operator mode switches.</p>
    </>}</State>
    <h4>System checks</h4><State state={system}>{(data) => <><Issues issues={data.issues} /><p className="admin-note">Checked {date(data.checkedAt)} · {data.environment} · backend {data.backendCommit || "commit not supplied"}</p></>}</State>
    <h4>Recent matches</h4><State state={recent}>{(data) => <><Issues issues={data.issues} /><MatchList records={data.matches.slice(0, 5)} /><button onClick={() => onSelect("Matches")}>Browse match evidence</button><p className="admin-note">{data.scope}</p></>}</State>
  </>;
}

function Players({ request, revision }) {
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const state = useAdminData(request, `/api/admin/players?offset=${offset}&limit=25`, revision);
  return <><p className="admin-lede">Account identity, campaign gates, unlocks and saved decks. Read-only.</p><label className="admin-search">Filter this page<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Account name or ID" /></label><State state={state}>{(data) => <>
    <p className="admin-note">Source: {data.source} · accounts {data.players.length ? offset + 1 : 0}–{offset + data.players.length}. This filter applies to the loaded page.</p>
    {!data.players.length && <p>No accounts in this page.</p>}
    {data.players.filter((player) => `${player.name} ${player.id}`.toLowerCase().includes(query.toLowerCase())).map((player) => <details className="admin-player" key={player.id}><summary><strong>{player.name}</strong> <span>{player.id}</span></summary><Facts values={{ accountId: player.id, created: date(player.createdAt), lastSeen: date(player.lastSeenAt), ...player.results }} />
      <h5>Campaign progression</h5>{player.campaigns.map((campaign) => <div key={campaign.factionId}><strong>{label(campaign.factionId)}</strong><p>{campaign.completedChapterIds.length} recorded clears / {campaign.totalChapters} chapters</p><p className="admin-note">Completed: {campaign.completedChapterIds.join(", ") || "None"}<br />Unlocked: {campaign.unlockedChapterIds.join(", ") || "None"}</p></div>)}
      <Json value={player.unlocks} title="Gameplay entitlements, credits and cosmetic unlocks" />
      <Json value={player.decks} title={`Saved deck versions (${player.decks.length} decks)`} />
      <Json value={player.matchReferences} title="Canonical match references" />
    </details>)}
    <div className="admin-actions"><button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous players</button><button disabled={!data.hasMore} onClick={() => setOffset(offset + 25)}>Next players</button></div>
  </>}</State></>;
}

function MatchList({ records, onInspect }) {
  if (!records.length) return <p>No completed matches found in this window.</p>;
  return <div className="admin-table-wrap"><table><thead><tr><th>Match / time</th><th>Participants / result</th><th>Mode / encounter</th><th>Evidence</th>{onInspect && <th>Action</th>}</tr></thead><tbody>{records.map((record) => <tr key={record.matchId}><td><code>{record.matchId}</code><small>{date(record.completedAt)}</small></td><td>{(record.participants || []).map((player) => <div key={player.playerNum}>{player.displayName} · {player.faction?.name || "Basic"} · {player.result || "Not recorded"}<small>Deck {player.deck?.deckId || "runtime"} · version {player.deck?.deckVersionId || "not recorded"}</small></div>)}</td><td>{record.mode}<small>{record.campaign?.title || record.campaign?.chapterId || "—"}</small></td><td>{record.provenance?.integrity || "Not checked"}<small>Record v{record.recordVersion} · {record.contentVersion || "No content version"}</small></td>{onInspect && <td><button aria-label={`Inspect match ${record.matchId}`} onClick={() => onInspect(record.matchId)}>Inspect</button></td>}</tr>)}</tbody></table></div>;
}

function MatchDetail({ request, id, revision }) {
  const state = useAdminData(request, `/api/admin/matches/${encodeURIComponent(id)}`, revision);
  const detailRef = useRef(null);
  useEffect(() => { detailRef.current?.scrollIntoView?.({ block: "start" }); }, [id]);
  return <section ref={detailRef} className="admin-detail"><h4>Match evidence</h4><State state={state}>{({ match, provenance }) => <>
    <Facts values={{ matchId: match.matchId, started: date(match.startedAt), completed: date(match.completedAt), mode: match.mode, result: match.completionReason, recordVersion: match.recordVersion, contentVersion: match.contentVersion, rulesVersion: match.rulesVersion, evidenceCoverage: match.leagueEvidenceCoverage, ...provenance }} />
    <h5>Participants and deck snapshots</h5>{(match.participants || []).map((player) => <div key={player.playerNum}><Facts values={{ player: player.displayName, faction: player.faction?.name, result: player.result, finalLife: player.finalLife }} /><Json value={player.deck} title={`Deck evidence for ${player.displayName}`} /></div>)}
    {match.campaign && <><h5>Campaign / encounter</h5><Facts values={match.campaign} /></>}
    <h5>Authoritative audit history · {match.auditEvents?.length || 0} events</h5>
    <div className="admin-event-list">{(match.auditEvents || []).map((event, i) => <details key={`${event.sequence}-${i}`}><summary>#{event.sequence} · turn {event.turn} · {event.eventType} · {event.publicPayload?.message || event.phase}</summary><Facts values={{ timestamp: event.serverTimestamp, actor: event.actorPlayerNum, stateChecksum: event.stateChecksum }} /><Json value={event.publicPayload} title="Event payload" /></details>)}</div>
    {!match.auditEvents?.length && <p>No audit events were recorded.</p>}
    <Json value={match.leagueEvidence || []} title={`Authoritative league evidence (${match.leagueEvidence?.length || 0})`} />
    <p className="admin-note">Public replay frames recorded: {match.publicReplayFrameCount ?? "unknown"}. Full frame playback remains available through the existing match replay view.</p>
    <Json value={match} title="Complete public record projection" />
  </>}</State></section>;
}

function Matches({ request, revision }) {
  const state = useAdminData(request, "/api/admin/matches", revision);
  const [query, setQuery] = useState("");
  const [id, setId] = useState("");
  const [lookup, setLookup] = useState("");
  return <><p className="admin-lede">Browse completed records and inspect their original evidence.</p>
    <form className="admin-actions" onSubmit={(event) => { event.preventDefault(); setId(lookup.trim()); }}><label className="admin-search">Exact match ID<input value={lookup} onChange={(event) => setLookup(event.target.value)} placeholder="UUID, including older records" required /></label><button type="submit">Look up match</button></form>
    <label className="admin-search">Search recent records<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ID, participant, mode, faction or encounter" /></label>
    <State state={state}>{(data) => <><p className="admin-note">{data.scope}</p><Issues issues={data.issues} /><MatchList records={data.matches.filter((record) => [record.matchId, record.mode, record.campaign?.title, record.campaign?.chapterId, ...(record.participants || []).flatMap((player) => [player.displayName, player.faction?.name])].join(" ").toLowerCase().includes(query.toLowerCase()))} onInspect={setId} /></>}</State>
    {id && <MatchDetail key={id} request={request} id={id} revision={revision} />}
  </>;
}

function System({ request, revision, operations }) {
  const state = useAdminData(request, "/api/admin/system", revision);
  return <><State state={state}>{(data) => <><Facts values={{ applicationVersion: data.applicationVersion, backendCommit: data.backendCommit, environment: data.environment, checkedAt: date(data.checkedAt) }} /><h4>Validation and dependencies</h4><Issues issues={data.issues} /><p>{data.validation.message}</p><div className="admin-cards">{Object.entries(data.storage).map(([name, storage]) => <article key={name}><h4>{label(name)}</h4><Facts values={Object.fromEntries(Object.entries(storage).filter(([, value]) => typeof value !== "object"))} />{storage.capabilities && <Json value={storage.capabilities} title="Storage capabilities" />}</article>)}</div><h4>Schema and rules versions</h4><Facts values={data.versions} /><h4>Content and runtime boundaries</h4>{data.sources.map((source) => <article className="admin-source" key={source.domain}><h5>{source.domain}</h5><code>{source.source}</code><p>{source.boundary}</p></article>)}<ul className="admin-note">{data.boundaries.map((boundary) => <li key={boundary}>{boundary}</li>)}</ul></>}</State>
    <details className="admin-legacy"><summary>Existing Studio operations and archive recovery</summary><p>Existing collector, active-room, season and explicit archive-import tools. Recovery imports write to the archive after preview and confirmation.</p>{operations}</details>
  </>;
}

export default function GauntletAdmin({ request, onClose, operations }) {
  const [area, setArea] = useState("Overview");
  const [revision, setRevision] = useState(0);
  const [unsaved, setUnsaved] = useState(false);
  const authoring = ["Content", "Game", "Publishing"].includes(area);
  const selectArea = (name) => {
    if (unsaved && !["Content", "Game", "Publishing"].includes(name)) {
      if (!window.confirm("Leave without saving your form values? Saved shared drafts remain available.")) return;
      setUnsaved(false);
    }
    setArea(name);
  };
  const catalog = useAdminData(request, "/api/admin/catalog", revision);
  return <section className="gauntlet-admin" aria-label="Gauntlet Admin">
    <header className="admin-header"><div><span className="admin-eyebrow">EGGS · operator workspace</span><h3>Gauntlet Admin</h3><p>Content, gameplay, players and authoritative history.</p></div><div className="admin-actions"><button onClick={() => setRevision(revision + 1)}>Refresh admin</button><button onClick={onClose}>Close admin</button></div></header>
    <nav className="admin-nav" aria-label="Administration sections">{AREAS.map((name) => <button key={name} aria-current={area === name ? "page" : undefined} onClick={() => selectArea(name)}>{name}</button>)}</nav>
    <div className="admin-body"><div className="admin-title-row"><h3>{area}</h3><span className="admin-badge">{authoring ? "Controlled authoring" : "Read-only inspection"}</span></div>
      {area === "Overview" && <Overview catalog={catalog} request={request} revision={revision} onSelect={selectArea} />}
      {authoring && <Suspense fallback={<p>Loading authoring tools…</p>}><GauntletAuthoring request={request} area={area} revision={revision} catalog={catalog.data} onPublished={() => setRevision((value) => value + 1)} onUnsavedChange={setUnsaved} /></Suspense>}
      {area === "Players" && <Players request={request} revision={revision} />}
      {area === "Matches" && <Matches request={request} revision={revision} />}
      {area === "System" && <System request={request} revision={revision} operations={operations} />}
    </div>
  </section>;
}
