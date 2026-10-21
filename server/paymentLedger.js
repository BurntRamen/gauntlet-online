"use strict";
const { hash } = require("./authoredContent");
const { resolveDelivery } = require("./digitalDelivery");
const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
const keyPattern = /^[a-zA-Z0-9_-]{8,100}$/;

// This module is composed with the existing SQLite transaction helpers. It
// must never open a second financial store or credit the account JSON balance.
function createPaymentLedger({ transaction, execute, rows, get, put, owned, audit, now, id, gemsEnabled, moveGems, prepareDelivery }) {
  const events = intentId => rows("payment_events", "WHERE intent_id=?", [intentId]);
  const purchase = intentId => rows("purchases", "WHERE quote_id=?", [intentId])[0];
  function inspect(intent) {
    const inbox = events(intent.id), checkout = get("payment_checkouts", intent.id), bound = inbox.filter(e => checkout && e.checkoutId === checkout.checkoutId), p = purchase(intent.id);
    const terminal = bound.some(e => e.status === "disputed") ? "disputed" : bound.some(e => e.status === "refunded") ? "refunded" : null;
    const pending = inbox.filter(e => !get("payment_settlements", e.id)).length;
    return { ...intent, checkout: checkout || null, purchaseId: p?.id || null,
      status: terminal || (bound.some(e => e.status === "succeeded") ? "succeeded" : bound.some(e => e.status === "failed") ? "failed" : "pending"),
      fulfillment: pending ? "pending-recovery" : p && !terminal ? "fulfilled" : terminal ? "compensated" : "pending", pendingEvents: pending };
  }
  function capture(account, input, provider) {
    return execute(account, "payment-checkout", input, ({ release, config }) => {
      if (Object.keys(input).some(k => !["key", "productId", "country"].includes(k))) fail("Checkout accepts only the product, billing country and request key.", 422);
      if (!provider.countries.includes(input.country)) fail("This billing jurisdiction is not configured.", 422);
      const product = config.products.find(p => p.id === input.productId);
      if (!product || product.pricing !== "cash" || product.status !== "active" || !product.startsAt || now() < product.startsAt || now() >= product.endsAt) fail("This published cash offer is unavailable.");
      if (!provider.currencies.includes(product.cashCurrency) || !Number.isSafeInteger(product.cashPriceMinor) || product.cashPriceMinor < 1 || product.cashPriceMinor > 1000000) fail("The provider cannot honor this exact published price.");
      if (product.category === "gem-credit" && !gemsEnabled) fail("Gem funding requires the separate Gem runtime gate.", 503);
      const prior = owned("payment_intents", account.id).filter(p => p.product.id === product.id);
      // Unresolved checkouts reserve the limit. A client redirect or timeout
      // cannot release a reservation for a payment that may still succeed.
      const reserved = prior.filter(p => !["failed", "refunded", "disputed"].includes(inspect(p).status)).length;
      const otherPurchases = owned("purchases", account.id).filter(p => p.product.id === product.id && !prior.some(i => i.id === p.quoteId)).length;
      const historical = prior.filter(p => purchase(p.id) && ["refunded", "disputed"].includes(inspect(p).status)).length;
      if (reserved + historical + otherPurchases >= product.purchaseLimit) fail("Product limit reached or reserved by an unresolved checkout.");
      const terms = product.entitlements.map(key => {
        const term = config.entitlements.find(e => e.id === key);
        if (!term || term.provenance !== "commercial" || term.fulfillment !== "available") fail("Paid delivery is unavailable.");
        const endsAt = term.duration === "season" ? config.seasons.find(s => s.id === term.seasonId)?.endsAt : null;
        if (term.duration === "season" && (!endsAt || endsAt <= now())) fail("Seasonal access has expired.");
        const { filename, ...delivery } = resolveDelivery(term);
        return { ...term, endsAt, delivery };
      });
      if (product.category === "gem-credit" ? terms.length || !Number.isSafeInteger(product.gemCredit) || product.gemCredit < 1 || product.gemCredit > 1000000 : !terms.length || (product.gemCredit || 0)) fail("Cash offers must deliver either supported digital entitlements or a distinct Gem credit.", 422);
      const intent = { id: id(), accountId: account.id, product, terms, releaseId: release.id, provider: provider.id, mode: provider.mode,
        payment: { currency: product.cashCurrency, amountMinor: product.cashPriceMinor, country: input.country, taxMode: "inclusive" },
        createdAt: now() };
      prepareDelivery(intent, account.id); // Reject already-owned or invalid assets before charging.
      put("quotes", intent);
      put("payment_intents", intent, { account_id: account.id });
      audit("payment-intent-created", account.id, { intentId: intent.id, releaseId: release.id });
      return intent;
    });
  }
  function checkout(intentId, result) {
    return transaction(() => {
      const intent = get("payment_intents", intentId); if (!intent) fail("Payment intent not found.", 404);
      const value = { id: intentId, ...result, at: now() }, prior = get("payment_checkouts", intentId);
      if (prior) { if (prior.checkoutId !== result.checkoutId || prior.url !== result.url) fail("Provider changed an idempotent checkout."); return prior; }
      audit("payment-checkout-created", intent.accountId, { intentId, checkoutId: result.checkoutId });
      return put("payment_checkouts", value, { provider_ref: `${intent.provider}:${result.checkoutId}` });
    });
  }
  function receive(provider, event) {
    return transaction(() => {
      const intent = get("payment_intents", event.intentId); if (!intent || intent.provider !== provider) fail("Unknown payment intent for this provider.", 404);
      const value = { ...event, id: hash({ provider, eventId: event.id }), eventId: event.id, provider };
      const prior = get("payment_events", value.id);
      if (prior) { if (hash(prior.event) !== hash(event)) fail("Provider event ID reused with different facts."); return prior; }
      if (["currency", "amountMinor", "country", "taxMode"].some(k => event[k] !== intent.payment[k])) fail("Verified payment terms do not match the captured checkout.", 422);
      return put("payment_events", { ...value, event, receivedAt: now() }, { intent_id: intent.id });
    });
  }
  function reconcile(intentId) {
    try {
      return transaction(() => {
        const intent = get("payment_intents", intentId); if (!intent) fail("Payment not found.", 404);
        const check = get("payment_checkouts", intentId), inbox = events(intentId);
        if (!check) return inspect(intent); // Webhooks may precede checkout persistence.
        if (inbox.some(e => e.checkoutId !== check.checkoutId)) fail("Verified checkout reference differs; provider investigation is required.");
        const terminal = inbox.find(e => ["refunded", "disputed"].includes(e.status));
        let receipt = purchase(intentId);
        if (!terminal && inbox.some(e => e.status === "succeeded") && !receipt) {
          if (owned("purchases", intent.accountId).filter(p => p.product.id === intent.product.id).length >= intent.product.purchaseLimit) fail("Paid order exceeds its captured lifetime limit; request a provider refund.");
          for (const term of intent.terms) if (resolveDelivery(term).sha256 !== term.delivery.sha256) fail("Paid delivery integrity failed; restore the captured asset or request a provider refund.");
          const delivery = prepareDelivery(intent, intent.accountId);
          receipt = { id: id(), accountId: intent.accountId, product: intent.product, terms: intent.terms, releaseId: intent.releaseId, quoteId: intent.id,
            gold: 0, gems: 0, payment: { ...intent.payment, currency: "cash", denomination: intent.payment.currency }, paymentIntentId: intent.id,
            at: now(), fulfillment: "fulfilled", entitlementIds: delivery.map(g => g.id), gemCredit: intent.product.gemCredit || 0 };
          put("purchases", receipt, { account_id: intent.accountId, product_id: intent.product.id, quote_id: intent.id });
          if (receipt.gemCredit) moveGems(intent.accountId, "funding", receipt.gemCredit, { paymentIntentId: intent.id, purchaseId: receipt.id });
          for (const grant of delivery) put("entitlements", { ...grant, purchaseId: receipt.id }, { account_id: intent.accountId, purchase_id: receipt.id });
          audit("payment-fulfilled", intent.accountId, { intentId, purchaseId: receipt.id });
        }
        if (terminal && receipt && !rows("refunds", "WHERE purchase_id=?", [receipt.id]).length) {
          const refund = { id: id(), purchaseId: receipt.id, amount: 0, gems: 0, at: now(), reason: `Verified provider ${terminal.status}`, paymentIntentId: intent.id, providerEventId: terminal.eventId };
          put("refunds", refund, { purchase_id: receipt.id });
          if (receipt.gemCredit) moveGems(intent.accountId, "funding-reversal", -receipt.gemCredit, { paymentIntentId: intent.id, refundId: refund.id });
          for (const grant of owned("entitlements", intent.accountId).filter(g => g.purchaseId === receipt.id)) if (!rows("revocations", "WHERE entitlement_id=?", [grant.id]).length) put("revocations", { id: id(), entitlementId: grant.id, reason: refund.reason, refundId: refund.id, at: now() }, { entitlement_id: grant.id });
          audit("payment-compensated", intent.accountId, { intentId, refundId: refund.id, providerEventId: terminal.eventId });
        }
        for (const event of inbox) if (!get("payment_settlements", event.id)) put("payment_settlements", { id: event.id, intentId, eventId: event.eventId, status: event.status, purchaseId: receipt?.id || null, at: now() }, { intent_id: intentId });
        return inspect(intent);
      });
    } catch (error) { audit("payment-recovery-required", null, { intentId, reason: error.message }); throw error; }
  }
  function command(actor, input) {
    if (!actor?.id || typeof input?.key !== "string" || !keyPattern.test(input.key) || Object.keys(input).some(k => !["key", "operation", "intentId", "reason"].includes(k)) || !["retry", "refund"].includes(input.operation) || typeof input.reason !== "string" || input.reason.trim().length < 8 || input.reason.length > 500) fail("Select a payment operation and give a reason (8–500 characters) and stable request key.", 422);
    return transaction(() => {
      const commandId = hash({ actorId: actor.id, key: input.key }), fingerprint = hash(input), prior = get("payment_commands", commandId);
      if (prior) { if (prior.fingerprint !== fingerprint) fail("Request key already used for different payment facts."); return prior; }
      const intent = get("payment_intents", input.intentId); if (!intent) fail("Payment not found.", 404);
      if (input.operation === "refund" && inspect(intent).status !== "succeeded") fail("Only a verified successful payment can request a refund.");
      const result = put("payment_commands", { id: commandId, intentId: intent.id, actorId: actor.id, fingerprint, operation: input.operation, reason: input.reason.trim(), at: now() }, { intent_id: intent.id });
      audit("payment-operator-request", actor.id, { commandId, intentId: intent.id, operation: input.operation, reason: result.reason });
      return result;
    });
  }
  return { capture, checkout, receive, reconcile, command,
    pending: () => rows("payment_intents").map(inspect).filter(p => p.status === "pending" || p.pendingEvents).length,
    failed: (intentId, phase) => audit("payment-provider-failed", null, { intentId, operation: phase, reason: `Provider ${phase} did not complete. Retry the original request or investigate the verified payment binding.` }),
    action: (commandId, result) => transaction(() => get("payment_actions", commandId) || put("payment_actions", { id: commandId, result, at: now() })),
    actionFor: commandId => get("payment_actions", commandId),
    intent: intentId => { const intent = get("payment_intents", intentId); return intent ? inspect(intent) : null; },
    account: accountId => transaction(() => owned("payment_intents", accountId).map(inspect)),
    admin: () => transaction(() => ({ intents: rows("payment_intents").map(inspect), events: rows("payment_events"), commands: rows("payment_commands"), actions: rows("payment_actions"), audit: rows("audit").filter(a => a.action.startsWith("payment-")) })) };
}
module.exports = { createPaymentLedger };
