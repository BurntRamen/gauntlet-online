const fs = require("fs");
const path = require("path");

const ROOM_STATE_SCHEMA_VERSION = 1;

function isRoomRecoveryEnabled(value) {
  if (value == null || value === "") return true;
  return !["0", "false", "off", "no"].includes(String(value).trim().toLowerCase());
}

function isRecoverableRoom(roomState) {
  return !!roomState?.roomCode
    && !!roomState?.lobby?.players
    && roomState.game?.phase !== "gameOver"
    && roomState.lifecycle?.status !== "completed";
}

function cloneRoomForStorage(roomState) {
  const serialized = JSON.stringify(roomState, (key, value) => {
    if (key === "aiMoveTimer" || key.endsWith("Promise")) return undefined;
    if (typeof value === "function") return undefined;
    return value;
  });
  const storedRoom = JSON.parse(serialized);

  storedRoom.lobby.spectators = [];
  for (const player of Object.values(storedRoom.lobby.players || {})) {
    player.socket = null;
    player.connected = !!player.isAI;
  }
  for (const [playerNum, player] of Object.entries(storedRoom.game?.players || {})) {
    player.connected = !!storedRoom.lobby.players?.[playerNum]?.isAI;
  }
  delete storedRoom.aiMoveTimer;
  return storedRoom;
}

function prepareRecoveredRoom(roomState, now = Date.now()) {
  if (!isRecoverableRoom(roomState)) return null;
  const recoveredRoom = cloneRoomForStorage(roomState);
  const recoveredAt = new Date(now).toISOString();
  recoveredRoom.lifecycle = recoveredRoom.lifecycle || {};
  recoveredRoom.lifecycle.status = recoveredRoom.game
    ? "active"
    : recoveredRoom.draft?.status && recoveredRoom.draft.status !== "lobby"
      ? "drafting"
      : "lobby";
  recoveredRoom.lifecycle.emptySince = recoveredAt;
  recoveredRoom.lifecycle.completedAt = null;
  recoveredRoom.lifecycle.closeReason = null;
  recoveredRoom.recoveredAt = recoveredAt;
  return recoveredRoom;
}

function createRoomStateStore(filePath, options = {}) {
  const enabled = options.enabled !== false;
  const logger = options.logger || console;

  function saveRooms(roomStates, now = Date.now()) {
    if (!enabled) return { enabled: false, saved: 0 };
    const rooms = [...roomStates]
      .filter(isRecoverableRoom)
      .map(cloneRoomForStorage);
    const payload = {
      schemaVersion: ROOM_STATE_SCHEMA_VERSION,
      savedAt: new Date(now).toISOString(),
      rooms
    };
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    try {
      fs.renameSync(temporaryPath, filePath);
    } catch (error) {
      if (!fs.existsSync(temporaryPath)) throw error;
      fs.copyFileSync(temporaryPath, filePath);
      fs.rmSync(temporaryPath, { force: true });
    }
    return { enabled: true, saved: rooms.length, savedAt: payload.savedAt };
  }

  function loadRooms(now = Date.now()) {
    if (!enabled || !fs.existsSync(filePath)) return [];
    try {
      const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (payload.schemaVersion !== ROOM_STATE_SCHEMA_VERSION || !Array.isArray(payload.rooms)) {
        throw new Error("Unsupported active-room snapshot schema.");
      }
      return payload.rooms
        .map((roomState) => prepareRecoveredRoom(roomState, now))
        .filter(Boolean);
    } catch (error) {
      logger.error(`[Rooms] Could not restore active rooms from ${filePath}: ${error.message}`);
      return [];
    }
  }

  return { enabled, filePath, loadRooms, saveRooms };
}

module.exports = {
  ROOM_STATE_SCHEMA_VERSION,
  cloneRoomForStorage,
  createRoomStateStore,
  isRecoverableRoom,
  isRoomRecoveryEnabled,
  prepareRecoveredRoom
};
