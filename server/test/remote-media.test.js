const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");
const { createRemoteMediaStore, BUCKET } = require("../remoteMediaStore");
const { processAudio } = require("../audioUpload");
const assets = require("../authoredAssets");
const { createContentPublication } = require("../contentPublication");
const { createAuthoredBaseline } = require("../authoredContent");
const old = require("./fixtures/content-v2/authored-baseline-v1.json");
const baseline = createAuthoredBaseline({ domains: { decks: old.domains.decks }, game: { modes: old.domains.game } });
const migration = fs.readFileSync(path.join(__dirname, "../../supabase/migrations/20261029212907_immutable_media_library.sql"), "utf8");
function wav(samples = 800, extra = false) {
  const data = Buffer.alloc(samples * 2, 12), body = Buffer.alloc(44 + data.length + (extra ? 16 : 0));
  body.write("RIFF"); body.writeUInt32LE(body.length - 8, 4); body.write("WAVEfmt ", 8); body.writeUInt32LE(16, 16);
  body.writeUInt16LE(1, 20); body.writeUInt16LE(1, 22); body.writeUInt32LE(8000, 24); body.writeUInt32LE(16000, 28); body.writeUInt16LE(2, 32); body.writeUInt16LE(16, 34);
  body.write("data", 36); body.writeUInt32LE(data.length, 40); data.copy(body, 44);
  if (extra) { body.write("LIST", 44 + data.length); body.writeUInt32LE(8, 48 + data.length); body.write("private!", 52 + data.length); }
  return body;
}
async function fixture(t, maxBytes = 1048576) {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema storage; create table storage.objects(bucket_id text, name text); alter table storage.objects enable row level security; grant usage on schema storage to anon,authenticated; grant select,insert on storage.objects to anon,authenticated; create policy permissive on storage.objects for all using(true) with check(true); insert into storage.objects values('gauntlet-admin-media','private'),('other','public');");
  await db.exec(migration); await db.exec(migration);
  const objects = new Map(); let isPublic = false, lost = false;
  async function request(route, options = {}) {
    if (route === "rpc/reserve_gauntlet_media") { const p = JSON.parse(options.body); return (await db.query("select public.reserve_gauntlet_media($1,$2,$3,$4) result", [p.p_sha256,p.p_bytes,p.p_media_type,p.p_limit])).rows[0].result; }
    if (route.startsWith("gauntlet_media_capacity?")) return (await db.query("select max_bytes::float8 from public.gauntlet_media_capacity")).rows;
    return (await db.query("select bytes::float8 from public.gauntlet_media_objects order by sha256 limit 1000 offset $1", [new URLSearchParams(route.split("?")[1]).get("offset")])).rows;
  }
  async function storageRequest(route, options = {}) {
    if (route === `bucket/${BUCKET}`) return { public: isPublic };
    if (route === `object/list/${BUCKET}`) { const p = JSON.parse(options.body); return [...objects].sort().slice(p.offset,p.offset+p.limit).map(([name, bytes]) => ({ name, metadata: { size: bytes.length } })); }
    const key = route.split("/media/")[1];
    if (options.method === "POST") {
      assert.equal(options.headers["x-upsert"], "false");
      if (objects.has(key)) throw new Error("Already exists");
      objects.set(key, Buffer.from(options.body));
      if (lost) { lost = false; throw new Error("Lost response"); }
      return {};
    }
    if (!objects.has(key)) throw Object.assign(new Error("Missing media object"), { status: 503 });
    return objects.get(key);
  }
  return { db, objects, request, mediaStore: createRemoteMediaStore({ request, storageRequest, maxBytes }), public: value => { isPublic = value; }, lose: () => { lost = true; } };
}
const upload = (store, data, extra = {}) => store.uploadAsset({ expectedRevision: store.status().revision, requestId: crypto.randomUUID(), title: "Test media", description: "Isolated fixture", notes: "Private note", data: data.toString("base64"), ...extra }, "admin");
const image = async color => require("sharp")({ create: { width: 32, height: 32, channels: 3, background: color } }).png().toBuffer();
const patch = (store, id) => store.patch({ expectedRevision: store.status().revision, domain: "assets", id: "rumin-coin-scale-spear:standard", field: "art", value: id }, "admin");
async function publish(store, label) { store.preview({ expectedRevision: store.status().revision }); return store.publish({ expectedRevision: store.status().revision, label }, "admin"); }

test("media reservations are atomic, idempotent, capacity bounded and private even with permissive storage policies", async t => {
  const f = await fixture(t), p = { p_sha256: "a".repeat(64), p_bytes: 700000, p_media_type: "image/webp", p_limit: 1048576 };
  await f.db.exec("set role service_role");
  await f.request("rpc/reserve_gauntlet_media", { body: JSON.stringify(p) });
  await f.request("rpc/reserve_gauntlet_media", { body: JSON.stringify(p) });
  await assert.rejects(f.request("rpc/reserve_gauntlet_media", { body: JSON.stringify({ ...p, p_bytes: 1 }) }), /identity mismatch/);
  const results = await Promise.allSettled(["b", "c"].map(char => f.request("rpc/reserve_gauntlet_media", { body: JSON.stringify({ ...p, p_sha256: char.repeat(64), p_bytes: 300000 }) })));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal((await f.db.query("select count(*)::int n from public.gauntlet_media_objects")).rows[0].n, 2);
  await f.db.exec("reset role");
  for (const role of ["anon", "authenticated"]) {
    await f.db.exec(`set role ${role}`);
    await assert.rejects(f.db.query("select * from public.gauntlet_media_objects"), /permission denied/);
    await assert.rejects(f.db.query("select public.reserve_gauntlet_media($1,10,'audio/wav',1048576)", ["d".repeat(64)]), /permission denied/);
    assert.deepEqual((await f.db.query("select name from storage.objects")).rows, [{ name: "public" }]);
    await assert.rejects(f.db.query("insert into storage.objects values('gauntlet-admin-media','leak')"), /row-level security/);
    await f.db.exec("reset role");
  }
});

test("PCM audio strips metadata and rejects malformed, compressed, excessive and disguised content", async () => {
  const clean = processAudio(wav()), stripped = processAudio(wav(800, true));
  assert.equal(clean.data, stripped.data); assert.equal(stripped.metadata.durationMs, 100); assert.notEqual(stripped.metadata.sha256, stripped.metadata.originalSha256);
  for (const change of [b => b.writeUInt16LE(3,20), b => b.writeUInt16LE(3,22), b => b.writeUInt16LE(1,32), b => b.writeUInt32LE(999999,40), b => b.writeUInt32LE(1,4), b => b.writeUInt32LE(999,24)]) {
    const bad = wav(); change(bad); assert.throws(() => processAudio(bad), { status: 422 });
  }
  assert.throws(() => processAudio(wav(8000*601)), { status: 422 });
  assert.throws(() => processAudio(Buffer.from("<script>not audio</script>")), { status: 422 });
});

test("lost upload response, private media access and measured capacity reconcile exact immutable objects", async t => {
  const f = await fixture(t), processed = processAudio(wav()); f.lose();
  const body = Buffer.from(processed.data,"base64"), row = processed.metadata, ref = await f.mediaStore.put(row, body);
  assert.equal(typeof ref, "object"); assert.deepEqual(await f.mediaStore.get(row, ref), body);
  await f.mediaStore.put(row, body); assert.equal(f.objects.size, 1);
  const usage = await f.mediaStore.capacity(); assert.equal(usage.storedBytes, body.length); assert.equal(usage.reservedBytes, body.length);
  f.public(true); await assert.rejects(f.mediaStore.get(row, ref), { status: 503 }); f.public(false);
  f.objects.set(row.sha256, Buffer.from("corrupt")); await assert.rejects(f.mediaStore.get(row, ref), /integrity/);
});

test("remote artwork stays private until released; replacement, rollback, import and restart retain exact bytes", async t => {
  const f = await fixture(t); let store = createContentPublication({ baseline, memory: true });
  const legacy = (await upload(store, await image("red"))).uploaded; patch(store, legacy.id); const r1 = await publish(store, "Legacy artwork");
  const before = store.exportState(); store = createContentPublication({ baseline, memory: true, initialState: before, mediaStore: f.mediaStore });
  await store.migrateAssets({ expectedRevision: before.revision });
  const imported = store.exportState(); assert.deepEqual(imported.releases, before.releases); assert.equal(typeof imported.assetBlobs[legacy.sha256], "object");
  await store.migrateAssets({ expectedRevision: imported.revision }); assert.equal(store.status().revision, imported.revision);
  const b = (await upload(store, await image("blue"), { assetId: legacy.assetId })).uploaded;
  assert.throws(() => store.publicAsset(b.id,b.sha256), { status: 404 });
  assert.equal(assets.digest(Buffer.from((await store.privateAsset(b.id)).data,"base64")), b.sha256);
  patch(store,b.id); await publish(store,"Replacement");
  assert.equal(assets.digest((await store.publicAsset(legacy.id,legacy.sha256)).body),legacy.sha256);
  const pack = assets.packageAssets(store.exportState(),store.published().snapshot); assert.equal(pack.schemaVersion,"gauntlet.asset-package.v2"); assets.validatePackage(pack,store.published().snapshot);
  await store.rollback({ expectedRevision: store.status().revision, releaseId: r1.activeReleaseId },"admin");
  const saved = store.exportState(); store = createContentPublication({ baseline, memory: true, initialState: saved, mediaStore: f.mediaStore });
  assert.equal(store.active().releaseId,r1.activeReleaseId); assert.equal(assets.digest((await store.publicAsset(b.id,b.sha256)).body),b.sha256);
  patch(store,b.id); store.preview({ expectedRevision: store.status().revision }); f.objects.delete(b.sha256);
  await assert.rejects(store.publish({ expectedRevision: store.status().revision, label:"Missing bytes" },"admin"));
  assert.equal(store.active().releaseId,r1.activeReleaseId);
});

test("audio upload uses typed references and cannot replace artwork", async t => {
  const f = await fixture(t), store = createContentPublication({ baseline, memory:true, mediaStore:f.mediaStore });
  const audio = (await upload(store,wav())).uploaded;
  assert.equal(audio.mediaType,"audio/wav"); assert.ok(assets.validateVersions([audio])); assert.match(assets.publicPath(audio),/\.wav$/);
  const selected = (await upload(store, await image("red"))).uploaded;
  await assert.rejects(upload(store,wav(),{ assetId:selected.assetId }), /retain.*kind/);
  assert.equal(store.status().assetLibrary.filter(row=>row.assetId===selected.assetId).length,1);
  assert.equal(patch(store,audio.id).validation.valid,false,"wrong media cannot validate or publish");
  store.discard({ expectedRevision:store.status().revision });
  const encounter = baseline.domains.encounters[0];
  const value = encounter.dialogueAudio.map((entry,index)=>index===0?audio.id:entry);
  store.patch({ expectedRevision:store.status().revision, domain:"encounters", id:encounter.id, field:"dialogueAudio",value },"admin");
  await publish(store,"Audio release");
  assert.equal((await store.publicAsset(audio.id,audio.sha256)).mediaType,"audio/wav");
  assert.match(store.active().manifest.campaigns.rumin.chapters[0].dialogueAudio[0],/\.wav$/);
});
