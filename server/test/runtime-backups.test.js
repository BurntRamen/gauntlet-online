const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path"), crypto = require("node:crypto"), zlib = require("node:zlib");
const { spawnSync } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const { snapshot, validateBackup, restoreBackup, createRuntimeBackupService, createBackupStorage } = require("../runtimeBackups");
const { runtimeStorageConfig, MARKER, SCHEMA } = require("../runtimeStorage");
const { createRoomStateStore } = require("../roomStateStore");

function fixture(t) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-backup-")), root = path.join(parent, "live");
  fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, MARKER), JSON.stringify({ schemaVersion: SCHEMA, id: crypto.randomUUID() }));
  const config = runtimeStorageConfig({ GAUNTLET_RUNTIME_DATA_DIR: root, GAUNTLET_ECONOMY_DATA_DIR: path.join(root, "economy"), GAUNTLET_PARA_DATA_DIR: path.join(root, "para") });
  fs.mkdirSync(path.dirname(config.paths.economy)); fs.mkdirSync(path.dirname(config.paths.para));
  const db = new DatabaseSync(config.paths.economy);
  db.exec("PRAGMA journal_mode=WAL; create table purchases(id text primary key, receipt text); insert into purchases values ('purchase','durable receipt');");
  const para = new DatabaseSync(config.paths.para);
  para.exec("PRAGMA journal_mode=WAL; create table attempts(id text primary key, status text); insert into attempts values ('attempt','playing');");
  t.after(() => { db.close(); para.close(); assert.ok(parent.startsWith(path.resolve(os.tmpdir()) + path.sep)); fs.rmSync(parent, { recursive: true, force: true }); });
  const game = { roomCode: "LIVE01", lobby: { players: { 1: { reconnectToken: "private-token", socket: "socket" } } }, game: { phase: "priority", turn: 7, players: { 1: { life: 27, hand: [{ value: 9, suit: "hearts" }] } } } };
  const draft = { roomCode: "DRAFT1", lobby: { players: { 1: { reconnectToken: "draft-token" } } }, draft: { status: "picking", picks: ["card-a"] } };
  createRoomStateStore(config.paths.rooms).saveRooms([game, draft]);
  return { config, parent, db, para };
}

test("verified backup restores active games, draft picks and committed SQLite WAL data into a new process", t => {
  const f = fixture(t), backup = snapshot(f.config), target = path.join(f.parent, "restored");
  assert.equal(validateBackup(backup.key, backup.body).files.length, 3);
  const result = restoreBackup(backup.key, backup.body, target); assert.equal(result.files, 3);
  const code = `const p=require('node:path'),{DatabaseSync}=require('node:sqlite');const r=require('./server/roomStateStore').createRoomStateStore(p.join(process.argv[1],'rooms.json'),{strict:true}).loadRooms();const e=new DatabaseSync(p.join(process.argv[1],'economy/economy.sqlite'),{readOnly:true}),a=new DatabaseSync(p.join(process.argv[1],'para/para.sqlite'),{readOnly:true});process.stdout.write(JSON.stringify({rooms:r,receipt:e.prepare('select receipt from purchases').get(),attempt:a.prepare('select status from attempts').get()}));e.close();a.close();`;
  const child = spawnSync(process.execPath, ["-e", code, target], { cwd: path.join(__dirname, "../.."), encoding: "utf8", windowsHide: true });
  assert.equal(child.status, 0, child.stderr);
  const recovered = JSON.parse(child.stdout);
  assert.equal(recovered.rooms[0].game.turn, 7); assert.equal(recovered.rooms[0].lobby.players[1].reconnectToken, "private-token");
  assert.equal(recovered.rooms[0].lobby.players[1].socket, null); assert.deepEqual(recovered.rooms[1].draft.picks, ["card-a"]);
  assert.equal(recovered.receipt.receipt, "durable receipt"); assert.equal(recovered.attempt.status, "playing");
  assert.throws(() => restoreBackup(backup.key, backup.body, f.config.root), /never overwrite/);
  const corrupt = Buffer.from(backup.body); corrupt[10] ^= 1;
  assert.throws(() => restoreBackup(backup.key, corrupt, path.join(f.parent, "corrupt")), /SHA-256/);
  assert.equal(fs.existsSync(path.join(f.parent, "corrupt")), false);
});

test("backups reject unsafe paths, symlinks and corrupted bytes before activation", t => {
  const f = fixture(t), backup = snapshot(f.config), data = validateBackup(backup.key, backup.body);
  data.files[0].path = "../outside.json";
  const body = zlib.gzipSync(Buffer.from(JSON.stringify(data))), digest = crypto.createHash("sha256").update(body).digest("hex");
  const key = backup.key.replace(/[a-f0-9]{64}\.json\.gz$/, `${digest}.json.gz`);
  assert.throws(() => restoreBackup(key, body, path.join(f.parent, "unsafe")), /Unsafe/);
  assert.equal(fs.existsSync(path.join(f.parent, "unsafe")), false);
  fs.mkdirSync(f.config.paths.content);
  fs.symlinkSync(f.parent, path.join(f.config.paths.content, "escape"), "junction");
  assert.throws(() => snapshot(f.config), /escapes/);
  fs.unlinkSync(path.join(f.config.paths.content, "escape"));
});

test("backup success requires remote readback; failures preserve the last successful recovery point", async t => {
  const f = fixture(t), objects = new Map(); let corrupt = false, before = 0;
  const storage = { put: async (key, bytes) => objects.set(key, bytes), get: async key => corrupt ? Buffer.from("corrupt") : objects.get(key) };
  const service = createRuntimeBackupService({ config: f.config, storage, beforeSnapshot: () => { before += 1; } });
  const first = await service.run(); assert.ok(first.lastSuccessfulAt); assert.equal(before, 1);
  corrupt = true; await assert.rejects(service.run(), /SHA-256/);
  assert.equal(service.status().lastSuccessfulAt, first.lastSuccessfulAt); assert.equal(service.status().objectKey, first.objectKey);
  assert.ok(service.status().lastError);
  const reopened = createRuntimeBackupService({ config: f.config, storage });
  assert.equal(reopened.status().lastSuccessfulAt, first.lastSuccessfulAt);
  assert.equal(objects.size, 2, "Immutable backup objects are never overwritten or deleted automatically");
});

test("private backup transport refuses public buckets and redirects and never prints secret failures", async () => {
  const calls = [];
  const store = createBackupStorage({ url: "https://example.supabase.co", key: "private-key", fetchImpl: async (url, options) => { calls.push({ url, options }); return Response.json({ public: true }); } });
  await assert.rejects(store.ensureBucket(), /must be private/);
  assert.equal(calls[0].options.redirect, "error"); assert.equal(calls[0].options.headers.apikey, "private-key");
  const denied = createBackupStorage({ url: "https://example.supabase.co", key: "private-key", fetchImpl: async () => new Response("private internal data", { status: 403 }) });
  await assert.rejects(denied.ensureBucket(), error => !error.message.includes("private internal"));
});
