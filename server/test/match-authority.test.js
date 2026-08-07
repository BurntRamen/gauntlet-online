const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildAccountMatchIndexEntry,
  buildParaMatchExport,
  projectMatchPerspective,
  publicMatchRecord,
  publicMatchSummary
} = require("../matchRecords");
const { buildCompletionEnvelope, buildPlayerRecap } = require("../matchCompletion");

function recordFor({ campaign = false } = {}) {
  return {
    recordVersion: 2,
    matchId: campaign ? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" : "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    seriesId: null,
    mode: campaign ? "campaign" : "factions",
    ranked: !campaign,
    startedAt: "2026-08-08T10:00:00.000Z",
    completedAt: "2026-08-08T10:08:00.000Z",
    completionReason: "life_total",
    winnerPlayerNum: 1,
    turnCount: 8,
    participants: [
      {
        playerNum: 1,
        accountId: "account-1",
        displayName: "Canonical Alpha",
        identityType: "account",
        faction: { id: "rumin", name: "Rumin" },
        deck: { deckId: "deck-1", deckVersionId: "deck-version-1" },
        result: "win",
        finalLife: 17
      },
      {
        playerNum: 2,
        accountId: campaign ? null : "account-2",
        displayName: campaign ? "Canonical Remex" : "Canonical Beta",
        identityType: campaign ? "ai" : "account",
        faction: { id: "sheen", name: "Sheen" },
        deck: { deckId: null, deckVersionId: "deck-version-2" },
        result: "loss",
        finalLife: 0
      }
    ],
    campaign: campaign ? {
      factionId: "rumin",
      chapterId: "brothers-of-destiny",
      title: "Brothers of Destiny",
      opponentName: "Canonical Remex"
    } : null,
    combatStats: { byPlayer: { 1: { damageDealt: 21, damagePrevented: 4 } } },
    notableMoments: { largestAttack: { playerNum: 1, value: 14 }, finalLifeGap: 17, decisiveTurn: 8 },
    auditEvents: [{ sequence: 1, publicPayload: { message: "Canonical Alpha wins." }, stateChecksum: "checksum" }]
  };
}

for (const campaign of [false, true]) {
  test(`${campaign ? "campaign" : "human"} post-match surfaces share one record-v2 perspective`, () => {
    const record = recordFor({ campaign });
    const perspective = projectMatchPerspective(record, { accountId: "account-1" });
    const deliberatelyStaleConsequence = {
      accountId: "account-1",
      playerNum: 1,
      result: "loss",
      campaign: campaign ? { outcome: "cleared", firstClear: true, clearType: "first-clear" } : null,
      boosterCreditDelta: campaign ? 1 : 0
    };
    const completion = buildCompletionEnvelope({
      record,
      playerNum: 1,
      consequence: deliberatelyStaleConsequence,
      nextMission: campaign ? { status: "available", chapterId: "the-republic", title: "The Republic" } : null
    });
    const recap = buildPlayerRecap(record, 1);
    const publicRecord = publicMatchRecord(record);
    const history = publicMatchSummary(record, { accountId: "account-1" });
    const index = buildAccountMatchIndexEntry(record, { accountId: "account-1" });
    const para = buildParaMatchExport(record);

    assert.equal(perspective.matchId, record.matchId);
    assert.equal(completion.matchId, record.matchId);
    assert.equal(completion.perspective.matchId, record.matchId);
    assert.equal(completion.perspectives.length, 2);
    assert.equal(completion.perspectives[1].outcome, "loss");
    assert.equal(history.perspective.matchId, record.matchId);
    assert.equal(index.matchId, record.matchId);
    assert.equal(para.match.matchId, record.matchId);
    assert.equal(publicRecord.matchId, record.matchId);

    assert.equal(completion.result.outcome, "win");
    assert.equal(completion.perspective.outcome, "win");
    assert.equal(history.perspective.outcome, "win");
    assert.equal(recap.result, "win");
    assert.equal(recap.playerName, "Canonical Alpha");
    assert.equal(recap.opponentName, campaign ? "Canonical Remex" : "Canonical Beta");
    assert.equal(recap.finalLife, 17);
    assert.equal(recap.opponentLife, 0);
    assert.equal(recap.largestAttack.value, 14);
    assert.equal(completion.perspective.player.deck.deckVersionId, "deck-version-1");
    assert.deepEqual(Object.keys(index).sort(), ["completedAt", "deckVersionId", "matchId", "recordVersion"]);
    if (campaign) {
      assert.equal(completion.campaign.title, "Brothers of Destiny");
      assert.equal(completion.campaign.firstClear, true);
      assert.equal(completion.campaign.nextMission.chapterId, "the-republic");
    }
  });
}

test("stale legacy projection fields cannot redefine available record-v2 facts", () => {
  const record = recordFor({ campaign: true });
  const staleLegacyProjection = {
    matchId: record.matchId,
    result: "loss",
    mode: "basic",
    factionId: "wrong",
    factionName: "Wrong Faction",
    opponentName: "Wrong Opponent",
    life: -999,
    opponentLife: 999,
    campaign: { factionId: "wrong", chapterId: "wrong", title: "Wrong Chapter" }
  };
  const history = publicMatchSummary(record, { accountId: "account-1" });
  const completion = buildCompletionEnvelope({ record, playerNum: 1, consequence: staleLegacyProjection });

  assert.equal(history.perspective.outcome, "win");
  assert.equal(history.perspective.mode, "campaign");
  assert.equal(history.perspective.player.faction.name, "Rumin");
  assert.equal(history.perspective.opponent.displayName, "Canonical Remex");
  assert.equal(history.perspective.player.finalLife, 17);
  assert.equal(history.perspective.campaign.title, "Brothers of Destiny");
  assert.equal(completion.result.outcome, "win");
  assert.equal(completion.recap.opponentName, "Canonical Remex");
});
