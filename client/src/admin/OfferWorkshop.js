import { useState } from "react";
import Help from "./AuthoringHelp";
import { PrivateCard } from "./PrivateAsset";
import "../DeckProducts.css";
import DeckOfferCard from "../DeckOfferCard";
import RelatedContent from "./RelatedContent";
import WorkshopShell, { WorkshopSection } from "./WorkshopShell";

const sections = [["details", "Product details"], ["related", "Recipe & uses"]];
export default function OfferWorkshop({ row, state, fields, list, search, onReview, onInspect, busy, unsaved, section, onSection, onSelectList }) {
  const [localSection, setSection] = useState("details");
  const active = sections.some(([id]) => id === section) ? section : localSection;
  const manifest = state.previewContent?.manifest || state.previewContent;
  const offer = manifest?.deckOffers?.find(offer => offer.id === row?.id);
  const source = state.draft ? "Saved draft" : "Live content";
  return <WorkshopShell name="Store Workshop" title={row?.name || "Choose a deck product"} selectionId={row?.id} search={search} list={list} busy={busy} onSelectList={onSelectList}
    sections={row && sections} section={active} onSection={onSection || setSection} status={<span>{unsaved ? "Unsaved changes in this browser" : source}</span>}
    actions={<button disabled={busy} onClick={onReview}>Review release</button>}
    preview={row && <WorkshopSection title="Store preview" id="offer-preview"><p className="admin-preview-source">{source} · player presentation</p>{unsaved && <Help topic="workspaceOfferWorkshop1" className="admin-note" />}{offer ? <DeckOfferCard CardFace={PrivateCard} offer={offer} manifest={manifest} preview /> : <Help topic="OfferWorkshopNote1" />}</WorkshopSection>}>
    {row ? <><div hidden={active !== "details"}><WorkshopSection title="Product terms" id="offer-details"><Help topic="OfferWorkshop1" /><Help topic="workspaceOfferWorkshop2" className="admin-note" />{fields}</WorkshopSection></div>
      <div hidden={active !== "related"}><WorkshopSection title="Recipe & uses" id="offer-related"><button disabled={busy || !row.templateId} onClick={() => onInspect("decks", row.templateId)}>Inspect recipe and test it</button><RelatedContent data={state.relationshipData} domain="offers" id={row.id} onInspect={onInspect} /></WorkshopSection></div>
      <details className="admin-json"><summary>Technical · product identity</summary><pre>{JSON.stringify({ id: row.id, templateId: row.templateId }, null, 2)}</pre></details>
    </> : <Help topic="workspaceOfferWorkshop3" className="admin-note" />}
  </WorkshopShell>;
}
