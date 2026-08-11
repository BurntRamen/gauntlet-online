export const MATCH_PRESENTATION_SCHEMA = "gauntlet.match-presentation.v1";
export const CORE_PRESENTATION_KIT_ID = "gauntlet-core-v1";
export const CORE_PRESENTATION_KIT_URL = "/assets/gauntlet/match/kits/gauntlet-core-v1/kit.json";

export const PRESENTATION_ASSET_STATUSES = Object.freeze([
  "provisional",
  "candidate",
  "approved"
]);

const ASSET_GROUPS = Object.freeze([
  "modules",
  "materials",
  "masks",
  "effects",
  "audio"
]);

export const FALLBACK_PRESENTATION_KIT = Object.freeze({
  schemaVersion: MATCH_PRESENTATION_SCHEMA,
  kitId: CORE_PRESENTATION_KIT_ID,
  revision: "fallback-1",
  status: "provisional",
  provenance: {
    creator: "Gauntlet engineering",
    source: "Code-native deterministic fallback",
    approvalOwner: "Unassigned",
    license: "Project-internal",
    checksum: null
  },
  assetDefaults: { provenanceRef: "kit", checksum: null },
  responsiveVariants: {
    desktop: { minAspect: 0.9, ornament: "full" },
    portrait: { maxAspect: 0.72, ornament: "reduced" },
    shortLandscape: { maxHeight: 520, ornament: "reduced" }
  },
  assets: {
    modules: {},
    materials: {
      "table.graphite": {
        id: "table.graphite",
        role: "tiling-table-material",
        format: "png",
        path: "/assets/gauntlet/match/graphite-table-v1.png",
        status: "provisional",
        revision: "generated-v1",
        fallback: "procedural.graphite"
      }
    },
    masks: {},
    effects: {
      "attack.declare": { id: "attack.declare", role: "attack", format: "webp", path: "/assets/gauntlet/match/effects/attack-declare.webp", status: "provisional", revision: "generated-v1", fallback: "procedural.ring" },
      "block.commit": { id: "block.commit", role: "block", format: "webp", path: "/assets/gauntlet/match/effects/block-raise.webp", status: "provisional", revision: "generated-v1", fallback: "procedural.shield" },
      "payment.release": { id: "payment.release", role: "payment", format: "webp", path: "/assets/gauntlet/match/effects/payment-discard.webp", status: "provisional", revision: "generated-v1", fallback: "procedural.inlay" },
      "damage.impact": { id: "damage.impact", role: "damage", format: "webp", path: "/assets/gauntlet/match/effects/damage-impact.webp", status: "provisional", revision: "generated-v1", fallback: "procedural.impact" },
      "priority.transfer": { id: "priority.transfer", role: "priority", format: "webp", path: "/assets/gauntlet/match/effects/priority-transfer.webp", status: "provisional", revision: "generated-v1", fallback: "procedural.inlay" },
      "turn.start": { id: "turn.start", role: "turn", format: "webp", path: "/assets/gauntlet/match/effects/turn-transition.webp", status: "provisional", revision: "generated-v1", fallback: "procedural.sweep" }
    },
    audio: {
      "ui.select": { id: "ui.select", role: "ui", format: "wav", path: "/assets/gauntlet/match/sfx/ui-select.wav", status: "provisional", revision: "generated-v1", fallback: "tone.ui.select" },
      "ui.confirm": { id: "ui.confirm", role: "ui", format: "wav", path: "/assets/gauntlet/match/sfx/ui-confirm.wav", status: "provisional", revision: "generated-v1", fallback: "tone.ui.confirm" },
      "ui.cancel": { id: "ui.cancel", role: "ui", format: "wav", path: "/assets/gauntlet/match/sfx/ui-cancel.wav", status: "provisional", revision: "generated-v1", fallback: "tone.ui.cancel" },
      "priority.pass": { id: "priority.pass", role: "priority", format: "wav", path: "/assets/gauntlet/match/sfx/priority-pass.wav", status: "provisional", revision: "generated-v1", fallback: "tone.priority.pass" },
      "payment.release": { id: "payment.release", role: "payment", format: "wav", path: "/assets/gauntlet/match/sfx/payment-discard.wav", status: "provisional", revision: "generated-v1", fallback: "tone.payment" },
      "attack.declare": { id: "attack.declare", role: "attack", format: "wav", path: "/assets/gauntlet/match/sfx/attack-declare.wav", status: "provisional", revision: "generated-v1", fallback: "tone.attack" },
      "block.commit": { id: "block.commit", role: "block", format: "wav", path: "/assets/gauntlet/match/sfx/block-declare.wav", status: "provisional", revision: "generated-v1", fallback: "tone.block" },
      "damage.impact": { id: "damage.impact", role: "damage", format: "wav", path: "/assets/gauntlet/match/sfx/damage-impact.wav", status: "provisional", revision: "generated-v1", fallback: "tone.damage" },
      "priority.transfer": { id: "priority.transfer", role: "priority", format: "wav", path: "/assets/gauntlet/match/sfx/priority-transfer.wav", status: "provisional", revision: "generated-v1", fallback: "tone.priority" },
      "turn.start": { id: "turn.start", role: "turn", format: "wav", path: "/assets/gauntlet/match/sfx/turn-start.wav", status: "provisional", revision: "generated-v1", fallback: "tone.turn" },
      "card.place": { id: "card.place", role: "card", format: "wav", path: "/assets/gauntlet/match/sfx/card-place.wav", status: "provisional", revision: "generated-v1", fallback: "tone.card.place" },
      "card.draw": { id: "card.draw", role: "card", format: "wav", path: "/assets/gauntlet/match/sfx/card-draw.wav", status: "provisional", revision: "generated-v1", fallback: "tone.card.draw" },
      "ability.activate": { id: "ability.activate", role: "ability", format: "wav", path: "/assets/gauntlet/match/sfx/ability-activate.wav", status: "provisional", revision: "generated-v1", fallback: "tone.ability" },
      "match.victory": { id: "match.victory", role: "result", format: "wav", path: "/assets/gauntlet/match/sfx/victory.wav", status: "provisional", revision: "generated-v1", fallback: "tone.victory" },
      "match.defeat": { id: "match.defeat", role: "result", format: "wav", path: "/assets/gauntlet/match/sfx/defeat.wav", status: "provisional", revision: "generated-v1", fallback: "tone.defeat" }
    }
  }
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function presentationAssets(kit, group) {
  return kit?.assets?.[group] || {};
}

export function resolvePresentationAsset(kit, group, id) {
  return presentationAssets(kit, group)?.[id]
    || presentationAssets(FALLBACK_PRESENTATION_KIT, group)?.[id]
    || null;
}

export function validatePresentationKit(kit, { requireApproved = false } = {}) {
  const errors = [];
  if (!kit || typeof kit !== "object") return { valid: false, errors: ["Presentation kit must be an object."] };
  if (kit.schemaVersion !== MATCH_PRESENTATION_SCHEMA) errors.push(`Unsupported schemaVersion: ${kit.schemaVersion || "missing"}.`);
  if (!kit.kitId) errors.push("kitId is required.");
  if (!PRESENTATION_ASSET_STATUSES.includes(kit.status)) errors.push(`Invalid kit status: ${kit.status || "missing"}.`);
  if (!kit.provenance?.source || !kit.provenance?.approvalOwner) errors.push("Kit provenance source and approvalOwner are required.");
  const provenanceRefs = new Set(["kit", ...Object.keys(kit.provenanceSources || {})]);
  ASSET_GROUPS.forEach((group) => {
    const entries = kit.assets?.[group];
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
      errors.push(`assets.${group} must be an object.`);
      return;
    }
    Object.entries(entries).forEach(([key, asset]) => {
      if (asset?.id !== key) errors.push(`assets.${group}.${key} must repeat its stable id.`);
      if (!asset?.role) errors.push(`assets.${group}.${key} is missing role.`);
      if (!asset?.format) errors.push(`assets.${group}.${key} is missing format.`);
      if (!PRESENTATION_ASSET_STATUSES.includes(asset?.status)) errors.push(`assets.${group}.${key} has invalid status.`);
      if (!asset?.revision) errors.push(`assets.${group}.${key} is missing revision.`);
      if (!asset?.provenance && !asset?.provenanceRef && !kit.assetDefaults?.provenanceRef) errors.push(`assets.${group}.${key} is missing provenance.`);
      if (!("checksum" in asset) && !("checksum" in (kit.assetDefaults || {}))) errors.push(`assets.${group}.${key} is missing checksum metadata.`);
      const provenanceRef = asset?.provenanceRef || kit.assetDefaults?.provenanceRef;
      if (!asset?.provenance && provenanceRef && !provenanceRefs.has(provenanceRef)) errors.push(`assets.${group}.${key} has unknown provenanceRef ${provenanceRef}.`);
      const checksum = asset?.checksum ?? kit.assetDefaults?.checksum;
      if (["candidate", "approved"].includes(asset?.status) && !checksum) errors.push(`assets.${group}.${key} needs a checksum before ${asset.status} review.`);
      if (!asset?.path && !asset?.fallback) errors.push(`assets.${group}.${key} needs a path or fallback.`);
      if (asset?.referenceOnly && asset?.runtimeSelectable !== false) {
        errors.push(`assets.${group}.${key} is reference-only and must not be runtime selectable.`);
      }
      if (asset?.referenceOnly && asset?.requiredForCutover) {
        errors.push(`assets.${group}.${key} is reference-only and cannot be required for runtime cutover.`);
      }
      if (asset?.structuralComposite && asset?.runtimeSelectable !== false) {
        errors.push(`assets.${group}.${key} is a structural composite and cannot be runtime selectable.`);
      }
      if (requireApproved && asset?.requiredForCutover && asset.status !== "approved") {
        errors.push(`assets.${group}.${key} is required for cutover but is not approved.`);
      }
    });
  });
  return { valid: errors.length === 0, errors };
}

export async function loadPresentationKit(url = CORE_PRESENTATION_KIT_URL, { fetcher } = {}) {
  const request = fetcher || (typeof window !== "undefined" ? window.fetch : null);
  if (typeof request !== "function") return clone(FALLBACK_PRESENTATION_KIT);
  try {
    const response = await request(url);
    if (!response?.ok) throw new Error(`Unable to load presentation kit (${response?.status || "network"}).`);
    const kit = await response.json();
    const validation = validatePresentationKit(kit);
    if (!validation.valid) throw new Error(validation.errors.join("\n"));
    return kit;
  } catch (error) {
    return { ...clone(FALLBACK_PRESENTATION_KIT), loadError: error?.message || String(error) };
  }
}

export class PresentationAssetCache {
  constructor() {
    this.entries = new Map();
  }

  async get(key, factory) {
    if (!this.entries.has(key)) this.entries.set(key, Promise.resolve().then(factory));
    return this.entries.get(key);
  }

  dispose() {
    this.entries.forEach((entry) => Promise.resolve(entry).then((asset) => asset?.dispose?.()).catch(() => {}));
    this.entries.clear();
  }
}
