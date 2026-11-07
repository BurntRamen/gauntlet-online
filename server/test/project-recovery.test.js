const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { PGlite } = require("@electric-sql/pglite"), recovery = require("../projectRecovery");
const migrations = ["20261013013808_account_stats_concurrency_guard.sql", "20261015032055_durable_match_and_private_authoring.sql", "20261029211614_authoritative_runtime_state.sql", "20261029212907_immutable_media_library.sql", "20261107045019_private_recovery_export.sql"];
async function database(t) {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(fs.readFileSync(path.join(__dirname, "../supabase-schema.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(__dirname, "../migrations/command-deck-layouts.sql"), "utf8"));
  await db.exec("grant select,insert,update on gauntlet_accounts,gauntlet_friends,gauntlet_friend_messages to service_role;");
  for (const file of migrations) await db.exec(fs.readFileSync(path.join(__dirname, "../../supabase/migrations", file), "utf8"));
  await db.exec(fs.readFileSync(path.join(__dirname, "../../supabase/migrations", migrations.at(-1)), "utf8"));
  await db.exec("set role service_role");
  const request = async (route, options) => {
    if (route === "rpc/export_gauntlet_recovery") return (await db.query("select public.export_gauntlet_recovery() value")).rows[0].value;
    const p = JSON.parse(options.body);
    await db.exec("reset role");
    try { return (await db.query("select public.restore_gauntlet_recovery($1,$2) value", [p.p_id, p.p_snapshot])).rows[0].value; }
    finally { await db.exec("set role service_role"); }
  };
  return { db, request };
}
function directory(t) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-recovery-"));
  t.after(() => { assert.equal(path.dirname(parent), os.tmpdir()); assert.ok(path.basename(parent).startsWith("gauntlet-recovery-")); fs.rmSync(parent, { recursive: true, force: true }); });
  return path.join(parent, "private-export");
}
function objects() {
  const values = new Map(); let writes = 0, lose = false;
  return { values, writes: () => writes, lose: () => { lose = true; }, ensurePrivateBucket: async () => {},
    get: async (bucket, key) => { const bytes = values.get(`${bucket}/${key}`); if (!bytes) throw Object.assign(new Error("Missing immutable object"), { status: 404 }); return bytes; },
    put: async (bucket, key, body) => { assert.equal(values.has(`${bucket}/${key}`), false, "No upsert"); values.set(`${bucket}/${key}`, body); writes++; if (lose) { lose = false; throw new Error("Lost upload reply"); } }
  };
}
async function populate(db, storage) {
  const accountId = "11111111-1111-4111-8111-111111111111";
  const portrait = await require("sharp")({ create: { width: 240, height: 320, channels: 3, background: "#123456" } }).png().toBuffer();
  const avatar = { revision: recovery.digest(portrait).slice(0, 20), mimeType: "image/png", byteSize: portrait.length };
  storage.values.set(`gauntlet-profile-images/${accountId}/${avatar.revision}.png`, portrait);
  await db.query("insert into public.gauntlet_accounts(id,name,name_key,password_salt,password_hash,stats) values($1,'Operator','operator','fixture-salt','credential-hash',$2)", [accountId, { _accountRevision: 42, economy: { gold: 300, timetwisters: 12 }, collection: { owned: { card: 2 } }, profile: { avatar }, wins: 7 }]);
  const friend = "44444444-4444-4444-8444-444444444444";
  await db.query("insert into gauntlet_accounts(id,name,name_key,password_salt,password_hash,stats) values($1,'Friend','friend','fixture-salt','credential-hash',$2)", [friend, { profile: { avatar: { ...avatar, inlineData: portrait.toString("base64") } } }]);
  await db.query("insert into gauntlet_friends(account_id,friend_id) values($1,$2)", [accountId,friend]);
  await db.query("insert into gauntlet_friend_messages(id,from_id,to_id,text) values('55555555-5555-4555-8555-555555555555',$1,$2,'Private fixture message')", [accountId,friend]);
  await db.query("insert into gauntlet_account_layouts(account_id,revision,preferences) values($1,7,$2)", [accountId,{version:1,pages:{play:{order:["campaign","ranked"],hidden:["basic-ai"]}}}]);
  const bytes = Buffer.from("isolated immutable media"), sha = recovery.digest(bytes);
  await db.query("select public.reserve_gauntlet_media($1,$2,'image/webp',268435456)", [sha, bytes.length]);
  const ref = { provider: "supabase-immutable-media-v1", bucket: "gauntlet-admin-media", key: `media/${sha}`, sha256: sha, bytes: bytes.length, mediaType: "image/webp" };
  await db.query("select public.save_gauntlet_private_authoring(0,$1)", [{ schemaVersion: "gauntlet.content-store.v1", revision: 9, privateNotes: { secret: "private note" }, assetBlobs: { art: ref }, runtimeActivation: { releaseId: "captured" } }]);
  storage.values.set(`${ref.bucket}/${ref.key}`, bytes);
  const runtime = { schemaVersion: 2, rooms: [{ roomCode: "ABC123", lobby: { players: { 1: { reconnectToken: "private-token", accountId } } }, game: { phase: "priority", players: { 1: { hand: [{ id: "hidden" }] } } } }] };
  await db.query("select public.commit_gauntlet_runtime('active-rooms',0,'22222222-2222-4222-8222-222222222222',$1,$2)", [require("../remoteRoomStateStore").CONTRACT, runtime]);
  const record = require("../matchRecords").buildMatchRecord({ roomCode: "FINISH", matchMetadata: { matchId: "33333333-3333-4333-8333-333333333333", startedAt: "2026-11-01T00:00:00Z" }, lobby: { players: { 1: { accountId, accountName: "Operator" }, 2: { guestName: "AI", isAI: true } } }, game: { gameMode: "factions", phase: "gameOver", turn: 3, winner: 1, players: { 1: { life: 20, faction: { id: "rumin" } }, 2: { life: 0, faction: { id: "sheen" } } }, serverAuditEvents: [] } }, { completedAt: "2026-11-01T00:10:00Z" });
  record.completion = { status: "finalized", envelopeVersion: "gauntlet.match-completion.v1", finalizedAt: record.completedAt, consequences: [] };
  await db.query("select public.finalize_gauntlet_match($1)", [record]);
  const artifact = require("../matchArchive").createArtifact(record), index = artifact.index;
  await db.query("insert into public.gauntlet_match_archive_index(match_id,index_version,record_version,completed_at,participants,mode,ranked,winner_player_num,completion_reason,archive_object_key,archive_sha256,archive_byte_size) values($1,$2,2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", [index.matchId, index.indexVersion, index.completedAt, JSON.stringify(index.participants), index.mode, index.ranked, index.winnerPlayerNum, index.completionReason, artifact.objectKey, artifact.sha256, artifact.byteSize]);
  await db.exec("reset role");
  await db.query("update public.gauntlet_match_archive_index set participant_account_ids=$1 where match_id=$2", [index.participantAccountIds, index.matchId]);
  await db.exec("set role service_role");
  storage.values.set(`gauntlet-match-archives/${artifact.objectKey}`, Buffer.from(artifact.bytes));
  return { accountId, sha };
}
test("consistent private project export restores account credentials, balances, hidden rooms, receipts, drafts and immutable bytes once", async t => {
  const source = await database(t), target = await database(t), storage = objects(), restoredStorage = objects(), dir = directory(t);
  const fixture = await populate(source.db, storage);
  const buckets = { archives: "gauntlet-archives-drill", avatars: "gauntlet-portraits-drill" };
  for (const [key, bytes] of [...storage.values]) {
    const next = key.replace("gauntlet-match-archives/", buckets.archives + "/").replace("gauntlet-profile-images/", buckets.avatars + "/");
    if (next !== key) { storage.values.delete(key); storage.values.set(next, bytes); }
  }
  const result = await recovery.exportProject({ request: source.request, storage, source: "https://source.example", directory: dir, buckets });
  assert.equal(result.integrityVerified, true); assert.equal(result.recoveryVerified, false);
  restoredStorage.lose(); let lost = true;
  const request = async (route, options) => { const value = await target.request(route, options); if (route === "rpc/restore_gauntlet_recovery" && lost) { lost = false; throw new Error("Lost commit reply"); } return value; };
  const options = { request, storage: restoredStorage, destination: "https://isolated.example", directory: dir };
  await assert.rejects(recovery.restoreProject(options), /Lost commit reply/);
  assert.equal((await recovery.restoreProject(options)).databaseAndObjectsVerified, true);
  assert.equal(restoredStorage.writes(), 3);
  assert.deepEqual(restoredStorage.values, storage.values);
  await assert.rejects(target.db.query("select public.restore_gauntlet_recovery($1,'{}')", [fixture.accountId]), /permission denied/, "The runtime credential cannot invoke offline recovery");
  assert.deepEqual(await target.request("rpc/export_gauntlet_recovery"), await source.request("rpc/export_gauntlet_recovery"));
  assert.equal((await target.db.query("select stats from gauntlet_accounts where id=$1", [fixture.accountId])).rows[0].stats._accountRevision, 42);
  await assert.rejects(recovery.restoreProject({ ...options, destination: "https://source.example/" }), /different isolated/);
  await target.db.query("update gauntlet_accounts set stats=stats||'{\"wins\":8}'::jsonb where id=$1", [fixture.accountId]);
  await assert.rejects(recovery.restoreProject(options), /not empty/);
  await source.db.exec("reset role");
  for (const role of ["anon", "authenticated"]) {
    await source.db.exec(`set role ${role}`);
    await assert.rejects(source.request("rpc/export_gauntlet_recovery"), /permission denied/);
    await assert.rejects(source.db.query("select public.restore_gauntlet_recovery($1,'{}')", [fixture.accountId]), /permission denied/);
    await assert.rejects(source.db.query("select * from gauntlet_recovery_receipts"), /permission denied/);
    await source.db.exec("reset role");
  }
});
test("missing/corrupt referenced bytes, schema drift and partial restores never produce a successful recovery", async t => {
  const source = await database(t), target = await database(t), storage = objects(), dir = directory(t);
  const fixture = await populate(source.db, storage), blob = storage.values.get(`gauntlet-admin-media/media/${fixture.sha}`);
  storage.values.delete(`gauntlet-admin-media/media/${fixture.sha}`);
  await assert.rejects(recovery.exportProject({ request: source.request, storage, source: "https://source.example", directory: dir }), /Missing immutable/);
  assert.equal(fs.existsSync(path.join(dir, "manifest.json")), false);
  storage.values.set(`gauntlet-admin-media/media/${fixture.sha}`, blob);
  const complete = directory(t); await recovery.exportProject({ request: source.request, storage, source: "https://source.example", directory: complete });
  const snapshot = await source.request("rpc/export_gauntlet_recovery");
  const brokenPortrait = structuredClone(snapshot);
  brokenPortrait.tables.gauntlet_accounts.rows.find(row => row.stats.profile?.avatar?.inlineData).stats.profile.avatar.inlineData = Buffer.alloc(200).toString("base64");
  assert.throws(() => recovery.objectInventory(brokenPortrait), /portrait bytes/);
  assert.throws(() => recovery.objectInventory(snapshot, { avatars: "../private" }), /bucket configuration/);
  const changed = structuredClone(snapshot); changed.tables.gauntlet_media_objects.columns[0].type = "uuid";
  await assert.rejects(target.request("rpc/restore_gauntlet_recovery", { body: JSON.stringify({ p_id: fixture.accountId, p_snapshot: changed }) }), /schema differs/);
  assert.equal((await target.db.query("select count(*)::int n from gauntlet_accounts")).rows[0].n, 0, "Late failure rolls back earlier inserts");
  fs.writeFileSync(path.join(complete, `${fixture.sha}.blob`), "corrupt");
  await assert.rejects(recovery.restoreProject({ request: target.request, storage: objects(), destination: "https://isolated.example", directory: complete }), /failed verification/);
});
