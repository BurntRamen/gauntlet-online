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

// ============ FACTION DATA ============
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
    game: null,
    damageConfirmed: { 1: false, 2: false }
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
  return { value: 0, notes: [] };
}

function getAttackPaymentRequirement(player, card) {
  return { required: card?.value || 0, freeAttackUsed: false };
}

function getPaymentTotal(player, paymentIndexes, useHeraBonus) {
  let total = 0;
  for (const idx of paymentIndexes) {
    if (player.hand[idx]) total += player.hand[idx].value || 0;
  }
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
  if (freeUsed) notes.push("Meerus free attack");
  player.turnData.attacksDeclaredThisTurn++;
  player.turnData.previousAttackSuit = card?.suit;
  return { effectiveValue, notes };
}

function applyBlockBonuses(player, card) {
  let effectiveValue = card?.value || 0;
  const notes = [];
  const faction = player.faction?.id;
  if (faction === "rumin") {
    effectiveValue += 1;
    notes.push("Emperor Nu +1");
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

function resolveDamage(game, roomState) {
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
    } else {
      game.message = `Attack was fully blocked!`;
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
  roomState.damageConfirmed = { 1: false, 2: false };
}

function startEndPhase(game) {
  game.phase = "end";
  game.endPlacementLaneIndex = 0;
  game.endPlacementFirstPlayer = game.lastActivePlayer === 1 ? 2 : 1;
  game.endPlacementStep = 0;
  game.endPlaced = { 1: [false, false, false], 2: [false, false, false] };
  game.message = "End of Turn Phase - Place facedown cards in lanes";
}

function advanceEndPlacement(game) {
  game.endPlacementStep++;
  
  if (game.endPlacementStep >= 2) {
    game.endPlacementLaneIndex++;
    game.endPlacementStep = 0;
  }
  
  if (game.endPlacementLaneIndex >= 3) {
    for (const p of [1, 2]) {
      const player = game.players[p];
      while (player.hand.length < 8 && player.deck.length > 0) {
        player.hand.push(player.deck.pop());
      }
    }
    
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
    game.message = `Turn ${game.turn} - Player ${game.priority} has priority`;
  }
}

function createGameFromLobby(roomState) {
  const faction1 = getFactionById(roomState.lobby.players[1].factionId);
  const faction2 = getFactionById(roomState.lobby.players[2].factionId);
  
  const suits = ["♠", "♥", "♦", "♣"];
  const values = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const rankNames = { 11: "J", 12: "Q", 13: "K", 14: "A" };
  
  function createDeck() {
    const deck = [];
    for (const suit of suits) {
      for (const value of values) {
        deck.push({
          id: `card-${Math.random().toString(36).slice(2)}-${Date.now()}`,
          value: value,
          suit: suit,
          name: `${rankNames[value] || value} of ${suit}`,
          rank: rankNames[value] || String(value)
        });
      }
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }
  
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
        deck: createDeck(),
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
        deck: createDeck(),
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
  
  for (const p of [1, 2]) {
    for (let i = 0; i < 8; i++) {
      if (game.players[p].deck.length > 0) {
        game.players[p].hand.push(game.players[p].deck.pop());
      }
    }
  }
  
  roomState.game = game;
  roomState.damageConfirmed = { 1: false, 2: false };
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
    
    if (game.phase !== "priority") {
      socket.emit("errorMessage", "Not in priority phase");
      return;
    }
    if (game.priority !== playerNum) {
      socket.emit("errorMessage", "Not your priority to pass");
      return;
    }
    
    game.priorityPassed[playerNum] = true;
    game.message = `Player ${playerNum} passed priority (P1: ${game.priorityPassed[1] ? "✓" : "○"}, P2: ${game.priorityPassed[2] ? "✓" : "○"})`;
    
    if (game.priorityPassed[1] && game.priorityPassed[2]) {
      if (hasPendingAttacks(game)) {
        game.phase = "damage";
        game.message = "Both players passed - damage phase. Click Resolve Damage.";
        roomState.damageConfirmed = { 1: false, 2: false };
      } else {
        startEndPhase(game);
      }
      resetPriorityPassed(game);
    } else {
      game.priority = getOtherPlayer(playerNum);
    }
    
    emitState(roomState);
  });

  socket.on("resolveDamage", () => {
    console.log(`[Socket] resolveDamage`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    
    if (game.phase !== "damage") {
      socket.emit("errorMessage", "Not in damage phase");
      return;
    }
    
    roomState.damageConfirmed[playerNum] = true;
    game.message = `Player ${playerNum} confirmed damage (${roomState.damageConfirmed[1] ? "✓" : "○"} ${roomState.damageConfirmed[2] ? "✓" : "○"})`;
    emitState(roomState);
    
    if (roomState.damageConfirmed[1] && roomState.damageConfirmed[2]) {
      console.log("[resolveDamage] Both confirmed - resolving");
      resolveDamage(game, roomState);
      
      if (game.players[1].life <= 0 && game.players[2].life <= 0) {
        game.phase = "gameOver";
        game.winner = null;
        game.message = "Game Over - Tie!";
        io.to(roomState.roomCode).emit("gameEnded", { winner: null, tie: true });
      } else if (game.players[1].life <= 0) {
        game.phase = "gameOver";
        game.winner = 2;
        game.message = "Player 2 wins!";
        io.to(roomState.roomCode).emit("gameEnded", { winner: 2, tie: false });
      } else if (game.players[2].life <= 0) {
        game.phase = "gameOver";
        game.winner = 1;
        game.message = "Player 1 wins!";
        io.to(roomState.roomCode).emit("gameEnded", { winner: 1, tie: false });
      } else {
        game.phase = "priority";
        game.priority = getOtherPlayer(game.lastActivePlayer);
        game.lastActivePlayer = game.priority;
        resetPriorityPassed(game);
        game.message = `Damage resolved. Player ${game.priority} has priority.`;
      }
      
      emitState(roomState);
    }
  });

  socket.on("confirmAttack", ({ from, attackCardIndex, paymentIndexes, useHeraBonus }) => {
    console.log(`[Socket] confirmAttack: idx=${attackCardIndex}, payments=${paymentIndexes}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];
    
    if (game.phase !== "priority") {
      socket.emit("errorMessage", "Not in priority phase");
      return;
    }
    if (game.priority !== playerNum) {
      socket.emit("errorMessage", "Not your priority to attack");
      return;
    }
    
    if (!player.hand[attackCardIndex]) {
      socket.emit("errorMessage", "Invalid attack card");
      return;
    }
    
    const attackCard = player.hand[attackCardIndex];
    const payment = getPaymentTotal(player, paymentIndexes, useHeraBonus);
    const required = getBaseCardValue(attackCard);
    
    if (payment.total < required) {
      socket.emit("errorMessage", `Need ${required} payment, have ${payment.total}`);
      return;
    }
    
    removeIndexesFromHandToDiscard(player, paymentIndexes);
    player.hand.splice(attackCardIndex, 1);
    addAccelerationIfOverpaid(player, payment.total, required);
    
    const attackId = `attack-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    game.handAttacks.push({
      id: attackId,
      player: playerNum,
      card: attackCard,
      source: "hand",
      effectiveValue: attackCard.value,
      block: [],
      notes: []
    });
    
    // Reset passed flags and give priority to defender
    resetPriorityPassed(game);
    game.priority = getOtherPlayer(playerNum);
    game.message = `Player ${playerNum} attacked with ${attackCard.name}! Player ${game.priority} can block or pass.`;
    
    emitState(roomState);
  });

  socket.on("confirmBlock", ({ handAttackId, blockCardIndex, paymentIndexes, useHeraBonus }) => {
    console.log(`[Socket] confirmBlock: attackId=${handAttackId}, blockIdx=${blockCardIndex}, payments=${paymentIndexes}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];
    
    if (game.phase !== "priority") {
      socket.emit("errorMessage", "Not in priority phase");
      return;
    }
    
    const attack = game.handAttacks.find(a => a.id === handAttackId);
    if (!attack) {
      socket.emit("errorMessage", "Attack not found");
      return;
    }
    
    const defender = getOtherPlayer(attack.player);
    if (playerNum !== defender) {
      socket.emit("errorMessage", "Not the defender");
      return;
    }
    
    // If take damage (no block card)
    if (blockCardIndex === undefined || blockCardIndex === null || blockCardIndex === -1) {
      console.log(`[Socket] No block card - passing priority to take damage`);
      game.priorityPassed[playerNum] = true;
      game.message = `Player ${playerNum} chose not to block.`;
      
      if (game.priorityPassed[1] && game.priorityPassed[2]) {
        if (hasPendingAttacks(game)) {
          game.phase = "damage";
          game.message = "Both players passed - damage phase. Click Resolve Damage.";
          roomState.damageConfirmed = { 1: false, 2: false };
        } else {
          startEndPhase(game);
        }
        resetPriorityPassed(game);
      } else {
        game.priority = getOtherPlayer(playerNum);
      }
      emitState(roomState);
      return;
    }
    
    // Validate block card
    if (!player.hand[blockCardIndex]) {
      socket.emit("errorMessage", "Invalid block card");
      return;
    }
    
    const blockCard = player.hand[blockCardIndex];
    const blockCardValue = getBaseCardValue(blockCard);
    const payment = getPaymentTotal(player, paymentIndexes, useHeraBonus);
    
    console.log(`[Socket] Block payment check: need ${blockCardValue}, have ${payment.total}`);
    
    if (payment.total < blockCardValue) {
      socket.emit("errorMessage", `Need ${blockCardValue} payment to block, have ${payment.total}`);
      return;
    }
    
    // Process block
    removeIndexesFromHandToDiscard(player, paymentIndexes);
    player.hand.splice(blockCardIndex, 1);
    addAccelerationIfOverpaid(player, payment.total, blockCardValue);
    
    const blockInfo = applyBlockBonuses(player, blockCard);
    finalizeBlockDeclaration(player);
    
    attack.block.push({
      player: playerNum,
      card: blockCard,
      source: "hand",
      effectiveValue: blockInfo.effectiveValue,
      notes: blockInfo.notes
    });
    
    // IMPORTANT: This attack is now blocked. The attacker can declare NEW attacks,
    // but this specific attack is resolved and will be processed in damage phase.
    // Reset passed flags and give priority back to attacker so they can attack again or pass.
    resetPriorityPassed(game);
    game.priority = attack.player;
    game.message = `Player ${playerNum} blocked with ${blockCard.name} (paid ${payment.total}, blocker value ${blockCardValue} -> ${blockInfo.effectiveValue})! Player ${attack.player} may attack again or pass.`;
    
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
    
    if (game.phase !== "end") {
      socket.emit("errorMessage", "Not in end phase");
      return;
    }
    
    if (lane !== game.endPlacementLaneIndex) {
      socket.emit("errorMessage", "Wrong lane");
      return;
    }
    
    const currentPlayer = game.endPlacementStep === 0 ? game.endPlacementFirstPlayer : getOtherPlayer(game.endPlacementFirstPlayer);
    if (playerNum !== currentPlayer) {
      socket.emit("errorMessage", "Not your turn to place");
      return;
    }
    
    if (game.endPlaced[playerNum][lane]) {
      socket.emit("errorMessage", "Already placed in this lane");
      return;
    }
    
    if (!player.hand[handIndex]) {
      socket.emit("errorMessage", "Invalid card");
      return;
    }
    
    const card = player.hand.splice(handIndex, 1)[0];
    game.lanes[lane].facedown[playerNum] = card;
    game.endPlaced[playerNum][lane] = true;
    game.message = `Player ${playerNum} placed a card in lane ${lane + 1}`;
    
    advanceEndPlacement(game);
    emitState(roomState);
  });

  socket.on("skipEndPlacement", ({ lane }) => {
    console.log(`[Socket] skipEndPlacement: lane ${lane}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    
    if (game.phase !== "end") {
      socket.emit("errorMessage", "Not in end phase");
      return;
    }
    
    if (lane !== game.endPlacementLaneIndex) {
      socket.emit("errorMessage", "Wrong lane");
      return;
    }
    
    const currentPlayer = game.endPlacementStep === 0 ? game.endPlacementFirstPlayer : getOtherPlayer(game.endPlacementFirstPlayer);
    if (playerNum !== currentPlayer) {
      socket.emit("errorMessage", "Not your turn to skip");
      return;
    }
    
    if (game.endPlaced[playerNum][lane]) {
      socket.emit("errorMessage", "Already processed");
      return;
    }
    
    game.endPlaced[playerNum][lane] = true;
    game.message = `Player ${playerNum} skipped lane ${lane + 1}`;
    
    advanceEndPlacement(game);
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