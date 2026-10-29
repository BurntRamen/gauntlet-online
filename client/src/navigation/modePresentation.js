// Publication manifests hydrate these legacy defaults even when an editor has
// never changed the prose. Keep the Command Deck's clear labels in that case.
const legacyProse = {
  practice: ["Master your next move.", "Find your rhythm at the table. Learn the core game or put a faction through its paces against AI.", "The training grounds", "Learn & experiment"],
  freeForAll: ["A seat at your table.", "Challenge a friend to a duel, bring a group together, or watch a match unfold.", "Private matches", "Play with friends"],
  ranked: ["Make your mark.", "Bring your best game. Find an opponent, build your record, and climb the seasonal standings.", "The ranked arena", "Enter the competition"],
  draft: ["Every pick is a possibility.", "Draft your picks or open a Sealed pool. Build a deck that is yours, one card at a time.", "The drafting room", "Draft & sealed"],
  campaign: ["Begin your journey.", "Learn the rhythm of Gauntlet, then follow a commander through their campaign. Your next chapter is waiting.", "The academy & the archives"],
};

function authoredOrDefault(value, legacy, fallback) {
  return typeof value === "string" && value.trim() && value.trim() !== legacy ? value : fallback;
}

/** Resolve explicit authored prose without restoring the old shipped banners. */
export function getModePresentation(modeId, modeMetadata, { title, description }) {
  const mode = modeMetadata?.[modeId];
  const [legacyTitle, legacyDescription, legacyEyebrow, legacyDetail] = legacyProse[modeId] || [];
  return {
    title: authoredOrDefault(mode?.heroTitle, legacyTitle, title),
    description: authoredOrDefault(mode?.heroDescription, legacyDescription, description),
    eyebrow: authoredOrDefault(mode?.heroEyebrow, legacyEyebrow),
    detail: authoredOrDefault(mode?.menuDetail, legacyDetail),
  };
}
