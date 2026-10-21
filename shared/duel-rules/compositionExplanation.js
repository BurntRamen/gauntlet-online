"use strict";
const contract = require("./compositionContract");
const conditionLabels = { always: "Always", overpay: "Attack overpayment at least", diamondsPaid: "Diamonds paid this turn (including this attack)", attackValue: "Printed attack value at least", attackNumber: "Attack number this turn equals" };
const operationLabels = { attackBonus: "Add attack value", gainLife: "Gain life" };
function explain(effect, card) {
  if (!contract.validate(effect, card)) return "Invalid composition. Correct the marked fields before saving or testing.";
  return effect.abilities.map((ability, index) => `Ability ${index + 1}: When this Rumin armament is selected to arm a hand attack, ${ability.condition.kind === "always" ? "always" : `if ${conditionLabels[ability.condition.kind].toLowerCase()}${ability.condition.amount == null ? "" : " " + ability.condition.amount}`}, ${ability.effects.map(effect => effect.kind === "attackBonus" ? `add ${effect.amount} to that attack for this combat` : `gain ${effect.amount} life immediately`).join(", then ")}. Once per arming; pay the normal attack cost and consume this armament. Conditions use the accepted attack payment; a false condition still consumes the armed source.`).join("\n");
}
module.exports = { explain, conditionLabels, operationLabels };
