import {useHelp as useCreativeCopy} from "./AuthoringHelp";
import Validation from "./WorkshopValidation";
import {Json,resolveCard} from './Presentation';
import Help from "./AuthoringHelp";
import SupportContractSummary from "./SupportContractSummary";
import { useState } from "react";
import { PrivateCard as SpecialCardFace } from "./PrivateAsset";
import WorkshopShell, { WorkshopFacts, WorkshopSection } from "./WorkshopShell";
import RelatedContent from "./RelatedContent";
import PrintingWorkshop from "./PrintingWorkshop";

const sections = [["identity", "Details"], ["artwork", "Artwork"], ["mechanics", "Mechanics"], ["test", "Test"], ["related", "Related content"]];
export default function CardWorkshop({ row, state, field, preview, playtest, onInspect, onReview, search, list, unsaved, suit, onSuit, variantId, onVariantChange, section, onSection, onCreatePrinting, busy, buffers = {} }) {
  const creativeCopy=useCreativeCopy();

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
  const resolved=resolveCard(manifest,row?.id,variant?.id,suit||localSuit), resolvedVariant=resolved?.collector;
  const local = Object.fromEntries(["name","text","flavor","value","rarity","type","factionId","suit","frameStyle"].filter(key=>buffers[`cards:${row?.id}:${key}`]!==undefined).map(key=>[key,buffers[`cards:${row.id}:${key}`]]));
  const localArt=buffers[`assets:${variant?.id}:art`];
  const image=localArt===undefined ? undefined : state.assetLibrary?.find(asset=>[asset.id,asset.source,asset.path].includes(localArt))?.path || "";
  const card = resolved && { ...resolved, ...local, ...(local.text !== undefined ? {displayText:local.text} : {}), ...(local.value !== undefined ? {rank:local.value} : {}), suit: local.suit || suit || localSuit, collector: resolvedVariant, presentation: {...(resolvedVariant?.presentation || resolved.presentation), ...(Object.keys(local).length || localArt!==undefined ? {composed:true} : {}), ...(localArt!==undefined ? {illustration:image,authoredIllustration:true} : {})} };
  const issues = [...(state.validation?.errors || []), ...(state.validation?.warnings || [])].filter((item) => item.domain === "cards" && item.id === row?.id);
  const source = unsaved ? creativeCopy.creativeDeckWorkshop2 : state.draft ? "Saved draft" : "Live content";
  const previewSource = unsaved ? creativeCopy.creativeCardWorkshop1 : state.previewContent?.releaseId?.startsWith("draft:") || state.draft ? "Saved draft" : "Live content";
  const printingUnsaved = state.localDirtyRecords ? !!state.localDirtyRecords[`assets:${variant?.id}`] : !!unsaved;
  const previewControls = <div className="design-controls"><label>Preview suit<select value={suit || localSuit} onChange={(event) => (onSuit || setLocalSuit)(event.target.value)}>{["spades", "hearts", "diamonds", "clubs"].map((name) => <option value={name} key={name}>{name[0].toUpperCase() + name.slice(1)}</option>)}</select></label>{variants.length > 0 && <label>Collector version<select aria-label="Collector version" value={variant?.id || ""} disabled={busy || printingUnsaved} onChange={(event) => (onVariantChange || setLocalVariant)(event.target.value)}>{variants.map((item) => <option value={item.id} key={item.id}>{item.name || item.label || item.variantName || item.edition || item.id}</option>)}</select></label>}</div>;
  return <WorkshopShell busy={busy} name="Card Workshop" title={row?.name || "Choose a card"} search={search} list={list} selectionId={row?.id} sections={row && sections} section={active} onSection={onSection || setLocalSection} status={<span>{source}</span>} actions={onReview && <button disabled={busy} onClick={onReview}>Review release</button>}
    preview={row && active !== "test" && <><WorkshopSection title="Card preview" id="card-preview"><p className="admin-preview-source">{previewSource} · revision {state.revision} · player card face</p>{unsaved && <p className="admin-note">{creativeCopy.creativeCardWorkshop2}</p>}{card ? <><div className="admin-card-preview"><SpecialCardFace card={card} art={resolvedVariant?.art} /></div>{previewControls}<SupportContractSummary card={card} />{card.flavor && <p><em>{card.flavor}</em></p>}</> : <>{previewControls}{preview || <Help className="admin-note" topic="CardWorkshopNote1" />}</>}</WorkshopSection></>}
  >{row ? <>
    <div hidden={active !== "identity"}><WorkshopSection title="Identity" id="card-identity">{field("name")}<WorkshopFacts values={{ Faction: faction?.name || row.factionId, Type: row.type, Rarity: row.rarity, "Printed value": row.value }} />{["factionId", "type", "rarity", "value", "suit", "frameStyle", "availability", "status"].map(key => <div key={key}>{field(key)}</div>)}</WorkshopSection>
    <WorkshopSection title="Displayed wording" id="card-wording"><Help topic="cardWording" />{field("text")}{row.origin === "admin-v1" && field("flavor")}</WorkshopSection>
    {issues.length>0 && <WorkshopSection title="Validation" id="card-validation"><Validation validation={state.validation} domain="cards" id={row.id} onInspect={onInspect}/>{unsaved && <Help className="admin-note" topic="CardWorkshopNote2" />}</WorkshopSection>}</div>
    <div hidden={active !== "mechanics"}><WorkshopSection title="Mechanics" id="card-mechanics"><div className="design-effect-summary" hidden={["composed-rumin-armament", "authored-mechanic", "mechanic-program"].includes(row.effect?.id)}><h5>{effect?.label || row.effect?.id || "Effect unavailable"}</h5>{effect?.description ? <p>{effect.description}</p> : <Help topic="cardEffectUnavailable" />}{effect && <p className="admin-note">Version {effect.version} · {effect.factionId} · {effect.cardType}</p>}{effect && !Object.keys(effect.parameters || {}).length && <Help className="admin-note" topic="cardNoParameters" />}</div>{field("effect")}<SupportContractSummary card={row} /><Help className="admin-note" topic="CardWorkshop3" />{row.id && <button type="button" onClick={() => onInspect?.("card-effects", "card:" + row.id)}>Edit this card’s effect</button>}</WorkshopSection></div>
    <div hidden={active !== "artwork"}>{variant ? <WorkshopSection title="Artwork" id="card-artwork"><Help topic="cardArtwork" /><PrintingWorkshop onInspect={onInspect} card={row} variants={variants} selected={variant} state={state} field={field} onSelect={onVariantChange || setLocalVariant} onCreate={onCreatePrinting} busy={busy} unsaved={printingUnsaved} suit={suit || localSuit} /></WorkshopSection> : <Help topic="workspaceCardWorkshop3" />}</div>
    <div hidden={active !== "test"}>{playtest}</div>
    <div hidden={active !== "related"}><WorkshopSection title="Related content" id="card-related"><RelatedContent data={state.relationshipData} domain="cards" id={row.id} onInspect={onInspect} /></WorkshopSection></div>
    <Json title={<>{creativeCopy.creativeCardWorkshop4}</>} value={{ id: row.id, defaultVariantId: row.defaultVariantId, selectedVariantId: variant?.id, effect: row.effect, revision: state.revision, source: state.draft?.hash || state.activeReleaseId }} className="admin-json" />
  </> : <Help className="admin-note" topic="CardWorkshopNote3" />}</WorkshopShell>;
}
