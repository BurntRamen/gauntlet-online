import {useHelp as useCreativeCopy} from "./admin/AuthoringHelp";
import Validation from "./admin/WorkshopValidation";
import {Json} from './admin/Presentation';
import Help from "./admin/AuthoringHelp";
import GauntletContractFields from "./GauntletContractFields";
import WorkshopShell, { WorkshopSection } from "./admin/WorkshopShell";
import { PrivateImage, PrivateAudio } from "./admin/PrivateAsset";

const SECTIONS = { story: "Story", setup: "Opponent", mechanics: "Rules", deck: "Cards", assets: "Media", test: "Test" };

export function focusWorkshop(id) {
  const target = document.getElementById(id);
  if (!target) return;
  for (let node = target; node; node = node.parentElement) if (node.tagName === "DETAILS") node.open = true;
  target.scrollIntoView?.({ block: "start" });
  (target.querySelector(":invalid") || target.querySelector("input, textarea, select") || target).focus();
}

// Split the controls, not the authored field: all sections update and save one
// setup object using the existing optimistic revision check.
export function EncounterSetupFields({ value, onChange, group, ...props }) {
  const creativeCopy=useCreativeCopy();

  const subset = (keys) => Object.fromEntries(keys.filter((key) => Object.hasOwn(value || {}, key)).map((key) => [key, value[key]]));
  const render = (keys) => <GauntletContractFields {...props} value={subset(keys)} onChange={(updates) => onChange({ ...value, ...updates })} />;
  const baseKeys = Object.keys(value || {}).filter((key) => !["bossAbility", "playerAdditions", "bossAdditions"].includes(key));
  return <div className="encounter-setup-sections">
    {(!group || group === "setup" || group === "mechanics") && <section aria-label={creativeCopy.creativeEncounterWorkshop1}><h5>Opponent / Setup</h5><Help className="admin-note" topic="EncounterWorkshop1" />{render(group === "setup" ? ["bossLife"] : group === "mechanics" ? baseKeys.filter(key=>key!=="bossLife") : baseKeys)}</section>}
    {(!group || group === "mechanics") && <section aria-label={creativeCopy.creativeEncounterWorkshop2} id="workshop-mechanics" tabIndex={-1}><h5>Mechanics</h5><Help className="admin-note" topic="EncounterWorkshop2" />{render(["bossAbility"])}{value?.bossAbility?.id && <button type="button" onClick={() => props.onInspect?.("encounter-mechanics", value.bossAbility.id)}>{creativeCopy.creativeEncounterWorkshop3}</button>}</section>}
    {(!group || group === "deck") && <section aria-label={creativeCopy.creativeEncounterWorkshop4} id="workshop-deck" tabIndex={-1}><h5>Deck / Cards</h5><Help className="admin-note" topic="EncounterWorkshop3" />{render(["playerAdditions", "bossAdditions"])}</section>}
    <Help className="admin-note" topic="EncounterWorkshopNote1" />
  </div>;
}

export default function EncounterWorkshop({ row, state, unsaved, list, search, field, preview, playtest, onInspect, onReview, section, onSection, busy }) {
  const creativeCopy=useCreativeCopy();

  const guide = state.guide || {};

  const activeSection = ({validation:"story",preview:"assets"})[section] || (SECTIONS[section] ? section : "story");
  const group = activeSection;
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
  const jump = onSection;
  const sourceLabel = state.draft ? "Saved draft" : "Live content";
  const description = row ? [campaign?.commanderName || "Campaign not recorded", chapterIndex >= 0 ? "Chapter " + (chapterIndex + 1) : row.order ? "Additional encounter " + row.order : null, opponent?.name].filter(Boolean).join(" · ") : creativeCopy.creativeEncounterWorkshop5;
  return <WorkshopShell name="Encounter Workshop" title={row?.title || "Choose an encounter"} description={description} selectionId={row?.id} search={search} list={list} busy={busy}
    sections={row && Object.entries(SECTIONS)} section={activeSection} onSection={jump}
    actions={<>{campaign && <button disabled={busy} onClick={()=>onInspect("campaigns",campaign.id)}>{campaign.commanderName}</button>}<button type="button" disabled={busy} onClick={onReview}>Review release</button></>}
    preview={row && !["preview", "test"].includes(group) && <WorkshopSection title="Briefing preview" id="encounter-briefing"><p className="admin-preview-source">{sourceLabel} · player briefing</p>{unsaved && <Help topic="workspaceEncounterWorkshop1" className="admin-note" />}{preview || <p className="admin-note">{guide.previewHelp || creativeCopy.creativeEncounterWorkshop6}</p>}</WorkshopSection>}>
    {row && <>
      <div hidden={group !== "story"}><WorkshopSection title="Identity / Story" id="workshop-story"><Help topic="workspaceEncounterWorkshop2" className="admin-note" />{["title", "status", "order", "playableName", "story", "beforeBattle", "afterBattle", "dialogue", "endDialogue"].map((name) => field(name))}</WorkshopSection></div>
      <div hidden={!["setup","mechanics","deck"].includes(group)}><WorkshopSection title={SECTIONS[group] || "Opponent"} id="workshop-setup"><div hidden={group!=="setup"} className="admin-record-summary"><p>Opponent: {opponent ? <button type="button" onClick={() => onInspect("characters", opponent.id)}>{opponent.name}</button> : "Not recorded"}</p><p>Player faction: {faction ? <button type="button" onClick={() => onInspect("factions", faction.id)}>{faction.name}</button> : "Not recorded"}</p></div>
        <div hidden={group!=="mechanics"}><p className="admin-note">{guide.encounterObjective}</p>{guide.unavailableObjectives && <details><summary>{creativeCopy.creativeEncounterWorkshop7}</summary><p>{guide.unavailableObjectives}</p></details>}
        {field("ruleModifierId")}</div><div hidden={group!=="setup"}>{field("aiProfile")}{field("opponentDeckId")}{row.opponentDeckId && <button type="button" onClick={() => onInspect("decks", row.opponentDeckId)}>{creativeCopy.creativeEncounterWorkshop8}</button>}</div>
        {field("setup", { renderContract: (props) => <EncounterSetupFields {...props} group={group} /> })}
        <Json title={<>{creativeCopy.creativeEncounterWorkshop9}</>} value={{ encounter: row.id, campaign: row.campaignId, opponent: row.opponentId, deck: row.deckId, nextEncounter: row.nextEncounterId, branches: row.branches }} className="admin-json" preClassName="admin-protected" />
      </WorkshopSection></div>
      <div hidden={group !== "assets"}><WorkshopSection title={creativeCopy.creativeEncounterWorkshop10} id="workshop-assets">{field("image")}{row.image && <PrivateImage className="admin-art-preview" src={source(row.image)} alt="Saved encounter scene" loading="lazy" />}
        <p className="admin-note">{portrait ? creativeCopy.creativeEncounterWorkshop11 : creativeCopy.creativeEncounterWorkshop12}</p>
        {portrait && <>{portrait.image && <PrivateImage className="workshop-portrait" src={source(portrait.image)} alt={portrait.name} loading="lazy" />}<button type="button" onClick={() => onInspect("characters", portrait.id)}>Open {portrait.name} portrait definition</button></>}
        {["dialogueAudio", "endDialogueAudio"].map((key) => <div key={key}>{field(key)}{(row[key] || []).map((audio, index) => audio && <label className="workshop-audio" key={index}>{key === "dialogueAudio" ? "Opening" : "Closing"} voice {index + 1}<PrivateAudio label={(key === "dialogueAudio" ? "Opening" : "Closing") + " voice " + (index + 1)} src={source(audio)} /></label>)}</div>)}
      </WorkshopSection></div>
      <details className="encounter-validation"><summary>Validation · {errors.filter(selectedIssue).length} errors</summary><WorkshopSection title="Validation" id="workshop-validation"><p>{!errors.filter(selectedIssue).length ? creativeCopy.creativeEncounterWorkshop13 : creativeCopy.creativeEncounterWorkshop14}. {unsaved && creativeCopy.creativeEncounterWorkshop15}</p>
        <Validation validation={state.validation} domain="encounters" id={row.id} onInspect={onInspect}/>
        {elsewhere.length>0&&<details><summary>{elsewhere.length} validation issue{elsewhere.length===1?"":"s"}{creativeCopy.creativeEncounterWorkshop16}</summary><Validation validation={{errors:errors.filter(entry=>!selectedIssue(entry)),warnings:warnings.filter(entry=>!selectedIssue(entry))}} onInspect={onInspect}/></details>}
      </WorkshopSection></details>
      <div hidden={group !== "test"}><WorkshopSection title="Playtest" id="encounter-test">{playtest}</WorkshopSection></div>
    </>}
  </WorkshopShell>;
}
