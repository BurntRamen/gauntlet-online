import { BOARD_LAYOUT_PROFILES, resolveBoardAnchor } from "./boardStage";

const CARD_WIDTH = 2.3;
const CARD_HEIGHT = 3.22;

function centeredIndex(index, count) {
  return Number(index || 0) - (Math.max(1, Number(count || 1)) - 1) / 2;
}

function handPosition(actor, profile) {
  const local = actor.zone.side === "local";
  const hand = profile.anchors.hand;
  const count = Math.max(1, Number(actor.zone.count || 1));
  const index = Number(actor.zone.slotIndex || 0);
  const centered = centeredIndex(index, count);
  const normalized = count > 1 ? centered / ((count - 1) / 2) : 0;
  const scale = local ? hand.localScale : hand.opponentScale;
  const availableWidth = profile.id === "portrait" ? 14.4 : profile.id === "short-landscape" ? 22.2 : 24.5;
  const maximumSpread = local
    ? (profile.id === "portrait" ? 1.54 : profile.id === "short-landscape" ? 1.68 : 1.9)
    : (profile.id === "portrait" ? 0.88 : 1.22);
  const spread = count <= 1
    ? 0
    : Math.min(maximumSpread, Math.max(CARD_WIDTH * scale * 0.72, (availableWidth - CARD_WIDTH * scale) / (count - 1)));
  return {
    x: (local ? hand.localX : hand.opponentX) + centered * spread,
    y: local ? 0.62 : 0.88,
    z: (local ? hand.localZ : hand.opponentZ) - Math.abs(normalized) * (local ? 0.22 : 0.08),
    rotationX: Math.PI / 2,
    rotationY: 0,
    rotationZ: (local ? 0 : Math.PI) + normalized * (local ? -0.1 : 0.065),
    scale
  };
}

function lanePosition(actor, profile) {
  const laneIndex = Math.max(0, Math.min(2, Number(actor.zone.laneIndex || 0)));
  const side = actor.zone.side === "opponent" ? "opponent" : "local";
  const anchor = resolveBoardAnchor(
    `lane-${laneIndex}`,
    side === "opponent" ? "opponentFacedown" : "localFacedown",
    profile
  );
  return {
    x: anchor.x,
    y: anchor.y,
    z: anchor.z,
    rotationX: Math.PI / 2,
    rotationY: 0,
    rotationZ: side === "opponent" ? Math.PI : 0,
    scale: profile.id === "portrait" ? 0.55 : profile.id === "short-landscape" ? 0.59 : 0.64
  };
}

function combatPosition(actor, profile) {
  const role = actor.zone.role || "attacker";
  const count = Math.max(1, Number(actor.zone.count || 1));
  const index = Number(actor.zone.slotIndex || 0);
  const centered = centeredIndex(index, count);
  const handCombat = actor.zone.laneIndex == null;
  const baseScale = role === "blocker" ? 0.56 : role === "attachment" ? 0.46 : 0.62;
  const scale = profile.id === "portrait" ? baseScale * 0.9 : baseScale;
  const spread = CARD_WIDTH * scale + 0.16;
  const ownerRotation = actor.zone.side === "opponent" ? Math.PI : 0;
  if (handCombat) {
    const anchor = resolveBoardAnchor(
      "hand-combat-dais",
      role === "blocker"
        ? "blockerGroup"
      : role === "attachment"
          ? "attachmentGroup"
          : "attackerGroup",
      profile
    );
    return {
      x: anchor.x + centered * spread,
      y: anchor.y + index * 0.012,
      z: anchor.z,
      rotationX: Math.PI / 2,
      rotationY: 0,
      rotationZ: ownerRotation,
      scale
    };
  }
  const laneIndex = Math.max(0, Math.min(2, Number(actor.zone.laneIndex || 0)));
  const anchor = resolveBoardAnchor(
    `lane-${laneIndex}`,
    actor.zone.side === "opponent" ? "opponentCombat" : "localCombat",
    profile
  );
  return {
    x: anchor.x + centered * spread,
    y: anchor.y + index * 0.012,
    z: anchor.z,
    rotationX: Math.PI / 2,
    rotationY: 0,
    rotationZ: ownerRotation,
    scale
  };
}

function attachmentPosition(actor, profile) {
  const count = Math.max(1, Number(actor.zone.count || 1));
  const index = Number(actor.zone.slotIndex || 0);
  const centered = centeredIndex(index, count);
  if (actor.zone.laneIndex != null) {
    const laneIndex = Math.max(0, Math.min(2, Number(actor.zone.laneIndex || 0)));
    const anchor = resolveBoardAnchor(`lane-${laneIndex}`, "resolution", profile);
    return {
      x: anchor.x + centered * 1.18,
      y: anchor.y - 0.06 + index * 0.01,
      z: anchor.z,
      rotationX: Math.PI / 2,
      rotationY: 0,
      rotationZ: actor.zone.side === "opponent" ? Math.PI : 0,
      scale: profile.id === "portrait" ? 0.38 : 0.44
    };
  }
  const anchor = resolveBoardAnchor("hand-combat-dais", "attachmentGroup", profile);
  return {
    x: anchor.x + centered * 1.16,
    y: anchor.y + index * 0.01,
    z: anchor.z,
    rotationX: Math.PI / 2,
    rotationY: 0,
    rotationZ: actor.zone.side === "opponent" ? Math.PI : 0,
    scale: profile.id === "portrait" ? 0.38 : 0.44
  };
}

function paymentPosition(actor, profile) {
  const count = Math.max(1, Number(actor.zone.count || 1));
  const index = Number(actor.zone.slotIndex || 0);
  const columns = Math.min(4, count);
  const row = Math.floor(index / columns);
  const rowCount = Math.ceil(count / columns);
  const cardsInRow = Math.min(columns, count - row * columns);
  const column = index % columns;
  const centered = centeredIndex(column, cardsInRow);
  const preferredScale = profile.id === "portrait" ? 0.48 : profile.id === "short-landscape" ? 0.55 : 0.6;
  const slotGap = 0.18;
  const trayTransform = profile.modules?.["payment-tray"] || { scaleX: 1, scaleZ: 1 };
  const trayWidth = 6.05 * Number(trayTransform.scaleX || 1);
  const trayDepth = 4.25 * Number(trayTransform.scaleZ || 1);
  const maxRowCards = Math.min(columns, count);
  const widthScale = (trayWidth - slotGap * Math.max(0, maxRowCards - 1))
    / (CARD_WIDTH * maxRowCards);
  const depthScale = (trayDepth - slotGap * Math.max(0, rowCount - 1))
    / (CARD_HEIGHT * rowCount);
  const scale = Math.min(preferredScale, widthScale, depthScale);
  const spread = CARD_WIDTH * scale + slotGap;
  const rowSpread = CARD_HEIGHT * scale + slotGap;
  const anchor = resolveBoardAnchor("payment-tray", "center", profile);
  return {
    x: anchor.x + centered * spread,
    y: anchor.y + index * 0.014,
    z: anchor.z + (row - (rowCount - 1) / 2) * rowSpread,
    rotationX: Math.PI / 2,
    rotationY: 0,
    rotationZ: actor.zone.side === "opponent" ? Math.PI : 0,
    scale
  };
}

export function resolveActorPosition(actor, profile = BOARD_LAYOUT_PROFILES.desktop) {
  if (!actor?.zone) return { x: 0, y: 0.2, z: 0, rotationX: Math.PI / 2, rotationY: 0, rotationZ: 0, scale: 0.6 };
  if (actor.zone.kind === "hand") return handPosition(actor, profile);
  if (actor.zone.kind === "lane") return lanePosition(actor, profile);
  if (actor.zone.kind === "combat") return combatPosition(actor, profile);
  if (actor.zone.kind === "attachment") return attachmentPosition(actor, profile);
  if (actor.zone.kind === "payment") return paymentPosition(actor, profile);
  return { x: 0, y: 0.2, z: 0, rotationX: Math.PI / 2, rotationY: 0, rotationZ: 0, scale: 0.6 };
}

export function resolvePilePosition(side, pile, profile = BOARD_LAYOUT_PROFILES.desktop) {
  const moduleId = `pile-${side === "opponent" ? "opponent" : "local"}-${pile === "deck" ? "deck" : "discard"}`;
  const anchor = resolveBoardAnchor(moduleId, "cardAnchor", profile);
  return { x: anchor.x, z: anchor.z };
}

export function resolveTransitionOrigin(transition, profile = BOARD_LAYOUT_PROFILES.desktop) {
  if (transition?.previousActor) return resolveActorPosition(transition.previousActor, profile);
  const actor = transition?.nextActor;
  if (transition?.motionRole === "draw-enter") {
    const pile = resolvePilePosition(actor?.zone?.side, "deck", profile);
    return {
      x: pile.x,
      y: 0.46,
      z: pile.z,
      rotationX: Math.PI / 2,
      rotationY: 0,
      rotationZ: actor?.zone?.side === "opponent" ? Math.PI : 0,
      scale: 0.44
    };
  }
  const target = resolveActorPosition(actor, profile);
  return {
    ...target,
    y: Math.max(0.72, target.y),
    z: actor?.zone?.side === "opponent" ? 11.7 : -11.7
  };
}

export function resolveDeparturePosition(actor, profile = BOARD_LAYOUT_PROFILES.desktop, index = 0) {
  const pile = resolvePilePosition(actor?.zone?.side, "discard", profile);
  return {
    x: pile.x + Number(index || 0) * 0.04,
    y: 0.44 + Number(index || 0) * 0.012,
    z: pile.z,
    rotationX: Math.PI / 2,
    rotationY: 0,
    rotationZ: actor?.zone?.side === "opponent" ? Math.PI : 0,
    scale: 0.42
  };
}

export function actorBoundsAt(position) {
  const scale = Number(position?.scale || 1);
  return {
    left: Number(position?.x || 0) - (CARD_WIDTH * scale) / 2,
    right: Number(position?.x || 0) + (CARD_WIDTH * scale) / 2,
    bottom: Number(position?.z || 0) - (CARD_HEIGHT * scale) / 2,
    top: Number(position?.z || 0) + (CARD_HEIGHT * scale) / 2
  };
}
