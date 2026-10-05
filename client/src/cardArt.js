const CUSTOM_CARD_ID = /^(?:rumin|sheen|frumo|bizi|zynarth|astral-vanguard|indela|neutral)-/;

export const PLAYING_CARD_ART_FACTIONS = Object.freeze(["basic", "rumin", "bizi", "sheen", "frumo"]);

export function getCustomCardArtDefinition(card) {
  if (card?.presentation) return card.presentation.illustration ? { id: card.gameplayCardId || card.definitionId || card.id, factionId: card.factionId, illustration: card.presentation.illustration } : null;
  const id = [card?.gameplayCardId, card?.definitionId, card?.id]
    .find((candidate) => CUSTOM_CARD_ID.test(String(candidate || "")));
  if (!id) return null;
  const factionId = id.startsWith("astral-vanguard-") ? "astral-vanguard" : id.split("-")[0];
  return { id, factionId, illustration: `/assets/gauntlet/constructed/${factionId}/${id}.webp` };
}

export function getCustomCardFacePath(card) {
  if (card?.presentation) {
    const suit = SUIT_NAMES[normalizeCardDisplayText(card.suit).trim().toLowerCase()] || "spades";
    return card.presentation.composed ? "" : card.presentation.faces?.[suit] || card.presentation.face || "";
  }
  const definition = getCustomCardArtDefinition(card);
  if (!definition) return "";
  const suit = SUIT_NAMES[normalizeCardDisplayText(card?.suit).trim().toLowerCase()] || "spades";
  return `/assets/gauntlet/constructed/faces/${definition.id}-${suit}.webp?v=2`;
}

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
  if (card?.presentation) return Boolean(getCustomCardFacePath(card) || card.presentation.illustration);
  if (getCustomCardArtDefinition(card)) return true;
  if (!isOrdinaryPlayingCard(card)) return false;
  const suit = SUIT_NAMES[normalizeCardDisplayText(card?.suit).trim().toLowerCase()] || "";
  return Boolean(suit && getPlayingCardRankSlug(card));
}

export function getPlayingCardArtPath(card, factionId) {
  if (card?.presentation) return getCustomCardFacePath(card) || card.presentation.illustration || "";
  const customFace = getCustomCardFacePath(card);
  if (customFace) return customFace;
  const requestedFaction = String(factionId || card?.factionId || "basic").toLowerCase();
  const faction = new Set(["mekan", "jali", "gracus", "indela", "zynarth", "astral-vanguard"]).has(requestedFaction) ? "basic" : requestedFaction;
  const suit = SUIT_NAMES[normalizeCardDisplayText(card?.suit).trim().toLowerCase()] || "";
  const rank = getPlayingCardRankSlug(card);

  // Unregistered replacements cannot borrow an unrelated ordinary face.
  if (!isOrdinaryPlayingCard(card)) return "";
  if (!SUPPORTED_FACTIONS.has(faction) || !suit || !rank) return "";
  return `/assets/gauntlet/playing-cards/${faction}-${rank}-${suit}.webp`;
}
