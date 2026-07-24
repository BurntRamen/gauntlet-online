const test = require("node:test");
const assert = require("node:assert/strict");

const { server, __test } = require("../index");

const {
  applyDeckResult,
  getSavedConstructedDeck,
  getSavedDraftDeck,
  normalizeDeckLibrary,
  saveConstructedDeckToLibrary,
  saveDraftDeckToLibrary,
  updateDeckLibraryRecord
} = __test;

test.after(() => server.close());

function makeConstructedStats() {
  return { collection: { cards: { "rumin-gilded-scale-legionary": 2 } } };
}

function constructedPayload(overrides = {}) {
  return {
    name: "Gold Guard",
    factionId: "rumin",
    cardQuantities: { "rumin-gilded-scale-legionary": 2 },
    cardSuitChoices: { "rumin-gilded-scale-legionary": ["spades", "hearts"] },
    ...overrides
  };
}

function draftDeck(draftType, name) {
  return {
    name,
    factionId: "sheen",
    factionName: "Sheen",
    draftType,
    baseCardCount: 52,
    maxCardCount: 52,
    cardCount: 52,
    replacementCount: 1,
    additionCount: 1,
    cards: [{ id: `sheen-${draftType}`, name: "Root Guard", value: 7, suit: "clubs", factionId: "sheen" }]
  };
}

test("migrates legacy singleton decks deterministically without duplicating them", () => {
  const stats = makeConstructedStats();
  stats.savedConstructedDeck = {
    ...constructedPayload(),
    factionName: "Rumin",
    savedAt: "2026-07-15T12:00:00.000Z"
  };
  const first = normalizeDeckLibrary(stats, "account-1");
  const deckId = first.activeConstructedDeckId;
  const second = normalizeDeckLibrary(stats, "account-1");

  assert.match(deckId, /^legacy-deck-/);
  assert.equal(second.decks.length, 1);
  assert.equal(second.decks[0].ownerId, "account-1");
  assert.equal(getSavedConstructedDeck(stats).deckId, deckId);
});

test("creates named constructed decks and appends immutable versions on edit", () => {
  const stats = makeConstructedStats();
  const first = saveConstructedDeckToLibrary(stats, constructedPayload(), "account-1");
  const firstVersionId = first.record.currentVersionId;
  const updated = saveConstructedDeckToLibrary(stats, constructedPayload({
    deckId: first.record.id,
    name: "Gold Guard II",
    cardQuantities: { "rumin-gilded-scale-legionary": 1 },
    cardSuitChoices: { "rumin-gilded-scale-legionary": ["diamonds"] }
  }), "account-1");

  assert.equal(updated.record.id, first.record.id);
  assert.equal(updated.record.versions.length, 2);
  assert.equal(updated.record.versions[0].id, firstVersionId);
  assert.notEqual(updated.record.currentVersionId, firstVersionId);
  assert.equal(stats.savedConstructedDeck.name, "Gold Guard II");
  assert.equal(stats.savedConstructedDeck.versionId, updated.record.currentVersionId);
  assert.equal(getSavedConstructedDeck(stats).replacementCount, 1);
});

test("duplicates, features, activates, archives, and restores library decks", () => {
  const stats = makeConstructedStats();
  const original = saveConstructedDeckToLibrary(stats, constructedPayload(), "account-1").record;
  const duplicate = updateDeckLibraryRecord(stats, original.id, { action: "duplicate", name: "Second Guard" });
  updateDeckLibraryRecord(stats, duplicate.id, { action: "feature" });
  updateDeckLibraryRecord(stats, duplicate.id, { action: "activate" });

  assert.equal(stats.deckLibrary.activeConstructedDeckId, duplicate.id);
  assert.equal(stats.deckLibrary.decks.find((deck) => deck.id === duplicate.id).featured, true);

  updateDeckLibraryRecord(stats, duplicate.id, { action: "archive" });
  assert.equal(stats.deckLibrary.decks.find((deck) => deck.id === duplicate.id).archived, true);
  assert.notEqual(stats.deckLibrary.activeConstructedDeckId, duplicate.id);

  updateDeckLibraryRecord(stats, duplicate.id, { action: "restore" });
  assert.equal(stats.deckLibrary.decks.find((deck) => deck.id === duplicate.id).archived, false);
});

test("preserves separate player and bot draft snapshots", () => {
  const stats = {};
  const player = saveDraftDeckToLibrary(stats, draftDeck("player", "Player Draft"), "account-1");
  const bot = saveDraftDeckToLibrary(stats, draftDeck("bot", "Bot Draft"), "account-1");

  assert.equal(stats.deckLibrary.activeDraftDeckIds.player, player.id);
  assert.equal(stats.deckLibrary.activeDraftDeckIds.bot, bot.id);
  assert.equal(getSavedDraftDeck(stats, "player").deckId, player.id);
  assert.equal(getSavedDraftDeck(stats, "bot").deckId, bot.id);
  assert.equal(stats.deckLibrary.decks.filter((deck) => deck.format === "draft").length, 2);
});

test("attributes results to the immutable deck version used by a match", () => {
  const stats = makeConstructedStats();
  const deck = saveConstructedDeckToLibrary(stats, constructedPayload(), "account-1").record;
  const versionId = deck.currentVersionId;
  saveConstructedDeckToLibrary(stats, constructedPayload({ deckId: deck.id, name: "Later Version" }), "account-1");

  applyDeckResult(stats, versionId, "win", "match-1");
  const record = stats.deckLibrary.decks.find((entry) => entry.id === deck.id);
  assert.deepEqual(record.record, { wins: 1, losses: 0, draws: 0, recentMatchIds: ["match-1"] });
  assert.equal(record.versions.some((version) => version.id === versionId), true);
});
