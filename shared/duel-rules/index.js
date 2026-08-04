"use strict";

const RULES_VERSION = "gauntlet-duel-v2";
const SCHEMA_VERSION = 2;
const COMMAND_SCHEMA_VERSION = 1;
const EVENT_SCHEMA_VERSION = 1;
const CARD_CONTENT_VERSION = "gauntlet-cards-v1";
const STARTING_LIFE = 42;
const HAND_SIZE = 8;
const SUITS = ["♠", "♥", "♦", "♣"];
const VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const RANKS = { 11: "J", 12: "Q", 13: "K", 14: "A" };
const FACTION_PROFILES = {
  rumin: {
    id: "rumin",
    name: "Rumin",
    commander: "Kaiser, the Jewel",
    general: "Meerus",
    city: "Rumie, City of the Empire"
  },
  sheen: {
    id: "sheen",
    name: "Sheen",
    commander: "Emperor Nu",
    general: "Tang",
    city: "Beli, Living City"
  },
  frumo: {
    id: "frumo",
    name: "Frumo",
    commander: "Lord Commander Polea",
    general: "Lafayette",
    city: "Ristus, Sunken City"
  },
  bizi: {
    id: "bizi",
    name: "Bizi",
    commander: "Focus, Conductor of Progress",
    general: "Hera",
    city: "Constanti, Technology Hub"
  }
};
const FACTION_ABILITY_INTENTS = Object.freeze({
  "polea-place": "Put a card from your hand into an empty lane you control.",
  "polea-swap": "Move one lane card to an empty lane, or switch two lane cards you control.",
  "polea-peek": "Privately look at one face-down lane card controlled by either player.",
  "polea-buff": "Give one card you control +1 value until end of turn.",
  "lafayette-swap": "Swap one card in your hand with one lane card you control.",
  "focus-buff": "Once per turn, spend one acceleration counter to give one card you control +1 value until end of turn.",
  "hera-payment": "Once per turn, optionally make one matching-suit payment card provide +2 additional value."
});
const CONSTRUCTED_CHOICE_INTENTS = Object.freeze({
  "forum-ledger-payment": "Choose one payment card for Forum Ledger Runner's first attack to provide +1.",
  "jewel-bank-payment": "Choose whether to use a readied Jewel-Bank Contract on exactly one payment card.",
  "arm-rumin-weapons": "Choose which eligible Rumin lane weapon arms to a hand attack.",
  "beli-awakened": "Choose whether Beli Awakened uses its readied +3 attack bonus.",
  "sandstorm-processor": "Choose whether Sandstorm Processor attacks with +2 while two acceleration counters are present.",
  "constanti-sunforge": "Choose zero through three acceleration counters for Constanti Sunforge to remove.",
  "voltaric-ultimatum": "Choose whether Voltaric Ultimatum removes two acceleration counters for +5.",
  "focus-prime-signal": "Choose zero through the available Focus Prime Signal bonus for the next card.",
  "acceleration-blockers": "Choose which Gearplate Shield or Heat-Sink Matrix blockers remove one acceleration for +2.",
  "deckhand-diver-peek": "Choose whether Deckhand Diver privately inspects the top deck card when placed.",
  "last-gamble-choice": "After the qualifying private peek, choose whether The Last Gamble empowers the next attack or block."
});

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function otherPlayer(player) {
  return Number(player) === 1 ? 2 : 1;
}

function cardValue(card) {
  if (!card) return 0;
  if (card.rank === "A" || card.value === "A") return 14;
  if (card.rank === "K" || card.value === "K") return 13;
  if (card.rank === "Q" || card.value === "Q") return 12;
  if (card.rank === "J" || card.value === "J") return 11;
  return Number(card.value) || 0;
}

function cardDefinitionId(card) {
  return card?.definitionId || card?.catalogId || card?.id || null;
}

function cardIs(card, definitionId) {
  return cardDefinitionId(card) === definitionId;
}

function cardHasType(card, type) {
  return String(card?.type || "").toLowerCase() === String(type || "").toLowerCase();
}

function hashSeed(input) {
  const text = String(input || "gauntlet");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed) {
  let value = hashSeed(seed) || 1;
  return function random() {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function createStandardDeck(player, factionId = "rumin") {
  return SUITS.flatMap((suit, suitIndex) => VALUES.map((value) => ({
    id: `p${player}-${suitIndex}-${RANKS[value] || value}`,
    value,
    rank: RANKS[value] || String(value),
    suit,
    name: `${RANKS[value] || value} of ${suit}`,
    faction: "Basic Gauntlet",
    factionId
  })));
}

function shuffleDeck(cards, random) {
  const deck = cards.map((card) => ({ ...card }));
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [deck[index], deck[target]] = [deck[target], deck[index]];
  }
  return deck;
}

function drawToEight(game, playerNumber, events) {
  const player = game.players[playerNumber];
  const drawn = [];
  while (player.hand.length < HAND_SIZE && player.deck.length > 0) {
    const card = player.deck.pop();
    player.hand.push(card);
    drawn.push(card.id);
  }
  events.push(event(game, "cards.drawn", { player: playerNumber, cardIds: drawn }));
}

function drawExtraCards(game, playerNumber, count, source, events) {
  const player = game.players[playerNumber];
  const drawn = [];
  for (let index = 0; index < count && player.deck.length > 0; index += 1) {
    const card = player.deck.pop();
    player.hand.push(card);
    drawn.push(card.id);
  }
  if (drawn.length) {
    events.push(event(game, "cards.drawn", {
      player: playerNumber,
      cardIds: drawn,
      source
    }));
  }
}

function createTurnData() {
  return {
    attacksDeclaredThisTurn: 0,
    blocksDeclaredThisTurn: 0,
    damageTakenThisTurn: 0,
    previousAttackSuit: null,
    previousPlayedValue: null,
    suitsPlayedThisTurn: [],
    ruminMatchingSuitBonuses: 0,
    ruminFreeThirdReady: false,
    sheenLargeAttackReady: false,
    frumoConsecutiveUsed: false,
    poleaUsed: false,
    lafayetteUsed: false,
    focusUsed: false,
    heraUsed: false,
    biziDifferentSuitBonuses: 0,
    biziCardsPlayedThisTurn: 0,
    paymentSuitsThisTurn: [],
    ruminSenateVaultGuardUsed: false,
    ruminCountingHouseAegisUsed: false,
    ruminNextWeaponArmBonus: 0,
    ruminJewelBankAvailable: false,
    frumoLaneSwappedThisTurn: false,
    frumoNextPaymentBonus: 0,
    frumoNextActionBonus: 0,
    frumoNextActionKind: null,
    frumoRiptideSmugglerUsed: false,
    poleaSunkenOrderUsed: false,
    biziVoltageBonusUsed: false,
    biziFirstOverpayRewardUsed: false,
    biziClockworkCaravanUsed: false,
    biziEndTurnDraws: 0,
    biziPrimeSignalAvailable: 0,
    sheenNextAttackBonus: 0,
    sheenNextBlockBonus: 0,
    sheenEndTurnDraws: 0,
    beliCanopyShieldUsed: false,
    beliAwakenedReady: false,
    tangLifeGainUsed: false
  };
}

function makePlayer(number, name, deck, faction = null) {
  const sourceFaction = typeof faction === "string"
    ? FACTION_PROFILES[faction] || { id: faction, name: faction }
    : faction;
  const normalizedFaction = sourceFaction && typeof sourceFaction === "object"
    ? {
        id: sourceFaction.id || "rumin",
        name: sourceFaction.name || sourceFaction.id || "Basic Gauntlet",
        commander: sourceFaction.commander || null,
        general: sourceFaction.general || null,
        city: sourceFaction.city || null
      }
    : { id: "rumin", name: "Basic Gauntlet" };
  return {
    id: number,
    accountName: name,
    life: STARTING_LIFE,
    hand: [],
    deck,
    discard: [],
    faction: normalizedFaction,
    connected: true,
    accelerationCounters: 0,
    turnData: createTurnData()
  };
}

function event(game, type, detail = {}) {
  game.eventSequence += 1;
  return {
    id: `${game.matchId}-event-${game.eventSequence}`,
    sequence: game.eventSequence,
    revision: game.revision,
    type,
    ...detail
  };
}

function appendHistory(game, player, label, events) {
  const entry = {
    id: `log-${game.eventSequence}-${game.actionHistory.length}`,
    turn: game.turn,
    player,
    label,
    eventTypes: events.map((entryEvent) => entryEvent.type)
  };
  game.actionHistory.push(entry);
  return entry;
}

function createMatch(options = {}) {
  const seed = String(options.seed || "gauntlet-local");
  const random = options.random || createSeededRandom(seed);
  const startingPriority = options.startingPriority || (random() < 0.5 ? 1 : 2);
  const names = options.playerNames || { 1: "Player 1", 2: "Player 2" };
  const factions = options.factions || {};
  const gameMode = options.gameMode === "factions" ? "factions" : "basic";
  const factionOne = gameMode === "factions"
    ? (factions[1] || FACTION_PROFILES.rumin)
    : { id: "rumin", name: "Basic Gauntlet" };
  const factionTwo = gameMode === "factions"
    ? (factions[2] || FACTION_PROFILES.sheen)
    : { id: "rumin", name: "Basic Gauntlet" };
  const deckOne = options.decks?.[1]
    ? options.decks[1].map((card) => ({ ...card }))
    : shuffleDeck(createStandardDeck(1, factionOne.id), random);
  const deckTwo = options.decks?.[2]
    ? options.decks[2].map((card) => ({ ...card }))
    : shuffleDeck(createStandardDeck(2, factionTwo.id), random);
  const game = {
    schemaVersion: SCHEMA_VERSION,
    snapshotSchemaVersion: SCHEMA_VERSION,
    commandSchemaVersion: COMMAND_SCHEMA_VERSION,
    eventSchemaVersion: EVENT_SCHEMA_VERSION,
    rulesVersion: RULES_VERSION,
    cardContentVersion: CARD_CONTENT_VERSION,
    matchId: options.matchId || `local-${hashSeed(seed).toString(36)}`,
    seed,
    gameMode,
    revision: 0,
    phase: "priority",
    turn: 1,
    priority: startingPriority,
    startingPriorityThisTurn: startingPriority,
    lastActivePlayer: startingPriority,
    mostRecentAttackDefender: null,
    priorityPassed: { 1: false, 2: false },
    players: {
      1: makePlayer(1, names[1] || "Player 1", deckOne, factionOne),
      2: makePlayer(2, names[2] || "Player 2", deckTwo, factionTwo)
    },
    lanes: [0, 1, 2].map(() => ({
      facedown: { 1: null, 2: null },
      attack: null,
      block: []
    })),
    handAttacks: [],
    paymentLog: [],
    endPlacementLaneIndex: 0,
    endPlacementFirstPlayer: startingPriority,
    endPlacementStep: 0,
    endPlaced: { 1: [false, false, false], 2: [false, false, false] },
    winner: null,
    loser: null,
    lastCommandId: null,
    lastEvents: [],
    message: `Turn 1: Player ${startingPriority} has starting priority.`,
    eventSequence: 0,
    actionHistory: []
  };
  const events = [
    event(game, "match.created"),
    event(game, "deck.shuffled", { player: 1 }),
    event(game, "deck.shuffled", { player: 2 })
  ];
  drawToEight(game, 1, events);
  drawToEight(game, 2, events);
  events.push(event(game, "match.started"), event(game, "priority.granted", { player: startingPriority }));
  appendHistory(game, null, `New deterministic match started with seed “${seed}”.`, events);
  game.lastEvents = events.map((entry) => ({ ...entry }));
  return {
    state: game,
    events,
    animationEvents: events,
    legalActions: getLegalActions(game, startingPriority)
  };
}

function unique(values) {
  return new Set(values).size === values.length;
}

function findHandCard(player, cardId) {
  return player.hand.find((card) => card.id === cardId) || null;
}

function removeCardsFromHand(player, cardIds, destination = null) {
  const removed = [];
  for (const cardId of cardIds) {
    const index = player.hand.findIndex((card) => card.id === cardId);
    if (index >= 0) removed.push(player.hand.splice(index, 1)[0]);
  }
  if (destination) destination.push(...removed);
  return removed;
}

function validatePayment(player, cardIds, required, excludedIds = [], bonus = 0) {
  const ids = Array.isArray(cardIds) ? cardIds : [];
  if (!unique(ids)) return { error: "Payment cards must be unique." };
  if (ids.some((id) => excludedIds.includes(id))) {
    return { error: "A committed card cannot also be used as payment." };
  }
  const cards = ids.map((id) => findHandCard(player, id));
  if (cards.some((card) => !card)) return { error: "Every payment card must be in the acting player’s hand." };
  const total = cards.reduce((sum, card) => sum + cardValue(card), 0) + Number(bonus || 0);
  if (total < required) return { error: `Need ${required} payment; selected cards provide ${total}.` };
  return { cards, cardIds: ids.slice(), total, required };
}

function factionId(player) {
  return player?.faction?.id || "basic";
}

function temporaryBonus(card) {
  return Number(card?.temporaryValueBonus || 0);
}

function controlledLaneEntries(game, playerNumber) {
  return game.lanes.flatMap((lane, laneIndex) => {
    const card = lane.facedown[playerNumber];
    return card ? [{ card, laneIndex }] : [];
  });
}

function supportCards(game, playerNumber) {
  return [
    ...controlledLaneEntries(game, playerNumber).map((entry) => entry.card),
    ...game.handAttacks.filter((attack) => attack.player === playerNumber).map((attack) => attack.card),
    ...game.lanes.flatMap((lane) => lane.attack?.player === playerNumber ? [lane.attack.card] : [])
  ];
}

function playerControlsCard(game, playerNumber, definitionId) {
  return supportCards(game, playerNumber).some((card) => cardIs(card, definitionId));
}

function gainLifeFromBlocking(game, playerNumber, amount, source, notes, events) {
  const player = game.players[playerNumber];
  player.life += amount;
  notes.push(`${source} +${amount} life`);
  events.push(event(game, "life.gained", {
    player: playerNumber,
    amount,
    source
  }));
  if (playerControlsCard(game, playerNumber, "sheen-roots-that-remember")) {
    player.turnData.sheenNextBlockBonus += 1;
    notes.push("Roots That Remember next block +1");
  }
}

function gainAcceleration(game, playerNumber, amount, source, notes, events) {
  const player = game.players[playerNumber];
  player.accelerationCounters += amount;
  if (notes) notes.push(`${source} +${amount} acceleration`);
  events.push(event(game, "acceleration.gained", {
    player: playerNumber,
    amount,
    total: player.accelerationCounters,
    source
  }));
  for (const card of supportCards(game, playerNumber)) {
    if (cardIs(card, "bizi-solar-array-adept")) {
      card.temporaryValueBonus = temporaryBonus(card) + amount;
      if (notes) notes.push(`Solar Array Adept +${amount}`);
    }
  }
}

function addPaymentSuits(player, cards) {
  for (const card of cards || []) {
    if (card?.suit && !player.turnData.paymentSuitsThisTurn.includes(card.suit)) {
      player.turnData.paymentSuitsThisTurn.push(card.suit);
    }
  }
}

function recordPlayedCard(player, card) {
  player.turnData.previousPlayedValue = cardValue(card);
  if (card?.suit && !player.turnData.suitsPlayedThisTurn.includes(card.suit)) {
    player.turnData.suitsPlayedThisTurn.push(card.suit);
  }
}

function constructedPaymentBonus(game, playerNumber, command, context, paymentCards) {
  const player = game.players[playerNumber];
  const notes = [];
  let bonus = 0;
  const consume = {
    jewelBank: false,
    frumoNextPayment: false,
    biziVoltage: false
  };
  const paymentIds = paymentCards.map((card) => card.id);
  const selectedForumCardId = command.forumLedgerPaymentCardId || null;

  if (selectedForumCardId) {
    if (
      context.action !== "attack"
      || !cardIs(context.card, "rumin-forum-ledger-runner")
      || Number(player.turnData.attacksDeclaredThisTurn || 0) !== 0
      || !paymentIds.includes(selectedForumCardId)
    ) {
      return { error: "Forum Ledger Runner can enhance one selected payment card on its first attack only." };
    }
    bonus += 1;
    notes.push("Forum Ledger Runner payment +1");
  }

  if (command.useJewelBankBonus) {
    if (
      !player.turnData.ruminJewelBankAvailable
      || context.card?.factionId !== "rumin"
      || paymentCards.length !== 1
    ) {
      return { error: "Jewel-Bank Contract requires its pending effect and exactly one payment card for a Rumin card." };
    }
    bonus += 2;
    consume.jewelBank = true;
    notes.push("Jewel-Bank Contract payment +2");
  }

  if (
    context.action === "attack"
    && Number(player.turnData.attacksDeclaredThisTurn || 0) === 3
    && paymentCards.some((card) => cardIs(card, "rumin-edict-of-the-vault"))
  ) {
    bonus += 3;
    notes.push("Edict of the Vault payment +3");
  }
  if (
    context.action === "block"
    && context.blockCards?.length >= 2
    && paymentCards.some((card) => cardIs(card, "sheen-harmony-ward"))
  ) {
    bonus += 1;
    notes.push("Harmony Ward payment +1");
  }
  if (
    paymentCards.some((card) => cardIs(card, "frumo-sunken-coin"))
    && game.lanes.some((lane) => !lane.facedown[playerNumber])
  ) {
    bonus += 1;
    notes.push("Sunken Coin payment +1");
  }
  if (Number(player.turnData.frumoNextPaymentBonus || 0) > 0) {
    bonus += player.turnData.frumoNextPaymentBonus;
    consume.frumoNextPayment = true;
    notes.push(`Frumo next payment +${player.turnData.frumoNextPaymentBonus}`);
  }
  const voltageRation = paymentCards.some((card) => cardIs(card, "bizi-voltage-ration"));
  const brassSpark = (
    Number(player.turnData.biziCardsPlayedThisTurn || 0) === 0
    && paymentCards.some((card) => cardIs(card, "bizi-brass-spark"))
  );
  if (
    !player.turnData.biziVoltageBonusUsed
    && context.card?.factionId === "bizi"
    && (voltageRation || brassSpark)
  ) {
    bonus += 1;
    consume.biziVoltage = true;
    notes.push("Bizi payment card +1");
  }
  if (
    context.card?.factionId === "bizi"
    && paymentCards.some((card) => cardIs(card, "bizi-heras-calibration"))
  ) {
    bonus += 2;
    notes.push("Hera's Calibration payment +2");
  }
  return { bonus, notes, consume };
}

function consumeConstructedPaymentBonus(player, consume) {
  if (consume?.jewelBank) player.turnData.ruminJewelBankAvailable = false;
  if (consume?.frumoNextPayment) player.turnData.frumoNextPaymentBonus = 0;
  if (consume?.biziVoltage) player.turnData.biziVoltageBonusUsed = true;
}

function calculateFrumoConsecutiveBonus(player, card) {
  if (
    factionId(player) !== "frumo"
    || player.turnData.frumoConsecutiveUsed
    || player.turnData.previousPlayedValue == null
    || Math.abs(cardValue(card) - player.turnData.previousPlayedValue) !== 1
  ) {
    return { bonus: 0, notes: [] };
  }
  player.turnData.frumoConsecutiveUsed = true;
  return { bonus: 2, notes: ["Ristus +2"] };
}

function attackPaymentRequirement(player, card, useMeerusFreeAttack = false) {
  const attackNumber = Number(player.turnData.attacksDeclaredThisTurn || 0) + 1;
  const meerusEligible = (
    factionId(player) === "rumin"
    && attackNumber === 3
    && player.turnData.ruminFreeThirdReady
    && cardValue(card) <= 3
  );
  if (useMeerusFreeAttack && !meerusEligible) {
    return { error: "Meerus can only make the eligible third attack of value 3 or less free." };
  }
  if (meerusEligible && useMeerusFreeAttack) {
    return { required: 0, freeAttackUsed: true };
  }
  const taxRoadReduction = (
    Number(player.turnData.attacksDeclaredThisTurn || 0) === 0
    && cardIs(card, "rumin-tax-road-scout")
  ) ? 1 : 0;
  return {
    required: Math.max(0, cardValue(card) - taxRoadReduction),
    freeAttackUsed: false,
    meerusEligible,
    reductions: taxRoadReduction ? [{ source: "Tax-Road Scout", amount: 1 }] : []
  };
}

function calculateFactionAttackBonus(player, card) {
  const notes = [];
  let bonus = temporaryBonus(card);
  const attackNumber = Number(player.turnData.attacksDeclaredThisTurn || 0) + 1;
  const previousSuit = player.turnData.previousAttackSuit;
  const id = factionId(player);

  if (bonus) notes.push(`Temporary +${bonus}`);
  if (id === "rumin") {
    if (attackNumber === 4) {
      bonus += 3;
      notes.push("Kaiser +3");
    }
    if (
      attackNumber > 1
      && previousSuit
      && previousSuit === card.suit
      && player.turnData.ruminMatchingSuitBonuses < 2
    ) {
      bonus += 1;
      player.turnData.ruminMatchingSuitBonuses += 1;
      notes.push("Rumie +1");
    }
  }
  if (id === "sheen" && player.turnData.sheenLargeAttackReady && cardValue(card) >= 10) {
    bonus += 2;
    player.turnData.sheenLargeAttackReady = false;
    notes.push("Beli +2");
  }
  if (id === "frumo") {
    const consecutive = calculateFrumoConsecutiveBonus(player, card);
    bonus += consecutive.bonus;
    notes.push(...consecutive.notes);
  }
  if (
    id === "bizi"
    && attackNumber > 1
    && previousSuit
    && previousSuit !== card.suit
    && player.turnData.biziDifferentSuitBonuses < 2
  ) {
    bonus += 1;
    player.turnData.biziDifferentSuitBonuses += 1;
    notes.push("Constanti +1");
  }
  return { bonus, notes };
}

function calculateConstructedAttackBonus(game, playerNumber, card, source, command, paymentCards) {
  const player = game.players[playerNumber];
  const notes = [];
  const attachedCards = [];
  let bonus = 0;
  const attackNumber = Number(player.turnData.attacksDeclaredThisTurn || 0) + 1;
  const baseValue = cardValue(card);
  const selectedWeaponIds = Array.isArray(command.armWeaponCardIds)
    ? command.armWeaponCardIds
    : [];
  if (!unique(selectedWeaponIds)) return { error: "Each armed weapon must be selected once." };

  const availableWeapons = controlledLaneEntries(game, playerNumber)
    .filter((entry) => entry.card.factionId === "rumin" && cardHasType(entry.card, "weapon"));
  const selectedWeapons = selectedWeaponIds.map((id) => (
    availableWeapons.find((entry) => entry.card.id === id)
  ));
  if (selectedWeapons.some((entry) => !entry)) {
    return { error: "Every armed weapon must be a Rumin weapon in one of your lanes." };
  }
  if (selectedWeaponIds.length && source !== "hand") {
    return { error: "Rumin weapons can only arm to a hand attack." };
  }
  if (!cardIs(card, "rumin-rumie-market-colossus") && selectedWeaponIds.length > 1) {
    return { error: "Only Rumie Market Colossus may arm more than one weapon." };
  }

  for (const entry of selectedWeapons) {
    const weapon = entry.card;
    let weaponBonus = 0;
    if (cardIs(weapon, "rumin-coin-scale-spear")) weaponBonus = 2;
    else if (cardIs(weapon, "rumin-rumie-vault-shield")) weaponBonus = 3;
    else if (cardIs(weapon, "rumin-imperial-scale-pike")) {
      weaponBonus = player.turnData.previousAttackSuit === card.suit ? 4 : 2;
    } else if (cardIs(weapon, "rumin-aurelian-clawblade")) weaponBonus = 4;
    else if (cardIs(weapon, "rumin-triumphal-ram")) weaponBonus = baseValue >= 8 ? 5 : 4;
    else if (cardIs(weapon, "rumin-kaisers-gold-claw")) weaponBonus = attackNumber === 4 ? 6 : 5;
    else weaponBonus = Math.max(1, Math.floor(cardValue(weapon) / 2));

    if (player.turnData.ruminNextWeaponArmBonus) {
      weaponBonus += player.turnData.ruminNextWeaponArmBonus;
      notes.push(`Marble Market Tribune weapon +${player.turnData.ruminNextWeaponArmBonus}`);
      player.turnData.ruminNextWeaponArmBonus = 0;
    }
    if (cardIs(card, "rumin-rumie-market-colossus")) weaponBonus += 1;
    if (attackNumber === 4 && playerControlsCard(game, playerNumber, "rumin-basilisk-standard")) {
      weaponBonus += 2;
      notes.push("Basilisk Standard +2");
    }
    bonus += weaponBonus;
    attachedCards.push(weapon);
    game.lanes[entry.laneIndex].facedown[playerNumber] = null;
    notes.push(`${weapon.name || "Rumin weapon"} armed +${weaponBonus}`);
  }

  if (
    cardIs(card, "rumin-gilded-scale-legionary")
    && [...player.turnData.paymentSuitsThisTurn, ...paymentCards.map((entry) => entry.suit)].includes("♦")
  ) {
    bonus += 1;
    notes.push("Gilded Scale Legionary +1");
  }
  if (cardIs(card, "sheen-thornroot-counterstroke") && !player.turnData.damageTakenThisTurn) {
    bonus += 2;
    notes.push("Thornroot Counterstroke +2");
  }
  if (cardIs(card, "sheen-nus-calm-command") && player.turnData.blocksDeclaredThisTurn >= 3) {
    bonus += 3;
    notes.push("Nu's Calm Command +3");
  }
  if (command.useBeliAwakenedBonus) {
    if (!cardIs(card, "sheen-beli-awakened") || !player.turnData.beliAwakenedReady) {
      return { error: "Beli Awakened's +3 is only available after a damage-free block." };
    }
    bonus += 3;
    player.turnData.beliAwakenedReady = false;
    notes.push("Beli Awakened +3");
  }
  if (player.turnData.sheenNextAttackBonus) {
    bonus += player.turnData.sheenNextAttackBonus;
    notes.push(`Sheen next attack +${player.turnData.sheenNextAttackBonus}`);
    player.turnData.sheenNextAttackBonus = 0;
  }

  const differentSuit = (
    attackNumber > 1
    && player.turnData.previousAttackSuit
    && player.turnData.previousAttackSuit !== card.suit
  );
  if (differentSuit && playerControlsCard(game, playerNumber, "bizi-constanti-conduit")) {
    bonus += 1;
    notes.push("Constanti Conduit +1");
  }
  if (differentSuit && cardIs(card, "bizi-dune-circuit-runner")) {
    bonus += 1;
    notes.push("Dune Circuit Runner +1");
  }
  if (differentSuit && cardIs(card, "bizi-railspike-marshal")) {
    bonus += 1;
    notes.push("Railspike Marshal +1");
  }
  if (differentSuit && playerControlsCard(game, playerNumber, "bizi-desert-logic-engine")) {
    bonus += 2;
    notes.push("Desert Logic Engine +2");
  }

  if (command.useSandstormProcessor) {
    if (!cardIs(card, "bizi-sandstorm-processor") || Number(player.accelerationCounters || 0) < 2) {
      return { error: "Sandstorm Processor needs at least 2 acceleration counters." };
    }
    bonus += 2;
    notes.push("Sandstorm Processor +2");
  }
  const sunforgeSpend = Number(command.sunforgeAccelerationToSpend || 0);
  if (!Number.isInteger(sunforgeSpend) || sunforgeSpend < 0 || sunforgeSpend > 3) {
    return { error: "Constanti Sunforge may spend from 0 through 3 acceleration counters." };
  }
  if (sunforgeSpend > 0) {
    if (!cardIs(card, "bizi-constanti-sunforge") || sunforgeSpend > Number(player.accelerationCounters || 0)) {
      return { error: "Constanti Sunforge cannot spend that many acceleration counters." };
    }
    player.accelerationCounters -= sunforgeSpend;
    bonus += sunforgeSpend * 2;
    notes.push(`Constanti Sunforge spent ${sunforgeSpend} +${sunforgeSpend * 2}`);
  }
  if (command.useVoltaricUltimatum) {
    if (!cardIs(card, "bizi-voltaric-ultimatum") || Number(player.accelerationCounters || 0) < 2) {
      return { error: "Voltaric Ultimatum needs 2 acceleration counters." };
    }
    player.accelerationCounters -= 2;
    bonus += 5;
    notes.push("Voltaric Ultimatum +5");
  }

  const primeSignalBonus = Number(command.primeSignalBonus || 0);
  const primeSignalLimit = Math.min(4, Number(player.turnData.biziPrimeSignalAvailable || 0));
  if (!Number.isInteger(primeSignalBonus) || primeSignalBonus < 0 || primeSignalBonus > primeSignalLimit) {
    return { error: `Focus Prime Signal may add from 0 through ${primeSignalLimit}.` };
  }
  if (primeSignalBonus > 0) {
    bonus += primeSignalBonus;
    notes.push(`Focus Prime Signal +${primeSignalBonus}`);
    player.turnData.biziPrimeSignalAvailable = 0;
  }

  if (source === "lane" && cardIs(card, "frumo-tideglass-cutlass") && player.turnData.frumoLaneSwappedThisTurn) {
    bonus += 1;
    notes.push("Tideglass Cutlass +1");
  }
  if (
    cardIs(card, "frumo-pressure-lock-pistol")
    && player.turnData.previousPlayedValue != null
    && Math.abs(baseValue - player.turnData.previousPlayedValue) === 1
  ) {
    bonus += 2;
    notes.push("Pressure-Lock Pistol +2");
  }
  if (
    source === "lane"
    && (cardIs(card, "frumo-ristus-blackwake") || cardIs(card, "frumo-ballast-hook"))
    && game.lanes.some((lane) => !lane.facedown[playerNumber])
  ) {
    bonus += 1;
    notes.push("Frumo empty lane +1");
  }
  if (
    source === "lane"
    && cardIs(card, "frumo-captains-bad-wager")
    && player.turnData.previousPlayedValue != null
    && player.turnData.previousPlayedValue % 2 === 0
  ) {
    bonus += 3;
    notes.push("Captain's Bad Wager +3");
  }
  if (
    player.turnData.frumoNextActionBonus
    && (!player.turnData.frumoNextActionKind || player.turnData.frumoNextActionKind === "attack")
  ) {
    bonus += player.turnData.frumoNextActionBonus;
    notes.push(`Frumo next action +${player.turnData.frumoNextActionBonus}`);
    player.turnData.frumoNextActionBonus = 0;
    player.turnData.frumoNextActionKind = null;
  }

  return { bonus, notes, attachedCards };
}

function applyOverpayFactionEffects(player, total, required, events, game) {
  if (factionId(player) !== "bizi" || total - required < 2) return;
  gainAcceleration(game, player.id, 1, "Focus", null, events);
}

function applyConstructedOverpayEffects(game, playerNumber, card, total, required, notes, events) {
  if (total - required < 2) return;
  const player = game.players[playerNumber];
  if (cardIs(card, "rumin-senate-vault-guard") && !player.turnData.ruminSenateVaultGuardUsed) {
    player.life += 1;
    player.turnData.ruminSenateVaultGuardUsed = true;
    notes.push("Senate Vault Guard +1 life");
    events.push(event(game, "life.gained", { player: playerNumber, amount: 1, source: "Senate Vault Guard" }));
  }
  if (
    card?.factionId === "rumin"
    && playerControlsCard(game, playerNumber, "rumin-counting-house-aegis")
    && !player.turnData.ruminCountingHouseAegisUsed
  ) {
    player.life += 1;
    player.turnData.ruminCountingHouseAegisUsed = true;
    notes.push("Counting-House Aegis +1 life");
    events.push(event(game, "life.gained", { player: playerNumber, amount: 1, source: "Counting-House Aegis" }));
  }
  if (cardIs(card, "bizi-copperline-technician")) {
    gainAcceleration(game, playerNumber, 1, "Copperline Technician", notes, events);
  }
  if (
    playerControlsCard(game, playerNumber, "bizi-regnum-voltage-bank")
    && !player.turnData.biziFirstOverpayRewardUsed
  ) {
    player.life += 1;
    player.turnData.biziFirstOverpayRewardUsed = true;
    notes.push("Regnum Voltage Bank +1 life");
    events.push(event(game, "life.gained", { player: playerNumber, amount: 1, source: "Regnum Voltage Bank" }));
    gainAcceleration(game, playerNumber, 1, "Regnum Voltage Bank", notes, events);
  }
  if (cardIs(card, "bizi-clockwork-caravan") && !player.turnData.biziClockworkCaravanUsed) {
    player.turnData.biziEndTurnDraws += 1;
    player.turnData.biziClockworkCaravanUsed = true;
    notes.push("Clockwork Caravan end-turn draw");
  }
}

function applyAfterConstructedAttack(game, playerNumber, attack, payment, events) {
  const player = game.players[playerNumber];
  const card = attack.card;
  const notes = attack.notes;
  if (cardIs(card, "rumin-marble-market-tribune")) {
    player.turnData.ruminNextWeaponArmBonus += 1;
    notes.push("Marble Market Tribune next weapon +1");
  }
  if (
    attack.attachedCards.some((weapon) => cardIs(weapon, "rumin-aurelian-clawblade"))
    && payment.total - payment.required >= 2
  ) {
    player.life += 1;
    notes.push("Aurelian Clawblade +1 life");
    events.push(event(game, "life.gained", { player: playerNumber, amount: 1, source: "Aurelian Clawblade" }));
  }
  if (cardIs(card, "rumin-jewel-bank-contract")) {
    player.turnData.ruminJewelBankAvailable = true;
    notes.push("Jewel-Bank Contract readied");
  }
  if (cardIs(card, "bizi-focus-prime-signal")) {
    gainAcceleration(game, playerNumber, 2, "Focus Prime Signal", notes, events);
    player.turnData.biziPrimeSignalAvailable = Math.min(4, player.accelerationCounters);
    notes.push(`Focus Prime Signal readied up to +${player.turnData.biziPrimeSignalAvailable}`);
  }
  if (cardIs(card, "frumo-leviathan-salvage") && notes.some((note) => /Ristus|consecutive/i.test(note))) {
    player.life += 1;
    notes.push("Leviathan Salvage +1 life");
    events.push(event(game, "life.gained", { player: playerNumber, amount: 1, source: "Leviathan Salvage" }));
  }
}

function validateConstructedBlockChoices(player, blockCards, command) {
  const selectedIds = Array.isArray(command.accelerationBlockerCardIds)
    ? command.accelerationBlockerCardIds
    : [];
  if (!unique(selectedIds)) return { error: "Each acceleration blocker must be selected once." };
  const selectedCards = selectedIds.map((id) => blockCards.find((card) => card.id === id));
  if (selectedCards.some((card) => !card)) {
    return { error: "Acceleration can only be spent on a selected blocker." };
  }
  if (selectedCards.some((card) => (
    !cardIs(card, "bizi-gearplate-shield")
    && !cardIs(card, "bizi-heat-sink-matrix")
  ))) {
    return { error: "Only Gearplate Shield or Heat-Sink Matrix can use that block option." };
  }
  if (selectedCards.length > Number(player.accelerationCounters || 0)) {
    return { error: "Not enough acceleration counters for the selected blockers." };
  }
  return { selectedIds };
}

function calculateConstructedBlockBonus(game, playerNumber, card, context, command) {
  const player = game.players[playerNumber];
  const notes = [];
  let bonus = 0;
  let preventDamage = 0;
  const blockNumber = Number(player.turnData.blocksDeclaredThisTurn || 0) + 1;
  if (cardIs(card, "sheen-rootwatch-initiate") && blockNumber > 1) {
    bonus += 1;
    notes.push("Rootwatch Initiate +1");
  }
  if (cardIs(card, "sheen-living-bark-guard") && context.attack.source === "hand") {
    bonus += 1;
    notes.push("Living Bark Guard +1");
  }
  if (cardIs(card, "sheen-seedwall-acolyte") && blockNumber === 1) {
    bonus += 1;
    notes.push("Seedwall Acolyte +1");
  }
  if (cardIs(card, "sheen-ringroot-bastion") && context.laneBlock) {
    bonus += 2;
    notes.push("Ringroot Bastion +2");
  }
  if (
    cardIs(card, "rumin-marble-phalanx")
    && Number(player.turnData.attacksDeclaredThisTurn || 0) > 0
  ) {
    bonus += 1;
    notes.push("Marble Phalanx +1");
  }
  if (cardIs(card, "sheen-nus-verdant-edict") && blockNumber === 3) {
    bonus += 1;
    notes.push("Nu's Verdant Edict +1");
  }
  if (playerControlsCard(game, playerNumber, "sheen-emperors-heartwood")) {
    bonus += 1;
    notes.push("Emperor's Heartwood +1");
  }
  if (player.turnData.sheenNextBlockBonus) {
    bonus += player.turnData.sheenNextBlockBonus;
    notes.push(`Sheen next block +${player.turnData.sheenNextBlockBonus}`);
    player.turnData.sheenNextBlockBonus = 0;
  }
  if ((command.accelerationBlockerCardIds || []).includes(card.id)) {
    player.accelerationCounters -= 1;
    bonus += 2;
    notes.push(`${card.name || "Bizi blocker"} spent 1 acceleration +2`);
  }
  if (context.laneBlock && cardIs(card, "frumo-coral-hull-guard")) {
    bonus += 1;
    player.turnData.frumoLaneSwappedThisTurn = true;
    notes.push("Coral-Hull Guard +1");
  }
  if (
    player.turnData.frumoNextActionBonus
    && (!player.turnData.frumoNextActionKind || player.turnData.frumoNextActionKind === "block")
  ) {
    bonus += player.turnData.frumoNextActionBonus;
    notes.push(`Frumo next action +${player.turnData.frumoNextActionBonus}`);
    player.turnData.frumoNextActionBonus = 0;
    player.turnData.frumoNextActionKind = null;
  }
  if (
    cardIs(card, "rumin-vault-shield-bearer")
    && context.paymentTotal - context.required >= 1
  ) {
    preventDamage += 1;
    notes.push("Vault Shield Bearer prevents 1");
  }
  if (cardIs(card, "sheen-beli-canopy-shield") && !player.turnData.beliCanopyShieldUsed) {
    preventDamage += 1;
    player.turnData.beliCanopyShieldUsed = true;
    notes.push("Beli Canopy Shield prevents 1");
  }

  if (context.firstBlocker) {
    const primeSignalBonus = Number(command.primeSignalBonus || 0);
    const primeSignalLimit = Math.min(4, Number(player.turnData.biziPrimeSignalAvailable || 0));
    if (!Number.isInteger(primeSignalBonus) || primeSignalBonus < 0 || primeSignalBonus > primeSignalLimit) {
      return { error: `Focus Prime Signal may add from 0 through ${primeSignalLimit}.` };
    }
    if (primeSignalBonus > 0) {
      bonus += primeSignalBonus;
      notes.push(`Focus Prime Signal +${primeSignalBonus}`);
      player.turnData.biziPrimeSignalAvailable = 0;
    }
  }
  return { bonus, notes, preventDamage };
}

function applyAfterConstructedBlock(game, playerNumber, blockEntries, events) {
  const player = game.players[playerNumber];
  const blockNumber = Number(player.turnData.blocksDeclaredThisTurn || 0);
  if (
    blockEntries.some((entry) => cardIs(entry.card, "sheen-beli-vinebinder"))
    && blockNumber >= 2
  ) {
    player.turnData.sheenNextAttackBonus += 1;
    blockEntries[0].notes.push("Beli Vinebinder next attack +1");
  }
  if (
    blockEntries.some((entry) => cardIs(entry.card, "sheen-tangs-patient-hand"))
    && blockNumber >= 2
  ) {
    player.turnData.sheenEndTurnDraws += 1;
    gainLifeFromBlocking(
      game,
      playerNumber,
      2,
      "Tang's Patient Hand",
      blockEntries[0].notes,
      events
    );
    blockEntries[0].notes.push("Tang's Patient Hand end-turn draw");
  }
  if (
    playerControlsCard(game, playerNumber, "sheen-emperors-heartwood")
    && blockNumber >= 3
  ) {
    gainLifeFromBlocking(
      game,
      playerNumber,
      1,
      "Emperor's Heartwood",
      blockEntries[0].notes,
      events
    );
  }
  if (blockEntries.some((entry) => cardIs(entry.card, "rumin-jewel-bank-contract"))) {
    player.turnData.ruminJewelBankAvailable = true;
    blockEntries[0].notes.push("Jewel-Bank Contract readied");
  }
  if (blockEntries.some((entry) => cardIs(entry.card, "bizi-focus-prime-signal"))) {
    gainAcceleration(
      game,
      playerNumber,
      2,
      "Focus Prime Signal",
      blockEntries[0].notes,
      events
    );
    player.turnData.biziPrimeSignalAvailable = Math.min(4, player.accelerationCounters);
    blockEntries[0].notes.push(`Focus Prime Signal readied up to +${player.turnData.biziPrimeSignalAvailable}`);
  }
}

function applyConstructedLaneEntry(game, playerNumber, card, laneIndex, command, events) {
  const player = game.players[playerNumber];
  if (command.useDeckhandDiverPeek) {
    if (!cardIs(card, "frumo-deckhand-diver")) {
      return { error: "Deckhand Diver can only inspect the deck when that card enters a lane." };
    }
    const topCard = player.deck[player.deck.length - 1] || null;
    events.push(event(game, "card.peeked", {
      player: playerNumber,
      viewer: playerNumber,
      source: "Deckhand Diver",
      zone: "deck",
      card: topCard ? { ...topCard } : null
    }));
  }
  if (cardIs(card, "frumo-ristus-rises")) {
    card.temporaryValueBonus = temporaryBonus(card) + 1;
    player.turnData.frumoLaneSwappedThisTurn = true;
    events.push(event(game, "card.buffApplied", {
      player: playerNumber,
      cardId: card.id,
      amount: 1,
      source: "Ristus Rises"
    }));
  }
  if (cardIs(card, "frumo-kelpcloak-trickster")) {
    player.turnData.frumoLaneSwappedThisTurn = true;
  }
  if (cardIs(card, "frumo-abyssal-switchboard")) {
    player.turnData.frumoNextActionBonus += 1;
  }
  events.push(event(game, "laneEntry.resolved", {
    player: playerNumber,
    laneIndex,
    source: cardDefinitionId(card)
  }));
  return { accepted: true };
}

function resolveFactionTarget(game, player, command) {
  const laneIndex = Number(command.laneIndex ?? command.targets?.laneIndex);
  const targetType = command.targetType || command.targets?.targetType || "laneCard";
  if (targetType === "laneCard") {
    if (!Number.isInteger(laneIndex) || laneIndex < 0 || laneIndex > 2) return null;
    return game.lanes[laneIndex].facedown[player.id] || null;
  }
  if (targetType === "laneAttack") {
    const attack = game.lanes[laneIndex]?.attack;
    return attack?.player === player.id ? attack : null;
  }
  if (targetType === "handAttack") {
    const attackId = command.attackId || command.targets?.attackId;
    return game.handAttacks.find((attack) => attack.id === attackId && attack.player === player.id) || null;
  }
  return null;
}

function heraPaymentBonus(player, command, paymentIds) {
  if (!command.useHeraBonus) return { bonus: 0, card: null };
  if (factionId(player) !== "bizi") {
    return { error: "Hera payment can only be used by Bizi." };
  }
  if (player.turnData.heraUsed) {
    return { error: "Hera payment has already been used this turn." };
  }
  if (!player.turnData.suitsPlayedThisTurn.length) {
    return { error: "Hera needs a suit you have already played this turn." };
  }
  const matchingCard = paymentIds
    .map((id) => findHandCard(player, id))
    .find((card) => player.turnData.suitsPlayedThisTurn.includes(card?.suit));
  if (!matchingCard) {
    return { error: "Hera requires a payment card matching a suit you played this turn." };
  }
  return { bonus: 2, card: matchingCard };
}

function clearTemporaryBonuses(game) {
  const clearCard = (card) => {
    if (card && Object.prototype.hasOwnProperty.call(card, "temporaryValueBonus")) {
      delete card.temporaryValueBonus;
    }
  };
  for (const playerNumber of [1, 2]) {
    const player = game.players[playerNumber];
    player.hand.forEach(clearCard);
    player.deck.forEach(clearCard);
    player.discard.forEach(clearCard);
  }
  game.lanes.forEach((lane) => {
    clearCard(lane.facedown[1]);
    clearCard(lane.facedown[2]);
  });
}

function rejectionCode(reason) {
  if (/stale/i.test(reason)) return "STALE_REVISION";
  if (/payment/i.test(reason) || /^Need \d+/i.test(reason)) return "INVALID_PAYMENT";
  if (/priority/i.test(reason)) return "INVALID_PRIORITY";
  if (/lane/i.test(reason)) return "INVALID_LANE";
  if (/block/i.test(reason)) return "INVALID_BLOCK";
  if (/attack/i.test(reason)) return "INVALID_ATTACK";
  if (/game is already over/i.test(reason)) return "MATCH_COMPLETE";
  if (/unknown player/i.test(reason)) return "UNKNOWN_PLAYER";
  if (/unsupported/i.test(reason)) return "UNSUPPORTED_COMMAND";
  return "INVALID_COMMAND";
}

function reject(current, command, reason, commandId = null) {
  const resolvedCommandId = commandId || command?.__commandId || command?.commandId || null;
  const rejection = { code: rejectionCode(reason), message: reason };
  return {
    commandId: resolvedCommandId,
    accepted: false,
    state: current,
    legalActions: getLegalActions(current, command?.player),
    rejectionReason: reason,
    rejection,
    revision: Number(current?.revision || 0),
    actionLogEntry: null,
    animationEvents: []
  };
}

function hasPendingAttack(game) {
  return game.handAttacks.length > 0 || game.lanes.some((lane) => lane.attack);
}

function pendingAttack(game) {
  const hand = game.handAttacks[0];
  if (hand) return { attack: hand, laneIndex: null };
  const laneIndex = game.lanes.findIndex((lane) => lane.attack);
  return laneIndex >= 0 ? { attack: game.lanes[laneIndex].attack, laneIndex } : null;
}

function resolveAttack(game, attack, laneIndex, events) {
  const defender = attack.targetPlayer;
  const blockValue = (attack.block || []).reduce((sum, block) => sum + block.effectiveValue, 0);
  const prevented = (attack.block || []).reduce((sum, block) => sum + Number(block.preventDamage || 0), 0);
  const damage = Math.max(0, attack.effectiveValue - blockValue - prevented);
  const before = game.players[defender].life;
  game.players[defender].life -= damage;
  game.players[defender].turnData.damageTakenThisTurn += damage;
  if (damage === 0 && (attack.block || []).length) {
    for (const block of attack.block) {
      if (cardIs(block.card, "sheen-quiet-grove-sentinel")) {
        gainLifeFromBlocking(game, defender, 1, "Quiet Grove Sentinel", block.notes, events);
      }
      if (cardIs(block.card, "sheen-raincall-mender")) {
        gainLifeFromBlocking(game, defender, 1, "Raincall Mender", block.notes, events);
      }
    }
    if (playerControlsCard(game, defender, "sheen-beli-awakened")) {
      game.players[defender].turnData.beliAwakenedReady = true;
    }
  }
  game.players[attack.player].discard.push(attack.card);
  game.players[attack.player].discard.push(...(attack.attachedCards || []));
  (attack.block || []).forEach((block) => game.players[block.player].discard.push(block.card));
  events.push(event(game, "damage.calculated", {
    player: defender,
    attackValue: attack.effectiveValue,
    blockValue,
    prevented,
    damage
  }));
  if (damage > 0) {
    events.push(event(game, "damage.dealt", { player: defender, amount: damage, from: before, to: game.players[defender].life }));
  } else {
    events.push(event(game, "attack.fullyBlocked", { player: defender }));
  }
  if (laneIndex == null) game.handAttacks = game.handAttacks.filter((entry) => entry.id !== attack.id);
  else {
    game.lanes[laneIndex].attack = null;
    game.lanes[laneIndex].block = [];
  }
  game.phase = "priority";
  game.priority = defender;
  game.mostRecentAttackDefender = null;
  game.priorityPassed = { 1: false, 2: false };
  game.message = `${damage} damage resolved. Player ${defender} has priority.`;
  events.push(event(game, "combat.resolutionCompleted"), event(game, "priority.granted", { player: defender }));
}

function checkVictory(game, events) {
  const p1 = game.players[1].life;
  const p2 = game.players[2].life;
  events.push(event(game, "lifeCheck.started"));
  if (p1 > 0 && p2 > 0) {
    events.push(event(game, "lifeCheck.completed"));
    return false;
  }
  game.phase = "gameOver";
  game.winner = p1 === p2 ? null : p1 > p2 ? 1 : 2;
  game.message = game.winner == null ? "The match ends in a draw." : `Player ${game.winner} wins!`;
  events.push(event(game, "match.ended", { winner: game.winner }));
  return true;
}

function currentPlacementPlayer(game) {
  return game.endPlacementStep === 0
    ? game.endPlacementFirstPlayer
    : otherPlayer(game.endPlacementFirstPlayer);
}

function startEndPlacement(game, events) {
  game.phase = "end";
  game.endPlacementFirstPlayer = game.startingPriorityThisTurn;
  game.endPlacementLaneIndex = 0;
  game.endPlacementStep = 0;
  game.endPlaced = { 1: [false, false, false], 2: [false, false, false] };
  const actor = currentPlacementPlayer(game);
  game.message = `End placement: Player ${actor} may place in or skip Lane 1.`;
  events.push(event(game, "endPlacement.started", { player: actor, laneIndex: 0 }));
}

function startNextTurn(game, events) {
  clearTemporaryBonuses(game);
  drawToEight(game, 1, events);
  drawToEight(game, 2, events);
  for (const playerNumber of [1, 2]) {
    const turnData = game.players[playerNumber].turnData;
    drawExtraCards(
      game,
      playerNumber,
      Number(turnData.sheenEndTurnDraws || 0),
      "Tang's Patient Hand",
      events
    );
    drawExtraCards(
      game,
      playerNumber,
      Number(turnData.biziEndTurnDraws || 0),
      "Clockwork Caravan",
      events
    );
  }
  const next = otherPlayer(game.startingPriorityThisTurn);
  game.turn += 1;
  game.phase = "priority";
  game.priority = next;
  game.startingPriorityThisTurn = next;
  game.lastActivePlayer = next;
  game.priorityPassed = { 1: false, 2: false };
  game.endPlacementLaneIndex = 0;
  game.endPlacementStep = 0;
  game.players[1].turnData = createTurnData();
  game.players[2].turnData = createTurnData();
  let campaignMessage = "";
  if (game.campaign) {
    game.campaign.bossAttacksThisTurn = 0;
    const bossHealing = Number(game.campaign.bossAbility?.healAtTurnStart || 0);
    if (bossHealing > 0 && game.players[2]) {
      game.players[2].life += bossHealing;
      campaignMessage = `${game.campaign.bossAbility.name} restored ${bossHealing} life. `;
      events.push(event(game, "campaign.bossHealed", {
        player: 2,
        amount: bossHealing,
        abilityId: game.campaign.bossAbility.id
      }));
    }
  }
  game.message = `${campaignMessage}Turn ${game.turn}: Player ${next} has starting priority.`;
  events.push(event(game, "startingPriority.rotated", { player: next }), event(game, "turn.started", { player: next }));
}

function advancePlacement(game, events) {
  if (game.endPlacementStep === 0) game.endPlacementStep = 1;
  else {
    game.endPlacementStep = 0;
    game.endPlacementLaneIndex += 1;
  }
  if (game.endPlacementLaneIndex > 2) {
    startNextTurn(game, events);
    return;
  }
  const actor = currentPlacementPlayer(game);
  game.message = `End placement: Player ${actor} may place in or skip Lane ${game.endPlacementLaneIndex + 1}.`;
  events.push(event(game, "lanePlacement.requested", { player: actor, laneIndex: game.endPlacementLaneIndex }));
}

function normalizeCommand(command) {
  if (!command) return command;
  if (command.type === "attack.declare") {
    return command.source === "lane"
      ? { ...command, type: "declareLaneAttack" }
      : { ...command, type: "declareHandAttack", attackerCardId: command.cardId };
  }
  if (command.type === "block.declare") {
    return command.source === "lane"
      ? { ...command, type: "declareLaneBlock" }
      : { ...command, type: "declareHandBlock", blockerCardIds: command.blockCardIds };
  }
  if (command.type === "block.decline") return { ...command, type: "declineBlock" };
  if (command.type === "priority.pass") return { ...command, type: "passPriority" };
  if (command.type === "lane.place") return { ...command, type: "placeFacedown" };
  if (command.type === "lane.skip") return { ...command, type: "skipPlacement" };
  return command;
}

function applyCommand(current, rawCommand) {
  const envelope = rawCommand?.command && typeof rawCommand.command === "object"
    ? rawCommand
    : null;
  const commandId = envelope?.commandId || rawCommand?.commandId || null;
  const command = normalizeCommand(envelope
    ? {
        ...envelope.command,
        player: envelope.command.player ?? envelope.actorPlayerId,
        __system: envelope.system === true,
        __commandId: commandId
      }
    : rawCommand);
  if (!current || !command) return reject(current, command, "A match and command are required.");
  if (
    envelope
    && Number.isFinite(Number(envelope.baseRevision))
    && Number(envelope.baseRevision) !== Number(current.revision || 0)
  ) {
    return reject(
      current,
      command,
      `Stale command revision ${envelope.baseRevision}; current revision is ${current.revision || 0}.`,
      commandId
    );
  }
  if (current.phase === "gameOver") return reject(current, command, "The match is already over.");
  const game = clone(current);
  const player = Number(command.player);
  const actor = game.players[player];
  const events = [];
  let label = "";

  if (!actor) return reject(current, command, "Unknown player.");

  if (command.type === "declareCampaignBossAttack") {
    if (!command.__system) {
      return reject(current, command, "Campaign boss commands are server-authenticated.");
    }
    if (
      !game.campaign
      || player !== 2
      || game.phase !== "priority"
      || game.priority !== 2
      || hasPendingAttack(game)
    ) {
      return reject(current, command, "The campaign boss cannot attack in the current window.");
    }
    const campaign = game.campaign;
    const attackNumber = Number(campaign.bossAttacksThisTurn || 0) + 1;
    if (attackNumber > Number(campaign.attacksPerTurn || 0)) {
      return reject(current, command, "The campaign boss has used all scripted attacks this turn.");
    }
    const minValue = Number(campaign.minAttackValue || 5);
    const maxValue = Number(campaign.maxAttackValue || 8);
    const valueRange = Math.max(1, maxValue - minValue + 1);
    const baseValue = minValue
      + ((Number(game.turn || 1) + attackNumber + Number(campaign.chapterNumber || 1)) % valueRange);
    const ability = campaign.bossAbility || null;
    let bonus = 0;
    if (ability?.id === "first-strike") bonus = attackNumber === 1 ? 1 : 0;
    else if (ability?.id === "odd-pressure") bonus = attackNumber % 2 === 1 ? 1 : 0;
    else if (ability?.id === "even-feint") bonus = attackNumber % 2 === 0 ? Number(ability.evenBonus || 1) : 0;
    else if (ability?.id === "final-push") {
      bonus = attackNumber === campaign.attacksPerTurn ? (Number(ability.tier || 0) >= 3 ? 2 : 1) : 0;
    } else if (ability?.id === "late-pressure") {
      bonus = attackNumber >= Math.max(1, campaign.attacksPerTurn - 1) ? 1 : 0;
    } else if (ability?.id === "first-and-final") {
      bonus = attackNumber === 1 || attackNumber === campaign.attacksPerTurn ? 1 : 0;
    }
    const value = baseValue + bonus;
    const notes = [
      `Boss strike ${attackNumber}/${campaign.attacksPerTurn}`,
      ...(bonus > 0 ? [`${ability.name} +${bonus}`] : [])
    ];
    const suits = ["♠", "♥", "♦", "♣"];
    const suit = suits[
      (Number(game.turn || 1) + attackNumber + Number(campaign.chapterNumber || 1)) % suits.length
    ];
    const rankNames = { 11: "J", 12: "Q", 13: "K", 14: "A" };
    const cardId = `${game.matchId}-campaign-${campaign.chapterId}-${game.turn}-${attackNumber}`;
    const attackCard = {
      id: cardId,
      value,
      suit,
      rank: rankNames[value] || String(value),
      name: `${campaign.opponentName} Strike ${attackNumber}`,
      faction: actor.faction?.name,
      factionId: actor.faction?.id,
      image: actor.faction?.cardImage,
      campaignBossCard: true
    };
    const attack = {
      id: `${game.matchId}-attack-${game.eventSequence + 1}`,
      player: 2,
      targetPlayer: 1,
      card: attackCard,
      source: "campaignBoss",
      sourceLane: null,
      effectiveValue: value,
      block: [],
      attachedCards: [],
      notes,
      payment: {
        player: 2,
        cards: [],
        total: 0,
        required: 0,
        campaignBoss: true
      }
    };
    campaign.bossAttacksThisTurn = attackNumber;
    game.handAttacks.push(attack);
    game.priorityPassed = { 1: false, 2: false };
    game.priority = 1;
    game.mostRecentAttackDefender = 1;
    game.message = `${campaign.opponentName} launched scripted attack ${attackNumber}/${campaign.attacksPerTurn}. Player 1 may block or decline.`;
    events.push(
      event(game, "campaign.attackDeclared", {
        player: 2,
        targetPlayer: 1,
        attackId: attack.id,
        cardId,
        attackNumber,
        effectiveValue: value
      }),
      event(game, "attack.declared", {
        player: 2,
        targetPlayer: 1,
        attackId: attack.id,
        source: "campaignBoss",
        sourceLane: null,
        effectiveValue: value
      }),
      event(game, "priority.granted", { player: 1 })
    );
    label = `${campaign.opponentName} declared scripted attack ${attackNumber}.`;
  } else if (command.type === "declareHandAttack" || command.type === "declareLaneAttack") {
    if (game.phase !== "priority" || game.priority !== player || hasPendingAttack(game)) {
      return reject(current, command, "That player does not have an open priority window to attack.");
    }
    const laneIndex = command.type === "declareLaneAttack" ? Number(command.laneIndex) : null;
    const attackCard = laneIndex == null
      ? findHandCard(actor, command.attackerCardId || command.cardId)
      : game.lanes[laneIndex]?.facedown?.[player];
    if (!attackCard) return reject(current, command, laneIndex == null ? "Select an attacker from hand." : "That lane has no attacking card.");
    const requirement = attackPaymentRequirement(actor, attackCard, !!command.useMeerusFreeAttack);
    if (requirement.error) return reject(current, command, requirement.error);
    const paymentIds = Array.isArray(command.paymentCardIds) ? command.paymentCardIds : [];
    const excludedIds = laneIndex == null ? [attackCard.id] : [];
    const paymentSelection = validatePayment(actor, paymentIds, 0, excludedIds);
    if (paymentSelection.error) return reject(current, command, paymentSelection.error);
    const hera = heraPaymentBonus(actor, command, paymentIds);
    if (hera.error) return reject(current, command, hera.error);
    const constructedPayment = constructedPaymentBonus(game, player, command, {
      action: "attack",
      card: attackCard
    }, paymentSelection.cards);
    if (constructedPayment.error) return reject(current, command, constructedPayment.error);
    const payment = validatePayment(
      actor,
      paymentIds,
      requirement.required,
      excludedIds,
      hera.bonus + constructedPayment.bonus
    );
    if (payment.error) return reject(current, command, payment.error);
    const attackBonus = calculateFactionAttackBonus(actor, attackCard);
    const constructedAttack = calculateConstructedAttackBonus(
      game,
      player,
      attackCard,
      laneIndex == null ? "hand" : "lane",
      command,
      payment.cards
    );
    if (constructedAttack.error) return reject(current, command, constructedAttack.error);
    attackBonus.bonus += constructedAttack.bonus;
    attackBonus.notes.push(...constructedPayment.notes, ...constructedAttack.notes);
    consumeConstructedPaymentBonus(actor, constructedPayment.consume);
    removeCardsFromHand(actor, payment.cardIds, actor.discard);
    if (laneIndex == null) removeCardsFromHand(actor, [attackCard.id]);
    else game.lanes[laneIndex].facedown[player] = null;
    const defender = otherPlayer(player);
    const attack = {
      id: `attack-${game.eventSequence + 1}`,
      player,
      targetPlayer: defender,
      source: laneIndex == null ? "hand" : "lane",
      sourceLane: laneIndex,
      card: attackCard,
      effectiveValue: cardValue(attackCard) + attackBonus.bonus,
      notes: attackBonus.notes,
      attachedCards: constructedAttack.attachedCards,
      block: [],
      payment: { player, cards: payment.cards, total: payment.total, required: payment.required }
    };
    if (laneIndex == null) game.handAttacks.push(attack);
    else game.lanes[laneIndex].attack = attack;
    actor.turnData.attacksDeclaredThisTurn += 1;
    if (actor.turnData.attacksDeclaredThisTurn === 2 && factionId(actor) === "rumin") {
      actor.turnData.ruminFreeThirdReady = true;
    }
    if (requirement.freeAttackUsed) actor.turnData.ruminFreeThirdReady = false;
    if (hera.bonus) actor.turnData.heraUsed = true;
    actor.turnData.previousAttackSuit = attackCard.suit;
    recordPlayedCard(actor, attackCard);
    if (attackCard.factionId === "bizi") actor.turnData.biziCardsPlayedThisTurn += 1;
    addPaymentSuits(actor, payment.cards);
    applyOverpayFactionEffects(actor, payment.total, payment.required, events, game);
    applyConstructedOverpayEffects(
      game,
      player,
      attackCard,
      payment.total,
      payment.required,
      attack.notes,
      events
    );
    applyAfterConstructedAttack(game, player, attack, attack.payment, events);
    game.phase = "priority";
    game.priority = defender;
    game.mostRecentAttackDefender = defender;
    game.priorityPassed = { 1: false, 2: false };
    game.paymentLog.push({ type: "attack", player, cards: payment.cards, total: payment.total, required: payment.required });
    game.message = `Player ${player} attacked ${laneIndex == null ? "from hand" : `from Lane ${laneIndex + 1}`}. Player ${defender} may block or decline.`;
    events.push(
      event(game, "payment.discarded", { player, cardIds: payment.cardIds, total: payment.total, required: payment.required }),
      ...(hera.bonus ? [event(game, "payment.modified", {
        player,
        source: "Hera",
        cardId: hera.card.id,
        amount: hera.bonus
      })] : []),
      ...(constructedPayment.bonus ? [event(game, "payment.modified", {
        player,
        source: "constructed",
        amount: constructedPayment.bonus,
        notes: constructedPayment.notes
      })] : []),
      ...(attack.attachedCards.length ? [event(game, "weapons.armed", {
        player,
        attackId: attack.id,
        cardIds: attack.attachedCards.map((card) => card.id)
      })] : []),
      event(game, "attack.declared", {
        player,
        cardId: attackCard.id,
        laneIndex,
        effectiveValue: attack.effectiveValue,
        notes: attack.notes
      })
    );
    label = `Player ${player} declared a ${laneIndex == null ? "hand" : `Lane ${laneIndex + 1}`} attack with ${attackCard.rank}${attackCard.suit}.`;
  } else if (command.type === "declareHandBlock" || command.type === "declareLaneBlock") {
    const pending = pendingAttack(game);
    if (!pending || game.phase !== "priority" || game.priority !== player || pending.attack.targetPlayer !== player) {
      return reject(current, command, "That player is not the active defender.");
    }
    const laneBlock = command.type === "declareLaneBlock";
    if (laneBlock !== (pending.laneIndex != null)) {
      return reject(current, command, laneBlock ? "A hand attack cannot be blocked from a lane." : "A lane attack can only be blocked from the same lane.");
    }
    let blockCards;
    if (laneBlock) {
      if (Number(command.laneIndex) !== pending.laneIndex) return reject(current, command, "The blocker must come from the attacked lane.");
      const laneCard = game.lanes[pending.laneIndex].facedown[player];
      if (!laneCard) return reject(current, command, "There is no face-down blocker in that lane.");
      blockCards = [laneCard];
    } else {
      const ids = Array.isArray(command.blockerCardIds) ? command.blockerCardIds : [];
      if (!ids.length || !unique(ids)) return reject(current, command, "Choose one or more unique hand blockers.");
      blockCards = ids.map((id) => findHandCard(actor, id));
      if (blockCards.some((card) => !card)) return reject(current, command, "Every blocker must be in the defender’s hand.");
    }
    const blockerIds = blockCards.map((card) => card.id);
    const required = blockCards.reduce((sum, card) => sum + cardValue(card), 0);
    const paymentIds = Array.isArray(command.paymentCardIds) ? command.paymentCardIds : [];
    const paymentSelection = validatePayment(actor, paymentIds, 0, blockerIds);
    if (paymentSelection.error) return reject(current, command, paymentSelection.error);
    const hera = heraPaymentBonus(actor, command, paymentIds);
    if (hera.error) return reject(current, command, hera.error);
    const constructedPayment = constructedPaymentBonus(game, player, command, {
      action: "block",
      card: blockCards[0],
      blockCards
    }, paymentSelection.cards);
    if (constructedPayment.error) return reject(current, command, constructedPayment.error);
    const constructedBlockChoices = validateConstructedBlockChoices(actor, blockCards, command);
    if (constructedBlockChoices.error) return reject(current, command, constructedBlockChoices.error);
    const payment = validatePayment(
      actor,
      paymentIds,
      required,
      blockerIds,
      hera.bonus + constructedPayment.bonus
    );
    if (payment.error) return reject(current, command, payment.error);
    const blockNumber = Number(actor.turnData.blocksDeclaredThisTurn || 0) + 1;
    const sheenBonus = factionId(actor) === "sheen" ? (blockNumber >= 3 ? 2 : 1) : 0;
    removeCardsFromHand(actor, payment.cardIds, actor.discard);
    if (laneBlock) game.lanes[pending.laneIndex].facedown[player] = null;
    else removeCardsFromHand(actor, blockerIds);
    const blockEntries = blockCards.map((card, cardIndex) => {
      const consecutive = calculateFrumoConsecutiveBonus(actor, card);
      const notes = sheenBonus ? [`Emperor Nu +${sheenBonus}`] : [];
      notes.push(...consecutive.notes);
      const constructedBlock = calculateConstructedBlockBonus(game, player, card, {
        attack: pending.attack,
        laneBlock,
        paymentTotal: payment.total,
        required,
        firstBlocker: cardIndex === 0
      }, command);
      if (constructedBlock.error) return { error: constructedBlock.error };
      notes.push(...constructedPayment.notes, ...constructedBlock.notes);
      const moonlitBonus = (
        cardIs(card, "frumo-poleas-moonlit-map")
        && consecutive.bonus > 0
      ) ? 1 : 0;
      if (moonlitBonus) notes.push("Polea's Moonlit Map +1");
      const entry = {
        id: `block-${card.id}`,
        player,
        source: laneBlock ? "lane" : "hand",
        card,
        effectiveValue: cardValue(card)
          + temporaryBonus(card)
          + sheenBonus
          + consecutive.bonus
          + constructedBlock.bonus
          + moonlitBonus,
        preventDamage: constructedBlock.preventDamage,
        notes,
        payment: { player, cards: payment.cards, total: payment.total, required }
      };
      recordPlayedCard(actor, card);
      if (card.factionId === "bizi") actor.turnData.biziCardsPlayedThisTurn += 1;
      return entry;
    });
    const constructedBlockError = blockEntries.find((entry) => entry.error);
    if (constructedBlockError) return reject(current, command, constructedBlockError.error);
    if (payment.cards.some((card) => cardIs(card, "sheen-mossbound-staff"))) {
      blockEntries[0].effectiveValue += 1;
      blockEntries[0].notes.push("Mossbound Staff +1");
    }
    if (
      blockEntries.length >= 2
      && payment.cards.some((card) => cardIs(card, "sheen-sapling-chorus"))
    ) {
      blockEntries[0].effectiveValue += 1;
      blockEntries[0].notes.push("Sapling Chorus +1");
    }
    pending.attack.block.push(...blockEntries);
    if (pending.laneIndex != null) game.lanes[pending.laneIndex].block.push(...blockEntries);
    actor.turnData.blocksDeclaredThisTurn += 1;
    if (hera.bonus) actor.turnData.heraUsed = true;
    consumeConstructedPaymentBonus(actor, constructedPayment.consume);
    addPaymentSuits(actor, payment.cards);
    if (factionId(actor) === "sheen" && actor.turnData.blocksDeclaredThisTurn === 2) {
      actor.turnData.sheenLargeAttackReady = true;
      gainLifeFromBlocking(game, player, 2, "Tang", blockEntries[0].notes, events);
    }
    applyOverpayFactionEffects(actor, payment.total, payment.required, events, game);
    applyConstructedOverpayEffects(
      game,
      player,
      blockCards[0],
      payment.total,
      payment.required,
      blockEntries[0].notes,
      events
    );
    applyAfterConstructedBlock(game, player, blockEntries, events);
    game.paymentLog.push({ type: "block", player, cards: payment.cards, total: payment.total, required });
    events.push(
      event(game, "payment.discarded", { player, cardIds: payment.cardIds, total: payment.total, required }),
      ...(hera.bonus ? [event(game, "payment.modified", {
        player,
        source: "Hera",
        cardId: hera.card.id,
        amount: hera.bonus
      })] : []),
      ...(constructedPayment.bonus ? [event(game, "payment.modified", {
        player,
        source: "constructed",
        amount: constructedPayment.bonus,
        notes: constructedPayment.notes
      })] : []),
      ...(constructedBlockChoices.selectedIds.length ? [event(game, "acceleration.spent", {
        player,
        amount: constructedBlockChoices.selectedIds.length,
        cardIds: constructedBlockChoices.selectedIds,
        source: "constructed-block"
      })] : []),
      event(game, "block.declared", { player, cardIds: blockerIds, laneIndex: pending.laneIndex })
    );
    label = `Player ${player} blocked with ${blockCards.map((card) => `${card.rank}${card.suit}`).join(", ")}.`;
    if (game.gameMode === "basic") {
      resolveAttack(game, pending.attack, pending.laneIndex, events);
    } else {
      game.priorityPassed = { 1: false, 2: false };
      game.priorityPassed[player] = true;
      game.priority = pending.attack.player;
      game.message = `Player ${player} blocked. Player ${pending.attack.player} may pass to resolve combat.`;
      events.push(event(game, "priority.granted", { player: pending.attack.player }));
    }
  } else if (command.type === "declineBlock") {
    const pending = pendingAttack(game);
    if (!pending || game.phase !== "priority" || game.priority !== player || pending.attack.targetPlayer !== player) {
      return reject(current, command, "Only the active defender may decline this block.");
    }
    events.push(event(game, "block.declined", { player }));
    label = `Player ${player} declined the block.`;
    if (game.gameMode === "basic") {
      resolveAttack(game, pending.attack, pending.laneIndex, events);
    } else {
      game.priorityPassed[player] = true;
      game.priority = pending.attack.player;
      game.message = `Player ${player} declined the block. Player ${pending.attack.player} may pass to resolve combat.`;
      events.push(event(game, "priority.granted", { player: pending.attack.player }));
    }
  } else if (command.type === "useFactionAbility") {
    if (game.phase !== "priority" || game.priority !== player) {
      return reject(current, command, "Faction abilities require your priority window.");
    }
    const abilityId = String(command.abilityId || "");
    const actorFaction = factionId(actor);
    const laneIndex = Number(command.laneIndex ?? command.targets?.laneIndex);
    const cardId = command.cardId || command.targets?.cardId;

    if (abilityId.startsWith("polea-")) {
      if (actorFaction !== "frumo") return reject(current, command, "Polea belongs to Frumo.");
      const usingSunkenOrder = actor.turnData.poleaUsed;
      if (
        usingSunkenOrder
        && (
          actor.turnData.poleaSunkenOrderUsed
          || !playerControlsCard(game, player, "frumo-poleas-sunken-order")
        )
      ) {
        return reject(current, command, "Polea has already been used this turn.");
      }

      if (abilityId === "polea-place") {
        const card = findHandCard(actor, cardId);
        if (!card) return reject(current, command, "Choose a Frumo hand card to place.");
        if (!Number.isInteger(laneIndex) || laneIndex < 0 || laneIndex > 2) {
          return reject(current, command, "Choose an empty lane.");
        }
        if (game.lanes[laneIndex].facedown[player]) {
          return reject(current, command, "Polea can only place into an empty lane.");
        }
        removeCardsFromHand(actor, [card.id]);
        game.lanes[laneIndex].facedown[player] = card;
        const laneEntry = applyConstructedLaneEntry(game, player, card, laneIndex, command, events);
        if (laneEntry.error) return reject(current, command, laneEntry.error);
        events.push(event(game, "card.placedFacedown", { player, cardId: card.id, laneIndex, source: "Polea" }));
        label = `Player ${player} used Polea to place a card in Lane ${laneIndex + 1}.`;
      } else if (abilityId === "polea-swap") {
        const laneA = Number(command.laneA ?? command.targets?.laneA);
        const laneB = Number(command.laneB ?? command.targets?.laneB);
        if (
          !Number.isInteger(laneA)
          || !Number.isInteger(laneB)
          || laneA === laneB
          || laneA < 0
          || laneB < 0
          || laneA > 2
          || laneB > 2
        ) {
          return reject(current, command, "Choose two different lanes.");
        }
        const cardA = game.lanes[laneA].facedown[player];
        const cardB = game.lanes[laneB].facedown[player];
        if (!cardA && !cardB) {
          return reject(current, command, "At least one chosen lane must contain a card you control.");
        }
        [
          game.lanes[laneA].facedown[player],
          game.lanes[laneB].facedown[player]
        ] = [
          game.lanes[laneB].facedown[player],
          game.lanes[laneA].facedown[player]
        ];
        const movedCardCount = Number(!!cardA) + Number(!!cardB);
        actor.turnData.frumoLaneSwappedThisTurn = true;
        if (playerControlsCard(game, player, "frumo-tide-debt-ledger")) {
          actor.turnData.frumoNextPaymentBonus += 1;
        }
        events.push(event(game, "lanes.swapped", {
          player,
          laneA,
          laneB,
          movedCardCount,
          source: "Polea"
        }));
        label = movedCardCount === 1
          ? `Player ${player} used Polea to move a card between Lanes ${laneA + 1} and ${laneB + 1}.`
          : `Player ${player} used Polea to switch Lanes ${laneA + 1} and ${laneB + 1}.`;
      } else if (abilityId === "polea-peek") {
        const targetPlayer = Number(command.targetPlayerId ?? command.targets?.targetPlayerId ?? otherPlayer(player));
        if (![1, 2].includes(targetPlayer)) {
          return reject(current, command, "Choose a face-down card controlled by either player.");
        }
        const card = game.lanes[laneIndex]?.facedown?.[targetPlayer];
        if (!card) return reject(current, command, "Choose an occupied face-down lane card.");
        if (usingSunkenOrder && targetPlayer !== player) {
          return reject(current, command, "Polea's Sunken Order may only target your own cards.");
        }
        const lastGambleChoice = command.lastGambleChoice || null;
        if (lastGambleChoice && !["attack", "block"].includes(lastGambleChoice)) {
          return reject(current, command, "The Last Gamble must choose attack or block.");
        }
        if (lastGambleChoice && !playerControlsCard(game, player, "frumo-the-last-gamble")) {
          return reject(current, command, "The Last Gamble is not under your control.");
        }
        events.push(event(game, "card.peeked", {
          player,
          viewer: player,
          targetPlayer,
          laneIndex,
          card: { ...card }
        }));
        if (lastGambleChoice) {
          actor.turnData.frumoNextActionBonus = 4;
          actor.turnData.frumoNextActionKind = lastGambleChoice;
          events.push(event(game, "choice.committed", {
            player,
            source: "The Last Gamble",
            choice: lastGambleChoice
          }));
        }
        for (const support of supportCards(game, player)) {
          if (cardIs(support, "frumo-riptide-smuggler") && !actor.turnData.frumoRiptideSmugglerUsed) {
            support.temporaryValueBonus = temporaryBonus(support) + 1;
            actor.turnData.frumoRiptideSmugglerUsed = true;
            events.push(event(game, "card.buffApplied", {
              player,
              cardId: support.id,
              amount: 1,
              source: "Riptide Smuggler"
            }));
          }
        }
        label = `Player ${player} used Polea to inspect a face-down card.`;
      } else if (abilityId === "polea-buff") {
        const target = resolveFactionTarget(game, actor, command);
        if (!target) return reject(current, command, "Choose a card you control for Polea.");
        if (target.card && Number.isFinite(Number(target.effectiveValue))) {
          target.effectiveValue += 1;
          target.notes = [...(target.notes || []), "Polea +1"];
        } else {
          target.temporaryValueBonus = temporaryBonus(target) + 1;
        }
        events.push(event(game, "card.buffApplied", { player, amount: 1, source: "Polea" }));
        label = `Player ${player} used Polea to give a card +1 this turn.`;
      } else {
        return reject(current, command, "Unknown Polea mode.");
      }
      actor.turnData.poleaUsed = true;
      if (usingSunkenOrder) actor.turnData.poleaSunkenOrderUsed = true;
    } else if (abilityId === "lafayette-swap") {
      if (actorFaction !== "frumo") return reject(current, command, "Lafayette belongs to Frumo.");
      if (actor.turnData.lafayetteUsed) return reject(current, command, "Lafayette has already been used this turn.");
      const handCard = findHandCard(actor, cardId);
      const laneCard = game.lanes[laneIndex]?.facedown?.[player];
      if (!handCard || !laneCard) return reject(current, command, "Choose a hand card and an occupied lane you control.");
      const handIndex = actor.hand.findIndex((card) => card.id === handCard.id);
      actor.hand[handIndex] = laneCard;
      game.lanes[laneIndex].facedown[player] = handCard;
      actor.turnData.lafayetteUsed = true;
      actor.turnData.frumoLaneSwappedThisTurn = true;
      if (playerControlsCard(game, player, "frumo-lafayettes-chart")) {
        actor.turnData.frumoNextPaymentBonus += 1;
      }
      if (playerControlsCard(game, player, "frumo-tide-debt-ledger")) {
        actor.turnData.frumoNextPaymentBonus += 1;
      }
      const laneEntry = applyConstructedLaneEntry(game, player, handCard, laneIndex, command, events);
      if (laneEntry.error) return reject(current, command, laneEntry.error);
      events.push(event(game, "laneCard.swappedWithHand", { player, laneIndex, source: "Lafayette" }));
      label = `Player ${player} used Lafayette to swap a hand and lane card.`;
    } else if (abilityId === "focus-buff") {
      if (actorFaction !== "bizi") return reject(current, command, "Focus belongs to Bizi.");
      if (actor.turnData.focusUsed) return reject(current, command, "Focus has already been used this turn.");
      if (Number(actor.accelerationCounters || 0) < 1) return reject(current, command, "Focus needs an acceleration counter.");
      const target = resolveFactionTarget(game, actor, command);
      if (!target) return reject(current, command, "Choose a card you control for Focus.");
      const focusBonus = playerControlsCard(game, player, "bizi-focus-overclock") ? 3 : 1;
      if (target.card && Number.isFinite(Number(target.effectiveValue))) {
        target.effectiveValue += focusBonus;
        target.notes = [...(target.notes || []), `Focus +${focusBonus}`];
      } else {
        target.temporaryValueBonus = temporaryBonus(target) + focusBonus;
      }
      actor.accelerationCounters -= 1;
      actor.turnData.focusUsed = true;
      events.push(event(game, "acceleration.spent", { player, amount: 1, source: "Focus" }));
      events.push(event(game, "card.buffApplied", { player, amount: focusBonus, source: "Focus" }));
      label = `Player ${player} spent an acceleration counter with Focus.`;
    } else {
      return reject(current, command, "Unsupported faction ability.");
    }

    game.priorityPassed = { 1: false, 2: false };
    game.message = `${label} Player ${player} retains priority.`;
  } else if (command.type === "passPriority") {
    const activeCombat = pendingAttack(game);
    if (game.phase !== "priority" || game.priority !== player) {
      return reject(current, command, "That player cannot pass priority now.");
    }
    if (activeCombat) {
      if (game.gameMode === "basic") {
        return reject(current, command, "The defender must block or decline before priority can pass.");
      }
      if (
        player === activeCombat.attack.player
        && game.priorityPassed[activeCombat.attack.targetPlayer]
      ) {
        events.push(event(game, "priority.passed", { player }));
        label = `Player ${player} passed to combat resolution.`;
        resolveAttack(game, activeCombat.attack, activeCombat.laneIndex, events);
      } else {
        game.priorityPassed[player] = true;
        game.priority = otherPlayer(player);
        game.message = `Player ${player} passed combat priority. Player ${game.priority} may respond.`;
        events.push(
          event(game, "priority.passed", { player }),
          event(game, "priority.granted", { player: game.priority })
        );
        label = `Player ${player} passed combat priority.`;
      }
    } else {
    game.priorityPassed[player] = true;
    events.push(event(game, "priority.passed", { player }));
    label = `Player ${player} passed priority.`;
    if (game.priorityPassed[1] && game.priorityPassed[2]) {
      events.push(event(game, "priorityRound.closed"));
      if (!checkVictory(game, events)) startEndPlacement(game, events);
    } else {
      game.priority = otherPlayer(player);
      game.message = `Player ${game.priority} has priority.`;
      events.push(event(game, "priority.granted", { player: game.priority }));
    }
    }
  } else if (command.type === "placeFacedown" || command.type === "skipPlacement") {
    if (game.phase !== "end" || currentPlacementPlayer(game) !== player || Number(command.laneIndex) !== game.endPlacementLaneIndex) {
      return reject(current, command, "It is not that player’s placement opportunity.");
    }
    const laneIndex = game.endPlacementLaneIndex;
    const occupied = !!game.lanes[laneIndex].facedown[player];
    if (command.type === "placeFacedown") {
      if (occupied) return reject(current, command, "That lane is already occupied and must be skipped.");
      const card = findHandCard(actor, command.cardId);
      if (!card) return reject(current, command, "Select a card from the acting player’s hand.");
      removeCardsFromHand(actor, [card.id]);
      game.lanes[laneIndex].facedown[player] = card;
      const laneEntry = applyConstructedLaneEntry(game, player, card, laneIndex, command, events);
      if (laneEntry.error) return reject(current, command, laneEntry.error);
      events.push(event(game, "card.placedFacedown", { player, cardId: card.id, laneIndex }));
      label = `Player ${player} placed a face-down card in Lane ${laneIndex + 1}.`;
    } else {
      events.push(event(game, "lanePlacement.skipped", { player, laneIndex }));
      label = `Player ${player} skipped Lane ${laneIndex + 1}.`;
    }
    game.endPlaced[player][laneIndex] = true;
    advancePlacement(game, events);
  } else if (command.type === "concede") {
    game.phase = "gameOver";
    game.winner = otherPlayer(player);
    game.loser = player;
    game.message = `Player ${player} conceded. Player ${game.winner} wins!`;
    events.push(event(game, "match.ended", { winner: game.winner }));
    label = `Player ${player} conceded.`;
  } else {
    return reject(current, command, "Unsupported simulator command.");
  }

  game.revision = Number(current.revision || 0) + 1;
  game.lastCommandId = commandId;
  events.forEach((entry) => {
    entry.revision = game.revision;
  });
  const actionLogEntry = appendHistory(game, player, label, events);
  game.lastEvents = events.map((entry) => ({ ...entry }));
  return {
    commandId,
    accepted: true,
    state: game,
    revision: game.revision,
    legalActions: getLegalActions(game, game.priority),
    rejectionReason: "",
    rejection: null,
    actionLogEntry,
    animationEvents: events
  };
}

function getFactionAbilityActions(game, playerNumber) {
  const actor = game?.players?.[playerNumber];
  if (!actor || game.gameMode !== "factions" || game.phase !== "priority" || game.priority !== playerNumber) {
    return [];
  }
  const actions = [];
  const ownLaneCount = game.lanes.filter((lane) => lane.facedown[playerNumber]).length;
  const activeCombat = pendingAttack(game);
  const controlsActiveAttack = activeCombat?.attack?.player === playerNumber;

  if (factionId(actor) === "frumo") {
    const poleaAvailable = (
      !actor.turnData.poleaUsed
      || (
        !actor.turnData.poleaSunkenOrderUsed
        && playerControlsCard(game, playerNumber, "frumo-poleas-sunken-order")
      )
    );
    if (poleaAvailable) {
      if (actor.hand.length && ownLaneCount < game.lanes.length) {
        actions.push({
          type: "useFactionAbility",
          abilityId: "polea-place",
          label: "Polea · place a hand card",
          intent: FACTION_ABILITY_INTENTS["polea-place"]
        });
      }
      if (ownLaneCount >= 1) {
        actions.push({
          type: "useFactionAbility",
          abilityId: "polea-swap",
          label: "Polea · move or switch lanes",
          intent: FACTION_ABILITY_INTENTS["polea-swap"]
        });
      }
      if (game.lanes.some((lane) => lane.facedown[1] || lane.facedown[2])) {
        actions.push({
          type: "useFactionAbility",
          abilityId: "polea-peek",
          label: "Polea · inspect a face-down card",
          intent: FACTION_ABILITY_INTENTS["polea-peek"],
          optionalEffects: playerControlsCard(game, playerNumber, "frumo-the-last-gamble")
            ? [{
                id: "last-gamble-choice",
                kind: "choice",
                choices: ["attack", "block"],
                label: "The Last Gamble · empower the next attack or block"
              }]
            : []
        });
      }
      if (ownLaneCount >= 1 || controlsActiveAttack) {
        actions.push({
          type: "useFactionAbility",
          abilityId: "polea-buff",
          label: "Polea · give a card +1",
          intent: FACTION_ABILITY_INTENTS["polea-buff"]
        });
      }
    }
    if (!actor.turnData.lafayetteUsed && actor.hand.length && ownLaneCount >= 1) {
      actions.push({
        type: "useFactionAbility",
        abilityId: "lafayette-swap",
        label: "Lafayette · switch hand and lane",
        intent: FACTION_ABILITY_INTENTS["lafayette-swap"]
      });
    }
  }

  if (
    factionId(actor) === "bizi"
    && Number(actor.accelerationCounters || 0) > 0
    && !actor.turnData.focusUsed
    && (ownLaneCount >= 1 || controlsActiveAttack)
  ) {
    actions.push({
      type: "useFactionAbility",
      abilityId: "focus-buff",
      label: playerControlsCard(game, playerNumber, "bizi-focus-overclock")
        ? "Focus Overclock · spend 1 acceleration for +3"
        : "Focus · spend 1 acceleration for +1",
      intent: FACTION_ABILITY_INTENTS["focus-buff"]
    });
  }
  return actions;
}

function getConstructedAttackOptions(game, playerNumber, card, source) {
  const player = game.players[playerNumber];
  const options = [];
  if (
    cardIs(card, "rumin-forum-ledger-runner")
    && Number(player.turnData.attacksDeclaredThisTurn || 0) === 0
  ) {
    options.push({
      id: "forum-ledger-payment",
      kind: "payment-card",
      amount: 1,
      label: "Forum Ledger Runner · make one selected payment card +1"
    });
  }
  if (player.turnData.ruminJewelBankAvailable && card?.factionId === "rumin") {
    options.push({
      id: "jewel-bank-payment",
      kind: "toggle",
      amount: 2,
      requiresPaymentCardCount: 1,
      label: "Jewel-Bank Contract · make the single payment card +2"
    });
  }
  if (source === "hand") {
    const weapons = controlledLaneEntries(game, playerNumber)
      .filter((entry) => entry.card.factionId === "rumin" && cardHasType(entry.card, "weapon"));
    if (weapons.length) {
      options.push({
        id: "arm-rumin-weapons",
        kind: "card-list",
        maximum: cardIs(card, "rumin-rumie-market-colossus") ? weapons.length : 1,
        cardIds: weapons.map((entry) => entry.card.id),
        cards: weapons.map((entry) => ({
          cardId: entry.card.id,
          laneIndex: entry.laneIndex,
          label: entry.card.name || "Rumin weapon"
        })),
        label: "Arm Rumin weapon"
      });
    }
  }
  if (cardIs(card, "bizi-sandstorm-processor") && Number(player.accelerationCounters || 0) >= 2) {
    options.push({
      id: "sandstorm-processor",
      kind: "toggle",
      amount: 2,
      label: "Sandstorm Processor · attack with +2"
    });
  }
  if (cardIs(card, "sheen-beli-awakened") && player.turnData.beliAwakenedReady) {
    options.push({
      id: "beli-awakened",
      kind: "toggle",
      amount: 3,
      label: "Beli Awakened · attack with +3"
    });
  }
  if (cardIs(card, "bizi-voltaric-ultimatum") && Number(player.accelerationCounters || 0) >= 2) {
    options.push({
      id: "voltaric-ultimatum",
      kind: "toggle",
      cost: 2,
      amount: 5,
      label: "Voltaric Ultimatum · spend 2 acceleration for +5"
    });
  }
  if (cardIs(card, "bizi-constanti-sunforge")) {
    options.push({
      id: "constanti-sunforge",
      kind: "amount",
      minimum: 0,
      maximum: Math.min(3, Number(player.accelerationCounters || 0)),
      valuePerUnit: 2,
      label: "Constanti Sunforge · choose 0–3 acceleration"
    });
  }
  if (Number(player.turnData.biziPrimeSignalAvailable || 0) > 0) {
    options.push({
      id: "focus-prime-signal",
      kind: "amount",
      minimum: 0,
      maximum: Math.min(4, Number(player.turnData.biziPrimeSignalAvailable || 0)),
      valuePerUnit: 1,
      label: "Focus Prime Signal · choose the next-card bonus"
    });
  }
  return options;
}

function getConstructedBlockOptions(game, playerNumber, candidateCards) {
  const player = game.players[playerNumber];
  const accelerationCards = candidateCards.filter((card) => (
    cardIs(card, "bizi-gearplate-shield")
    || cardIs(card, "bizi-heat-sink-matrix")
  ));
  const options = [];
  if (accelerationCards.length && Number(player.accelerationCounters || 0) > 0) {
    options.push({
      id: "acceleration-blockers",
      kind: "card-list",
      maximum: Math.min(accelerationCards.length, Number(player.accelerationCounters || 0)),
      cardIds: accelerationCards.map((card) => card.id),
      label: "Spend 1 acceleration for +2 on each selected blocker"
    });
  }
  if (Number(player.turnData.biziPrimeSignalAvailable || 0) > 0) {
    options.push({
      id: "focus-prime-signal",
      kind: "amount",
      minimum: 0,
      maximum: Math.min(4, Number(player.turnData.biziPrimeSignalAvailable || 0)),
      valuePerUnit: 1,
      label: "Focus Prime Signal · choose the next-card bonus"
    });
  }
  return options;
}

function selectionGroup(key, role, entities, minimum = 1, maximum = 1, ordered = false) {
  return {
    key,
    role,
    entityType: entities[0]?.type || "entity",
    entities,
    entityIds: entities.map((entity) => entity.id),
    minimum,
    maximum,
    ordered
  };
}

function handCardEntity(card, owner) {
  return {
    id: card.id,
    type: "handCard",
    owner: Number(owner),
    cardId: card.id
  };
}

function laneEntity(laneIndex, owner, occupied, cardId = null) {
  return {
    id: `lane:${laneIndex}:player:${owner}`,
    type: occupied ? "laneCard" : "lane",
    owner: Number(owner),
    laneIndex: Number(laneIndex),
    occupied: Boolean(occupied),
    ...(cardId ? { cardId } : {})
  };
}

function attackEntity(attack, laneIndex) {
  return {
    id: attack.id,
    type: laneIndex == null ? "handAttack" : "laneAttack",
    owner: Number(attack.player),
    attackId: attack.id,
    laneIndex: laneIndex == null ? null : Number(laneIndex)
  };
}

function normalizeLegalAction(game, playerNumber, action) {
  const actor = game.players[playerNumber];
  const opponent = otherPlayer(playerNumber);
  const handEntities = actor.hand.map((card) => handCardEntity(card, playerNumber));
  const pending = pendingAttack(game);
  const sources = [];
  const targets = [];
  let payment = null;
  const fixed = {};
  const selected = {};

  if (action.type === "declareHandAttack") {
    const source = handEntities.find((entity) => entity.cardId === action.cardId);
    if (source) sources.push(selectionGroup("cardId", "attacker", [source]));
    targets.push(selectionGroup("targetPlayerId", "defender", [{
      id: `player:${opponent}`,
      type: "player",
      playerId: opponent,
      owner: opponent
    }]));
    payment = {
      requiredValue: Number(action.requiredPayment || 0),
      mode: "cardValueTotal",
      eligibleCardIds: actor.hand.filter((card) => card.id !== action.cardId).map((card) => card.id),
      excludedCardIds: [action.cardId],
      excludesSelections: ["cardId"],
      minimumCards: 0,
      maximumCards: Math.max(0, actor.hand.length - 1),
      selectionOrderMatters: false
    };
    fixed.cardId = action.cardId;
    fixed.targetPlayerId = opponent;
    selected.paymentCardIds = "payment";
  } else if (action.type === "declareLaneAttack") {
    const card = game.lanes[action.laneIndex]?.facedown?.[playerNumber];
    sources.push(selectionGroup("laneIndex", "attacker", [
      laneEntity(action.laneIndex, playerNumber, true, card?.id)
    ]));
    targets.push(selectionGroup("targetPlayerId", "defender", [{
      id: `player:${opponent}`,
      type: "player",
      playerId: opponent,
      owner: opponent
    }]));
    payment = {
      requiredValue: Number(action.requiredPayment || 0),
      mode: "cardValueTotal",
      eligibleCardIds: actor.hand.map((cardEntry) => cardEntry.id),
      excludedCardIds: [],
      excludesSelections: [],
      minimumCards: 0,
      maximumCards: actor.hand.length,
      selectionOrderMatters: false
    };
    fixed.laneIndex = Number(action.laneIndex);
    fixed.targetPlayerId = opponent;
    selected.paymentCardIds = "payment";
  } else if (action.type === "declareHandBlock") {
    sources.push(selectionGroup(
      "blockerCardIds",
      "blocker",
      handEntities,
      Number(action.minimumBlockers || 1),
      handEntities.length,
      false
    ));
    if (pending) targets.push(selectionGroup("attackId", "incomingAttack", [attackEntity(pending.attack, null)]));
    payment = {
      requiredValue: null,
      mode: "selectedCardValueTotal",
      eligibleCardIds: actor.hand.map((card) => card.id),
      excludedCardIds: [],
      excludesSelections: ["blockerCardIds"],
      minimumCards: 0,
      maximumCards: actor.hand.length,
      selectionOrderMatters: false
    };
    fixed.attackId = action.attackId;
    selected.blockerCardIds = "blockerCardIds";
    selected.paymentCardIds = "payment";
  } else if (action.type === "declareLaneBlock") {
    const blocker = game.lanes[action.laneIndex]?.facedown?.[playerNumber];
    sources.push(selectionGroup("laneIndex", "blocker", [
      laneEntity(action.laneIndex, playerNumber, true, blocker?.id)
    ]));
    if (pending) targets.push(selectionGroup("attackId", "incomingAttack", [attackEntity(pending.attack, pending.laneIndex)]));
    payment = {
      requiredValue: cardValue(blocker),
      mode: "cardValueTotal",
      eligibleCardIds: actor.hand.map((card) => card.id),
      excludedCardIds: [],
      excludesSelections: [],
      minimumCards: 0,
      maximumCards: actor.hand.length,
      selectionOrderMatters: false
    };
    fixed.laneIndex = Number(action.laneIndex);
    selected.paymentCardIds = "payment";
  } else if (action.type === "declineBlock") {
    if (pending) targets.push(selectionGroup("attackId", "incomingAttack", [attackEntity(pending.attack, pending.laneIndex)]));
    fixed.attackId = action.attackId;
  } else if (action.type === "placeFacedown") {
    const source = handEntities.find((entity) => entity.cardId === action.cardId);
    if (source) sources.push(selectionGroup("cardId", "placement", [source]));
    targets.push(selectionGroup("laneIndex", "destination", [
      laneEntity(action.laneIndex, playerNumber, false)
    ]));
    fixed.cardId = action.cardId;
    fixed.laneIndex = Number(action.laneIndex);
  } else if (action.type === "skipPlacement") {
    targets.push(selectionGroup("laneIndex", "destination", [
      laneEntity(action.laneIndex, playerNumber, Boolean(game.lanes[action.laneIndex]?.facedown?.[playerNumber]))
    ]));
    fixed.laneIndex = Number(action.laneIndex);
  } else if (action.type === "useFactionAbility") {
    fixed.abilityId = action.abilityId;
    const ownLaneCards = game.lanes.flatMap((lane, laneIndex) => lane.facedown[playerNumber]
      ? [laneEntity(laneIndex, playerNumber, true)]
      : []);
    const controlledAttack = pending?.attack?.player === playerNumber
      ? attackEntity(pending.attack, pending.laneIndex)
      : null;
    if (action.abilityId === "polea-place") {
      sources.push(selectionGroup("cardId", "placement", handEntities));
      const emptyLanes = game.lanes.flatMap((lane, laneIndex) => !lane.facedown[playerNumber]
        ? [laneEntity(laneIndex, playerNumber, false)]
        : []);
      targets.push(selectionGroup("laneIndex", "destination", emptyLanes));
    } else if (action.abilityId === "polea-swap") {
      const lanes = game.lanes.map((lane, laneIndex) => (
        laneEntity(laneIndex, playerNumber, Boolean(lane.facedown[playerNumber]))
      ));
      targets.push(selectionGroup("laneIndexes", "lanePair", lanes, 2, 2, false));
    } else if (action.abilityId === "polea-peek") {
      const usingSunkenOrder = Boolean(actor.turnData.poleaUsed);
      const owners = usingSunkenOrder ? [playerNumber] : [1, 2];
      const occupied = game.lanes.flatMap((lane, laneIndex) => owners.flatMap((owner) => (
        lane.facedown[owner] ? [laneEntity(laneIndex, owner, true)] : []
      )));
      targets.push(selectionGroup("laneCard", "inspect", occupied));
    } else if (action.abilityId === "polea-buff" || action.abilityId === "focus-buff") {
      const controlledTargets = controlledAttack ? [...ownLaneCards, controlledAttack] : ownLaneCards;
      targets.push(selectionGroup("cardTarget", "buffTarget", controlledTargets));
    } else if (action.abilityId === "lafayette-swap") {
      sources.push(selectionGroup("cardId", "handCard", handEntities));
      targets.push(selectionGroup("laneIndex", "laneCard", ownLaneCards));
    }
  }

  const allSelections = [...sources, ...targets];
  const confirmationPayload = {
    type: action.type,
    fixed,
    selected,
    abilityId: action.abilityId || null
  };
  return {
    ...action,
    id: action.id || [action.type, action.abilityId, action.cardId, action.laneIndex, action.attackId]
      .filter((value) => value !== undefined && value !== null && value !== "")
      .join(":"),
    available: true,
    unavailableReason: null,
    selection: {
      sources,
      targets,
      payment,
      orderMatters: allSelections.some((group) => group.ordered)
    },
    validSourceEntities: sources.flatMap((group) => group.entities),
    validTargetEntities: targets.flatMap((group) => group.entities),
    selectionConstraints: allSelections.map(({ key, role, minimum, maximum, ordered }) => ({
      key,
      role,
      minimum,
      maximum,
      ordered
    })),
    payment,
    confirmationPayload
  };
}

function getLegalActions(game, player) {
  if (!game || game.phase === "gameOver") return [];
  const playerNumber = Number(player);
  const actor = game.players[playerNumber];
  if (!actor) return [];
  const pending = pendingAttack(game);
  if (pending) {
    if (game.priority !== playerNumber) return [];
    const factionActions = getFactionAbilityActions(game, playerNumber);
    if (
      game.gameMode === "factions"
      && pending.attack.player === playerNumber
      && game.priorityPassed[pending.attack.targetPlayer]
    ) {
      return [...factionActions, { type: "passPriority", resolvesCombat: true }]
        .map((action) => normalizeLegalAction(game, playerNumber, action));
    }
    if (pending.attack.targetPlayer !== playerNumber) {
      return factionActions.map((action) => normalizeLegalAction(game, playerNumber, action));
    }
    const actions = [{ type: "declineBlock", attackId: pending.attack.id }];
    if (pending.laneIndex == null) {
      if (actor.hand.length) {
        actions.unshift({
          type: "declareHandBlock",
          attackId: pending.attack.id,
          minimumBlockers: 1,
          optionalEffects: getConstructedBlockOptions(game, playerNumber, actor.hand)
        });
      }
    } else if (game.lanes[pending.laneIndex].facedown[playerNumber]) {
      actions.unshift({
        type: "declareLaneBlock",
        laneIndex: pending.laneIndex,
        optionalEffects: getConstructedBlockOptions(
          game,
          playerNumber,
          [game.lanes[pending.laneIndex].facedown[playerNumber]]
        )
      });
    }
    return [...factionActions, ...actions]
      .map((action) => normalizeLegalAction(game, playerNumber, action));
  }
  if (game.phase === "priority") {
    if (game.priority !== playerNumber) return [];
    return [
      ...getFactionAbilityActions(game, playerNumber),
      ...actor.hand.map((card) => ({
        type: "declareHandAttack",
        cardId: card.id,
        requiredPayment: attackPaymentRequirement(actor, card).required,
        optionalEffects: getConstructedAttackOptions(game, playerNumber, card, "hand"),
        optionalPaymentModifiers: attackPaymentRequirement(actor, card).meerusEligible
          ? [{ id: "meerus-free-attack", requiredPayment: 0 }]
          : []
      })),
      ...game.lanes.flatMap((lane, laneIndex) => lane.facedown[playerNumber]
        ? [{
            type: "declareLaneAttack",
            laneIndex,
            requiredPayment: attackPaymentRequirement(actor, lane.facedown[playerNumber]).required,
            optionalEffects: getConstructedAttackOptions(
              game,
              playerNumber,
              lane.facedown[playerNumber],
              "lane"
            ),
            optionalPaymentModifiers: attackPaymentRequirement(actor, lane.facedown[playerNumber]).meerusEligible
              ? [{ id: "meerus-free-attack", requiredPayment: 0 }]
              : []
          }]
        : []),
      { type: "passPriority" }
    ].map((action) => normalizeLegalAction(game, playerNumber, action));
  }
  if (game.phase === "end" && currentPlacementPlayer(game) === playerNumber) {
    const laneIndex = game.endPlacementLaneIndex;
    const actions = [{ type: "skipPlacement", laneIndex }];
    if (!game.lanes[laneIndex].facedown[playerNumber]) {
      actions.unshift(...actor.hand.map((card) => ({
        type: "placeFacedown",
        laneIndex,
        cardId: card.id,
        optionalEffects: cardIs(card, "frumo-deckhand-diver")
          ? [{
              id: "deckhand-diver-peek",
              kind: "toggle",
              private: true,
              label: "Deckhand Diver · privately inspect the top deck card"
            }]
          : []
      })));
    }
    return actions.map((action) => normalizeLegalAction(game, playerNumber, action));
  }
  return [];
}

function factionAbilityDefinitions(game, playerNumber) {
  const actor = game?.players?.[playerNumber];
  const faction = factionId(actor);
  if (faction === "frumo") {
    return [
      ["polea-place", "Polea · place a hand card"],
      ["polea-swap", "Polea · move or switch lanes"],
      ["polea-peek", "Polea · inspect a face-down card"],
      ["polea-buff", "Polea · give a card +1"],
      ["lafayette-swap", "Lafayette · switch hand and lane"]
    ];
  }
  if (faction === "bizi") {
    return [["focus-buff", "Focus · spend acceleration to buff a card"]];
  }
  return [];
}

function unavailableAbilityReason(game, playerNumber, abilityId) {
  const actor = game?.players?.[playerNumber];
  if (!actor || game.gameMode !== "factions") return "Faction actions are unavailable in this match.";
  if (game.phase !== "priority" || game.priority !== playerNumber) return "This ability requires your priority window.";
  if (abilityId.startsWith("polea-") && actor.turnData.poleaUsed) {
    const sunkenOrderReady = !actor.turnData.poleaSunkenOrderUsed
      && playerControlsCard(game, playerNumber, "frumo-poleas-sunken-order");
    if (!sunkenOrderReady) return "Polea has already been used this turn.";
  }
  if (abilityId === "lafayette-swap" && actor.turnData.lafayetteUsed) {
    return "Lafayette has already been used this turn.";
  }
  if (abilityId === "focus-buff") {
    if (actor.turnData.focusUsed) return "Focus has already been used this turn.";
    if (Number(actor.accelerationCounters || 0) < 1) return "Focus needs an acceleration counter.";
  }
  return "No valid source and target combination is currently available.";
}

function getActionAvailability(game, player) {
  const playerNumber = Number(player);
  const actor = game?.players?.[playerNumber];
  if (!actor) return { laneAttacks: [], factionAbilities: [], handAttack: { available: false, reason: "Player unavailable." } };
  const legal = getLegalActions(game, playerNumber);
  const laneAttacks = game.lanes.map((lane, laneIndex) => {
    const action = legal.find((entry) => entry.type === "declareLaneAttack" && entry.laneIndex === laneIndex);
    let reason = null;
    if (!action) {
      if (game.phase !== "priority") reason = "Lane attacks require a priority phase.";
      else if (game.priority !== playerNumber) reason = "Wait until you have priority.";
      else if (pendingAttack(game)) reason = "Resolve the current attack before declaring another.";
      else if (!lane.facedown[playerNumber]) reason = `Lane ${laneIndex + 1} has no face-down card available to attack.`;
      else reason = `Lane ${laneIndex + 1} is unavailable for the current action.`;
    }
    return {
      type: "declareLaneAttack",
      laneIndex,
      available: Boolean(action),
      unavailableReason: reason,
      actionId: action?.id || null
    };
  });
  const factionAbilities = factionAbilityDefinitions(game, playerNumber).map(([abilityId, label]) => {
    const action = legal.find((entry) => entry.type === "useFactionAbility" && entry.abilityId === abilityId);
    return {
      type: "useFactionAbility",
      abilityId,
      label: action?.label || label,
      intent: action?.intent || FACTION_ABILITY_INTENTS[abilityId] || "",
      available: Boolean(action),
      unavailableReason: action ? null : unavailableAbilityReason(game, playerNumber, abilityId),
      actionId: action?.id || null
    };
  });
  const handActions = legal.filter((entry) => entry.type === "declareHandAttack");
  return {
    laneAttacks,
    factionAbilities,
    handAttack: {
      type: "declareHandAttack",
      available: handActions.length > 0,
      actionIds: handActions.map((entry) => entry.id),
      unavailableReason: handActions.length > 0
        ? null
        : game.phase !== "priority"
          ? "Hand attacks require a priority phase."
          : game.priority !== playerNumber
            ? "Wait until you have priority."
            : pendingAttack(game)
              ? "Resolve the current attack before declaring another."
              : actor.hand.length === 0
                ? "No hand card is available to attack."
                : "A hand attack is unavailable for the current action."
    }
  };
}

function sanitizeEventForPerspective(entry, viewer, hiddenCardIds) {
  if (!entry || typeof entry !== "object") return entry;
  if (entry.type === "card.peeked" && Number(entry.viewer) !== viewer) {
    const sanitized = clone(entry);
    delete sanitized.card;
    delete sanitized.cardId;
    delete sanitized.source;
    sanitized.private = true;
    return sanitized;
  }
  if (entry.type === "card.peeked" && Number(entry.viewer) === viewer) return clone(entry);

  const sanitized = clone(entry);
  const belongsToOtherPlayer = Number(entry.player) !== viewer;
  if (entry.type === "cards.drawn" && belongsToOtherPlayer) {
    sanitized.count = Array.isArray(entry.cardIds) ? entry.cardIds.length : Number(entry.count || 0);
    delete sanitized.cardIds;
  }
  if (
    belongsToOtherPlayer
    && ["card.placedFacedown", "laneEntry.resolved"].includes(entry.type)
  ) {
    delete sanitized.card;
    delete sanitized.cardId;
    delete sanitized.cardIds;
    delete sanitized.source;
  }
  if (sanitized.cardId && hiddenCardIds.has(sanitized.cardId)) delete sanitized.cardId;
  if (Array.isArray(sanitized.cardIds)) {
    sanitized.cardIds = sanitized.cardIds.filter((cardId) => !hiddenCardIds.has(cardId));
    if (sanitized.cardIds.length === 0 && belongsToOtherPlayer) delete sanitized.cardIds;
  }
  if (sanitized.card?.id && hiddenCardIds.has(sanitized.card.id)) delete sanitized.card;
  return sanitized;
}

function projectForPerspective(game, perspectivePlayer) {
  const projected = clone(game);
  const viewer = Number(perspectivePlayer);
  const hiddenCardIds = new Set();
  for (const player of [1, 2]) {
    projected.players[player].handCount = projected.players[player].hand.length;
    projected.players[player].deckCount = projected.players[player].deck.length;
    if (player !== viewer) {
      projected.players[player].hand.forEach((card) => hiddenCardIds.add(card.id));
      projected.players[player].deck.forEach((card) => hiddenCardIds.add(card.id));
      projected.players[player].hand = projected.players[player].hand.map((card, index) => ({
        id: `hidden-p${player}-${index}`,
        hidden: true
      }));
    }
    projected.players[player].deck = [];
  }
  projected.lanes.forEach((lane, laneIndex) => {
    for (const player of [1, 2]) {
      if (player !== viewer && lane.facedown[player]) {
        hiddenCardIds.add(lane.facedown[player].id);
        lane.facedown[player] = { id: `hidden-lane-${laneIndex}-p${player}`, hidden: true };
      }
    }
  });
  projected.lastEvents = (projected.lastEvents || [])
    .map((entry) => sanitizeEventForPerspective(entry, viewer, hiddenCardIds));
  projected.animationEvents = (projected.animationEvents || [])
    .map((entry) => sanitizeEventForPerspective(entry, viewer, hiddenCardIds));
  projected.legalActions = [1, 2].includes(viewer) ? getLegalActions(game, viewer) : [];
  projected.actionAvailability = [1, 2].includes(viewer)
    ? getActionAvailability(game, viewer)
    : { laneAttacks: [], factionAbilities: [], handAttack: { available: false, unavailableReason: "Spectators cannot act." } };
  projected.snapshotSchemaVersion = Number(projected.snapshotSchemaVersion || projected.schemaVersion || SCHEMA_VERSION);
  projected.commandSchemaVersion = Number(projected.commandSchemaVersion || COMMAND_SCHEMA_VERSION);
  projected.eventSchemaVersion = Number(projected.eventSchemaVersion || EVENT_SCHEMA_VERSION);
  projected.rulesVersion = projected.rulesVersion || RULES_VERSION;
  projected.cardContentVersion = projected.cardContentVersion || CARD_CONTENT_VERSION;
  return projected;
}

function createCommandEnvelope(state, actorPlayerId, command, commandId = null) {
  const revision = Number(state?.revision || 0);
  const id = commandId || `${state?.matchId || "match"}-command-${revision + 1}`;
  return {
    commandId: id,
    baseRevision: revision,
    actorPlayerId: Number(actorPlayerId),
    command: { ...command }
  };
}

module.exports = {
  CARD_CONTENT_VERSION,
  COMMAND_SCHEMA_VERSION,
  CONSTRUCTED_CHOICE_INTENTS,
  EVENT_SCHEMA_VERSION,
  FACTION_ABILITY_INTENTS,
  FACTION_PROFILES,
  HAND_SIZE,
  RULES_VERSION,
  SCHEMA_VERSION,
  STARTING_LIFE,
  applyCommand,
  cardValue,
  createCommandEnvelope,
  createMatch,
  createSeededRandom,
  createStandardDeck,
  currentPlacementPlayer,
  getLegalActions,
  getActionAvailability,
  otherPlayer,
  projectForPerspective
};
