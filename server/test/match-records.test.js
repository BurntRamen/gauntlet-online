const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-matches-"));
const matchDataFile = path.join(tempDir, "matches.json");
process.env.MATCH_DATA_FILE = matchDataFile;

const {
  buildMatchRecord,
  captureAuditEvent,
  createLocalMatchStore,
  createMatchMetadata,
  publicMatchSummary,
  recordCombatResolution
} = require("../matchRecords");
const { server, __test } = require("../index");

test.after(() => {
  server.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function makeRoom(options = {}) {
  const matchMetadata = createMatchMetadata({
    matchId: options.matchId || crypto.randomUUID(),
    seriesId: options.seriesId || null,
    gameNumber: options.gameNumber || 1,
    startedAt: "2026-07-15T12:00:00.000Z"
  });
  const game = {
    gameMode: options.gameMode || "factions",
    phase: "gameOver",
    turn: options.turn || 7,
    priority: 2,
    winner: options.draw ? null : 1,
    message: options.draw ? "Players agreed to an intentional draw." : "Player 1 wins the game.",
    players: {
      1: {
        accountName: "Alpha",
        faction: { id: "rumin", name: "Rumin" },
        life: options.draw ? 4 : 9,
        hand: [{ name: "Private Alpha Hand", value: 14 }],
        deck: [{ name: "Private Alpha Deck", value: 2 }],
        discard: []
      },
      2: {
        accountName: options.campaign ? "The Brass Regent" : "Beta",
        faction: { id: "sheen", name: "Sheen" },
        life: options.draw ? 4 : -2,
        hand: [{ name: "Private Beta Hand", value: 13 }],
        deck: [{ name: "Private Beta Deck", value: 3 }],
        discard: []
      }
    },
    lanes: [],
    handAttacks: [],
    eventLog: []
  };
  if (options.campaign) {
    game.campaign = {
      factionId: "rumin",
      chapterId: "first-march",
      title: "The First March",
      opponentName: "The Brass Regent"
    };
  }
  if (options.freeForAll) {
    game.gameMode = "freeForAll";
    game.players[3] = {
      accountName: "Gamma",
      faction: { id: "bizi", name: "Bizi" },
      life: 0,
      eliminated: true,
      hand: [],
      deck: [],
      discard: []
    };
  }
  if (options.draftLeague) game.draftLeague = true;
  captureAuditEvent(game, "2026-07-15T12:30:00.000Z");
  recordCombatResolution(game, {
    attackerPlayerNum: 1,
    defenderPlayerNum: 2,
    attackValue: 12,
    blockValue: 5,
    preventionValue: 2,
    damage: 5
  });

  const room = {
    roomCode: "SECRET",
    ranked: !!options.ranked,
    matchMetadata,
    seriesId: options.seriesId || null,
    lobby: {
      players: {
        1: {
          accountId: "11111111-1111-4111-8111-111111111111",
          accountName: "Alpha",
          reconnectToken: "private-reconnect-token",
          socket: "private-socket",
          savedConstructedDeck: {
            name: "Alpha Guard",
            factionId: "rumin",
            savedAt: "2026-07-14T12:00:00.000Z",
            replacementCount: 1,
            cards: [{ id: "rumin-one", value: 8, suit: "hearts", privateNote: "hidden" }]
          }
        },
        2: options.campaign ? {
          accountName: "The Brass Regent",
          isAI: true,
          reconnectToken: "private-ai-token"
        } : {
          accountId: "22222222-2222-4222-8222-222222222222",
          accountName: "Beta",
          reconnectToken: "private-reconnect-token-two",
          passwordHash: "private-password-hash"
        }
      }
    },
    game
  };
  if (options.seriesId) {
    room.bestOf3Series = {
      bestOf: 3,
      targetWins: 2,
      gameNumber: options.gameNumber || 1,
      scores: { 1: 1, 2: 0 }
    };
  }
  if (options.draftLeague) {
    room.draftLeague = true;
    room.draftLeagueMatch = { draftType: "bot" };
  }
  if (options.freeForAll) {
    room.lobby.players[3] = { accountName: "Gamma", isGuest: true, reconnectToken: "private-gamma-token" };
  }
  return room;
}

test("builds a server-authored public record with combat and audit data", () => {
  const room = makeRoom({ ranked: true });
  const record = buildMatchRecord(room, {
    completionReason: "life_total",
    completedAt: "2026-07-15T12:30:00.000Z"
  });

  assert.equal(record.matchId, room.matchMetadata.matchId);
  assert.equal(record.ranked, true);
  assert.equal(record.winnerPlayerNum, 1);
  assert.equal(record.participants[0].displayName, "Alpha");
  assert.equal(record.participants[0].deck.source, "constructed");
  assert.match(record.participants[0].deck.deckVersionId, /^legacy-[0-9a-f]{24}$/);
  assert.equal(record.combatStats.totalDamageDealt, 5);
  assert.equal(record.combatStats.totalDamagePrevented, 7);
  assert.equal(record.auditEvents[0].eventType, "game_completed");
  assert.match(record.auditEvents[0].stateChecksum, /^[0-9a-f]{64}$/);
});

test("captures draw, concession, campaign, draft league, and best-of-three metadata", () => {
  const draw = buildMatchRecord(makeRoom({ draw: true }), { completionReason: "intentional_draw" });
  assert.equal(draw.winnerPlayerNum, null);
  assert.ok(draw.participants.every((participant) => participant.result === "draw"));

  const concession = buildMatchRecord(makeRoom(), { completionReason: "concession" });
  assert.equal(concession.completionReason, "concession");

  const campaign = buildMatchRecord(makeRoom({ campaign: true }), { completionReason: "life_total" });
  assert.equal(campaign.mode, "campaign");
  assert.equal(campaign.participants[1].identityType, "ai");
  assert.equal(campaign.campaign.chapterId, "first-march");

  const draft = buildMatchRecord(makeRoom({ draftLeague: true, ranked: true }), { completionReason: "life_total" });
  assert.equal(draft.mode, "draftLeague");
  assert.deepEqual(draft.draft, { league: true, draftType: "bot" });

  const seriesId = crypto.randomUUID();
  const series = buildMatchRecord(makeRoom({ seriesId, gameNumber: 2 }), { completionReason: "life_total" });
  assert.equal(series.seriesId, seriesId);
  assert.equal(series.series.gameNumber, 2);
  assert.deepEqual(series.series.scoreAfter, { 1: 2, 2: 0 });

  const freeForAll = buildMatchRecord(makeRoom({ freeForAll: true }), { completionReason: "concession" });
  assert.equal(freeForAll.mode, "freeForAll");
  assert.equal(freeForAll.participants.length, 3);
});

test("does not persist private hand, deck order, reconnect, socket, or credential data", () => {
  const serialized = JSON.stringify(buildMatchRecord(makeRoom(), { completionReason: "life_total" }));
  for (const privateValue of [
    "Private Alpha Hand",
    "Private Alpha Deck",
    "Private Beta Hand",
    "Private Beta Deck",
    "private-reconnect-token",
    "private-socket",
    "private-password-hash",
    "private-gamma-token",
    "privateNote"
  ]) {
    assert.equal(serialized.includes(privateValue), false, privateValue);
  }
});

test("upserts duplicate completion records and lists account matches newest first", () => {
  const store = createLocalMatchStore(matchDataFile);
  const room = makeRoom();
  const first = buildMatchRecord(room, { completionReason: "life_total", completedAt: "2026-07-15T12:30:00.000Z" });
  const corrected = { ...first, completionReason: "concession" };
  store.upsert(first);
  store.upsert(corrected);

  assert.equal(store.load().matches.length, 1);
  assert.equal(store.findById(first.matchId).completionReason, "concession");
  assert.equal(store.listByAccount(first.participants[0].accountId).length, 1);
  assert.equal(publicMatchSummary(corrected).auditEvents, undefined);
  assert.equal(publicMatchSummary(corrected).auditEventCount, 1);
});

test("records a completed game once through the live completion path", async () => {
  const store = createLocalMatchStore(matchDataFile);
  const beforeCount = store.load().matches.length;
  const room = makeRoom();
  room.lobby.players[2].isAI = true;

  await __test.recordFinalGameStats(room, { completionReason: "concession" });
  await __test.recordFinalGameStats(room, { completionReason: "concession" });

  const persisted = store.findById(room.matchMetadata.matchId);
  assert.equal(store.load().matches.length, beforeCount + 1);
  assert.equal(persisted.completionReason, "concession");
  assert.equal(room.game.statsRecorded, true);
});

test("serves a privacy-filtered public match record without leaking server-only live state", async () => {
  const store = createLocalMatchStore(matchDataFile);
  const room = makeRoom();
  const record = buildMatchRecord(room, { completionReason: "life_total" });
  store.upsert(record);

  const visibleGame = __test.sanitizeGameForViewer(room.game, 1, 0);
  assert.equal(visibleGame.serverAuditEvents, undefined);
  assert.equal(visibleGame.serverCombatStats, undefined);
  assert.equal(visibleGame.players[2].hand.length, 0);
  assert.equal(visibleGame.players[1].deck.length, 0);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/matches/${record.matchId}`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.match.matchId, record.matchId);
  assert.equal(JSON.stringify(body).includes("private-reconnect-token"), false);
});
