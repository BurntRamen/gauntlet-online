const {
  MatchArchiveError,
  canonicalJson,
  canonicalValue,
  sha256Hex,
  utf8Bytes
} = require("./canonical");
const { buildReplayTimeline, replayAvailability } = require("./replay");

const MATCH_ARCHIVE_INDEX_VERSION = "gauntlet.match-archive-index.v1";
const MATCH_ARCHIVE_OBJECT_VERSION = "record-v2";
const MATCH_RECORD_VERSION = 2;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FORBIDDEN_ARCHIVE_KEY = /(reconnect|token|servicerole|secret|credential|password|socket|deckorder|privatehand|privatedeck|privatepeek|privateaudit)/i;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
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
    assertArchive(!participantIds.has(participant.participantId), "DUPLICATE_PARTICIPANT_ID", "A match archive contains duplicate participant IDs.");
    participantIds.add(participant.participantId);
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
    buildReplayTimeline(record, { mode: "portable-json", capabilities: { completeRecordV2: "local", publicRecordAfterProcessReplacement: true } });
  } catch (error) {
    if (error?.name === "MatchReplayIntegrityError") throw new MatchArchiveError(error.code || "REPLAY_INTEGRITY_FAILURE", error.message);
    throw error;
  }
  return record;
}

function archiveIndex(record, artifact) {
  const participants = [...record.participants].sort((left, right) => Number(left.playerNum) - Number(right.playerNum)).map((participant) => ({
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
    season: record.season ? { seasonId: record.season.seasonId || null, seasonCode: record.season.seasonCode || null, displayName: record.season.displayName || null } : null,
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
  const bytes = utf8Bytes(json);
  const artifact = {
    record: clone(normalizedRecord),
    json,
    bytes,
    sha256: sha256Hex(bytes),
    byteSize: bytes.byteLength,
    objectKey: archiveObjectKey(normalizedRecord)
  };
  artifact.index = archiveIndex(normalizedRecord, artifact);
  return artifact;
}

function parseAndVerifyArchive(input, expected = {}) {
  let record;
  try {
    if (typeof input === "string") record = JSON.parse(input);
    else if (input instanceof Uint8Array || input instanceof ArrayBuffer) record = JSON.parse(new TextDecoder().decode(input));
    else record = clone(input);
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
    evidenceCount: Array.isArray(record.leagueEvidence) ? record.leagueEvidence.length : 0,
    replayFrameCount: Array.isArray(record.publicReplayFrames) ? record.publicReplayFrames.length : 0,
    replay: clone(replay || replayAvailability(record)),
    archive: archive ? {
      status: archive.archiveStatus || "archived",
      integrity: archive.integrity || "verified",
      sha256: archive.sha256,
      byteSize: Number(archive.byteSize || 0),
      objectVersion: archive.archiveObjectVersion || MATCH_ARCHIVE_OBJECT_VERSION
    } : { status: "local", integrity: "canonical-hash-verified", sha256: null, byteSize: 0, objectVersion: MATCH_ARCHIVE_OBJECT_VERSION }
  };
}

module.exports = {
  MATCH_ARCHIVE_INDEX_VERSION,
  MATCH_ARCHIVE_OBJECT_VERSION,
  MATCH_RECORD_VERSION,
  MatchArchiveError,
  archiveObjectKey,
  buildMatchPreview,
  createArtifact,
  parseAndVerifyArchive,
  validateArchiveIndex,
  validateMatchRecord
};
