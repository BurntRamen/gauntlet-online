import {
  CARD_MOTION_CUE_HOOKS,
  CARD_MOTION_CONTRACT_VERSION,
  CARD_MOTION_PROFILES,
  cardTravelPathCollides,
  COMBAT_RESOLUTION_HOLD_MS,
  createCardMotion,
  didCardDepartureComplete,
  getPaymentDepartureTiming,
  PAYMENT_SETTLE_HOLD_MS,
  planCardTravelPath,
  sampleCardMotion,
  sampleCardTravelPath,
  semanticCardTravelCorridors,
  shouldAllowElevatedSourceEgress,
  shouldHoldCombatCard
} from "./cardMotion";

describe("shared Babylon card motion", () => {
  test("completes actor disposal from the actual discard trajectory", () => {
    const record = {
      departureStarted: true,
      motion: { role: "discard-exit" }
    };

    expect(didCardDepartureComplete(record, { complete: false })).toBe(false);
    expect(didCardDepartureComplete(record, { complete: true })).toBe(true);
    expect(didCardDepartureComplete({ ...record, departureStarted: false }, { complete: true })).toBe(false);
    expect(didCardDepartureComplete({ ...record, motion: { role: "attack-enter" } }, { complete: true })).toBe(false);
  });

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
    expect(CARD_MOTION_PROFILES["attack-enter"].durationMs).toBe(500);
    expect(CARD_MOTION_PROFILES["block-enter"].durationMs).toBe(540);
    expect(CARD_MOTION_PROFILES["replay-stage"].durationMs).toBe(
      CARD_MOTION_PROFILES["attack-enter"].durationMs
    );
    expect(CARD_MOTION_PROFILES["payment-enter"].lift).toBeGreaterThan(0.5);
    expect(CARD_MOTION_PROFILES["block-enter"].lift).toBeGreaterThan(
      CARD_MOTION_PROFILES["placement-enter"].lift
    );
    expect(CARD_MOTION_PROFILES["lane-shift"].durationMs).toBe(420);
    expect(CARD_MOTION_PROFILES["swap-return"].durationMs).toBe(420);
    expect(COMBAT_RESOLUTION_HOLD_MS).toBe(100);
    expect(PAYMENT_SETTLE_HOLD_MS).toBe(120);
    expect(shouldHoldCombatCard("attack")).toBe(true);
    expect(shouldHoldCombatCard("block")).toBe(true);
    expect(shouldHoldCombatCard("replay-action", "primary")).toBe(true);
    expect(shouldHoldCombatCard("replay-action", "blocker")).toBe(true);
    expect(shouldHoldCombatCard("replay-action", "attachment")).toBe(true);
    expect(shouldHoldCombatCard("replay-action", "payment")).toBe(false);
    expect(shouldHoldCombatCard("hand")).toBe(false);
  });

  test("gives committed movements stable cues without layering every travel and settle", () => {
    Object.keys(CARD_MOTION_CUE_HOOKS).forEach((role) => {
      const motion = createCardMotion({
        role,
        occurrenceId: `match:event:card:${role}`,
        sourceEventId: `event:${role}`,
        start: { x: 0, y: 0, z: 0 },
        destination: { x: 4, y: 0.2, z: 2 }
      });
      expect(motion.cueHooks.length).toBeGreaterThan(0);
      expect(motion.occurrenceId).toBe(`match:event:card:${role}`);
      expect(motion.sourceEventId).toBe(`event:${role}`);
      expect(new Set(motion.cueHooks.map((cue) => cue.occurrenceId)).size).toBe(motion.cueHooks.length);
      expect(motion.cueHooks.every((cue) => cue.visual && cue.audio)).toBe(true);
      expect(Math.max(...motion.cueHooks.map((cue) => cue.offsetMs))).toBeLessThanOrEqual(motion.durationMs);
    });
    expect(createCardMotion({
      role: "draw-enter",
      start: { x: 0 },
      destination: { x: 1 }
    }).cueHooks).toEqual([]);
    expect(createCardMotion({
      role: "replay-stage",
      start: { x: 0 },
      destination: { x: 1 }
    }).cueHooks).toEqual([]);
    expect(createCardMotion({
      role: "discard-exit",
      start: { x: 0 },
      destination: { x: 1 }
    }).cueHooks).toEqual([]);
    expect(createCardMotion({
      role: "block-enter",
      pathIndex: 1,
      start: { x: 0 },
      destination: { x: 1 }
    }).cueHooks).toEqual([]);
  });

  test("uses distinct restrained posture for commitment motions", () => {
    const pose = (role, progress = 0.5) => {
      const motion = createCardMotion({
        role,
        start: { x: 0, y: 0.2, z: 0, rotationX: Math.PI / 2, rotationY: 0, scale: 1 },
        destination: { x: 4, y: 0.2, z: 4, rotationX: Math.PI / 2, rotationY: 0, scale: 1 }
      });
      return sampleCardMotion(motion, motion.durationMs * progress);
    };

    const attack = pose("attack-enter");
    const block = pose("block-enter");
    const payment = pose("payment-enter");
    const placement = pose("placement-enter", 0.86);
    const laneShift = pose("lane-shift");

    expect(attack.rotationX).toBeLessThan(Math.PI / 2);
    expect(block.rotationY).toBeGreaterThan(0);
    expect(payment.scale).toBeLessThan(1);
    expect(placement.scale).toBeLessThan(1);
    expect(laneShift.rotationY).toBeGreaterThan(0);
    expect(laneShift.y).toBeLessThan(attack.y);
    expect(pose("attack-enter", 1)).toMatchObject({
      rotationX: Math.PI / 2,
      rotationY: 0,
      scale: 1,
      complete: true
    });
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

  test("scales travel, stagger, and cue timing coherently for replay speed", () => {
    const normal = createCardMotion({
      role: "block-enter",
      start: { x: 0, z: 0 },
      destination: { x: 4, z: 2 },
      startTimeMs: 100,
      delayMs: 200,
      playbackRate: 1
    });
    const fast = createCardMotion({
      role: "block-enter",
      start: { x: 0, z: 0 },
      destination: { x: 4, z: 2 },
      startTimeMs: 100,
      delayMs: 200,
      playbackRate: 2
    });
    expect(fast.durationMs).toBe(Math.round(normal.durationMs / 2));
    expect(fast.startTimeMs - 100).toBe((normal.startTimeMs - 100) / 2);
    expect(fast.cueHooks.map((cue) => cue.offsetMs)).toEqual(
      normal.cueHooks.map((cue) => Math.round(cue.offsetMs / 2))
    );
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

  test("escapes the permitted source-hand fan before enforcing full path clearance", () => {
    const obstacles = [
      { id: "source-neighbour", x: 0.42, z: 0, scale: 0.72 },
      { id: "combat-card", x: 4.2, z: 0, scale: 0.64 }
    ];
    const path = planCardTravelPath({
      start: { x: 0, z: 0 },
      destination: { x: 8.4, z: 0 },
      obstacles,
      movingScale: 0.72,
      bounds: { left: -10, right: 10, bottom: -8, top: 8 }
    });

    expect(path.length).toBeGreaterThan(2);
    expect(cardTravelPathCollides(path, obstacles, 0.72)).toBe(false);
  });

  test("routes local payment through a deliberate lower-board corridor instead of an extreme detour", () => {
    const start = { x: -1.34, y: 0.62, z: -6.23, scale: 0.82 };
    const destination = { x: 9.89, y: 0.34, z: -5.59, scale: 0.55 };
    const obstacles = [0.34, 2.02, 3.7, 5.38].map((x, index) => ({
      id: `hand-${index}`,
      x,
      z: -6.2,
      scale: 0.82,
      allowElevatedSourceEgress: true
    }));
    const preferredPaths = semanticCardTravelCorridors({ role: "payment-enter", start, destination });
    const path = planCardTravelPath({
      start,
      destination,
      obstacles,
      movingScale: 0.82,
      preferredPaths
    });

    expect(path).toHaveLength(4);
    expect(Math.max(...path.map((point) => point.z))).toBeLessThan(-2.8);
    expect(cardTravelPathCollides(path, obstacles, 0.82)).toBe(false);
  });

  test("gives an anonymous in-place lane mutation a restrained physical loop", () => {
    const corridors = semanticCardTravelCorridors({
      role: "lane-shift",
      start: { x: -3, z: 2 },
      destination: { x: -3, z: 2 }
    });
    expect(corridors).toEqual([[
      { x: -3, z: 2 },
      { x: -2.66, z: 1.92 },
      { x: -3, z: 2 }
    ]]);
  });

  test("seats a shrinking payment card beside an occupied tray slot without overlap or board-wide routing", () => {
    const start = { x: -3.02, y: 0.62, z: -6.294, scale: 0.82 };
    const destination = { x: 9.168, y: 0.34, z: -5.59, scale: 0.55 };
    const obstacles = [
      ...[-1.34, 0.34, 2.02].map((x, index) => ({
        id: `hand-${index}`,
        x,
        z: -6.23,
        scale: 0.82,
        allowElevatedSourceEgress: true
      })),
      { id: "seated-payment", x: 10.612, z: -5.59, scale: 0.55, settleAdjacent: true }
    ];
    const motion = createCardMotion({
      role: "payment-enter",
      start,
      destination,
      obstacles,
      pathIndex: 0,
      bounds: { left: -12.31, right: 12.31, bottom: -7.23, top: 7.1 }
    });

    expect(motion.path).toHaveLength(4);
    expect(Math.max(...motion.path.map((point) => point.z))).toBeLessThan(0);
    expect(cardTravelPathCollides(motion.path, obstacles, {
      start: start.scale,
      end: destination.scale
    })).toBe(false);
  });

  test("keeps a crowded multi-payment route below lane and combat space", () => {
    const start = { x: 1.7, y: 0.62, z: -7.05, scale: 0.9 };
    const destination = { x: 9.97, y: 0.34, z: -6.35, scale: 0.6 };
    const obstacles = [
      ...[-4.8, -2.9, -1, 0.9, 2.8, 4.7].map((x, index) => ({
        id: `hand-${index}`,
        x,
        z: -7.05,
        scale: 0.9,
        allowElevatedSourceEgress: true
      })),
      ...[-7.35, 0, 7.35].map((x, index) => ({
        id: `lane-${index}`,
        x,
        z: -3.15,
        scale: 0.64
      })),
      { id: "seated-payment", x: 11.53, z: -6.35, scale: 0.6, settleAdjacent: true }
    ];
    const motion = createCardMotion({
      role: "payment-enter",
      start,
      destination,
      obstacles,
      bounds: { left: -13, right: 13, bottom: -8.3, top: 8.3 }
    });

    expect(Math.max(...motion.path.map((point) => point.z))).toBeLessThan(0);
    expect(cardTravelPathCollides(motion.path, obstacles, {
      start: start.scale,
      end: destination.scale
    })).toBe(false);
  });

  test("keeps the captured paid-block payment on its lower rail past concurrent blocker sources", () => {
    const start = { x: -5.35, y: 0.62, z: -7.207, scale: 0.9 };
    const destination = { x: 10.75, y: 0.34, z: -6.35, scale: 0.6 };
    const destinationZone = { kind: "payment", side: "local" };
    const sourceHandZone = { kind: "hand", side: "local" };
    const combatZone = { kind: "combat", side: "local" };
    const obstacles = [
      ...[-7.25, -1.55, 0.35, 2.25, 6.05].map((x, index) => ({
        id: `wide-hand-${index}`,
        x,
        z: -7.05,
        scale: 0.9,
        allowElevatedSourceEgress: shouldAllowElevatedSourceEgress({
          destinationZone,
          obstacleZone: sourceHandZone
        })
      })),
      ...[-3.45, 4.15].map((x, index) => ({
        id: `concurrent-blocker-source-${index}`,
        x,
        z: index === 0 ? -7.144 : -7.207,
        scale: 0.9,
        allowElevatedSourceEgress: shouldAllowElevatedSourceEgress({
          destinationZone,
          obstacleZone: combatZone,
          obstacleSourceZone: sourceHandZone,
          obstacleMotionRole: "block-enter",
          obstacleKind: "current"
        })
      })),
      ...[-7.35, 0, 7.35].map((x, index) => ({
        id: `wide-lane-${index}`,
        x,
        z: -3.15,
        scale: 0.64
      }))
    ];
    const motion = createCardMotion({
      role: "payment-enter",
      start,
      destination,
      obstacles,
      bounds: { left: -13, right: 13, bottom: -8.3, top: 8.3 }
    });

    expect(motion.path).toEqual(semanticCardTravelCorridors({
      role: "payment-enter",
      start,
      destination
    })[0]);
    expect(motion.path).toHaveLength(4);
    expect(Math.max(...motion.path.map((point) => point.z))).toBeLessThan(0);
    expect(cardTravelPathCollides(motion.path, obstacles, {
      start: start.scale,
      end: destination.scale
    })).toBe(false);
    expect(shouldAllowElevatedSourceEgress({
      destinationZone,
      obstacleZone: combatZone,
      obstacleSourceZone: sourceHandZone,
      obstacleMotionRole: "attack-enter",
      obstacleKind: "current"
    })).toBe(true);
    expect(shouldAllowElevatedSourceEgress({
      destinationZone,
      obstacleZone: combatZone,
      obstacleSourceZone: sourceHandZone,
      obstacleMotionRole: "block-enter",
      obstacleKind: "target"
    })).toBe(false);
    expect(shouldAllowElevatedSourceEgress({
      destinationZone,
      obstacleZone: combatZone,
      obstacleSourceZone: sourceHandZone,
      obstacleMotionRole: "block-enter",
      obstacleKind: "reserved-path"
    })).toBe(false);
  });

  test("treats an occupied destination as a collision except for the tiny hand settle allowance", () => {
    const occupiedDestination = { id: "occupied", x: 14, z: 0, scale: 0.72 };
    const direct = [{ x: 0, z: 0 }, { x: 14, z: 0 }];

    expect(cardTravelPathCollides(direct, [occupiedDestination], 0.72)).toBe(true);
    expect(cardTravelPathCollides(direct, [{
      ...occupiedDestination,
      x: 15.5,
      allowTargetOverlap: true
    }], 0.72)).toBe(false);
  });

  test("publishes one collision-safe presentation contract for every adapter", () => {
    expect(CARD_MOTION_CONTRACT_VERSION).toBe("gauntlet.card-motion.collision-safe.v1");
  });
});
