const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createAuthoredBaseline, hash } = require("../authoredContent");
const { createContentPublication } = require("../contentPublication");
const { createGitHubContentPublication } = require("../githubContentPublication");
const { selectWorkshopSnapshot, workshopMetadata, registerAdminWorkshopRoutes } = require("../adminWorkshopData");
const old = require("./fixtures/content-v2/authored-baseline-v1.json");
const baseline = createAuthoredBaseline({ domains: { decks: old.domains.decks }, game: { modes: old.domains.game } });

test("workshop guidance mirrors deployed contracts and cannot be rewritten by draft card wording", () => {
  const store = createContentPublication({ baseline, memory: true });
  const first = workshopMetadata(selectWorkshopSnapshot(store.status()));
  assert.equal(first.cardEffects.length, 126);
  assert.equal(first.factionEffects.length, 10);
  assert.equal(first.bossAbilities.length, 6);
  assert.equal(first.gameConfig.startingLife, 42);
  assert.equal(first.gameConfig.handSize, 8);
  const effect = first.cardEffects.find(row => row.id === "coin-scale-spear");
  assert.deepEqual(effect.parameters.armBonus, { min: 0, max: 8, default: 2, label: "Armed attack bonus" });
  store.patch({ expectedRevision: 0, domain: "cards", id: effect.legacyCardId, field: "text", value: "Invented behavior" });
  const draft = workshopMetadata(selectWorkshopSnapshot(store.status(), { source: "draft" }));
  assert.equal(draft.cardEffects.find(row => row.id === effect.id).description, effect.description);
  assert.equal(draft.bindings.authoredRelease, `draft:${draft.hash}`);
  assert.throws(() => selectWorkshopSnapshot(store.status(), { source: "draft", hash: first.hash }), { status: 409 });
  assert.throws(() => selectWorkshopSnapshot(store.status(), { source: "other" }), { status: 400 });
  const invalid = store.patch({ expectedRevision: store.status().revision, domain: "factions", id: "rumin", field: "mechanics", value: null });
  assert.equal(invalid.validation.valid, false);
  assert.equal(workshopMetadata(selectWorkshopSnapshot(invalid, { source: "draft" })).cardEffects.length, 126, "Invalid authored values cannot hide workshop guidance needed to fix them");
});

test("private workshop reads reject unauthenticated access, stale hashes and never mutate content or receipts", async t => {
  const store = createContentPublication({ baseline, memory: true }), app = express();
  app.use((req, _res, next) => { if (req.headers["x-test-operator"] === "yes") req.gauntletAdminAccount = { id: "test-approved-account" }; next(); });
  registerAdminWorkshopRoutes(app, { publication: store });
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}/api/admin/workshops`;
  const status = store.status(), before = store.exportState();
  for (const path of ["", "/relationships", "/presentation", "/review", `/releases/${status.activeReleaseId}/review`]) {
    const denied = await fetch(`${origin}${path}`);
    assert.equal(denied.status, 403);
    assert.match(denied.headers.get("cache-control"), /no-store/);
    const allowed = await fetch(`${origin}${path}`, { headers: { "x-test-operator": "yes" } });
    assert.equal(allowed.status, 200, path);
    assert.match(allowed.headers.get("cache-control"), /no-store/);
  }
  const get = path => fetch(`${origin}${path}`, { headers: { "x-test-operator": "yes" } });
  assert.equal((await get("?source=draft")).status, 404);
  assert.equal((await get("/relationships?hash=old")).status, 409);
  assert.equal((await get("/presentation?source=live&hash=old")).status, 409);
  assert.equal((await get("/releases/not-a-release/review")).status, 400);
  const presentation = await (await get(`/presentation?hash=${hash(baseline)}`)).json();
  assert.equal(presentation.resolved.releaseId, status.activeReleaseId);
  assert.equal(presentation.resolved.manifest.cards.length, 126);
  assert.deepEqual(store.exportState(), before);
});

test("GitHub release inspection works without credentials, performs no writes, and returns an isolated snapshot", async () => {
  const store = createGitHubContentPublication({ baseline, token: "", releaseFile: "missing-workshop-test-release.json",
    client: { request: () => assert.fail("Disconnected read should not use GitHub"), putFile: () => assert.fail("No writes") } });
  const status = await store.status(), release = await store.releaseSnapshot(status.activeReleaseId);
  assert.equal(release.compatible, true);
  release.snapshot.domains.cards[0].name = "Modified response";
  assert.notEqual((await store.releaseSnapshot(status.activeReleaseId)).snapshot.domains.cards[0].name, "Modified response");
  assert.equal((await store.status()).revision, status.revision);
  await assert.rejects(store.releaseSnapshot("missing"), { status: 404 });
});
