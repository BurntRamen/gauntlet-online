const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createSocketBoundary } = require("../socketBoundary");

test("socket boundary contains handler rejections and continues processing", async () => {
  const handlers = new Map();
  const messages = [];
  const errors = [];
  const socket = { connected: true, on: (event, handler) => handlers.set(event, handler), emit: (...args) => messages.push(args) };
  const on = createSocketBoundary(socket, { getRoomForSocket: () => null, onError: (...args) => errors.push(args) });
  on("startGame", async () => { throw new Error("Storage unavailable"); });
  let progressed = false;
  on("leaveRoom", () => { progressed = true; });
  handlers.get("startGame")();
  handlers.get("leaveRoom")();
  await new Promise(setImmediate);
  assert.equal(errors.length, 1);
  assert.equal(messages[0][0], "errorMessage");
  assert.equal(progressed, true);
});

test("disconnect cleanup follows in-flight work and skips later client requests", async () => {
  const handlers = new Map();
  const order = [];
  const socket = { connected: true, on: (event, handler) => handlers.set(event, handler), emit() {} };
  const on = createSocketBoundary(socket, { getRoomForSocket: () => null });
  let release;
  on("createRoom", async () => { await new Promise((resolve) => { release = resolve; }); order.push("created"); });
  on("selectFaction", () => order.push("selected"));
  on("disconnect", () => order.push("detached"));
  handlers.get("createRoom")({ guestName: "Guest" });
  await new Promise(setImmediate);
  handlers.get("selectFaction")({ factionId: "rumin" });
  socket.connected = false;
  handlers.get("disconnect")();
  release();
  await new Promise(setImmediate);
  assert.deepEqual(order, ["created", "detached"]);
});
