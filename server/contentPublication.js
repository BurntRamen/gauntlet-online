"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { migrateV1 } = require("./contentMigration");
const { clone, hash, fieldsFor, fieldValue, validateAuthoredContent, resolveEngineContent } = require("./authoredContent");
const paraLeague = require("./paraLeague");
const STORE_SCHEMA = "gauntlet.content-store.v1";
const releaseId = (snapshot) => `gauntlet-content-${hash(snapshot)}`;
function fail(status, message) { const error = new Error(message); error.status = status; throw error; }

// One atomic state file is the transaction boundary: snapshot insertion, pointer
// activation and draft removal either all commit, or none do. A separate exclusive
// lock and revision checks prevent lost updates across operators/processes.
function createContentPublication({ baseline, directory = ".", writable = true, memory = false, initialState = null, provider = "local", runtimeCapabilities = () => ({ enabled: false }), economyCapabilities = () => ({ enabled: false }) }) {
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
    if (provider !== "local") fail(503, `Publication provider '${provider}' is unsupported in this deployment. No GitHub or deployment adapter is installed.`);
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
    const contentChanges = Object.entries(state.draft.snapshot.domains).flatMap(([domain, rows]) => rows.flatMap((row) => {
      const original = live.domains[domain]?.find((entry) => entry.id === row.id);
      return Object.entries(fieldsFor(domain, original || row)).filter(([field, spec]) => hash(fieldValue(row, field, spec) ?? null) !== hash(fieldValue(original, field, spec) ?? null)).map(([field, spec]) => ({ domain, id: row.id, field, live: fieldValue(original, field, spec), draft: fieldValue(row, field, spec) }));
    }));
    const previous = live.paraLeague || paraLeague.emptyConfig();
    const next = state.draft.snapshot.paraLeague || paraLeague.emptyConfig();
    const paraChanges = Object.keys(paraLeague.FIELDS).flatMap((domain) => next[domain].flatMap((row) => {
      const original = previous[domain].find((entry) => entry.id === row.id);
      return Object.keys(paraLeague.FIELDS[domain]).filter((field) => hash(row[field] ?? null) !== hash(original?.[field] ?? null))
        .map((field) => ({ domain: `para:${domain}`, id: row.id, field, live: original?.[field] ?? null, draft: row[field] }));
    }));
    return [...contentChanges, ...paraChanges];
  }
  function project(state) {
    const live = state.releases[state.activeReleaseId];
    const validation = validateAuthoredContent(state.draft?.snapshot || live.snapshot, baseline);
    if (state.draft && state.draft.baseReleaseId !== live.id) { validation.valid = false; validation.errors.push({ message: "Draft base differs from the active release. Discard and recreate this draft." }); }
    return { revision: state.revision, writable: writable && provider === "local", storage: "Atomic JSON on the configured server volume; one shared draft", activeReleaseId: live.id,
      publication: { provider, supported: provider === "local", github: "unavailable", activeReleaseId: live.id, deployment: provider === "local" ? "active-on-this-server" : "unsupported-provider", message: "Local publication activates this server immediately." },
      guide: require("./adminAuthoringGuide"),
      encounterSummaries: require("./encounterAuthoring").summaries(state.draft?.snapshot || live.snapshot),
      assetLibrary: require("./digitalDelivery").deliveryOptions(),
      live: clone(live.snapshot), draft: state.draft ? { ...clone(state.draft), hash: hash(state.draft.snapshot) } : null, changes: changes(state), validation,
      fields: Object.fromEntries(Object.entries(baseline.domains).map(([domain, rows]) => [domain, Object.fromEntries(rows.map((row) => [row.id, fieldsFor(domain, row)]))])),
      releases: Object.values(state.releases).map(({ snapshot, ...release }) => ({ ...release, compatible: compatible({ snapshot }) })),
      activations: clone(state.activations).reverse(),
      para: { fields: paraLeague.FIELDS, templates: Object.fromEntries(Object.keys(paraLeague.FIELDS).map((key) => [key, paraLeague.newDefinition(key)])),
        capabilities: { ...paraLeague.CAPABILITIES, officialEntry: runtimeCapabilities().enabled, currencyOperations: economyCapabilities().enabled, purchases: economyCapabilities().enabled, fulfillment: economyCapabilities().enabled, runtime: runtimeCapabilities(), economy: economyCapabilities() }, invariants: paraLeague.INVARIANTS,
        catalog: validation.valid ? paraLeague.catalog(state.draft?.snapshot.paraLeague || live.snapshot.paraLeague || paraLeague.emptyConfig()) : [],
        summary: validation.valid ? paraLeague.summary(state.draft?.snapshot.paraLeague || live.snapshot.paraLeague || paraLeague.emptyConfig()) : [] } };
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
      const next = revert ? state.releases[state.activeReleaseId].snapshot.domains[domain].find(entry => entry.id === id)[field] : value;
      if (next === undefined) delete row[field]; else row[field] = clone(next);
      state.draft.updatedAt = new Date().toISOString(); state.draft.updatedBy = actorId; state.draft.previewedHash = null; state.draft.previewedRevision = null; state.draft.playtestedHash = null;
    });
  }
  function discard({ expectedRevision }) { return transaction(expectedRevision, (state) => { state.draft = null; }); }
  function paraDraft({ expectedRevision, operation, domain, id, value, sourceId }, actorId) {
    return transaction(expectedRevision, (state) => {
      if (!state.draft) state.draft = { baseReleaseId: state.activeReleaseId, snapshot: clone(state.releases[state.activeReleaseId].snapshot), previewedHash: null };
      const snapshot = state.draft.snapshot;
      if (operation === "seed") {
        if (snapshot.paraLeague && Object.keys(paraLeague.FIELDS).some((key) => snapshot.paraLeague[key].length)) fail(409, "The Para catalog already has definitions. Seed only an empty catalog; existing work is preserved.");
        snapshot.paraLeague = paraLeague.seedSeasonZero();
      } else {
        if (!Object.hasOwn(paraLeague.FIELDS, domain) || typeof id !== "string" || !/^[a-z][a-z0-9-]{0,79}$/.test(id)) fail(400, "Choose a definition type and a stable lowercase ID.");
        snapshot.paraLeague ||= paraLeague.emptyConfig();
        const rows = snapshot.paraLeague[domain], index = rows.findIndex((row) => row.id === id);
        if (operation === "archive") {
          if (index < 0 || !Object.hasOwn(paraLeague.FIELDS[domain], "status")) fail(400, "This definition cannot be archived.");
          rows[index].status = "archived";
        } else if (operation === "duplicate") {
          const source = rows.find((row) => row.id === sourceId);
          if (!source || index >= 0 || rows.length >= 500) fail(409, "Choose an existing source and a new unused ID; catalog limit is 500.");
          const copy = { ...clone(source), id, name: `${source.name.slice(0, 150)} copy` };
          if (Object.hasOwn(copy, "status")) copy.status = domain === "products" ? "unavailable" : "draft";
          for (const key of Object.keys(copy).filter((key) => paraLeague.FIELDS[domain][key].type === "date")) copy[key] = null;
          rows.push(copy);
        } else if (operation === "create" || operation === "update") {
          if (!value || typeof value !== "object" || Array.isArray(value) || value.id !== id || Object.keys(value).sort().join() !== Object.keys(paraLeague.FIELDS[domain]).sort().join()) fail(400, "Supply the exact typed fields for this definition. Identity and protected fields cannot be patched.");
          if (operation === "create" && (index >= 0 || rows.length >= 500)) fail(409, "ID already exists or the catalog is full.");
          if (operation === "update" && index < 0) fail(404, "Definition no longer exists. Refresh the shared draft.");
          // Keep malformed structures out of storage. Cross-reference and semantic
          // errors remain reviewable in the shared draft but cannot be published.
          for (const [key, field] of Object.entries(paraLeague.FIELDS[domain])) {
            const entry = value[key];
            if (["references", "choices", "numbers", "rewards"].includes(field.type) && (!Array.isArray(entry) || entry.length > 64)) fail(400, "Invalid list field.");
            if (field.type === "text" && (typeof entry !== "string" || entry.length > field.maxLength)) fail(400, "Invalid text field.");
            if (["reference", "asset"].includes(field.type) && typeof entry !== "string") fail(400, "Invalid reference field.");
            if (field.type === "choice" && typeof entry !== typeof field.options[0]) fail(400, "Invalid choice field.");
            if (field.type === "integer" && !Number.isFinite(entry)) fail(400, "Invalid numeric field.");
            if (field.type === "boolean" && typeof entry !== "boolean") fail(400, "Invalid boolean field.");
            if (field.type === "date" && entry !== null && typeof entry !== "string") fail(400, "Invalid date field.");
            if (["choices", "references"].includes(field.type) && entry.some((item) => typeof item !== "string")) fail(400, "Invalid reference list.");
            if (field.type === "numbers" && entry.some((item) => !Number.isFinite(item))) fail(400, "Invalid numeric list.");
            if (field.type === "rewards" && entry.some((item) => !item || Object.keys(item).sort().join() !== "entitlementId,wins" || typeof item.entitlementId !== "string" || !Number.isFinite(item.wins))) fail(400, "Invalid reward tier.");
          }
          if (operation === "create") rows.push(clone(value)); else rows[index] = clone(value);
        } else fail(400, "Unknown Para draft operation.");
      }
      state.draft.updatedBy = actorId; state.draft.updatedAt = new Date().toISOString();
      state.draft.previewedHash = null; state.draft.playtestedHash = null;
    });
  }
  function paraSimulation({ expectedRevision, ...input }) {
    const state = read();
    if (state.revision !== expectedRevision) fail(409, "Content changed. Refresh before simulating this draft.");
    const config = (state.draft?.snapshot || state.releases[state.activeReleaseId].snapshot).paraLeague || paraLeague.emptyConfig();
    return { revision: state.revision, ...paraLeague.simulate(config, input) };
  }
  function preview({ expectedRevision }) {
    const result = transaction(expectedRevision, (state) => {
      if (!state.draft) fail(400, "Save a draft before previewing.");
      if (!project(state).validation.valid) fail(422, "Draft validation failed. Correct the reported fields before previewing.");
      state.draft.previewedHash = hash(state.draft.snapshot);
      state.draft.previewedRevision = state.revision + 1;
    });
    const preview = resolveEngineContent(result.draft.snapshot, `draft:${result.draft.previewedHash}`);
    preview.presentation = require("./adminPreview").buildAdminPreview(result.draft.snapshot, preview);
    return { ...result, preview };
  }
  function publish({ expectedRevision, label }, actorId) {
    return transaction(expectedRevision, (state) => {
      if (!state.draft || !changes(state).length) fail(400, "There are no draft changes to publish.");
      if (!project(state).validation.valid) fail(422, "Draft validation failed. Nothing was published.");
      if (state.draft.previewedHash !== hash(state.draft.snapshot)) fail(409, "Preview this exact saved draft before publishing.");
      if (changes(state).some((change) => !change.domain.startsWith("para:") && fieldsFor(change.domain, state.draft.snapshot.domains[change.domain].find((row) => row.id === change.id))[change.field]?.mechanical)
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
    return { draftHash, draftRevision: state.revision, resolved: resolveEngineContent(state.draft.snapshot, `draft:${draftHash}`) };
  }
  function recordPlaytest(draftHash, actorId) {
    return transaction(read().revision, (state) => {
      if (!state.draft || hash(state.draft.snapshot) !== draftHash || !project(state).validation.valid) fail(409, "The draft changed. Start a new playtest for the current draft.");
      state.draft.playtestedHash = draftHash;
      state.draft.playtestedBy = actorId;
    });
  }
  function releaseSnapshot(id) {
    const state = read(), release = Object.hasOwn(state.releases, id) && state.releases[id];
    if (!release) fail(404, "Content release not found.");
    return { ...clone(release), compatible: compatible(release) };
  }
  function published(id) {
    const state = read(), release = state.releases[id || state.activeReleaseId];
    if (!release || !compatible(release)) fail(503, "Published release unavailable or incompatible.");
    return clone(release);
  }
  return { exportState: () => clone(read()), releaseSnapshot, published, paraDraft, paraSimulation, active, status: () => project(read()), patch, discard, preview, publish, rollback, playtestContent, recordPlaytest };
}

function registerContentPublicationRoutes(app, publication) {
  const notices = { "para-draft": "Definition saved to the shared draft. Published rules are unchanged.", draft: "Field saved to the shared draft. Live content is unchanged.", publish: "Publication requested. Check the release and deployment status.", rollback: "Rollback requested. Check the release and deployment status.", discard: "Shared draft discarded.", validate: "Draft validation completed.", preview: "Saved draft preview is ready." };
  // Mounted beneath the existing mandatory two-account namespace middleware.
  for (const [method, route, operation] of [
    ["get", "authoring", () => require("./adminLiveAvailability").readAuthoringStatus(publication)],
    ["patch", "authoring/draft", (req) => publication.patch(req.body, req.gauntletAdminAccount.id)],
    ["post", "authoring/para-draft", (req) => publication.paraDraft(req.body, req.gauntletAdminAccount.id)],
    ["post", "authoring/para-simulate", (req) => publication.paraSimulation(req.body)],
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
    try { const result = await operation(req); res.json({ ...result, ...(notices[route.split("/")[1]] ? { notice: notices[route.split("/")[1]] } : {}) }); }
    catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : "Content storage is unavailable. No operation was confirmed; refresh to inspect its state." }); }
  });
}

module.exports = { STORE_SCHEMA, createContentPublication, registerContentPublicationRoutes };
