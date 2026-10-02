"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { migrateV1 } = require("./contentMigration");
const { clone, hash, fieldsFor, validateAuthoredContent, resolveEngineContent } = require("./authoredContent");
const STORE_SCHEMA = "gauntlet.content-store.v1";
const releaseId = (snapshot) => `gauntlet-content-${hash(snapshot)}`;
function fail(status, message) { const error = new Error(message); error.status = status; throw error; }

// One atomic state file is the transaction boundary: snapshot insertion, pointer
// activation and draft removal either all commit, or none do. A separate exclusive
// lock and revision checks prevent lost updates across operators/processes.
function createContentPublication({ baseline, directory = ".", writable = true, memory = false, initialState = null }) {
  const filename = path.join(directory, "content-state.json");
  const lockfile = path.join(directory, "content-state.lock");
  const initialId = releaseId(baseline);
  const initialRelease = { id: initialId, sha256: hash(baseline), label: "Deployed source baseline", createdAt: new Date().toISOString(), createdBy: null, snapshot: clone(baseline) };
  const initial = { schemaVersion: STORE_SCHEMA, revision: 0, activeReleaseId: initialId, releases: { [initialId]: initialRelease }, draft: null, activations: [] };
  let memoryState = initialState ? clone(initialState) : clone(initial);
  let persisted = !memory && fs.existsSync(filename);
  const baselineValidation = validateAuthoredContent(baseline, baseline);
  if (!baselineValidation.valid) throw new Error(`Invalid authored baseline: ${JSON.stringify(baselineValidation.errors)}`);

  function compatible(release) { return release.snapshot?.engine?.compatibilityHash === baseline.engine.compatibilityHash && validateAuthoredContent(release.snapshot, baseline).valid; }
  function read(skipMigration = false) {
    if (!memory && !fs.existsSync(filename)) {
      if (persisted) fail(503, "Content store disappeared. Restore its durable state before serving content.");
      return clone(initial);
    }
    if (!memory) persisted = true;
    const state = memory ? clone(memoryState) : JSON.parse(fs.readFileSync(filename, "utf8"));
    if (state.schemaVersion !== STORE_SCHEMA || !Number.isSafeInteger(state.revision) || state.revision < 0 || !state.releases || !Array.isArray(state.activations)) fail(503, "Unsupported content store.");
    for (const [id, release] of Object.entries(state.releases)) {
      if (id !== release.id || release.sha256 !== hash(release.snapshot) || id !== releaseId(release.snapshot)) fail(503, "Published content integrity check failed.");
    }
    if (state.releases[state.activeReleaseId]?.snapshot?.schemaVersion === "gauntlet.authored-content.v1") {
      if (skipMigration) return state;
      if (!writable) fail(503, "The v1 content store requires writable persistent storage for its v2 migration.");
      let lock;
      try { lock = fs.openSync(lockfile, "wx", 0o600); }
      catch (error) { if (error.code === "EEXIST") fail(409, "Content migration is locked by another operation. Retry after it finishes."); throw error; }
      try {
        const current = read(true);
        if (current.releases[current.activeReleaseId].snapshot.schemaVersion === "gauntlet.authored-content.v1") {
          const migratedIds = new Map();
          for (const release of Object.values(current.releases)) {
            if (release.snapshot.schemaVersion !== "gauntlet.authored-content.v1") continue;
            let snapshot;
            try {
              snapshot = migrateV1(release.snapshot, baseline);
              if (!validateAuthoredContent(snapshot, baseline).valid) throw new Error("Unsupported legacy references.");
            } catch (error) {
              // Retain older incompatible releases as immutable evidence. Only
              // the active release and draft base must be migratable at boot.
              if (release.id === current.activeReleaseId || release.id === current.draft?.baseReleaseId) fail(503, "Active legacy release cannot migrate: its engine contract or asset references are unsupported.");
              continue;
            }
            const id = releaseId(snapshot);
            if (!current.releases[id]) current.releases[id] = { ...release, id, sha256: hash(snapshot), snapshot, migratedFrom: release.id, label: `${release.label} (v2 migration)` };
            migratedIds.set(release.id, id);
          }
          const from = current.activeReleaseId;
          current.activeReleaseId = migratedIds.get(from);
          if (current.draft) current.draft = { ...current.draft, snapshot: migrateV1(current.draft.snapshot, baseline), baseReleaseId: migratedIds.get(current.draft.baseReleaseId), previewedHash: null, playtestedHash: null };
          current.activations.push({ action: "migrate-v2", from, to: current.activeReleaseId, at: new Date().toISOString(), by: null });
          current.revision += 1;
          write(current);
        }
        return current;
      } finally { fs.closeSync(lock); fs.unlinkSync(lockfile); }
    }
    if (!state.releases[state.activeReleaseId] || !compatible(state.releases[state.activeReleaseId])) fail(503, "Active content is incompatible with this engine deployment.");
    return state;
  }
  // Detect incompatible or damaged active content at boot, rather than silently
  // falling back to a different release underneath running games.
  read();

  function write(state) {
    if (memory) { memoryState = clone(state); return; }
    const temporary = path.join(directory, `content-state.${crypto.randomUUID()}.tmp`);
    let descriptor;
    try {
      descriptor = fs.openSync(temporary, "wx", 0o600);
      fs.writeFileSync(descriptor, JSON.stringify(state));
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor); descriptor = undefined;
      fs.renameSync(temporary, filename);
      persisted = true;
      if (process.platform !== "win32") {
        const dir = fs.openSync(directory, "r");
        try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
      }
    } finally {
      if (descriptor !== undefined) fs.closeSync(descriptor);
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
  function transaction(expectedRevision, operate) {
    if (!writable) fail(503, "Publishing requires GAUNTLET_CONTENT_DATA_DIR on a persistent server volume. Configure it before authoring in production.");
    if (memory) {
      const state = read();
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== state.revision) fail(409, "Content changed in another session. Refresh before saving.");
      operate(state); state.revision += 1; write(state); return project(state);
    }
    fs.mkdirSync(directory, { recursive: true });
    let lock;
    try { lock = fs.openSync(lockfile, "wx", 0o600); }
    catch (error) { if (error.code === "EEXIST") fail(409, "Another content operation holds the storage lock. Refresh and retry; a crash lock requires operator recovery."); throw error; }
    try {
      const state = read();
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== state.revision) fail(409, "Content changed in another session. Refresh before saving; your local edits have not been applied.");
      operate(state);
      state.revision += 1;
      write(state);
      return project(state);
    } finally { fs.closeSync(lock); fs.unlinkSync(lockfile); }
  }
  function changes(state) {
    if (!state.draft) return [];
    const live = state.releases[state.activeReleaseId].snapshot;
    return Object.entries(state.draft.snapshot.domains).flatMap(([domain, rows]) => rows.flatMap((row) => {
      const original = live.domains[domain]?.find((entry) => entry.id === row.id);
      return Object.keys(fieldsFor(domain, original || row)).filter((field) => hash(row[field]) !== hash(original?.[field])).map((field) => ({ domain, id: row.id, field, live: original[field], draft: row[field] }));
    }));
  }
  function project(state) {
    const live = state.releases[state.activeReleaseId];
    const validation = validateAuthoredContent(state.draft?.snapshot || live.snapshot, baseline);
    if (state.draft && state.draft.baseReleaseId !== live.id) { validation.valid = false; validation.errors.push({ message: "Draft base differs from the active release. Discard and recreate this draft." }); }
    return { revision: state.revision, writable, storage: "Atomic JSON on the configured server volume; one shared draft", activeReleaseId: live.id,
      assetLibrary: require("./contentAssets").assetManifest.entries,
      live: clone(live.snapshot), draft: clone(state.draft), changes: changes(state), validation,
      fields: Object.fromEntries(Object.entries(baseline.domains).map(([domain, rows]) => [domain, Object.fromEntries(rows.map((row) => [row.id, fieldsFor(domain, row)]))])),
      releases: Object.values(state.releases).map(({ snapshot, ...release }) => ({ ...release, compatible: compatible({ snapshot }) })),
      activations: clone(state.activations).reverse() };
  }
  function active() {
    const state = read(), release = state.releases[state.activeReleaseId];
    return resolveEngineContent(release.snapshot, release.id);
  }
  function patch({ expectedRevision, domain, id, field, value, revert = false }, actorId) {
    return transaction(expectedRevision, (state) => {
      const original = baseline.domains[domain]?.find((row) => row.id === id);
      if (!original || !Object.hasOwn(fieldsFor(domain, original), field)) fail(400, "This field is engine-controlled or unknown.");
      if (!revert && value === undefined) fail(400, "A draft value is required.");
      if (!state.draft) state.draft = { baseReleaseId: state.activeReleaseId, snapshot: clone(state.releases[state.activeReleaseId].snapshot), updatedBy: actorId, updatedAt: new Date().toISOString(), previewedHash: null };
      const row = state.draft.snapshot.domains[domain].find((entry) => entry.id === id);
      row[field] = clone(revert ? state.releases[state.activeReleaseId].snapshot.domains[domain].find((entry) => entry.id === id)[field] : value);
      state.draft.updatedAt = new Date().toISOString(); state.draft.updatedBy = actorId; state.draft.previewedHash = null; state.draft.playtestedHash = null;
    });
  }
  function discard({ expectedRevision }) { return transaction(expectedRevision, (state) => { state.draft = null; }); }
  function preview({ expectedRevision }) {
    const result = transaction(expectedRevision, (state) => {
      if (!state.draft) fail(400, "Save a draft before previewing.");
      if (!project(state).validation.valid) fail(422, "Draft validation failed. Correct the reported fields before previewing.");
      state.draft.previewedHash = hash(state.draft.snapshot);
    });
    return { ...result, preview: resolveEngineContent(result.draft.snapshot, `draft:${result.draft.previewedHash}`) };
  }
  function publish({ expectedRevision, label }, actorId) {
    return transaction(expectedRevision, (state) => {
      if (!state.draft || !changes(state).length) fail(400, "There are no draft changes to publish.");
      if (!project(state).validation.valid) fail(422, "Draft validation failed. Nothing was published.");
      if (state.draft.previewedHash !== hash(state.draft.snapshot)) fail(409, "Preview this exact saved draft before publishing.");
      if (changes(state).some((change) => fieldsFor(change.domain, state.draft.snapshot.domains[change.domain].find((row) => row.id === change.id))[change.field]?.mechanical)
        && state.draft.playtestedHash !== hash(state.draft.snapshot)) fail(409, "Playtest this exact saved mechanical draft before publishing.");
      if (typeof label !== "string" || !label.trim() || label.length > 160) fail(400, "Give the release a name of 1–160 characters.");
      const snapshot = state.draft.snapshot, id = releaseId(snapshot), timestamp = new Date().toISOString();
      // Publishing identical content reuses its original immutable release.
      if (!state.releases[id]) state.releases[id] = { id, sha256: hash(snapshot), label: label.trim(), createdAt: timestamp, createdBy: actorId, snapshot: clone(snapshot) };
      state.activations.push({ action: "publish", from: state.activeReleaseId, to: id, at: timestamp, by: actorId });
      state.activeReleaseId = id; state.draft = null;
    });
  }
  function rollback({ expectedRevision, releaseId: id }, actorId) {
    return transaction(expectedRevision, (state) => {
      if (state.draft) fail(409, "Publish or discard the shared draft before changing the active release.");
      const release = Object.hasOwn(state.releases, id) && state.releases[id];
      if (!release || !compatible(release)) fail(422, "The selected release does not exist or is incompatible with this engine.");
      state.activations.push({ action: "rollback", from: state.activeReleaseId, to: id, at: new Date().toISOString(), by: actorId });
      state.activeReleaseId = id;
    });
  }
  function playtestContent(expectedRevision) {
    const state = read();
    if (state.revision !== expectedRevision) fail(409, "Content changed. Refresh before starting a playtest.");
    if (!state.draft || !project(state).validation.valid) fail(422, "Save a valid draft before playtesting.");
    const draftHash = hash(state.draft.snapshot);
    return { draftHash, resolved: resolveEngineContent(state.draft.snapshot, `draft:${draftHash}`) };
  }
  function recordPlaytest(draftHash, actorId) {
    return transaction(read().revision, (state) => {
      if (!state.draft || hash(state.draft.snapshot) !== draftHash || !project(state).validation.valid) fail(409, "The draft changed. Start a new playtest for the current draft.");
      state.draft.playtestedHash = draftHash;
      state.draft.playtestedBy = actorId;
    });
  }
  return { exportState: () => clone(read()), active, status: () => project(read()), patch, discard, preview, publish, rollback, playtestContent, recordPlaytest };
}

function registerContentPublicationRoutes(app, publication) {
  // Mounted beneath the existing mandatory two-account namespace middleware.
  for (const [method, route, operation] of [
    ["get", "authoring", () => publication.status()],
    ["patch", "authoring/draft", (req) => publication.patch(req.body, req.gauntletAdminAccount.id)],
    ["post", "authoring/discard", (req) => publication.discard(req.body)],
    ["post", "authoring/validate", () => publication.status()],
    ["post", "authoring/preview", (req) => publication.preview(req.body)],
    ["post", "authoring/publish", (req) => publication.publish(req.body, req.gauntletAdminAccount.id)],
    ["post", "authoring/rollback", (req) => publication.rollback(req.body, req.gauntletAdminAccount.id)],
    ["post", "authoring/reconcile", () => publication.reconcile ? publication.reconcile() : publication.status()],
    ["post", "authoring/cancel-publication", (req) => publication.cancelPublication ? publication.cancelPublication(req.body) : publication.status()]
  ]) app[method](`/api/admin/${route}`, async (req, res) => {
    // Defense in depth if these routes are ever mounted elsewhere.
    if (!req.gauntletAdminAccount?.id) return res.status(403).json({ error: "Admin access required." });
    res.set("Cache-Control", "private, no-store");
    try { res.json(await operation(req)); }
    catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : "Content storage is unavailable. No operation was confirmed; refresh to inspect its state." }); }
  });
}

module.exports = { STORE_SCHEMA, createContentPublication, registerContentPublicationRoutes };
