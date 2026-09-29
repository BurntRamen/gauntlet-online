const test = require("node:test");
const assert = require("node:assert/strict");
const { createMatch, applyCommand, getLegalActions } = require("../../shared/duel-rules");
const { getFactionById } = require("../gameContent");

const card = (id, value, suit = "♥") => ({ id, value, rank: String(value), suit });

function command(game, player, type, extra = {}) {
  const result = applyCommand(game, { type, player, ...extra });
  assert.equal(result.accepted, true, result.rejectionReason);
  return result.state;
}

function factionState(first, second = "rumin") {
  const game = createMatch({ gameMode: "factions", seed: `${first}-${second}-test`, startingPriority: 1, factions: { 1: first, 2: second } }).state;
  game.players[1].faction = getFactionById(first);
  game.players[2].faction = getFactionById(second);
  game.priority = 1;
  return game;
}

test("Epicura creates one blockable 4-value Minotaur attacker per turn", () => {
  let game = factionState("gracus");
  assert.equal(getLegalActions(game, 1).some((action) => action.abilityId === "gracus:epicura:attack"), true);
  game = command(game, 1, "useFactionAbility", { abilityId: "gracus:epicura:attack" });
  assert.equal(game.handAttacks[0].card.name, "Epicura's Minotaur");
  assert.equal(game.handAttacks[0].effectiveValue, 4);
  assert.equal(game.priority, 2);
  assert.equal(getLegalActions(game, 2).some((action) => action.type === "declareHandBlock"), true);
  game.priority = 1;
  assert.equal(getLegalActions(game, 1).some((action) => action.abilityId?.startsWith("gracus:epicura")), false);
});

test("Epicura can create a Minotaur blocker against an unblocked attack", () => {
  let game = factionState("rumin", "gracus");
  game.players[1].hand = [card("attack", 3), card("pay", 4)];
  game = command(game, 1, "declareHandAttack", { cardId: "attack", paymentCardIds: ["pay"] });
  assert.equal(getLegalActions(game, 2).some((action) => action.abilityId === "gracus:epicura:block"), true);
  game = command(game, 2, "useFactionAbility", { abilityId: "gracus:epicura:block" });
  assert.equal(game.handAttacks[0].block[0].effectiveValue, 4);
  assert.equal(game.handAttacks[0].block[0].card.token, true);
});

test("Athun rewards an eight-point upward jump and Platus taxes attacks", () => {
  let game = factionState("gracus");
  game.players[1].turnData.previousPlayedValue = 2;
  game.players[1].hand = [card("giant", 10), card("pay", 10)];
  game = command(game, 1, "declareHandAttack", { cardId: "giant", paymentCardIds: ["pay"] });
  assert.equal(game.handAttacks[0].effectiveValue, 12);
  assert.equal(game.handAttacks[0].notes.includes("Athun +2"), true);

  game = factionState("rumin", "gracus");
  game.players[1].hand = [card("attack", 4), card("pay", 4)];
  const action = getLegalActions(game, 1).find((entry) => entry.cardId === "attack");
  assert.equal(action.requiredPayment, 5);
  assert.equal(applyCommand(game, { type: "declareHandAttack", player: 1, cardId: "attack", paymentCardIds: ["pay"] }).accepted, false);
});

test("Indela odd omens reduce costs and Kashi strengthens even cards", () => {
  let game = factionState("indela");
  game.players[1].turnData.indelaRevealedValues = [5, 5];
  game.players[1].turnData.indelaOwnReduction = 2;
  game.players[1].turnData.indelaOpponentTax = 0;
  game.players[1].hand = [card("even", 6), card("pay", 4)];
  const action = getLegalActions(game, 1).find((entry) => entry.cardId === "even");
  assert.equal(action.requiredPayment, 4);
  game = command(game, 1, "declareHandAttack", { cardId: "even", paymentCardIds: ["pay"] });
  assert.equal(game.handAttacks[0].effectiveValue, 7);
  assert.equal(game.handAttacks[0].notes.includes("Kashi +1"), true);
});

test("Indela even omens tax the opposing player", () => {
  const game = factionState("rumin", "indela");
  game.players[2].turnData.indelaRevealedValues = [8, 8];
  game.players[2].turnData.indelaOpponentTax = 2;
  game.players[1].hand = [card("attack", 5), card("pay", 5)];
  const action = getLegalActions(game, 1).find((entry) => entry.cardId === "attack");
  assert.equal(action.requiredPayment, 7);
});
