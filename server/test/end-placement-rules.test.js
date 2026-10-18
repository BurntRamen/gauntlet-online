"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { applyCommand, createMatch, getLegalActions } = require("../../shared/duel-rules");

const card = (id, value = 3) => ({ id, value, rank: String(value), suit: "hearts" });

function pass(game, player) {
  const result = applyCommand(game, { type: "passPriority", player });
  assert.equal(result.accepted, true, result.rejectionReason);
  return result;
}

function enterEndPlacement(game) {
  game.phase = "priority";
  game.priority = 1;
  game.startingPriorityThisTurn = 1;
  game.priorityPassed = { 1: false, 2: false };
  let result = pass(game, 1);
  result = pass(result.state, 2);
  return result;
}

test("end placement automatically advances a full turn when neither player can place", () => {
  const game = createMatch({ gameMode: "factions", seed: "empty-placement", startingPriority: 1 }).state;
  game.players[1].hand = [];
  game.players[2].hand = [];
  game.players[1].deck = [card("p1-draw")];
  game.players[2].deck = [card("p2-draw")];

  const result = enterEndPlacement(game);

  assert.equal(result.state.phase, "priority");
  assert.equal(result.state.turn, 2);
  assert.equal(result.state.priority, 2);
  assert.equal(result.animationEvents.filter((entry) => (
    entry.type === "lanePlacement.skipped" && entry.automatic
  )).length, 6);
});

test("end placement automatically skips an empty player and preserves the opponent opportunity", () => {
  const game = createMatch({ gameMode: "factions", seed: "one-empty-placement", startingPriority: 1 }).state;
  game.players[1].hand = [];
  game.players[2].hand = [card("placeable")];

  const result = enterEndPlacement(game);

  assert.equal(result.state.phase, "end");
  assert.equal(result.state.endPlacementLaneIndex, 0);
  assert.equal(result.state.endPlacementStep, 1);
  assert.equal(result.state.endPlaced[1][0], true);
  assert.deepEqual(
    getLegalActions(result.state, 2).map((entry) => entry.type),
    ["placeFacedown", "skipPlacement"]
  );
});

test("end placement automatically skips an occupied lane without consuming a hand card", () => {
  const game = createMatch({ gameMode: "factions", seed: "occupied-placement", startingPriority: 1 }).state;
  game.players[1].hand = [card("held")];
  game.players[2].hand = [card("opponent")];
  game.lanes[0].facedown[1] = card("already-placed");

  const result = enterEndPlacement(game);

  assert.equal(result.state.endPlacementStep, 1);
  assert.equal(result.state.players[1].hand.some((entry) => entry.id === "held"), true);
  assert.equal(result.animationEvents.some((entry) => (
    entry.type === "lanePlacement.skipped"
      && entry.player === 1
      && entry.laneIndex === 0
      && entry.reason === "no_legal_placement"
  )), true);
});
