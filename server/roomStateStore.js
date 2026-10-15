const fs = require("fs");
const path = require("path");
const crypto = require("node:crypto");

const ROOM_STATE_SCHEMA_VERSION = 1;

function isRoomRecoveryEnabled(value) {
  if (value == null || value === "") return true;
  return !["0", "false", "off", "no"].includes(String(value).trim().toLowerCase());
}

function isRecoverableRoom(roomState) {
  return !!roomState?.roomCode
    && !!roomState?.lobby?.players
    && (!!roomState.pendingFinalization || (roomState.game?.phase !== "gameOver"
      && roomState.lifecycle?.status !== "completed"));
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
    if (player.connected && !player.opponentKind) player.opponentKind = storedRoom.game.campaign ? "campaign-boss" : "training-ai";
  }
  delete storedRoom.aiMoveTimer;
  return storedRoom;
}

function prepareRecoveredRoom(roomState, now = Date.now()) {
  if (!isRecoverableRoom(roomState)) return null;
  const recoveredRoom = cloneRoomForStorage(roomState);
  const recoveredAt = new Date(now).toISOString();
  recoveredRoom.lifecycle = recoveredRoom.lifecycle || {};
  recoveredRoom.lifecycle.status = recoveredRoom.pendingFinalization ? "finalizing" : recoveredRoom.game
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
  let lastSavedAt = null, lastSaveFailed = false;

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
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
    const temporaryPath = `${filePath}.${crypto.randomUUID()}.tmp`;
    let descriptor;
    try {
      descriptor = fs.openSync(temporaryPath, "wx", 0o600);
      fs.writeFileSync(descriptor, `${JSON.stringify(payload)}\n`, "utf8");
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor); descriptor = undefined;
      fs.renameSync(temporaryPath, filePath);
      if (process.platform !== "win32") {
        const directory = fs.openSync(path.dirname(filePath), "r");
        try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
      }
      lastSavedAt = payload.savedAt; lastSaveFailed = false;
    } catch (error) {
      lastSaveFailed = true;
      throw error; // Never replace the last good checkpoint with a partial copy.
    } finally {
      if (descriptor !== undefined) fs.closeSync(descriptor);
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
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
      lastSavedAt = payload.savedAt || null;
      return payload.rooms
        .map((roomState) => prepareRecoveredRoom(roomState, now))
        .filter(Boolean);
    } catch (error) {
      if (options.strict) throw new Error("The active-room checkpoint could not be restored. Preserve the file and restore a verified backup before starting.");
      logger.error(`[Rooms] Could not restore active rooms from ${filePath}: ${error.message}`);
      return [];
    }
  }

  return { enabled, filePath, loadRooms, saveRooms, status: () => ({ enabled, lastSavedAt, lastSaveFailed, recovery: "latest-checkpoint", checkpointDelayMs: 50 }) };
}

module.exports = {
  ROOM_STATE_SCHEMA_VERSION,
  cloneRoomForStorage,
  createRoomStateStore,
  isRecoverableRoom,
  isRoomRecoveryEnabled,
  prepareRecoveredRoom
};
