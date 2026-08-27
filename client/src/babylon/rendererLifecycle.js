export const IDLE_RENDER_FPS = 30;
export const DEFAULT_GRAPHICS_QUALITY = "balanced";
export const GRAPHICS_QUALITY_OPTIONS = Object.freeze([
  Object.freeze({
    id: "performance",
    label: "Performance",
    description: "Lower resolution for smoother play on integrated or older graphics.",
    maxPixels: 550000
  }),
  Object.freeze({
    id: DEFAULT_GRAPHICS_QUALITY,
    label: "Balanced",
    description: "Automatically balances sharpness and performance.",
    maxPixels: 900000
  }),
  Object.freeze({
    id: "high",
    label: "High",
    description: "Uses the display's native resolution for sharper cards and text.",
    fixedScalingLevel: 1
  }),
  Object.freeze({
    id: "ultra",
    label: "Ultra",
    description: "Supersamples the table for high-end graphics hardware.",
    fixedScalingLevel: 0.75
  })
]);

const GRAPHICS_QUALITY_BY_ID = Object.freeze(Object.fromEntries(
  GRAPHICS_QUALITY_OPTIONS.map((option) => [option.id, option])
));

export function normalizeGraphicsQuality(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return GRAPHICS_QUALITY_BY_ID[normalized]?.id || DEFAULT_GRAPHICS_QUALITY;
}

export function matchHardwareScalingLevel(width, height, quality = DEFAULT_GRAPHICS_QUALITY) {
  const profile = GRAPHICS_QUALITY_BY_ID[normalizeGraphicsQuality(quality)];
  if (profile.fixedScalingLevel != null) return profile.fixedScalingLevel;
  const pixelCount = Math.max(1, Number(width) || 1) * Math.max(1, Number(height) || 1);
  const budget = Math.max(1, Number(profile.maxPixels) || 900000);
  return Number(Math.max(1, Math.min(2, Math.sqrt(pixelCount / budget))).toFixed(3));
}

export function shouldRenderMatchFrame({
  now,
  lastRenderedAt,
  animationActive,
  hidden = false
}) {
  if (animationActive) return true;
  const targetFps = hidden ? 4 : IDLE_RENDER_FPS;
  const intervalMs = 1000 / targetFps;
  return !Number.isFinite(lastRenderedAt) || Number(now) - Number(lastRenderedAt) >= intervalMs;
}

export function renderMatchFrame(renderer, onFailure) {
  try {
    renderer.scene.render();
    return true;
  } catch (error) {
    onFailure?.(error);
    return false;
  }
}
