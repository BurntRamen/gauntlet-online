import {
  CORE_PRESENTATION_KIT_ID,
  FALLBACK_PRESENTATION_KIT,
  loadPresentationKit,
  MATCH_PRESENTATION_SCHEMA,
  PresentationAssetCache,
  resolvePresentationAsset,
  validatePresentationKit
} from "./presentationKit";

test("the fallback kit is a valid explicitly provisional presentation kit", () => {
  expect(FALLBACK_PRESENTATION_KIT.schemaVersion).toBe(MATCH_PRESENTATION_SCHEMA);
  expect(FALLBACK_PRESENTATION_KIT.kitId).toBe(CORE_PRESENTATION_KIT_ID);
  expect(FALLBACK_PRESENTATION_KIT.status).toBe("provisional");
  expect(validatePresentationKit(FALLBACK_PRESENTATION_KIT)).toEqual({ valid: true, errors: [] });
});

test("assets resolve independently through the deterministic fallback kit", () => {
  const partial = {
    ...FALLBACK_PRESENTATION_KIT,
    assets: {
      ...FALLBACK_PRESENTATION_KIT.assets,
      audio: {
        "attack.declare": { ...FALLBACK_PRESENTATION_KIT.assets.audio["attack.declare"], path: "/authored/attack.ogg", status: "approved" }
      }
    }
  };
  expect(resolvePresentationAsset(partial, "audio", "attack.declare").path).toBe("/authored/attack.ogg");
  expect(resolvePresentationAsset(partial, "audio", "card.draw").path).toContain("card-draw.wav");
});

test("a failed or malformed runtime kit safely returns the fallback", async () => {
  const missing = await loadPresentationKit("/missing", { fetcher: async () => ({ ok: false, status: 404 }) });
  expect(missing.kitId).toBe(CORE_PRESENTATION_KIT_ID);
  expect(missing.loadError).toMatch(/unable to load/i);

  const malformed = await loadPresentationKit("/bad", { fetcher: async () => ({ ok: true, json: async () => ({}) }) });
  expect(malformed.kitId).toBe(CORE_PRESENTATION_KIT_ID);
  expect(malformed.loadError).toMatch(/schemaVersion/i);
});

test("the shared cache creates once and disposes loaded authored assets", async () => {
  const cache = new PresentationAssetCache();
  const asset = { dispose: jest.fn() };
  const factory = jest.fn(async () => asset);
  expect(await cache.get("board", factory)).toBe(asset);
  expect(await cache.get("board", factory)).toBe(asset);
  expect(factory).toHaveBeenCalledTimes(1);
  cache.dispose();
  await Promise.resolve();
  expect(asset.dispose).toHaveBeenCalledTimes(1);
});

test("strict validation rejects unapproved cutover assets", () => {
  const kit = JSON.parse(JSON.stringify(FALLBACK_PRESENTATION_KIT));
  kit.assets.effects["attack.declare"].requiredForCutover = true;
  const result = validatePresentationKit(kit, { requireApproved: true });
  expect(result.valid).toBe(false);
  expect(result.errors.join(" ")).toMatch(/not approved/i);
});

test("candidate assets require durable checksum and provenance records", () => {
  const kit = JSON.parse(JSON.stringify(FALLBACK_PRESENTATION_KIT));
  kit.assets.materials["board.surface-overlay"] = {
    id: "board.surface-overlay",
    role: "board-surface-overlay",
    format: "webp",
    path: "/board.webp",
    status: "candidate",
    revision: "delivery-1",
    provenanceRef: "missing-delivery"
  };
  const invalid = validatePresentationKit(kit);
  expect(invalid.valid).toBe(false);
  expect(invalid.errors.join(" ")).toMatch(/unknown provenanceRef/i);
  expect(invalid.errors.join(" ")).toMatch(/checksum/i);

  kit.provenanceSources = { "missing-delivery": { source: "delivery.zip" } };
  kit.assets.materials["board.surface-overlay"].checksum = "sha256:abc";
  expect(validatePresentationKit(kit)).toEqual({ valid: true, errors: [] });
});

test("reference and structural board composites cannot become runtime assets", () => {
  const kit = JSON.parse(JSON.stringify(FALLBACK_PRESENTATION_KIT));
  kit.assets.materials["board.reference"] = {
    id: "board.reference",
    role: "reference-only-board-concept",
    format: "webp",
    path: "/board.webp",
    status: "provisional",
    revision: "reference-1",
    referenceOnly: true,
    structuralComposite: true,
    runtimeSelectable: true
  };
  const invalid = validatePresentationKit(kit);
  expect(invalid.valid).toBe(false);
  expect(invalid.errors.join(" ")).toMatch(/reference-only.*runtime selectable/i);
  expect(invalid.errors.join(" ")).toMatch(/structural composite.*runtime selectable/i);
});
