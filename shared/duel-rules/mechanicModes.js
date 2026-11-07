"use strict";
const contract = require("./mechanicContract");
const ffaOperations = ["attackBonus", "blockBonus", "gainLife", "damage", "draw", "mill", "counters"];
function freeForAllReason(definition) {
  if (contract.errors(definition).length) return "The mechanic definition must validate before mode eligibility can be determined.";
  if (definition.interpreter !== 2) return "Interpreter 1 captures two-seat semantics. Create an independent interpreter 2 copy for multiplayer qualification.";
  if (definition.cardTypes.some(type => type !== "servitor")) return "Free-for-All currently qualifies Servitor combat effects; support placement and activation use a different multiplayer command flow.";
  for (const a of definition.abilities) {
    if (!["attack", "block", "combatEnd"].includes(a.trigger)) return `Free-for-All does not execute the ${contract.triggers[a.trigger]} hook for authored mechanics.`;
    if (a.decision !== "automatic" || a.target !== "none") return "Free-for-All does not yet support queued authored decisions or independently selected targets. Choose a duel/campaign or an automatic combat effect.";
    const unsupported = a.effects.find(op => !ffaOperations.includes(op.kind));
    if (unsupported) return `${contract.operations[unsupported.kind].label} is not qualified in Free-for-All.`;
  }
  return null;
}
function compatibility(definition) {
  const reason = freeForAllReason(definition);
  return { duel: { eligible: !contract.errors(definition).length }, freeForAll: { eligible: !reason, reason,
    semantics: "You means this card's controller. Opposing player means the declared defender for an attacker, or that attack's controller for a blocker. Other seats are unaffected." } };
}
module.exports = { ffaOperations, freeForAllReason, compatibility };
