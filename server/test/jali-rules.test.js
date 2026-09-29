const test = require("node:test");
const assert = require("node:assert/strict");
const { createMatch, applyCommand, getLegalActions, projectForPerspective } = require("../../shared/duel-rules");
const { getFactionById } = require("../gameContent");

const card = (id, value, suit = "♥") => ({ id, value, rank: String(value), suit });

function state() {
  const game = createMatch({ gameMode: "factions", seed: "jali-test", factions: { 1: "jali", 2: "rumin" } }).state;
  game.players[1].faction = getFactionById("jali", "basho");
  game.priority = 1;
  game.players[1].hand = [card("attack", 3), card("pay1", 2), card("pay2", 2, "♣"), card("reserve", 7, "♦")];
  return game;
}

function command(game, player, type, extra = {}) {
  const result = applyCommand(game, { type, player, ...extra });
  assert.equal(result.accepted, true, result.rejectionReason);
  return result.state;
}

test("a fully blocked Jali attacker creates a Revenant that Watane can spend", () => {
  let game = state();
  game = command(game, 1, "declareHandAttack", { cardId: "attack", paymentCardIds: ["pay1", "pay2"] });
  game.players[2].hand = [card("block", 4), card("payment", 6)];
  game = command(game, 2, "declareHandBlock", { blockerCardIds: ["block"], paymentCardIds: ["payment"] });
  game = command(game, 1, "passPriority");
  assert.equal(game.players[1].revenants, 1);
  assert.equal(game.players[1].turnData.jaliRevenantCreated, true);

  game.priority = 1;
  game = command(game, 1, "useFactionAbility", { abilityId: "jali:watane:reserve" });
  assert.equal(game.players[1].revenants, 0);
  assert.equal(game.players[1].hand.find((entry) => entry.id === "reserve").temporaryValueBonus, 2);
});

test("Basho reveals a complete three-lane formation and creates one Revenant", () => {
  let game = state();
  game.lanes.forEach((lane, index) => { lane.facedown[1] = card(`formation-${index}`, index + 3); });
  const before = projectForPerspective(game, 2);
  assert.equal(before.lanes[0].facedown[1].hidden, true);

  game = command(game, 1, "useFactionAbility", { abilityId: "jali:basho" });
  assert.equal(game.players[1].revenants, 1);
  assert.equal(game.lanes.every((lane) => lane.facedown[1].revealed), true);
  assert.equal(getLegalActions(game, 1).some((action) => action.abilityId === "jali:basho"), false);

  const after = projectForPerspective(game, 2);
  assert.equal(after.lanes[0].facedown[1].id, "formation-0");
  assert.equal(after.lanes[0].facedown[1].hidden, undefined);
});

test("Katana prepares each low-value card once after a Revenant is created", () => {
  let game = state();
  game.players[1].turnData.jaliRevenantCreated = true;
  assert.equal(getLegalActions(game, 1).some((action) => action.abilityId === "jali:katana:reserve"), true);
  game = command(game, 1, "useFactionAbility", { abilityId: "jali:katana:reserve" });
  const reserve = game.players[1].hand.find((entry) => entry.id === "reserve");
  assert.equal(reserve.temporaryValueBonus, 2);
  assert.equal(getLegalActions(game, 1).some((action) => action.abilityId === "jali:katana:reserve"), false);
});
