import Help from "./admin/AuthoringHelp";
import { useEffect, useRef, useState } from "react";
import GauntletContractFields from "./GauntletContractFields";
import WorkshopShell, { WorkshopSection } from "./admin/WorkshopShell";
import { PrivateImage } from "./admin/PrivateAsset";

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
    <section aria-label="Opponent setup controls"><h5>Opponent / Setup</h5><Help className="admin-note" topic="EncounterWorkshop1" />{render(baseKeys)}</section>
    <section aria-label="Encounter mechanics controls" id="workshop-mechanics" tabIndex={-1}><h5>Mechanics</h5><Help className="admin-note" topic="EncounterWorkshop2" />{render(["bossAbility"])}{value?.bossAbility?.id && <button type="button" onClick={() => props.onInspect?.("encounter-mechanics", value.bossAbility.id)}>Inspect this encounter rule</button>}</section>
    <section aria-label="Encounter card additions controls" id="workshop-deck" tabIndex={-1}><h5>Deck / Cards</h5><Help className="admin-note" topic="EncounterWorkshop3" />{render(["playerAdditions", "bossAdditions"])}</section>
    <Help className="admin-note" topic="EncounterWorkshopNote1" />
  </div>;
}

export function encounterSessionStatus(session, state) {
  if (!session) return "No active playtest";
  if (session.expired || Date.parse(session.expiresAt) <= Date.now()) return "Expired playtest";
  if (session.source === "live") return session.stale || (session.releaseId && state.activeReleaseId && session.releaseId !== state.activeReleaseId) ? "Outdated live playtest" : "Current live playtest";
  return session.stale || (session.contentHash || session.draftHash) !== state.draft?.hash ? "Stale saved draft playtest" : "Current saved draft playtest";
}

export default function EncounterWorkshop({ row, state, unsaved, session, list, search, field, preview, playtest, onInspect, onReview, onSelectList, context, onContext, section, onSection, busy }) {
  const guide = state.guide || {};

  const [localSection, setActiveSection] = useState(context?.section || "story");
  const activeSection = SECTIONS[section] ? section : localSection;
  const group = ["mechanics", "deck"].includes(activeSection) ? "setup" : activeSection;

  const latestContext = useRef({ context, onContext, row });
  latestContext.current = { context, onContext, row };
  useEffect(() => {
    const saved = latestContext.current.context;

    setActiveSection(saved?.encounterId === row?.id && SECTIONS[saved.section] ? saved.section : "story");
    const frame = requestAnimationFrame(() => { if (saved?.encounterId === row?.id && Number.isFinite(saved.scroll)) window.scrollTo(0, saved.scroll); });
    return () => cancelAnimationFrame(frame);
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
    if (onSection) { onSection(id); return; }
 setActiveSection(id);
    requestAnimationFrame(() => { focusWorkshop("workshop-" + id); onContext?.({ encounterId: row?.id, section: id, scroll: window.scrollY }); });
  };
  const sourceLabel = state.draft ? "Saved draft" : "Live content";
  const description = row ? [campaign?.commanderName || "Campaign not recorded", chapterIndex >= 0 ? "Chapter " + (chapterIndex + 1) : row.order ? "Additional encounter " + row.order : null, opponent?.name].filter(Boolean).join(" · ") : "Choose an encounter to shape its story, setup and player briefing.";
  return <WorkshopShell name="Encounter Workshop" title={row?.title || "Choose an encounter"} description={description} selectionId={row?.id} search={search} list={list} busy={busy} onSelectList={onSelectList}
    sections={row && Object.entries(SECTIONS)} section={activeSection} onSection={jump}
    status={row && <><span>{unsaved ? "Unsaved changes in this browser" : sourceLabel}</span><span>{state.validation?.valid ? "Saved values valid" : "Validation needs attention"}</span></>}
    actions={<button type="button" disabled={busy} onClick={onReview}>Review release</button>}
    preview={row && !["preview", "test"].includes(group) && <WorkshopSection title="Briefing preview" id="encounter-briefing"><p className="admin-preview-source">{sourceLabel} · player briefing</p>{unsaved && <p className="admin-note">Local edits are not included. Save changes to refresh the briefing.</p>}{preview || <p className="admin-note">{guide.previewHelp || "Save a valid draft to preview the player briefing."}</p>}</WorkshopSection>}>
    {row && <>{session && <p className="admin-note">Testing {testLabel}{testedId !== row.id ? " · another subject; this session has not changed with your selection." : "."}</p>}
      <div hidden={group !== "story"}><WorkshopSection title="Identity / Story" id="workshop-story"><p className="admin-note">Story and dialogue appear in the player briefing. Each audio entry follows its corresponding dialogue line.</p>{["title", "status", "order", "playableName", "story", "beforeBattle", "afterBattle", "dialogue", "endDialogue"].map((name) => field(name))}</WorkshopSection></div>
      <div hidden={group !== "setup"}><WorkshopSection title="Opponent / Setup" id="workshop-setup"><div className="admin-record-summary"><p>Opponent: {opponent ? <button type="button" onClick={() => onInspect("characters", opponent.id)}>{opponent.name}</button> : "Not recorded"}</p><p>Player faction: {faction ? <button type="button" onClick={() => onInspect("factions", faction.id)}>{faction.name}</button> : "Not recorded"}</p></div>
        {field("ruleModifierId")}{field("opponentDeckId")}{row.opponentDeckId && <button type="button" onClick={() => onInspect("decks", row.opponentDeckId)}>Inspect assigned opponent recipe</button>}
        {field("setup", { renderContract: (props) => <EncounterSetupFields {...props} /> })}
        <details className="admin-json"><summary>Technical · identity and routing</summary><pre className="admin-protected">{JSON.stringify({ encounter: row.id, campaign: row.campaignId, opponent: row.opponentId, deck: row.deckId, nextEncounter: row.nextEncounterId, branches: row.branches }, null, 2)}</pre></details>
      </WorkshopSection></div>
      <div hidden={group !== "assets"}><WorkshopSection title="Presentation / Assets" id="workshop-assets">{field("image")}{row.image && <PrivateImage className="admin-art-preview" src={source(row.image)} alt="Saved encounter scene" loading="lazy" />}
        <p className="admin-note">{portrait ? "Faction commander portrait comes from this character definition:" : "No faction commander portrait recorded."}</p>
        {portrait && <>{portrait.image && <PrivateImage className="workshop-portrait" src={source(portrait.image)} alt={portrait.name} loading="lazy" />}<button type="button" onClick={() => onInspect("characters", portrait.id)}>Open {portrait.name} portrait definition</button></>}
        {["dialogueAudio", "endDialogueAudio"].map((key) => <div key={key}>{field(key)}{(row[key] || []).map((audio, index) => audio && <label className="workshop-audio" key={index}>{key === "dialogueAudio" ? "Opening" : "Closing"} voice {index + 1}<audio controls preload="none" aria-label={(key === "dialogueAudio" ? "Opening" : "Closing") + " voice " + (index + 1)} src={source(audio)} /></label>)}</div>)}
      </WorkshopSection></div>
      <div hidden={group !== "validation"}><WorkshopSection title="Validation" id="workshop-validation"><p>{!errors.filter(selectedIssue).length ? "No errors for this encounter" : "Encounter needs attention"}. {unsaved && "Save local changes before validating again."}</p>
        {[["Errors", errors.filter(selectedIssue)], ["Warnings", warnings.filter(selectedIssue)]].map(([label, entries]) => <div key={label}><h5>{label} · {entries.length}</h5>{entries.map((entry, index) => <p key={index}>{entry.message} <button type="button" onClick={() => jump(entry.field === "setup" ? "setup" : ["image", "dialogueAudio", "endDialogueAudio"].includes(entry.field) ? "assets" : "story")}>Go to {entry.field}</button></p>)}</div>)}
        {elsewhere.length > 0 && <details><summary>{elsewhere.length} validation issue{elsewhere.length === 1 ? "" : "s"} elsewhere in the shared draft</summary>{elsewhere.map((entry, index) => <p key={index}>{entry.message}{entry.domain && entry.id && <button type="button" onClick={() => onInspect(entry.domain, entry.id, entry.field)}>Open related content</button>}</p>)}</details>}
      </WorkshopSection></div>
      <div hidden={group !== "preview"}><WorkshopSection title="Presentation preview" id="workshop-preview"><p className="admin-preview-source">{sourceLabel} · player briefing</p>{group === "preview" && (preview || <p className="admin-note">{guide.previewHelp}</p>)}</WorkshopSection></div>
      <div hidden={group !== "test"}><WorkshopSection title="Playtest" id="workshop-test"><p className="admin-note">{encounterSessionStatus(session, state)}{state.draft && <> · {state.draft.previewedHash === state.draft.hash ? "Saved draft preview is current" : "Saved draft preview still needed"}</>}</p>{playtest}</WorkshopSection></div>
    </>}
  </WorkshopShell>;
}
