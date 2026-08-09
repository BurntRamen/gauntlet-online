export const CARD_MOTION_PROFILES = Object.freeze({
  hover: Object.freeze({ durationMs: 150, easing: "ease-out" }),
  "payment-enter": Object.freeze({ durationMs: 520, easing: "ease-in-out", lift: 0.72 }),
  "draw-enter": Object.freeze({ durationMs: 560, easing: "ease-out", lift: 0.58 }),
  "placement-enter": Object.freeze({ durationMs: 620, easing: "ease-in-out", lift: 0.54 }),
  "attack-enter": Object.freeze({ durationMs: 640, easing: "ease-in-out", lift: 0.7 }),
  "block-enter": Object.freeze({ durationMs: 680, easing: "ease-in-out", lift: 0.82 }),
  "replay-stage": Object.freeze({ durationMs: 640, easing: "ease-in-out", lift: 0.7 }),
  "discard-exit": Object.freeze({ durationMs: 520, easing: "ease-in", lift: 0.28 }),
  "state-correction": Object.freeze({ durationMs: 220, easing: "ease-out" })
});

export const COMBAT_RESOLUTION_HOLD_MS = 900;
export const PAYMENT_SETTLE_HOLD_MS = 220;
export const CARD_PATH_CLEARANCE = 0.16;
export const CARD_PATH_FOOTPRINT = Object.freeze({ width: 2.3, height: 3.22 });
export const CARD_MOTION_CONTRACT_VERSION = "gauntlet.card-motion.collision-safe.v1";

const COLLISION_PLANNED_ROLES = new Set([
  "payment-enter",
  "draw-enter",
  "placement-enter",
  "attack-enter",
  "block-enter",
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

function pathLength(points) {
  return points.slice(1).reduce((total, point, index) => (
    total + Math.hypot(point.x - points[index].x, point.z - points[index].z)
  ), 0);
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
  const relevant = obstacles.filter((obstacle) => (
    obstacle && Number.isFinite(Number(obstacle.x)) && Number.isFinite(Number(obstacle.z))
    && Math.hypot(Number(points[0].x) - Number(obstacle.x), Number(points[0].z) - Number(obstacle.z)) > 0.05
  ));
  const samples = Math.max(24, Math.ceil(pathLength(points) / 0.16));
  for (let index = 1; index < samples; index += 1) {
    const point = sampleCardTravelPath(points, index / samples);
    if (relevant.some((obstacle) => pointInsideExpandedCard(point, obstacle, movingScale, clearance))) {
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
  clearance = CARD_PATH_CLEARANCE
} = {}) {
  const origin = { x: Number(start?.x || 0), z: Number(start?.z || 0) };
  const target = { x: Number(destination?.x || 0), z: Number(destination?.z || 0) };
  const direct = [origin, target];
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
    const xMargin = CARD_PATH_FOOTPRINT.width * (movingScale + Number(obstacle.scale || 1)) / 2 + clearance;
    const zMargin = CARD_PATH_FOOTPRINT.height * (movingScale + Number(obstacle.scale || 1)) / 2 + clearance;
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
  bounds = null
}) {
  const profile = CARD_MOTION_PROFILES[role] || CARD_MOTION_PROFILES["state-correction"];
  const path = !reducedMotion && COLLISION_PLANNED_ROLES.has(role)
    ? planCardTravelPath({
        start,
        destination,
        obstacles,
        movingScale: Math.max(Number(start?.scale || 1), Number(destination?.scale || 1)),
        pathIndex,
        bounds
      })
    : [{ x: start?.x || 0, z: start?.z || 0 }, { x: destination?.x || 0, z: destination?.z || 0 }];
  return {
    role,
    start: { ...start },
    destination: { ...destination },
    startTimeMs: (Number(startTimeMs) || 0) + (reducedMotion ? 0 : Number(delayMs || 0)),
    durationMs: reducedMotion ? 0 : profile.durationMs,
    easing: profile.easing,
    lift: reducedMotion ? 0 : Number(profile.lift || 0),
    path
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
  return { ...sampled, progress: linearProgress, complete: linearProgress >= 1 };
}
