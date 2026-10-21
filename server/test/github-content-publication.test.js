const test = require("node:test");
const assert = require("node:assert/strict");
const { createGitHubContentPublication, createGitHubClient, DRAFT_PATH, DRAFT_BRANCH, RELEASE_PATH, blobSha } = require("../githubContentPublication");
const { createAuthoredBaseline, clone, hash } = require("../authoredContent");
const old = require("./fixtures/content-v2/authored-baseline-v1.json");
const baseline = createAuthoredBaseline({ domains: { decks: old.domains.decks }, game: { modes: old.domains.game } });
const fail = (status) => { throw Object.assign(new Error("Simulated GitHub conflict"), { status }); };

function repository() {
  let sequence = 1;
  const commit = () => (++sequence).toString(16).padStart(40, "0");
  const original = "a".repeat(40), refs = new Map([["main", original]]), trees = new Map([[original, new Map()]]), pulls = [];
  const client = {
    ready: false, failed: false, unexpectedFile: false, writes: [],
    async readFile(ref, filename) { return clone(trees.get(refs.get(ref) || ref)?.get(filename) || null); },
    async putFile(branch, filename, value, sha, message) {
      const before = trees.get(refs.get(branch));
      if (!before || (before.get(filename)?.sha || null) !== (sha || null)) fail(409);
      const next = new Map(before), body = Buffer.from(JSON.stringify(value, null, 2) + "\n");
      next.set(filename, { value: clone(value), sha: blobSha(body) });
      const head = commit(); trees.set(head, next); refs.set(branch, head);
      for (const pr of pulls) if (pr.head.ref === branch) pr.head.sha = head;
      client.writes.push({ branch, filename, message });
      return { commit: { sha: head } };
    },
    async request(route, options = {}) {
      let match;
      if (route === "") return { private: client.private !== false };
      if ((match = route.match(/^git\/ref\/heads\/(.+)$/))) { const sha = refs.get(match[1]); if (!sha) { if (options.missing) return null; fail(404); } return { object: { sha } }; }
      if (route === "git/refs") { const branch = options.body.ref.replace("refs/heads/", ""); if (refs.has(branch)) fail(409); refs.set(branch, options.body.sha); return {}; }
      if (route.startsWith("compare/")) return { files: [{ filename: RELEASE_PATH, status: "modified" }, ...(client.unexpectedFile ? [{ filename: "server/index.js", status: "modified" }] : [])] };
      if (route.startsWith("pulls?")) return clone(pulls.filter(pr => route.includes(encodeURIComponent(`BurntRamen:${pr.head.ref}`))));
      if (route === "pulls") { const pr = { number: pulls.length + 1, head: { ref: options.body.head, sha: refs.get(options.body.head) }, base: { ref: "main" }, state: "open", merged: false }; pulls.push(pr); return clone(pr); }
      if ((match = route.match(/^pulls\/(\d+)\/merge$/))) { const pr = pulls[Number(match[1]) - 1]; assert.equal(options.body.sha, pr.head.sha); assert.equal(client.ready, true); pr.merged = true; pr.state = "closed"; refs.set("main", pr.head.sha); return { merged: true }; }
      if ((match = route.match(/^pulls\/(\d+)$/))) { const pr = pulls[Number(match[1]) - 1]; if (options.method === "PATCH") pr.state = options.body.state; return clone(pr); }
      if (route.includes("/check-runs")) return { check_runs: [{ name: "Validate Gauntlet content", status: client.ready || client.failed ? "completed" : "in_progress", conclusion: client.failed ? "failure" : client.ready ? "success" : null }] };
      if (route.endsWith("/status")) return { state: "success", statuses: [] };
      throw new Error(`Unexpected GitHub request: ${route}`);
    }
  };
  const store = (extra = {}) => createGitHubContentPublication({ baseline, token: "test-only-token", client, deployedCommit: original, releaseFile: "missing-test-release.json", ...extra });
  return { client, store, refs, trees, pulls };
}
test("private deck notes require a private repository and never enter a release package", async () => {
  const repo = repository(), store = repo.store();
  repo.client.private = false;
  await assert.rejects(store.saveNotes({ expectedRevision: 0, id: "standard", value: "PRIVATE-DECK-NOTE" }, "admin"), /private repository/);
  assert.equal(repo.client.writes.length, 0);
  repo.client.private = true;
  let state = await store.saveNotes({ expectedRevision: 0, id: "standard", value: "PRIVATE-DECK-NOTE" }, "admin");
  assert.equal((await repo.store().status()).privateNotes.standard.value, "PRIVATE-DECK-NOTE");
  state = await store.patch({ expectedRevision: state.revision, domain: "decks", id: "standard", field: "description", value: "Public recipe description" }, "admin");
  state = await store.preview({ expectedRevision: state.revision });
  await store.publish({ expectedRevision: state.revision, label: "Public description" }, "admin");
  const release = (await repo.client.readFile(repo.pulls[0].head.ref, RELEASE_PATH)).value;
  assert.ok(!JSON.stringify(release).includes("PRIVATE-DECK-NOTE"));
});

test("public or unverified GitHub storage cannot receive drafts or drive publication", async () => {
  for (const metadata of [{ private: false }, {}]) {
    const repo = repository(), request = repo.client.request;
    repo.client.request = (route, options) => route === "" ? Promise.resolve(metadata) : request(route, options);
    const store = repo.store(), state = await store.status();
    assert.equal(state.writable, false); assert.equal(state.privateStorageReady, false);
    assert.match(state.authoringError, /Case must configure private Supabase authoring storage/);
    assert.equal(state.publication.supported, false); assert.match(state.storage, /Live inspection and live playtests remain available/);
    assert.ok(store.active().manifest.cards.length);
    const before = clone(repo.refs.get("main"));
    for (const method of ["patch", "create", "discard", "preview", "saveNotes", "uploadAsset", "archiveAsset", "studioDraft", "competitionDraft", "paraDraft", "recordPlaytest", "publish", "rollback", "cancelPublication", "reconcile", "playtestContent"]) {
      await assert.rejects(store[method]({}, "admin"), error => error.status === 503 && /private repository/.test(error.message), method);
    }
    assert.equal(repo.refs.size, 1); assert.equal(repo.refs.get("main"), before);
    assert.equal(repo.client.writes.length, 0); assert.equal(repo.pulls.length, 0);
  }
});

test("repository privacy is rechecked before the draft write and branch creation", async () => {
  const repo = repository(), request = repo.client.request; let checks = 0;
  repo.client.request = (route, options) => route === "" ? Promise.resolve({ private: ++checks === 1 }) : request(route, options);
  await assert.rejects(repo.store().patch({ expectedRevision: 0, domain: "cards", id: baseline.domains.cards[0].id, field: "name", value: "Private working title" }, "admin"), /private repository/);
  assert.equal(checks, 2); assert.equal(repo.refs.size, 1); assert.equal(repo.client.writes.length, 0);
});

test("private image upload packaging survives deployment, rollback and interrupted reconciliation", async () => {
  const repo = repository(), store = repo.store(), sharp = require("sharp");
  const image = async background => (await sharp({ create: { width: 64, height: 64, channels: 3, background } }).png().toBuffer()).toString("base64");
  const input = { expectedRevision: 0, title: "Private artwork notes", description: "Do not expose", notes: "Private source", data: await image("red") };
  repo.client.private = false;
  await assert.rejects(store.uploadAsset(input, "admin"), /private repository/); assert.equal(repo.client.writes.length, 0);
  repo.client.private = true;
  let state = await store.uploadAsset(input, "admin"); const a = state.uploaded;
  assert.equal((await repo.store().status()).assetLibrary.at(-1).id, a.id);
  assert.throws(() => store.publicAsset(a.id, a.sha256), { status: 404 });
  state = await store.patch({ expectedRevision: state.revision, domain: "assets", id: "rumin-coin-scale-spear:standard", field: "art", value: a.id }, "admin");
  state = await store.preview({ expectedRevision: state.revision });
  const putFile = repo.client.putFile;
  let interrupted = true;
  repo.client.putFile = async (...args) => { if (args[1] === RELEASE_PATH && interrupted) { interrupted = false; throw new Error("interrupted package write"); } return putFile(...args); };
  await assert.rejects(store.publish({ expectedRevision: state.revision, label: "Image R1" }, "admin"), /interrupted/);
  assert.equal(repo.pulls.length, 0); assert.equal(store.active().manifest.cards.find(c => c.id === "rumin-coin-scale-spear").presentation.illustrationAssetId.startsWith("image-version-"), false);
  state = await store.reconcile(); assert.equal(state.pending.phase, "checks");
  repo.client.ready = true; await store.reconcile();
  const r1 = (await repo.client.readFile("main", RELEASE_PATH)).value;
  assert.equal(r1.assetPackage.versions[0].id, a.id); assert.ok(!JSON.stringify(r1).includes("Private source"));
  const first = repo.store({ deployedRelease: r1, deployedCommit: repo.refs.get("main") });
  assert.equal(first.publicAsset(a.id, a.sha256).body.length, a.bytes);
  state = await first.uploadAsset({ ...input, expectedRevision: (await first.status()).revision, assetId: a.assetId, data: await image("blue") }, "admin"); const b = state.uploaded;
  state = await first.patch({ expectedRevision: state.revision, domain: "assets", id: "rumin-coin-scale-spear:standard", field: "art", value: b.id }, "admin");
  state = await first.preview({ expectedRevision: state.revision }); await first.publish({ expectedRevision: state.revision, label: "Image R2" }, "admin");
  const r2 = (await repo.client.readFile("main", RELEASE_PATH)).value, second = repo.store({ deployedRelease: r2, deployedCommit: repo.refs.get("main") });
  assert.equal(second.publicAsset(a.id, a.sha256).body.length, a.bytes);
  assert.equal(second.publicAsset(b.id, b.sha256).body.length, b.bytes);
  await second.rollback({ expectedRevision: (await second.status()).revision, releaseId: r1.id }, "admin");
  const rollback = (await repo.client.readFile("main", RELEASE_PATH)).value;
  const rolled = repo.store({ deployedRelease: rollback, deployedCommit: repo.refs.get("main") });
  assert.equal(rolled.active().manifest.cards.find(c => c.id === "rumin-coin-scale-spear").presentation.illustrationAssetId, a.id);
  assert.equal(rolled.publicAsset(b.id, b.sha256).body.length, b.bytes);
  const corrupt = clone(rollback); delete corrupt.assetPackage.blobs[a.sha256];
  assert.throws(() => repo.store({ deployedRelease: corrupt }), /missing/);
});
async function draft(store, { mechanical = false } = {}) {
  let state = await store.status();
  state = await store.patch({ expectedRevision: state.revision, domain: "game", id: mechanical ? "shared-rules" : "practice", field: mechanical ? "handSize" : "name", value: mechanical ? 5 : "Published practice" }, "approved-account");
  return store.preview({ expectedRevision: state.revision });
}

async function staleSourceRepository() {
  const repo = repository(), previous = clone(baseline);
  previous.engine.compatibilityHash = "previous-source-contract";
  const store = repo.store({ baseline: previous });
  await store.saveNotes({ expectedRevision: 0, id: "standard", value: "Retained operator notes" }, "admin");
  return repo;
}

test("source deployment reconciles an unused authoring baseline without writes or lost history", async () => {
  const repo = await staleSourceRepository();
  const before = clone((await repo.client.readFile(DRAFT_BRANCH, DRAFT_PATH)).value);
  const writes = repo.client.writes.length, store = repo.store();
  const status = await store.status();
  assert.equal(status.activeReleaseId, store.active().releaseId);
  assert.equal(status.revision, before.revision + 1);
  assert.equal(status.privateNotes.standard.value, "Retained operator notes");
  assert.equal(repo.client.writes.length, writes, "Reading never migrates remote state");
  await store.patch({ expectedRevision: status.revision, domain: "game", id: "practice", field: "name", value: "New source draft" }, "admin");
  const saved = (await repo.client.readFile(DRAFT_BRANCH, DRAFT_PATH)).value;
  assert.deepEqual(saved.releases[before.activeReleaseId], before.releases[before.activeReleaseId]);
  assert.deepEqual(saved.activations.slice(0, -1), before.activations);
  assert.equal(saved.activations.at(-1).action, "reconcile-deployment");
  assert.equal(saved.activations.at(-1).sourceCommit, "a".repeat(40));
  assert.equal(saved.draft.baseReleaseId, store.active().releaseId);
  assert.equal((await repo.store().status()).revision, saved.revision);
  await assert.rejects(repo.store().patch({ expectedRevision: status.revision, domain: "game", id: "practice", field: "name", value: "Stale operator" }), { status: 409 });
});

test("private authoring baseline reconciliation persists only through its atomic private save", async () => {
  const repo = await staleSourceRepository();
  let state = (await repo.client.readFile(DRAFT_BRANCH, DRAFT_PATH)).value, version = 1;
  const original = clone(state), writes = repo.client.writes.length;
  const draftStore = { load: async () => ({ state: clone(state), version }), save: async (expected, next) => {
    assert.equal(expected, version); state = clone(next); version += 1;
  } };
  const store = repo.store({ draftStore }), status = await store.status();
  assert.deepEqual(state, original);
  await store.saveNotes({ expectedRevision: status.revision, id: "standard", value: "Updated private notes" }, "admin");
  assert.equal(state.activeReleaseId, store.active().releaseId);
  assert.deepEqual(state.releases[original.activeReleaseId], original.releases[original.activeReleaseId]);
  assert.equal(state.activations.at(-1).action, "reconcile-deployment");
  assert.equal(repo.client.writes.length, writes);
});

test("source reconciliation never replaces saved drafts, pending publication or operator releases", async () => {
  for (const kind of ["draft", "pending", "operator"]) {
    const repo = await staleSourceRepository();
    const state = repo.trees.get(repo.refs.get(DRAFT_BRANCH)).get(DRAFT_PATH).value;
    if (kind === "operator") state.releases[state.activeReleaseId].createdBy = "approved-account";
    else state[kind] = { preserved: true };
    const before = clone(state), writes = repo.client.writes.length;
    await assert.rejects(repo.store().status(), { status: 503 });
    assert.deepEqual(state, before); assert.equal(repo.client.writes.length, writes);
  }
});

test("baseline reconciliation still rejects corrupt history and invalid revisions", async () => {
  for (const kind of ["hash", "revision", "activations"]) {
    const repo = await staleSourceRepository();
    const state = repo.trees.get(repo.refs.get(DRAFT_BRANCH)).get(DRAFT_PATH).value;
    if (kind === "hash") state.releases[state.activeReleaseId].snapshot.domains.game[0].name = "Tampered history";
    if (kind === "revision") state.revision = -1;
    if (kind === "activations") state.activations = null;
    const writes = repo.client.writes.length;
    await assert.rejects(repo.store().status(), { status: 503 });
    assert.equal(repo.client.writes.length, writes);
  }
});

test("a packaged content release never silently reconciles divergent saved history", async () => {
  const repo = await staleSourceRepository(), sha256 = hash(baseline);
  const deployedRelease = { schemaVersion: "gauntlet.repository-release.v1", id: `gauntlet-content-${sha256}`, sha256, snapshot: baseline };
  const writes = repo.client.writes.length;
  await assert.rejects(repo.store({ deployedRelease }).status(), { status: 503 });
  assert.equal(repo.client.writes.length, writes);
});

test("Supabase-private drafts import GitHub history, keep unused uploads and notes private, and publish through the existing gates", async () => {
  const repo = repository();
  const originalStore = repo.store();
  const old = await draft(originalStore);
  // Model a legacy record already present when the repository is public.
  repo.client.private = false;
  assert.equal((await originalStore.status()).writable, false);
  let privateState = null, version = 0;
  const draftStore = { load: async () => privateState ? { state: clone(privateState), version } : null,
    save: async (expected, state) => { if (expected !== version) fail(409); privateState = clone(state); version += 1; } };
  const store = repo.store({ draftStore });
  assert.equal((await store.status()).draft.hash, old.draft.hash);
  assert.equal((await store.status()).writable, true);
  const writesBefore = repo.client.writes.length;
  let state = await store.saveNotes({ expectedRevision: old.revision, id: "standard", value: "PRIVATE-SUPABASE-NOTE" }, "admin");
  const data = (await require("sharp")({ create: { width: 32, height: 32, channels: 3, background: "red" } }).png().toBuffer()).toString("base64");
  state = await store.uploadAsset({ expectedRevision: state.revision, title: "PRIVATE-UPLOAD-TITLE", description: "PRIVATE-DESCRIPTION", notes: "PRIVATE-SOURCE", data }, "admin");
  const selected = state.uploaded;
  state = await store.uploadAsset({ expectedRevision: state.revision, title: "PRIVATE-UNUSED", description: "", notes: "", data }, "admin");
  const unused = state.uploaded;
  assert.equal(repo.client.writes.length, writesBefore, "No new draft or private bytes were written to the public repository");
  state = await store.patch({ expectedRevision: state.revision, domain: "assets", id: "rumin-coin-scale-spear:standard", field: "art", value: selected.id }, "admin");
  state = await store.preview({ expectedRevision: state.revision });
  state = await store.publish({ expectedRevision: state.revision, label: "Private staging release" }, "admin");
  assert.equal(state.pending.phase, "checks"); assert.equal(repo.pulls[0].merged, false);
  const release = (await repo.client.readFile(repo.pulls[0].head.ref, RELEASE_PATH)).value;
  assert.ok(!JSON.stringify(release).includes("PRIVATE-"));
  assert.equal(release.assetPackage.versions.some(row => row.id === unused.id), false);
  assert.equal(release.assetPackage.versions.some(row => row.id === selected.id), true);
  repo.client.ready = true; await store.reconcile();
  const deployed = repo.store({ draftStore, deployedRelease: release, deployedCommit: repo.refs.get("main") });
  const restored = await deployed.status();
  assert.equal(restored.privateNotes.standard.value, "PRIVATE-SUPABASE-NOTE");
  assert.equal(restored.pending, null);
  assert.equal(Buffer.from((await deployed.privateAsset(unused.id)).data, "base64").length, unused.bytes);
  assert.throws(() => deployed.publicAsset(unused.id, unused.sha256), { status: 404 });
  draftStore.load = async () => { throw Object.assign(new Error("Private database unavailable"), { status: 503 }); };
  const before = repo.client.writes.length;
  await assert.rejects(deployed.status(), { status: 503 });
  await assert.rejects(deployed.saveNotes({ expectedRevision: restored.revision, id: "standard", value: "No fallback" }), { status: 503 });
  assert.equal(repo.client.writes.length, before);
});

test("GitHub drafts are shared, conflict checked and never change deployed content", async () => {
  const repo = repository(), first = repo.store(), second = repo.store();
  const before = first.active();
  await draft(first);
  assert.equal((await second.status()).draft.snapshot.domains.game.find(x => x.id === "practice").name, "Published practice");
  await assert.rejects(second.patch({ expectedRevision: 0, domain: "game", id: "practice", field: "name", value: "Lost update" }), { status: 409 });
  assert.deepEqual(first.active(), before);
  assert.ok(repo.client.writes.every(write => write.branch === DRAFT_BRANCH && write.filename === DRAFT_PATH));
  const results = await Promise.allSettled([first.discard({ expectedRevision: 2 }), second.discard({ expectedRevision: 2 })]);
  assert.equal(results.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(results.find(x => x.status === "rejected").reason.status, 409);
});

test("mechanical publication requires exact playtest, CI, content-only PR and actual deployment", async () => {
  const repo = repository(), store = repo.store(), before = store.active();
  let state = await draft(store, { mechanical: true });
  await assert.rejects(store.publish({ expectedRevision: state.revision, label: "Untested" }, "admin"), { status: 409 });
  const playtest = await store.playtestContent(state.revision);
  state = await store.recordPlaytest(playtest.draftHash, "admin");
  const writes = repo.client.writes.length;
  await store.recordPlaytest(playtest.draftHash, "admin");
  assert.equal(repo.client.writes.length, writes, "Repeated commands do not create duplicate receipt commits");
  state = await store.publish({ expectedRevision: state.revision, label: "Five-card hand" }, "admin");
  assert.equal(state.pending.phase, "checks");
  assert.equal(repo.pulls[0].merged, false);
  assert.deepEqual(store.active(), before);
  await assert.rejects(store.patch({ expectedRevision: state.revision, domain: "game", id: "practice", field: "name", value: "Overlapping" }), { status: 409 });
  repo.client.unexpectedFile = true;
  await assert.rejects(store.reconcile(), { status: 409 });
  assert.equal(repo.pulls[0].merged, false);
  repo.client.unexpectedFile = false; repo.client.ready = true;
  state = await store.reconcile();
  assert.equal(state.pending.phase, "deploying");
  assert.deepEqual(store.active(), before, "Merged is not the same as deployed");
  const packaged = (await repo.client.readFile("main", RELEASE_PATH)).value;
  const deployed = repo.store({ deployedRelease: packaged, deployedCommit: repo.refs.get("main") });
  assert.equal(deployed.active().manifest.gameConfig.handSize, 5);
  state = await deployed.status(); assert.equal(state.pending, null); assert.equal(state.writable, true);
  state = await deployed.rollback({ expectedRevision: state.revision, releaseId: before.releaseId }, "admin");
  assert.equal(state.pending.phase, "deploying");
  assert.equal(deployed.active().manifest.gameConfig.handSize, 5, "Rollback also waits for deployment");
});

test("failed checks can be canceled without losing the reviewed draft", async () => {
  const repo = repository(), store = repo.store();
  let state = await draft(store); const savedDraft = clone(state.draft);
  repo.client.failed = true;
  state = await store.publish({ expectedRevision: state.revision, label: "Blocked release" }, "admin");
  assert.equal(state.pending.phase, "checks-failed"); assert.equal(repo.pulls[0].merged, false);
  // Simulate a restart after GitHub created the PR but before its number was saved.
  delete repo.trees.get(repo.refs.get(DRAFT_BRANCH)).get(DRAFT_PATH).value.pending.pullRequestNumber;
  state = await store.cancelPublication({ expectedRevision: state.revision });
  assert.equal(state.pending, null); assert.deepEqual(state.draft, savedDraft); assert.equal(repo.pulls[0].state, "closed");
});

test("missing credentials, corrupt history and mismatched deployed code fail closed", async () => {
  const repo = repository(), disconnected = repo.store({ token: "" });
  assert.equal((await disconnected.status()).connectionRequired, true);
  await assert.rejects(disconnected.patch({}), { status: 503 });
  const store = repo.store(); let state = await draft(store);
  const wrongCode = repo.store({ deployedCommit: "b".repeat(40) });
  await assert.rejects(wrongCode.publish({ expectedRevision: state.revision, label: "Wrong deployment" }, "admin"), { status: 409 });
  const file = repo.trees.get(repo.refs.get(DRAFT_BRANCH)).get(DRAFT_PATH);
  file.value.releases[file.value.activeReleaseId].snapshot.domains.game[0].name = "Tampered";
  await assert.rejects(store.status(), /integrity/);
  assert.equal(repo.pulls.length, 0);
});

test("GitHub transport sends credentials only to the fixed repository API and sanitizes failures", async () => {
  const calls = [];
  const client = createGitHubClient({ token: "private-test-token", fetchImpl: async (url, options) => { calls.push({ url, options }); return new Response("secret internal failure", { status: 403 }); } });
  await assert.rejects(client.readFile("main", RELEASE_PATH), error => error.status === 503 && !error.message.includes("secret"));
  assert.ok(calls[0].url.startsWith("https://api.github.com/repos/BurntRamen/gauntlet-online/"));
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(calls[0].options.headers.Authorization, "Bearer private-test-token");
});

test("existing server GitHub credentials are recognized without requiring a renamed secret", async (t) => {
  const keys = ["GAUNTLET_GITHUB_TOKEN", "GITHUB_TOKEN", "GH_TOKEN"];
  const previous = keys.map((key) => process.env[key]);
  t.after(() => keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; }));
  for (const selected of keys) {
    keys.forEach((key) => delete process.env[key]);
    process.env[selected] = "existing-server-test-credential";
    const repo = repository();
    const store = createGitHubContentPublication({ baseline, client: repo.client, releaseFile: "missing-test-release.json" });
    assert.equal((await store.status()).connectionRequired, false, selected);
    const state = await draft(store);
    assert.equal(state.draft.snapshot.domains.game.find((entry) => entry.id === "practice").name, "Published practice");
  }
});


test("authored set and new card survive shared GitHub drafts, deployment and reference-safe rollback", async () => {
  const repo = repository(), store = repo.store();
  let state = await store.create({ expectedRevision: 0, domain: "sets", name: "Test set" }, "admin");
  const set = state.draft.snapshot.domains.sets[0];
  state = await store.create({ expectedRevision: state.revision, domain: "cards", name: "New blade", setId: set.id, effectId: "coin-scale-spear" }, "admin");
  const card = state.draft.snapshot.domains.cards.at(-1), oldRelease = state.activeReleaseId;
  assert.equal(store.lookupCard(card.id), null);
  assert.equal((await repo.store().status()).draft.snapshot.domains.cards.at(-1).id, card.id);
  state = await store.preview({ expectedRevision: state.revision });
  state = await store.recordPlaytest(state.draft.hash, "admin");
  state = await store.publish({ expectedRevision: state.revision, label: "New definitions" }, "admin");
  assert.equal(state.pending.phase, "checks");
  repo.client.ready = true; state = await store.reconcile();
  assert.equal(state.pending.phase, "deploying");
  assert.equal(store.lookupCard(card.id), null);
  const deployedRelease = (await repo.client.readFile(repo.refs.get("main"), RELEASE_PATH)).value;
  const deployed = repo.store({ deployedCommit: repo.refs.get("main"), deployedRelease });
  assert.equal(deployed.lookupCard(card.id).effect.parameters.armBonus, 2);
  const lookup = deployed.lookupCard(card.id); lookup.effect.parameters.armBonus = 999;
  assert.equal(deployed.lookupCard(card.id).effect.parameters.armBonus, 2);
  state = await deployed.status();
  await assert.rejects(deployed.rollback({ expectedRevision: state.revision, releaseId: oldRelease }, "admin"), /published identity/);
});


test("structured definitions survive GitHub packaging with version bindings and reject malformed saves", async () => {
  const repo = repository(), store = repo.store(), composition = require("../../shared/duel-rules/compositionContract");
  let state = await store.create({ expectedRevision: 0, domain: "sets", name: "Composition set" }, "admin");
  state = await store.create({ expectedRevision: state.revision, domain: "cards", name: "Composed blade", setId: state.draft.snapshot.domains.sets[0].id, effectId: "coin-scale-spear" }, "admin");
  const card = state.draft.snapshot.domains.cards.at(-1), effect = composition.create();
  effect.abilities[0].condition = { kind: "overpay", amount: 2 };
  effect.abilities[0].effects.push({ kind: "gainLife", amount: 1, ...composition.operations.gainLife });
  const payload = { domain: "cards", id: card.id, field: "effect", value: effect };
  const bad = clone(effect); bad.version = 2;
  await assert.rejects(store.patch({ ...payload, value: bad, expectedRevision: state.revision }, "admin"), { status: 422 });
  assert.equal((await store.status()).revision, state.revision);
  state = await store.patch({ ...payload, expectedRevision: state.revision }, "admin");
  assert.deepEqual((await repo.store().status()).draft.snapshot.domains.cards.at(-1).effect, effect);
  state = await store.preview({ expectedRevision: state.revision });
  state = await store.recordPlaytest(state.draft.hash, "admin");
  state = await store.publish({ expectedRevision: state.revision, label: "Composed definitions" }, "admin");
  repo.client.ready = true; state = await store.reconcile();
  assert.equal(state.pending.phase, "deploying"); assert.equal(store.lookupCard(card.id), null);
  const deployedRelease = (await repo.client.readFile(repo.refs.get("main"), RELEASE_PATH)).value;
  const deployed = repo.store({ deployedCommit: repo.refs.get("main"), deployedRelease });
  assert.deepEqual(deployed.lookupCard(card.id).effect, effect);
  assert.equal(deployed.active().manifest.contentBinding.compositionVersion, composition.VERSION);
});

test("Para definitions use GitHub drafts and become runtime-active only after the exact release deploys", async () => {
  const repo = repository(), store = repo.store({ runtimeCapabilities: () => ({ enabled: true }), economyCapabilities: () => ({ enabled: true }) });
  let state = await store.create({ expectedRevision: 0, domain: "sets", name: "Mixed release set" }, "approved-account");
  state = await store.paraDraft({ expectedRevision: state.revision, operation: "seed" }, "approved-account");
  assert.equal(state.validation.valid, true);
  state = await store.create({ expectedRevision: state.revision, domain: "decks", name: "Mixed release recipe", factionId: "rumin" }, "approved-account");
  assert.equal(state.provider, "github"); assert.equal(state.publication.provider, "github");
  assert.equal(state.para.capabilities.currencyOperations, true);
  assert.equal(store.published().snapshot.paraLeague, undefined);
  state = await store.preview({ expectedRevision: state.revision });
  assert.equal(state.validation.valid, true);
  state = await store.recordPlaytest(state.draft.hash, "approved-account");
  state = await store.publish({ expectedRevision: state.revision, label: "Inactive Para and Gold definitions" }, "approved-account");
  assert.equal(state.pending.phase, "checks");
  repo.client.ready = true; state = await store.reconcile();
  assert.equal(state.pending.phase, "deploying");
  assert.equal(store.published().snapshot.paraLeague, undefined);
  const packaged = (await repo.client.readFile("main", RELEASE_PATH)).value;
  const deployed = repo.store({ deployedRelease: packaged, deployedCommit: repo.refs.get("main") });
  assert.equal(deployed.published().id, packaged.id);
  assert.equal(deployed.published().snapshot.paraLeague.seasons[0].status, "draft");
  assert.equal(deployed.published().snapshot.domains.decks.at(-1).name, "Mixed release recipe");
  assert.ok(deployed.published().snapshot.paraLeague.products.every(p => p.status !== "active"));
});
