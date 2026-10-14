const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto");
const { spawn } = require("node:child_process"), { DatabaseSync } = require("node:sqlite");
const { createGoldEconomy } = require("../goldEconomy"), para = require("../paraLeague"), { hash } = require("../authoredContent");
const { ANALYSIS, matchAnalysis } = require("../digitalDelivery");
const account = { id: "account-a", createdAt: "2026-01-01T00:00:00.000Z" }, operator = { id: "operator-a" };
const key = () => crypto.randomUUID();
const window = { startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2027-01-01T00:00:00.000Z" };
function definitions() {
  const c = para.emptyConfig();
  c.seasons.push({ ...para.seedSeasonZero().seasons[0], id: "gold-season", ...window, goldBudget: 1000 });
  for (const [id, condition, amount] of [["welcome", "welcome", 500], ["play", "ordinary-play", 200], ["training", "basic-training", 100], ["faction", "faction-training", 100], ["campaign", "campaign", 100]]) c.awards.push({ ...para.newDefinition("awards"), id, name: id, seasonId: "gold-season", status: "active", condition, amount, minimumOccurrences: 1, claimLimit: id === "play" ? 3 : 1, ...window });
  c.entitlements.push({ ...para.newDefinition("entitlements"), id: "analysis-access", name: "Personal analysis", category: "analytics", provenance: "commercial", fulfillment: "available", asset: ANALYSIS, rightsReference: "First-party calculation of the account's own canonical evidence" });
  c.products.push({ ...para.newDefinition("products"), id: "analysis", name: "Personal analysis", category: "analytics", status: "active", entitlements: ["analysis-access"], pricing: "gold", goldPrice: 300, ...window });
  return c;
}
function fixture(t, overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-gold-test-")), filename = path.join(dir, "economy.sqlite");
  let config = definitions(), clock = "2026-10-12T12:00:00.000Z";
  const release = () => ({ id: hash(config), snapshot: { paraLeague: config } });
  const options = { filename, publication: { published: () => structuredClone(release()) }, now: () => clock, ...overrides };
  let economy = createGoldEconomy(options);
  t.after(() => { economy.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const claim = (awardId = "welcome", requestKey = key()) => economy.claim(account, { key: requestKey, awardId });
  const quote = () => economy.quote(account, { key: key(), productId: "analysis" });
  const buy = () => economy.purchase(account, { key: key(), quoteId: quote().id });
  return { dir, filename, options, release, get economy() { return economy; }, get config() { return config; }, claim, quote, buy,
    publish: (fn) => { config = structuredClone(config); fn(config); }, time: (at) => { clock = at; },
    restart: () => { economy.close(); economy = createGoldEconomy(options); } };
}
function record(overrides = {}) {
  return { matchId: key(), mode: "basic", completedAt: "2026-10-12T12:00:00.000Z", completion: { status: "finalized" }, turnCount: 8,
    participants: [{ playerNum: 1, accountId: account.id, identityType: "account", result: "win", faction: { id: "basic", name: "Basic" } }, { playerNum: 2, accountId: "account-b", identityType: "account", result: "loss" }], ...overrides };
}
test("Gold is opt-in; inactive 4,000 seed and missing published config cannot mint", (t) => {
  const disabled = createGoldEconomy({}); assert.equal(disabled.enabled, false); assert.match(disabled.status().reason, /GAUNTLET_ECONOMY/);
  const seed = para.seedSeasonZero(); assert.equal(para.summary(seed)[0].maximumGold, 4000); assert.ok(seed.awards.every((a) => a.status === "draft"));
  const f = fixture(t); f.publish((c) => c.awards.forEach((a) => { a.status = "draft"; }));
  assert.equal(f.economy.player(account).balance, 0); assert.throws(() => f.claim(), /draft/);
});
test("active definitions validate implemented delivery, rights, windows and Gold-only pricing", () => {
  const c = definitions(); assert.equal(para.validateConfig(c).valid, true);
  for (const mutate of [(c) => { c.entitlements[0].asset = "service:missing"; }, (c) => { c.entitlements[0].rightsReference = ""; }, (c) => { c.entitlements[0].category = "variant-lab"; }, (c) => { c.products[0].startsAt = null; }, (c) => { c.products[0].pricing = "gems"; c.products[0].goldPrice = 0; c.products[0].gemPrice = 100; }, (c) => { c.awards[0].claimLimit = 2; }, (c) => { c.awards[0].amount = 0; }]) { const copy = structuredClone(c); mutate(copy); assert.equal(para.validateConfig(copy).valid, false); }
});
test("initial issuance is finite, exactly once, globally unique and pinned to a release", (t) => {
  const f = fixture(t), k = key(), receipt = f.claim("welcome", k);
  assert.deepEqual(f.claim("welcome", k), receipt); assert.equal(receipt.releaseId, f.release().id);
  assert.throws(() => f.claim("play", k), /different operation/); assert.throws(() => f.claim(), /limit/);
  f.publish((c) => { c.awards[0].amount = 900; c.awards[0].claimLimit = 10; c.seasons[0].goldBudget = 99999; c.awards.push({ ...c.awards[0], id: "welcome-two", claimLimit: 1 }); });
  assert.throws(() => f.claim("welcome-two"), /already claimed/); assert.throws(() => f.claim(), /limit/);
  const p = f.economy.player(account); assert.equal(p.balance, 500); assert.equal(p.seasons[0].budget, 1000); assert.equal(p.awards[0].amount, 500); assert.equal(p.awards[0].currentDefinitionChanged, true);
});
test("only finalized server evidence qualifies; Para, abandoned, self-play and guest games cannot award", (t) => {
  const f = fixture(t);
  for (const r of [record({ para: { eventId: "official" } }), record({ completion: { status: "pending" } }), record({ participants: record().participants.map((p) => ({ ...p, accountId: account.id })) }), record({ participants: record().participants.map((p) => ({ ...p, result: "abandoned" })) }), record({ participants: [record().participants[0], { identityType: "guest", result: "loss" }] })]) f.economy.ingest(r);
  assert.throws(() => f.claim("play"), /verified activity/); assert.equal(f.economy.admin().evidence.length, 0);
  f.economy.ingest(record()); f.claim("play"); assert.equal(f.economy.player(account).balance, 200);
});
test("training and campaign milestones use canonical wins, chapter uniqueness and exact occurrences", (t) => {
  const f = fixture(t), ai = { identityType: "ai", result: "loss" };
  f.publish((c) => { c.awards.find((a) => a.id === "campaign").minimumOccurrences = 2; });
  const training = record({ participants: [record().participants[0], ai] }); f.economy.ingest(training); f.economy.ingest(training); f.claim("training");
  f.economy.ingest(record({ mode: "factions", participants: [record().participants[0], ai] })); f.claim("faction");
  const campaign = { factionId: "rumin", chapterId: "one" };
  f.economy.ingest(record({ campaign, participants: training.participants })); f.economy.ingest(record({ campaign, participants: training.participants })); assert.throws(() => f.claim("campaign"), /verified activity/);
  f.economy.ingest(record({ campaign: { ...campaign, chapterId: "two" }, participants: training.participants })); f.claim("campaign");
  assert.equal(f.economy.player(account).balance, 300);
});
test("account-season cap rejects whole claims, persists across publication, and refunds never reset it", (t) => {
  const f = fixture(t); f.claim();
  for (let i = 0; i < 3; i++) f.economy.ingest(record());
  f.claim("play"); f.claim("play"); assert.throws(() => f.claim("play"), /budget/);
  const p = f.buy(); f.economy.operate(operator, { key: key(), operation: "refund", purchaseId: p.id, reason: "Test purchase refund" });
  assert.throws(() => f.claim("play"), /budget/); assert.equal(f.economy.player(account).seasons[0].issued, 900);
});
test("Gold debits, fulfillment and receipts are atomic; duplicate request and quote have one effect", (t) => {
  const f = fixture(t); f.claim(); const quote = f.quote(), input = { quoteId: quote.id, key: key() };
  const p = f.economy.purchase(account, input); assert.deepEqual(f.economy.purchase(account, input), p);
  assert.throws(() => f.economy.purchase(account, { ...input, key: key() }), /already purchased/);
  assert.equal(f.economy.player(account).balance, 200); assert.equal(f.economy.player(account).grants.length, 1);
  assert.equal(f.economy.access(account, p.entitlementIds[0]).delivery.kind, "analysis");
});
test("failed entitlement insertion rolls back the debit and purchase, then the same key can recover", (t) => {
  const f = fixture(t); f.claim(); const q = f.quote(), input = { key: key(), quoteId: q.id }, db = new DatabaseSync(f.filename);
  db.exec("CREATE TRIGGER simulate_delivery_failure BEFORE INSERT ON gold_entitlements BEGIN SELECT RAISE(ABORT,'simulated storage failure'); END;");
  assert.throws(() => f.economy.purchase(account, input), /simulated storage failure/);
  assert.equal(f.economy.player(account).balance, 500); assert.equal(f.economy.player(account).purchases.length, 0);
  db.exec("DROP TRIGGER simulate_delivery_failure"); db.close(); f.economy.purchase(account, input); assert.equal(f.economy.player(account).balance, 200);
});
test("insufficient funds, stale and expired quotes, expired offers and foreign quotes are rejected", (t) => {
  const f = fixture(t), q = f.quote(); assert.throws(() => f.economy.purchase(account, { key: key(), quoteId: q.id }), /Insufficient/);
  assert.throws(() => f.economy.purchase({ id: "foreign" }, { key: key(), quoteId: q.id }), /unavailable/);
  f.claim(); f.publish((c) => { c.products[0].goldPrice = 400; }); assert.throws(() => f.economy.purchase(account, { key: key(), quoteId: q.id }), /stale/);
  const q2 = f.quote(); f.time("2026-10-12T12:16:00.000Z"); assert.throws(() => f.economy.purchase(account, { key: key(), quoteId: q2.id }), /expired/);
  f.time("2027-01-01T00:00:00.000Z"); assert.throws(() => f.quote(), /offer window/);
});
test("permanent ownership and receipts survive restart, retirement, account identity checks and backup restore", (t) => {
  const f = fixture(t); f.claim(); const p = f.buy(), original = f.economy.player(account);
  f.restart(); assert.deepEqual(f.economy.player(account), original);
  f.publish((c) => { c.products[0].status = "archived"; c.entitlements[0].fulfillment = "unavailable"; });
  assert.equal(f.economy.access(account, p.entitlementIds[0]).delivery.kind, "analysis");
  assert.throws(() => f.economy.access({ id: "stranger" }, p.entitlementIds[0]), /Active owned/);
  assert.throws(() => f.economy.player({ ...account, createdAt: "2099-01-01" }), /identity changed/);
  const backup = path.join(f.dir, "backup.sqlite"); f.economy.backup(backup);
  const recovered = createGoldEconomy({ ...f.options, filename: backup });
  assert.equal(recovered.player(account).balance, 200); assert.equal(recovered.access(account, p.entitlementIds[0]).grant.purchaseId, p.id); recovered.close();
  const { backupGoldLedger } = require("../../scripts/backup-gold-ledger");
  const cliBackup = path.join(f.dir, "operator-backup.sqlite"); assert.equal(backupGoldLedger(f.filename, cliBackup), cliBackup);
  assert.throws(() => backupGoldLedger(f.filename, cliBackup), /new, distinct/);
});
test("timed and season access expire on the server; permanent access prevents repeat acquisitions", (t) => {
  const f = fixture(t); f.publish((c) => { c.entitlements[0].duration = "days"; c.entitlements[0].durationDays = 2; }); f.claim(); const p = f.buy();
  f.time("2026-10-14T12:00:00.000Z"); assert.throws(() => f.economy.access(account, p.entitlementIds[0]), /Active owned/); assert.equal(f.economy.player(account).grants[0].state, "expired");
  f.publish((c) => { c.products[0].purchaseLimit = 2; c.products[0].goldPrice = 100; c.entitlements[0].duration = "season"; c.entitlements[0].durationDays = 0; c.entitlements[0].seasonId = "gold-season"; });
  const seasonal = f.buy(); f.time(window.endsAt); assert.throws(() => f.economy.access(account, seasonal.entitlementIds[0]), /Active owned/);
});
test("refunds and corrections append compensations, revoke access and preserve purchase and season limits", (t) => {
  const f = fixture(t); f.claim(); const p = f.buy();
  const input = { key: key(), operation: "refund", purchaseId: p.id, reason: "Duplicate content correction" };
  const refund = f.economy.operate(operator, input); assert.deepEqual(f.economy.operate(operator, input), refund);
  assert.throws(() => f.economy.operate(operator, { ...input, key: key() }), /already refunded/);
  assert.throws(() => f.buy(), /purchase limit/); assert.throws(() => f.economy.access(account, p.entitlementIds[0]), /Active owned/);
  f.economy.operate(operator, { key: key(), operation: "adjust", accountId: account.id, delta: -100, reason: "Historical correction" }, account);
  assert.throws(() => f.economy.operate(operator, { key: key(), operation: "adjust", accountId: account.id, delta: -500, reason: "Historical correction" }, account), /negative/);
  assert.throws(() => f.economy.operate(operator, { key: key(), operation: "adjust", accountId: account.id, delta: 501, seasonId: "gold-season", reason: "Historical correction" }, account), /budget/);
  const totals = f.economy.admin().totals; assert.deepEqual(totals, { imported: 0, issued: 500, retired: 400, restored: 300, balance: 400, pending: 0 });
});
test("database guards prevent silent rewrites and unsupported schema versions fail closed", (t) => {
  const f = fixture(t); f.claim(); const db = new DatabaseSync(f.filename);
  for (const table of ["transactions", "claims", "accounts", "evidence", "seasons"]) for (const sql of [`DELETE FROM gold_${table}`, `UPDATE gold_${table} SET body='{}'`]) assert.throws(() => db.exec(sql), /immutable/);
  db.close(); const future = path.join(f.dir, "future.sqlite"), next = new DatabaseSync(future); next.exec("PRAGMA user_version=99"); next.close();
  assert.throws(() => createGoldEconomy({ ...f.options, filename: future }), /Unsupported/);
});
test("simultaneous separate processes cannot exceed claim or purchase limits", async (t) => {
  const f = fixture(t, { legacyGoldImport: true }); const configPath = path.join(f.dir, "release.json"); fs.writeFileSync(configPath, JSON.stringify(f.release()));
  const run = (operation, input) => new Promise((resolve, reject) => {
    const code = `const {createGoldEconomy}=require('./server/goldEconomy'); const e=createGoldEconomy({filename:process.argv[1],legacyGoldImport:true,publication:{published:()=>JSON.parse(require('fs').readFileSync(process.argv[2]))},now:()=> '2026-10-12T12:00:00.000Z'});try{e[process.argv[3]](JSON.parse(process.argv[4]),JSON.parse(process.argv[5]));process.stdout.write('ok')}catch(err){process.stdout.write('rejected:'+err.message)}finally{e.close()}`;
    const child = spawn(process.execPath, ["-e", code, f.filename, configPath, operation, JSON.stringify({ ...account, stats: { economy: { gold: 1000 } } }), JSON.stringify(input)], { cwd: path.resolve(__dirname, "../.."), windowsHide: true });
    let output = ""; child.stdout.on("data", (s) => { output += s; }); child.on("error", reject); child.on("exit", (code) => code ? reject(new Error(`Child failed ${code}`)) : resolve(output));
  });
  const claims = await Promise.all(Array.from({ length: 6 }, () => run("claim", { key: key(), awardId: "welcome" })));
  assert.equal(claims.filter((r) => r === "ok").length, 1); assert.equal(f.economy.player(account).balance, 1500);
  assert.equal(f.economy.admin().totals.imported, 1000); assert.equal(f.economy.player(account).transactions.filter(t => t.kind === "opening-balance").length, 1);
  const q = f.quote(); const purchases = await Promise.all(Array.from({ length: 6 }, () => run("purchase", { key: key(), quoteId: q.id })));
  assert.equal(purchases.filter((r) => r === "ok").length, 1); assert.equal(f.economy.player(account).balance, 1200); assert.equal(f.economy.player(account).grants.length, 1);
});
test("analysis computes real owned finalized evidence without gating free history", () => {
  const a = record({ combatStats: { byPlayer: { 1: { damageDealt: 12 } } } });
  const report = matchAnalysis([a, record({ completion: { status: "pending" } }), record({ participants: [{ accountId: "foreign" }] })], account.id);
  assert.equal(report.tables[0].rows[0][1], 1); assert.equal(report.tables[0].rows[0][5], "100%"); assert.equal(report.tables[0].rows[0][7], 12); assert.match(report.summary, /Basic history and replay remain free/);
});
test("permanent delivery cannot be repurchased through another SKU and original content hashes remain pinned", (t) => {
  const f = fixture(t); f.claim(); const p = f.buy();
  f.publish((c) => { c.products.push({ ...c.products[0], id: "same-content", goldPrice: 100 }); });
  const q = f.economy.quote(account, { key: key(), productId: "same-content" });
  assert.throws(() => f.economy.purchase(account, { key: key(), quoteId: q.id }), /already owned/);
  const grant = f.economy.access(account, p.entitlementIds[0]); assert.match(grant.grant.term.delivery.sha256, /^[a-f0-9]{64}$/);
  assert.equal(f.economy.player(account).balance, 200);
});
test("implemented music and cosmetic delivery verifies actual manifest file hashes", () => {
  const { resolveDelivery } = require("../digitalDelivery"), { assetManifest } = require("../contentAssets");
  for (const [media, category, kind] of [["image/", "card-back", "image"], ["audio/", "profile-music", "audio"]]) {
    const asset = assetManifest.entries.find((a) => a.mediaType.startsWith(media));
    const delivery = resolveDelivery({ category, asset: asset.id }); assert.equal(delivery.sha256, asset.sha256); assert.equal(delivery.kind, kind); assert.ok(fs.existsSync(delivery.filename));
  }
  assert.throws(() => resolveDelivery({ category: "digital-publication", asset: "missing" }), /no implemented/);
});
test("draft learning requires distinct human opponents or an AI win, in the published window", (t) => {
  const f = fixture(t); f.publish((c) => { c.awards.push({ ...c.awards[1], id: "draft-learning", condition: "draft-learning", claimLimit: 1 }); });
  const draft = { draftType: "player" };
  f.economy.ingest(record({ draft, completedAt: "2025-01-01T00:00:00.000Z" }));
  f.economy.ingest(record({ draft, participants: record().participants.map((p) => ({ ...p, accountId: account.id })) }));
  assert.throws(() => f.claim("draft-learning"), /verified activity/);
  f.economy.ingest(record({ draft })); f.claim("draft-learning"); assert.throws(() => f.claim("draft-learning"), /limit/);
});

test("legacy Gold imports once outside seasonal caps and preserves original currency history", (t) => {
  const f = fixture(t, { legacyGoldImport: true });
  const legacy = { ...account, stats: { economy: { gold: 1200000, timetwisters: 900, totals: { goldEarned: 1800000, goldSpent: 600000 }, purchaseReceipts: { old: { amount: 900 } } } } };
  const before = JSON.stringify(legacy);
  assert.equal(f.economy.player(legacy).balance, 1200000);
  f.economy.claim(legacy, { key: key(), awardId: "welcome" });
  assert.equal(f.economy.player(legacy).balance, 1200500);
  assert.equal(f.economy.player(legacy).seasons[0].issued, 500);
  assert.equal(JSON.stringify(legacy), before);
  f.restart();
  const later = { ...legacy, stats: { economy: { gold: 9999999 } } };
  assert.equal(f.economy.player(later).balance, 1200500);
  const opening = f.economy.player(later).transactions.filter(row => row.kind === "opening-balance");
  assert.equal(opening.length, 1); assert.deepEqual(opening[0].sourceSnapshot, legacy.stats.economy);
  assert.equal(f.economy.admin().totals.imported, 1200000);
  const backup = path.join(f.dir, "opening-backup.sqlite");
  require("../../scripts/backup-gold-ledger").backupGoldLedger(f.filename, backup);
  const recovered = createGoldEconomy({ ...f.options, filename: backup });
  try { assert.deepEqual(recovered.player(later), f.economy.player(later)); } finally { recovered.close(); }
  const db = new DatabaseSync(f.filename);
  assert.throws(() => db.exec("UPDATE gold_openings SET delta=0"), /immutable/); db.close();
});
test("unapproved or invalid legacy imports fail closed without partial bindings or lost value", (t) => {
  const f = fixture(t), legacy = { ...account, stats: { economy: { gold: 123 } } };
  assert.throws(() => f.economy.player(legacy), /approved opening-balance migration/);
  assert.equal(f.economy.admin().accounts.length, 0);
  const invalid = fixture(t, { legacyGoldImport: true });
  for (const gold of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, "500"]) assert.throws(() => invalid.economy.player({ ...account, stats: { economy: { gold } } }), /invalid/);
  assert.equal(invalid.economy.admin().totals.balance, 0);
});

test("version 1 ledger upgrades without rewriting its receipts or grants", (t) => {
  const f = fixture(t); f.claim(); const purchase = f.buy();
  // A version 1 database predates the separate opening-balance table.
  const legacyFile = path.join(f.dir, "v1.sqlite"); f.economy.backup(legacyFile);
  const db = new DatabaseSync(legacyFile); db.exec("DROP TABLE gold_openings; PRAGMA user_version=1"); db.close();
  const upgraded = createGoldEconomy({ ...f.options, filename: legacyFile });
  try {
    assert.equal(upgraded.player(account).balance, 200);
    assert.deepEqual(upgraded.player(account).purchases, [purchase]);
    assert.equal(upgraded.access(account, purchase.entitlementIds[0]).delivery.kind, "analysis");
    assert.equal(upgraded.player(account).transactions.filter(row => row.kind === "opening-balance").length, 1);
  } finally { upgraded.close(); }
});

test("existing legacy runs retain their rewards before the finite wallet opens", (t) => {
  const f = fixture(t, { legacyGoldImport: true });
  const { EVENT_DEFINITIONS, applyEventResult } = require("../events"), event = EVENT_DEFINITIONS[0];
  const legacy = { ...account, stats: { economy: { gold: 1200 }, events: { runs: { [event.id]: { id: "existing-run", eventId: event.id, status: "active", wins: 0, losses: 0, claimedTiers: [] } } } } };
  assert.equal(f.economy.wallet(legacy).source, "legacy-event-settlement");
  assert.throws(() => f.economy.player(legacy), /Finish or resign/);
  assert.equal(f.economy.admin().accounts.length, 0);
  const result = applyEventResult(legacy.stats, event.id, "existing-run", "win");
  legacy.stats.events = result.progress;
  legacy.stats.economy.gold += result.rewards.reduce((sum, row) => sum + row.gold, 0);
  legacy.stats.events.runs[event.id].status = "complete";
  assert.equal(f.economy.player(legacy).balance, 1700);
  assert.equal(f.economy.player(legacy).seasons[0].issued, 0);
});

test("credits cannot overflow an imported exact-integer balance", (t) => {
  const f = fixture(t, { legacyGoldImport: true }), legacy = { ...account, stats: { economy: { gold: Number.MAX_SAFE_INTEGER } } };
  assert.equal(f.economy.player(legacy).balance, Number.MAX_SAFE_INTEGER);
  assert.throws(() => f.economy.claim(legacy, { key: key(), awardId: "welcome" }), /integer range/);
  assert.equal(f.economy.player(legacy).balance, Number.MAX_SAFE_INTEGER);
  assert.equal(f.economy.admin().claims.length, 0);
});
