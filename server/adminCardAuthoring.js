"use strict";

const { cardEffectDefinitions } = require("../shared/duel-rules/effectRegistry");
const { getPublicGameContent } = require("./gameContent");

// Guidance is keyed to the shipped handler's source card. An author's mutable
// rules wording must never become the explanation of a different handler.
function cardAuthoringDefinitions() {
  const cards = new Map(getPublicGameContent().cards.map(card => [card.id, card]));
  return cardEffectDefinitions().map(({ handler: _handler, ...effect }) => {
    const card = cards.get(effect.legacyCardId);
    return { ...effect, label: card?.name || effect.id,
      description: card?.text || "This deployed effect has no recorded guidance.",
      descriptionSource: "deployed-source", parameters: Object.fromEntries(Object.entries(effect.parameters).map(([key, rule]) => [key,
        { ...rule, label: key === "armBonus" ? "Armed attack bonus" : key }])) };
  });
}

module.exports = { cardAuthoringDefinitions };
