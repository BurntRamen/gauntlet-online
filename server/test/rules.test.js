const test = require("node:test");
const assert = require("node:assert/strict");

const { server, __test } = require("../index");

const {
  applyBlockBonuses,
  applyGameOverState,
  applyProgressionForResult,
  calculateAttackBonuses,
  createFreeForAllGameFromLobby,
  createGameFromLobby,
  createTurnData,
  getBaseCardValue,
  getPaymentTotal,
  resolveDamage,
  startEndPhase,
  advanceEndPlacement,
  validateConstructedDeckPayload,
  validateHandIndexes
} = __test;

test.after(() => server.close());

function makePlayer(factionId = "basic") {
  return {
    accountName: null,
    faction: { id: factionId, name: factionId },
    life: 42,
    hand: [],
    deck: [],
    discard: [],
    connected: true,
    turnData: createTurnData(),
    accelerationCounters: 0
  };
}

function makeGame(faction1 = "basic", faction2 = "basic") {
  return {
    gameMode: "basic",
    phase: "priority",
    turn: 1,
    priority: 1,
    startingPriorityThisTurn: 1,
    priorityPassed: { 1: false, 2: false },
    players: { 1: makePlayer(faction1), 2: makePlayer(faction2) },
    lanes: Array.from({ length: 3 }, () => ({ facedown: { 1: null, 2: null }, attack: null, block: [] })),
    handAttacks: [],
    eventLog: [],
    endPlaced: { 1: [false, false, false], 2: [false, false, false] },
    winner: null,
    message: ""
  };
}

test("normalizes numbered and face-card values", () => {
  assert.equal(getBaseCardValue({ value: 7 }), 7);
  assert.equal(getBaseCardValue({ value: "J" }), 11);
  assert.equal(getBaseCardValue({ value: "Q" }), 12);
  assert.equal(getBaseCardValue({ value: "K" }), 13);
  assert.equal(getBaseCardValue({ value: "A" }), 14);
  assert.equal(getBaseCardValue(null), 0);
});

test("rejects invalid, duplicate, and selected payment indexes", () => {
  const player = makePlayer();
  player.hand = [{ value: 2 }, { value: 3 }, { value: 4 }];

  assert.deepEqual(validateHandIndexes(player, [0, 2]), { indexes: [0, 2] });
  assert.equal(validateHandIndexes(player, [0, 0]).error, "Duplicate payment card");
  assert.equal(validateHandIndexes(player, [3]).error, "Invalid payment card");
  assert.equal(validateHandIndexes(player, [1], [1]).error, "Selected card cannot also be payment");
});

test("totals payment and applies Hera only to a previously played suit", () => {
  const player = makePlayer("bizi");
  player.hand = [{ value: 4, suit: "hearts" }, { value: 3, suit: "clubs" }];
  player.turnData.suitsPlayedThisTurn = ["hearts"];

  const payment = getPaymentTotal(player, [0, 1], true, { action: "attack", card: { factionId: "bizi" } });
  assert.equal(payment.total, 9);
  assert.equal(payment.heraUsedNow, true);

  player.turnData.suitsPlayedThisTurn = ["spades"];
  assert.equal(getPaymentTotal(player, [0, 1], true, {}).total, 7);
});

test("applies the fourth-attack and shared-suit Rumin bonuses", () => {
  const game = makeGame("rumin");
  const player = game.players[1];
  player.turnData.attacksDeclaredThisTurn = 3;
  player.turnData.previousAttackSuit = "hearts";

  const bonus = calculateAttackBonuses(game, 1, { value: 8, suit: "hearts" }, "hand");
  assert.equal(bonus.value, 4);
  assert.match(bonus.notes.join(" "), /Kaiser fourth attack \+3/);
  assert.match(bonus.notes.join(" "), /Rumie shared suit \+1/);
});

test("gives Sheen's third block a total +2 faction bonus", () => {
  const game = makeGame("sheen");
  game.players[1].turnData.blocksDeclaredThisTurn = 2;

  const block = applyBlockBonuses(game, 1, { value: 5, suit: "clubs" });
  assert.equal(block.effectiveValue, 7);
  assert.match(block.notes.join(" "), /Emperor Nu third block \+2/);
});

test("resolves blocked damage, prevention, discards, and combat cleanup", () => {
  const game = makeGame();
  const roomState = { damageConfirmed: { 1: true, 2: true } };
  game.handAttacks = [{
    player: 1,
    source: "hand",
    card: { value: 10, name: "Ten" },
    effectiveValue: 10,
    notes: [],
    block: [{ player: 2, card: { value: 4, name: "Four" }, effectiveValue: 4, preventDamage: 2, notes: [] }]
  }];

  resolveDamage(game, roomState);

  assert.equal(game.players[2].life, 38);
  assert.equal(game.players[2].turnData.damageTakenThisTurn, 4);
  assert.equal(game.players[1].discard.length, 1);
  assert.equal(game.players[2].discard.length, 1);
  assert.equal(game.handAttacks.length, 0);
  assert.deepEqual(roomState.damageConfirmed, { 1: false, 2: false });
});

test("checks life totals only when asked and awards the higher total", () => {
  const game = makeGame();
  assert.equal(applyGameOverState(game), false);

  game.players[1].life = 0;
  game.players[2].life = -2;
  assert.equal(applyGameOverState(game), true);
  assert.equal(game.winner, 1);
  assert.equal(game.phase, "gameOver");

  const draw = makeGame();
  draw.players[1].life = -1;
  draw.players[2].life = -1;
  assert.equal(applyGameOverState(draw), true);
  assert.equal(draw.winner, null);
});

test("completes all lane placements, refills hands, and rotates priority", async () => {
  const game = makeGame();
  game.players[1].hand = [{ value: 2 }];
  game.players[1].deck = Array.from({ length: 10 }, (_, index) => ({ value: index + 2 }));
  game.players[2].hand = [];
  game.players[2].deck = Array.from({ length: 10 }, (_, index) => ({ value: index + 2 }));
  const roomState = { game };

  startEndPhase(game);
  for (let step = 0; step < 6; step += 1) await advanceEndPlacement(roomState);

  assert.equal(game.phase, "priority");
  assert.equal(game.turn, 2);
  assert.equal(game.priority, 2);
  assert.equal(game.players[1].hand.length, 8);
  assert.equal(game.players[2].hand.length, 8);
});

test("validates constructed replacements against ownership and card slots", () => {
  const stats = { collection: { cards: { "rumin-gilded-scale-legionary": 2 } } };
  const deck = validateConstructedDeckPayload(stats, {
    name: "Gold Guard",
    factionId: "rumin",
    cardQuantities: { "rumin-gilded-scale-legionary": 2 },
    cardSuitChoices: { "rumin-gilded-scale-legionary": ["spades", "hearts"] }
  });

  assert.equal(deck.name, "Gold Guard");
  assert.equal(deck.cardCount, 52);
  assert.equal(deck.replacementCount, 2);
  assert.throws(() => validateConstructedDeckPayload(stats, {
    factionId: "rumin",
    cardQuantities: { "rumin-gilded-scale-legionary": 2 },
    cardSuitChoices: { "rumin-gilded-scale-legionary": ["spades", "spades"] }
  }), /Only one card can replace/);
});

test("awards a campaign pack only on the first clear", () => {
  const stats = {};
  const context = {
    completedAt: "2026-07-15T12:00:00.000Z",
    factionId: "rumin",
    factionName: "Rumin",
    life: 8,
    campaign: { factionId: "rumin", chapterId: "brothers-of-destiny", title: "Brothers of Destiny" }
  };

  applyProgressionForResult(stats, "win", context);
  applyProgressionForResult(stats, "win", context);

  assert.deepEqual(stats.progression.campaign.rumin, ["brothers-of-destiny"]);
  assert.equal(stats.collection.packCredits, 1);
  assert.equal(stats.collection.earnedPackCredits, 1);
  assert.equal(stats.progression.matchHistory.length, 2);
  assert.ok(stats.progression.achievements["first-campaign-clear"]);
});

test("creates a standard two-player game with 52-card decks", () => {
  const roomState = {
    roomCode: "TEST01",
    lobby: {
      gameMode: "factions",
      players: {
        1: { factionId: "rumin", accountName: "Alpha" },
        2: { factionId: "sheen", accountName: "Beta" }
      }
    }
  };

  createGameFromLobby(roomState);

  assert.equal(roomState.game.players[1].hand.length, 8);
  assert.equal(roomState.game.players[1].deck.length, 44);
  assert.equal(roomState.game.players[2].hand.length, 8);
  assert.equal(roomState.game.players[2].deck.length, 44);
  assert.ok([1, 2].includes(roomState.game.priority));
});

test("creates and completes a free-for-all game around active seats", () => {
  const roomState = {
    roomCode: "FFA001",
    lobby: {
      gameMode: "freeForAll",
      players: {
        1: { connected: true, factionId: "rumin", accountName: "One" },
        2: { connected: true, factionId: "sheen", accountName: "Two" },
        3: { connected: false, factionId: null },
        4: { connected: false, factionId: null }
      }
    }
  };

  createFreeForAllGameFromLobby(roomState);
  assert.deepEqual(Object.keys(roomState.game.players), ["1", "2"]);
  roomState.game.players[2].eliminated = true;
  assert.equal(applyGameOverState(roomState.game), true);
  assert.equal(roomState.game.winner, 1);
});
