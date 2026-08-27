export const PLAYING_CARD_ART_FACTIONS = Object.freeze(["basic", "rumin", "bizi", "sheen", "frumo"]);

const SUPPORTED_FACTIONS = new Set(PLAYING_CARD_ART_FACTIONS);

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

const MALFORMED_SUITS = [
  ["Ã¢â„¢Â ", "\u2660"],
  ["Ã¢â„¢Â¥", "\u2665"],
  ["Ã¢â„¢Â¦", "\u2666"],
  ["Ã¢â„¢Â£", "\u2663"],
  ["â™ ", "\u2660"],
  ["â™¥", "\u2665"],
  ["â™¦", "\u2666"],
  ["â™£", "\u2663"]
];

export function normalizeCardDisplayText(value) {
  return MALFORMED_SUITS.reduce(
    (text, [malformed, symbol]) => text.split(malformed).join(symbol),
    String(value ?? "")
  );
}

export function getPlayingCardRankSlug(card) {
  const raw = card?.rank ?? card?.value;
  const normalized = String(raw || "").trim().toLowerCase();
  if (normalized === "a" || normalized === "1" || normalized === "14") return "a";
  if (normalized === "j" || normalized === "11") return "j";
  if (normalized === "q" || normalized === "12") return "q";
  if (normalized === "k" || normalized === "13") return "k";
  const value = Number(normalized);
  return value >= 2 && value <= 10 ? String(value) : "";
}

export function isOrdinaryPlayingCard(card) {
  return Boolean(card && !card.draftCard && !card.type && !card.rarity);
}

export function expectsPlayingCardArt(card) {
  if (!isOrdinaryPlayingCard(card)) return false;
  const suit = SUIT_NAMES[normalizeCardDisplayText(card?.suit).trim().toLowerCase()] || "";
  return Boolean(suit && getPlayingCardRankSlug(card));
}

export function getPlayingCardArtPath(card, factionId) {
  const faction = String(factionId || card?.factionId || "basic").toLowerCase();
  const suit = SUIT_NAMES[normalizeCardDisplayText(card?.suit).trim().toLowerCase()] || "";
  const rank = getPlayingCardRankSlug(card);

  // Collection and draft replacements retain their existing faction-card treatment.
  if (!isOrdinaryPlayingCard(card)) return "";
  if (!SUPPORTED_FACTIONS.has(faction) || !suit || !rank) return "";
  return `/assets/gauntlet/playing-cards/${faction}-${rank}-${suit}.webp`;
}
