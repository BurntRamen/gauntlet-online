const test = require("node:test"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const rules = require("../../shared/duel-rules"), contract = require("../../shared/duel-rules/mechanicContract"), choices = require("../mechanicChoices");
const id = "mechanic-11111111-1111-4111-8111-111111111111";
const card = (id, value = 4) => ({ id, value, rank: String(value), suit: "spades", name: id });
function source(type, abilities, name = "source") {
  const definition = { id, name: "Decision fixture", status: "active", interpreter: 2, cardTypes: [type], abilities };
  assert.deepEqual(contract.errors(definition), []);
  return { ...card(name), type, factionId: "rumin", effect: { id: contract.ID, version: 2, mechanicId: id, definition, revision: crypto.createHash("sha256").update(JSON.stringify(definition)).digest("hex") } };
}
function game() {
  const state = rules.createMatch({ seed: "decisions", startingPriority: 1, gameMode: "factions", factions: { 1: { id: "rumin", mechanics: null }, 2: { id: "sheen", mechanics: null } } }).state;
  state.contentBinding = { mechanicVersion: contract.VERSION2 };
  for (const p of [1, 2]) { state.players[p].hand = [card(`pay-${p}`, 8), card(`extra-${p}`, 3)]; state.players[p].deck = [card(`draw-${p}`, 2)]; }
  return state;
}
const ability = (trigger, patch) => ({ ...contract.ability(trigger, 2), decision: "optional", ...patch });
function accept(state, command) { const r = rules.applyCommand(state, command); assert.equal(r.accepted, true, r.rejectionReason); return r; }
function action(state, player, predicate = a => !a.decline) {
  const a = rules.getLegalActions(state, player).find(predicate); assert.ok(a);
  return { type: a.type, player, ...a.confirmationPayload.fixed, paymentCardIds: [] };
}
test("optional attack choices block all other commands, pay exactly once, preserve ordering and survive JSON recovery", () => {
  let state = game(); state.players[1].hand.push(source("servitor", [ability("attack", { cost: { payment: 3, life: 1, counters: 0, consumeSource: false }, effects: [{ kind: "attackBonus", amount: 2, duration: "combat" }] }), { ...contract.ability("attack", 2), effects: [{ kind: "gainLife", amount: 3, duration: "instant" }] }]));
  state = accept(state, { type: "declareHandAttack", player: 1, cardId: "source", paymentCardIds: ["pay-1"] }).state;
  assert.equal(state.priority, 2); assert.equal(state.handAttacks[0].effectiveValue, 4); assert.equal(state.players[1].life, 42);
  assert.equal(state.mechanicQueue.length, 2); assert.equal(rules.getLegalActions(state, 2).length, 0);
  assert.equal(rules.applyCommand(state, { type: "declineBlock", player: 2 }).accepted, false);
  const command = { ...action(state, 1), paymentCardIds: ["extra-1"] }, before = JSON.stringify(state);
  assert.equal(rules.applyCommand(state, { ...command, player: 2 }).accepted, false);
  assert.equal(rules.applyCommand(state, { ...command, paymentCardIds: ["missing"] }).accepted, false); assert.equal(JSON.stringify(state), before);
  choices.stamp(state, 100, 500); choices.stamp(state, 300, 500); assert.equal(state.mechanicQueue[0].deadline, 600);
  const recovered = JSON.parse(JSON.stringify(state)); const result = accept(recovered, command);
  assert.equal(result.state.handAttacks[0].effectiveValue, 6); assert.equal(result.state.players[1].life, 44); assert.equal(result.state.priority, 2);
  assert.deepEqual(result.animationEvents.filter(e => e.type === "mechanic.effect").map(e => e.operation), ["attackBonus", "gainLife"]);
  assert.equal(result.state.players[1].discard.filter(c => c.id === "extra-1").length, 1);
  assert.equal(rules.applyCommand(result.state, command).accepted, false);
  assert.ok(result.animationEvents.some(e => e.type === "choice.resolved" && e.paidLife === 1));
  assert.equal(result.state.mechanicQueue.length, 0);
});
test("target choices and decline have private legal options, immutable inputs, and no optional cost on timeout", () => {
  let state = game(); state.players[1].discard = [card("old")];
  state.players[1].hand.push(source("spell", [ability("placed", { target: "discard", cost: { payment: 3, life: 2, counters: 0, consumeSource: false }, effects: [{ kind: "recover", amount: 1, duration: "instant" }] })]));
  state = accept(state, rules.createCommandEnvelope(state, 1, { type: "playSupport", cardId: "source", laneIndex: 0, paymentCardIds: ["pay-1"] })).state;
  const view = rules.projectForPerspective(state, 2); assert.equal(view.mechanicQueue, undefined); assert.equal(view.mechanicContinuation, undefined);
  assert.equal(JSON.stringify(view).includes('"extra-1"'), false); assert.equal(view.mechanicDecision.player, 1); assert.deepEqual(view.legalActions, []);
  const command = { ...action(state, 1), paymentCardIds: ["extra-1"] };
  assert.equal(rules.applyCommand(state, { ...command, targetCardId: "pay-2" }).accepted, false);
  const paid = accept(state, command).state; assert.equal(paid.players[1].life, 40); assert.ok(paid.players[1].hand.some(c => c.id === "old"));
  const timeout = choices.command(state, { timeout: true }); assert.match(timeout.abilityId, /decline$/);
  const declined = accept(state, timeout); assert.equal(declined.state.players[1].life, 42); assert.ok(declined.state.players[1].hand.some(c => c.id === "extra-1"));
  assert.ok(declined.animationEvents.some(e => e.type === "choice.declined"));
});
test("turn-end decisions resolve before refill and before turn-start effects", () => {
  let state = game();
  state.lanes[0].support[1] = source("spell", [ability("turnEnd", { target: "hand", decision: "required", effects: [{ kind: "discard", amount: 1, duration: "instant" }] })]);
  state = accept(state, { type: "passPriority", player: 1 }).state;
  state = accept(state, { type: "passPriority", player: 2 }).state;
  for (let i = 0; i < 6; i++) state = accept(state, { type: "skipPlacement", player: rules.currentPlacementPlayer(state), laneIndex: state.endPlacementLaneIndex }).state;
  assert.equal(state.turn, 1); assert.equal(state.mechanicContinuation.kind, "nextTurn");
  assert.ok(!state.players[1].hand.some(c => c.id === "draw-1"));
  const result = accept(JSON.parse(JSON.stringify(state)), choices.command(state, { timeout: true }));
  assert.equal(result.state.turn, 2); assert.equal(result.state.mechanicContinuation, undefined);
  assert.ok(result.state.players[1].hand.some(c => c.id === "draw-1"));
  assert.ok(result.animationEvents.findIndex(e => e.type === "card.moved") < result.animationEvents.findIndex(e => e.type === "turn.started"));
});
test("a queued block modifier resolves before basic combat damage; missing required targets skip", () => {
  let state = game(); state.gameMode = "basic";
  state.players[2].hand.push(source("servitor", [ability("block", { effects: [{ kind: "blockBonus", amount: 3, duration: "combat" }] })], "blocker"));
  state = accept(state, { type: "declareHandAttack", player: 1, cardId: "extra-1", paymentCardIds: ["pay-1"] }).state;
  state = accept(state, { type: "declareHandBlock", player: 2, blockerCardIds: ["blocker"], paymentCardIds: ["pay-2"] }).state;
  assert.equal(state.handAttacks.length, 1); assert.equal(state.mechanicContinuation.kind, "combat");
  const result = accept(state, action(state, 2)); assert.equal(result.state.handAttacks.length, 0); assert.equal(result.state.players[2].life, 42);
  state = game(); state.players[1].hand.push(source("servitor", [ability("attack", { decision: "required", target: "enemySupport", effects: [{ kind: "removeSupport", amount: 1, duration: "instant" }] })]));
  const skipped = accept(state, { type: "declareHandAttack", player: 1, cardId: "source", paymentCardIds: ["pay-1"] });
  assert.equal(skipped.state.mechanicQueue.length, 0); assert.ok(skipped.animationEvents.some(e => e.type === "choice.skipped"));
});
test("interpreter version, concealed decisions, forced costs and malformed programs fail closed", () => {
  const fixture = source("spell", [ability("placed")]);
  assert.equal(contract.validateEffect({ ...fixture.effect, version: 1 }, fixture), false);
  for (const patch of [{ cardTypes: ["ambush"] }, { abilities: [ability("placed", { decision: "required", target: "hand", cost: { payment: 1, life: 0, counters: 0, consumeSource: false } })] }, { abilities: [ability("placed", { script: "run" })] }]) assert.ok(contract.errors({ ...fixture.effect.definition, ...patch }).length);
  const legacy = { ...fixture.effect.definition, interpreter: 1, abilities: [contract.ability()] }; assert.deepEqual(contract.errors(legacy), []);
  const invalid = game(); invalid.contentBinding.mechanicVersion = "gauntlet.mechanics.v999"; assert.equal(rules.applyCommand(invalid, { type: "passPriority", player: 1 }).accepted, false);
});
