const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { before, after, test } = require("node:test");
const { io } = require("socket.io-client");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-events-"));
for (const [key, file] of Object.entries({ ACCOUNT_DATA_FILE: "accounts.json", MATCH_DATA_FILE: "matches.json", FACTION_STATS_DATA_FILE: "factions.json", ROOM_STATE_DATA_FILE: "rooms.json" })) process.env[key] = path.join(directory, file);
process.env.SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";
process.env.ROOM_STATE_RECOVERY_ENABLED = "false";
const { server, __test } = require("../index");
let url;
const sockets = [];

function nextEvent(socket, name) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Missing ${name}`)), 3000);
    socket.once(name, (payload) => { clearTimeout(timeout); resolve(payload); });
  });
}

async function connect() {
  const socket = io(url, { transports: ["websocket"] });
  sockets.push(socket);
  if (!socket.connected) await nextEvent(socket, "connect");
  return socket;
}

async function registerAndEnter(suffix) {
  const registered = await fetch(`${url}/api/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: `Event${Date.now()}${suffix}`, password: "EventQueueTest42!" }) });
  assert.equal(registered.ok, true);
  const session = await registered.json();
  const entered = await fetch(`${url}/api/events/open-gauntlet/join`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` } });
  assert.equal(entered.ok, true);
  return { ...session, entry: await entered.json() };
}

before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

test("free entries match only inside their event and carry durable run ids", async () => {
  const [a, b] = await Promise.all([registerAndEnter("a"), registerAndEnter("b")]);
  assert.equal(a.entry.event.entryCost.amount, 0);
  const [first, second] = await Promise.all([connect(), connect()]);
  const matchedFirst = nextEvent(first, "assign");
  const matchedSecond = nextEvent(second, "assign");
  first.emit("joinEventMatchmaking", { authToken: a.token, eventId: "open-gauntlet", factionId: "rumin" });
  second.emit("joinEventMatchmaking", { authToken: b.token, eventId: "open-gauntlet", factionId: "sheen" });
  const [seatA, seatB] = await Promise.all([matchedFirst, matchedSecond]);
  const room = __test.rooms.get(seatA.roomCode);
  assert.equal(seatA.roomCode, seatB.roomCode);
  assert.equal(room.ranked, false);
  assert.equal(room.event.eventId, "open-gauntlet");
  assert.equal(room.event.entries[seatA.playerNum].runId, a.entry.run.id);
  assert.equal(room.event.entries[seatB.playerNum].runId, b.entry.run.id);
});

test("public events include the major calendar and server-computed availability", async () => {
  const response = await fetch(`${url}/api/events`);
  assert.equal(response.ok, true);
  const payload = await response.json();
  const major = payload.events.find((event) => event.id === "fall-grand-gauntlet-2026");
  assert.equal(major.scale, "major");
  assert.equal(major.schedule.startsAt, "2026-10-23T17:00:00.000Z");
  assert.equal(typeof major.availability.canEnter, "boolean");
  assert.match(major.availability.state, /^(upcoming|live|entry-closed|ended)$/);
});

after(async () => {
  sockets.forEach((socket) => socket.disconnect());
  __test.rooms.clear();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(directory, { recursive: true, force: true });
});
