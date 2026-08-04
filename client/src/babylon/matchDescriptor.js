const DEFAULT_SERIES = Object.freeze({
  kind: "single",
  gameNumber: 1,
  playerWins: Object.freeze({ 1: 0, 2: 0 })
});

function playerCards(game) {
  return Object.values(game?.players || {}).flatMap((player) => [
    ...(player?.hand || []),
    ...(player?.deck || []),
    ...(player?.discard || [])
  ]);
}

function hasConstructedCards(game) {
  return playerCards(game).some((card) => (
    Boolean(card?.definitionId)
    || Boolean(card?.draftCard)
    || Boolean(card?.type && card.type !== "standard")
  ));
}

function normalizeSeries(game, controlState = {}) {
  const series = game?.bestOf3Series || controlState?.bestOf3Series;
  if (!series || Number(series.bestOf || 1) !== 3) {
    return {
      ...DEFAULT_SERIES,
      playerWins: { ...DEFAULT_SERIES.playerWins }
    };
  }
  const scores = series.scores || series.playerWins || {};
  return {
    kind: "bestOf3",
    gameNumber: Math.max(1, Number(series.gameNumber || 1)),
    playerWins: {
      1: Number(scores[1] ?? scores["1"] ?? 0),
      2: Number(scores[2] ?? scores["2"] ?? 0)
    }
  };
}

export function createMatchDescriptor(game, controlState = {}) {
  const lobby = controlState?.lobby || {};
  const campaign = game?.campaign || lobby?.campaign || null;
  const isDraft = Boolean(
    game?.draftLeague
    || controlState?.draftLeague
    || lobby?.draftLeague
  );
  const hasAiOpponent = Boolean(
    controlState?.trainingAi
    || lobby?.players?.[2]?.isAI
    || game?.players?.[2]?.isAI
    || lobby?.players?.[2]?.accountName === "Training AI"
    || game?.players?.[2]?.accountName === "Training AI"
  );

  return {
    ruleset: game?.gameMode === "factions" ? "factions" : "basic",
    deckFormat: campaign
      ? "campaign"
      : isDraft
        ? "draft"
        : hasConstructedCards(game)
          ? "constructed"
          : "standard",
    opponentKind: campaign
      ? "campaignBoss"
      : hasAiOpponent
        ? "trainingAi"
        : "human",
    series: normalizeSeries(game, controlState),
    participantCount: 2
  };
}

export function matchDescriptorLabel(descriptor) {
  if (!descriptor) return "Gauntlet match";
  if (descriptor.opponentKind === "campaignBoss") return "Campaign battle";
  if (descriptor.opponentKind === "trainingAi") return "Training match";
  if (descriptor.deckFormat === "draft") return "Draft-deck match";
  if (descriptor.deckFormat === "constructed") return "Constructed match";
  return descriptor.ruleset === "factions" ? "Faction match" : "Basic match";
}
