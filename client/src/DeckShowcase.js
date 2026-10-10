import DeckBox from "./DeckBox";
import SpecialCardFace from "./SpecialCardFace";
import { FACTION_VISUALS, resolveVisualAsset } from "./GauntletVisuals";
import { getPlayingCardArtPath } from "./cardArt";
import { findCollectorVariant, getCurrentDeckVersion } from "./contentArt";
import { buildDeckSlots, slotLabel } from "./deckSlots";
import "./DeckShowcase.css";

export function getDeckFrontSlot(deck, cards = []) {
  const version = getCurrentDeckVersion(deck) || {};
  const slots = buildDeckSlots(cards, version.gameplayCardQuantities || version.cardQuantities || {}, version.cardSuitChoices || {});
  return slots.find((slot) => slot.key === version.frontCardSlot)
    || slots.find((slot) => slot.card)
    || slots.find((slot) => slot.key === "14:spades");
}

export default function DeckShowcase({ deck, cards = [], collectorCatalog = [], compact = false }) {
  const version = getCurrentDeckVersion(deck) || {};
  const slot = getDeckFrontSlot(deck, cards);
  // Public profiles carry only the chosen front card, without the private list.
  const card = deck?.frontCard || (slot.card ? { ...slot.card, suit: slot.suit } : null);
  const variant = card && findCollectorVariant(card.gameplayCardId || card.id, collectorCatalog, version.collectorVariantSelections?.[card.gameplayCardId || card.id]);
  const frontSlot = card || slot;
  return <span className={"deck-showcase" + (compact ? " is-compact" : "")} aria-label={(deck?.name || "Your deck") + " showcase"}>
    <DeckBox boxId={version.deckBoxId} factionId={deck?.factionId} name={deck?.factionName || FACTION_VISUALS[deck?.factionId]?.name || deck?.factionId || "Gauntlet"} compact={compact} />
    <span className="deck-showcase-front" aria-label={"Front card: " + (card?.name || slotLabel(frontSlot))}>
      {card && (card.id || card.gameplayCardId) ? <SpecialCardFace card={card} art={variant?.art} presentation={variant || card.collector} />
        : <img src={resolveVisualAsset(getPlayingCardArtPath(frontSlot, "basic"))} alt={slotLabel(frontSlot) + " standard playing card"} />}
    </span>
  </span>;
}
