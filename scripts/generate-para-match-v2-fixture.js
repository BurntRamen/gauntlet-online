"use strict";

const { buildParaMatchExport } = require("../server/matchRecords");

function buildFixtureRecord() {
  const matchId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const timestamp = "2026-08-07T18:00:00.000Z";
  const checksum = "9d3d12c9d8f743ba429e74e5bfd1f6c17ae645451e2798d8269c41e5ac73cafe";
  const evidence = [
    ["command.accepted", 1, null, "declareHandAttack", { command: { type: "declareHandAttack", attackerCardId: "rumin-ace-spades", paymentCardIds: ["rumin-seven-hearts"] } }],
    ["payment.discarded", 1, null, "declareHandAttack", { player: 1, cardIds: ["rumin-seven-hearts"], total: 7, required: 7 }],
    ["attack.declared", 1, 2, "declareHandAttack", { player: 1, targetPlayer: 2, cardId: "rumin-ace-spades", effectiveValue: 14 }],
    ["command.accepted", 2, null, "declareHandBlock", { command: { type: "declareHandBlock", blockerCardIds: ["sheen-five-clubs"], paymentCardIds: ["sheen-five-diamonds"] } }],
    ["block.declared", 2, null, "declareHandBlock", { player: 2, cardIds: ["sheen-five-clubs"] }],
    ["priority.passed", 1, null, "passPriority", { player: 1 }],
    ["damage.calculated", 2, null, "passPriority", { player: 2, attackValue: 14, blockValue: 5, prevented: 1, damage: 8 }],
    ["damage.dealt", 2, null, "passPriority", { player: 2, amount: 8, from: 8, to: 0 }],
    ["match.ended", null, null, "passPriority", { winner: 1 }]
  ].map(([eventType, actorPlayerNum, targetPlayerNum, commandType, publicPayload], index) => ({
    sequence: index + 1,
    eventId: `${matchId}:league:${index + 1}`,
    commandId: `${matchId}:command:${Math.floor(index / 3) + 1}`,
    commandType,
    eventSequence: index + 1,
    turn: 6,
    phase: eventType === "match.ended" ? "gameOver" : "priority",
    eventType,
    actorPlayerNum,
    targetPlayerNum,
    sourceType: eventType === "attack.declared" ? "hand" : null,
    laneIndex: null,
    publicPayload,
    serverTimestamp: timestamp,
    resultingStateChecksum: checksum
  }));
  return {
    recordVersion: 2,
    matchId,
    seriesId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    mode: "factions",
    rulesVersion: "gauntlet-duel-v2",
    contentVersion: "gauntlet-content-v1",
    ranked: true,
    startedAt: "2026-08-07T17:45:00.000Z",
    completedAt: timestamp,
    completionReason: "life_total",
    abandonmentReason: null,
    winnerPlayerNum: 1,
    turnCount: 6,
    participants: [
      {
        participantId: `${matchId}:p1`, playerNum: 1, identityType: "account",
        accountId: "11111111-1111-4111-8111-111111111111", displayName: "Fixture Alpha",
        faction: { id: "rumin", name: "Rumin" },
        deck: { deckId: "deck-alpha", deckVersionId: "deck-alpha-v3", source: "constructed", format: "constructed" },
        finalLife: 11, result: "win"
      },
      {
        participantId: `${matchId}:p2`, playerNum: 2, identityType: "account",
        accountId: "22222222-2222-4222-8222-222222222222", displayName: "Fixture Beta",
        faction: { id: "sheen", name: "Sheen" },
        deck: { deckId: "deck-beta", deckVersionId: "deck-beta-v2", source: "constructed", format: "constructed" },
        finalLife: 0, result: "loss"
      }
    ],
    campaign: null,
    series: { seriesId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", bestOf: 3, targetWins: 2, gameNumber: 2, scoreAfter: { 1: 2, 2: 0 } },
    draft: null,
    combatStats: {
      attacksResolved: 3, totalAttackValue: 31, totalBlockValue: 9,
      totalDamagePrevented: 10, totalDamageDealt: 21,
      largestAttack: { playerNum: 1, targetPlayerNum: 2, value: 14, damage: 8, blockValue: 5, preventionValue: 1, turn: 6 },
      byPlayer: {
        1: { attacksResolved: 2, attackValue: 24, blockValue: 4, damagePrevented: 4, damageDealt: 14, damageTaken: 7 },
        2: { attacksResolved: 1, attackValue: 7, blockValue: 5, damagePrevented: 6, damageDealt: 7, damageTaken: 14 }
      }
    },
    notableMoments: {
      largestAttack: { playerNum: 1, targetPlayerNum: 2, value: 14, damage: 8, blockValue: 5, preventionValue: 1, turn: 6 },
      finalLifeGap: 11,
      decisiveTurn: 6
    },
    auditEvents: [{ sequence: 1, publicPayload: { message: "Player 1 wins!" }, stateChecksum: checksum }],
    leagueEvidence: evidence,
    leagueEvidenceCoverage: "complete"
  };
}

function buildFixtureExport() {
  return buildParaMatchExport(
    buildFixtureRecord(),
    "https://gauntletonline.com/?match=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "2026-08-07T18:01:00.000Z",
    {
      version: 2,
      storage: {
        mode: "account-only",
        capabilities: {
          completeRecordV2: "process-local",
          publicRecordAfterProcessReplacement: false,
          auditHistoryAfterProcessReplacement: false
        }
      }
    }
  );
}

if (require.main === module) process.stdout.write(`${JSON.stringify(buildFixtureExport(), null, 2)}\n`);

module.exports = { buildFixtureExport, buildFixtureRecord };
