const test = require("node:test");
const assert = require("node:assert/strict");

const engine = require("../../shared/duel-rules");
const { defaultCardEffect, hasCardEffect } = require("../../shared/duel-rules/effectRegistry");

function catalogCard(id, value, suit) {
  return {
    id: `instance-${id}`,
    definitionId: id,
    gameplayCardId: id,
    name: id,
    factionId: id.split("-")[0],
    type: "servitor",
    value,
    suit,
    effect: defaultCardEffect(id)
  };
}

test("full-catalog faction cards resolve their printed suit identity in combat", () => {
  const state = engine.createMatch({ gameMode: "factions", startingPriority: 1,
    factions: { 1: engine.FACTION_PROFILES.mercaw, 2: engine.FACTION_PROFILES.rumin } }).state;
  const attacker = catalogCard("mercaw-spades-2", 2, "spades");
  assert.equal(hasCardEffect(attacker, "catalog-faction-identity"), true);
  state.players[1].hand = [attacker, { id: "payment", value: 14, suit: "hearts" }];

  const result = engine.applyCommand(state, {
    type: "declareHandAttack",
    player: 1,
    attackerCardId: attacker.id,
    paymentCardIds: ["payment"]
  });

  assert.equal(result.accepted, true);
  assert.equal(result.state.handAttacks[0].effectiveValue, 3);
});
