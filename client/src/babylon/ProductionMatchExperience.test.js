import { act, fireEvent, render, screen, within } from "@testing-library/react";
import ProductionMatchExperience, { eventCalloutContent } from "./ProductionMatchExperience";
import {
  BATTLEFIELD_EVENT_PACING,
  createBattlefieldPlaybackFrames
} from "./battlefieldPlayback";
import { PRESENTATION_BEAT_RECIPES } from "./presentationCadence";

jest.mock("./GauntletMatchCanvas", () => function MockCanvas({ viewModel, commands, onSceneMetrics }) {
  return (
    <div data-testid="mock-gauntlet-canvas">
      {viewModel.instruction}
      <span data-testid="mock-canvas-cadence-tier">
        {viewModel.presentationCues?.[0]?.cadence?.tier || "rest"}
      </span>
      <button
        type="button"
        data-testid="mock-report-combat-focus"
        onClick={() => onSceneMetrics?.({
          sceneContract: "gauntlet.test-scene.v1",
          boardPresentation: { focus: { region: "combat", tier: 3 } }
        })}
      >
        Report combat focus
      </button>
      <button
        type="button"
        data-testid="mock-preview-card"
        onMouseEnter={() => commands.previewCard?.({
          label: "Seven of Hearts",
          value: 7,
          stateLabel: "Attacking in Lane 1",
          stateIcon: "attack"
        })}
        onMouseLeave={() => commands.previewCard?.(null)}
      >
        Preview card
      </button>
      <button type="button" data-match-zone="hand">Mock card one</button>
      <button type="button" data-match-zone="hand">Mock card two</button>
      <button type="button" data-match-zone="lanes">Mock lane one</button>
    </div>
  );
});

function createViewModel() {
  return {
    revision: 4,
    rulesVersion: "test-rules",
    phase: "priority",
    phaseLabel: "Priority",
    currentTurnLabel: "Turn 3",
    instruction: "Choose an action.",
    top: { id: 2, name: "Opponent", life: 27, factionId: "rumin", factionName: "Basic Gauntlet", handCount: 5 },
    bottom: { id: 1, name: "Local", life: 34, factionId: "rumin", factionName: "Basic Gauntlet", handCount: 8 },
    priority: 1,
    perspective: { player: 1, spectator: false },
    interactions: {
      passLabel: "Pass Priority",
      confirmLabel: "Confirm",
      confirmDisabled: true,
      confirmReason: "",
      abilities: [],
      legalLanes: [],
      handInteractionEnabled: true
    },
    selection: {
      attackMode: null,
      blockMode: null,
      placementMode: null,
      abilityMode: null
    },
    hand: [],
    events: []
  };
}

function adapterFor(overrides = {}) {
  const update = {
    source: "local",
    connected: true,
    viewModel: createViewModel(),
    commands: {},
    privacy: { required: false, player: 1 },
    ...overrides
  };
  return {
    connect: jest.fn(() => Promise.resolve()),
    subscribe: jest.fn((listener) => {
      listener(update);
      return () => {};
    })
  };
}

test("renders the player-facing HUD from an adapter without developer chrome", async () => {
  render(<ProductionMatchExperience adapter={adapterFor()} options={{ audioEnabled: false }} />);

  expect(await screen.findByTestId("production-babylon-match")).toHaveAttribute("data-revision", "4");
  expect(screen.getByTestId("production-babylon-match")).toHaveAttribute("data-presentation-kit", "gauntlet-core-v1");
  expect(screen.getByTestId("production-babylon-match")).toHaveAttribute("data-presentation-status", "provisional");
  expect(screen.getByTestId("battlefield-safe-frame")).toContainElement(
    screen.getByTestId("mock-gauntlet-canvas")
  );
  expect(screen.getByLabelText(/Local, 34 life, has priority/)).toBeInTheDocument();
  expect(screen.getByLabelText(/Opponent, 27 life/)).toBeInTheDocument();
  expect(screen.getAllByText("Choose an action.")).toHaveLength(2);
  expect(screen.getAllByText("G", { exact: true })).toHaveLength(2);
  expect(screen.queryByText("Developer tools")).not.toBeInTheDocument();
});

test("preserves the scene but disables commands while disconnected", async () => {
  render(
    <ProductionMatchExperience
      adapter={adapterFor({ connected: false })}
      options={{ audioEnabled: false }}
    />
  );

  expect((await screen.findAllByText(/Connection interrupted/)).length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: "Pass Priority" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
});

test("uses a privacy curtain for local perspective handoff", async () => {
  const reveal = jest.fn();
  render(
    <ProductionMatchExperience
      adapter={adapterFor({
        privacy: { required: true, player: 2, reveal }
      })}
      options={{ audioEnabled: false }}
    />
  );

  const revealButton = await screen.findByRole("button", { name: "Reveal my hand" });
  fireEvent.click(revealButton);
  expect(reveal).toHaveBeenCalledTimes(1);
});

test("shows the reason a staged action cannot yet be confirmed", async () => {
  const viewModel = createViewModel();
  viewModel.selection.attackMode = { from: "hand" };
  viewModel.interactions.confirmReason = "Select 2 more payment value.";

  render(
    <ProductionMatchExperience
      adapter={adapterFor({ viewModel })}
      options={{ audioEnabled: false }}
    />
  );

  expect(await screen.findByText("Select 2 more payment value.")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Pass Priority" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
});

test("keeps the post-match flow inside the production experience", async () => {
  const newMatch = jest.fn();
  const onContinueJourney = jest.fn();
  const viewModel = createViewModel();
  viewModel.phase = "gameOver";
  viewModel.winner = 1;
  viewModel.message = "Local wins.";

  render(
    <ProductionMatchExperience
      adapter={adapterFor({ viewModel, commands: { newMatch } })}
      options={{ audioEnabled: false }}
      onContinueJourney={onContinueJourney}
    />
  );

  fireEvent.click(await screen.findByRole("button", { name: "Start New Match" }));
  expect(newMatch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Continue Journey" }));
  expect(onContinueJourney).toHaveBeenCalledTimes(1);
});

test("presents transport notices in a ticker without replacing action guidance", async () => {
  const viewModel = {
    ...createViewModel(),
    statusNotice: "Match restored from the latest authoritative snapshot."
  };
  render(
    <ProductionMatchExperience
      adapter={adapterFor({ viewModel })}
      options={{ audioEnabled: false }}
    />
  );

  expect(await screen.findByText(/Match restored/)).toBeInTheDocument();
  expect(screen.getAllByText("Choose an action.")).toHaveLength(2);
});

test("coalesces payment with attack, then presents the next combat beat and feed history", async () => {
  jest.useFakeTimers();
  let publish;
  const initialUpdate = {
    source: "local",
    connected: true,
    viewModel: createViewModel(),
    commands: {},
    privacy: { required: false, player: 1 }
  };
  const adapter = {
    connect: jest.fn(() => Promise.resolve()),
    subscribe: jest.fn((listener) => {
      publish = listener;
      listener(initialUpdate);
      return () => {};
    })
  };
  render(<ProductionMatchExperience adapter={adapter} options={{ audioEnabled: false }} />);
  const match = await screen.findByTestId("production-babylon-match");
  expect(match).toHaveAttribute("data-playback-catching-up", "false");
  expect(match).toHaveAttribute("data-playback-queued-frames", "0");

  const events = [
    { id: "payment-queued", type: "payment.discarded" },
    { id: "attack-queued", type: "attack.declared", laneIndex: 0 },
    { id: "block-queued", type: "block.declared", laneIndex: 0 }
  ];
  const queuedUpdate = {
    ...initialUpdate,
    revision: 5,
    events,
    viewModel: { ...createViewModel(), revision: 5, events }
  };
  const [attackFrame] = createBattlefieldPlaybackFrames(queuedUpdate, new Set(), {
    baseUpdate: initialUpdate
  });
  act(() => publish(queuedUpdate));

  expect(match).toHaveAttribute("data-playback-catching-up", "true");
  expect(match).toHaveAttribute("data-active-event-id", attackFrame.event.id);
  expect(screen.getByText("Lane 1 attack committed")).toBeVisible();
  act(() => jest.advanceTimersByTime(attackFrame.durationMs));
  expect(screen.getByText("Lane 1 block committed")).toBeVisible();

  fireEvent.click(screen.getByLabelText("Show 1 recent match events"));
  expect(screen.getByText("Lane 1 attack committed")).toBeVisible();
  act(() => jest.runOnlyPendingTimers());
  expect(match).toHaveAttribute("data-active-event-id", "");
  expect(match).toHaveAttribute("data-playback-catching-up", "false");
  expect(match).toHaveAttribute("data-playback-queued-frames", "0");
  jest.useRealTimers();
});

test("keeps spectator guidance neutral while presentation playback resolves", async () => {
  jest.useFakeTimers();
  let publish;
  const spectatorViewModel = {
    ...createViewModel(),
    instruction: "Player 1 has priority.",
    perspective: { player: null, spectator: true }
  };
  const initialUpdate = {
    source: "live",
    connected: true,
    viewModel: spectatorViewModel,
    commands: {},
    privacy: { required: false, player: null }
  };
  const adapter = {
    connect: jest.fn(() => Promise.resolve()),
    subscribe: jest.fn((listener) => {
      publish = listener;
      listener(initialUpdate);
      return () => {};
    })
  };

  render(<ProductionMatchExperience adapter={adapter} options={{ audioEnabled: false }} />);
  await screen.findByTestId("production-babylon-match");
  const spectatorPanel = screen.getByText("Spectator view").closest("section");
  expect(within(spectatorPanel).getByText("Player 1 has priority.")).toBeVisible();

  const damageEvent = {
    id: "spectator-damage-5",
    type: "damage.calculated",
    attackId: "attack-5",
    damage: 8
  };
  act(() => publish({
    ...initialUpdate,
    revision: 5,
    events: [damageEvent],
    viewModel: {
      ...spectatorViewModel,
      revision: 5,
      instruction: "Player 2 has priority.",
      events: [damageEvent]
    }
  }));

  expect(within(spectatorPanel).getByText("Watching the current action resolve.")).toBeVisible();
  expect(within(spectatorPanel).queryByText(/Player null/)).not.toBeInTheDocument();
  act(() => jest.runAllTimers());
  expect(within(spectatorPanel).getByText("Player 2 has priority.")).toBeVisible();
  jest.useRealTimers();
});

test("holds the result modal until the terminal cadence reaches final reconcile", async () => {
  jest.useFakeTimers();
  let publish;
  const initialUpdate = {
    source: "local",
    connected: true,
    viewModel: createViewModel(),
    commands: {},
    privacy: { required: false, player: 1 }
  };
  const adapter = {
    connect: jest.fn(() => Promise.resolve()),
    subscribe: jest.fn((listener) => {
      publish = listener;
      listener(initialUpdate);
      return () => {};
    })
  };

  render(<ProductionMatchExperience adapter={adapter} options={{ audioEnabled: false }} />);
  const match = await screen.findByTestId("production-babylon-match");
  const terminalEvent = { id: "match-ended-5", type: "match.ended", winner: 1 };
  const terminalViewModel = {
    ...createViewModel(),
    revision: 5,
    phase: "gameOver",
    phaseLabel: "Match Complete",
    winner: 1,
    message: "Local wins.",
    events: [terminalEvent]
  };

  act(() => publish({
    ...initialUpdate,
    revision: 5,
    events: [terminalEvent],
    viewModel: terminalViewModel
  }));

  expect(match).toHaveClass("is-resolving");
  expect(screen.queryByRole("heading", { name: "Victory" })).not.toBeInTheDocument();
  act(() => jest.runOnlyPendingTimers());
  expect(screen.getByRole("heading", { name: "Victory" })).toBeVisible();
  expect(match).not.toHaveClass("is-resolving");

  jest.useRealTimers();
});

test("keeps the HUD projection on the presented combat beat while commands stay authoritative", async () => {
  jest.useFakeTimers();
  let publish;
  const oldPassPriority = jest.fn();
  const newPassPriority = jest.fn();
  const initialViewModel = {
    ...createViewModel(),
    turn: 3,
    players: {
      1: { ...createViewModel().bottom },
      2: { ...createViewModel().top }
    }
  };
  const initialUpdate = {
    source: "local",
    connected: true,
    viewModel: initialViewModel,
    broadcast: {
      label: "Arena cast",
      season: "Qualifier",
      spectatorCount: 12,
      matchId: "match-1"
    },
    commands: { passPriority: oldPassPriority },
    privacy: { required: false, player: 1 }
  };
  const adapter = {
    connect: jest.fn(() => Promise.resolve()),
    subscribe: jest.fn((listener) => {
      publish = listener;
      listener(initialUpdate);
      return () => {};
    })
  };

  render(<ProductionMatchExperience adapter={adapter} options={{ audioEnabled: false }} />);
  await screen.findByTestId("production-babylon-match");
  const resolutionEvents = [
    { id: "block-payment-5", type: "payment.discarded", player: 1, cardIds: ["payment-1"] },
    { id: "block-5", type: "block.declared", player: 1, laneIndex: 0, cardIds: ["blocker-1"] },
    { id: "damage-5", type: "damage.calculated", attacker: 2, laneIndex: 0, damage: 4 },
    { id: "priority-5", type: "priority.granted", player: 2 }
  ];
  const resolvedViewModel = {
    ...createViewModel(),
    revision: 5,
    currentTurnLabel: "Turn 4",
    phaseLabel: "Response Complete",
    turn: 4,
    priority: 2,
    top: { ...createViewModel().top, life: 23 },
    players: {
      1: { ...createViewModel().bottom },
      2: { ...createViewModel().top, life: 23 }
    },
    interactions: { ...createViewModel().interactions, passLabel: "Yield New Priority" },
    events: resolutionEvents
  };

  const resolvedUpdate = {
    ...initialUpdate,
    revision: 5,
    events: resolutionEvents,
    viewModel: resolvedViewModel,
    broadcast: {
      label: "Arena cast",
      season: "Final",
      spectatorCount: 31,
      matchId: "match-1"
    },
    commands: { passPriority: newPassPriority }
  };
  const [blockFrame, damageAnticipationFrame] = createBattlefieldPlaybackFrames(resolvedUpdate, new Set(), {
    baseUpdate: initialUpdate
  });
  act(() => publish(resolvedUpdate));

  expect(screen.getByLabelText("Turn 3, Priority")).toBeVisible();
  expect(screen.getByLabelText(/Opponent, 27 life/)).toBeInTheDocument();
  const broadcast = screen.getByLabelText("Arena cast match information");
  expect(within(broadcast).getByText("Qualifier")).toBeVisible();
  expect(within(broadcast).getByText("Turn 3")).toBeVisible();
  expect(within(broadcast).getByText("12 watching")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Yield New Priority" }));
  expect(newPassPriority).toHaveBeenCalledTimes(1);
  expect(oldPassPriority).not.toHaveBeenCalled();

  act(() => jest.advanceTimersByTime(blockFrame.durationMs + damageAnticipationFrame.durationMs));
  expect(screen.getByLabelText("Turn 4, Response Complete")).toBeVisible();
  expect(screen.getByLabelText(/Opponent, 23 life, has priority/)).toBeInTheDocument();
  expect(within(broadcast).getByText("Final")).toBeVisible();
  expect(within(broadcast).getByText("Turn 4")).toBeVisible();
  expect(within(broadcast).getByText("31 watching")).toBeVisible();

  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

test("exposes quiescent and active feed states plus cadence and scene focus metadata", async () => {
  jest.useFakeTimers();
  let publish;
  const initialViewModel = {
    ...createViewModel(),
    presentationCues: [{ cadence: { tier: "attention" } }]
  };
  const initialUpdate = {
    source: "local",
    connected: true,
    viewModel: initialViewModel,
    presentation: { cues: initialViewModel.presentationCues },
    commands: {},
    privacy: { required: false, player: 1 }
  };
  const adapter = {
    connect: jest.fn(() => Promise.resolve()),
    subscribe: jest.fn((listener) => {
      publish = listener;
      listener(initialUpdate);
      return () => {};
    })
  };

  render(<ProductionMatchExperience adapter={adapter} options={{ audioEnabled: false }} />);
  const match = await screen.findByTestId("production-babylon-match");
  const feed = screen.getByLabelText("Live match feed");
  expect(feed).toHaveClass("is-quiescent");
  expect(match).toHaveAttribute("data-cadence-tier", "attention");
  expect(match).toHaveAttribute("data-focus-region", "board");
  fireEvent.click(screen.getByTestId("mock-report-combat-focus"));
  expect(match).toHaveAttribute("data-focus-region", "combat");

  const attackEvent = { id: "attack-active-5", type: "attack.declared", player: 1, laneIndex: 0 };
  act(() => publish({
    ...initialUpdate,
    revision: 5,
    events: [attackEvent],
    viewModel: { ...createViewModel(), revision: 5, events: [attackEvent] }
  }));
  expect(feed).toHaveClass("is-active");
  expect(screen.getByTestId("mock-canvas-cadence-tier")).toHaveTextContent("commitment");

  act(() => jest.runOnlyPendingTimers());
  expect(feed).toHaveClass("is-quiescent");
  jest.useRealTimers();
});

test("uses the App-owned completion and waits for account refresh before continuing campaign", async () => {
  const onContinueCampaign = jest.fn();
  const viewModel = createViewModel();
  viewModel.phase = "gameOver";
  viewModel.winner = 1;
  viewModel.message = "Local wins.";
  const adapter = adapterFor({
    viewModel,
    snapshot: { campaign: { factionId: "rumin", chapterId: "brothers-of-destiny" } }
  });
  const completion = {
    matchId: "match-1",
    result: { playerNum: 1, outcome: "win", winnerPlayerNum: 1 },
    campaign: {
      factionId: "rumin",
      chapterId: "brothers-of-destiny",
      firstClear: true,
      nextMission: { status: "available", factionId: "rumin", chapterId: "the-republic", title: "The Republic" }
    },
    rewards: { boosterCreditDelta: 1 }
  };
  const rendered = render(
    <ProductionMatchExperience
      adapter={adapter}
      completion={completion}
      campaignContinuationReady={false}
      onContinueCampaign={onContinueCampaign}
      options={{ audioEnabled: false }}
    />
  );

  const continueButton = await screen.findByRole("button", { name: "Next Mission: The Republic" });
  expect(continueButton).toBeDisabled();
  rendered.rerender(
    <ProductionMatchExperience
      adapter={adapter}
      completion={completion}
      campaignContinuationReady
      onContinueCampaign={onContinueCampaign}
      options={{ audioEnabled: false }}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Next Mission: The Republic" }));
  expect(onContinueCampaign).toHaveBeenCalledWith("rumin", "the-republic");
});

test("does not fetch completion independently or offer continuation after defeat", async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn();
  const viewModel = createViewModel();
  viewModel.phase = "gameOver";
  viewModel.winner = 2;
  viewModel.message = "Opponent wins.";
  try {
    render(
      <ProductionMatchExperience
        adapter={adapterFor({
          viewModel,
          snapshot: { campaign: { factionId: "rumin", chapterId: "brothers-of-destiny" } }
        })}
        completion={{
          result: { playerNum: 1, outcome: "loss", winnerPlayerNum: 2 },
          campaign: {
            factionId: "rumin",
            nextMission: { status: "available", chapterId: "the-republic", title: "The Republic" }
          },
          rewards: { boosterCreditDelta: 0 }
        }}
        onContinueCampaign={jest.fn()}
        options={{ audioEnabled: false }}
      />
    );

    expect(await screen.findByRole("heading", { name: "Defeat" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Next Mission:/ })).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  } finally {
    global.fetch = originalFetch;
  }
});

test("presents campaign identity and canonical boss ability inside the production shell", async () => {
  render(
    <ProductionMatchExperience
      adapter={adapterFor({
        descriptor: {
          ruleset: "factions",
          deckFormat: "campaign",
          opponentKind: "campaignBoss",
          series: { kind: "single", gameNumber: 1, playerWins: { 1: 0, 2: 0 } }
        },
        snapshot: {
          campaign: {
            chapterId: "chapter-one",
            title: "The First Gate",
            opponentName: "Remex",
            beforeBattle: "The bronze gate closes behind you.",
            dialogue: ["Remex: Hold the line."],
            bossAbility: {
              name: "Remex: Fortified Claim",
              text: "The boss's first scripted attack each turn gets +1 value."
            }
          }
        }
      })}
      options={{ audioEnabled: false }}
    />
  );

  const encounter = await screen.findByText("Remex: Fortified Claim");
  encounter.closest("details").open = true;
  expect(screen.getByRole("heading", { name: "The First Gate" })).toBeVisible();
  expect(screen.getByText(/first scripted attack each turn gets \+1 value/i)).toBeVisible();
  expect(screen.getAllByText("Remex").length).toBeGreaterThan(0);
  expect(screen.getByText("Hold the line.")).toBeVisible();
});

test("plays and stops campaign opening dialogue from the production shell", async () => {
  const originalAudio = window.Audio;
  const clip = {
    play: jest.fn(() => Promise.resolve()),
    pause: jest.fn(),
    currentTime: 0,
    onended: null,
    onerror: null,
    volume: 0
  };
  window.Audio = jest.fn(() => clip);

  try {
    render(
      <ProductionMatchExperience
        adapter={adapterFor({
          descriptor: {
            ruleset: "factions",
            deckFormat: "campaign",
            opponentKind: "campaignBoss",
            series: { kind: "single", gameNumber: 1, playerWins: { 1: 0, 2: 0 } }
          },
          snapshot: {
            campaign: {
              chapterId: "chapter-one",
              title: "The First Gate",
              opponentName: "Remex",
              startDialogue: ["Narrator: The gate closes.", "Remex: Hold the line."],
              startDialogueAudio: ["/voices/narrator.mp3", "/voices/remex.mp3"]
            }
          }
        })}
        options={{ audioEnabled: true }}
      />
    );

    await screen.findByTestId("production-babylon-match");
    document.querySelector(".production-campaign-encounter").open = true;
    fireEvent.click(screen.getByRole("button", { name: "Play dialogue" }));
    expect(window.Audio).toHaveBeenCalledWith("/voices/narrator.mp3");
    expect(clip.play).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Playing Narrator.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(clip.pause).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Playback stopped.")).toBeVisible();
  } finally {
    window.Audio = originalAudio;
  }
});

test("keeps campaign aftermath and ending voice playback in the match result", async () => {
  const originalAudio = window.Audio;
  const clip = {
    play: jest.fn(() => Promise.resolve()),
    pause: jest.fn(),
    currentTime: 0,
    onended: null,
    onerror: null,
    volume: 0
  };
  window.Audio = jest.fn(() => clip);
  const viewModel = createViewModel();
  viewModel.phase = "gameOver";
  viewModel.winner = 1;
  viewModel.message = "Local wins.";

  try {
    render(
      <ProductionMatchExperience
        adapter={adapterFor({
          viewModel,
          snapshot: {
            campaign: {
              afterBattle: "The gate opens again.",
              endDialogue: ["Remex: You have earned passage."],
              endDialogueAudio: ["/voices/remex-ending.mp3"]
            }
          }
        })}
        options={{ audioEnabled: true }}
      />
    );

    expect(await screen.findByText("The gate opens again.")).toBeVisible();
    expect(screen.getByLabelText("Ending dialogue")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Play Remex voice" }));
    expect(window.Audio).toHaveBeenCalledWith("/voices/remex-ending.mp3");
    expect(clip.play).toHaveBeenCalledTimes(1);
  } finally {
    window.Audio = originalAudio;
  }
});

test("surfaces draft format and best-of-three continuity without developer chrome", async () => {
  render(
    <ProductionMatchExperience
      adapter={adapterFor({
        descriptor: {
          ruleset: "factions",
          deckFormat: "draft",
          opponentKind: "human",
          series: { kind: "bestOf3", gameNumber: 2, playerWins: { 1: 1, 2: 0 } }
        }
      })}
      options={{ audioEnabled: false }}
    />
  );

  const match = await screen.findByTestId("production-babylon-match");
  expect(match).toHaveAttribute("data-deck-format", "draft");
  expect(screen.getByText("Draft-deck match")).toBeVisible();
  expect(screen.getByText("Game 2 · 1–0")).toBeVisible();
  expect(screen.queryByText("Developer tools")).not.toBeInTheDocument();
});

test("supports arrow, Home, and End navigation within an accessible match zone", async () => {
  render(<ProductionMatchExperience adapter={adapterFor()} options={{ audioEnabled: false }} />);
  const first = await screen.findByRole("button", { name: "Mock card one" });
  const second = screen.getByRole("button", { name: "Mock card two" });

  first.focus();
  fireEvent.keyDown(first, { key: "ArrowRight" });
  expect(second).toHaveFocus();
  fireEvent.keyDown(second, { key: "Home" });
  expect(first).toHaveFocus();
  fireEvent.keyDown(first, { key: "End" });
  expect(second).toHaveFocus();
});

test("exposes confirmed concession for the complete local simulator lifecycle", async () => {
  const concede = jest.fn();
  render(
    <ProductionMatchExperience
      adapter={adapterFor({
        controls: { canConcede: true },
        commands: { concede }
      })}
      options={{ audioEnabled: false }}
    />
  );

  fireEvent.click(await screen.findByText("Match"));
  fireEvent.click(screen.getByRole("button", { name: "Concede" }));
  expect(screen.getByRole("group", { name: "Confirm concession" })).toBeVisible();
  fireEvent.click(screen.getByRole("group", { name: "Confirm concession" }).querySelector(".danger"));

  expect(concede).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "Main menu" })).not.toBeInTheDocument();
});

test("keeps live undo, draw, concession, and navigation controls around the Babylon engine", async () => {
  const respondUndo = jest.fn();
  const respondDraw = jest.fn();
  const concede = jest.fn();
  const leaveMatch = jest.fn();
  render(
    <ProductionMatchExperience
      adapter={adapterFor({
        source: "live",
        controls: {
          roomCode: "ABC123",
          undoRequest: { approvalsNeeded: [1], label: "declared an attack" },
          drawOfferBy: 2,
          canRequestUndo: true,
          canOfferDraw: true,
          canConcede: true
        },
        commands: { respondUndo, respondDraw, concede, leaveMatch }
      })}
      options={{ audioEnabled: false }}
    />
  );

  fireEvent.click(await screen.findByText("Match"));
  expect(screen.getByText("Room ABC123")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Approve" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Decline" })[1]);
  fireEvent.click(screen.getByRole("button", { name: "Concede" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Confirm" }).find((button) => !button.disabled));
  fireEvent.click(screen.getByRole("button", { name: "Main menu" }));

  expect(respondUndo).toHaveBeenCalledWith(true);
  expect(respondDraw).toHaveBeenCalledWith(false);
  expect(concede).toHaveBeenCalledTimes(1);
  expect(leaveMatch).toHaveBeenCalledTimes(1);
});

test("keeps discard, match log, keyboard help, faction abilities, and sound in the production shell", async () => {
  const inspectCard = jest.fn();
  const activateAbility = jest.fn();
  const onAudioEnabledChange = jest.fn();
  const viewModel = createViewModel();
  viewModel.interactions.abilities = [
    {
      id: "polea-place",
      label: "Polea: place a hand card",
      available: true,
      active: false,
      intent: "Choose a hand card, then an empty lane."
    },
    {
      id: "focus-boost",
      label: "Focus: spend acceleration",
      available: false,
      active: false,
      reason: "No acceleration counter is available."
    }
  ];
  render(
    <ProductionMatchExperience
      adapter={adapterFor({
        viewModel,
        descriptor: {
          ruleset: "factions",
          deckFormat: "constructed",
          opponentKind: "human",
          series: { kind: "single", gameNumber: 1, playerWins: { 1: 0, 2: 0 } }
        },
        snapshot: {
          players: {
            1: {
              accountName: "Local",
              faction: {
                name: "Rumin",
                commander: { name: "Kaiser", text: "Your fourth attack gets +3 value." },
                general: "Meerus",
                city: "Rumie"
              },
              discard: [{ id: "discard-one", name: "Seven of Hearts", value: 7, rank: "7", suit: "Hearts" }]
            },
            2: {
              accountName: "Opponent",
              faction: { name: "Sheen", commander: "Emperor Nu", general: "Tang", city: "Beli" },
              discard: []
            }
          },
          actionHistory: [{ id: "history-one", turn: 2, label: "Player 1 declared a lane attack." }]
        },
        controls: { canConcede: true },
        commands: { inspectCard, activateAbility }
      })}
      options={{ audioEnabled: true, onAudioEnabledChange }}
    />
  );

  fireEvent.click(await screen.findByText("Match"));
  fireEvent.click(screen.getByRole("button", { name: "Discard piles" }));
  expect(screen.getByRole("dialog", { name: "Discard piles" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /Seven of Hearts/ }));
  expect(inspectCard).toHaveBeenCalledWith(expect.objectContaining({ id: "discard-one" }));
  fireEvent.click(screen.getByRole("button", { name: "Close" }));

  fireEvent.click(screen.getByRole("button", { name: "Match log" }));
  expect(screen.getByText("Player 1 declared a lane attack.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getByRole("button", { name: "Faction abilities" }));
  expect(screen.getByRole("dialog", { name: "Faction abilities" })).toBeVisible();
  expect(screen.getByText("Kaiser")).toBeVisible();
  expect(screen.getByText("Your fourth attack gets +3 value.")).toBeVisible();
  const factionDialog = screen.getByRole("dialog", { name: "Faction abilities" });
  expect(within(factionDialog).getByRole("button", { name: /Focus: spend acceleration/ })).toBeDisabled();
  expect(within(factionDialog).getByText("No acceleration counter is available.")).toBeVisible();
  fireEvent.click(within(factionDialog).getByRole("button", { name: /Polea: place a hand card/ }));
  expect(activateAbility).toHaveBeenCalledWith("polea-place");
  expect(screen.queryByRole("dialog", { name: "Faction abilities" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Match"));
  fireEvent.click(screen.getByRole("button", { name: "Keyboard help" }));
  expect(screen.getByText(/Move focus to hand/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getByRole("button", { name: "Mute sound" }));
  expect(onAudioEnabledChange).toHaveBeenCalledWith(false);
});

test("opens keyboard zones without permanent duplicate chrome and exposes the discard shortcut", async () => {
  render(<ProductionMatchExperience adapter={adapterFor()} options={{ audioEnabled: false }} />);

  expect(await screen.findByTestId("production-babylon-match")).toBeVisible();
  fireEvent.keyDown(window, { key: "h" });
  expect(document.activeElement).toHaveAttribute("data-match-zone", "hand");
  fireEvent.keyDown(window, { key: "ArrowRight" });
  expect(document.activeElement).toHaveAttribute("data-match-zone", "hand");

  fireEvent.keyDown(window, { key: "d" });
  expect(screen.getByRole("dialog", { name: "Discard piles" })).toBeVisible();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Discard piles" })).not.toBeInTheDocument();
});

test("shows a nonmodal card-role preview and a persistent combat recap", async () => {
  jest.useFakeTimers();
  let publish;
  const adapter = adapterFor();
  adapter.subscribe = jest.fn((listener) => {
    publish = listener;
    listener({
      source: "local",
      connected: true,
      viewModel: createViewModel(),
      commands: {},
      privacy: { required: false, player: 1 }
    });
    return () => {};
  });
  render(<ProductionMatchExperience adapter={adapter} options={{ audioEnabled: false }} />);

  fireEvent.mouseEnter(await screen.findByTestId("mock-preview-card"));
  expect(screen.getByLabelText("Seven of Hearts preview")).toHaveTextContent("Attacking in Lane 1");
  fireEvent.mouseLeave(screen.getByTestId("mock-preview-card"));
  expect(screen.queryByLabelText("Seven of Hearts preview")).not.toBeInTheDocument();

  act(() => publish({
    source: "local",
    connected: true,
    viewModel: {
      ...createViewModel(),
      events: [
        { id: "attack-1", type: "attack.declared", laneIndex: 0, effectiveValue: 9 },
        { id: "block-1", type: "block.declared", laneIndex: 0, cardIds: ["blocker-1"] },
        { id: "damage-1", type: "damage.calculated", attackValue: 9, blockValue: 3, damage: 6 }
      ]
    },
    commands: {},
    privacy: { required: false, player: 1 }
  }));
  act(() => jest.advanceTimersByTime(
    BATTLEFIELD_EVENT_PACING["attack.declared"]
    + BATTLEFIELD_EVENT_PACING["block.declared"]
    + PRESENTATION_BEAT_RECIPES["damage.impact"].phases.impact
  ));
  const recap = screen.getByRole("status", { name: "Latest combat summary" });
  expect(recap).toHaveTextContent("Lane 1 attack");
  expect(recap).toHaveTextContent("Attack 9");
  expect(recap).toHaveTextContent("Block 3");
  expect(recap).toHaveTextContent("Damage 6");
  expect(recap).toHaveTextContent("6 damage dealt");
  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

test("presents rematch acceptance and decline as explicit post-match actions", async () => {
  const requestRematch = jest.fn();
  const declineRematch = jest.fn();
  const viewModel = createViewModel();
  viewModel.phase = "gameOver";
  viewModel.winner = 2;
  viewModel.message = "Opponent wins.";
  render(
    <ProductionMatchExperience
      adapter={adapterFor({
        viewModel,
        controls: {
          canRematch: true,
          rematchStatus: { requestedBy: 2, message: "Opponent requested a rematch." }
        },
        commands: { requestRematch, declineRematch }
      })}
      options={{ audioEnabled: false }}
    />
  );

  fireEvent.click(await screen.findByRole("button", { name: "Accept Rematch" }));
  fireEvent.click(screen.getByRole("button", { name: "Decline Rematch" }));
  expect(requestRematch).toHaveBeenCalledTimes(1);
  expect(declineRematch).toHaveBeenCalledTimes(1);
});

test("keeps a terminal replay frame visible without the live-player result modal", async () => {
  const viewModel = createViewModel();
  viewModel.phase = "gameOver";
  viewModel.phaseLabel = "Match Complete";
  viewModel.winner = 2;
  viewModel.message = "Player 2 wins!";

  render(
    <ProductionMatchExperience
      adapter={adapterFor({
        source: "replay",
        viewModel,
        controls: null
      })}
      options={{ audioEnabled: false }}
    />
  );

  expect(await screen.findByText("Match Complete")).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Defeat" })).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("ignores a completion outcome for a different player perspective", async () => {
  const viewModel = createViewModel();
  viewModel.phase = "gameOver";
  viewModel.winner = 2;
  viewModel.message = "Player 2 wins.";
  render(
    <ProductionMatchExperience
      adapter={adapterFor({
        viewModel,
        completion: {
          result: { playerNum: 2, outcome: "win", winnerPlayerNum: 2 }
        }
      })}
      options={{ audioEnabled: false }}
    />
  );

  expect(await screen.findByRole("heading", { name: "Defeat" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Victory" })).not.toBeInTheDocument();
});

test("plays accepted event IDs once and disposes its audio context", async () => {
  jest.useFakeTimers();
  const oscillator = {
    connect: jest.fn(),
    frequency: { setValueAtTime: jest.fn() },
    start: jest.fn(),
    stop: jest.fn(),
    type: "sine"
  };
  const gain = {
    connect: jest.fn(),
    gain: {
      setValueAtTime: jest.fn(),
      exponentialRampToValueAtTime: jest.fn()
    }
  };
  const audioContext = {
    currentTime: 0,
    destination: {},
    close: jest.fn(),
    createGain: jest.fn(() => gain),
    createOscillator: jest.fn(() => oscillator),
    resume: jest.fn()
  };
  const originalAudioContext = window.AudioContext;
  window.AudioContext = jest.fn(() => audioContext);
  let publish;
  const initialUpdate = {
    source: "local",
    connected: true,
    viewModel: createViewModel(),
    commands: {},
    privacy: { required: false, player: 1 }
  };
  const adapter = {
    connect: jest.fn(() => Promise.resolve()),
    subscribe: jest.fn((listener) => {
      publish = listener;
      listener(initialUpdate);
      return () => {};
    })
  };

  const rendered = render(
    <ProductionMatchExperience adapter={adapter} options={{ audioEnabled: true }} />
  );
  fireEvent.pointerDown(window);

  const publishEvents = (events) => act(() => publish({
    ...initialUpdate,
    viewModel: { ...initialUpdate.viewModel, events }
  }));
  publishEvents([{ id: "accepted-1", type: "attack.declared" }]);
  expect(audioContext.createOscillator).toHaveBeenCalledTimes(0);
  act(() => jest.advanceTimersByTime(820));
  expect(audioContext.createOscillator).toHaveBeenCalledTimes(1);
  publishEvents([{ id: "accepted-1", type: "attack.declared" }]);
  expect(audioContext.createOscillator).toHaveBeenCalledTimes(1);
  publishEvents([
    { id: "accepted-1", type: "attack.declared" },
    { id: "accepted-2", type: "damage.calculated" }
  ]);
  act(() => jest.advanceTimersByTime(BATTLEFIELD_EVENT_PACING["attack.declared"]));
  act(() => jest.advanceTimersByTime(260));
  expect(audioContext.createOscillator).toHaveBeenCalledTimes(2);

  rendered.unmount();
  expect(audioContext.close).toHaveBeenCalledTimes(1);
  window.AudioContext = originalAudioContext;
  jest.useRealTimers();
});

test("does not initialize event audio while sound is muted", () => {
  const originalAudioContext = window.AudioContext;
  window.AudioContext = jest.fn();
  render(<ProductionMatchExperience adapter={adapterFor()} options={{ audioEnabled: false }} />);
  fireEvent.pointerDown(window);
  expect(window.AudioContext).not.toHaveBeenCalled();
  window.AudioContext = originalAudioContext;
});

test("names hand and lane combat events without implying a fourth lane", () => {
  expect(eventCalloutContent({
    type: "attack.declared",
    laneIndex: null
  })).toEqual(["attack", "Hand attack committed"]);
  expect(eventCalloutContent({
    type: "attack.declared",
    laneIndex: 1
  })).toEqual(["attack", "Lane 2 attack committed"]);
  expect(eventCalloutContent({
    type: "block.declared",
    laneIndex: null
  })).toEqual(["block", "Hand block committed"]);
  expect(eventCalloutContent({
    type: "block.declared",
    laneIndex: 2
  })).toEqual(["block", "Lane 3 block committed"]);
  expect(eventCalloutContent({
    type: "damage.calculated",
    damage: 0
  })).toEqual(["block", "Attack stopped"]);
  expect(eventCalloutContent({
    type: "damage.calculated",
    damage: 8
  })).toEqual(["damage", "Major damage · 8"]);
});
