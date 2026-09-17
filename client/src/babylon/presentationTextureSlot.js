// Keeps a working material visible while loading its replacement. A late or
// failed request must never overwrite a newer selection or revive a dead scene.
export function createPresentationTextureSlot({ loadTexture, applyTexture }) {
  let desiredPath = null;
  let activeTexture = null;
  let generation = 0;
  let disposed = false;
  const pending = new Set();

  function release(texture) {
    if (pending.delete(texture)) texture.dispose();
  }

  return {
    setPath(path) {
      if (disposed || path === desiredPath) return;
      desiredPath = path;
      const requestGeneration = ++generation;
      let request;
      try {
        request = loadTexture(path);
      } catch {
        desiredPath = null;
        return;
      }
      pending.add(request.texture);
      Promise.resolve(request.ready).then((loaded) => {
        if (disposed || requestGeneration !== generation || !loaded) {
          release(request.texture);
          if (!disposed && requestGeneration === generation) desiredPath = null;
          return;
        }
        pending.delete(request.texture);
        const previous = activeTexture;
        activeTexture = request.texture;
        applyTexture(activeTexture);
        previous?.dispose();
      }, () => {
        release(request.texture);
        if (!disposed && requestGeneration === generation) desiredPath = null;
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation += 1;
      pending.forEach((texture) => texture.dispose());
      pending.clear();
      activeTexture?.dispose();
      activeTexture = null;
    }
  };
}
