const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { verifyAsset, verifyMappings } = require("./check-suitfire-art");
const manifest = require("../docs/art-handoffs/suitfire-approved-art-2026-11-07.json");
const registry = require("../client/public/brand/suitfire-art/manifest.json");
const inventory = require("../docs/branding/suitfire-art-audit-inventory.json");
const { COLLECTION_CARDS: cards } = require("../server/gameContent");
const input = () => structuredClone({ manifest, registry, inventory, cards });
test("artwork bytes must match size, SHA-256 and Git object identity", () => {
  const bytes = Buffer.from("approved bytes");
  const asset = { path: "fixture.webp", bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex"), git_blob_sha1: crypto.createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest("hex") };
  verifyAsset(asset, bytes);
  assert.throws(() => verifyAsset(asset, Buffer.from("tampered bytes")), /SHA-256/);
  assert.throws(() => verifyAsset({ ...asset, git_blob_sha1: "wrong" }, bytes), /Git blob/);
});
test("all active routes bind the approved card identity and captured type", () => {
  assert.deepEqual(verifyMappings(input()), { illustrations: 66, covers: 4, sourceMappings: 330 });
  for (const patch of [{ factionId: "rumin" }, { cardType: "armament" }, { surfaces: ["portrait"] }]) {
    const data = input(); Object.assign(Object.values(data.registry.replacements)[0], patch);
    assert.throws(() => verifyMappings(data), /Unsafe mapping/);
  }
});
test("an extra scene replacement and a source/name drift fail release validation", () => {
  const data = input(); data.registry.replacements["/unrelated-scene.webp"] = Object.values(data.registry.replacements)[0];
  assert.throws(() => verifyMappings(data), /Unexpected replacement/);
  const renamed = input(); renamed.cards.find(card => card.id === renamed.inventory.cards[0].cardId).name = "Changed name";
  assert.throws(() => verifyMappings(renamed), /Captured name drift/);
});
