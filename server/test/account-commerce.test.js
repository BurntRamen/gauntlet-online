const test = require("node:test"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { prepareRefund, captureGrant } = require("../accountCommerce");
const actor = { id: "operator" }, input = { purchaseId: "purchase", key: crypto.randomUUID(), reason: "Return captured product" };
const adapters = { normalizeCollection: stats => structuredClone(stats.collection), normalizeProgression: stats => structuredClone(stats.progression) };
function fixture() { return { id: "player", stats: { economy: { timetwisters: 3, purchaseReceipts: { "deck:purchase": { requestId: "purchase", currency: "timetwisters", price: 7, template: { composition: { cards: [{ printingId: "foil" }] } }, terms: { cardBackId: "campaignMap" }, grant: { schemaVersion: 1, printingCounts: { foil: 1 }, cardBackId: "campaignMap", baseBackOwned: false } } } }, collection: { collectorVariants: { foil: 2 } }, progression: { achievements: {}, matchHistory: [], cosmetics: { unlockedCardBacks: ["classic", "campaignMap"], selectedCardBack: "campaignMap" } } } }; }
test("refund removes its printing contribution, retains other copies and recipes, and records immutable financial evidence", () => {
  const account = fixture(), original = structuredClone(account), result = prepareRefund(account, input, actor, adapters);
  assert.deepEqual(account, original); assert.equal(result.stats.economy.timetwisters, 10); assert.equal(result.stats.collection.collectorVariants.foil, 1);
  assert.deepEqual(result.stats.economy.purchaseReceipts, original.stats.economy.purchaseReceipts);
  assert.equal(result.stats.progression.cosmetics.selectedCardBack, "classic"); assert.deepEqual(result.stats.progression.cosmetics.unlockedCardBacks, ["classic"]);
  const replay = prepareRefund({ ...account, stats: result.stats }, input, actor, adapters); assert.deepEqual(replay.stats, result.stats); assert.equal(replay.alreadyRefunded, true);
});
test("independent, earned, old ambiguous and other purchase back ownership survives exact reversal", () => {
  for (const kind of ["independent", "earned", "legacy", "other"]) {
    const a = fixture(), receipt = a.stats.economy.purchaseReceipts["deck:purchase"];
    if (kind === "independent") receipt.grant.baseBackOwned = true;
    if (kind === "earned") a.stats.progression.achievements["first-campaign-clear"] = "earned-later";
    if (kind === "legacy") delete receipt.grant;
    if (kind === "other") a.stats.economy.purchaseReceipts["deck:other"] = { ...structuredClone(receipt), requestId: "other" };
    const result = prepareRefund(a, input, actor, adapters); assert.ok(result.stats.progression.cosmetics.unlockedCardBacks.includes("campaignMap"), kind);
    assert.equal(result.stats.collection.collectorVariants.foil, 1);
  }
  const a = fixture();
  assert.equal(captureGrant(a.stats, a.stats.progression, { cards: [{ variantId: "foil" }] }, "campaignMap").baseBackOwned, false, "another purchase is not independent ownership");
});
test("bad balance, overflow, missing ownership, unknown delivery and the wrong currency fail without mutation", () => {
  for (const alter of [a => { a.stats.economy.timetwisters = 1.5; }, a => { a.stats.economy.timetwisters = Number.MAX_SAFE_INTEGER; }, a => { a.stats.collection.collectorVariants.foil = 0; }, a => { delete a.stats.economy.purchaseReceipts["deck:purchase"].grant; delete a.stats.economy.purchaseReceipts["deck:purchase"].template; }, a => { a.stats.economy.purchaseReceipts["deck:purchase"].currency = "gold"; }]) {
    const a = fixture(); alter(a); const before = structuredClone(a); assert.throws(() => prepareRefund(a, input, actor, adapters)); assert.deepEqual(a, before);
  }
});
