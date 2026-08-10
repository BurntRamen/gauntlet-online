const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  MatchArchiveError,
  buildMatchPreview,
  canonicalJson,
  createArtifact,
  createLocalArchiveBackend,
  createMatchArchive,
  parseAndVerifyArchive
} = require("../matchArchive");

const MATCH_ID = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";

function recordFixture(overrides = {}) {
  return {
    recordVersion: 2,
    matchId: MATCH_ID,
    seriesId: null,
    mode: "campaign",
    rulesVersion: "rules-v1",
    contentVersion: "content-v1",
    ranked: false,
    season: null,
    startedAt: "2026-08-09T12:00:00.000Z",
    completedAt: "2026-08-09T12:20:00.000Z",
    completionReason: "life_total",
    abandonmentReason: null,
    winnerPlayerNum: 1,
    turnCount: 7,
    participants: [
      {
        participantId: `${MATCH_ID}:p1`,
        playerNum: 1,
        identityType: "account",
        accountId: ACCOUNT_ID,
        displayName: "Archive Alpha",
        faction: { id: "rumin", name: "Rumin" },
        deck: { deckId: null, deckVersionId: "deck-v1", source: "standard", format: "constructed", gameplayCards: [], collectorVariants: [] },
        finalLife: 17,
        result: "win"
      },
      {
        participantId: `${MATCH_ID}:p2`,
        playerNum: 2,
        identityType: "ai",
        accountId: null,
        displayName: "Archive Opponent",
        faction: { id: "sheen", name: "Sheen" },
        deck: { deckId: null, deckVersionId: "deck-v2", source: "standard", format: "constructed", gameplayCards: [], collectorVariants: [] },
        finalLife: -2,
        result: "loss"
      }
    ],
    finalLife: { 1: 17, 2: -2 },
    campaign: { factionId: "rumin", chapterId: "first-march", title: "The First March", opponentName: "Archive Opponent" },
    draft: null,
    series: null,
    combatStats: {
      attacksResolved: 2,
      totalAttackValue: 21,
      totalBlockValue: 4,
      totalDamagePrevented: 4,
      totalDamageDealt: 17,
      largestAttack: { playerNum: 1, targetPlayerNum: 2, value: 13, damage: 9, blockValue: 4, preventionValue: 0, turn: 7 },
      byPlayer: {}
    },
    notableMoments: { largestAttack: { playerNum: 1, targetPlayerNum: 2, value: 13, damage: 9, blockValue: 4, preventionValue: 0, turn: 7 }, finalLifeGap: 19, decisiveTurn: 7 },
    auditEvents: [{ sequence: 1, turn: 7, phase: "gameOver", actorPlayerNum: 1, eventType: "game_completed", publicPayload: { message: "Player 1 wins." }, serverTimestamp: "2026-08-09T12:20:00.000Z", stateChecksum: null }],
    leagueEvidenceVersion: "gauntlet.league-evidence.v1",
    leagueEvidence: [],
    publicReplayFrameVersion: "gauntlet.public-replay-frame.v1",
    publicReplayFrames: [],
    leagueEvidenceCoverage: "unavailable",
    completion: {
      status: "finalized",
      envelopeVersion: "gauntlet.match-completion.v1",
      startedAt: "2026-08-09T12:20:00.000Z",
      finalizedAt: "2026-08-09T12:20:01.000Z",
      consequences: [{
        accountId: ACCOUNT_ID,
        playerNum: 1,
        result: "win",
        boosterCreditDelta: 1,
        campaign: { factionId: "rumin", chapterId: "first-march", outcome: "cleared", firstClear: true },
        receiptKey: `${MATCH_ID}:${ACCOUNT_ID}`
      }]
    },
    ...overrides
  };
}

test("canonical match JSON and SHA-256 are deterministic across key order and formatting", () => {
  const record = recordFixture();
  const reordered = Object.fromEntries(Object.entries(record).reverse());
  const first = createArtifact(record);
  const second = parseAndVerifyArchive(JSON.stringify(reordered, null, 2));

  assert.equal(first.json, second.json);
  assert.equal(first.sha256, second.sha256);
  assert.equal(first.byteSize, Buffer.byteLength(first.json));
  assert.match(first.sha256, /^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(JSON.parse(first.json)), first.json);
});

test("archive writes an immutable object plus lightweight index and survives a fresh instance", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-archive-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const firstProcess = createMatchArchive({ backend: createLocalArchiveBackend(directory) });
  const stored = await firstProcess.store(recordFixture());

  assert.equal(stored.status, "archived");
  assert.equal(stored.index.participantAccountIds[0], ACCOUNT_ID);
  assert.equal(stored.index.participants[0].displayName, "Archive Alpha");
  assert.equal(Object.hasOwn(stored.index, "leagueEvidence"), false);
  assert.equal(Object.hasOwn(stored.index, "record"), false);

  const replacementProcess = createMatchArchive({ backend: createLocalArchiveBackend(directory) });
  const loaded = await replacementProcess.findById(MATCH_ID);
  assert.deepEqual(loaded.record, recordFixture());
  assert.equal(loaded.artifact.sha256, stored.artifact.sha256);
  assert.equal((await replacementProcess.list({ accountId: ACCOUNT_ID }))[0].matchId, MATCH_ID);
  assert.equal((await replacementProcess.verify(MATCH_ID)).verified, true);
});

test("duplicate canonical archive is a no-op and same-ID different bytes fail closed", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-archive-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const archive = createMatchArchive({ backend: createLocalArchiveBackend(directory) });
  const first = await archive.store(recordFixture());
  const duplicate = await archive.store(recordFixture());
  assert.equal(first.status, "archived");
  assert.equal(duplicate.status, "already-archived");
  await assert.rejects(
    () => archive.store(recordFixture({ turnCount: 8 })),
    (error) => error instanceof MatchArchiveError && error.code === "ARCHIVE_CONFLICT"
  );
});

test("retry reconciles an immutable object that exists before its index", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-archive-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const backend = createLocalArchiveBackend(directory);
  const artifact = createArtifact(recordFixture());
  await backend.writeObject(artifact.objectKey, artifact.bytes);
  assert.equal(await backend.readIndex(MATCH_ID), null);

  const archive = createMatchArchive({ backend });
  const reconciled = await archive.store(recordFixture());
  assert.equal(reconciled.status, "archived");
  assert.equal((await archive.verify(MATCH_ID)).sha256, artifact.sha256);
});

test("archive verifier fails closed for unsupported, inconsistent, corrupt, and private records", () => {
  const artifact = createArtifact(recordFixture());
  const cyclicRecord = recordFixture();
  cyclicRecord.cycle = [];
  cyclicRecord.cycle.push(cyclicRecord.cycle);
  assert.throws(() => parseAndVerifyArchive("not json"), { code: "INVALID_JSON" });
  assert.throws(() => createArtifact(recordFixture({ recordVersion: 3 })), { code: "UNSUPPORTED_RECORD_VERSION" });
  assert.throws(() => createArtifact(recordFixture({ winnerPlayerNum: 2 })), { code: "WINNER_RESULT_MISMATCH" });
  assert.throws(() => createArtifact(recordFixture({ reconnectToken: "private" })), { code: "PRIVATE_ARCHIVE_FIELD" });
  assert.throws(() => createArtifact(recordFixture({ token: "private" })), { code: "PRIVATE_ARCHIVE_FIELD" });
  assert.throws(() => createArtifact(recordFixture({ nonJsonValue: new Date() })), { code: "UNSUPPORTED_JSON_VALUE" });
  assert.throws(() => createArtifact(cyclicRecord), { code: "CYCLIC_JSON" });
  assert.throws(() => createArtifact(recordFixture({ completion: { status: "pending" } })), { code: "MATCH_NOT_FINALIZED" });
  assert.equal(parseAndVerifyArchive(artifact.bytes, { ...artifact.index, completedAt: "2026-08-09T12:20:00+00:00" }).sha256, artifact.sha256);
  assert.throws(() => parseAndVerifyArchive(artifact.bytes, { ...artifact.index, objectKey: "../outside.json" }), { code: "INVALID_ARCHIVE_OBJECT_KEY" });
  assert.throws(() => parseAndVerifyArchive(artifact.bytes, { ...artifact.index, mode: "basic" }), { code: "ARCHIVE_INDEX_PROJECTION_MISMATCH" });
});

test("preview is a compact projection of the verified canonical artifact", () => {
  const artifact = createArtifact(recordFixture());
  const preview = buildMatchPreview(artifact.record, { ...artifact.index, integrity: "verified" }, { available: true, mode: "event-only" });
  assert.equal(preview.matchId, MATCH_ID);
  assert.equal(preview.participants[0].displayName, "Archive Alpha");
  assert.equal(preview.largestAttack.value, 13);
  assert.equal(preview.damageDealt, 17);
  assert.equal(preview.archive.sha256, artifact.sha256);
  assert.equal(preview.archive.integrity, "verified");
  assert.equal(canonicalJson(preview).includes("receiptKey"), false);
});

test("optional archive mode exposes a degraded result rather than claiming durability", async () => {
  const archive = createMatchArchive({
    required: false,
    logger: { error() {} },
    backend: { kind: "unavailable-test", async probe() { throw new Error("bucket missing"); } }
  });
  const stored = await archive.store(recordFixture());
  assert.equal(stored.status, "degraded");
  assert.equal(archive.status().available, false);
  assert.match(archive.status().error.message, /bucket missing/);
});

module.exports = { ACCOUNT_ID, MATCH_ID, recordFixture };
