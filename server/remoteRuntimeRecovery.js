"use strict";
const crypto = require("node:crypto");
const { isDeepStrictEqual } = require("node:util");
const { createRemoteRuntimeStore } = require("./remoteRuntimeStore");
const { CONTRACT } = require("./remoteRoomStateStore");
const { cloneRoomForStorage, isRecoverableRoom } = require("./roomStateStore");
const SCHEMA = "gauntlet.remote-runtime-export.v1";
const hash = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function exportRuntime({ request, id = "active-rooms", contract = CONTRACT }) {
  const store = createRemoteRuntimeStore({ request, id, contract });
  const state = await store.load();
  if (!state) throw new Error("There is no committed runtime to export.");
  const payload = { schemaVersion: SCHEMA, id, contract, revision: store.status().revision, exportedAt: new Date().toISOString(), state };
  return { ...payload, sha256: hash(payload) };
}
function validateExport(envelope) {
  const { sha256, ...payload } = envelope || {};
  if (payload.schemaVersion !== SCHEMA || hash(payload) !== sha256 || payload.contract !== CONTRACT || !Number.isSafeInteger(payload.revision)
    || payload.state?.schemaVersion !== 2 || !Array.isArray(payload.state.rooms) || payload.state.rooms.some(room => !isRecoverableRoom(room))) throw new Error("Runtime export is corrupt or requires another engine version.");
  if (new Set(payload.state.rooms.map(room => room.roomCode)).size !== payload.state.rooms.length) throw new Error("Duplicate recovered room identity.");
  return payload;
}
async function restoreRuntime({ request, envelope, targetId }) {
  const payload = validateExport(envelope);
  if (!targetId || targetId === payload.id || !targetId.startsWith("restore-")) throw new Error("Restore into a new restore-* store, never the live authority.");
  const store = createRemoteRuntimeStore({ request, id: targetId, contract: payload.contract });
  const previous = await store.load();
  if (previous) {
    if (isDeepStrictEqual(previous, payload.state)) return { restored: false, alreadyRestored: true, targetId, rooms: previous.rooms.length };
    throw new Error("Restore destination already contains different state. Nothing was overwritten.");
  }
  await store.save(payload.state);
  const verified = await store.load();
  if (!isDeepStrictEqual(verified, payload.state)) throw new Error("Restore readback failed.");
  return { restored: true, targetId, rooms: verified.rooms.length, readbackVerified: true };
}
async function importLocalRooms({ request, checkpoint, id = "active-rooms" }) {
  if (checkpoint?.schemaVersion !== 1 || !Array.isArray(checkpoint.rooms) || checkpoint.rooms.some(room => !isRecoverableRoom(room))) throw new Error("Invalid local room checkpoint. Preserve the source.");
  const state = { schemaVersion: 2, savedAt: checkpoint.savedAt, rooms: checkpoint.rooms.map(cloneRoomForStorage) };
  if (new Set(state.rooms.map(room => room.roomCode)).size !== state.rooms.length) throw new Error("Duplicate local room identity.");
  const store = createRemoteRuntimeStore({ request, id, contract: CONTRACT });
  const previous = await store.load();
  if (previous) {
    if (isDeepStrictEqual(previous, state)) return { imported: false, alreadyImported: true, rooms: state.rooms.length };
    throw new Error("Remote runtime already exists. Quiesce and reconcile; never overwrite it with a local checkpoint.");
  }
  await store.save(state);
  if (!isDeepStrictEqual(await store.load(), state)) throw new Error("Migration readback failed. Preserve the source.");
  return { imported: true, rooms: state.rooms.length, readbackVerified: true };
}
module.exports = { exportRuntime, validateExport, restoreRuntime, importLocalRooms };
