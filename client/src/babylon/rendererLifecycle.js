export const IDLE_RENDER_FPS = 30;

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
