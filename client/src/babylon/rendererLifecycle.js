export function renderMatchFrame(renderer, onFailure) {
  try {
    renderer.scene.render();
    return true;
  } catch (error) {
    onFailure?.(error);
    return false;
  }
}
