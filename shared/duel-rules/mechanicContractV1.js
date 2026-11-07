"use strict";

// This interpreter contract is immutable. Add a version rather than changing
// the meaning of a published primitive. Authoring supplies data, never code.
const ID = "authored-mechanic", VERSION = "gauntlet.mechanics.v1";
const types = ["servitor", "armament", "weaponry", "spell", "shelter", "ambush", "contraption", "biomorph", "operation", "arcana"];
const triggers = { attack: "When this card attacks", block: "When this card blocks", placed: "After this support is placed", turnStart: "At the start of each turn, while in support", turnEnd: "Before the turn's refill, while in support", combatEnd: "After this card's combat", activate: "Activate with open priority", response: "Activate during combat priority", payment: "Adjust this card's attack payment" };
const conditions = { always: [0, 0, "Always"], overpay: [0, 28, "Paid at least this much over cost"], lifeAtMost: [1, 100, "Your life is at most"], handAtLeast: [0, 12, "Cards in your hand at least"], countersAtLeast: [0, 20, "This mechanic's counters at least"], supportAtLeast: [0, 3, "Your support cards at least"], attackAtLeast: [2, 30, "Attacking value at least"], diamondsPaid: [0, 0, "A diamond was paid"] };
const targets = { none: "Automatic targets described by each effect", discard: "One card in your discard", hand: "One card in your hand", lane: "One of your combat lanes", support: "One of your support slots", enemySupport: "One opposing support slot" };
const operations = {
  attackBonus: { label: "Modify this attack", min: -8, max: 8, timing: ["attack", "response"], durations: ["combat"] },
  blockBonus: { label: "Modify this blocker", min: -8, max: 8, timing: ["block"], durations: ["combat"] },
  preventDamage: { label: "Prevent damage to you this combat", min: 1, max: 8, timing: ["block", "response"], durations: ["combat"] },
  gainLife: { label: "Gain life", min: 1, max: 8, durations: ["instant"] },
  damage: { label: "Deal damage to the opposing player", min: 1, max: 8, durations: ["instant"] },
  draw: { label: "Draw cards now", min: 1, max: 3, durations: ["instant"] },
  mill: { label: "Move your top deck cards to discard", min: 1, max: 3, durations: ["instant"] },
  recover: { label: "Return your selected discard card to hand", min: 1, max: 1, target: "discard", durations: ["instant"] },
  discard: { label: "Discard your selected hand card", min: 1, max: 1, target: "hand", durations: ["instant"] },
  counters: { label: "Adjust this mechanic's counters (bounded from 0 to 99)", min: -8, max: 8, durations: ["instant"] },
  acceleration: { label: "Adjust acceleration counters", min: -3, max: 3, durations: ["instant"] },
  valueBonus: { label: "Modify the selected controlled card", min: -8, max: 8, targets: ["lane", "support"], durations: ["turn"] },
  moveLane: { label: "Move the selected card to an empty same-kind slot", min: 1, max: 1, targets: ["lane", "support"], durations: ["instant"] },
  removeSupport: { label: "Discard the selected opposing support", min: 1, max: 1, target: "enemySupport", durations: ["instant"] },
  paymentReduction: { label: "Reduce this attack's payment requirement", min: 1, max: 8, timing: ["payment"], durations: ["instant"] }
};
const exact = (v, keys) => !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const integer = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;
const text = (v, max) => typeof v === "string" && v.trim().length > 0 && v.length <= max && !/[\x00-\x1f]/.test(v);
function errors(definition) {
  const issues = [], add = message => issues.push(message);
  if (!exact(definition, ["id", "name", "status", "interpreter", "cardTypes", "abilities"]) || !/^mechanic-[a-f0-9-]{36}$/.test(definition.id) || !text(definition.name, 120) || definition.interpreter !== 1 || !["active", "archived"].includes(definition.status)) return ["Use the supported mechanic identity and interpreter contract."];
  if (!Array.isArray(definition.cardTypes) || !definition.cardTypes.length || new Set(definition.cardTypes).size !== definition.cardTypes.length || definition.cardTypes.some(t => !types.includes(t))) return ["Choose supported compatible card types."];
  if (!Array.isArray(definition.abilities) || !integer(definition.abilities.length, 1, 6)) return [...issues, "Use one to six abilities."];
  for (const [index, a] of definition.abilities.entries()) {
    const prefix = `Ability ${index + 1}: `;
    if (!exact(a, ["label", "trigger", "conditions", "cost", "target", "perTurn", "perMatch", "effects"]) || !text(a.label, 100) || !Object.hasOwn(triggers, a.trigger) || !Object.hasOwn(targets, a.target) || !integer(a.perTurn, 1, 4) || !integer(a.perMatch, 0, 20)) { add(prefix + "choose a supported trigger, target and bounded use limits."); continue; }
    const manual = ["activate", "response"].includes(a.trigger);
    if (!exact(a.cost, ["payment", "life", "counters", "consumeSource"]) || !integer(a.cost.payment, 0, 14) || !integer(a.cost.life, 0, 8) || !integer(a.cost.counters, 0, 8) || typeof a.cost.consumeSource !== "boolean") add(prefix + "use supported costs.");
    else if (!manual && (a.cost.payment || a.cost.life || a.cost.counters || a.cost.consumeSource || a.target !== "none")) add(prefix + "automatic triggers have no optional costs or player-selected targets; use an activation for choices.");
    if (["placed", "turnStart", "turnEnd", "activate", "response"].includes(a.trigger) && definition.cardTypes.includes("servitor")) add(prefix + "support triggers require a non-Servitor type; combat cards do not reveal themselves from hidden lanes.");
    if (["attack", "block", "combatEnd", "payment"].includes(a.trigger) && definition.cardTypes.some(t => t !== "servitor")) add(prefix + "combat triggers require a Servitor; support cards never become attackers or blockers.");
    if (!Array.isArray(a.conditions) || !integer(a.conditions.length, 1, 4) || a.conditions.some(c => !exact(c, ["kind", "amount"]) || !Object.hasOwn(conditions, c.kind) || !integer(c.amount, conditions[c.kind]?.[0], conditions[c.kind]?.[1]))) add(prefix + "use one to four supported conditions and ranges.");
    if (a.trigger === "payment" && Array.isArray(a.conditions) && a.conditions.some(c => ["overpay", "diamondsPaid", "attackAtLeast"].includes(c?.kind))) add(prefix + "payment adjustments cannot depend on the payment they modify.");
    if (Array.isArray(a.conditions)) for (const c of a.conditions) {
      if (["overpay", "diamondsPaid"].includes(c?.kind) && !["attack", "block", "combatEnd", "activate", "response"].includes(a.trigger)) add(prefix + "this trigger has no payment to inspect.");
      if (c?.kind === "attackAtLeast" && !["attack", "block", "combatEnd", "response"].includes(a.trigger)) add(prefix + "this trigger has no pending attack to inspect.");
    }
    if (!Array.isArray(a.effects) || !integer(a.effects.length, 1, 4)) { add(prefix + "use one to four ordered effects."); continue; }
    for (const op of a.effects) {
      const spec = operations[op?.kind];
      if (!exact(op, ["kind", "amount", "duration"]) || !spec || !integer(op.amount, spec.min, spec.max) || !spec.durations.includes(op.duration) || spec.timing && !spec.timing.includes(a.trigger) || spec.target && spec.target !== a.target || spec.targets && !spec.targets.includes(a.target) || a.trigger === "payment" && op.kind !== "paymentReduction") add(prefix + "an effect has an unsupported timing, target, duration or amount.");
    }
    if (a.target !== "none" && !a.effects.some(op => operations[op?.kind]?.target || operations[op?.kind]?.targets)) add(prefix + "a selected target must be used by an effect.");
  }
  if (!issues.length && describe(definition).length > 2000) add("Generated card wording exceeds 2,000 characters. Shorten ability labels or use fewer conditions/effects.");
  return issues;
}
function validateEffect(effect, card) {
  if (!effect || effect.id !== ID || effect.version !== 1 || !/^mechanic-[a-f0-9-]{36}$/.test(effect.mechanicId)) return false;
  if (exact(effect, ["id", "version", "mechanicId"])) return true; // unresolved authoring reference
  return exact(effect, ["id", "version", "mechanicId", "definition", "revision"]) && /^[a-f0-9]{64}$/.test(effect.revision) && !errors(effect.definition).length && effect.definition.id === effect.mechanicId && (!card || effect.definition.cardTypes.includes(card.type));
}
const ability = (trigger = "placed") => ({ label: "Draw when placed", trigger, conditions: [{ kind: "always", amount: 0 }], cost: { payment: 0, life: 0, counters: 0, consumeSource: false }, target: "none", perTurn: 1, perMatch: 0, effects: [{ kind: "draw", amount: 1, duration: "instant" }] });
function describe(definition) {
  return definition.abilities.map(a => `${a.label}: ${triggers[a.trigger]}. ${a.conditions.filter(c => c.kind !== "always").map(c => `${conditions[c.kind][2]} ${c.amount || ""}`).join(" and ")}${a.conditions.some(c => c.kind !== "always") ? ". " : ""}${a.cost.payment ? `Pay ${a.cost.payment} from hand. ` : ""}${a.cost.life ? `Pay ${a.cost.life} life. ` : ""}${a.cost.counters ? `Spend ${a.cost.counters} mechanic counters. ` : ""}${a.cost.consumeSource ? "Discard this source. " : ""}${a.effects.map(op => `${operations[op.kind].label} (${op.amount}; ${op.duration})`).join("; then ")}. At most ${a.perTurn} per turn${a.perMatch ? ` and ${a.perMatch} per match` : ""}.`).join("\n");
}
function explain(definition) { return errors(definition).length ? "Correct the validation errors to generate an executable explanation." : describe(definition); }
module.exports = { ID, VERSION, types, triggers, conditions, targets, operations, exact, errors, validateEffect, ability, explain };
