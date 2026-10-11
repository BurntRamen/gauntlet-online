const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../../shared/duel-rules");
const authored = require("../authoredContent");
const { createContentPublication } = require("../contentPublication");
const { createAdminPlaytests } = require("../adminPlaytest");
const { applyScenario } = require("../adminTestScenarios");
const { contentRelationships } = require("../adminContentRelationships");
const old = require("./fixtures/content-v2/authored-baseline-v1.json");
const baseline = authored.createAuthoredBaseline({ domains: { decks: old.domains.decks }, game: { modes: old.domains.game } });
const publication = createContentPublication({ baseline, memory: true });
const resolved = publication.active();
function createGame(content, selection) {
  return authored.pinGameContent(engine.createMatch({ seed: "neutral-admin", startingPriority: 1, gameMode: "factions",
    factions: { 1: content.factions[selection.factionId], 2: content.factions[selection.opponentFactionId] },
    config: content.manifest.gameConfig }).state, content);
}
test("all neutral cards and effects can be tested with an actual playable faction", () => {
  const playtests = createAdminPlaytests({ publication, createGame, chooseAi: () => null });
  for (const card of resolved.manifest.cards.filter(card => card.factionId === "neutral")) {
    for (const factionId of ["rumin", "sheen"]) {
      for (const subject of [{ kind: "card", id: card.id }, { kind: "card-effect", id: card.effect.id, cardId: card.id }]) {
        const { playtest } = playtests.start({ source: "live", factionId, subject }, "approved-admin");
        assert.equal(playtest.context.factionId, factionId);
        assert.ok(playtest.game.players[1].hand.some(entry => entry.definitionId === card.id));
        assert.equal(playtest.game.players[1].hand.length + playtest.game.players[1].deck.length, 52);
      }
    }
  }
  assert.throws(() => playtests.start({ source: "live", factionId: "neutral", subject: { kind: "card", id: "neutral-soldier" } }, "approved-admin"), { status: 422 });
  assert.equal(publication.status().draft, null);
});
test("neutral support cards respect production slot types and printed-value inventory", () => {
  const game = createGame(resolved, { factionId: "rumin", opponentFactionId: "sheen" });
  for (const card of resolved.manifest.cards.filter(card => card.factionId === "neutral")) {
    const support = card.type !== "servitor";
    const slot = { cardId: card.id, value: card.value, suit: "spades" };
    const scenario = zone => ({ version: 1, players: { 1: { [zone]: [slot, null, null] } } });
    const result = applyScenario(game, resolved, scenario(support ? "support" : "combat"), "neutral-test");
    assert.equal(result.game.lanes[0][support ? "support" : "facedown"][1].definitionId, card.id);
    assert.throws(() => applyScenario(game, resolved, scenario(support ? "combat" : "support"), "invalid"), { status: 422 });
    assert.throws(() => applyScenario(game, resolved, { version: 1, players: { 1: { hand: [{ ...slot, value: 14 }] } } }, "invalid"), { status: 422 });
  }
});
test("neutral content does not create a broken editable faction reference", () => {
  const relationships = contentRelationships(baseline);
  assert.equal(relationships.nodes.some(node => node.domain === "factions" && node.id === "neutral"), false);
  assert.ok(relationships.edges.some(edge => edge.from === "cards:neutral-soldier" && edge.kind === "uses-effect"));
});

