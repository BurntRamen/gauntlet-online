const test = require("node:test");
const assert = require("node:assert/strict");
const { applyCommand, createMatch, getLegalActions } = require("../../shared/duel-rules");

function incomingAttack(gameMode = "basic", laneIndex = null) {
  let state = createMatch({ seed: "single-block", gameMode, startingPriority: 1 }).state;
  const attacker = state.players[1].hand[0];
  attacker.value = 2;
  attacker.rank = "2";
  state.players[1].hand[1].value = 10;
  state.players[1].hand[1].rank = "10";
  state.players[2].hand.forEach((card) => { card.value = 2; card.rank = "2"; });
  state.players[2].hand[2].value = 10;
  state.players[2].hand[2].rank = "10";
  if (laneIndex != null) {
    state.lanes[laneIndex].facedown[1] = state.players[1].hand.shift();
    state.lanes[laneIndex].facedown[2] = state.players[2].hand.shift();
  }
  const result = applyCommand(state, {
    player: 1,
    type: laneIndex == null ? "declareHandAttack" : "declareLaneAttack",
    cardId: attacker.id,
    laneIndex,
    paymentCardIds: [state.players[1].hand.find((card) => card.value === 10).id]
  });
  assert.equal(result.accepted, true);
  return result.state;
}

function assertAtomicRejection(state, command, reason) {
  const before = structuredClone(state);
  const result = applyCommand(state, command);
  assert.equal(result.accepted, false);
  assert.match(result.rejectionReason, reason);
  assert.equal(result.state, state);
  assert.deepEqual(state, before, "hand, payment, counters, priority, revision and archives remain unchanged");
  assert.deepEqual(result.animationEvents, []);
}

for (const mode of ["basic", "factions"]) {
  test(`${mode}: exactly one hand blocker is required before payment or effects`, () => {
    const state = incomingAttack(mode);
    const ids = state.players[2].hand.map((card) => card.id);
    for (const blockerCardIds of [undefined, [], [ids[0], ids[1]], [ids[0], ids[0]], ids]) {
      assertAtomicRejection(state, {
        type: "declareHandBlock", player: 2, blockerCardIds,
        paymentCardIds: [ids[2]], useHeraBonus: true, accelerationBlockerCardIds: [ids[0]]
      }, /exactly one/i);
    }
  });

  test(`${mode}: one blocker keeps array-shaped commands and events`, () => {
    const state = incomingAttack(mode);
    const [blocker, , payment] = state.players[2].hand;
    const result = applyCommand(state, {
      type: "declareHandBlock", player: 2,
      blockerCardIds: [blocker.id], paymentCardIds: [payment.id]
    });
    assert.equal(result.accepted, true);
    assert.deepEqual(result.animationEvents.find((entry) => entry.type === "block.declared").cardIds, [blocker.id]);
    assert.equal(result.state.players[2].turnData.blocksDeclaredThisTurn, 1);
    assert.equal(result.state.players[2].hand.some((card) => card.id === blocker.id), false);
  });

  test(`${mode}: the blocker cannot be used as its own payment`, () => {
    const state = incomingAttack(mode);
    const blocker = state.players[2].hand[0];
    assertAtomicRejection(state, {
      type: "declareHandBlock", player: 2,
      blockerCardIds: [blocker.id], paymentCardIds: [blocker.id]
    }, /cannot|exclude|payment/i);
  });
}

for (const laneIndex of [null, 0]) {
  test(`an already blocked ${laneIndex == null ? "hand" : "lane"} attack rejects a second declaration`, () => {
    let state = incomingAttack("factions", laneIndex);
    const payment = state.players[2].hand.find((card) => card.value === 10);
    const result = applyCommand(state, {
      type: laneIndex == null ? "declareHandBlock" : "declareLaneBlock",
      player: 2, laneIndex,
      blockerCardIds: [laneIndex == null ? state.players[2].hand[0].id : state.lanes[laneIndex].facedown[2].id],
      paymentCardIds: [payment.id]
    });
    assert.equal(result.accepted, true);
    state = result.state;
    // Ability windows may return priority; that must not permit another blocker.
    state.priority = 2;
    state.priorityPassed[2] = false;
    assertAtomicRejection(state, {
      type: laneIndex == null ? "declareHandBlock" : "declareLaneBlock",
      player: 2, laneIndex,
      blockerCardIds: [state.players[2].hand[0].id], paymentCardIds: []
    }, /already.*block/i);
    assert.equal(getLegalActions(state, 2).some((action) => /declare.*Block|declineBlock/.test(action.type)), false);
  });
}

test("legal hand-block sources advertise a fixed single selection and separate multi-card payment", () => {
  const state = incomingAttack();
  const action = getLegalActions(state, 2).find((entry) => entry.type === "declareHandBlock");
  assert.equal(action.selection.sources[0].minimum, 1);
  assert.equal(action.selection.sources[0].maximum, 1);
  assert.ok(action.payment.maximumCards > 1);
  assert.deepEqual(action.payment.excludesSelections, ["blockerCardIds"]);
});

test("explicit lane blocker arrays cannot smuggle empty or multiple declarations", () => {
  const state = incomingAttack("factions", 0);
  const blocker = state.lanes[0].facedown[2];
  for (const blockerCardIds of [[], [blocker.id, state.players[2].hand[0].id]]) {
    assertAtomicRejection(state, {
      type: "declareLaneBlock", player: 2, laneIndex: 0, blockerCardIds, paymentCardIds: []
    }, /exactly one/i);
  }
});
