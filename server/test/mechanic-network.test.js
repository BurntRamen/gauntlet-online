const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path"), crypto = require("node:crypto");
const { io } = require("socket.io-client");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-mechanic-network-"));
for (const [key, file] of Object.entries({ ACCOUNT_DATA_FILE: "accounts.json", MATCH_DATA_FILE: "matches.json", FACTION_STATS_DATA_FILE: "factions.json", ROOM_STATE_DATA_FILE: "rooms.json", GAUNTLET_CONTENT_DATA_DIR: "content", MATCH_ARCHIVE_DATA_DIR: "archives" })) process.env[key] = path.join(directory, file);
for (const key of ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "GAUNTLET_ROOM_STATE_PROVIDER", "GAUNTLET_OPERATIONAL_PROVIDER", "GAUNTLET_PRIVATE_AUTHORING_PROVIDER", "GAUNTLET_RUNTIME_BACKUPS"]) delete process.env[key];
process.env.ROOM_STATE_RECOVERY_ENABLED = "true"; process.env.GAUNTLET_CONTENT_PROVIDER = "file"; process.env.NODE_ENV = "test";
const { server, __test } = require("../index"), contract = require("../../shared/duel-rules/mechanicContract");
const clients = []; let origin;
test.before(async () => { await new Promise(resolve => server.listen(0, "127.0.0.1", resolve)); origin = `http://127.0.0.1:${server.address().port}`; });
test.after(async () => {
  clients.forEach(socket => socket.disconnect()); __test.rooms.clear(); await __test.persistRoomsNow();
  await new Promise(resolve => server.close(resolve));
  assert.equal(path.dirname(directory), os.tmpdir()); assert.ok(path.basename(directory).startsWith("gauntlet-mechanic-network-")); fs.rmSync(directory, { recursive: true, force: true });
});
function event(socket, name, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, receive); reject(new Error(`Missing ${name}`)); }, 15000);
    const receive = value => { if (predicate(value)) { clearTimeout(timer); socket.off(name, receive); resolve(value); } }; socket.on(name, receive);
  });
}
async function connect() { const socket = io(origin, { autoConnect: false, transports: ["websocket"], reconnection: false }); clients.push(socket); const ready = event(socket, "connect"); socket.connect(); await ready; return socket; }
async function enter(socket, operation, payload) { const assigned = event(socket, "assign"); socket.emit(operation, payload); return assigned; }
const basic = (id, value) => ({ id, value, rank: String(value), suit: "spades", name: id });
function mechanic(optional) {
  const definition = { id: "mechanic-11111111-1111-4111-8111-111111111111", name: "Network fixture", interpreter: 2, status: "active", cardTypes: ["servitor"], abilities: [{ ...contract.ability("attack", 2), decision: optional ? "optional" : "automatic", cost: { payment: optional ? 3 : 0, life: 0, counters: 0, consumeSource: false }, effects: [{ kind: "attackBonus", amount: 2, duration: "combat" }, { kind: "damage", amount: 1, duration: "instant" }] }] };
  assert.deepEqual(contract.errors(definition), []);
  return { ...basic("authored-source", 4), factionId: "rumin", type: "servitor", effect: { id: contract.ID, version: 2, mechanicId: definition.id, definition, revision: crypto.createHash("sha256").update(JSON.stringify(definition)).digest("hex") } };
}
async function room(count = 2) {
  const sockets = [await connect()], seats = [await enter(sockets[0], count > 2 ? "createFreeForAllRoom" : "createRoom", { guestName: "Fixture host" })];
  for (let p = 2; p <= count; p++) { sockets.push(await connect()); seats.push(await enter(sockets[p - 1], "joinRoom", { roomCode: seats[0].roomCode, guestName: `Fixture ${p}` })); }
  const value = __test.rooms.get(seats[0].roomCode); value.lobby.gameMode = count > 2 ? "freeForAll" : "factions";
  for (const player of Object.values(value.lobby.players)) player.factionId = "rumin";
  if (count > 2) __test.createFreeForAllGameFromLobby(value); else __test.createGameFromLobby(value, { seed: "network-fixture" });
  value.game.priority = 1; value.game.contentBinding = { ...value.game.contentBinding, mechanicVersion: contract.VERSION2 };
  return { sockets, seats, value };
}
for (const timeout of [false, true]) test(`queued paid mechanic survives reconnect and ${timeout ? "times out without payment" : "executes exactly once"} through the production socket`, { timeout: 90000 }, async () => {
  const fixture = await room(), { sockets, seats } = fixture; let value = fixture.value;
  value.game.players[1].hand = [mechanic(true), basic("attack-payment", 8), basic("decision-payment", 3)];
  const receive = event(sockets[0], "state", state => !!state.mechanicDecision);
  const accepted = await sockets[0].timeout(20000).emitWithAck("duelCommand", { commandId: "attack", baseRevision: value.game.revision, command: { type: "declareHandAttack", cardId: "authored-source", paymentCardIds: ["attack-payment"] } });
  assert.equal(accepted.accepted, true); const offered = await receive;
  assert.equal(offered.mechanicQueue, undefined); assert.ok(offered.legalActions.some(action => action.decline));
  assert.equal(value.game.players[2].life, 42);
  const deadline = value.game.mechanicQueue[0].deadline; assert.ok(deadline > Date.now());
  sockets.forEach(socket => socket.disconnect()); await __test.persistRoomsNow();
  // Startup recovery deliberately initializes once. The first case loads from
  // disk; the second verifies a normal reconnect and timeout on that process.
  if (!timeout) { __test.rooms.clear(); await __test.initializeRoomRecovery(); }
  const returned = await connect(), stateEvent = event(returned, "state", state => !!state.mechanicDecision);
  returned.emit("reconnectToRoom", seats[0]); const state = await stateEvent;
  value = __test.rooms.get(seats[0].roomCode); assert.equal(value.game.mechanicQueue[0].deadline, deadline);
  const other = await connect(), otherState = event(other, "state"); other.emit("reconnectToRoom", seats[1]); const view = await otherState;
  assert.equal(view.players[1].hand.length, 0); assert.equal(view.legalActions.length, 0);
  const choice = state.legalActions.find(action => !action.decline), command = { type: choice.type, ...choice.confirmationPayload.fixed, paymentCardIds: ["decision-payment"] };
  const denied = await other.timeout(20000).emitWithAck("duelCommand", { commandId: "wrong-controller", baseRevision: value.game.revision, command }); assert.equal(denied.accepted, false);
  if (timeout) {
    await __test.sweepRoomLifecycle({ now: deadline + 1 });
    assert.equal(value.game.mechanicQueue.length, 0); assert.equal(value.game.handAttacks[0].effectiveValue, 4);
    assert.ok(value.game.players[1].hand.some(card => card.id === "decision-payment")); assert.equal(value.game.players[2].life, 42);
  } else {
    const envelope = { commandId: "choose-and-pay", baseRevision: value.game.revision, command };
    const ack = await returned.timeout(20000).emitWithAck("duelCommand", envelope); assert.equal(ack.accepted, true);
    assert.equal(value.game.handAttacks[0].effectiveValue, 6); assert.equal(value.game.players[2].life, 41);
    assert.equal(value.game.players[1].discard.filter(card => card.id === "decision-payment").length, 1);
    assert.deepEqual(await returned.timeout(20000).emitWithAck("duelCommand", envelope), ack);
  }
  returned.disconnect(); other.disconnect(); __test.deleteRoom(value.roomCode);
});
test("four-player transport executes authored combat against the selected opponent only", { timeout: 90000 }, async () => {
  const { sockets, value } = await room(4), game = value.game; game.priority = 3;
  game.players[3].hand = [mechanic(false), basic("payment", 8)];
  const stateEvent = event(sockets[2], "state", state => state.handAttacks?.length === 1);
  sockets[2].emit("confirmAttack", { from: "hand", attackCardIndex: 0, paymentIndexes: [1], targetPlayer: 4 });
  await stateEvent;
  assert.equal(game.handAttacks[0].effectiveValue, 6); assert.equal(game.players[4].life, 41);
  assert.equal(game.players[1].life, 42); assert.equal(game.players[2].life, 42);
  assert.equal(__test.sanitizeGameForViewer(game, 1).players[3].hand.length, 0);
  sockets.forEach(socket => socket.disconnect()); __test.deleteRoom(value.roomCode);
});
