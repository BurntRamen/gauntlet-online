"use strict";
const reject = message => { throw Object.assign(new Error(message), { status: 422 }); };
function choices(product, gemsEnabled = false) {
  const rows = [];
  if (["gold", "dual", "free"].includes(product.pricing)) rows.push({ currency: product.pricing === "free" ? "free" : "gold", gold: product.goldPrice, gems: 0 });
  if (gemsEnabled && ["gems", "dual"].includes(product.pricing)) rows.push({ currency: "gems", gold: 0, gems: product.gemPrice });
  if (gemsEnabled && product.pricing === "split") rows.push({ currency: "split", gold: product.goldPrice, gems: product.gemPrice });
  return rows;
}
function select(product, currency, gemsEnabled) {
  const options = choices(product, gemsEnabled);
  if (!options.length) reject("This currency is not enabled on this service.");
  const selected = currency ? options.find(p => p.currency === currency) : options.length === 1 ? options[0] : null;
  if (!selected) reject("Choose one of the published payment options.");
  if (![selected.gold, selected.gems].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 1000000)) reject("The published currency amounts are invalid.");
  return selected;
}
function label(payment) {
  return [payment.gold > 0 && `${payment.gold} Gold`, payment.gems > 0 && `${payment.gems} Gems`].filter(Boolean).join(" + ") || "0 Gold";
}
module.exports = { choices, select, label };
