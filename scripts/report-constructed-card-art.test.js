"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const sharp = require("sharp");
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

test("every custom card has a unique illustration and four distinct full-art suit faces", async () => {
  const hashes = new Set();
  const faceHashes = new Set();
  const publicRoot = path.resolve(__dirname, "../client/public");
  for (const card of COLLECTION_CARDS) {
    const variant = COLLECTOR_VARIANTS.find((entry) => entry.gameplayCardId === card.id && !entry.paid);
    assert.ok(variant.art, `${card.id} has dedicated artwork`);
    const digest = crypto.createHash("sha256").update(fs.readFileSync(path.join(publicRoot, variant.art))).digest("hex");
    assert.ok(!hashes.has(digest), `${card.id} must not reuse another card's illustration`);
    hashes.add(digest);
    for (const suit of ["spades", "hearts", "diamonds", "clubs"]) {
      const facePath = path.join(publicRoot, `assets/gauntlet/constructed/faces/${card.id}-${suit}.webp`);
      assert.ok(fs.existsSync(facePath), `${card.id}: ${suit} face`);
      const metadata = await sharp(facePath).metadata();
      assert.deepEqual([metadata.width, metadata.height, metadata.format], [500, 700, "webp"], `${card.id}: valid ${suit} playing-card face`);
      const faceDigest = crypto.createHash("sha256").update(fs.readFileSync(facePath)).digest("hex");
      assert.ok(!faceHashes.has(faceDigest), `${card.id}: ${suit} must have its own face`);
      faceHashes.add(faceDigest);
    }
  }
});
