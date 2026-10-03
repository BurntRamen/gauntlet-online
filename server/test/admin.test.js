const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-admin-"));
Object.assign(process.env, {
  ACCOUNT_DATA_FILE: path.join(root, "accounts.json"), MATCH_DATA_FILE: path.join(root, "matches.json"),
  MATCH_ARCHIVE_DATA_DIR: path.join(root, "archive"), ROOM_STATE_RECOVERY_ENABLED: "false",
  OWNER_STATS_TOKEN: "admin-test-owner-secret", ACCOUNT_AUTH_SECRET: "admin-test-account-secret"
});
process.env.GAUNTLET_ADMIN_SIMPLY_ACCOUNT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
process.env.GAUNTLET_ADMIN_BURNT_RAMEN_ACCOUNT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SECRET_KEY;
const account = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Admin Player", passwordHash: "PRIVATE_HASH", passwordSalt: "PRIVATE_SALT", stats: {
  progression: { campaign: { rumin: ["brothers-of-destiny"] }, cosmetics: { unlockedTitles: ["recruit"] } },
  collection: { gameplayEntitlements: { "rumin-forum-ledger-runner": 1 }, collectorIssuanceReceipts: { private: "PRIVATE_CLAIM" } },
  deckLibrary: { decks: [{ id: "deck-1", name: "Saved deck", format: "constructed", factionId: "rumin", currentVersionId: "v1", privateNote: "PRIVATE_NOTE", versions: [{ id: "v1", gameplayCardQuantities: { "rumin-forum-ledger-runner": 1 }, secret: "PRIVATE_VERSION" }] }] }
} };
fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, JSON.stringify({ accounts: [account] }));
const { server, __test } = require("../index");
const { buildMatchRecord, publicMatchRecord } = require("../matchRecords");
const { createArtifact } = require("../matchArchive");
const { createAdminData } = require("../adminData");
const record = buildMatchRecord({ roomCode: "ADMIN", matchMetadata: { matchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", startedAt: "2026-10-02T09:55:00.000Z", seriesId: null, gameNumber: 1 }, lobby: { players: { 1: { guestName: "Guest One" }, 2: { guestName: "Guest Two" } } }, game: {
    matchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", gameMode: "factions", phase: "gameOver", winner: 1, turn: 3,
  players: { 1: { life: 20, faction: { id: "rumin", name: "Rumin" } }, 2: { life: 0, faction: { id: "sheen", name: "Sheen" } } },
  serverAuditEvents: [{ sequence: 1, turn: 3, phase: "gameOver", actorPlayerNum: 1, eventType: "game_completed", publicPayload: { message: "Player 1 wins." }, serverTimestamp: "2026-10-02T10:00:00.000Z", stateChecksum: "checksum-1" }],
  serverLeagueEvidence: [{ eventId: "evidence-1", sequence: 1, eventType: "match.completed", publicPayload: {} }]
} }, { completedAt: "2026-10-02T10:00:00.000Z" });
record.completion = { status: "finalized", envelopeVersion: "gauntlet.match-completion.v1", finalizedAt: record.completedAt, consequences: [] };
fs.writeFileSync(process.env.MATCH_DATA_FILE, JSON.stringify({ matches: [record, { ...record, matchId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", completion: { status: "pending" } }] }));
let origin;
let session;
test.before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  session = __test.issueAccountSession(account).token;
});
test.after(async () => { await new Promise((resolve) => server.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); });
async function get(route, token = session, extra = {}) {
  const response = await fetch(`${origin}/api/admin/${route}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra } });
  return { status: response.status, body: await response.json(), cache: response.headers.get("cache-control") };
}

test("every new admin route rejects missing, player, tampered and expired operator credentials", async () => {
  const expired = __test.issueAccountSession(account, 0).token;
  const player = { ...account, id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", name: "simply" };
  const burnt = { ...account, id: process.env.GAUNTLET_ADMIN_BURNT_RAMEN_ACCOUNT_ID, name: "Burnt Ramen" };
  const before = fs.readFileSync(process.env.ACCOUNT_DATA_FILE);
  fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, JSON.stringify({ accounts: [account, player, burnt] }));
  const playerToken = __test.issueAccountSession(player).token;
  const burntToken = __test.issueAccountSession(burnt).token;
  for (const route of ["catalog", "players", "matches", `matches/${record.matchId}`, "system"]) {
    for (const token of [null, `${session}tampered`, `${session}.extra`, expired, __test.issueAccountSession({ id: "ffffffff-ffff-4fff-8fff-ffffffffffff", name: "Deleted", stats: {} }).token]) {
      const response = await get(route, token);
      assert.equal(response.status, 401, route);
      assert.match(response.cache, /no-store/);
    }
    assert.equal((await get(route, null, { Authorization: `Bearer ${playerToken}` })).status, 403);
    assert.equal((await get(route, burntToken)).status, 200);
    assert.equal((await get(route)).status, 200);
  }
  for (const route of ["overview", "account-stats", "faction-stats", "session", "unknown-future-route"]) {
    assert.equal((await get(route, playerToken)).status, 403);
    assert.equal((await get(route, null, { "x-owner-token": process.env.OWNER_STATS_TOKEN })).status, 401);
  }
  for (const route of ["session", "collector-entitlements/issue", "match-archive/import/preview", "match-archive/import/commit", `match-archive/${record.matchId}/verify`, "match-archive/archive-process-local"]) {
    const denied = await fetch(`${origin}/api/admin/${route}`, {
      method: "POST", headers: { Authorization: `Bearer ${playerToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ownerToken: process.env.OWNER_STATS_TOKEN })
    });
    assert.equal(denied.status, 403, route);
  }
  for (const route of ["/admin/gauntlet", "/admin/gauntlet/content/cards"]) {
    assert.equal((await fetch(`${origin}${route}`)).status, 401);
    assert.equal((await fetch(`${origin}${route}`, { headers: { Authorization: `Bearer ${playerToken}` } })).status, 403);
    assert.equal((await fetch(`${origin}${route}`, { headers: { Authorization: `Bearer ${session}` } })).status, 200);
  }
  fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, before);
});

test("catalog reflects the live registry, campaign-only content and deterministic encounter calculations", async () => {
  const { body, status } = await get("catalog");
  assert.equal(status, 200);
  assert.equal(body.counts.cards, require("../gameContent").COLLECTION_CARDS.length);
  assert.equal(body.counts.encounters, 56);
  assert.equal(body.counts.factions, 11);
  assert.match(body.domains.factions.find((f) => f.id === "xendra").definition.availability, /campaign only/);
  const encounter = body.domains.encounters[0];
  assert.deepEqual(encounter.definition.runtime.difficulty, __test.getCampaignDifficulty(encounter.definition.factionId, encounter.id));
  assert.equal(body.validation.valid, true);
  assert.equal(body.publishing.snapshot.sha256, (await get("catalog")).body.publishing.snapshot.sha256);
  assert.notEqual(body.versions.registryRules, body.versions.engineRules);
  for (const rows of Object.values(body.domains)) for (const row of rows) { assert.ok(row.source); assert.equal(row.editable, false); }
});

test("players expose safe progression and saved deck versions without mutating or leaking account data", async () => {
  const before = fs.readFileSync(process.env.ACCOUNT_DATA_FILE, "utf8");
  const { body } = await get("players?limit=1");
  assert.equal(body.hasMore, false);
  assert.equal(body.players[0].decks[0].versions[0].id, "v1");
  assert.deepEqual(body.players[0].campaigns[0].unlockedChapterIds.slice(0, 2), ["brothers-of-destiny", "the-republic"]);
  assert.equal(JSON.stringify(body).includes("PRIVATE_"), false);
  assert.equal(fs.readFileSync(process.env.ACCOUNT_DATA_FILE, "utf8"), before);
  assert.equal((await get("players?offset=-1")).status, 400);
  assert.equal((await get("players?limit=0")).status, 400);
  assert.equal((await get("players?limit=nope")).status, 400);
  assert.deepEqual((await get("players?offset=1")).body.players, []);
});

test("match browser includes guest-only matches, excludes pending records, and preserves evidence", async () => {
  const before = fs.readFileSync(process.env.MATCH_DATA_FILE, "utf8");
  const list = await get("matches");
  assert.equal(list.body.matches.length, 1);
  assert.equal(list.body.matches[0].matchId, record.matchId);
  const detail = await get(`matches/${record.matchId}`);
  assert.deepEqual(detail.body.match, publicMatchRecord(record));
  assert.equal(detail.body.provenance.integrity, "not-verified");
  assert.equal((await get("matches/not-a-uuid")).status, 400);
  assert.equal((await get("matches/cccccccc-cccc-4ccc-8ccc-cccccccccccc")).status, 404);
  assert.equal(fs.readFileSync(process.env.MATCH_DATA_FILE, "utf8"), before);
});

test("canonical archives are verified and a corrupt archive is never silently replaced by a storage copy", async () => {
  const artifact = createArtifact(record);
  await __test.matchArchive.store(record);
  const detail = await get(`matches/${record.matchId}`);
  assert.equal(detail.body.provenance.integrity, "verified");
  assert.equal(detail.body.provenance.sha256, artifact.sha256);
  const archived = await __test.matchArchive.findById(record.matchId);
  const objectFile = path.join(process.env.MATCH_ARCHIVE_DATA_DIR, archived.index.objectKey);
  const bytes = fs.readFileSync(objectFile);
  fs.writeFileSync(objectFile, "corrupt");
  try {
    assert.equal((await get(`matches/${record.matchId}`)).status, 503);
    const list = (await get("matches")).body;
    assert.equal(list.matches.length, 0);
    assert.ok(list.issues.some((issue) => issue.includes(record.matchId)));
  } finally { fs.writeFileSync(objectFile, bytes); }
});

test("corrupted local account storage fails closed without returning private content", async () => {
  const before = fs.readFileSync(process.env.ACCOUNT_DATA_FILE);
  fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, "private corrupt account value");
  try {
    const system = await get("system");
    assert.equal(system.status, 401);
    const serialized = JSON.stringify(system.body);
    for (const secret of [root, process.env.OWNER_STATS_TOKEN, "private corrupt account value", process.env.ACCOUNT_AUTH_SECRET]) assert.equal(serialized.includes(secret), false);
    assert.equal((await get("players")).status, 401);
  } finally { fs.writeFileSync(process.env.ACCOUNT_DATA_FILE, before); }
});

test("Supabase adapters select safe account columns, paginate, and read preferred/compatibility matches without writes", async () => {
  let mode = "preferred";
  const queries = [];
  const data = createAdminData({ useSupabase: () => true, runtime: { progression: () => ({ campaign: {} }), collection: () => ({}), decks: () => ({ decks: [] }) },
    request: async (query, options) => { queries.push(query); assert.equal(options, undefined); return query.startsWith("gauntlet_accounts") ? [{ id: account.id, name: account.name, stats: {} }, { id: "second", name: "Second" }] : mode === "preferred" ? [{ record }] : [{ data: { kind: "gauntlet.match-journal", version: 1, record } }]; },
    persistence: { getMode: async () => mode }, archive: { list: async () => [], status: () => ({ available: false }) }
  });
  const page = await data.players({ offset: "5", limit: "1" });
  assert.equal(page.hasMore, true);
  assert.match(queries[0], /select=id,name,created_at,last_seen_at,stats/);
  assert.match(queries[0], /offset=5&limit=2/);
  assert.equal((await data.matches()).matches[0].provenance.source, "preferred");
  mode = "compatibility";
  assert.equal((await data.matches()).matches[0].provenance.source, "compatibility");
  assert.match(queries.at(-1), /id=like.match%3A\*/);
});

test("historical match evidence remains readable when current authoring is unavailable", async () => {
  const before = JSON.stringify(record);
  let authoringReads = 0;
  const data = createAdminData({
    publication: { status: async () => { authoringReads += 1; throw new Error("PRIVATE_PROVIDER_DIAGNOSTIC"); } },
    archive: { findById: async () => ({ record, index: { sha256: "verified-history-digest" } }) },
    persistence: { findById: async () => { throw new Error("Canonical records must not fall back to storage"); }, status: () => ({ mode: "file" }) }
  });
  const result = await data.match(record.matchId);
  assert.equal(authoringReads, 1);
  assert.deepEqual(result.match, publicMatchRecord(record));
  assert.equal(result.provenance.integrity, "verified");
  assert.equal(result.provenance.sha256, "verified-history-digest");
  assert.equal(result.design.matchId, record.matchId);
  assert.equal(result.design.current.hash, null);
  assert.equal(result.design.current.bindings, null);
  assert.equal(result.design.draft, undefined);
  assert.ok(result.design.events.some(event => event.text === "Player 1 wins."));
  const faction = result.design.references.find(reference => reference.domain === "factions" && reference.id === "rumin");
  assert.equal(faction.recorded.label, "Rumin");
  assert.equal(faction.current.available, false);
  assert.equal(faction.current.definition, null);
  assert.equal(JSON.stringify(result).includes("PRIVATE_PROVIDER_DIAGNOSTIC"), false);
  assert.equal(JSON.stringify(record), before);
});
