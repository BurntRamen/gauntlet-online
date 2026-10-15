"use strict";
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto"), zlib = require("node:zlib");
const { MARKER, SCHEMA: VOLUME_SCHEMA, within } = require("./runtimeStorage");
const SCHEMA = "gauntlet.runtime-backup.v1", MAX_BYTES = 64 * 1024 * 1024;
const STATUS_FILE = ".gauntlet-backup-status.json";
const sha256 = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const keyPattern = /^runtime\/\d{4}-\d{2}-\d{2}T[\d-]+Z-[a-f0-9-]{36}-([a-f0-9]{64})\.json\.gz$/;

function snapshot(config, now = new Date().toISOString()) {
  if (!config.root) throw new Error("Configure the private runtime volume before backing it up.");
  const root = fs.realpathSync(config.root), files = [], seen = new Set();
  const volume = JSON.parse(fs.readFileSync(path.join(root, MARKER), "utf8"));
  if (volume.schemaVersion !== VOLUME_SCHEMA) throw new Error("Unrecognized runtime volume.");
  let total = 0;
  function collect(filename) {
    if (!fs.existsSync(filename)) return;
    const stat = fs.lstatSync(filename);
    if (stat.isSymbolicLink() || !within(root, fs.realpathSync(filename))) throw new Error("Backup source escapes the private runtime volume.");
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(filename)) {
        if (name.endsWith(".lock")) throw new Error("A runtime transaction is in progress; retry the backup.");
        if (!/\.(tmp)$|-(wal|shm)$/.test(name)) collect(path.join(filename, name));
      }
      return;
    }
    if (!stat.isFile() || seen.has(filename)) return;
    seen.add(filename);
    let bytes;
    if (filename.endsWith(".sqlite")) {
      const { DatabaseSync } = require("node:sqlite");
      const temporary = path.join(os.tmpdir(), `gauntlet-backup-${crypto.randomUUID()}.sqlite`);
      const db = new DatabaseSync(filename, { readOnly: true });
      try {
        db.exec("PRAGMA busy_timeout=10000");
        db.prepare("VACUUM INTO ?").run(temporary);
        const copy = new DatabaseSync(temporary, { readOnly: true });
        try { if (copy.prepare("PRAGMA integrity_check").get().integrity_check !== "ok") throw new Error("SQLite backup failed its integrity check."); } finally { copy.close(); }
        if (fs.statSync(temporary).size > MAX_BYTES * 0.7) throw new Error("SQLite backup exceeds the supported runtime backup envelope.");
        bytes = fs.readFileSync(temporary);
      } finally { db.close(); if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
    } else {
      if (!/\.(json|png|jpe?g|webp)$/i.test(filename)) throw new Error("Unexpected file in runtime data; inspect it before backing up.");
      if (stat.size > MAX_BYTES) throw new Error("Runtime backup exceeds the supported 64 MiB envelope. Expand the backup implementation before relying on it.");
      bytes = fs.readFileSync(filename);
      if (filename.endsWith(".json")) JSON.parse(bytes.toString("utf8"));
    }
    total += bytes.length;
    if (total > MAX_BYTES * 0.7) throw new Error("Runtime backup exceeds the supported 64 MiB envelope. No backup was marked successful.");
    files.push({ path: path.relative(root, filename).split(path.sep).join("/"), bytes: bytes.length, sha256: sha256(bytes), data: bytes.toString("base64") });
  }
  for (const source of Object.values(config.paths).filter(Boolean)) collect(path.resolve(source));
  const encoded = Buffer.from(JSON.stringify({ schemaVersion: SCHEMA, createdAt: now, volume, files }));
  if (encoded.length > MAX_BYTES) throw new Error("Runtime backup exceeds 64 MiB.");
  const body = zlib.gzipSync(encoded);
  return { body, key: `runtime/${now.replace(/[:.]/g, "-")}-${crypto.randomUUID()}-${sha256(body)}.json.gz`, fileCount: files.length };
}

function validateBackup(key, bytes) {
  const match = keyPattern.exec(key);
  if (!match || bytes.length > MAX_BYTES || sha256(bytes) !== match[1]) throw new Error("Backup object failed its SHA-256 check.");
  const backup = JSON.parse(zlib.gunzipSync(bytes, { maxOutputLength: MAX_BYTES }));
  if (backup.schemaVersion !== SCHEMA || backup.volume?.schemaVersion !== VOLUME_SCHEMA || !Array.isArray(backup.files)) throw new Error("Unsupported runtime backup.");
  const names = new Set();
  for (const file of backup.files) {
    if (typeof file.path !== "string" || file.path.split("/").some(part => !part || part === "." || part === ".." || /[\\:\x00-\x1f]/.test(part)) || names.has(file.path) || file.path === MARKER) throw new Error("Unsafe or duplicate backup path.");
    names.add(file.path);
    const contents = Buffer.from(file.data, "base64");
    if (contents.length !== file.bytes || sha256(contents) !== file.sha256) throw new Error("Backup file failed its integrity check.");
  }
  return backup;
}

function restoreBackup(key, bytes, destination) {
  const backup = validateBackup(key, bytes);
  if (!destination || !path.isAbsolute(destination) || fs.existsSync(destination)) throw new Error("Restore into a new absolute directory; never overwrite the running data volume.");
  const root = path.resolve(destination);
  fs.mkdirSync(root, { mode: 0o700 });
  for (const file of backup.files) {
    const target = path.resolve(root, ...file.path.split("/"));
    if (!within(root, target)) throw new Error("Unsafe restore path.");
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    fs.writeFileSync(target, Buffer.from(file.data, "base64"), { flag: "wx", mode: 0o600 });
    if (target.endsWith(".sqlite")) {
      const db = new (require("node:sqlite").DatabaseSync)(target, { readOnly: true });
      try { if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok") throw new Error("Restored SQLite integrity check failed; do not activate this directory."); } finally { db.close(); }
    }
  }
  // Written last: an interrupted restore is never a valid initialized volume.
  fs.writeFileSync(path.join(root, MARKER), JSON.stringify(backup.volume), { flag: "wx", mode: 0o600 });
  return { createdAt: backup.createdAt, files: backup.files.length };
}

function createBackupStorage({ url, key, bucket = "gauntlet-runtime-backups", fetchImpl = fetch }) {
  const base = new URL(url);
  if (base.protocol !== "https:" || base.username || base.password || base.pathname !== "/" || !key) throw new Error("Configure the existing backend Supabase URL and secret for private backups.");
  async function request(route, { method = "GET", body, raw = false } = {}) {
    const response = await fetchImpl(`${base.origin}/storage/v1/${route}`, { method, body, redirect: "error", signal: AbortSignal.timeout(60000),
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": Buffer.isBuffer(body) ? "application/octet-stream" : "application/json", "x-upsert": "false" } });
    if (!response.ok) throw Object.assign(new Error(`Private backup storage request failed (${response.status}).`), { status: response.status });
    if (raw) return Buffer.from(await response.arrayBuffer());
    const text = await response.text(); return text ? JSON.parse(text) : null;
  }
  const object = key => `${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
  async function ensureBucket() {
    let found;
    try { found = await request(`bucket/${encodeURIComponent(bucket)}`); }
    catch (error) {
      if (error.status !== 404) throw error;
      try { await request("bucket", { method: "POST", body: JSON.stringify({ id: bucket, name: bucket, public: false, file_size_limit: MAX_BYTES }) }); }
      catch (createError) { if (![400, 409].includes(createError.status)) throw createError; }
      found = await request(`bucket/${encodeURIComponent(bucket)}`);
    }
    if (found?.public !== false) throw new Error("Backup bucket must be private. No backup was uploaded.");
  }
  return {
    ensureBucket,
    async put(key, bytes) { if (!keyPattern.test(key)) throw new Error("Invalid backup key."); await ensureBucket(); return request(`object/${object(key)}`, { method: "POST", body: bytes }); },
    async get(key) { if (!keyPattern.test(key)) throw new Error("Invalid backup key."); await ensureBucket(); return request(`object/authenticated/${object(key)}`, { raw: true }); },
    async list(offset = 0) { await ensureBucket(); return request(`object/list/${encodeURIComponent(bucket)}`, { method: "POST", body: JSON.stringify({ prefix: "runtime", limit: 100, offset, sortBy: { column: "name", order: "desc" } }) }); }
  };
}

function createRuntimeBackupService({ config, storage, beforeSnapshot = () => {}, intervalMs = 3600000, logger = console }) {
  let running = null, timer, initial;
  let status = { enabled: !!storage, lastSuccessfulAt: null, lastAttemptAt: null, lastError: null, objectKey: null };
  const filename = config.root && path.join(config.root, STATUS_FILE);
  if (filename && fs.existsSync(filename)) {
    try { status = { ...status, ...JSON.parse(fs.readFileSync(filename)), enabled: !!storage }; } catch { status.lastError = "Previous backup status could not be read."; }
  }
  async function run() {
    if (running) return running;
    if (!storage) throw new Error("Private runtime backups are not configured.");
    running = (async () => {
      status.lastAttemptAt = new Date().toISOString();
      try {
        await beforeSnapshot();
        const bundle = snapshot(config);
        await storage.put(bundle.key, bundle.body);
        // Read back and verify the complete uploaded object before claiming success.
        validateBackup(bundle.key, await storage.get(bundle.key));
        status = { ...status, lastSuccessfulAt: new Date().toISOString(), lastError: null, objectKey: bundle.key, fileCount: bundle.fileCount };
      } catch (error) {
        status.lastError = error.message;
        throw error;
      } finally {
        if (filename) { const temporary = `${filename}.${crypto.randomUUID()}.tmp`; fs.writeFileSync(temporary, JSON.stringify(status), { mode: 0o600 }); fs.renameSync(temporary, filename); }
      }
      return { ...status };
    })();
    try { return await running; } finally { running = null; }
  }
  const attempt = () => run().catch(error => logger.error("[Backup] Private runtime backup failed:", error.message));
  return { run, status: () => ({ ...status, running: !!running }),
    start() { if (!storage || timer) return; initial = setTimeout(attempt, 60000); initial.unref(); timer = setInterval(attempt, Math.max(300000, intervalMs)); timer.unref(); },
    stop() { clearTimeout(initial); clearInterval(timer); timer = null; } };
}

module.exports = { snapshot, validateBackup, restoreBackup, createBackupStorage, createRuntimeBackupService, SCHEMA, MAX_BYTES };
