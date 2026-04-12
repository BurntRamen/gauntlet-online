const { getFactionById } = require("./factions");

function newDeck(factionName) {
  const suits = ["♠", "♥", "♦", "♣"];
  const values = Array.from({ length: 13 }, (_, i) => i + 1);

  return suits
    .flatMap((suit) =>
      values.map((value) => ({
        id: `${factionName}-${suit}-${value}-${Math.random().toString(36).slice(2, 9)}`,
        suit,
        value,
        faction: factionName,
        name: `${factionName} ${value}${suit}`,
        tempBuff: 0
      }))
    )
    .sort(() => Math.random() - 0.5);
}

function createTurnData() {
  return {
    attacksDeclaredThisTurn: 0,
    blocksDeclaredThisTurn: 0,
    previousAttackSuit: null,
    previousPlayedValue: null,
    suitsPlayedThisTurn: [],
    rumieSuitBonusCount: 0,
    constantiSuitBonusCount: 0,
    meerusFreeAttackAvailable: false,
    beliHighCostAttackBuffAvailable: false,
    tangLifeGainUsed: false,
    poleaUsed: false,
    lafayetteUsed: false,
    focusBuffUsed: false,
    heraUsed: false,
    ristusBonusUsed: false
  };
}

function createPlayer(id, faction) {
  const deck = newDeck(faction.name);

  return {
    id,
    socket: null,
    life: 42,
    deck,
    hand: deck.splice(0, 8),
    discard: [],
    faction,
    accelerationCounters: 0,
    turnData: createTurnData()
  };
}

function createGameFromLobby(roomState) {
  const startingPriority = Math.random() < 0.5 ? 1 : 2;

  const p1Faction = getFactionById(roomState.lobby.players[1].factionId);
  const p2Faction = getFactionById(roomState.lobby.players[2].factionId);

  roomState.game = {
    roomCode: roomState.roomCode,
    started: true,
    turn: 1,
    phase: "priority",
    priority: startingPriority,
    startingPriorityThisTurn: startingPriority,
    turnPlayer: startingPriority,
    lastDefender: startingPriority === 1 ? 2 : 1,

    players: {
      1: createPlayer(1, p1Faction),
      2: createPlayer(2, p2Faction)
    },

    lanes: Array.from({ length: 3 }, () => ({
      facedown: { 1: null, 2: null },
      attack: null,
      block: []
    })),

    handAttacks: [],
    priorityPassed: { 1: false, 2: false },

    endPlacementFirstPlayer: startingPriority,
    endPlacementLaneIndex: 0,
    endPlacementStep: 0,
    endPlaced: { 1: [false, false, false], 2: [false, false, false] },

    winner: null,
    message: `Turn 1: Player ${startingPriority} starts with priority.`
  };

  roomState.game.players[1].socket = roomState.lobby.players[1].socket;
  roomState.game.players[2].socket = roomState.lobby.players[2].socket;
}

module.exports = {
  createTurnData,
  createGameFromLobby
};