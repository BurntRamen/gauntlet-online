import {
  BATTLEFIELD_EVENT_PACING,
  BATTLEFIELD_PLAYBACK_CONTRACT_VERSION,
  BattlefieldPlaybackQueue,
  battlefieldCommitEventIndex,
  battlefieldEventDuration,
  createBattlefieldPlaybackFrames
} from "./battlefieldPlayback";
import { PRESENTATION_BEAT_RECIPES } from "./presentationCadence";
import { createPresentationSnapshot } from "./presentationSnapshot";
import { planPresentationTransitions } from "./presentationTransitionPlanner";

function updateFor(events, overrides = {}) {
  return {
    source: "local",
    revision: 2,
    events,
    snapshot: { id: "match-1" },
    viewModel: {
      matchId: "match-1",
      revision: 2,
      instruction: "Authoritative state",
      events
    },
    ...overrides
  };
}

describe("queued battlefield playback", () => {
  test("splits a resolved command into deterministic readable event frames", () => {
    const seen = new Set();
    const events = [
      { id: "paid", type: "payment.discarded" },
      { id: "attack", type: "attack.declared" },
      { id: "priority", type: "priority.granted", player: 2 }
    ];
    const frames = createBattlefieldPlaybackFrames(updateFor(events), seen);

    expect(frames.map((frame) => frame.event?.id || null)).toEqual(["attack", null]);
    expect(frames.map((frame) => frame.durationMs)).toEqual([frames[0].beat.timing.durationMs, 0]);
    expect(frames[0].durationMs).toBeGreaterThan(BATTLEFIELD_EVENT_PACING["attack.declared"]);
    expect(frames[0].beat.kind).toBe("attack.commit");
    expect(frames[0].update.viewModel.events).toEqual(events);
    expect(frames[0].update.presentation.playbackContract).toBe(
      BATTLEFIELD_PLAYBACK_CONTRACT_VERSION
    );
    expect(frames[0].update.presentation.cues).toEqual(expect.arrayContaining([
      expect.objectContaining({ cueId: "payment.release", sourceEventId: "paid" }),
      expect.objectContaining({
      cueId: "attack.declare",
      sourceEventId: "attack"
      })
    ]));
    expect(frames[0].update.viewModel.presentationCues).toEqual(frames[0].update.presentation.cues);
  });

  test("keeps authoritative state current while presentation events are gated sequentially", () => {
    const seen = new Set();
    const previous = updateFor([], {
      revision: 1,
      viewModel: {
        ...updateFor([]).viewModel,
        revision: 1,
        instruction: "Attack awaiting a response",
        bottom: { life: 20 }
      }
    });
    const blockEvents = [
      { id: "block-paid", type: "payment.discarded" },
      { id: "block-card", type: "block.declared" },
      { id: "block-damage", type: "damage.calculated", damage: 4 },
      { id: "block-priority", type: "priority.granted", player: 1 }
    ];
    const resolved = updateFor(blockEvents, {
      revision: 2,
      viewModel: {
        ...updateFor(blockEvents).viewModel,
        revision: 2,
        instruction: "Combat resolved",
        bottom: { life: 16 }
      }
    });
    const frames = createBattlefieldPlaybackFrames(resolved, seen, { baseUpdate: previous });

    expect(battlefieldCommitEventIndex(blockEvents)).toBe(2);
    expect(frames.map((frame) => frame.beat?.kind || null)).toEqual([
      "block.commit",
      null,
      "damage.impact",
      null
    ]);
    expect(frames[0].update.viewModel.instruction).toBe("Attack awaiting a response");
    expect(frames[0].update.viewModel.bottom.life).toBe(20);
    expect(frames[0].update.viewModel.presentationPlayback.stateCommitted).toBe(false);
    expect(frames[1].update.viewModel.instruction).toBe("Attack awaiting a response");
    expect(frames[1].update.viewModel.bottom.life).toBe(20);
    expect(frames[1].update.viewModel.presentationPlayback).toMatchObject({
      activeBeatPhase: "anticipation",
      activeEventType: null,
      stateCommitted: false
    });
    expect(frames[2].update.viewModel.instruction).toBe("Combat resolved");
    expect(frames[2].update.viewModel.bottom.life).toBe(16);
    expect(frames[2].update.viewModel.presentationPlayback).toMatchObject({
      activeBeatPhase: "consequence",
      activeEventType: "damage.calculated",
      stateCommitted: true
    });
    expect(frames[2].update.viewModel.presentationCues[0].offsetMs).toBe(0);
    expect(frames[1].durationMs + frames[2].durationMs).toBe(
      frames[2].beat.timing.durationMs
    );
    expect(frames[3].update.viewModel.instruction).toBe("Combat resolved");
    expect(frames.slice(0, -1).every((frame) => frame.update.viewModel.presentationEventGate)).toBe(true);
    expect(frames.at(-1).update.viewModel.presentationPlayback.finalReconcile).toBe(true);
    expect(frames[3].update.viewModel.presentationPlayback.stateCommitted).toBe(true);
  });

  test("a resolved paid block presents payment and blockers before committing damage", () => {
    const card = (id) => ({
      id,
      label: `Real ${id}`,
      value: 5,
      artPath: `/cards/${id}.png`,
      raw: { id },
      interactionEnabled: true
    });
    const baseViewModel = {
      matchId: "match-1",
      revision: 1,
      perspective: { player: 1, bottomPlayer: 1, opponent: 2, topPlayer: 2 },
      bottom: { id: 1, handCount: 3, deckCount: 49, discardCount: 0 },
      top: { id: 2, handCount: 0, deckCount: 52, discardCount: 0 },
      hand: [card("payment"), card("blocker-one"), card("blocker-two")],
      lanes: [],
      attacks: [],
      publicPayments: [],
      selection: {},
      interactions: { legalLanes: [] },
      visibleCardCatalog: {},
      instruction: "Choose a block payment.",
      events: []
    };
    const previous = updateFor([], {
      revision: 1,
      viewModel: baseViewModel
    });
    const events = [
      { id: "paid-block", type: "payment.discarded", player: 1, cardIds: ["payment"] },
      { id: "declared-block", type: "block.declared", player: 1, cardIds: ["blocker-one", "blocker-two"] },
      { id: "resolved-block", type: "damage.calculated", player: 1, damage: 0 },
      { id: "fully-blocked", type: "attack.fullyBlocked", player: 1 }
    ];
    const resolved = updateFor(events, {
      revision: 2,
      viewModel: {
        ...baseViewModel,
        revision: 2,
        hand: [],
        visibleCardCatalog: {
          payment: card("payment"),
          "blocker-one": card("blocker-one"),
          "blocker-two": card("blocker-two")
        },
        events,
        instruction: "Attack stopped."
      }
    });
    const frames = createBattlefieldPlaybackFrames(resolved, new Set(), { baseUpdate: previous });
    const commitmentFrame = frames[0];

    expect(commitmentFrame.beat.kind).toBe("block.commit");
    expect(commitmentFrame.update.viewModel.presentationPlayback.stateCommitted).toBe(false);
    expect(commitmentFrame.update.viewModel.events.map(({ id }) => id)).toEqual([
      "paid-block",
      "declared-block"
    ]);
    expect(commitmentFrame.update.viewModel.visibleCardCatalog).toEqual(
      resolved.viewModel.visibleCardCatalog
    );

    const before = createPresentationSnapshot(baseViewModel, { source: "local" });
    const duringCommitment = createPresentationSnapshot(commitmentFrame.update.viewModel, { source: "local" });
    const transitions = planPresentationTransitions(before, duringCommitment, { eventGate: true }).transitions;
    expect(transitions.filter(({ motionRole }) => motionRole === "payment-enter")).toEqual([
      expect.objectContaining({ actorId: "card:payment", sourceEventId: "paid-block", animate: true })
    ]);
    expect(transitions.filter(({ motionRole }) => motionRole === "block-enter")).toEqual([
      expect.objectContaining({ actorId: "card:blocker-one", sourceEventId: "declared-block", animate: true }),
      expect.objectContaining({ actorId: "card:blocker-two", sourceEventId: "declared-block", animate: true })
    ]);
    ["payment", "blocker-one", "blocker-two"].forEach((id) => {
      expect(duringCommitment.actorById.get(`card:${id}`)).toEqual(expect.objectContaining({
        label: `Real ${id}`,
        artPath: `/cards/${id}.png`
      }));
    });
  });

  test("never replays duplicate authoritative events", () => {
    const seen = new Set();
    const event = { id: "attack", type: "attack.declared" };
    expect(createBattlefieldPlaybackFrames(updateFor([event]), seen)).toHaveLength(2);
    expect(createBattlefieldPlaybackFrames(updateFor([event]), seen)).toEqual([
      expect.objectContaining({ event: null, durationMs: 0 })
    ]);
  });

  test("preserves readable text dwell under reduced motion and honors replay speed", () => {
    const event = { type: "block.declared" };
    expect(battlefieldEventDuration(event, { reducedMotion: true })).toBe(
      PRESENTATION_BEAT_RECIPES["block.commit"].reducedMotionMs
    );
    expect(battlefieldEventDuration(event, { playbackRate: 4 })).toBe(
      Math.round(BATTLEFIELD_EVENT_PACING["block.declared"] / 4)
    );
  });

  test("queues rapid authoritative updates instead of replacing active presentation", () => {
    jest.useFakeTimers();
    const presented = [];
    const states = [];
    const queue = new BattlefieldPlaybackQueue({
      onPresent: (update, frame) => presented.push({ update, frame }),
      onStateChange: (state) => states.push(state)
    });
    queue.push(updateFor([{ id: "attack", type: "attack.declared" }]));
    queue.push(updateFor(
      [{ id: "block", type: "block.declared" }],
      { revision: 3, viewModel: { ...updateFor([]).viewModel, revision: 3 } }
    ));

    expect(presented.map(({ frame }) => frame.event?.id || null)).toEqual(["attack"]);
    jest.advanceTimersByTime(BATTLEFIELD_EVENT_PACING["attack.declared"] - 1);
    expect(presented).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(presented.map(({ frame }) => frame.event?.id || null)).toEqual(["attack", null, "block"]);
    expect(states.some((state) => state.queuedFrames >= 2)).toBe(true);

    queue.dispose();
    jest.useRealTimers();
  });

  test("starts a new cue traversal when replay deliberately seeks or restarts", () => {
    jest.useFakeTimers();
    const cues = [];
    const queue = new BattlefieldPlaybackQueue({
      onPresent: (update) => cues.push(update.presentation?.cues?.[0]?.occurrenceId),
      onStateChange: () => {}
    });
    const event = { id: "damage", type: "damage.calculated" };
    const replay = (currentIndex) => updateFor([event], {
      source: "replay",
      replay: { currentIndex, speed: 1 },
      viewModel: { ...updateFor([event]).viewModel, events: [event] }
    });
    queue.push(replay(0));
    jest.runOnlyPendingTimers();
    queue.push(replay(3));
    expect(cues[0]).not.toBe(cues[1]);
    queue.dispose();
    jest.useRealTimers();
  });

  test("projects match results from the player perspective carried by the live view", () => {
    const event = { id: "ended", type: "match.ended", winner: 2 };
    const update = updateFor([event], {
      viewModel: {
        ...updateFor([event]).viewModel,
        events: [event],
        perspective: { player: 1, spectator: false }
      }
    });
    const [frame] = createBattlefieldPlaybackFrames(update, new Set());
    expect(frame.update.presentation.cues[0].cueId).toBe("match.defeat");
  });

  test("does not delay authoritative input while visual frames catch up", () => {
    jest.useFakeTimers();
    const states = [];
    const queue = new BattlefieldPlaybackQueue({
      onPresent: () => {},
      onStateChange: (state) => states.push(state)
    });
    queue.push(updateFor([]));
    queue.push(updateFor([
      { id: "payment", type: "payment.discarded" },
      { id: "attack", type: "attack.declared" }
    ], { revision: 3 }));

    expect(states.at(-1)).toMatchObject({ catchingUp: true, inputLocked: false });
    jest.advanceTimersByTime(BATTLEFIELD_EVENT_PACING["payment.discarded"]);
    expect(states.at(-1)).toMatchObject({ catchingUp: true, inputLocked: false });

    queue.dispose();
    jest.useRealTimers();
  });
});
