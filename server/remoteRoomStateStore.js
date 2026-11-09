"use strict";
const { createRemoteRuntimeStore } = require("./remoteRuntimeStore");
const { hash } = require("./authoredContent");
const { cloneRoomForStorage, isRecoverableRoom, prepareRecoveredRoom } = require("./roomStateStore");
const rules = require("../shared/duel-rules");
const CONTRACT = `rooms.v2:${rules.SCHEMA_VERSION}:${rules.COMMAND_SCHEMA_VERSION}:${rules.EVENT_SCHEMA_VERSION}:${rules.RULES_VERSION}`;
function createRemoteRoomStateStore({ request, id = "active-rooms" }) {
  const store = createRemoteRuntimeStore({ request, id, contract: CONTRACT });
  let saved = 0, committed = null;
  return {
    enabled: true, remote: true,
    async loadRooms(now = Date.now()) {
      const value = await store.load();
      if (!value) { committed = null; saved = 0; return []; }
      if (value.schemaVersion !== 2 || !Array.isArray(value.rooms) || value.rooms.some(room => !isRecoverableRoom(room))) throw new Error("Unsupported durable rooms. Preserve the store and restore with a compatible server.");
      const codes = new Set(value.rooms.map(room => room.roomCode));
      if (codes.size !== value.rooms.length) throw new Error("Duplicate durable room identity.");
      saved = value.rooms.length;
      committed = hash(value.rooms);
      return value.rooms.map(room => prepareRecoveredRoom(room, now));
    },
    async saveRooms(rooms, now = Date.now()) {
      const snapshot = [...rooms].filter(isRecoverableRoom).map(cloneRoomForStorage);
      const fingerprint = hash(snapshot), status = store.status();
      // Shutdown/backup timestamps alone must not advance the CAS revision
      // underneath a replacement process that has already loaded these rooms.
      if (fingerprint === committed && status.health === "healthy") {
        return { unchanged: true, revision: status.revision, committedAt: status.lastCommittedAt,
          enabled: true, saved, savedAt: status.lastCommittedAt };
      }
      const receipt = await store.save({ schemaVersion: 2, savedAt: new Date(now).toISOString(), rooms: snapshot });
      committed = fingerprint;
      saved = snapshot.length;
      return { ...receipt, enabled: true, saved, savedAt: receipt.committedAt };
    },
    status: () => ({ ...store.status(), enabled: true, saved, recovery: "committed-actions", checkpointDelayMs: 0,
      lastSavedAt: store.status().lastCommittedAt, lastSaveFailed: store.status().health === "unavailable" })
  };
}
module.exports = { createRemoteRoomStateStore, CONTRACT };
