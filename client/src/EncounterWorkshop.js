import { useEffect, useRef, useState } from "react";
import GauntletContractFields from "./GauntletContractFields";

const SECTIONS = { story: "Identity / Story", setup: "Opponent / Setup", mechanics: "Mechanics", deck: "Deck / Cards", assets: "Presentation / Assets", validation: "Validation", preview: "Preview", test: "Playtest" };

export function focusWorkshop(id) {
  const target = document.getElementById(id);
  if (!target) return;
  for (let node = target; node; node = node.parentElement) if (node.tagName === "DETAILS") node.open = true;
  target.scrollIntoView?.({ block: "start" });
  (target.querySelector(":invalid") || target.querySelector("input, textarea, select") || target).focus();
}

// Split the controls, not the authored field: all sections update and save one
// setup object using the existing optimistic revision check.
export function EncounterSetupFields({ value, onChange, ...props }) {
  const subset = (keys) => Object.fromEntries(keys.filter((key) => Object.hasOwn(value || {}, key)).map((key) => [key, value[key]]));
  const render = (keys) => <GauntletContractFields {...props} value={subset(keys)} onChange={(updates) => onChange({ ...value, ...updates })} />;
  const baseKeys = Object.keys(value || {}).filter((key) => !["bossAbility", "playerAdditions", "bossAdditions"].includes(key));
  return <div className="encounter-setup-sections">
    <section aria-label="Opponent setup controls"><h5>Opponent / Setup</h5><p className="admin-note">Starting life and scripted attacks. Attack progression offset changes the attack sequence; it does not reorder chapters.</p>{render(baseKeys)}</section>
    <section aria-label="Encounter mechanics controls"><h5>Mechanics</h5><p className="admin-note">Select a supported ability and its parameters. Ability wording is presentation; the selected rule controls behavior.</p>{render(["bossAbility"])}{value?.bossAbility?.id && <button type="button" onClick={() => props.onInspect?.("encounter-mechanics", value.bossAbility.id)}>Inspect this encounter rule</button>}</section>
    <section aria-label="Encounter card additions controls"><h5>Deck / Cards</h5><p className="admin-note">Each selected card adds one copy. Up to 12 different cards per side, from this encounter’s faction.</p>{render(["playerAdditions", "bossAdditions"])}</section>
    <p className="admin-note">Setup, mechanics and card additions save together below.</p>
  </div>;
}

export function encounterSessionStatus(session, state) {
  if (!session) return "No active playtest";
  if (session.expired || Date.parse(session.expiresAt) <= Date.now()) return "Expired playtest";
  if (session.source === "live") return session.stale || (session.releaseId && state.activeReleaseId && session.releaseId !== state.activeReleaseId) ? "Outdated live playtest" : "Current live playtest";
  return session.stale || (session.contentHash || session.draftHash) !== state.draft?.hash ? "Stale saved draft playtest" : "Current saved draft playtest";
}

export default function EncounterWorkshop({ row, state, unsaved, session, list, search, field, preview, playtest, onInspect, onReview, onSelectList, context, onContext }) {
  const guide = state.guide || {};
  const [showList, setShowList] = useState(false);
  const [activeSection, setActiveSection] = useState(context?.section || "story");
  const workspace = useRef(null);
  const latestContext = useRef({ context, onContext, row });
  latestContext.current = { context, onContext, row };
  useEffect(() => {
    const saved = latestContext.current.context;
    setShowList(false);
    setActiveSection(saved?.encounterId === row?.id && SECTIONS[saved.section] ? saved.section : "story");
    const frame = requestAnimationFrame(() => { if (saved?.encounterId === row?.id && Number.isFinite(saved.scroll)) window.scrollTo(0, saved.scroll); });
    let timer;
    const rememberScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const current = latestContext.current;
        if (!current.row || !workspace.current?.getClientRects().length) return;
        const section = Object.keys(SECTIONS).filter((id) => { const element = document.getElementById("workshop-" + id); return element && element.getBoundingClientRect().top <= 140; }).at(-1);
        if (section) setActiveSection(section);
        current.onContext?.({ encounterId: current.row.id, scroll: window.scrollY, ...(section ? { section } : {}) });
      }, 150);
    };
    window.addEventListener("scroll", rememberScroll, { passive: true });
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); window.removeEventListener("scroll", rememberScroll); };
  }, [row?.id]);
  const snapshot = state.draft?.snapshot || state.live;
  const domains = snapshot?.domains || {};
  const campaign = domains.campaigns?.find((entry) => entry.id === row?.campaignId);
  const opponent = domains.characters?.find((entry) => entry.id === row?.opponentId);
  const faction = domains.factions?.find((entry) => entry.id === row?.factionId);
  const portrait = domains.characters?.find((entry) => entry.factionId === row?.factionId && entry.role === "commander");
  const chapterIndex = campaign?.encounterIds?.indexOf(row?.id) ?? -1;
  const source = (value) => (state.assetLibrary || []).find((asset) => [asset.id, asset.source, asset.path].includes(value))?.path || value;
  const errors = state.validation?.errors || [], warnings = state.validation?.warnings || [];
  const selectedIssue = (entry) => entry.domain === "encounters" && entry.id === row?.id;
  const elsewhere = [...errors, ...warnings].filter((entry) => !selectedIssue(entry));
  const testedId = session?.subject?.kind === "encounter" ? session.subject.id : session?.context?.encounterId;
  const testLabel = session?.subject?.label || session?.context?.encounter || "Subject not recorded";
  const jump = (id) => {
    if (!SECTIONS[id]) return;
    setShowList(false); setActiveSection(id);
    requestAnimationFrame(() => { focusWorkshop("workshop-" + id); onContext?.({ encounterId: row?.id, section: id, scroll: window.scrollY }); });
  };
  return <section ref={workspace} className={"encounter-workshop " + (row && !showList ? "has-selection" : "")} aria-label="Encounter Workshop">
    <header className="workshop-context" tabIndex={-1} id="workshop-context">
      <span className="admin-eyebrow">Encounter Workshop</span>
      <h4>{row ? [campaign?.commanderName || "Campaign not recorded", chapterIndex >= 0 ? "Chapter " + (chapterIndex + 1) : "Chapter not recorded", row.title].join(" › ") : "Choose an encounter"}</h4>
      {row && <><p>{opponent?.name || "Opponent not recorded"} · {faction?.name || "Faction not recorded"}</p><div className="admin-tags">
        <span>{unsaved ? "Unsaved local values" : state.draft ? "Shared draft" : "Live content"}</span>
        <span>{state.validation?.valid ? "Saved values valid" : "Validation errors"}</span>
        <span>{state.draft?.previewedHash === state.draft?.hash && state.draft ? "Previewed revision " + (state.draft.previewedRevision ?? "not recorded") : "Preview needed"}</span>
        <span>{encounterSessionStatus(session, state)}</span>
      </div>{session && <p className="admin-note">Testing {testLabel}{testedId !== row.id ? " · another subject; this session has not changed with your selection." : "."}</p>}</>}
      <p className="admin-note">{guide.steps}</p>
      {row && <nav className="admin-actions" aria-label="Workshop sections">
        <label className="workshop-jump">Jump to section<select value={activeSection} onChange={(event) => jump(event.target.value)}>{Object.entries(SECTIONS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <div className="workshop-section-buttons">{Object.entries(SECTIONS).map(([id, label]) => <button type="button" key={id} aria-pressed={activeSection === id} onClick={() => jump(id)}>{label}</button>)}</div>
        <button type="button" onClick={onReview}>Review release</button>
        <button type="button" className="workshop-list-toggle" onClick={() => onSelectList ? onSelectList(() => setShowList(true)) : setShowList(true)}>Encounter list</button>
      </nav>}
    </header>
    <section className="workshop-list" aria-label="Encounter selection">{search}<div onClick={(event) => { if (event.target.closest("button[aria-pressed]")) setShowList(false); }}>{list}</div></section>
    {row && <><div className="workshop-editor">
      <section id="workshop-story" tabIndex={-1}><h4>Identity / Story</h4>{["title", "playableName", "story", "beforeBattle", "afterBattle", "dialogue", "endDialogue"].map((name) => field(name))}</section>
      <section id="workshop-setup" tabIndex={-1}><h4>Opponent / Setup</h4><p>Opponent: {opponent ? <button type="button" onClick={() => onInspect("characters", opponent.id)}>{opponent.name}</button> : "Not recorded"}<br />Effective player faction: {faction ? <button type="button" onClick={() => onInspect("factions", faction.id)}>{faction.name}</button> : "Not recorded"}</p>
        {field("setup", { renderContract: (props) => <EncounterSetupFields {...props} /> })}
        <details><summary>Technical · identity and routing</summary><pre className="admin-protected">{JSON.stringify({ encounter: row.id, campaign: row.campaignId, opponent: row.opponentId, deck: row.deckId, nextEncounter: row.nextEncounterId, branches: row.branches }, null, 2)}</pre></details>
      </section>
      <section id="workshop-assets" tabIndex={-1}><h4>Presentation / Assets</h4>{field("image")}{row.image && <img className="admin-art-preview" src={source(row.image)} alt="Saved encounter scene" loading="lazy" />}
        <p className="admin-note">{portrait ? "Faction commander portrait comes from this character definition:" : "No faction commander portrait recorded."}</p>
        {portrait && <>{portrait.image && <img className="workshop-portrait" src={source(portrait.image)} alt={portrait.name} loading="lazy" />}<button type="button" onClick={() => onInspect("characters", portrait.id)}>Open {portrait.name} portrait definition</button></>}
        {["dialogueAudio", "endDialogueAudio"].map((key) => <div key={key}>{field(key)}{(row[key] || []).map((audio, index) => audio && <label className="workshop-audio" key={index}>{key === "dialogueAudio" ? "Opening" : "Closing"} voice {index + 1}<audio controls preload="none" aria-label={(key === "dialogueAudio" ? "Opening" : "Closing") + " voice " + (index + 1)} src={source(audio)} /></label>)}</div>)}
      </section>
      <section id="workshop-validation" tabIndex={-1}><h4>Validation</h4><p>Saved revision {state.revision} · {!errors.filter(selectedIssue).length ? "No errors for this encounter" : "Encounter needs attention"}. {unsaved && guide.unsavedReadiness}</p>
        {[["Errors", errors.filter(selectedIssue)], ["Warnings", warnings.filter(selectedIssue)]].map(([label, entries]) => <div key={label}><h5>{label} · {entries.length}</h5>{entries.map((entry, index) => <p key={index}>{entry.message} <button type="button" onClick={() => focusWorkshop("admin-field-" + entry.field)}>Go to {entry.field}</button></p>)}</div>)}
        {elsewhere.length > 0 && <details><summary>{elsewhere.length} validation issue{elsewhere.length === 1 ? "" : "s"} elsewhere in the shared draft</summary>{elsewhere.map((entry, index) => <p key={index}>{entry.message}{entry.domain && entry.id && <button type="button" onClick={() => onInspect(entry.domain, entry.id)}>Open related content</button>}</p>)}</details>}
      </section>
    </div><section className="workshop-testing" aria-label="Encounter preview and playtest"><section id="workshop-preview" tabIndex={-1}><h4>Presentation preview</h4>{preview ? <details><summary>Open presentation preview</summary>{preview}</details> : <p className="admin-note">{guide.previewHelp}</p>}</section>{playtest}</section></>}
  </section>;
}
