"use strict";
const offers = require("./adminDeckOffers");
const SCHEMA = "gauntlet.authored-content.v4";
function upgrade(snapshot) {
  snapshot.schemaVersion = SCHEMA;
  snapshot.domains.sets ||= [];
  snapshot.domains.offers ||= [];
  return snapshot;
}
function validate(snapshot, baseline, validateCatalog) {
  if (!snapshot.domains || !Array.isArray(snapshot.domains.offers)) return { valid: false, errors: [{ message: "Missing deck-offer domain." }], warnings: [] };
  const { offers: rows, ...domains } = snapshot.domains;
  const base = validateCatalog({ ...snapshot, schemaVersion: "gauntlet.authored-content.v3", domains }, baseline);
  const errors = [...base.errors], ids = new Set();
  for (const offer of rows) {
    if (ids.has(offer?.id)) errors.push({ domain: "offers", id: offer?.id, field: "id", message: "Duplicate permanent offer identity." });
    ids.add(offer?.id); errors.push(...offers.errors(offer, snapshot));
  }
  return { valid: !errors.length, errors, warnings: base.warnings };
}
module.exports = { SCHEMA, upgrade, validate };
