import { brandText } from './brand/brandPreview';
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./GauntletAdmin.css";
import "./admin/AdminWorkspace.css";
import { OperatorPreferences, useOperatorPreferences } from "./admin/OperatorPreferences";

import { targetFromLocation } from "./admin/workshopTargets";
const GauntletAuthoring = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./GauntletAuthoring"));
import AREAS from "../../shared/admin/areas.json";
import ModuleHome from "./admin/ModuleHome";
const Competition = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./GauntletCompetition"));
const Operations = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./admin/Operations"));
import AdminSearch from "./admin/AdminSearch";
import useAdminData from "./admin/useAdminData";
const Players = lazy(() => import(/* webpackChunkName: "gauntlet-admin-workshops" */ "./admin/Players"));
function clearAdminLocation() { if (window.location.pathname.startsWith("/admin/gauntlet")) window.history.replaceState({}, "", "/"); }
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
  ["Lore & Website Text", [["modes", "Website text"]]]
];
const contentDestination = domain => CONTENT_DESTINATIONS.find(([, types]) => types.some(([id]) => id === domain)) || CONTENT_DESTINATIONS[0];

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

function Overview({ request, revision, onSelect }) {
  const state = useAdminData(request, "/api/admin/home", revision);
  return <State state={state}>{data => <ModuleHome data={data} onSelect={onSelect} />}</State>;
}

export default function GauntletAdmin(props) {
  return <OperatorPreferences key={props.operatorScope || "session"} scope={props.operatorScope}><AdminWorkspace {...props} /></OperatorPreferences>;
}
function AdminWorkspace({ request, onClose, operations, exitGuard, environment }) {
  const operator = useOperatorPreferences();
  const [area, setArea] = useState(() => { const params = new URLSearchParams(window.location.search); return AREAS.includes(params.get("area")) ? params.get("area") : params.has("workshop") && targetFromLocation() ? "Content" : "Home"; });
  const [drawer, setDrawer] = useState(false), [editing, setEditing] = useState(null);
  const rail = useRef(null), drawerTrigger = useRef(null), utilityMenu = useRef(null);
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
  const dismissMenus = () => {
    if (drawer) { setDrawer(false); drawerTrigger.current?.focus(); }
    if (utilityMenu.current?.open) { utilityMenu.current.open = false; utilityMenu.current.querySelector("summary")?.focus(); }
  };
  const canLeave = action => { dismissMenus(); return playerGuard.current(() => guard.current(action)); };
  useEffect(() => {
    const outside = event => { if (utilityMenu.current?.open && !utilityMenu.current.contains(event.target)) utilityMenu.current.open = false; };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
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
  const [catalogRequested, setCatalogRequested] = useState(!!authoringArea || area === "Players");
  useEffect(() => { if (authoringArea || area === "Players") setCatalogRequested(true); }, [authoringArea, area]);
  const catalog = useAdminData(request, "/api/admin/catalog", revision, catalogRequested);
  const currentDomain = editing?.domain || contentDomain?.name || targetFromLocation({ domain: "cards" }).domain;
  const destination = contentDestination(currentDomain);
  const closeDrawer = () => { setDrawer(false); drawerTrigger.current?.focus(); };
  const openDestination = (name, types) => { const recent = operator.preferences.recent.find(item => types.some(([id]) => id === item.domain)); selectArea("Content", recent?.domain || types[0][0], recent?.id); };
  return <section className="gauntlet-admin admin-workspace" data-density={operator.preferences.density} data-focus={operator.preferences.focus} aria-label={brandText("SuitFire Admin", "Gauntlet Admin")}>
    <a className="admin-skip" href="#admin-workspace-content">Skip to workspace</a>
    {drawer && <div className="admin-drawer-shade" onClick={closeDrawer} />}
    <div ref={rail} className={`admin-rail ${drawer ? "is-open" : ""}`} role={drawer ? "dialog" : undefined} aria-modal={drawer ? true : undefined} aria-label={drawer ? "Workspace navigation" : undefined} onKeyDown={event => {
      if (!drawer) return;
      if (event.key === "Escape") { event.preventDefault(); closeDrawer(); }
      if (event.key === "Tab") { const items = [...rail.current.querySelectorAll("button,a[href]")].filter(el => !el.disabled && el.offsetParent !== null); const first = items[0], last = items.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
    }}>
      <div className="admin-brand"><img className="admin-brand-mark" src="/brand/suitfire-v14/crest.png" alt="" /><div><strong>SUITFIRE</strong><span>Operator studio</span></div><button className="admin-drawer-close" onClick={closeDrawer} aria-label="Close navigation">×</button></div>
      <nav className="admin-nav" aria-label="Administration sections">{AREAS.map((name, index) => <div key={name}><button aria-current={area === name ? "page" : undefined} onClick={() => selectArea(name)}><svg className="admin-section-icon" viewBox="0 0 24 24" aria-hidden="true"><use href={`/brand/admin-icons.svg#area-${index}`} /></svg>{name}</button>{name === "Content" && area === "Content" && <nav className="admin-destinations" aria-label="Content destinations">{CONTENT_DESTINATIONS.map(([label, types]) => <button key={label} aria-current={destination[0] === label ? "page" : undefined} onClick={() => openDestination(label, types)}>{label}</button>)}</nav>}</div>)}</nav>
      <div className="admin-rail-footer"><button className="admin-mobile-return" onClick={() => canLeave(() => { clearAdminLocation(); onClose?.(); })}>Back to {brandText("SuitFire", "Gauntlet")} ↗</button><span className="admin-connection-dot" />{environment?.includes("127.0.0.1") || environment?.includes("localhost") ? "Local environment" : "Private administration"}<small>Server-authorized access</small></div>
    </div>
    <div className="admin-workspace-main">
    <header className="admin-topbar">
      <button ref={drawerTrigger} className="admin-drawer-trigger" aria-label="Navigation" aria-expanded={drawer} onClick={() => setDrawer(true)}><span aria-hidden="true">☰</span> Navigation</button>
      <div className="admin-location"><span>Studio</span><span aria-hidden="true">/</span><strong>{area === "Content" ? destination[0] : area}</strong></div>
      <AdminSearch request={request} onSelect={(target, accepted) => selectArea(target.area, target.domain, target.id, target.section, target.field, accepted)} />
      <span className={`admin-save-context ${editing?.unsaved ? "has-local" : ""}`}>{authoring && editing ? editing.loading ? "Loading authoring…" : editing.busy ? "Working…" : editing.unsaved ? "Unsaved in this browser" : editing.liveOnly ? "Shared draft unavailable" : ["draft", "Saved draft"].includes(editing.source) ? "Saved to shared draft" : "Live content" : "Server-authorized"}</span>
      <details ref={utilityMenu} className="admin-utilities" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); dismissMenus(); } }}><summary aria-label="Workspace options">More</summary><div><strong>Workspace preferences</strong><p className="admin-note">Personal to this account and browser. Shared alerts and release state always stay visible.</p><label>Density<select aria-label="Density" value={operator.preferences.density} onChange={event => operator.update({ density: event.target.value })}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label><label><input type="checkbox" checked={operator.preferences.focus} onChange={event => operator.update({ focus: event.target.checked })} /> Focus on editor</label><label>Preview<select aria-label="Preview visibility" value={operator.preferences.preview == null ? "auto" : String(operator.preferences.preview)} onChange={event => operator.update({ preview: event.target.value === "auto" ? null : event.target.value === "true" })}><option value="auto">Automatic for this screen</option><option value="true">Show preview</option><option value="false">Keep editor visible</option></select></label><button onClick={operator.reset}>Reset preferences</button><button onClick={() => canLeave(() => setRevision(value => value + 1))}>Refresh admin</button></div></details>
      <button className="admin-return" onClick={() => canLeave(() => { clearAdminLocation(); onClose?.(); })}>Back to {brandText("SuitFire", "Gauntlet")} <span aria-hidden="true">↗</span></button>
    </header>
    <div className="admin-body" id="admin-workspace-content" tabIndex={-1}>
      {area === "Content" && <div className="admin-content-context">{destination[1].length > 1 && <label>Content type<select aria-label="Content type" value={currentDomain} onChange={event => selectArea("Content", event.target.value)}>{destination[1].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>}{editing?.id && <button aria-pressed={operator.isPinned(editing)} onClick={() => operator.togglePin({ domain: editing.domain, id: editing.id, name: editing.name })}>{operator.isPinned(editing) ? "★ Pinned" : "☆ Pin item"}</button>}</div>}
      {area !== "Home" && area !== "Content" && area !== "Publishing" && <div className="admin-title-row"><div><span className="admin-eyebrow">{authoring ? "Shared draft workspace" : area === "Players" ? "Player support" : "Live operations"}</span><h2>{area}</h2></div><span className="admin-badge">{authoring ? "Changes go live after publishing" : area === "Players" ? "Corrections apply immediately" : "Authoritative service evidence"}</span></div>}
      {workspace[area] && <nav className="admin-subnav" aria-label={`${area} workspaces`}>{({ Competition: ["Para definitions", "Ranked & Gauntlet", "Results"], "Store & Economy": ["Products", "Gold & Rewards"], Operations: ["Health", "Match evidence"] })[area].map(value => <button key={value} aria-pressed={workspace[area] === value} onClick={() => selectWorkspace(value)}>{value}</button>)}</nav>}
      {area === "Content" && matchesOpened && <button onClick={() => selectArea("Matches")}>Return to match inspection</button>}
      {area === "Home" && <Overview request={request} revision={revision} onSelect={selectArea} />}
      {authoringArea && <div hidden={!authoring}><Suspense fallback={<p role="status">Opening your workspace…</p>}><GauntletAuthoring request={request} area={authoringArea} initialDomain={contentDomain} revision={revision} catalog={catalog.data} onStatus={setEditing} onPublished={() => setRevision((value) => value + 1)} guard={guard} onNavigate={selectArea} beforeNavigate={action => { dismissMenus(); return playerGuard.current(action); }} onExit={onClose} /></Suspense></div>}
      {area === "Players" && <Suspense fallback={<p>Loading players…</p>}><Players request={request} revision={revision} catalog={catalog.data} guard={playerGuard} useData={useAdminData} State={State} Facts={Facts} Json={Json} date={date} label={label} /></Suspense>}

      {area === "Competition" && workspace.Competition === "Results" && <Suspense fallback={<p role="status">Loading competition…</p>}><Competition request={request} revision={revision} useData={useAdminData} State={State} Json={Json} label={label} /></Suspense>}
      {(matchesOpened || area === "Operations") && <Suspense fallback={<p role="status">Loading operations…</p>}><Operations active={area === "Operations"} workspace={workspace.Operations} matchesOpened={matchesOpened} request={request} revision={revision} operations={operations} onInspectContent={inspectContent} State={State} Facts={Facts} Json={Json} date={date} label={label} /></Suspense>}
    </div></div>
  </section>;
}
