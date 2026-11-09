// Loaded only after an eligible account selects the SuitFire presentation.
export async function loadRegistry() {
  const response = await fetch(`${process.env.PUBLIC_URL || ""}/brand/suitfire-art/manifest.json`);
  if (!response.ok) throw new Error("Preview art manifest unavailable");
  const data = await response.json();
  if (data.version !== 1) throw new Error("Unsupported preview art manifest");
  return data;
}
const normalizeArtIdentity = value => String(value || "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
function localPath(source) {
  const path = String(source || "").split(/[?#]/)[0];
  const base = process.env.PUBLIC_URL || "";
  // Never reinterpret a third-party URL just because its filename matches ours.
  if (/^(?:[a-z]+:|\/\/)/i.test(path)) return "";
  return base && path.startsWith(base + "/") ? path.slice(base.length) : path;
}
export function resolvePresentationArt({ source = "", factionId = "", surface = "art", cardId = "", cardType = "", speaker = "" } = {}, options = {}) {
  const preview = options.preview ?? false;
  const config = options.registry;
  const original = { src: source, status: "original", kind: "image" };
  if (!preview) return original;
  const path = localPath(source);
  const canonical = config?.aliases?.[path] || path;
  const faction = normalizeArtIdentity(factionId).replace(/ /g, "");
  if (surface === "portrait") {
    const identity = normalizeArtIdentity(speaker);
    const portrait = config?.portraits?.[config?.portraitAliases?.[identity] || identity];
    if (portrait?.status === "retained-exact" && portrait.factionId === faction
      && (!source || canonical === portrait.source)) {
      return { src: portrait.source, status: "retained-exact", kind: "portrait" };
    }
    // Existing neutral unavailable-art mark, never a draft likeness or faction study.
    return { src: "/assets/gauntlet/ui/faction-art-unavailable.svg", status: "pending-portrait", kind: "image" };
  }
  if (surface === "loading") return { src: "/assets/gauntlet/menus/tutorial-table-v1.webp", status: "neutral", kind: "image" };
  // Covers are explicitly decorative, separate from event scenes and portraits.
  const cover = config?.covers?.[faction];
  if (["cover", "booster"].includes(surface) && (!source || path) && cover?.status === "approved") {
    return { src: cover.target, status: "approved", kind: "image" };
  }
  const mapping = config?.replacements?.[canonical];
  // An exact source match alone is insufficient: identity and representation must agree.
  if (mapping?.status === "approved" && (!mapping.factionId || mapping.factionId === faction)
    && (!mapping.cardId || (surface === "thumbnail" && !cardId) || mapping.cardId === cardId)
    // A stable ID can refer to an older printing with a different card type.
    // Deck decoration has no printed rules; actual cards require captured type.
    && (!mapping.cardId || surface === "thumbnail" || (mapping.cardType && mapping.cardType === cardType))
    && mapping.surfaces?.includes(surface)) {
    return { src: mapping.target, status: "approved", kind: mapping.kind || "image" };
  }
  return { ...original, status: config?.pending?.[canonical] || "retained-original" };
}
export function presentationCard(registry, card, factionId = card?.factionId, source = card?.presentation?.illustration || card?.image || "", surface = "illustration") {
  if (!card) return card;
  const art = resolvePresentationArt({ source, factionId, surface, cardId: card.gameplayCardId || card.definitionId || card.id, cardType: card.type || card.cardType || "" }, { preview: true, registry });
  if (art.kind !== "illustration") return card;
  return { ...card, factionId: card.factionId || factionId, presentation: { ...card.presentation, composed: true, illustration: art.src, face: "", faces: {} } };
}
export function presentationFace(registry, source, card, factionId = card?.factionId) {
  const resolved = resolvePresentationArt({ source, factionId, surface: "card", cardId: card?.gameplayCardId || card?.definitionId || card?.id || "", cardType: card?.type || card?.cardType || "" }, { preview: true, registry });
  // An illustration must be composed with the existing rank, suit and rules.
  return resolved.kind === "illustration" ? "" : resolved.src;
}
