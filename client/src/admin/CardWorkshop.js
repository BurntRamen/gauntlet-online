import Help from "./AuthoringHelp";
import SupportContractSummary from "./SupportContractSummary";
import { useState } from "react";
import { PrivateCard as SpecialCardFace } from "./PrivateAsset";
import WorkshopShell, { WorkshopFacts, WorkshopSection } from "./WorkshopShell";
import RelatedContent from "./RelatedContent";
import PrintingWorkshop from "./PrintingWorkshop";

const sections = [["identity", "Details"], ["artwork", "Artwork"], ["mechanics", "Mechanics"], ["test", "Test"], ["related", "Related content"]];
export default function CardWorkshop({ row, state, field, preview, playtest, onInspect, onReview, search, list, unsaved, suit, onSuit, variantId, onVariantChange, section, onSection, onSelectList, onCreatePrinting, busy }) {
  const [localSection, setLocalSection] = useState("identity");
  const active = ({ wording: "identity", validation: "identity", preview: "artwork" })[section] || (sections.some(([id]) => id === section) ? section : localSection);
  const [localSuit, setLocalSuit] = useState("spades");
  const [localVariant, setLocalVariant] = useState(null);
  const snapshot = state.draft?.snapshot || state.live;
  const variants = (snapshot?.domains.assets || []).filter((item) => item.gameplayCardId === row?.id);
  const selectedId = variantId || localVariant;
  const variant = variants.find((item) => item.id === selectedId) || variants.find((item) => item.id === row?.defaultVariantId) || variants[0];
  const effect = state.workshopMetadata?.cardEffects?.find((item) => item.id === row?.effect?.id);
  const faction = snapshot?.domains.factions?.find((item) => item.id === row?.factionId);
  const manifest = state.previewContent?.manifest || state.previewContent;
  const resolved = manifest?.cards?.find((item) => item.id === row?.id);
  const resolvedVariant = manifest?.collectorVariants?.find((item) => item.variantId === variant?.id);
  const card = resolved && { ...resolved, suit: suit || localSuit, collector: resolvedVariant, presentation: resolvedVariant?.presentation || resolved.presentation };
  const issues = [...(state.validation?.errors || []), ...(state.validation?.warnings || [])].filter((item) => item.domain === "cards" && item.id === row?.id);
  const source = unsaved ? "Unsaved local values" : state.draft ? "Shared draft" : "Live content";
  return <WorkshopShell busy={busy} name="Card Workshop" title={row?.name || "Choose a card"} search={search} list={list} selectionId={row?.id} onSelectList={onSelectList} sections={row && sections} section={active} onSection={onSection || setLocalSection} status={<span>{source}</span>} actions={onReview && <button disabled={busy} onClick={onReview}>Review release</button>}
    preview={row && active !== "test" && <><WorkshopSection title="Card preview" id="card-preview"><div className="design-controls"><label>Preview suit<select value={suit || localSuit} onChange={(event) => (onSuit || setLocalSuit)(event.target.value)}>{["spades", "hearts", "diamonds", "clubs"].map((name) => <option value={name} key={name}>{name[0].toUpperCase() + name.slice(1)}</option>)}</select></label>{variants.length > 0 && <label>Collector version<select aria-label="Collector version" value={variant?.id || ""} disabled={busy || !!unsaved} onChange={(event) => (onVariantChange || setLocalVariant)(event.target.value)}>{variants.map((item) => <option value={item.id} key={item.id}>{item.name || item.label || item.variantName || item.edition || item.id}</option>)}</select></label>}</div>{card ? <><div className="admin-card-preview"><SpecialCardFace card={card} art={resolvedVariant?.art} /></div><SupportContractSummary card={card} />{row.flavor && <p><em>{row.flavor}</em></p>}<Help className="admin-note" topic="savedCardPreview" /></> : preview || <Help className="admin-note" topic="CardWorkshopNote1" />}</WorkshopSection></>}
  >{row ? <>
    <div hidden={active !== "identity"}><WorkshopSection title="Identity" id="card-identity">{field("name")}<WorkshopFacts values={{ Faction: faction?.name || row.factionId, Type: row.type, Rarity: row.rarity, "Printed value": row.value }} />{row.origin === "admin-v1" ? <>{["factionId", "type", "rarity", "value", "suit", "availability", "status"].map(key => <div key={key}>{field(key)}</div>)}<Help className="admin-note" topic="CardWorkshop1" /></> : <Help className="admin-note" topic="CardWorkshop2" />}</WorkshopSection>
    <WorkshopSection title="Displayed wording" id="card-wording"><Help topic="cardWording" />{field("text")}{row.origin === "admin-v1" && field("flavor")}</WorkshopSection>
    <WorkshopSection title="Validation" id="card-validation">{issues.length ? <ul className="admin-alert">{issues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul> : <p className="admin-good">No saved validation issues for this card.</p>}{unsaved && <Help className="admin-note" topic="CardWorkshopNote2" />}</WorkshopSection></div>
    <div hidden={active !== "mechanics"}><WorkshopSection title="Mechanics" id="card-mechanics"><div className="design-effect-summary" hidden={["composed-rumin-armament", "authored-mechanic"].includes(row.effect?.id)}><h5>{effect?.label || row.effect?.id || "Effect unavailable"}</h5>{effect?.description ? <p>{effect.description}</p> : <Help topic="cardEffectUnavailable" />}{effect && <p className="admin-note">Version {effect.version} · {effect.factionId} · {effect.cardType}</p>}{effect && !Object.keys(effect.parameters || {}).length && <Help className="admin-note" topic="cardNoParameters" />}</div>{field("effect")}<SupportContractSummary card={row} /><Help className="admin-note" topic="CardWorkshop3" />{row.effect?.id && !["composed-rumin-armament", "authored-mechanic"].includes(row.effect.id) && <button type="button" onClick={() => onInspect?.("card-effects", row.effect.id)}>Inspect effect and its uses</button>}</WorkshopSection></div>
    <div hidden={active !== "artwork"}>{variant ? <WorkshopSection title="Artwork" id="card-artwork"><Help topic="cardArtwork" /><PrintingWorkshop onInspect={onInspect} card={row} variants={variants} selected={variant} state={state} field={field} onSelect={onVariantChange || setLocalVariant} onCreate={onCreatePrinting} busy={busy} unsaved={unsaved} suit={suit || localSuit} /></WorkshopSection> : <p>No collector artwork is registered for this card.</p>}</div>
    <div hidden={active !== "test"}>{playtest}</div>
    <div hidden={active !== "related"}><WorkshopSection title="Related content" id="card-related"><RelatedContent data={state.relationshipData} domain="cards" id={row.id} onInspect={onInspect} /></WorkshopSection></div>
    <details className="admin-json"><summary>Technical · card and contract identity</summary><pre>{JSON.stringify({ id: row.id, defaultVariantId: row.defaultVariantId, selectedVariantId: variant?.id, effect: row.effect, revision: state.revision, source: state.draft?.hash || state.activeReleaseId }, null, 2)}</pre></details>
  </> : <Help className="admin-note" topic="CardWorkshopNote3" />}</WorkshopShell>;
}
