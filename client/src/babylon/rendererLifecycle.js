export const IDLE_RENDER_FPS = 30;
export const MAX_MATCH_RENDER_PIXELS = 900000;

export function matchHardwareScalingLevel(width, height, maxPixels = MAX_MATCH_RENDER_PIXELS) {
  const pixelCount = Math.max(1, Number(width) || 1) * Math.max(1, Number(height) || 1);
  const budget = Math.max(1, Number(maxPixels) || MAX_MATCH_RENDER_PIXELS);
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
