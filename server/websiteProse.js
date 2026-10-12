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
const locations = { practice: "Play → Practice", freeForAll: "Play → Tables", ranked: "Play → Ranked", draft: "Play → Draft", campaign: "Journey" };
function proseFields(id) {
  return Object.fromEntries((defaults[id] || []).map((defaultValue, index) => {
    const [key, label, maxLength] = fields[index];
    return [key, { label, type: "text", maxLength, required: true, defaultValue, note: `Shown in ${locations[id]}. Presentation only; save to the shared draft, preview, then publish.` }];
  }));
}
module.exports = { proseFields };
