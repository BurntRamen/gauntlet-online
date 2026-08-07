const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MATCH_JOURNAL_KIND,
  createMatchPersistence,
  journalId
} = require("../matchPersistence");

function capabilityError(code, message = "schema capability unavailable") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function makeRecord(matchId, status = "finalized") {
  return {
    recordVersion: 2,
    matchId,
    mode: "campaign",
    completedAt: "2026-08-07T12:00:00.000Z",
    participants: [{ accountId: "account-1", playerNum: 1, result: "win" }],
    auditEvents: [],
    completion: { status, consequences: [] }
  };
}

function makeLocalStore() {
  const records = new Map();
  return {
    findById: (id) => records.get(id) || null,
    listByAccount: (accountId, limit) => [...records.values()]
      .filter((record) => record.participants.some((participant) => participant.accountId === accountId))
      .slice(0, limit),
    upsert: (record) => {
      records.set(record.matchId, structuredClone(record));
      return record;
    }
  };
}

test("falls back only for a demonstrated dedicated-schema capability error and journals record v2", async () => {
  const rows = new Map();
  const calls = [];
  const supabaseRequest = async (pathname, options = {}) => {
    calls.push({ pathname, options });
    if (pathname === "gauntlet_match_records?select=id&limit=1") throw capabilityError("PGRST205", "table not found");
    if (pathname === "gauntlet_faction_stats?select=id&limit=1") return [];
    if (pathname === "gauntlet_faction_stats?on_conflict=id") {
      for (const row of JSON.parse(options.body)) rows.set(row.id, row);
      return null;
    }
    if (pathname.startsWith("gauntlet_faction_stats?id=eq.")) {
      const encodedId = pathname.slice("gauntlet_faction_stats?id=eq.".length, pathname.indexOf("&select=data"));
      const row = rows.get(decodeURIComponent(encodedId));
      return row ? [{ data: structuredClone(row.data) }] : [];
    }
    throw new Error(`Unexpected request: ${pathname}`);
  };
  const persistence = createMatchPersistence({
    useSupabaseStore: () => true,
    supabaseRequest,
    localStore: makeLocalStore(),
    toPreferredRow: (record) => ({ id: record.matchId, record }),
    now: () => "2026-08-07T12:01:00.000Z",
    logger: { warn() {} }
  });
  const record = makeRecord("11111111-1111-4111-8111-111111111111");

  assert.equal(await persistence.findById(record.matchId), null);
  await persistence.persist(record);
  assert.deepEqual(await persistence.findById(record.matchId), record);
  assert.equal(await persistence.getMode(), "compatibility");
  assert.equal(rows.get(journalId(record.matchId)).data.kind, MATCH_JOURNAL_KIND);
  assert.equal(rows.get(journalId(record.matchId)).data.record.recordVersion, 2);
  assert.equal(rows.has("global"), false);
  assert.equal(calls.filter((call) => call.pathname === "gauntlet_match_records?select=id&limit=1").length, 1);
});

test("compatibility history hydrates canonical records from account-side match IDs", async () => {
  const first = makeRecord("22222222-2222-4222-8222-222222222222");
  const second = makeRecord("33333333-3333-4333-8333-333333333333");
  const journals = new Map([first, second].map((record) => [journalId(record.matchId), {
    kind: MATCH_JOURNAL_KIND,
    version: 1,
    record,
    updatedAt: record.completedAt
  }]));
  const persistence = createMatchPersistence({
    useSupabaseStore: () => true,
    localStore: makeLocalStore(),
    toPreferredRow: (record) => ({ id: record.matchId, record }),
    logger: { warn() {} },
    supabaseRequest: async (pathname) => {
      if (pathname === "gauntlet_match_records?select=id&limit=1") throw capabilityError("42P01");
      if (pathname === "gauntlet_faction_stats?select=id&limit=1") return [];
      const encodedId = pathname.slice("gauntlet_faction_stats?id=eq.".length, pathname.indexOf("&select=data"));
      const data = journals.get(decodeURIComponent(encodedId));
      return data ? [{ data }] : [];
    }
  });

  const records = await persistence.listByAccount("account-1", 30, [second.matchId, first.matchId]);
  assert.deepEqual(records.map((record) => record.matchId), [second.matchId, first.matchId]);
});

test("keeps the preferred dedicated-table and atomic RPC path when supported", async () => {
  const calls = [];
  const record = makeRecord("44444444-4444-4444-8444-444444444444");
  const persistence = createMatchPersistence({
    useSupabaseStore: () => true,
    localStore: makeLocalStore(),
    toPreferredRow: (value) => ({ id: value.matchId, record: value }),
    logger: { warn() {} },
    supabaseRequest: async (pathname, options = {}) => {
      calls.push({ pathname, options });
      if (pathname === "gauntlet_match_records?select=id&limit=1") return [];
      if (pathname === "rpc/finalize_gauntlet_match") return { finalized: true };
      throw new Error(`Unexpected request: ${pathname}`);
    }
  });

  await persistence.persist(record, { accountApplications: [{ accountId: "account-1" }] });
  assert.equal(await persistence.getMode(), "preferred");
  assert.equal(calls.some((call) => call.pathname === "rpc/finalize_gauntlet_match"), true);
  assert.equal(calls.some((call) => call.pathname.startsWith("gauntlet_faction_stats")), false);
});

test("does not hide network or malformed-response failures behind compatibility storage", async () => {
  let factionProbeCalled = false;
  const networkPersistence = createMatchPersistence({
    useSupabaseStore: () => true,
    localStore: makeLocalStore(),
    toPreferredRow: (record) => ({ id: record.matchId, record }),
    supabaseRequest: async (pathname) => {
      if (pathname.startsWith("gauntlet_faction_stats")) factionProbeCalled = true;
      throw new TypeError("fetch failed");
    }
  });
  await assert.rejects(() => networkPersistence.getMode(), /fetch failed/);
  assert.equal(factionProbeCalled, false);

  const malformedPersistence = createMatchPersistence({
    useSupabaseStore: () => true,
    localStore: makeLocalStore(),
    toPreferredRow: (record) => ({ id: record.matchId, record }),
    supabaseRequest: async (pathname) => {
      if (pathname === "gauntlet_match_records?select=id&limit=1") return [];
      if (pathname.includes("&select=record")) return { not: "an array" };
      return [];
    }
  });
  await assert.rejects(
    () => malformedPersistence.findById("55555555-5555-4555-8555-555555555555"),
    /Malformed Gauntlet match record response/
  );
  assert.equal((await malformedPersistence.getMode()), "preferred");
});

test("falls back from a missing finalization RPC and commits prepared account applications before journaling", async () => {
  const rows = new Map();
  const committed = [];
  const record = makeRecord("66666666-6666-4666-8666-666666666666");
  const applications = [{ accountId: "account-1", result: "win", context: { matchId: record.matchId } }];
  const persistence = createMatchPersistence({
    useSupabaseStore: () => true,
    localStore: makeLocalStore(),
    toPreferredRow: (value) => ({ id: value.matchId, record: value }),
    logger: { warn() {} },
    commitCompatibilityApplications: async (matchId, received) => committed.push({ matchId, received }),
    supabaseRequest: async (pathname, options = {}) => {
      if (pathname === "gauntlet_match_records?select=id&limit=1") return [];
      if (pathname === "rpc/finalize_gauntlet_match") throw capabilityError("PGRST202", "function not found");
      if (pathname === "gauntlet_faction_stats?select=id&limit=1") return [];
      if (pathname === "gauntlet_faction_stats?on_conflict=id") {
        for (const row of JSON.parse(options.body)) rows.set(row.id, row);
        return null;
      }
      throw new Error(`Unexpected request: ${pathname}`);
    }
  });

  await persistence.persist(record, { accountApplications: applications });
  assert.equal(await persistence.getMode(), "compatibility");
  assert.deepEqual(committed, [{ matchId: record.matchId, received: applications }]);
  assert.equal(rows.get(journalId(record.matchId)).data.record.completion.status, "finalized");
});
