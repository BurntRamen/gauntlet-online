import {
  CARD_MOTION_PROFILES,
  COMBAT_RESOLUTION_HOLD_MS,
  createCardMotion,
  sampleCardMotion,
  shouldHoldCombatCard
} from "./cardMotion";

describe("shared Babylon card motion", () => {
  test("samples meaningful travel by elapsed time rather than frame count", () => {
    const motion = createCardMotion({
      role: "attack-enter",
      start: { x: -8, y: 0, alpha: 1 },
      destination: { x: -2, y: 1, alpha: 1 },
      startTimeMs: 100
    });
    const halfway = sampleCardMotion(motion, 100 + motion.durationMs / 2);
    const complete = sampleCardMotion(motion, 100 + motion.durationMs);

    expect(halfway.progress).toBeCloseTo(0.5);
    expect(halfway.x).toBeCloseTo(-5);
    expect(complete).toMatchObject({ x: -2, y: 1, complete: true });
  });

  test("uses one profile contract for live and replay staging", () => {
    expect(CARD_MOTION_PROFILES["attack-enter"].durationMs).toBeGreaterThanOrEqual(500);
    expect(CARD_MOTION_PROFILES["block-enter"].durationMs).toBeGreaterThanOrEqual(500);
    expect(CARD_MOTION_PROFILES["replay-stage"].durationMs).toBe(
      CARD_MOTION_PROFILES["attack-enter"].durationMs
    );
    expect(COMBAT_RESOLUTION_HOLD_MS).toBeGreaterThanOrEqual(600);
    expect(shouldHoldCombatCard("attack")).toBe(true);
    expect(shouldHoldCombatCard("block")).toBe(true);
    expect(shouldHoldCombatCard("replay-action")).toBe(true);
    expect(shouldHoldCombatCard("hand")).toBe(false);
  });

  test("keeps hover responsive and reduced motion immediate", () => {
    expect(CARD_MOTION_PROFILES.hover.durationMs).toBeLessThanOrEqual(180);
    const motion = createCardMotion({
      role: "placement-enter",
      start: { x: 0 },
      destination: { x: 10 },
      reducedMotion: true
    });
    expect(sampleCardMotion(motion, 0)).toMatchObject({ x: 10, complete: true });
  });
});
