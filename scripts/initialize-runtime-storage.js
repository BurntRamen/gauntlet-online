"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { MARKER, SCHEMA, persistentMount } = require("../server/runtimeStorage");

function initialize(directory) {
  if (!directory || !path.isAbsolute(directory)) throw new Error("Provide the absolute private data directory on the mounted Render disk.");
  const root = path.resolve(directory);
  // Refuse accidental initialization on Render's ephemeral deployment filesystem.
  if (process.platform !== "linux" || !persistentMount(root, fs.readFileSync("/proc/self/mountinfo", "utf8"))) throw new Error("A persistent Linux disk must be mounted before initialization.");
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  if (!persistentMount(fs.realpathSync(root), fs.readFileSync("/proc/self/mountinfo", "utf8"))) throw new Error("The directory resolves outside the persistent mount.");
  const marker = path.join(root, MARKER);
  if (fs.existsSync(marker)) {
    if (JSON.parse(fs.readFileSync(marker, "utf8")).schemaVersion !== SCHEMA) throw new Error("Unexpected volume marker; preserve it for operator inspection.");
    return "Runtime volume already initialized.";
  }
  fs.writeFileSync(marker, JSON.stringify({ schemaVersion: SCHEMA, id: crypto.randomUUID(), createdAt: new Date().toISOString() }), { flag: "wx", mode: 0o600 });
  return "Private runtime volume initialized. No existing data was changed.";
}
if (require.main === module) { try { console.log(initialize(process.argv[2])); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { initialize };
