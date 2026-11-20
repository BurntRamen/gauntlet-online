"use strict";

// Optional presentation overrides on existing mode owners. Absence preserves
// the shipped wording and the exact hash of older releases and shared drafts.
const defaults = {
  practice: ["The training grounds", "Master your next move.", "Find your rhythm at the table. Learn the core game or put a faction through its paces against AI.", "Learn & experiment"],
  freeForAll: ["Private matches", "A seat at your table.", "Challenge a friend to a duel, bring a group together, or watch a match unfold.", "Play with friends"],
  ranked: ["The ranked arena", "Make your mark.", "Bring your best game. Find an opponent, build your record, and climb the seasonal standings.", "Enter the competition"],
  draft: ["The drafting room", "Every pick is a possibility.", "Draft your picks or open a Sealed pool. Build a deck that is yours, one card at a time.", "Draft & sealed"],
  campaign: ["The academy & the archives", "Begin your journey.", "Learn the rhythm of Gauntlet, then follow a commander through their campaign. Your next chapter is waiting."]
};
const fields = [["heroEyebrow", "Page overline", 80], ["heroTitle", "Page heading", 160], ["heroDescription", "Page introduction", 600], ["menuDetail", "Menu description", 80]];
const locations = { practice: "Learn & Rules → Practice", freeForAll: "Play → Join a Table", ranked: "Compete → Ranked", draft: "Draft", campaign: "Campaign" };
const surfaces = require("../shared/admin/websiteSurfaces.json");
function proseFields(id) {
  return Object.fromEntries([...(defaults[id] || []).map((defaultValue, index) => {
    const [key, label, maxLength] = fields[index];
    return [key, { label, type: "text", maxLength, required: true, defaultValue, note: `Shown in ${locations[id]}. Presentation only; save to the shared draft, preview, then publish.` }];
  }), ...surfaces.filter(surface => surface.owner === id).flatMap(surface => [
    ...["title", "description"].map(part => [`${surface.id}Page${part === "title" ? "Title" : "Description"}`, { label: `${surface.name} · ${part === "title" ? "heading" : "introduction"}`, type: "text", maxLength: part === "title" ? 160 : 600, required: true, defaultValue: surface[part], note: `Shown in ${surface.name}. Save to the shared draft; publish from Publishing.` }]),
    [`${surface.id}PageImage`, { label: `${surface.name} · header image`, type: "asset", media: "image", maxLength: 600, required: false, defaultValue: "", note: "Optional decorative header artwork. Choose a versioned image; clearing it restores the standard header. Existing releases keep their original image." }]
  ])]);
}
function projectProse(domains, versions = [], releaseId = "") {
  return Object.fromEntries(surfaces.map(surface => {
    const row = domains.game.find(mode => mode.id === surface.owner);
    const image = row?.[`${surface.id}PageImage`];
    return [surface.id, { ...Object.fromEntries(["title", "description"].map(part => [part, row?.[`${surface.id}Page${part === "title" ? "Title" : "Description"}`] ?? surface[part]])), ...(image ? { image: require("./contentAssets").resolveAsset(image, versions, releaseId) } : {}) }];
  }));
}
module.exports = { proseFields, projectProse, surfaces };
