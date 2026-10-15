"use strict";
const crypto = require("node:crypto"), decks = require("./adminDecks");
const { exact } = require("../shared/duel-rules/deckContract");
const ORIGIN = "admin-deck-offer-v1";
const BOXES = ["classic", "faction", "obsidian"], BACKS = ["classic", "arenaCircuit", "victorGold", "campaignMap"];
const fields = {
  name: { label: "Product name", type: "text", required: true, maxLength: 80 },
  description: { label: "Store description", type: "text", required: false, maxLength: 2000 },
  templateId: { label: "Deck recipe", type: "deck-reference", mechanical: true },
  deckBoxId: { label: "Deck box", type: "choice", options: BOXES },
  cardBackId: { label: "Card back", type: "choice", options: BACKS },
  prices: { label: "Prices", type: "offer-prices" },
  sale: { label: "Sale terms", type: "offer-sale", defaultValue: { startsAt: null, endsAt: null, purchaseLimit: null } },
  status: { label: "Store availability", type: "choice", options: ["unavailable", "available", "archived"] }
};
function create(snapshot, input) {
  const source = input.sourceId && snapshot.domains.offers.find(row => row.id === input.sourceId);
  if (input.sourceId && !source) throw Object.assign(new Error("The offer to duplicate is unavailable."), { status: 422 });
  const templateId = input.templateId || source?.templateId;
  const row = { id: `auth-offer-${crypto.randomUUID()}`, origin: ORIGIN, name: input.name.trim(), description: source?.description || "", templateId,
    deckBoxId: source?.deckBoxId || "classic", cardBackId: source?.cardBackId || "classic", prices: { gold: null, timetwisters: null }, sale: structuredClone(source?.sale || fields.sale.defaultValue), status: "unavailable" };
  snapshot.domains.offers.push(row); return row;
}
function errors(row, snapshot) {
  const result = [], add = (field, message) => result.push({ domain: "offers", id: row?.id, field, message });
  if (!exact(row, ["id", "origin", "name", "description", "templateId", "deckBoxId", "cardBackId", "prices", "status", ...(Object.hasOwn(row, "sale") ? ["sale"] : [])]) || row.origin !== ORIGIN || !/^auth-offer-[a-f0-9-]{36}$/.test(row.id)) { add("id", "Unsupported permanent offer identity or fulfillment fields."); return result; }
  if (Object.hasOwn(row, "sale")) {
    const sale = row.sale, date = value => value === null || typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
    if (!exact(sale, ["startsAt", "endsAt", "purchaseLimit"]) || !date(sale.startsAt) || !date(sale.endsAt) || sale.startsAt && sale.endsAt && sale.startsAt >= sale.endsAt || sale.purchaseLimit !== null && (!Number.isSafeInteger(sale.purchaseLimit) || sale.purchaseLimit < 1 || sale.purchaseLimit > 1000)) add("sale", "Use valid UTC dates, an end after the start, and a whole lifetime purchase limit from 1 to 1000, or leave it unlimited.");
  }
  for (const key of ["name", "description"]) if (typeof row[key] !== "string" || row[key].length > fields[key].maxLength || key === "name" && !row[key].trim() || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(row[key])) add(key, "Use supported store text.");
  const deck = snapshot.domains.decks.find(item => item.id === row.templateId && item.origin === decks.ORIGIN);
  if (!deck?.destinations?.player) add("templateId", "Select an authored deck enabled for players.");
  if (row.status === "available" && deck?.status !== "active") add("templateId", "An available product requires a discoverable deck. Disable the offer before archiving the template.");
  if (!BOXES.includes(row.deckBoxId) || !BACKS.includes(row.cardBackId)) add("deckBoxId", "Choose an existing deck box and card back; unsupported cosmetics cannot be fulfilled.");
  if (!fields.status.options.includes(row.status)) add("status", "Choose an explicit store availability.");
  if (!exact(row.prices, ["gold", "timetwisters"]) || Object.entries(row.prices).some(([currency, value]) => value !== null && (!Number.isSafeInteger(value) || value < 0 || value > (currency === "gold" ? 1000000 : 100000000)))) add("prices", "Use an explicit whole price or disable the currency. Gold supports up to 1,000,000 per transaction; Timetwisters up to 100,000,000. No price is supplied automatically.");
  else if (row.status === "available" && Object.values(row.prices).every(value => value === null)) add("prices", "Set at least one Gold or Timetwister price before making this product available.");
  return result;
}
function project(row, templates, releaseId) {
  const template = templates.find(deck => deck.id === row.templateId);
  return { ...row, revision: decks.revision({ offer: row, templateRevision: template.revision, releaseId }), template, releaseId,
    terms: { sale: structuredClone(row.sale || fields.sale.defaultValue), gameplayAccess: "All legal cards in ranked and constructed events; Draft and Sealed retain their pools.",
      printingIds: template.composition.cards.map(card => card.printingId), deckBoxId: row.deckBoxId, cardBackId: row.cardBackId,
      savedDeck: "Create and activate a separate saved composition. The previous deck is retained. Future recipe revisions do not rewrite it.",
      duplicates: "Printing counts increase by one. Existing boxes and backs remain unlocked; no duplicate compensation.",
      deckBoxAccess: "These three existing box styles are already available to all players; the product selects its configured style." } };
}
module.exports = { ORIGIN, BOXES, BACKS, fields, create, errors, project };
