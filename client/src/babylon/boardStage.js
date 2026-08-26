export const BOARD_STAGE_CONTRACT_VERSION = "gauntlet.board-stage.native.v1";

export const BOARD_SCENE_LAYERS = Object.freeze([
  "BoardStage",
  "CardLayer",
  "StateLightingLayer",
  "TransientFxLayer",
  "WorldReadoutLayer",
  "ReactShell"
]);

const DESKTOP_MOUNTS = Object.freeze({
  "board-base": { x: 0, z: 0, width: 28.4, depth: 17.9 },
  "lane-0": { x: -7.35, z: -0.15, width: 6.35, depth: 7.95 },
  "lane-1": { x: 0, z: -0.15, width: 6.35, depth: 7.95 },
  "lane-2": { x: 7.35, z: -0.15, width: 6.35, depth: 7.95 },
  "hand-combat-dais": { x: 0, z: 5.25, width: 13.6, depth: 2.45 },
  "payment-tray": { x: 10.75, z: -6.35, width: 6.05, depth: 4.25 },
  "pile-local-deck": { x: -12.6, z: -6.75, width: 1.68, depth: 2.26 },
  "pile-local-discard": { x: -10.4, z: -6.75, width: 2.08, depth: 2.72 },
  "pile-opponent-deck": { x: 9.9, z: 7.02, width: 1.68, depth: 2.26 },
  "pile-opponent-discard": { x: 7.9, z: 7.02, width: 2.08, depth: 2.72 }
});

function freezeProfile(profile) {
  return Object.freeze({
    ...profile,
    modules: Object.freeze(Object.fromEntries(
      Object.entries(profile.modules).map(([id, module]) => [id, Object.freeze(module)])
    )),
    anchors: Object.freeze({
      ...profile.anchors,
      laneX: Object.freeze(profile.anchors.laneX.slice()),
      piles: Object.freeze(Object.fromEntries(
        Object.entries(profile.anchors.piles).map(([id, position]) => [id, Object.freeze(position)])
      ))
    })
  });
}

function scaledDesktopModules(scaleX = 1, scaleZ = 1) {
  return Object.fromEntries(Object.entries(DESKTOP_MOUNTS).map(([id, module]) => [id, {
    x: module.x * scaleX,
    z: module.z * scaleZ,
    scaleX,
    scaleZ
  }]));
}

const desktopModules = scaledDesktopModules();
// Short landscape is a recomposed physical table, not the desktop board scaled
// uniformly. Compressing depth keeps the three tactical lanes readable in the
// very shallow battlefield left by browser chrome and the action rail.
const shortLandscapeModules = scaledDesktopModules(0.92, 0.62);
const ultrawideModules = scaledDesktopModules(0.94, 0.66);
const portraitModules = {
  "board-base": { x: 0, z: 0, scaleX: 0.58, scaleZ: 1.5 },
  "lane-0": { x: -4.35, z: 0, scaleX: 0.68, scaleZ: 1.1 },
  "lane-1": { x: 0, z: 0, scaleX: 0.68, scaleZ: 1.1 },
  "lane-2": { x: 4.35, z: 0, scaleX: 0.68, scaleZ: 1.1 },
  "hand-combat-dais": { x: 0, z: 9.5, scaleX: 0.72, scaleZ: 0.9 },
  "payment-tray": { x: 0, z: -8.3, scaleX: 0.82, scaleZ: 0.8 },
  "pile-local-deck": { x: -6.15, z: 12, scaleX: 0.68, scaleZ: 0.68 },
  "pile-local-discard": { x: -6.15, z: 9.5, scaleX: 0.68, scaleZ: 0.68 },
  "pile-opponent-deck": { x: 6.15, z: 12, scaleX: 0.68, scaleZ: 0.68 },
  "pile-opponent-discard": { x: 6.15, z: 9.5, scaleX: 0.68, scaleZ: 0.68 }
};

function moduleAnchors(profile, moduleId, bounds) {
  if (moduleId.startsWith("lane-")) {
    const laneIndex = Number(moduleId.slice(-1));
    const x = profile.anchors.laneX[laneIndex];
    return {
      opponentFacedown: { x, y: 0.43, z: profile.anchors.lane.opponent },
      opponentCombat: { x, y: 0.53, z: profile.anchors.lane.attacker },
      resolution: { x, y: 0.5, z: profile.anchors.lane.center },
      localCombat: { x, y: 0.53, z: profile.anchors.lane.blocker },
      localFacedown: { x, y: 0.43, z: profile.anchors.lane.local },
      fxCenter: { x, y: 0.84, z: profile.anchors.lane.center },
      readout: { x, y: 0.28, z: profile.anchors.lane.center },
      interactionBounds: { ...bounds }
    };
  }
  if (moduleId === "hand-combat-dais") {
    return {
      attackerGroup: { x: profile.anchors.combat.attackerX, y: 0.62, z: profile.anchors.combat.z },
      blockerGroup: { x: profile.anchors.combat.blockerX, y: 0.62, z: profile.anchors.combat.z },
      attachmentGroup: { x: profile.anchors.combat.attachmentX, y: 0.56, z: profile.anchors.combat.z },
      attackValue: { x: profile.anchors.combat.attackerX, y: 0.78, z: profile.anchors.combat.z },
      blockValue: { x: profile.anchors.combat.blockerX, y: 0.78, z: profile.anchors.combat.z },
      fxImpact: { x: profile.anchors.combat.x, y: 0.84, z: profile.anchors.combat.z },
      interactionBounds: { ...bounds }
    };
  }
  if (moduleId === "payment-tray") {
    return {
      center: { x: profile.anchors.payment.x, y: 0.55, z: profile.anchors.payment.z },
      readout: { x: profile.anchors.payment.x, y: 0.5, z: profile.anchors.payment.z },
      fxDischarge: { x: profile.anchors.payment.x, y: 0.84, z: profile.anchors.payment.z },
      interactionBounds: { ...bounds }
    };
  }
  if (moduleId.startsWith("pile-")) {
    const pileKey = {
      "pile-local-deck": "localDeck",
      "pile-local-discard": "localDiscard",
      "pile-opponent-deck": "opponentDeck",
      "pile-opponent-discard": "opponentDiscard"
    }[moduleId];
    const position = profile.anchors.piles[pileKey];
    return {
      cardAnchor: { x: position.x, y: 0.54, z: position.z },
      countMedallion: { x: position.x, y: 0.5, z: bounds.bottom - 0.22 },
      interactionBounds: { ...bounds }
    };
  }
  const boardTransform = profile.modules["board-base"] || desktopModules["board-base"];
  return {
    origin: { x: boardTransform.x, y: 0, z: boardTransform.z },
    priorityLocal: { x: boardTransform.x, y: 0.125, z: boardTransform.z + -5.35 * boardTransform.scaleZ },
    priorityOpponent: { x: boardTransform.x, y: 0.125, z: boardTransform.z + 5.85 * boardTransform.scaleZ },
    turnSweep: { x: boardTransform.x, y: 0.6, z: boardTransform.z + (17.9 / 2 - 0.8) * boardTransform.scaleZ },
    interactionBounds: { ...bounds }
  };
}

export const BOARD_LAYOUT_PROFILES = Object.freeze({
  desktop: freezeProfile({
    id: "desktop",
    cameraWidth: 29.5,
    ornament: "full",
    touchTargetScale: 1,
    modules: desktopModules,
    anchors: {
      laneX: [-7.35, 0, 7.35],
      lane: { local: -3.15, opponent: 3.05, attacker: 1.25, blocker: -1.25, center: -0.05 },
      hand: { localX: -0.6, localZ: -7.05, opponentX: 0, opponentZ: 8.15, localScale: 0.9, opponentScale: 0.46 },
      combat: { x: 0, z: 5.25, attackerX: -3.65, blockerX: 2.35, attachmentX: -5.45 },
      payment: { x: 10.75, z: -6.35 },
      piles: {
        localDeck: { x: -12.6, z: -6.75 },
        localDiscard: { x: -10.4, z: -6.75 },
        opponentDeck: { x: 9.9, z: 7.02 },
        opponentDiscard: { x: 7.9, z: 7.02 }
      }
    }
  }),
  portrait: freezeProfile({
    id: "portrait",
    cameraWidth: 16.8,
    ornament: "reduced",
    touchTargetScale: 1.24,
    modules: portraitModules,
    anchors: {
      laneX: [-4.35, 0, 4.35],
      lane: { local: -3.25, opponent: 3.25, attacker: 1.3, blocker: -1.05, center: 0 },
      hand: { localX: 0, localZ: -12, opponentX: 0, opponentZ: 12.85, localScale: 0.92, opponentScale: 0.45 },
      combat: { x: 0, z: 9.5, attackerX: -2.63, blockerX: 1.69, attachmentX: -3.92 },
      payment: { x: 0, z: -8.3 },
      piles: {
        localDeck: { x: -6.15, z: 12 },
        localDiscard: { x: -6.15, z: 9.5 },
        opponentDeck: { x: 6.15, z: 12 },
        opponentDiscard: { x: 6.15, z: 9.5 }
      }
    }
  }),
  "short-landscape": freezeProfile({
    id: "short-landscape",
    cameraWidth: 26,
    ornament: "reduced",
    touchTargetScale: 1.16,
    modules: shortLandscapeModules,
    anchors: {
      laneX: [-6.76, 0, 6.76],
      lane: { local: -1.95, opponent: 1.89, attacker: 1.02, blocker: -1.02, center: -0.03 },
      hand: { localX: -0.5, localZ: -4.15, opponentX: 0, opponentZ: 4.95, localScale: 0.94, opponentScale: 0.5 },
      combat: { x: 0, z: 3.1, attackerX: -3.36, blockerX: 2.16, attachmentX: -5.01 },
      payment: { x: 9.89, z: -3.94 },
      piles: {
        localDeck: { x: -11.59, z: -4.18 },
        localDiscard: { x: -9.57, z: -4.18 },
        opponentDeck: { x: 9.1, z: 4.35 },
        opponentDiscard: { x: 7.27, z: 4.35 }
      }
    }
  }),
  ultrawide: freezeProfile({
    id: "ultrawide",
    cameraWidth: 27,
    ornament: "full",
    touchTargetScale: 1,
    modules: ultrawideModules,
    anchors: {
      laneX: [-6.91, 0, 6.91],
      lane: { local: -2.08, opponent: 2.01, attacker: 1.08, blocker: -1.08, center: -0.03 },
      hand: { localX: -0.4, localZ: -4.55, opponentX: 0, opponentZ: 5.15, localScale: 0.72, opponentScale: 0.42 },
      combat: { x: 0, z: 3.47, attackerX: -3.43, blockerX: 2.21, attachmentX: -5.12 },
      payment: { x: 10.11, z: -4.19 },
      piles: {
        localDeck: { x: -11.84, z: -4.46 },
        localDiscard: { x: -9.78, z: -4.46 },
        opponentDeck: { x: 9.31, z: 4.63 },
        opponentDiscard: { x: 7.43, z: 4.63 }
      }
    }
  })
});

export function getBoardLayoutProfile(width, height) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const aspect = safeWidth / safeHeight;
  if (safeHeight <= 420 && aspect > 1.45) {
    return BOARD_LAYOUT_PROFILES["short-landscape"];
  }
  if (aspect >= 2.7) return BOARD_LAYOUT_PROFILES.ultrawide;
  if (aspect <= 0.72 || (safeWidth <= 920 && safeHeight >= 560 && aspect <= 1.25)) {
    return BOARD_LAYOUT_PROFILES.portrait;
  }
  return BOARD_LAYOUT_PROFILES.desktop;
}

export function boardModuleDescriptors(profile = BOARD_LAYOUT_PROFILES.desktop) {
  return Object.entries(DESKTOP_MOUNTS).map(([id, base]) => {
    const transform = profile.modules[id] || desktopModules[id];
    const bounds = {
      left: transform.x - (base.width * transform.scaleX) / 2,
      right: transform.x + (base.width * transform.scaleX) / 2,
      bottom: transform.z - (base.depth * transform.scaleZ) / 2,
      top: transform.z + (base.depth * transform.scaleZ) / 2
    };
    return {
      id,
      semanticId: id.startsWith("lane-")
        ? "lane.module"
        : id.startsWith("pile-")
          ? "pile.dock"
          : {
              "board-base": "board.base",
              "hand-combat-dais": "combat.dais",
              "payment-tray": "payment.tray"
            }[id],
      mount: { x: transform.x, y: 0, z: transform.z },
      scale: { x: transform.scaleX, y: 1, z: transform.scaleZ },
      bounds,
      anchors: moduleAnchors(profile, id, bounds)
    };
  });
}

export function createBoardStageDescriptor(profile = BOARD_LAYOUT_PROFILES.desktop) {
  const modules = boardModuleDescriptors(profile);
  return {
    sceneContract: BOARD_STAGE_CONTRACT_VERSION,
    layers: BOARD_SCENE_LAYERS.slice(),
    profile: profile.id,
    boardModuleCount: modules.length,
    boardModules: modules,
    structuralCompositeRasterCount: 0
  };
}

export function boardModuleIdForPresentationInstance(semanticId, instanceId) {
  const instance = String(instanceId || "");
  if (semanticId === "board.base") return "board-base";
  if (semanticId === "combat.dais") return "hand-combat-dais";
  if (semanticId === "payment.tray") return "payment-tray";
  if (semanticId === "lane.module" && /^lane-[0-2]$/.test(instance)) return instance;
  if (semanticId === "pile.dock") {
    return {
      localDeck: "pile-local-deck",
      localDiscard: "pile-local-discard",
      opponentDeck: "pile-opponent-deck",
      opponentDiscard: "pile-opponent-discard"
    }[instance] || null;
  }
  return null;
}

export function boardStageMotionBounds(profile = BOARD_LAYOUT_PROFILES.desktop) {
  const board = boardModuleDescriptors(profile).find((module) => module.id === "board-base");
  const hand = profile.anchors.hand;
  return {
    left: board.bounds.left + 0.75,
    right: board.bounds.right - 0.75,
    bottom: Math.min(board.bounds.bottom + 0.65, hand.localZ),
    top: Math.max(board.bounds.top - 0.65, hand.opponentZ)
  };
}

export function resolveBoardAnchor(moduleId, anchorId, profile = BOARD_LAYOUT_PROFILES.desktop) {
  const module = boardModuleDescriptors(profile).find((entry) => entry.id === moduleId);
  return module?.anchors?.[anchorId] ? { ...module.anchors[anchorId] } : null;
}

export function transformBoardAnchor(position, profile = BOARD_LAYOUT_PROFILES.desktop) {
  const boardTransform = profile.modules["board-base"] || desktopModules["board-base"];
  return {
    ...position,
    x: Number(position?.x || 0) * boardTransform.scaleX + boardTransform.x,
    z: Number(position?.z || 0) * boardTransform.scaleZ + boardTransform.z
  };
}
