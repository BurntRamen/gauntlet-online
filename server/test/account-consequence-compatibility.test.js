const test = require("node:test");
const assert = require("node:assert/strict");

const originalFetch = global.fetch;

process.env.SUPABASE_URL = "https://gauntlet-test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";

const account = {
  id: "77777777-7777-4777-8777-777777777777",
  name: "Compatibility Player",
  name_key: "compatibility player",
  password_salt: "salt",
  password_hash: "hash",
  created_at: "2026-08-07T12:00:00.000Z",
  last_login_at: null,
  last_seen_at: null,
  stats: {
    gamesPlayed: 0,
    gamesWon: 0,
    collection: { packCredits: 0, earnedPackCredits: 0 },
    progression: { campaign: {}, matchHistory: [] }
  }
};
let patchCount = 0;

global.fetch = async (url, options = {}) => {
  const parsed = new URL(url);
  const endpoint = `${parsed.pathname}${parsed.search}`;
  if (endpoint.startsWith("/rest/v1/gauntlet_accounts?id=eq.")) {
    if ((options.method || "GET") === "PATCH") {
      patchCount += 1;
      Object.assign(account, JSON.parse(options.body));
      return new Response(null, { status: 204 });
    }
    return Response.json([structuredClone(account)]);
  }
  return Response.json({ code: "PGRST205", message: `Unexpected test endpoint: ${endpoint}` }, { status: 404 });
};

const { app, server, __test } = require("../index");

test.after(() => server.close());

test("compatibility consequences persist updated stats and receipt together and retry exactly once", async () => {
  const matchId = "88888888-8888-4888-8888-888888888888";
  const context = {
    matchId,
    ranked: false,
    completedAt: "2026-08-07T12:05:00.000Z",
    factionId: "rumin",
    factionName: "Rumin",
    opponentName: "The Brass Regent",
    compatibilityPersistence: true,
    campaign: { factionId: "rumin", chapterId: "first-march", title: "The First March" }
  };

  const first = await __test.recordAccountGameResult(account.id, "win", context);
  const retry = await __test.recordAccountGameResult(account.id, "win", context);
  const receipt = `${matchId}:${account.id}`;

  assert.equal(first.alreadyApplied, false);
  assert.equal(retry.alreadyApplied, true);
  assert.equal(patchCount, 1);
  assert.equal(account.stats.gamesPlayed, 1);
  assert.equal(account.stats.gamesWon, 1);
  assert.equal(account.stats.collection.packCredits, 1);
  assert.deepEqual(account.stats.progression.campaign.rumin, ["first-march"]);
  assert.equal(account.stats.matchConsequenceReceipts[receipt].campaign.firstClear, true);
  assert.equal(account.stats.matchConsequenceReceipts[receipt].boosterCreditDelta, 1);
  assert.deepEqual(account.stats.progression.matchHistory, [{
    matchId,
    recordVersion: 2,
    completedAt: context.completedAt,
    deckVersionId: null
  }]);
});

test("season consequence and compact references persist exactly once in account-only JSONB", async () => {
  const matchId = "99999999-9999-4999-8999-999999999999";
  const context = {
    matchId,
    ranked: true,
    completedAt: "2026-08-07T12:15:00.000Z",
    factionId: "sheen",
    factionName: "Sheen",
    opponentName: "Season Opponent",
    playerNum: 1,
    compatibilityPersistence: true,
    season: {
      seasonDefinitionVersion: "gauntlet.season.v1",
      seasonId: "season-zero",
      seasonCode: "S0",
      displayName: "Season Zero",
      format: "ranked-bo1"
    },
    matchIndex: { recordVersion: 2, completedAt: "2026-08-07T12:15:00.000Z" }
  };
  const patchCountBefore = patchCount;
  const first = await __test.recordAccountGameResult(account.id, "win", context);
  const retry = await __test.recordAccountGameResult(account.id, "win", context);

  assert.equal(first.season.pointsDelta, 3);
  assert.equal(retry.alreadyApplied, true);
  assert.equal(patchCount, patchCountBefore + 1);
  assert.equal(account.stats.seasons["season-zero"].gamesPlayed, 1);
  assert.equal(account.stats.seasons["season-zero"].points, 3);
  assert.equal(account.stats.seasons["season-zero"].recentMatches[0].matchId, matchId);
  assert.equal(account.stats.matchConsequenceReceipts[`${matchId}:${account.id}`].season.record.points, 3);
});

test("account match history exposes durable references honestly when complete records are unavailable", async () => {
  const { token } = __test.issueAccountSession(account);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const response = await originalFetch(`http://127.0.0.1:${address.port}/api/account/matches`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.matches, []);
  assert.deepEqual(body.unavailableMatchReferences, account.stats.progression.matchHistory);
  assert.equal(body.storage.mode, "account-only");
  assert.equal(body.storage.capabilities.completeRecordV2, "process-local");
  assert.equal(body.storage.capabilities.publicRecordAfterProcessReplacement, false);
  assert.equal(body.storage.capabilities.completionAfterProcessReplacement, false);

  const accountResponse = await originalFetch(`http://127.0.0.1:${address.port}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const accountBody = await accountResponse.json();
  assert.equal(accountResponse.status, 200);
  assert.equal(accountBody.account.stats.seasons["season-zero"].points, 3);
  assert.equal(accountBody.account.stats.seasons["season-zero"].recentMatches[0].matchId, "99999999-9999-4999-8999-999999999999");
});
