const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const { listFactions, getFactionById } = require("./game/factions");
const { createRoom, getRoom, deleteRoom, getRoomForSocket } = require("./game/roomStore");
const { createGameFromLobby } = require("./game/gameFactory");
const {
  getOtherPlayer,
  getPlayerNumberBySocket,
  roomPlayersReady,
  resetPriorityPassed,
  removeIndexesFromHandToDiscard,
  registerCardPlayed,
  calculateAttackBonuses,
  getAttackPaymentRequirement,
  getPaymentTotal,
  finalizeAttackDeclaration,
  applyBlockBonuses,
  finalizeBlockDeclaration,
  addAccelerationIfOverpaid,
  hasPendingAttacks,
  resolveDamage,
  reopenPriorityAfterDamage,
  currentEndPlacementPlayer,
  startEndPhase,
  advanceEndPlacement,
  getBaseCardValue
} = require("./game/gameLogic");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});



app.get("/", (_req, res) => {
  res.send("Gauntlet server is running.");
});

function makeReconnectToken() {
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function emitLobbyState(roomState) {
  io.to(roomState.roomCode).emit("lobbyState", {
    roomCode: roomState.roomCode,
    players: roomState.lobby.players,
    factions: listFactions(),
    spectatorCount: roomState.lobby.spectators.length
  });
}

function emitState(roomState) {
  io.to(roomState.roomCode).emit("state", {
    ...roomState.game,
    spectatorCount: roomState.lobby.spectators.length
  });
}

function emitPeek(socketId, text) {
  io.to(socketId).emit("peekResult", text);
}

function hasIncomingAttackAgainst(game, playerNum) {
  const opponent = playerNum === 1 ? 2 : 1;

  const incomingHandAttack = game.handAttacks.some(
    (attack) => attack.player === opponent
  );

  const incomingLaneAttack = game.lanes.some(
    (lane) => lane.attack && lane.attack.player === opponent
  );

  return incomingHandAttack || incomingLaneAttack;
}

function assignPlayerSeat(roomState, playerNum, socket) {
  const seat = roomState.lobby.players[playerNum];
  if (!seat.reconnectToken) {
    seat.reconnectToken = makeReconnectToken();
  }
  seat.socket = socket.id;
  seat.connected = true;

  socket.join(roomState.roomCode);
  socket.data.roomCode = roomState.roomCode;
  socket.data.role = "player";
  socket.data.playerNum = playerNum;

  socket.emit("assign", {
    role: "player",
    playerNum,
    reconnectToken: seat.reconnectToken,
    roomCode: roomState.roomCode
  });
}

function assignSpectator(roomState, socket) {
  roomState.lobby.spectators.push(socket.id);

  socket.join(roomState.roomCode);
  socket.data.roomCode = roomState.roomCode;
  socket.data.role = "spectator";
  socket.data.playerNum = null;

  socket.emit("assignSpectator", {
    role: "spectator",
    roomCode: roomState.roomCode
  });
}

function tryReconnect(roomState, reconnectToken, socket) {
  for (const p of [1, 2]) {
    const lobbySeat = roomState.lobby.players[p];
    if (lobbySeat.reconnectToken && lobbySeat.reconnectToken === reconnectToken) {
      lobbySeat.socket = socket.id;
      lobbySeat.connected = true;

      socket.join(roomState.roomCode);
      socket.data.roomCode = roomState.roomCode;
      socket.data.role = "player";
      socket.data.playerNum = p;

      socket.emit("assign", {
        role: "player",
        playerNum: p,
        reconnectToken: lobbySeat.reconnectToken,
        roomCode: roomState.roomCode
      });

      if (roomState.game) {
        roomState.game.players[p].socket = socket.id;
        roomState.game.players[p].connected = true;
        emitState(roomState);
      } else {
        emitLobbyState(roomState);
      }
      return true;
    }
  }

  if (roomState.game) {
    for (const p of [1, 2]) {
      const gp = roomState.game.players[p];
      if (gp.reconnectToken && gp.reconnectToken === reconnectToken) {
        gp.socket = socket.id;
        gp.connected = true;

        roomState.lobby.players[p].socket = socket.id;
        roomState.lobby.players[p].connected = true;

        socket.join(roomState.roomCode);
        socket.data.roomCode = roomState.roomCode;
        socket.data.role = "player";
        socket.data.playerNum = p;

        socket.emit("assign", {
          role: "player",
          playerNum: p,
          reconnectToken: gp.reconnectToken,
          roomCode: roomState.roomCode
        });

        emitState(roomState);
        return true;
      }
    }
  }

  return false;
}

io.on("connection", (socket) => {
  socket.on("createRoom", () => {
    const roomState = createRoom();
    assignPlayerSeat(roomState, 1, socket);
    emitLobbyState(roomState);
  });

  socket.on("joinRoom", ({ roomCode, asSpectator = false }) => {
    const normalized = String(roomCode || "").trim().toUpperCase();
    const roomState = getRoom(normalized);

    if (!roomState) {
      socket.emit("errorMessage", "Room not found.");
      return;
    }

    if (asSpectator) {
      assignSpectator(roomState, socket);
      if (roomState.game) emitState(roomState);
      else emitLobbyState(roomState);
      return;
    }

    if (!roomState.lobby.players[2].socket && !roomState.game) {
      assignPlayerSeat(roomState, 2, socket);
      emitLobbyState(roomState);
      return;
    }

    socket.emit("errorMessage", "Player seats are full. Join as spectator instead.");
  });

  socket.on("reconnectToRoom", ({ roomCode, reconnectToken }) => {
    const normalized = String(roomCode || "").trim().toUpperCase();
    const roomState = getRoom(normalized);

    if (!roomState || !reconnectToken) return;

    const ok = tryReconnect(roomState, reconnectToken, socket);
    if (!ok) {
      socket.emit("errorMessage", "Reconnect failed. Join the room again.");
    }
  });

  socket.on("selectFaction", ({ factionId }) => {
    const roomState = getRoomForSocket(socket);
    if (!roomState || roomState.game) return;
    if (socket.data.role !== "player") return;

    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;

    const faction = getFactionById(factionId);
    if (!faction) return;

    roomState.lobby.players[playerNum].factionId = factionId;
    emitLobbyState(roomState);
  });

  socket.on("startGame", () => {
    const roomState = getRoomForSocket(socket);
    if (!roomState || roomState.game) return;
    if (socket.data.role !== "player") return;

    if (!roomPlayersReady(roomState)) {
      socket.emit("errorMessage", "Both players must join and select a faction first.");
      return;
    }

    createGameFromLobby(roomState);

    for (const p of [1, 2]) {
      roomState.game.players[p].reconnectToken = roomState.lobby.players[p].reconnectToken;
      roomState.game.players[p].connected = roomState.lobby.players[p].connected;
      roomState.game.players[p].socket = roomState.lobby.players[p].socket;
    }

    emitState(roomState);
  });

  socket.on("usePolea", (payload) => {
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game || roomState.game.winner) return;
    if (socket.data.role !== "player") return;
    const game = roomState.game;

    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const player = game.players[playerNum];
    if (player.faction.id !== "frumo") return;
    if (game.phase !== "priority") return;
    if (game.priority !== playerNum) return;
    if (player.turnData.poleaUsed) return;

    const { mode } = payload;

    if (mode === 1) {
      const lane = Number(payload.lane);
      const handIndex = Number(payload.handIndex);
      if (lane < 0 || lane > 2) return;
      if (handIndex < 0 || handIndex >= player.hand.length) return;
      if (game.lanes[lane].facedown[playerNum]) return;

      const card = player.hand.splice(handIndex, 1)[0];
      const notes = registerCardPlayed(player, card);
      game.lanes[lane].facedown[playerNum] = card;
      player.turnData.poleaUsed = true;
      game.message = `Player ${playerNum} used Polea to place a card in lane ${lane + 1}.${notes.length ? ` ${notes.join(", ")}` : ""}`;
    }

    if (mode === 2) {
      const laneA = Number(payload.laneA);
      const laneB = Number(payload.laneB);
      if (laneA < 0 || laneA > 2 || laneB < 0 || laneB > 2) return;

      const temp = game.lanes[laneA].facedown[playerNum];
      game.lanes[laneA].facedown[playerNum] = game.lanes[laneB].facedown[playerNum];
      game.lanes[laneB].facedown[playerNum] = temp;

      player.turnData.poleaUsed = true;
      game.message = `Player ${playerNum} used Polea to switch lane positions.`;
    }

    if (mode === 3) {
      const targetPlayer = Number(payload.targetPlayer);
      const lane = Number(payload.lane);
      if (![1, 2].includes(targetPlayer)) return;
      if (lane < 0 || lane > 2) return;

      const card = game.lanes[lane].facedown[targetPlayer];
      const text = card
        ? `Peeked card in Player ${targetPlayer} lane ${lane + 1}: ${card.value}${card.suit} (${card.name})`
        : `No face-down card in Player ${targetPlayer} lane ${lane + 1}.`;

      emitPeek(socket.id, text);
      player.turnData.poleaUsed = true;
      game.message = `Player ${playerNum} used Polea to look at a face-down card.`;
    }

    if (mode === 4) {
      const targetType = payload.targetType;

      if (targetType === "laneCard") {
        const lane = Number(payload.lane);
        if (lane < 0 || lane > 2) return;
        const card = game.lanes[lane].facedown[playerNum];
        if (!card) return;
        card.tempBuff = (card.tempBuff || 0) + 1;
      }

      if (targetType === "laneAttack") {
        const lane = Number(payload.lane);
        if (lane < 0 || lane > 2) return;
        const attack = game.lanes[lane].attack;
        if (!attack || attack.player !== playerNum) return;
        attack.effectiveValue += 1;
        attack.notes = [...(attack.notes || []), "Polea +1"];
      }

      if (targetType === "handAttack") {
        const attack = game.handAttacks.find((a) => a.id === payload.handAttackId);
        if (!attack || attack.player !== playerNum) return;
        attack.effectiveValue += 1;
        attack.notes = [...(attack.notes || []), "Polea +1"];
      }

      player.turnData.poleaUsed = true;
      game.message = `Player ${playerNum} used Polea to grant +1 value until end of turn.`;
    }

    emitState(roomState);
  });

  socket.on("useLafayette", ({ lane, handIndex }) => {
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game || roomState.game.winner) return;
    if (socket.data.role !== "player") return;
    const game = roomState.game;

    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const player = game.players[playerNum];
    if (player.faction.id !== "frumo") return;
    if (game.phase !== "priority") return;
    if (game.priority !== playerNum) return;
    if (player.turnData.lafayetteUsed) return;

    lane = Number(lane);
    handIndex = Number(handIndex);

    if (lane < 0 || lane > 2) return;
    if (handIndex < 0 || handIndex >= player.hand.length) return;

    const laneCard = game.lanes[lane].facedown[playerNum];
    if (!laneCard) return;

    const handCard = player.hand[handIndex];
    const handNotes = registerCardPlayed(player, handCard);

    player.hand[handIndex] = laneCard;
    game.lanes[lane].facedown[playerNum] = handCard;
    player.turnData.lafayetteUsed = true;
    game.message = `Player ${playerNum} used Lafayette to swap a lane card with a hand card.${handNotes.length ? ` ${handNotes.join(", ")}` : ""}`;

    emitState(roomState);
  });

  socket.on("useFocusBuff", ({ targetType, lane, handAttackId }) => {
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game || roomState.game.winner) return;
    if (socket.data.role !== "player") return;
    const game = roomState.game;

    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const player = game.players[playerNum];
    if (player.faction.id !== "bizi") return;
    if (game.phase !== "priority") return;
    if (game.priority !== playerNum) return;
    if (player.turnData.focusBuffUsed) return;
    if (player.accelerationCounters <= 0) return;

    if (targetType === "laneCard") {
      lane = Number(lane);
      if (lane < 0 || lane > 2) return;
      const card = game.lanes[lane].facedown[playerNum];
      if (!card) return;
      card.tempBuff = (card.tempBuff || 0) + 1;
    }

    if (targetType === "laneAttack") {
      lane = Number(lane);
      if (lane < 0 || lane > 2) return;
      const attack = game.lanes[lane].attack;
      if (!attack || attack.player !== playerNum) return;
      attack.effectiveValue += 1;
      attack.notes = [...(attack.notes || []), "Focus +1"];
    }

    if (targetType === "handAttack") {
      const attack = game.handAttacks.find((a) => a.id === handAttackId);
      if (!attack || attack.player !== playerNum) return;
      attack.effectiveValue += 1;
      attack.notes = [...(attack.notes || []), "Focus +1"];
    }

    player.accelerationCounters -= 1;
    player.turnData.focusBuffUsed = true;
    game.message = `Player ${playerNum} used Focus to give +1 value until end of turn.`;
    emitState(roomState);
  });

    socket.on("passPriority", () => {
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game || roomState.game.winner) return;
    if (socket.data.role !== "player") return;
    const game = roomState.game;

    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    if (game.phase !== "priority") return;
    if (game.priority !== playerNum) return;

        if (hasPendingAttacks(game)) {
      socket.emit(
        "errorMessage",
        "You cannot declare a new attack until the current attack is blocked or damage resolves."
      );
      return;
    }

    game.priorityPassed[playerNum] = true;
    game.priority = getOtherPlayer(playerNum);

    if (game.priorityPassed[1] && game.priorityPassed[2]) {
      startEndPhase(game);
    }

    emitState(roomState);
  });

  socket.on("confirmAttack", ({ from, lane, attackCardIndex, paymentIndexes, useHeraBonus }) => {
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game || roomState.game.winner) return;
    if (socket.data.role !== "player") return;
    const game = roomState.game;

    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    if (game.phase !== "priority") return;
    if (game.priority !== playerNum) return;
    if (!Array.isArray(paymentIndexes)) return;

    if (hasIncomingAttackAgainst(game, playerNum)) {
      socket.emit(
        "errorMessage",
        "You cannot declare a new attack while you have an unresolved incoming attack."
      );
      return;
    }

    const player = game.players[playerNum];
    let attackCard = null;

    if (from === "hand") {
      if (attackCardIndex == null) return;
      if (attackCardIndex < 0 || attackCardIndex >= player.hand.length) return;
      if (paymentIndexes.includes(attackCardIndex)) return;

      attackCard = player.hand[attackCardIndex];
      if (!attackCard) return;

      const paymentRequirement = getAttackPaymentRequirement(player, attackCard);
      const payment = getPaymentTotal(player, paymentIndexes, useHeraBonus);
      if (payment.total < paymentRequirement.required) return;

      const playNotes = registerCardPlayed(player, attackCard);
      const attackNotes = calculateAttackBonuses(player, attackCard);

      attackCard = player.hand.splice(attackCardIndex, 1)[0];

      const adjustedPaymentIndexes = paymentIndexes.map((i) =>
        i > attackCardIndex ? i - 1 : i
      );

      removeIndexesFromHandToDiscard(player, adjustedPaymentIndexes);

      if (payment.heraUsedNow) player.turnData.heraUsed = true;
      addAccelerationIfOverpaid(player, payment.total, paymentRequirement.required);

      const finalAttack = finalizeAttackDeclaration(
        player,
        attackCard,
        attackNotes,
        paymentRequirement.freeAttackUsed
      );

      game.handAttacks.push({
        id: `hand-attack-${Math.random().toString(36).slice(2, 9)}`,
        player: playerNum,
        card: attackCard,
        source: "hand",
        effectiveValue: finalAttack.effectiveValue,
        notes: [
          ...playNotes,
          ...finalAttack.notes,
          ...(paymentRequirement.freeAttackUsed ? ["Meerus free attack"] : []),
          ...(payment.heraUsedNow ? ["Hera +2 payment"] : [])
        ],
        block: []
      });
    } else if (from === "lane") {
      lane = Number(lane);
      if (lane < 0 || lane > 2) return;

      const currentLane = game.lanes[lane];
      if (currentLane.attack) return;

      attackCard = currentLane.facedown[playerNum];
      if (!attackCard) return;

      const paymentRequirement = getAttackPaymentRequirement(player, attackCard);
      const payment = getPaymentTotal(player, paymentIndexes, useHeraBonus);
      if (payment.total < paymentRequirement.required) return;

      const playNotes = registerCardPlayed(player, attackCard);
      const attackNotes = calculateAttackBonuses(player, attackCard);

      removeIndexesFromHandToDiscard(player, paymentIndexes);
      currentLane.facedown[playerNum] = null;

      if (payment.heraUsedNow) player.turnData.heraUsed = true;
      addAccelerationIfOverpaid(player, payment.total, paymentRequirement.required);

      const finalAttack = finalizeAttackDeclaration(
        player,
        attackCard,
        attackNotes,
        paymentRequirement.freeAttackUsed
      );

      currentLane.attack = {
        player: playerNum,
        card: attackCard,
        source: "lane",
        effectiveValue: finalAttack.effectiveValue,
        notes: [
          ...playNotes,
          ...finalAttack.notes,
          ...(paymentRequirement.freeAttackUsed ? ["Meerus free attack"] : []),
          ...(payment.heraUsedNow ? ["Hera +2 payment"] : [])
        ]
      };
    } else {
      return;
    }

    game.lastDefender = getOtherPlayer(playerNum);
    resetPriorityPassed(game);
    game.priority = getOtherPlayer(playerNum);
    game.message = `Player ${playerNum} attacked${from === "hand" ? " from hand" : ` in lane ${lane + 1}`}. Defending player has priority to respond or block.`;

    emitState(roomState);
  });

  socket.on("confirmBlock", ({ lane, handAttackId, blockCardIndex, paymentIndexes, useHeraBonus }) => {
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game || roomState.game.winner) return;
    if (socket.data.role !== "player") return;
    const game = roomState.game;

    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    if (game.phase !== "priority") return;
    if (game.priority !== playerNum) return;
    if (!Array.isArray(paymentIndexes)) return;

    const player = game.players[playerNum];

    if (handAttackId) {
      const attack = game.handAttacks.find((a) => a.id === handAttackId);
      if (!attack) {
        socket.emit("errorMessage", "That hand attack could not be found.");
        return;
      }

      const defender = getOtherPlayer(attack.player);
      if (playerNum !== defender) {
        socket.emit("errorMessage", "You are not the defender for that hand attack.");
        return;
      }

      if (blockCardIndex == null) {
        socket.emit("errorMessage", "Choose a blocking card.");
        return;
      }

      if (blockCardIndex < 0 || blockCardIndex >= player.hand.length) {
        socket.emit("errorMessage", "Invalid blocking card.");
        return;
      }

      if (paymentIndexes.includes(blockCardIndex)) {
        socket.emit("errorMessage", "Your blocking card cannot also be used as payment.");
        return;
      }

      let blockCard = player.hand[blockCardIndex];
      if (!blockCard) {
        socket.emit("errorMessage", "That blocking card no longer exists.");
        return;
      }

      const payment = getPaymentTotal(player, paymentIndexes, useHeraBonus);
           const blockRequired = getBaseCardValue(blockCard);

      if (payment.total < blockRequired) {
        socket.emit(
          "errorMessage",
          `Not enough payment to block. Need ${blockRequired}, but only have ${payment.total}.`
        );
        return;
      }

      const playNotes = registerCardPlayed(player, blockCard);

      blockCard = player.hand.splice(blockCardIndex, 1)[0];

      const adjustedPaymentIndexes = paymentIndexes.map((i) =>
        i > blockCardIndex ? i - 1 : i
      );

      removeIndexesFromHandToDiscard(player, adjustedPaymentIndexes);

      if (payment.heraUsedNow) player.turnData.heraUsed = true;
            addAccelerationIfOverpaid(player, payment.total, blockRequired);

      const blockInfo = applyBlockBonuses(player, blockCard);

      attack.block.push({
        player: playerNum,
        card: blockCard,
        source: "hand",
        effectiveValue: blockInfo.effectiveValue,
        notes: [
          ...playNotes,
          ...blockInfo.notes,
          ...(payment.heraUsedNow ? ["Hera +2 payment"] : [])
        ]
      });

      finalizeBlockDeclaration(player);
      resetPriorityPassed(game);
      game.priority = getOtherPlayer(playerNum);
      game.message = `Player ${playerNum} blocked a hand attack. Priority passes back.`;

      emitState(roomState);
      return;
    }

    lane = Number(lane);
    if (lane < 0 || lane > 2) {
      socket.emit("errorMessage", "Invalid lane for block.");
      return;
    }

    const currentLane = game.lanes[lane];
    if (!currentLane.attack) {
      socket.emit("errorMessage", "There is no attack in that lane to block.");
      return;
    }

    const defender = getOtherPlayer(currentLane.attack.player);
    if (playerNum !== defender) {
      socket.emit("errorMessage", "You are not the defender for that lane attack.");
      return;
    }

    let laneBlockCard = currentLane.facedown[playerNum];
    if (!laneBlockCard) {
      socket.emit("errorMessage", "There is no card in that lane to block with.");
      return;
    }

    const payment = getPaymentTotal(player, paymentIndexes, useHeraBonus);
       const laneBlockRequired = getBaseCardValue(laneBlockCard);

    if (payment.total < laneBlockRequired) {
      socket.emit(
        "errorMessage",
        `Not enough payment to block. Need ${laneBlockRequired}, but only have ${payment.total}.`
      );
      return;
    }

    const playNotes = registerCardPlayed(player, laneBlockCard);

    removeIndexesFromHandToDiscard(player, paymentIndexes);
    currentLane.facedown[playerNum] = null;

    if (payment.heraUsedNow) player.turnData.heraUsed = true;
        addAccelerationIfOverpaid(player, payment.total, laneBlockRequired);

    const blockInfo = applyBlockBonuses(player, laneBlockCard);

    currentLane.block.push({
      player: playerNum,
      card: laneBlockCard,
      source: "lane",
      effectiveValue: blockInfo.effectiveValue,
      notes: [
        ...playNotes,
        ...blockInfo.notes,
        ...(payment.heraUsedNow ? ["Hera +2 payment"] : [])
      ]
    });

    finalizeBlockDeclaration(player);
    resetPriorityPassed(game);
    game.priority = getOtherPlayer(playerNum);
    game.message = `Player ${playerNum} blocked in lane ${lane + 1}. Priority passes back.`;

    emitState(roomState);
  });

  socket.on("resolveDamage", () => {
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game || roomState.game.winner) return;
    if (socket.data.role !== "player") return;
    const game = roomState.game;

    if (game.phase !== "damage") return;

    resolveDamage(game);

    if (!game.winner) {
      reopenPriorityAfterDamage(game);
    }

    emitState(roomState);
  });

  socket.on("placeFacedown", ({ lane, handIndex }) => {
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game || roomState.game.winner) return;
    if (socket.data.role !== "player") return;
    const game = roomState.game;

    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    if (game.phase !== "end") return;
    if (lane == null || Number(lane) !== game.endPlacementLaneIndex) return;
    if (handIndex == null) return;
    if (playerNum !== currentEndPlacementPlayer(game)) return;

    const player = game.players[playerNum];
    const currentLane = game.lanes[Number(lane)];

    if (game.endPlaced[playerNum][Number(lane)]) return;
    if (currentLane.facedown[playerNum]) return;
    if (handIndex < 0 || handIndex >= player.hand.length) return;

    const card = player.hand.splice(handIndex, 1)[0];
    const playNotes = registerCardPlayed(player, card);
    currentLane.facedown[playerNum] = card;
    game.endPlaced[playerNum][Number(lane)] = true;

    game.message = `Player ${playerNum} placed a facedown card in lane ${Number(lane) + 1}.${playNotes.length ? ` ${playNotes.join(", ")}` : ""}`;

    advanceEndPlacement(game);
    emitState(roomState);
  });

  socket.on("skipEndPlacement", ({ lane }) => {
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game || roomState.game.winner) return;
    if (socket.data.role !== "player") return;
    const game = roomState.game;

    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    if (game.phase !== "end") return;
    if (lane == null || Number(lane) !== game.endPlacementLaneIndex) return;
    if (playerNum !== currentEndPlacementPlayer(game)) return;

    if (game.endPlaced[playerNum][Number(lane)]) return;

    game.endPlaced[playerNum][Number(lane)] = true;
    game.message = `Player ${playerNum} skipped lane ${Number(lane) + 1} placement.`;

    advanceEndPlacement(game);
    emitState(roomState);
  });

  socket.on("disconnect", () => {
    const roomState = getRoomForSocket(socket);
    if (!roomState) return;

    const roomCode = roomState.roomCode;

    if (socket.data.role === "spectator") {
      roomState.lobby.spectators = roomState.lobby.spectators.filter((id) => id !== socket.id);
      if (roomState.game) emitState(roomState);
      else emitLobbyState(roomState);
      return;
    }

    if (roomState.game) {
      for (const p of [1, 2]) {
        if (roomState.game.players[p].socket === socket.id) {
          roomState.game.players[p].socket = null;
          roomState.game.players[p].connected = false;
          roomState.lobby.players[p].socket = null;
          roomState.lobby.players[p].connected = false;
        }
      }
      emitState(roomState);
    } else {
      for (const p of [1, 2]) {
        if (roomState.lobby.players[p].socket === socket.id) {
          roomState.lobby.players[p].socket = null;
          roomState.lobby.players[p].connected = false;
        }
      }
      emitLobbyState(roomState);

      const noPlayers =
        !roomState.lobby.players[1].socket &&
        !roomState.lobby.players[2].socket &&
        roomState.lobby.spectators.length === 0;

      if (noPlayers) {
        deleteRoom(roomCode);
      }
    }
  });
});


server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});