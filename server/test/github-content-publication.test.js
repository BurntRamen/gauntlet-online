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
async function draft(store, { mechanical = false } = {}) {
  let state = await store.status();
  state = await store.patch({ expectedRevision: state.revision, domain: "game", id: mechanical ? "shared-rules" : "practice", field: mechanical ? "handSize" : "name", value: mechanical ? 5 : "Published practice" }, "approved-account");
  return store.preview({ expectedRevision: state.revision });
}

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
