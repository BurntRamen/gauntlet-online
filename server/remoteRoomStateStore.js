"use strict";
const { createRemoteRuntimeStore } = require("./remoteRuntimeStore");
const { cloneRoomForStorage, isRecoverableRoom, prepareRecoveredRoom } = require("./roomStateStore");
const rules = require("../shared/duel-rules");
const CONTRACT = `rooms.v2:${rules.SCHEMA_VERSION}:${rules.COMMAND_SCHEMA_VERSION}:${rules.EVENT_SCHEMA_VERSION}:${rules.RULES_VERSION}`;
function createRemoteRoomStateStore({ request, id = "active-rooms" }) {
  const store = createRemoteRuntimeStore({ request, id, contract: CONTRACT });
  let saved = 0;
  return {
    enabled: true, remote: true,
    async loadRooms(now = Date.now()) {
      const value = await store.load();
      if (!value) return [];
      if (value.schemaVersion !== 2 || !Array.isArray(value.rooms) || value.rooms.some(room => !isRecoverableRoom(room))) throw new Error("Unsupported durable rooms. Preserve the store and restore with a compatible server.");
      const codes = new Set(value.rooms.map(room => room.roomCode));
      if (codes.size !== value.rooms.length) throw new Error("Duplicate durable room identity.");
      saved = value.rooms.length;
      return value.rooms.map(room => prepareRecoveredRoom(room, now));
    },
    async saveRooms(rooms, now = Date.now()) {
      const snapshot = [...rooms].filter(isRecoverableRoom).map(cloneRoomForStorage);
      const receipt = await store.save({ schemaVersion: 2, savedAt: new Date(now).toISOString(), rooms: snapshot });
      saved = snapshot.length;
      return { ...receipt, enabled: true, saved, savedAt: receipt.committedAt };
    },
    status: () => ({ ...store.status(), enabled: true, saved, recovery: "committed-actions", checkpointDelayMs: 0,
      lastSavedAt: store.status().lastCommittedAt, lastSaveFailed: store.status().health === "unavailable" })
  };
}
module.exports = { createRemoteRoomStateStore, CONTRACT };
