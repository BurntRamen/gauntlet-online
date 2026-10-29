const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { runtimeStorageConfig, inspectRuntimeStorage, persistentMount, SCHEMA, MARKER } = require("../runtimeStorage");

test("runtime paths move together without enabling a new economy or official league", () => {
  const root = path.resolve(os.tmpdir(), "private-volume"), config = runtimeStorageConfig({ GAUNTLET_RUNTIME_DATA_DIR: root });
  for (const key of ["accounts", "matches", "factions", "rooms", "archive", "avatars", "content", "layouts"]) assert.ok(config.paths[key].startsWith(root + path.sep));
  assert.equal(config.paths.para, null); assert.equal(config.paths.economy, null);
  assert.throws(() => runtimeStorageConfig({ GAUNTLET_RUNTIME_DATA_DIR: "relative" }), /absolute/);
  const previous = runtimeStorageConfig({ ACCOUNT_DATA_FILE: "custom-accounts.json", MATCH_DATA_FILE: "custom-matches.json" });
  assert.equal(previous.paths.avatars, "custom-accounts.json.avatars"); assert.equal(previous.paths.archive, "custom-matches.json.archive");
  assert.equal(previous.paths.layouts, "custom-accounts.json.layouts.json");
});

test("strict runtime configuration rejects missing mounts, missing markers and paths outside the volume", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-volume-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const config = runtimeStorageConfig({ GAUNTLET_RUNTIME_DATA_DIR: root, GAUNTLET_REQUIRE_DURABLE_STORAGE: "true" });
  const mountInfo = `1 0 0:1 / / rw - overlay overlay rw\n2 1 8:1 / ${root.replace(/ /g, "\\040")} rw - ext4 /dev/example rw`;
  const options = { platform: "linux", mountInfo };
  assert.throws(() => inspectRuntimeStorage(config, options), /required/);
  fs.writeFileSync(path.join(root, MARKER), JSON.stringify({ schemaVersion: SCHEMA, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }));
  assert.equal(inspectRuntimeStorage(config, options).persistentMountVerified, true);
  assert.throws(() => inspectRuntimeStorage(config, { ...options, mountInfo: "1 0 0:1 / / rw - overlay overlay rw" }), /persistent Linux mount/);
  assert.throws(() => inspectRuntimeStorage({ ...config, paths: { ...config.paths, rooms: path.join(root, "..", "elsewhere.json") } }, options), /escapes/);
  assert.equal(inspectRuntimeStorage(runtimeStorageConfig({})).persistentMountVerified, false);
  assert.equal(persistentMount(root, mountInfo.replace("ext4", "tmpfs")), false);
});
