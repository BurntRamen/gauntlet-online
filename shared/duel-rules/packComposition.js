"use strict";
// Existing 13-card economy, suit guarantees and duplicate behavior are fixed.
// Only the already supported rarity slots and rare/mythic wild roll are authored.
const defaults = Object.freeze({ version: 1, slots: Object.freeze(["common", "common", "common", "common", "common", "common", "common", "uncommon", "uncommon", "uncommon", "rare", "wild", "face"]), wildMythicPercent: 20 });
const slots = { common: "Common", uncommon: "Uncommon", rare: "Rare", mythic: "Mythic", wild: "Rare / mythic roll", face: "Face card" };
function valid(value) {
  return !!value && Object.keys(value).sort().join() === "slots,version,wildMythicPercent" && value.version === 1 && Array.isArray(value.slots) && value.slots.length === 13 && value.slots.every((slot, i) => Object.hasOwn(slots, slot) && (i >= 4 || slot === "common")) && Number.isSafeInteger(value.wildMythicPercent) && value.wildMythicPercent >= 0 && value.wildMythicPercent <= 100;
}
function resolve(manifest, setId) {
  const recipe = manifest?.draftSets?.find(set => set.id === setId)?.packComposition || manifest?.packComposition || defaults;
  if (!valid(recipe)) throw new Error("The captured pack composition is invalid.");
  return recipe;
}
function rarity(slot, recipe, randomInt) { return slot === "wild" ? randomInt(100) < recipe.wildMythicPercent ? "mythic" : "rare" : slot; }
function requirements(recipe) {
  return [...new Set(recipe.slots.flatMap(slot => slot === "face" ? [] : slot === "wild" ? [...(recipe.wildMythicPercent < 100 ? ["rare"] : []), ...(recipe.wildMythicPercent > 0 ? ["mythic"] : [])] : [slot]))];
}
const field = { label: "Pack composition", type: "pack-composition", mechanical: true, defaultValue: defaults, note: "13 cards, one guaranteed card of each suit, fixed face-card odds and existing duplicate delivery. Only supported rarity slots and the wild roll change. Prices, credits and rewards are separate." };
module.exports = { defaults, slots, valid, resolve, rarity, requirements, field };
