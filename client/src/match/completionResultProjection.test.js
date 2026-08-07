import { projectPostMatchResult } from "./completionResultProjection";

test("available record-v2 perspective outranks stale live and consequence facts", () => {
  const completion = {
    matchId: "canonical-match",
    result: { outcome: "loss", winnerPlayerNum: 2 },
    recap: { finalMessage: "stale recap" },
    match: {
      participants: [
        { playerNum: 1, displayName: "Canonical Alpha", result: "win", finalLife: 17, faction: { id: "rumin", name: "Rumin" } },
        { playerNum: 2, displayName: "Canonical Beta", result: "loss", finalLife: 0, faction: { id: "sheen", name: "Sheen" } }
      ]
    },
    perspective: {
      matchId: "canonical-match",
      recordVersion: 2,
      winnerPlayerNum: 1,
      outcome: "win",
      finalMessage: "Canonical Alpha wins.",
      player: { playerNum: 1, displayName: "Canonical Alpha", result: "win", finalLife: 17 },
      opponent: { playerNum: 2, displayName: "Canonical Beta", result: "loss", finalLife: 0 },
      campaign: null,
      completedAt: "2026-08-08T10:08:00.000Z",
      turnCount: 8
    }
  };
  const projection = projectPostMatchResult({
    completion,
    playerNum: 1,
    game: { matchId: "stale-live-match", winner: 2, message: "Stale live winner" },
    viewModel: { matchId: "stale-view-model", winner: 2, message: "Stale view model" }
  });

  expect(projection.canonicalAvailable).toBe(true);
  expect(projection.matchId).toBe("canonical-match");
  expect(projection.outcome).toBe("win");
  expect(projection.winnerPlayerNum).toBe(1);
  expect(projection.title).toBe("Victory");
  expect(projection.finalMessage).toBe("Canonical Alpha wins.");
  expect(projection.participants[0].displayName).toBe("Canonical Alpha");
});

test("live state remains an explicit temporary fallback while completion is unavailable", () => {
  const projection = projectPostMatchResult({
    playerNum: 1,
    game: { matchId: "pending-match", winner: 2, message: "Player 2 wins." }
  });
  expect(projection.canonicalAvailable).toBe(false);
  expect(projection.matchId).toBe("pending-match");
  expect(projection.outcome).toBe("loss");
  expect(projection.title).toBe("Defeat");
});

test("an anonymous player selects their own server-projected record-v2 perspective", () => {
  const completion = {
    matchId: "canonical-match",
    result: { playerNum: 1, outcome: "loss", winnerPlayerNum: 2 },
    perspective: {
      matchId: "canonical-match",
      recordVersion: 2,
      outcome: "loss",
      winnerPlayerNum: 2,
      player: { playerNum: 1, displayName: "Conceding Guest" }
    },
    perspectives: [{
      matchId: "canonical-match",
      recordVersion: 2,
      outcome: "loss",
      winnerPlayerNum: 2,
      player: { playerNum: 1, displayName: "Conceding Guest" }
    }, {
      matchId: "canonical-match",
      recordVersion: 2,
      outcome: "win",
      winnerPlayerNum: 2,
      finalMessage: "Player 1 conceded. Player 2 wins!",
      player: { playerNum: 2, displayName: "Winning Guest" }
    }],
    match: { participants: [{ playerNum: 1 }, { playerNum: 2 }] }
  };

  const projection = projectPostMatchResult({
    completion,
    playerNum: 2,
    game: { matchId: "canonical-match", winner: 1, message: "Stale live result" }
  });

  expect(projection.canonicalAvailable).toBe(true);
  expect(projection.outcome).toBe("win");
  expect(projection.title).toBe("Victory");
  expect(projection.player.displayName).toBe("Winning Guest");
  expect(projection.finalMessage).toBe("Player 1 conceded. Player 2 wins!");
});
