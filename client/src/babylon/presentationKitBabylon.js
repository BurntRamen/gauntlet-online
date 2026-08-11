import { PresentationAssetCache, presentationAssets } from "./presentationKit";

export function shouldLoadAuthoredModule(asset) {
  return Boolean(
    asset?.format === "glb"
    && asset?.path
    && ["candidate", "approved"].includes(asset.status)
  );
}

export function shouldLoadAuthoredTexture(asset) {
  return Boolean(asset?.path && ["candidate", "approved"].includes(asset.status));
}

export async function loadAuthoredPresentationTexture(scene, asset, {
  cache = new PresentationAssetCache(),
  textureLoader
} = {}) {
  if (!shouldLoadAuthoredTexture(asset)) return { loaded: false, texture: null, reason: "fallback" };
  if (typeof textureLoader !== "function") {
    return { loaded: false, texture: null, reason: "loader-unavailable" };
  }
  try {
    const texture = await cache.get(`texture:${asset.path}`, () => textureLoader({ scene, asset }));
    if (!texture) throw new Error("Presentation texture loader returned no texture.");
    return { loaded: true, texture };
  } catch (error) {
    return { loaded: false, texture: null, reason: error?.message || String(error) };
  }
}

export async function loadAuthoredPresentationModule(scene, asset, {
  cache = new PresentationAssetCache(),
  modelLoader,
  instances = [{ id: asset?.id || "module", position: { x: 0, y: 0, z: 0 } }]
} = {}) {
  if (!shouldLoadAuthoredModule(asset)) return { loaded: false, roots: [], reason: "fallback" };
  if (typeof modelLoader !== "function") {
    return { loaded: false, roots: [], reason: "loader-unavailable" };
  }
  try {
    const source = await cache.get(`module:${asset.path}`, () => modelLoader({ scene, asset }));
    if (typeof source?.instantiate !== "function") {
      throw new Error("Presentation model loader must return an instantiable cached source.");
    }
    const instantiated = await Promise.all(instances.map(async (instance) => ({
      instance,
      root: await source.instantiate(instance)
    })));
    const loadedInstances = instantiated.filter(({ root }) => Boolean(root));
    return {
      loaded: true,
      roots: loadedInstances.map(({ root }) => root),
      instances: loadedInstances,
      source
    };
  } catch (error) {
    return { loaded: false, roots: [], reason: error?.message || String(error) };
  }
}

export async function loadAuthoredPresentationModules(scene, kit, placements, options = {}) {
  const results = {};
  for (const [id, asset] of Object.entries(presentationAssets(kit, "modules"))) {
    results[id] = await loadAuthoredPresentationModule(scene, asset, {
      ...options,
      instances: placements?.[id] || [{ id, position: { x: 0, y: 0, z: 0 } }]
    });
  }
  return results;
}
