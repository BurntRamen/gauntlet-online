const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  COLLECTION_CARDS,
  COLLECTOR_VARIANTS,
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

  assert.equal(content.schemaVersion, 2);
  assert.equal(content.contentVersion, CONTENT_VERSION);
  assert.equal(content.rulesVersion, RULES_VERSION);
  assert.equal(content.factions.length, 4);
  assert.equal(Object.values(content.campaigns).flatMap((campaign) => campaign.chapters).length, 56);
  assert.equal(content.campaigns.xendra.chapters.length, 8);
  assert.equal(content.cards.length, COLLECTION_CARDS.length);
  assert.equal(content.collectorVariants.length, COLLECTOR_VARIANTS.length);
  assert.equal(content.deckRules.basePlayingDeckSize, 52);
  assert.equal(content.deckRules.basePlayingDeckSize, DECK_RULES.replacementSuits.length * DECK_RULES.playingDeckValues.length);
});

test("keeps the legacy faction adapter on the canonical registry", () => {
  const publicFactions = getPublicGameContent().factions;
  assert.deepEqual(Object.values(FACTIONS), publicFactions);
});

test("maps every catalog constructed card into the shared deterministic rules", () => {
  const sharedRulesSource = fs.readFileSync(
    path.join(__dirname, "..", "..", "shared", "duel-rules", "index.js"),
    "utf8"
  );
  const missing = COLLECTION_CARDS
    .map((card) => card.id)
    .filter((cardId) => !sharedRulesSource.includes(`"${cardId}"`));

  assert.equal(COLLECTION_CARDS.length, 72);
  assert.deepEqual(missing, []);
});

test("requires card-specific constructed behavior coverage for the full catalog", () => {
  const behaviorSources = [
    path.join(__dirname, "..", "..", "shared", "duel-rules", "index.js"),
    path.join(__dirname, "..", "gameContent.js")
  ].map((sourcePath) => fs.readFileSync(sourcePath, "utf8")).join("\n");
  const missing = COLLECTION_CARDS
    .map((card) => card.id)
    .filter((cardId) => !behaviorSources.includes(`"${cardId}"`));

  assert.equal(COLLECTION_CARDS.length, 72);
  assert.deepEqual(missing, []);
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
