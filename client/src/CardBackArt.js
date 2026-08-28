import "./CardBackArt.css";

export const CARD_BACK_DEFINITIONS = Object.freeze({
  classic: Object.freeze({
    id: "classic",
    name: "Classic Gauntlet",
    asset: "/assets/gauntlet/match/gauntlet-card-back-official.jpg",
    description: "The original Gauntlet card back."
  }),
  arenaCircuit: Object.freeze({
    id: "arenaCircuit",
    name: "Arena Circuit",
    asset: "/assets/gauntlet/card-backs/arena-circuit-v1.webp",
    description: "Three lanes held under pressure around a single clash point."
  }),
  victorGold: Object.freeze({
    id: "victorGold",
    name: "Victor Gold",
    asset: "/assets/gauntlet/card-backs/victor-gold-v1.webp",
    description: "A hard-won gold circuit unlocked by a first victory."
  }),
  campaignMap: Object.freeze({
    id: "campaignMap",
    name: "Campaign Map",
    asset: "/assets/gauntlet/card-backs/campaign-map-v1.webp",
    description: "Three campaign routes advance through gates and checkpoints."
  })
});

export function getCardBackDefinition(cardBackId = "classic") {
  return CARD_BACK_DEFINITIONS[cardBackId] || CARD_BACK_DEFINITIONS.classic;
}

export function resolveCardBackAsset(cardBackId = "classic") {
  const asset = getCardBackDefinition(cardBackId).asset;
  return `${process.env.PUBLIC_URL || ""}${asset}`;
}

export function CardBackArt({ cardBackId = "classic", className = "", decorative = false, label = "" }) {
  const definition = getCardBackDefinition(cardBackId);
  const accessibleLabel = label || `${definition.name} card back`;
  return (
    <span
      className={`card-back-art ${className}`.trim()}
      style={{ backgroundImage: `url(${resolveCardBackAsset(definition.id)})` }}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? "true" : undefined}
      aria-label={decorative ? undefined : accessibleLabel}
      data-card-back-id={definition.id}
    />
  );
}
