export const domains = new Set(["encounters", "cards", "sets", "rule-modifiers", "mechanics", "card-effects", "faction-effects", "encounter-mechanics", "game", "modes", "campaigns", "factions", "decks", "offers", "characters", "assets", "asset-library", "competition:ranked", "competition:events", "para:awards", "para:products", "para:entitlements", "para:seasons", "para:events"]);
export function workshopTarget(value, fallback = { domain: "encounters", id: null }) {
  if (!value || !domains.has(value.domain)) return fallback;
  return { domain: value.domain, id: typeof value.id === "string" && value.id.length <= 240 ? value.id : null, ...(typeof value.field === "string" && /^[a-zA-Z][a-zA-Z0-9]{0,59}$/.test(value.field) ? { field: value.field } : {}), section: typeof value.section === "string" && /^[a-z-]{1,60}$/.test(value.section) ? value.section : null, ...(typeof value.cardId === "string" && value.cardId.length <= 240 ? { cardId: value.cardId } : {}) };
}
export function targetFromLocation(fallback) {
  const params = new URLSearchParams(window.location.search);
  return workshopTarget({ domain: params.get("workshop"), id: params.get("object"), section: params.get("section"), cardId: params.get("testCard"), field: params.get("field") }, fallback);
}
