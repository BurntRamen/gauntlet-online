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

// ============ FACTION DATA (FULL VERSION) ============
const factionsData = {
  rumin: {
    id: "rumin",
    name: "Rumin",
    commander: { name: "Emperor Nu", text: "Your blocking cards get +1 value. If this is your third or later block this turn, they get +2 instead." },
    general: { name: "Tang", text: "When you block for the second time in a turn, gain 2 life." },
    city: { name: "Rumie, City of the Empire", text: "Your first two attacks each turn that share a suit with your previous attack get +1 value." }
  },
  sheen: {
    id: "sheen",
    name: "Sheen",
    commander: { name: "Sheen Commander", text: "Your healing abilities are 50% more effective." },
    general: { name: "Sheen General", text: "Once per turn, you may heal a servitor for 3." },
    city: { name: "Sheen City", text: "Your servitors have +2 health." }
  },
  frumo: {
    id: "frumo",
    name: "Frumo",
    commander: { name: "Lord Commander Polea", text: "Once per turn, choose one: place a card from hand into empty lane, switch lanes of 2 cards, or look at 1 face-down card." },
    general: { name: "Lafayette", text: "Once per turn, you may swap a lane card with a card from your hand." },
    city: { name: "Constanti, Technology Hub", text: "Once per turn, if you've played a card of a suit this turn, you may use a card of the same suit to pay 1 less." }
  },
  bizi: {
    id: "bizi",
    name: "Bizi",
    commander: { name: "Overlord Tesla", text: "Cards you play remain on the battlefield instead of being discarded." },
    general: { name: "Gridmaster Volt", text: "Cards adjacent to another card of the same suit get +1 value." },
    city: { name: "Voltspire", text: "Whenever you play a card, you may place it adjacent to another card." }
  }
};

function listFactions() {
  return Object.values(factionsData);
}

function getFactionById(id) {
  return factionsData[id] || null;
}

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
    factions: listFactions(),
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
  const bonuses = [];
  const faction = player.faction?.id;
  
  // Rumin: Emperor Nu - blocking bonus (handled in block)
  // Rumin: Tang - block healing (handled in block)
  // Rumin: Rumie - first two attacks sharing suit get +1
  if (faction === "rumin" && player.turnData.attacksDeclaredThisTurn < 2) {
    if (player.turnData.previousAttackSuit === card?.suit && player.turnData.attacksDeclaredThisTurn > 0) {
      bonuses.push("Rumie +1 (shared suit)");
      return { value: 1, notes: bonuses };
    }
  }
  
  return { value: 0, notes: bonuses };
}

function getAttackPaymentRequirement(player, card) {
  // Bizi: Overlord Tesla - cards remain (different mechanic)
  // For now, standard requirement
  return { required: card?.value || 0, freeAttackUsed: false };
}

function getPaymentTotal(player, paymentIndexes, useHeraBonus) {
  let total = 0;
  for (const idx of paymentIndexes) {
    if (player.hand[idx]) total += player.hand[idx].value || 0;
  }
  // Bizi: Hera bonus - +2 payment if available
  let heraUsedNow = false;
  if (useHeraBonus && player.faction?.id === "bizi" && !player.turnData.heraUsed) {
    total += 2;
    heraUsedNow = true;
  }
  return { total, heraUsedNow };
}

function finalizeAttackDeclaration(player, card, attackBonus, freeUsed) {
  let effectiveValue = (card?.value || 0) + (attackBonus.value || 0);
  const notes = [...attackBonus.notes];
  
  // Rumin: Tang - block healing handled elsewhere
  // Rumin: Emperor Nu - block bonus handled elsewhere
  
  if (freeUsed) notes.push("Meerus free attack");
  
  player.turnData.attacksDeclaredThisTurn++;
  player.turnData.previousAttackSuit = card?.suit;
  
  return { effectiveValue, notes };
}

function applyBlockBonuses(player, card) {
  let effectiveValue = card?.value || 0;
  const notes = [];
  const faction = player.faction?.id;
  
  // Rumin: Emperor Nu - blocking cards get +1 value
  if (faction === "rumin") {
    effectiveValue += 1;
    notes.push("Emperor Nu +1");
    // Third block or later gets +2 instead
    if (player.turnData.blocksDeclaredThisTurn >= 2) {
      effectiveValue += 1;
      notes.push("Emperor Nu third block +2");
    }
  }
  
  return { effectiveValue, notes };
}

function finalizeBlockDeclaration(player) {
  player.turnData.blocksDeclaredThisTurn++;
}

function addAccelerationIfOverpaid(player, paid, required) {
  // Bizi: Banking excess value as acceleration counters
  if (player.faction?.id === "bizi" && paid > required) {
    player.accelerationCounters = (player.accelerationCounters || 0) + (paid - required);
  }
}

function hasPendingAttacks(game) {
  return (game.handAttacks && game.handAttacks.length > 0) ||
    (game.lanes && game.lanes.some(l => l.attack));
}

function getBaseCardValue(card) {
  if (!card) return 0;
  const value = card.value;
  if (value === "A" || value === 14 || value === "14") return 14;
  if (value === "K" || value === 13 || value === "13") return 13;
  if (value === "Q" || value === 12 || value === "12") return 12;
  if (value === "J" || value === 11 || value === "11") return 11;
  return Number(value) || 0;
}

function resolveDamage(game) {
  // Process hand attacks
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
  // Process lane attacks
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
  
  // Rumin: Tang - gain 2 life on second block (check turnData)
  for (const p of [1, 2]) {
    if (game.players[p].faction?.id === "rumin" && game.players[p].turnData.blocksDeclaredThisTurn >= 2) {
      game.players[p].life += 2;
      game.message = `Player ${p} gained 2 life from Tang`;
    }
  }
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
  const faction1 = getFactionById(roomState.lobby.players[1].factionId);
  const faction2 = getFactionById(roomState.lobby.players[2].factionId);
  
  const game = {
    roomCode: roomState.roomCode,
    phase: "priority",
    turn: 1,
    priority: 1,
    lastActivePlayer: 1,
    priorityPassed: { 1: false, 2: false },
    players: {
      1: {
        faction: faction1,
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
        faction: faction2,
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
  
  // Generate sample hands for testing (using standard card values)
  const suits = ["♠", "♥", "♦", "♣"];
  const values = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const rankNames = { 11: "J", 12: "Q", 13: "K", 14: "A" };
  
  for (const p of [1, 2]) {
    for (let i = 0; i < 8; i++) {
      const value = values[Math.floor(Math.random() * values.length)];
      const suit = suits[Math.floor(Math.random() * suits.length)];
      game.players[p].hand.push({
        id: `card-${p}-${i}-${Date.now()}-${Math.random()}`,
        value: value,
        suit: suit,
        name: `${rankNames[value] || value} of ${suit}`,
        rank: rankNames[value] || String(value)
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
    roomState.lobby.players[1].reconnectToken = makeReconnectToken();
    socket.join(roomState.roomCode);
    socket.data.roomCode = roomState.roomCode;
    socket.data.role = "player";
    socket.data.playerNum = 1;
    socket.emit("assign", { 
      role: "player", 
      playerNum: 1, 
      roomCode: roomState.roomCode,
      reconnectToken: roomState.lobby.players[1].reconnectToken
    });
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
      roomState.lobby.players[2].reconnectToken = makeReconnectToken();
      socket.join(normalized);
      socket.data.roomCode = normalized;
      socket.data.role = "player";
      socket.data.playerNum = 2;
      socket.emit("assign", { 
        role: "player", 
        playerNum: 2, 
        roomCode: normalized,
        reconnectToken: roomState.lobby.players[2].reconnectToken
      });
      emitLobbyState(roomState);
      return;
    }
    socket.emit("errorMessage", "Room is full. Join as spectator instead.");
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
      socket.emit("errorMessage", "Both players must select a faction first.");
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
    
    // Check for game end (life <= 0)
    let winner = null;
    if (game.players[1].life <= 0 && game.players[2].life <= 0) {
      winner = null;
      game.phase = "gameOver";
      socket.emit("gameEnded", { winner: null, tie: true });
    } else if (game.players[1].life <= 0) {
      winner = 2;
      game.phase = "gameOver";
      socket.emit("gameEnded", { winner: 2, tie: false });
    } else if (game.players[2].life <= 0) {
      winner = 1;
      game.phase = "gameOver";
      socket.emit("gameEnded", { winner: 1, tie: false });
    }
    
    if (!winner) {
      reopenPriorityAfterDamage(game);
    }
    emitState(roomState);
  });

  socket.on("confirmAttack", (data) => {
    console.log(`[Socket] confirmAttack:`, data);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];
    
    // Get the attack card from hand
    if (data.attackCardIndex !== undefined && player.hand[data.attackCardIndex]) {
      const attackCard = player.hand[data.attackCardIndex];
      
      // Calculate payment
      const payment = getPaymentTotal(player, data.paymentIndexes || [], data.useHeraBonus);
      const required = getBaseCardValue(attackCard);
      
      if (payment.total >= required) {
        // Remove payment cards
        removeIndexesFromHandToDiscard(player, data.paymentIndexes || []);
        // Remove attack card from hand
        player.hand.splice(data.attackCardIndex, 1);
        // Add acceleration if overpaid
        addAccelerationIfOverpaid(player, payment.total, required);
        
        game.handAttacks.push({
          id: `attack-${Date.now()}-${Math.random()}`,
          player: playerNum,
          card: attackCard,
          effectiveValue: attackCard.value,
          block: []
        });
        game.priority = getOtherPlayer(playerNum);
        resetPriorityPassed(game);
        game.message = `Player ${playerNum} attacked with ${attackCard.name}!`;
      } else {
        socket.emit("errorMessage", `Not enough payment. Need ${required}, have ${payment.total}`);
      }
    }
    emitState(roomState);
  });

  socket.on("confirmBlock", (data) => {
    console.log(`[Socket] confirmBlock:`, data);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];
    
    if (data.handAttackId && game.handAttacks.length > 0) {
      const attack = game.handAttacks.find(a => a.id === data.handAttackId);
      if (attack && player.hand[data.blockCardIndex]) {
        const blockCard = player.hand[data.blockCardIndex];
        const payment = getPaymentTotal(player, data.paymentIndexes || [], data.useHeraBonus);
        const required = getBaseCardValue(blockCard);
        
        if (payment.total >= required) {
          removeIndexesFromHandToDiscard(player, data.paymentIndexes || []);
          player.hand.splice(data.blockCardIndex, 1);
          addAccelerationIfOverpaid(player, payment.total, required);
          
          attack.block.push({
            player: playerNum,
            card: blockCard,
            effectiveValue: blockCard.value
          });
          game.priority = getOtherPlayer(playerNum);
          resetPriorityPassed(game);
          game.message = `Player ${playerNum} blocked with ${blockCard.name}!`;
        } else {
          socket.emit("errorMessage", `Not enough payment to block. Need ${required}, have ${payment.total}`);
        }
      }
    }
    emitState(roomState);
  });

  socket.on("placeFacedown", ({ lane, handIndex }) => {
    console.log(`[Socket] placeFacedown: lane ${lane}, handIndex ${handIndex}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];
    
    if (game.phase === "end" && player.hand[handIndex]) {
      const card = player.hand.splice(handIndex, 1)[0];
      game.lanes[lane].facedown[playerNum] = card;
      game.message = `Player ${playerNum} placed a facedown card in lane ${lane + 1}`;
    }
    emitState(roomState);
  });

  socket.on("skipEndPlacement", ({ lane }) => {
    console.log(`[Socket] skipEndPlacement: lane ${lane}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    
    if (game.phase === "end") {
      game.endPlaced[playerNum][lane] = true;
      advanceEndPlacement(game);
    }
    emitState(roomState);
  });

  socket.on("usePolea", (payload) => {
    console.log(`[Socket] usePolea:`, payload);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];
    
    if (player.faction?.id === "frumo" && !player.turnData.poleaUsed && game.phase === "priority") {
      // Simplified Polea handling
      player.turnData.poleaUsed = true;
      game.message = `Player ${playerNum} used Polea ability`;
    }
    emitState(roomState);
  });

  socket.on("useLafayette", ({ lane, handIndex }) => {
    console.log(`[Socket] useLafayette: lane ${lane}, handIndex ${handIndex}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];
    
    if (player.faction?.id === "frumo" && !player.turnData.lafayetteUsed && game.phase === "priority") {
      if (game.lanes[lane].facedown[playerNum] && player.hand[handIndex]) {
        const laneCard = game.lanes[lane].facedown[playerNum];
        const handCard = player.hand[handIndex];
        game.lanes[lane].facedown[playerNum] = handCard;
        player.hand[handIndex] = laneCard;
        player.turnData.lafayetteUsed = true;
        game.message = `Player ${playerNum} used Lafayette to swap cards`;
      }
    }
    emitState(roomState);
  });

  socket.on("useFocusBuff", ({ targetType, lane, handAttackId }) => {
    console.log(`[Socket] useFocusBuff:`, targetType);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];
    
    if (player.faction?.id === "bizi" && !player.turnData.focusBuffUsed && player.accelerationCounters > 0 && game.phase === "priority") {
      player.accelerationCounters--;
      player.turnData.focusBuffUsed = true;
      game.message = `Player ${playerNum} used Focus Buff`;
    }
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