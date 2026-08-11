import { createReplayMatchAdapter, MIN_REPLAY_ACTION_INTERVAL_MS } from "./ReplayMatchAdapter";

function snapshot({ turn, phase = "priority", priority = 1, life = 20, winner = null, attack = null }) {
  return {
    matchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    gameMode: "factions",
    rulesVersion: "test-rules",
    revision: turn,
    phase,
    turn,
    priority,
    priorityPassed: { 1: false, 2: false },
    players: {
      1: { accountName: "Alpha", life: 20, faction: { id: "rumin", name: "Rumin" }, hand: [], deck: [], discard: [], handCount: 4, deckCount: 40, discardCount: 0 },
      2: { accountName: "Beta", life, faction: { id: "sheen", name: "Sheen" }, hand: [], deck: [], discard: [], handCount: 5, deckCount: 39, discardCount: 0 }
    },
    lanes: [0, 1, 2].map(() => ({ facedown: { 1: null, 2: null }, attack: null, block: [] })),
    handAttacks: attack ? [attack] : [],
    winner,
    loser: winner === 1 ? 2 : null,
    message: phase === "gameOver" ? "Player 1 wins." : `Turn ${turn}`,
    lastEvents: []
  };
}

function replayFixture() {
  const attack = { id: "attack-1", player: 1, targetPlayer: 2, effectiveValue: 12, card: { id: "public-attacker", value: 12, suit: "â™ " }, block: [] };
  return {
    schemaVersion: "gauntlet.public-replay-timeline.v1",
    matchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    availability: { available: true, mode: "public-state-frames", visualCoverage: "exact-authoritative-command-results" },
    participants: [
      { playerNum: 1, displayName: "Alpha", faction: { name: "Rumin" } },
      { playerNum: 2, displayName: "Beta", faction: { name: "Sheen" } }
    ],
    frames: [
      { frameIndex: 1, publicStateChecksum: "one", publicState: snapshot({ turn: 1 }) },
      { frameIndex: 2, publicStateChecksum: "two", publicState: snapshot({ turn: 1, attack }) },
      { frameIndex: 3, publicStateChecksum: "three", publicState: snapshot({ turn: 2, life: 8 }) },
      { frameIndex: 4, publicStateChecksum: "four", publicState: snapshot({ turn: 3, phase: "gameOver", priority: null, life: 0, winner: 1 }) }
    ],
    steps: [
      { index: 0, evidenceSequence: 1, evidenceId: "start", eventType: "match.started", turn: 1, phase: "priority", label: "Match started", frameIndex: 1, publicPayload: {} },
      { index: 1, evidenceSequence: 2, evidenceId: "attack", eventType: "attack.declared", turn: 1, phase: "priority", label: "Attack declared", frameIndex: 2, publicPayload: { effectiveValue: 12 } },
      { index: 2, evidenceSequence: 3, evidenceId: "damage", eventType: "damage.dealt", turn: 2, phase: "priority", label: "12 damage", frameIndex: 3, publicPayload: { amount: 12 } },
      { index: 3, evidenceSequence: 4, evidenceId: "end", eventType: "match.ended", turn: 3, phase: "gameOver", label: "Player 1 wins", frameIndex: 4, publicPayload: { winner: 1 } }
    ],
    notableMoments: [{ id: "match-ending", label: "Match ending", evidenceSequence: 4 }]
  };
}

test("replay adapter is spectator-only, read-only, and steps deterministically", async () => {
  const adapter = createReplayMatchAdapter({ replay: replayFixture() });
  await adapter.connect();
  let update = adapter.createUpdate();
  expect(update.source).toBe("replay");
  expect(update.presentation).toEqual({
    renderer: "babylon-shared",
    motionContract: "gauntlet.card-motion.collision-safe.v1"
  });
  expect(update.viewModel.perspective.spectator).toBe(true);
  expect(update.commands).toEqual({});
  expect(update.legalActions).toEqual([]);
  expect(update.viewModel.players[2].life).toBe(20);

  update.replayControls.next();
  update = adapter.createUpdate();
  expect(update.replay.currentIndex).toBe(1);
  expect(update.viewModel.handAttacks[0].card.raw.id).toBe("public-attacker");

  update.replayControls.jumpToEvidence(4);
  update = adapter.createUpdate();
  expect(update.viewModel.phase).toBe("gameOver");
  expect(update.viewModel.winner).toBe(1);

  update.replayControls.restart();
  update = adapter.createUpdate();
  expect(update.replay.currentIndex).toBe(0);
  expect(update.viewModel.players[2].life).toBe(20);
  adapter.dispose();
});

test("replay adapter auto-play and speed use evidence order rather than timestamps", () => {
  jest.useFakeTimers();
  const adapter = createReplayMatchAdapter({ replay: replayFixture(), playbackIntervalMs: 1000 });
  adapter.replayControls.setSpeed(2);
  adapter.replayControls.play();
  jest.advanceTimersByTime(MIN_REPLAY_ACTION_INTERVAL_MS - 1);
  expect(adapter.createUpdate().replay.currentIndex).toBe(0);
  jest.advanceTimersByTime(1);
  expect(adapter.createUpdate().replay.currentIndex).toBe(1);
  jest.advanceTimersByTime(MIN_REPLAY_ACTION_INTERVAL_MS * 2);
  expect(adapter.createUpdate().replay.currentIndex).toBe(3);
  expect(adapter.createUpdate().replay.playing).toBe(false);
  adapter.dispose();
  jest.useRealTimers();
});

test("semantic actions, not their component evidence rows, are the playback unit", () => {
  const replay = replayFixture();
  replay.actions = [{
    id: "attack-action",
    kind: "attack",
    label: "Alpha attacks",
    summary: "Alpha attacks with Triumphal Ram for 12",
    turn: 1,
    phase: "priority",
    evidenceSequenceStart: 1,
    evidenceSequenceEnd: 3,
    frameAfterIndex: 2,
    durationMs: 2200,
    cards: { primary: { runtimeId: "public-attacker", name: "Triumphal Ram", value: 8 }, payments: [], blockers: [], attachments: [] },
    values: { attack: 12 },
    primaryEvent: { id: "attack", sequence: 2, type: "attack.declared", player: 1, effectiveValue: 12 },
    evidence: replay.steps.slice(0, 3)
  }, {
    id: "result-action",
    kind: "result",
    label: "Match complete",
    summary: "Alpha wins",
    turn: 3,
    phase: "gameOver",
    evidenceSequenceStart: 4,
    evidenceSequenceEnd: 4,
    frameAfterIndex: 4,
    durationMs: 2800,
    cards: { primary: null, payments: [], blockers: [], attachments: [] },
    values: {},
    primaryEvent: { id: "end", sequence: 4, type: "match.ended", winner: 1 },
    evidence: [replay.steps[3]]
  }];
  const adapter = createReplayMatchAdapter({ replay });
  expect(adapter.createUpdate().replay.totalActions).toBe(2);
  adapter.replayControls.jumpToEvidence(3);
  expect(adapter.createUpdate().replay.currentIndex).toBe(0);
  adapter.replayControls.next();
  expect(adapter.createUpdate().replay.action.summary).toBe("Alpha wins");
  adapter.dispose();
});

test("manual replay traversal emits one coherent frame per command", () => {
  const adapter = createReplayMatchAdapter({ replay: replayFixture() });
  const listener = jest.fn();
  const unsubscribe = adapter.subscribe(listener);
  listener.mockClear();

  adapter.replayControls.next();
  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener.mock.calls[0][0].replay).toMatchObject({ currentIndex: 1, transitionMode: "animate" });

  listener.mockClear();
  adapter.replayControls.previous();
  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener.mock.calls[0][0].replay).toMatchObject({ currentIndex: 0, transitionMode: "reconcile" });

  listener.mockClear();
  adapter.replayControls.jump(3);
  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener.mock.calls[0][0].replay.currentIndex).toBe(3);

  unsubscribe();
  adapter.dispose();
});
