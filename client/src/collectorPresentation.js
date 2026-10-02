export const COLLECTOR_PALETTES = Object.freeze({
  "living-foil": ["#67e8f9", "#f6c453", "#c084fc"],
  "gilded-march": ["#f59e0b", "#fef3c7", "#dc2626"],
  "living-canopy": ["#4ade80", "#fef08a", "#22d3ee"],
  "sunken-tide": ["#22d3ee", "#bae6fd", "#6366f1"],
  "charged-engine": ["#38bdf8", "#fde047", "#f97316"],
  "brood-pulse": ["#a3e635", "#d8b4fe", "#ec4899"],
  "orbital-sweep": ["#60a5fa", "#e0f2fe", "#818cf8"],
  "elemental-omen": ["#fb7185", "#c4b5fd", "#60a5fa"]
});

const FACTION_STYLES = {
  rumin: "gilded-march", sheen: "living-canopy", frumo: "sunken-tide",
  bizi: "charged-engine", zynarth: "brood-pulse", "astral-vanguard": "orbital-sweep", indela: "elemental-omen"
};

// Match previews wrap a card in raw; archived actions can carry collector data
// directly. Explicit standard presentations always override an equipped foil.
export function collectorPresentation(card, presentation) {
  const source = card?.raw || card;
  const collector = presentation || source?.collector || card?.collector || (source?.finish ? source : null);
  const animated = Boolean(collector?.animated || collector?.finish === "foil");
  const style = collector?.animationStyle || FACTION_STYLES[source?.factionId || card?.factionId] || "living-foil";
  return { animated, style, palette: COLLECTOR_PALETTES[style] || COLLECTOR_PALETTES["living-foil"] };
}

export function collectorVersionLabel(variant) {
  if (!variant) return "Standard";
  if (variant.finish === "standard") return "Standard";
  return variant.name || (variant.finish === "foil" ? "Collector foil" : variant.finish);
}
