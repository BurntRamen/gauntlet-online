import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MatchesHub from "./MatchesHub";

const originalFetch = global.fetch;

afterEach(() => { global.fetch = originalFetch; });

test("shows available and unavailable matches honestly with direct actions and Season Zero as a subsection", async () => {
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
        archive: { status: "archived", integrity: "verified", sha256: "a".repeat(64), byteSize: 1234 },
        preview: {
          matchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          winnerPlayerNum: 1,
          participants: [
            { playerNum: 1, displayName: "Alpha", faction: { name: "Rumin" }, finalLife: 12 },
            { playerNum: 2, displayName: "Beta", faction: { name: "Sheen" }, finalLife: -1 }
          ],
          largestAttack: { value: 11 },
          damageDealt: 18,
          damagePrevented: 4,
          archive: { status: "archived", sha256: "a".repeat(64) }
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
  />);

  expect(await screen.findByText("Rumin vs Beta")).toBeVisible();
  expect(screen.getByText("Match bbbbbbbb")).toBeVisible();
  expect(screen.getAllByText("Replay unavailable").length).toBeGreaterThan(0);
  expect(screen.getAllByRole("heading", { name: "Season Zero" }).length).toBeGreaterThan(0);
  expect(screen.getByText("Season standings are one part of your broader match history.")).toBeVisible();
  expect(screen.getByText("Archived · Verified")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Preview" }));
  expect(screen.getByText("11")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "Watch Replay" }));
  expect(onOpenReplay).toHaveBeenCalledWith("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  fireEvent.click(screen.getByRole("button", { name: "Match Record" }));
  expect(onOpenMatch).toHaveBeenCalledWith("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("http://localhost:4000/api/account/matches?limit=30", expect.any(Object)));
});

test("asks signed-out players to sign in without requesting private history", () => {
  global.fetch = jest.fn();
  render(<MatchesHub account={null} authToken="" serverUrl="http://localhost:4000" standings={[]} lifetimeStandings={[]} />);
  expect(screen.getByRole("heading", { name: "Sign in to see your matches" })).toBeVisible();
  expect(global.fetch).not.toHaveBeenCalled();
});
