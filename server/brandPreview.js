"use strict";
// Verified existing player IDs, not guest names, mutable display names or GitHub identities.
const PREVIEW_ACCOUNTS = new Set([
  "47d97ddb-65f9-4014-be92-9b677467d943", // simply
  "9a9dcf5c-1d3f-422e-b0eb-ca1a32a699e5"  // BurntRamen
]);
function accountBrand(account) {
  return PREVIEW_ACCOUNTS.has(account?.id) ? "suitfire" : "gauntlet";
}
module.exports = { accountBrand };
