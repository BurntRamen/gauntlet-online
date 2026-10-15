const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");
const { createPrivateAuthoringStore } = require("../privateAuthoringStore");
const { createMatchPersistence } = require("../matchPersistence");
const migration = name => fs.readFileSync(path.join(__dirname, "../../supabase/migrations", name), "utf8");

test("private authoring and full match persistence survive new clients, enforce CAS and deny public access", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create table public.gauntlet_accounts(id uuid primary key, stats jsonb not null default '{}', last_seen_at timestamptz); grant select, update on public.gauntlet_accounts to service_role;");
    await db.exec("create schema storage; create table storage.objects(id text, bucket_id text); alter table storage.objects enable row level security; grant usage on schema storage to anon,authenticated; grant select,insert on storage.objects to anon,authenticated; create policy existing_public_media on storage.objects for all to anon,authenticated using(true) with check(true); insert into storage.objects values ('private','gauntlet-runtime-backups'),('archive','gauntlet-match-archives'),('public','other-public-media');");
    await db.exec(migration("20261013013808_account_stats_concurrency_guard.sql"));
    const sql = migration("20261015032055_durable_match_and_private_authoring.sql");
    await db.exec(sql); await db.exec(sql); // Safe to re-run after an uncertain editor outcome.
    const request = async (route, options = {}) => {
      if (route.startsWith("gauntlet_private_authoring?")) return (await db.query("select revision::int, state from public.gauntlet_private_authoring where id='shared'")).rows;
      if (route.startsWith("gauntlet_match_records?")) return (await db.query("select id from public.gauntlet_match_records limit 1")).rows;
      const input = JSON.parse(options.body);
      if (route === "rpc/save_gauntlet_private_authoring") return (await db.query("select public.save_gauntlet_private_authoring($1,$2)", [input.p_expected_revision, input.p_state])).rows[0];
      if (route === "rpc/finalize_gauntlet_match") return (await db.query("select public.finalize_gauntlet_match($1,$2,$3,$4)", [input.p_record, input.p_events, input.p_consequences, input.p_account_applications])).rows[0];
      throw new Error(`Unexpected route ${route}`);
    };
    await db.exec("set role service_role");
    await db.query("insert into public.gauntlet_faction_stats(id,data) values ('global',$1)", [{ totalGames: 4 }]);
    assert.deepEqual((await db.query("select data from public.gauntlet_faction_stats where id='global'")).rows[0].data, { totalGames: 4 });
    const store = createPrivateAuthoringStore({ request });
    assert.equal(await store.load(), null);
    const envelope = { schemaVersion: "gauntlet.content-store.v1", revision: 7, privateNotes: { secret: "private note" }, assetBlobs: { digest: "private bytes" } };
    await store.save(0, envelope);
    const second = createPrivateAuthoringStore({ request });
    assert.deepEqual(await second.load(), { version: 1, state: envelope });
    await second.save(1, { ...envelope, revision: 8 });
    await assert.rejects(store.save(1, envelope), { status: 409 });
    await assert.rejects(store.save(0, envelope), { status: 409 });
    assert.equal((await store.load()).state.revision, 8);
    await db.exec("reset role");
    const accountId = "11111111-1111-4111-8111-111111111111", matchId = "22222222-2222-4222-8222-222222222222";
    await db.query("insert into public.gauntlet_accounts(id,stats) values ($1,$2)", [accountId, { economy: { gold: 12 } }]);
    await db.exec("set role service_role");
    const record = { matchId, recordVersion: 2, mode: "basic", rulesVersion: "test", contentVersion: "test", ranked: false,
      startedAt: "2026-10-14T00:00:00Z", completedAt: "2026-10-14T00:10:00Z", completionReason: "normal", winnerPlayerNum: 1,
      participants: [{ accountId, playerNum: 1 }], completion: { status: "finalized", consequences: [] },
      auditEvents: [{ sequence: 1, turn: 3, phase: "priority", actorPlayerNum: 1, eventType: "attack", publicPayload: { lane: 1 }, serverTimestamp: "2026-10-14T00:09:00Z", stateChecksum: "checksum" }] };
    const persistence = createMatchPersistence({ useSupabaseStore: () => true, supabaseRequest: request, localStore: { upsert: () => assert.fail("Must not fall back to local storage") } });
    const applications = [{ accountId, result: "win", nextStats: { economy: { gold: 14 }, wins: 1 }, consequence: { wins: 1 } }];
    await persistence.persist(record, { accountApplications: applications });
    await persistence.persist(record, { accountApplications: applications });
    assert.equal((await db.query("select stats from public.gauntlet_accounts")).rows[0].stats._accountRevision, 1);
    assert.equal((await db.query("select count(*)::int as n from public.gauntlet_match_consequence_receipts")).rows[0].n, 1);
    const event = (await db.query("select * from public.gauntlet_match_events")).rows[0];
    assert.equal(event.event_type, "attack"); assert.deepEqual(event.public_payload, { lane: 1 });
    const other = { ...record, matchId: "33333333-3333-4333-8333-333333333333" };
    await assert.rejects(persistence.persist(other, { accountApplications: applications }), /Account data changed/);
    assert.equal((await db.query("select count(*)::int as n from public.gauntlet_match_records")).rows[0].n, 1, "Stale account update rolls back the full match transaction");
    await db.exec("reset role");
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      for (const table of ["gauntlet_faction_stats", "gauntlet_private_authoring", "gauntlet_match_records", "gauntlet_match_events", "gauntlet_match_consequence_receipts", "gauntlet_match_archive_index"]) await assert.rejects(db.query(`select * from public.${table}`), /permission denied/);
      await assert.rejects(db.query("select public.save_gauntlet_private_authoring(2, $1)", [envelope]), /permission denied/);
      await assert.rejects(db.query("select public.finalize_gauntlet_match($1)", [record]), /permission denied/);
      assert.deepEqual((await db.query("select id from storage.objects")).rows, [{ id: "public" }]);
      await assert.rejects(db.query("insert into storage.objects values ('bad','gauntlet-runtime-backups')"), /row-level security/);
      await db.exec("reset role");
    }
    const exposed = await db.query("select proname from pg_proc where pronamespace='public'::regnamespace and prosecdef");
    assert.deepEqual(exposed.rows, [], "No privileged SECURITY DEFINER RPCs introduced");
  } finally { await db.close(); }
});

test("private authoring outages remain private and return sanitized failures", async () => {
  const store = createPrivateAuthoringStore({ request: async () => { throw Object.assign(new Error("secret internal database detail"), { code: "PGRST205" }); } });
  await assert.rejects(store.load(), error => error.status === 503 && !error.message.includes("secret internal"));
  await assert.rejects(store.save(0, {}), { status: 503 });
});
