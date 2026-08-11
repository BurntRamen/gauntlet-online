import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import {
  BOARD_LAYOUT_PROFILES,
  BOARD_SCENE_LAYERS,
  createBoardStageDescriptor
} from "./boardStage";

function preserveWorldParent(mesh, parent, mount) {
  const position = mesh.position.clone();
  mesh.parent = parent;
  mesh.position.set(position.x - mount.x, position.y, position.z - mount.z);
}

function pileModuleId(name) {
  const lower = name.toLowerCase();
  if (!lower.startsWith("pile-")) return null;
  if (lower.includes("localdeck")) return "pile-local-deck";
  if (lower.includes("localdiscard")) return "pile-local-discard";
  if (lower.includes("opponentdeck")) return "pile-opponent-deck";
  if (lower.includes("opponentdiscard")) return "pile-opponent-discard";
  return null;
}

function laneModuleId(name) {
  const patterns = [
    /^lane-(\d)(?:$|-)/,
    /^lane-(?:rail|state-light|anchor|frame|sigil|label)-(\d)(?:$|-)/,
    /^combat-(?:line|arrow)-(\d)$/
  ];
  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) return `lane-${match[1]}`;
  }
  return null;
}

function moduleIdForMesh(mesh) {
  const name = mesh.name || "";
  const lane = laneModuleId(name);
  if (lane) return lane;
  const pile = pileModuleId(name);
  if (pile) return pile;
  if (name === "independent-hand-combat" || name.startsWith("hand-combat-") || name.startsWith("combat-state-light")) {
    return "hand-combat-dais";
  }
  if (name.startsWith("payment-")) return "payment-tray";
  if (
    name === "tabletop"
    || name === "table-inlay"
    || name.startsWith("table-edge-")
    || name.startsWith("board-")
    || name.startsWith("priority-")
  ) return "board-base";
  return null;
}

function layerForMesh(mesh) {
  const name = mesh.name || "";
  if (name.includes("state-light") || name.startsWith("priority-")) return "StateLightingLayer";
  if (["event-ring", "event-sprite", "turn-sweep"].includes(name)) return "TransientFxLayer";
  return "BoardStage";
}

export function createBabylonBoardStage(scene, initialProfile = BOARD_LAYOUT_PROFILES.desktop) {
  const roots = Object.fromEntries(BOARD_SCENE_LAYERS.filter((id) => id !== "ReactShell").map((id) => {
    const root = new TransformNode(id, scene);
    root.metadata = { gauntletSceneLayer: id };
    return [id, root];
  }));
  const descriptor = createBoardStageDescriptor(BOARD_LAYOUT_PROFILES.desktop);
  const modules = new Map(descriptor.boardModules.map((module) => {
    const root = new TransformNode(`BoardModule:${module.id}`, scene);
    root.parent = roots.BoardStage;
    root.position.set(module.mount.x, module.mount.y, module.mount.z);
    root.metadata = {
      gauntletSceneLayer: "BoardStage",
      gauntletBoardModule: module.id,
      gauntletSemanticModule: module.semanticId
    };
    return [module.id, { ...module, root, meshCount: 0 }];
  }));

  scene.meshes.slice().forEach((mesh) => {
    const moduleId = moduleIdForMesh(mesh);
    const layer = layerForMesh(mesh);
    mesh.metadata = { ...(mesh.metadata || {}), gauntletSceneLayer: layer };
    if (["TransientFxLayer", "WorldReadoutLayer"].includes(layer)) {
      preserveWorldParent(mesh, roots[layer], { x: 0, z: 0 });
      return;
    }
    const module = modules.get(moduleId);
    if (!module) return;
    preserveWorldParent(mesh, module.root, module.mount);
    module.meshCount += 1;
  });

  let profile = BOARD_LAYOUT_PROFILES.desktop;
  function applyProfile(nextProfile = BOARD_LAYOUT_PROFILES.desktop) {
    profile = nextProfile;
    const nextDescriptor = createBoardStageDescriptor(nextProfile);
    nextDescriptor.boardModules.forEach((nextModule) => {
      const module = modules.get(nextModule.id);
      if (!module) return;
      module.root.position.set(nextModule.mount.x, nextModule.mount.y, nextModule.mount.z);
      module.root.scaling.set(nextModule.scale.x, nextModule.scale.y, nextModule.scale.z);
    });
    return nextDescriptor;
  }
  applyProfile(initialProfile);

  function attachAuthoredRoot(moduleId, root) {
    const module = modules.get(moduleId);
    if (!module || !root) return false;
    root.parent = module.root;
    root.position?.set?.(0, 0, 0);
    root.metadata = {
      ...(root.metadata || {}),
      gauntletSceneLayer: "BoardStage",
      gauntletBoardModule: moduleId,
      gauntletAuthoredModule: true
    };
    module.authoredRootCount = Number(module.authoredRootCount || 0) + 1;
    return true;
  }

  function resetAuthoredRoots() {
    modules.forEach((module) => {
      module.authoredRootCount = 0;
    });
  }

  return {
    layers: roots,
    modules,
    applyProfile,
    attachAuthoredRoot,
    resetAuthoredRoots,
    get profile() {
      return profile;
    },
    getMetrics() {
      const current = createBoardStageDescriptor(profile);
      return {
        ...current,
        boardModules: current.boardModules.map((module) => ({
          ...module,
          meshCount: modules.get(module.id)?.meshCount || 0,
          authoredRootCount: modules.get(module.id)?.authoredRootCount || 0
        }))
      };
    }
  };
}
