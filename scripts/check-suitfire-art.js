const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const HANDOFF = "bb39699fbfb9f44ff3bdf50d1476cb4641c05d1e";
const PREFIX = "client/public/assets/gauntlet/faction-art-2026-11-07/";
const digest = (algorithm, bytes) => crypto.createHash(algorithm).update(bytes).digest("hex");
function verifyAsset(asset, bytes) {
  assert.equal(bytes.length, asset.bytes, `Byte size: ${asset.path}`);
  assert.equal(digest("sha256", bytes), asset.sha256, `SHA-256: ${asset.path}`);
  assert.equal(digest("sha1", Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])), asset.git_blob_sha1, `Git blob: ${asset.path}`);
}
function verifyMappings({ manifest, registry, inventory, cards }) {
  assert.equal(manifest.assets.length, 70);
  assert.equal(registry.release.handoffCommit, HANDOFF);
  assert.equal(registry.release.cardIllustrations, 66);
  assert.equal(registry.release.decorativeCovers, 4);
  const targets = new Map(manifest.assets.map(asset => [asset.path.slice("client/public".length), asset]));
  assert.equal(targets.size, 70, "Duplicate approved paths");
  const expected = new Set();
  assert.equal(inventory.cards.length, 66);
  const ids = new Set();
  for (const card of inventory.cards) {
    assert.ok(["sheen", "frumo", "bizi"].includes(card.factionId));
    assert.ok(!ids.has(card.cardId), "Duplicate card identity"); ids.add(card.cardId);
    const current = cards.find(entry => entry.id === card.cardId);
    assert.ok(current, `Missing current card: ${card.cardId}`);
    assert.equal(current.name, card.currentName, `Captured name drift: ${card.cardId}`);
    assert.equal(current.type, card.currentType, `Captured type drift: ${card.cardId}`);
    const asset = targets.get(card.target);
    assert.equal(asset?.kind, "constructed_illustration", card.cardId);
    assert.equal(path.posix.basename(asset.path, ".webp"), card.cardId);
    assert.equal(asset.sha256, card.targetSha256);
    assert.equal(card.pixelReview, "reviewed-approved-baseline");
    for (const original of card.originals) {
      assert.ok(!expected.has(original.source)); expected.add(original.source);
      const mapping = registry.replacements[original.source];
      assert.deepEqual(mapping, { status: "approved", factionId: card.factionId, cardId: card.cardId, cardType: current.type, surfaces: ["card", "illustration", "thumbnail"], target: card.target, kind: "illustration" }, `Unsafe mapping: ${original.source}`);
      assert.equal(registry.aliases[original.immutablePath], original.source);
    }
  }
  assert.equal(expected.size, 330);
  assert.deepEqual(Object.keys(registry.replacements).sort(), [...expected].sort(), "Unexpected replacement surface/source");
  assert.deepEqual(Object.keys(registry.covers).sort(), ["bizi", "frumo", "rumin", "sheen"]);
  for (const cover of inventory.covers) {
    assert.equal(targets.get(cover.target)?.kind, "city_cover");
    assert.equal(targets.get(cover.target)?.sha256, cover.targetSha256);
    assert.deepEqual(registry.covers[cover.factionId], { status: "approved", source: cover.source, target: cover.target });
  }
  const used = new Set([...inventory.cards, ...inventory.covers].map(entry => entry.target));
  assert.deepEqual([...used].sort(), [...targets.keys()].sort(), "Unaccounted handoff art");
  assert.equal(registry.portraits["leafen gao"].source, "/assets/gauntlet/leafen-gao.png");
  return { illustrations: ids.size, covers: inventory.covers.length, sourceMappings: expected.size };
}
function check(root = path.resolve(__dirname, "..")) {
  const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  const manifest = readJson("docs/art-handoffs/suitfire-approved-art-2026-11-07.json");
  const registry = readJson("client/public/brand/suitfire-art/manifest.json");
  const inventory = readJson("docs/branding/suitfire-art-audit-inventory.json");
  const { COLLECTION_CARDS: cards } = require(path.join(root, "server/gameContent"));
  const result = verifyMappings({ manifest, registry, inventory, cards });
  for (const asset of manifest.assets) {
    assert.ok(asset.path.startsWith(PREFIX) && !asset.path.includes("..") && asset.path.endsWith(".webp"), "Unexpected artwork path");
    assert.equal(asset.status, "review_approved");
    assert.ok(!asset.path.includes("/rumin/") || asset.kind === "city_cover", "Superseded Rumin card art");
    verifyAsset(asset, fs.readFileSync(path.join(root, asset.path)));
  }
  for (const card of inventory.cards) for (const original of card.originals) {
    for (const file of [original.source, original.immutablePath]) assert.equal(digest("sha256", fs.readFileSync(path.join(root, "client/public", file))), original.sha256, `Retained source changed: ${file}`);
  }
  assert.equal(digest("sha256", fs.readFileSync(path.join(root, "client/public/assets/gauntlet/leafen-gao.png"))), "e7db39aeb8f4a467cdc17b0eb9aa52c8d851c959c31654fa429c44ac59ed1b06", "Leafen identity changed");
  console.log(`SuitFire artwork: 70 hashes verified; ${result.illustrations} card illustrations, ${result.sourceMappings} exact sources, ${result.covers} decorative covers. Originals retained.`);
  return result;
}
if (require.main === module) check();
module.exports = { verifyAsset, verifyMappings, check };
