const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { before, after, test } = require("node:test");
const { io } = require("socket.io-client");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-session-regressions-"));
for (const [key, file] of Object.entries({ ACCOUNT_DATA_FILE: "accounts.json", MATCH_DATA_FILE: "matches.json", FACTION_STATS_DATA_FILE: "factions.json", ROOM_STATE_DATA_FILE: "rooms.json" })) {
  process.env[key] = path.join(directory, file);
}
process.env.SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";
process.env.ROOM_STATE_RECOVERY_ENABLED = "false";
const { server, __test } = require("../index");
let url;
const sockets = [];
function event(socket, name, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, receive); reject(new Error(`Missing ${name}`)); }, 3000);
    function receive(value) { if (predicate(value)) { clearTimeout(timer); socket.off(name, receive); resolve(value); } }
    socket.on(name, receive);
  });
}
async function connect() {
  const socket = io(url, { autoConnect: false, transports: ["websocket"] });
  sockets.push(socket);
  const connected = event(socket, "connect");
  socket.connect();
  await connected;
  return socket;
}
async function create(socket, name) {
  const assigned = event(socket, "assign");
  socket.emit("createRoom", { guestName: name });
  return assigned;
}
async function action(socket, name, payload) {
  socket.emit(name, ...(payload === undefined ? [] : [payload]));
  await new Promise((resolve) => socket.emit("requestMatchState", {}, resolve));
}
async function enter(socket, name, payload) {
  const assigned = event(socket, "assign");
  await action(socket, name, payload);
  return assigned;
}
async function freeForAll(count = 4) {
  const players = [await connect()];
  const assignment = await enter(players[0], "createFreeForAllRoom", { guestName: "FFA Host" });
  for (let i = 1; i < count; i++) {
    players.push(await connect());
    await enter(players[i], "joinRoom", { roomCode: assignment.roomCode, guestName: `FFA ${i}` });
  }
  for (const socket of players) await action(socket, "selectFaction", { factionId: "rumin" });
  for (const socket of players) await action(socket, "startGame");
  return { players, room: __test.rooms.get(assignment.roomCode) };
}
before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

test("ranked carries each chosen faction and General from queue through the live match", async () => {
  async function register(suffix) {
    const response = await fetch(`${url}/api/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: `Mekan${Date.now()}${suffix}`, password: "MekanRankedTest42!" }) });
    assert.equal(response.ok, true);
    return response.json();
  }
  const a = await register("a");
  const b = await register("b");
  const first = await connect();
  const second = await connect();
  const legacyQueued = event(second, "matchmakingStatus", (status) => status.inQueue);
  second.emit("joinMatchmaking", { authToken: b.token });
  assert.equal((await legacyQueued).inQueue, true);
  await action(second, "leaveMatchmaking");
  const queued = event(first, "matchmakingStatus", (status) => status.inQueue);
  first.emit("joinMatchmaking", { authToken: a.token, factionId: "mekan", generalId: "hui" });
  await queued;
  const matchedFirst = event(first, "assign");
  const matchedSecond = event(second, "assign");
  second.emit("joinMatchmaking", { authToken: b.token, factionId: "bizi" });
  const [seat, opponent] = await Promise.all([matchedFirst, matchedSecond]);
  const room = __test.rooms.get(seat.roomCode);
  assert.equal(room.lobby.players[seat.playerNum].factionId, "mekan");
  assert.equal(room.lobby.players[seat.playerNum].generalId, "hui");
  assert.equal(room.lobby.players[opponent.playerNum].factionId, "bizi");
  await action(first, "startGame");
  await action(second, "startGame");
  assert.equal(room.game.gameMode, "factions");
  assert.equal(room.game.players[seat.playerNum].faction.general.id, "hui");
  assert.equal(room.ranked, true);
  first.disconnect(); second.disconnect();
});
after(async () => {
  sockets.forEach((socket) => socket.disconnect());
  await new Promise(setImmediate);
  __test.rooms.clear();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(directory, { recursive: true, force: true });
});

test("malformed unauthenticated socket inputs are rejected without killing the server", async () => {
  const socket = await connect();
  for (const [name, payload] of [["selectFaction", null], ["joinRoom", { roomCode: 12345 }], ["createRoom", []], ["confirmAttack", "bad"], ["joinMatchmaking", null], ["setDraftDeckAdditions", { selections: {} }]]) {
    const response = await new Promise((resolve) => socket.emit(name, payload, resolve));
    assert.equal(response.accepted, false);
    assert.equal(response.rejection.code, "INVALID_PAYLOAD");
  }
  assert.equal((await fetch(`${url}/api/game-content`)).status, 200);
  assert.equal((await create(socket, "Still Alive")).playerNum, 1);
  socket.disconnect();
});

test("a guest name cannot reclaim a seat but its reconnect token can", async () => {
  const host = await connect();
  const original = await create(host, "Shared Name");
  const room = __test.rooms.get(original.roomCode);
  host.disconnect();
  for (let i = 0; i < 30 && room.lobby.players[1].connected; i++) await new Promise((resolve) => setTimeout(resolve, 10));
  const stranger = await connect();
  const joined = event(stranger, "assign");
  stranger.emit("joinRoom", { roomCode: original.roomCode, guestName: "Shared Name" });
  const assignment = await joined;
  assert.equal(assignment.playerNum, 2);
  assert.notEqual(assignment.reconnectToken, original.reconnectToken);
  const returning = await connect();
  const recovered = event(returning, "assign");
  returning.emit("joinRoom", { roomCode: original.roomCode, guestName: "Shared Name", reconnectToken: original.reconnectToken });
  assert.equal((await recovered).playerNum, 1);
  returning.disconnect();
  stranger.disconnect();
});

test("rapid room creation and joining cannot create multiple memberships", async () => {
  const host = await connect();
  const assignments = [];
  host.on("assign", (value) => assignments.push(value));
  const assigned = event(host, "assign");
  const rejected = event(host, "errorMessage", (message) => /Leave your current room/.test(message));
  host.emit("createRoom", { guestName: "Rapid Host" });
  host.emit("createRoom", { guestName: "Rapid Host" });
  const original = await assigned;
  await rejected;
  assert.equal(assignments.length, 1);
  const mode = event(host, "lobbyState", (state) => state.gameMode === "basic");
  host.emit("setGameMode", { mode: "basic" });
  assert.equal((await mode).roomCode, original.roomCode);
  const otherHost = await connect();
  const other = await create(otherHost, "Other Host");
  const refusal = await new Promise((resolve) => host.emit("joinRoom", { roomCode: other.roomCode, asSpectator: true }, resolve));
  assert.equal(refusal.rejection.code, "ALREADY_IN_ROOM");
  assert.equal(__test.rooms.get(other.roomCode).lobby.spectators.includes(host.id), false);
  host.disconnect();
  otherHost.disconnect();
});

test("free-for-all completion archives replay frames with the authoritative match ID", async () => {
  const host = await connect();
  const assigned = event(host, "assign");
  host.emit("createFreeForAllRoom", { guestName: "FFA Archive" });
  const { roomCode } = await assigned;
  const room = __test.rooms.get(roomCode);
  for (const player of Object.values(room.lobby.players)) {
    player.connected = true;
    player.factionId = "rumin";
  }
  __test.createFreeForAllGameFromLobby(room);
  assert.equal(room.game.matchId, room.matchMetadata.matchId);
  for (const player of Object.values(room.game.players)) {
    for (const card of [...player.hand, ...player.deck]) {
      assert.ok(["♠", "♥", "♦", "♣"].includes(card.suit));
    }
  }
  room.game.phase = "gameOver";
  room.game.winner = 4;
  await __test.recordFinalGameStats(room, { completionReason: "concession" });
  assert.equal(room.game.statsRecorded, true);
  assert.equal(room.matchMetadata.recordedMatchId, room.game.matchId);
  assert.ok(await __test.matchArchive.findById(room.game.matchId));
  host.disconnect();
});

test("free-for-all placement survives concessions at every placement step", async () => {
  for (let step = 0; step < 12; step++) {
    const { players, room } = await freeForAll();
    const game = room.game;
    for (let p = 0; p < 4; p++) await action(players[game.priority - 1], "passPriority");
    const actor = () => __test.sanitizeGameForViewer(game, 1, 0).currentEndPlacementPlayer;
    for (let i = 0; i < step; i++) await action(players[actor() - 1], "skipEndPlacement", { lane: game.endPlacementLaneIndex });
    // Remove the starting player, including after that player's opportunity.
    await action(players[game.endPlacementFirstPlayer - 1], "concedeGame");
    let actions = 0;
    while (game.phase === "end" && actions++ < 12) {
      const next = actor();
      assert.ok(next && !game.players[next].eliminated);
      assert.equal(game.endPlaced[next][game.endPlacementLaneIndex], false);
      await action(players[next - 1], "skipEndPlacement", { lane: game.endPlacementLaneIndex });
    }
    assert.equal(game.turn, 2);
    assert.equal(game.phase, "priority");
    players.forEach((socket) => socket.disconnect());
  }
});

test("conceding attacker or defender clears pending combat and leaves active priority", async () => {
  for (const departing of ["attacker", "defender"]) {
    const { players, room } = await freeForAll();
    const game = room.game;
    const attacker = game.priority;
    const defender = attacker === 4 ? 1 : attacker + 1;
    const hand = game.players[attacker].hand;
    const index = hand.reduce((best, card, i) => card.value < hand[best].value ? i : best, 0);
    const cardId = hand[index].id;
    await action(players[attacker - 1], "confirmAttack", { from: "hand", attackCardIndex: index, paymentIndexes: hand.map((_, i) => i).filter((i) => i !== index), targetPlayer: defender });
    assert.equal(game.handAttacks.length, 1);
    await action(players[(departing === "attacker" ? attacker : defender) - 1], "concedeGame");
    assert.equal(game.handAttacks.length, 0);
    assert.ok(game.players[attacker].discard.some((card) => card.id === cardId));
    assert.equal(game.players[game.priority].eliminated, false);
    for (let i = 0; i < 3; i++) await action(players[game.priority - 1], "passPriority");
    assert.equal(game.phase, "end");
    players.forEach((socket) => socket.disconnect());
  }
});

test("started games and drafts reject new seats but allow spectators and reconnects", async () => {
  const ffa = await freeForAll(2);
  const host = await connect(), guest = await connect();
  const draftAssignment = await enter(host, "createDraftRoom", { guestName: "Draft Host" });
  const guestAssignment = await enter(guest, "joinRoom", { roomCode: draftAssignment.roomCode, guestName: "Draft Guest" });
  await action(host, "startDraft");
  for (const roomCode of [ffa.room.roomCode, draftAssignment.roomCode]) {
    const late = await connect();
    const rejected = event(late, "errorMessage");
    await action(late, "joinRoom", { roomCode, guestName: "Late Player" });
    assert.match(await rejected, /already started/);
    const spectating = event(late, "assignSpectator");
    await action(late, "joinRoom", { roomCode, asSpectator: true });
    await spectating;
    late.disconnect();
  }
  guest.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 20));
  const replacement = await connect();
  const recovered = await enter(replacement, "joinRoom", { roomCode: draftAssignment.roomCode, guestName: "Draft Guest", reconnectToken: guestAssignment.reconnectToken });
  assert.equal(recovered.playerNum, 2);
  [host, replacement, ...ffa.players].forEach((socket) => socket.disconnect());
});

test("intentional lobby leave releases the seat and clears prior readiness", async () => {
  const host = await connect(), guest = await connect();
  const assignment = await create(host, "Host");
  await enter(guest, "joinRoom", { roomCode: assignment.roomCode, guestName: "Guest" });
  const room = __test.rooms.get(assignment.roomCode);
  await action(host, "setGameMode", { mode: "basic" });
  await action(host, "startGame");
  await action(guest, "leaveRoom");
  assert.equal(room.lobby.players[1].readyToStart, false);
  const replacement = await connect();
  assert.equal((await enter(replacement, "joinRoom", { roomCode: assignment.roomCode, guestName: "Replacement" })).playerNum, 2);
  [host, guest, replacement].forEach((socket) => socket.disconnect());
});

test("only seated drafters can cancel a draft with a disconnected participant", async () => {
  const host = await connect(), guest = await connect(), watcher = await connect();
  const assignment = await enter(host, "createDraftRoom", { guestName: "Draft Host" });
  await enter(guest, "joinRoom", { roomCode: assignment.roomCode, guestName: "Draft Guest" });
  await action(watcher, "joinRoom", { roomCode: assignment.roomCode, asSpectator: true });
  await action(host, "startDraft");
  const room = __test.rooms.get(assignment.roomCode);
  await action(host, "cancelDraft");
  assert.equal(room.draft.status, "drafting");
  await action(guest, "leaveRoom");
  await action(watcher, "cancelDraft");
  assert.equal(room.draft.status, "drafting");
  await action(host, "cancelDraft");
  assert.equal(room.draft.status, "cancelled");
  const card = room.draft.currentPacks[1].cards[0];
  await action(host, "draftPick", { cardCopyId: card.draftCopyId });
  assert.equal(room.draft.draftedPools[1].length, 0);
  [host, guest, watcher].forEach((socket) => socket.disconnect());
});
