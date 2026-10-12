const SUPPORT_CARD_TYPES = new Set([
  "armament",
  "weaponry",
  "spell",
  "shelter",
  "ambush",
  "contraption",
  "biomorph",
  "operation",
  "arcana"
]);

const CARD_TYPE_LABELS = {
  armament: "Armament",
  weaponry: "Weaponry",
  spell: "Spell",
  shelter: "Shelter",
  ambush: "Ambush",
  contraption: "Contraption",
  biomorph: "Biomorph",
  operation: "Operation",
  arcana: "Arcana",
  servitor: "Servitor",
  unit: "Servitor",
  token: "Token"
};

export function normalizedCardType(card) {
  if (card?.zynarthEgg) return "egg";
  return String(card?.type || "standard").trim().toLowerCase();
}

export function cardTypeLabel(card) {
  const type = normalizedCardType(card);
  if (type === "standard") return "Standard playing card";
  if (type === "egg") return "Egg";
  if (CARD_TYPE_LABELS[type]) return CARD_TYPE_LABELS[type];
  return type.split(/[\s_-]+/).filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Card";
}

export function isCombatCapableCard(card) {
  const type = normalizedCardType(card);
  return type !== "egg" && !SUPPORT_CARD_TYPES.has(type);
}

export function cardCombatLabel(card) {
  return isCombatCapableCard(card)
    ? "Can attack and block"
    : "Support card · cannot attack or block";
}
