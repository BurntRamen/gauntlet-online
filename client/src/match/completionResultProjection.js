function fallbackOutcome(winnerPlayerNum, playerNum) {
  if (winnerPlayerNum == null) return "draw";
  if (playerNum == null) return "unknown";
  return Number(winnerPlayerNum) === Number(playerNum) ? "win" : "loss";
}

export function projectPostMatchResult({ completion = null, game = null, viewModel = null, playerNum = null }) {
  const liveWinner = game?.winner ?? viewModel?.winner ?? null;
  const liveMatchId = game?.matchId || viewModel?.matchId || null;
  const requestedPlayerNum = playerNum == null ? null : Number(playerNum);
  const suppliedPerspectives = [
    ...(completion?.perspectives || []),
    completion?.perspective
  ].filter(Boolean);
  const perspective = requestedPlayerNum == null
    ? completion?.perspective || suppliedPerspectives[0] || null
    : suppliedPerspectives.find((entry) => Number(entry?.player?.playerNum) === requestedPlayerNum) || null;
  const canonicalAvailable = Boolean(completion?.matchId && perspective?.matchId === completion.matchId);
  const completionResultMatchesPlayer = requestedPlayerNum == null
    || Number(completion?.result?.playerNum) === requestedPlayerNum;
  const outcome = canonicalAvailable
    ? perspective.outcome
    : completionResultMatchesPlayer && completion?.result?.outcome
      ? completion.result.outcome
      : fallbackOutcome(liveWinner, playerNum);
  const winnerPlayerNum = canonicalAvailable
    ? perspective.winnerPlayerNum
    : completionResultMatchesPlayer
      ? completion?.result?.winnerPlayerNum ?? liveWinner
      : liveWinner;
  const title = outcome === "draw"
    ? "Draw"
    : outcome === "win"
      ? "Victory"
      : outcome === "loss"
        ? "Defeat"
        : winnerPlayerNum == null ? "Match Complete" : `Player ${winnerPlayerNum} Wins`;
  return {
    canonicalAvailable,
    matchId: canonicalAvailable ? perspective.matchId : completion?.matchId || liveMatchId,
    recordVersion: canonicalAvailable ? perspective.recordVersion : null,
    outcome,
    winnerPlayerNum,
    title,
    finalMessage: canonicalAvailable
      ? perspective.finalMessage
      : completion?.recap?.finalMessage || game?.message || viewModel?.message || null,
    player: canonicalAvailable ? perspective.player : null,
    opponent: canonicalAvailable ? perspective.opponent : null,
    participants: canonicalAvailable ? completion.match?.participants || [] : [],
    campaign: canonicalAvailable ? perspective.campaign : null,
    completedAt: canonicalAvailable ? perspective.completedAt : null,
    turnCount: canonicalAvailable ? perspective.turnCount : null
  };
}
