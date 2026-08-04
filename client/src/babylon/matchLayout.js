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
    attackX: -2.45,
    blockX: 1.6,
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
