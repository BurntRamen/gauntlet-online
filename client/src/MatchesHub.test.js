import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MatchesHub, { RecentMatchShortcut } from "./MatchesHub";
import { createLocalMatchLibrary, createLocalMatchRecorder, createMemoryMatchBackend } from "./matchHistory";
import * as transcript from "./matchTranscript";

const { applyCommand, createCommandEnvelope, createMatch } = require("@gauntlet/duel-rules");

const originalFetch = global.fetch;

afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

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
  const onOpenRanked = jest.fn();
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
    onOpenRanked={onOpenRanked}
    matchLibrary={emptyLibrary()}
  />);

  expect(await screen.findByText("vs Beta")).toBeVisible();
  expect(screen.getByText("Full match record unavailable")).toBeVisible();
  expect(screen.getAllByText(/Replay file not saved on this device/).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("heading", { name: "Season Zero" }).length).toBeGreaterThan(0);
  expect(screen.getByText("Ranked results appear here; imported match files never change the standings.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Open Ranked Setup" }));
  expect(onOpenRanked).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Preview Record" }));
  expect(screen.getByText("11")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "Watch Replay" }));
  await waitFor(() => expect(onOpenReplay).toHaveBeenCalledWith("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
  fireEvent.click(screen.getByRole("button", { name: "View Match Record" }));
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
  expect(screen.getByRole("heading", { name: "Import Match File" })).toBeVisible();
  expect(screen.getByText("Sign in to see account results alongside replays saved on this device.")).toBeVisible();
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
  expect(await screen.findByText("Valid Gauntlet match file")).toBeVisible();
  expect(screen.getByText(/file is complete and unchanged/i)).toBeVisible();

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

test("large libraries render in batches without opening any replay payload", async () => {
  const entries = Array.from({ length: 45 }, (_, index) => ({
    matchId: `saved-${index}`, completedAt: "2026-09-20T12:00:00Z", mode: "basic",
    participants: [{ playerNum: 1, displayName: "You" }, { playerNum: 2, displayName: `Opponent ${index}` }],
    replay: { available: true },
    get canonicalJson() { throw new Error("List read a replay"); }
  }));
  const library = { list: async () => entries, subscribe: () => () => {}, get: jest.fn(), load: jest.fn() };
  const { container } = render(<MatchesHub matchLibrary={library} />);
  await waitFor(() => expect(container.querySelectorAll(".matches-row")).toHaveLength(20));
  fireEvent.click(screen.getByRole("button", { name: "Show more matches (20 of 45)" }));
  expect(container.querySelectorAll(".matches-row")).toHaveLength(40);
  fireEvent.click(screen.getByRole("button", { name: "Show more matches (40 of 45)" }));
  expect(container.querySelectorAll(".matches-row")).toHaveLength(45);
  expect(library.get).not.toHaveBeenCalled();
  expect(library.load).not.toHaveBeenCalled();
});

test("legacy saved matches verify just the selected archive when preview is requested", async () => {
  const library = emptyLibrary();
  const { entry } = await library.save(portableJson());
  delete entry.preview;
  await library.backend.put(entry);
  const get = jest.spyOn(library, "get");
  render(<MatchesHub matchLibrary={library} />);
  const previewButton = await screen.findByRole("button", { name: "Preview Record" });
  expect(get).not.toHaveBeenCalled();
  fireEvent.click(previewButton);
  await waitFor(() => expect(screen.getByLabelText("Match record preview")).toBeVisible());
  expect(get).toHaveBeenCalledTimes(1);
});

test("saved matches retain plain-text transcript export alongside portable match files", async () => {
  const library = emptyLibrary();
  await library.save(portableJson());
  const download = jest.spyOn(transcript, "downloadMatchTranscript").mockImplementation(() => {});
  render(<MatchesHub matchLibrary={library} hideStandings />);
  const exportButton = await screen.findByRole("button", { name: "Export Transcript" });
  expect(screen.getByRole("button", { name: "Export Match File" })).toBeVisible();
  expect(download).not.toHaveBeenCalled();
  fireEvent.click(exportButton);
  await waitFor(() => expect(download).toHaveBeenCalledWith(expect.objectContaining({ availability: expect.objectContaining({ available: true }) })));
});

function accountMatch(matchId, opponent, available) {
  return {
    matchId, mode: "basic", completedAt: "2026-10-28T12:00:00.000Z",
    perspective: { outcome: "win", player: { displayName: "You" }, opponent: { displayName: opponent } },
    replay: { available, mode: "public-state-frames", unavailableReason: available ? null : "Replay scenes were not recorded." }
  };
}

test("replay destination filters unavailable matches while records remain separately accessible", async () => {
  const matches = [accountMatch("available-match", "Replay Opponent", true), accountMatch("record-only", "Record Opponent", false)];
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ matches, unavailableMatchReferences: [{ matchId: "reference-only" }] }) });
  const props = {
    account: { id: "account-1" }, authToken: "token", serverUrl: "http://localhost:4000", matchLibrary: emptyLibrary(),
    standings: [], lifetimeStandings: [], season: { displayName: "Season Zero" }, hideStandings: true,
    onOpenReplay: jest.fn(), onOpenMatch: jest.fn()
  };
  const { rerender } = render(<MatchesHub {...props} view="replays" />);
  expect(await screen.findByText("vs Replay Opponent")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Replay Library" })).toBeVisible();
  expect(screen.queryByText("vs Record Opponent")).not.toBeInTheDocument();
  expect(screen.queryByText("Full match record unavailable")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Season Zero" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View Match Record" }));
  await waitFor(() => expect(props.onOpenMatch).toHaveBeenCalledWith("available-match"));
  rerender(<MatchesHub {...props} view="recent" />);
  expect(screen.getByText("vs Record Opponent")).toBeVisible();
  expect(screen.getByText("Replay scenes were not recorded.")).toBeVisible();
  expect(screen.getAllByRole("button", { name: "View Match Record" })).toHaveLength(2);
  expect(screen.getAllByRole("button", { name: "Watch Replay" })).toHaveLength(1);
  expect(screen.getByText("Full match record unavailable")).toBeVisible();
});

test("replay destination truthfully explains an empty library and keeps importing available", async () => {
  global.fetch = jest.fn();
  render(<MatchesHub account={null} authToken="" view="replays" hideStandings matchLibrary={emptyLibrary()} />);
  expect(await screen.findByText("No playable replays are available yet. Import a saved match file below.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Choose Match File" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Watch Replay" })).not.toBeInTheDocument();
});

test("imported files without replay evidence never offer a misleading Watch Replay action", async () => {
  const library = emptyLibrary();
  const inspected = library.inspect(portableJson());
  inspected.replay.availability = { available: false, unavailableReason: "The file contains results without replay evidence." };
  jest.spyOn(library, "inspect").mockReturnValue(inspected);
  const { container } = render(<MatchesHub account={null} authToken="" hideStandings matchLibrary={library} />);
  fireEvent.drop(container.querySelector(".match-import-drop"), { dataTransfer: { files: [{ text: async () => "test-file" }] } });
  expect(await screen.findByText("The file contains results without replay evidence.")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Watch Replay" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save to My Matches" })).toBeVisible();
});

test("account changes immediately clear previous account results and discard late responses", async () => {
  let resolveFirst;
  global.fetch = jest.fn()
    .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
    .mockResolvedValue({ ok: true, json: async () => ({ matches: [accountMatch("second-match", "Second Account Opponent", true)] }) });
  const library = emptyLibrary();
  const props = { serverUrl: "http://localhost:4000", matchLibrary: library, hideStandings: true };
  const { rerender } = render(<MatchesHub {...props} account={{ id: "first" }} authToken="first-token" />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  rerender(<MatchesHub {...props} account={{ id: "second" }} authToken="second-token" />);
  expect(await screen.findByText("vs Second Account Opponent")).toBeVisible();
  await act(async () => { resolveFirst({ ok: true, json: async () => ({ matches: [accountMatch("first-match", "First Account Opponent", true)] }) }); });
  await waitFor(() => expect(screen.queryByText("vs First Account Opponent")).not.toBeInTheDocument());
  await act(async () => { rerender(<MatchesHub {...props} account={null} authToken="" />); });
  expect(screen.queryByText("vs Second Account Opponent")).not.toBeInTheDocument();
});


test("Play shortcut opens an actual locally saved replay and labels its outcome", async () => {
  const library = emptyLibrary();
  const saved = await library.save(portableJson());
  const onReplay = jest.fn();
  render(<RecentMatchShortcut matchLibrary={library} onOpenReplay={onReplay} onOpenMatches={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: "Watch Replay" }));
  await waitFor(() => expect(onReplay).toHaveBeenCalledWith(saved.entry.matchId, expect.objectContaining({ availability: expect.any(Object) }), expect.objectContaining({ matchId: saved.entry.matchId })));
});

test("Play shortcut does not show an earlier account's late history response", async () => {
  let finishOld;
  global.fetch = jest.fn().mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockResolvedValue({ ok: true, json: async () => ({ matches: [] }) });
  const library = emptyLibrary();
  const props = { serverUrl: "http://test", matchLibrary: library, onOpenMatches: jest.fn(), onOpenReplay: jest.fn() };
  const { rerender } = render(<RecentMatchShortcut {...props} account={{ id: "one" }} authToken="first" />);
  rerender(<RecentMatchShortcut {...props} account={{ id: "two" }} authToken="second" />);
  await act(async () => { finishOld({ ok: true, json: async () => ({ matches: [{ matchId: "old", perspective: { opponent: { displayName: "Old Opponent" } }, replay: { available: true } }] }) }); });
  expect(screen.queryByText(/Old Opponent/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Watch Replay" })).not.toBeInTheDocument();
});
