"use strict";
const fail = (message, status = 422) => { throw Object.assign(new Error(message), { status }); };
const token = value => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,150}$/.test(value);
const iso = value => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

// Adapter contract v1: methods createCheckout(intent), verifyWebhook(raw,
// headers), requestRefund(intent, command). Each outbound operation MUST honor
// the supplied intent/command ID as its provider idempotency key. The verifier
// authenticates bytes and delivery freshness before returning a normalized
// event. A future provider must qualify these guarantees, not just implement
// the method names. No production adapter or secret is selected here.
function createPaymentService({ ledger, adapter = null, allowLive = false, acceptCheckouts = true, now = () => new Date().toISOString() }) {
  if (adapter) {
    const p = adapter.contract;
    if (!p || !token(p.id) || !["sandbox", "live"].includes(p.mode) || p.version !== 1 || p.taxMode !== "inclusive" || p.taxConfigured !== true ||
      !Array.isArray(p.countries) || !p.countries.length || p.countries.some(c => !/^[A-Z]{2}$/.test(c)) ||
      !Array.isArray(p.currencies) || !p.currencies.length || p.currencies.some(c => !["usd", "eur", "gbp"].includes(c)) ||
      !Array.isArray(p.checkoutHosts) || !p.checkoutHosts.length || p.checkoutHosts.some(h => typeof h !== "string" || !/^[a-z0-9.-]+$/.test(h)) ||
      ["createCheckout", "verifyWebhook", "requestRefund"].some(k => typeof adapter[k] !== "function")) throw new Error("Payment adapter contract, tax-inclusive pricing and jurisdiction qualification are required.");
    if (p.mode === "live" && !allowLive) throw new Error("Live payment adapter requires separate explicit activation.");
  }
  const status = () => ({ recordsAvailable: !!ledger, configured: !!ledger && !!adapter, checkoutsEnabled: !!ledger && !!adapter && acceptCheckouts, mode: adapter?.contract.mode || "disabled",
    reason: !ledger ? "Payment records require the durable currency ledger." : !adapter ? "Provider adapter only. No provider, merchant account or live checkout is connected." : !acceptCheckouts ? "New checkouts paused; verified events, recovery and provider refund requests remain available." : `${adapter.contract.mode} adapter connected. Prices include tax; only configured billing jurisdictions are accepted.` });
  const requireLedger = () => { if (!ledger) fail(status().reason, 503); };
  const requireAdapter = () => { requireLedger(); if (!adapter) fail(status().reason, 503); };
  function forAdapter(intent) {
    if (intent.provider !== adapter.contract.id || intent.mode !== adapter.contract.mode) fail("Restore the original qualified provider adapter to recover this payment.", 503);
    return intent;
  }
  async function ensureCheckout(intent) {
    forAdapter(intent);
    if (!intent.checkout) {
      let result;
      try { result = await adapter.createCheckout(structuredClone(intent)); }
      catch (error) { ledger.failed(intent.id, "checkout"); throw error; }
      let url; try { url = new URL(result?.url); } catch { fail("Provider did not return a valid checkout address.", 503); }
      if (!token(result?.checkoutId) || url.protocol !== "https:" || url.username || url.password || url.port || !adapter.contract.checkoutHosts.includes(url.hostname) || !iso(result.expiresAt) || result.expiresAt <= now()) fail("Provider checkout destination or expiry is not qualified.", 503);
      ledger.checkout(intent.id, { checkoutId: result.checkoutId, url: result.url, expiresAt: result.expiresAt });
    }
    return ledger.reconcile(intent.id);
  }
  async function checkout(account, input) {
    requireAdapter(); if (!acceptCheckouts) fail("New checkouts are paused.", 503);
    const intent = ledger.capture(account, input, adapter.contract);
    return ensureCheckout(ledger.intent(intent.id));
  }
  async function webhook(raw, headers) {
    requireAdapter();
    if (!Buffer.isBuffer(raw) || raw.length > 65536) fail("Payment webhook requires bounded raw bytes.", 400);
    const event = await adapter.verifyWebhook(raw, headers);
    const fields = ["id", "intentId", "checkoutId", "status", "amountMinor", "currency", "country", "taxMode", "occurredAt"];
    if (!event || Object.keys(event).length !== fields.length || Object.keys(event).some(k => !fields.includes(k)) || !token(event.id) || !token(event.intentId) || !token(event.checkoutId) ||
      !["pending", "succeeded", "failed", "refunded", "disputed"].includes(event.status) || !Number.isSafeInteger(event.amountMinor) || event.amountMinor < 1 || event.amountMinor > 1000000 || !iso(event.occurredAt) ||
      !adapter.contract.currencies.includes(event.currency) || !adapter.contract.countries.includes(event.country) || event.taxMode !== "inclusive") fail("Verified provider event is outside the supported full-payment contract.", 422);
    const captured = ledger.intent(event.intentId); if (captured) forAdapter(captured);
    try { ledger.receive(adapter.contract.id, event); } // Commit verified inbox BEFORE fulfillment.
    catch (error) { if (captured) ledger.failed(captured.id, "event-binding"); throw error; }
    return ledger.reconcile(event.intentId);
  }
  async function operate(actor, input) {
    requireLedger();
    if (input?.operation === "refund") requireAdapter();
    const command = ledger.command(actor, input), prior = ledger.actionFor(command.id);
    if (prior) return prior.result;
    const intent = ledger.intent(command.intentId);
    let result;
    if (command.operation === "retry") {
      if (!intent.checkout) { requireAdapter(); result = await ensureCheckout(intent); }
      else result = ledger.reconcile(intent.id);
      // Pending input remains pending; never display a fictitious successful grant.
      result = { notice: `Payment ${result.status}; fulfillment ${result.fulfillment}.`, intentId: intent.id };
    } else {
      let response;
      try { response = await adapter.requestRefund(structuredClone(forAdapter(intent)), structuredClone(command)); }
      catch (error) { ledger.failed(intent.id, "refund"); throw error; }
      if (!token(response?.requestId)) fail("Provider refund acknowledgement is missing; retry the same request key.", 503);
      result = { requestId: response.requestId, intentId: intent.id, notice: "Provider refund requested. Compensation waits for a verified full-refund or dispute event." };
    }
    return ledger.action(command.id, result).result;
  }
  function adminView(accounts = []) {
    const health = status(), data = ledger?.admin() || { intents: [], events: [], commands: [], audit: [] };
    const names = new Map(accounts.map(a => [a.id, a.name || a.id]));
    const table = (title, columns, rows, open = false) => ({ title, columns, rows, open });
    const options = data.intents.map(p => [p.id, `${p.product.name} · ${names.get(p.accountId) || p.accountId} · ${p.status} / ${p.fulfillment} · ${p.createdAt}`]);
    return { summary: health.reason, tables: [
      table("Payment readiness", ["Provider", "New checkouts", "Required next step"], [[health.mode, health.checkoutsEnabled ? "Enabled" : "Disabled", health.reason]], true),
      table("Payment orders", ["Order", "Account", "Product", "Captured price", "Payment", "Delivery", "Pending events", "Created"], data.intents.map(p => [p.id, p.accountId, p.product.name, `${(p.payment.amountMinor / 100).toFixed(2)} ${p.payment.currency.toUpperCase()}`, p.status, p.fulfillment, p.pendingEvents, p.createdAt])),
      table("Verified payment events", ["Event", "Order", "Status", "Occurred", "Received"], data.events.map(e => [e.eventId, e.intentId, e.status, e.occurredAt, e.receivedAt])),
      table("Payment recovery evidence", ["Action", "Order", "Actor", "Reason", "At"], data.audit.map(a => [a.action, a.intentId, a.actorId, a.reason, a.at]))
    ], forms: options.length ? [{ label: "Recover or request refund of a payment", action: "payment-operate", values: {}, fields: [
      { name: "intentId", label: "Payment order", type: "choice", required: true, options },
      { name: "operation", label: "Action", type: "choice", required: true, options: [["retry", "Retry captured fulfillment"], ...(health.configured ? [["refund", "Request full provider refund"]] : [])] },
      { name: "reason", label: "Operational reason", type: "text", required: true, minLength: 8, maxLength: 500 }
    ] }] : [] };
  }
  return { status, checkout, webhook, operate, adminView,
    account: accountId => { requireLedger(); return ledger.account(accountId); } };
}

// Register express.raw on this path BEFORE the application's JSON middleware.
function registerPaymentRoutes(app, service, { requireAccount }) {
  const send = work => async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    try { const result = await work(req, res); if (!res.headersSent) res.json(result); }
    catch (error) { res.status([400, 401, 403, 404, 409, 422].includes(error.status) ? error.status : 503).json({ error: error.status ? error.message : "Payment operation interrupted. Retry using the same request key." }); }
  };
  app.get("/api/payments", send(async (req, res) => { const entry = await requireAccount(req, res); if (entry) return { status: service.status(), orders: service.status().recordsAvailable ? service.account(entry.account.id) : [] }; }));
  app.post("/api/payments/checkout", send(async (req, res) => { const entry = await requireAccount(req, res); if (entry) return { order: await service.checkout(entry.account, req.body) }; }));
  // No client success/callback route exists. The server accepts only raw signed events.
  app.post("/api/payments/webhook", send(async req => { await service.webhook(req.body, req.headers); return { received: true }; }));
}
module.exports = { createPaymentService, registerPaymentRoutes };
