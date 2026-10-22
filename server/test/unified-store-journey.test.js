const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path"), crypto = require("node:crypto");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-unified-store-"));
const accounts = ["simply", "Burnt Ramen", "Buyer"].map((name, i) => ({ id: `${String(i + 1).repeat(8)}-${String(i + 1).repeat(4)}-4aaa-8aaa-${String(i + 1).repeat(12)}`, name, createdAt: "2026-01-01T00:00:00.000Z", stats: { economy: { gold: 100, timetwisters: 10 } } }));
process.env.GAUNTLET_GEMS_ENABLED = "true";
Object.assign(process.env, { NODE_ENV: "test", GAUNTLET_CONTENT_PROVIDER: "file", GAUNTLET_GOLD_MIGRATION: "legacy-opening-v1", ACCOUNT_DATA_FILE: path.join(root, "accounts.json"), MATCH_DATA_FILE: path.join(root, "matches.json"), GAUNTLET_CONTENT_DATA_DIR: path.join(root, "content"), GAUNTLET_ECONOMY_DATA_DIR: path.join(root, "economy"), ACCOUNT_AUTH_SECRET: "unified-store-isolated-secret", ROOM_STATE_RECOVERY_ENABLED: "false", GAUNTLET_ADMIN_SIMPLY_ACCOUNT_ID: accounts[0].id, GAUNTLET_ADMIN_BURNT_RAMEN_ACCOUNT_ID: accounts[1].id });
for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "GAUNTLET_PARA_DATA_DIR"]) delete process.env[key];
fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, JSON.stringify({ accounts }));
const { server, __test } = require("../index"), pub = __test.contentPublication, ledger = __test.goldEconomy;
let origin;
test.before(async () => { await new Promise(r => server.listen(0, "127.0.0.1", r)); origin = `http://127.0.0.1:${server.address().port}`; });
test.after(async () => { await new Promise(r => server.close(r)); ledger.close(); fs.rmSync(root, { recursive: true, force: true }); });
async function api(route, body, who = 0, method = body ? "POST" : "GET") {
  const response = await fetch(origin + route, { method, headers: { "Content-Type": "application/json", Connection: "close", ...(who === null ? {} : { Authorization: `Bearer ${__test.issueAccountSession(accounts[who]).token}` }) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
}
async function admin(action, input = {}, method = "POST") { const r = await api(`/api/admin/authoring/${action}`, { expectedRevision: pub.status().revision, ...input }, 0, method); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data; }
const patch = (domain, id, field, value) => admin("draft", { domain, id, field, value }, "PATCH");
const me = async () => (await api("/api/auth/me", null, 2)).data.account;
async function publish(label) { await admin("preview"); await admin("publish", { label }); }

test("Admin publishes cash Gem definitions without connecting a provider; the real HTTP namespace stays private and disabled", async () => {
  const para = require("../paraLeague"), product = { ...para.newDefinition("products"), id: "adapter-only-credit", name: "Configured Gem credit", category: "gem-credit", status: "active", pricing: "cash", cashPriceMinor: 499, cashCurrency: "usd", gemCredit: 20, startsAt: "2020-01-01T00:00:00.000Z", endsAt: "2099-01-01T00:00:00.000Z" };
  await admin("para-draft", { operation: "create", domain: "products", id: product.id, value: product }); await publish("Adapter-only cash catalog");
  assert.deepEqual(pub.published().snapshot.paraLeague.products[0], product);
  const input = { productId: product.id, country: "US", key: crypto.randomUUID() };
  assert.equal((await api("/api/payments/checkout", input, null)).status, 401);
  const checkout = await api("/api/payments/checkout", input, 2); assert.equal(checkout.status, 503); assert.match(checkout.data.error, /No provider/);
  const readiness = await api("/api/payments", null, 2); assert.equal(readiness.data.status.checkoutsEnabled, false); assert.deepEqual(readiness.data.orders, []);
  assert.equal((await api("/api/admin/economy/payment-operate", { operation: "retry", intentId: "unknown", key: crypto.randomUUID(), reason: "Unauthorized recovery" }, 2)).status, 403);
  for (const operator of [0, 1]) { const view = (await api("/api/admin/economy", null, operator)).data.view; assert.ok(view.tables.find(t => t.title === "Payment readiness").rows[0].includes("Disabled")); }
  assert.equal(ledger.wallet(accounts[2]).gems, 0);
});

test("one Gold authority: operator product, concurrent receipts, historical prices, account projection, retirement, restart and refund", async () => {
  let state = await admin("create", { domain: "decks", name: "Durable recipe", factionId: "rumin" });
  const deckId = state.draft.snapshot.domains.decks.at(-1).id;
  const card = state.live.domains.cards.find(c => c.effect.id === "vault-shield-bearer"), printing = state.live.domains.assets.find(p => p.gameplayCardId === card.id && p.paid);
  await patch("decks", deckId, "composition", { factionId: "rumin", generalId: null, cards: [{ cardId: card.id, printingId: printing.id }] });
  await patch("decks", deckId, "destinations", { player: true, practice: true, encounter: true });
  state = await admin("create", { domain: "offers", name: "Durable product", templateId: deckId });
  const offerId = state.draft.snapshot.domains.offers.at(-1).id;
  await patch("offers", offerId, "prices", { gold: 30, timetwisters: 5 });
  await patch("offers", offerId, "cardBackId", "campaignMap");
  await patch("offers", offerId, "sale", { startsAt: "2020-01-01T00:00:00.000Z", endsAt: "2099-01-01T00:00:00.000Z", purchaseLimit: 3 });
  await patch("offers", offerId, "status", "available");
  await admin("preview"); const session = (await admin("playtest", { subject: { kind: "deck", id: deckId } })).playtest;
  await admin("playtest/command", { id: session.id, gameRevision: session.game.revision, command: { type: "passPriority", player: session.game.priority } });
  await admin("publish", { label: "Unified store terms 1" });
  const offer = pub.active().manifest.deckOffers[0], input = { offerId, revision: offer.revision, currency: "gold", requestId: crypto.randomUUID() };
  const buy = body => api("/api/economy/buy-deck-product", body, 2);
  const before = fs.readFileSync(process.env.ACCOUNT_DATA_FILE);
  const outcomes = await Promise.all([buy(input), buy(input), buy(input)]);
  outcomes.forEach(r => assert.equal(r.status, 200, JSON.stringify(r.data)));
  assert.equal(new Set(outcomes.map(r => r.data.receipt.ledgerPurchaseId)).size, 1);
  assert.deepEqual(fs.readFileSync(process.env.ACCOUNT_DATA_FILE), before, "Gold purchase owns its grant without a second account commit");
  let player = await me(); assert.equal(player.economy.gold, 70); assert.equal(player.economy.timetwisters, 10);
  assert.equal(player.collection.collectorVariants[printing.id], 1); assert.equal(player.stats.deckLibrary.decks.length, 1); assert.ok(!player.stats.ledgerProjection);
  const captured = outcomes[0].data.receipt;
  assert.equal((await api("/api/economy/access", { entitlementId: ledger.player(accounts[2]).grants[0].id }, 1)).status, 403);
  assert.equal((await api("/api/admin/economy/operate", { operation: "refund", purchaseId: captured.ledgerPurchaseId }, 2)).status, 403);
  // Price changes affect only new requests, even when an earlier request retries.
  await patch("offers", offerId, "prices", { gold: 40, timetwisters: 5 }); await publish("Future price 40");
  assert.equal((await buy({ ...input, requestId: crypto.randomUUID() })).status, 409);
  assert.deepEqual((await buy(input)).data.receipt, captured);
  const revised = { ...input, revision: pub.active().manifest.deckOffers[0].revision, requestId: crypto.randomUUID() };
  const twisters = await buy({ ...revised, currency: "timetwisters" }); assert.equal(twisters.status, 200, JSON.stringify(twisters.data));
  player = await me(); assert.equal(player.economy.gold, 70); assert.equal(player.economy.timetwisters, 5); assert.equal(player.collection.collectorVariants[printing.id], 2);
  const second = await buy({ ...revised, requestId: crypto.randomUUID() }); assert.equal(second.status, 200, JSON.stringify(second.data)); assert.equal(second.data.receipt.price, 40);
  assert.equal((await me()).economy.gold, 30);
  assert.equal((await buy({ ...revised, requestId: crypto.randomUUID() })).status, 409, "lifetime limit spans both currencies");
  await patch("offers", offerId, "status", "archived"); await publish("Retired product");
  assert.deepEqual((await buy(input)).data.receipt, captured); assert.equal((await me()).collection.collectorVariants[printing.id], 3);
  const backup = path.join(root, "checkpoint.sqlite"); ledger.backup(backup);
  const restored = require("../goldEconomy").createGoldEconomy({ filename: backup, publication: pub, legacyGoldImport: true });
  assert.equal(restored.player(accounts[2]).balance, 30); assert.equal(restored.accountGrants(accounts[2].id).length, 2); restored.close();
  const restartEconomy = path.join(root, "restart-economy"); fs.mkdirSync(restartEconomy); fs.copyFileSync(backup, path.join(restartEconomy, "economy.sqlite"));
  const child = require("node:child_process").spawnSync(process.execPath, ["-e", `const {server,__test}=require('./server/index'); const a=JSON.parse(require('node:fs').readFileSync(process.env.ACCOUNT_DATA_FILE)).accounts[2]; server.listen(0,'127.0.0.1',async()=>{ const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/auth/me',{headers:{Authorization:'Bearer '+__test.issueAccountSession(a).token}}); process.stdout.write('RESTORED='+JSON.stringify(await r.json())+'\\n'); server.closeAllConnections(); server.close(()=>{__test.goldEconomy.close();process.exitCode=r.ok?0:1;}); });`], { cwd: path.resolve(__dirname, "../.."), env: { ...process.env, GAUNTLET_ECONOMY_DATA_DIR: restartEconomy }, encoding: "utf8", windowsHide: true, timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
  assert.equal(child.status, 0, JSON.stringify({ signal: child.signal, error: child.error?.message || null, stderr: child.stderr }));
  const recovered = JSON.parse(child.stdout.split("\n").find(line => line.startsWith("RESTORED=")).slice(9)).account;
  assert.equal(recovered.economy.gold, 30); assert.equal(recovered.collection.collectorVariants[printing.id], 3); assert.equal(recovered.stats.deckLibrary.decks.length, 3);
  const refund = { operation: "refund", key: "refund-unified-deck", purchaseId: captured.ledgerPurchaseId, reason: "Correct duplicate product selection for isolated test" };
  const refunds = await Promise.all([api("/api/admin/economy/operate", refund, 1), api("/api/admin/economy/operate", refund, 1)]);
  refunds.forEach(r => assert.equal(r.status, 200, JSON.stringify(r.data)));
  player = await me(); assert.equal(player.economy.gold, 60); assert.equal(player.collection.collectorVariants[printing.id], 2);
  assert.ok(player.progression.cosmetics.unlockedCardBacks.includes("campaignMap"), "Timetwister ownership survives Gold refund");
  assert.equal(ledger.admin().refunds.length, 1); assert.equal(ledger.player(accounts[2]).transactions.filter(t => t.kind === "opening-balance").length, 1);
  assert.equal((await api("/api/economy/deck-receipts", null, 2)).data.receipts.length, 3);
  const support = await api(`/api/admin/players?q=${accounts[2].id}`, null, 1); assert.equal(support.status, 200); assert.equal(support.data.players[0].commerce.ledger.balance, 60);
  const twisterRefund = { purchaseRef: `${accounts[2].id}/${twisters.data.receipt.requestId}`, key: crypto.randomUUID(), reason: "Return exact Timetwister purchase after product retirement" };
  assert.equal((await api("/api/admin/economy/refund-deck", twisterRefund, 2)).status, 403);
  const operations = await api("/api/admin/economy", null, 0);
  assert.ok(operations.data.view.forms.find(f => f.action === "refund-deck").fields[0].options.some(([id]) => id === twisterRefund.purchaseRef));
  const failedBefore = fs.readFileSync(process.env.ACCOUNT_DATA_FILE);
  fs.writeFileSync(`${process.env.ACCOUNT_DATA_FILE}.lock`, "isolated competing writer");
  try { assert.equal((await api("/api/admin/economy/refund-deck", twisterRefund, 0)).status, 409); }
  finally { fs.unlinkSync(`${process.env.ACCOUNT_DATA_FILE}.lock`); }
  assert.deepEqual(fs.readFileSync(process.env.ACCOUNT_DATA_FILE), failedBefore, "failed commit cannot credit or revoke partial ownership");
  const reversed = await Promise.all([api("/api/admin/economy/refund-deck", twisterRefund, 0), api("/api/admin/economy/refund-deck", twisterRefund, 0)]);
  reversed.forEach(r => assert.equal(r.status, 200, JSON.stringify(r.data)));
  player = await me(); assert.equal(player.economy.timetwisters, 10); assert.equal(player.economy.gold, 60); assert.equal(player.collection.collectorVariants[printing.id], 1);
  assert.ok(!player.stats.accountCommerce); assert.ok(!player.stats.operatorAudit);
  assert.ok(player.progression.cosmetics.unlockedCardBacks.includes("campaignMap"), "active Gold ownership survives Timetwister refund");
  assert.deepEqual((await buy({ ...revised, currency: "timetwisters" })).data.receipt, twisters.data.receipt, "refunded request retries retain original receipt without granting again");
  assert.equal((await api("/api/admin/economy/refund-deck", { ...twisterRefund, reason: "Changed refund request" }, 0)).status, 409);
  assert.equal((await api("/api/admin/economy/refund-deck", { ...twisterRefund, key: crypto.randomUUID() }, 1)).status, 409);
  const stored = JSON.parse(fs.readFileSync(process.env.ACCOUNT_DATA_FILE)).accounts[2];
  assert.equal(stored.stats.accountCommerce.refunds.length, 1); assert.equal(stored.stats.operatorAudit.filter(r => r.action === "deck-refund").length, 1);
  assert.equal(stored.stats.accountCommerce.refunds[0].amount, 5); assert.equal(stored.stats.accountCommerce.refunds[0].actorId, accounts[0].id);
  const last = await api("/api/admin/economy/operate", { ...refund, key: crypto.randomUUID(), purchaseId: second.data.receipt.ledgerPurchaseId }, 1);
  assert.equal(last.status, 200, JSON.stringify(last.data));
  player = await me(); assert.equal(player.economy.gold, 100); assert.equal(player.collection.collectorVariants[printing.id] || 0, 0);
  assert.ok(!player.progression.cosmetics.unlockedCardBacks.includes("campaignMap"), "all refunded contributions disappear without leaving a phantom base back");
  const restart = require("node:child_process").spawnSync(process.execPath, ["-e", `const a=require('./server/accountStore').read(process.env.ACCOUNT_DATA_FILE).accounts[2]; if(a.stats.economy.timetwisters!==10||a.stats.accountCommerce.refunds.length!==1) process.exitCode=1;`], { cwd: path.resolve(__dirname, "../.."), env: process.env, encoding: "utf8", windowsHide: true, timeout: 10000 });
  assert.equal(restart.status, 0, restart.stderr);
});

test("refund before an account projection write retains recipe knowledge without retaining paid cosmetics", async () => {
  const templateId = pub.status().live.domains.decks.find(d => d.name === "Durable recipe").id;
  const state = await admin("create", { domain: "offers", name: "Refund projection test", templateId });
  const offerId = state.draft.snapshot.domains.offers.at(-1).id;
  await patch("offers", offerId, "prices", { gold: 25, timetwisters: null });
  await patch("offers", offerId, "cardBackId", "campaignMap"); await patch("offers", offerId, "status", "available");
  await admin("preview"); const playtest = (await admin("playtest", { subject: { kind: "deck", id: templateId } })).playtest;
  await admin("playtest/command", { id: playtest.id, gameRevision: playtest.game.revision, command: { type: "passPriority", player: playtest.game.priority } });
  await publish("Refund projection terms");
  const offer = pub.active().manifest.deckOffers.find(o => o.id === offerId), printingId = offer.template.composition.cards[0].printingId;
  const priorFile = fs.readFileSync(process.env.ACCOUNT_DATA_FILE);
  const purchase = await api("/api/economy/buy-deck-product", { offerId, revision: offer.revision, currency: "gold", requestId: crypto.randomUUID() }, 1);
  assert.equal(purchase.status, 200, JSON.stringify(purchase.data));
  const result = await api("/api/admin/economy/operate", { operation: "refund", key: "refund-before-projection-save", purchaseId: purchase.data.receipt.ledgerPurchaseId, reason: "Refund before any account projection write" }, 0);
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.deepEqual(fs.readFileSync(process.env.ACCOUNT_DATA_FILE), priorFile);
  for (let i = 0; i < 2; i++) {
    const account = (await api("/api/auth/me", null, 1)).data.account;
    assert.equal(account.economy.gold, 100);
    assert.equal(account.collection.collectorVariants[printingId] || 0, 0);
    assert.ok(!account.progression.cosmetics.unlockedCardBacks.includes("campaignMap"));
    assert.ok(account.stats.deckLibrary.decks.some(d => d.id === purchase.data.receipt.deckId));
    account.stats.deckLibrary.activeConstructedDeckId = purchase.data.receipt.deckId;
    assert.throws(() => __test.getSavedConstructedDeck(account.stats, null, { competitive: true }), /printing selection is unavailable or not owned/, "A paid printing cannot be used after its only grant is revoked");
  }
});

test("sale windows reject unstarted and ended products before preparation can debit or grant", () => {
  for (const sale of [{ startsAt: "2099-01-01T00:00:00.000Z" }, { endsAt: "2020-01-01T00:00:00.000Z" }]) {
    const account = structuredClone(accounts[2]);
    assert.throws(() => require("../deckCommerce").preparePurchase(account, { offerId: "window", revision: "exact", currency: "gold", requestId: crypto.randomUUID() }, { manifest: { deckOffers: [{ id: "window", revision: "exact", status: "available", sale }] } }, {}), /outside its sale window/);
    assert.deepEqual(account, accounts[2]);
  }
});

test("Gem-priced deck recipes use the same ledger authority and exact revocable printing projection", async () => {
  const db = new (require("node:sqlite").DatabaseSync)(path.join(process.env.GAUNTLET_ECONOMY_DATA_DIR, "economy.sqlite"));
  const funding = { id: crypto.randomUUID(), accountId: accounts[2].id, kind: "funding", delta: 20, currency: "gems", paymentId: "isolated-existing-funding", at: new Date().toISOString() };
  db.prepare("INSERT INTO gold_gem_transactions(id,account_id,kind,delta,body) VALUES(?,?,?,?,?)").run(funding.id, funding.accountId, funding.kind, funding.delta, JSON.stringify(funding)); db.close();
  const templateId = pub.status().live.domains.decks.find(d => d.name === "Durable recipe").id;
  const state = await admin("create", { domain: "offers", name: "Gem recipe", templateId }), offerId = state.draft.snapshot.domains.offers.at(-1).id;
  await patch("offers", offerId, "prices", { gold: null, timetwisters: null, gems: 7 }); await patch("offers", offerId, "status", "available");
  await admin("preview"); const playtest = (await admin("playtest", { subject: { kind: "deck", id: templateId } })).playtest;
  await admin("playtest/command", { id: playtest.id, gameRevision: playtest.game.revision, command: { type: "passPriority", player: playtest.game.priority } }); await publish("Gem recipe terms");
  const offer = pub.active().manifest.deckOffers.find(o => o.id === offerId), input = { offerId, revision: offer.revision, currency: "gems", requestId: crypto.randomUUID() };
  const before = await me(), file = fs.readFileSync(process.env.ACCOUNT_DATA_FILE);
  const results = await Promise.all([api("/api/economy/buy-deck-product", input, 2), api("/api/economy/buy-deck-product", input, 2)]);
  results.forEach(r => assert.equal(r.status, 200, JSON.stringify(r.data)));
  assert.deepEqual(fs.readFileSync(process.env.ACCOUNT_DATA_FILE), file);
  const after = await me(); assert.equal(after.economy.gems, 13); assert.equal(after.economy.gold, before.economy.gold); assert.equal(after.economy.timetwisters, before.economy.timetwisters);
  assert.equal(results[0].data.receipt.currency, "gems"); assert.equal(results[0].data.receipt.price, 7);
  const pid = offer.template.composition.cards[0].printingId;
  assert.equal(after.collection.collectorVariants[pid], Number(before.collection.collectorVariants[pid] || 0) + 1);
  const refunded = await api("/api/admin/economy/operate", { operation: "refund", purchaseId: results[0].data.receipt.ledgerPurchaseId, key: crypto.randomUUID(), reason: "Return exact Gem deck grant" }, 0);
  assert.equal(refunded.status, 200, JSON.stringify(refunded.data)); assert.equal((await me()).economy.gems, 20);
  assert.equal((await me()).collection.collectorVariants[pid] || 0, before.collection.collectorVariants[pid] || 0);
});
