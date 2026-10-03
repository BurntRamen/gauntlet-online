const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { createPlayerMetadataEditor, registerPlayerMetadataRoutes } = require("../adminPlayerMetadata");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-player-metadata-"));
const ids = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "cccccccc-cccc-4ccc-8ccc-cccccccccccc"];
Object.assign(process.env, {
  ACCOUNT_DATA_FILE: path.join(root, "accounts.json"), MATCH_DATA_FILE: path.join(root, "matches.json"),
  MATCH_ARCHIVE_DATA_DIR: path.join(root, "archive"), ROOM_STATE_DATA_FILE: path.join(root, "rooms.json"),
  FACTION_STATS_DATA_FILE: path.join(root, "factions.json"), ROOM_STATE_RECOVERY_ENABLED: "false",
  ACCOUNT_AUTH_SECRET: "isolated-player-metadata-tests", GAUNTLET_ADMIN_SIMPLY_ACCOUNT_ID: ids[0], GAUNTLET_ADMIN_BURNT_RAMEN_ACCOUNT_ID: ids[1]
});
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SECRET_KEY;
const accounts = ["simply", "Burnt Ramen", "Visitor"].map((name, index) => ({
  id: ids[index], name, nameKey: name.toLowerCase(), createdAt: "2026-10-02T12:00:00Z", lastSeenAt: "2026-10-02T13:00:00Z",
  passwordSalt: "metadata-fixture", passwordHash: crypto.pbkdf2Sync("test-password", "metadata-fixture", 150000, 32, "sha256").toString("hex"),
  stats: { gamesWon: 7, progression: { campaign: { rumin: ["brothers-of-destiny"] } }, deckLibrary: { decks: [] }, privateData: "PRIVATE_DATA" }
}));
const { server, __test } = require("../index");
let origin;
const token = (index) => __test.issueAccountSession(structuredClone(accounts[index])).token;
test.before(async () => { await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); origin = `http://127.0.0.1:${server.address().port}`; });
test.beforeEach(() => fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, JSON.stringify({ accounts })));
test.after(async () => { await new Promise((resolve) => server.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); });
const read = () => JSON.parse(fs.readFileSync(process.env.ACCOUNT_DATA_FILE, "utf8")).accounts;
async function patch(body, auth = token(0), id = ids[2]) {
  const response = await fetch(`${origin}/api/admin/players/${id}/metadata`, { method: "PATCH",
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify(body) });
  return { status: response.status, body: response.headers.get("content-type")?.includes("json") ? await response.json() : null, cache: response.headers.get("cache-control") };
}
const edit = (name = "New Visitor", expectedName = "Visitor") => ({ expectedName, metadata: { name } });

test("metadata writes reject guests, ordinary players and forged sessions server-side", async () => {
  for (const [auth, status] of [[null, 401], [token(2), 403], [`${token(0)}tampered`, 401], [__test.issueAccountSession(structuredClone(accounts[0]), 0).token, 401]]) {
    const response = await patch(edit(), auth);
    assert.equal(response.status, status);
    assert.match(response.cache, /no-store/);
  }
  assert.deepEqual(read(), accounts);
});

test("both admins can save names; identities, private data, results and existing sessions are preserved", async () => {
  const saved = await patch(edit());
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body, { player: { id: ids[2], name: "New Visitor" } });
  assert.deepEqual(read()[2], { ...accounts[2], name: "New Visitor", nameKey: "new visitor" });
  const login = await fetch(`${origin}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "New Visitor", password: "test-password" }) });
  assert.equal(login.status, 200);
  const adminSave = await patch(edit("Renamed Admin", "simply"), token(1), ids[0]);
  assert.equal(adminSave.status, 200);
  const access = await fetch(`${origin}/api/admin/access`, { headers: { Authorization: `Bearer ${token(0)}` } });
  assert.equal(access.status, 200);
  assert.equal(read()[0].id, ids[0]);
});

test("validation blocks protected fields, duplicate names and stale edits without changing account data", async () => {
  for (const body of [null, [], {}, { ...edit(), id: ids[0] }, { ...edit(), metadata: { name: "New Visitor", id: ids[0] } }, { ...edit(), metadata: { stats: {} } }, edit("x"), edit("<script>"), edit("x".repeat(25))]) {
    assert.equal((await patch(body)).status, 400);
  }
  assert.equal((await patch(edit(" SIMPLY "))).status, 409);
  assert.equal((await patch(edit("New Visitor", "Old Visitor"))).status, 409);
  assert.equal((await patch(edit(), token(0), "not-an-id")).status, 400);
  assert.equal((await patch(edit(), token(0), "dddddddd-dddd-4ddd-8ddd-dddddddddddd")).status, 404);
  assert.deepEqual(read(), accounts);
});

test("hosted writes use a conditional narrow patch and handle write races and duplicate names", async () => {
  const calls = [];
  let outcome = "saved";
  const update = createPlayerMetadataEditor({ useSupabase: () => true,
    normalizeName: (name) => name.trim().replace(/\s+/g, " "), validName: (name) => /^[A-Za-z0-9 _-]{3,24}$/.test(name),
    request: async (query, options) => {
      calls.push({ query, options });
      if (!options) return [{ id: ids[2], name: "Visitor" }];
      if (outcome === "duplicate") throw Object.assign(new Error("private database diagnostic"), { code: "23505" });
      return outcome === "race" ? [] : [{ id: ids[2], name: "New Visitor" }];
    }
  });
  assert.deepEqual(await update(ids[2], edit(" New   Visitor ")), { id: ids[2], name: "New Visitor" });
  assert.deepEqual(JSON.parse(calls[1].options.body), { name: "New Visitor", name_key: "new visitor" });
  assert.equal(calls[1].options.method, "PATCH");
  assert.equal(calls[1].options.headers.Prefer, "return=representation");
  assert.equal(new URLSearchParams(calls[1].query.split("?")[1]).get("name"), 'eq."Visitor"');
  outcome = "race";
  await assert.rejects(update(ids[2], edit()), (error) => error.status === 409);
  outcome = "duplicate";
  await assert.rejects(update(ids[2], edit()), (error) => error.status === 409 && !error.message.includes("private"));
});

test("storage diagnostics are never returned through the metadata endpoint", async () => {
  let handler;
  registerPlayerMetadataRoutes({ patch: (_path, value) => { handler = value; } }, {
    authorize: () => true, edit: async () => { throw Object.assign(new Error("PRIVATE_DATABASE_DETAIL"), { status: 400 }); }
  });
  const response = { set() {}, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; } };
  await handler({ params: { accountId: ids[2] }, body: edit() }, response);
  assert.equal(response.statusCode, 503);
  assert.equal(JSON.stringify(response.body).includes("PRIVATE_"), false);
});
