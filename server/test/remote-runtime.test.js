const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");
const { createRemoteRuntimeStore } = require("../remoteRuntimeStore");
const { createRemoteRoomStateStore } = require("../remoteRoomStateStore");
const { createDurableRoomBoundary } = require("../durableRoomBoundary");
const migration = fs.readFileSync(path.join(__dirname, "../../supabase/migrations/20261029211614_authoritative_runtime_state.sql"), "utf8");

async function database(t) {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(migration); await db.exec(migration);
  const call = async (route, options = {}) => {
    if (route.startsWith("gauntlet_runtime_states?")) return (await db.query("select revision::int, contract, state, updated_at from public.gauntlet_runtime_states where id=$1", [new URLSearchParams(route.split("?")[1]).get("id").slice(3)])).rows;
    const p = JSON.parse(options.body);
    return (await db.query("select public.commit_gauntlet_runtime($1,$2,$3,$4,$5) as result", [p.p_id,p.p_expected_revision,p.p_request_id,p.p_contract,p.p_state])).rows[0].result;
  };
  return { db, call };
}
const room = () => ({ roomCode: "ABC123", lobby: { players: { 1: { socket: "private-socket", connected: true, reconnectToken: "secret" } }, spectators: [] },
  game: { phase: "priority", revision: 4, players: { 1: { hand: [{ id: "hidden" }], deck: [{ id: "next" }] } } },
  duelCommandResults: { action: { fingerprint: "fingerprint", result: { accepted: true } } }, aiMoveDueAt: 1800000000000 });

test("unchanged shutdown and backup checkpoints do not invalidate a replacement process", async t => {
  const { db, call } = await database(t);
  const outgoing = createRemoteRoomStateStore({ request: call });
  await outgoing.loadRooms();
  const initial = await outgoing.saveRooms([]);
  assert.equal(initial.revision, 1); // Initialize even an empty store.
  const incoming = createRemoteRoomStateStore({ request: call });
  assert.deepEqual(await incoming.loadRooms(), []);
  const shutdown = await outgoing.saveRooms([], Date.now() + 1000);
  const backup = await incoming.saveRooms([], Date.now() + 2000);
  for (const receipt of [shutdown, backup]) {
    assert.equal(receipt.unchanged, true);
    assert.equal(receipt.revision, initial.revision);
    assert.equal(new Date(receipt.savedAt).getTime(), new Date(initial.savedAt).getTime());
  }
  assert.equal((await db.query("select count(*)::int n from public.gauntlet_runtime_commits")).rows[0].n, 1);
  const mutation = await incoming.saveRooms([room()]);
  assert.equal(mutation.revision, 2);
  assert.equal(incoming.status().health, "healthy");
});

test("room checkpoint deduplication preserves real conflicts and failed-state blocking", async t => {
  const { call } = await database(t);
  const a = createRemoteRoomStateStore({ request: call });
  await a.loadRooms(); await a.saveRooms([room()]);
  const b = createRemoteRoomStateStore({ request: call });
  const recovered = await b.loadRooms();
  await b.saveRooms(recovered); // Recovery metadata is a real change.
  const unchanged = await b.saveRooms(recovered);
  assert.equal(unchanged.unchanged, true);
  const edited = room(); edited.game.revision++;
  await assert.rejects(a.saveRooms([edited]), { code: "RUNTIME_UNAVAILABLE" });
  // Returning to an earlier payload must not hide an uncertain/stale commit.
  await assert.rejects(a.saveRooms([room()]), { code: "RUNTIME_UNAVAILABLE" });
  assert.equal(a.status().lastSaveFailed, true);
  const fresh = createRemoteRoomStateStore({ request: call });
  assert.equal((await fresh.loadRooms())[0].game.revision, 4);
});

test("PostgreSQL atomically commits runtime state, rejects stale writers and protects private tables", async t => {
  const { db, call } = await database(t);
  await db.exec("set role service_role");
  const a = createRemoteRuntimeStore({ request: call, id: "test", contract: "v1" });
  const b = createRemoteRuntimeStore({ request: call, id: "test", contract: "v1" });
  assert.equal(await a.load(), null); await b.load();
  await a.save({ private: "first" });
  await assert.rejects(b.save({ private: "stale" }), { code: "RUNTIME_UNAVAILABLE" });
  const fresh = createRemoteRuntimeStore({ request: call, id: "test", contract: "v1" });
  assert.deepEqual(await fresh.load(), { private: "first" });
  assert.equal((await db.query("select count(*)::int n from public.gauntlet_runtime_commits")).rows[0].n, 1);
  await assert.rejects(createRemoteRuntimeStore({ request: call, id: "test", contract: "v2" }).load());
  await db.exec("reset role");
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    for (const table of ["gauntlet_runtime_states", "gauntlet_runtime_commits"]) await assert.rejects(db.query(`select * from public.${table}`), /permission denied/);
    await assert.rejects(db.query("select public.commit_gauntlet_runtime('test',1,'00000000-0000-4000-8000-000000000001','v1','{}')"), /permission denied/);
    await db.exec("reset role");
  }
  assert.deepEqual((await db.query("select proname from pg_proc where pronamespace='public'::regnamespace and prosecdef")).rows, []);
});

test("an unknown HTTP outcome reuses the receipt and never double-applies the commit", async t => {
  const { db, call } = await database(t); let lose = true; const bodies = [];
  const store = createRemoteRuntimeStore({ id: "retry", contract: "v1", request: async (route, options) => {
    const result = await call(route, options);
    if (options?.body) { bodies.push(options.body); if (lose) { lose = false; throw new Error("Connection reset after commit"); } }
    return result;
  } });
  await store.load(); const receipt = await store.save({ action: 1 });
  assert.equal(receipt.duplicate, true); assert.equal(bodies[0], bodies[1]);
  const altered = JSON.parse(bodies[0]); altered.p_state.action = 2;
  await assert.rejects(call("rpc/commit_gauntlet_runtime", { body: JSON.stringify(altered) }), /identity reused/);
  assert.equal((await db.query("select count(*)::int n from public.gauntlet_runtime_commits")).rows[0].n, 1);
});

test("fresh room clients recover hidden cards, deck order, decisions, deadlines and command receipts", async t => {
  const { call } = await database(t);
  const first = createRemoteRoomStateStore({ request: call }); await first.loadRooms();
  const active = room(); active.game.pendingDecision = { actor: 1, options: ["yes", "no"], deadline: 1800000000001 };
  const draft = { roomCode: "DRAFT1", lobby: active.lobby, draft: { status: "drafting", unopenedPacks: { 1: [["private-pack"]] }, draftedPools: { 1: ["picked"] } } };
  await first.saveRooms([active, draft]);
  const second = createRemoteRoomStateStore({ request: call }); const restored = await second.loadRooms();
  assert.deepEqual(restored[0].game.players[1].hand, active.game.players[1].hand);
  assert.deepEqual(restored[0].game.players[1].deck, active.game.players[1].deck);
  assert.deepEqual(restored[0].game.pendingDecision, active.game.pendingDecision);
  assert.deepEqual(restored[0].duelCommandResults, active.duelCommandResults);
  assert.equal(restored[0].aiMoveDueAt, active.aiMoveDueAt);
  assert.equal(restored[0].lobby.players[1].socket, null);
  assert.equal(restored[0].lobby.players[1].reconnectToken, "secret");
  assert.deepEqual(restored[1].draft, draft.draft);
});

test("outbox waits for durable commit and serializes operators with timer work", async () => {
  const rooms = new Map([["ABC123", room()]]), delivered = [], order = [];
  let finish;
  const boundary = createDurableRoomBoundary({ rooms, store: { saveRooms: async () => { order.push("commit"); await new Promise(resolve => { finish = resolve; }); } } });
  const first = boundary.run(() => { rooms.get("ABC123").game.revision++; boundary.output(() => delivered.push("state")); boundary.output(() => delivered.push("ack")); });
  const second = boundary.run(() => { order.push("timer"); });
  await new Promise(setImmediate); assert.deepEqual(delivered, []); assert.deepEqual(order, ["commit"]);
  finish(); await Promise.all([first, second]);
  assert.deepEqual(delivered, ["state", "ack"]); assert.deepEqual(order, ["commit", "timer"]);
});

test("failed commit discards success output and stops every following writer", async () => {
  const rooms = new Map([["ABC123", room()]]), messages = [];
  const boundary = createDurableRoomBoundary({ rooms, store: { saveRooms: async () => { throw new Error("DB offline"); } } });
  await assert.rejects(boundary.run(() => { rooms.get("ABC123").game.revision++; boundary.output(() => messages.push("success")); }), /offline/);
  assert.deepEqual(messages, []); assert.equal(boundary.status().blocked, true);
  await assert.rejects(boundary.run(() => assert.fail("must not run")), { code: "RUNTIME_UNAVAILABLE" });
});

test("broadcasts freeze their views before later mutations and asynchronous descendants start new operations", async () => {
  const rooms = new Map([["ABC123", room()]]), delivered = []; let descendant;
  const boundary = createDurableRoomBoundary({ rooms, store: { saveRooms: async () => {} } });
  const adapter = { broadcast: packet => delivered.push(packet) }; boundary.wrapBroadcast(adapter);
  await boundary.run(() => {
    const packet = { data: ["state", { value: 1 }] }; adapter.broadcast(packet, { rooms: new Set(["ABC123"]), except: new Set() }); packet.data[1].value = 9;
    descendant = new Promise(resolve => setImmediate(() => resolve(boundary.run(() => { rooms.get("ABC123").game.revision++; }))));
  });
  await descendant; assert.equal(delivered[0].data[1].value, 1);
});

test("local migration and isolated restore are repeatable, preserve sources and reject destructive destinations", async t => {
  const { call } = await database(t);
  const recovery = require("../remoteRuntimeRecovery");
  const source = { schemaVersion: 1, savedAt: "2026-10-29T00:00:00Z", rooms: [room()] }, before = structuredClone(source);
  assert.equal((await recovery.importLocalRooms({ request: call, checkpoint: source })).readbackVerified, true);
  assert.equal((await recovery.importLocalRooms({ request: call, checkpoint: source })).alreadyImported, true);
  assert.deepEqual(source, before);
  await assert.rejects(recovery.importLocalRooms({ request: call, checkpoint: { ...source, rooms: [] } }), /already exists/);
  const exported = await recovery.exportRuntime({ request: call });
  assert.equal(recovery.validateExport(exported).state.rooms.length, 1);
  await assert.rejects(recovery.restoreRuntime({ request: call, envelope: exported, targetId: "active-rooms" }), /never the live authority/);
  assert.equal((await recovery.restoreRuntime({ request: call, envelope: exported, targetId: "restore-isolated" })).readbackVerified, true);
  assert.equal((await recovery.restoreRuntime({ request: call, envelope: exported, targetId: "restore-isolated" })).alreadyRestored, true);
  const corrupt = structuredClone(exported); corrupt.state.rooms[0].game.revision++;
  assert.throws(() => recovery.validateExport(corrupt), /corrupt/);
});

test("remote backups verify stored bytes, retain status across restart, enforce capacity and restore only isolated scopes",async t=>{
  const {db,call}=await database(t),backup=require("../remoteRuntimeBackups");
  const rooms=createRemoteRoomStateStore({request:call});await rooms.loadRooms();await rooms.saveRooms([room()]);
  const request=(route,options)=>route.includes("id=in.")?db.query("select id,revision::int,contract,state from public.gauntlet_runtime_states where id in ('active-rooms','operational-systems') order by id").then(result=>result.rows):call(route,options);
  const objects=new Map(),storage={put:async(key,body)=>{assert.equal(objects.has(key),false);objects.set(key,Buffer.from(body));},get:async key=>objects.get(key),list:async offset=>[...objects].slice(offset,offset+100).map(([name,body])=>({name,metadata:{size:body.length}}))};
  const service=backup.createRemoteRuntimeBackupService({request,storage,beforeSnapshot:async()=>{},maxBytes:1048576});await service.initialize();
  const done=await service.run();assert.ok(done.lastSuccessfulAt);assert.equal(done.recoveryVerified,false);
  const fresh=backup.createRemoteRuntimeBackupService({request,storage,beforeSnapshot:async()=>{},maxBytes:1048576});await fresh.initialize();assert.equal(fresh.status().objectKey,done.objectKey);
  const body=await storage.get(done.objectKey);assert.equal(backup.validate(done.objectKey,body).records[0].state.rooms[0].game.revision,4);
  const restored=await backup.restore({request,key:done.objectKey,body,prefix:"backup-drill"});assert.equal(restored.scopes[0].id,"restore-backup-drill-active-rooms");assert.equal(restored.scopes[0].readbackVerified,true);
  await backup.restore({request,key:done.objectKey,body,prefix:"backup-drill"});
  await assert.rejects(backup.restore({request,key:done.objectKey,body,prefix:"../active"}),/isolated/);
  const corrupt=Buffer.from(body);corrupt[20]^=1;assert.throws(()=>backup.validate(done.objectKey,corrupt),/integrity/);
  storage.list=async()=>[{name:"retained",metadata:{size:1048576}}];
  await assert.rejects(fresh.run(),/budget reached/);assert.equal(objects.size,1);assert.ok(fresh.status().lastError);
});
