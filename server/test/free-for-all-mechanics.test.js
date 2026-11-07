const test = require("node:test"), assert = require("node:assert/strict");
const contract = require("../../shared/duel-rules/mechanicContract"), modes = require("../../shared/duel-rules/mechanicModes"), ffa = require("../freeForAllMechanics");
const id = "mechanic-11111111-1111-4111-8111-111111111111";
function source(trigger, effects) {
  const definition = { id, name: "FFA fixture", status: "active", interpreter: 2, cardTypes: ["servitor"], abilities: [{ ...contract.ability(trigger, 2), effects }] };
  return { id: "source", name: "Source", type: "servitor", value: 4, effect: { id: contract.ID, version: 2, mechanicId: id, definition, revision: "a".repeat(64) } };
}
const op = (kind, amount = 2, duration = "instant") => ({ kind, amount, duration });
function game() { return { gameMode: "freeForAll", matchId: "ffa", turn: 1, lanes: [0, 1, 2].map(() => ({ support: {} })), players: Object.fromEntries([1, 2, 3, 4].map(p => [p, { life: 42, hand: [], deck: [{ id: `private-${p}` }], discard: [], turnData: { damageTakenThisTurn: 0 } }])) }; }
test("qualified combat vocabulary uses declared FFA opponent and controller across all seats and recovery", () => {
  for (const player of [1, 2, 3, 4]) for (const opponent of [1, 2, 3, 4].filter(p => p !== player)) {
    const state = game(), card = source("attack", [op("attackBonus", 2, "combat"), op("damage"), op("gainLife"), op("draw", 1)]), attack = { id: "attack", player, targetPlayer: opponent, effectiveValue: 4, notes: [] };
    assert.equal(ffa.reason(card), null);
    const events = ffa.trigger(state, player, card, "attack", { attack, payment: { total: 4, required: 4, cards: [] } });
    assert.equal(attack.effectiveValue, 6); assert.equal(state.players[player].life, 44); assert.equal(state.players[opponent].life, 40);
    for (const bystander of [1, 2, 3, 4].filter(p => ![player, opponent].includes(p))) assert.equal(state.players[bystander].life, 42);
    assert.equal(state.players[player].hand[0].id, `private-${player}`); assert.ok(events.some(e => e.type === "damage.dealt" && e.targetPlayer === opponent));
    const recovered = JSON.parse(JSON.stringify(state)); assert.equal(ffa.trigger(recovered, player, card, "attack", { attack }).length, 0, "captured usage prevents another execution in this turn");
  }
});
test("block and combat-end effects target attacker, never the numeric two-seat complement", () => {
  const state = game(), attack = { player: 4, targetPlayer: 3, effectiveValue: 5, notes: [] }, block = { player: 3, effectiveValue: 2, notes: [] };
  const blocker = source("block", [op("blockBonus", 3, "combat"), op("damage", 1)]);
  ffa.trigger(state, 3, blocker, "block", { attack, block }); assert.equal(block.effectiveValue, 5); assert.equal(state.players[4].life, 41); assert.equal(state.players[1].life, 42);
  const end = source("combatEnd", [op("counters", 2), op("mill", 1)]); end.id = "another-source";
  ffa.trigger(state, 3, end, "combatEnd", { attack }); assert.equal(state.players[3].mechanicCounters[id], 2); assert.equal(state.players[3].discard[0].id, "private-3");
});
test("mode qualification rejects unsupported decisions, support windows and old interpreter before execution", () => {
  const card = source("attack", [op("damage")]);
  assert.match(modes.freeForAllReason({ ...card.effect.definition, interpreter: 1, abilities: [contract.ability("attack")] }), /two-seat/);
  card.effect.definition.abilities[0].decision = "optional"; assert.match(ffa.reason(card), /queued/); assert.throws(() => ffa.trigger(game(), 1, card, "attack", { attack: { player: 1, targetPlayer: 2 } }), /queued/);
  card.effect.definition = { ...card.effect.definition, cardTypes: ["spell"], abilities: [contract.ability("placed", 2)] }; assert.match(ffa.reason(card), /support placement/);
});
