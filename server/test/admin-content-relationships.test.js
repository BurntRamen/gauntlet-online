const test = require("node:test");
const assert = require("node:assert/strict");
const { createAuthoredBaseline, clone } = require("../authoredContent");
const { contentRelationships } = require("../adminContentRelationships");
const { assetEntry } = require("../contentAssets");
const old = require("./fixtures/content-v2/authored-baseline-v1.json");
const baseline = createAuthoredBaseline({ domains: { decks: old.domains.decks }, game: { modes: old.domains.game } });

test("relationships normalize asset aliases, follow encounter-owned deck cards, and remain isolated from cached callers", () => {
  const draft = clone(baseline), encounter = draft.domains.encounters[0], card = draft.domains.cards.find(row => row.factionId === encounter.factionId);
  encounter.setup.playerAdditions = [card.id];
  const graph = contentRelationships(draft, { source: "draft", liveSnapshot: baseline });
  assert.ok(graph.edges.some(edge => edge.from === `decks:${encounter.deckId}` && edge.to === `cards:${card.id}` && edge.kind === "player-addition"));
  assert.ok(graph.edges.some(edge => edge.from === `encounters:${encounter.id}` && edge.to === `encounter-mechanics:${encounter.setup.bossAbility.id}` && edge.kind === "uses-ability"));
  const campaign = draft.domains.campaigns.find(row => row.coverImage), entry = assetEntry(campaign.coverImage);
  assert.ok(graph.edges.some(edge => edge.from === `campaigns:${campaign.id}` && edge.to === `asset-library:${entry.id}`));
  campaign.coverImage = entry.path;
  const aliased = contentRelationships(draft);
  assert.deepEqual(aliased.edges.filter(edge => edge.from === `campaigns:${campaign.id}` && edge.kind === "uses-asset"),
    graph.edges.filter(edge => edge.from === `campaigns:${campaign.id}` && edge.kind === "uses-asset").map(({ status: _status, ...edge }) => edge));
  assert.equal(new Set(aliased.edges.map(edge => JSON.stringify(edge))).size, aliased.edges.length);
  aliased.nodes.length = 0;
  assert.ok(contentRelationships(draft).nodes.length > 1000);
  assert.match(graph.coverage, /Player-owned decks.*not included/);
});

test("draft relationships expose removed and added references without conflating current content", () => {
  const draft = clone(baseline), card = draft.domains.cards[0];
  const beforeId = card.effect.id, afterId = draft.domains.cards.find(row => row.factionId === card.factionId && row.type === card.type && row.effect.id !== beforeId).effect.id;
  card.effect.id = afterId;
  const graph = contentRelationships(draft, { source: "draft", liveSnapshot: baseline });
  assert.equal(graph.edges.find(edge => edge.from === `cards:${card.id}` && edge.to === `card-effects:${beforeId}`).status, "removed");
  assert.equal(graph.edges.find(edge => edge.from === `cards:${card.id}` && edge.to === `card-effects:${afterId}`).status, "added");
  assert.notEqual(graph.hash, graph.liveHash);
  assert.ok(contentRelationships(baseline).edges.some(edge => edge.from === `cards:${card.id}` && edge.to === `card-effects:${beforeId}`));
});
