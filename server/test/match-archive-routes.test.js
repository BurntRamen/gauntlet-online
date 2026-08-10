const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-archive-routes-"));
process.env.ACCOUNT_DATA_FILE = path.join(tempRoot, "accounts.json");
process.env.MATCH_DATA_FILE = path.join(tempRoot, "matches.json");
process.env.MATCH_ARCHIVE_DATA_DIR = path.join(tempRoot, "archives");
process.env.ACCOUNT_AUTH_SECRET = "match-archive-route-test-secret";
process.env.OWNER_STATS_TOKEN = "match-archive-owner-secret";
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { server, __test } = require("../index");
const { createArtifact } = require("../matchArchive");

let origin;

test.before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

async function jsonRequest(pathname, options = {}) {
  const response = await fetch(`${origin}${pathname}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null, text };
}

function archivedRecord(accountId) {
  const matchId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  return {
    recordVersion: 2,
    matchId,
    seriesId: null,
    mode: "factions",
    rulesVersion: "rules-v1",
    contentVersion: "content-v1",
    ranked: true,
    season: { seasonId: "season-zero", seasonCode: "S0", displayName: "Season Zero" },
    startedAt: "2026-08-09T10:00:00.000Z",
    completedAt: "2026-08-09T10:12:00.000Z",
    completionReason: "life_total",
    abandonmentReason: null,
    winnerPlayerNum: 1,
    turnCount: 6,
    participants: [
      { participantId: `${matchId}:p1`, playerNum: 1, identityType: "account", accountId, displayName: "Archive Routes", faction: { id: "rumin", name: "Rumin" }, deck: { deckVersionId: "deck-a", source: "standard", format: "constructed", gameplayCards: [], collectorVariants: [] }, finalLife: 14, result: "win" },
      { participantId: `${matchId}:p2`, playerNum: 2, identityType: "ai", accountId: null, displayName: "Archive AI", faction: { id: "sheen", name: "Sheen" }, deck: { deckVersionId: "deck-b", source: "standard", format: "constructed", gameplayCards: [], collectorVariants: [] }, finalLife: -3, result: "loss" }
    ],
    finalLife: { 1: 14, 2: -3 },
    series: null,
    campaign: null,
    draft: null,
    combatStats: { attacksResolved: 1, totalAttackValue: 15, totalBlockValue: 3, totalDamagePrevented: 3, totalDamageDealt: 12, largestAttack: { playerNum: 1, targetPlayerNum: 2, value: 15, damage: 12, blockValue: 3, preventionValue: 0, turn: 6 }, byPlayer: {} },
    notableMoments: { largestAttack: { playerNum: 1, targetPlayerNum: 2, value: 15, damage: 12, blockValue: 3, preventionValue: 0, turn: 6 }, finalLifeGap: 17, decisiveTurn: 6 },
    auditEvents: [{ sequence: 1, turn: 6, phase: "gameOver", actorPlayerNum: 1, eventType: "game_completed", publicPayload: { message: "Player 1 wins." }, serverTimestamp: "2026-08-09T10:12:00.000Z", stateChecksum: null }],
    leagueEvidenceVersion: "gauntlet.league-evidence.v1",
    leagueEvidence: [],
    publicReplayFrameVersion: "gauntlet.public-replay-frame.v1",
    publicReplayFrames: [],
    leagueEvidenceCoverage: "unavailable",
    completion: {
      status: "finalized",
      envelopeVersion: "gauntlet.match-completion.v1",
      startedAt: "2026-08-09T10:12:00.000Z",
      finalizedAt: "2026-08-09T10:12:01.000Z",
      consequences: [{ accountId, playerNum: 1, result: "win", boosterCreditDelta: 0, receiptKey: `${matchId}:${accountId}` }]
    }
  };
}

test("Match Record, Replay, Para, JSON export, verify, and import use the same archived record", async () => {
  const registration = await jsonRequest("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: "Archive Routes", password: "archive-test-password" })
  });
  assert.equal(registration.response.status, 200);
  const { token, account } = registration.body;
  const record = archivedRecord(account.id);
  const stored = await __test.matchArchive.store(record);
  assert.equal(stored.status, "archived");

  const match = await jsonRequest(`/api/matches/${record.matchId}`);
  assert.equal(match.response.status, 200);
  assert.equal(match.body.match.matchId, record.matchId);
  assert.equal(match.body.match.archive.integrity, "verified");
  assert.equal(match.body.preview.largestAttack.value, 15);

  const replay = await jsonRequest(`/api/matches/${record.matchId}/replay`);
  assert.equal(replay.response.status, 200);
  assert.equal(replay.body.replay.matchId, record.matchId);

  const firstPara = await jsonRequest(`/api/matches/${record.matchId}/export/para?version=2`);
  const secondPara = await jsonRequest(`/api/matches/${record.matchId}/export/para?version=2`);
  assert.equal(firstPara.response.status, 200);
  assert.equal(firstPara.body.verification.contentHash, secondPara.body.verification.contentHash);

  const unauthorized = await jsonRequest(`/api/matches/${record.matchId}/archive`);
  assert.equal(unauthorized.response.status, 401);
  const archiveResponse = await fetch(`${origin}/api/matches/${record.matchId}/archive`, { headers: { Authorization: `Bearer ${token}` } });
  const archiveText = await archiveResponse.text();
  assert.equal(archiveResponse.status, 200);
  assert.equal(archiveText, createArtifact(record).json);
  assert.match(archiveResponse.headers.get("content-disposition"), /gauntlet-match-/);

  const ownerSession = await jsonRequest("/api/admin/session", {
    method: "POST",
    body: JSON.stringify({ ownerToken: process.env.OWNER_STATS_TOKEN })
  });
  const ownerHeaders = { "x-owner-session": ownerSession.body.sessionToken };
  const preview = await jsonRequest("/api/admin/match-archive/import/preview", {
    method: "POST",
    headers: ownerHeaders,
    body: JSON.stringify({ record })
  });
  assert.equal(preview.response.status, 200);
  assert.equal(preview.body.status, "already-archived");
  assert.equal(preview.body.sha256, stored.artifact.sha256);

  const duplicate = await jsonRequest("/api/admin/match-archive/import/commit", {
    method: "POST",
    headers: ownerHeaders,
    body: JSON.stringify({ record, expectedSha256: preview.body.sha256 })
  });
  assert.equal(duplicate.response.status, 200);
  assert.equal(duplicate.body.status, "already-archived");

  const conflict = await jsonRequest("/api/admin/match-archive/import/preview", {
    method: "POST",
    headers: ownerHeaders,
    body: JSON.stringify({ record: { ...record, turnCount: 7 } })
  });
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.body.code, "ARCHIVE_CONFLICT");

  const verified = await jsonRequest(`/api/admin/match-archive/${record.matchId}/verify`, { method: "POST", headers: ownerHeaders, body: "{}" });
  assert.equal(verified.response.status, 200);
  assert.equal(verified.body.sha256, stored.artifact.sha256);
});
