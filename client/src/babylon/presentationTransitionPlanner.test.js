import { createPresentationSnapshot } from "./presentationSnapshot";
import { CardActorRegistry } from "./cardActorRegistry";
import {
  planPresentationTransitions,
  PresentationTransitionPlanner,
  shouldSnapPresentationUpdate
} from "./presentationTransitionPlanner";

function card(id, selected = {}) {
  return { id, label: id, value: 8, raw: { id }, selected, interactionEnabled: true };
}

function state({ revision = 1, hand = [card("one")], attacks = [], events = [], source = "live", transitionMode } = {}) {
  return createPresentationSnapshot({
    matchId: "match",
    revision,
    perspective: { player: 1, bottomPlayer: 1, opponent: 2, topPlayer: 2 },
    bottom: { id: 1, handCount: hand.length, deckCount: 51, discardCount: 0 },
    top: { id: 2, handCount: 0, deckCount: 52, discardCount: 0 },
    hand,
    lanes: [0, 1, 2].map(() => ({ hasLocalCard: false, hasOpponentCard: false })),
    attacks,
    publicPayments: [],
    selection: {},
    interactions: { legalLanes: [] },
    events
  }, { source, transitionMode });
}

function actorSnapshot({ revision, actorId = "card:one", from, events = [] }) {
  const actors = from ? [{
    actorId,
    visibleIdentity: actorId,
    cardId: actorId.replace("card:", ""),
    zone: from
  }] : [];
  return {
    matchId: "match",
    revision,
    source: "live",
    transitionMode: "animate",
    traversalGeneration: 0,
    events,
    actors,
    actorById: new Map(actors.map((actor) => [actor.actorId, actor]))
  };
}

test("selection changes do not create a zone transition", () => {
  const before = state();
  const after = state({ revision: 1, hand: [card("one", { attacker: true })] });
  expect(planPresentationTransitions(before, after).transitions).toHaveLength(0);
});

test("same-zone reflow and responsive recomposition snap without semantic card travel", () => {
  const reflow = {
    animate: false,
    motionRole: "state-correction",
    fromZone: { kind: "hand", side: "local", role: "hand", slotIndex: 4 },
    toZone: { kind: "hand", side: "local", role: "hand", slotIndex: 3 }
  };
  expect(shouldSnapPresentationUpdate(reflow, { animateTransition: false })).toBe(true);
  expect(shouldSnapPresentationUpdate(null, { responsiveRecompose: true })).toBe(true);
  expect(shouldSnapPresentationUpdate(null, { animateTransition: false })).toBe(true);
  expect(shouldSnapPresentationUpdate(null, { localFeedbackChanged: true })).toBe(false);
  expect(shouldSnapPresentationUpdate({ animate: true }, { animateTransition: true })).toBe(false);
});

test("an accepted hand attack moves the same actor once", () => {
  const before = state();
  const attack = { id: "a1", owner: 1, laneIndex: null, card: card("one"), blocks: [], payment: { cards: [] } };
  const after = state({
    revision: 2,
    hand: [],
    attacks: [attack],
    events: [{ id: "event-attack", type: "attack.declared", player: 1, cardId: "one" }]
  });
  const plan = planPresentationTransitions(before, after);
  expect(plan.transitions).toHaveLength(1);
  expect(plan.transitions[0]).toEqual(expect.objectContaining({
    actorId: "card:one",
    motionRole: "attack-enter",
    sourceEventId: "event-attack",
    animate: true
  }));
});

test.each([
  ["hand block", { kind: "hand", side: "local", role: "hand", slotIndex: 0 }, { kind: "combat", side: "local", role: "blocker", slotIndex: 0 }, "block.declared", "block-enter"],
  ["lane attack", { kind: "lane", side: "local", role: "facedown", laneIndex: 1, slotIndex: 0 }, { kind: "combat", side: "local", role: "attacker", laneIndex: 1, slotIndex: 0 }, "attack.declared", "attack-enter"],
  ["lane block", { kind: "lane", side: "local", role: "facedown", laneIndex: 1, slotIndex: 0 }, { kind: "combat", side: "local", role: "blocker", laneIndex: 1, slotIndex: 0 }, "block.declared", "block-enter"],
  ["payment", { kind: "hand", side: "local", role: "hand", slotIndex: 0 }, { kind: "payment", side: "local", role: "payment", slotIndex: 0 }, "payment.discarded", "payment-enter"],
  ["placement", { kind: "hand", side: "local", role: "hand", slotIndex: 0 }, { kind: "lane", side: "local", role: "facedown", laneIndex: 2, slotIndex: 0 }, "card.placedFacedown", "placement-enter"]
])("accepted %s creates exactly one semantic transition", (_label, fromZone, toZone, eventType, motionRole) => {
  const before = actorSnapshot({ revision: 1, from: fromZone });
  const after = actorSnapshot({
    revision: 2,
    from: toZone,
    events: [{ id: `event-${eventType}`, type: eventType, cardId: "one", laneIndex: toZone.laneIndex }]
  });
  const plan = planPresentationTransitions(before, after);
  expect(plan.transitions).toHaveLength(1);
  expect(plan.transitions[0]).toEqual(expect.objectContaining({
    actorId: "card:one",
    motionRole,
    sourceEventId: `event-${eventType}`,
    animate: true
  }));
});

test("combat resolution schedules one departure and equivalent snapshots cannot repeat it", () => {
  const planner = new PresentationTransitionPlanner();
  const combat = actorSnapshot({
    revision: 1,
    from: {
      kind: "combat",
      side: "local",
      role: "attacker",
      attackId: "attack-one",
      laneIndex: 1,
      slotIndex: 0
    }
  });
  planner.plan(combat);
  const cleared = actorSnapshot({
    revision: 2,
    from: null,
    events: [
      {
        id: "resolve",
        type: "damage.calculated",
        attackId: "attack-one",
        laneIndex: 1,
        cardId: "one"
      },
      { id: "dealt", type: "damage.dealt" },
      { id: "complete", type: "combat.resolutionCompleted" }
    ]
  });
  expect(planner.plan(cleared, { eventGate: true }).transitions).toEqual([
    expect.objectContaining({
      actorId: "card:one",
      motionRole: "discard-exit",
      sourceEventId: "resolve",
      animate: true
    })
  ]);
  expect(planner.plan(cleared, { eventGate: true }).transitions).toHaveLength(0);
});

test.each([
  ["blocker", { kind: "combat", side: "local", role: "blocker" }],
  ["attachment", { kind: "attachment", side: "local", role: "attachment" }]
])("aggregate damage identity releases a %s even when cardId names the attacker", (_label, zone) => {
  const planner = new PresentationTransitionPlanner();
  planner.plan(actorSnapshot({
    revision: 1,
    from: { ...zone, attackId: "attack-one", laneIndex: 1, slotIndex: 0 }
  }));
  const cleared = actorSnapshot({
    revision: 2,
    from: null,
    events: [{
      id: "resolve",
      type: "damage.calculated",
      attackId: "attack-one",
      laneIndex: 1,
      cardId: "attacker-card"
    }]
  });

  const result = planner.plan(cleared, { eventGate: true });
  expect(result.snapshot.actors).toHaveLength(0);
  expect(result.transitions).toEqual([
    expect.objectContaining({
      actorId: "card:one",
      motionRole: "discard-exit",
      sourceEventId: "resolve",
      animate: true
    })
  ]);
});

test("duplicate snapshots cannot restart an emitted occurrence", () => {
  const planner = new PresentationTransitionPlanner();
  planner.plan(state());
  const attack = { id: "a1", owner: 1, laneIndex: null, card: card("one"), blocks: [], payment: { cards: [] } };
  const next = state({ revision: 2, hand: [], attacks: [attack], events: [{ id: "event-attack", type: "attack.declared", cardId: "one" }] });
  expect(planner.plan(next).transitions.filter((entry) => entry.animate)).toHaveLength(1);
  expect(planner.plan(next).transitions.filter((entry) => entry.animate)).toHaveLength(0);
});

test("event-gated payment actors depart before a later payment batch enters", () => {
  const planner = new PresentationTransitionPlanner();
  const firstPayment = {
    actorId: "card:first",
    visibleIdentity: "card:first",
    cardId: "first",
    zone: { kind: "payment", side: "local", role: "payment", slotIndex: 0, count: 1 }
  };
  const secondInHand = {
    actorId: "card:second",
    visibleIdentity: "card:second",
    cardId: "second",
    zone: { kind: "hand", side: "local", role: "hand", slotIndex: 0, count: 1 }
  };
  const first = {
    ...actorSnapshot({ revision: 1, from: null }),
    actors: [firstPayment, secondInHand],
    actorById: new Map([
      [firstPayment.actorId, firstPayment],
      [secondInHand.actorId, secondInHand]
    ])
  };
  planner.plan(first);
  const secondActor = {
    actorId: "card:second",
    visibleIdentity: "card:second",
    cardId: "second",
    zone: { kind: "payment", side: "local", role: "payment", slotIndex: 0, count: 1 }
  };
  const second = {
    ...actorSnapshot({ revision: 2, from: null }),
    events: [{ id: "pay-two", type: "payment.discarded", player: 1, cardId: "second" }],
    actors: [secondActor],
    actorById: new Map([[secondActor.actorId, secondActor]])
  };
  const result = planner.plan(second, { eventGate: true });
  const payments = result.snapshot.actors.filter((actor) => actor.zone.kind === "payment");

  expect(payments).toHaveLength(1);
  expect(payments[0]).toEqual(expect.objectContaining({ actorId: "card:second" }));
  expect(result.transitions).toEqual(expect.arrayContaining([
    expect.objectContaining({
      actorId: "card:first",
      motionRole: "discard-exit",
      sourceEventId: "pay-two",
      animate: true
    }),
    expect.objectContaining({
      actorId: "card:second",
      motionRole: "payment-enter",
      sourceEventId: "pay-two",
      animate: true
    })
  ]));
});

test("accepted attack releases its committed payment actor into discard", () => {
  const planner = new PresentationTransitionPlanner();
  const payment = actorSnapshot({
    revision: 2,
    from: { kind: "payment", side: "local", role: "payment", slotIndex: 0, count: 1 },
    events: [{ id: "paid", type: "payment.discarded", player: 1, cardIds: ["one"] }]
  });
  planner.plan(payment);
  const attack = actorSnapshot({
    revision: 2,
    from: null,
    events: [{ id: "attack", type: "attack.declared", player: 1, cardId: "attacker" }]
  });

  const result = planner.plan(attack, { eventGate: true });
  expect(result.snapshot.actorById.has("card:one")).toBe(false);
  expect(result.transitions).toEqual([
    expect.objectContaining({
      actorId: "card:one",
      motionRole: "discard-exit",
      sourceEventId: "attack",
      animate: true
    })
  ]);
});

test("multiple accepted payments are dealt into the tray with readable stagger", () => {
  const previous = {
    ...actorSnapshot({ revision: 1, from: null }),
    actors: [0, 1, 2].map((index) => ({
      actorId: `card:payment-${index}`,
      visibleIdentity: `card:payment-${index}`,
      cardId: `payment-${index}`,
      zone: { kind: "hand", side: "local", role: "hand", slotIndex: index, count: 3 }
    }))
  };
  previous.actorById = new Map(previous.actors.map((actor) => [actor.actorId, actor]));
  const next = {
    ...actorSnapshot({ revision: 2, from: null }),
    events: previous.actors.map((actor, index) => ({
      id: `payment-event-${index}`,
      type: "payment.discarded",
      cardId: actor.cardId
    })),
    actors: previous.actors.map((actor, index) => ({
      ...actor,
      zone: { kind: "payment", side: "local", role: "payment", slotIndex: index, count: 3 }
    }))
  };
  next.actorById = new Map(next.actors.map((actor) => [actor.actorId, actor]));

  const transitions = planPresentationTransitions(previous, next).transitions;
  expect(transitions.map((transition) => transition.delayMs)).toEqual([0, 70, 140]);
  expect(transitions.every((transition) => transition.motionRole === "payment-enter")).toBe(true);
});

test("a paid hand block exposes payment travel before its staggered brace", () => {
  const planner = new PresentationTransitionPlanner();
  const payment = card("payment");
  const blockerOne = card("blocker-one");
  const blockerTwo = card("blocker-two");
  const staged = state({
    hand: [payment, blockerOne, blockerTwo]
  });
  planner.plan(staged);

  const committed = state({
    hand: [payment, blockerOne, blockerTwo],
    events: [
      { id: "paid-block", type: "payment.discarded", player: 1, cardIds: ["payment"] },
      { id: "declared-block", type: "block.declared", player: 1, cardIds: ["blocker-one", "blocker-two"] }
    ]
  });
  const transitions = planner.plan(committed, { eventGate: true }).transitions;

  expect(transitions).toEqual(expect.arrayContaining([
    expect.objectContaining({
      actorId: "card:payment",
      motionRole: "payment-enter",
      sourceEventId: "paid-block",
      delayMs: 0,
      animate: true
    }),
    expect.objectContaining({
      actorId: "card:blocker-one",
      motionRole: "block-enter",
      sourceEventId: "declared-block",
      delayMs: 120,
      animate: true
    }),
    expect.objectContaining({
      actorId: "card:blocker-two",
      motionRole: "block-enter",
      sourceEventId: "declared-block",
      delayMs: 175,
      animate: true
    })
  ]));
  expect(transitions.filter(({ motionRole }) => motionRole === "payment-enter")).toHaveLength(1);
  expect(transitions.filter(({ motionRole }) => motionRole === "block-enter")).toHaveLength(2);
});

test.each([
  [
    "lane shift",
    { kind: "lane", side: "local", role: "facedown", laneIndex: 0, slotIndex: 0 },
    { kind: "lane", side: "local", role: "facedown", laneIndex: 2, slotIndex: 0 },
    { id: "swap-lanes", type: "lanes.swapped", laneA: 0, laneB: 2 },
    "lane-shift"
  ],
  [
    "lane return to hand",
    { kind: "lane", side: "local", role: "facedown", laneIndex: 1, slotIndex: 0 },
    { kind: "hand", side: "local", role: "hand", slotIndex: 0 },
    { id: "swap-return", type: "laneCard.swappedWithHand", laneIndex: 1 },
    "swap-return"
  ],
  [
    "hand card entering a swapped lane",
    { kind: "hand", side: "local", role: "hand", slotIndex: 0 },
    { kind: "lane", side: "local", role: "facedown", laneIndex: 1, slotIndex: 0 },
    { id: "swap-enter", type: "laneCard.swappedWithHand", laneIndex: 1 },
    "lane-shift"
  ]
])("accepted %s uses a low, target-specific motion", (_label, from, to, event, motionRole) => {
  const before = actorSnapshot({ revision: 1, from });
  const after = actorSnapshot({ revision: 2, from: to, events: [event] });
  expect(planPresentationTransitions(before, after).transitions).toEqual([
    expect.objectContaining({ motionRole, sourceEventId: event.id, animate: true })
  ]);
});

test("hidden lane identities still acknowledge an in-place opponent swap", () => {
  const actors = [0, 2].map((laneIndex) => ({
    actorId: `hidden:player-2:lane:${laneIndex}`,
    visibleIdentity: `hidden:player-2:lane:${laneIndex}`,
    cardId: null,
    anonymous: true,
    zone: { kind: "lane", side: "opponent", role: "facedown", laneIndex, slotIndex: 0 }
  }));
  const snapshot = (revision, events = []) => ({
    matchId: "match",
    revision,
    source: "live",
    transitionMode: "animate",
    traversalGeneration: 0,
    events,
    actors,
    actorById: new Map(actors.map((actor) => [actor.actorId, actor]))
  });
  const transitions = planPresentationTransitions(snapshot(1), snapshot(2, [{
    id: "hidden-swap",
    type: "lanes.swapped",
    player: 2,
    laneA: 0,
    laneB: 2
  }])).transitions;

  expect(transitions).toHaveLength(2);
  expect(transitions.every((transition) => (
    transition.motionRole === "lane-shift"
    && transition.sourceEventId === "hidden-swap"
    && transition.animate
  ))).toBe(true);
  expect(transitions.map((transition) => transition.delayMs)).toEqual([0, 60]);
});

test("live stale revisions are rejected and replay seeks reconcile statically", () => {
  const current = state({ revision: 4 });
  const stale = state({ revision: 3 });
  expect(planPresentationTransitions(current, stale)).toEqual(expect.objectContaining({ accepted: false, reason: "stale-revision" }));
  const replaySeek = state({ revision: 2, source: "replay", transitionMode: "reconcile" });
  const result = planPresentationTransitions(current, replaySeek);
  expect(result.accepted).toBe(true);
  expect(result.transitions.every((entry) => !entry.animate)).toBe(true);
});

test("rebinds a public reveal to the matching hidden lane actor", () => {
  const before = createPresentationSnapshot({
    matchId: "match",
    revision: 1,
    perspective: { player: 1, bottomPlayer: 1, opponent: 2, topPlayer: 2 },
    bottom: { id: 1, handCount: 0, deckCount: 52, discardCount: 0 },
    top: { id: 2, handCount: 0, deckCount: 52, discardCount: 0 },
    hand: [],
    lanes: [
      { hasLocalCard: false, hasOpponentCard: true },
      { hasLocalCard: false, hasOpponentCard: false },
      { hasLocalCard: false, hasOpponentCard: false }
    ],
    attacks: [],
    publicPayments: [],
    selection: {},
    interactions: { legalLanes: [] },
    events: []
  }, { source: "live" });
  const revealed = card("revealed");
  const after = createPresentationSnapshot({
    matchId: "match",
    revision: 2,
    perspective: { player: 1, bottomPlayer: 1, opponent: 2, topPlayer: 2 },
    bottom: { id: 1, handCount: 0, deckCount: 52, discardCount: 0 },
    top: { id: 2, handCount: 0, deckCount: 52, discardCount: 0 },
    hand: [],
    lanes: [
      { hasLocalCard: false, hasOpponentCard: false },
      { hasLocalCard: false, hasOpponentCard: false },
      { hasLocalCard: false, hasOpponentCard: false }
    ],
    attacks: [{ id: "a1", owner: 2, laneIndex: 0, card: revealed, blocks: [], payment: { cards: [] } }],
    publicPayments: [],
    selection: {},
    interactions: { legalLanes: [] },
    events: [{ id: "attack", type: "attack.declared", player: 2, cardId: "revealed", laneIndex: 0 }]
  }, { source: "live" });
  const transition = planPresentationTransitions(before, after).transitions[0];
  expect(transition).toEqual(expect.objectContaining({
    actorId: "card:revealed",
    rebindFromActorId: "hidden:player-2:lane:0",
    motionRole: "attack-enter",
    animate: true
  }));
});

test("live, local, replay, and imported replay project the same actor zones and motion roles", () => {
  const sources = ["live", "local", "replay", "imported-replay"];
  const results = sources.map((source) => {
    const before = state({ source });
    const after = state({
      source,
      revision: 2,
      hand: [],
      attacks: [{
        id: "a1",
        owner: 1,
        laneIndex: null,
        card: card("one"),
        blocks: [],
        payment: { cards: [] }
      }],
      events: [{ id: "accepted-attack", type: "attack.declared", player: 1, cardId: "one" }]
    });
    const transition = planPresentationTransitions(before, after).transitions[0];
    return {
      actors: after.actors.map((entry) => ({ id: entry.actorId, zone: entry.zone })),
      transition: {
        actorId: transition.actorId,
        from: transition.fromZone,
        to: transition.toZone,
        motionRole: transition.motionRole,
        animate: transition.animate
      }
    };
  });
  results.slice(1).forEach((result) => expect(result).toEqual(results[0]));
});

test("reconnect reconciliation snaps to canonical state without stale travel or actor replacement", () => {
  const planner = new PresentationTransitionPlanner();
  const created = [];
  const updated = [];
  const registry = new CardActorRegistry({
    create: (entry) => {
      const runtime = { id: `runtime:${entry.actorId}` };
      created.push(runtime);
      return runtime;
    },
    update: (runtime, entry) => updated.push({ runtime, entry })
  });
  const connected = state({ revision: 1 });
  const initialPlan = planner.plan(connected);
  registry.reconcile(initialPlan.snapshot, initialPlan.transitions);
  const runtime = registry.get("card:one").runtime;
  const recovered = state({
    revision: 6,
    hand: [],
    attacks: [{
      id: "a1",
      owner: 1,
      laneIndex: null,
      card: card("one"),
      blocks: [],
      payment: { cards: [] }
    }],
    events: [{ id: "stale-attack", type: "attack.declared", player: 1, cardId: "one" }],
    transitionMode: "reconcile"
  });
  const recoveredPlan = planner.plan(recovered);
  registry.reconcile(recoveredPlan.snapshot, recoveredPlan.transitions);

  expect(recoveredPlan.transitions).toEqual([
    expect.objectContaining({ actorId: "card:one", motionRole: "attack-enter", animate: false, reconcile: true })
  ]);
  expect(created).toHaveLength(1);
  expect(registry.get("card:one").runtime).toBe(runtime);
  expect(registry.get("card:one").actor.zone).toEqual(expect.objectContaining({ kind: "combat" }));
  expect(registry.metrics().duplicateVisibleIdentityCount).toBe(0);
  expect(updated).toHaveLength(1);
});
