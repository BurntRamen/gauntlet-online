"use strict";
const { normalizeEconomy } = require("./economy");
const { resolveComposition, compositionPayload, exact } = require("../shared/duel-rules/deckContract");
const fail = (status, message) => { throw Object.assign(new Error(message), { status, purchaseRejected: true }); };

// Pure preparation on a private copy. The caller commits this entire result or
// nothing, using the same account store as every other purchase and deck save.
function preparePurchase(account, input, resolved, { normalizeCollection, normalizeProgression, saveDeck, ledgerCurrency, now = new Date().toISOString() }) {
  if (!exact(input, ["offerId", "revision", "currency", "requestId"]) || !/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId) || !["gold", "timetwisters", ...(ledgerCurrency === "gems" ? ["gems"] : [])].includes(input.currency)) fail(422, "Choose an offer, exact terms, currency and a valid purchase request ID.");
  const stats = structuredClone(account.stats || {}), economy = normalizeEconomy(stats, { now });
  if (input.currency === "gems") economy.gems = stats.economy?.gems ?? 0;
  const receiptKey = `deck:${input.requestId}`, previous = economy.purchaseReceipts[receiptKey];
  if (previous) {
    if (previous.offerId !== input.offerId || previous.revision !== input.revision || previous.currency !== input.currency) fail(409, "This request ID was used with different terms. Inspect the earlier receipt.");
    return { stats, receipt: previous, alreadyPurchased: true };
  }
  const offer = resolved.manifest.deckOffers?.find(offer => offer.id === input.offerId);
  if (!offer || offer.status !== "available") fail(409, "This product is unavailable. No payment was taken.");
  if (offer.revision !== input.revision) fail(409, "The product or recipe changed. Review its current terms before purchasing.");
  const sale = offer.sale || {};
  if (sale.startsAt && now < sale.startsAt || sale.endsAt && now >= sale.endsAt) fail(409, "This product is outside its sale window. No payment was taken.");
  if (sale.purchaseLimit && Object.values(economy.purchaseReceipts).filter(receipt => receipt.offerId === offer.id).length >= sale.purchaseLimit) fail(409, "This account has reached the product's lifetime purchase limit, including refunded purchases.");
  const price = offer.prices[input.currency];
  if (!Number.isSafeInteger(price) || price < 0) fail(422, "That currency is not enabled for this product.");
  const recordedBalance = stats.economy?.[input.currency] ?? 0;
  if (!Number.isSafeInteger(recordedBalance) || recordedBalance < 0) fail(503, "The account currency needs operator reconciliation before it can be spent.");
  if (economy[input.currency] < price) fail(422, `You need ${price} ${input.currency[0].toUpperCase() + input.currency.slice(1)}.`);
  const loadout = resolveComposition(offer.template.composition, resolved.manifest, { channel: "constructed" });
  const collection = normalizeCollection(stats);
  for (const card of loadout.cards) collection.collectorVariants[card.variantId] = Number(collection.collectorVariants[card.variantId] || 0) + 1;
  stats.collection = collection;
  const progression = normalizeProgression(stats);
  const grant = require("./accountCommerce").captureGrant(stats, progression, loadout, offer.cardBackId);
  progression.cosmetics.unlockedCardBacks = [...new Set([...progression.cosmetics.unlockedCardBacks, offer.cardBackId])];
  if (stats.ledgerProjection) stats.ledgerProjection.baseBacks = [...new Set([...(stats.ledgerProjection.baseBacks || []), offer.cardBackId])];
  stats.progression = progression;
  const { record } = saveDeck(stats, { ...compositionPayload(offer.template), accessMode: "competitive", deckBoxId: offer.deckBoxId, cardBackId: offer.cardBackId }, account.id);
  economy[input.currency] -= price;
  if (input.currency !== "gems") economy.totals[input.currency === "gold" ? "goldSpent" : "timetwistersSpent"] += price;
  const receipt = { requestId: input.requestId, offerId: offer.id, revision: offer.revision, currency: input.currency, price, purchasedAt: now, releaseId: resolved.releaseId,
    template: structuredClone(offer.template), terms: structuredClone(offer.terms), grant, deckId: record.id, versionId: record.currentVersionId };
  economy.purchaseReceipts[receiptKey] = receipt; stats.economy = economy;
  return { stats, receipt, alreadyPurchased: false };
}
module.exports = { preparePurchase };
