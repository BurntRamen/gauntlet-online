const test = require("node:test");
const assert = require("node:assert/strict");

const { server, __test } = require("../index");
const { getLegalActions } = require("../../shared/duel-rules");
const { campaignChapters } = require("../gameContent");

test.after(() => server.close());

function choosePassivePlayerCommand(game) {
  const legalActions = getLegalActions(game, 1);
  const pending = [
    ...(game.handAttacks || []),
    ...(game.lanes || []).map((lane) => lane.attack).filter(Boolean)
  ][0] || null;
  if (pending?.targetPlayer === 1) {
    const decline = legalActions.find((action) => action.type === "declineBlock");
    if (decline) return { type: "declineBlock", attackId: pending.id };
  }
  const placement = legalActions.find((action) => action.type === "placeFacedown");
  if (placement) {
    return {
      type: "placeFacedown",
      laneIndex: placement.laneIndex,
      cardId: placement.cardId
    };
  }
  const skip = legalActions.find((action) => action.type === "skipPlacement");
  if (skip) return { type: "skipPlacement", laneIndex: skip.laneIndex };
  if (legalActions.some((action) => action.type === "passPriority")) {
    return { type: "passPriority" };
  }
  return null;
}

async function finishAutomatedOpponentMatch(room, maximumCommands = 200) {
  let commandNumber = 0;
  while (room.game.phase !== "gameOver" && commandNumber < maximumCommands) {
    commandNumber += 1;
    const playerOneCommand = choosePassivePlayerCommand(room.game);
    if (playerOneCommand) {
      const acknowledgement = await __test.executeSemanticDuelCommand(room, 1, {
        commandId: `${room.game.matchId}-test-player-${commandNumber}`,
        baseRevision: room.game.revision,
        command: playerOneCommand
      });
      assert.equal(acknowledgement.accepted, true, acknowledgement.rejection?.message);
      continue;
    }

    const automatedCommand = __test.chooseSemanticTrainingAiCommand(room.game);
    assert.ok(automatedCommand, `AI had no semantic command in ${room.game.phase} at revision ${room.game.revision}`);
    const acknowledgement = await __test.applySemanticAutomatedCommand(room, automatedCommand);
    assert.ok(acknowledgement, `AI command ${automatedCommand.type} was rejected`);
    assert.equal(acknowledgement.accepted, true);
  }
  assert.equal(room.game.phase, "gameOver", `match exceeded ${maximumCommands} semantic commands`);
  return commandNumber;
}

test("campaign ability generation follows its canonical text at tier boundaries", () => {
  const midTierMachineLogic = __test.getCampaignBossAbility(
    "bizi",
    8,
    { opponentName: "Machine Regent" }
  );
  assert.equal(midTierMachineLogic.tier, 2);
  assert.equal(midTierMachineLogic.id, "final-push");
  assert.match(midTierMachineLogic.text, /final scripted attack/i);
  assert.doesNotMatch(midTierMachineLogic.text, /first and final/i);

  const finalTierMachineLogic = __test.getCampaignBossAbility(
    "bizi",
    9,
    { opponentName: "Machine Regent" }
  );
  assert.equal(finalTierMachineLogic.tier, 3);
  assert.equal(finalTierMachineLogic.id, "first-and-final");
  assert.match(finalTierMachineLogic.text, /first and final/i);
});

test("Training AI chooses a semantic lane command from shared legal actions", () => {
  const room = __test.createRoom();
  room.lobby.gameMode = "basic";
  __test.createGameFromLobby(room);
  const game = room.game;
  game.priority = 2;
  game.phase = "priority";
  game.handAttacks = [];
  game.lanes.forEach((lane) => {
    lane.attack = null;
    lane.block = [];
  });
  const laneCard = game.players[2].hand.shift();
  game.lanes[0].facedown[2] = laneCard;
  game.lanes[1].facedown[2] = game.players[2].hand.shift();
  game.lanes[2].facedown[2] = game.players[2].hand.shift();

  const beforeSelection = structuredClone(game);
  const selected = __test.chooseSemanticTrainingAiCommand(game);
  assert.equal(selected.type, "declareLaneAttack");
  assert.ok([0, 1, 2].includes(selected.laneIndex));
  assert.ok(game.lanes[selected.laneIndex].facedown[2]);
  assert.ok(Array.isArray(selected.paymentCardIds));
  assert.ok(selected.paymentCardIds.every((cardId) => (
    game.players[2].hand.some((card) => card.id === cardId)
  )));
  assert.deepEqual(game, beforeSelection);
});

test("campaign boss only blocks with values available in its scripted attack range", () => {
  const room = __test.createRoom();
  room.lobby.gameMode = "factions";
  room.lobby.players[1].factionId = "rumin";
  room.lobby.players[2].factionId = "rumin";
  __test.createGameFromLobby(room, {
    matchMetadata: { matchId: "campaign-block-range", gameNumber: 1, seriesId: null },
    seed: "campaign-block-range"
  });
  const game = room.game;
  game.phase = "priority";
  game.priority = 2;
  game.campaign = {
    chapterId: "block-range",
    chapterNumber: 2,
    opponentName: "Range Warden",
    attacksPerTurn: 2,
    bossAttacksThisTurn: 0,
    minAttackValue: 5,
    maxAttackValue: 8
  };
  game.players[2].hand = [
    { id: "boss-ace", rank: "A", value: 14, suit: "S", name: "Out of Range Ace" },
    { id: "boss-six", rank: "6", value: 6, suit: "H", name: "In Range Six" },
    { id: "boss-payment", rank: "7", value: 7, suit: "D", name: "Payment Seven" }
  ];
  game.handAttacks = [{
    id: "incoming-player-attack",
    player: 1,
    targetPlayer: 2,
    card: { id: "player-nine", rank: "9", value: 9, suit: "C", name: "Player Nine" },
    source: "hand",
    sourceLane: null,
    effectiveValue: 9,
    block: []
  }];

  const selected = __test.chooseSemanticTrainingAiCommand(game);

  assert.equal(selected.type, "declareHandBlock");
  assert.deepEqual(selected.blockerCardIds, ["boss-six"]);
  assert.deepEqual(selected.paymentCardIds, ["boss-payment"]);
  __test.deleteRoom(room.roomCode);
});

test("Training AI executes through the acknowledged semantic-command lifecycle", async () => {
  const room = __test.createRoom();
  room.lobby.gameMode = "basic";
  __test.createGameFromLobby(room, {
    matchMetadata: { matchId: "training-ai-lifecycle", gameNumber: 1, seriesId: null },
    seed: "training-ai-lifecycle"
  });
  const game = room.game;
  game.priority = 2;
  game.phase = "priority";
  game.handAttacks = [];
  game.lanes.forEach((lane) => {
    lane.attack = null;
    lane.block = [];
  });
  for (let laneIndex = 0; laneIndex < 3; laneIndex += 1) {
    game.lanes[laneIndex].facedown[2] = game.players[2].hand.shift();
  }
  const selected = __test.chooseSemanticTrainingAiCommand(game);
  const revision = game.revision;
  const snapshotSequence = game.snapshotSequence;

  const acknowledgement = await __test.applySemanticAutomatedCommand(room, selected);

  assert.equal(acknowledgement.accepted, true);
  assert.equal(acknowledgement.commandId, `training-ai-lifecycle-training-ai-${revision + 1}`);
  assert.equal(room.game.revision, revision + 1);
  assert.equal(acknowledgement.revision, room.game.revision);
  assert.equal(room.game.snapshotSequence, snapshotSequence + 1);
  assert.equal(acknowledgement.snapshotSequence, room.game.snapshotSequence);
  assert.equal(room.game.lastCommandId, acknowledgement.commandId);
  assert.ok(room.duelCommandResults[`server:${acknowledgement.commandId}`]);
  assert.ok(room.game.lastEvents.some((event) => event.type === "attack.declared"));

  __test.deleteRoom(room.roomCode);
});

test("campaign AI selects an authenticated system command without mutating state", () => {
  const room = __test.createRoom();
  room.lobby.gameMode = "factions";
  room.lobby.players[1].factionId = "rumin";
  room.lobby.players[2].factionId = "rumin";
  __test.createGameFromLobby(room);
  const game = room.game;
  game.priority = 2;
  game.phase = "priority";
  game.handAttacks = [];
  game.campaign = {
    chapterId: "semantic-boss",
    chapterNumber: 1,
    opponentName: "Semantic Warden",
    attacksPerTurn: 2,
    bossAttacksThisTurn: 0,
    minAttackValue: 5,
    maxAttackValue: 8,
    bossAbility: {
      id: "first-strike",
      name: "Opening Pressure"
    }
  };
  const revision = game.revision;

  const selected = __test.chooseSemanticTrainingAiCommand(game);
  assert.deepEqual(selected, { type: "declareCampaignBossAttack", system: true });
  assert.equal(game.revision, revision);
  assert.equal(game.handAttacks.length, 0);
});

test("campaign boss commands reject client-spoofed authority and use the server command lifecycle", async () => {
  const room = __test.createRoom();
  room.lobby.gameMode = "factions";
  room.lobby.players[1].factionId = "rumin";
  room.lobby.players[2].factionId = "rumin";
  __test.createGameFromLobby(room, {
    matchMetadata: { matchId: "campaign-command-lifecycle", gameNumber: 1, seriesId: null },
    seed: "campaign-command-lifecycle"
  });
  room.game.priority = 2;
  room.game.phase = "priority";
  room.game.handAttacks = [];
  room.game.campaign = {
    chapterId: "system-authority",
    chapterNumber: 3,
    opponentName: "Authority Warden",
    attacksPerTurn: 2,
    bossAttacksThisTurn: 0,
    minAttackValue: 5,
    maxAttackValue: 8,
    bossAbility: {
      id: "first-strike",
      name: "Opening Pressure"
    }
  };
  const revision = room.game.revision;

  const spoofed = await __test.executeSemanticDuelCommand(room, 2, {
    commandId: `campaign-command-lifecycle-campaign-${revision + 1}`,
    baseRevision: revision,
    system: true,
    command: { type: "declareCampaignBossAttack" }
  });
  assert.equal(spoofed.accepted, false);
  assert.match(spoofed.rejection.message, /server-authenticated/i);
  assert.equal(room.game.revision, revision);
  assert.equal(room.game.handAttacks.length, 0);

  const selected = __test.chooseSemanticTrainingAiCommand(room.game);
  const acknowledgement = await __test.applySemanticAutomatedCommand(room, selected);
  assert.equal(acknowledgement.accepted, true);
  assert.equal(acknowledgement.commandId, `campaign-command-lifecycle-campaign-${revision + 1}`);
  assert.equal(room.game.revision, revision + 1);
  assert.equal(room.game.campaign.bossAttacksThisTurn, 1);
  assert.equal(room.game.handAttacks.length, 1);
  assert.equal(room.game.handAttacks[0].source, "campaignBoss");
  assert.equal(room.game.handAttacks[0].id, "campaign-command-lifecycle-attack-1");
  assert.ok(room.game.lastEvents.some((event) => event.type === "campaign.attackDeclared"));
  assert.ok(room.duelCommandResults[`server:${acknowledgement.commandId}`]);

  __test.deleteRoom(room.roomCode);
});

for (const { label, campaign, factions = false } of [
  { label: "Basic Training AI", campaign: false },
  { label: "faction Training AI", campaign: false, factions: true },
  { label: "campaign boss", campaign: true, factions: true }
]) test(`${label} completes a match using only semantic commands`, async () => {
  const room = __test.createRoom();
  room.lobby.gameMode = factions ? "factions" : "basic";
  if (factions) {
    room.lobby.players[1].factionId = "rumin";
    room.lobby.players[2].factionId = campaign ? "rumin" : "bizi";
  }
  const matchId = campaign
    ? "complete-campaign-match"
    : factions
      ? "complete-faction-training-match"
      : "complete-training-match";
  __test.createGameFromLobby(room, {
    matchMetadata: { matchId, gameNumber: 1, seriesId: null },
    seed: matchId
  });
  if (campaign) {
    room.game.priority = 2;
    room.game.startingPriorityThisTurn = 2;
    room.game.players[2].life = 18;
    room.game.campaign = {
      chapterId: "complete-encounter",
      chapterNumber: 1,
      opponentName: "Completion Warden",
      attacksPerTurn: 2,
      bossAttacksThisTurn: 0,
      minAttackValue: 5,
      maxAttackValue: 8,
      bossAbility: {
        id: "first-strike",
        name: "Opening Pressure"
      }
    };
  }

  try {
    const commands = await finishAutomatedOpponentMatch(room);
    assert.ok(commands > 0);
    assert.equal(room.game.winner, 2);
    assert.ok(room.game.revision >= commands);
    assert.equal(room.game.lastEvents.some((event) => event.type === "match.ended"), true);
    assert.ok(Object.keys(room.duelCommandResults).length > 0);
  } finally {
    __test.deleteRoom(room.roomCode);
  }
});

test("every configured campaign encounter reaches victory through shared transitions", async () => {
  const completed = [];
  for (const [factionId, chapters] of Object.entries(campaignChapters)) {
    for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex += 1) {
      const chapter = chapters[chapterIndex];
      const room = __test.createRoom();
      room.lobby.gameMode = "factions";
      room.lobby.players[1].factionId = factionId;
      room.lobby.players[2].factionId = factionId;
      room.lobby.players[1].campaignDeckAdditions = __test.getCampaignDeckAdditions(
        factionId,
        chapterIndex,
        "player"
      );
      room.lobby.players[2].campaignDeckAdditions = __test.getCampaignDeckAdditions(
        factionId,
        chapterIndex,
        "boss"
      );
      const matchId = `campaign-${factionId}-${chapter.id}`;
      __test.createGameFromLobby(room, {
        matchMetadata: { matchId, gameNumber: 1, seriesId: null },
        seed: matchId
      });
      const difficulty = __test.getCampaignDifficulty(factionId, chapter.id);
      room.game.campaign = {
        factionId,
        chapterId: chapter.id,
        chapterNumber: chapterIndex + 1,
        title: chapter.title,
        opponentName: chapter.opponentName,
        bossAbility: __test.getCampaignBossAbility(factionId, chapterIndex, chapter),
        bossAttacksThisTurn: 0,
        ...difficulty
      };
      room.game.players[2].life = difficulty.bossLife;
      room.game.statsRecorded = true;

      try {
        const commandCount = await finishAutomatedOpponentMatch(room, 300);
        assert.equal(room.game.winner, 2, `${factionId}/${chapter.id} did not resolve a winner`);
        assert.ok(commandCount > 0);
        completed.push(`${factionId}/${chapter.id}`);
      } finally {
        __test.deleteRoom(room.roomCode);
      }
    }
  }

  assert.equal(
    completed.length,
    Object.values(campaignChapters).reduce((total, chapters) => total + chapters.length, 0)
  );
});

test("draft-league match creation preserves draft cards and best-of-three state", () => {
  const draftCard = {
    id: "draft-rumin-two",
    definitionId: "rumin-draft-two",
    name: "Drafted Forum Scout",
    value: 2,
    suit: "♠",
    replacementSuit: "♠",
    factionId: "rumin",
    type: "unit",
    text: "Draft test card"
  };
  const makeEntry = (suffix) => ({
    socketId: `missing-socket-${suffix}`,
    accountId: `account-${suffix}`,
    accountName: `Drafter ${suffix}`,
    draftType: "player",
    bestOf: 3,
    savedDraftDeck: {
      factionId: "rumin",
      factionName: "Rumin",
      draftType: "player",
      cards: [{ ...draftCard, id: `${draftCard.id}-${suffix}` }]
    }
  });
  const room = __test.createDraftLeagueRoom(makeEntry("A"), makeEntry("B"));

  assert.equal(room.draftLeague, true);
  assert.equal(room.game.draftLeague, true);
  assert.equal(room.bestOf3Series.bestOf, 3);
  assert.equal(room.game.bestOf3Series.gameNumber, 1);
  for (const playerNum of [1, 2]) {
    const cards = [
      ...room.game.players[playerNum].hand,
      ...room.game.players[playerNum].deck
    ];
    assert.ok(cards.some((card) => card.definitionId === "rumin-draft-two"));
    assert.ok(cards.some((card) => card.draftCard === true));
  }

  __test.deleteRoom(room.roomCode);
});

test("the same finalized draft configuration and seed reconstruct the same duel deck", () => {
  const configure = () => {
    const room = __test.createRoom();
    room.lobby.gameMode = "factions";
    for (const playerNum of [1, 2]) {
      room.lobby.players[playerNum].accountName = `Seeded Drafter ${playerNum}`;
      room.lobby.players[playerNum].factionId = "rumin";
      room.lobby.players[playerNum].savedDraftDeck = {
        factionId: "rumin",
        factionName: "Rumin",
        draftType: "player",
        cards: [{
          id: `seeded-card-${playerNum}`,
          definitionId: "rumin-seeded-draft",
          factionId: "rumin",
          name: "Seeded Draft Scout",
          value: 3,
          suit: "hearts",
          replacementSuit: "hearts",
          type: "unit"
        }]
      };
    }
    return room;
  };
  const first = configure();
  const second = configure();
  const metadata = { matchId: "seeded-draft-match", gameNumber: 1, seriesId: null };

  __test.createGameFromLobby(first, { matchMetadata: metadata, seed: "draft-reconstruction" });
  __test.createGameFromLobby(second, { matchMetadata: metadata, seed: "draft-reconstruction" });

  assert.equal(first.game.seed, "draft-reconstruction");
  assert.equal(first.game.priority, second.game.priority);
  for (const playerNum of [1, 2]) {
    const firstCards = [
      ...first.game.players[playerNum].hand,
      ...first.game.players[playerNum].deck
    ];
    const secondCards = [
      ...second.game.players[playerNum].hand,
      ...second.game.players[playerNum].deck
    ];
    assert.deepEqual(
      firstCards.map((card) => [card.id, card.definitionId || null]),
      secondCards.map((card) => [card.id, card.definitionId || null])
    );
  }

  __test.deleteRoom(first.roomCode);
  __test.deleteRoom(second.roomCode);
});
