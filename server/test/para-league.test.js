const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const para = require("../paraLeague");
const { buildCatalog } = require("../adminData");
const { createAuthoredBaseline, clone } = require("../authoredContent");
const { createContentPublication } = require("../contentPublication");
const baseline = createAuthoredBaseline(buildCatalog({ season: () => ({}), encounter: () => ({ bossAbility: null, deckPlan: { player: { additions: [] }, boss: { additions: [] } } }) }));

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "para-authoring-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = createContentPublication({ baseline, directory });
  const draft = (body) => store.paraDraft({ expectedRevision: store.status().revision, ...body }, "operator-one");
  return { store, directory, draft };
}
function run(config, week, wins, losses) { return { eventId: config.events[week - 1].id, wins, losses }; }
function simulate(config, results, week = 7) { return para.simulate(config, { seasonId: config.seasons[0].id, eventId: config.events[week - 1].id, results }); }

test("Season Zero seed is inactive, unscheduled, eight weeks, exact provisional prices and 4000 maximum Gold", () => {
  const config = para.seedSeasonZero();
  assert.equal(para.validateConfig(config).valid, true);
  assert.equal(config.events.length, 8);
  assert.deepEqual(config.events.map((e) => [e.winTarget, e.lossLimit]), [[7, 3], [5, 2], [7, 3], [5, 2], [7, 3], [5, 2], [7, 3], [12, 3]]);
  assert.deepEqual(config.events[0].prestige, [0, 2, 4, 7, 11, 16, 22, 30]);
  assert.deepEqual(config.events[1].prestige, [0, 4, 9, 15, 22, 30]);
  assert.deepEqual(config.events[6].prestige, [0, 4, 8, 12, 18, 24, 32, 40]);
  assert.equal(config.seasons[0].countedResults, 4);
  assert.equal(config.seasons[0].qualifyingEventCount, 6);
  assert.ok(config.events.every((e) => e.status === "draft" && e.startsAt === null && e.endsAt === null && e.scoringAttempts === 1 && !e.rewards.length));
  assert.ok(config.products.every((p) => p.status === "unavailable"));
  assert.deepEqual(config.products.map((p) => [p.goldPrice, p.gemPrice]), [[600, 120], [900, 180], [1800, 360], [400, 0], [700, 0], [1200, 200], [0, 500], [0, 750]]);
  assert.equal(para.summary(config)[0].maximumGold, 4000);
  assert.equal(config.awards.reduce((n, a) => n + a.amount, 0), 4000);
  assert.ok(config.entitlements.every((e) => !e.asset && !e.rightsReference && e.fulfillment === "unavailable"));
});

test("strict contracts reject purchased power, currency prizes, unsupported formats, activation and malformed catalogs", () => {
  const cases = [
    (c) => { c.seasons[0].membershipPrice = 1; }, (c) => { c.events[0].entryCost = 1; },
    (c) => { c.events[0].gemReward = 5; }, (c) => { c.events[0].goldReward = 5; },
    (c) => { c.events[0].format = "undeployed-format"; }, (c) => { c.events[0].status = "active"; },
    (c) => { c.products[0].status = "available"; }, (c) => { c.entitlements[0].category = "gameplay-card"; },
    (c) => { c.entitlements[0].fulfillment = "download"; }, (c) => { c.products[0].conversionRate = 2; },
    (c) => { c.events[0].scoringAttempts = -1; }, (c) => { c.events[0].lossLimit = 2; },
    (c) => { c.events[0].prestige.pop(); }, (c) => { c.events[0].prestige[0] = 0.5; },
    (c) => { c.events[0].seasonId = "unknown"; }, (c) => { c.products[0].entitlements = ["missing"]; },
    (c) => { c.awards[0].amount = Infinity; }, (c) => { c.awards[0].claimLimit = 0; },
    (c) => { c.events[0].rewards = [null]; }, (c) => { c.events = "bad"; },
    (c) => { c.products[0] = null; }, (c) => { c.seasons[0].countedResults = 7; },
    (c) => { c.products[0].pricing = "gold"; }, (c) => { c.products[0].entitlements = []; },
    (c) => { c.entitlements[0].asset = "https://unverified.invalid/music.mp3"; },
    (c) => { c.seasons[0].startsAt = "2026-02-30T00:00:00.000Z"; },
    (c) => { c.products[0].startsAt = "2026-10-01T00:00:00.000Z"; }
  ];
  for (const mutate of cases) { const config = para.seedSeasonZero(); mutate(config); assert.equal(para.validateConfig(config).valid, false, mutate.toString()); }
  for (const invalid of [null, [], {}, { schemaVersion: para.SCHEMA }]) assert.equal(para.validateConfig(invalid).valid, false);
});

test("earned-only provenance cannot cross into the commercial catalog; windows and caps are validated", () => {
  const config = para.seedSeasonZero();
  config.events[0].rewards = [{ wins: 7, entitlementId: config.entitlements[0].id }];
  assert.equal(para.validateConfig(config).valid, false);
  config.entitlements[0].provenance = "earned-only";
  assert.equal(para.validateConfig(config).valid, false);
  config.products[0].entitlements = [config.entitlements[1].id];
  assert.equal(para.validateConfig(config).valid, true);
  config.seasons[0].goldBudget = 3000;
  assert.deepEqual(para.summary(config)[0], { seasonId: "para-season-zero", catalogGold: 4000, budget: 3000, maximumGold: 3000, capped: true });
  config.seasons[0].startsAt = "2026-11-01T00:00:00.000Z"; config.seasons[0].endsAt = "2026-12-27T00:00:00.000Z";
  config.events[0].startsAt = "2026-10-01T00:00:00.000Z"; config.events[0].endsAt = "2026-11-07T00:00:00.000Z";
  assert.equal(para.validateConfig(config).valid, false);
});

test("simulation counts best four, qualification thresholds and perfect runs without awarding currency", () => {
  const config = para.seedSeasonZero(), bytes = JSON.stringify(config);
  const result = simulate(config, [run(config, 1, 6, 3), run(config, 2, 5, 1), run(config, 3, 1, 3), run(config, 4, 4, 2), run(config, 5, 0, 3), run(config, 6, 1, 2)]);
  assert.equal(result.qualifyingPrestige, 78); assert.equal(result.invitationalEligible, true); assert.equal(result.championshipEligible, false);
  assert.equal(result.countedEventIds.length, 4);
  assert.equal(result.goldAward, 0); assert.equal(result.gemAward, 0); assert.equal(result.officialEntryAvailable, false);
  assert.equal(simulate(config, [run(config, 1, 7, 0)]).invitationalEligible, true);
  assert.equal(simulate(config, [run(config, 1, 7, 1)]).invitationalEligible, false);
  assert.equal(simulate(config, [run(config, 1, 7, 0), run(config, 7, 7, 0)], 8).championshipEligible, true);
  assert.equal(simulate(config, [run(config, 1, 7, 0), run(config, 2, 5, 0), run(config, 7, 5, 3)], 8).championshipEligible, true);
  assert.equal(JSON.stringify(config), bytes);
});

test("simulation rejects duplicate, incomplete, impossible, future and forged Prestige results", () => {
  const config = para.seedSeasonZero();
  for (const results of [[run(config, 1, 7, 0), run(config, 1, 7, 0)], [run(config, 1, 4, 0)], [run(config, 1, 7, 3)], [run(config, 7, 7, 0)], [{ ...run(config, 1, 7, 0), prestige: 1000 }], [run(config, 1, -1, 3)], [run(config, 1, 99, 0)]]) assert.throws(() => simulate(config, results), /completed earlier run/);
  assert.throws(() => simulate(config, [run(config, 7, 7, 0)], 8), /eligibility first/);
});

test("one shared draft supports creations, duplicates, review, immutable publication, restart and rollback", (t) => {
  const { store, directory, draft } = fixture(t), initial = store.active(), initialId = store.status().activeReleaseId;
  let state = draft({ operation: "seed" });
  assert.ok(state.validation.valid);
  assert.equal(state.live.paraLeague, undefined);
  assert.deepEqual(store.active(), initial);
  assert.throws(() => draft({ operation: "seed" }), /already has definitions/);
  state = draft({ operation: "duplicate", domain: "seasons", sourceId: "para-season-zero", id: "para-season-one" });
  assert.equal(state.draft.snapshot.paraLeague.seasons[1].startsAt, null);
  const config = state.draft.snapshot.paraLeague;
  for (const domain of ["events", "awards", "products", "entitlements"]) {
    const value = { ...clone(config[domain][0]), id: `new-${domain}` };
    state = draft({ operation: "create", domain, id: value.id, value });
  }
  const second = createContentPublication({ baseline, directory });
  assert.throws(() => second.paraDraft({ expectedRevision: 0, operation: "seed" }, "operator-two"), /another session/);
  assert.throws(() => store.publish({ expectedRevision: state.revision, label: "Unreviewed" }, "operator"), /Preview/);
  store.preview({ expectedRevision: state.revision });
  state = store.publish({ expectedRevision: store.status().revision, label: "Reviewed inactive Para proposals" }, "operator-two");
  assert.equal(state.live.paraLeague.events.length, 9);
  assert.ok(state.changes.length === 0 && !state.draft);
  const before = JSON.parse(fs.readFileSync(path.join(directory, "content-state.json"))).releases;
  assert.equal(before[initialId].snapshot.paraLeague, undefined);
  assert.equal(second.status().activeReleaseId, state.activeReleaseId);
  store.rollback({ expectedRevision: state.revision, releaseId: initialId }, "operator-two");
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, "content-state.json"))).releases, before);
  assert.deepEqual(store.active(), initial);
});

test("invalid saved definitions block publication, changes invalidate review, and archive retains evidence", (t) => {
  const { store, draft } = fixture(t);
  let state = draft({ operation: "seed" });
  const event = clone(state.draft.snapshot.paraLeague.events[0]);
  event.status = "active";
  state = draft({ operation: "update", domain: "events", id: event.id, value: event });
  assert.equal(state.validation.valid, false);
  assert.throws(() => store.preview({ expectedRevision: state.revision }), /validation failed/);
  event.status = "draft";
  draft({ operation: "update", domain: "events", id: event.id, value: event });
  store.preview({ expectedRevision: store.status().revision });
  state = draft({ operation: "archive", domain: "events", id: event.id });
  assert.equal(state.draft.snapshot.paraLeague.events.length, 8);
  assert.equal(state.draft.snapshot.paraLeague.events[0].status, "archived");
  assert.throws(() => store.publish({ expectedRevision: state.revision, label: "Stale review" }, "operator"), /Preview/);
  assert.throws(() => draft({ operation: "update", domain: "events", id: event.id, value: { ...event, entryPrice: 20 } }), /exact typed fields/);
  assert.throws(() => draft({ operation: "delete", domain: "events", id: event.id }), /Unknown/);
  for (const fields of [{ status: {} }, { prestige: [null] }, { rewards: [null] }, { startsAt: 12 }, { seasonId: {} }, { scoringAttempts: "1" }]) {
    assert.throws(() => draft({ operation: "update", domain: "events", id: event.id, value: { ...event, ...fields } }), /Invalid/);
  }
  const bytes = JSON.stringify(store.status());
  assert.throws(() => store.paraSimulation({ expectedRevision: 0 }), /Content changed/);
  assert.equal(JSON.stringify(store.status()), bytes);
});
