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
  return Number(Math.max(1, Math.sqrt(pixelCount / budget)).toFixed(3));
}

export function shouldRenderMatchFrame({
  now,
  lastRenderedAt,
  animationActive,
  hidden = false
}) {
  if (animationActive && !hidden) return true;
  const targetFps = hidden ? 4 : IDLE_RENDER_FPS;
  const intervalMs = 1000 / targetFps;
  // Vsync timestamps fluctuate around 16.67ms. An exact 33.33ms comparison
  // otherwise skips every third frame, turning the 30fps cap into 20fps bursts.
  return !Number.isFinite(lastRenderedAt) || Number(now) - Number(lastRenderedAt) >= intervalMs - 1;
}

export function createAdaptiveResolutionController() {
  let previous = null;
  let samples = [];
  return ({ now, hidden, quality, baseScaling, currentScaling }) => {
    const elapsed = previous == null ? 0 : now - previous;
    previous = now;
    if (hidden || quality !== "balanced" || elapsed > 250) { samples = []; return currentScaling; }
    if (elapsed > 0) samples.push(elapsed);
    if (samples.length < 120) return currentScaling;
    const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    samples = [];
    // Only lower resolution after sustained pressure; never oscillate the
    // canvas size during a match or override the player's manual quality choice.
    return average > 24
      ? Math.min(baseScaling * 1.6, currentScaling * 1.15)
      : currentScaling;
  };
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
