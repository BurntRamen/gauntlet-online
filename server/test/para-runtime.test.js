const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const { createParaRuntime } = require("../paraRuntime");
const para = require("../paraLeague");
const { hash } = require("../authoredContent");

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-para-sqlite-"));
  const filename = path.join(dir, "para.sqlite");
  let clock = "2026-10-12T12:00:00.000Z";
  const config = para.seedSeasonZero();
  Object.assign(config.seasons[0], { status: "active", startsAt: "2026-10-01T00:00:00.000Z", endsAt: "2027-01-01T00:00:00.000Z" });
  config.events.forEach((e) => Object.assign(e, { status: "scheduled", startsAt: "2026-10-01T00:00:00.000Z", endsAt: "2027-01-01T00:00:00.000Z", registrationOpensAt: "2026-10-01T00:00:00.000Z", registrationClosesAt: "2026-12-31T00:00:00.000Z" }));
  let release = { id: `gauntlet-content-${hash(config)}`, sha256: hash(config), snapshot: { paraLeague: config } };
  const publication = { published: () => JSON.parse(JSON.stringify(release)) };
  const options = { filename, publication, now: () => clock };
  let runtime = createParaRuntime(options);
  t.after(() => { runtime.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const enroll = (accountId, week = 1) => runtime.enroll(accountId, { eventId: config.events[week - 1].id, acceptedRules: runtime.event(config.events[week - 1].id).release.id, eligibilityConfirmed: true });
  runtime.sync();
  function result(a, b, winner = a.accountId, extras = {}) {
    const matchId = crypto.randomUUID(); runtime.reserve(matchId, a.id, b.id);
    return { matchId, contentVersion: a.releaseId, ranked: false, para: { eventId: a.eventId, releaseId: a.releaseId, attemptIds: [a.id, b.id] }, completedAt: clock,
      participants: [a, b].map((p) => ({ accountId: p.accountId, identityType: "account", result: winner === null ? "draw" : winner === p.accountId ? "win" : "loss" })), completion: { status: "finalized" }, ...extras };
  }
  function winRun(accountId, week = 1, losses = 0) {
    const a = enroll(accountId, week), def = config.events[week - 1];
    for (let i = 0; i < losses + def.winTarget; i++) {
      const opponentId = `opponent-${crypto.randomUUID()}`;
      if (week > 6) winRun(opponentId, 1);
      const b = enroll(opponentId, week);
      runtime.settle(result(a, b, i < losses ? b.accountId : a.accountId));
    }
    return a;
  }
  return { get runtime() { return runtime; }, options, filename, config, enroll, result, winRun,
    clock: (value) => { clock = value; },
    publish: (mutate) => { const snapshot = JSON.parse(JSON.stringify(release.snapshot)); mutate(snapshot.paraLeague); release = { id: `gauntlet-content-${hash(snapshot)}`, sha256: hash(snapshot), snapshot }; return release; },
    restart: () => { runtime.close(); runtime = createParaRuntime(options); return runtime; } };
}

test("membership is automatic, free and creates no Prestige; registration requires rules, windows and eligibility", (t) => {
  const f = fixture(t), view = f.runtime.view("account-a");
  assert.deepEqual(view.membership, { automatic: true, free: true }); assert.equal(view.lifetimePrestige, 0);
  assert.throws(() => f.runtime.enroll("a", { eventId: f.config.events[0].id, eligibilityConfirmed: true }), /Accept/);
  assert.throws(() => f.enroll("a", 7), /Requires 45/);
  f.clock("2027-01-02T00:00:00.000Z"); assert.throws(() => f.enroll("a"), /ended/);
});

test("SQLite awards exactly once across duplicates, new process and restart; attempts cannot reset", (t) => {
  const f = fixture(t), a = f.enroll("a"), b = f.enroll("b");
  const record = f.result(a, b); f.runtime.settle(record); f.runtime.settle(record);
  for (let i = 1; i < 7; i++) f.runtime.settle(f.result(a, f.enroll(`opponent-${i}`)));
  const first = f.runtime.view("a");
  assert.equal(first.awards.length, 1); assert.equal(first.lifetimePrestige, 30);
  assert.equal(first.awards[0].evidence.length, 7); assert.equal(first.seasons[0].invitationalEligible, true);
  assert.throws(() => f.enroll("a"), /limit/);
  f.restart(); assert.deepEqual(f.runtime.view("a").awards, first.awards); assert.throws(() => f.enroll("a"), /limit/);
  const child = spawnSync(process.execPath, ["-e", "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);console.log(db.prepare('select count(*) n from para_awards').get().n);try{db.exec('delete from para_awards')}catch(e){console.log(e.message)}db.close();", f.filename], { encoding: "utf8" });
  assert.equal(child.status, 0); assert.match(child.stdout, /^1/); assert.match(child.stdout, /immutable/);
  assert.equal(f.runtime.inspect().receipts.length, 7);
});

test("completed runtime results and Admin simulator share qualification thresholds, best four and perfect exceptions", (t) => {
  const f = fixture(t);
  f.winRun("a", 1, 1); f.winRun("a", 2, 1);
  const results = f.runtime.view("a").awards.map(({ eventId, wins, losses }) => ({ eventId, wins, losses }));
  const simulated = para.simulate(f.config, { seasonId: f.config.seasons[0].id, eventId: f.config.events[6].id, results });
  const actual = f.runtime.view("a").seasons[0];
  for (const key of ["qualifyingPrestige", "combinedPrestige", "countedEventIds", "invitationalEligible", "championshipEligible"]) assert.deepEqual(actual[key], simulated[key]);
  assert.equal(actual.qualifyingPrestige, 60); assert.equal(actual.invitationalEligible, true);
  f.winRun("a", 7); assert.equal(f.runtime.view("a").seasons[0].championshipEligible, true);
  const season = f.config.seasons[0];
  assert.equal(para.qualification(season, [1,2,3,4,5,6].map((i) => ({ eventId: `q${i}`, eventType: "qualifier", prestige: i * 2, wins: i, perfect: false }))).qualifyingPrestige, 36);
});

test("published changes cannot rewrite pinned schedules, run scores, season thresholds or historical awards", (t) => {
  const f = fixture(t), a = f.enroll("a");
  f.publish((config) => { config.events[0].prestige[7] = 900; config.seasons[0].invitationalThreshold = 1000; });
  f.winRun("a");
  const v = f.runtime.view("a"); assert.equal(v.awards[0].amount, 30); assert.equal(v.awards[0].releaseId, a.releaseId);
  assert.equal(v.seasons[0].season.invitationalThreshold, 45); assert.equal(v.events[0].definitionMismatch, true);
  assert.equal(f.runtime.inspect().standings[0].definitionMismatch, true);
  assert.equal(f.runtime.inspect().standings[0].releaseId, a.releaseId);
});

test("withdraw, pause, cancel, expiry and ties have explicit durable policies", (t) => {
  const f = fixture(t), a = f.enroll("a"), b = f.enroll("b");
  f.runtime.withdraw("a", a.id); const retry = f.enroll("a"); assert.notEqual(retry.id, a.id);
  f.runtime.settle(f.result(retry, b, null));
  assert.equal(f.runtime.view("a").events[0].attempts[1].draws, 1);
  f.runtime.operate("operator", { eventId: a.eventId, action: "pause", reason: "Investigating" });
  assert.throws(() => f.runtime.canPlay(retry.id), /window/);
  f.runtime.operate("operator", { eventId: a.eventId, action: "resume", reason: "Resolved" });
  f.runtime.withdraw("a", retry.id); assert.throws(() => f.enroll("a"), /limit/);
  f.runtime.operate("operator", { eventId: a.eventId, action: "cancel", reason: "Schedule change" });
  assert.throws(() => f.runtime.operate("operator", { eventId: a.eventId, action: "resume", reason: "Retry" }), /permanent/);
  assert.equal(f.runtime.view("a").awards.length, 0);
  assert.ok(f.runtime.inspect().audit.some((r) => r.actorId === "operator" && r.action === "cancel"));
});

test("recovery reconciles finalized canonical evidence and releases only unrecoverable unfinished matches", async (t) => {
  const f = fixture(t), a = f.enroll("a"), b = f.enroll("b"), record = f.result(a, b);
  f.restart(); await f.runtime.recover(async () => record, () => false);
  assert.equal(f.runtime.view("a").events[0].attempts[0].wins, 1);
  const unfinished = f.result(a, b);
  f.restart(); await f.runtime.recover(async () => null, () => false);
  assert.equal(f.runtime.view("a").events[0].attempts[0].wins, 1);
  assert.equal(f.runtime.view("a").events[0].attempts[0].matchId, null);
  assert.throws(() => f.runtime.settle(unfinished), /no longer pending/);
});

test("only reserved human matches with exact pinned evidence can settle, and corrupt retries roll back atomically", (t) => {
  const f = fixture(t), a = f.enroll("a"), b = f.enroll("b"), record = f.result(a, b);
  assert.equal(f.runtime.settle({ matchId: "ordinary" }), null);
  assert.throws(() => f.runtime.settle({ ...record, ranked: true }), /evidence/);
  assert.throws(() => f.runtime.settle({ ...record, completion: { status: "pending" } }), /finalization/);
  assert.equal(f.runtime.inspect().receipts.length, 0);
  f.runtime.settle(record);
  assert.throws(() => f.runtime.settle({ ...record, completedAt: "changed" }), /changed/);
  assert.equal(f.runtime.inspect().receipts.length, 1);
});

test("a fresh process reconciles a reservation left after canonical completion, then duplicate recovery is a no-op", async (t) => {
  const f = fixture(t), a = f.enroll("a"), b = f.enroll("b"), record = f.result(a, b);
  const evidencePath = path.join(path.dirname(f.filename), "canonical-record.json");
  fs.writeFileSync(evidencePath, JSON.stringify(record));
  const script = "const fs=require('node:fs');const {createParaRuntime}=require(process.argv[1]);const r=createParaRuntime({filename:process.argv[2],publication:{}});r.recover(async()=>JSON.parse(fs.readFileSync(process.argv[3],'utf8')),()=>false).then(()=>{r.close();console.log('recovered')}).catch(e=>{console.error(e);process.exitCode=1});";
  const child = spawnSync(process.execPath, ["-e", script, require.resolve("../paraRuntime"), f.filename, evidencePath], { encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr); assert.match(child.stdout, /recovered/);
  f.restart(); await f.runtime.recover(async () => record, () => false);
  assert.equal(f.runtime.inspect().receipts.length, 1);
  assert.equal(f.runtime.view("a").events[0].attempts[0].wins, 1);
});

test("late completions and cancellation void an unfinished match without silently consuming an unplayed run", (t) => {
  const f = fixture(t), a = f.enroll("a"), b = f.enroll("b"), record = f.result(a, b);
  f.clock("2027-01-01T00:00:00.000Z");
  const receipt = f.runtime.settle({ ...record, completedAt: "2027-01-01T00:00:00.000Z" });
  assert.equal(receipt.status, "void"); assert.equal(f.runtime.view("a").events[0].attempts[0].status, "void");
  assert.equal(f.runtime.view("a").lifetimePrestige, 0);
});

test("published tiebreak ordering and earliest score timestamp are deterministic", () => {
  const season = para.seedSeasonZero().seasons[0];
  const a = { accountId: "a", combinedPrestige: 45, perfectRuns: 1, wins: 7, scoreReachedAt: "2026-10-10" };
  const b = { accountId: "b", combinedPrestige: 45, perfectRuns: 0, wins: 12, scoreReachedAt: "2026-10-09" };
  assert.ok(para.compareStandings(season, a, b) < 0);
  assert.ok(para.compareStandings({ ...season, tiebreak: "prestige-wins-perfect-earliest-account" }, a, b) > 0);
  assert.ok(para.compareStandings(season, a, { ...a, accountId: "z", scoreReachedAt: "2026-10-11" }) < 0);
});
