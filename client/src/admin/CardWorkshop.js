import { useState } from "react";
import SpecialCardFace from "../SpecialCardFace";
import WorkshopShell, { WorkshopFacts, WorkshopSection } from "./WorkshopShell";
import RelatedContent from "./RelatedContent";

export default function CardWorkshop({ row, state, field, preview, playtest, onInspect, onReview, search, list, unsaved, suit, onSuit, variantId, onVariantChange }) {
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
  return <WorkshopShell name="Card Workshop" title={row?.name || "Choose a card"} description="Shape the card’s wording, presentation and supported mechanics, then test its behavior." search={search} list={list} status={<span>{source}</span>} actions={onReview && <button onClick={onReview}>Review release</button>}
    preview={row && <><WorkshopSection title="Card preview" id="card-preview"><div className="design-controls"><label>Preview suit<select value={suit || localSuit} onChange={(event) => (onSuit || setLocalSuit)(event.target.value)}>{["spades", "hearts", "diamonds", "clubs"].map((name) => <option value={name} key={name}>{name[0].toUpperCase() + name.slice(1)}</option>)}</select></label>{variants.length > 0 && <label>Collector version<select value={variant?.id || ""} disabled={!!unsaved} onChange={(event) => (onVariantChange || setLocalVariant)(event.target.value)}>{variants.map((item) => <option value={item.id} key={item.id}>{item.name || item.label || item.variantName || item.edition || item.id}</option>)}</select></label>}</div>{card ? <><div className="admin-card-preview"><SpecialCardFace card={card} art={resolvedVariant?.art} /></div><p className="admin-note">Resolved {state.previewContent?.releaseId?.startsWith("draft:") ? "saved draft" : "content"} presentation. Unsaved form values are not shown.</p></> : preview || <p className="admin-note">Preview the saved draft to see its resolved card face.</p>}</WorkshopSection>{playtest}</>}
  >{row ? <>
    <WorkshopSection title="Identity" id="card-identity">{field("name")}<WorkshopFacts values={{ Faction: faction?.name || row.factionId, Type: row.type, Rarity: row.rarity, "Printed value": row.value }} /><p className="admin-note">Gameplay identity and printed values are read-only.</p></WorkshopSection>
    <WorkshopSection title="Displayed wording" id="card-wording" description="This is the text players read. Changing it does not change the executable effect.">{field("text")}</WorkshopSection>
    <WorkshopSection title="Mechanics" id="card-mechanics"><div className="design-effect-summary"><h5>{effect?.label || row.effect?.id || "Effect unavailable"}</h5><p>{effect?.description || "Mechanic guidance is unavailable for this deployed effect. Inspect its contract below."}</p>{effect && <p className="admin-note">Version {effect.version} · {effect.factionId} · {effect.cardType}</p>}{effect && !Object.keys(effect.parameters || {}).length && <p className="admin-note">This effect has no configurable parameters.</p>}</div>{field("effect")}<p className="admin-note">After changing the effect, review the displayed wording and run an engine test.</p>{row.effect?.id && <button type="button" onClick={() => onInspect?.("card-effects", row.effect.id)}>Inspect effect and its uses</button>}</WorkshopSection>
    {variant && <WorkshopSection title="Artwork" id="card-artwork" description="Artwork belongs to the selected collector version. Card ownership and collector identity stay unchanged.">{field("art", { domain: "assets", row: variant })}</WorkshopSection>}
    <WorkshopSection title="Validation" id="card-validation">{issues.length ? <ul className="admin-alert">{issues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul> : <p className="admin-good">No saved validation issues for this card.</p>}{unsaved && <p className="admin-note">Save local values before validating or testing them.</p>}</WorkshopSection>
    <WorkshopSection title="Related content" id="card-related"><RelatedContent data={state.relationshipData} domain="cards" id={row.id} onInspect={onInspect} /></WorkshopSection>
    <details className="admin-json"><summary>Technical · card and contract identity</summary><pre>{JSON.stringify({ id: row.id, defaultVariantId: row.defaultVariantId, selectedVariantId: variant?.id, effect: row.effect, revision: state.revision, source: state.draft?.hash || state.activeReleaseId }, null, 2)}</pre></details>
  </> : <p className="admin-note">Select a card to edit it and open its test workspace.</p>}</WorkshopShell>;
}
