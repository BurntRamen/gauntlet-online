const test = require("node:test"), assert = require("node:assert/strict");
const rules = require("../../shared/duel-rules"), contract = require("../../shared/duel-rules/ruleModifierContract");
const captured = { revision: "a".repeat(64), definition: { id: "modifier-11111111-1111-4111-8111-111111111111", name: "Short hand", status: "active", interpreter: 1, playerLife: 25, opponentLife: 61, handSize: 5 } };
test("modifier contract rejects unsupported behavior, versions and scopes without mutating a game", () => {
  for (const patch of [{ handSize: 2 }, { playerLife: 101 }, { opponentLife: 0 }, { interpreter: 2 }, { script: "draw()" }]) assert.ok(contract.errors({ ...captured.definition, ...patch }).length);
  const game = rules.createMatch({ seed: "modifier" }).state;
  for (const player of Object.values(game.players)) player.deck.unshift(...player.hand.splice(0));
  const before = structuredClone(game);
  for (const scope of ["ranked", "para", "freeForAll", "factions"]) { assert.throws(() => contract.apply(game, captured, scope)); assert.deepEqual(game, before); }
  for (const invalid of [{ ...captured, revision: "invalid" }, { ...captured, definition: { ...captured.definition, interpreter: 2 } }]) { assert.throws(() => contract.apply(game, invalid, "campaign")); assert.deepEqual(game, before); }
  contract.apply(game, captured, "campaign"); const applied = structuredClone(game);
  assert.throws(() => contract.apply(game, captured, "campaign")); assert.deepEqual(game, applied);
  assert.equal(game.config.startingLife, 42, "canonical rules remain identifiable independently");
});
test("serialized match captures the original modifier and continues normal deterministic refill after recovery", () => {
  const input = structuredClone(captured);
  const initial = rules.createMatch({ seed: "modifier-recovery", ruleModifier: input, startingPriority: 1 }).state;
  input.definition.handSize = 12;
  assert.equal(initial.ruleModifier.definition.handSize, 5);
  const turn = state => {
    state.players[1].discard.push(state.players[1].hand.pop());
    const act = command => { const result = rules.applyCommand(state, command); assert.equal(result.accepted, true, result.rejectionReason); state = result.state; };
    act({ type: "passPriority", player: state.priority }); act({ type: "passPriority", player: state.priority });
    while (state.phase === "end") act({ type: "skipPlacement", player: rules.currentPlacementPlayer(state), laneIndex: state.endPlacementLaneIndex });
    return state;
  };
  const original = turn(structuredClone(initial)), restored = turn(JSON.parse(JSON.stringify(initial)));
  assert.deepEqual(restored, original); assert.equal(restored.players[1].hand.length, 5); assert.equal(restored.players[1].life, 25); assert.equal(restored.players[2].life, 61);
});
