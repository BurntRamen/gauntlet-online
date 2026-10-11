"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { __test } = require("../index");
const {
  NEUTRAL_COLLECTION_CARDS,
  RUMIN_COLLECTION_CARDS,
  SHEEN_COLLECTION_CARDS
} = require("../gameContent");

test("every account receives the shared Reath gameplay pool", () => {
  const collection = __test.normalizeCollection({});
  assert.equal(NEUTRAL_COLLECTION_CARDS.length, 18);
  for (const card of NEUTRAL_COLLECTION_CARDS) {
    assert.equal(collection.gameplayEntitlements[card.id], 1, card.id);
    assert.equal(collection.collectorVariants[card.defaultVariantId], 1, card.defaultVariantId);
  }
});

test("constructed decks accept neutral cards beside exactly one chosen faction", () => {
  const neutral = NEUTRAL_COLLECTION_CARDS.find((card) => card.id === "neutral-soldier");
  const rumin = RUMIN_COLLECTION_CARDS.find((card) => card.value !== neutral.value || card.suit !== neutral.suit);
  const sheen = SHEEN_COLLECTION_CARDS.find((card) => (
    (card.value !== neutral.value || card.suit !== neutral.suit)
    && (card.value !== rumin.value || card.suit !== rumin.suit)
  ));
  const stats = { collection: { gameplayEntitlements: { [rumin.id]: 1, [sheen.id]: 1 } } };
  const valid = __test.validateConstructedDeckPayload(stats, {
    factionId: "rumin",
    gameplayCardQuantities: { [neutral.id]: 1, [rumin.id]: 1 }
  });
  assert.deepEqual(valid.gameplayCardQuantities, { [neutral.id]: 1, [rumin.id]: 1 });
  assert.throws(() => __test.validateConstructedDeckPayload(stats, {
    factionId: "rumin",
    gameplayCardQuantities: { [neutral.id]: 1, [sheen.id]: 1 }
  }), /one faction plus neutral Reath cards/);
});

test("neutral cards keep fixed slots and cover Timetwister's shared card roles", () => {
  assert.equal(new Set(NEUTRAL_COLLECTION_CARDS.map((card) => `${card.value}:${card.suit}`)).size, 18);
  assert.deepEqual(
    [...new Set(NEUTRAL_COLLECTION_CARDS.map((card) => card.type))].sort(),
    ["ambush", "contraption", "servitor", "shelter", "spell", "weaponry"]
  );
});
