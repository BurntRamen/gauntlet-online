export const CARD_MOTION_PROFILES = Object.freeze({
  hover: Object.freeze({ durationMs: 150, easing: "ease-out" }),
  "payment-enter": Object.freeze({ durationMs: 450, easing: "ease-in-out" }),
  "draw-enter": Object.freeze({ durationMs: 500, easing: "ease-out" }),
  "placement-enter": Object.freeze({ durationMs: 580, easing: "ease-in-out" }),
  "attack-enter": Object.freeze({ durationMs: 580, easing: "ease-in-out" }),
  "block-enter": Object.freeze({ durationMs: 600, easing: "ease-in-out" }),
  "replay-stage": Object.freeze({ durationMs: 580, easing: "ease-in-out" }),
  "discard-exit": Object.freeze({ durationMs: 480, easing: "ease-in" }),
  "state-correction": Object.freeze({ durationMs: 220, easing: "ease-out" })
});

export const COMBAT_RESOLUTION_HOLD_MS = 720;

export function shouldHoldCombatCard(type) {
  return ["attack", "block", "replay-action"].includes(type);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
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
  reducedMotion = false
}) {
  const profile = CARD_MOTION_PROFILES[role] || CARD_MOTION_PROFILES["state-correction"];
  return {
    role,
    start: { ...start },
    destination: { ...destination },
    startTimeMs: Number(startTimeMs) || 0,
    durationMs: reducedMotion ? 0 : profile.durationMs,
    easing: profile.easing
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
  return { ...sampled, progress: linearProgress, complete: linearProgress >= 1 };
}
