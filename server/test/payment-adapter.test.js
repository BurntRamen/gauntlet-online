const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path"), crypto = require("node:crypto"), { DatabaseSync } = require("node:sqlite");
const { createGoldEconomy } = require("../goldEconomy"), { createPaymentService, registerPaymentRoutes } = require("../paymentService"), { paymentTestAdapter } = require("./helpers/paymentTestAdapter"), para = require("../paraLeague"), { hash } = require("../authoredContent");
const buyer = { id: "buyer", createdAt: "2026-01-01T00:00:00.000Z", stats: { economy: { gold: 100, timetwisters: 9 } } }, actor = { id: "operator" }, key = () => crypto.randomUUID();
function fixture(t, { gems = false, adapterOptions = {}, enabled = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-payment-")), file = path.join(root, "ledger.sqlite"), config = para.emptyConfig();
  config.entitlements.push({ ...para.newDefinition("entitlements"), id: "title", name: "Payment title", category: "profile-title", asset: require("../digitalDelivery").TITLE, provenance: "commercial", fulfillment: "available", rightsReference: "Isolated title fixture", duration: "days", durationDays: 1 });
  config.products.push({ ...para.newDefinition("products"), id: "product", name: "Cash product", category: gems ? "gem-credit" : "profile-title", status: "active", entitlements: gems ? [] : ["title"], pricing: "cash", goldPrice: 0, gemPrice: 0, cashPriceMinor: 499, cashCurrency: "usd", gemCredit: gems ? 20 : 0, purchaseLimit: 5, startsAt: "2020-01-01T00:00:00.000Z", endsAt: "2099-01-01T00:00:00.000Z" });
  const options = { filename: file, legacyGoldImport: true, gemsEnabled: enabled, publication: { published: () => ({ id: hash(config), snapshot: { paraLeague: structuredClone(config) } }) } };
  let ledger = createGoldEconomy(options); const adapter = paymentTestAdapter(adapterOptions);
  let service = createPaymentService({ ledger: ledger.payments, adapter });
  t.after(() => { ledger.close(); fs.rmSync(root, { recursive: true, force: true }); });
  const sql = work => { const db = new DatabaseSync(file); try { return work(db); } finally { db.close(); } };
  const event = (order, status = "succeeded", extra = {}) => ({ id: key(), intentId: order.id, checkoutId: `fixture-${order.id}`, status, ...order.payment, occurredAt: new Date().toISOString(), ...extra });
  const send = e => { const signed = adapter.sign(e); return service.webhook(signed.body, signed.headers); };
  const checkout = (extra = {}) => service.checkout(buyer, { key: key(), productId: "product", country: "US", ...extra });
  return { root, file, config, options, sql, adapter, event, send, checkout, get ledger() { return ledger; }, get service() { return service; }, restart(enable = enabled) { ledger.close(); ledger = createGoldEconomy({ ...options, gemsEnabled: enable }); service = createPaymentService({ ledger: ledger.payments, adapter }); } };
}

test("cash configuration is publishable but never activates a missing provider, Gems, tax or live merchant", async t => {
  const f = fixture(t, { gems: true, enabled: false }); assert.equal(para.validateConfig(f.config).valid, true);
  const incomplete = structuredClone(f.config); delete incomplete.products[0].cashCurrency;
  assert.equal(para.validateConfig(incomplete).valid, false); assert.equal(para.catalog(incomplete)[0].price, "Cash price incomplete", "invalid drafts remain reviewable");
  const disabled = createPaymentService({ ledger: f.ledger.payments });
  assert.equal(disabled.status().checkoutsEnabled, false);
  await assert.rejects(disabled.checkout(buyer, {}), /No provider/);
  assert.throws(() => createPaymentService({ ledger: f.ledger.payments, adapter: { ...f.adapter, contract: { ...f.adapter.contract, mode: "live" } } }), /explicit activation/);
  assert.throws(() => createPaymentService({ adapter: { ...f.adapter, contract: { ...f.adapter.contract, taxConfigured: false } } }), /tax-inclusive/);
  await assert.rejects(f.checkout(), /separate Gem/); await assert.rejects(f.checkout({ country: "FR" }), /jurisdiction/);
  assert.equal(f.ledger.wallet(buyer).gold, 100); assert.equal(f.ledger.wallet(buyer).gems, 0); assert.equal(buyer.stats.economy.timetwisters, 9);
  f.config.products[0].pricing = "free"; assert.equal(para.validateConfig(f.config).valid, false, "free Gem funding is forbidden");
  f.config.products[0].pricing = "cash"; f.config.products[0].entitlements = ["title"]; assert.equal(para.validateConfig(f.config).valid, false, "funding cannot hide bundled entitlements");
});

test("verified success grants once; retirement, price changes, duplicate and failed events preserve captured terms", async t => {
  const f = fixture(t), request = { key: key() }, order = await f.checkout(request), e = f.event(order);
  assert.equal(order.status, "pending"); assert.equal(f.ledger.accountGrants(buyer.id).length, 0);
  f.config.products[0].cashPriceMinor = 899; f.config.products[0].status = "archived";
  assert.equal((await f.checkout(request)).id, order.id, "interrupted checkout retains original terms");
  const outcomes = await Promise.all([f.send(e), f.send(e), f.send({ ...e, id: key() })]); outcomes.forEach(o => assert.equal(o.fulfillment, "fulfilled"));
  await f.send(f.event(order, "failed")); await f.send(f.event(order, "pending"));
  const receipts = f.ledger.player(buyer).purchases; assert.equal(receipts.length, 1); assert.equal(receipts[0].payment.amountMinor, 499); assert.equal(receipts[0].payment.denomination, "usd");
  assert.equal(f.ledger.accountGrants(buyer.id).length, 1); assert.equal(f.ledger.wallet(buyer).gold, 100);
  f.restart(); assert.deepEqual(f.ledger.player(buyer).purchases, receipts); assert.equal(f.ledger.payments.intent(order.id).status, "succeeded");
  const backup = path.join(f.root, "restored.sqlite"); require("../../scripts/backup-gold-ledger").backupGoldLedger(f.file, backup);
  const restored = createGoldEconomy({ ...f.options, filename: backup }); try { assert.deepEqual(restored.payments.intent(order.id), f.ledger.payments.intent(order.id)); assert.deepEqual(restored.player(buyer).purchases, receipts); } finally { restored.close(); }
  f.sql(db => { assert.throws(() => db.exec("DELETE FROM gold_payment_events"), /immutable/); assert.throws(() => db.exec("UPDATE gold_payment_intents SET body='{}'"), /immutable/); });
});

test("signatures, delivery freshness, exact price, jurisdiction, event identity and checkout binding fail closed", async t => {
  const f = fixture(t), order = await f.checkout(), event = f.event(order), signed = f.adapter.sign(event);
  await assert.rejects(f.service.webhook(Buffer.from(JSON.stringify({ ...event, amountMinor: 1 })), signed.headers), /signature/);
  await assert.rejects(f.service.webhook(signed.body, { ...signed.headers, "x-fixture-time": "1000000000" }), /stale/);
  for (const extra of [{ amountMinor: 498 }, { currency: "gbp" }, { country: "GB" }, { intentId: "someone-else" }, { accountId: "other" }, { taxMode: "unverified" }, { amountMinor: 4.99 }]) await assert.rejects(f.send(f.event(order, "succeeded", extra)));
  assert.equal(f.ledger.player(buyer).purchases.length, 0);
  await f.send(event); await assert.rejects(f.send({ ...event, status: "refunded" }), /different facts/);
  const other = await f.checkout(); await assert.rejects(f.send(f.event(other, "succeeded", { checkoutId: "wrong-reference" })), /reference differs/);
  assert.equal(f.ledger.payments.intent(other.id).fulfillment, "pending-recovery"); assert.equal(f.ledger.player(buyer).purchases.length, 1);
  assert.equal(f.ledger.payments.intent(other.id).status, "pending", "an event for a different checkout cannot confirm payment");
  await assert.rejects(f.service.operate(actor, { operation: "retry", intentId: other.id, reason: "A stable key is required" }), /stable request key/);
});

test("verified inbox survives a failed atomic grant and restart; reasoned retry fulfills exactly once", async t => {
  const f = fixture(t), order = await f.checkout(), event = f.event(order);
  f.sql(db => db.exec("CREATE TRIGGER fail_paid_delivery BEFORE INSERT ON gold_entitlements BEGIN SELECT RAISE(ABORT,'isolated delivery failure'); END"));
  await assert.rejects(f.send(event), /delivery failure/);
  assert.equal(f.ledger.player(buyer).purchases.length, 0); assert.equal(f.ledger.payments.intent(order.id).status, "succeeded"); assert.equal(f.ledger.payments.intent(order.id).fulfillment, "pending-recovery");
  f.restart(); f.sql(db => db.exec("DROP TRIGGER fail_paid_delivery"));
  const input = { operation: "retry", intentId: order.id, key: key(), reason: "Retry after restoring the captured delivery asset" };
  const result = await f.service.operate(actor, input); assert.match(result.notice, /fulfilled/); assert.deepEqual(await f.service.operate(actor, input), result);
  await f.send(event); assert.equal(f.ledger.player(buyer).purchases.length, 1); assert.equal(f.ledger.accountGrants(buyer.id).length, 1);
  await assert.rejects(f.service.operate(actor, { ...input, reason: "Different command facts" }), /different payment facts/);
  assert.ok(f.ledger.payments.admin().audit.some(a => a.actorId === actor.id && a.reason === input.reason));
});

test("checkout crash after provider creation recovers its stable intent, including an early webhook", async t => {
  let f, originalId, calls = 0;
  f = fixture(t, { adapterOptions: { onCheckout: async intent => {
    calls++; originalId ||= intent.id; assert.equal(intent.id, originalId);
    if (calls === 1) { await f.send(f.event(intent)); throw new Error("isolated crash before local checkout persistence"); }
  } } });
  const request = { key: key() }; await assert.rejects(f.checkout(request), /isolated crash/);
  assert.equal(f.ledger.player(buyer).purchases.length, 0); assert.equal(f.ledger.payments.intent(originalId).pendingEvents, 1);
  f.restart(); const recovered = await f.checkout(request); assert.equal(recovered.id, originalId); assert.equal(recovered.fulfillment, "fulfilled"); assert.equal(calls, 2);
});

test("full refund request is audited but does not revoke until verified; refunds and disputes compensate only their own grants", async t => {
  const f = fixture(t), first = await f.checkout(), second = await f.checkout(); await f.send(f.event(first)); await f.send(f.event(second));
  const purchase = f.ledger.player(buyer).purchases[0]; assert.throws(() => f.ledger.operate(actor, { operation: "refund", purchaseId: purchase.id, key: key(), reason: "Cannot bypass the provider receipt" }), /provider refund/);
  const input = { operation: "refund", intentId: first.id, key: key(), reason: "Customer requests the original full price refund" };
  const request = await f.service.operate(actor, input); assert.match(request.notice, /waits for a verified/); assert.deepEqual(await f.service.operate(actor, input), request);
  assert.equal(f.ledger.accountGrants(buyer.id).filter(g => g.state === "active").length, 2);
  const event = f.event(first, "refunded"); await f.send(event); await f.send(event); await f.send(f.event(first, "succeeded")); await f.send(f.event(first, "disputed"));
  assert.equal(f.ledger.accountGrants(buyer.id).filter(g => g.state === "revoked").length, 1); assert.equal(f.ledger.accountGrants(buyer.id).filter(g => g.state === "active").length, 1);
  assert.equal(f.ledger.admin().refunds.length, 1); assert.equal(f.ledger.payments.intent(first.id).status, "disputed");
  f.restart(); assert.equal(f.ledger.payments.intent(first.id).fulfillment, "compensated");
});

test("out-of-order refund or dispute permanently prevents later success from minting paid assets", async t => {
  const f = fixture(t, { gems: true });
  for (const status of ["refunded", "disputed"]) { const order = await f.checkout(); await f.send(f.event(order, status)); await f.send(f.event(order)); assert.equal(f.ledger.payments.intent(order.id).fulfillment, "compensated"); }
  assert.equal(f.ledger.wallet(buyer).gems, 0); assert.equal(f.ledger.player(buyer).purchases.length, 0);
});

test("funding reversal after spending records Gem debt; Gold and Timetwisters never pay the debt", async t => {
  const f = fixture(t, { gems: true }), order = await f.checkout(); await f.send(f.event(order)); assert.equal(f.ledger.wallet(buyer).gems, 20);
  f.config.products.push({ ...f.config.products[0], id: "gem-title", category: "profile-title", entitlements: ["title"], pricing: "gems", cashPriceMinor: 0, gemCredit: 0, gemPrice: 12 });
  const q = f.ledger.quote(buyer, { productId: "gem-title", key: key() }), p = f.ledger.purchase(buyer, { quoteId: q.id, key: key() });
  await f.send(f.event(order, "disputed")); assert.equal(f.ledger.wallet(buyer).gems, 0); assert.equal(f.ledger.wallet(buyer).gemDebt, 12); assert.equal(f.ledger.wallet(buyer).gold, 100);
  assert.equal(f.ledger.accountGrants(buyer.id)[0].state, "active", "a funding reversal does not blindly revoke unrelated purchases");
  assert.throws(() => f.ledger.purchase(buyer, { quoteId: f.ledger.quote(buyer, { productId: "gem-title", key: key() }).id, key: key() }), /Insufficient Gems/);
  f.restart(false); f.ledger.operate(actor, { operation: "refund", purchaseId: p.id, key: key(), reason: "Refund spent Gem product after funding dispute" });
  assert.equal(f.ledger.wallet(buyer).gemDebt, 0); assert.equal(f.ledger.wallet(buyer).gems, 0); assert.equal(buyer.stats.economy.timetwisters, 9);
});

test("failed compensation remains recoverable without a second refund or reversal", async t => {
  const f = fixture(t, { gems: true }), order = await f.checkout(); await f.send(f.event(order));
  f.sql(db => db.exec("CREATE TRIGGER fail_reverse BEFORE INSERT ON gold_gem_transactions WHEN NEW.kind='funding-reversal' BEGIN SELECT RAISE(ABORT,'isolated reversal failure'); END"));
  const event = f.event(order, "refunded"); await assert.rejects(f.send(event), /reversal failure/); assert.equal(f.ledger.wallet(buyer).gems, 20); assert.equal(f.ledger.admin().refunds.length, 0);
  f.restart(false); f.sql(db => db.exec("DROP TRIGGER fail_reverse")); await f.send(event); await f.send(event); assert.equal(f.ledger.wallet(buyer).gems, 0); assert.equal(f.ledger.admin().refunds.length, 1);
});

test("provider destinations are constrained; duplicate pending checkouts reserve lifetime limits", async t => {
  const f = fixture(t); f.config.products[0].purchaseLimit = 1;
  const broken = { ...f.adapter, createCheckout: async i => ({ checkoutId: i.id, url: "https://untrusted.example/", expiresAt: "2099-01-01T00:00:00.000Z" }) };
  const service = createPaymentService({ ledger: f.ledger.payments, adapter: broken });
  const input = { key: key(), productId: "product", country: "US" }; await assert.rejects(service.checkout(buyer, input), /destination/);
  await assert.rejects(f.checkout(), /limit reached/);
  const recovered = await f.service.operate(actor, { operation: "retry", intentId: f.ledger.payments.account(buyer.id)[0].id, key: key(), reason: "Recover checkout with qualified original adapter" }); assert.match(recovered.notice, /pending/);
  const paused = createPaymentService({ ledger: f.ledger.payments, adapter: f.adapter, acceptCheckouts: false }); await assert.rejects(paused.checkout(buyer, input), /paused/);
  const signed = f.adapter.sign(f.event(f.ledger.payments.account(buyer.id)[0])); await paused.webhook(signed.body, signed.headers); assert.equal(f.ledger.player(buyer).purchases.length, 1);
});

test("separate workers replaying the same verified event cannot duplicate funding", async t => {
  const f = fixture(t, { gems: true }), order = await f.checkout(), event = f.event(order);
  const worker = () => new Promise((resolve, reject) => {
    const program = `const c=JSON.parse(process.env.GAUNTLET_PAYMENT_CONFIG),{createGoldEconomy}=require('./server/goldEconomy'),{createPaymentService}=require('./server/paymentService'),{paymentTestAdapter}=require('./server/test/helpers/paymentTestAdapter'); const l=createGoldEconomy({filename:process.env.GAUNTLET_PAYMENT_FILE,legacyGoldImport:true,gemsEnabled:true,publication:{published:()=>({id:require('./server/authoredContent').hash(c),snapshot:{paraLeague:c}})}}), a=paymentTestAdapter(), s=createPaymentService({ledger:l.payments,adapter:a}), e=a.sign(JSON.parse(process.env.GAUNTLET_PAYMENT_EVENT));s.webhook(e.body,e.headers).then(r=>process.stdout.write(r.fulfillment)).catch(e=>{process.stderr.write(e.message);process.exitCode=1;}).finally(()=>l.close());`;
    const child = require("node:child_process").spawn(process.execPath, ["-e", program], { cwd: path.resolve(__dirname, "../.."), windowsHide: true, env: { ...process.env, GAUNTLET_PAYMENT_CONFIG: JSON.stringify(f.config), GAUNTLET_PAYMENT_FILE: f.file, GAUNTLET_PAYMENT_EVENT: JSON.stringify(event) } });
    let output = "", error = ""; child.stdout.on("data", b => { output += b; }); child.stderr.on("data", b => { error += b; }); child.on("error", reject); child.on("exit", code => code ? reject(new Error(error)) : resolve(output));
  });
  assert.deepEqual(await Promise.all([worker(), worker(), worker()]), ["fulfilled", "fulfilled", "fulfilled"]);
  assert.equal(f.ledger.wallet(buyer).gems, 20); assert.equal(f.ledger.player(buyer).purchases.length, 1); assert.equal(f.ledger.payments.admin().events.length, 1);
});

test("interrupted provider refund retries preserve one command and wait for webhook compensation", async t => {
  const commands = new Set(); let calls = 0;
  const f = fixture(t, { adapterOptions: { onRefund: async (intent, command) => { commands.add(command.id); if (++calls === 1) throw new Error("isolated interruption after provider request"); } } });
  const order = await f.checkout(); await f.send(f.event(order));
  const input = { operation: "refund", intentId: order.id, key: key(), reason: "Retry an interrupted full provider refund request" };
  await assert.rejects(f.service.operate(actor, input), /isolated interruption/); f.restart(); await f.service.operate(actor, input); assert.equal(commands.size, 1);
  assert.equal(f.ledger.accountGrants(buyer.id)[0].state, "active"); await f.send(f.event(order, "refunded")); assert.equal(f.ledger.accountGrants(buyer.id)[0].state, "revoked");
});

test("HTTP uses raw signature bytes, isolates order history, and has no client-success grant route", async t => {
  const f = fixture(t), express = require("express"), app = express();
  app.use("/api/payments/webhook", express.raw({ type: "application/json", limit: "64kb" })); app.use(express.json());
  registerPaymentRoutes(app, f.service, { requireAccount: async (req, res) => { if (!req.headers.authorization) { res.status(401).json({ error: "Sign in" }); return; } return { account: req.headers.authorization === "buyer" ? buyer : { ...buyer, id: "other" } }; } });
  const server = await new Promise(resolve => { const server = app.listen(0, "127.0.0.1", () => resolve(server)); }); t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`, send = (route, body, auth = "buyer", headers = {}) => fetch(url + route, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", Connection: "close", ...(auth ? { Authorization: auth } : {}), ...headers }, ...(body ? { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) } : {}) });
  assert.equal((await send("/api/payments", null, null)).status, 401);
  const response = await send("/api/payments/checkout", { key: key(), productId: "product", country: "US" }), order = (await response.json()).order; assert.equal(response.status, 200);
  assert.equal((await (await send("/api/payments", null, "other")).json()).orders.length, 0);
  assert.equal((await send("/api/payments/success", { intentId: order.id })).status, 404);
  assert.equal((await send("/api/payments/webhook", f.event(order), null)).status, 401); assert.equal(f.ledger.player(buyer).purchases.length, 0);
  const signed = f.adapter.sign(f.event(order)); const paid = await send("/api/payments/webhook", signed.body, null, signed.headers); assert.equal(paid.status, 200); assert.equal(f.ledger.accountGrants(buyer.id).length, 1);
});
