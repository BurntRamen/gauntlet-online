const test = require("node:test"), assert = require("node:assert/strict");
const { areas, modules, projectModules } = require("../adminModules");
test("module contracts distinguish deployed interfaces from disabled consumers", () => {
  const result = projectModules({ environment: "production", authoring: { writable: true }, para: { enabled: false }, gold: { enabled: false }, deck: { ready: false, reason: "Missing revision guard" } });
  assert.equal(areas.length, 7);
  assert.equal(new Set(modules.map(m => m.id)).size, modules.length);
  for (const row of result.modules) {
    assert.ok(areas.includes(row.area));
    for (const field of ["source", "schema", "consumer", "preview", "activation", "operations", "history", "publication", "boundary"]) assert.ok(row[field], `${row.id}: ${field}`);
    assert.equal(row.implementation, "deployed");
  }
  assert.equal(result.modules.find(m => m.id === "gold").status, "disabled");
  assert.equal(result.modules.find(m => m.id === "gems").status, "disabled");
  assert.equal(result.modules.find(m => m.id === "payments").status, "missing");
  assert.equal(result.modules.find(m => m.id === "publishing").status, "available");
  assert.deepEqual(result.modules.find(m => m.id === "deck-products").blockers, ["Missing revision guard"]);
  const local = projectModules({ gold: { enabled: true }, para: { enabled: true } });
  assert.equal(local.modules.find(m => m.id === "gold").implementation, "local");
  assert.equal(local.modules.find(m => m.id === "gold").status, "available");
  assert.equal(local.modules.find(m => m.id === "gems").status, "disabled", "enabling Gold never silently enables Gems");
});
