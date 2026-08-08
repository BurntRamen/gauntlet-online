export const MATCH_LAYOUT = {
  viewport: { halfHeight: 9.35, padding: 0.55 },
  table: { width: 28.4, depth: 17.9, y: -0.42 },
  lanes: {
    x: [-7.35, 0, 7.35],
    z: -0.15,
    width: 6.35,
    depth: 7.95
  },
  opponentHand: { x: 0, z: 7.95, y: 0.88, scale: 0.54, spread: 1.22 },
  playerHand: { x: -0.6, z: -7.05, y: 0.62, scale: 0.9, spread: 1.9 },
  handCombat: {
    x: 0,
    y: 0.72,
    z: 5.25,
    width: 13.6,
    depth: 2.45,
    spread: 1.82,
    attackX: -3.65,
    blockX: 2.35,
    localRow: 5.25,
    opponentRow: 5.25,
    localBlockRow: 5.25,
    opponentBlockRow: 5.25
  },
  payment: {
    x: 12.15,
    z: -3.6,
    y: 0.74,
    width: 3.7,
    depth: 1.72,
    spread: 0.68
  },
  piles: {
    localDeck: { x: -12.35, z: -6.75 },
    localDiscard: { x: -9.95, z: -6.75 },
    opponentDeck: { x: 12.35, z: 7.02 },
    opponentDiscard: { x: 9.95, z: 7.02 }
  },
  pilePads: {
    deck: { width: 1.68, depth: 2.26 },
    discard: { width: 2.08, depth: 2.72 }
  },
  anchors: {
    opponentFacedown: 3.05,
    opponentAttack: 1.65,
    resolution: -0.05,
    localAttack: -1.72,
    localFacedown: -3.15
  },
  card: { width: 2.3, height: 3.22, depth: 0.1 }
};

export function getHandCombatPosition(role, index = 0, count = 1, ownerIsLocal = true) {
  const safeCount = Math.max(1, count);
  const centered = index - (safeCount - 1) / 2;
  const isBlocker = role === "blocker";
  return {
    x: MATCH_LAYOUT.handCombat.x
      + (isBlocker ? MATCH_LAYOUT.handCombat.blockX : MATCH_LAYOUT.handCombat.attackX)
      + centered * (isBlocker ? 1.34 : MATCH_LAYOUT.handCombat.spread),
    y: MATCH_LAYOUT.handCombat.y + (isBlocker ? 0.24 : 0.3) + index * 0.012,
    z: MATCH_LAYOUT.handCombat.z,
    rotationX: Math.PI / 2,
    rotationZ: ownerIsLocal ? 0 : Math.PI,
    scale: isBlocker ? 0.62 : 0.68
  };
}

export function getLaneCombatPosition(laneIndex, role, index = 0, count = 1, ownerIsLocal = true) {
  const safeCount = Math.max(1, count);
  const centered = index - (safeCount - 1) / 2;
  const isBlocker = role === "blocker";
  return {
    x: (MATCH_LAYOUT.lanes.x[laneIndex] || 0)
      + (isBlocker ? 1.35 : -1.45)
      + (isBlocker ? centered * 0.7 : 0),
    y: 0.42 + index * 0.012,
    z: MATCH_LAYOUT.anchors.resolution + (ownerIsLocal ? -0.18 : 0.18),
    rotationX: Math.PI / 2,
    rotationZ: ownerIsLocal ? 0 : Math.PI,
    scale: isBlocker ? 0.62 : 0.72
  };
}

export function getBattlefieldSafeFrame(width, height) {
  const viewportWidth = Math.max(1, Number(width) || 1);
  const viewportHeight = Math.max(1, Number(height) || 1);
  const portraitPhone = viewportWidth <= 600 && viewportHeight > viewportWidth;
  const shortLandscape = viewportHeight <= 520 && viewportWidth > viewportHeight;
  const tablet = viewportWidth <= 1024;
  const top = portraitPhone ? 64 : shortLandscape ? 64 : tablet && viewportWidth <= 900 ? 82 : 96;
  const bottom = portraitPhone ? 140 : shortLandscape ? 104 : tablet ? 158 : 152;
  const side = viewportWidth <= 600 ? 4 : viewportWidth <= 1024 ? 6 : 8;
  const battlefield = {
    x: side,
    y: top,
    width: Math.max(1, viewportWidth - side * 2),
    height: Math.max(1, viewportHeight - top - bottom)
  };
  return {
    width: viewportWidth,
    height: viewportHeight,
    top,
    bottom,
    left: side,
    right: side,
    battlefield,
    topHud: { x: 0, y: 0, width: viewportWidth, height: top },
    bottomHud: { x: 0, y: viewportHeight - bottom, width: viewportWidth, height: bottom }
  };
}

export function getTableCameraProjection(width, height) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const aspect = safeWidth / safeHeight;
  // On phone portrait, frame the complete playable core (all lanes, hand,
  // combat zones) rather than shrinking it to preserve decorative table ends.
  const requiredWidthHalf = aspect < 0.72
    ? 10.4
    : MATCH_LAYOUT.table.width / 2 + MATCH_LAYOUT.viewport.padding;
  const halfHeight = Math.max(MATCH_LAYOUT.viewport.halfHeight, requiredWidthHalf / Math.max(0.1, aspect));
  return {
    aspect,
    top: halfHeight,
    bottom: -halfHeight,
    left: -halfHeight * aspect,
    right: halfHeight * aspect
  };
}

export function getHandHoverPosition(position, reducedMotion = false) {
  return {
    ...position,
    // Keep the clickable footprint in its fan slot. The old hover moved the
    // pickable mesh toward the board, allowing a neighbouring card to take
    // over while the pointer was still.
    y: position.y + (reducedMotion ? 0.06 : 0.18),
    rotationZ: position.rotationZ * (reducedMotion ? 0.92 : 0.78),
    scale: position.scale * (reducedMotion ? 1.03 : 1.08)
  };
}

export function getLanePosition(index, side = "center") {
  const x = MATCH_LAYOUT.lanes.x[index] || 0;
  const z = side === "player"
    ? MATCH_LAYOUT.anchors.localFacedown
    : side === "opponent"
      ? MATCH_LAYOUT.anchors.opponentFacedown
      : MATCH_LAYOUT.anchors.resolution;
  return {
    x,
    y: 0.16,
    z,
    rotationX: Math.PI / 2,
    rotationZ: side === "opponent" ? Math.PI : 0
  };
}

export function getFanPosition(index, count, side = "player", overrides = {}) {
  const hand = side === "player" ? MATCH_LAYOUT.playerHand : MATCH_LAYOUT.opponentHand;
  const safeCount = Math.max(1, count);
  const centered = index - (safeCount - 1) / 2;
  const normalized = safeCount > 1 ? centered / ((safeCount - 1) / 2) : 0;
  const spread = overrides.spread ?? hand.spread;
  return {
    x: (overrides.x ?? hand.x ?? 0) + centered * spread,
    y: hand.y,
    z: hand.z - Math.abs(normalized) * (side === "player" ? 0.26 : 0.1),
    rotationX: Math.PI / 2,
    rotationY: 0,
    rotationZ: (side === "opponent" ? Math.PI : 0) + normalized * (side === "player" ? -0.1 : 0.075),
    scale: overrides.scale ?? hand.scale
  };
}

export function normalizeVisibleCardRotation(rotation = 0) {
  let viewerRotation = Number(rotation || 0) % Math.PI;
  if (viewerRotation > Math.PI / 2) viewerRotation -= Math.PI;
  if (viewerRotation < -Math.PI / 2) viewerRotation += Math.PI;
  return viewerRotation;
}
