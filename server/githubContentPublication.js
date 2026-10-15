"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createContentPublication } = require("./contentPublication");
const { clone, hash, validateAuthoredContent, resolveEngineContent } = require("./authoredContent");
const imageAssets = require("./authoredAssets");
const REPOSITORY = "BurntRamen/gauntlet-online";
const DRAFT_BRANCH = "codex/gauntlet-admin-draft";
const DRAFT_PATH = "content/gauntlet-draft.json";
// Keep releases inside Render's server root so a content-only merge triggers
// deployment even when the service filters changes to that directory.
const RELEASE_PATH = "server/content/gauntlet-release.json";
const RELEASE_SCHEMA = "gauntlet.repository-release.v1";
const MAX_BYTES = 16 * 1024 * 1024;
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
const encode = (value) => encodeURIComponent(value);
const bytes = (value) => Buffer.from(JSON.stringify(value, null, 2) + "\n");
const blobSha = (body) => crypto.createHash("sha1").update(`blob ${body.length}\0`).update(body).digest("hex");

function createGitHubClient({ token, fetchImpl = fetch }) {
  async function request(route, { method = "GET", body, raw = false, missing = false } = {}) {
    if (!token) fail(503, "GitHub authoring is not connected. Configure the server's repository-scoped GitHub credential.");
    const response = await fetchImpl(`https://api.github.com/repos/${REPOSITORY}/${route}`, {
      method, redirect: "error", signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${token}`, Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Gauntlet-Admin", ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (missing && response.status === 404) return null;
    if (!response.ok) {
      if ([409, 422].includes(response.status)) fail(409, "The GitHub revision changed or the operation conflicts. Refresh before retrying.");
      if ([401, 403].includes(response.status)) fail(503, "GitHub access was denied or rate-limited. Check the repository credential and retry later.");
      if (response.status === 405) fail(409, "GitHub has not allowed this pull request to merge. Required checks or repository protection are still pending.");
      fail(503, "GitHub did not confirm the operation. Refresh to inspect its state before retrying.");
    }
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_BYTES * 2) fail(503, "GitHub content exceeds the supported size.");
    return raw ? text : text ? JSON.parse(text) : null;
  }
  async function readFile(ref, filename) {
    const text = await request(`contents/${filename}?ref=${encode(ref)}`, { raw: true, missing: true });
    if (text === null) return null;
    if (Buffer.byteLength(text) > MAX_BYTES) fail(503, "The retained content package exceeds 16 MiB. Storage expansion is required; no history was removed.");
    return { value: JSON.parse(text), sha: blobSha(Buffer.from(text)) };
  }
  async function putFile(branch, filename, value, previousSha, message) {
    const content = bytes(value);
    if (content.length > MAX_BYTES) fail(422, "The retained content package exceeds 16 MiB. Storage expansion is required; no history was removed.");
    return request(`contents/${filename}`, { method: "PUT", body: { branch, message, content: content.toString("base64"), ...(previousSha ? { sha: previousSha } : {}) } });
  }
  return { request, readFile, putFile };
}

function createGitHubContentPublication({ baseline, draftStore = null, runtimeCapabilities = () => ({ enabled: false }), economyCapabilities = () => ({ enabled: false }), token = process.env.GAUNTLET_GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "", client = createGitHubClient({ token }), deployedCommit = process.env.RENDER_GIT_COMMIT || "", releaseFile = path.join(__dirname, "../", RELEASE_PATH), deployedRelease }) {
  const seed = createContentPublication({ baseline, runtimeCapabilities, economyCapabilities, memory: true });
  const initial = seed.exportState();
  const packaged = deployedRelease || (fs.existsSync(releaseFile) ? JSON.parse(fs.readFileSync(releaseFile, "utf8")) : null);
  if (packaged) {
    if (packaged.schemaVersion !== RELEASE_SCHEMA || packaged.id !== `gauntlet-content-${hash(packaged.snapshot)}` || packaged.sha256 !== hash(packaged.snapshot) || !validateAuthoredContent(packaged.snapshot, baseline).valid) throw new Error("The packaged GitHub content release is incompatible or corrupt.");
    imageAssets.validatePackage(packaged.assetPackage, packaged.snapshot);
    initial.assetBlobs = clone(packaged.assetPackage?.blobs || {});
    const { schemaVersion, assetPackage, ...release } = packaged;
    initial.releases[release.id] = release; initial.activeReleaseId = release.id;
  }
  const deployed = initial.releases[initial.activeReleaseId];
  const deployedContent = resolveEngineContent(deployed.snapshot, deployed.id);
  const active = () => resolveEngineContent(deployed.snapshot, deployed.id);
  const cardIndex = new Map(deployedContent.manifest.cards.map(card => [card.id, card]));
  const variantIndex = new Map(deployedContent.manifest.collectorVariants.map(variant => [variant.variantId, variant]));
  const core = (state) => createContentPublication({ baseline, runtimeCapabilities, economyCapabilities, memory: true, initialState: state });
  async function mainHead() { return (await client.request("git/ref/heads/main")).object.sha; }
  async function load() {
    const privateDraft = draftStore ? await draftStore.load() : null;
    if (!token && !privateDraft) return { state: clone(initial), sha: null, privateVersion: 0 };
    // A first private save imports the existing GitHub draft without deleting
    // it. Once created, the private store is authoritative: never fall back on
    // database failure or write new private material to the old draft branch.
    const branch = privateDraft ? null : await client.request(`git/ref/heads/${DRAFT_BRANCH}`, { missing: true });
    const file = branch ? await client.readFile(branch.object.sha, DRAFT_PATH) : null;
    const state = privateDraft ? clone(privateDraft.state) : file ? file.value : clone(initial);
    core(state); // Validate release hashes, compatibility and the active pointer.
    if (state.pending?.releaseId === deployed.id) delete state.pending;
    if (!state.pending && state.activeReleaseId !== deployed.id) fail(409, "The saved draft belongs to another deployed release. Wait for deployment or reconcile its GitHub history.");
    return { state, sha: file?.sha || null, branchExists: !!branch, privateVersion: privateDraft?.version || 0 };
  }
  function project(state) {
    const view = core(state).status();
    return { ...view, writable: !!token && !state.pending, provider: "github", draftStorage: draftStore ? "supabase-private" : "github",
      storage: draftStore ? "Private drafts, uploads and notes in Supabase. Published releases use GitHub checks and deployment." : "Shared drafts and release history in GitHub. Publishing merges a content pull request, then waits for deployment.",
      publication: { provider: "github", supported: true, activeReleaseId: deployed.id, github: "installed", deployment: state.pending ? state.pending.phase : "active-on-this-server", message: "Shared GitHub drafts publish through reviewed pull requests and deployment. The running release remains active until deployment completes." },
      activeReleaseId: deployed.id, live: clone(deployed.snapshot), pending: clone(state.pending || null),
      connectionRequired: !token, repositoryUrl: `https://github.com/${REPOSITORY}` };
  }
  async function save(loaded, state, message) {
    if (draftStore) return draftStore.save(loaded.privateVersion, state);
    if (!loaded.branchExists) {
      try { await client.request("git/refs", { method: "POST", body: { ref: `refs/heads/${DRAFT_BRANCH}`, sha: await mainHead() } }); }
      catch (error) { if (error.status !== 409) throw error; }
    }
    await client.putFile(DRAFT_BRANCH, DRAFT_PATH, state, loaded.sha, message);
  }
  async function operate(method, args, actorId) {
    if (!token) fail(503, "Connect the server's repository-scoped GitHub credential before saving Admin changes.");
    if (!draftStore && method === "uploadAsset" && (await client.request(""))?.private !== true) fail(503, "Private image uploads require a private repository or an approved private storage adapter. No image was saved to GitHub.");
    if (!draftStore && method === "saveNotes" && (await client.request(""))?.private !== true) fail(503, "Private notes require a verified private repository. No notes were saved.");
    const loaded = await load();
    if (loaded.state.pending) fail(409, "A publication is in progress. Finish its checks and deployment before editing another draft.");
    const store = core(loaded.state);
    if (method === "recordPlaytest" && store.status().draft?.playtestedHash === args && hash(store.status().draft.snapshot) === args) return project(loaded.state);
    const result = await store[method](args, actorId);
    const state = store.exportState();
    await save(loaded, state, `Gauntlet Admin: ${method}${actorId ? ` by ${actorId}` : ""}`);
    return { ...project(state), ...(result.preview ? { preview: result.preview } : {}), ...(result.uploaded ? { uploaded: result.uploaded } : {}) };
  }
  async function playtestContent(revision) { const loaded = await load(); if (loaded.state.pending) fail(409, "Finish the current publication before starting another playtest."); return core(loaded.state).playtestContent(revision); }
  async function recordPlaytest(draftHash, actorId) { return operate("recordPlaytest", draftHash, actorId); }

  async function publish(args, actorId, method = "publish") {
    if (!token) fail(503, "Connect the server's repository-scoped GitHub credential before publishing.");
    const loaded = await load();
    if (loaded.state.pending) return reconcile();
    const main = await mainHead();
    if (deployedCommit && main !== deployedCommit) fail(409, "Production is not running the current main commit. Wait for that deployment before publishing content.");
    const store = core(loaded.state); store[method](args, actorId);
    const state = store.exportState();
    state.pending = { releaseId: state.activeReleaseId, branch: `codex/gauntlet-content-${state.activeReleaseId.slice(-16)}-${state.revision}`, baseCommit: main, phase: "preparing", requestedBy: actorId, operation: method, draftBefore: clone(loaded.state.draft) };
    await save(loaded, state, `Gauntlet Admin: prepare ${method}`);
    return reconcile();
  }
  async function cancelPublication({ expectedRevision }) {
    const loaded = await load(), state = loaded.state, pending = state.pending;
    if (expectedRevision !== state.revision) fail(409, "Publication changed. Refresh before canceling.");
    if (!pending) return project(state);
    // Recover a PR created before an interrupted draft-state write as well.
    const candidates = pending.pullRequestNumber ? [] : await client.request(`pulls?state=all&head=${encode(`BurntRamen:${pending.branch}`)}&base=main`);
    const number = pending.pullRequestNumber || candidates.find((item) => item.head.ref === pending.branch && item.base.ref === "main")?.number;
    if (number) {
      const pr = await client.request(`pulls/${number}`);
      if (pr.merged) fail(409, "This release has already merged. Wait for deployment, then use rollback.");
      if (pr.head.ref !== pending.branch || pr.base.ref !== "main") fail(409, "Unexpected publication pull request.");
      if (pr.state !== "closed") await client.request(`pulls/${pr.number}`, { method: "PATCH", body: { state: "closed" } });
    }
    state.activeReleaseId = deployed.id; state.draft = pending.draftBefore || null; delete state.pending; state.revision += 1;
    await save(loaded, state, "Gauntlet Admin: cancel publication and preserve draft");
    return project(state);
  }
  async function reconcile() {
    const loaded = await load(), state = loaded.state, pending = state.pending;
    if (!pending) return project(state);
    const beforePending = hash(pending);
    const release = state.releases[pending.releaseId];
    if (!release || !/^codex\/gauntlet-content-[a-f0-9]{16}-\d+$/.test(pending.branch) || !/^[a-f0-9]{40}$/.test(pending.baseCommit)) fail(503, "Invalid GitHub publication record.");
    const pack = imageAssets.packageAssets(state, release.snapshot);
    const payload = { schemaVersion: RELEASE_SCHEMA, ...clone(release), ...(pack.versions.length ? { assetPackage: pack } : {}) };
    let branch = await client.request(`git/ref/heads/${pending.branch}`, { missing: true });
    if (!branch) {
      try { await client.request("git/refs", { method: "POST", body: { ref: `refs/heads/${pending.branch}`, sha: pending.baseCommit } }); }
      catch (error) { if (error.status !== 409) throw error; }
      branch = await client.request(`git/ref/heads/${pending.branch}`);
    }
    let selected = await client.readFile(branch.object.sha, RELEASE_PATH);
    if (branch.object.sha === pending.baseCommit) {
      const saved = await client.putFile(pending.branch, RELEASE_PATH, payload, selected?.sha, `Publish Gauntlet content: ${release.label}`);
      branch = { object: { sha: saved.commit.sha } }; selected = { value: payload };
    }
    if (!selected || hash(selected.value) !== hash(payload)) fail(409, "The publication branch changed outside Admin. Review it in GitHub; nothing was merged.");
    const comparison = await client.request(`compare/${pending.baseCommit}...${branch.object.sha}`);
    if (comparison.files?.length !== 1 || comparison.files[0].filename !== RELEASE_PATH || comparison.files[0].status === "removed") fail(409, "A content publication may change only its release file. Review unexpected branch changes in GitHub.");
    const pulls = await client.request(`pulls?state=all&head=${encode(`BurntRamen:${pending.branch}`)}&base=main`);
    let pr = pulls.find((item) => item.head.ref === pending.branch && item.base.ref === "main");
    if (!pr) pr = await client.request("pulls", { method: "POST", body: { title: `Gauntlet content: ${release.label}`, head: pending.branch, base: "main", body: `Publish validated Gauntlet content ${release.id}.\n\nThe exact draft passed server validation, saved preview, and any required real-engine playtest. The release file includes exact image versions and verified bytes for current and retained releases. Requested by approved account ${pending.requestedBy}.` } });
    pr = await client.request(`pulls/${pr.number}`);
    if (pr.head.sha !== branch.object.sha || pr.base.ref !== "main") fail(409, "The pull request head changed. Refresh and review it before publishing.");
    pending.pullRequestNumber = pr.number; pending.url = `https://github.com/${REPOSITORY}/pull/${pr.number}`; pending.headCommit = pr.head.sha;
    if (pr.merged) pending.phase = "deploying";
    else if (pr.state === "closed") pending.phase = "closed";
    else {
      const checks = await client.request(`commits/${pr.head.sha}/check-runs?per_page=100`);
      const status = await client.request(`commits/${pr.head.sha}/status`);
      const runs = checks.check_runs || [];
      // A named repository check must pass; an empty check set is not approval.
      const validation = runs.find((check) => check.name === "Validate Gauntlet content");
      const failed = runs.some((check) => check.status === "completed" && !["success", "neutral", "skipped"].includes(check.conclusion)) || ["error", "failure"].includes(status.state);
      const waiting = (checks.total_count > runs.length) || !validation || validation.conclusion !== "success" || runs.some((check) => check.status !== "completed") || (status.statuses?.length && status.state === "pending");
      if (failed) pending.phase = "checks-failed";
      else if (waiting) pending.phase = "checks";
      else {
        try { const merged = await client.request(`pulls/${pr.number}/merge`, { method: "PUT", body: { sha: pr.head.sha, merge_method: "merge" } }); pending.phase = merged.merged ? "deploying" : "merge-blocked"; }
        catch (error) { if (error.status !== 409) throw error; pending.phase = "merge-blocked"; }
      }
    }
    if (hash(pending) !== beforePending) { state.revision += 1; await save(loaded, state, `Gauntlet Admin: publication ${pending.phase}`); }
    return project(state);
  }
  return { active, published: () => clone(deployed),
    saveNotes: (args, actor) => operate("saveNotes", args, actor),
    uploadAsset: (args, actor) => operate("uploadAsset", args, actor), archiveAsset: args => operate("archiveAsset", args),
    privateAsset: async id => core((await load()).state).privateAsset(id),
    publicAsset: (id, digest) => {
      const row = packaged?.assetPackage?.versions.find(row => row.id === id && row.sha256 === digest);
      if (!row) fail(404, "Published image version not found.");
      return { mediaType: row.mediaType, sha256: row.sha256, body: imageAssets.verifiedBytes(row, packaged.assetPackage.blobs) };
    },
    status: async () => project((await load()).state),
    lookupCard: id => clone(cardIndex.get(id) || null), lookupVariant: id => clone(variantIndex.get(id) || null),
    lookupSet: id => clone(deployedContent.manifest.draftSets.find(set => set.id === id) || null),
    paraDraft: (args, actor) => operate("paraDraft", args, actor),
    paraSimulation: async args => core((await load()).state).paraSimulation(args),
    deployedSnapshot: () => ({ id: deployed.id, snapshot: clone(deployed.snapshot) }),
    releaseSnapshot: async id => core((await load()).state).releaseSnapshot(id),
    create: (args, actor) => operate("create", args, actor), patch: (args, actor) => operate("patch", args, actor), discard: (args) => operate("discard", args), preview: (args) => operate("preview", args),
    publish, rollback: (args, actor) => publish(args, actor, "rollback"), playtestContent, recordPlaytest, reconcile, cancelPublication };
}
module.exports = { createGitHubContentPublication, createGitHubClient, REPOSITORY, DRAFT_BRANCH, DRAFT_PATH, RELEASE_PATH, RELEASE_SCHEMA, blobSha };
