"use strict";
// Resolve only within the caller's captured release. An explicit bad selection
// never silently falls back to a different printing or today's catalog.
function resolvePrinting(gameplayCardId, variants = [], requestedId, defaultId = `${gameplayCardId}:standard`) {
  return variants.find(row => row.gameplayCardId === gameplayCardId && row.variantId === (requestedId || defaultId)) || null;
}
function canUsePrinting(variant, ownership = {}) {
  return !!variant && (!(variant.paid || variant.entitlementRequired) || Number(ownership[variant.variantId]) > 0);
}
module.exports = { resolvePrinting, canUsePrinting };
