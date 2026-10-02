"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { applyCommand, createMatch } = require("../../shared/duel-rules");
const { INDELA_COLLECTION_CARDS, getFactionById, getGameplayCardById } = require("../gameContent");

function playingCard(id, value, suit = "hearts", factionId = "indela") {
  return { id, value, rank: String(value), suit, factionId };
}

function factionCard(definitionId, instanceId = definitionId) {
  return { ...getGameplayCardById(definitionId), id: instanceId, definitionId, gameplayCardId: definitionId };
}

function indelaMatch() {
  const game = createMatch({ gameMode: "factions", seed: "indela-constructed", startingPriority: 1, factions: { 1: "indela", 2: "rumin" } }).state;
  game.players[1].faction = getFactionById("indela");
  game.players[2].faction = getFactionById("rumin");
  game.priority = 1;
  return game;
}

test("Indela has a complete fixed-slot Gauntlet catalog", () => {
  assert.equal(INDELA_COLLECTION_CARDS.length, 18);
  assert.equal(INDELA_COLLECTION_CARDS.filter((card) => card.type === "servitor").length, 10);
  assert.equal(INDELA_COLLECTION_CARDS.filter((card) => card.type === "arcana").length, 8);
  assert.equal(new Set(INDELA_COLLECTION_CARDS.map((card) => `${card.value}:${card.suit}`)).size, 18);
});

test("odd omens empower fire Servitors and Arcane Amplification strengthens Kashi", () => {
  const game = indelaMatch();
  game.players[1].turnData.indelaRevealedValues = [5];
  game.players[1].turnData.indelaOwnReduction = 0;
  game.lanes[0].support[1] = factionCard("indela-arcane-amplification", "amplification");
  game.players[1].hand = [factionCard("indela-student-of-flame", "student"), playingCard("payment", 2)];

  const result = applyCommand(game, { type: "declareHandAttack", player: 1, cardId: "student", paymentCardIds: ["payment"] });
  assert.equal(result.accepted, true, result.rejectionReason);
  assert.equal(result.state.handAttacks[0].effectiveValue, 5);
  assert.ok(result.state.handAttacks[0].notes.includes("Student of Flame +1"));
  assert.ok(result.state.handAttacks[0].notes.includes("Kashi +1"));
  assert.ok(result.state.handAttacks[0].notes.includes("Arcane Amplification +1"));
});

test("Indela elemental channelers increase payments only during their matching omen", () => {
  const game = indelaMatch();
  game.players[1].turnData.indelaRevealedValues = [5];
  game.players[1].turnData.indelaOwnReduction = 0;
  game.players[1].hand = [playingCard("attacker", 7), factionCard("indela-mystic-of-embers", "mystic")];

  const result = applyCommand(game, { type: "declareHandAttack", player: 1, cardId: "attacker", paymentCardIds: ["mystic"] });
  assert.equal(result.accepted, true, result.rejectionReason);
  assert.equal(result.state.handAttacks[0].payment.total, 7);
  assert.ok(result.state.handAttacks[0].notes.includes("Mystic of Embers payment +1"));
});

test("even omens empower Indela ice blocks and Arcana prevention", () => {
  let game = indelaMatch();
  game.players[1].faction = getFactionById("rumin");
  game.players[2].faction = getFactionById("indela");
  game.players[2].turnData.indelaRevealedValues = [8];
  game.players[2].turnData.indelaOpponentTax = 0;
  game.lanes[0].support[2] = factionCard("indela-frost-nova", "nova");
  game.lanes[1].support[2] = factionCard("indela-frostbite-gale", "gale");
  game.players[1].hand = [playingCard("attacker", 4, "clubs", "rumin"), playingCard("attack-payment", 4, "spades", "rumin")];
  game.players[2].hand = [factionCard("indela-frost-apprentice", "apprentice"), playingCard("block-payment", 2)];

  let result = applyCommand(game, { type: "declareHandAttack", player: 1, cardId: "attacker", paymentCardIds: ["attack-payment"] });
  assert.equal(result.accepted, true, result.rejectionReason);
  game = result.state;
  result = applyCommand(game, { type: "declareHandBlock", player: 2, blockerCardIds: ["apprentice"], paymentCardIds: ["block-payment"] });
  assert.equal(result.accepted, true, result.rejectionReason);
  const block = result.state.handAttacks[0].block[0];
  assert.equal(block.effectiveValue, 4);
  assert.equal(block.preventDamage, 1);
  assert.ok(block.notes.includes("Frost Apprentice +1"));
  assert.ok(block.notes.includes("Frost Nova +1"));
  assert.ok(block.notes.includes("Frostbite Gale prevents 1"));
});
