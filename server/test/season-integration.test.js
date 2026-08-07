const test = require("node:test");
const assert = require("node:assert/strict");

const { server, __test } = require("../index");
const { buildMatchRecord } = require("../matchRecords");

test.after(() => server.close());

test("ranked rooms receive Season Zero identity while unranked rooms do not", () => {
  const unranked = __test.createRoom();
  const ranked = __test.createMatchedRoom(
    { socketId: "missing-a", accountId: "a", accountName: "Alpha", bestOf: 3 },
    { socketId: "missing-b", accountId: "b", accountName: "Beta", bestOf: 3 }
  );
  assert.equal(unranked.season, undefined);
  assert.equal(ranked.season.seasonId, "season-zero");
  assert.equal(ranked.season.format, "ranked-bo3");
  assert.ok(ranked.seriesId);
});

test("match record v2 carries season additively and an unranked record does not", () => {
  const ranked = __test.createMatchedRoom(
    { socketId: "missing-c", accountId: "c", accountName: "Gamma", bestOf: 1 },
    { socketId: "missing-d", accountId: "d", accountName: "Delta", bestOf: 1 }
  );
  ranked.lobby.gameMode = "basic";
  ranked.lobby.players[1].connected = true;
  ranked.lobby.players[2].connected = true;
  __test.createGameFromLobby(ranked, { seed: "season-record" });
  ranked.game.phase = "gameOver";
  ranked.game.winner = 1;
  const seasonalRecord = buildMatchRecord(ranked);

  const unranked = __test.createRoom();
  unranked.lobby.gameMode = "basic";
  unranked.lobby.players[1] = { ...unranked.lobby.players[1], connected: true, accountName: "One" };
  unranked.lobby.players[2] = { ...unranked.lobby.players[2], connected: true, accountName: "Two" };
  __test.createGameFromLobby(unranked, { seed: "unranked-record" });
  unranked.game.phase = "gameOver";
  unranked.game.winner = 2;
  const unrankedRecord = buildMatchRecord(unranked);

  assert.equal(seasonalRecord.recordVersion, 2);
  assert.equal(seasonalRecord.season.seasonId, "season-zero");
  assert.equal(unrankedRecord.season, null);
});

test("authoritative BO3 consequence context preserves game, series, season, and player identity", () => {
  const matchRecord = {
    recordVersion: 2,
    matchId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    seriesId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    ranked: true,
    mode: "factions",
    completedAt: "2026-08-07T13:00:00.000Z",
    winnerPlayerNum: 1,
    turnCount: 5,
    season: { seasonId: "season-zero", displayName: "Season Zero", format: "ranked-bo3" },
    series: { seriesId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", targetWins: 2, scoreAfter: { 1: 2, 2: 1 } },
    participants: [
      { playerNum: 1, accountId: "a", displayName: "Alpha", result: "win", finalLife: 5, faction: { id: "rumin", name: "Rumin" }, deck: {} },
      { playerNum: 2, accountId: "b", displayName: "Beta", result: "loss", finalLife: -1, faction: { id: "sheen", name: "Sheen" }, deck: {} }
    ]
  };
  const result = __test.buildAccountResultContext({ draftLeague: false }, matchRecord, 1);
  assert.equal(result.playerNum, 1);
  assert.equal(result.season.seasonId, "season-zero");
  assert.equal(result.series.scoreAfter[1], 2);
  assert.equal(result.matchId, matchRecord.matchId);
});

test("active seasonal match directory exposes only safe public metadata", () => {
  const room = __test.createRoom();
  room.ranked = true;
  room.season = { seasonId: "season-zero", seasonCode: "S0", displayName: "Season Zero", format: "ranked-bo1" };
  room.lifecycle.status = "active";
  room.lobby.players[1] = { accountName: "Alpha", factionId: "rumin", reconnectToken: "secret-reconnect-a" };
  room.lobby.players[2] = { accountName: "Beta", factionId: "sheen", reconnectToken: "secret-reconnect-b" };
  room.lobby.spectators = ["socket-secret"];
  room.game = {
    matchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    gameMode: "factions",
    phase: "priority",
    turn: 4,
    players: {
      1: { accountName: "Alpha", faction: { id: "rumin", name: "Rumin" }, hand: [{ id: "private-a" }], deck: [{ id: "deck-a" }] },
      2: { accountName: "Beta", faction: { id: "sheen", name: "Sheen" }, hand: [{ id: "private-b" }], deck: [{ id: "deck-b" }] }
    }
  };
  const listing = __test.listSpectatableSeasonMatches().find((entry) => entry.roomCode === room.roomCode);
  const serialized = JSON.stringify(listing);
  assert.equal(listing.players[0].displayName, "Alpha");
  assert.equal(listing.spectatorCount, 1);
  for (const privateValue of ["secret-reconnect-a", "secret-reconnect-b", "socket-secret", "private-a", "private-b", "deck-a", "deck-b"]) {
    assert.equal(serialized.includes(privateValue), false);
  }
  room.game.phase = "gameOver";
  assert.equal(__test.listSpectatableSeasonMatches().some((entry) => entry.roomCode === room.roomCode), false);
});

test("seasonal spectators receive no private hands, deck order, facedown identity, or actions", () => {
  const game = {
    matchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    gameMode: "factions",
    phase: "priority",
    turn: 1,
    priority: 1,
    players: {
      1: { id: 1, life: 42, hand: [{ id: "hand-a", value: 4 }], deck: [{ id: "deck-a" }], discard: [], lanes: [null, null, null] },
      2: { id: 2, life: 42, hand: [{ id: "hand-b", value: 7 }], deck: [{ id: "deck-b" }], discard: [], lanes: [null, null, null] }
    },
    lanes: [
      { facedown: { 1: { id: "lane-a", value: 5 }, 2: { id: "lane-b", value: 8 } }, attack: null, block: [] },
      { facedown: { 1: null, 2: null }, attack: null, block: [] },
      { facedown: { 1: null, 2: null }, attack: null, block: [] }
    ],
    handAttacks: [],
    priorityPassed: { 1: false, 2: false },
    eventLog: []
  };
  const view = __test.sanitizeGameForViewer(game, null, 1);
  assert.deepEqual(view.players[1].hand, []);
  assert.deepEqual(view.players[2].hand, []);
  assert.deepEqual(view.players[1].deck, []);
  assert.equal(view.lanes[0].facedown[1].hidden, true);
  assert.equal(view.lanes[0].facedown[2].hidden, true);
  assert.deepEqual(view.legalActions, []);
});
