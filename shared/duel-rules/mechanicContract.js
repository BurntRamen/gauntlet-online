"use strict";
// Published v1 definitions retain their original meaning. V2 introduces bounded
// controller decisions, never executable code or recursively scheduled effects.
const v1 = require("./mechanicContractV1");
const VERSION2 = "gauntlet.mechanics.v2";
const decisions = { automatic: "Resolve automatically", optional: "Controller may pay and resolve, or decline", required: "Controller must choose an available target" };
function errors(definition) {
  if (definition?.interpreter !== 2) return v1.errors(definition);
  if (!Array.isArray(definition.abilities)) return ["Use one to six abilities."];
  const legacy = { ...definition, interpreter: 1, abilities: definition.abilities.map(a => { const { decision, ...fields } = a || {}; return fields; }) };
  const issues = v1.errors(legacy).filter(message => !message.includes("automatic triggers have no optional costs"));
  for (const [index, a] of definition.abilities.entries()) {
    const add = text => issues.push(`Ability ${index + 1}: ${text}`);
    if (!a || !Object.hasOwn(decisions, a.decision)) { add("choose an automatic, optional or required decision."); continue; }
    const manual = ["activate", "response"].includes(a.trigger);
    if (manual && a.decision !== "automatic") add("activations already use a voluntary command; choose automatic resolution.");
    if (!manual && a.decision === "automatic" && (a.target !== "none" || Object.values(a.cost || {}).some(Boolean))) add("selected targets and costs require a controller decision.");
    if (a.trigger === "payment" && a.decision !== "automatic") add("payment adjustments resolve before payment selection and cannot ask for another decision.");
    if (a.decision === "required" && (a.target === "none" || Object.values(a.cost || {}).some(Boolean))) add("required choices select a target without imposing optional costs.");
    if (!manual && a.cost?.consumeSource && !["placed", "turnStart", "turnEnd"].includes(a.trigger)) add("only a support still on the board can be consumed by a triggered decision.");
    if (a.decision !== "automatic" && definition.cardTypes?.includes("ambush")) add("concealed Ambush decision triggers are unavailable until a reveal timing contract is implemented.");
    if ((a.effects || []).filter(op => ["recover", "discard", "removeSupport", "moveLane"].includes(op.kind)).length > 1) add("move a selected target only once per ability.");
  }
  return issues;
}
function validateEffect(effect, card) {
  if (effect?.version !== 2) return v1.validateEffect(effect, card);
  if (effect.id !== v1.ID || !/^mechanic-[a-f0-9-]{36}$/.test(effect.mechanicId)) return false;
  if (v1.exact(effect, ["id", "version", "mechanicId"])) return true;
  return v1.exact(effect, ["id", "version", "mechanicId", "definition", "revision"]) && /^[a-f0-9]{64}$/.test(effect.revision) && effect.definition?.interpreter === 2 && !errors(effect.definition).length && effect.definition.id === effect.mechanicId && (!card || effect.definition.cardTypes.includes(card.type));
}
function explain(definition) {
  if (definition?.interpreter !== 2) return v1.explain(definition);
  if (errors(definition).length) return "Correct the validation errors to generate an executable explanation.";
  return definition.abilities.map(a => `${a.label}: ${v1.triggers[a.trigger]}. ${a.conditions.filter(c => c.kind !== "always").map(c => `${v1.conditions[c.kind][2]} ${c.amount || ""}`).join(" and ")}${a.conditions.some(c => c.kind !== "always") ? ". " : ""}${a.decision === "optional" ? "You may resolve this ability, or decline. " : a.decision === "required" ? "Choose a target; skip if none remains. " : ""}${a.target !== "none" ? `Choose ${v1.targets[a.target]}. ` : ""}${a.cost.payment ? `Pay ${a.cost.payment} from hand. ` : ""}${a.cost.life ? `Pay ${a.cost.life} life. ` : ""}${a.cost.counters ? `Spend ${a.cost.counters} mechanic counters. ` : ""}${a.cost.consumeSource ? "Discard this support. " : ""}${a.effects.map(op => `${v1.operations[op.kind].label} (${op.amount}; ${op.duration})`).join("; then ")}. At most ${a.perTurn} per turn${a.perMatch ? ` and ${a.perMatch} per match` : ""}.`).join("\n");
}
const ability = (trigger = "placed", interpreter = 1) => ({ ...v1.ability(trigger), ...(interpreter === 2 ? { decision: "automatic" } : {}) });
module.exports = { ...v1, VERSION2, decisions, supportedVersions: [v1.VERSION, VERSION2], errors, validateEffect, ability, explain };
