"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { COLLECTION_CARDS, COLLECTOR_VARIANTS } = require("../server/gameContent");
const { buildConstructedCardArtInventory } = require("./report-constructed-card-art");

test("constructed-card art inventory follows the collector variant contract", () => {
  const inventory = buildConstructedCardArtInventory();
  assert.equal(inventory.summary.gameplayCardCount, COLLECTION_CARDS.length);
  assert.equal(inventory.summary.collectorVariantCount, COLLECTOR_VARIANTS.length);
  assert.equal(inventory.cards.length, COLLECTION_CARDS.length);
  for (const card of inventory.cards) {
    assert.ok(card.gameplayCardId);
    assert.ok(card.standardVariantId);
    assert.ok(card.collectorVariantId);
    assert.ok(Object.hasOwn(card.currentArt, "standard"));
    assert.ok(Object.hasOwn(card.currentArt, "collector"));
  }

  const biziCards = inventory.cards.filter((card) => card.faction === "bizi");
  assert.equal(biziCards.length, 18);
  assert.equal(biziCards.every((card) => (
    card.currentArt.standard?.startsWith("/assets/gauntlet/constructed/bizi/")
    && card.currentArt.standard === card.currentArt.collector
  )), true);
});
