"use strict";
const { assetEntry } = require("./contentAssets");
const SLOTS = Object.freeze({ "card-back": "cardBack", "deck-box": "deckBox", "profile-title": "title", "faction-banner": "banner", "profile-music": "music", "faction-soundtrack": "music" });
const LABELS = Object.freeze({ cardBack: "Match card back", deckBox: "Deck Library box cover", title: "Profile title", banner: "Profile faction banner", music: "Profile soundtrack" });
function presentation(grant) {
  const slot = SLOTS[grant?.term?.category], delivery = grant?.term?.delivery;
  if (!slot || grant.state !== "active" || !delivery) return null;
  if (slot === "title" && delivery.kind === "title") return { slot, name: grant.term.name };
  const asset = assetEntry(grant.term.asset);
  if (!asset || asset.sha256 !== delivery.sha256 || !["image", "audio"].includes(delivery.kind)) return null;
  return { slot, name: grant.term.name, url: asset.path, sha256: delivery.sha256 };
}
function selected(account, grants) {
  const result = {};
  for (const [slot, id] of Object.entries(account?.stats?.equipment || {})) {
    const item = presentation(grants.find(g => g.id === id));
    if (item?.slot === slot) result[slot] = item;
  }
  return result;
}
function revalidate(equipment, grants) {
  const owned = grants.map(presentation).filter(Boolean);
  return Object.fromEntries(Object.entries(equipment || {}).filter(([slot, item]) => owned.some(p => p.slot === slot && p.name === item.name && p.sha256 === item.sha256 && p.url === item.url)));
}
function view(account, grants) {
  const equipment = selected(account, grants), forms = [], rows = [];
  for (const [slot, label] of Object.entries(LABELS)) {
    const choices = grants.flatMap(g => { const item = presentation(g); return item?.slot === slot ? [[g.id, `${item.name} · ${g.expiresAt || "Permanent"}`]] : []; });
    rows.push([label, equipment[slot]?.name || "Default"]);
    if (choices.length || account.stats?.equipment?.[slot]) forms.push({ label: `Set ${label.toLowerCase()}`, action: "equip", values: { slot }, fields: [{ name: "entitlementId", label, type: "choice", required: true, options: [["default", "Use default"], ...choices] }] });
  }
  return { forms, tables: [{ title: "Equipped appearance", columns: ["Destination", "Selection"], rows }] };
}
function prepareSelection(account, input, grant) {
  if (!Object.hasOwn(LABELS, input?.slot) || typeof input.entitlementId !== "string") throw Object.assign(new Error("Choose a supported equipment destination."), { status: 422 });
  if (input.entitlementId !== "default" && (grant?.id !== input.entitlementId || presentation(grant)?.slot !== input.slot)) throw Object.assign(new Error("An active owned grant for this equipment destination is required."), { status: 403 });
  const stats = structuredClone(account.stats || {});
  stats.equipment = { ...stats.equipment };
  if (input.entitlementId === "default") delete stats.equipment[input.slot]; else stats.equipment[input.slot] = grant.id;
  return stats;
}
module.exports = { SLOTS, LABELS, selected, view, prepareSelection, presentation, revalidate };
