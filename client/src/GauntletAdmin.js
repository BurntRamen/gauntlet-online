import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./GauntletAdmin.css";
import "./admin/AdminWorkspace.css";
import { OperatorPreferences, useOperatorPreferences } from "./admin/OperatorPreferences";

import { targetFromLocation } from "./admin/useWorkshopContext";
const GauntletAuthoring = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./GauntletAuthoring"));
import AREAS from "../../shared/admin/areas.json";
import ModuleHome from "./admin/ModuleHome";
const Competition = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./GauntletCompetition"));
const MatchInspector = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./admin/MatchInspector"));
import AdminSearch from "./admin/AdminSearch";
const Players = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./admin/Players"));
function clearAdminLocation() { if (window.location.pathname.startsWith("/admin/gauntlet")) window.history.replaceState({}, "", "/"); }
const ICONS = ["M3 10 12 3l9 7v11h-6v-7H9v7H3Z", "M4 20h4L20 8l-4-4L4 16Zm10-14 4 4", "M8 3h8v7a4 4 0 0 1-8 0Zm0 2H4v3c0 3 4 3 4 3m8-6h4v3c0 3-4 3-4 3m-4 3v6m-4 0h8", "M4 7h16v14H4Zm4 0V5a4 4 0 0 1 8 0v2", "M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 9v-3c0-5 12-5 12 0v3m2-16c6-2 7 8 1 8m0 3c5 0 5 3 5 5", "M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6", "M3 6h18M3 12h18M3 18h18M8 3v6m8 0v6m-8 0v6"];
const label = (value) => String(value).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").replace(/^./, (char) => char.toUpperCase());
const date = (value) => value ? new Date(value).toLocaleString() : "Not recorded";
export const CONTENT_DESTINATIONS = [
  ["Cards", [["cards", "Cards"]]],
  ["Printings & Sets", [["sets", "Sets"], ["assets", "Printings"]]],
  ["Decks", [["decks", "Decks"]]],
  ["Campaigns & Encounters", [["encounters", "Encounters"], ["campaigns", "Campaign stories"]]],
  ["Factions & Characters", [["factions", "Factions"], ["characters", "Characters"]]],
  ["Media", [["asset-library", "Media library"]]],
  ["Mechanics & Rules", [["mechanics", "Mechanics Studio"], ["rule-modifiers", "Rule modifiers"], ["card-effects", "Card effects"], ["faction-effects", "Faction effects"], ["encounter-mechanics", "Encounter mechanics"], ["game", "Shared configuration"]]],
  ["Website Text", [["modes", "Website text"]]]
];
const contentDestination = domain => CONTENT_DESTINATIONS.find(([, types]) => types.some(([id]) => id === domain)) || CONTENT_DESTINATIONS[0];

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
  return issues.length > 0 ? <ul className="admin-alert">{issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul> : <p className="admin-good">These checks reported no failures.</p>;
}

function System({ request, revision, operations }) {
  const state = useAdminData(request, "/api/admin/system", revision);
  return <><State state={state}>{(data) => <><Facts values={{ applicationVersion: data.applicationVersion, backendCommit: data.backendCommit, environment: data.environment, checkedAt: date(data.checkedAt) }} /><h4>Validation and dependencies</h4><Issues issues={data.issues} /><p>{data.validation.message}</p><div className="admin-cards">{Object.entries(data.storage).map(([name, storage]) => <article key={name}><h4>{label(name)}</h4><Facts values={Object.fromEntries(Object.entries(storage).filter(([, value]) => typeof value !== "object"))} />{storage.capabilities && <Json value={storage.capabilities} title="Storage capabilities" />}</article>)}</div><details className="admin-json"><summary>Schema and rules versions</summary><Facts values={data.versions} /></details><details className="admin-json"><summary>Content and runtime boundaries</summary>{data.sources.map((source) => <article className="admin-source" key={source.domain}><h5>{source.domain}</h5><code>{source.source}</code><p>{source.boundary}</p></article>)}<ul className="admin-note">{data.boundaries.map((boundary) => <li key={boundary}>{boundary}</li>)}</ul></details></>}</State>
    <section className="admin-operations-tools" aria-label="Live service and archive recovery"><h3>Live service & archive recovery</h3><p className="admin-note">Inspect active rooms, recorded matches, collector receipts and recovery evidence. Archive imports require preview and confirmation.</p>{operations}</section>
  </>;
}


function Overview({ request, revision, onSelect }) {
  const state = useAdminData(request, "/api/admin/home", revision);
  return <State state={state}>{data => <Suspense fallback={<p>Loading overview…</p>}><ModuleHome data={data} onSelect={onSelect} /></Suspense>}</State>;
}

function MatchList({ records, onInspect }) {
  if (!records.length) return <p>No completed matches found in this window.</p>;
  return <div className="admin-table-wrap"><table><thead><tr><th>Match / time</th><th>Participants / result</th><th>Mode / encounter</th><th>Evidence</th>{onInspect && <th>Action</th>}</tr></thead><tbody>{records.map((record) => <tr key={record.matchId}><td>{date(record.completedAt)}<details><summary>Match ID</summary><code>{record.matchId}</code></details></td><td>{(record.participants || []).map((player) => <div key={player.playerNum}>{player.displayName} · {player.faction?.name || "Basic"} · {player.result || "Not recorded"}</div>)}</td><td>{record.mode}<small>{record.campaign?.title || record.campaign?.chapterId || "—"}</small></td><td>{record.provenance?.integrity || "Not checked"}<details><summary>Record versions</summary><small>Record v{record.recordVersion} · {record.contentVersion || "No content version"}</small></details></td>{onInspect && <td><button aria-label={`Inspect match ${record.matchId}`} onClick={() => onInspect(record.matchId)}>Inspect</button></td>}</tr>)}</tbody></table></div>;
}

function MatchDetail({ request, id, revision, onInspectContent }) {
  const state = useAdminData(request, `/api/admin/matches/${encodeURIComponent(id)}`, revision);
  const detailRef = useRef(null);
  useEffect(() => { detailRef.current?.scrollIntoView?.({ block: "start" }); }, [id]);
  return <section ref={detailRef} className="admin-detail"><State state={state}>{data => <Suspense fallback={<p role="status">Loading match inspection…</p>}><MatchInspector {...data} onInspect={onInspectContent} /></Suspense>}</State></section>;
}

function Matches({ request, revision, onInspectContent }) {
  const state = useAdminData(request, "/api/admin/matches", revision);
  const [query, setQuery] = useState("");
  const [id, setId] = useState("");
  const [lookup, setLookup] = useState("");
  return <><p className="admin-lede">Browse completed records and inspect their original evidence.</p>
    <form className="admin-actions" onSubmit={(event) => { event.preventDefault(); setId(lookup.trim()); }}><label className="admin-search">Exact match ID<input value={lookup} onChange={(event) => setLookup(event.target.value)} placeholder="UUID, including older records" required /></label><button type="submit">Look up match</button></form>
    <label className="admin-search">Search recent records<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ID, participant, mode, faction or encounter" /></label>
    <State state={state}>{(data) => <><p className="admin-note">{data.scope}</p><Issues issues={data.issues} /><MatchList records={data.matches.filter((record) => [record.matchId, record.mode, record.campaign?.title, record.campaign?.chapterId, ...(record.participants || []).flatMap((player) => [player.displayName, player.faction?.name])].join(" ").toLowerCase().includes(query.toLowerCase()))} onInspect={setId} /></>}</State>
    {id && <MatchDetail key={id} request={request} id={id} revision={revision} onInspectContent={onInspectContent} />}
  </>;
}



export default function GauntletAdmin(props) {
  return <OperatorPreferences key={props.operatorScope || "session"} scope={props.operatorScope}><AdminWorkspace {...props} /></OperatorPreferences>;
}
function AdminWorkspace({ request, onClose, operations, exitGuard, environment }) {
  const operator = useOperatorPreferences();
  const [area, setArea] = useState(() => { const params = new URLSearchParams(window.location.search); return AREAS.includes(params.get("area")) ? params.get("area") : params.has("workshop") && targetFromLocation() ? "Content" : "Home"; });
  const [drawer, setDrawer] = useState(false), [editing, setEditing] = useState(null);
  const rail = useRef(null), drawerTrigger = useRef(null);
  useEffect(() => { if (drawer) rail.current?.querySelector("button")?.focus(); }, [drawer]);
  const rememberedDomain = editing?.domain, rememberedId = editing?.id, rememberedName = editing?.name, remember = operator.remember;
  useEffect(() => { if (rememberedId && rememberedName) remember({ domain: rememberedDomain, id: rememberedId, name: rememberedName }); }, [rememberedDomain, rememberedId, rememberedName, remember]);
  const [workspace, setWorkspace] = useState({ Competition: "Para definitions", "Store & Economy": "Products", Operations: "Health" });
  const areaScroll = useRef({});
  useLayoutEffect(() => {
    if (areaScroll.current[area] !== undefined) window.scrollTo(0, areaScroll.current[area]);
  }, [area]);
  const [matchesOpened, setMatchesOpened] = useState(false);
  const [revision, setRevision] = useState(0);
  const guard = useRef(action => { action?.(); return true; });
  const playerGuard = useRef(action => { action?.(); return true; });
  const canLeave = action => playerGuard.current(() => guard.current(action));
  const [authoringArea, setAuthoringArea] = useState(() => ["Content", "Publishing", "Store & Economy", "Competition"].includes(area) ? area : null);
  const historyExit = useRef(onClose);
  historyExit.current = onClose;
  useEffect(() => {
    if (authoringArea) return undefined; // The workshop owns history once mounted.
    let restoring = false, resume = false;
    const pop = event => {
      if (restoring) { event.stopImmediatePropagation(); restoring = false; if (resume) { resume = false; window.history.back(); } return; }
      let deciding = true;
      const accepted = playerGuard.current(() => { if (deciding) return; if (restoring) resume = true; else window.history.back(); });
      deciding = false;
      if (!accepted) {
        event.stopImmediatePropagation(); restoring = true; window.history.go(1);
      } else historyExit.current?.();
    };
    window.addEventListener("popstate", pop, true);
    return () => window.removeEventListener("popstate", pop, true);
  }, [authoringArea]);
  useEffect(() => { if (exitGuard) exitGuard.current = action => playerGuard.current(() => guard.current(() => { if (action) clearAdminLocation(); action?.(); })); return () => { if (exitGuard) exitGuard.current = action => { action?.(); return true; }; }; }, [exitGuard]);
  const [contentDomain, setContentDomain] = useState(null);
  const authoring = ["Content", "Publishing", "Store & Economy"].includes(area) || area === "Competition" && workspace.Competition !== "Results";
  const selectArea = (name, domain, id, section, field, accepted, options) => (options?.internal ? action => action() : canLeave)(() => {
    const next = ({ Design: domain === "offers" ? "Store & Economy" : "Content", Game: "Content", Overview: "Home", System: "Operations", Matches: "Operations", "Para League & Economy": "Competition" })[name] || name;
    const nextWorkspace = options?.workspace || workspace[next];
    if (options?.workspace) setWorkspace(current => ({ ...current, [next]: options.workspace }));
    if (next !== area) areaScroll.current[area] = window.scrollY;
    if (["Content", "Publishing", "Competition", "Store & Economy"].includes(next)) setAuthoringArea(next === "Store & Economy" && nextWorkspace === "Gold & Rewards" ? "Economy" : next === "Competition" && nextWorkspace === "Ranked & Gauntlet" ? "Ranked & Gauntlet" : next);
    if (domain || name === "Game" || !options?.internal && next === "Store & Economy" && next !== area) setContentDomain({ name: domain || (next === "Store & Economy" ? "offers" : "game"), id, section, field });
    if (name === "Matches") { setMatchesOpened(true); setWorkspace(current => ({ ...current, Operations: "Match evidence" })); }
    if (name === "System") setWorkspace(current => ({ ...current, Operations: "Health" }));
    setArea(next); setDrawer(false);
    const url = new URL(window.location.href); url.searchParams.set("area", next);
    window.history.replaceState(window.history.state, "", url);
    accepted?.();
  });
  const selectWorkspace = value => canLeave(() => { setWorkspace(current => ({ ...current, [area]: value }));
    if (area === "Store & Economy") { setAuthoringArea(value === "Products" ? area : "Economy"); if (value === "Products") setContentDomain({ name: "offers" }); }
    if (area === "Competition" && value !== "Results") setAuthoringArea(value === "Para definitions" ? "Competition" : "Ranked & Gauntlet");
    if (value === "Match evidence") setMatchesOpened(true);
  });
  const inspectContent = (domain, id) => selectArea("Content", domain, id);
  const catalog = useAdminData(request, "/api/admin/catalog", revision);
  const currentDomain = editing?.domain || contentDomain?.name || targetFromLocation({ domain: "cards" }).domain;
  const destination = contentDestination(currentDomain);
  const closeDrawer = () => { setDrawer(false); drawerTrigger.current?.focus(); };
  const openDestination = (name, types) => { const recent = operator.preferences.recent.find(item => types.some(([id]) => id === item.domain)); selectArea("Content", recent?.domain || types[0][0], recent?.id); };
  return <section className="gauntlet-admin admin-workspace" data-density={operator.preferences.density} data-focus={operator.preferences.focus} aria-label="Gauntlet Admin">
    <a className="admin-skip" href="#admin-workspace-content">Skip to workspace</a>
    {drawer && <div className="admin-drawer-shade" onClick={closeDrawer} />}
    <div ref={rail} className={`admin-rail ${drawer ? "is-open" : ""}`} role={drawer ? "dialog" : undefined} aria-modal={drawer ? true : undefined} aria-label={drawer ? "Workspace navigation" : undefined} onKeyDown={event => {
      if (!drawer) return;
      if (event.key === "Escape") { event.preventDefault(); closeDrawer(); }
      if (event.key === "Tab") { const items = [...rail.current.querySelectorAll("button,a[href]")].filter(el => !el.disabled && el.offsetParent !== null); const first = items[0], last = items.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
    }}>
      <div className="admin-brand"><span className="admin-brand-mark" aria-hidden="true">G</span><div><strong>GAUNTLET</strong><span>Operator studio</span></div><button className="admin-drawer-close" onClick={closeDrawer} aria-label="Close navigation">×</button></div>
      <nav className="admin-nav" aria-label="Administration sections">{AREAS.map((name, index) => <button key={name} aria-current={area === name ? "page" : undefined} onClick={() => selectArea(name)}><svg className="admin-section-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[index] || ICONS[0]} /></svg>{name}</button>)}</nav>
      {area === "Content" && <nav className="admin-destinations" aria-label="Content destinations"><span className="admin-eyebrow">Content library</span>{CONTENT_DESTINATIONS.map(([name, types]) => <button key={name} aria-current={destination[0] === name ? "page" : undefined} onClick={() => openDestination(name, types)}>{name}</button>)}</nav>}
      <div className="admin-rail-footer"><button className="admin-mobile-return" onClick={() => canLeave(() => { clearAdminLocation(); onClose?.(); })}>Back to Gauntlet ↗</button><span className="admin-connection-dot" />{environment?.includes("127.0.0.1") || environment?.includes("localhost") ? "Local environment" : "Private administration"}<small>Server-authorized access</small></div>
    </div>
    <div className="admin-workspace-main">
    <header className="admin-topbar">
      <button ref={drawerTrigger} className="admin-drawer-trigger" aria-label="Navigation" aria-expanded={drawer} onClick={() => setDrawer(true)}><span aria-hidden="true">☰</span> Navigation</button>
      <div className="admin-location"><span>Studio</span><span aria-hidden="true">/</span><strong>{area === "Content" ? destination[0] : area}</strong></div>
      <AdminSearch request={request} onSelect={(target, accepted) => selectArea(target.area, target.domain, target.id, target.section, target.field, accepted)} />
      <span className={`admin-save-context ${editing?.unsaved ? "has-local" : ""}`}>{authoring && editing ? editing.loading ? "Loading authoring…" : editing.busy ? "Working…" : editing.unsaved ? "Unsaved in this browser" : editing.liveOnly ? "Shared draft unavailable" : ["draft", "Saved draft"].includes(editing.source) ? "Saved to shared draft" : "Live content" : "Server-authorized"}</span>
      <details className="admin-utilities"><summary aria-label="Workspace options">•••</summary><div><strong>Workspace preferences</strong><label>Density<select aria-label="Density" value={operator.preferences.density} onChange={event => operator.update({ density: event.target.value })}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label><label><input type="checkbox" checked={operator.preferences.focus} onChange={event => operator.update({ focus: event.target.checked })} /> Focus on editor</label><label>Preview<select aria-label="Preview visibility" value={operator.preferences.preview == null ? "auto" : String(operator.preferences.preview)} onChange={event => operator.update({ preview: event.target.value === "auto" ? null : event.target.value === "true" })}><option value="auto">Automatic on wide screens</option><option value="true">Show preview</option><option value="false">Keep editor visible</option></select></label><button onClick={operator.reset}>Reset preferences</button><button onClick={() => canLeave(() => setRevision(value => value + 1))}>Refresh admin</button></div></details>
      <button className="admin-return" onClick={() => canLeave(() => { clearAdminLocation(); onClose?.(); })}>Back to Gauntlet <span aria-hidden="true">↗</span></button>
    </header>
    <div className="admin-body" id="admin-workspace-content" tabIndex={-1}>
      {area === "Content" && <div className="admin-content-context">{destination[1].length > 1 && <label>Content type<select aria-label="Content type" value={currentDomain} onChange={event => selectArea("Content", event.target.value)}>{destination[1].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>}{editing?.id && <button aria-pressed={operator.isPinned(editing)} onClick={() => operator.togglePin({ domain: editing.domain, id: editing.id, name: editing.name })}>{operator.isPinned(editing) ? "★ Pinned" : "☆ Pin item"}</button>}</div>}
      {area !== "Home" && area !== "Content" && area !== "Publishing" && <div className="admin-title-row"><div><span className="admin-eyebrow">{authoring ? "Shared draft workspace" : area === "Players" ? "Player support" : "Live operations"}</span><h2>{area}</h2></div><span className="admin-badge">{authoring ? "Changes go live after publishing" : area === "Players" ? "Corrections apply immediately" : "Authoritative service evidence"}</span></div>}
      {workspace[area] && <nav className="admin-subnav" aria-label={`${area} workspaces`}>{({ Competition: ["Para definitions", "Ranked & Gauntlet", "Results"], "Store & Economy": ["Products", "Gold & Rewards"], Operations: ["Health", "Match evidence"] })[area].map(value => <button key={value} aria-pressed={workspace[area] === value} onClick={() => selectWorkspace(value)}>{value}</button>)}</nav>}
      {area === "Content" && matchesOpened && <button onClick={() => selectArea("Matches")}>Return to match inspection</button>}
      {area === "Home" && <Overview request={request} revision={revision} onSelect={selectArea} />}
      {authoringArea && <div hidden={!authoring}><Suspense fallback={<p role="status">Opening your workspace…</p>}><GauntletAuthoring request={request} area={authoringArea} initialDomain={contentDomain} revision={revision} catalog={catalog.data} onStatus={setEditing} onPublished={() => setRevision((value) => value + 1)} guard={guard} onNavigate={selectArea} beforeNavigate={action => playerGuard.current(action)} onExit={onClose} /></Suspense></div>}
      {area === "Players" && <Suspense fallback={<p>Loading players…</p>}><Players request={request} revision={revision} catalog={catalog.data} guard={playerGuard} useData={useAdminData} State={State} Facts={Facts} Json={Json} date={date} label={label} /></Suspense>}
      {matchesOpened && <div hidden={area !== "Operations" || workspace.Operations !== "Match evidence"}><Matches request={request} revision={revision} onInspectContent={inspectContent} /></div>}
      {area === "Competition" && workspace.Competition === "Results" && <Suspense fallback={<p role="status">Loading competition…</p>}><Competition request={request} revision={revision} useData={useAdminData} State={State} Json={Json} label={label} /></Suspense>}
      {area === "Operations" && workspace.Operations === "Health" && <System request={request} revision={revision} operations={operations} />}
    </div></div>
  </section>;
}
