const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const store = require("../accountStore");
test("atomic account writes retain the prior file on failure and reject stale writers", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "account-atomic-")), file = path.join(directory, "accounts.json");
  try {
    const initial = { accounts: [{ id: "one", stats: { economy: { gold: 100 } } }] }; store.save(file, initial);
    const stale = store.read(file), next = store.read(file); next.accounts[0].stats.economy.gold = 70; store.save(file, next);
    assert.throws(() => store.save(file, stale), { status: 409 }); assert.equal(store.read(file).accounts[0].stats.economy.gold, 70);
    const bytes = fs.readFileSync(file), original = fs.renameSync;
    const failure = t.mock.method(fs, "renameSync", (from, to) => { if (to === file) throw new Error("interrupted disk write"); return original(from, to); });
    assert.throws(() => store.save(file, next), /interrupted/); failure.mock.restore(); assert.deepEqual(fs.readFileSync(file), bytes);
    fs.writeFileSync(`${file}.lock`, "in progress"); assert.throws(() => store.save(file, next), { status: 409 }); fs.unlinkSync(`${file}.lock`);
    store.save(file, next); assert.equal(store.read(file).revision, 3);
  } finally { assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep)); fs.rmSync(directory, { recursive: true, force: true }); }
});
test("Postgres guard rejects stale stats and rolls back consequence receipts in the same transaction", async () => {
  const { PGlite } = require("@electric-sql/pglite");
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role; create table public.gauntlet_accounts(id text primary key, stats jsonb); create table public.receipts(id text primary key);");
    await db.exec(fs.readFileSync(path.resolve(__dirname, "../../supabase/migrations/20261013013808_account_stats_concurrency_guard.sql"), "utf8"));
    assert.equal((await db.query("select public.gauntlet_account_write_capability() as ready")).rows[0].ready, 1);
    await db.query("insert into public.gauntlet_accounts values ('one', $1)", [{ economy: { gold: 100 } }]);
    await db.query("update public.gauntlet_accounts set stats=$1 where id='one'", [{ economy: { gold: 70, purchaseReceipts: { purchase: true } } }]);
    const before = (await db.query("select stats from public.gauntlet_accounts")).rows[0].stats; assert.equal(before._accountRevision, 1);
    await assert.rejects(() => db.transaction(async tx => {
      await tx.exec("insert into public.receipts values ('stale-match')");
      await tx.query("update public.gauntlet_accounts set stats=$1 where id='one'", [{ economy: { gold: 100 } }]);
    }), /Account data changed/);
    assert.deepEqual((await db.query("select stats from public.gauntlet_accounts")).rows[0].stats, before);
    assert.equal((await db.query("select * from public.receipts")).rows.length, 0);
    await db.query("update public.gauntlet_accounts set stats=$1 where id='one'", [{ ...before, gamesPlayed: 1 }]);
    assert.equal((await db.query("select stats from public.gauntlet_accounts")).rows[0].stats._accountRevision, 2);
    await db.exec("set role anon"); await assert.rejects(() => db.query("select public.gauntlet_account_write_capability()"), /permission denied/);
  } finally { await db.close(); }
});
