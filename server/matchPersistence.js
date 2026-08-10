const MATCH_JOURNAL_KIND = "gauntlet.match-journal";
const MATCH_JOURNAL_VERSION = 1;
const MATCH_RECORD_VERSION = 2;

const CAPABILITY_ERROR_CODES = new Set([
  "42P01",
  "42501",
  "PGRST202",
  "PGRST204",
  "PGRST205"
]);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isCapabilityError(error) {
  return CAPABILITY_ERROR_CODES.has(String(error?.code || "").toUpperCase());
}

function journalId(matchId) {
  return `match:${matchId}`;
}

function journalPayload(record, updatedAt) {
  return {
    kind: MATCH_JOURNAL_KIND,
    version: MATCH_JOURNAL_VERSION,
    record: clone(record),
    updatedAt
  };
}

function recordFromJournalRow(row, expectedMatchId = null) {
  const data = row?.data;
  if (!data) return null;
  if (data.kind !== MATCH_JOURNAL_KIND || Number(data.version) !== MATCH_JOURNAL_VERSION) {
    throw new Error("Invalid Gauntlet match journal envelope.");
  }
  const record = data.record;
  if (!record || Number(record.recordVersion) !== MATCH_RECORD_VERSION || !record.matchId) {
    throw new Error("Invalid canonical match record in Gauntlet match journal.");
  }
  if (expectedMatchId && record.matchId !== expectedMatchId) {
    throw new Error("Gauntlet match journal ID does not match its canonical record.");
  }
  return record;
}

function createMatchPersistence({
  useSupabaseStore,
  supabaseRequest,
  localStore,
  toPreferredRow,
  commitCompatibilityApplications = async () => {},
  now = () => new Date().toISOString(),
  logger = console
}) {
  let mode = useSupabaseStore() ? "unknown" : "local";
  let fallbackReason = null;
  let capabilityProbe = null;

  function setMode(nextMode, error = null) {
    if (mode === nextMode) return;
    mode = nextMode;
    fallbackReason = error ? { code: error.code || null, message: error.message || String(error) } : null;
    if (nextMode === "compatibility") {
      logger.warn?.("[Matches] Dedicated match storage is unavailable; using namespaced faction-stats journals.", fallbackReason);
    } else if (nextMode === "account-only") {
      logger.warn?.("[Matches] Durable match journals are unavailable; using account-only consequence persistence.", fallbackReason);
    }
  }

  async function probeCompatibility(error) {
    try {
      await supabaseRequest("gauntlet_faction_stats?select=id&limit=1");
      setMode("compatibility", error);
    } catch (compatibilityError) {
      if (!isCapabilityError(compatibilityError)) throw compatibilityError;
      setMode("account-only", compatibilityError);
    }
    return mode;
  }

  async function getMode() {
    if (mode !== "unknown") return mode;
    if (capabilityProbe) return capabilityProbe;
    capabilityProbe = (async () => {
      try {
        await supabaseRequest("gauntlet_match_records?select=id&limit=1");
        setMode("preferred");
      } catch (error) {
        if (!isCapabilityError(error)) throw error;
        await probeCompatibility(error);
      }
      return mode;
    })();
    try {
      return await capabilityProbe;
    } finally {
      capabilityProbe = null;
    }
  }

  async function fallBackFromPreferred(error) {
    if (!isCapabilityError(error)) throw error;
    return probeCompatibility(error);
  }

  async function writeJournal(record) {
    const updatedAt = now();
    try {
      await supabaseRequest("gauntlet_faction_stats?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify([{
          id: journalId(record.matchId),
          data: journalPayload(record, updatedAt),
          updated_at: updatedAt
        }])
      });
      return record;
    } catch (error) {
      if (!isCapabilityError(error)) throw error;
      setMode("account-only", error);
      return localStore.upsert(record);
    }
  }

  async function persistPreferred(record, options) {
    if (record.completion?.status === "finalized") {
      await supabaseRequest("rpc/finalize_gauntlet_match", {
        method: "POST",
        body: JSON.stringify({
          p_record: record,
          p_events: record.auditEvents || [],
          p_consequences: (record.completion.consequences || []).map((consequence) => ({
            accountId: consequence.accountId,
            playerNum: consequence.playerNum,
            result: consequence.result,
            ...consequence
          })),
          p_account_applications: options.accountApplications || []
        })
      });
      return record;
    }

    await supabaseRequest("gauntlet_match_records?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([toPreferredRow(record)])
    });
    if ((record.auditEvents || []).length > 0) {
      await supabaseRequest("gauntlet_match_events?on_conflict=match_id,sequence", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(record.auditEvents.map((event) => ({
          match_id: record.matchId,
          sequence: event.sequence,
          turn: event.turn,
          phase: event.phase,
          actor_player_num: event.actorPlayerNum,
          event_type: event.eventType,
          public_payload: event.publicPayload,
          server_timestamp: event.serverTimestamp,
          state_checksum: event.stateChecksum
        })))
      });
    }
    return record;
  }

  async function persist(record, options = {}) {
    const activeMode = await getMode();
    if (activeMode === "local" || activeMode === "account-only") {
      if (record.completion?.status === "finalized" && (options.accountApplications || []).length > 0) {
        await commitCompatibilityApplications(record.matchId, options.accountApplications);
      }
      return localStore.upsert(record);
    }
    if (activeMode === "compatibility") return writeJournal(record);

    try {
      return await persistPreferred(record, options);
    } catch (error) {
      const fallbackMode = await fallBackFromPreferred(error);
      if (fallbackMode === "account-only") return localStore.upsert(record);
      if (record.completion?.status === "finalized" && (options.accountApplications || []).length > 0) {
        await commitCompatibilityApplications(record.matchId, options.accountApplications);
      }
      return writeJournal(record);
    }
  }

  async function readJournal(matchId) {
    const rows = await supabaseRequest(
      `gauntlet_faction_stats?id=eq.${encodeURIComponent(journalId(matchId))}&select=data`
    );
    if (!Array.isArray(rows)) throw new Error("Malformed Gauntlet match journal response.");
    return rows.length > 0 ? recordFromJournalRow(rows[0], matchId) : null;
  }

  async function findById(matchId) {
    const activeMode = await getMode();
    if (activeMode === "local" || activeMode === "account-only") return localStore.findById(matchId);
    if (activeMode === "compatibility") return readJournal(matchId);
    try {
      const rows = await supabaseRequest(`gauntlet_match_records?id=eq.${encodeURIComponent(matchId)}&select=record`);
      if (!Array.isArray(rows)) throw new Error("Malformed Gauntlet match record response.");
      return rows?.[0]?.record || null;
    } catch (error) {
      const fallbackMode = await fallBackFromPreferred(error);
      return fallbackMode === "compatibility" ? readJournal(matchId) : localStore.findById(matchId);
    }
  }

  async function listByAccount(accountId, limit = 30, indexedMatchIds = []) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 30, 100));
    const activeMode = await getMode();
    if (activeMode === "local" || activeMode === "account-only") {
      return localStore.listByAccount(accountId, safeLimit);
    }
    if (activeMode === "preferred") {
      try {
        const rows = await supabaseRequest(
          `gauntlet_match_records?participant_account_ids=cs.{${encodeURIComponent(accountId)}}&select=record&order=completed_at.desc&limit=${safeLimit}`
        );
        if (!Array.isArray(rows)) throw new Error("Malformed Gauntlet match history response.");
        return rows.map((row) => row.record).filter(Boolean);
      } catch (error) {
        const fallbackMode = await fallBackFromPreferred(error);
        if (fallbackMode === "account-only") return localStore.listByAccount(accountId, safeLimit);
      }
    }

    const ids = [...new Set(indexedMatchIds.filter(Boolean))].slice(0, safeLimit);
    const records = await Promise.all(ids.map((matchId) => readJournal(matchId)));
    return records.filter((record) => record?.participants?.some((participant) => participant.accountId === accountId));
  }

  function status() {
    const durableRecordV2 = mode === "preferred" || mode === "compatibility" || mode === "local";
    return {
      mode,
      capabilities: {
        accountConsequences: mode === "local" ? "local-json" : "durable",
        accountMatchIndex: mode === "local" ? "local-json" : "durable",
        completeRecordV2: durableRecordV2 ? "durable" : "process-local",
        publicRecordAfterProcessReplacement: durableRecordV2,
        completionAfterProcessReplacement: durableRecordV2,
        auditHistoryAfterProcessReplacement: durableRecordV2
      },
      fallbackReason: clone(fallbackReason)
    };
  }

  return { findById, getMode, listByAccount, persist, status };
}

module.exports = {
  CAPABILITY_ERROR_CODES,
  MATCH_JOURNAL_KIND,
  MATCH_JOURNAL_VERSION,
  createMatchPersistence,
  isCapabilityError,
  journalId,
  journalPayload,
  recordFromJournalRow
};
