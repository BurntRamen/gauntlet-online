const test = require("node:test");
const assert = require("node:assert/strict");

const engine = require("../../shared/duel-rules");
const { defaultCardEffect, hasCardEffect } = require("../../shared/duel-rules/effectRegistry");

function catalogCard(id, value, suit) {
  const specialSupport = [10, 12, 14].includes(value);
  const factionId = id.split("-")[0];
  return {
    id: `instance-${id}`,
    definitionId: id,
    gameplayCardId: id,
    name: id,
    factionId,
    type: specialSupport && factionId === "voltari"
      ? "conduit"
      : specialSupport && factionId === "xendra"
        ? "nightmare"
        : specialSupport && factionId === "morphlings"
          ? "biomorph"
          : "servitor",
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

test("Voltari cards generate and spend persistent Charge instead of receiving automatic suit pumps", () => {
  let state = engine.createMatch({ gameMode: "factions", startingPriority: 1,
    factions: { 1: engine.FACTION_PROFILES.voltari, 2: engine.FACTION_PROFILES.rumin } }).state;
  state.players[1].turnData.attacksDeclaredThisTurn = 1;
  state.players[1].turnData.previousAttackSuit = "hearts";
  const generator = catalogCard("voltari-spades-2", 2, "spades");
  state.players[1].hand = [generator, { id: "pay-a", value: 14, suit: "clubs" }];
  let result = engine.applyCommand(state, { type: "declareHandAttack", player: 1, attackerCardId: generator.id, paymentCardIds: ["pay-a"] });
  assert.equal(result.accepted, true);
  assert.equal(result.state.players[1].chargeCounters, 1);
  assert.equal(result.state.handAttacks[0].effectiveValue, 2);

  state = engine.createMatch({ gameMode: "factions", startingPriority: 1,
    factions: { 1: engine.FACTION_PROFILES.voltari, 2: engine.FACTION_PROFILES.rumin } }).state;
  state.players[1].chargeCounters = 1;
  state.players[1].turnData.attacksDeclaredThisTurn = 1;
  state.players[1].turnData.previousAttackSuit = "hearts";
  const discharge = catalogCard("voltari-spades-6", 6, "spades");
  state.players[1].hand = [discharge, { id: "pay-b", value: 14, suit: "clubs" }];
  result = engine.applyCommand(state, { type: "declareHandAttack", player: 1, attackerCardId: discharge.id, paymentCardIds: ["pay-b"] });
  assert.equal(result.accepted, true);
  assert.equal(result.state.players[1].chargeCounters, 0);
  assert.equal(result.state.handAttacks[0].effectiveValue, 8);
});

test("Voltari Conduits use support slots and charge the network when played", () => {
  const state = engine.createMatch({ gameMode: "factions", startingPriority: 1,
    factions: { 1: engine.FACTION_PROFILES.voltari, 2: engine.FACTION_PROFILES.rumin } }).state;
  const conduit = catalogCard("voltari-diamonds-10", 10, "diamonds");
  state.players[1].hand = [conduit, { id: "pay", value: 14, suit: "clubs" }];
  const command = engine.createCommandEnvelope(state, 1, { type: "playSupport", cardId: conduit.id, laneIndex: 0, paymentCardIds: ["pay"] });
  const result = engine.applyCommand(state, command);
  assert.equal(result.accepted, true);
  assert.equal(result.state.players[1].chargeCounters, 2);
  assert.equal(result.state.lanes[0].support[1].type, "conduit");
});

test("Xen’Dra spend Insanity for non-pump suit effects", () => {
  let state = engine.createMatch({ gameMode: "factions", startingPriority: 2,
    factions: { 1: engine.FACTION_PROFILES.xendra, 2: engine.FACTION_PROFILES.rumin } }).state;
  const attacker = { id: "attacker", name: "Attacker", factionId: "rumin", type: "servitor", value: 5, suit: "hearts" };
  state.players[2].hand = [attacker, { id: "attack-pay", value: 14, suit: "clubs" }];
  let result = engine.applyCommand(state, { type: "declareHandAttack", player: 2, attackerCardId: attacker.id, paymentCardIds: ["attack-pay"] });
  assert.equal(result.accepted, true);
  state = result.state;
  state.players[1].insanityCounters = 2;
  const mirror = catalogCard("xendra-hearts-6", 6, "hearts");
  state.players[1].hand = [mirror, { id: "block-pay", value: 14, suit: "spades" }];
  result = engine.applyCommand(state, { type: "declareHandBlock", player: 1, blockerCardIds: [mirror.id], paymentCardIds: ["block-pay"] });
  assert.equal(result.accepted, true);
  assert.equal(result.state.players[1].insanityCounters, 0);
  assert.equal(result.state.handAttacks[0].block[0].preventDamage, 2);
});

test("The Continuants build persistent Continuity and cohere without losing their identity", () => {
  const state = engine.createMatch({ gameMode: "factions", startingPriority: 1,
    factions: { 1: engine.FACTION_PROFILES.morphlings, 2: engine.FACTION_PROFILES.rumin } }).state;
  state.players[1].continuityCounters = 5;
  state.players[1].life = 17;
  const biomorph = catalogCard("morphlings-spades-10", 10, "spades");
  state.players[1].hand = [biomorph, { id: "pay", value: 14, suit: "clubs" }];

  const command = engine.createCommandEnvelope(state, 1, {
    type: "playSupport",
    cardId: biomorph.id,
    laneIndex: 0,
    paymentCardIds: ["pay"]
  });
  const result = engine.applyCommand(state, command);

  assert.equal(result.accepted, true);
  assert.equal(result.state.lanes[0].support[1].type, "biomorph");
  assert.equal(result.state.players[1].continuityCounters, 2);
  assert.equal(result.state.players[1].life, 18);
  assert.equal(result.state.players[1].turnData.alienEndTurnDraws, 1);
});
