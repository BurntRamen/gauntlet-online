"use strict";
const contract = require("./compositionContract");
const isComposed = card => card?.effect?.id === contract.ID;
const armable = card => isComposed(card) && contract.validate(card.effect, card);
// Conditions are evaluated once, on the validated attack command's pre-payment
// snapshot. No effect may dispatch another trigger or mutate the condition facts.
function prepare(source, facts) {
  if (!armable(source)) return { error: "Unsupported armament composition or interpreter version." };
  return { source, abilities: source.effect.abilities.map((ability, index) => {
    const c = ability.condition;
    const observed = { always: true, overpay: facts.overpay, diamondsPaid: facts.diamondsPaid, attackValue: facts.attackValue, attackNumber: facts.attackNumber }[c.kind];
    const passed = c.kind === "always" || (c.kind === "diamondsPaid" ? observed : c.kind === "attackNumber" ? observed === c.amount : observed >= c.amount);
    return { index, passed, condition: c, observed, effects: ability.effects };
  }) };
}
// Only called on applyCommand's private clone, after the normal payment and
// source checks succeed. Rejected commands never commit this clone or its trace.
function execute(plan, game, attack, events, event, trace) {
  const source = plan.source, player = game.players[attack.player];
  const emit = entry => trace?.push({ source: source.name, sourceId: source.id, ...entry });
  emit({ step: "eligibility", message: "Eligible controlled armament; selected hand attacker is legal. Normal payment committed; source attached until combat ends.", required: attack.payment.required, paid: attack.payment.total, target: attack.card.id });
  for (const ability of plan.abilities) {
    emit({ step: "condition", ability: ability.index + 1, message: ability.passed ? "Condition passed." : "Condition failed; no effects resolve.", condition: ability.condition, observed: ability.observed });
    if (!ability.passed) continue;
    for (const [index, operation] of ability.effects.entries()) {
      const before = operation.kind === "attackBonus" ? attack.effectiveValue : player.life;
      if (operation.kind === "attackBonus") {
        attack.effectiveValue += operation.amount;
        const note = `${source.name} ability ${ability.index + 1}.${index + 1} +${operation.amount}`;
        attack.notes.push(note); attack.valueNotes.push(note);
      } else {
        player.life += operation.amount;
        events.push(event(game, "life.gained", { player: attack.player, amount: operation.amount, source: source.name }));
      }
      emit({ step: "effect", ability: ability.index + 1, order: index + 1, operation: operation.kind, target: operation.target === "attacker" ? attack.card.id : attack.player, duration: operation.duration, before, amount: operation.amount, after: before + operation.amount, message: `${operation.kind === "attackBonus" ? "Attack value" : "Life"}: ${before} + ${operation.amount} = ${before + operation.amount}.` });
    }
    emit({ step: "usage", ability: ability.index + 1, message: "Once-per-arming use consumed. This attached source cannot arm again; no turn reset." });
  }
}
module.exports = { isComposed, armable, prepare, execute };
