import { createMatchDescriptor, matchDescriptorLabel } from "./matchDescriptor";

function game(overrides = {}) {
  return {
    gameMode: "basic",
    players: {
      1: { hand: [], deck: [], discard: [] },
      2: { hand: [], deck: [], discard: [] }
    },
    ...overrides
  };
}

test("describes a standard Basic human match", () => {
  const descriptor = createMatchDescriptor(game());
  expect(descriptor).toEqual({
    ruleset: "basic",
    deckFormat: "standard",
    opponentKind: "human",
    series: {
      kind: "single",
      gameNumber: 1,
      playerWins: { 1: 0, 2: 0 }
    },
    participantCount: 2
  });
  expect(matchDescriptorLabel(descriptor)).toBe("Basic match");
});

test("describes constructed, AI, campaign, draft, and series axes independently", () => {
  expect(createMatchDescriptor(game({
    gameMode: "factions",
    players: {
      1: { hand: [{ id: "one", definitionId: "rumin-card" }] },
      2: { hand: [] }
    }
  })).deckFormat).toBe("constructed");

  expect(createMatchDescriptor(game(), {
    lobby: { players: { 2: { isAI: true } } }
  }).opponentKind).toBe("trainingAi");

  expect(createMatchDescriptor(game({
    players: {
      1: { hand: [], deck: [], discard: [] },
      2: { accountName: "Training AI", hand: [], deck: [], discard: [] }
    }
  })).opponentKind).toBe("trainingAi");

  const campaign = createMatchDescriptor(game({
    gameMode: "factions",
    campaign: { chapterId: "chapter-1" }
  }));
  expect(campaign.deckFormat).toBe("campaign");
  expect(campaign.opponentKind).toBe("campaignBoss");

  const draftSeries = createMatchDescriptor(game({
    gameMode: "factions",
    draftLeague: true,
    bestOf3Series: {
      bestOf: 3,
      gameNumber: 2,
      scores: { 1: 1, 2: 0 }
    }
  }));
  expect(draftSeries.deckFormat).toBe("draft");
  expect(draftSeries.series).toEqual({
    kind: "bestOf3",
    gameNumber: 2,
    playerWins: { 1: 1, 2: 0 }
  });
});
