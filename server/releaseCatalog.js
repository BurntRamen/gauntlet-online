"use strict";
const { available } = require("./adminCatalog");

// Definitions remain resolvable independently of discoverability, acquisition,
// gameplay legality and ownership. Never remove retired rows from the manifest.
function cardsFor(manifest, channel, { factionId, rarity, setId } = {}) {
  const set = setId && manifest.draftSets.find(s => s.id === setId);
  if (setId && !set) return [];
  return manifest.cards.filter(card => available(card, channel)
    && (!factionId || card.factionId === factionId) && (!rarity || card.rarity === rarity)
    && (!set ? true : set.authored ? set.memberCardIds.includes(card.id) : card.origin !== "admin-v1"));
}
function assertConstructedCards(cards) {
  if (cards.some(card => card?.origin === "admin-v1" && !available(card, "constructed"))) {
    throw Object.assign(new Error("Your saved deck contains a card that is no longer legal in constructed play. Edit or choose another deck. Your collection and saved deck are retained."), { code: "CONTENT_DECK_UNAVAILABLE", status: 422 });
  }
}
module.exports = { available, cardsFor, assertConstructedCards };
