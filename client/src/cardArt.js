const SUPPORTED_FACTIONS = new Set(["rumin", "bizi", "sheen", "frumo"]);

const SUIT_NAMES = {
  "\u2666": "diamonds",
  d: "diamonds",
  diamond: "diamonds",
  diamonds: "diamonds",
  "\u2660": "spades",
  s: "spades",
  spade: "spades",
  spades: "spades",
  "\u2665": "hearts",
  h: "hearts",
  heart: "hearts",
  hearts: "hearts",
  "\u2663": "clubs",
  c: "clubs",
  club: "clubs",
  clubs: "clubs"
};

function getRankSlug(card) {
  const raw = card?.rank ?? card?.value;
  const normalized = String(raw || "").trim().toLowerCase();
  if (normalized === "a" || normalized === "1" || normalized === "14") return "a";
  if (normalized === "j" || normalized === "11") return "j";
  if (normalized === "q" || normalized === "12") return "q";
  if (normalized === "k" || normalized === "13") return "k";
  const value = Number(normalized);
  return value >= 2 && value <= 10 ? String(value) : "";
}

export function getPlayingCardArtPath(card, factionId) {
  const faction = String(factionId || "").toLowerCase();
  const suit = SUIT_NAMES[String(card?.suit || "").trim().toLowerCase()] || "";
  const rank = getRankSlug(card);

  // Collection and draft replacements retain their existing faction-card treatment.
  if (!card || card.draftCard || card.type || card.rarity) return "";
  if (!SUPPORTED_FACTIONS.has(faction) || !suit || !rank) return "";
  return `/assets/gauntlet/playing-cards/${faction}-${rank}-${suit}.webp`;
}
