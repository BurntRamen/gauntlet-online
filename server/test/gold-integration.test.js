const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-gold-routes-"));
const accounts = ["simply", "Burnt Ramen", "Player", "Legacy player"].map((name, i) => ({ id: `${String(i + 1).repeat(8)}-${String(i + 1).repeat(4)}-4aaa-8aaa-${String(i + 1).repeat(12)}`, name, createdAt: "2026-01-01T00:00:00.000Z", stats: {} }));
accounts[3].stats = { economy: { gold: 2800, timetwisters: 900, totals: { goldEarned: 3800, goldSpent: 1000 }, purchaseReceipts: { legacy: { amount: 900 } } }, collection: { packCredits: 3 } };
Object.assign(process.env, { GAUNTLET_GOLD_MIGRATION: "legacy-opening-v1", ACCOUNT_DATA_FILE: path.join(root, "accounts.json"), MATCH_DATA_FILE: path.join(root, "matches.json"), MATCH_ARCHIVE_DATA_DIR: path.join(root, "archive"), FACTION_STATS_DATA_FILE: path.join(root, "factions.json"), ROOM_STATE_DATA_FILE: path.join(root, "rooms.json"), GAUNTLET_CONTENT_DATA_DIR: path.join(root, "content"), GAUNTLET_PARA_DATA_DIR: path.join(root, "para"), GAUNTLET_ECONOMY_DATA_DIR: path.join(root, "economy"), ACCOUNT_AUTH_SECRET: "isolated-gold-routes-secret", GAUNTLET_ADMIN_SIMPLY_ACCOUNT_ID: accounts[0].id, GAUNTLET_ADMIN_BURNT_RAMEN_ACCOUNT_ID: accounts[1].id });
delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.SUPABASE_SECRET_KEY;
fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, JSON.stringify({ accounts }));
const { server, __test } = require("../index"), para = require("../paraLeague"), { ANALYSIS } = require("../digitalDelivery");
const { buildMatchRecord } = require("../matchRecords");
const match = buildMatchRecord({ roomCode: "GOLD", matchMetadata: { matchId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", startedAt: "2026-10-01T00:00:00.000Z" }, lobby: { players: { 1: { accountId: accounts[2].id }, 2: { isAI: true } } }, game: { gameMode: "basic", phase: "gameOver", winner: 1, turn: 6, players: { 1: { life: 20 }, 2: { life: 0 } } } }, { completedAt: "2026-10-01T00:05:00.000Z" });
match.completion = { status: "finalized", finalizedAt: match.completedAt }; fs.writeFileSync(process.env.MATCH_DATA_FILE, JSON.stringify({ matches: [match] }));
const tokens = accounts.map((a) => __test.issueAccountSession(a).token); let origin;
test.before(async () => { await new Promise((r) => server.listen(0, "127.0.0.1", r)); origin = `http://127.0.0.1:${server.address().port}`; });
test.after(async () => { await new Promise((r) => server.close(r)); __test.paraRuntime.close(); __test.goldEconomy.close(); fs.rmSync(root, { recursive: true, force: true }); });
async function api(route, input, who = 0) {
  const r = await fetch(origin + route, { method: input ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(who === null ? {} : { Authorization: `Bearer ${tokens[who]}` }) }, ...(input ? { body: JSON.stringify(input) } : {}) });
  return { status: r.status, data: await r.json() };
}
const author = async (action, body = {}) => { const state = (await api("/api/admin/authoring")).data; const result = await api(`/api/admin/authoring/${action}`, { expectedRevision: state.revision, ...body }); assert.equal(result.status, 200, JSON.stringify(result.data)); return result.data; };
const newRow = (domain, row) => author("para-draft", { operation: "create", domain, id: row.id, value: { ...para.newDefinition(domain), ...row } });
test("Gold endpoints preserve two-account Admin authorization and enforce player authentication", async () => {
  for (const route of ["/api/admin/economy", "/api/admin/economy/operate"]) {
    const body = route.endsWith("operate") ? {} : null;
    assert.equal((await api(route, body, null)).status, 401); assert.equal((await api(route, body, 2)).status, 403);
  }
  assert.equal((await api("/api/economy", null, null)).status, 401);
  for (const who of [0, 1]) assert.equal((await api("/api/admin/economy", null, who)).status, 200);
  assert.equal((await api("/api/economy/claim", { key: "test-claim", awardId: "fake", amount: 999999 }, 2)).status, 404);
});
test("Admin-authored published award and real service complete earn-purchase-access-inspect without changing Para or accounts", async () => {
  const beforeAccounts = fs.readFileSync(process.env.ACCOUNT_DATA_FILE), beforeMatch = fs.readFileSync(process.env.MATCH_DATA_FILE), beforePara = __test.paraRuntime.profile(accounts[2].id);
  const window = { startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2099-01-01T00:00:00.000Z" };
  await newRow("seasons", { ...para.seedSeasonZero().seasons[0], id: "test-gold-season", name: "Gold only, no active Para calendar", ...window, goldBudget: 700 });
  await newRow("awards", { id: "test-training", name: "Verified basic training", seasonId: "test-gold-season", status: "active", condition: "basic-training", amount: 700, ...window });
  await newRow("entitlements", { id: "test-analysis-content", name: "Personal evidence analysis", category: "analytics", provenance: "commercial", asset: ANALYSIS, rightsReference: "First-party aggregation of owned canonical matches", fulfillment: "available" });
  await newRow("products", { id: "test-analysis", name: "Personal evidence analysis", category: "analytics", status: "active", entitlements: ["test-analysis-content"], goldPrice: 200, ...window });
  assert.equal((await api("/api/economy/claim", { key: "prepublication", awardId: "test-training" }, 2)).status, 404);
  await author("preview"); const published = await author("publish", { label: "Operational Gold test release" });
  const claim = await api("/api/economy/claim", { key: "verified-training", awardId: "test-training" }, 2); assert.equal(claim.status, 200, JSON.stringify(claim.data)); assert.match(claim.data.view.summary, /^700 Gold/);
  assert.equal((await api("/api/economy/claim", { key: "another-training", awardId: "test-training" }, 2)).status, 409);
  const q = await api("/api/economy/quote", { key: "quote-analysis", productId: "test-analysis" }, 2); assert.equal(q.status, 200);
  const buy = await api("/api/economy/purchase", { key: "buy-analysis", quoteId: q.data.view.forms[0].values.quoteId }, 2); assert.equal(buy.status, 200); assert.match(buy.data.view.summary, /^500 Gold/);
  const entitlementId = buy.data.view.forms.find((f) => f.action === "access").values.entitlementId;
  const access = await api("/api/economy/access", { entitlementId }, 2); assert.equal(access.status, 200); assert.equal(access.data.view.tables[0].rows[0][1], 1);
  assert.equal((await api("/api/economy/access", { entitlementId }, 0)).status, 403);
  const operations = (await api("/api/admin/economy")).data.view; assert.ok(operations.tables.find((t) => t.title === "Purchase receipts").rows[0].includes(published.activeReleaseId));
  assert.deepEqual(fs.readFileSync(process.env.ACCOUNT_DATA_FILE), beforeAccounts); assert.deepEqual(fs.readFileSync(process.env.MATCH_DATA_FILE), beforeMatch); assert.deepEqual(__test.paraRuntime.profile(accounts[2].id), beforePara);
  assert.equal((await api("/api/economy/reconcile", { matchId: match.matchId }, 0)).status, 404);
  assert.equal((await api("/api/economy/reconcile", { matchId: match.matchId }, 2)).status, 200);
});
test("an operator who already has a player ledger can refund using the authoritative account identity", async () => {
  assert.equal((await api("/api/economy", null, 0)).status, 200);
  const purchaseId = __test.goldEconomy.player(accounts[2]).purchases[0].id;
  const refunded = await api("/api/admin/economy/operate", { operation: "refund", key: "refund-as-player-operator", purchaseId, reason: "Integration refund identity check" });
  assert.equal(refunded.status, 200, JSON.stringify(refunded.data)); assert.match(refunded.data.view.summary, /Refunds restored 200/);
  const forbidden = await api("/api/admin/economy/operate", { operation: "adjust", key: "missing-target-id", accountId: "missing-account", delta: 10, reason: "Integration identity check" });
  assert.equal(forbidden.status, 422);
});

test("the migrated player wallet preserves opening Gold and Gems while retiring old earning and purchase routes", async () => {
  const before = fs.readFileSync(process.env.ACCOUNT_DATA_FILE);
  const first = await api("/api/auth/me", null, 3);
  assert.equal(first.status, 200);
  assert.equal(first.data.account.economy.gold, 2800);
  assert.equal(first.data.account.economy.timetwisters, 900);
  assert.equal(first.data.account.economy.source, "finite-gold-ledger");
  assert.deepEqual(first.data.account.economy.daily.quests, []);
  assert.equal((await api("/api/auth/me", null, 3)).data.account.economy.gold, 2800);
  for (const currency of ["gold", "timetwisters"]) assert.equal((await api("/api/economy/buy-gameplay-pack", { currency }, 3)).status, 409);
  assert.equal((await api("/api/economy/timetwister-purchase-link", { productId: "timetwisters-750" }, 3)).status, 409);
  assert.equal((await api("/api/admin/economy/fulfill-timetwisters", { productId: "timetwisters-750", transactionId: "new-cash" }, 0)).status, 409);
  assert.deepEqual(fs.readFileSync(process.env.ACCOUNT_DATA_FILE), before);
  assert.equal(__test.goldEconomy.player(accounts[3]).transactions.filter(t => t.kind === "opening-balance").length, 1);
});
