const test = require("node:test"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createPlayerRepairService } = require("../adminPlayerRepairs");
test("hosted repair uses account CAS, reconciles a committed lost reply and refuses concurrent replacement", async () => {
  const id = crypto.randomUUID(), actor = crypto.randomUUID();
  let account = { id, name: "Fixture", stats: { _accountRevision: 4, matchConsequenceReceipts: { evidence: { result: "win", campaign: { factionId: "rumin", chapterId: "fixture-clear", outcome: "cleared" } } } } }, behavior = "lost", writes = 0;
  const service = createPlayerRepairService({ useSupabase: () => true, request: async (route, options) => {
    if (route.startsWith("rpc/")) return 1;
    if (!options) return [structuredClone(account)];
    writes++; const { stats } = JSON.parse(options.body);
    assert.equal(options.method, "PATCH"); assert.equal(stats._accountRevision, account.stats._accountRevision);
    assert.equal(Object.keys(JSON.parse(options.body)).join(), "stats");
    if (behavior === "race") throw Object.assign(new Error("Database detail"), { code: "40001" });
    account.stats = { ...stats, _accountRevision: stats._accountRevision + 1 };
    if (behavior === "lost") throw new Error("Lost reply after commit");
    return [{ id }];
  } });
  const preview = await service.preview(id), input = { action: preview.action, expectedHash: preview.hash, key: crypto.randomUUID(), reason: "Restore verified clear after outage" };
  await assert.rejects(service.apply(id, input, actor), /Lost reply/);
  assert.equal((await service.apply(id, input, actor)).alreadyApplied, true); assert.equal(writes, 1);
  account.stats.progression.campaign.rumin = [];
  const next = await service.preview(id); behavior = "race";
  await assert.rejects(service.apply(id, { ...input, key: crypto.randomUUID(), expectedHash: next.hash }, actor), error => error.status === 409 && !error.message.includes("Database"));
  assert.deepEqual(account.stats.progression.campaign.rumin, []);
});
