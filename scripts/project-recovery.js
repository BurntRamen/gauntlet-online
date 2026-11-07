#!/usr/bin/env node
"use strict";
const recovery = require("../server/projectRecovery");
const { spawn } = require("node:child_process");
function ownerRestore(destination, databaseUrl, snapshot, id) {
  // Explicit database-owner connection to the SAME isolated storage project.
  // Password travels only in the child environment, never argv or output.
  const project = new URL(destination).hostname.match(/^([a-z0-9]{20})\.supabase\.co$/)?.[1];
  const db = new URL(databaseUrl);
  const user = decodeURIComponent(db.username);
  const direct = db.hostname === `db.${project}.supabase.co` && user === "postgres";
  const pooler = /^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(db.hostname) && user === `postgres.${project}`;
  if (!project || !["postgres:", "postgresql:"].includes(db.protocol) || !(direct || pooler) || db.pathname !== "/postgres" || !db.password || db.search || db.hash) throw new Error("Use the isolated project's postgres connection URI without query parameters.");
  const literal = value => "'" + value.replace(/'/g, "''") + "'";
  const sql = `BEGIN; SET LOCAL standard_conforming_strings=on; SELECT public.restore_gauntlet_recovery(${literal(id)}::uuid,${literal(JSON.stringify(snapshot))}::jsonb); COMMIT;`;
  return new Promise((resolve, reject) => {
    const child = spawn("psql", ["--no-psqlrc", "--set=ON_ERROR_STOP=1", "--quiet", "--tuples-only", "--no-align"], { windowsHide: true,
      env: { ...process.env, PGHOST: db.hostname, PGPORT: db.port || "5432", PGUSER: user, PGPASSWORD: decodeURIComponent(db.password), PGDATABASE: "postgres", PGSSLMODE: "verify-full", PGSSLROOTCERT: "system", PGCONNECT_TIMEOUT: "15" }, stdio: ["pipe", "ignore", "ignore"] });
    child.on("error", () => reject(new Error("Install PostgreSQL 16+ psql for offline restore; no database import was confirmed.")));
    child.on("close", code => code === 0 ? resolve({ restored: true }) : reject(new Error("Offline restore was not confirmed. Check the isolated database, keep it offline, and retry the identical export.")));
    child.stdin.on("error", () => {}); child.stdin.end(sql);
  });
}
function adapter(url, secret) {
  const origin = recovery.sourceOrigin(url);
  if (!secret) throw new Error("Configure the server-only project credential.");
  const auth = { apikey: secret, ...(!secret.startsWith("sb_secret_") ? { Authorization: `Bearer ${secret}` } : {}) };
  async function call(route, options = {}) {
    const response = await fetch(`${origin}/${route}`, { ...options, redirect: "error", signal: AbortSignal.timeout(60000), headers: { ...auth, "Content-Type": "application/json", ...options.headers } });
    if (!response.ok) throw Object.assign(new Error(`Recovery request failed (${response.status}); inspect the private server/database logs.`), { status: response.status });
    const maximum = route.startsWith("storage/") ? 64 * 1024 * 1024 : 128 * 1024 * 1024;
    if (Number(response.headers.get("content-length")) > maximum) throw new Error("Recovery response exceeds its limit.");
    const chunks = []; let size = 0;
    for await (const chunk of response.body) { size += chunk.length; if (size > maximum) throw new Error("Recovery response exceeds its limit."); chunks.push(chunk); }
    const body = Buffer.concat(chunks);
    return options.raw ? body : body.length ? JSON.parse(body) : null;
  }
  const object = (bucket, key) => `${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
  return {
    request: (route, options) => call(`rest/v1/${route}`, options),
    storage: {
      get: (bucket, key) => call(`storage/v1/object/authenticated/${object(bucket, key)}`, { raw: true }),
      put: (bucket, key, body, mediaType) => call(`storage/v1/object/${object(bucket, key)}`, { method: "POST", body, headers: { "Content-Type": mediaType, "x-upsert": "false" } }),
      async ensurePrivateBucket(bucket) {
        let value;
        try { value = await call(`storage/v1/bucket/${bucket}`); }
        catch (error) {
          if (error.status !== 404) throw error;
          await call("storage/v1/bucket", { method: "POST", body: JSON.stringify({ id: bucket, name: bucket, public: false, file_size_limit: 64 * 1024 * 1024 }) });
          value = await call(`storage/v1/bucket/${bucket}`);
        }
        if (value?.public !== false) throw new Error("Restore buckets must remain private.");
      }
    }
  };
}
async function main() {
  const [command, directory] = process.argv.slice(2);
  if (!["export", "verify", "restore-isolated"].includes(command) || !directory) throw new Error("Usage: node scripts/project-recovery.js export|verify|restore-isolated ABSOLUTE_PRIVATE_DIRECTORY");
  if (command === "verify") {
    const { manifest } = recovery.verifyDirectory(directory);
    return { integrityVerified: true, recoveryVerified: false, createdAt: manifest.createdAt, objects: manifest.objects.length };
  }
  if (command === "export") return recovery.exportProject({ ...adapter(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY), source: process.env.SUPABASE_URL, directory, buckets: { archives: process.env.MATCH_ARCHIVE_BUCKET, avatars: process.env.ACCOUNT_AVATAR_BUCKET },
    ...(process.env.GAUNTLET_EXPORT_MAX_BYTES ? { maxBytes: Number(process.env.GAUNTLET_EXPORT_MAX_BYTES) } : {}) });
  const target = adapter(process.env.RECOVERY_TARGET_SUPABASE_URL, process.env.RECOVERY_TARGET_SUPABASE_SECRET_KEY);
  if (!process.env.RECOVERY_TARGET_DATABASE_URL) throw new Error("Offline restore requires the isolated project's database-owner connection in RECOVERY_TARGET_DATABASE_URL.");
  return recovery.restoreProject({ ...target, request: (route, options) => {
    if (route !== "rpc/restore_gauntlet_recovery") return target.request(route, options);
    const p = JSON.parse(options.body);
    return ownerRestore(process.env.RECOVERY_TARGET_SUPABASE_URL, process.env.RECOVERY_TARGET_DATABASE_URL, p.p_snapshot, p.p_id);
  }, destination: process.env.RECOVERY_TARGET_SUPABASE_URL, directory });
}
if (require.main === module) main().then(value => console.log(JSON.stringify(value))).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { adapter };
