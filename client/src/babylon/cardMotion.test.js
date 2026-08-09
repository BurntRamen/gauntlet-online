import {
  CARD_MOTION_CONTRACT_VERSION,
  CARD_MOTION_PROFILES,
  cardTravelPathCollides,
  COMBAT_RESOLUTION_HOLD_MS,
  createCardMotion,
  getPaymentDepartureTiming,
  PAYMENT_SETTLE_HOLD_MS,
  planCardTravelPath,
  sampleCardMotion,
  sampleCardTravelPath,
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
    expect(halfway.y).toBeGreaterThan(0.5);
    expect(complete).toMatchObject({ x: -2, y: 1, complete: true });
  });

  test("uses one profile contract for live and replay staging", () => {
    expect(CARD_MOTION_PROFILES["attack-enter"].durationMs).toBeGreaterThanOrEqual(500);
    expect(CARD_MOTION_PROFILES["block-enter"].durationMs).toBeGreaterThanOrEqual(500);
    expect(CARD_MOTION_PROFILES["replay-stage"].durationMs).toBe(
      CARD_MOTION_PROFILES["attack-enter"].durationMs
    );
    expect(CARD_MOTION_PROFILES["payment-enter"].lift).toBeGreaterThan(0.5);
    expect(CARD_MOTION_PROFILES["block-enter"].lift).toBeGreaterThan(
      CARD_MOTION_PROFILES["placement-enter"].lift
    );
    expect(COMBAT_RESOLUTION_HOLD_MS).toBeGreaterThanOrEqual(600);
    expect(shouldHoldCombatCard("attack")).toBe(true);
    expect(shouldHoldCombatCard("block")).toBe(true);
    expect(shouldHoldCombatCard("replay-action", "primary")).toBe(true);
    expect(shouldHoldCombatCard("replay-action", "blocker")).toBe(true);
    expect(shouldHoldCombatCard("replay-action", "attachment")).toBe(true);
    expect(shouldHoldCombatCard("replay-action", "payment")).toBe(false);
    expect(shouldHoldCombatCard("hand")).toBe(false);
  });

  test("lets payment reach and settle in its tray before discard departure", () => {
    const motion = createCardMotion({
      role: "payment-enter",
      start: { x: 0 },
      destination: { x: 10 },
      startTimeMs: 100
    });
    const timing = getPaymentDepartureTiming(motion, 250);

    expect(timing.holdMs).toBe(
      motion.startTimeMs + motion.durationMs - 250 + PAYMENT_SETTLE_HOLD_MS
    );
    expect(timing.departureMs).toBe(CARD_MOTION_PROFILES["discard-exit"].durationMs);
    expect(timing.totalMs).toBe(timing.holdMs + timing.departureMs);
    expect(getPaymentDepartureTiming(motion, 250, true)).toEqual({
      holdMs: 0,
      departureMs: 0,
      totalMs: 0
    });
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

  test.each([
    ["hand attack", { x: -8, z: -7 }, { x: -2, z: 1 }],
    ["lane attack", { x: 0, z: -6 }, { x: 0, z: 2.5 }],
    ["hand block", { x: 7, z: -7 }, { x: 2.6, z: -1.2 }],
    ["payment", { x: 2, z: -7 }, { x: 9, z: -6.3 }],
    ["placement", { x: -4, z: -7 }, { x: 0, z: -3 }],
    ["draw", { x: -11, z: -7 }, { x: 5, z: -7 }],
    ["discard", { x: 0, z: 1 }, { x: -10, z: -7 }]
  ])("plans a collision-free %s trajectory around a readable card", (_name, start, destination) => {
    const obstacles = [{ id: "important-card", x: (start.x + destination.x) / 2, z: (start.z + destination.z) / 2, scale: 0.72 }];
    const path = planCardTravelPath({
      start,
      destination,
      obstacles,
      movingScale: 0.72,
      bounds: { left: -12, right: 12, bottom: -8, top: 8 }
    });

    expect(path.length).toBeGreaterThan(2);
    expect(cardTravelPathCollides(path, obstacles, 0.72)).toBe(false);
    expect(path[0]).toEqual(start);
    expect(path.at(-1)).toEqual(destination);
  });

  test("fans multiple blockers through separate paths while preserving the attacker", () => {
    const attacker = { id: "attacker", x: 0, z: 1.25, scale: 0.72 };
    const paths = [-1.9, 0, 1.9].map((x, pathIndex) => planCardTravelPath({
      start: { x: 5 + pathIndex, z: -7 },
      destination: { x, z: -1.25 },
      obstacles: [attacker],
      movingScale: 0.66,
      pathIndex,
      bounds: { left: -12, right: 12, bottom: -8, top: 8 }
    }));

    paths.forEach((path) => expect(cardTravelPathCollides(path, [attacker], 0.66)).toBe(false));
    const midpoints = paths.map((path) => sampleCardTravelPath(path, 0.5));
    expect(new Set(midpoints.map((point) => `${point.x.toFixed(2)}:${point.z.toFixed(2)}`)).size).toBe(3);
  });

  test("publishes one collision-safe presentation contract for every adapter", () => {
    expect(CARD_MOTION_CONTRACT_VERSION).toBe("gauntlet.card-motion.collision-safe.v1");
  });
});
