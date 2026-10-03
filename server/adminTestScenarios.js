"use strict";
const engine = require("../shared/duel-rules");
const { SUITS, SUIT_NAMES, VALUES } = require("../shared/duel-rules/gameConfig");
const { hash } = require("./authoredContent");
const { ordinaryPresentation } = require("./contentAssets");
const clone = value => JSON.parse(JSON.stringify(value));
const fail = message => { throw Object.assign(new Error(message), { status: 422 }); };
const scenarioSpec = Object.freeze({ version: 1, suits: SUIT_NAMES, values: VALUES,
  life: { min: 1, max: 100, default: 42 }, turn: { min: 1, max: 1000, default: 1 },
  counter: { min: 0, max: 1000, default: 0 }, priority: [1, 2], laneCount: 3,
  deckOrder: "draw-first", remainingCards: "Unassigned cards follow the ordered deck cards.",
  counters: ["accelerationCounters", "revenants", "attacksDeclaredThisTurn", "blocksDeclaredThisTurn"],
  zones: ["hand", "deck", "discard", "combat", "support"] });
const supportTypes = new Set(["armament", "shelter", "ambush", "contraption", "biomorph", "operation", "arcana"]);
function object(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) fail(`${label} contains unsupported fields.`);
}
function integer(value, min, max, label, fallback) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) fail(`${label} must be a whole number from ${min} to ${max}.`);
  return value;
}
function suitName(suit) { return SUIT_NAMES[SUITS.indexOf(suit)] || (SUIT_NAMES.includes(suit) ? suit : null); }
function slotKey(card) { const suit = suitName(card.suit); return suit && VALUES.includes(card.value) ? `${suit}:${card.value}` : null; }
function inventory(game, player) {
  const owner = game.players[player], cards = [...owner.hand, ...owner.deck, ...owner.discard,
    ...game.lanes.flatMap(lane => [lane.facedown?.[player], lane.support?.[player]].filter(Boolean))];
  const slots = new Map();
  for (const card of cards) {
    const key = slotKey(card);
    // Generated tokens do not become freely editable scenario inventory.
    if (!key || card.zynarthEgg || card.zynarthUnderling || card.isToken || card.token) continue;
    if (slots.has(key)) fail("Starting deck contains duplicate value-and-suit slots.");
    slots.set(key, clone(card));
  }
  if (slots.size !== 52) fail("Custom scenarios require a complete 52-slot starting deck.");
  return slots;
}
function replacement(original, definition, suit, id) {
  return { ...clone(definition), id, definitionId: definition.id, gameplayCardId: definition.id,
    suit, rank: original.rank, value: original.value };
}
function applyScenario(game, resolved, scenario, id) {
  object(scenario, ["version", "turn", "priority", "players"], "Scenario");
  if (scenario.version !== 1) fail("Unsupported custom scenario version.");
  object(scenario.players, ["1", "2"], "Scenario players");
  const next = clone(game), turn = integer(scenario.turn, 1, 1000, "Turn", 1), priority = integer(scenario.priority, 1, 2, "Priority", 1);
  const freshTurnData = engine.createMatch({ seed: "admin-scenario-turn-defaults", startingPriority: 1 }).state.players[1].turnData;
  const normalized = { version: 1, turn, priority, players: {} };
  for (const player of [1, 2]) {
    const input = scenario.players[player] || {};
    object(input, ["factionId", "life", ...scenarioSpec.counters, "previousPlayedValue", "previousAttackSuit", ...scenarioSpec.zones], `Player ${player}`);
    const owner = next.players[player], factionId = input.factionId || owner.faction.id;
    if (!Object.hasOwn(resolved.factions, factionId) || owner.faction.id !== factionId) fail(`Player ${player} faction does not match the starting deck.`);
    const slots = inventory(game, player), used = new Set();
    const ordinarySlots = new Map(engine.createStandardDeck(player, factionId).map(card => [slotKey(card), card]));
    const scalar = { factionId, life: integer(input.life, 1, 100, "Life", 42) };
    for (const key of scenarioSpec.counters) scalar[key] = integer(input[key], 0, 1000, key, 0);
    if (factionId !== "bizi" && scalar.accelerationCounters) fail("Acceleration counters belong to Bizi.");
    if (factionId !== "jali" && scalar.revenants) fail("Revenants belong to Jali.");
    scalar.previousPlayedValue = input.previousPlayedValue == null ? null : integer(input.previousPlayedValue, 2, 14, "Previous played value");
    scalar.previousAttackSuit = input.previousAttackSuit == null ? null : input.previousAttackSuit;
    if (scalar.previousAttackSuit !== null && !SUIT_NAMES.includes(scalar.previousAttackSuit)) fail("Choose a supported previous attack suit.");
    const resolveSlot = (slot, zone) => {
      object(slot, ["value", "suit", "cardId"], "Card slot");
      if (!SUIT_NAMES.includes(slot.suit) || !VALUES.includes(slot.value)) fail("Choose a valid card value and suit.");
      const key = slotKey(slot), original = slots.get(key);
      if (!original || used.has(key)) fail("Each value-and-suit slot can appear only once per player.");
      const cardId = `${id}-p${player}-${slot.suit}-${slot.value}`;
      const ordinary = ordinarySlots.get(key);
      let card = { ...ordinary, id: cardId, faction: owner.faction.name, image: owner.faction.cardImage,
        presentation: ordinaryPresentation(ordinary, factionId, resolved.releaseId) };
      if (slot.cardId !== undefined) {
        if (typeof slot.cardId !== "string") fail("Choose an existing published card definition.");
        const definition = resolved.manifest.cards.find(card => card.id === slot.cardId);
        if (!definition || definition.factionId !== factionId || definition.value !== original.value) fail("A replacement must match this faction and printed value.");
        card = replacement(original, definition, SUITS[SUIT_NAMES.indexOf(slot.suit)], cardId);
      }
      const support = supportTypes.has(card.type);
      if (zone === "support" && !support) fail("Support positions require support cards.");
      if (zone === "combat" && support) fail("Combat positions require combat cards.");
      used.add(key); return card;
    };
    const zones = {};
    for (const zone of scenarioSpec.zones) {
      const lane = ["combat", "support"].includes(zone), entries = input[zone] ?? (lane ? [null, null, null] : []);
      if (!Array.isArray(entries) || entries.length > (lane ? 3 : 52) || (lane && entries.length !== 3)) fail(`${zone} must contain ${lane ? "three positions" : "at most 52 slots"}.`);
      zones[zone] = entries.map(slot => lane && slot === null ? null : resolveSlot(slot, zone));
    }
    const remaining = [...slots].filter(([key]) => !used.has(key)).map(([, card]) => ({ ...card, id: `${id}-p${player}-${suitName(card.suit)}-${card.value}` }));
    // The engine draws with pop(); operators specify the first card to draw first.
    zones.deck = [...zones.deck, ...remaining].reverse();
    Object.assign(owner, { life: scalar.life, accelerationCounters: scalar.accelerationCounters, revenants: scalar.revenants,
      hand: zones.hand, deck: zones.deck, discard: zones.discard,
      turnData: { ...clone(freshTurnData), attacksDeclaredThisTurn: scalar.attacksDeclaredThisTurn, blocksDeclaredThisTurn: scalar.blocksDeclaredThisTurn,
        previousPlayedValue: scalar.previousPlayedValue, previousAttackSuit: scalar.previousAttackSuit === null ? null : SUITS[SUIT_NAMES.indexOf(scalar.previousAttackSuit)] } });
    for (let lane = 0; lane < 3; lane++) {
      next.lanes[lane].support ||= { 1: null, 2: null };
      next.lanes[lane].facedown[player] = zones.combat[lane]; next.lanes[lane].support[player] = zones.support[lane];
    }
    normalized.players[player] = { ...scalar, ...Object.fromEntries(scenarioSpec.zones.map(zone => [zone, (zone === "deck" ? [...zones.deck].reverse() : zones[zone]).map(card => card && ({ value: card.value, suit: suitName(card.suit), ...(card.definitionId || card.gameplayCardId ? { cardId: card.definitionId || card.gameplayCardId } : {}) }))])) };
  }
  Object.assign(next, { turn, priority, startingPriorityThisTurn: priority, lastActivePlayer: priority, phase: "priority",
    revision: 0, priorityPassed: { 1: false, 2: false }, handAttacks: [], actionHistory: [], lastEvents: [], paymentLog: [], eventSequence: 0,
    endPlacementFirstPlayer: priority, message: "Custom starting state. No preceding actions were played." });
  for (const lane of next.lanes) { lane.attack = null; lane.block = []; }
  return { game: next, scenario: normalized, scenarioHash: hash(normalized) };
}

function focusCard(game, resolved, cardId, id) {
  const definition = resolved.manifest.cards.find(card => card.id === cardId);
  if (!definition || definition.factionId !== game.players[1].faction.id) fail("The selected card must belong to the test faction.");
  const next = clone(game), owner = next.players[1];
  const all = [...owner.hand, ...owner.deck];
  let card = all.find(entry => (entry.definitionId || entry.gameplayCardId) === cardId);
  if (!card) {
    const original = all.find(entry => entry.value === definition.value);
    if (!original) fail("The selected card has no available starting slot.");
    card = replacement(original, definition, original.suit, `${id}-focus`);
    const zone = owner.hand.some(entry => entry.id === original.id) ? owner.hand : owner.deck;
    zone.splice(zone.findIndex(entry => entry.id === original.id), 1, card);
  }
  const deckIndex = owner.deck.findIndex(entry => entry.id === card.id);
  if (deckIndex >= 0) { owner.deck.splice(deckIndex, 1); if (owner.hand.length) owner.deck.push(owner.hand.pop()); owner.hand.unshift(card); }
  return next;
}
module.exports = { scenarioSpec, applyScenario, focusCard };
