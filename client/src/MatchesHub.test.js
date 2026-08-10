import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MatchesHub from "./MatchesHub";
import { createLocalMatchLibrary, createLocalMatchRecorder, createMemoryMatchBackend } from "./matchHistory";

const { applyCommand, createCommandEnvelope, createMatch } = require("@gauntlet/duel-rules");

const originalFetch = global.fetch;

afterEach(() => { global.fetch = originalFetch; });

function emptyLibrary() {
  return createLocalMatchLibrary({ backend: createMemoryMatchBackend() });
}

function portableJson() {
  const matchId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const game = createMatch({ matchId, seed: "matches-import", playerNames: { 1: "Import Alpha", 2: "Import Beta" } }).state;
  const recorder = createLocalMatchRecorder({ initialGame: game, playerNames: { 1: "Import Alpha", 2: "Import Beta" }, startedAt: "2026-08-09T12:00:00.000Z" });
  const envelope = createCommandEnvelope(game, game.priority, { type: "concede", player: game.priority }, `${matchId}:concede`);
  const result = applyCommand(game, envelope);
  recorder.recordAccepted(result.state, envelope);
  return recorder.buildRecord(result.state, "2026-08-09T12:01:00.000Z").json;
}

test("merges account references honestly and keeps Season Zero as a subsection", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      storage: { mode: "account-only" },
      matches: [{
        matchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        mode: "factions",
        completedAt: "2026-08-07T12:00:00.000Z",
        turnCount: 4,
        season: null,
        perspective: {
          outcome: "win",
          player: { participantId: "p1", faction: { name: "Rumin" }, result: "win" },
          opponent: { participantId: "p2", displayName: "Beta" }
        },
        replay: { available: true, mode: "public-state-frames" },
        preview: {
          matchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          winnerPlayerNum: 1,
          participants: [
            { playerNum: 1, displayName: "Alpha", faction: { name: "Rumin" }, finalLife: 12 },
            { playerNum: 2, displayName: "Beta", faction: { name: "Sheen" }, finalLife: -1 }
          ],
          largestAttack: { value: 11 },
          damageDealt: 18,
          damagePrevented: 4
        }
      }],
      unavailableMatchReferences: [{
        matchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        recordVersion: 2,
        completedAt: "2026-08-06T12:00:00.000Z"
      }]
    })
  });
  const onOpenReplay = jest.fn();
  const onOpenMatch = jest.fn();
  render(<MatchesHub
    account={{ id: "account-1", stats: { gamesPlayed: 2 } }}
    authToken="session"
    serverUrl="http://localhost:4000"
    season={{ displayName: "Season Zero" }}
    standings={[]}
    lifetimeStandings={[]}
    onOpenProfile={() => {}}
    onOpenReplay={onOpenReplay}
    onOpenMatch={onOpenMatch}
    matchLibrary={emptyLibrary()}
  />);

  expect(await screen.findByText("Rumin vs Beta")).toBeVisible();
  expect(screen.getByText("Match bbbbbbbb")).toBeVisible();
  expect(screen.getAllByText(/Replay file not saved on this device/).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("heading", { name: "Season Zero" }).length).toBeGreaterThan(0);
  expect(screen.getByText("Imported files remain local history and never alter competitive standings.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Preview" }));
  expect(screen.getByText("11")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "Watch Replay" }));
  await waitFor(() => expect(onOpenReplay).toHaveBeenCalledWith("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
  fireEvent.click(screen.getByRole("button", { name: "Match Record" }));
  await waitFor(() => expect(onOpenMatch).toHaveBeenCalledWith("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
  expect(global.fetch).toHaveBeenCalledWith("http://localhost:4000/api/account/matches?limit=30", expect.any(Object));
});

test("keeps local import and history available while signed out without requesting account history", async () => {
  global.fetch = jest.fn();
  render(<MatchesHub
    account={null}
    authToken=""
    serverUrl="http://localhost:4000"
    standings={[]}
    lifetimeStandings={[]}
    matchLibrary={emptyLibrary()}
  />);
  expect(screen.getByRole("heading", { name: "Import Match JSON" })).toBeVisible();
  expect(screen.getByText("Sign in to merge durable account result references with matches saved on this device.")).toBeVisible();
  await waitFor(() => expect(global.fetch).not.toHaveBeenCalled());
});

test("previews imported JSON, watches without persisting, then saves only after explicit action", async () => {
  global.fetch = jest.fn();
  const library = emptyLibrary();
  const onOpenReplay = jest.fn();
  const { container } = render(<MatchesHub
    account={null}
    authToken=""
    serverUrl="http://localhost:4000"
    standings={[]}
    lifetimeStandings={[]}
    onOpenReplay={onOpenReplay}
    matchLibrary={library}
  />);
  const file = { text: async () => portableJson() };
  fireEvent.drop(container.querySelector(".match-import-drop"), { dataTransfer: { files: [file] } });
  expect(await screen.findByText("Valid Gauntlet record")).toBeVisible();
  expect(screen.getByText(/Integrity confirms canonical content identity/)).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "Watch Replay" }));
  expect(onOpenReplay).toHaveBeenCalledWith(
    "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    expect.objectContaining({ availability: expect.objectContaining({ available: true }) }),
    expect.objectContaining({ matchId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" })
  );
  expect(await library.list()).toHaveLength(0);

  fireEvent.click(screen.getByRole("button", { name: "Save to My Matches" }));
  expect(await screen.findByText("Saved to My Matches.")).toBeVisible();
  expect(await library.list()).toHaveLength(1);
  expect(global.fetch).not.toHaveBeenCalled();
});
