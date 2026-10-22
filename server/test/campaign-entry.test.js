const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { before, after, test } = require("node:test");
const { io } = require("socket.io-client");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-campaign-entry-"));
for (const [key, name] of Object.entries({ ACCOUNT_DATA_FILE: "accounts.json", FACTION_STATS_DATA_FILE: "factions.json", MATCH_DATA_FILE: "matches.json", ROOM_STATE_DATA_FILE: "rooms.json", GAUNTLET_CONTENT_DATA_DIR: "content" })) process.env[key] = path.join(directory, name);
process.env.ACCOUNT_AUTH_SECRET = "campaign-entry-test-secret-with-enough-length";
process.env.GAUNTLET_CONTENT_PROVIDER = "github";
for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]) delete process.env[key];
const { server, __test } = require("../index");
const clients = [];
let url;

function event(socket, name, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, receive); reject(new Error(`Timed out waiting for ${name}`)); }, 5000);
    function receive(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(name, receive);
      resolve(payload);
    }
    socket.on(name, receive);
  });
}

async function connect() {
  const socket = io(url, { autoConnect: false, transports: ["websocket"], forceNew: true });
  clients.push(socket);
  const ready = event(socket, "connect");
  socket.connect();
  await ready;
  return socket;
}

before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  clients.forEach((socket) => socket.disconnect());
  for (const roomCode of __test.rooms.keys()) __test.deleteRoom(roomCode);
  __test.persistRoomsNow();
  await new Promise((resolve) => server.close(resolve));
  assert.equal(path.dirname(directory), os.tmpdir());
  assert.ok(path.basename(directory).startsWith("gauntlet-campaign-entry-"));
  fs.rmSync(directory, { recursive: true, force: true });
});

test("Bizi campaign opens a playable match without disconnecting", async () => {
  const socket = await connect();
  const state = event(socket, "state", (game) => game.campaign?.factionId === "bizi");
  socket.emit("createCampaignRoom", { guestName: "Campaign Tester", factionId: "bizi", chapterId: "kharons-vision" });
  const game = await state;
  assert.equal(game.campaign.chapterId, "kharons-vision");
  assert.equal(game.phase, "priority");
  assert.ok(game.players[1].hand.length > 0);
  assert.equal(socket.connected, true);
});

test("signed-in Bizi chapter five opens with a populated deck and survives reconnection", async t => {
  const response = await fetch(`${url}/api/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Campaign Account", password: "Campaign-Test-Password-42" }) });
  const { token, account } = await response.json();
  const store = JSON.parse(fs.readFileSync(process.env.ACCOUNT_DATA_FILE, "utf8"));
  const stored = store.accounts.find(entry => entry.id === account.id);
  stored.stats.progression = { ...stored.stats.progression, campaign: { bizi: ["kharons-vision", "first-titan", "golden-empire", "riot-of-sparks"] } };
  const cards = __test.contentPublication.active().manifest.cards.filter(card => card.factionId === "bizi");
  const quantities = Object.fromEntries(cards.map(card => [card.id, 1]));
  stored.stats.collection = { gameplayEntitlements: quantities };
  stored.stats.savedConstructedDeck = { factionId: "bizi", gameplayCardQuantities: quantities };
  fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, JSON.stringify(store));
  const socket = await connect();
  const reads = t.mock.method(__test.contentPublication, "active");
  const assigned = event(socket, "assign");
  const state = event(socket, "state", game => game.campaign?.chapterId === "last-victories");
  socket.emit("createCampaignRoom", { authToken: token, factionId: "bizi", chapterId: "last-victories" });
  const game = await state;
  assert.equal(game.campaign.chapterId, "last-victories");
  assert.equal(socket.connected, true);
  assert.ok(reads.mock.callCount() <= 10, "deck entry must not read the full catalog once per card");
  const seat = await assigned;
  const room = __test.rooms.get(seat.roomCode);
  assert.equal(room.lobby.players[1].savedConstructedDeck.cards.length, cards.length);
  assert.equal(game.contentVersion, __test.contentPublication.active().releaseId);
  socket.disconnect();
  const restoredSocket = await connect();
  const restored = event(restoredSocket, "state", next => next.matchId === game.matchId);
  restoredSocket.emit("reconnectToRoom", { ...seat, authToken: token });
  const next = await restored;
  assert.equal(next.campaign.chapterId, "last-victories");
  assert.deepEqual(next.players[1].hand, game.players[1].hand);
});


