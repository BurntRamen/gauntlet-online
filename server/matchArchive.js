const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { buildReplayTimeline } = require("./matchReplay");

const MATCH_ARCHIVE_HASH_ALGORITHM = "sha256";
const MATCH_ARCHIVE_INDEX_VERSION = "gauntlet.match-archive-index.v1";
const MATCH_ARCHIVE_OBJECT_VERSION = "record-v2";
const MATCH_RECORD_VERSION = 2;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FORBIDDEN_ARCHIVE_KEY = /(reconnect|token|servicerole|secret|credential|password|socket|deckorder|privatehand|privatedeck|privatepeek|privateaudit)/i;

class MatchArchiveError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = "MatchArchiveError";
    this.code = code;
    this.details = details;
  }
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function canonicalValue(value, seen = new Set()) {
  if (value === null || ["string", "boolean"].includes(typeof value)) return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new MatchArchiveError("NON_FINITE_NUMBER", "Canonical match JSON cannot contain a non-finite number.");
    return Object.is(value, -0) ? 0 : value;
  }
  if (!value || typeof value !== "object") {
    throw new MatchArchiveError("UNSUPPORTED_JSON_VALUE", "Canonical match JSON contains an unsupported value.");
  }
  if (seen.has(value)) throw new MatchArchiveError("CYCLIC_JSON", "Canonical match JSON cannot contain circular references.");
  seen.add(value);
  if (Array.isArray(value)) {
    const result = value.map((entry) => canonicalValue(entry, seen));
    seen.delete(value);
    return result;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    seen.delete(value);
    throw new MatchArchiveError("UNSUPPORTED_JSON_VALUE", "Canonical match JSON contains a non-JSON object.");
  }
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] === undefined) throw new MatchArchiveError("UNDEFINED_JSON_VALUE", `Canonical match JSON contains undefined at ${key}.`);
    result[key] = canonicalValue(value[key], seen);
  }
  seen.delete(value);
  return result;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

function sha256(value) {
  return crypto.createHash(MATCH_ARCHIVE_HASH_ALGORITHM).update(value).digest("hex");
}

function archiveObjectKey(record) {
  const completedAt = new Date(record.completedAt);
  if (Number.isNaN(completedAt.getTime())) throw new MatchArchiveError("INVALID_COMPLETED_AT", "Match completion time is invalid.");
  const year = String(completedAt.getUTCFullYear());
  const month = String(completedAt.getUTCMonth() + 1).padStart(2, "0");
  return `matches/${year}/${month}/${record.matchId}/record-v2.json`;
}

function inspectPrivateFields(value, location = "$", findings = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspectPrivateFields(entry, `${location}[${index}]`, findings));
    return findings;
  }
  if (!value || typeof value !== "object") return findings;
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (FORBIDDEN_ARCHIVE_KEY.test(normalizedKey)) findings.push(`${location}.${key}`);
    inspectPrivateFields(child, `${location}.${key}`, findings);
  }
  return findings;
}

function assertArchive(condition, code, message, details = null) {
  if (!condition) throw new MatchArchiveError(code, message, details);
}

function validateParticipants(record) {
  assertArchive(Array.isArray(record.participants) && record.participants.length >= 2, "INVALID_PARTICIPANTS", "A match archive requires at least two participants.");
  const playerNumbers = new Set();
  const participantIds = new Set();
  for (const participant of record.participants) {
    const playerNum = Number(participant?.playerNum);
    assertArchive(Number.isInteger(playerNum) && playerNum > 0, "INVALID_PARTICIPANT_NUMBER", "A match participant has an invalid player number.");
    assertArchive(!playerNumbers.has(playerNum), "DUPLICATE_PARTICIPANT_NUMBER", "A match archive contains duplicate player numbers.");
    playerNumbers.add(playerNum);
    assertArchive(participant.participantId === `${record.matchId}:p${playerNum}`, "INVALID_PARTICIPANT_ID", "A match participant ID is inconsistent with the archived match.");
    assertArchive(typeof participant.displayName === "string" && participant.displayName.trim().length > 0, "INVALID_PARTICIPANT_NAME", "A match participant is missing a display name.");
    assertArchive(["account", "guest", "ai"].includes(participant.identityType), "INVALID_PARTICIPANT_IDENTITY", "A match participant has an unsupported identity type.");
    if (participant.identityType === "account") assertArchive(UUID_PATTERN.test(participant.accountId || ""), "INVALID_ACCOUNT_ID", "An account participant is missing a valid account ID.");
    else assertArchive(participant.accountId == null, "INVALID_ACCOUNT_ID", "A guest or AI participant cannot carry an account ID.");
    if (participant.participantId) {
      assertArchive(!participantIds.has(participant.participantId), "DUPLICATE_PARTICIPANT_ID", "A match archive contains duplicate participant IDs.");
      participantIds.add(participant.participantId);
    }
    assertArchive(typeof participant.faction?.id === "string" && typeof participant.faction?.name === "string", "INVALID_PARTICIPANT_FACTION", "A match participant is missing faction metadata.");
    assertArchive(participant.deck && typeof participant.deck === "object" && !Array.isArray(participant.deck), "INVALID_DECK_SNAPSHOT", "A match participant is missing a deck snapshot.");
    assertArchive(typeof participant.deck.deckVersionId === "string" && participant.deck.deckVersionId.length > 0, "INVALID_DECK_VERSION", "A match participant is missing an immutable deck version.");
    assertArchive(typeof participant.deck.source === "string" && typeof participant.deck.format === "string", "INVALID_DECK_METADATA", "A match participant has incomplete deck metadata.");
    assertArchive(Array.isArray(participant.deck.gameplayCards) && Array.isArray(participant.deck.collectorVariants), "INVALID_DECK_SNAPSHOT", "A match participant has an incomplete deck snapshot.");
    assertArchive(Number.isFinite(Number(participant.finalLife)), "INVALID_FINAL_LIFE", "A match participant has an invalid final life total.");
    if (record.finalLife && Object.hasOwn(record.finalLife, playerNum)) {
      assertArchive(Number(record.finalLife[playerNum]) === Number(participant.finalLife), "FINAL_LIFE_MISMATCH", "A participant final life total does not match the match outcome.");
    }
    assertArchive(["win", "loss", "draw", "abandoned"].includes(participant.result), "INVALID_PARTICIPANT_RESULT", "A match participant has an invalid result.");
  }
  const winners = record.participants.filter((entry) => entry.result === "win");
  if (record.winnerPlayerNum != null) {
    assertArchive(playerNumbers.has(Number(record.winnerPlayerNum)), "INVALID_WINNER", "The match winner is not a participant.");
    assertArchive(winners.length === 1 && Number(winners[0].playerNum) === Number(record.winnerPlayerNum), "WINNER_RESULT_MISMATCH", "The winner participant result is inconsistent.");
  } else {
    assertArchive(winners.length === 0, "WINNER_RESULT_MISMATCH", "A match without a winner cannot contain a winning participant result.");
  }
}

function validateCompletion(record) {
  assertArchive(record.completion?.status === "finalized", "MATCH_NOT_FINALIZED", "Only finalized match records can be archived.");
  assertArchive(typeof record.completion.finalizedAt === "string" && !Number.isNaN(Date.parse(record.completion.finalizedAt)), "INVALID_FINALIZATION_TIME", "The finalized match is missing a valid finalization time.");
  assertArchive(Date.parse(record.completion.finalizedAt) >= Date.parse(record.completedAt), "INVALID_FINALIZATION_TIME", "Match finalization precedes authoritative completion.");
  const receiptKeys = new Set();
  for (const consequence of record.completion.consequences || []) {
    assertArchive(UUID_PATTERN.test(consequence.accountId || ""), "INVALID_CONSEQUENCE_ACCOUNT", "A completion consequence has an invalid account ID.");
    const participant = record.participants.find((entry) => entry.accountId === consequence.accountId);
    assertArchive(participant && Number(participant.playerNum) === Number(consequence.playerNum) && participant.result === consequence.result, "CONSEQUENCE_PARTICIPANT_MISMATCH", "A completion consequence does not match its participant result.");
    const expectedKey = `${record.matchId}:${consequence.accountId}`;
    assertArchive(consequence.receiptKey === expectedKey, "INVALID_RECEIPT_KEY", "A completion consequence has an invalid receipt key.");
    assertArchive(!receiptKeys.has(expectedKey), "DUPLICATE_RECEIPT_KEY", "A match archive contains duplicate account consequence receipts.");
    receiptKeys.add(expectedKey);
  }
}

function validateMatchRecord(record) {
  assertArchive(record && typeof record === "object" && !Array.isArray(record), "INVALID_RECORD", "The archive must contain one match record object.");
  assertArchive(Number(record.recordVersion) === MATCH_RECORD_VERSION, "UNSUPPORTED_RECORD_VERSION", "Only authoritative match record version 2 is supported.");
  assertArchive(UUID_PATTERN.test(record.matchId || ""), "INVALID_MATCH_ID", "The match archive has an invalid match ID.");
  assertArchive(typeof record.mode === "string" && record.mode.length > 0, "INVALID_MODE", "The match archive is missing its mode.");
  assertArchive(typeof record.startedAt === "string" && !Number.isNaN(Date.parse(record.startedAt)), "INVALID_STARTED_AT", "The match archive has an invalid start time.");
  assertArchive(typeof record.completedAt === "string" && !Number.isNaN(Date.parse(record.completedAt)), "INVALID_COMPLETED_AT", "The match archive has an invalid completion time.");
  assertArchive(Date.parse(record.completedAt) >= Date.parse(record.startedAt), "INVALID_MATCH_TIME_RANGE", "The match completion precedes its start.");
  assertArchive(typeof record.completionReason === "string" && record.completionReason.length > 0, "INVALID_COMPLETION_REASON", "The match archive is missing a completion reason.");
  validateParticipants(record);
  validateCompletion(record);
  const privateFields = inspectPrivateFields(record);
  assertArchive(privateFields.length === 0, "PRIVATE_ARCHIVE_FIELD", "The match archive contains a forbidden private field.", { fields: privateFields });
  try {
    buildReplayTimeline(record, {
      mode: "archive",
      capabilities: { completeRecordV2: "durable", publicRecordAfterProcessReplacement: true, auditHistoryAfterProcessReplacement: true }
    });
  } catch (error) {
    if (error?.name === "MatchReplayIntegrityError") {
      throw new MatchArchiveError(error.code || "REPLAY_INTEGRITY_FAILURE", error.message);
    }
    throw error;
  }
  return record;
}

function archiveIndex(record, artifact) {
  const participants = [...record.participants]
    .sort((left, right) => Number(left.playerNum) - Number(right.playerNum))
    .map((participant) => ({
      playerNum: Number(participant.playerNum),
      accountId: participant.accountId || null,
      displayName: participant.displayName,
      factionId: participant.faction?.id || "basic",
      result: participant.result,
      finalLife: Number(participant.finalLife || 0)
    }));
  return {
    indexVersion: MATCH_ARCHIVE_INDEX_VERSION,
    matchId: record.matchId,
    recordVersion: Number(record.recordVersion),
    completedAt: record.completedAt,
    participantAccountIds: participants.map((entry) => entry.accountId).filter(Boolean),
    participants,
    mode: record.mode,
    ranked: !!record.ranked,
    season: record.season ? {
      seasonId: record.season.seasonId || null,
      seasonCode: record.season.seasonCode || null,
      displayName: record.season.displayName || null
    } : null,
    winnerPlayerNum: record.winnerPlayerNum == null ? null : Number(record.winnerPlayerNum),
    completionReason: record.completionReason,
    objectKey: artifact.objectKey,
    sha256: artifact.sha256,
    byteSize: artifact.byteSize,
    archiveStatus: "archived",
    archiveObjectVersion: MATCH_ARCHIVE_OBJECT_VERSION
  };
}

function validateArchiveIndex(index, expectedMatchId = null) {
  assertArchive(index && typeof index === "object" && !Array.isArray(index), "INVALID_ARCHIVE_INDEX", "The match archive index is malformed.");
  assertArchive(UUID_PATTERN.test(index.matchId || ""), "INVALID_ARCHIVE_INDEX_MATCH_ID", "The match archive index has an invalid match ID.");
  if (expectedMatchId) assertArchive(index.matchId === expectedMatchId, "ARCHIVE_INDEX_MATCH_ID_MISMATCH", "The match archive index does not match the requested match.");
  assertArchive(index.indexVersion === MATCH_ARCHIVE_INDEX_VERSION, "UNSUPPORTED_ARCHIVE_INDEX_VERSION", "The match archive index version is unsupported.");
  assertArchive(Number(index.recordVersion) === MATCH_RECORD_VERSION, "UNSUPPORTED_RECORD_VERSION", "The match archive index does not reference record version 2.");
  assertArchive(typeof index.completedAt === "string" && !Number.isNaN(Date.parse(index.completedAt)), "INVALID_ARCHIVE_INDEX_TIME", "The match archive index has an invalid completion time.");
  assertArchive(index.objectKey === archiveObjectKey({ matchId: index.matchId, completedAt: index.completedAt }), "INVALID_ARCHIVE_OBJECT_KEY", "The match archive index has an unexpected object path.");
  assertArchive(/^[0-9a-f]{64}$/.test(index.sha256 || ""), "INVALID_ARCHIVE_HASH", "The match archive index has an invalid SHA-256.");
  assertArchive(Number.isSafeInteger(Number(index.byteSize)) && Number(index.byteSize) > 0, "INVALID_ARCHIVE_SIZE", "The match archive index has an invalid byte size.");
  assertArchive(index.archiveStatus === "archived", "INVALID_ARCHIVE_STATUS", "The match archive index does not identify an archived object.");
  assertArchive(index.archiveObjectVersion === MATCH_ARCHIVE_OBJECT_VERSION, "UNSUPPORTED_ARCHIVE_OBJECT_VERSION", "The match archive object version is unsupported.");
  return index;
}

function createArtifact(record) {
  const normalizedRecord = canonicalValue(record);
  validateMatchRecord(normalizedRecord);
  const json = JSON.stringify(normalizedRecord);
  const bytes = Buffer.from(json, "utf8");
  const artifact = {
    record: clone(normalizedRecord),
    json,
    bytes,
    sha256: sha256(bytes),
    byteSize: bytes.byteLength,
    objectKey: archiveObjectKey(normalizedRecord)
  };
  artifact.index = archiveIndex(normalizedRecord, artifact);
  return artifact;
}

function parseAndVerifyArchive(input, expected = {}) {
  let record;
  try {
    record = typeof input === "string" || Buffer.isBuffer(input)
      ? JSON.parse(Buffer.isBuffer(input) ? input.toString("utf8") : input)
      : clone(input);
  } catch {
    throw new MatchArchiveError("INVALID_JSON", "The selected match archive is not valid JSON.");
  }
  const artifact = createArtifact(record);
  if (expected.matchId) assertArchive(artifact.record.matchId === expected.matchId, "MATCH_ID_MISMATCH", "The archive match ID does not match the requested match.");
  if (expected.sha256) assertArchive(artifact.sha256 === String(expected.sha256).toLowerCase(), "ARCHIVE_HASH_MISMATCH", "The archived JSON does not match its indexed SHA-256.");
  if (expected.byteSize != null) assertArchive(artifact.byteSize === Number(expected.byteSize), "ARCHIVE_SIZE_MISMATCH", "The archived JSON byte size does not match its index.");
  if (expected.indexVersion) {
    validateArchiveIndex(expected, artifact.record.matchId);
    for (const key of Object.keys(artifact.index)) {
      const matches = key === "completedAt"
        ? Date.parse(expected[key]) === Date.parse(artifact.index[key])
        : canonicalJson(expected[key]) === canonicalJson(artifact.index[key]);
      assertArchive(matches, "ARCHIVE_INDEX_PROJECTION_MISMATCH", `The archived JSON does not match indexed field ${key}.`);
    }
  }
  return artifact;
}

function buildMatchPreview(record, archive = null, replay = null) {
  const participants = (record.participants || []).map((entry) => ({
    playerNum: Number(entry.playerNum),
    displayName: entry.displayName,
    faction: clone(entry.faction || null),
    result: entry.result,
    finalLife: Number(entry.finalLife || 0)
  }));
  return {
    matchId: record.matchId,
    recordVersion: Number(record.recordVersion),
    completedAt: record.completedAt,
    mode: record.mode,
    ranked: !!record.ranked,
    season: clone(record.season || null),
    participants,
    winnerPlayerNum: record.winnerPlayerNum == null ? null : Number(record.winnerPlayerNum),
    turnCount: Number(record.turnCount || 0),
    finalLife: clone(record.finalLife || {}),
    largestAttack: clone(record.notableMoments?.largestAttack || null),
    damageDealt: Number(record.combatStats?.totalDamageDealt || 0),
    damagePrevented: Number(record.combatStats?.totalDamagePrevented || 0),
    replay: clone(replay || null),
    archive: archive ? {
      status: archive.archiveStatus || "archived",
      integrity: archive.integrity || "verified",
      sha256: archive.sha256,
      byteSize: Number(archive.byteSize || 0),
      objectVersion: archive.archiveObjectVersion || MATCH_ARCHIVE_OBJECT_VERSION
    } : { status: "unavailable", integrity: "unavailable", sha256: null, byteSize: 0, objectVersion: null }
  };
}

function createLocalArchiveBackend(rootDirectory) {
  const root = path.resolve(rootDirectory);
  const indexRoot = path.join(root, "indexes");
  const objectPath = (key) => path.join(root, ...key.split("/"));
  const indexPath = (matchId) => path.join(indexRoot, `${matchId}.json`);

  function writeExclusive(filename, contents) {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    try {
      fs.writeFileSync(filename, contents, { flag: "wx" });
      return true;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      return false;
    }
  }

  return {
    kind: "local-object-archive",
    async probe() {
      fs.mkdirSync(indexRoot, { recursive: true });
      return { available: true, durable: true, target: root };
    },
    async readIndex(matchId) {
      const filename = indexPath(matchId);
      return fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, "utf8")) : null;
    },
    async writeIndex(index) {
      const filename = indexPath(index.matchId);
      if (!writeExclusive(filename, canonicalJson(index))) {
        const existing = JSON.parse(fs.readFileSync(filename, "utf8"));
        if (existing.sha256 !== index.sha256) throw new MatchArchiveError("ARCHIVE_CONFLICT", "This match ID is already indexed with different canonical JSON.");
        return { created: false, index: existing };
      }
      return { created: true, index };
    },
    async readObject(key) {
      const filename = objectPath(key);
      return fs.existsSync(filename) ? fs.readFileSync(filename) : null;
    },
    async writeObject(key, bytes) {
      const filename = objectPath(key);
      if (!writeExclusive(filename, bytes)) return { created: false, bytes: fs.readFileSync(filename) };
      return { created: true, bytes };
    },
    async listIndexes({ accountId = null, limit = 100 } = {}) {
      if (!fs.existsSync(indexRoot)) return [];
      return fs.readdirSync(indexRoot)
        .filter((name) => name.endsWith(".json"))
        .map((name) => JSON.parse(fs.readFileSync(path.join(indexRoot, name), "utf8")))
        .filter((entry) => !accountId || entry.participantAccountIds?.includes(accountId))
        .sort((left, right) => Date.parse(right.completedAt || 0) - Date.parse(left.completedAt || 0))
        .slice(0, Math.max(1, Math.min(Number(limit) || 100, 500)));
    }
  };
}

function createSupabaseArchiveBackend({ supabaseRequest, storageRequest, bucket = "gauntlet-match-archives" }) {
  function indexFromRow(row) {
    if (!row) return null;
    return {
      indexVersion: row.index_version,
      matchId: row.match_id,
      recordVersion: Number(row.record_version),
      completedAt: row.completed_at,
      participantAccountIds: row.participant_account_ids || [],
      participants: row.participants || [],
      mode: row.mode,
      ranked: !!row.ranked,
      season: row.season || null,
      winnerPlayerNum: row.winner_player_num,
      completionReason: row.completion_reason,
      objectKey: row.archive_object_key,
      sha256: row.archive_sha256,
      byteSize: Number(row.archive_byte_size),
      archiveStatus: row.archive_status,
      archiveObjectVersion: row.archive_object_version
    };
  }
  return {
    kind: "supabase-private-object-archive",
    async probe() {
      await supabaseRequest("gauntlet_match_archive_index?select=match_id&limit=1");
      const bucketResult = await storageRequest(`bucket/${encodeURIComponent(bucket)}`);
      assertArchive(bucketResult && bucketResult.public === false, "ARCHIVE_BUCKET_NOT_PRIVATE", "The configured match archive bucket must be private.");
      return { available: true, durable: true, target: bucket };
    },
    async readIndex(matchId) {
      const rows = await supabaseRequest(`gauntlet_match_archive_index?match_id=eq.${encodeURIComponent(matchId)}&select=*`);
      if (!Array.isArray(rows)) throw new MatchArchiveError("MALFORMED_ARCHIVE_INDEX", "Supabase returned a malformed archive index response.");
      return indexFromRow(rows[0]);
    },
    async writeIndex(index) {
      const existing = await this.readIndex(index.matchId);
      if (existing) {
        if (existing.sha256 !== index.sha256) throw new MatchArchiveError("ARCHIVE_CONFLICT", "This match ID is already indexed with different canonical JSON.");
        return { created: false, index: existing };
      }
      try {
        await supabaseRequest("gauntlet_match_archive_index", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify([{
          match_id: index.matchId,
          index_version: index.indexVersion,
          record_version: index.recordVersion,
          completed_at: index.completedAt,
          participant_account_ids: index.participantAccountIds,
          participants: index.participants,
          mode: index.mode,
          ranked: index.ranked,
          season: index.season,
          winner_player_num: index.winnerPlayerNum,
          completion_reason: index.completionReason,
          archive_object_key: index.objectKey,
          archive_sha256: index.sha256,
          archive_byte_size: index.byteSize,
          archive_status: index.archiveStatus,
            archive_object_version: index.archiveObjectVersion
          }])
        });
      } catch (error) {
        if (Number(error.status) !== 409 && error.code !== "23505") throw error;
        const concurrent = await this.readIndex(index.matchId);
        if (!concurrent || concurrent.sha256 !== index.sha256) {
          throw new MatchArchiveError("ARCHIVE_CONFLICT", "This match ID was concurrently indexed with different canonical JSON.");
        }
        return { created: false, index: concurrent };
      }
      return { created: true, index };
    },
    async readObject(key) {
      const response = await storageRequest(`object/authenticated/${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`, { raw: true, notFound: true });
      return response || null;
    },
    async writeObject(key, bytes) {
      try {
        await storageRequest(`object/${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=0", "x-upsert": "false" },
          body: bytes,
          raw: true
        });
        return { created: true, bytes };
      } catch (error) {
        if (![400, 409].includes(Number(error.status))) throw error;
        const existing = await this.readObject(key);
        if (!existing) throw error;
        return { created: false, bytes: existing };
      }
    },
    async listIndexes({ accountId = null, limit = 100 } = {}) {
      const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
      const filter = accountId ? `participant_account_ids=cs.{${encodeURIComponent(accountId)}}&` : "";
      const rows = await supabaseRequest(`gauntlet_match_archive_index?${filter}select=*&order=completed_at.desc&limit=${safeLimit}`);
      if (!Array.isArray(rows)) throw new MatchArchiveError("MALFORMED_ARCHIVE_INDEX", "Supabase returned a malformed archive list response.");
      return rows.map(indexFromRow).filter(Boolean);
    }
  };
}

function createMatchArchive({ backend, required = true, logger = console }) {
  let availability = { mode: "unknown", available: false, durable: false, target: null, error: null };
  let probePromise = null;

  async function probe() {
    if (availability.mode !== "unknown") return availability;
    if (!probePromise) {
      probePromise = (async () => {
        try {
          const result = await backend.probe();
          availability = { mode: backend.kind, ...result, error: null };
        } catch (error) {
          availability = {
            mode: "archive-unavailable",
            available: false,
            durable: false,
            target: null,
            error: { code: error.code || null, message: error.message || String(error) }
          };
          logger.error?.("[MatchArchive] Durable archive capability is unavailable", availability.error);
        }
        return availability;
      })();
    }
    try { return await probePromise; } finally { probePromise = null; }
  }

  async function ensureAvailable() {
    const state = await probe();
    if (!state.available) throw new MatchArchiveError("ARCHIVE_UNAVAILABLE", "Durable match archive storage is unavailable.", state.error);
    return state;
  }

  async function store(record, options = {}) {
    const artifact = createArtifact(record);
    try {
      await ensureAvailable();
      const existingIndex = await backend.readIndex(record.matchId);
      if (existingIndex) {
        validateArchiveIndex(existingIndex, record.matchId);
        if (existingIndex.sha256 !== artifact.sha256) throw new MatchArchiveError("ARCHIVE_CONFLICT", "This match ID is already archived with different canonical JSON.");
        let existingObject = await backend.readObject(existingIndex.objectKey);
        if (!existingObject) {
          const repaired = await backend.writeObject(existingIndex.objectKey, artifact.bytes);
          existingObject = repaired.bytes;
        }
        parseAndVerifyArchive(existingObject, existingIndex);
        return { status: "already-archived", artifact, index: existingIndex, created: false };
      }
      const objectResult = await backend.writeObject(artifact.objectKey, artifact.bytes);
      if (!objectResult.created) {
        const existingArtifact = parseAndVerifyArchive(objectResult.bytes, { matchId: record.matchId });
        if (existingArtifact.sha256 !== artifact.sha256) throw new MatchArchiveError("ARCHIVE_CONFLICT", "This match ID already has a different immutable archive object.");
      }
      const indexResult = await backend.writeIndex(artifact.index);
      validateArchiveIndex(indexResult.index, record.matchId);
      return { status: indexResult.created ? (options.imported ? "imported" : "archived") : "already-archived", artifact, index: indexResult.index, created: indexResult.created };
    } catch (error) {
      if (required || error.code === "ARCHIVE_CONFLICT") throw error;
      return { status: "degraded", artifact, index: null, created: false, error: { code: error.code || null, message: error.message || String(error) } };
    }
  }

  async function findById(matchId) {
    assertArchive(UUID_PATTERN.test(matchId || ""), "INVALID_MATCH_ID", "The requested match archive ID is invalid.");
    const state = await probe();
    if (!state.available) return null;
    const index = await backend.readIndex(matchId);
    if (!index) return null;
    validateArchiveIndex(index, matchId);
    const bytes = await backend.readObject(index.objectKey);
    assertArchive(bytes, "ARCHIVE_OBJECT_MISSING", "The match archive index points to a missing object.");
    const artifact = parseAndVerifyArchive(bytes, index);
    return { record: artifact.record, index: { ...index, integrity: "verified" }, artifact };
  }

  async function list({ accountId = null, limit = 100 } = {}) {
    const state = await probe();
    return state.available ? backend.listIndexes({ accountId, limit }) : [];
  }

  async function verify(matchId) {
    const archived = await findById(matchId);
    if (!archived) throw new MatchArchiveError("ARCHIVE_NOT_FOUND", "The match archive was not found.");
    return {
      verified: true,
      matchId,
      sha256: archived.artifact.sha256,
      byteSize: archived.artifact.byteSize,
      objectKey: archived.index.objectKey,
      recordVersion: archived.record.recordVersion
    };
  }

  function inspect(input) {
    const artifact = parseAndVerifyArchive(input);
    return {
      verified: true,
      artifact,
      preview: buildMatchPreview(artifact.record, { ...artifact.index, integrity: "verified" })
    };
  }

  function status() {
    return { ...clone(availability), required };
  }

  return { findById, inspect, list, probe, status, store, verify };
}

module.exports = {
  MATCH_ARCHIVE_HASH_ALGORITHM,
  MATCH_ARCHIVE_INDEX_VERSION,
  MATCH_ARCHIVE_OBJECT_VERSION,
  MatchArchiveError,
  archiveIndex,
  archiveObjectKey,
  buildMatchPreview,
  canonicalJson,
  canonicalValue,
  createArtifact,
  createLocalArchiveBackend,
  createMatchArchive,
  createSupabaseArchiveBackend,
  parseAndVerifyArchive,
  sha256,
  validateArchiveIndex,
  validateMatchRecord
};
