"use strict";

// Fixed pre-conversion scenarios. Expected results are data, never a second engine.
const crypto = require("node:crypto");
const { COLLECTION_CARDS } = require("../server/gameContent");
const { canonicalJson } = require("../shared/match-history/canonical");
const clone = (value) => JSON.parse(JSON.stringify(value));
const NEW_METADATA = new Set(["effect", "mechanics", "contentBinding", "assetManifestVersion", "presentation", "opponentKind", "config", "cardEffectContractVersion", "factionEffectContractVersion", "encounterContractVersion"]);
function behavior(value) {
  if (Array.isArray(value)) return value.map(behavior);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !NEW_METADATA.has(key)).map(([key, child]) => [key, behavior(child)]));
}
function fingerprint(value) { return crypto.createHash("sha256").update(canonicalJson(JSON.parse(JSON.stringify(behavior(value))))).digest("hex"); }
function scenarios(engine) {
  const results = {};
  const base = (faction) => engine.createMatch({ seed: "v2-equivalence", matchId: "equivalence", gameMode: "factions", startingPriority: 1, factions: { 1: engine.FACTION_PROFILES[faction], 2: engine.FACTION_PROFILES.sheen } }).state;
  const card = (definition, prefix, suit = "♦") => ({ ...clone(definition), id: `${prefix}-${definition.id}`, definitionId: definition.id, suit, rank: String(definition.value), draftCard: true });
  const payment = (prefix) => ["♦", "♠", "♥", "♣"].map((suit, index) => ({ id: `${prefix}-pay-${index}`, name: "Payment", value: 14, rank: "A", suit }));
  // This fixture captures the 126-card production catalog that existed before
  // neutral Reath cards were introduced. Neutral cards have their own contract
  // tests and must not rewrite the historical equivalence baseline.
  const legacyDefinitions = COLLECTION_CARDS.filter((definition) => definition.factionId !== "neutral");
  for (const definition of legacyDefinitions) for (let turnIndex = 0; turnIndex < 4; turnIndex++) {
    const key = `${definition.id}:${turnIndex}`;
    const game = base(definition.factionId), subject = card(definition, "subject");
    const actor = game.players[1];
    actor.hand = [subject, ...payment("p1")]; actor.accelerationCounters = 6;
    Object.assign(actor.turnData, { attacksDeclaredThisTurn: turnIndex, blocksDeclaredThisTurn: turnIndex, previousAttackSuit: turnIndex % 2 ? "♠" : "♦", previousPlayedValue: definition.value - 1,
      paymentSuitsThisTurn: ["♦", "♠"], suitsPlayedThisTurn: ["♦"], ruminMeerusFreeAttackAvailable: true, meerusFreeAttackAvailable: true, beliAwakenedReady: true, sheenLargeAttackReady: true,
      ruminJewelBankAvailable: true, frumoLaneSwappedThisTurn: true, frumoConsecutiveBonuses: 0, biziCardsPlayedThisTurn: 2 });
    const supportDefinitions = COLLECTION_CARDS.filter((entry) => entry.factionId === definition.factionId && entry.id !== definition.id);
    game.lanes.forEach((lane, index) => { lane.facedown[1] = card(supportDefinitions[(turnIndex * 3 + index) % supportDefinitions.length], `support-${index}`); });
    const attack = { type: "declareHandAttack", player: 1, attackerCardId: subject.id, paymentCardIds: actor.hand.slice(1, 3).map((entry) => entry.id) };
    results[`${key}:attack`] = fingerprint(engine.applyCommand(game, attack));
    results[`${key}:choices`] = fingerprint(engine.getActionAvailability(game, 1));
    const placed = clone(game); placed.phase = "end"; placed.endPlacementFirstPlayer = 1; placed.endPlacementLaneIndex = 0; placed.endPlacementStep = 0; placed.lanes[0].facedown[1] = null;
    results[`${key}:placement`] = fingerprint(engine.applyCommand(placed, { type: "placeFacedown", player: 1, cardId: subject.id, laneIndex: 0 }));
    const blocking = clone(game); blocking.priority = 2;
    const incomingCard = { id: "incoming", value: 10, rank: "10", suit: "♠", name: "Incoming" };
    blocking.players[2].hand = [incomingCard, ...payment("p2")];
    const incoming = engine.applyCommand(blocking, { type: "declareHandAttack", player: 2, attackerCardId: incomingCard.id, paymentCardIds: ["p2-pay-0"] });
    if (!incoming.accepted) throw new Error(`Baseline incoming attack rejected: ${key}`);
    const block = { type: "declareHandBlock", player: 1, attackId: incoming.state.handAttacks[0].id, blockerCardIds: [subject.id], paymentCardIds: ["p1-pay-0", "p1-pay-1"] };
    const blocked = engine.applyCommand(incoming.state, block);
    results[`${key}:block`] = fingerprint(blocked);
    if (blocked.accepted) {
      let resolved = blocked.state;
      for (let pass = 0; pass < 2; pass++) { const next = engine.applyCommand(resolved, { type: "passPriority", player: resolved.priority }); if (next.accepted) resolved = next.state; }
      results[`${key}:resolve`] = fingerprint(resolved);
    }
    const payGame = clone(game), ordinary = { id: "ordinary", name: "Ordinary", value: 2, rank: "2", suit: "♦", factionId: definition.factionId };
    payGame.players[1].hand.unshift(ordinary);
    results[`${key}:payment`] = fingerprint(engine.applyCommand(payGame, { type: "declareHandAttack", player: 1, attackerCardId: ordinary.id, paymentCardIds: [subject.id, "p1-pay-0"] }));
  }
  return results;
}
module.exports = { scenarios, fingerprint, behavior };
