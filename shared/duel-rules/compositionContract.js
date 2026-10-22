"use strict";

// Version 1 is an immutable interpreter contract, not a migration of legacy
// handlers. Keep this validator and its executor when introducing a new version.
const ID = "composed-rumin-armament";
const VERSION = "gauntlet.composition.armament.v1";
const limits = { abilities: 4, effects: 4, amount: 8 };
const conditions = { always: null, overpay: [0, 14], diamondsPaid: null, attackValue: [2, 14], attackNumber: [1, 20] };
const operations = { attackBonus: { target: "attacker", duration: "combat" }, gainLife: { target: "self", duration: "instant" } };
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const supports = card => card?.factionId === "rumin" && card?.type === "armament";
function errors(effect, card) {
  const issues = [], add = (path, message) => issues.push({ path, message });
  if (!exact(effect, ["id", "version", "abilities"]) || effect.id !== ID || effect.version !== 1) return [{ path: "effect", message: "Unsupported composition or interpreter version." }];
  if (card && !supports(card)) add("effect", "Composition v1 supports Rumin armaments only.");
  if (!Array.isArray(effect.abilities) || !integer(effect.abilities.length, 1, limits.abilities)) return [...issues, { path: "abilities", message: "Use 1–4 abilities." }];
  effect.abilities.forEach((ability, index) => {
    const path = `abilities.${index}`;
    if (!exact(ability, ["timing", "condition", "cost", "limit", "effects"]) || ability.timing !== "arm" || ability.cost !== "attack-payment-and-source" || ability.limit !== "once-per-arming") { add(path, "Use the existing arming window, attack payment and one consumed source per arming."); return; }
    const condition = ability.condition, range = conditions[condition?.kind];
    if (!condition || !Object.hasOwn(conditions, condition.kind) || !exact(condition, range ? ["kind", "amount"] : ["kind"]) || (range && !integer(condition.amount, ...range))) add(`${path}.condition`, "Choose a supported condition and whole-number bound.");
    if (!Array.isArray(ability.effects) || !integer(ability.effects.length, 1, limits.effects)) { add(`${path}.effects`, "Use 1–4 ordered effects per ability."); return; }
    ability.effects.forEach((operation, i) => {
      const spec = operations[operation?.kind];
      if (!exact(operation, ["kind", "amount", "target", "duration"]) || !spec || operation.target !== spec.target || operation.duration !== spec.duration || !integer(operation.amount, 1, limits.amount)) add(`${path}.effects.${i}`, "Use attack bonus (attacker, this combat) or life gain (self, instant), from 1–8.");
    });
  });
  return issues;
}
const validate = (effect, card) => errors(effect, card).length === 0;
const ability = () => ({ timing: "arm", condition: { kind: "always" }, cost: "attack-payment-and-source", limit: "once-per-arming", effects: [{ kind: "attackBonus", amount: 2, ...operations.attackBonus }] });
const create = () => ({ id: ID, version: 1, abilities: [ability()] });
module.exports = { ID, VERSION, limits, conditions, operations, supports, errors, validate, ability, create };
