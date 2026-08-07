import { fireEvent, render, screen } from "@testing-library/react";
import { ActiveSeasonMatches, SeasonQueueSummary, SeasonResultFacts, SeasonStandings } from "./SeasonZero";

const season = { seasonId: "season-zero", displayName: "Season Zero", status: "active" };

test("ranked presentation identifies Season Zero and BO3 scoring semantics", () => {
  render(<SeasonQueueSummary season={season} bestOf={3} />);
  expect(screen.getByText("Season Zero")).toBeInTheDocument();
  expect(screen.getByText(/Ranked BO3/)).toHaveTextContent("series result scores standings points");
});

test("standings show rank, points, record, and an off-board player position", () => {
  const onOpenProfile = jest.fn();
  render(<SeasonStandings
    season={season}
    standings={[{ rank: 1, accountId: "a", name: "Alpha", gamesPlayed: 3, wins: 2, losses: 1, draws: 0, points: 6, winRate: 66.7 }]}
    playerStanding={{ rank: 28, accountId: "me", name: "Me", wins: 1, losses: 2, draws: 0, points: 3 }}
    onOpenProfile={onOpenProfile}
  />);
  expect(screen.getByText("Season Zero")).toBeInTheDocument();
  expect(screen.getByText(/#28 · 3 points/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "1. Alpha" }));
  expect(onOpenProfile).toHaveBeenCalledWith("a");
});

test("season result consequence presents authoritative delta and updated record", () => {
  render(<dl><SeasonResultFacts seasonResult={{ displayName: "Season Zero", result: "win", seriesResult: "win", pointsDelta: 3, rank: 4, record: { wins: 2, losses: 1, draws: 0, points: 6 } }} /></dl>);
  expect(screen.getByText("WIN")).toBeInTheDocument();
  expect(screen.getByText("+3 · 6 total")).toBeInTheDocument();
  expect(screen.getByText(/2W 1L 0D · #4/)).toBeInTheDocument();
});

test("active seasonal match entry can be joined as a spectator", () => {
  const onSpectate = jest.fn();
  render(<ActiveSeasonMatches season={season} matches={[{
    roomCode: "ABC123",
    matchId: "match-1",
    format: "ranked-bo1",
    turn: 4,
    spectatorCount: 2,
    players: [{ displayName: "Alpha" }, { displayName: "Beta" }]
  }]} onSpectate={onSpectate} />);
  expect(screen.getByText("Alpha vs Beta")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Spectate" }));
  expect(onSpectate).toHaveBeenCalledWith("ABC123");
});
