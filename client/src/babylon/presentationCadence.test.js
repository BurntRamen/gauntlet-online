import {
  CADENCE_TIERS,
  CADENCE_TIER_TIMINGS,
  MAJOR_DAMAGE_THRESHOLD,
  PRESENTATION_BEAT_RECIPES,
  PRESENTATION_CADENCE_CONTRACT_VERSION,
  PRESENTATION_MOTION_PROFILES,
  projectPresentationBeats,
  projectPresentationCueMetadata,
  resolvePresentationBeatTiming
} from "./presentationCadence";

describe("tiered presentation cadence", () => {
  test("keeps tiers, phases, and motion profiles in one monotonic contract", () => {
    expect(Object.values(CADENCE_TIERS)).toEqual([
      "rest",
      "attention",
      "commitment",
      "resolution",
      "major"
    ]);
    expect(Object.values(CADENCE_TIER_TIMINGS).map(({ durationMs }) => durationMs)).toEqual([
      0,
      520,
      820,
      1050,
      1350
    ]);
    Object.values(PRESENTATION_BEAT_RECIPES).forEach((recipe) => {
      const offsets = Object.values(recipe.phases);
      expect(offsets).toEqual([...offsets].sort((left, right) => left - right));
      expect(offsets.at(-1)).toBe(recipe.durationMs);
    });
    expect(Object.fromEntries(Object.entries(PRESENTATION_MOTION_PROFILES).map(([role, profile]) => [
      role,
      profile.durationMs
    ]))).toEqual({
      hover: 130,
      "payment-enter": 520,
      "draw-enter": 420,
      "placement-enter": 560,
      "attack-enter": 680,
      "block-enter": 720,
      "lane-shift": 600,
      "swap-return": 600,
      "replay-stage": 680,
      "discard-exit": 420,
      "state-correction": 180
    });
    expect(PRESENTATION_MOTION_PROFILES["payment-enter"].staggerMs).toBe(170);
    expect(PRESENTATION_MOTION_PROFILES["block-enter"].staggerMs).toBe(90);
    expect(PRESENTATION_MOTION_PROFILES["draw-enter"].staggerMs).toBe(55);
    expect(PRESENTATION_MOTION_PROFILES["lane-shift"].staggerMs).toBe(45);
    expect(PRESENTATION_MOTION_PROFILES["attack-enter"].paymentLeadMs).toBe(180);
    expect(PRESENTATION_MOTION_PROFILES["block-enter"].paymentLeadMs).toBe(180);
  });

  test("coalesces payment, attack, and its trailing priority into one commitment beat", () => {
    const events = [
      { id: "payment", type: "payment.discarded", player: 1, cardIds: ["p1", "p2"] },
      { id: "modifier", type: "payment.modified", player: 1, amount: 1 },
      { id: "attack", type: "attack.declared", player: 1, cardId: "attacker", laneIndex: 2 },
      { id: "priority", type: "priority.granted", player: 2 }
    ];
    const beats = projectPresentationBeats(events);
    expect(beats).toHaveLength(1);
    expect(beats[0]).toMatchObject({
      contract: PRESENTATION_CADENCE_CONTRACT_VERSION,
      kind: "attack.commit",
      tier: CADENCE_TIERS.COMMITMENT,
      sourceEventIds: ["payment", "modifier", "attack", "priority"]
    });
    expect(projectPresentationCueMetadata(beats[0]).map(({ cueId }) => cueId)).toEqual([
      "payment.release",
      "attack.declare",
      "priority.transfer"
    ]);
  });

  test("coalesces payment and blockers while extending the beat through staggered motion", () => {
    const [beat] = projectPresentationBeats([
      { id: "payment", type: "payment.discarded", cardIds: ["p1", "p2", "p3"] },
      { id: "block", type: "block.declared", cardIds: ["b1", "b2", "b3"] }
    ]);
    expect(beat.kind).toBe("block.commit");
    expect(beat.durationMs).toBe(1190);
    expect(beat.timing.motionWindows.find(({ role }) => role === "block")).toMatchObject({
      count: 3,
      startMs: 180,
      durationMs: 720,
      staggerMs: 90,
      endMs: 1190
    });
    expect(resolvePresentationBeatTiming(beat, { playbackRate: 2 }).durationMs).toBe(595);
    expect(resolvePresentationBeatTiming(beat, { reducedMotion: true }).durationMs).toBeGreaterThanOrEqual(
      PRESENTATION_BEAT_RECIPES["block.commit"].reducedMotionMs
    );
  });

  test("coalesces all combat consequences and priority into one outcome-specific resolution", () => {
    const projectDamage = (damage) => projectPresentationBeats([
      { id: `calculated-${damage}`, type: "damage.calculated", damage, laneIndex: 1 },
      damage > 0
        ? { id: `dealt-${damage}`, type: "damage.dealt", amount: damage, laneIndex: 1 }
        : { id: "blocked", type: "attack.fullyBlocked", laneIndex: 1 },
      { id: `complete-${damage}`, type: "combat.resolutionCompleted" },
      { id: `priority-${damage}`, type: "priority.granted", player: 2 }
    ])[0];

    expect(projectDamage(0).kind).toBe("combat.blocked");
    expect(projectDamage(4).kind).toBe("damage.impact");
    const major = projectDamage(MAJOR_DAMAGE_THRESHOLD);
    expect(major.kind).toBe("damage.major");
    expect(major.events).toHaveLength(4);
    expect(projectPresentationCueMetadata(major)[0]).toMatchObject({
      cueId: "damage.major",
      effectDurationMs: major.durationMs,
      cadence: {
        contract: PRESENTATION_CADENCE_CONTRACT_VERSION,
        kind: "damage.major",
        tier: CADENCE_TIERS.MAJOR,
        level: 4,
        grammar: "major-impact",
        materialRole: "danger",
        spriteAlpha: 0.4,
        ringAlpha: 0.22,
        boardResponse: 1,
        zoneResponse: "lane-resolve"
      }
    });
    expect(projectPresentationCueMetadata(major).map(({ cueId, offsetMs, cadence }) => ({
      cueId,
      offsetMs,
      grammar: cadence.grammar
    }))).toEqual([
      { cueId: "damage.major", offsetMs: 220, grammar: "major-impact" },
      { cueId: "priority.transfer", offsetMs: 420, grammar: "handoff" }
    ]);

    const [passedResolution] = projectPresentationBeats([
      { id: "passed", type: "priority.passed", player: 1 },
      { id: "calculated", type: "damage.calculated", damage: 3 },
      { id: "dealt", type: "damage.dealt", amount: 3 },
      { id: "granted", type: "priority.granted", player: 2 }
    ]);
    expect(passedResolution.kind).toBe("damage.impact");
    expect(passedResolution.events.map(({ id }) => id)).toEqual([
      "passed",
      "calculated",
      "dealt",
      "granted"
    ]);
  });

  test("groups non-empty draws with turn start and suppresses empty draw and payment beats", () => {
    expect(projectPresentationBeats([
      { id: "empty-payment", type: "payment.discarded", cardIds: [] },
      { id: "empty-draw", type: "cards.drawn", cardIds: [] }
    ])).toEqual([]);

    const [turn] = projectPresentationBeats([
      { id: "empty", type: "cards.drawn", cardIds: [] },
      { id: "draw-1", type: "cards.drawn", player: 1, cardIds: ["a", "b", "c"] },
      { id: "draw-2", type: "cards.drawn", player: 2, cardIds: ["d", "e"] },
      { id: "turn", type: "turn.started", player: 2 }
    ]);
    expect(turn.kind).toBe("turn.start");
    expect(turn.motionCounts.drawCards).toBe(5);
    expect(turn.durationMs).toBe(720);
    expect(projectPresentationCueMetadata(turn).map(({ cueId }) => cueId)).toEqual([
      "card.draw",
      "turn.start"
    ]);
  });

  test("collapses the campaign alias and coalesces ability mutations", () => {
    const beats = projectPresentationBeats([
      { id: "campaign", type: "campaign.attackDeclared", attackId: "a1", cardId: "boss" },
      { id: "attack", type: "attack.declared", attackId: "a1", source: "campaignBoss" },
      { id: "priority", type: "priority.granted", player: 1 },
      { id: "ability", type: "ability.activated", abilityId: "polea-swap", player: 1 },
      { id: "swap", type: "lanes.swapped", laneA: 0, laneB: 2, movedCardCount: 2 },
      { id: "buff", type: "card.buffApplied", amount: 1 }
    ]);
    expect(beats.map(({ kind }) => kind)).toEqual(["attack.commit", "ability.activate"]);
    expect(beats[0].events.map(({ id }) => id)).toEqual(["campaign", "attack", "priority"]);
    expect(beats[0].event.cardId).toBe("boss");
    expect(beats[1].events.map(({ id }) => id)).toEqual(["ability", "swap", "buff"]);
    expect(projectPresentationCueMetadata(beats[1])).toHaveLength(1);
    expect(projectPresentationCueMetadata(beats[1])[0].cueId).toBe("ability.activate");
  });

  test("publishes distinct physical grammar for every visual beat", () => {
    const cases = [
      [{ type: "payment.discarded", cardIds: ["p"] }, "contract"],
      [{ type: "attack.declared" }, "thrust"],
      [{ type: "block.declared", cardIds: ["b"] }, "brace"],
      [{ type: "damage.calculated", damage: 0 }, "resist"],
      [{ type: "damage.calculated", damage: 4 }, "impact"],
      [{ type: "damage.calculated", damage: 8 }, "major-impact"],
      [{ type: "card.placedFacedown" }, "seat"],
      [{ type: "cards.drawn", cardIds: ["d"] }, "draw"],
      [{ type: "priority.granted" }, "handoff"],
      [{ type: "turn.started" }, "sweep"],
      [{ type: "ability.activated" }, "focus"],
      [{ type: "match.ended", winner: 1 }, "result"]
    ];
    expect(cases.map(([entry]) => {
      const beat = projectPresentationBeats([{ id: `event-${entry.type}`, ...entry }])[0];
      return projectPresentationCueMetadata(beat, { perspectivePlayer: 1 })[0].cadence.grammar;
    })).toEqual(cases.map(([, grammar]) => grammar));
  });
});
