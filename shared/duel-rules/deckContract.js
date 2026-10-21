"use strict";
const { SUIT_NAMES: SUITS, VALUES } = require("./gameConfig");
const { resolvePrinting, canUsePrinting } = require("./printings");
const fail = message => { throw Object.assign(new Error(message), { status: 422 }); };
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

// The composition is a set of replacements in the existing 52-slot inventory.
// Array order is editorial only; the production factory owns shuffling.
function resolveComposition(composition, manifest, { channel = "constructed", ownership, allCards = false } = {}) {
  if (!exact(composition, ["factionId", "generalId", "cards"])) fail("Choose a faction, General and card selections; unsupported loadout fields are not accepted.");
  const faction = manifest.factions.find(row => row.id === composition.factionId);
  if (!faction) fail("Choose an existing faction.");
  const generals = faction.generals || [faction.general];
  if (!generals.some(general => (general?.id || null) === composition.generalId)) fail("Choose a General belonging to this faction.");
  if (!Array.isArray(composition.cards) || composition.cards.length > 52) fail("A deck retains 52 playing-card slots.");
  const ids = new Set(), slots = new Set();
  const cards = composition.cards.map(selection => {
    if (!exact(selection, ["cardId", "printingId"])) fail("Each selection requires a gameplay card and its printing, without quantity or slot overrides.");
    const card = manifest.cards.find(row => row.id === selection.cardId);
    if (!card || ![composition.factionId, "neutral"].includes(card.factionId)) fail("Decks can include one faction plus neutral Reath cards.");
    if (ids.has(card.id)) fail(`${card.name} can appear only once.`);
    ids.add(card.id);
    if (!VALUES.includes(card.value) || !SUITS.includes(card.suit)) fail(`${card.name} has an unsupported playing-card slot.`);
    const slot = `${card.value}:${card.suit}`;
    if (slots.has(slot)) fail(`Only one card can replace the ${card.value} of ${card.suit}.`);
    slots.add(slot);
    if (card.origin === "admin-v1" && !card.availability?.[channel]) fail(`${card.name} is unavailable for ${channel}.`);
    const printing = resolvePrinting(card.id, manifest.collectorVariants, selection.printingId, card.defaultVariantId);
    if (!printing) fail(`Choose a printing belonging to ${card.name} in this release.`);
    if (ownership && !allCards && !(Number(ownership.gameplayEntitlements?.[card.id]) > 0)) fail(`You do not have gameplay access to ${card.name} in this mode.`);
    if (ownership && !canUsePrinting(printing, ownership.collectorVariants)) fail(`You do not own the ${printing.name} printing.`);
    return { ...card, variantId: printing.variantId, collector: printing, presentation: printing.presentation };
  });
  return { faction, general: generals.find(row => (row?.id || null) === composition.generalId), cards, cardCount: 52, replacementCount: cards.length };
}
function compositionPayload(template) {
  return { name: template.name, factionId: template.composition.factionId, generalId: template.composition.generalId,
    gameplayCardQuantities: Object.fromEntries(template.composition.cards.map(row => [row.cardId, 1])),
    collectorVariantSelections: Object.fromEntries(template.composition.cards.map(row => [row.cardId, row.printingId])) };
}
module.exports = { resolveComposition, compositionPayload, exact };
