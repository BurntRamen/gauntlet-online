import { getBoardLayoutProfile } from "./boardPresentation";

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
    y: 0.22,
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
    x: 10.75,
    z: -6.35,
    y: 0.3,
    width: 6.05,
    depth: 4.25,
    spread: 1.5,
    rowSpread: 2.1,
    columns: 4,
    scale: 0.6
  },
  piles: {
    localDeck: { x: -12.6, z: -6.75 },
    localDiscard: { x: -10.4, z: -6.75 },
    opponentDeck: { x: 9.9, z: 7.02 },
    opponentDiscard: { x: 7.9, z: 7.02 }
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
      + centered * (isBlocker ? 1.56 : MATCH_LAYOUT.handCombat.spread),
    y: MATCH_LAYOUT.handCombat.y + (isBlocker ? 0.24 : 0.3) + index * 0.012,
    z: MATCH_LAYOUT.handCombat.z,
    rotationX: Math.PI / 2,
    rotationZ: ownerIsLocal ? 0 : Math.PI,
    scale: isBlocker ? 0.62 : 0.68
  };
}

export function getHandCombatTickerPosition(index = 0, count = 1, role = "attacker", ownerIsLocal = true) {
  const safeCount = Math.max(1, count);
  const centered = index - (safeCount - 1) / 2;
  const preferredScale = 0.58;
  const gap = 0.12;
  const scale = Math.min(
    preferredScale,
    Math.max(0.24, (MATCH_LAYOUT.handCombat.width - 0.5 - gap * (safeCount - 1))
      / (MATCH_LAYOUT.card.width * safeCount))
  );
  const visibleCardWidth = MATCH_LAYOUT.card.width * scale;
  const spread = safeCount <= 1 ? 0 : visibleCardWidth + gap;
  return {
    x: MATCH_LAYOUT.handCombat.x + centered * spread,
    y: MATCH_LAYOUT.handCombat.y + (role === "blocker" ? 0.22 : 0.3) + index * 0.012,
    z: MATCH_LAYOUT.handCombat.z + (role === "blocker" ? -0.16 : 0.16),
    rotationX: Math.PI / 2,
    rotationZ: ownerIsLocal ? 0 : Math.PI,
    scale
  };
}

export function getHandCombatAttachmentPosition(index = 0, count = 1, ownerIsLocal = true) {
  const safeCount = Math.max(1, count);
  const centered = index - (safeCount - 1) / 2;
  return {
    x: -6.3 + centered * 1.22,
    y: MATCH_LAYOUT.handCombat.y + 0.18 + index * 0.012,
    z: MATCH_LAYOUT.handCombat.z + (ownerIsLocal ? -0.08 : 0.08),
    rotationX: Math.PI / 2,
    rotationZ: ownerIsLocal ? 0 : Math.PI,
    scale: 0.48
  };
}

export function getPaymentPosition(index = 0, count = 1, ownerIsLocal = true) {
  const safeCount = Math.max(1, count);
  const columnCount = Math.min(MATCH_LAYOUT.payment.columns, safeCount);
  const rowCount = Math.ceil(safeCount / columnCount);
  const row = Math.floor(index / columnCount);
  const cardsInRow = Math.min(columnCount, safeCount - row * columnCount);
  const column = index % columnCount;
  const centered = column - (cardsInRow - 1) / 2;
  const visibleCardWidth = MATCH_LAYOUT.card.width * MATCH_LAYOUT.payment.scale;
  const availableCenterSpan = Math.max(0, MATCH_LAYOUT.payment.width - visibleCardWidth);
  const spread = cardsInRow <= 1
    ? 0
    : Math.min(MATCH_LAYOUT.payment.spread, availableCenterSpan / (cardsInRow - 1));
  return {
    x: MATCH_LAYOUT.payment.x + centered * spread + (row % 2 ? spread * 0.18 : 0),
    y: MATCH_LAYOUT.payment.y + index * 0.018,
    z: MATCH_LAYOUT.payment.z + (row - (rowCount - 1) / 2) * MATCH_LAYOUT.payment.rowSpread,
    rotationX: Math.PI / 2,
    rotationZ: (ownerIsLocal ? 0 : Math.PI) + centered * -0.035,
    scale: MATCH_LAYOUT.payment.scale
  };
}

export function getLaneCombatPosition(laneIndex, role, index = 0, count = 1, ownerIsLocal = true) {
  const safeCount = Math.max(1, count);
  const centered = index - (safeCount - 1) / 2;
  const isBlocker = role === "blocker";
  const preferredScale = isBlocker ? 0.58 : 0.68;
  const gap = 0.12;
  const scale = Math.min(
    preferredScale,
    Math.max(0.3, (MATCH_LAYOUT.lanes.width - 0.45 - gap * (safeCount - 1))
      / (MATCH_LAYOUT.card.width * safeCount))
  );
  return {
    x: (MATCH_LAYOUT.lanes.x[laneIndex] || 0) + centered * (MATCH_LAYOUT.card.width * scale + gap),
    y: 0.42 + index * 0.012,
    z: MATCH_LAYOUT.anchors.resolution + (isBlocker ? -1.25 : 1.25),
    rotationX: Math.PI / 2,
    rotationZ: ownerIsLocal ? 0 : Math.PI,
    scale
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
  const profile = getBoardLayoutProfile(safeWidth, safeHeight);
  // On phone portrait, frame the complete playable core (all lanes, hand,
  // combat zones) rather than shrinking it to preserve decorative table ends.
  const requiredWidthHalf = profile.cameraWidth / 2;
  const boardTransform = profile.modules?.["board-base"] || { z: 0, scaleZ: 1 };
  const boardHalfHeight = Math.abs(Number(boardTransform.z || 0))
    + MATCH_LAYOUT.table.depth * Number(boardTransform.scaleZ || 1) / 2
    + 0.4;
  const halfHeight = Math.max(boardHalfHeight, requiredWidthHalf / Math.max(0.1, aspect));
  return {
    aspect,
    profile: profile.id,
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
