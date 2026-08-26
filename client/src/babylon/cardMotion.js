import { PRESENTATION_MOTION_PROFILES } from "./presentationCadence";

// Keep the established export for adapters while making the cadence contract
// the only authority for motion duration and easing.
export const CARD_MOTION_PROFILES = PRESENTATION_MOTION_PROFILES;

export const COMBAT_RESOLUTION_HOLD_MS = 160;
export const PAYMENT_SETTLE_HOLD_MS = 180;
export const CARD_PATH_CLEARANCE = 0.16;
export const CARD_PATH_FOOTPRINT = Object.freeze({ width: 2.3, height: 3.22 });
export const CARD_MOTION_CONTRACT_VERSION = "gauntlet.card-motion.collision-safe.v1";

export function shouldAllowElevatedSourceEgress({
  destinationZone = null,
  obstacleZone = null,
  obstacleSourceZone = null,
  obstacleMotionRole = null,
  obstacleKind = "current"
} = {}) {
  if (destinationZone?.kind !== "payment" || destinationZone?.side == null) return false;
  const sourceHandZone = obstacleZone?.kind === "hand"
    ? obstacleZone
    : obstacleKind === "current"
      && ["attack-enter", "block-enter"].includes(obstacleMotionRole)
      && obstacleSourceZone?.kind === "hand"
      ? obstacleSourceZone
      : null;
  return sourceHandZone?.side != null && destinationZone.side === sourceHandZone.side;
}

export const CARD_MOTION_CUE_HOOKS = Object.freeze({
  "payment-enter": Object.freeze([
    { cueId: "card.lift", phase: "anticipate", at: 0 },
    { cueId: "payment.commit", phase: "settle", at: 0.78 }
  ]),
  "placement-enter": Object.freeze([
    { cueId: "card.lift", phase: "anticipate", at: 0 }
  ]),
  "attack-enter": Object.freeze([
    { cueId: "card.lift", phase: "anticipate", at: 0 }
  ]),
  "block-enter": Object.freeze([
    { cueId: "card.lift", phase: "anticipate", at: 0 }
  ])
});

const COLLISION_PLANNED_ROLES = new Set([
  "payment-enter",
  "draw-enter",
  "placement-enter",
  "attack-enter",
  "block-enter",
  "lane-shift",
  "swap-return",
  "replay-stage",
  "discard-exit"
]);

export function shouldHoldCombatCard(type, presentationRole = null) {
  if (["attack", "block"].includes(type)) return true;
  if (type !== "replay-action") return false;
  return ["primary", "blocker", "attachment"].includes(presentationRole);
}

export function getPaymentDepartureTiming(motion, nowMs, reducedMotion = false) {
  if (reducedMotion) return { holdMs: 0, departureMs: 0, totalMs: 0 };
  const remainingTravelMs = motion?.role === "payment-enter"
    ? Math.max(0, Number(motion.startTimeMs || 0) + Number(motion.durationMs || 0) - Number(nowMs || 0))
    : 0;
  const holdMs = remainingTravelMs + PAYMENT_SETTLE_HOLD_MS;
  const departureMs = CARD_MOTION_PROFILES["discard-exit"].durationMs;
  return { holdMs, departureMs, totalMs: holdMs + departureMs };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function pointInsideExpandedCard(point, obstacle, movingScale = 1, clearance = CARD_PATH_CLEARANCE) {
  const obstacleScale = Number(obstacle?.scale || 1);
  const halfWidth = CARD_PATH_FOOTPRINT.width * (movingScale + obstacleScale) / 2 + clearance;
  const halfHeight = CARD_PATH_FOOTPRINT.height * (movingScale + obstacleScale) / 2 + clearance;
  return Math.abs(Number(point.x) - Number(obstacle.x)) < halfWidth
    && Math.abs(Number(point.z) - Number(obstacle.z)) < halfHeight;
}

function travelScaleAt(movingScale, progress) {
  if (typeof movingScale === "number") return Number(movingScale) || 1;
  const start = Number(movingScale?.start ?? movingScale?.startScale ?? 1);
  const end = Number(movingScale?.end ?? movingScale?.endScale ?? start);
  return start + (end - start) * clamp01(progress);
}

function maximumTravelScale(movingScale) {
  return Math.max(travelScaleAt(movingScale, 0), travelScaleAt(movingScale, 1));
}

function pathLength(points) {
  return points.slice(1).reduce((total, point, index) => (
    total + Math.hypot(point.x - points[index].x, point.z - points[index].z)
  ), 0);
}

function elevatedSourceEgressEndProgress(points) {
  const fallbackProgress = 0.78;
  if (!Array.isArray(points) || points.length !== 4) return fallbackProgress;
  const [origin, liftPoint, railPoint, destination] = points;
  const followsLowerRail = (
    Math.abs(Number(liftPoint.x) - Number(origin.x)) < 0.01
    && Math.abs(Number(railPoint.z) - Number(liftPoint.z)) < 0.01
    && Math.abs(Number(destination.x) - Number(railPoint.x)) < 0.01
    && Number(liftPoint.z) < 0
    && Number(railPoint.z) < 0
  );
  if (!followsLowerRail) return fallbackProgress;
  const totalLength = pathLength(points);
  const finalDescentLength = Math.hypot(
    Number(destination.x) - Number(railPoint.x),
    Number(destination.z) - Number(railPoint.z)
  );
  if (totalLength <= 0 || finalDescentLength <= 0.001) return fallbackProgress;
  return Math.max(fallbackProgress, (totalLength - finalDescentLength) / totalLength);
}

export function sampleCardTravelPath(points, progress) {
  const safePoints = Array.isArray(points) && points.length >= 2 ? points : [{ x: 0, z: 0 }, { x: 0, z: 0 }];
  const lengths = safePoints.slice(1).map((point, index) => (
    Math.hypot(point.x - safePoints[index].x, point.z - safePoints[index].z)
  ));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total <= 0) return { ...safePoints.at(-1) };
  let remaining = clamp01(progress) * total;
  for (let index = 0; index < lengths.length; index += 1) {
    if (remaining <= lengths[index] || index === lengths.length - 1) {
      const local = lengths[index] <= 0 ? 1 : clamp01(remaining / lengths[index]);
      return {
        x: safePoints[index].x + (safePoints[index + 1].x - safePoints[index].x) * local,
        z: safePoints[index].z + (safePoints[index + 1].z - safePoints[index].z) * local
      };
    }
    remaining -= lengths[index];
  }
  return { ...safePoints.at(-1) };
}

export function cardTravelPathCollides(points, obstacles = [], movingScale = 1, clearance = CARD_PATH_CLEARANCE) {
  const origin = points[0] || { x: 0, z: 0 };
  const destination = points.at(-1) || origin;
  const originScale = travelScaleAt(movingScale, 0);
  const destinationScale = travelScaleAt(movingScale, 1);
  const elevatedSourceEgressProgress = elevatedSourceEgressEndProgress(points);
  const relevant = obstacles
    .filter((obstacle) => (
      obstacle && Number.isFinite(Number(obstacle.x)) && Number.isFinite(Number(obstacle.z))
    ))
    .map((obstacle) => ({
      obstacle,
      startedInside: pointInsideExpandedCard(origin, obstacle, originScale, clearance),
      exitedSourceOverlap: false,
      endsInsidePermittedOverlap: obstacle.allowTargetOverlap === true
        && pointInsideExpandedCard(destination, obstacle, destinationScale, clearance)
    }));
  const samples = Math.max(24, Math.ceil(pathLength(points) / 0.16));
  for (let index = 1; index <= samples; index += 1) {
    const progress = index / samples;
    const point = sampleCardTravelPath(points, index / samples);
    const collided = relevant.some((entry) => {
      const sampleScale = travelScaleAt(movingScale, progress);
      // A card leaving its own fanned hand first lifts above that source fan.
      // The semantic payment corridor keeps the lifted card on the local
      // lower rail through its cross-board leg; source-hand projection overlap
      // while elevated is preferable to routing it through lanes or combat.
      if (
        entry.obstacle.allowElevatedSourceEgress === true
        && progress <= elevatedSourceEgressProgress
      ) return false;
      // Adjacent tray slots retain full physical collision checks while the
      // extra travel clearance eases away near settlement. This permits a
      // shrinking hand card to seat beside another payment card without ever
      // allowing their real card bounds to intersect.
      const sampleClearance = entry.obstacle.settleAdjacent === true && progress >= 0.72
        ? 0
        : clearance;
      const inside = pointInsideExpandedCard(point, entry.obstacle, sampleScale, sampleClearance);
      if (entry.startedInside && !entry.exitedSourceOverlap) {
        if (!inside) entry.exitedSourceOverlap = true;
        return false;
      }
      // A hand fan intentionally retains a very small final overlap. The card
      // must approach that fan from a clear route; only the final settle may
      // enter the neighbouring card's expanded footprint.
      if (entry.endsInsidePermittedOverlap && progress >= 0.86) return false;
      return inside;
    });
    if (collided) {
      return true;
    }
  }
  return false;
}

function clampWaypoint(point, bounds) {
  if (!bounds) return point;
  return {
    x: Math.max(bounds.left, Math.min(bounds.right, point.x)),
    z: Math.max(bounds.bottom, Math.min(bounds.top, point.z))
  };
}

export function planCardTravelPath({
  start,
  destination,
  obstacles = [],
  movingScale = 1,
  pathIndex = 0,
  bounds = null,
  clearance = CARD_PATH_CLEARANCE,
  preferredPaths = []
} = {}) {
  const origin = { x: Number(start?.x || 0), z: Number(start?.z || 0) };
  const target = { x: Number(destination?.x || 0), z: Number(destination?.z || 0) };
  const maximumMovingScale = maximumTravelScale(movingScale);
  const direct = [origin, target];
  const safePreferredPath = preferredPaths
    .map((path) => (Array.isArray(path) ? path.map((point) => ({
      x: Number(point?.x || 0),
      z: Number(point?.z || 0)
    })) : []))
    .find((path) => path.length >= 2 && !cardTravelPathCollides(path, obstacles, movingScale, clearance));
  if (safePreferredPath) return safePreferredPath;
  if (!cardTravelPathCollides(direct, obstacles, movingScale, clearance)) return direct;

  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  const distance = Math.max(0.001, Math.hypot(dx, dz));
  const perpendicular = { x: -dz / distance, z: dx / distance };
  const preferredSide = Number(pathIndex) % 2 === 0 ? 1 : -1;
  const candidates = [];
  [2.2, 3.4, 4.8, 6.2, 8].forEach((offset) => {
    [preferredSide, -preferredSide].forEach((side) => {
      candidates.push([
        origin,
        clampWaypoint({
          x: (origin.x + target.x) / 2 + perpendicular.x * offset * side,
          z: (origin.z + target.z) / 2 + perpendicular.z * offset * side
        }, bounds),
        target
      ]);
    });
  });
  obstacles.forEach((obstacle) => {
    const xMargin = CARD_PATH_FOOTPRINT.width * (maximumMovingScale + Number(obstacle.scale || 1)) / 2 + clearance;
    const zMargin = CARD_PATH_FOOTPRINT.height * (maximumMovingScale + Number(obstacle.scale || 1)) / 2 + clearance;
    [-1, 1].forEach((side) => {
      const x = Number(obstacle.x) + xMargin * side;
      candidates.push([origin, clampWaypoint({ x, z: origin.z }, bounds), clampWaypoint({ x, z: target.z }, bounds), target]);
      const z = Number(obstacle.z) + zMargin * side;
      candidates.push([origin, clampWaypoint({ x: origin.x, z }, bounds), clampWaypoint({ x: target.x, z }, bounds), target]);
    });
  });
  const safe = candidates
    .filter((candidate) => !cardTravelPathCollides(candidate, obstacles, movingScale, clearance))
    .sort((left, right) => pathLength(left) - pathLength(right));
  return safe[0] || candidates.at(-1) || direct;
}

export function semanticCardTravelCorridors({ role, start, destination } = {}) {
  const origin = { x: Number(start?.x || 0), z: Number(start?.z || 0) };
  const target = { x: Number(destination?.x || 0), z: Number(destination?.z || 0) };
  if (
    role === "lane-shift"
    && Math.abs(origin.x - target.x) < 0.01
    && Math.abs(origin.z - target.z) < 0.01
  ) {
    const direction = origin.x <= 0 ? 1 : -1;
    return [[origin, { x: origin.x + direction * 0.34, z: origin.z - 0.08 }, target]];
  }
  if (role !== "payment-enter") return [];
  const movingScale = Math.max(Number(start?.scale || 1), Number(destination?.scale || 1));
  const sourceClearance = CARD_PATH_FOOTPRINT.height * movingScale + CARD_PATH_CLEARANCE * 2.4;
  if (origin.z <= 0) {
    // The payment tray is beside the local hand. Lift over the source fan and
    // travel along the lower rail instead of climbing through lane/combat
    // space. Distinct payment cards are time-staggered by the transition
    // planner, so this corridor reads like dealing cards into adjacent wells.
    const egressZ = origin.z + (target.z - origin.z) * 0.45;
    return [[
      origin,
      { x: origin.x, z: egressZ },
      { x: target.x, z: egressZ },
      target
    ]];
  }
  const egressZ = origin.z + sourceClearance;
  const sideX = Math.max(origin.x, target.x) + CARD_PATH_FOOTPRINT.width * movingScale + 0.5;
  return [[
    origin,
    { x: origin.x, z: egressZ },
    { x: sideX, z: egressZ },
    { x: sideX, z: target.z },
    target
  ]];
}

export function easeCardMotion(progress, easing = "ease-in-out") {
  const value = clamp01(progress);
  if (easing === "ease-in") return value * value * value;
  if (easing === "ease-out") return 1 - ((1 - value) ** 3);
  return value < 0.5
    ? 4 * value * value * value
    : 1 - ((-2 * value + 2) ** 3) / 2;
}

export function createCardMotion({
  role = "state-correction",
  start,
  destination,
  startTimeMs = 0,
  reducedMotion = false,
  obstacles = [],
  pathIndex = 0,
  delayMs = 0,
  bounds = null,
  occurrenceId = null,
  sourceEventId = null,
  playbackRate = 1
}) {
  const profile = CARD_MOTION_PROFILES[role] || CARD_MOTION_PROFILES["state-correction"];
  const rate = Math.max(0.25, Number(playbackRate) || 1);
  const durationMs = reducedMotion ? 0 : Math.round(profile.durationMs / rate);
  const preferredPaths = semanticCardTravelCorridors({ role, start, destination });
  const movingScale = {
    start: Number(start?.scale || 1),
    end: Number(destination?.scale || 1)
  };
  const path = !reducedMotion && COLLISION_PLANNED_ROLES.has(role)
    ? planCardTravelPath({
        start,
        destination,
        obstacles,
        movingScale,
        pathIndex,
        bounds,
        preferredPaths
      })
    : [{ x: start?.x || 0, z: start?.z || 0 }, { x: destination?.x || 0, z: destination?.z || 0 }];
  const stableOccurrenceId = occurrenceId || [
    role,
    Number(start?.x || 0).toFixed(3),
    Number(start?.z || 0).toFixed(3),
    Number(destination?.x || 0).toFixed(3),
    Number(destination?.z || 0).toFixed(3)
  ].join(":");
  return {
    role,
    occurrenceId: stableOccurrenceId,
    sourceEventId,
    start: { ...start },
    destination: { ...destination },
    startTimeMs: (Number(startTimeMs) || 0) + (reducedMotion ? 0 : Number(delayMs || 0) / rate),
    durationMs,
    easing: profile.easing,
    lift: reducedMotion ? 0 : Number(profile.lift || 0),
    path,
    // A grouped motion has one physical lift voice. Staggered followers keep
    // their visual path without layering identical presentation cues.
    cueHooks: (Number(pathIndex || 0) === 0 ? CARD_MOTION_CUE_HOOKS[role] || [] : []).map((hook) => ({
      contract: "gauntlet.presentation-cues.v1",
      ...hook,
      occurrenceId: `${stableOccurrenceId}:${hook.cueId}:${hook.phase}`,
      offsetMs: Math.round(durationMs * hook.at),
      visual: { assetId: hook.cueId, fallback: `procedural.${hook.cueId}` },
      audio: { assetId: hook.cueId, gain: 0.34, variant: "stable-hash", fallback: `tone.${hook.cueId}` }
    }))
  };
}

export function sampleCardMotion(motion, nowMs) {
  if (!motion) return null;
  const linearProgress = motion.durationMs <= 0
    ? 1
    : clamp01((Number(nowMs) - motion.startTimeMs) / motion.durationMs);
  const progress = easeCardMotion(linearProgress, motion.easing);
  const sampled = {};
  Object.keys(motion.destination).forEach((key) => {
    const startValue = Number(motion.start[key]);
    const endValue = Number(motion.destination[key]);
    sampled[key] = Number.isFinite(startValue) && Number.isFinite(endValue)
      ? startValue + (endValue - startValue) * progress
      : motion.destination[key];
  });
  if (motion.path?.length >= 2) {
    const pathPoint = sampleCardTravelPath(motion.path, progress);
    sampled.x = pathPoint.x;
    sampled.z = pathPoint.z;
  }
  if (Number.isFinite(sampled.y) && motion.lift) {
    sampled.y += Math.sin(Math.PI * linearProgress) * motion.lift;
  }
  const travelEnvelope = Math.sin(Math.PI * linearProgress);
  const directionZ = Math.sign(Number(motion.destination?.z || 0) - Number(motion.start?.z || 0)) || 1;
  if (motion.role === "attack-enter" && Number.isFinite(sampled.rotationX)) {
    sampled.rotationX -= directionZ * travelEnvelope * 0.14;
  } else if (motion.role === "block-enter" && Number.isFinite(sampled.rotationY)) {
    const braceDirection = Number(motion.destination?.x || 0) < Number(motion.start?.x || 0) ? -1 : 1;
    sampled.rotationY += braceDirection * travelEnvelope * 0.12;
  } else if (motion.role === "payment-enter" && Number.isFinite(sampled.scale)) {
    sampled.scale *= 1 - travelEnvelope * 0.035;
  } else if (motion.role === "placement-enter" && Number.isFinite(sampled.scale)) {
    const contactEnvelope = Math.max(0, 1 - Math.abs(linearProgress - 0.86) / 0.14);
    sampled.scale *= 1 - contactEnvelope * 0.03;
  } else if (["lane-shift", "swap-return"].includes(motion.role) && Number.isFinite(sampled.rotationY)) {
    const shiftDirection = Number(motion.destination?.x || 0) < Number(motion.start?.x || 0) ? -1 : 1;
    sampled.rotationY += shiftDirection * travelEnvelope * 0.045;
  }
  return { ...sampled, progress: linearProgress, complete: linearProgress >= 1 };
}

export function didCardDepartureComplete(record, sampled) {
  return Boolean(
    record?.departureStarted
    && record?.motion?.role === "discard-exit"
    && sampled?.complete === true
  );
}
