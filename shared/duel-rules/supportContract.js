"use strict";

// Finite deployed capabilities, never an interpreter for authored rules text.
const { cardEffect, validateCardEffect, cardEffectDefinitions } = require("./effectRegistry");
const VERSION = "gauntlet.support.v1";
const TYPES = new Set(["armament", "weaponry", "spell", "shelter", "ambush", "contraption", "biomorph", "operation", "arcana"]);
const CONSUMED = new Set([
  "gilded-scale-legionary", "coin-scale-spear", "rumie-vault-shield", "imperial-scale-pike",
  "aurelian-clawblade", "triumphal-ram", "kaisers-gold-claw", "neutral-longsword",
  "neutral-smoke-bomb", "neutral-tower-shield", "deckhand-diver", "riptide-smuggler",
  "lafayettes-chart", "poleas-sunken-order", "leviathan-salvage", "tide-debt-ledger",
  "abyssal-switchboard", "the-last-gamble"
]);
const ENTRY = { "deckhand-diver": "optional-private-peek", "abyssal-switchboard": "next-attack-or-block", "focus-prime-signal": "acceleration-and-next-card" };
const PAYMENT_ONLY = new Set(["neutral-think", "voltage-ration", "heras-calibration"]);
const DEFINITIONS = Object.fromEntries(cardEffectDefinitions().filter(row => TYPES.has(row.cardType)).map(row => [row.id, Object.freeze({
  version: VERSION, effectId: row.id, timing: "open-priority", cost: "printed-value",
  responseTiming: null, onPlay: ENTRY[row.id] || null,
  ongoing: ENTRY[row.id] || PAYMENT_ONLY.has(row.id) ? null : row.id,
  paymentEffect: PAYMENT_ONLY.has(row.id) ? row.id : null,
  duration: row.id === "abyssal-switchboard" ? "resolution" : "until-text-removes",
  charges: CONSUMED.has(row.id) ? 1 : null,
  discardCondition: row.id === "abyssal-switchboard" ? "after-resolution"
    : row.id === "deckhand-diver" ? "after-chosen-peek" : CONSUMED.has(row.id) ? "printed-consumption" : "explicit-removal-only",
  concealed: row.cardType === "ambush"
})]));
function definition(card) {
  const effect = cardEffect(card);
  return validateCardEffect(effect, card) ? DEFINITIONS[effect.id] || null : null;
}
function enabled(game) { return game?.rulesVersion === "gauntlet-duel-v12"; }
module.exports = { VERSION, TYPES, DEFINITIONS, definition, enabled };
