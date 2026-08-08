import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MatchReplayScreen from "./MatchReplayScreen";

jest.mock("./ProductionMatchExperience", () => function ProductionMatchExperienceMock({ adapter }) {
  const update = adapter.createUpdate();
  return <div data-testid="official-production-renderer">{update.source}:{update.viewModel?.matchId}</div>;
});

function replayResponse() {
  const publicState = {
    matchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    gameMode: "basic",
    rulesVersion: "test",
    revision: 1,
    phase: "priority",
    turn: 1,
    priority: 1,
    priorityPassed: { 1: false, 2: false },
    players: {
      1: { accountName: "Alpha", life: 20, faction: { id: "rumin", name: "Basic" }, hand: [], deck: [], discard: [], handCount: 8, deckCount: 44, discardCount: 0 },
      2: { accountName: "Beta", life: 20, faction: { id: "rumin", name: "Basic" }, hand: [], deck: [], discard: [], handCount: 8, deckCount: 44, discardCount: 0 }
    },
    lanes: [0, 1, 2].map(() => ({ facedown: { 1: null, 2: null }, attack: null, block: [] })),
    handAttacks: [],
    winner: null,
    loser: null,
    message: "Match started",
    lastEvents: []
  };
  return {
    replay: {
      schemaVersion: "gauntlet.public-replay-timeline.v1",
      matchId: publicState.matchId,
      availability: { available: true, mode: "public-state-frames", visualCoverage: "exact-authoritative-command-results" },
      participants: [
        { playerNum: 1, displayName: "Alpha", faction: { id: "rumin", name: "Rumin" } },
        { playerNum: 2, displayName: "Beta", faction: { id: "sheen", name: "Sheen" } }
      ],
      result: { winnerPlayerNum: 1 },
      frames: [{ frameIndex: 1, publicStateChecksum: "checksum", publicState }],
      steps: [{ index: 0, evidenceSequence: 1, evidenceId: "start", eventType: "match.started", turn: 1, phase: "priority", label: "Match started", frameIndex: 1, publicPayload: {} }],
      actions: [{
        id: "attack-action",
        kind: "attack",
        label: "Alpha attacks",
        summary: "Alpha attacks with Triumphal Ram for 12",
        actorName: "Alpha",
        turn: 1,
        phase: "priority",
        evidenceSequenceStart: 1,
        evidenceSequenceEnd: 1,
        frameAfterIndex: 1,
        cards: {
          primary: { runtimeId: "attacker", gameplayCardId: "rumin-triumphal-ram", name: "Triumphal Ram", value: 8, suit: "diamonds", factionId: "rumin", rulesText: "Gain combat value." },
          payments: [{ runtimeId: "payment", name: "Eight of Clubs", rank: "8", value: 8, suit: "clubs", factionId: "rumin" }],
          blockers: [],
          attachments: []
        },
        values: { attack: 12, paymentTotal: 8, paymentRequired: 8 },
        primaryEvent: { id: "attack", sequence: 1, type: "attack.declared", player: 1, effectiveValue: 12 },
        evidence: [{ sequence: 1, eventType: "attack.declared", publicPayload: { effectiveValue: 12 } }]
      }, {
        id: "block-action",
        kind: "block",
        label: "Beta blocks",
        summary: "Beta blocks with Vault Shield Bearer for 6",
        actorName: "Beta",
        turn: 1,
        phase: "priority",
        evidenceSequenceStart: 2,
        evidenceSequenceEnd: 3,
        frameAfterIndex: 1,
        cards: {
          primary: { runtimeId: "blocker", gameplayCardId: "rumin-vault-shield-bearer", name: "Vault Shield Bearer", value: 4, factionId: "rumin" },
          payments: [{ runtimeId: "block-payment", name: "Two of Diamonds", rank: "2", value: 2, suit: "diamonds", factionId: "sheen" }],
          blockers: [{ runtimeId: "blocker", gameplayCardId: "rumin-vault-shield-bearer", name: "Vault Shield Bearer", value: 4, factionId: "rumin" }],
          attachments: []
        },
        values: { block: 6, paymentTotal: 2, paymentRequired: 2 },
        primaryEvent: { id: "block", sequence: 3, type: "block.declared", player: 2 },
        evidence: [{ sequence: 2, eventType: "payment.discarded", publicPayload: { total: 2 } }, { sequence: 3, eventType: "block.declared", publicPayload: {} }]
      }, {
        id: "result-action",
        kind: "result",
        label: "Match complete",
        summary: "Alpha wins",
        actorName: "Gauntlet broadcast",
        turn: 1,
        phase: "gameOver",
        evidenceSequenceStart: 4,
        evidenceSequenceEnd: 4,
        frameAfterIndex: 1,
        cards: { primary: null, payments: [], blockers: [], attachments: [] },
        values: {},
        primaryEvent: { id: "end", sequence: 4, type: "match.ended", winner: 1 },
        evidence: [{ sequence: 4, eventType: "match.ended", publicPayload: { winner: 1 } }]
      }],
      notableMoments: [{ id: "match-ending", label: "Match ending", evidenceSequence: 1 }]
    }
  };
}

test("visual replay mounts the official ProductionMatchExperience and exposes replay controls", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => replayResponse() });
  render(<MatchReplayScreen matchId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" serverUrl="http://localhost:4000" onBack={() => {}} />);
  expect(await screen.findByTestId("official-production-renderer")).toHaveTextContent("replay:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  expect(screen.getByRole("button", { name: "Play" })).toBeVisible();
  expect(screen.getByRole("slider", { name: "Replay action timeline" })).toBeVisible();
  fireEvent.click(screen.getByText("More"));
  expect(screen.getByRole("button", { name: "Match ending" })).toBeVisible();
  expect(screen.getByText("Alpha attacks with Triumphal Ram for 12")).toBeVisible();
  expect(screen.getByText("Triumphal Ram")).toBeVisible();
  expect(screen.getByText("Payment")).toBeVisible();
  expect(screen.getByTestId("replay-battlefield-stage")).toBeVisible();
  expect(screen.getByTestId("replay-transport")).toBeVisible();
  expect(screen.getByTestId("replay-battlefield-stage")).not.toContainElement(screen.getByTestId("replay-transport"));
  fireEvent.click(screen.getByRole("button", { name: "Next action" }));
  expect(screen.getByText("Beta blocks with Vault Shield Bearer for 6")).toBeVisible();
  expect(screen.getAllByText("Vault Shield Bearer")[0]).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Next action" }));
  expect(await screen.findByRole("heading", { name: "Alpha wins" }, { timeout: 1800 })).toBeVisible();
  expect(screen.queryByText("Victory")).not.toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("http://localhost:4000/api/matches/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/replay"));
});

test("event-only legacy replay is explicit and does not mount a fabricated battlefield", async () => {
  const response = replayResponse();
  response.replay.availability.mode = "event-only";
  response.replay.availability.visualCoverage = "event-only";
  response.replay.frames = [];
  response.replay.steps[0].frameIndex = null;
  response.replay.actions.forEach((action) => { action.frameAfterIndex = null; });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => response });
  render(<MatchReplayScreen matchId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" serverUrl="http://localhost:4000" onBack={() => {}} />);
  expect(await screen.findByText("Authoritative event replay")).toBeVisible();
  expect(screen.getByText(/predates public replay frames/i)).toBeVisible();
  expect(screen.getByText("Alpha attacks with Triumphal Ram for 12")).toBeVisible();
  expect(screen.getByText("Inspect authoritative evidence")).toBeVisible();
  expect(screen.queryByTestId("official-production-renderer")).not.toBeInTheDocument();
});
