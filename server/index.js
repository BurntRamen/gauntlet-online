const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

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

// ============ GAME STATE STORAGE ============
const rooms = new Map();

function makeReconnectToken() {
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function createRoom() {
  const roomCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  const roomState = {
    roomCode,
    lobby: {
      players: {
        1: { socket: null, connected: false, factionId: null, reconnectToken: null },
        2: { socket: null, connected: false, factionId: null, reconnectToken: null }
      },
      spectators: []
    },
    game: null
  };
  rooms.set(roomCode, roomState);
  return roomState;
}

function getRoom(roomCode) {
  return rooms.get(roomCode);
}

function deleteRoom(roomCode) {
  rooms.delete(roomCode);
}

function getRoomForSocket(socket) {
  for (const [code, room] of rooms) {
    if (room.lobby.players[1].socket === socket.id ||
        room.lobby.players[2].socket === socket.id ||
        room.lobby.spectators.includes(socket.id)) {
      return room;
    }
  }
  return null;
}

function emitLobbyState(roomState) {
  io.to(roomState.roomCode).emit("lobbyState", {
    roomCode: roomState.roomCode,
    players: roomState.lobby.players,
    factions: [],
    spectatorCount: roomState.lobby.spectators.length
  });
}

function emitState(roomState) {
  if (!roomState.game) return;
  io.to(roomState.roomCode).emit("state", {
    ...roomState.game,
    spectatorCount: roomState.lobby.spectators.length
  });
}

// ============ FACTION DATA ============
const factions = {
  rumin: { id: "rumin", name: "Rumin", commander: { name: "Rumin Commander", text: "Commander ability" }, general: { name: "Rumin General", text: "General ability" }, city: { name: "Rumin City", text: "City ability" } },
  sheen: { id: "sheen", name: "Sheen", commander: { name: "Sheen Commander", text: "Commander ability" }, general: { name: "Sheen General", text: "General ability" }, city: { name: "Sheen City", text: "City ability" } },
  frumo: { id: "frumo", name: "Frumo", commander: { name: "Frumo Commander", text: "Commander ability" }, general: { name: "Frumo General", text: "General ability" }, city: { name: "Frumo City", text: "City ability" } },
  bizi: { id: "bizi", name: "Bizi", commander: { name: "Bizi Commander", text: "Commander ability" }, general: { name: "Bizi General", text: "General ability" }, city: { name: "Bizi City", text: "City ability" } }
};

function listFactions() {
  return Object.values(factions);
}

function getFactionById(id) {
  return factions[id] || null;
}

// ============ HELPER FUNCTIONS ============
function getOtherPlayer(playerNum) {
  return playerNum === 1 ? 2 : 1;
}

function getPlayerNumberBySocket(roomState, socketId) {
  if (roomState.lobby.players[1].socket === socketId) return 1;
  if (roomState.lobby.players[2].socket === socketId) return 2;
  return null;
}

function roomPlayersReady(roomState) {
  return roomState.lobby.players[1].factionId && roomState.lobby.players[2].factionId;
}

function resetPriorityPassed(game) {
  game.priorityPassed = { 1: false, 2: false };
}

function removeIndexesFromHandToDiscard(player, indexes) {
  const sorted = [...indexes].sort((a, b) => b - a);
  for (const idx of sorted) {
    if (idx >= 0 && idx < player.hand.length) {
      player.discard.push(player.hand[idx]);
      player.hand.splice(idx, 1);
    }
  }
}

function registerCardPlayed(player, card) {
  player.turnData.previousPlayedValue = card?.value || 0;
  return [];
}

function calculateAttackBonuses(player, card) {
  return [];
}

function getAttackPaymentRequirement(player, card) {
  return { required: card?.value || 0, freeAttackUsed: false };
}

function getPaymentTotal(player, paymentIndexes, useHeraBonus) {
  let total = 0;
  for (const idx of paymentIndexes) {
    if (player.hand[idx]) total += player.hand[idx].value || 0;
  }
  return { total, heraUsedNow: false };
}

function finalizeAttackDeclaration(player, card, notes, freeUsed) {
  return { effectiveValue: card?.value || 0, notes: [] };
}

function applyBlockBonuses(player, card) {
  return { effectiveValue: card?.value || 0, notes: [] };
}

function finalizeBlockDeclaration(player) {}

function addAccelerationIfOverpaid(player, paid, required) {}

function hasPendingAttacks(game) {
  return (game.handAttacks && game.handAttacks.length > 0) ||
    (game.lanes && game.lanes.some(l => l.attack));
}

function getBaseCardValue(card) {
  if (!card) return 0;
  const value = card.value;
  if (value === "A" || value === 14) return 14;
  if (value === "K" || value === 13) return 13;
  if (value === "Q" || value === 12) return 12;
  if (value === "J" || value === 11) return 11;
  return Number(value) || 0;
}

function resolveDamage(game) {
  // Simple damage resolution
  for (const attack of game.handAttacks) {
    let totalBlock = 0;
    for (const block of attack.block) {
      totalBlock += block.effectiveValue || 0;
    }
    const damage = Math.max(0, (attack.effectiveValue || 0) - totalBlock);
    if (damage > 0) {
      const defender = getOtherPlayer(attack.player);
      game.players[defender].life -= damage;
      game.message = `Attack dealt ${damage} damage to Player ${defender}`;
    }
  }
  for (let i = 0; i < game.lanes.length; i++) {
    const lane = game.lanes[i];
    if (lane.attack) {
      let totalBlock = 0;
      for (const block of lane.block) {
        totalBlock += block.effectiveValue || 0;
      }
      const damage = Math.max(0, (lane.attack.effectiveValue || 0) - totalBlock);
      if (damage > 0) {
        const defender = getOtherPlayer(lane.attack.player);
        game.players[defender].life -= damage;
        game.message = `Lane attack dealt ${damage} damage to Player ${defender}`;
      }
      lane.attack = null;
      lane.block = [];
    }
  }
  game.handAttacks = [];
}

function reopenPriorityAfterDamage(game) {
  game.phase = "priority";
  resetPriorityPassed(game);
  game.priority = game.lastActivePlayer || 1;
}

function startEndPhase(game) {
  game.phase = "end";
  game.endPlacementLaneIndex = 0;
  game.endPlacementFirstPlayer = game.lastActivePlayer === 1 ? 2 : 1;
  game.endPlacementStep = 0;
  game.endPlaced = { 1: [false, false, false], 2: [false, false, false] };
}

function advanceEndPlacement(game) {
  game.endPlacementStep++;
  if (game.endPlacementStep >= 2) {
    game.endPlacementLaneIndex++;
    game.endPlacementStep = 0;
  }
  if (game.endPlacementLaneIndex >= 3) {
    game.phase = "priority";
    game.turn++;
    game.lastActivePlayer = getOtherPlayer(game.lastActivePlayer);
    game.priority = game.lastActivePlayer;
    resetPriorityPassed(game);
    for (const p of [1, 2]) {
      game.players[p].turnData = {
        attacksDeclaredThisTurn: 0,
        blocksDeclaredThisTurn: 0,
        previousAttackSuit: null,
        previousPlayedValue: null,
        poleaUsed: false,
        lafayetteUsed: false,
        focusBuffUsed: false,
        heraUsed: false
      };
    }
  }
}

function createGameFromLobby(roomState) {
  const game = {
    roomCode: roomState.roomCode,
    phase: "priority",
    turn: 1,
    priority: 1,
    lastActivePlayer: 1,
    priorityPassed: { 1: false, 2: false },
    players: {
      1: {
        faction: getFactionById(roomState.lobby.players[1].factionId),
        life: 42,
        hand: [],
        deck: [],
        discard: [],
        lanes: [null, null, null],
        connected: true,
        turnData: {
          attacksDeclaredThisTurn: 0,
          blocksDeclaredThisTurn: 0,
          previousAttackSuit: null,
          previousPlayedValue: null,
          poleaUsed: false,
          lafayetteUsed: false,
          focusBuffUsed: false,
          heraUsed: false
        },
        accelerationCounters: 0
      },
      2: {
        faction: getFactionById(roomState.lobby.players[2].factionId),
        life: 42,
        hand: [],
        deck: [],
        discard: [],
        lanes: [null, null, null],
        connected: true,
        turnData: {
          attacksDeclaredThisTurn: 0,
          blocksDeclaredThisTurn: 0,
          previousAttackSuit: null,
          previousPlayedValue: null,
          poleaUsed: false,
          lafayetteUsed: false,
          focusBuffUsed: false,
          heraUsed: false
        },
        accelerationCounters: 0
      }
    },
    lanes: [
      { facedown: { 1: null, 2: null }, attack: null, block: [] },
      { facedown: { 1: null, 2: null }, attack: null, block: [] },
      { facedown: { 1: null, 2: null }, attack: null, block: [] }
    ],
    handAttacks: [],
    endPlacementLaneIndex: 0,
    endPlacementFirstPlayer: null,
    endPlacementStep: 0,
    endPlaced: { 1: [false, false, false], 2: [false, false, false] },
    winner: null,
    message: ""
  };
  
  // Generate sample hands for testing
  for (const p of [1, 2]) {
    for (let i = 0; i < 8; i++) {
      game.players[p].hand.push({
        id: `card-${p}-${i}`,
        value: Math.floor(Math.random() * 13) + 1,
        suit: ["♠", "♥", "♦", "♣"][Math.floor(Math.random() * 4)],
        name: `Card ${i+1}`
      });
    }
  }
  
  roomState.game = game;
}

// ============ SOCKET HANDLERS ============
io.on("connection", (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);
  
  socket.on("createRoom", () => {
    console.log("[Socket] createRoom");
    const roomState = createRoom();
    roomState.lobby.players[1].socket = socket.id;
    roomState.lobby.players[1].connected = true;
    socket.join(roomState.roomCode);
    socket.data.roomCode = roomState.roomCode;
    socket.data.role = "player";
    socket.data.playerNum = 1;
    socket.emit("assign", { role: "player", playerNum: 1, roomCode: roomState.roomCode });
    emitLobbyState(roomState);
  });

  socket.on("joinRoom", ({ roomCode, asSpectator = false }) => {
    console.log(`[Socket] joinRoom: ${roomCode}, spectator: ${asSpectator}`);
    const normalized = roomCode.toUpperCase();
    const roomState = getRoom(normalized);
    if (!roomState) {
      socket.emit("errorMessage", "Room not found.");
      return;
    }
    if (asSpectator) {
      roomState.lobby.spectators.push(socket.id);
      socket.join(normalized);
      socket.data.roomCode = normalized;
      socket.data.role = "spectator";
      socket.emit("assignSpectator", { role: "spectator", roomCode: normalized });
      if (roomState.game) emitState(roomState);
      else emitLobbyState(roomState);
      return;
    }
    if (!roomState.lobby.players[2].socket) {
      roomState.lobby.players[2].socket = socket.id;
      roomState.lobby.players[2].connected = true;
      socket.join(normalized);
      socket.data.roomCode = normalized;
      socket.data.role = "player";
      socket.data.playerNum = 2;
      socket.emit("assign", { role: "player", playerNum: 2, roomCode: normalized });
      emitLobbyState(roomState);
      return;
    }
    socket.emit("errorMessage", "Room is full.");
  });

  socket.on("selectFaction", ({ factionId }) => {
    console.log(`[Socket] selectFaction: ${factionId}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState || roomState.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    roomState.lobby.players[playerNum].factionId = factionId;
    emitLobbyState(roomState);
  });

  socket.on("startGame", () => {
    console.log(`[Socket] startGame`);
    const roomState = getRoomForSocket(socket);
    if (!roomState || roomState.game) return;
    if (!roomPlayersReady(roomState)) {
      socket.emit("errorMessage", "Both players must select factions first.");
      return;
    }
    createGameFromLobby(roomState);
    emitState(roomState);
  });

  socket.on("passPriority", () => {
    console.log(`[Socket] passPriority`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    if (game.phase !== "priority") return;
    if (game.priority !== playerNum) return;
    
    game.priorityPassed[playerNum] = true;
    game.priority = getOtherPlayer(playerNum);
    
    if (game.priorityPassed[1] && game.priorityPassed[2]) {
      if (hasPendingAttacks(game)) {
        game.phase = "damage";
      } else {
        startEndPhase(game);
      }
    }
    emitState(roomState);
  });

  socket.on("resolveDamage", () => {
    console.log(`[Socket] resolveDamage`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const game = roomState.game;
    if (game.phase !== "damage") return;
    resolveDamage(game);
    reopenPriorityAfterDamage(game);
    emitState(roomState);
  });

  socket.on("confirmAttack", (data) => {
    console.log(`[Socket] confirmAttack:`, data);
    // Simplified attack handling
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    
    game.handAttacks.push({
      id: `attack-${Date.now()}`,
      player: playerNum,
      card: { value: 5, suit: "♠", name: "Test Card" },
      effectiveValue: 5,
      block: []
    });
    game.priority = getOtherPlayer(playerNum);
    resetPriorityPassed(game);
    game.message = `Player ${playerNum} attacked!`;
    emitState(roomState);
  });

  socket.on("confirmBlock", (data) => {
    console.log(`[Socket] confirmBlock:`, data);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    
    if (data.handAttackId && game.handAttacks.length > 0) {
      game.handAttacks[0].block.push({
        player: playerNum,
        card: { value: 4, suit: "♥", name: "Block Card" },
        effectiveValue: 4
      });
      game.message = `Player ${playerNum} blocked!`;
    }
    game.priority = getOtherPlayer(playerNum);
    resetPriorityPassed(game);
    emitState(roomState);
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    const roomState = getRoomForSocket(socket);
    if (roomState) {
      for (const p of [1, 2]) {
        if (roomState.lobby.players[p].socket === socket.id) {
          roomState.lobby.players[p].connected = false;
          roomState.lobby.players[p].socket = null;
        }
      }
      if (roomState.game) emitState(roomState);
      else emitLobbyState(roomState);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});