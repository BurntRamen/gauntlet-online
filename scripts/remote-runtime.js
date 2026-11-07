#!/usr/bin/env node
"use strict";
const fs = require("node:fs"), path = require("node:path");
const recovery = require("../server/remoteRuntimeRecovery");
async function main() {
  const [command, filename, targetId] = process.argv.slice(2);
  if (!["export", "verify", "restore-isolated", "import-local"].includes(command) || !filename || !path.isAbsolute(filename)) throw new Error("Usage: node scripts/remote-runtime.js export|verify|restore-isolated|import-local ABSOLUTE_PRIVATE_FILE [restore-store-id]");
  const read = () => { if (fs.statSync(filename).size > 70 * 1024 * 1024) throw new Error("Export exceeds the supported limit."); return JSON.parse(fs.readFileSync(filename, "utf8")); };
  if (command === "verify") { const value = recovery.validateExport(read()); return { integrityVerified: true, rooms: value.state.rooms.length, recoveryVerified: false }; }
  const url = new URL(process.env.SUPABASE_URL), key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || !key) throw new Error("Configure the server's Supabase URL and secret in the environment.");
  const request = async (route, options = {}) => {
    const response = await fetch(`${url.origin}/rest/v1/${route}`, { ...options, redirect: "error", signal: AbortSignal.timeout(20000),
      headers: { apikey: key, ...(!key.startsWith("sb_secret_") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json" } });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error("Private runtime request failed."), { code: data.code });
    return data;
  };
  if (command === "export") {
    const envelope = await recovery.exportRuntime({ request });
    fs.writeFileSync(filename, JSON.stringify(envelope), { flag: "wx", mode: 0o600 });
    recovery.validateExport(read());
    return { exported: true, rooms: envelope.state.rooms.length, revision: envelope.revision, integrityVerified: true, recoveryVerified: false };
  }
  if (command === "restore-isolated") return recovery.restoreRuntime({ request, envelope: read(), targetId });
  return recovery.importLocalRooms({ request, checkpoint: read() });
}
main().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
