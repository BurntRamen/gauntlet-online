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
process.env.ROOM_STATE_DATA_FILE = path.join(tempDirectory, "rooms.json");
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

function emitWithAck(socket, eventName, payload) {
  return new Promise((resolve) => (
    payload === undefined
      ? socket.emit(eventName, resolve)
      : socket.emit(eventName, payload, resolve)
  ));
}

before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  for (const socket of clients) socket.disconnect();
  __test.rooms.clear();
  __test.persistRoomsNow();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

test("two guests can recover a private Basic game after room memory is cleared", async () => {
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
  assert.equal(hostGame.rulesVersion, guestGame.rulesVersion);
  assert.ok(hostGame.revision > 0);
  assert.ok(Array.isArray(hostGame.legalActions));
  assert.ok(Array.isArray(guestGame.legalActions));
  assert.equal(hostGame.legalActions.length > 0, hostGame.priority === 1);
  assert.equal(guestGame.legalActions.length > 0, guestGame.priority === 2);

  const prioritySocket = hostGame.priority === 1 ? host : guest;
  const priorityState = hostGame.priority === 1 ? hostGame : guestGame;
  const commandId = "integration-pass-1";
  const updatedStatePromise = waitForEvent(
    prioritySocket,
    "state",
    (state) => state.revision > priorityState.revision
  );
  const commandAck = await emitWithAck(prioritySocket, "duelCommand", {
    commandId,
    baseRevision: priorityState.revision,
    command: { type: "passPriority" }
  });
  const updatedState = await updatedStatePromise;
  assert.equal(commandAck.accepted, true);
  assert.equal(commandAck.commandId, commandId);
  assert.equal(commandAck.revision, updatedState.revision);
  assert.equal(updatedState.revision, priorityState.revision + 1);

  const duplicateAck = await emitWithAck(prioritySocket, "duelCommand", {
    commandId,
    baseRevision: priorityState.revision,
    command: { type: "passPriority" }
  });
  assert.deepEqual(duplicateAck, commandAck);

  const conflictingAck = await emitWithAck(prioritySocket, "duelCommand", {
    commandId,
    baseRevision: priorityState.revision,
    command: { type: "concede" }
  });
  assert.equal(conflictingAck.accepted, false);
  assert.equal(conflictingAck.rejection.code, "COMMAND_ID_CONFLICT");

  const resyncAck = await emitWithAck(prioritySocket, "requestMatchState", { commandId });
  assert.equal(resyncAck.accepted, true);
  assert.equal(resyncAck.revision, updatedState.revision);
  assert.deepEqual(resyncAck.commandResult, commandAck);

  const staleAck = await emitWithAck(prioritySocket, "duelCommand", {
    commandId: "integration-stale",
    baseRevision: priorityState.revision,
    command: { type: "passPriority" }
  });
  assert.equal(staleAck.accepted, false);
  assert.equal(staleAck.rejection.code, "STALE_REVISION");

  const disconnectedStatePromise = waitForEvent(host, "state", (state) => !state.players[2].connected);
  guest.disconnect();
  const disconnectedState = await disconnectedStatePromise;
  assert.equal(disconnectedState.revision, updatedState.revision);
  host.disconnect();

  const persistence = __test.persistRoomsNow();
  assert.equal(persistence.saved, 1);
  __test.rooms.clear();
  const recovery = __test.initializeRoomRecovery(Date.parse("2026-07-16T12:00:00.000Z"));
  assert.equal(recovery.restored, 1);

  const recoveredHost = await connectClient();
  const hostReassignmentPromise = waitForEvent(recoveredHost, "assign");
  const recoveredHostStatePromise = waitForEvent(recoveredHost, "state", (state) => state.players[1].connected);
  recoveredHost.emit("reconnectToRoom", {
    roomCode: hostAssignment.roomCode,
    reconnectToken: hostAssignment.reconnectToken
  });
  const hostReassignment = await hostReassignmentPromise;
  const recoveredHostState = await recoveredHostStatePromise;
  assert.equal(hostReassignment.playerNum, 1);
  assert.equal(recoveredHostState.players[1].accountName, "Alpha");
  assert.ok(recoveredHostState.players[1].hand.length > 0);
  assert.equal(recoveredHostState.players[2].hand.length, 0);

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
  assert.equal(recoveredState.turn, disconnectedState.turn);
  assert.equal(recoveredState.priority, disconnectedState.priority);
  assert.equal(recoveredState.revision, disconnectedState.revision);
  assert.ok(recoveredState.players[2].hand.length > 0);
  assert.equal(recoveredState.players[1].hand.length, 0);
});

test("two live faction clients can submit an intended semantic faction ability exactly once", async () => {
  const host = await connectClient();
  const hostAssignmentPromise = waitForEvent(host, "assign");
  const hostLobbyPromise = waitForEvent(host, "lobbyState");
  host.emit("createRoom", { guestName: "Frumo One" });
  const hostAssignment = await hostAssignmentPromise;
  await hostLobbyPromise;

  const guest = await connectClient();
  const guestAssignmentPromise = waitForEvent(guest, "assign");
  const joinedLobbyPromise = waitForEvent(
    host,
    "lobbyState",
    (state) => state.players[2]?.accountName === "Frumo Two"
  );
  guest.emit("joinRoom", { roomCode: hostAssignment.roomCode, guestName: "Frumo Two" });
  const guestAssignment = await guestAssignmentPromise;
  await joinedLobbyPromise;

  const bothFrumoPromise = waitForEvent(
    host,
    "lobbyState",
    (state) => state.players[1]?.factionId === "frumo" && state.players[2]?.factionId === "frumo"
  );
  host.emit("selectFaction", { factionId: "frumo" });
  guest.emit("selectFaction", { factionId: "frumo" });
  await bothFrumoPromise;

  const hostReadyPromise = waitForEvent(host, "lobbyState", (state) => state.players[1].readyToStart);
  host.emit("startGame");
  await hostReadyPromise;

  const hostStatePromise = waitForEvent(host, "state", (state) => state.gameMode === "factions");
  const guestStatePromise = waitForEvent(guest, "state", (state) => state.gameMode === "factions");
  guest.emit("startGame");
  const hostState = await hostStatePromise;
  const guestState = await guestStatePromise;

  const priorityPlayer = hostState.priority;
  const prioritySocket = priorityPlayer === 1 ? host : guest;
  const priorityState = priorityPlayer === 1 ? hostState : guestState;
  const poleaAction = priorityState.legalActions.find(
    (action) => action.type === "useFactionAbility" && action.abilityId === "polea-place"
  );
  assert.ok(poleaAction);
  const card = priorityState.players[priorityPlayer].hand[0];
  const commandId = "integration-faction-polea-place";
  const nextStatePromise = waitForEvent(
    prioritySocket,
    "state",
    (state) => state.revision === priorityState.revision + 1
  );
  const acknowledgement = await emitWithAck(prioritySocket, "duelCommand", {
    commandId,
    baseRevision: priorityState.revision,
    command: {
      type: "useFactionAbility",
      abilityId: "polea-place",
      cardId: card.id,
      laneIndex: 0,
      targets: { cardId: card.id, laneIndex: 0 }
    }
  });
  const nextState = await nextStatePromise;

  assert.equal(acknowledgement.accepted, true);
  assert.equal(acknowledgement.revision, priorityState.revision + 1);
  assert.equal(nextState.lanes[0].facedown[priorityPlayer].id, card.id);
  assert.equal(nextState.players[priorityPlayer].hand.length, priorityState.players[priorityPlayer].hand.length - 1);

  const retryAcknowledgement = await emitWithAck(prioritySocket, "duelCommand", {
    commandId,
    baseRevision: priorityState.revision,
    command: {
      type: "useFactionAbility",
      abilityId: "polea-place",
      cardId: card.id,
      laneIndex: 0
    }
  });
  assert.deepEqual(retryAcknowledgement, acknowledgement);

  const otherSocket = priorityPlayer === 1 ? guest : host;
  const drawOfferedPromise = waitForEvent(
    otherSocket,
    "state",
    (state) => state.drawOfferBy === priorityPlayer
  );
  const drawOfferAcknowledgement = await emitWithAck(prioritySocket, "offerDraw");
  await drawOfferedPromise;
  assert.equal(drawOfferAcknowledgement.accepted, true);
  assert.match(drawOfferAcknowledgement.message, /sent/i);
  const drawDeclinedPromise = waitForEvent(
    prioritySocket,
    "state",
    (state) => state.drawOfferBy == null && /declined/i.test(state.message)
  );
  const drawResponseAcknowledgement = await emitWithAck(otherSocket, "respondDraw", { accept: false });
  const drawDeclinedState = await drawDeclinedPromise;
  assert.equal(drawResponseAcknowledgement.accepted, true);
  assert.match(drawResponseAcknowledgement.message, /declined/i);
  assert.equal(drawDeclinedState.phase, "priority");

  const undoOfferedPromise = waitForEvent(
    otherSocket,
    "state",
    (state) => state.undoRequest?.requester === priorityPlayer
  );
  const undoRequestAcknowledgement = await emitWithAck(prioritySocket, "requestUndo");
  const undoOfferedState = await undoOfferedPromise;
  assert.equal(undoRequestAcknowledgement.accepted, true);
  assert.match(undoRequestAcknowledgement.message, /sent/i);

  const undoApprovedPromise = waitForEvent(
    prioritySocket,
    "state",
    (state) => state.undoRequest == null && /undo approved/i.test(state.message)
  );
  const undoResponseAcknowledgement = await emitWithAck(otherSocket, "respondUndo", { approve: true });
  const undoApprovedState = await undoApprovedPromise;
  assert.equal(undoResponseAcknowledgement.accepted, true);
  assert.match(undoResponseAcknowledgement.message, /completed/i);
  assert.ok(undoApprovedState.revision > undoOfferedState.revision);
  assert.ok(undoApprovedState.snapshotSequence > undoOfferedState.snapshotSequence);

  const legacyPoleaStatePromise = waitForEvent(
    prioritySocket,
    "state",
    (state) => state.revision > undoApprovedState.revision && !!state.lanes[0].facedown[priorityPlayer]
  );
  const legacyPlacedCard = undoApprovedState.players[priorityPlayer].hand[0];
  prioritySocket.emit("usePolea", { mode: 1, handIndex: 0, lane: 0 });
  const legacyPoleaState = await legacyPoleaStatePromise;
  assert.equal(legacyPoleaState.lanes[0].facedown[priorityPlayer].id, legacyPlacedCard.id);
  assert.match(legacyPoleaState.lastCommandId, /-legacy-polea-/);

  const paymentIndexes = legacyPoleaState.players[priorityPlayer].hand.map((_, index) => index);
  const legacyAttackStatePromise = waitForEvent(
    prioritySocket,
    "state",
    (state) => state.revision > legacyPoleaState.revision && !!state.lanes[0].attack
  );
  prioritySocket.emit("confirmAttack", {
    from: "lane",
    lane: 0,
    attackCardIndex: null,
    paymentIndexes,
    useHeraBonus: false
  });
  const legacyAttackState = await legacyAttackStatePromise;
  assert.equal(legacyAttackState.lanes[0].attack.player, priorityPlayer);
  assert.match(legacyAttackState.lastCommandId, /-legacy-attack-/);

  const defenderPlayer = priorityPlayer === 1 ? 2 : 1;
  const defenderSocket = defenderPlayer === 1 ? host : guest;
  const legacyDeclineStatePromise = waitForEvent(
    defenderSocket,
    "state",
    (state) => state.revision > legacyAttackState.revision && state.priority === priorityPlayer
  );
  defenderSocket.emit("confirmBlock", {
    lane: 0,
    handAttackId: null,
    blockCardIndex: -1,
    blockCardIndexes: [],
    paymentIndexes: [],
    useHeraBonus: false
  });
  const legacyDeclineState = await legacyDeclineStatePromise;
  assert.ok(legacyDeclineState.lanes[0].attack);
  assert.match(legacyDeclineState.lastCommandId, /-legacy-block-/);

  const legacyResolutionPromise = waitForEvent(
    prioritySocket,
    "state",
    (state) => state.revision > legacyDeclineState.revision && !state.lanes[0].attack
  );
  prioritySocket.emit("passPriority");
  const legacyResolvedState = await legacyResolutionPromise;
  assert.equal(legacyResolvedState.priority, defenderPlayer);

  const legacyConcessionStatePromise = waitForEvent(
    prioritySocket,
    "state",
    (state) => state.phase === "gameOver" && state.winner === priorityPlayer
  );
  const legacyConcessionAck = await emitWithAck(defenderSocket, "concedeGame");
  const legacyConcessionState = await legacyConcessionStatePromise;
  assert.equal(legacyConcessionAck.accepted, true);
  assert.match(legacyConcessionState.lastCommandId, /-legacy-concede-/);

  host.disconnect();
  guest.disconnect();
});

test("a live constructed choice is explicit, card-ID based, and idempotent", async () => {
  const host = await connectClient();
  const hostAssignmentPromise = waitForEvent(host, "assign");
  const hostLobbyPromise = waitForEvent(host, "lobbyState");
  host.emit("createRoom", { guestName: "Constructed One" });
  const hostAssignment = await hostAssignmentPromise;
  await hostLobbyPromise;

  const guest = await connectClient();
  const guestAssignmentPromise = waitForEvent(guest, "assign");
  const joinedLobbyPromise = waitForEvent(
    host,
    "lobbyState",
    (state) => state.players[2]?.accountName === "Constructed Two"
  );
  guest.emit("joinRoom", {
    roomCode: hostAssignment.roomCode,
    guestName: "Constructed Two"
  });
  await guestAssignmentPromise;
  await joinedLobbyPromise;

  const bothRuminPromise = waitForEvent(
    host,
    "lobbyState",
    (state) => state.players[1]?.factionId === "rumin" && state.players[2]?.factionId === "rumin"
  );
  host.emit("selectFaction", { factionId: "rumin" });
  guest.emit("selectFaction", { factionId: "rumin" });
  await bothRuminPromise;

  const hostReadyPromise = waitForEvent(host, "lobbyState", (state) => state.players[1].readyToStart);
  host.emit("startGame");
  await hostReadyPromise;
  const hostStatePromise = waitForEvent(host, "state", (state) => state.gameMode === "factions");
  const guestStatePromise = waitForEvent(guest, "state", (state) => state.gameMode === "factions");
  guest.emit("startGame");
  const hostState = await hostStatePromise;
  const guestState = await guestStatePromise;

  const priorityPlayer = hostState.priority;
  const prioritySocket = priorityPlayer === 1 ? host : guest;
  const priorityState = priorityPlayer === 1 ? hostState : guestState;
  const roomState = __test.rooms.get(hostAssignment.roomCode);
  const actor = roomState.game.players[priorityPlayer];
  const attacker = actor.hand[0];
  const payment = actor.hand[1];
  Object.assign(attacker, {
    definitionId: "rumin-forum-ledger-runner",
    name: "Forum Ledger Runner",
    factionId: "rumin",
    type: "unit",
    value: 3,
    rank: "3"
  });
  Object.assign(payment, { value: 2, rank: "2" });

  const commandId = "integration-constructed-forum-ledger";
  const nextStatePromise = waitForEvent(
    prioritySocket,
    "state",
    (state) => state.revision === priorityState.revision + 1
  );
  const envelope = {
    commandId,
    baseRevision: priorityState.revision,
    command: {
      type: "declareHandAttack",
      cardId: attacker.id,
      attackerCardId: attacker.id,
      paymentCardIds: [payment.id],
      forumLedgerPaymentCardId: payment.id
    }
  };
  const acknowledgement = await emitWithAck(prioritySocket, "duelCommand", envelope);
  const nextState = await nextStatePromise;

  assert.equal(acknowledgement.accepted, true);
  assert.equal(nextState.handAttacks[0].card.definitionId, "rumin-forum-ledger-runner");
  assert.equal(nextState.handAttacks[0].payment.required, 3);
  assert.equal(nextState.handAttacks[0].payment.total, 3);
  assert.ok(nextState.lastEvents.some(
    (entry) => entry.type === "payment.modified" && entry.source === "constructed"
  ));

  const retryAcknowledgement = await emitWithAck(prioritySocket, "duelCommand", envelope);
  assert.deepEqual(retryAcknowledgement, acknowledgement);
  assert.equal(roomState.game.revision, priorityState.revision + 1);

  host.disconnect();
  guest.disconnect();
});

test("a semantic concession advances a best-of-three series without leaving the room", async () => {
  const host = await connectClient();
  const hostAssignmentPromise = waitForEvent(host, "assign");
  const hostLobbyPromise = waitForEvent(host, "lobbyState");
  host.emit("createRoom", { guestName: "Series One" });
  const hostAssignment = await hostAssignmentPromise;
  await hostLobbyPromise;

  const basicLobbyPromise = waitForEvent(host, "lobbyState", (state) => state.gameMode === "basic");
  host.emit("setGameMode", { mode: "basic" });
  await basicLobbyPromise;

  const guest = await connectClient();
  const guestAssignmentPromise = waitForEvent(guest, "assign");
  const joinedLobbyPromise = waitForEvent(
    host,
    "lobbyState",
    (state) => state.players[2]?.accountName === "Series Two"
  );
  guest.emit("joinRoom", { roomCode: hostAssignment.roomCode, guestName: "Series Two" });
  const guestAssignment = await guestAssignmentPromise;
  await joinedLobbyPromise;

  const hostReadyPromise = waitForEvent(host, "lobbyState", (state) => state.players[1].readyToStart);
  host.emit("startGame");
  await hostReadyPromise;
  const hostStatePromise = waitForEvent(host, "state", (state) => state.phase === "priority");
  const guestStatePromise = waitForEvent(guest, "state", (state) => state.phase === "priority");
  guest.emit("startGame");
  const hostState = await hostStatePromise;
  await guestStatePromise;

  const roomState = __test.rooms.get(hostAssignment.roomCode);
  roomState.seriesId = "integration-series";
  roomState.bestOf3Series = {
    bestOf: 3,
    targetWins: 2,
    gameNumber: 1,
    scores: { 1: 0, 2: 0 }
  };
  roomState.game.bestOf3Series = structuredClone(roomState.bestOf3Series);
  const firstMatchId = roomState.game.matchId;
  const nextGamePromise = waitForEvent(
    host,
    "state",
    (state) => (
      state.matchId !== firstMatchId
      && state.bestOf3Series?.gameNumber === 2
    )
  );
  const acknowledgement = await emitWithAck(host, "duelCommand", {
    commandId: "integration-series-concede",
    baseRevision: hostState.revision,
    command: { type: "concede" }
  });
  const nextGame = await nextGamePromise;

  assert.equal(acknowledgement.accepted, true);
  assert.notEqual(nextGame.matchId, firstMatchId);
  assert.equal(nextGame.phase, "priority");
  assert.equal(nextGame.bestOf3Series.gameNumber, 2);
  assert.deepEqual(nextGame.bestOf3Series.scores, { 1: 0, 2: 1 });
  assert.equal(roomState.lifecycle.status, "active");
  assert.equal(roomState.lobby.players[1].connected, true);
  assert.equal(roomState.lobby.players[2].connected, true);

  const disconnectedStatePromise = waitForEvent(
    host,
    "state",
    (state) => state.matchId === nextGame.matchId && state.players[2].connected === false
  );
  guest.disconnect();
  await disconnectedStatePromise;

  const reconnectedGuest = await connectClient();
  const reassignmentPromise = waitForEvent(reconnectedGuest, "assign");
  const rehydratedGamePromise = waitForEvent(
    reconnectedGuest,
    "state",
    (state) => state.matchId === nextGame.matchId && state.players[2].connected === true
  );
  reconnectedGuest.emit("reconnectToRoom", {
    roomCode: guestAssignment.roomCode,
    reconnectToken: guestAssignment.reconnectToken
  });
  const reassignment = await reassignmentPromise;
  const rehydratedGame = await rehydratedGamePromise;
  assert.equal(reassignment.playerNum, 2);
  assert.equal(rehydratedGame.bestOf3Series.gameNumber, 2);
  assert.deepEqual(rehydratedGame.bestOf3Series.scores, { 1: 0, 2: 1 });

  host.disconnect();
  reconnectedGuest.disconnect();
});
