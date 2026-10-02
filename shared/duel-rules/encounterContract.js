"use strict";
const ENCOUNTER_CONTRACT_VERSION = "gauntlet.encounter-setup.v1";
const bossHandlers = Object.freeze({
  "first-strike": (n) => n === 1 ? 1 : 0,
  "odd-pressure": (n) => n % 2 === 1 ? 1 : 0,
  "even-feint": (n, count, ability) => n % 2 === 0 ? (ability.evenBonus || 1) : 0,
  "final-push": (n, count, ability) => n === count ? (ability.tier >= 3 ? 2 : 1) : 0,
  "late-pressure": (n, count) => n >= Math.max(1, count - 1) ? 1 : 0,
  "first-and-final": (n, count) => n === 1 || n === count ? 1 : 0
});
const bounded = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const keys = (value, names) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join() === names.slice().sort().join();
function validateEncounterSetup(setup, cards, factionId) {
  if (!keys(setup, ["version", "bossLife", "attacksPerTurn", "minAttackValue", "maxAttackValue", "chapterNumber", "bossAbility", "playerAdditions", "bossAdditions", "attackTiming", "winRoute", "lossRoute"])) return false;
  if (setup.version !== 1 || !bounded(setup.bossLife, 1, 100) || !bounded(setup.attacksPerTurn, 1, 6)
    || !bounded(setup.minAttackValue, 1, 14) || !bounded(setup.maxAttackValue, setup.minAttackValue, 14)
    || !bounded(setup.chapterNumber, 1, 64) || setup.attackTiming !== "clear-priority"
    || setup.winRoute !== "first-uncompleted" || setup.lossRoute !== "retry") return false;
  const ability = setup.bossAbility;
  if (!ability || !Object.hasOwn(bossHandlers, ability.id) || !bounded(ability.tier, 1, 3)
    || Object.keys(ability).some((key) => !["id", "title", "text", "tier", "name", "evenBonus", "healAtTurnStart"].includes(key))
    || ["title", "text", "name"].some((key) => typeof ability[key] !== "string" || !ability[key].trim() || ability[key].length > 2000)
    || (Object.hasOwn(ability, "evenBonus") && !bounded(ability.evenBonus, 1, 4))
    || (Object.hasOwn(ability, "healAtTurnStart") && !bounded(ability.healAtTurnStart, 0, 4))) return false;
  return [setup.playerAdditions, setup.bossAdditions].every((ids) => Array.isArray(ids) && ids.length <= 12 && new Set(ids).size === ids.length
    && ids.every((id) => cards.some((card) => card.id === id && card.factionId === factionId)));
}
function campaignDifficulty(setup) {
  return Object.fromEntries(["bossLife", "attacksPerTurn", "minAttackValue", "maxAttackValue", "chapterNumber"].map((key) => [key, setup[key]]));
}
function bossAttackBonus(campaign, attackNumber) {
  const ability = campaign?.bossAbility;
  return ability && Object.hasOwn(bossHandlers, ability.id) ? bossHandlers[ability.id](attackNumber, campaign.attacksPerTurn, ability) : 0;
}
function bossAttackBase(campaign, turn, attackNumber) {
  const min = Number(campaign.minAttackValue || 5), max = Number(campaign.maxAttackValue || 8);
  return min + ((Number(turn || 1) + attackNumber + Number(campaign.chapterNumber || 1)) % Math.max(1, max - min + 1));
}
module.exports = { ENCOUNTER_CONTRACT_VERSION, validateEncounterSetup, campaignDifficulty, bossAttackBase, bossAttackBonus, bossAbilityIds: Object.keys(bossHandlers) };
