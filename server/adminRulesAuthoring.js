"use strict";

const effects = require("../shared/duel-rules/effectRegistry");
const config = require("../shared/duel-rules/gameConfig");
const encounters = require("./encounterAuthoring");
const { factionsData } = require("./gameContent");

function rulesAuthoringData(snapshot) {
  const factionEffects = Object.values(effects.factionEffectDefinitions()).map(effect => {
    const faction = factionsData[effect.factionId];
    return { ...effect, label: faction?.name || effect.factionId,
      description: ["commander", "general", "city"].map(role => faction?.[role]?.text ? `${faction[role].name}: ${faction[role].text}` : null).filter(Boolean).join("\n"),
      descriptionSource: "deployed-source", parameters: Object.fromEntries(Object.entries(effect.parameters).map(([key, rule]) => [key, { ...rule,
        label: ({ fourthAttackBonus: "Fourth attack bonus", largeAttackBonus: "Large attack bonus" })[key] || key }])) };
  });
  const bossAbilities = Object.entries(encounters.abilityLabels).map(([id, label]) => ({ id, label }));
  const gameConfig = { handSize: snapshot.domains.game.find(row => row.id === "shared-rules")?.handSize ?? config.HAND_SIZE,
    handSizeBounds: [3, 12], startingLife: config.STARTING_LIFE, deckSize: config.DECK_SIZE, laneCount: 3,
    suits: [...config.SUITS], values: [...config.VALUES], editableFields: ["handSize"], derivedFields: ["deckSize"],
    sourceControlled: ["startingLife", "laneCount", "suits", "values", "payment", "damage", "targeting", "priority", "multiplayer", "matchmaking", "timers", "progression", "rewards"] };
  return { factionEffects, bossAbilities, encounterRules: encounters.rules,
    encounterMechanics: { abilities: bossAbilities, rules: encounters.rules }, gameConfig };
}

module.exports = { rulesAuthoringData };
