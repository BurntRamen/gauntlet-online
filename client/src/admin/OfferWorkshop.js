import Help from "./AuthoringHelp";
import { PrivateCard } from "./PrivateAsset";
import "../DeckProducts.css";
import DeckOfferCard from "../DeckOfferCard";
import RelatedContent from "./RelatedContent";

export default function OfferWorkshop({ row, state, fields, list, search, onReview, onInspect, busy }) {
  const manifest = state.previewContent?.manifest || state.previewContent;
  const offer = manifest?.deckOffers?.find(offer => offer.id === row?.id);
  return <section aria-label="Store Workshop"><h3>Deck products</h3><Help topic="OfferWorkshop1" /><button disabled={busy} onClick={onReview}>Review release</button>{search}{list}{row && <><h4>{row.name}</h4>{fields}{offer ? <><h4>Saved store presentation</h4><DeckOfferCard CardFace={PrivateCard} offer={offer} manifest={manifest} preview /><button onClick={() => onInspect("decks", row.templateId)}>Inspect recipe and test it</button></> : <Help topic="OfferWorkshopNote1" />}<RelatedContent data={state.relationshipData} domain="offers" id={row.id} onInspect={onInspect} /></>}</section>;
}
