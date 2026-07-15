const test = require("node:test");
const assert = require("node:assert/strict");

const {
  COLLECTION_CARDS,
  CONTENT_VERSION,
  DECK_RULES,
  RULES_VERSION,
  getPublicGameContent,
  validateGameContent
} = require("../gameContent");
const { FACTIONS } = require("../game/factions");
const { server } = require("../index");

test.after(() => server.close());

test("validates the authoritative versioned game content registry", () => {
  assert.equal(validateGameContent(), true);
  const content = getPublicGameContent();

  assert.equal(content.schemaVersion, 1);
  assert.equal(content.contentVersion, CONTENT_VERSION);
  assert.equal(content.rulesVersion, RULES_VERSION);
  assert.equal(content.factions.length, 4);
  assert.equal(Object.values(content.campaigns).flatMap((campaign) => campaign.chapters).length, 48);
  assert.equal(content.cards.length, COLLECTION_CARDS.length);
  assert.equal(content.deckRules.basePlayingDeckSize, 52);
  assert.equal(content.deckRules.basePlayingDeckSize, DECK_RULES.replacementSuits.length * DECK_RULES.playingDeckValues.length);
});

test("keeps the legacy faction adapter on the canonical registry", () => {
  const publicFactions = getPublicGameContent().factions;
  assert.deepEqual(Object.values(FACTIONS), publicFactions);
});

test("serves the validated public content manifest", async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/game-content`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.content.contentVersion, CONTENT_VERSION);
  assert.equal(body.content.rulesVersion, RULES_VERSION);
  assert.equal(body.content.campaigns.rumin.chapters.length, 12);
});
