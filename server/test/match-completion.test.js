const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildCompletionEnvelope,
  createFinalizeCompletedMatch,
  receiptKey
} = require("../matchCompletion");

function makeRecord(matchId, chapterId = "first-march") {
  return {
    recordVersion: 2,
    matchId,
    mode: "campaign",
    completedAt: "2026-08-05T12:00:00.000Z",
    winnerPlayerNum: 1,
    turnCount: 8,
    participants: [
      { playerNum: 1, accountId: "account-1", displayName: "Commander", result: "win", finalLife: 12, faction: { id: "rumin", name: "Rumin" } },
      { playerNum: 2, accountId: null, displayName: "The Brass Regent", result: "loss", finalLife: -1, faction: { id: "rumin", name: "Rumin" } }
    ],
    campaign: { factionId: "rumin", chapterId, title: "The First March" },
    auditEvents: [{ publicPayload: { message: "Player 1 wins the game." } }],
    notableMoments: { largestAttack: null }
  };
}

function makeHarness({ failPersist = false, failConsequence = false } = {}) {
  const records = new Map();
  const receipts = new Map();
  const accounts = new Map([["account-1", { id: "account-1", stats: { gamesPlayed: 0, collection: { packCredits: 0 }, progression: { campaign: {} } } }]]);
  let persistCalls = 0;
  let consequenceCalls = 0;
  const service = createFinalizeCompletedMatch({
    findMatchRecord: async (matchId) => records.get(matchId) || null,
    persistMatchRecord: async (record) => {
      persistCalls += 1;
      if (failPersist) throw new Error("record write failed");
      records.set(record.matchId, structuredClone(record));
    },
    applyAccountConsequence: async (consequence) => {
      consequenceCalls += 1;
      if (failConsequence) throw new Error("account write failed");
      const key = receiptKey(consequence.matchId || "match", consequence.accountId);
      const account = accounts.get(consequence.accountId);
      if (!account) throw new Error("account missing");
      if (receipts.has(key)) return receipts.get(key);
      const facts = {
        result: consequence.result,
        boosterCreditDelta: consequence.result === "win" ? 1 : 0,
        boosterCreditReason: "campaign_first_clear",
        campaign: consequence.result === "win" ? { outcome: "cleared", firstClear: true, clearType: "first-clear" } : { outcome: "not-cleared", firstClear: false },
        progression: { campaign: { rumin: [consequence.context.campaign.chapterId] } },
        achievementsUnlocked: [{ id: "first-campaign-clear" }],
        cosmeticsUnlocked: [{ bucket: "titles", id: "campaigner" }],
        account: { ...account, stats: { ...account.stats, gamesPlayed: 1, gamesWon: 1, collection: { packCredits: 1 }, progression: { campaign: { rumin: [consequence.context.campaign.chapterId] } } } }
      };
      receipts.set(key, facts);
      return facts;
    },
    buildNextMission: async () => ({ status: "available", factionId: "rumin", chapterId: "second-march", title: "The Second March" })
  });
  return { service, records, receipts, accounts, get persistCalls() { return persistCalls; }, get consequenceCalls() { return consequenceCalls; } };
}

test("finalizes a campaign victory once and returns the durable completion envelope", async () => {
  const harness = makeHarness();
  const record = makeRecord("match-1");
  const consequence = { matchId: record.matchId, accountId: "account-1", playerNum: 1, result: "win", context: { campaign: record.campaign } };

  const first = await harness.service.finalizeCompletedMatch({ record, consequences: [consequence] });
  const retry = await harness.service.finalizeCompletedMatch({ record, consequences: [consequence] });

  assert.equal(first.envelope.matchId, "match-1");
  assert.equal(first.envelope.campaign.firstClear, true);
  assert.equal(first.envelope.rewards.boosterCreditDelta, 1);
  assert.equal(first.envelope.campaign.nextMission.chapterId, "second-march");
  assert.equal(retry.alreadyFinalized, true);
  assert.equal(harness.records.size, 1);
  assert.equal(harness.consequenceCalls, 1);
});

test("concurrent finalization shares one operation and cannot duplicate consequences", async () => {
  const harness = makeHarness();
  const record = makeRecord("match-concurrent");
  const consequence = { matchId: record.matchId, accountId: "account-1", playerNum: 1, result: "win", context: { campaign: record.campaign } };
  const results = await Promise.all([
    harness.service.finalizeCompletedMatch({ record, consequences: [consequence] }),
    harness.service.finalizeCompletedMatch({ record, consequences: [consequence] })
  ]);
  assert.equal(harness.consequenceCalls, 1);
  assert.equal(new Set(results.map((result) => result.envelope.matchId)).size, 1);
});

test("completion envelope projects seasonal consequence without replacing match facts", () => {
  const record = makeRecord("match-season");
  record.ranked = true;
  record.season = { seasonId: "season-zero", seasonCode: "S0", displayName: "Season Zero", format: "ranked-bo1" };
  const envelope = buildCompletionEnvelope({
    record,
    playerNum: 1,
    consequence: {
      season: {
        result: "win",
        seriesResult: "win",
        pointsDelta: 3,
        rank: 2,
        record: { gamesPlayed: 2, wins: 2, losses: 0, draws: 0, points: 6 }
      }
    }
  });
  assert.equal(envelope.match.season.seasonId, "season-zero");
  assert.equal(envelope.perspective.outcome, "win");
  assert.equal(envelope.season.pointsDelta, 3);
  assert.equal(envelope.season.record.points, 6);
  assert.equal(envelope.season.rank, 2);
});

test("a loss has no campaign clear or booster reward", async () => {
  const harness = makeHarness();
  const record = makeRecord("match-loss");
  record.winnerPlayerNum = 2;
  record.participants[0].result = "loss";
  record.participants[1].result = "win";
  const consequence = { matchId: record.matchId, accountId: "account-1", playerNum: 1, result: "loss", context: { campaign: record.campaign } };
  const result = await harness.service.finalizeCompletedMatch({ record, consequences: [consequence] });
  assert.equal(result.envelope.campaign.firstClear, false);
  assert.equal(result.envelope.rewards.boosterCreditDelta, 0);
});

test("a record failure prevents account consequences, and a consequence failure leaves no finalized envelope", async () => {
  const record = makeRecord("match-failure");
  const consequence = { matchId: record.matchId, accountId: "account-1", playerNum: 1, result: "win", context: { campaign: record.campaign } };
  const recordFailure = makeHarness({ failPersist: true });
  await assert.rejects(() => recordFailure.service.finalizeCompletedMatch({ record, consequences: [consequence] }));
  assert.equal(recordFailure.consequenceCalls, 0);

  const consequenceFailure = makeHarness({ failConsequence: true });
  await assert.rejects(() => consequenceFailure.service.finalizeCompletedMatch({ record, consequences: [consequence] }));
  assert.equal(consequenceFailure.records.get(record.matchId).completion.status, "pending");
});
