"use strict";
const VERSION = "gauntlet.encounter-ai.v1";
const profiles = Object.freeze({
  "scripted-pressure": "Scripted pressure first",
  "support-first": "Prepare support, then scripted pressure"
});
const field = { label: "Opponent AI profile", type: "choice", options: Object.entries(profiles).map(([id, name]) => ({ id, name })), defaultValue: "scripted-pressure", maxLength: 80, required: true, mechanical: true,
  note: "Scripted pressure keeps the existing opponent policy. Support first plays legal, affordable support before scripted attacks. Support, attacks and blocks share the existing action budget; with one action, support can replace that turn's attack. Responses, healing and rewards retain their rules. Captured matches retain their profile." };
function profile(value) {
  const id = value ?? "scripted-pressure";
  if (!Object.hasOwn(profiles, id)) throw new Error("Unsupported captured encounter AI profile.");
  return id;
}
function prepareSupport(game, legalActions, chooseSupport) {
  if (!game.campaign || profile(game.campaign.aiProfile) !== "support-first") return null;
  return chooseSupport(game, legalActions);
}
function validateCaptured(campaign) {
  if (!campaign) return;
  profile(campaign.aiProfile);
  if (campaign.aiContractVersion && campaign.aiContractVersion !== VERSION) throw new Error("The captured encounter AI requires a compatible server.");
}
module.exports = { VERSION, profiles, field, profile, prepareSupport, validateCaptured };
