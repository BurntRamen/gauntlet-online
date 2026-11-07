const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-packs-"));
Object.assign(process.env, { NODE_ENV: "test", GAUNTLET_CONTENT_PROVIDER: "file", ACCOUNT_DATA_FILE: path.join(root, "accounts.json"), MATCH_DATA_FILE: path.join(root, "matches.json"), GAUNTLET_CONTENT_DATA_DIR: path.join(root, "content"), ROOM_STATE_RECOVERY_ENABLED: "false" });
for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]) delete process.env[key];
const { server, __test } = require("../index");
const packs = require("../../shared/duel-rules/packComposition");
const { clone, createAuthoredBaseline, resolveEngineContent, validateAuthoredContent } = require("../authoredContent");
test.after(() => { server.close(); fs.rmSync(root, { recursive: true, force: true }); });

test("captured recipes drive real Draft, Sealed and earned grants without changing suit guarantees or credit accounting", t => {
  const baseline = __test.contentPublication.status().live, original = resolveEngineContent(baseline, "original").manifest;
  const saved = clone(baseline), recipe = { ...clone(packs.defaults), slots: [...Array(4).fill("common"), ...Array(9).fill("mythic")] };
  saved.domains.game.find(row => row.id === "shared-rules").packComposition = recipe;
  assert.equal(validateAuthoredContent(saved, baseline).valid, true);
  const resolved = resolveEngineContent(saved, "updated"), manifest = resolved.manifest;
  for (const format of ["draft", "sealed"]) {
    const pack = __test.createDraftPack(1, ["rumin"], manifest, null, format);
    assert.equal(pack.cards.length, 13);
    assert.equal(new Set(pack.cards.map(card => card.draftCopyId)).size, 13);
    assert.deepEqual(new Set(pack.cards.slice(0, 4).map(card => card.suit)), new Set(["spades", "hearts", "diamonds", "clubs"]));
    assert.ok(pack.cards.slice(4).every(card => card.rarity === "mythic"));
    const prior = __test.createDraftPack(1, ["rumin"], JSON.parse(JSON.stringify(original)), null, format);
    assert.ok(prior.cards.slice(4, 7).every(card => card.rarity === "common"), "captured drafts retain original recipe");
  }
  const active = t.mock.method(__test.contentPublication, "active", () => resolved);
  try {
    const stats = { collection: { packCredits: 1 } }, cards = __test.openCollectionBooster(stats, "rumin-foundation");
    assert.equal(cards.length, 13); assert.ok(cards.slice(4).every(card => card.rarity === "mythic"));
    assert.equal(stats.collection.packCredits, 0); assert.equal(stats.collection.openedGameplayPacks, 1);
    const quantities = {};
    for (const card of cards) quantities[card.gameplayCardId] = (quantities[card.gameplayCardId] || 0) + 1;
    for (const [id, quantity] of Object.entries(quantities)) assert.equal(stats.collection.gameplayEntitlements[id], quantity);
    assert.deepEqual(__test.collectionSummary(stats).boosters["rumin-foundation"].slots, recipe.slots);
    assert.throws(() => __test.openCollectionBooster(stats, "rumin-foundation"), /credit/);
  } finally { active.mock.restore(); }
});

test("set recipes and validation preserve immutable defaults and reject unsupported economy fields", () => {
  assert.equal(packs.rarity("wild", packs.defaults, () => 19), "mythic");
  assert.equal(packs.rarity("wild", packs.defaults, () => 20), "rare");
  for (const recipe of [{ ...packs.defaults, price: 0 }, { ...packs.defaults, wildMythicPercent: 101 }, { ...packs.defaults, slots: Array(13).fill("rare") }, { ...packs.defaults, slots: Array(12).fill("common") }]) assert.equal(packs.valid(recipe), false);
  const baseline = __test.contentPublication.status().live, snapshot = clone(baseline), catalog = require("../adminCatalog");
  const set = catalog.createObject(snapshot, { domain: "sets", name: "Fixture distribution" });
  set.members = baseline.domains.cards.filter(card => card.factionId === "rumin" && card.rarity === "common").map(card => card.id);
  set.limited = { draft: true, sealed: true }; set.packComposition = { version: 1, slots: Array(13).fill("common"), wildMythicPercent: 0 };
  assert.equal(validateAuthoredContent(snapshot, baseline).valid, true);
  const manifest = resolveEngineContent(snapshot, "set-recipe").manifest;
  for (const format of ["draft", "sealed"]) assert.ok(__test.createDraftPack(1, ["rumin"], manifest, set.id, format).cards.every(card => card.rarity === "common"));
  assert.deepEqual(catalog.createObject(snapshot, { domain: "sets", name: "Copy", sourceId: set.id }).packComposition, set.packComposition);
  set.packComposition.slots[12] = "mythic";
  assert.ok(validateAuthoredContent(snapshot, baseline).errors.some(error => error.id === set.id && /rarity/.test(error.message)));
});
