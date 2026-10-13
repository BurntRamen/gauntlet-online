const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createAuthoredBaseline, hash, pinGameContent } = require("../authoredContent");
const engine = require("../../shared/duel-rules");
const { createAdminPlaytests, registerAdminPlaytestRoutes } = require("../adminPlaytest");
const { createContentPublication, registerContentPublicationRoutes } = require("../contentPublication");
const { createGitHubContentPublication, RELEASE_SCHEMA } = require("../githubContentPublication");
const { readAuthoringStatus } = require("../adminLiveAvailability");
const { registerAdminWorkshopRoutes } = require("../adminWorkshopData");
const old = require("./fixtures/content-v2/authored-baseline-v1.json");
const baseline = createAuthoredBaseline({ domains: { decks: old.domains.decks }, game: { modes: old.domains.game } });

function unavailableRepository() {
  const store = createContentPublication({ baseline, memory: true });
  let state = store.patch({ expectedRevision: 0, domain: "cards", id: baseline.domains.cards[0].id, field: "name", value: "Deployed authored card" });
  state = store.preview({ expectedRevision: state.revision });
  state = store.publish({ expectedRevision: state.revision, label: "Deployed release" }, "operator");
  const deployed = store.exportState().releases[state.activeReleaseId];
  let reads = 0;
  const publication = createGitHubContentPublication({ baseline, token: "configured-credential",
    deployedRelease: { schemaVersion: RELEASE_SCHEMA, ...deployed },
    client: {
      request: async () => { reads++; throw Object.assign(new Error("Private upstream detail"), { status: 503 }); },
      putFile: () => assert.fail("Live fallback must never write remote content")
    } });
  return { publication, deployed, reads: () => reads };
}

test("authoring failure exposes only the captured deployed release and explicitly unknown draft/history", async () => {
  const { publication, deployed } = unavailableRepository();
  const before = publication.active();
  const fallback = await readAuthoringStatus(publication);
  assert.equal(fallback.liveOnly, true);
  assert.equal(fallback.revision, null);
  assert.equal(fallback.writable, false);
  assert.equal(fallback.connectionRequired, false);
  assert.deepEqual(fallback.sourceAvailability, { live: true, draft: false, history: false });
  assert.equal(fallback.activeReleaseId, deployed.id);
  assert.equal(hash(fallback.live), hash(deployed.snapshot));
  assert.equal(fallback.live.domains.cards[0].name, "Deployed authored card", "Do not substitute the source baseline for deployed authored changes");
  assert.equal(fallback.draft, null);
  assert.deepEqual(fallback.changes, []);
  assert.deepEqual(fallback.releases, []);
  assert.deepEqual(fallback.activations, []);
  assert.equal(fallback.validation.valid, true);
  assert.ok(fallback.fields.cards[fallback.live.domains.cards[0].id].name);
  assert.ok(Object.keys(fallback.encounterSummaries).length);
  assert.ok(fallback.assetLibrary.length);
  assert.match(fallback.authoringError, /history are unavailable/);
  assert.doesNotMatch(JSON.stringify(fallback), /Private upstream detail/);
  fallback.live.domains.cards[0].name = "Changed response";
  assert.deepEqual(publication.active(), before);
  const normal = { revision: 18, draft: { hash: "saved" }, writable: true };
  assert.deepEqual(await readAuthoringStatus({ ...publication, status: async () => normal }), normal, "Recovery returns the actual provider projection");
  await assert.rejects(readAuthoringStatus({ status: async () => { throw new Error("Damaged local store"); } }), /Damaged local store/, "No source-baseline fallback can hide local active-store damage");
});

test("live workshop reads work during remote outage while draft, history, validation and publication retain their failures", async t => {
  const { publication, deployed, reads } = unavailableRepository(), app = express();
  app.use(express.json());
  app.use((req, _res, next) => { if (req.headers["x-test-operator"] === "yes") req.gauntletAdminAccount = { id: "approved-account" }; next(); });
  registerContentPublicationRoutes(app, publication);
  registerAdminWorkshopRoutes(app, { publication });
  registerAdminPlaytestRoutes(app, createAdminPlaytests({ publication, chooseAi: () => null,
    createGame(resolved, selection) {
      const faction = resolved.factions[selection.factionId || "rumin"];
      return pinGameContent(engine.createMatch({ seed: "offline-live-test", gameMode: "factions", startingPriority: 1,
        config: resolved.manifest.gameConfig, factions: { 1: faction, 2: faction } }).state, resolved);
    } }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}/api/admin`;
  const get = path => fetch(origin + path, { headers: { "x-test-operator": "yes" } });
  const post = (path, body) => fetch(origin + path, { method: "POST", headers: { "x-test-operator": "yes", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal((await fetch(origin + "/authoring")).status, 403);
  assert.equal((await fetch(origin + "/workshops")).status, 403);
  assert.equal(reads(), 0, "Authorization precedes even fallback reads");
  const contentHash = hash(deployed.snapshot);
  for (const path of ["", "/relationships", "/presentation"]) {
    const response = await get(`/workshops${path}?source=live&hash=${contentHash}`);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("cache-control"), /no-store/);
    const body = await response.json();
    assert.equal(body.source, "live"); assert.equal(body.hash, contentHash);
    if (path === "/presentation") assert.equal(body.resolved.releaseId, deployed.id);
  }
  assert.equal(reads(), 0, "Live capabilities never depend on remote draft availability");
  assert.equal((await get("/workshops/presentation?source=live&hash=old")).status, 409);
  const status = await get("/authoring");
  assert.equal(status.status, 200);
  assert.equal((await status.json()).liveOnly, true);
  for (const path of ["/workshops?source=draft", "/workshops/review", `/workshops/releases/${deployed.id}/review`]) {
    const response = await get(path);
    assert.equal(response.status, 503, path);
    assert.equal((await response.json()).readiness, undefined, "Remote release readiness is not fabricated");
  }
  for (const action of ["validate", "preview", "publish"]) {
    const response = await post("/authoring/" + action, { expectedRevision: null, label: "Never publish fallback" });
    assert.equal(response.status, 503, action);
  }
  const beforeLiveTest = reads();
  const startedResponse = await post("/authoring/playtest", { source: "live", expectedRevision: null });
  assert.equal(startedResponse.status, 200);
  const started = await startedResponse.json(), session = started.playtest;
  assert.equal(session.source, "live"); assert.equal(session.releaseId, deployed.id);
  assert.equal(session.contentHash, contentHash);
  assert.equal(started.authoring, undefined);
  const executedResponse = await post("/authoring/playtest/command", { id: session.id, gameRevision: session.game.revision,
    command: { type: "passPriority", player: session.game.priority } });
  assert.equal(executedResponse.status, 200);
  const executed = await executedResponse.json();
  assert.equal(executed.playtest.acceptedCommands, 1);
  assert.equal(executed.authoring, undefined);
  assert.equal(reads(), beforeLiveTest, "Live execution never reads remote draft state or records a publication receipt");
  assert.equal(publication.active().releaseId, deployed.id);
});
