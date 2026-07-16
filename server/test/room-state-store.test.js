const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, test } = require("node:test");

const {
  ROOM_STATE_SCHEMA_VERSION,
  createRoomStateStore,
  isRoomRecoveryEnabled
} = require("../roomStateStore");

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-room-store-"));
const roomStateFile = path.join(tempDirectory, "rooms.json");

after(() => fs.rmSync(tempDirectory, { recursive: true, force: true }));

function makeActiveRoom() {
  return {
    roomCode: "ABC123",
    lifecycle: {
      status: "active",
      createdAt: "2026-07-16T10:00:00.000Z",
      lastActivityAt: "2026-07-16T10:05:00.000Z",
      emptySince: null,
      completedAt: null,
      closeReason: null
    },
    lobby: {
      gameMode: "basic",
      players: {
        1: { socket: "socket-alpha", connected: true, accountName: "Alpha", reconnectToken: "alpha-token", isGuest: true },
        2: { socket: null, connected: true, accountName: "Training AI", reconnectToken: null, isAI: true }
      },
      spectators: ["spectator-socket"]
    },
    game: {
      phase: "priority",
      turn: 4,
      priority: 1,
      players: {
        1: { connected: true, life: 19, hand: [{ suit: "hearts", value: 8 }], deck: [{ suit: "clubs", value: 2 }] },
        2: { connected: true, life: 23, hand: [{ suit: "spades", value: 5 }], deck: [{ suit: "diamonds", value: 7 }] }
      }
    },
    aiMoveTimer: { privateRuntimeValue: true },
    damageConfirmed: { 1: false, 2: false }
  };
}

test("writes private active state while removing process-local socket and timer data", () => {
  const store = createRoomStateStore(roomStateFile);
  const result = store.saveRooms([
    makeActiveRoom(),
    { ...makeActiveRoom(), roomCode: "DONE99", game: { phase: "gameOver" } }
  ], Date.parse("2026-07-16T10:06:00.000Z"));

  assert.equal(result.saved, 1);
  const payload = JSON.parse(fs.readFileSync(roomStateFile, "utf8"));
  assert.equal(payload.schemaVersion, ROOM_STATE_SCHEMA_VERSION);
  assert.equal(payload.rooms[0].lobby.players[1].socket, null);
  assert.equal(payload.rooms[0].lobby.players[1].connected, false);
  assert.equal(payload.rooms[0].lobby.players[2].connected, true);
  assert.deepEqual(payload.rooms[0].lobby.spectators, []);
  assert.equal(payload.rooms[0].aiMoveTimer, undefined);
  assert.equal(payload.rooms[0].lobby.players[1].reconnectToken, "alpha-token");
  assert.deepEqual(payload.rooms[0].game.players[1].hand, [{ suit: "hearts", value: 8 }]);
});

test("restores the authoritative game and starts a fresh reconnect grace period", () => {
  const store = createRoomStateStore(roomStateFile);
  const recoveredAt = Date.parse("2026-07-16T10:10:00.000Z");
  const [room] = store.loadRooms(recoveredAt);

  assert.equal(room.roomCode, "ABC123");
  assert.equal(room.lifecycle.status, "active");
  assert.equal(room.lifecycle.emptySince, "2026-07-16T10:10:00.000Z");
  assert.equal(room.recoveredAt, "2026-07-16T10:10:00.000Z");
  assert.equal(room.game.turn, 4);
  assert.equal(room.game.priority, 1);
  assert.equal(room.game.players[1].life, 19);
  assert.equal(room.lobby.players[1].connected, false);
  assert.equal(room.game.players[1].connected, false);
  assert.equal(room.game.players[2].connected, true);
});

test("can be disabled and rejects corrupt snapshots without crashing startup", () => {
  assert.equal(isRoomRecoveryEnabled(undefined), true);
  assert.equal(isRoomRecoveryEnabled("false"), false);
  const disabled = createRoomStateStore(roomStateFile, { enabled: false });
  assert.deepEqual(disabled.loadRooms(), []);

  fs.writeFileSync(roomStateFile, "{not-json", "utf8");
  const errors = [];
  const store = createRoomStateStore(roomStateFile, { logger: { error: (message) => errors.push(message) } });
  assert.deepEqual(store.loadRooms(), []);
  assert.equal(errors.length, 1);
});
