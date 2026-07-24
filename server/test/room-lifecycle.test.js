const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-room-life-"));
process.env.MATCH_DATA_FILE = path.join(tempDir, "matches.json");
process.env.ACCOUNT_DATA_FILE = path.join(tempDir, "accounts.json");
process.env.FACTION_STATS_DATA_FILE = path.join(tempDir, "faction-stats.json");
process.env.ROOM_STATE_DATA_FILE = path.join(tempDir, "rooms.json");

const {
  createRoomLifecycle,
  getRoomLifecycleAction,
  getRoomLifecycleConfig,
  markRoomCompleted,
  syncRoomPresence,
  touchRoom
} = require("../roomLifecycle");
const { server, __test } = require("../index");

const TEST_CONFIG = {
  reconnectGraceMs: 1000,
  lobbyTtlMs: 5000,
  completedTtlMs: 2000,
  sweepIntervalMs: 1000
};

test.after(() => {
  for (const roomCode of [...__test.rooms.keys()]) __test.deleteRoom(roomCode);
  server.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function makeActiveGame(roomState) {
  roomState.matchMetadata = {
    matchId: "33333333-3333-4333-8333-333333333333",
    seriesId: null,
    gameNumber: 1,
    startedAt: "2026-07-15T12:00:00.000Z"
  };
  roomState.lobby.players[1] = {
    socket: null,
    connected: false,
    accountId: null,
    accountName: "Alpha",
    isGuest: true,
    factionId: "rumin",
    reconnectToken: "alpha-private-token"
  };
  roomState.lobby.players[2] = {
    socket: null,
    connected: false,
    accountId: null,
    accountName: "Beta",
    isGuest: true,
    factionId: "sheen",
    reconnectToken: "beta-private-token"
  };
  roomState.game = {
    gameMode: "factions",
    phase: "priority",
    turn: 3,
    priority: 1,
    winner: null,
    message: "Player 1 has priority.",
    players: {
      1: { accountName: "Alpha", faction: { id: "rumin", name: "Rumin" }, life: 30, hand: [], deck: [], discard: [] },
      2: { accountName: "Beta", faction: { id: "sheen", name: "Sheen" }, life: 24, hand: [], deck: [], discard: [] }
    },
    lanes: [],
    handAttacks: [],
    eventLog: []
  };
  return roomState;
}

test("uses safe lifecycle defaults and accepts explicit millisecond configuration", () => {
  const defaults = getRoomLifecycleConfig({});
  assert.ok(defaults.reconnectGraceMs >= 60000);
  assert.ok(defaults.lobbyTtlMs > defaults.reconnectGraceMs);
  assert.ok(defaults.completedTtlMs >= 60000);

  const configured = getRoomLifecycleConfig({
    ROOM_RECONNECT_GRACE_MS: "2000",
    ROOM_LOBBY_TTL_MS: "3000",
    ROOM_COMPLETED_TTL_MS: "4000",
    ROOM_SWEEP_INTERVAL_MS: "5000"
  });
  assert.deepEqual(configured, {
    reconnectGraceMs: 2000,
    lobbyTtlMs: 3000,
    completedTtlMs: 4000,
    sweepIntervalMs: 5000
  });
});

test("keeps connected rooms and starts the reconnect clock after the last player leaves", () => {
  const now = Date.parse("2026-07-15T12:00:00.000Z");
  const room = {
    lifecycle: createRoomLifecycle(now),
    lobby: { players: { 1: { socket: "socket-1", isAI: false }, 2: { socket: null, isAI: false } } },
    game: { phase: "priority" }
  };
  touchRoom(room, now);
  assert.equal(room.lifecycle.emptySince, null);
  assert.equal(getRoomLifecycleAction(room, now + 10000, TEST_CONFIG), "keep");

  room.lobby.players[1].socket = null;
  syncRoomPresence(room, now + 10000);
  assert.equal(getRoomLifecycleAction(room, now + 10999, TEST_CONFIG), "keep");
  assert.equal(getRoomLifecycleAction(room, now + 11000, TEST_CONFIG), "abandon_match");

  room.lobby.players[1].socket = "socket-reconnected";
  touchRoom(room, now + 11000);
  assert.equal(room.lifecycle.emptySince, null);
  assert.equal(getRoomLifecycleAction(room, now + 50000, TEST_CONFIG), "keep");
});

test("expires empty lobbies, abandoned drafts, and completed rooms on separate clocks", () => {
  const now = Date.parse("2026-07-15T12:00:00.000Z");
  const lobby = { lifecycle: createRoomLifecycle(now), lobby: { players: {} }, game: null };
  assert.equal(getRoomLifecycleAction(lobby, now + 4999, TEST_CONFIG), "keep");
  assert.equal(getRoomLifecycleAction(lobby, now + 5000, TEST_CONFIG), "delete_empty_lobby");

  const draft = {
    lifecycle: createRoomLifecycle(now),
    lobby: { players: {} },
    game: null,
    draft: { status: "drafting" }
  };
  assert.equal(getRoomLifecycleAction(draft, now + 1000, TEST_CONFIG), "delete_abandoned_draft");

  const completed = { lifecycle: createRoomLifecycle(now), lobby: { players: {} }, game: { phase: "gameOver" } };
  markRoomCompleted(completed, new Date(now).toISOString(), "life_total");
  assert.equal(getRoomLifecycleAction(completed, now + 1999, TEST_CONFIG), "keep");
  assert.equal(getRoomLifecycleAction(completed, now + 2000, TEST_CONFIG), "delete_completed");
});

test("records timeout abandonment without changing competitive statistics", async () => {
  const now = Date.parse("2026-07-15T12:30:00.000Z");
  const room = makeActiveGame(__test.createRoom());
  const matchId = await __test.abandonActiveRoom(room, "reconnect_timeout", now);

  const store = JSON.parse(fs.readFileSync(process.env.MATCH_DATA_FILE, "utf8"));
  const record = store.matches.find((entry) => entry.matchId === matchId);
  assert.equal(room.game.phase, "gameOver");
  assert.equal(room.game.statsRecorded, true);
  assert.equal(record.completionReason, "abandoned");
  assert.equal(record.abandonmentReason, "reconnect_timeout");
  assert.ok(record.participants.every((participant) => participant.result === "abandoned"));
  assert.equal(fs.existsSync(process.env.FACTION_STATS_DATA_FILE), false);
  assert.equal(fs.existsSync(process.env.ACCOUNT_DATA_FILE), false);
  __test.deleteRoom(room.roomCode);
});

test("sweeps disconnected matches, then removes them after completed retention", async () => {
  const startedAt = Date.parse("2026-07-15T13:00:00.000Z");
  const room = makeActiveGame(__test.createRoom());
  room.matchMetadata.matchId = "44444444-4444-4444-8444-444444444444";
  room.lifecycle.emptySince = new Date(startedAt).toISOString();

  const abandoned = await __test.sweepRoomLifecycle({ now: startedAt + 1000, config: TEST_CONFIG });
  assert.equal(abandoned.abandoned, 1);
  assert.equal(__test.rooms.has(room.roomCode), true);

  const deleted = await __test.sweepRoomLifecycle({ now: startedAt + 3000, config: TEST_CONFIG });
  assert.equal(deleted.deleted, 1);
  assert.equal(__test.rooms.has(room.roomCode), false);
});

test("graceful shutdown persistence preserves active matches without finalizing them", () => {
  const room = makeActiveGame(__test.createRoom());
  room.matchMetadata.matchId = "55555555-5555-4555-8555-555555555555";
  const result = __test.persistActiveRoomsForShutdown(Date.parse("2026-07-15T14:00:00.000Z"));
  assert.ok(result.saved >= 1);
  const store = JSON.parse(fs.readFileSync(process.env.ROOM_STATE_DATA_FILE, "utf8"));
  const snapshot = store.rooms.find((entry) => entry.roomCode === room.roomCode);
  assert.equal(snapshot.game.phase, "priority");
  assert.equal(snapshot.matchMetadata.matchId, room.matchMetadata.matchId);
  const matchStore = JSON.parse(fs.readFileSync(process.env.MATCH_DATA_FILE, "utf8"));
  assert.equal(matchStore.matches.some((entry) => entry.matchId === room.matchMetadata.matchId), false);
});
