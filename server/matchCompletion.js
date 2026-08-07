const MATCH_COMPLETION_ENVELOPE_VERSION = "gauntlet.match-completion.v1";

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function receiptKey(matchId, accountId) {
  return `${matchId}:${accountId}`;
}

function buildPlayerRecap(record, playerNum) {
  const participant = record?.participants?.find((entry) => Number(entry.playerNum) === Number(playerNum));
  const opponent = record?.participants?.find((entry) => Number(entry.playerNum) !== Number(playerNum));
  const result = participant?.result || "unknown";
  const headline = result === "win" ? "Victory" : result === "loss" ? "Defeat" : result === "draw" ? "Draw" : "Match complete";
  const finalMessage = [...(record?.auditEvents || [])]
    .reverse()
    .find((event) => event?.publicPayload?.message)?.publicPayload?.message || null;
  return {
    headline,
    result,
    playerName: participant?.displayName || `Player ${playerNum}`,
    opponentName: opponent?.displayName || "Opponent",
    factionName: participant?.faction?.name || null,
    finalLife: participant?.finalLife ?? null,
    opponentLife: opponent?.finalLife ?? null,
    turnCount: record?.turnCount ?? null,
    finalMessage,
    largestAttack: clone(record?.notableMoments?.largestAttack || null)
  };
}

function buildCompletionEnvelope({ record, playerNum, consequence = null, account = null, nextMission = null }) {
  const publicMatch = clone(record);
  if (publicMatch) delete publicMatch.completion;
  const progression = consequence?.progression || {};
  return {
    envelopeVersion: MATCH_COMPLETION_ENVELOPE_VERSION,
    matchId: record?.matchId || null,
    match: publicMatch,
    result: {
      playerNum: playerNum == null ? null : Number(playerNum),
      outcome: consequence?.result || record?.participants?.find((entry) => Number(entry.playerNum) === Number(playerNum))?.result || "unknown",
      winnerPlayerNum: record?.winnerPlayerNum ?? null
    },
    campaign: record?.campaign ? {
      factionId: record.campaign.factionId,
      chapterId: record.campaign.chapterId,
      title: record.campaign.title,
      outcome: consequence?.campaign?.outcome || "not-cleared",
      clearType: consequence?.campaign?.clearType || null,
      firstClear: consequence?.campaign?.firstClear === true,
      repeatClear: consequence?.campaign?.firstClear === false,
      nextMission
    } : null,
    rewards: {
      boosterCreditDelta: Number(consequence?.boosterCreditDelta || 0),
      reason: consequence?.boosterCreditReason || null,
      achievementsUnlocked: clone(consequence?.achievementsUnlocked || []),
      cosmeticsUnlocked: clone(consequence?.cosmeticsUnlocked || [])
    },
    progression: {
      campaign: clone(progression.campaign || null),
      accountTotals: account ? {
        gamesPlayed: Number(account.stats?.gamesPlayed || 0),
        gamesWon: Number(account.stats?.gamesWon || 0),
        gamesLost: Number(account.stats?.gamesLost || 0),
        gamesDrawn: Number(account.stats?.gamesDrawn || 0),
        packCredits: Number(account.stats?.collection?.packCredits || 0)
      } : null
    },
    recap: buildPlayerRecap(record, playerNum),
    createdAt: record?.completedAt || new Date().toISOString()
  };
}

function createFinalizeCompletedMatch({
  findMatchRecord,
  persistMatchRecord,
  applyAccountConsequence,
  buildEnvelope = buildCompletionEnvelope,
  buildNextMission = () => null,
  now = () => new Date().toISOString()
}) {
  const inFlight = new Map();

  async function finalizeCompletedMatch({ record, consequences = [], playerNum = 1 }) {
    if (!record?.matchId) throw new Error("A match ID is required to finalize a completed match.");
    const existing = await findMatchRecord(record.matchId);
    if (existing?.completion?.status === "finalized") {
      const existingConsequence = existing.completion.consequences?.find((entry) => Number(entry.playerNum) === Number(playerNum)) || existing.completion.consequences?.[0] || null;
      return {
        alreadyFinalized: true,
        record: existing,
        envelope: buildEnvelope({
          record: existing,
          playerNum,
          consequence: existingConsequence,
          account: null,
          nextMission: existingConsequence?.nextMission || null
        })
      };
    }

    if (inFlight.has(record.matchId)) return inFlight.get(record.matchId);
    const operation = (async () => {
      const pending = {
        ...clone(record),
        completion: {
          status: "pending",
          envelopeVersion: MATCH_COMPLETION_ENVELOPE_VERSION,
          startedAt: now()
        }
      };
      await persistMatchRecord(pending);

      const appliedConsequences = [];
      const appliedAccounts = new Map();
      const accountApplications = [];
      for (const consequence of consequences) {
        if (!consequence?.accountId) continue;
        const applied = await applyAccountConsequence(consequence);
        if (applied?.account) appliedAccounts.set(consequence.accountId, applied.account);
        const { account: _accountProjection, nextStats: _nextStats, ...consequenceFacts } = applied || {};
        accountApplications.push({
          accountId: consequence.accountId,
          result: consequence.result,
          context: clone(consequence.context || {}),
          consequence: clone(consequenceFacts),
          nextStats: clone(applied?.nextStats || null)
        });
        const campaign = consequence.campaign || consequence.context?.campaign || null;
        const nextMission = campaign ? await buildNextMission({
          account: applied?.account || consequence.account,
          factionId: campaign.factionId,
          chapterId: campaign.chapterId,
          result: consequence.result
        }) : null;
        appliedConsequences.push({
          accountId: consequence.accountId,
          playerNum: consequence.playerNum,
          result: consequence.result,
          boosterCreditDelta: Number(applied?.boosterCreditDelta || consequence.boosterCreditDelta || 0),
          boosterCreditReason: applied?.boosterCreditReason || consequence.boosterCreditReason || null,
          campaign: applied?.campaign || campaign,
          achievementsUnlocked: clone(applied?.achievementsUnlocked || []),
          cosmeticsUnlocked: clone(applied?.cosmeticsUnlocked || []),
          progression: clone(applied?.progression || null),
          nextMission,
          receiptKey: receiptKey(record.matchId, consequence.accountId)
        });
      }

      const finalized = {
        ...pending,
        completion: {
          ...pending.completion,
          status: "finalized",
          finalizedAt: now(),
          consequences: appliedConsequences
        }
      };
      await persistMatchRecord(finalized, { accountApplications });
      const playerConsequence = appliedConsequences.find((entry) => Number(entry.playerNum) === Number(playerNum)) || appliedConsequences[0] || null;
      return {
        alreadyFinalized: false,
        record: finalized,
        envelope: buildEnvelope({
          record: finalized,
          playerNum,
          consequence: playerConsequence,
          account: playerConsequence ? appliedAccounts.get(playerConsequence.accountId) || null : null,
          nextMission: playerConsequence?.nextMission || null
        })
      };
    })();
    inFlight.set(record.matchId, operation);
    try {
      return await operation;
    } finally {
      inFlight.delete(record.matchId);
    }
  }

  return { finalizeCompletedMatch, receiptKey, envelopeVersion: MATCH_COMPLETION_ENVELOPE_VERSION };
}

module.exports = {
  MATCH_COMPLETION_ENVELOPE_VERSION,
  buildCompletionEnvelope,
  buildPlayerRecap,
  createFinalizeCompletedMatch,
  receiptKey
};
