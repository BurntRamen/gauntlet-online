"use strict";
const crypto = require("node:crypto"), registry = require("./gameContent"), assets = require("./contentAssets");
const ORIGIN = "admin-printing-v1";
const fields = {
  name: { label: "Printing label", type: "text", required: true, maxLength: 160 },
  art: { label: "Artwork reference", type: "asset", media: "image", required: true, maxLength: 512 },
  edition: { label: "Digital set / edition", type: "printing-edition" },
  collectorNumber: { label: "Collector identifier", type: "text", required: true, maxLength: 32 },
  position: { label: "Edition display order", type: "integer", min: 0, max: 10000 },
  finish: { label: "Presentation finish", type: "choice", options: ["standard", "foil"] },
  status: { label: "Printing discovery", type: "choice", options: ["active", "archived"] }
};
const fail = message => { throw Object.assign(new Error(message), { status: 422 }); };
const editions = snapshot => [...registry.DRAFT_SETS, ...(snapshot.domains.sets || [])];
function create(snapshot, input) {
  const source = snapshot.domains.assets.find(row => row.id === input.sourceId);
  if (input.sourceId && !source) fail("Choose an existing printing to duplicate.");
  const card = snapshot.domains.cards.find(row => row.id === (input.gameplayCardId || source?.gameplayCardId));
  if (!card || source && source.gameplayCardId !== card.id) fail("The printing must belong to its original gameplay card.");
  const edition = editions(snapshot).find(row => row.id === input.edition);
  if (!edition || edition.status === "archived") fail("Choose an active digital set / edition.");
  const id = `auth-printing-${crypto.randomUUID()}`, original = source || snapshot.domains.assets.find(row => row.id === card.defaultVariantId);
  const row = { id, variantId: id, schemaVersion: 1, origin: ORIGIN, gameplayCardId: card.id, name: input.name.trim(), edition: edition.id,
    collectorNumber: input.collectorNumber, position: input.position ?? Math.min(10000, Math.max(0, ...snapshot.domains.assets.filter(v => v.edition === edition.id).map(v => v.position || 0)) + 10),
    finish: input.finish || source?.finish || "standard", frame: "faction-standard", border: "standard", art: input.art || original?.art,
    collectorRarity: card.rarity, paid: false, entitlementRequired: true, acquisition: "unavailable", status: "active" };
  snapshot.domains.assets.push(row); return row;
}
function errors(row, snapshot) {
  const problems = [], add = (field, message) => problems.push({ domain: "assets", id: row?.id, field, message });
  const keys = ["id", "variantId", "schemaVersion", "origin", "gameplayCardId", "name", "edition", "collectorNumber", "position", "finish", "frame", "border", "art", "collectorRarity", "paid", "entitlementRequired", "acquisition", "status"];
  if (!row || Object.keys(row).length !== keys.length || keys.some(key => !Object.hasOwn(row, key)) || !/^auth-printing-[a-f0-9-]{36}$/.test(row.id) || row.variantId !== row.id || row.origin !== ORIGIN || row.schemaVersion !== 1) add("id", "Unsupported immutable printing identity or fields.");
  if (!snapshot.domains.cards.some(card => card.id === row.gameplayCardId)) add("gameplayCardId", "Printing gameplay card is unknown.");
  if (typeof row.name !== "string" || !row.name.trim() || row.name.length > 160 || /[\x00-\x1f]/.test(row.name)) add("name", "Use a printing label of 1–160 characters.");
  if (typeof row.collectorNumber !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/.test(row.collectorNumber)) add("collectorNumber", "Use 1–32 letters, digits, dots, underscores or hyphens for the collector identifier.");
  if (snapshot.domains.assets.some(other => other.id !== row.id && other.edition === row.edition && typeof other.collectorNumber === "string" && typeof row.collectorNumber === "string" && other.collectorNumber.toLowerCase() === row.collectorNumber.toLowerCase())) add("collectorNumber", "That collector identifier is already used in this digital edition, including archived printings.");
  if (!editions(snapshot).some(set => set.id === row.edition)) add("edition", "Choose an existing digital set / edition.");
  if (!Number.isInteger(row.position) || row.position < 0 || row.position > 10000) add("position", "Edition display order must be 0–10,000.");
  if (!row.art || !assets.validAssetReference(row.art, "image", snapshot.assetVersions)) add("art", "Choose an exact valid image version.");
  if (!["standard", "foil"].includes(row.finish) || row.frame !== "faction-standard" || row.border !== "standard" || !["common", "uncommon", "rare", "mythic"].includes(row.collectorRarity) || !["active", "archived"].includes(row.status)) add("finish", "Choose a supported printing presentation. Frames and gameplay values are protected.");
  if (row.paid !== false || row.entitlementRequired !== true || row.acquisition !== "unavailable") add("acquisition", "New printings require explicit existing entitlement and are excluded from acquisition. No new grant or purchase policy is supported.");
  return problems;
}
module.exports = { ORIGIN, fields, editions, create, errors };
