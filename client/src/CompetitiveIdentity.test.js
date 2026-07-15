import { fireEvent, render, screen } from "@testing-library/react";
import { CompetitiveIdentityPanel, MatchRecordScreen } from "./CompetitiveIdentity";

const profile = {
  accountId: "account-1",
  displayName: "Alpha",
  competitiveRecord: { ranked: { wins: 3, losses: 1, draws: 0, winRate: 75 }, all: { wins: 4, losses: 2, draws: 0 } },
  verifiedMatchCount: 1,
  notableStats: { largestAttack: { value: 12 }, totalDamageDealt: 8, totalDamagePrevented: 3 },
  recentMatches: [{
    matchId: "match-1",
    ranked: true,
    mode: "factions",
    completedAt: "2026-07-15T12:00:00.000Z",
    turnCount: 5,
    participants: [
      { accountId: "account-1", displayName: "Alpha", result: "win", faction: { name: "Rumin" } },
      { accountId: "account-2", displayName: "Beta", result: "loss", faction: { name: "Sheen" } }
    ]
  }]
};

test("opens a public profile and verified match from Identity", () => {
  const onOpenProfile = jest.fn();
  const onOpenMatch = jest.fn();
  render(<CompetitiveIdentityPanel profile={profile} loading={false} error="" onOpenProfile={onOpenProfile} onOpenMatch={onOpenMatch} />);

  fireEvent.click(screen.getByRole("button", { name: "Public Profile" }));
  expect(onOpenProfile).toHaveBeenCalledWith("account-1");
  fireEvent.click(screen.getByRole("button", { name: /WIN Rumin vs Beta/ }));
  expect(onOpenMatch).toHaveBeenCalledWith("match-1");
});

test("match record links participants and the Para export", () => {
  const onOpenProfile = jest.fn();
  const match = {
    ...profile.recentMatches[0],
    completionReason: "life_total",
    participants: profile.recentMatches[0].participants.map((participant, index) => ({
      ...participant,
      participantId: `p${index + 1}`,
      playerNum: index + 1,
      finalLife: index === 0 ? 6 : -1,
      deck: { format: "constructed", deckVersionId: `version-${index + 1}` }
    })),
    combatStats: { totalDamageDealt: 8, totalDamagePrevented: 3 },
    notableMoments: { largestAttack: { value: 12 } },
    auditEvents: []
  };
  render(<MatchRecordScreen match={match} loading={false} error="" serverUrl="http://localhost:4000" onBack={() => {}} onOpenProfile={onOpenProfile} />);

  expect(screen.getByRole("link", { name: "Para Export" })).toHaveAttribute("href", "http://localhost:4000/api/matches/match-1/export/para");
  fireEvent.click(screen.getByRole("button", { name: /WIN Alpha/ }));
  expect(onOpenProfile).toHaveBeenCalledWith("account-1");
});
