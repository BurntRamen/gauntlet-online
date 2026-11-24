"use strict";

const { TRIGGERS } = require("./catalogFactionIdentity");
const conditions = Object.fromEntries(Object.entries(TRIGGERS).map(([name, number]) => [name.toLowerCase(), number]));
const names = Object.fromEntries(Object.entries(conditions).map(([name, number]) => [number, name]));
// These source cards each have one combat-value clause. Keep their original
// trace and support metadata when compiling their unedited instructions.
const namedBonuses = {
  "neutral-soldier": ["first_attack", 1], "neutral-lieutenant": ["rising_attack", 1],
  "neutral-sergeant": ["first_block", 1], "neutral-bodyguard": ["lane_block", 2],
  "neutral-wrestler": ["block_higher_attacker", 2], "rootwatch-initiate": ["late_block", 1],
  "living-bark-guard": ["block_hand_attack", 1], "seedwall-acolyte": ["first_block", 1],
  "ringroot-bastion": ["lane_block", 2], "dune-circuit-runner": ["different_suit_attack", 1],
  "railspike-marshal": ["different_suit_attack", 1]
};
const namedBonus = definition => definition && Object.hasOwn(namedBonuses, definition.id) ? namedBonuses[definition.id] : null;
const printedOnly = definition => definition?.handler === "printed-value-only";
const combatSpecs = { trigger: {min:1,max:15,default:1}, bonus: {min:0,max:8,default:0} };
const operations = {
  spend: "Spend faction resource", gain: "Gain faction resource", bonus: "Add combat value",
  prevent: "Prevent damage", draw: "Draw at end of turn", heal: "Gain life", onPlayGain: "Gain resource on placement"
};
const exact = (value, keys) => value && !Array.isArray(value) && typeof value === "object" &&
  Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));
function supports(definition) {
  return !!namedBonus(definition) || printedOnly(definition) || ["catalog-faction-identity", "catalog-alien-resource"].includes(definition?.handler);
}
function decompile(effect, definition) {
  if (!effect || !supports(definition)) return null;
  if (Object.hasOwn(effect, "modules")) return effect;
  if (printedOnly(definition) && exact(effect.parameters, [])) return {id:effect.id, version:effect.version, modules:[]};
  const template = namedBonus(definition);
  const p = template && exact(effect.parameters, []) ? {trigger: conditions[template[0]], bonus:template[1]} : effect.parameters;
  if (!p || !names[p.trigger]) return null;
  const modules = [{ when: names[p.trigger], operations: Object.keys(operations)
    .filter(k => k !== "onPlayGain" && Object.hasOwn(p, k))
    .map(kind => ({ kind, amount: p[kind] })) }];
  if (Object.hasOwn(p, "onPlayGain")) modules.push({ when: "placed", operations: [{kind: "onPlayGain", amount: p.onPlayGain}] });
  return { id: effect.id, version: effect.version, modules };
}
// Lower the authored instructions to the inputs consumed by the existing combat
// and placement stages. Their ordering includes paying a cost before gaining resources.
function compile(effect, definition) {
  if (!supports(definition) || !exact(effect, ["id", "version", "modules"]) || effect.id !== definition.id ||
      effect.version !== definition.version || !Array.isArray(effect.modules)) return null;
  if (printedOnly(definition) && !effect.modules.length) return {id:effect.id, version:effect.version, parameters:{}};
  const specs = printedOnly(definition) || namedBonus(definition) ? combatSpecs : definition.parameters;
  const placement = Object.hasOwn(specs, "onPlayGain");
  if (effect.modules.length !== (placement ? 2 : 1)) return null;
  const parameters = {};
  for (const [i, module] of effect.modules.entries()) {
    if (!exact(module, ["when", "operations"]) || !Array.isArray(module.operations)) return null;
    if (i === 0) {
      if (!Object.hasOwn(conditions, module.when)) return null;
      parameters.trigger = conditions[module.when];
      if (parameters.trigger < specs.trigger.min || parameters.trigger > specs.trigger.max) return null;
    } else if (module.when !== "placed") return null;
    const kinds = Object.keys(operations).filter(k => Object.hasOwn(specs, k) && (i === 1) === (k === "onPlayGain"));
    if (kinds.length !== module.operations.length) return null;
    for (const [index, op] of module.operations.entries()) {
      if (!exact(op, ["kind", "amount"]) || op.kind !== kinds[index] || !Number.isSafeInteger(op.amount) ||
          op.amount < specs[op.kind].min || op.amount > specs[op.kind].max) return null;
      parameters[op.kind] = op.amount;
    }
  }
  const template = namedBonus(definition);
  if (template && parameters.trigger === conditions[template[0]] && parameters.bonus === template[1]) {
    return {id:effect.id, version:effect.version, parameters:{}};
  }
  return {id: effect.id, version: effect.version, parameters};
}
module.exports = { namedBonus, printedOnly, combatSpecs, conditions, operations, supports, decompile, compile };
