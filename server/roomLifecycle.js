const DEFAULT_ROOM_RECONNECT_GRACE_MS = 10 * 60 * 1000;
const DEFAULT_ROOM_LOBBY_TTL_MS = 60 * 60 * 1000;
const DEFAULT_ROOM_COMPLETED_TTL_MS = 15 * 60 * 1000;
const DEFAULT_ROOM_SWEEP_INTERVAL_MS = 30 * 1000;

function readDuration(value, fallback, minimum = 1000) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

function getRoomLifecycleConfig(env = process.env) {
  return {
    reconnectGraceMs: readDuration(env.ROOM_RECONNECT_GRACE_MS, DEFAULT_ROOM_RECONNECT_GRACE_MS),
    lobbyTtlMs: readDuration(env.ROOM_LOBBY_TTL_MS, DEFAULT_ROOM_LOBBY_TTL_MS),
    completedTtlMs: readDuration(env.ROOM_COMPLETED_TTL_MS, DEFAULT_ROOM_COMPLETED_TTL_MS),
    sweepIntervalMs: readDuration(env.ROOM_SWEEP_INTERVAL_MS, DEFAULT_ROOM_SWEEP_INTERVAL_MS)
  };
}

function createRoomLifecycle(now = Date.now()) {
  const timestamp = new Date(now).toISOString();
  return {
    status: "lobby",
    createdAt: timestamp,
    lastActivityAt: timestamp,
    emptySince: timestamp,
    completedAt: null,
    closeReason: null
  };
}

function getConnectedHumanPlayerNumbers(roomState) {
  return Object.entries(roomState?.lobby?.players || {})
    .filter(([, player]) => !player.isAI && !!player.socket)
    .map(([playerNum]) => Number(playerNum));
}

function ensureRoomLifecycle(roomState, now = Date.now()) {
  roomState.lifecycle = roomState.lifecycle || createRoomLifecycle(now);
  return roomState.lifecycle;
}

function syncRoomPresence(roomState, now = Date.now()) {
  const lifecycle = ensureRoomLifecycle(roomState, now);
  if (getConnectedHumanPlayerNumbers(roomState).length > 0) {
    lifecycle.emptySince = null;
  } else if (!lifecycle.emptySince) {
    lifecycle.emptySince = new Date(now).toISOString();
  }
  return lifecycle;
}

function touchRoom(roomState, now = Date.now()) {
  const lifecycle = syncRoomPresence(roomState, now);
  lifecycle.lastActivityAt = new Date(now).toISOString();
  if (roomState.game?.phase === "gameOver") lifecycle.status = "completed";
  else if (roomState.game) lifecycle.status = "active";
  else if (roomState.draft?.status && roomState.draft.status !== "lobby") lifecycle.status = "drafting";
  else lifecycle.status = "lobby";
  if (lifecycle.status !== "completed") {
    lifecycle.completedAt = null;
    lifecycle.closeReason = null;
  }
  return lifecycle;
}

function markRoomCompleted(roomState, completedAt = new Date().toISOString(), closeReason = null) {
  const lifecycle = ensureRoomLifecycle(roomState, Date.parse(completedAt));
  lifecycle.status = "completed";
  lifecycle.completedAt = completedAt;
  lifecycle.lastActivityAt = completedAt;
  lifecycle.closeReason = closeReason;
  return lifecycle;
}

function elapsedSince(timestamp, now) {
  const started = Date.parse(timestamp || "");
  return Number.isFinite(started) ? Math.max(0, now - started) : 0;
}

function getRoomLifecycleAction(roomState, now = Date.now(), config = getRoomLifecycleConfig()) {
  const lifecycle = syncRoomPresence(roomState, now);
  const emptyFor = lifecycle.emptySince ? elapsedSince(lifecycle.emptySince, now) : 0;

  if (roomState.game?.phase === "gameOver" || lifecycle.status === "completed") {
    const completedAt = lifecycle.completedAt || lifecycle.lastActivityAt;
    if (elapsedSince(completedAt, now) >= config.completedTtlMs) return "delete_completed";
    return "keep";
  }

  if (!lifecycle.emptySince) return "keep";

  if (roomState.game) {
    return emptyFor >= config.reconnectGraceMs ? "abandon_match" : "keep";
  }

  if (roomState.draft?.status && roomState.draft.status !== "lobby") {
    return emptyFor >= config.reconnectGraceMs ? "delete_abandoned_draft" : "keep";
  }

  return emptyFor >= config.lobbyTtlMs ? "delete_empty_lobby" : "keep";
}

module.exports = {
  DEFAULT_ROOM_COMPLETED_TTL_MS,
  DEFAULT_ROOM_LOBBY_TTL_MS,
  DEFAULT_ROOM_RECONNECT_GRACE_MS,
  DEFAULT_ROOM_SWEEP_INTERVAL_MS,
  createRoomLifecycle,
  ensureRoomLifecycle,
  getConnectedHumanPlayerNumbers,
  getRoomLifecycleAction,
  getRoomLifecycleConfig,
  markRoomCompleted,
  syncRoomPresence,
  touchRoom
};
