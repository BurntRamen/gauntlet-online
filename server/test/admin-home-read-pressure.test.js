const test = require("node:test"), assert = require("node:assert/strict");
const { createAdminData } = require("../adminData");

test("Home shares one fresh authoring revision across its panels and retries failed reads", async () => {
  let reads = 0, unavailable = false;
  const data = createAdminData({
    useSupabase: () => true, request: async () => [], matchFile: "missing-home-test-matches.json",
    persistence: { getMode: async () => "local", status: () => ({ mode: "local" }) },
    archive: { probe: async () => true, status: () => ({ available: true, durable: true }) },
    runtime: { season: () => ({ seasonId: "ranked" }), encounter: () => ({ bossAbility: "none", deckPlan: {} }) },
    adminAccountCount: 2,
    publication: {
      active: () => undefined,
      status: () => { throw new Error("Home must not request editor metadata"); },
      summary: async () => {
        const revision = ++reads;
        await new Promise(resolve => setImmediate(resolve));
        if (unavailable) throw new Error("private-provider-detail");
        return { revision, activeReleaseId: `release-${revision}`, writable: true, validation: { valid: true },
          live: { schemaVersion: "test", domains: { game: [], offers: [] } }, draft: null, changes: [] };
      }
    }
  });
  const first = await data.home();
  assert.equal(reads, 1, "Home must not rebuild the full authoring projection for modules and health");
  assert.equal(first.publication.activeReleaseId, "release-1");
  assert.equal(first.storage.content.status, "read succeeded");
  assert.equal(first.storage.content.writable, true);
  assert.equal(first.tasks.some(task => task.title === "A data source could not be read"), false);

  unavailable = true;
  const failed = await data.home();
  assert.equal(reads, 2);
  assert.equal(failed.publication, null);
  assert.equal(failed.storage, null);
  assert.ok(failed.tasks.some(task => /Shared authoring is unavailable/.test(task.message)));
  assert.ok(failed.tasks.some(task => /System health is unavailable/.test(task.message)));
  assert.equal(JSON.stringify(failed).includes("private-provider-detail"), false);

  unavailable = false;
  assert.equal((await data.home()).publication.activeReleaseId, "release-3", "a new request must not retain an old or failed snapshot");
  await data.catalog();
  await data.modules();
  await data.system();
  assert.equal(reads, 6, "standalone endpoints retain their own fresh reads");
});

test("compact publication reads preserve authoritative draft, validation and privacy gates", async () => {
  const { createAuthoredBaseline, clone } = require("../authoredContent");
  const { createContentPublication } = require("../contentPublication");
  const { createGitHubContentPublication } = require("../githubContentPublication");
  const baseline = createAuthoredBaseline({ domains: { decks: [] }, game: { modes: [] } });
  const local = createContentPublication({ baseline, memory: true });
  local.patch({ expectedRevision: 0, domain: "cards", id: baseline.domains.cards[0].id, field: "name", value: "Summary fixture" }, "test");
  const check = async store => {
    const full = await store.status(), compact = await store.summary();
    assert.deepEqual(compact, Object.fromEntries(Object.keys(compact).map(key => [key, full[key]])));
    assert.equal(compact.validation.source, "draft");
    assert.equal(compact.validation.revision, compact.revision);
    assert.equal(compact.validation.hash, compact.draft.hash);
    assert.equal(compact.changes.length, 1);
    assert.equal(Object.hasOwn(compact, "fields"), false);
    assert.equal(Object.hasOwn(compact, "assetLibrary"), false);
    assert.ok(JSON.stringify(compact).length < JSON.stringify(full).length / 2);
    compact.live.domains.cards[0].name = "Caller mutation";
    assert.equal((await store.summary()).live.domains.cards[0].name, full.live.domains.cards[0].name);
  };
  await check(local);
  const draftStore = { load: async () => ({ version: 1, state: clone(local.exportState()) }) };
  const github = createGitHubContentPublication({ baseline, draftStore, token: "", releaseFile: "missing-summary-test-release.json" });
  await check(github);
  assert.equal((await github.summary()).writable, false, "a compact read must not grant missing repository credentials");
  draftStore.load = async () => { throw Object.assign(new Error("Private store unavailable"), { status: 503 }); };
  await assert.rejects(github.summary(), { status: 503 }, "failed private reads cannot fall back to a successful source view");
});
