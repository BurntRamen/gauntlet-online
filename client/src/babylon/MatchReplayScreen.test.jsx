import { render, screen, waitFor } from "@testing-library/react";
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
      participants: [],
      frames: [{ frameIndex: 1, publicStateChecksum: "checksum", publicState }],
      steps: [{ index: 0, evidenceSequence: 1, evidenceId: "start", eventType: "match.started", turn: 1, phase: "priority", label: "Match started", frameIndex: 1, publicPayload: {} }],
      notableMoments: [{ id: "match-ending", label: "Match ending", evidenceSequence: 1 }]
    }
  };
}

test("visual replay mounts the official ProductionMatchExperience and exposes replay controls", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => replayResponse() });
  render(<MatchReplayScreen matchId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" serverUrl="http://localhost:4000" onBack={() => {}} />);
  expect(await screen.findByTestId("official-production-renderer")).toHaveTextContent("replay:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  expect(screen.getByRole("button", { name: "Play" })).toBeVisible();
  expect(screen.getByRole("slider", { name: "Replay timeline" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Match ending" })).toBeVisible();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("http://localhost:4000/api/matches/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/replay"));
});

test("event-only legacy replay is explicit and does not mount a fabricated battlefield", async () => {
  const response = replayResponse();
  response.replay.availability.mode = "event-only";
  response.replay.availability.visualCoverage = "event-only";
  response.replay.frames = [];
  response.replay.steps[0].frameIndex = null;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => response });
  render(<MatchReplayScreen matchId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" serverUrl="http://localhost:4000" onBack={() => {}} />);
  expect(await screen.findByText("Authoritative event replay")).toBeVisible();
  expect(screen.getByText(/predates public replay frames/i)).toBeVisible();
  expect(screen.queryByTestId("official-production-renderer")).not.toBeInTheDocument();
});
