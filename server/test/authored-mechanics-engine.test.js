const test = require("node:test"), assert = require("node:assert/strict");
const crypto = require("node:crypto"), rules = require("../../shared/duel-rules");
const contract = require("../../shared/duel-rules/mechanicContract");
const id = "mechanic-11111111-1111-4111-8111-111111111111";
const card = (id, value = 4) => ({ id, value, rank: String(value), suit: "spades", name: id });
function authored(type, abilities) {
  const definition = { id, name: "Test mechanic", status: "active", interpreter: 1, cardTypes: [type], abilities };
  assert.deepEqual(contract.errors(definition), []);
  return { ...card("source"), type, factionId: "rumin", effect: { id: contract.ID, version: 1, mechanicId: id, definition, revision: crypto.createHash("sha256").update(JSON.stringify(definition)).digest("hex") } };
}
function game() {
  const state = rules.createMatch({ seed: "authored", startingPriority: 1, gameMode: "factions", factions: { 1: { id: "rumin", mechanics: null }, 2: { id: "sheen", mechanics: null } } }).state;
  for (const p of [1, 2]) { state.players[p].hand = [card(`pay-${p}`, 8), card(`extra-${p}`, 3)]; state.players[p].deck = [card(`draw-${p}`, 2)]; }
  return state;
}
function accept(state, command) { const r = rules.applyCommand(state, command); assert.equal(r.accepted, true, r.rejectionReason); return r; }
test("placed non-Servitor draws exactly once, cannot attack/block, and rejected choices commit nothing", () => {
  let state = game(); const source = authored("spell", [contract.ability()]); state.players[1].hand.push(source);
  assert.equal(rules.applyCommand(state, { type: "declareHandAttack", player: 1, cardId: source.id, paymentCardIds: ["pay-1"] }).accepted, false);
  const blockState = structuredClone(state); blockState.priority = 2;
  const incoming = accept(blockState, { type: "declareHandAttack", player: 2, cardId: "extra-2", paymentCardIds: ["pay-2"] }).state;
  assert.equal(rules.applyCommand(incoming, { type: "declareHandBlock", player: 1, blockerCardIds: [source.id], paymentCardIds: ["pay-1"] }).accepted, false);
  state = accept(state, { type: "passPriority", player: 1 }).state;
  state = accept(state, { type: "passPriority", player: 2 }).state;
  const before = JSON.stringify(state);
  assert.equal(rules.applyCommand(state, { type: "placeFacedown", player: 2, laneIndex: 0, cardId: source.id }).accepted, false);
  assert.equal(JSON.stringify(state), before);
  const placed = accept(state, { type: "placeFacedown", player: 1, laneIndex: 0, cardId: source.id });
  assert.equal(placed.state.players[1].hand.filter(c => c.id === "draw-1").length, 1);
  assert.equal(placed.animationEvents.filter(e => e.type === "cards.drawn").length, 1);
  assert.equal(placed.state.lanes[0].support[1].id, source.id);
  assert.equal(rules.applyCommand(placed.state, { type: "placeFacedown", player: 1, laneIndex: 0, cardId: source.id }).accepted, false);
});
test("ordered attack effects and payment reductions use normal payment, priority and captured definitions", () => {
  const reduction = { ...contract.ability("payment"), label: "Efficient", conditions: [{ kind: "handAtLeast", amount: 3 }], effects: [{ kind: "paymentReduction", amount: 2, duration: "instant" }] };
  const a = { ...contract.ability("attack"), conditions: [{ kind: "overpay", amount: 1 }], effects: [{ kind: "attackBonus", amount: 3, duration: "combat" }, { kind: "draw", amount: 1, duration: "instant" }] };
  const state = game(); state.players[1].hand.push(authored("servitor", [reduction, a]));
  const r = rules.applyCommand(state, { type: "declareHandAttack", player: 1, cardId: "source", paymentCardIds: ["extra-1"] }, { diagnostics: true });
  assert.equal(r.accepted, true); assert.equal(r.mechanicsTrace.length, 3); assert.match(r.mechanicsTrace[1].message, /Modify this attack/);
  assert.equal(r.state.handAttacks[0].payment.required, 2); assert.equal(r.state.handAttacks[0].effectiveValue, 7);
  assert.equal(r.state.priority, 2); assert.equal(r.state.players[1].mechanicUses[`source:${id}:0`].total, 1);
  assert.deepEqual(r.animationEvents.filter(e => e.type === "mechanic.effect").map(e => e.operation), ["paymentReduction", "attackBonus", "draw"]);
  assert.equal(state.players[1].hand.at(-1).effect.definition.abilities[1].effects[0].amount, 3);
  const declined = accept(r.state, { type: "declineBlock", player: 2 }).state;
  const resolved = accept(declined, { type: "passPriority", player: 1 }).state;
  assert.equal(resolved.players[2].life, state.players[2].life - 7); assert.equal(resolved.handAttacks.length, 0);
});
test("paid support activations validate authoritative targets, reset passes and enforce per-turn usage atomically", () => {
  const a = { ...contract.ability("activate"), label: "Recover", target: "discard", cost: { payment: 3, life: 1, counters: 0, consumeSource: false }, effects: [{ kind: "recover", amount: 1, duration: "instant" }, { kind: "gainLife", amount: 2, duration: "instant" }] };
  const state = game(); state.lanes[0].support[1] = authored("spell", [a]); state.players[1].discard.push(card("recover-me"));
  const action = rules.getLegalActions(state, 1).find(a => a.abilityId?.startsWith("mechanic:")); assert.ok(action);
  assert.equal(action.confirmationPayload.fixed.targetCardId, "recover-me"); assert.equal(action.payment.requiredValue, 3);
  const command = { type: action.type, player: 1, ...action.confirmationPayload.fixed, paymentCardIds: ["extra-1"] };
  assert.equal(rules.applyCommand(state, { ...command, targetCardId: "pay-2" }).accepted, false);
  assert.equal(rules.applyCommand(state, { ...command, paymentCardIds: ["missing"] }).accepted, false);
  const r = accept(state, command);
  assert.ok(r.state.players[1].hand.some(c => c.id === "recover-me")); assert.equal(r.state.players[1].life, state.players[1].life + 1);
  assert.equal(r.state.priority, 1); assert.deepEqual(r.state.priorityPassed, { 1: false, 2: false });
  assert.equal(rules.applyCommand(r.state, command).accepted, false);
});
test("response prevention uses the existing combat window; malformed programs and scripts fail closed", () => {
  let state = game();
  const a = { ...contract.ability("response"), label: "Guard", effects: [{ kind: "preventDamage", amount: 3, duration: "combat" }] };
  state.lanes[0].support[2] = authored("shelter", [a]);
  state = accept(state, { type: "declareHandAttack", player: 1, cardId: "extra-1", paymentCardIds: ["pay-1"] }).state;
  const action = rules.getLegalActions(state, 2).find(a => a.abilityId?.startsWith("mechanic:"));
  state = accept(state, { type: action.type, player: 2, ...action.confirmationPayload.fixed, paymentCardIds: [] }).state;
  state = accept(state, { type: "declineBlock", player: 2 }).state;
  state = accept(state, { type: "passPriority", player: 1 }).state; assert.equal(state.players[2].life, game().players[2].life);
  const bad = authored("servitor", [{ ...contract.ability("attack"), effects: [{ kind: "draw", amount: 1, duration: "instant" }] }]);
  bad.effect.definition.abilities[0].effects[0].kind = "eval";
  assert.equal(contract.validateEffect(bad.effect, bad), false);
  const invalid = game(); invalid.players[1].hand.push(bad);
  const before = JSON.stringify(invalid);
  assert.equal(rules.applyCommand(invalid, { type: "declareHandAttack", player: 1, cardId: "source", paymentCardIds: ["pay-1"] }).accepted, false);
  assert.equal(JSON.stringify(invalid), before);
});

test("zone and lane operations use owned targets, preserve cards, and expire turn bonuses", () => {
  const activate = (state, predicate) => { const a = rules.getLegalActions(state, 1).find(a => a.abilityId?.startsWith("mechanic:") && predicate(a)); assert.ok(a); return accept(state, { type: a.type, player: 1, ...a.confirmationPayload.fixed, paymentCardIds: [] }).state; };
  const state = game();
  const abilities = [
    { ...contract.ability("activate"), label: "Move", target: "lane", effects: [{ kind: "moveLane", amount: 1, duration: "instant" }] },
    { ...contract.ability("activate"), label: "Buff", target: "lane", effects: [{ kind: "valueBonus", amount: 2, duration: "turn" }] },
    { ...contract.ability("activate"), label: "Remove", target: "enemySupport", effects: [{ kind: "removeSupport", amount: 1, duration: "instant" }] },
    { ...contract.ability("activate"), label: "Discard", target: "hand", effects: [{ kind: "discard", amount: 1, duration: "instant" }] }
  ];
  state.lanes[0].support[1] = authored("spell", abilities); state.lanes[0].facedown[1] = card("hidden"); state.lanes[1].support[2] = { ...card("enemy"), type: "spell" };
  let next = activate(state, a => a.mechanicAbility === 0 && a.destinationLane === 2);
  assert.equal(next.lanes[0].facedown[1], null); assert.equal(next.lanes[2].facedown[1].id, "hidden");
  next = activate(next, a => a.mechanicAbility === 1); assert.equal(next.lanes[2].facedown[1].temporaryValueBonus, 2);
  next = activate(next, a => a.mechanicAbility === 2); assert.equal(next.lanes[1].support[2], null); assert.ok(next.players[2].discard.some(c => c.id === "enemy"));
  next = activate(next, a => a.mechanicAbility === 3 && a.targetCardId === "extra-1"); assert.ok(next.players[1].discard.some(c => c.id === "extra-1"));
  next = accept(next, { type: "passPriority", player: 1 }).state; next = accept(next, { type: "passPriority", player: 2 }).state;
  while (next.phase === "end") { const player = next.endPlacementStep === 0 ? next.endPlacementFirstPlayer : 3 - next.endPlacementFirstPlayer; next = accept(next, { type: "skipPlacement", player, laneIndex: next.endPlacementLaneIndex }).state; }
  assert.equal(Number(next.lanes[2].facedown[1].temporaryValueBonus || 0), 0);
});

test("turn triggers, counter costs, consumption and acceleration reuse faction interactions", () => {
  let state = game();
  const start = { ...contract.ability("turnStart"), effects: [{ kind: "counters", amount: 2, duration: "instant" }, { kind: "acceleration", amount: 1, duration: "instant" }] };
  const end = { ...contract.ability("turnEnd"), effects: [{ kind: "mill", amount: 1, duration: "instant" }] };
  const activation = { ...contract.ability("activate"), cost: { payment: 0, life: 0, counters: 2, consumeSource: true }, effects: [{ kind: "gainLife", amount: 2, duration: "instant" }] };
  state.lanes[0].support[1] = authored("contraption", [start, end, activation]);
  state.lanes[1].support[1] = { ...card("solar"), type: "contraption", effect: require("../../shared/duel-rules/effectRegistry").defaultCardEffect("bizi-solar-array-adept") };
  const acceleration = Number(state.players[1].accelerationCounters || 0);
  state = accept(state, { type: "passPriority", player: 1 }).state; state = accept(state, { type: "passPriority", player: 2 }).state;
  while (state.phase === "end") { const player = state.endPlacementStep === 0 ? state.endPlacementFirstPlayer : 3 - state.endPlacementFirstPlayer; state = accept(state, { type: "skipPlacement", player, laneIndex: state.endPlacementLaneIndex }).state; }
  assert.equal(state.players[1].mechanicCounters[id], 2); assert.ok(state.players[1].discard.some(c => c.id === "draw-1"));
  assert.equal(state.players[1].accelerationCounters, acceleration + 1); assert.equal(state.players[1].turnData.biziNextServitorBonus, 1);
  state.priority = 1; state.players[1].life = 0;
  const a = rules.getLegalActions(state, 1).find(a => a.abilityId?.startsWith("mechanic:")); assert.ok(a);
  state = accept(state, { type: a.type, player: 1, ...a.confirmationPayload.fixed, paymentCardIds: [] }).state;
  assert.equal(state.players[1].life, 2); assert.equal(state.players[1].mechanicCounters[id], 0); assert.equal(state.lanes[0].support[1], null);
});

test("activated payment conditions inspect selected cards before charging costs", () => {
  const a = { ...contract.ability("activate"), conditions: [{ kind: "overpay", amount: 2 }, { kind: "diamondsPaid", amount: 0 }], cost: { payment: 3, life: 0, counters: 0, consumeSource: false }, effects: [{ kind: "gainLife", amount: 2, duration: "instant" }] };
  const state = game(); state.players[1].hand[0].suit = "diamonds"; state.lanes[0].support[1] = authored("spell", [a]);
  const action = rules.getLegalActions(state, 1).find(a => a.abilityId?.startsWith("mechanic:")); assert.ok(action);
  const command = { type: action.type, player: 1, ...action.confirmationPayload.fixed };
  const before = JSON.stringify(state); assert.equal(rules.applyCommand(state, { ...command, paymentCardIds: ["extra-1"] }).accepted, false); assert.equal(JSON.stringify(state), before);
  assert.equal(accept(state, { ...command, paymentCardIds: ["pay-1"] }).state.players[1].life, state.players[1].life + 2);
});
