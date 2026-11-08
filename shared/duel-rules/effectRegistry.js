"use strict";

// This is a deployed, finite catalogue of engine handlers. Authors configure
// these definitions; they never supply handler names or executable code.
const baseDefinitions = require("./effectDefinitions.json");
const { CATALOG_FACTION_IDENTITIES, alienCatalogProfile } = require("./catalogFactionIdentity");
const completeCatalogFactions = Object.keys(CATALOG_FACTION_IDENTITIES);
const completeCatalogSuits = ["spades", "hearts", "diamonds", "clubs"];
const completeCatalogRanks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "jack", "queen", "king", "ace"];
const completeCatalogValues = Object.freeze({ jack: 11, queen: 12, king: 13, ace: 14 });
const definitions = [
  ...baseDefinitions,
  ...completeCatalogFactions.flatMap((factionId) => completeCatalogSuits.flatMap((suit) => {
    const trigger = CATALOG_FACTION_IDENTITIES[factionId][suit][0];
    return completeCatalogRanks.map((rank) => {
      const value = completeCatalogValues[rank] || Number(rank);
      const alien = alienCatalogProfile(factionId, suit, value);
      return {
        id: `catalog-${factionId}-${suit}-${rank}`,
        version: alien ? 2 : 1,
        legacyCardId: `${factionId}-${suit}-${rank}`,
        factionId,
        cardType: alien?.type || "servitor",
        handler: alien ? "catalog-alien-resource" : "catalog-faction-identity",
        parameters: alien ? {
          trigger: { min: alien.trigger, max: alien.trigger, default: alien.trigger },
          gain: { min: alien.gain, max: alien.gain, default: alien.gain },
          spend: { min: alien.spend, max: alien.spend, default: alien.spend },
          bonus: { min: alien.bonus, max: alien.bonus, default: alien.bonus },
          prevent: { min: alien.prevent, max: alien.prevent, default: alien.prevent },
          draw: { min: alien.draw, max: alien.draw, default: alien.draw },
          heal: { min: alien.heal, max: alien.heal, default: alien.heal },
          onPlayGain: { min: alien.onPlayGain, max: alien.onPlayGain, default: alien.onPlayGain }
        } : {
          trigger: { min: trigger, max: trigger, default: trigger },
          bonus: { min: 1, max: 1, default: 1 }
        }
      };
    });
  }))
];
const composition = require("./compositionContract");
const CARD_EFFECT_CONTRACT_VERSION = "gauntlet.card-effects.v1";
const FACTION_EFFECT_CONTRACT_VERSION = "gauntlet.faction-effects.v1";
const entries = Object.fromEntries(definitions.map((row) => [row.id, row]));
const legacy = Object.fromEntries(definitions.map((row) => [row.legacyCardId, row.id]));
const copy = (value) => JSON.parse(JSON.stringify(value));
function validateParameters(value, spec) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.keys(value).length === Object.keys(spec).length && Object.entries(spec).every(([key, rule]) =>
    Number.isSafeInteger(value[key]) && value[key] >= rule.min && value[key] <= rule.max);
}
function defaultCardEffect(cardId) {
  const definition = entries[legacy[cardId]];
  return definition ? { id: definition.id, version: definition.version, parameters: Object.fromEntries(Object.entries(definition.parameters).map(([key, rule]) => [key, rule.default])) } : null;
}
function validateCardEffect(effect, card) {
  if (effect?.id === require("./mechanicProgram").ID) return require("./mechanicProgram").validate(effect, card);
  if (effect?.id === require("./mechanicContract").ID) return require("./mechanicContract").validateEffect(effect, card);
  if (effect?.id === composition.ID) return composition.validate(effect, card);
  const entry = effect && entries[effect.id];
  return !!entry && Object.keys(effect).sort().join() === "id,parameters,version" && effect.version === entry.version
    && (!card || (entry.factionId === card.factionId && entry.cardType === card.type))
    && validateParameters(effect.parameters, entry.parameters);
}
function cardEffect(card) {
  // The fallback is an ingress adapter for pre-contract saves/replays only.
  // Explicit but invalid definitions must never fall back to identity dispatch.
  const effect = card && Object.hasOwn(card, "effect") ? card.effect : defaultCardEffect(card?.definitionId || card?.catalogId || card?.gameplayCardId || card?.id);
  return validateCardEffect(effect) ? effect : null;
}
function hasCardEffect(card, handler) {
  const effect = cardEffect(card);
  return effect?.id === handler || entries[effect?.id]?.handler === handler;
}
function cardParameter(card, key) { return cardEffect(card)?.parameters[key] ?? 0; }
const factionDefinitions = Object.freeze({
  ...Object.fromEntries(["mekan", "jali", "gracus", "indela", "ingles", "mercaw", "mtano", "russo", "zynarth", "astral-vanguard", "voltari", "xendra"].map(id => [id, { id: `engine-${id}`, version: 1, factionId: id, parameters: {} }])),
  rumin: { id: "imperial-rhythm", version: 1, factionId: "rumin", parameters: { fourthAttackBonus: { min: 0, max: 8, default: 3 } } },
  sheen: { id: "living-defense", version: 1, factionId: "sheen", parameters: { largeAttackBonus: { min: 0, max: 8, default: 2 } } },
  frumo: { id: "sunken-maneuvers", version: 1, factionId: "frumo", parameters: {} },
  bizi: { id: "acceleration-network", version: 1, factionId: "bizi", parameters: {} }
});
function defaultFactionMechanics(id) {
  const definition = factionDefinitions[id];
  return definition ? { id: definition.id, version: 1, parameters: Object.fromEntries(Object.entries(definition.parameters).map(([key, rule]) => [key, rule.default])) } : null;
}
function validateFactionMechanics(mechanics, factionId) {
  const definition = factionDefinitions[factionId];
  if (!definition) return mechanics === null;
  return !!mechanics && Object.keys(mechanics).sort().join() === "id,parameters,version" && mechanics.id === definition.id
    && mechanics.version === definition.version && validateParameters(mechanics.parameters, definition.parameters);
}
const { mechanicFamily } = require("./factionFamilyContract");
function factionMechanicId(player) {
  const faction = player?.faction;
  if (!faction || !Object.hasOwn(faction, "mechanics")) return faction?.id || "basic";
  return validateFactionMechanics(faction.mechanics, mechanicFamily(faction)) && faction.mechanics ? mechanicFamily(faction) : "basic";
}
function factionParameter(player, key) {
  const faction = player?.faction;
  const mechanics = faction && Object.hasOwn(faction, "mechanics") ? faction.mechanics : defaultFactionMechanics(faction?.id);
  return validateFactionMechanics(mechanics, mechanicFamily(faction)) ? mechanics?.parameters[key] ?? 0 : 0;
}
module.exports = { CARD_EFFECT_CONTRACT_VERSION, FACTION_EFFECT_CONTRACT_VERSION, cardEffect, hasCardEffect, cardParameter,
  defaultCardEffect, validateCardEffect, factionMechanicId, factionParameter, defaultFactionMechanics, validateFactionMechanics,
  cardEffectDefinitions: () => copy(definitions), factionEffectDefinitions: () => copy(factionDefinitions) };
