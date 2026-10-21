const test = require("node:test"), assert = require("node:assert/strict");
const engine = require("../../shared/duel-rules");
const contract = require("../../shared/duel-rules/compositionContract");
const { explain } = require("../../shared/duel-rules/compositionExplanation");
const { clone, createAuthoredBaseline, resolveEngineContent, pinGameContent } = require("../authoredContent");
const { applyScenario } = require("../adminTestScenarios");
const { previewAction, legalActions } = require("../adminPlaytestActions");
const old = require("./fixtures/content-v2/authored-baseline-v1.json");
const baseline = createAuthoredBaseline({ domains: { decks: old.domains.decks }, game: { modes: old.domains.game } });
const composed = () => { const effect = contract.create(); effect.abilities[0].condition = { kind: "overpay", amount: 2 }; effect.abilities[0].effects.push({ kind: "gainLife", amount: 1, ...contract.operations.gainLife }); return effect; };
function fixture(effect = composed(), payment = 14) {
  const snapshot = clone(baseline), definition = snapshot.domains.cards.find(card => card.id === "rumin-coin-scale-spear");
  definition.effect = effect;
  const resolved = resolveEngineContent(snapshot, "test-composition-release");
  const starting = pinGameContent(engine.createMatch({ matchId: "composition", seed: "composition", gameMode: "factions", startingPriority: 1, factions: { 1: resolved.factions.rumin, 2: resolved.factions.sheen } }).state, resolved);
  const game = applyScenario(starting, resolved, { version: 1, turn: 1, priority: 1, players: { 1: { factionId: "rumin", hand: [{ value: 2, suit: "spades" }, { value: payment, suit: "hearts" }, { value: 3, suit: "clubs" }, { value: 14, suit: "diamonds" }], support: [{ cardId: definition.id, value: 4, suit: "diamonds" }, null, null] }, 2: { factionId: "sheen" } } }, "composition").game;
  const command = { type: "declareHandAttack", player: 1, cardId: game.players[1].hand[0].id, paymentCardIds: [game.players[1].hand[1].id], armWeaponCardIds: [game.lanes[0].support[1].id] };
  return { game, command, definition, resolved };
}
test("guided contract rejects unknown, excessive, recursive and incompatible compositions", () => {
  assert.equal(contract.validate(composed(), { factionId: "rumin", type: "armament" }), true);
  assert.equal(contract.validate(composed(), { factionId: "sheen", type: "armament" }), false);
  for (const mutate of [e => e.version = 2, e => e.script = "x", e => e.abilities = [], e => e.abilities = Array(5).fill(contract.ability()), e => e.abilities[0].timing = "onDamage", e => e.abilities[0].limit = "everyTurn", e => e.abilities[0].cost = "free", e => e.abilities[0].condition = { kind: "unknown" }, e => e.abilities[0].condition.amount = -1, e => e.abilities[0].condition.amount = 1.5, e => e.abilities[0].effects = Array(5).fill(e.abilities[0].effects[0]), e => e.abilities[0].effects[0].target = "opponent", e => e.abilities[0].effects[0].duration = "forever", e => e.abilities[0].effects[0].kind = "triggerAbility", e => e.abilities[0].effects[0].amount = 9]) {
    const next = composed(); mutate(next); assert.equal(contract.validate(next), false, mutate.toString());
  }
  assert.match(explain(composed()), /overpayment at least 2.*add 2.*then gain 1/s);
});

test("authored armaments pay for Support Zones, survive recovery and consume once with their mechanics trace", () => {
  const { game, command } = fixture(), source = game.lanes[0].support[1];
  game.lanes[0].support[1] = null;
  const pitch = game.players[1].hand[3];
  game.players[1].hand.push(source);
  const action = legalActions(game).find(row => row.type === "playSupport" && row.cardId === source.id && row.laneIndex === 0);
  assert.ok(action, "Authored compositions must have the same paid placement descriptor as shipped armaments");
  const placement = engine.createCommandEnvelope(game, 1, { type: "playSupport", cardId: source.id, laneIndex: 0, paymentCardIds: [pitch.id] }, "composition-support");
  const placed = engine.applyCommand(game, placement);
  assert.equal(placed.accepted, true, placed.rejectionReason);
  assert.equal(placed.state.paymentLog.at(-1).required, source.value);
  assert.equal(placed.state.lanes[0].support[1].supportState.charges, 1);
  assert.equal(engine.applyCommand(placed.state, placement).duplicate, true);
  const { cloneRoomForStorage, prepareRecoveredRoom } = require("../roomStateStore");
  const recovered = prepareRecoveredRoom(cloneRoomForStorage({ roomCode: "COMPOSED", lobby: { players: { 1: {}, 2: {} } }, game: placed.state })).game;
  assert.equal(engine.applyCommand(recovered, placement).duplicate, true);
  const attack = engine.applyCommand(recovered, command, { diagnostics: true });
  assert.equal(attack.accepted, true, attack.rejectionReason);
  assert.equal(attack.state.handAttacks[0].effectiveValue, 4);
  assert.equal(attack.state.players[1].life, 43);
  const response = engine.applyCommand(attack.state, { type: "declineBlock", player: 2 });
  const end = engine.applyCommand(response.state, { type: "passPriority", player: 1 }, { diagnostics: true });
  assert.equal(end.accepted, true, end.rejectionReason);
  assert.equal(end.state.players[1].discard.filter(card => card.id === source.id).length, 1);
  assert.equal(end.state.players[1].discard.find(card => card.id === source.id).supportState.charges, 0);
  assert.ok(end.animationEvents.some(event => event.type === "support.discarded" && event.cardId === source.id));
  assert.ok(end.mechanicsTrace.some(entry => entry.step === "expiration" && entry.sourceId === source.id));
});
test("real legal descriptors, transactional payment, ordered effects and private trace", () => {
  const effect = composed(); effect.abilities[0].effects.push({ kind: "attackBonus", amount: 3, ...contract.operations.attackBonus });
  const { game, command } = fixture(effect), before = clone(game);
  const action = legalActions(game).find(action => action.cardId === command.cardId);
  assert.ok(action.optionalEffects.find(option => option.id === "arm-rumin-weapons").cardIds.includes(command.armWeaponCardIds[0]));
  const preview = previewAction(game, command); assert.equal(preview.accepted, true); assert.deepEqual(game, before);
  const result = engine.applyCommand(game, command, { diagnostics: true }); assert.equal(result.accepted, true);
  assert.equal(result.state.handAttacks[0].effectiveValue, 7); assert.equal(result.state.players[1].life, 43);
  assert.equal(result.state.priority, 2); assert.equal(result.state.lanes[0].support[1], null);
  assert.equal(result.state.paymentLog.at(-1).total, 14);
  assert.deepEqual(result.mechanicsTrace.filter(step => step.step === "effect").map(step => [step.operation, step.before, step.after]), [["attackBonus", 2, 4], ["gainLife", 42, 43], ["attackBonus", 4, 7]]);
  assert.deepEqual(preview.mechanicsTrace, result.mechanicsTrace);
  assert.equal(engine.applyCommand(game, command).mechanicsTrace, undefined);
  const replay = require("../../shared/match-history/replay").buildPublicReplaySnapshot(result.state);
  assert.deepEqual(replay.handAttacks[0].attachedCards[0].effect, effect);
  assert.equal(replay.contentBinding.compositionVersion, contract.VERSION);
  assert.equal(replay.mechanicsTrace, undefined);
  for (const state of [result.state, engine.projectForPerspective(result.state, 2)]) assert.ok(!JSON.stringify(state).includes("mechanicsTrace"));
  const response = engine.applyCommand(result.state, { type: "declineBlock", player: 2 });
  assert.equal(response.state.players[2].life, 42, "the response window is preserved");
  const resolved = engine.applyCommand(response.state, { type: "passPriority", player: 1 }, { diagnostics: true });
  assert.equal(resolved.accepted, true); assert.equal(resolved.state.players[2].life, 35);
  assert.ok(resolved.mechanicsTrace.some(step => step.step === "expiration"));
  assert.ok(resolved.state.players[1].discard.some(card => card.id === command.armWeaponCardIds[0]));
  assert.equal(resolved.state.players[1].life, 43);
  // The consumed source cannot arm a later attack. Restore priority by its real
  // pass command; do not patch pending-combat internals.
  const ready = resolved.state.priority === 1 ? resolved.state : engine.applyCommand(resolved.state, { type: "passPriority", player: 2 }).state;
  const again = { ...command, cardId: ready.players[1].hand[0].id, paymentCardIds: [ready.players[1].hand[1].id] };
  const denied = engine.applyCommand(ready, again); assert.equal(denied.accepted, false); assert.deepEqual(denied.state, ready);
});
test("false requirements consume the selected source but apply no effects; payment and priority failures are atomic", () => {
  const { game, command } = fixture(composed(), 2);
  const result = engine.applyCommand(game, command, { diagnostics: true });
  assert.equal(result.accepted, true); assert.equal(result.state.handAttacks[0].effectiveValue, 2); assert.equal(result.state.players[1].life, 42);
  assert.equal(result.mechanicsTrace.find(step => step.step === "condition").observed, 0);
  assert.equal(result.state.lanes[0].support[1], null);
  for (const change of [{ paymentCardIds: [] }, { paymentCardIds: [command.cardId] }, { player: 2 }, { armWeaponCardIds: ["unknown"] }, { armWeaponCardIds: [command.armWeaponCardIds[0], command.armWeaponCardIds[0]] }, { type: "declareLaneAttack", laneIndex: 0 }]) {
    const before = clone(game), rejected = engine.applyCommand(game, { ...command, ...change }, { diagnostics: true });
    assert.equal(rejected.accepted, false); assert.deepEqual(game, before); assert.deepEqual(rejected.state, before); assert.equal(rejected.mechanicsTrace[0].costsCommitted, false);
  }
  const moved = clone(game); moved.lanes[0].support[1] = null;
  assert.equal(engine.applyCommand(moved, command).accepted, false);
  const future = clone(game); future.contentBinding.compositionVersion = "gauntlet.composition.armament.v2";
  assert.match(engine.applyCommand(future, command).rejectionReason, /interpreter/);
});
test("reordering commuting effects changes authoritative trace order independently of conditions", () => {
  const forward = composed(), reverse = clone(forward);
  reverse.abilities[0].effects.reverse();
  assert.deepEqual(forward.abilities[0].condition, reverse.abilities[0].condition);
  const execute = effect => { const { game, command } = fixture(effect); return engine.applyCommand(game, command, { diagnostics: true }); };
  const a = execute(forward), b = execute(reverse);
  assert.equal(a.accepted, true); assert.equal(b.accepted, true);
  assert.deepEqual(a.mechanicsTrace.filter(row => row.step === "effect").map(row => row.operation), ["attackBonus", "gainLife"]);
  assert.deepEqual(b.mechanicsTrace.filter(row => row.step === "effect").map(row => row.operation), ["gainLife", "attackBonus"]);
  assert.equal(a.state.handAttacks[0].effectiveValue, b.state.handAttacks[0].effectiveValue);
  assert.equal(a.state.players[1].life, b.state.players[1].life);
});
test("all condition predicates use pre-attack facts and interoperate with existing Rumin bonuses", () => {
  for (const [condition, expected] of [[{ kind: "always" }, 4], [{ kind: "attackValue", amount: 3 }, 2], [{ kind: "attackValue", amount: 2 }, 4], [{ kind: "attackNumber", amount: 1 }, 4], [{ kind: "attackNumber", amount: 2 }, 2], [{ kind: "diamondsPaid" }, 2]]) {
    const effect = contract.create(); effect.abilities[0].condition = condition;
    const { game, command } = fixture(effect); assert.equal(engine.applyCommand(game, command).state.handAttacks[0].effectiveValue, expected);
  }
  const { game, command } = fixture(); game.players[1].turnData.ruminNextWeaponArmBonus = 1;
  const result = engine.applyCommand(game, command, { diagnostics: true });
  assert.equal(result.state.handAttacks[0].effectiveValue, 5); assert.equal(result.state.players[1].turnData.ruminNextWeaponArmBonus, 0);
  assert.equal(result.mechanicsTrace.find(step => step.operation === "attackBonus").before, 3);
  const diamond = contract.create(); diamond.abilities[0].condition = { kind: "diamondsPaid" };
  const d = fixture(diamond); d.command.paymentCardIds = [d.game.players[1].hand[3].id];
  assert.equal(engine.applyCommand(d.game, d.command).state.handAttacks[0].effectiveValue, 4);
});
test("representative legacy armaments retain their outputs; equivalent composition is opt-in only", () => {
  for (const payment of [2, 4, 14]) {
    const equivalent = contract.create(); equivalent.abilities[0].effects[0].amount = 3;
    const healing = contract.ability(); healing.condition = { kind: "overpay", amount: 2 }; healing.effects = [{ kind: "gainLife", amount: 1, ...contract.operations.gainLife }]; equivalent.abilities.push(healing);
    const a = fixture(equivalent, payment), b = fixture({ id: "aurelian-clawblade", version: 1, parameters: { armBonus: 3 } }, payment);
    const left = engine.applyCommand(a.game, a.command), right = engine.applyCommand(b.game, b.command);
    assert.equal(left.accepted, right.accepted); assert.equal(left.state.players[1].life, right.state.players[1].life); assert.equal(left.state.handAttacks[0].effectiveValue, right.state.handAttacks[0].effectiveValue);
  }
});

test("maximum bounded composition resolves every effect without recursion or truncation", () => {
  const effect = contract.create();
  effect.abilities = Array.from({ length: 4 }, () => ({ ...contract.ability(), effects: Array.from({ length: 4 }, () => ({ kind: "attackBonus", amount: 8, ...contract.operations.attackBonus })) }));
  const { game, command } = fixture(effect);
  const result = engine.applyCommand(game, command, { diagnostics: true });
  assert.equal(result.accepted, true); assert.equal(result.state.handAttacks[0].effectiveValue, 130);
  assert.equal(result.mechanicsTrace.filter(step => step.step === "effect").length, 16);
  game.players[1].turnData.attacksDeclaredThisTurn = 3;
  game.players[1].turnData.ruminNextWeaponArmBonus = 1;
  const stacked = engine.applyCommand(game, command, { diagnostics: true });
  assert.equal(stacked.state.handAttacks[0].effectiveValue, 134);
  assert.equal(stacked.mechanicsTrace.find(step => step.step === "effect").before, 6);
  // Preserve the legacy support ingress without an unbounded trigger loop:
  // three support + three old facedown-support slots, multi-arm attacker only.
  const many = fixture(effect), source = clone(many.game.lanes[0].support[1]);
  many.game.players[1].hand[0].effect = { id: "rumie-market-colossus", version: 1, parameters: {} };
  many.command.armWeaponCardIds = [];
  for (const [index, lane] of many.game.lanes.entries()) for (const zone of ["support", "facedown"]) {
    lane[zone][1] = { ...clone(source), id: `${zone}-${index}` }; many.command.armWeaponCardIds.push(lane[zone][1].id);
  }
  const maximum = engine.applyCommand(many.game, many.command, { diagnostics: true });
  assert.equal(maximum.accepted, true); assert.equal(maximum.mechanicsTrace.filter(step => step.step === "effect").length, 96);
});

test("unsupported interpreter definitions cannot load or roll back even with valid content digests", () => {
  const { createContentPublication } = require("../contentPublication");
  const { hash } = require("../authoredContent");
  const store = createContentPublication({ baseline, memory: true }), state = store.exportState();
  const snapshot = clone(baseline); snapshot.domains.cards.find(card => card.id === "rumin-coin-scale-spear").effect = { ...composed(), version: 2 };
  const digest = hash(snapshot), id = `gauntlet-content-${digest}`;
  state.releases[id] = { id, sha256: digest, label: "Future interpreter", snapshot };
  const withHistory = createContentPublication({ baseline, memory: true, initialState: state });
  assert.equal(withHistory.releaseSnapshot(id).compatible, false);
  assert.throws(() => withHistory.rollback({ expectedRevision: 0, releaseId: id }, "admin"), { status: 422 });
  state.activeReleaseId = id;
  assert.throws(() => createContentPublication({ baseline, memory: true, initialState: state }), /incompatible/);
});
