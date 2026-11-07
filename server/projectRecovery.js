"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { canonicalJson } = require("./matchArchive");
const SCHEMA = "gauntlet.project-recovery.v1", MAX_DATABASE = 128 * 1024 * 1024, MAX_OBJECT = 64 * 1024 * 1024;
const TABLES = ["gauntlet_accounts", "gauntlet_faction_stats", "gauntlet_match_records", "gauntlet_match_events", "gauntlet_match_consequence_receipts", "gauntlet_match_archive_index", "gauntlet_private_authoring", "gauntlet_runtime_states", "gauntlet_runtime_commits", "gauntlet_media_capacity", "gauntlet_media_objects"];
const digest = value => crypto.createHash("sha256").update(Buffer.isBuffer(value) ? value : canonicalJson(value)).digest("hex");
const fail = message => { throw new Error(message); };
function sourceOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) fail("Use a credential-free HTTPS project origin.");
  return url.origin;
}
function validateSnapshot(snapshot) {
  if (snapshot?.schemaVersion !== SCHEMA || Object.keys(snapshot.tables || {}).sort().join() !== [...TABLES].sort().join()) fail("Incomplete recovery database inventory.");
  for (const name of TABLES) {
    const table = snapshot.tables[name];
    if (!Array.isArray(table.columns) || !Array.isArray(table.rows) || !table.columns.length || new Set(table.columns.map(c => c.name)).size !== table.columns.length) fail("Invalid recovery table schema.");
    const keys = table.columns.map(c => c.name).sort().join();
    if (table.rows.some(row => !row || Object.keys(row).sort().join() !== keys)) fail("Invalid recovery row columns.");
  }
  for (const row of snapshot.tables.gauntlet_runtime_states.rows) {
    if (row.id === "active-rooms") {
      if (row.contract !== require("./remoteRoomStateStore").CONTRACT || row.state?.schemaVersion !== 2 || !Array.isArray(row.state.rooms)) fail("Use the server version compatible with these rooms.");
      const rooms = require("./roomStateStore");
      for (const room of row.state.rooms) { if (!rooms.isRecoverableRoom(room)) fail("Invalid recovered room."); rooms.prepareRecoveredRoom(structuredClone(room)); }
    } else if (row.id === "operational-systems") require("./remoteOperationalRecovery").verifyState(row.state);
  }
  return snapshot;
}
function objectInventory(snapshot) {
  const referenced = new Set(), visit = value => {
    if (!value || typeof value !== "object") return;
    if (value.provider === "supabase-immutable-media-v1") {
      if (value.bucket !== "gauntlet-admin-media" || value.key !== `media/${value.sha256}` || !/^[a-f0-9]{64}$/.test(value.sha256)) fail("Unrecognized captured media reference.");
      referenced.add(value.sha256);
    }
    for (const child of Object.values(value)) visit(child);
  };
  visit(snapshot.tables.gauntlet_private_authoring.rows); visit(snapshot.tables.gauntlet_runtime_states.rows);
  const objects = snapshot.tables.gauntlet_media_objects.rows.map(row => ({ bucket: "gauntlet-admin-media", key: `media/${row.sha256}`, sha256: row.sha256, bytes: Number(row.bytes), mediaType: row.media_type, required: referenced.has(row.sha256) }));
  for (const id of referenced) if (!objects.some(row => row.sha256 === id)) fail("A captured media reference has no immutable reservation.");
  for (const row of snapshot.tables.gauntlet_match_archive_index.rows) objects.push({ bucket: "gauntlet-match-archives", key: row.archive_object_key, sha256: row.archive_sha256, bytes: Number(row.archive_byte_size), mediaType: "application/json", required: true, matchId: row.match_id,
    archiveIndex: { indexVersion: row.index_version, matchId: row.match_id, recordVersion: row.record_version, completedAt: row.completed_at, participantAccountIds: row.participant_account_ids, participants: row.participants, mode: row.mode, ranked: row.ranked, season: row.season, winnerPlayerNum: row.winner_player_num, completionReason: row.completion_reason, objectKey: row.archive_object_key, sha256: row.archive_sha256, byteSize: Number(row.archive_byte_size), archiveStatus: row.archive_status, archiveObjectVersion: row.archive_object_version } });
  const identities = new Set();
  for (const row of objects) {
    if (!/^[a-f0-9]{64}$/.test(row.sha256) || !Number.isSafeInteger(row.bytes) || row.bytes < 1 || row.bytes > MAX_OBJECT || typeof row.key !== "string" || row.key.split("/").some(part => !part || part === "." || part === ".." || /[\\:\x00-\x1f]/.test(part)) || identities.has(`${row.bucket}/${row.key}`)) fail("Invalid or duplicated recovery object.");
    identities.add(`${row.bucket}/${row.key}`);
  }
  return objects;
}
function verifyObject(row, body) {
  if (!Buffer.isBuffer(body) || body.length !== row.bytes || digest(body) !== row.sha256) fail(`Recovery bytes failed verification: ${row.bucket}/${row.key}`);
  if (row.matchId) require("./matchArchive").parseAndVerifyArchive(body, row.archiveIndex);
}
function privateFile(root, name, max) {
  const filename = path.join(root, name), stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > max || fs.realpathSync(filename) !== filename) fail("Unsafe or oversized recovery file.");
  return fs.readFileSync(filename);
}
function verifyDirectory(directory) {
  const root = fs.realpathSync(directory), manifest = JSON.parse(privateFile(root, "manifest.json", MAX_DATABASE));
  const { sha256, ...payload } = manifest;
  if (manifest.schemaVersion !== SCHEMA || digest(payload) !== sha256 || !/^[a-f0-9-]{36}$/.test(manifest.id)) fail("Recovery manifest integrity failed.");
  sourceOrigin(manifest.source);
  const body = privateFile(root, "database.json", MAX_DATABASE);
  if (digest(body) !== manifest.databaseSha256) fail("Recovery database integrity failed.");
  const snapshot = validateSnapshot(JSON.parse(body)), expected = objectInventory(snapshot);
  if (!Array.isArray(manifest.objects) || manifest.objects.length !== expected.length) fail("Incomplete recovery object inventory.");
  for (let i = 0; i < expected.length; i++) {
    const { missingReservation, ...row } = manifest.objects[i];
    if (canonicalJson(row) !== canonicalJson(expected[i]) || missingReservation && row.required) fail("Recovery object inventory differs from the database.");
    if (!missingReservation) verifyObject(row, privateFile(root, `${row.sha256}.blob`, MAX_OBJECT));
  }
  return { manifest, snapshot, root };
}
async function exportProject({ request, storage, source, directory, maxBytes = 512 * 1024 * 1024 }) {
  source = sourceOrigin(source);
  if (!Number.isSafeInteger(maxBytes) || maxBytes < MAX_DATABASE || maxBytes > 4 * 1024 ** 3) fail("Export budget must be 128 MiB–4 GiB.");
  if (!path.isAbsolute(directory) || fs.existsSync(directory)) fail("Export requires a new absolute private directory.");
  const snapshot = validateSnapshot(await request("rpc/export_gauntlet_recovery", { method: "POST", body: "{}" }));
  const database = Buffer.from(canonicalJson(snapshot));
  if (database.length > MAX_DATABASE) fail("Database exceeds 128 MiB; use a database dump and object export.");
  const objects = objectInventory(snapshot); let bytes = database.length;
  if (objects.reduce((sum, row) => sum + row.bytes, bytes) > maxBytes) fail("Export exceeds the configured budget; no export was marked complete.");
  fs.mkdirSync(directory, { mode: 0o700 }); fs.writeFileSync(path.join(directory, "database.json"), database, { flag: "wx", mode: 0o600 });
  const completed = new Set();
  for (const row of objects) {
    let body;
    try { body = await storage.get(row.bucket, row.key); }
    catch (error) { if (error.status === 404 && !row.required) { row.missingReservation = true; continue; } throw error; }
    verifyObject(row, body);
    if (!completed.has(row.sha256)) { fs.writeFileSync(path.join(directory, `${row.sha256}.blob`), body, { flag: "wx", mode: 0o600 }); completed.add(row.sha256); bytes += body.length; }
  }
  const payload = { schemaVersion: SCHEMA, id: crypto.randomUUID(), createdAt: new Date().toISOString(), source, databaseSha256: digest(database), objects };
  fs.writeFileSync(path.join(directory, "manifest.json"), JSON.stringify({ ...payload, sha256: digest(payload) }), { flag: "wx", mode: 0o600 });
  verifyDirectory(directory);
  return { exported: true, integrityVerified: true, recoveryVerified: false, bytes, objects: completed.size, missingUnreferencedReservations: objects.filter(row => row.missingReservation).length };
}
async function restoreProject({ request, storage, destination, directory }) {
  const { manifest, snapshot, root } = verifyDirectory(directory);
  if (sourceOrigin(destination) === manifest.source) fail("Restore requires a different isolated project; the source project is never a destination.");
  const current = await request("rpc/export_gauntlet_recovery", { method: "POST", body: "{}" });
  validateSnapshot(current);
  // Exact retry after a lost commit reply is allowed; any different data blocks.
  const same = digest(current) === digest(snapshot);
  if (!same && TABLES.some(name => current.tables[name].rows.length)) fail("Destination is not empty. Nothing was replaced.");
  const verifiedBuckets = new Set();
  for (const row of manifest.objects) {
    if (row.missingReservation) continue;
    if (!verifiedBuckets.has(row.bucket)) { await storage.ensurePrivateBucket(row.bucket); verifiedBuckets.add(row.bucket); }
    const body = privateFile(root, `${row.sha256}.blob`, MAX_OBJECT);
    try { verifyObject(row, await storage.get(row.bucket, row.key)); }
    catch (error) {
      if (error.status !== 404) throw error;
      try { await storage.put(row.bucket, row.key, body, row.mediaType); }
      catch (error) { // A lost upload response is resolved by immutable readback.
        verifyObject(row, await storage.get(row.bucket, row.key));
      }
      verifyObject(row, await storage.get(row.bucket, row.key));
    }
  }
  await request("rpc/restore_gauntlet_recovery", { method: "POST", body: JSON.stringify({ p_id: manifest.id, p_snapshot: snapshot }) });
  const restored = await request("rpc/export_gauntlet_recovery", { method: "POST", body: "{}" });
  if (digest(restored) !== digest(snapshot)) fail("Restore readback differs; keep the destination offline.");
  return { restored: true, databaseAndObjectsVerified: true, applicationRecoveryVerified: false, tables: TABLES.length, objects: manifest.objects.filter(row => !row.missingReservation).length };
}
module.exports = { SCHEMA, TABLES, digest, validateSnapshot, objectInventory, verifyDirectory, exportProject, restoreProject, sourceOrigin };
