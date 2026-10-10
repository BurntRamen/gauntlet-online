const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { before, after, test } = require("node:test");
const { io } = require("socket.io-client");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-draft-test-"));
for (const [key, name] of Object.entries({ ACCOUNT_DATA_FILE: "accounts.json", FACTION_STATS_DATA_FILE: "factions.json", MATCH_DATA_FILE: "matches.json", ROOM_STATE_DATA_FILE: "rooms.json", GAUNTLET_CONTENT_DATA_DIR: "content" })) process.env[key] = path.join(directory, name);
process.env.ACCOUNT_AUTH_SECRET = "draft-flow-test-secret-with-enough-length";
for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]) delete process.env[key];
const { server, __test } = require("../index");
const clients = [];
let url;

function event(socket, name, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, receive); reject(new Error(`Timed out waiting for ${name}`)); }, 20000);
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
function request(socket, name, payload = {}) {
  return socket.timeout(20000).emitWithAck(name, payload);
}

before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  clients.forEach((socket) => socket.disconnect());
  __test.rooms.clear();
  __test.persistRoomsNow();
  await new Promise((resolve) => server.close(resolve));
  assert.equal(path.dirname(directory), os.tmpdir());
  assert.ok(path.basename(directory).startsWith("gauntlet-draft-test-"));
  fs.rmSync(directory, { recursive: true, force: true });
});

test("bot draft completes 24 real picks, restores its pool, preserves fixed slots, saves, and enters its league", async () => {
  const registration = await fetch(`${url}/api/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "DraftAccount", password: "Draft-Test-Password-42" }) });
  assert.equal(registration.status, 200);
  const { token } = await registration.json();
  let socket = await connect();
  const assigned = event(socket, "assign");
  const first = event(socket, "draftState");
  assert.equal((await request(socket, "createBotDraftRoom", { authToken: token })).ok, true);
  const seat = await assigned;
  let draft = await first;
  assert.equal(draft.activePlayers.length, 8);
  assert.equal(draft.myCurrentPack.cards.length, 8);
  assert.equal((await request(socket, "draftPick", { cardCopyId: "not-a-card" })).ok, false);
  for (let pick = 0; pick < 24; pick++) {
    const updated = event(socket, "draftState", (state) => state.myPool.length === pick + 1);
    const card = draft.myCurrentPack.cards[0];
    assert.ok(card.id && card.factionId && card.name);
    assert.equal((await request(socket, "draftPick", { cardCopyId: card.draftCopyId })).ok, true);
    draft = await updated;
    if (pick === 4) {
      socket.disconnect();
      socket = await connect();
      const restored = event(socket, "draftState");
      socket.emit("reconnectToRoom", { ...seat, authToken: token });
      const next = await restored;
      assert.deepEqual(next.myPool, draft.myPool);
      assert.deepEqual(next.myCurrentPack, draft.myCurrentPack);
      draft = next;
    }
  }
  assert.equal(draft.status, "building");
  assert.equal(draft.myPool.length, 24);
  assert.equal(new Set(draft.myPool.map((card) => card.draftCopyId)).size, 24);
  assert.equal(draft.myCurrentPack, null);
  assert.equal((await request(socket, "draftPick", { cardCopyId: draft.myPool[0].draftCopyId })).ok, false);
  assert.equal((await request(socket, "saveDraftDeck")).ok, false);
  const chosen = draft.myPool.find((card) => card.factionId !== "neutral");
  const selection = { cardCopyId: chosen.draftCopyId, suit: "clubs" };
  const built = event(socket, "draftState", (state) => state.myDeckAdditions.length === 1);
  assert.equal((await request(socket, "setDraftDeckAdditions", { selections: [selection] })).ok, true);
  assert.equal((await built).myDeckAdditions[0].replacementSuit, chosen.suit);
  const updatedAccount = event(socket, "accountUpdated");
  const savedMessage = event(socket, "draftDeckSaved");
  assert.equal((await request(socket, "saveDraftDeck")).ok, true);
  const account = await updatedAccount;
  assert.equal(account.stats.savedDraftDeck.draftType, "bot");
  assert.equal(account.stats.savedDraftDeck.cardCount, 52);
  assert.match((await savedMessage).message, /Bot Draft/);
  socket.emit("leaveRoom");
  const queue = event(socket, "draftLeagueStatus");
  socket.emit("joinDraftLeague", { authToken: token, draftType: "bot" });
  assert.equal((await queue).inQueue, true);
  socket.emit("leaveDraftLeague");
});

test("live draft requires connected seats, rejects late entrants, hides packs from spectators and waits for both picks", async () => {
  const host = await connect();
  const guest = await connect();
  const created = await request(host, "createDraftRoom", { guestName: "Host" });
  assert.equal((await request(host, "startDraft")).ok, false);
  const joined = event(guest, "assign");
  guest.emit("joinRoom", { guestName: "Guest", roomCode: ` ${created.roomCode.toLowerCase()} ` });
  await joined;
  assert.equal((await request(guest, "startDraft")).ok, false);
  const hostState = event(host, "draftState", (state) => state.status === "drafting");
  const guestState = event(guest, "draftState", (state) => state.status === "drafting");
  assert.equal((await request(host, "startDraft")).ok, true);
  const firstHost = await hostState;
  const firstGuest = await guestState;
  const late = await connect();
  const rejected = event(late, "errorMessage");
  late.emit("joinRoom", { guestName: "Late", roomCode: created.roomCode });
  assert.match(await rejected, /already started/);
  const spectator = event(late, "draftState");
  late.emit("joinRoom", { asSpectator: true, roomCode: created.roomCode });
  const hidden = await spectator;
  assert.equal(hidden.myCurrentPack, null);
  assert.deepEqual(hidden.myPool, []);
  const locked = event(host, "draftState", (state) => state.myPool.length === 1);
  assert.equal((await request(host, "draftPick", { cardCopyId: firstHost.myCurrentPack.cards[0].draftCopyId })).ok, true);
  assert.equal((await locked).myCurrentPack.pickedThisPass, true);
  assert.equal((await request(host, "draftPick", { cardCopyId: firstHost.myCurrentPack.cards[1].draftCopyId })).ok, false);
  const passed = event(host, "draftState", (state) => state.pickNumber === 2);
  assert.equal((await request(guest, "draftPick", { cardCopyId: firstGuest.myCurrentPack.cards[0].draftCopyId })).ok, true);
  const next = await passed;
  assert.equal(next.myCurrentPack.id, firstGuest.myCurrentPack.id);
  assert.equal(next.myCurrentPack.cards.length, 7);
  assert.equal(next.myCurrentPack.pickedThisPass, false);
});
