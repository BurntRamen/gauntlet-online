import { useEffect, useRef, useState } from "react";
import "./GauntletAdmin.css";

import GauntletAuthoring from "./GauntletAuthoring";
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
      <details className="admin-json"><summary>Advanced / Technical · content and rules versions</summary><Facts values={{ contentVersion: data.versions.content, registryRules: data.versions.registryRules, engineRules: data.versions.engineRules }} /></details>
      <div className="admin-counts">{Object.entries(data.counts).map(([key, count]) => <button key={key} onClick={() => onSelect("Content", key)}><strong>{count}</strong><span>{DOMAINS[key]}</span></button>)}</div>
      <p className="admin-note">Counts describe the loaded registry and derived definitions. Decks count templates/plans; player-owned decks are under Players.</p>
      <h4>Available game entry points</h4><div className="admin-tags">{data.game.modes.map((mode) => <span key={mode.id}>{mode.name}</span>)}</div>
      <p className="admin-note">Availability is defined in code; there are no global operator mode switches.</p>
    </>}</State>
    <h4>System checks</h4><State state={system}>{(data) => <><Issues issues={data.issues} /><p className="admin-note">Checked {date(data.checkedAt)} · {data.environment} · backend {data.backendCommit || "commit not supplied"}</p></>}</State>
    <h4>Recent matches</h4><State state={recent}>{(data) => <><Issues issues={data.issues} /><MatchList records={data.matches.slice(0, 5)} /><button onClick={() => onSelect("Matches")}>Browse match evidence</button><p className="admin-note">{data.scope}</p></>}</State>
  </>;
}

function PlayerMetadataEditor({ player, request, guard, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(player.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const input = useRef(null);
  useEffect(() => { if (editing) input.current?.focus(); }, [editing]);
  const dirty = editing && value !== player.name;
  function leave() {
    if (pending.current) return false;
    if (dirty && !window.confirm("Discard unsaved player metadata changes?")) return false;
    setEditing(false); setValue(player.name); setError("");
    return true;
  }
  useEffect(() => { guard.current = leave; return () => { guard.current = () => true; }; });
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  async function save(event) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      await request(`/api/admin/players/${encodeURIComponent(player.id)}/metadata`, {
        method: "PATCH", body: JSON.stringify({ expectedName: player.name, metadata: { name: value } })
      });
      pending.current = false; guard.current = () => true;
      setEditing(false); onSaved();
    } catch (failure) { setError(failure.message); }
    finally { pending.current = false; setBusy(false); }
  }
  return editing ? <form className="admin-player-edit" onSubmit={save} aria-label="Edit player metadata">
    <label className="admin-search">Player name<input ref={input} value={value} disabled={busy} minLength={3} maxLength={24} pattern={"[A-Za-z0-9 _\\-]{3,24}"} required aria-describedby="player-name-help" onChange={(event) => setValue(event.target.value)} /></label>
    <p id="player-name-help" className="admin-note">This is also the name used to sign in. Changes save directly to this account.</p>
    {error && <p role="alert" className="admin-alert">{error}</p>}
    <div className="admin-actions"><button type="submit" disabled={busy || !dirty}>{busy ? "Saving…" : "Save metadata"}</button><button type="button" disabled={busy} onClick={leave}>Cancel</button></div>
  </form> : <button onClick={() => setEditing(true)}>Edit metadata</button>;
}

function PlayerProfile({ player, catalog, onBack, request, guard, onSaved }) {
  const [section, setSection] = useState("Summary");
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); }, [player.id]);
  const name = (domain, id) => catalog?.domains?.[domain]?.find((item) => item.id === id)?.name || label(id);
  const unlocks = player.unlocks || {};
  const decks = player.decks || [];
  const campaigns = player.campaigns || [];
  return <section className="admin-player-profile" aria-label="Selected player">
    <button className="admin-player-back" onClick={onBack}>Back to player list</button>
    <header className="admin-player-heading"><div><span className="admin-eyebrow">Player profile</span><h4 ref={heading} tabIndex={-1}>{player.name}</h4><p className="admin-note">Last seen {date(player.lastSeenAt)}</p></div></header>
    <PlayerMetadataEditor player={player} request={request} guard={guard} onSaved={onSaved} />
    <nav className="admin-subnav" aria-label="Player details">{["Summary", "Campaigns", "Collection", "Decks", "Technical"].map((item) => <button key={item} aria-pressed={section === item} onClick={() => setSection(item)}>{item}</button>)}</nav>
    {section === "Summary" && <><h5>At a glance</h5><Facts values={{ gamesPlayed: player.results?.gamesPlayed, wins: player.results?.gamesWon, losses: player.results?.gamesLost, draws: player.results?.gamesDrawn }} />
      <div className="admin-player-totals"><p><strong>{campaigns.reduce((sum, campaign) => sum + campaign.completedChapterIds.length, 0)}</strong> campaign chapters cleared</p><p><strong>{decks.filter((deck) => !deck.archived).length}</strong> active saved decks</p></div>
      <p className="admin-note">Joined {date(player.createdAt)}. Choose a section above to see more.</p>
    </>}
    {section === "Campaigns" && <><h5>Campaign progress</h5>{!campaigns.length && <p>No campaign progress recorded.</p>}{campaigns.map((campaign) => {
      const chapters = catalog?.domains?.campaigns?.find((item) => item.id === campaign.factionId)?.definition?.chapters;
      return <details className="admin-player-card" key={campaign.factionId}><summary><strong>{name("factions", campaign.factionId)}</strong><span>{campaign.completedChapterIds.length} / {campaign.totalChapters} chapters cleared</span></summary>
        {chapters ? <ul className="admin-player-rows">{chapters.map((chapter) => <li key={chapter.id}><span>{chapter.title}</span><small>{campaign.completedChapterIds.includes(chapter.id) ? "Cleared" : campaign.unlockedChapterIds.includes(chapter.id) ? "Available" : "Locked"}</small></li>)}</ul> : <p>Chapter names are unavailable. Refresh admin to reload the content catalog.</p>}
      </details>;
    })}</>}
    {section === "Collection" && <><h5>Collection & unlocks</h5><Facts values={{ packCredits: unlocks.packCredits, achievements: unlocks.achievementIds?.length }} />
      {[ ["Gameplay cards", Object.entries(unlocks.gameplayEntitlements || {}).map(([id, count]) => `${name("cards", id)} · ${count}`)], ["Collector variants", Object.entries(unlocks.collectorVariants || {}).map(([id, count]) => `${label(id)} · ${count}`)], ["Titles", (unlocks.titles || []).map(label)], ["Card backs", (unlocks.cardBacks || []).map(label)], ["Faction badges", (unlocks.factionBadges || []).map((id) => name("factions", id))] ].map(([title, items]) => <details className="admin-player-card" key={title}><summary>{title}<span>{items.length} recorded</span></summary>{items.length ? <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>None recorded.</p>}</details>)}
    </>}
    {section === "Decks" && <><h5>Saved decks</h5>{!decks.length && <p>No saved decks.</p>}{decks.map((deck) => {
      const current = deck.versions?.find((version) => version.id === deck.currentVersionId);
      return <details className="admin-player-card" key={deck.id}><summary><strong>{deck.name || "Untitled deck"}</strong><span>{name("factions", deck.factionId || "basic")} · {deck.archived ? "Archived" : "Active"}</span></summary><p className="admin-note">{label(deck.format || "Not recorded")} · {deck.versions?.length || 0} saved versions · Updated {date(deck.updatedAt)}</p>
        {current ? <ul className="admin-player-rows">{Object.entries(current.cardQuantities || {}).map(([id, count]) => <li key={id}><span>{name("cards", id)}</span><small>×{count}</small></li>)}</ul> : <p>Current deck version not recorded.</p>}
      </details>;
    })}</>}
    {section === "Technical" && <><h5>Account records</h5><p className="admin-note">Permanent account identity and original records for troubleshooting.</p><Facts values={{ accountId: player.id, source: player.source, created: date(player.createdAt), lastSeen: date(player.lastSeenAt) }} /><Json value={player} title="Complete player record" /></>}
  </section>;
}

function Players({ request, revision, catalog, guard }) {
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState("");
  const list = useRef(null);
  const state = useAdminData(request, `/api/admin/players?offset=${offset}&limit=25`, `${revision}:${reload}`);
  const select = (id) => { if (id === selectedId) return true; if (!guard.current()) return false; setSelectedId(id); setNotice(""); return true; };
  return <><p className="admin-lede">Find a player, then open their profile to explore progress, collection and decks.</p>{notice && <p role="status" className="admin-good">{notice}</p>}<State state={state}>{(data) => {
    const filtered = data.players.filter((player) => `${player.name} ${player.id}`.toLowerCase().includes(query.toLowerCase()));
    const selected = data.players.find((player) => player.id === selectedId);
    return <div className={`admin-players-layout${selected ? " has-selection" : ""}`}>
      <div className="admin-player-directory"><label className="admin-search">Filter this page<input ref={list} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Player name or account ID" /></label>
        <p className="admin-note">Players {data.players.length ? offset + 1 : 0}–{offset + data.players.length} · Filter searches this page.</p>
        {!data.players.length && <p>No accounts in this page.</p>}
        {data.players.length > 0 && !filtered.length && <p role="status">No players match this filter on the loaded page. Clear the filter or try another page.</p>}
        <div className="admin-object-list">{filtered.map((player) => <button key={player.id} aria-label={`View player ${player.name}`} aria-pressed={selectedId === player.id} onClick={() => select(player.id)}><strong>{player.name}</strong><small>Last seen {date(player.lastSeenAt)}</small></button>)}</div>
        <div className="admin-actions"><button disabled={!offset} onClick={() => { if (guard.current()) { setSelectedId(null); setOffset(Math.max(0, offset - 25)); } }}>Previous players</button><button disabled={!data.hasMore} onClick={() => { if (guard.current()) { setSelectedId(null); setOffset(offset + 25); } }}>Next players</button></div>
      </div>
      {selected ? <PlayerProfile key={selected.id} player={selected} catalog={catalog} request={request} guard={guard} onSaved={() => { setNotice("Player metadata saved."); setReload((value) => value + 1); }} onBack={() => { if (select(null)) requestAnimationFrame(() => list.current?.focus()); }} /> : <div className="admin-player-empty"><h4>Select a player</h4><p>Choose a name to view their profile.</p></div>}
    </div>;
  }}</State></>;
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
    <Facts values={{ started: date(match.startedAt), completed: date(match.completedAt), mode: match.mode, result: match.completionReason, evidenceCoverage: match.leagueEvidenceCoverage, integrity: provenance.integrity }} />
    <details className="admin-json"><summary>Advanced / Technical · match identity and provenance</summary><Facts values={{ matchId: match.matchId, recordVersion: match.recordVersion, contentVersion: match.contentVersion, rulesVersion: match.rulesVersion, ...provenance }} /></details>
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

export default function GauntletAdmin({ request, onClose, operations, exitGuard }) {
  const [area, setArea] = useState("Overview");
  const [revision, setRevision] = useState(0);
  const guard = useRef(() => true);
  const playerGuard = useRef(() => true);
  const canLeave = () => guard.current() && playerGuard.current();
  const [authoringArea, setAuthoringArea] = useState(null);
  useEffect(() => { if (exitGuard) exitGuard.current = () => guard.current() && playerGuard.current(); return () => { if (exitGuard) exitGuard.current = () => true; }; }, [exitGuard]);
  const [contentDomain, setContentDomain] = useState({ name: "campaigns" });
  const authoring = ["Content", "Game", "Publishing"].includes(area);
  const selectArea = (name, domain) => {
    if (!canLeave()) return;
    if (["Content", "Game", "Publishing"].includes(name)) setAuthoringArea(name);
    if (domain) setContentDomain({ name: domain });
    setArea(name);
  };
  const catalog = useAdminData(request, "/api/admin/catalog", revision);
  return <section className="gauntlet-admin" aria-label="Gauntlet Admin">
    <header className="admin-header"><div><span className="admin-eyebrow">EGGS · operator workspace</span><h3>Gauntlet Admin</h3><p>Content, gameplay, players and authoritative history.</p></div><div className="admin-actions"><button onClick={() => { if (canLeave()) setRevision(revision + 1); }}>Refresh admin</button><button onClick={() => { if (canLeave()) onClose(); }}>Close admin</button></div></header>
    <nav className="admin-nav" aria-label="Administration sections">{AREAS.map((name) => <button key={name} aria-current={area === name ? "page" : undefined} onClick={() => selectArea(name)}>{name}</button>)}</nav>
    <div className="admin-body"><div className="admin-title-row"><h3>{area}</h3><span className="admin-badge">{authoring ? "Shared draft authoring" : area === "Players" ? "Player profiles" : area === "System" ? "Diagnostics and recovery" : "Read-only inspection"}</span></div>
      {area === "Overview" && <Overview catalog={catalog} request={request} revision={revision} onSelect={selectArea} />}
      {authoringArea && <div hidden={!authoring}><GauntletAuthoring request={request} area={authoringArea} initialDomain={contentDomain} revision={revision} catalog={catalog.data} onPublished={() => setRevision((value) => value + 1)} guard={guard} onNavigate={selectArea} /></div>}
      {area === "Players" && <Players request={request} revision={revision} catalog={catalog.data} guard={playerGuard} />}
      {area === "Matches" && <Matches request={request} revision={revision} />}
      {area === "System" && <System request={request} revision={revision} operations={operations} />}
    </div>
  </section>;
}
