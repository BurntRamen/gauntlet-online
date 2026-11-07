"use strict";
const { AsyncLocalStorage } = require("node:async_hooks");
const { isDeepStrictEqual } = require("node:util");
const clone = value => JSON.parse(JSON.stringify(value, (key, item) => key === "aiMoveTimer" || key.endsWith("Promise") || typeof item === "function" ? undefined : item));
const failure = () => Object.assign(new Error("Runtime recovery is required before accepting another action."), { status: 503, code: "RUNTIME_UNAVAILABLE" });

// Serialize all room writers, including AI and timers. Keep transport output in
// an outbox until PostgreSQL confirms the authoritative state and receipts.
function createDurableRoomBoundary({ rooms, store, additionalState = () => null, beforeCommit = async () => {} }) {
  const context = new AsyncLocalStorage();
  let tail = Promise.resolve(), blocked = false;
  const snapshot = () => clone({rooms:[...rooms.entries()],additional:additionalState()});
  function output(deliver) {
    const current = context.getStore();
    if (current && !current.closed) { current.outbox.push(deliver); return true; }
    if (blocked) return true;
    deliver(); return false;
  }
  async function checkpoint() {
    const current = context.getStore();
    if (!current || current.closed) throw new Error("Durable checkpoint requires an active room transaction.");
    try { await beforeCommit(); const receipt = await store.saveRooms(rooms.values()); current.base = snapshot(); return receipt; }
    catch (error) { blocked = true; throw error; }
  }
  function run(work) {
    const parent = context.getStore();
    if (parent && !parent.closed) return work();
    const pending = tail.then(async () => {
      if (blocked) throw failure();
      const current = { outbox: [], base: snapshot(), closed: false };
      return context.run(current, async () => {
        try {
          const result = await work();
          if (!isDeepStrictEqual(current.base, snapshot())) await checkpoint();
          current.closed = true;
          for (const send of current.outbox) send();
          return result;
        } catch (error) {
          current.closed = true;
          // An incomplete handler can have account/ledger side effects. Stop
          // instead of inventing an unsafe rollback of those external writes.
          if (!isDeepStrictEqual(current.base, snapshot())) blocked = true;
          throw error;
        }
      });
    });
    tail = pending.catch(() => {});
    return pending;
  }
  function wrapSocket(socket) {
    const emit = socket.emit.bind(socket);
    socket.emit = (...args) => {
      const frozen = clone(args);
      if (args[0] === "errorMessage" && (!context.getStore() || context.getStore().closed)) emit(...frozen);
      else output(() => emit(...frozen));
      return socket;
    };
  }
  function wrapBroadcast(adapter) {
    const broadcast = adapter.broadcast.bind(adapter);
    adapter.broadcast = (packet, options) => {
      const frozen = clone(packet), captured = { ...options, rooms: new Set(options.rooms), except: new Set(options.except) };
      output(() => broadcast(frozen, captured));
    };
  }
  return { run, checkpoint, output, wrapSocket, wrapBroadcast, status: () => ({ blocked, commitBeforeAcknowledgement: true }) };
}
module.exports = { createDurableRoomBoundary };
