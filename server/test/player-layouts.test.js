const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  createPlayerLayoutStore,
  emptyLayoutPreferences,
  validateLayoutPreferences,
  validateLayoutUpdate
} = require("../playerLayouts");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-player-layouts-"));
process.env.ACCOUNT_DATA_FILE = path.join(directory, "accounts.json");
process.env.ACCOUNT_LAYOUT_DATA_FILE = path.join(directory, "account-layouts.json");
process.env.SUPABASE_URL = "";
process.env.SUPABASE_SECRET_KEY = "";
process.env.SUPABASE_SERVICE_ROLE_KEY = "";

const accounts = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Same Name", stats: { gamesWon: 3, balance: 45 } },
  { id: "22222222-2222-4222-8222-222222222222", name: "Same Name", stats: { gamesWon: 1, balance: 10 } }
];
fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, JSON.stringify({ accounts }));
const { server, __test } = require("../index");
let address;
test.before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  address = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  // Remove only the directory made by this test, never an environment path.
  assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
  assert.ok(path.basename(directory).startsWith("gauntlet-player-layouts-"));
  fs.rmSync(directory, { recursive: true, force: true });
});

const preferences = (order = ["ranked", "basic-ai"], hidden = ["recent-matches"]) => ({
  version: 1, pages: { play: { order, hidden } }
});

test("client and server share the same optional module contract, including published campaign factions", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../../client/src/navigation/layoutRegistry.js"), "utf8");
  const client = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  const { layoutModuleAllowlist } = require("../playerLayouts");
  client.registerCampaignLayoutModules(["rumin", "new-faction", "rumin", "NOT-VALID", "unsafe/id"]);
  const serverModules = layoutModuleAllowlist(["rumin", "new-faction", "rumin", "NOT-VALID", "unsafe/id"]);
  assert.deepEqual(client.LAYOUT_PAGES, Object.keys(serverModules));
  for (const pageId of client.LAYOUT_PAGES) assert.deepEqual(client.getLayoutModuleIds(pageId), serverModules[pageId]);
});
const token = (index) => __test.issueAccountSession(structuredClone(accounts[index])).token;
async function request(index, body, query = "") {
  const response = await fetch(`${address}/api/account/layouts${query}`, {
    method: body === undefined ? "GET" : "PUT",
    headers: { ...(index === null ? {} : { Authorization: `Bearer ${token(index)}` }), "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { response, body: await response.json() };
}

test("versioned layout schema drops retired IDs, duplicates, unknown pages and critical controls", () => {
  const result = validateLayoutPreferences({
    version: 1,
    pages: {
      play: { order: ["retired", "ranked", "ranked", "basic-ai"], hidden: ["active-match", "queue", "invitations", "ranked"] },
      campaign: { order: ["faction-published", "faction-unknown", "tutorial"], hidden: ["faction-published"] },
      gameplay: { order: ["concede"], hidden: ["life-total"] }
    }
  }, ["published"]);
  assert.deepEqual(result, {
    version: 1,
    pages: {
      play: { order: ["ranked", "basic-ai"], hidden: ["ranked"] },
      campaign: { order: ["faction-published", "tutorial"], hidden: ["faction-published"] }
    }
  });
  assert.deepEqual(validateLayoutPreferences(JSON.parse('{"version":1,"pages":{"__proto__":{"order":[],"hidden":[]}}}')), emptyLayoutPreferences());
});

test("malformed, oversized, unsupported and ownership-changing updates are rejected", () => {
  const invalid = [
    null, [], {},
    { revision: -1, preferences: preferences() },
    { revision: "0", preferences: preferences() },
    { revision: Number.MAX_SAFE_INTEGER, preferences: preferences() },
    { revision: 0, preferences: { version: 2, pages: {} } },
    { revision: 0, preferences: { version: 1, pages: [] } },
    { revision: 0, preferences: { version: 1, pages: { play: { order: "ranked", hidden: [] } } } },
    { revision: 0, preferences: { version: 1, pages: { play: { order: [null], hidden: [] } } } },
    { revision: 0, preferences: { version: 1, pages: { play: { order: Array(65).fill("ranked"), hidden: [] } } } },
    { revision: 0, preferences: { version: 1, pages: { play: { order: [], hidden: [], currency: 999 } } } },
    { revision: 0, accountId: accounts[1].id, preferences: preferences() }
  ];
  for (const value of invalid) assert.throws(() => validateLayoutUpdate(value), { name: "Error" });
});

test("layout endpoint requires an authenticated existing account", async () => {
  const guest = await request(null);
  assert.equal(guest.response.status, 401);
  const response = await fetch(`${address}/api/account/layouts`, {
    headers: { Authorization: `Bearer ${__test.issueAccountSession({ id: "33333333-3333-4333-8333-333333333333", name: "Missing", stats: {} }).token}` }
  });
  assert.equal(response.status, 401);
  assert.equal(fs.existsSync(process.env.ACCOUNT_LAYOUT_DATA_FILE), false);
});

test("authenticated layouts use stable account IDs, persist on restart, and leave gameplay account data unchanged", async () => {
  const beforeAccounts = fs.readFileSync(process.env.ACCOUNT_DATA_FILE, "utf8");
  const initial = await request(0);
  assert.equal(initial.response.status, 200);
  assert.equal(initial.response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(initial.body, { revision: 0, preferences: emptyLayoutPreferences() });
  const saved = await request(0, { revision: 0, preferences: preferences() });
  assert.equal(saved.response.status, 200);
  assert.deepEqual(saved.body, { revision: 1, preferences: preferences() });
  const other = await request(1, undefined, `?accountId=${accounts[0].id}`);
  assert.deepEqual(other.body, { revision: 0, preferences: emptyLayoutPreferences() });
  const forgedOwner = await request(1, { accountId: accounts[0].id, revision: 1, preferences: preferences(["campaign"]) });
  assert.equal(forgedOwner.response.status, 400);
  const reopenedStore = createPlayerLayoutStore({ filePath: process.env.ACCOUNT_LAYOUT_DATA_FILE });
  assert.deepEqual(await reopenedStore.get(accounts[0].id), saved.body);
  assert.equal(fs.readFileSync(process.env.ACCOUNT_DATA_FILE, "utf8"), beforeAccounts);
  // Simulate an unrelated old account snapshot being saved by gameplay.
  fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, beforeAccounts);
  assert.deepEqual((await request(0)).body, saved.body);
});

test("stale and concurrent revisions cannot overwrite confirmed account layouts", async () => {
  const current = (await request(0)).body;
  const attempts = await Promise.all([
    request(0, { revision: current.revision, preferences: preferences(["campaign"]) }),
    request(0, { revision: current.revision, preferences: preferences(["draft"]) })
  ]);
  assert.deepEqual(attempts.map(({ response }) => response.status).sort(), [200, 409]);
  const saved = attempts.find(({ response }) => response.status === 200).body;
  const rejected = attempts.find(({ response }) => response.status === 409).body;
  assert.equal(rejected.revision, saved.revision);
  assert.deepEqual(rejected.preferences, saved.preferences);
  assert.deepEqual((await request(0)).body, saved);
  const malformed = await request(0, { revision: saved.revision, preferences: { version: 3, pages: {} } });
  assert.equal(malformed.response.status, 400);
  assert.deepEqual((await request(0)).body, saved);
});

test("page and all-layout resets change only layouts and preserve the other account", async () => {
  const other = await request(1, { revision: 0, preferences: { version: 1, pages: { decks: { order: ["packs", "editor"], hidden: ["collection"] } } } });
  const current = (await request(0)).body;
  const multi = { version: 1, pages: { ...preferences().pages, learn: { order: ["practice"], hidden: ["lore"] } } };
  const saved = await request(0, { revision: current.revision, preferences: multi });
  delete multi.pages.play;
  const oneReset = await request(0, { revision: saved.body.revision, preferences: multi });
  assert.deepEqual(oneReset.body.preferences.pages, { learn: { order: ["practice"], hidden: ["lore"] } });
  const allReset = await request(0, { revision: oneReset.body.revision, preferences: emptyLayoutPreferences() });
  assert.equal(allReset.response.status, 200);
  assert.deepEqual(allReset.body.preferences, emptyLayoutPreferences());
  assert.deepEqual((await request(1)).body, other.body);
  assert.deepEqual(JSON.parse(fs.readFileSync(process.env.ACCOUNT_DATA_FILE, "utf8")).accounts, accounts);
});

test("corrupt local storage fails safely without replacing saved preferences", async () => {
  const filename = path.join(directory, "corrupt-layouts.json");
  fs.writeFileSync(filename, "{broken");
  const store = createPlayerLayoutStore({ filePath: filename });
  await assert.rejects(store.get(accounts[0].id));
  await assert.rejects(store.put(accounts[0].id, { revision: 0, preferences: preferences() }));
  assert.equal(fs.readFileSync(filename, "utf8"), "{broken");
});

test("layout writes respect an existing cross-process transaction lock", async () => {
  const filename = path.join(directory, "locked-layouts.json");
  const store = createPlayerLayoutStore({ filePath: filename });
  await store.put(accounts[0].id, { revision: 0, preferences: preferences() });
  fs.writeFileSync(`${filename}.lock`, "");
  try {
    await assert.rejects(store.put(accounts[0].id, { revision: 1, preferences: emptyLayoutPreferences() }), { code: "LAYOUT_STORAGE_BUSY" });
    assert.deepEqual(await store.get(accounts[0].id), { revision: 1, preferences: preferences() });
  } finally { fs.unlinkSync(`${filename}.lock`); }
  const saved = await store.put(accounts[0].id, { revision: 1, preferences: emptyLayoutPreferences() });
  assert.equal(saved.revision, 2);
  assert.equal(fs.existsSync(`${filename}.lock`), false);
});

test("layout sidecars participate in the existing private runtime backup and restore", async () => {
  const { runtimeStorageConfig, MARKER, SCHEMA } = require("../runtimeStorage");
  const { snapshot, restoreBackup } = require("../runtimeBackups");
  const root = path.join(directory, "volume");
  fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, MARKER), JSON.stringify({ schemaVersion: SCHEMA, id: accounts[0].id }));
  const config = runtimeStorageConfig({ GAUNTLET_RUNTIME_DATA_DIR: root });
  const store = createPlayerLayoutStore({ filePath: config.paths.layouts });
  await store.put(accounts[0].id, { revision: 0, preferences: preferences() });
  const archive = snapshot(config);
  const restored = path.join(directory, "restored-volume");
  assert.equal(restoreBackup(archive.key, archive.body, restored).files, 1);
  const reopened = createPlayerLayoutStore({ filePath: runtimeStorageConfig({ GAUNTLET_RUNTIME_DATA_DIR: restored }).paths.layouts });
  assert.deepEqual(await reopened.get(accounts[0].id), { revision: 1, preferences: preferences() });
});

test("migration executes locally, isolates client roles, validates schema, and compares revisions atomically", async () => {
  const { PGlite } = require("@electric-sql/pglite");
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create table public.gauntlet_accounts (id uuid primary key);");
    const sql = fs.readFileSync(path.join(__dirname, "../migrations/command-deck-layouts.sql"), "utf8");
    await db.exec(sql);
    await db.exec(sql);
    const permissions = (await db.query("select has_table_privilege('anon', 'public.gauntlet_account_layouts', 'SELECT') as anon_read, has_table_privilege('authenticated', 'public.gauntlet_account_layouts', 'UPDATE') as client_write, has_table_privilege('service_role', 'public.gauntlet_account_layouts', 'UPDATE') as server_write, relrowsecurity as rls from pg_class where oid = 'public.gauntlet_account_layouts'::regclass")).rows[0];
    assert.deepEqual(permissions, { anon_read: false, client_write: false, server_write: true, rls: true });
    await db.query("insert into public.gauntlet_accounts(id) values ($1),($2)", accounts.map((account) => account.id));
    await db.exec("set role service_role");
    await db.query("insert into public.gauntlet_account_layouts(account_id, revision, preferences) values ($1, 1, $2)", [accounts[0].id, JSON.stringify(preferences())]);
    const first = await db.query("update public.gauntlet_account_layouts set revision = 2 where account_id = $1 and revision = 1 returning revision", [accounts[0].id]);
    const stale = await db.query("update public.gauntlet_account_layouts set revision = 2 where account_id = $1 and revision = 1 returning revision", [accounts[0].id]);
    assert.equal(first.rows.length, 1);
    assert.equal(stale.rows.length, 0);
    for (const invalid of [{}, { version: 2, pages: {} }, { version: 1, pages: [] }]) {
      await assert.rejects(db.query("insert into public.gauntlet_account_layouts(account_id, revision, preferences) values ($1, 1, $2)", [accounts[1].id, JSON.stringify(invalid)]), /check constraint/);
    }
    await db.exec("reset role; set role anon");
    await assert.rejects(db.query("select * from public.gauntlet_account_layouts"), /permission denied/);
    await db.exec("reset role; set role authenticated");
    await assert.rejects(db.query("select * from public.gauntlet_account_layouts"), /permission denied/);
  } finally { await db.close(); }
});

function fakeSupabase() {
  const rows = new Map();
  const requests = [];
  async function supabaseRequest(endpoint, options = {}) {
    requests.push({ endpoint, ...options });
    const url = new URL(endpoint, "https://example.invalid/");
    assert.equal(url.pathname, "/gauntlet_account_layouts");
    const method = options.method || "GET";
    if (method === "POST") {
      const next = JSON.parse(options.body);
      if (rows.has(next.account_id)) throw Object.assign(new Error("duplicate key"), { status: 409, code: "23505" });
      rows.set(next.account_id, next);
      return [structuredClone(next)];
    }
    const id = url.searchParams.get("account_id").slice(3);
    const row = rows.get(id);
    if (method === "GET") return row ? [structuredClone(row)] : [];
    assert.equal(method, "PATCH");
    assert.equal(options.headers.Prefer, "return=representation");
    const expected = Number(url.searchParams.get("revision").slice(3));
    if (!row || row.revision !== expected) return [];
    Object.assign(row, JSON.parse(options.body));
    return [structuredClone(row)];
  }
  return { supabaseRequest, requests };
}

test("cloud persistence uses conditional writes for cross-device conflicts, including simultaneous first saves", async () => {
  const backend = fakeSupabase();
  const createStore = () => createPlayerLayoutStore({ useSupabase: () => true, supabaseRequest: backend.supabaseRequest });
  const deviceA = createStore();
  const deviceB = createStore();
  const id = accounts[0].id;
  const initial = await deviceA.get(id);
  assert.deepEqual(initial, { revision: 0, preferences: emptyLayoutPreferences() });
  const first = await Promise.all([
    deviceA.put(id, { revision: 0, preferences: preferences(["ranked"]) }),
    deviceB.put(id, { revision: 0, preferences: preferences(["draft"]) })
  ]);
  assert.deepEqual(first.map(({ conflict }) => conflict), [false, true]);
  assert.deepEqual(first[0].preferences, first[1].preferences);
  const next = await Promise.all([
    deviceA.put(id, { revision: 1, preferences: preferences(["campaign"]) }),
    deviceB.put(id, { revision: 1, preferences: preferences(["basic-ai"]) })
  ]);
  assert.deepEqual(next.map(({ conflict }) => conflict), [false, true]);
  assert.deepEqual(await createStore().get(id), { revision: 2, preferences: preferences(["campaign"]) });
  assert.deepEqual(await deviceB.get(accounts[1].id), { revision: 0, preferences: emptyLayoutPreferences() });
  assert.equal(backend.requests.some(({ endpoint }) => endpoint.includes("gauntlet_accounts")), false);
});

test("cloud failure or missing write confirmation never claims a sync or falls back to local storage", async () => {
  const filename = path.join(directory, "forbidden-fallback.json");
  const unavailable = createPlayerLayoutStore({
    filePath: filename, useSupabase: () => true,
    supabaseRequest: async () => { throw Object.assign(new Error("missing migration"), { code: "PGRST205" }); }
  });
  await assert.rejects(unavailable.get(accounts[0].id), /missing migration/);
  await assert.rejects(unavailable.put(accounts[0].id, { revision: 0, preferences: preferences() }), /missing migration/);
  assert.equal(fs.existsSync(filename), false);
  const unconfirmed = createPlayerLayoutStore({ useSupabase: () => true, supabaseRequest: async () => null });
  await assert.rejects(unconfirmed.put(accounts[0].id, { revision: 0, preferences: preferences() }), /could not be confirmed/);
});
