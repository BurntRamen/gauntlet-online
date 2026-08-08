const test = require("node:test");
const assert = require("node:assert/strict");

const { captureLeagueEvidence } = require("../matchRecords");
const {
  PUBLIC_REPLAY_FRAME_VERSION,
  buildReplayTimeline,
  replayAvailability
} = require("../matchReplay");

const MATCH_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function card(id, value, suit = "â™ ") {
  return { id, value, rank: String(value), suit, factionId: "rumin", name: id };
}

function gameFixture() {
  return {
    schemaVersion: 2,
    snapshotSchemaVersion: 2,
    commandSchemaVersion: 1,
    eventSchemaVersion: 1,
    rulesVersion: "duel-rules-test",
    cardContentVersion: "cards-test",
    matchId: MATCH_ID,
    gameMode: "factions",
    revision: 0,
    phase: "priority",
    turn: 1,
    priority: 1,
    priorityPassed: { 1: false, 2: false },
    players: {
      1: {
        id: 1,
        accountName: "Alpha",
        life: 20,
        faction: { id: "rumin", name: "Rumin" },
        hand: [card("private-hand-alpha", 9)],
        deck: [card("private-deck-alpha-top", 4), card("private-deck-alpha-bottom", 3)],
        discard: []
      },
      2: {
        id: 2,
        accountName: "Beta",
        life: 20,
        faction: { id: "sheen", name: "Sheen" },
        hand: [card("private-hand-beta", 8)],
        deck: [card("private-deck-beta", 5)],
        discard: []
      }
    },
    lanes: [
      { facedown: { 1: card("private-facedown-alpha", 6), 2: null }, attack: null, block: [] },
      { facedown: { 1: null, 2: null }, attack: null, block: [] },
      { facedown: { 1: null, 2: null }, attack: null, block: [] }
    ],
    handAttacks: [],
    winner: null,
    loser: null,
    message: "Player 1 has priority.",
    reconnectToken: "private-reconnect-token",
    sessionToken: "private-session-token",
    serverAuditEvents: [{ private: true }]
  };
}

function capture(game, command, events) {
  game.revision += 1;
  return captureLeagueEvidence(game, {
    commandId: `${MATCH_ID}:command:${game.revision}`,
    actorPlayerNum: command.actor || null,
    command,
    events,
    timestamp: `2026-08-07T12:00:0${game.revision}.000Z`
  });
}

function recordFixture() {
  const game = gameFixture();
  capture(game, { type: "matchStarted" }, [
    { id: `${MATCH_ID}:started`, type: "match.started" },
    { id: `${MATCH_ID}:peek`, type: "card.peeked", player: 1, viewer: 1, card: card("private-peek", 14) }
  ]);

  const attacker = card("public-attacker", 12);
  const attackPayment = card("public-attack-payment", 3, "clubs");
  game.players[1].hand = [];
  game.handAttacks = [{
    id: "attack-1",
    player: 1,
    targetPlayer: 2,
    source: "hand",
    card: attacker,
    effectiveValue: 12,
    notes: [],
    attachedCards: [],
    payment: { player: 1, cards: [attackPayment], total: 3, required: 3 },
    block: []
  }];
  game.priority = 2;
  game.message = "Player 1 attacked.";
  capture(game, { type: "declareHandAttack", actor: 1, attackerCardId: attacker.id, paymentCardIds: [attackPayment.id] }, [
    { id: `${MATCH_ID}:attack-payment`, type: "payment.discarded", player: 1, cardIds: [attackPayment.id], total: 3, required: 3 },
    { id: `${MATCH_ID}:attack`, type: "attack.declared", player: 1, targetPlayer: 2, cardId: attacker.id, effectiveValue: 12 }
  ]);

  const blocker = card("public-blocker", 4, "â™¥");
  const blockPayment = card("public-block-payment", 2, "diamonds");
  game.players[2].hand = [];
  game.handAttacks[0].block = [{
    id: "block-1",
    player: 2,
    card: blocker,
    effectiveValue: 4,
    payment: { player: 2, cards: [blockPayment], total: 2, required: 2 }
  }];
  game.message = "Player 2 blocked.";
  capture(game, { type: "declareHandBlock", actor: 2, blockerCardIds: [blocker.id], paymentCardIds: [blockPayment.id] }, [
    { id: `${MATCH_ID}:block-payment`, type: "payment.discarded", player: 2, cardIds: [blockPayment.id], total: 2, required: 2 },
    { id: `${MATCH_ID}:block`, type: "block.declared", player: 2, cardIds: [blocker.id] }
  ]);

  game.players[2].life = 12;
  game.players[1].discard = [attacker];
  game.players[2].discard = [blocker];
  game.handAttacks = [];
  game.priority = 2;
  game.turn = 2;
  game.message = "8 damage resolved.";
  capture(game, { type: "passPriority", actor: 1 }, [
    { id: `${MATCH_ID}:calculated`, type: "damage.calculated", player: 2, attackValue: 12, blockValue: 4, damage: 8 },
    { id: `${MATCH_ID}:damage`, type: "damage.dealt", player: 2, amount: 8, from: 20, to: 12 }
  ]);

  game.players[2].life = 0;
  game.phase = "gameOver";
  game.winner = 1;
  game.loser = 2;
  game.turn = 3;
  game.priority = null;
  game.message = "Player 1 wins.";
  capture(game, { type: "finalizeMatch" }, [
    { id: `${MATCH_ID}:ended`, type: "match.ended", winner: 1 }
  ]);

  return {
    recordVersion: 2,
    matchId: MATCH_ID,
    leagueEvidenceVersion: "gauntlet.league-evidence.v1",
    leagueEvidenceCoverage: "complete",
    leagueEvidence: game.serverLeagueEvidence,
    publicReplayFrameVersion: PUBLIC_REPLAY_FRAME_VERSION,
    publicReplayFrames: game.serverPublicReplayFrames,
    participants: [
      { participantId: `${MATCH_ID}:p1`, playerNum: 1, displayName: "Alpha", faction: { id: "rumin", name: "Rumin" }, finalLife: 20, result: "win" },
      { participantId: `${MATCH_ID}:p2`, playerNum: 2, displayName: "Beta", faction: { id: "sheen", name: "Sheen" }, finalLife: 0, result: "loss" }
    ],
    finalLife: { 1: 20, 2: 0 },
    winnerPlayerNum: 1,
    completionReason: "life_total",
    completedAt: "2026-08-07T12:01:00.000Z",
    turnCount: 3,
    notableMoments: {
      largestAttack: { playerNum: 1, targetPlayerNum: 2, value: 12, turn: 1 },
      decisiveTurn: 3
    }
  };
}

test("builds a deterministic public replay through attack, block, damage, and final result", () => {
  const record = recordFixture();
  const first = buildReplayTimeline(record, { mode: "account-only", capabilities: { publicRecordAfterProcessReplacement: false } });
  const second = buildReplayTimeline(record, { mode: "account-only", capabilities: { publicRecordAfterProcessReplacement: false } });
  assert.deepEqual(first, second);
  assert.equal(first.availability.mode, "public-state-frames");
  assert.equal(first.frames[0].publicState.players[1].life, 20);
  assert.equal(first.frames[0].publicState.phase, "priority");
  const attack = first.steps.find((step) => step.eventType === "attack.declared");
  const block = first.steps.find((step) => step.eventType === "block.declared");
  const damage = first.steps.find((step) => step.eventType === "damage.dealt");
  assert.equal(first.frames[attack.frameIndex - 1].publicState.handAttacks[0].card.id, "public-attacker");
  assert.equal(first.frames[block.frameIndex - 1].publicState.handAttacks[0].block[0].card.id, "public-blocker");
  assert.equal(first.frames[damage.frameIndex - 1].publicState.players[2].life, 12);
  assert.equal(first.frames.at(-1).publicState.phase, "gameOver");
  assert.equal(first.frames.at(-1).publicState.winner, 1);
  assert.equal(first.result.winnerPlayerNum, 1);
  assert.equal(first.actions.length, first.frames.length);
  const attackAction = first.actions.find((action) => action.kind === "attack");
  const blockAction = first.actions.find((action) => action.kind === "block");
  const resolutionAction = first.actions.find((action) => action.kind === "resolution");
  assert.equal(attackAction.cards.primary.name, "public-attacker");
  assert.equal(attackAction.cards.payments[0].name, "public-attack-payment");
  assert.equal(attackAction.values.paymentTotal, 3);
  assert.ok(attackAction.evidenceSequenceEnd > attackAction.evidenceSequenceStart);
  assert.equal(blockAction.cards.primary.name, "public-blocker");
  assert.equal(blockAction.cards.blockers[0].name, "public-blocker");
  assert.equal(resolutionAction.values.attack, 12);
  assert.equal(resolutionAction.values.block, 4);
  assert.equal(resolutionAction.values.damage, 8);
  assert.equal(first.notableMoments.find((entry) => entry.id === "largest-attack").evidenceSequence, attack.evidenceSequence);
  assert.equal(first.notableMoments.find((entry) => entry.id === "match-ending").evidenceSequence, first.steps.at(-1).evidenceSequence);
});

test("public replay permanently removes private hands, deck order, facedown identity, peeks, tokens, and server fields", () => {
  const replay = buildReplayTimeline(recordFixture());
  const serialized = JSON.stringify(replay);
  for (const secret of [
    "private-hand-alpha", "private-hand-beta", "private-deck-alpha-top", "private-deck-alpha-bottom",
    "private-deck-beta", "private-facedown-alpha", "private-peek", "private-reconnect-token",
    "private-session-token", "serverAuditEvents"
  ]) assert.equal(serialized.includes(secret), false, secret);
  assert.equal(serialized.includes("public-attacker"), true);
  assert.equal(serialized.includes("public-blocker"), true);
  assert.equal(serialized.includes("public-attack-payment"), true);
  assert.equal(serialized.includes("public-block-payment"), true);
  assert.deepEqual(replay.frames[0].publicState.players[1].hand, []);
  assert.deepEqual(replay.frames[0].publicState.players[1].deck, []);
  assert.deepEqual(replay.frames[0].publicState.lanes[0].facedown[1], { id: "hidden-lane-0-p1", hidden: true });
});

test("older record-v2 evidence remains event-only without fabricated battlefield frames", () => {
  const record = recordFixture();
  delete record.publicReplayFrames;
  delete record.publicReplayFrameVersion;
  const replay = buildReplayTimeline(record);
  assert.equal(replay.availability.mode, "event-only");
  assert.equal(replay.availability.visualCoverage, "event-only");
  assert.deepEqual(replay.frames, []);
  assert.ok(replay.steps.every((step) => step.frameIndex === null && step.stateTiming === "event-only"));
  assert.ok(replay.actions.length < replay.steps.length);
  assert.ok(replay.actions.every((action) => action.frameAfterIndex === null));
});

test("corrupt or contradictory replay evidence fails closed", () => {
  const nonContiguous = recordFixture();
  nonContiguous.leagueEvidence[1].sequence = 9;
  assert.throws(() => buildReplayTimeline(nonContiguous), (error) => error.code === "NON_CONTIGUOUS_EVIDENCE");

  const duplicateId = recordFixture();
  duplicateId.leagueEvidence[1].eventId = duplicateId.leagueEvidence[0].eventId;
  assert.throws(() => buildReplayTimeline(duplicateId), (error) => error.code === "DUPLICATE_EVIDENCE_ID");

  const wrongMatch = recordFixture();
  wrongMatch.publicReplayFrames[0].matchId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  assert.throws(() => buildReplayTimeline(wrongMatch), (error) => error.code === "FRAME_MATCH_ID_MISMATCH");

  const checksum = recordFixture();
  checksum.publicReplayFrames[0].publicState.players[1].life = 999;
  assert.throws(() => buildReplayTimeline(checksum), (error) => error.code === "FRAME_CHECKSUM_MISMATCH");
});

test("replay availability reports the account-only durability gate honestly", () => {
  const record = recordFixture();
  assert.deepEqual(replayAvailability(record, {
    mode: "account-only",
    capabilities: { publicRecordAfterProcessReplacement: false }
  }), {
    available: true,
    mode: "public-state-frames",
    visualCoverage: "exact-authoritative-command-results",
    evidenceCount: record.leagueEvidence.length,
    frameCount: record.publicReplayFrames.length,
    storageMode: "account-only",
    survivesProcessReplacement: false,
    unavailableReason: null
  });
});
