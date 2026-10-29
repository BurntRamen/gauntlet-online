"use strict";

const fs = require("node:fs"), path = require("node:path");
const MARKER = ".gauntlet-storage.json";
const SCHEMA = "gauntlet.runtime-volume.v1";
const within = (root, target) => target === root || (!path.relative(root, target).startsWith(`..${path.sep}`) && path.relative(root, target) !== ".." && !path.isAbsolute(path.relative(root, target)));
const unescapeMount = text => text.replace(/\\([0-7]{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));

function persistentMount(root, mountInfo) {
  const mounts = mountInfo.split("\n").filter(Boolean).map(line => {
    const [left, right = ""] = line.split(" - ");
    return { directory: unescapeMount(left.split(" ")[4] || "/"), type: right.split(" ")[0] };
  }).filter(mount => within(mount.directory, root)).sort((a, b) => b.directory.length - a.directory.length);
  const mount = mounts[0];
  return !!mount && mount.directory !== "/" && ["ext4", "ext3", "xfs", "btrfs", "zfs"].includes(mount.type);
}

function resolveExistingPath(target) {
  if (fs.existsSync(target)) return fs.realpathSync(target);
  const parent = path.dirname(target);
  if (parent === target) return target;
  return path.join(resolveExistingPath(parent), path.basename(target));
}

function runtimeStorageConfig(env = process.env, serverDirectory = __dirname) {
  const root = env.GAUNTLET_RUNTIME_DATA_DIR || null;
  if (root && !path.isAbsolute(root)) throw new Error("GAUNTLET_RUNTIME_DATA_DIR must be an absolute private data directory.");
  const base = root || serverDirectory;
  const accounts = env.ACCOUNT_DATA_FILE || path.join(base, "accounts.json");
  const matches = env.MATCH_DATA_FILE || path.join(base, "matches.json");
  return { root: root ? path.resolve(root) : null, required: env.GAUNTLET_REQUIRE_DURABLE_STORAGE === "true", paths: {
    accounts, matches,
    layouts: env.ACCOUNT_LAYOUT_DATA_FILE || `${accounts}.layouts.json`,
    factions: env.FACTION_STATS_DATA_FILE || path.join(base, "faction-stats.json"),
    rooms: env.ROOM_STATE_DATA_FILE || path.join(base, "rooms.json"),
    archive: env.MATCH_ARCHIVE_DATA_DIR || (root ? path.join(root, "match-archives") : `${matches}.archive`),
    avatars: env.ACCOUNT_AVATAR_DATA_DIR || (root ? path.join(root, "avatars") : `${accounts}.avatars`),
    content: env.GAUNTLET_CONTENT_DATA_DIR || (root ? path.join(root, "content") : `${accounts}.content`),
    // Moving storage must not opt players into a different economy or league.
    para: env.GAUNTLET_PARA_DATA_DIR ? path.join(env.GAUNTLET_PARA_DATA_DIR, "para.sqlite") : null,
    economy: env.GAUNTLET_ECONOMY_DATA_DIR ? path.join(env.GAUNTLET_ECONOMY_DATA_DIR, "economy.sqlite") : null
  } };
}

function inspectRuntimeStorage(config, { platform = process.platform, mountInfo } = {}) {
  let reason = "Runtime files use an unverified local filesystem.", verified = false;
  if (config.root) {
    try {
      const root = fs.realpathSync(config.root);
      const marker = JSON.parse(fs.readFileSync(path.join(root, MARKER), "utf8"));
      if (marker.schemaVersion !== SCHEMA || !/^[a-f0-9-]{36}$/.test(marker.id || "")) throw new Error("Initialize the runtime volume before enabling it.");
      if (Object.values(config.paths).filter(Boolean).some(target => !within(root, resolveExistingPath(path.resolve(target))))) throw new Error("A runtime path escapes the configured data volume.");
      if (platform !== "linux" || !persistentMount(root, mountInfo ?? fs.readFileSync("/proc/self/mountinfo", "utf8"))) throw new Error("The runtime directory is not on a verified persistent Linux mount.");
      fs.accessSync(root, fs.constants.R_OK | fs.constants.W_OK);
      verified = true; reason = "Private runtime files are on a verified persistent volume; recovery uses the latest saved checkpoint.";
    } catch (error) { reason = error.code ? "The runtime volume or its initialization marker is unavailable." : error.message; }
  }
  if (config.required && !verified) throw new Error(`Durable runtime storage is required: ${reason}`);
  return { configured: !!config.root, required: config.required, persistentMountVerified: verified,
    mode: verified ? "persistent-volume" : "local-unverified", reason };
}

module.exports = { MARKER, SCHEMA, within, persistentMount, runtimeStorageConfig, inspectRuntimeStorage };
