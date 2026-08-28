const test = require("node:test");
const assert = require("node:assert/strict");

const { server, __test } = require("../index");
const {
  RULES_VERSION,
  SCHEMA_VERSION,
  applyCommand: applySharedDuelCommand
} = require("../../shared/duel-rules");
const { COLLECTION_CARDS } = require("../gameContent");

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
  sanitizeGameForViewer,
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

function makeSharedCombatGame(roomCode, seed) {
  const roomState = {
    roomCode,
    lobby: {
      gameMode: "basic",
      players: {
        1: { accountName: "Attacker" },
        2: { accountName: "Defender" }
      }
    }
  };
  createGameFromLobby(roomState, { seed });
  const game = roomState.game;
  game.phase = "priority";
  game.priority = 1;
  game.priorityPassed = { 1: false, 2: false };
  game.handAttacks = [];
  for (const player of [1, 2]) {
    game.players[player].hand = [];
    game.players[player].discard = [];
  }
  game.lanes.forEach((lane) => {
    lane.attack = null;
    lane.block = [];
    lane.facedown[1] = null;
    lane.facedown[2] = null;
  });
  return game;
}

function assertEventMetadata(events, type, expected) {
  const actual = events.find((entry) => entry.type === type);
  assert.ok(actual, `Expected ${type} event`);
  assert.deepEqual(
    Object.fromEntries(Object.keys(expected).map((key) => [key, actual[key]])),
    expected
  );
  return actual;
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
    matchId: "11111111-1111-4111-8111-111111111111",
    completedAt: "2026-07-15T12:00:00.000Z",
    factionId: "rumin",
    factionName: "Rumin",
    life: 8,
    campaign: { factionId: "rumin", chapterId: "brothers-of-destiny", title: "Brothers of Destiny" }
  };

  applyProgressionForResult(stats, "win", context);
  applyProgressionForResult(stats, "win", {
    ...context,
    matchId: "22222222-2222-4222-8222-222222222222",
    completedAt: "2026-07-15T12:10:00.000Z"
  });

  assert.deepEqual(stats.progression.campaign.rumin, ["brothers-of-destiny"]);
  assert.equal(stats.collection.packCredits, 1);
  assert.equal(stats.collection.earnedPackCredits, 1);
  assert.equal(stats.progression.matchHistory.length, 2);
  assert.deepEqual(Object.keys(stats.progression.matchHistory[0]).sort(), [
    "completedAt",
    "deckVersionId",
    "matchId",
    "recordVersion"
  ]);
  assert.equal("result" in stats.progression.matchHistory[0], false);
  assert.equal("campaign" in stats.progression.matchHistory[0], false);
  assert.ok(stats.progression.achievements["first-campaign-clear"]);
});

test("unlocks Arena Circuit after ten completed matches", () => {
  const stats = { gamesPlayed: 10 };
  applyProgressionForResult(stats, "loss", {
    matchId: "33333333-3333-4333-8333-333333333333",
    completedAt: "2026-07-15T12:20:00.000Z"
  });

  assert.ok(stats.progression.cosmetics.unlockedCardBacks.includes("classic"));
  assert.ok(stats.progression.cosmetics.unlockedCardBacks.includes("arenaCircuit"));
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
  assert.equal(roomState.game.rulesVersion, RULES_VERSION);
  assert.equal(roomState.game.schemaVersion, SCHEMA_VERSION);
  assert.equal(roomState.game.revision, 0);
});

test("preserves constructed definition identity on unique match card instances", () => {
  const definitionId = "rumin-forum-ledger-runner";
  const roomState = {
    roomCode: "CARDID",
    lobby: {
      gameMode: "factions",
      players: {
        1: {
          factionId: "rumin",
          accountName: "Builder",
          savedConstructedDeck: {
            cards: [{
              id: definitionId,
              factionId: "rumin",
              name: "Forum Ledger Runner",
              type: "unit",
              rarity: "common",
              value: 2,
              suit: "spades",
              replacementSuit: "spades",
              text: "If this is your first attack this turn, you may treat one payment card as +1 value."
            }]
          }
        },
        2: { factionId: "sheen", accountName: "Opponent" }
      }
    }
  };

  createGameFromLobby(roomState);

  const constructed = [
    ...roomState.game.players[1].hand,
    ...roomState.game.players[1].deck
  ].find((card) => card.definitionId === definitionId);
  assert.ok(constructed);
  assert.notEqual(constructed.id, definitionId);
  assert.equal(
    constructed.id,
    `${roomState.game.matchId}-p1-replacement-0-${definitionId}`
  );
});

test("server-authored matches reconstruct every catalog card with stable private instance identity", () => {
  for (const card of COLLECTION_CARDS) {
    const makeRoom = () => ({
      roomCode: `CAT-${card.id}`,
      lobby: {
        gameMode: "factions",
        players: {
          1: {
            factionId: card.factionId,
            accountName: "Catalog Builder",
            savedConstructedDeck: {
              cards: [{
                ...card,
                suit: "spades",
                replacementSuit: "spades"
              }]
            }
          },
          2: { factionId: card.factionId, accountName: "Catalog Opponent" }
        }
      }
    });
    const options = {
      seed: `catalog-seed-${card.id}`,
      matchMetadata: { matchId: `catalog-match-${card.id}` }
    };
    const first = makeRoom();
    const replay = makeRoom();
    createGameFromLobby(first, options);
    createGameFromLobby(replay, options);

    const firstCards = [...first.game.players[1].hand, ...first.game.players[1].deck];
    const replayCards = [...replay.game.players[1].hand, ...replay.game.players[1].deck];
    const instance = firstCards.find((entry) => entry.definitionId === card.id);
    const replayInstance = replayCards.find((entry) => entry.definitionId === card.id);

    assert.ok(instance, `${card.id} was not inserted into the server-authored deck`);
    assert.equal(instance.id, `catalog-match-${card.id}-p1-replacement-0-${card.id}`);
    assert.equal(instance.definitionId, card.id);
    assert.equal(instance.factionId, card.factionId);
    assert.equal(instance.rulesText, card.text);
    assert.deepEqual(replayCards.map((entry) => entry.id), firstCards.map((entry) => entry.id));
    assert.deepEqual(replayInstance, instance);
  }
});

test("server-authored constructed state accepts the shared semantic choice contract", () => {
  const definitionId = "rumin-forum-ledger-runner";
  const roomState = {
    roomCode: "SHARED",
    lobby: {
      gameMode: "factions",
      players: {
        1: {
          factionId: "rumin",
          accountName: "Builder",
          savedConstructedDeck: {
            cards: [{
              id: definitionId,
              factionId: "rumin",
              name: "Forum Ledger Runner",
              type: "unit",
              rarity: "common",
              value: 2,
              suit: "spades",
              replacementSuit: "spades",
              text: "If this is your first attack this turn, you may treat one payment card as +1 value."
            }]
          }
        },
        2: { factionId: "sheen", accountName: "Opponent" }
      }
    }
  };
  createGameFromLobby(roomState);
  const game = roomState.game;
  const player = game.players[1];
  const zones = [player.hand, player.deck];
  const sourceZone = zones.find((zone) => zone.some((card) => card.definitionId === definitionId));
  const sourceIndex = sourceZone.findIndex((card) => card.definitionId === definitionId);
  const [runner] = sourceZone.splice(sourceIndex, 1);
  if (!player.hand.includes(runner)) player.hand.push(runner);
  const payment = player.hand.find((card) => card.id !== runner.id && getBaseCardValue(card) >= 2);
  game.phase = "priority";
  game.priority = 1;
  game.priorityPassed = { 1: false, 2: false };
  game.handAttacks = [];
  game.lanes.forEach((lane) => {
    lane.attack = null;
    lane.block = [];
  });

  const result = applySharedDuelCommand(game, {
    commandId: "constructed-shared-command",
    baseRevision: game.revision,
    actorPlayerId: 1,
    command: {
      type: "declareHandAttack",
      cardId: runner.id,
      paymentCardIds: [payment.id],
      forumLedgerPaymentCardId: payment.id
    }
  });

  assert.equal(result.accepted, true);
  assert.equal(result.state.handAttacks[0].card.definitionId, definitionId);
  assert.match(result.state.handAttacks[0].notes.join(" "), /Forum Ledger Runner payment \+1/);
  assert.equal(result.revision, 1);
});

test("shared duel events retain hand attack identity through unblocked damage resolution", () => {
  const game = makeSharedCombatGame("EVENT1", "hand-event-metadata");
  const attacker = { id: "hand-attacker", value: 5, rank: "5", suit: "spades" };
  const payment = { id: "hand-payment", value: 5, rank: "5", suit: "clubs" };
  game.players[1].hand = [attacker, payment];

  const declared = applySharedDuelCommand(game, {
    commandId: "hand-attack-command",
    baseRevision: game.revision,
    actorPlayerId: 1,
    command: {
      type: "declareHandAttack",
      cardId: attacker.id,
      paymentCardIds: [payment.id]
    }
  });

  assert.equal(declared.accepted, true);
  const attackId = declared.state.handAttacks[0].id;
  assertEventMetadata(declared.animationEvents, "attack.declared", {
    targetPlayer: 2,
    attackId,
    cardId: attacker.id,
    source: "hand",
    sourceLane: null,
    laneIndex: null
  });

  const resolved = applySharedDuelCommand(declared.state, {
    commandId: "hand-decline-command",
    baseRevision: declared.revision,
    actorPlayerId: 2,
    command: { type: "declineBlock" }
  });

  assert.equal(resolved.accepted, true);
  assertEventMetadata(resolved.animationEvents, "damage.calculated", {
    attacker: 1,
    targetPlayer: 2,
    attackId,
    cardId: attacker.id,
    source: "hand",
    laneIndex: null
  });
  assertEventMetadata(resolved.animationEvents, "damage.dealt", {
    attacker: 1,
    attackId,
    laneIndex: null
  });
  assertEventMetadata(resolved.animationEvents, "combat.resolutionCompleted", {
    player: 2,
    attacker: 1,
    attackId,
    laneIndex: null,
    damage: 5
  });
});

test("shared duel events retain lane attack identity through block resolution", () => {
  const game = makeSharedCombatGame("EVENT2", "lane-event-metadata");
  const attacker = { id: "lane-attacker", value: 4, rank: "4", suit: "spades" };
  const attackPayment = { id: "lane-attack-payment", value: 4, rank: "4", suit: "clubs" };
  const blocker = { id: "lane-blocker", value: 5, rank: "5", suit: "hearts" };
  const blockPayment = { id: "lane-block-payment", value: 5, rank: "5", suit: "diamonds" };
  game.players[1].hand = [attackPayment];
  game.players[2].hand = [blockPayment];
  game.lanes[1].facedown[1] = attacker;
  game.lanes[1].facedown[2] = blocker;

  const declared = applySharedDuelCommand(game, {
    commandId: "lane-attack-command",
    baseRevision: game.revision,
    actorPlayerId: 1,
    command: {
      type: "declareLaneAttack",
      laneIndex: 1,
      paymentCardIds: [attackPayment.id]
    }
  });

  assert.equal(declared.accepted, true);
  const attackId = declared.state.lanes[1].attack.id;
  assertEventMetadata(declared.animationEvents, "attack.declared", {
    targetPlayer: 2,
    attackId,
    source: "lane",
    sourceLane: 1,
    laneIndex: 1
  });

  const resolved = applySharedDuelCommand(declared.state, {
    commandId: "lane-block-command",
    baseRevision: declared.revision,
    actorPlayerId: 2,
    command: {
      type: "declareLaneBlock",
      laneIndex: 1,
      paymentCardIds: [blockPayment.id]
    }
  });

  assert.equal(resolved.accepted, true);
  assertEventMetadata(resolved.animationEvents, "block.declared", {
    targetPlayer: 1,
    attackId,
    laneIndex: 1
  });
  assertEventMetadata(resolved.animationEvents, "damage.calculated", {
    attacker: 1,
    targetPlayer: 2,
    attackId,
    cardId: attacker.id,
    source: "lane",
    laneIndex: 1
  });
  assertEventMetadata(resolved.animationEvents, "attack.fullyBlocked", {
    player: 2,
    attacker: 1,
    attackId,
    laneIndex: 1
  });
  assertEventMetadata(resolved.animationEvents, "combat.resolutionCompleted", {
    player: 2,
    attacker: 1,
    attackId,
    laneIndex: 1,
    damage: 0
  });
});

test("never includes hidden hand, deck, or lane-card fronts in sanitized snapshots", () => {
  const game = makeGame();
  game.players[1].hand = [{ id: "p1-hand", value: 4, rank: "4", suit: "clubs" }];
  game.players[2].hand = [{ id: "p2-hand", value: 9, rank: "9", suit: "hearts" }];
  game.players[1].deck = [{ id: "p1-deck", value: 7 }];
  game.players[2].deck = [{ id: "p2-deck", value: 8 }];
  game.lanes[0].facedown[1] = { id: "p1-lane", value: 5, rank: "5", suit: "spades" };
  game.lanes[0].facedown[2] = { id: "p2-lane", value: 10, rank: "10", suit: "diamonds" };
  game.lastEvents = [
    { id: "draw", sequence: 1, revision: 2, type: "cards.drawn", player: 2, cardIds: ["p2-hand"] },
    { id: "placed", sequence: 2, revision: 2, type: "card.placedFacedown", player: 2, cardId: "p2-lane", laneIndex: 0 },
    { id: "peek", sequence: 3, revision: 2, type: "card.peeked", player: 2, viewer: 2, card: { id: "p1-lane", rank: "5" } }
  ];

  const playerOne = sanitizeGameForViewer(game, 1, 0);
  assert.equal(playerOne.players[1].hand[0].id, "p1-hand");
  assert.deepEqual(playerOne.players[2].hand, []);
  assert.deepEqual(playerOne.players[1].deck, []);
  assert.deepEqual(playerOne.players[2].deck, []);
  assert.equal(playerOne.lanes[0].facedown[1].id, "p1-lane");
  assert.deepEqual(playerOne.lanes[0].facedown[2], {
    id: "hidden-lane-0-p2",
    hidden: true
  });
  assert.equal(playerOne.lastEvents[0].count, 1);
  assert.equal(playerOne.lastEvents[0].cardIds, undefined);
  assert.equal(playerOne.lastEvents[1].cardId, undefined);
  assert.equal(playerOne.lastEvents[2].type, "card.peeked");
  assert.equal(playerOne.lastEvents[2].card, undefined);
  assert.equal(playerOne.commandSchemaVersion > 0, true);
  assert.equal(playerOne.eventSchemaVersion > 0, true);

  const spectator = sanitizeGameForViewer(game, null, 1);
  assert.deepEqual(spectator.players[1].hand, []);
  assert.deepEqual(spectator.players[2].hand, []);
  assert.equal(spectator.lanes[0].facedown[1].hidden, true);
  assert.equal(spectator.lanes[0].facedown[2].hidden, true);
  assert.equal(spectator.lastEvents.some((event) => event.card || event.cardId || event.cardIds), false);
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
