const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../../shared/duel-rules");
const authored = require("../authoredContent");
const { createContentPublication } = require("../contentPublication");
const { applyScenario, focusCard, scenarioSpec } = require("../adminTestScenarios");
const old = require("./fixtures/content-v2/authored-baseline-v1.json");
const baseline = authored.createAuthoredBaseline({ domains: { decks: old.domains.decks.map(row => ({ ...row, definition: row.plan })) }, game: { modes: old.domains.game } });
const resolved = createContentPublication({ baseline, memory: true }).active();
const gameFor = (one = "rumin", two = "sheen") => authored.pinGameContent(engine.createMatch({ seed: "scenario-tests", startingPriority: 1,
  gameMode: "factions", config: resolved.manifest.gameConfig, factions: { 1: resolved.factions[one], 2: resolved.factions[two] } }).state, resolved);
const scenario = (one = {}, two = {}) => ({ version: 1, turn: 4, priority: 2, players: { 1: one, 2: two } });
const inventory = (game, player) => [...game.players[player].hand, ...game.players[player].deck, ...game.players[player].discard,
  ...game.lanes.flatMap(lane => [lane.facedown[player], lane.support[player]].filter(Boolean))];

test("custom boards conserve every slot, order draws, bind published replacements and create server IDs", () => {
  const game = gameFor(), before = JSON.stringify(game), card = resolved.manifest.cards.find(card => card.factionId === "rumin" && card.type === "armament");
  const input = scenario({ life: 17, attacksDeclaredThisTurn: 2, previousPlayedValue: 7, previousAttackSuit: "hearts",
    hand: [{ value: 2, suit: "spades" }], deck: [{ value: 3, suit: "hearts" }, { value: 4, suit: "clubs" }], discard: [{ value: 5, suit: "diamonds" }],
    support: [{ value: card.value, suit: "clubs", cardId: card.id }, null, null], combat: [null, { value: 6, suit: "hearts" }, null] });
  const output = applyScenario(game, resolved, input, "fresh-session");
  assert.equal(JSON.stringify(game), before);
  assert.equal(output.game.turn, 4); assert.equal(output.game.priority, 2);
  assert.equal(output.game.players[1].life, 17);
  assert.equal(output.game.players[1].turnData.attacksDeclaredThisTurn, 2);
  assert.equal(output.game.players[1].turnData.previousAttackSuit, "♥");
  assert.equal(output.game.players[1].deck.at(-1).value, 3);
  assert.equal(output.game.players[1].deck.at(-2).value, 4);
  assert.deepEqual(output.game.lanes[0].support[1].effect, card.effect);
  for (const player of [1, 2]) {
    const cards = inventory(output.game, player);
    assert.equal(cards.length, 52); assert.equal(new Set(cards.map(card => `${card.suit}:${card.value}`)).size, 52);
    assert.equal(new Set(cards.map(card => card.id)).size, 52);
    assert.ok(cards.every(card => card.id.startsWith(`fresh-session-p${player}-`)));
  }
  assert.equal(output.game.actionHistory.length, 0); assert.equal(output.game.lastEvents.length, 0);
  assert.match(output.game.message, /No preceding actions/);
  assert.equal(applyScenario(game, resolved, input, "different-session").scenarioHash, output.scenarioHash);
  assert.equal(applyScenario(game, resolved, output.scenario, "roundtrip").scenarioHash, output.scenarioHash);
});

test("invalid, duplicate, cross-faction and protected setup values fail without changing the source", () => {
  const game = gameFor(), before = JSON.stringify(game);
  const arm = resolved.manifest.cards.find(card => card.factionId === "rumin" && card.type === "armament");
  const invalid = [
    { ...scenario(), phase: "combat" }, scenario({ turnData: {} }), scenario({ life: 0 }), scenario({ life: 101 }),
    scenario({ accelerationCounters: 1 }), scenario({ revenants: 1 }), scenario({ previousPlayedValue: 1 }),
    scenario({ previousAttackSuit: "stars" }), { ...scenario(), turn: 1001 },
    scenario({ hand: [{ value: 2, suit: "clubs" }], deck: [{ value: 2, suit: "clubs" }] }),
    scenario({ hand: [{ value: 2, suit: "clubs", id: "injected" }] }),
    scenario({ combat: [{ value: arm.value, suit: "clubs", cardId: arm.id }, null, null] }),
    scenario({ support: [{ value: 2, suit: "clubs" }, null, null] }),
    scenario({ factionId: "sheen" }), scenario({ hand: [{ value: arm.value === 2 ? 3 : 2, suit: "clubs", cardId: arm.id }] }),
    scenario({}, { hand: [{ value: arm.value, suit: "clubs", cardId: arm.id }] }),
    scenario({ hand: [{ value: 2, suit: "clubs", cardId: "unknown" }] })
  ];
  for (const input of invalid) assert.throws(() => applyScenario(game, resolved, input, "invalid"), { status: 422 });
  assert.equal(JSON.stringify(game), before);
});

test("only the two declared faction resources and finite turn counters can be seeded", () => {
  const { game } = applyScenario(gameFor("bizi", "jali"), resolved, scenario({ accelerationCounters: 1000 }, { revenants: 5, blocksDeclaredThisTurn: 4 }), "resources");
  assert.equal(game.players[1].accelerationCounters, 1000); assert.equal(game.players[2].revenants, 5);
  assert.equal(game.players[2].turnData.blocksDeclaredThisTurn, 4);
  assert.deepEqual(scenarioSpec.counter, { min: 0, max: 1000, default: 0 });
  assert.throws(() => applyScenario(gameFor("bizi"), resolved, scenario({ accelerationCounters: 1001 }), "invalid"), { status: 422 });
});

test("focused card tests deterministically place the selected definition in hand without adding slots", () => {
  for (const factionId of ["rumin", "indela", "zynarth", "astral-vanguard"]) {
    const game = gameFor(factionId), card = resolved.manifest.cards.find(card => card.factionId === factionId);
    const focused = focusCard(game, resolved, card.id, `focused-${factionId}`);
    assert.ok(focused.players[1].hand.some(entry => entry.definitionId === card.id));
    assert.equal(focused.players[1].hand.length, game.players[1].hand.length);
    // Faction-created tokens are preserved here; focus only replaces one standard slot.
    assert.equal(inventory(focused, 1).length, inventory(game, 1).length);
    assert.deepEqual(focused.players[1].hand.find(entry => entry.definitionId === card.id).effect, card.effect);
  }
});

test("an explicit ordinary slot clears a constructed definition while untouched slots retain theirs", () => {
  const card = resolved.manifest.cards.find(card => card.factionId === "rumin"), focused = focusCard(gameFor(), resolved, card.id, "old");
  const original = focused.players[1].hand.find(entry => entry.definitionId === card.id);
  const suit = scenarioSpec.suits[["♠", "♥", "♦", "♣"].indexOf(original.suit)];
  const result = applyScenario(focused, resolved, scenario({ hand: [{ value: card.value, suit }] }), "ordinary");
  assert.equal(result.game.players[1].hand[0].definitionId, undefined);
  assert.equal(result.game.players[1].hand[0].effect, undefined);
  assert.notEqual(result.game.players[1].hand[0].name, card.name);
  assert.equal(inventory(result.game, 1).length, 52);
});
