"use strict";
const crypto = require("node:crypto");
const { normalizeEconomy } = require("./economy");
const { exact } = require("../shared/duel-rules/deckContract");
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const refunds = stats => stats.accountCommerce?.refunds || [];
const receipts = stats => Object.entries(stats.economy?.purchaseReceipts || {}).filter(([key]) => key.startsWith("deck:")).map(([, receipt]) => receipt);
const activeBackReceipts = (stats, back) => receipts(stats).filter(r => !r.ledgerPurchaseId && r.terms?.cardBackId === back && !refunds(stats).some(f => f.purchaseId === r.requestId));
function earnedBack(stats, progress, id) {
  return id === "classic" || id === "arenaCircuit" && Math.max(Number(stats.gamesPlayed || 0), progress.matchHistory.length) >= 10 || id === "victorGold" && !!progress.achievements["first-win"] || id === "campaignMap" && !!progress.achievements["first-campaign-clear"];
}
function captureGrant(stats, progress, loadout, cardBackId) {
  const existing = activeBackReceipts(stats, cardBackId);
  const baseBackOwned = earnedBack(stats, progress, cardBackId) || existing.some(r => !r.grant || r.grant.baseBackOwned) ||
    !existing.length && progress.cosmetics.unlockedCardBacks.includes(cardBackId) && !stats.ledgerProjection?.backIds?.includes(cardBackId);
  const printingCounts = {};
  for (const card of loadout.cards) printingCounts[card.variantId] = (printingCounts[card.variantId] || 0) + 1;
  return { schemaVersion: 1, printingCounts, cardBackId, baseBackOwned: !!baseBackOwned };
}
function capturedGrant(receipt) {
  if (receipt.grant?.schemaVersion === 1) return structuredClone(receipt.grant);
  // Old immutable recipes still establish exact printing quantities. They do
  // not prove whether a back was independently owned before that purchase.
  const cards = receipt.template?.composition?.cards;
  if (!Array.isArray(cards) || cards.some(c => typeof c.printingId !== "string" || !c.printingId)) fail(409, "This historical receipt lacks exact delivery evidence. Reconcile its ownership before refunding.");
  const printingCounts = {};
  for (const card of cards) printingCounts[card.printingId] = (printingCounts[card.printingId] || 0) + 1;
  return { schemaVersion: 0, printingCounts, cardBackId: receipt.terms?.cardBackId, baseBackOwned: true };
}
function prepareRefund(account, input, actor, { normalizeCollection, normalizeProgression, now = new Date().toISOString() }) {
  if (!actor?.id || !exact(input, ["purchaseId", "reason", "key"]) || typeof input.purchaseId !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(input.key) || typeof input.reason !== "string" || input.reason.trim().length < 8 || input.reason.length > 1000) fail(422, "Choose a purchase, provide a reason of 8–1000 characters and a stable request key.");
  const stats = structuredClone(account.stats || {}), reason = input.reason.trim();
  const operationKey = `${actor.id}:${input.key}`, fingerprint = crypto.createHash("sha256").update(JSON.stringify([input.purchaseId, reason])).digest("hex");
  const prior = refunds(stats).find(r => r.operationKey === operationKey);
  if (prior) {
    if (prior.fingerprint !== fingerprint) fail(409, "This operation key already records different refund terms.");
    return { stats, receipt: prior, alreadyRefunded: true };
  }
  const purchase = stats.economy?.purchaseReceipts?.[`deck:${input.purchaseId}`];
  if (!purchase) fail(404, "The captured purchase receipt is unavailable.");
  if (purchase.currency !== "timetwisters" || purchase.ledgerPurchaseId) fail(422, "This operation refunds account Timetwister deck purchases only. Ledger purchases use their ledger refund operation.");
  if (refunds(stats).some(r => r.purchaseId === input.purchaseId)) fail(409, "This purchase has already been refunded. Inspect its refund receipt.");
  const before = stats.economy.timetwisters ?? 0;
  if (!Number.isSafeInteger(before) || before < 0 || !Number.isSafeInteger(purchase.price) || purchase.price < 0 || !Number.isSafeInteger(before + purchase.price)) fail(409, "The recorded currency requires reconciliation; nothing was changed.");
  const grant = capturedGrant(purchase), collection = normalizeCollection(stats), progress = normalizeProgression(stats);
  if (!grant.printingCounts || typeof grant.printingCounts !== "object") fail(409, "The purchase has no exact printing grant evidence.");
  for (const [id, count] of Object.entries(grant.printingCounts)) {
    const owned = collection.collectorVariants[id] || 0;
    if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(owned) || owned < count) fail(409, "A delivered printing is missing from the recorded collection. Reconcile ownership before refunding.");
    if (owned === count) delete collection.collectorVariants[id]; else collection.collectorVariants[id] = owned - count;
  }
  const back = grant.cardBackId;
  const retainBase = grant.baseBackOwned || earnedBack(stats, progress, back) || activeBackReceipts(stats, back).some(r => r.requestId !== purchase.requestId);
  if (!retainBase && back) {
    if (stats.ledgerProjection) stats.ledgerProjection.baseBacks = (stats.ledgerProjection.baseBacks || []).filter(id => id !== back);
    if (!stats.ledgerProjection?.backIds?.includes(back)) {
      progress.cosmetics.unlockedCardBacks = progress.cosmetics.unlockedCardBacks.filter(id => id !== back);
      if (progress.cosmetics.selectedCardBack === back) progress.cosmetics.selectedCardBack = "classic";
    }
  }
  stats.collection = collection; stats.collection = normalizeCollection(stats); stats.progression = progress;
  const economy = normalizeEconomy(stats, { now }); economy.timetwisters = before + purchase.price; stats.economy = economy;
  const receipt = { id: crypto.randomUUID(), operationKey, fingerprint, purchaseId: purchase.requestId, offerId: purchase.offerId, accountId: account.id, actorId: actor.id,
    reason, at: now, currency: "timetwisters", amount: purchase.price, before, after: economy.timetwisters, releaseId: purchase.releaseId,
    revokedPrintingCounts: grant.printingCounts, cardBackId: back || null, cardBackPolicy: retainBase ? "Retain independent or unproven ownership" : "Remove this account purchase contribution; active ledger ownership is preserved", recipePolicy: "Retain saved recipe knowledge; future printing use requires ownership" };
  stats.accountCommerce = { schemaVersion: 1, refunds: [...refunds(stats), receipt] };
  stats.operatorAudit = [...(stats.operatorAudit || []), { id: receipt.id, actorId: actor.id, action: "deck-refund", reason, at: now, before, after: economy.timetwisters, purchaseId: purchase.requestId }];
  return { stats, receipt, alreadyRefunded: false };
}
function adminView(accounts) {
  const purchases = accounts.flatMap(a => receipts(a.stats || {}).filter(r => r.currency === "timetwisters" && !r.ledgerPurchaseId).map(r => ({ ...r, accountId: a.id, accountName: a.name || a.id, refunded: refunds(a.stats || {}).some(f => f.purchaseId === r.requestId) })));
  const rows = accounts.flatMap(a => refunds(a.stats || {}));
  return { tables: [
    { title: "Timetwister balances", columns: ["Player", "Timetwisters", "Refunds restored"], rows: accounts.map(a => [a.name || a.id, a.stats?.economy?.timetwisters ?? 0, refunds(a.stats || {}).reduce((sum, r) => sum + r.amount, 0)]) },
    { title: "Timetwister deck purchases", columns: ["Player", "Recipe", "Timetwisters", "Purchased", "State", "Purchase"], rows: purchases.map(p => [p.accountName, p.template?.name || p.offerId, p.price, p.purchasedAt, p.refunded ? "Refunded" : "Delivered", p.requestId]) },
    { title: "Timetwister refunds", columns: ["Receipt", "Purchase", "Player", "Actor", "Amount", "Reason", "At", "Card back policy"], rows: rows.map(r => [r.id, r.purchaseId, r.accountId, r.actorId, r.amount, r.reason, r.at, r.cardBackPolicy]) }
  ], forms: [{ label: "Refund Timetwister purchase and revoke its printing grants", action: "refund-deck", values: {}, fields: [
    { name: "purchaseRef", label: "Timetwister purchase", type: "choice", required: true, options: purchases.filter(p => !p.refunded).map(p => [`${p.accountId}/${p.requestId}`, `${p.accountName} · ${p.template?.name || p.offerId} · ${p.price} Timetwisters · ${p.purchasedAt}`]) },
    { name: "reason", label: "Refund reason", type: "text", required: true, minLength: 8, maxLength: 1000 }
  ] }] };
}
module.exports = { captureGrant, prepareRefund, adminView };
