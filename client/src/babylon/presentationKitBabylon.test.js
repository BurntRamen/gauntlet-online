import {
  loadAuthoredPresentationModule,
  loadAuthoredPresentationTexture,
  shouldLoadAuthoredModule,
  shouldLoadAuthoredTexture
} from "./presentationKitBabylon";
import { PresentationAssetCache } from "./presentationKit";

test("only candidate or approved GLB modules replace deterministic fallbacks", () => {
  expect(shouldLoadAuthoredModule({ format: "glb", path: "/board.glb", status: "approved" })).toBe(true);
  expect(shouldLoadAuthoredModule({ format: "glb", path: "/board.glb", status: "candidate" })).toBe(true);
  expect(shouldLoadAuthoredModule({ format: "webp", path: "/board.webp", status: "approved" })).toBe(false);
  expect(shouldLoadAuthoredModule({ format: "glb", path: "/board.glb", status: "provisional" })).toBe(false);
  expect(shouldLoadAuthoredModule({ status: "approved" })).toBe(false);
});

test("authored modules fall back independently when no presentation loader is installed", async () => {
  const result = await loadAuthoredPresentationModule({}, {
    id: "board.base",
    format: "glb",
    path: "/board.glb",
    status: "approved"
  });
  expect(result).toEqual({ loaded: false, roots: [], reason: "loader-unavailable" });
});

test("candidate and approved textures can layer over fallbacks without replacing interaction geometry", () => {
  expect(shouldLoadAuthoredTexture({ path: "/board.webp", status: "candidate" })).toBe(true);
  expect(shouldLoadAuthoredTexture({ path: "/board.webp", status: "approved" })).toBe(true);
  expect(shouldLoadAuthoredTexture({ path: "/board.webp", status: "provisional" })).toBe(false);
  expect(shouldLoadAuthoredTexture({ status: "candidate" })).toBe(false);
});

test("authored textures cache once and fail independently", async () => {
  const texture = { dispose: jest.fn() };
  const textureLoader = jest.fn(async () => texture);
  const asset = { id: "board.surface-overlay", path: "/board.webp", status: "candidate" };
  const cache = new PresentationAssetCache();
  const first = await loadAuthoredPresentationTexture({}, asset, { textureLoader, cache });
  const second = await loadAuthoredPresentationTexture({}, asset, { textureLoader, cache });
  expect(first).toEqual({ loaded: true, texture });
  expect(second).toEqual({ loaded: true, texture });
  expect(textureLoader).toHaveBeenCalledTimes(1);

  const failed = await loadAuthoredPresentationTexture({}, asset, {
    textureLoader: async () => { throw new Error("missing texture"); }
  });
  expect(failed).toEqual({ loaded: false, texture: null, reason: "missing texture" });
});

test("the presentation loader caches an authored source and creates requested instances", async () => {
  const instantiate = jest.fn((instance) => ({ id: instance.id, dispose: jest.fn() }));
  const modelLoader = jest.fn(async () => ({ instantiate, dispose: jest.fn() }));
  const asset = { id: "lane.module", format: "glb", path: "/lane.glb", status: "candidate" };
  const result = await loadAuthoredPresentationModule({}, asset, {
    modelLoader,
    instances: [{ id: "lane-0" }, { id: "lane-1" }]
  });

  expect(result.loaded).toBe(true);
  expect(result.roots.map((root) => root.id)).toEqual(["lane-0", "lane-1"]);
  expect(modelLoader).toHaveBeenCalledTimes(1);
  expect(instantiate).toHaveBeenCalledTimes(2);
});
