const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path"), crypto = require("node:crypto"), { DatabaseSync } = require("node:sqlite");
const { createGoldEconomy } = require("../goldEconomy"), para = require("../paraLeague"), pricing = require("../currencyPricing"), { hash } = require("../authoredContent");
const buyer = { id: "buyer", createdAt: "2026-01-01T00:00:00.000Z", stats: { economy: { gold: 100, timetwisters: 900 } } }, actor = { id: "operator" }, key = () => crypto.randomUUID();
function fixture(t, pricingMode = "split", enabled = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-gems-")), file = path.join(root, "ledger.sqlite"), config = para.emptyConfig();
  config.entitlements.push({ ...para.newDefinition("entitlements"), id: "title", name: "Gem keeper", category: "profile-title", asset: require("../digitalDelivery").TITLE, provenance: "commercial", fulfillment: "available", rightsReference: "Isolated title fixture", duration: "days", durationDays: 1 });
  config.products.push({ ...para.newDefinition("products"), id: "product", name: "Future title", category: "profile-title", status: "active", entitlements: ["title"], pricing: pricingMode, goldPrice: pricingMode === "gems" ? 0 : 30, gemPrice: 12, purchaseLimit: 5, startsAt: "2020-01-01T00:00:00.000Z", endsAt: "2099-01-01T00:00:00.000Z" });
  const options = { filename: file, legacyGoldImport: true, gemsEnabled: enabled, publication: { published: () => ({ id: hash(config), snapshot: { paraLeague: structuredClone(config) } }) } };
  let ledger = createGoldEconomy(options); t.after(() => { ledger.close(); fs.rmSync(root, { recursive: true, force: true }); });
  const sql = work => { const db = new DatabaseSync(file); try { return work(db); } finally { db.close(); } };
  // Test fixtures seed preexisting currency evidence, never a public issuance
  // endpoint. Signed payment funding is qualified in its separate adapter suite.
  const seed = (amount = 40) => sql(db => { const row = { id: key(), accountId: buyer.id, kind: "funding", currency: "gems", delta: amount, at: new Date().toISOString(), paymentId: "isolated-funding-fixture" }; db.prepare("INSERT INTO gold_gem_transactions(id,account_id,kind,delta,body) VALUES(?,?,?,?,?)").run(row.id, row.accountId, row.kind, row.delta, JSON.stringify(row)); });
  const quote = currency => ledger.quote(buyer, { key: key(), productId: "product", ...(currency ? { currency } : {}) });
  return { root, file, config, options, sql, seed, quote, get ledger() { return ledger; }, restart(enable = enabled) { ledger.close(); ledger = createGoldEconomy({ ...options, gemsEnabled: enable }); } };
}
test("distinct Gems are opt-in; Gold alternatives stay usable and no Timetwisters are converted", t => {
  const f = fixture(t, "dual", false);
  assert.equal(para.validateConfig(f.config).valid, true);
  assert.equal(f.ledger.wallet(buyer).gems, 0); assert.equal(f.ledger.wallet(buyer).gold, 100); assert.equal(buyer.stats.economy.timetwisters, 900);
  assert.equal(f.quote("gold").payment.gold, 30); assert.throws(() => f.quote("gems"), /payment options/);
  f.config.products[0].pricing = "gems"; f.config.products[0].goldPrice = 0;
  assert.throws(() => f.quote(), /currency is disabled/); assert.equal(f.ledger.player(buyer).catalog[0].available, false);
  assert.throws(() => pricing.select({ pricing: "split", goldPrice: 10, gemPrice: 5 }, "timetwisters", true));
});
test("split debit, grants and refund commit atomically; interrupted fulfillment retries cannot double spend", t => {
  const f = fixture(t); f.seed(); const q = f.quote(), input = { key: key(), quoteId: q.id };
  f.sql(db => db.exec("CREATE TRIGGER fail_delivery BEFORE INSERT ON gold_entitlements BEGIN SELECT RAISE(ABORT,'isolated failure'); END"));
  assert.throws(() => f.ledger.purchase(buyer, input), /isolated failure/);
  assert.equal(f.ledger.wallet(buyer).gold, 100); assert.equal(f.ledger.wallet(buyer).gems, 40); assert.equal(f.ledger.player(buyer).purchases.length, 0);
  f.sql(db => db.exec("DROP TRIGGER fail_delivery"));
  const p = f.ledger.purchase(buyer, input); assert.equal(p.gold, 30); assert.equal(p.gems, 12); assert.equal(p.payment.currency, "split");
  assert.deepEqual(f.ledger.purchase(buyer, input), p); assert.equal(f.ledger.wallet(buyer).gold, 70); assert.equal(f.ledger.wallet(buyer).gems, 28);
  f.restart(false); const refund = { key: key(), operation: "refund", purchaseId: p.id, reason: "Refund exact split payment after disabling new Gem purchases" };
  const result = f.ledger.operate(actor, refund); assert.equal(result.amount, 30); assert.equal(result.gems, 12); assert.deepEqual(f.ledger.operate(actor, refund), result);
  assert.equal(f.ledger.wallet(buyer).gold, 100); assert.equal(f.ledger.wallet(buyer).gems, 40); assert.equal(f.ledger.accountGrants(buyer.id)[0].state, "revoked");
  assert.throws(() => f.ledger.operate(actor, { ...refund, key: key() }), /already refunded/);
  assert.deepEqual(f.ledger.player(buyer).purchases[0], p);
});
test("Gold-or-Gem choices have immutable prices, stale quote rejection, restart and backup evidence", t => {
  const f = fixture(t, "dual"); f.seed(); assert.throws(() => f.quote(), /Choose one/);
  const gem = f.quote("gems"), gold = f.quote("gold");
  const p = f.ledger.purchase(buyer, { key: key(), quoteId: gem.id }); assert.equal(p.gold, 0); assert.equal(p.gems, 12);
  assert.equal(f.ledger.wallet(buyer).gold, 100); assert.equal(f.ledger.wallet(buyer).gems, 28);
  f.config.products[0].gemPrice = 20;
  assert.throws(() => f.ledger.purchase(buyer, { key: key(), quoteId: gold.id }), /stale/); assert.equal(f.quote("gems").payment.gems, 20);
  f.config.products[0].status = "archived"; f.restart(); assert.deepEqual(f.ledger.player(buyer).purchases[0], p);
  const backup = path.join(f.root, "backup.sqlite"); f.ledger.backup(backup); const restored = createGoldEconomy({ ...f.options, filename: backup });
  try { assert.equal(restored.wallet(buyer).gems, 28); assert.deepEqual(restored.player(buyer).purchases[0], p); } finally { restored.close(); }
  f.sql(db => { assert.throws(() => db.exec("UPDATE gold_gem_transactions SET delta=0"), /immutable/); assert.throws(() => db.exec("DELETE FROM gold_gem_transactions"), /immutable/); });
});
test("simultaneous separate processes cannot overspend either component of a split payment", async t => {
  const f = fixture(t); f.seed(20); const quotes = [f.quote(), f.quote()];
  const worker = quote => new Promise(resolve => {
    const program = `const {createGoldEconomy}=require('./server/goldEconomy'); const c=JSON.parse(process.env.GAUNTLET_TEST_GEM_CONFIG), a=JSON.parse(process.env.GAUNTLET_TEST_GEM_ACCOUNT); const e=createGoldEconomy({filename:process.env.GAUNTLET_TEST_GEM_FILE,legacyGoldImport:true,gemsEnabled:true,publication:{published:()=>({id:require('./server/authoredContent').hash(c),snapshot:{paraLeague:c}})}});try{e.purchase(a,{key:process.env.GAUNTLET_TEST_GEM_KEY,quoteId:process.env.GAUNTLET_TEST_GEM_QUOTE});process.stdout.write('purchased');}catch(x){process.stdout.write(x.message);}finally{e.close();}`;
    const child = require("node:child_process").spawn(process.execPath, ["-e", program], { cwd: path.resolve(__dirname, "../.."), windowsHide: true, env: { ...process.env, GAUNTLET_TEST_GEM_CONFIG: JSON.stringify(f.config), GAUNTLET_TEST_GEM_ACCOUNT: JSON.stringify(buyer), GAUNTLET_TEST_GEM_FILE: f.file, GAUNTLET_TEST_GEM_KEY: key(), GAUNTLET_TEST_GEM_QUOTE: quote.id } });
    let output = ""; child.stdout.on("data", b => { output += b; }); child.on("error", e => resolve(String(e))); child.on("exit", () => resolve(output));
  });
  const outcomes = await Promise.all(quotes.map(worker)); assert.equal(outcomes.filter(o => o === "purchased").length, 1, JSON.stringify(outcomes)); assert.ok(outcomes.includes("Insufficient Gems."));
  assert.equal(f.ledger.wallet(buyer).gold, 70); assert.equal(f.ledger.wallet(buyer).gems, 8); assert.equal(f.ledger.player(buyer).purchases.length, 1);
});
