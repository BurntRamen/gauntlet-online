const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateBudgets, budgets } = require("./check-build-budgets");
const KIB = 1024;
const asset = (name, kib, sources = []) => ({ name, gzipBytes: kib * KIB, sources });

test("all named workshop splits share one Admin total and do not inflate player accounting", () => {
  const assets = [asset("main.a.js", 170), asset("player.a.chunk.js", 500), asset("gauntlet-admin.a.chunk.js", 18),
    asset("gauntlet-admin-cards.a.chunk.js", 8), asset("gauntlet-admin-new-workshop.a.chunk.js", 9)];
  const result = evaluateBudgets(assets);
  assert.equal(result.adminEntryGzipBytes, 18 * KIB);
  assert.equal(result.adminGzipBytes, 35 * KIB);
  assert.equal(result.totalGzipBytes, 670 * KIB);
  assert.equal(result.failures.length, 1, "The independent largest-async limit remains in force");
  assert.match(result.failures[0], /Largest async/);
  assets.push(asset("gauntlet-admin-scenarios.a.chunk.js", 14));
  assert.ok(evaluateBudgets(assets).failures.some(message => /All Admin/.test(message)));
});

test("entry and aggregate Admin limits cannot substitute for one another", () => {
  const assets = [asset("main.a.js", 170), asset("gauntlet-admin.a.chunk.js", 21), asset("gauntlet-admin-cards.a.chunk.js", 2)];
  const result = evaluateBudgets(assets);
  assert.equal(result.adminGzipBytes, 23 * KIB);
  assert.match(result.failures.join(" "), /Initial Admin entry/);
  assert.equal(budgets.mainGzip, 177 * KIB);
  assert.equal(budgets.totalJavaScriptGzip, 740 * KIB);
  assert.equal(budgets.largestAsyncGzip, 350 * KIB);
});

test("unnamed Admin chunks and accidental player imports fail instead of escaping the Admin limit", () => {
  const assets = [asset("main.a.js", 170), asset("gauntlet-admin.a.chunk.js", 18),
    asset("123.a.chunk.js", 7, ["webpack://client/./src/admin/CardWorkshop.js"]),
    asset("456.a.chunk.js", 6, ["webpack://client/./src/GauntletPlaytest.js"])];
  const result = evaluateBudgets(assets);
  assert.equal(result.adminGzipBytes, 31 * KIB);
  assert.equal(result.totalGzipBytes, 170 * KIB);
  assert.equal(result.failures.filter(message => /Admin modules appeared/.test(message)).length, 2);
  assets[0].sources = ["webpack://client/./src/admin/ScenarioBuilder.js"];
  assert.ok(evaluateBudgets(assets).failures.some(message => /Admin modules appeared in main/.test(message)));
});

test("missing or duplicated build entries fail qualification", () => {
  assert.ok(evaluateBudgets([asset("main.a.js", 170)]).failures.some(message => /gauntlet-admin entry/.test(message)));
  assert.ok(evaluateBudgets([asset("gauntlet-admin.a.chunk.js", 10)]).failures.some(message => /main client/.test(message)));
  assert.ok(evaluateBudgets([asset("main.a.js", 170), asset("gauntlet-admin.a.chunk.js", 10), asset("gauntlet-admin.b.chunk.js", 10)]).failures.some(message => /exactly one named/.test(message)));
});
