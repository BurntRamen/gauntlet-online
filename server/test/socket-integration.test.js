const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, before, test } = require("node:test");
const { io: createClient } = require("socket.io-client");

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-socket-integration-"));
process.env.ACCOUNT_DATA_FILE = path.join(tempDirectory, "accounts.json");
process.env.FACTION_STATS_DATA_FILE = path.join(tempDirectory, "faction-stats.json");
process.env.MATCH_RECORD_DATA_FILE = path.join(tempDirectory, "match-records.json");
process.env.AUTH_SECRET = "socket-integration-test-secret-with-enough-length";

const { server, __test } = require("../index");

let baseUrl;
const clients = new Set();

function waitForEvent(socket, eventName, predicate = () => true, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);

    function onEvent(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timeout);
      socket.off(eventName, onEvent);
      resolve(payload);
    }

    socket.on(eventName, onEvent);
  });
}

async function connectClient() {
  const socket = createClient(baseUrl, {
    autoConnect: false,
    forceNew: true,
    transports: ["websocket"]
  });
  clients.add(socket);
  const connected = waitForEvent(socket, "connect");
  socket.connect();
  await connected;
  return socket;
}

before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  for (const socket of clients) socket.disconnect();
  __test.rooms.clear();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

test("two guests can start a private Basic game and reclaim a disconnected seat", async () => {
  const host = await connectClient();
  const hostAssignmentPromise = waitForEvent(host, "assign");
  const createdLobbyPromise = waitForEvent(host, "lobbyState");
  host.emit("createRoom", { guestName: "Alpha" });

  const hostAssignment = await hostAssignmentPromise;
  const createdLobby = await createdLobbyPromise;
  assert.equal(hostAssignment.playerNum, 1);
  assert.equal(createdLobby.players[1].accountName, "Alpha");

  const basicLobbyPromise = waitForEvent(host, "lobbyState", (state) => state.gameMode === "basic");
  host.emit("setGameMode", { mode: "basic" });
  await basicLobbyPromise;

  const guest = await connectClient();
  const guestAssignmentPromise = waitForEvent(guest, "assign");
  const joinedLobbyPromise = waitForEvent(guest, "lobbyState", (state) => state.players[2].accountName === "Beta");
  guest.emit("joinRoom", { roomCode: hostAssignment.roomCode, guestName: "Beta" });

  const guestAssignment = await guestAssignmentPromise;
  const joinedLobby = await joinedLobbyPromise;
  assert.equal(guestAssignment.playerNum, 2);
  assert.equal(joinedLobby.players[1].accountName, "Alpha");
  assert.equal(joinedLobby.players[2].accountName, "Beta");

  const hostReadyPromise = waitForEvent(host, "lobbyState", (state) => state.players[1].readyToStart);
  host.emit("startGame");
  await hostReadyPromise;

  const hostGamePromise = waitForEvent(host, "state", (state) => state.phase === "priority");
  const guestGamePromise = waitForEvent(guest, "state", (state) => state.phase === "priority");
  guest.emit("startGame");

  const hostGame = await hostGamePromise;
  const guestGame = await guestGamePromise;
  assert.equal(hostGame.players[1].accountName, "Alpha");
  assert.equal(hostGame.players[2].accountName, "Beta");
  assert.ok(hostGame.players[1].hand.length > 0);
  assert.equal(hostGame.players[2].hand.length, 0);
  assert.ok(guestGame.players[2].hand.length > 0);
  assert.equal(guestGame.players[1].hand.length, 0);
  assert.equal(hostGame.players[2].handCount, guestGame.players[2].hand.length);

  const disconnectedStatePromise = waitForEvent(host, "state", (state) => !state.players[2].connected);
  guest.disconnect();
  const disconnectedState = await disconnectedStatePromise;

  const reconnectedGuest = await connectClient();
  const reassignmentPromise = waitForEvent(reconnectedGuest, "assign");
  const recoveredStatePromise = waitForEvent(reconnectedGuest, "state", (state) => state.players[2].connected);
  reconnectedGuest.emit("reconnectToRoom", {
    roomCode: guestAssignment.roomCode,
    reconnectToken: guestAssignment.reconnectToken
  });

  const reassignment = await reassignmentPromise;
  const recoveredState = await recoveredStatePromise;
  assert.equal(reassignment.playerNum, 2);
  assert.equal(recoveredState.players[2].accountName, "Beta");
  assert.equal(recoveredState.turnNumber, disconnectedState.turnNumber);
  assert.equal(recoveredState.priority, disconnectedState.priority);
  assert.ok(recoveredState.players[2].hand.length > 0);
  assert.equal(recoveredState.players[1].hand.length, 0);
});
