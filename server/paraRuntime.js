"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { hash, resolveEngineContent } = require("./authoredContent");
const { qualification, scoreRun, eligibleFor, compareStandings } = require("./paraLeague");
const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };

// Private operational database. Content remains authored exclusively through
// contentPublication; stored releases here are immutable execution evidence.
function createParaRuntime({ filename, publication, now = () => new Date().toISOString() }) {
  if (!filename) return { enabled: false, status: () => ({ enabled: false, reason: "Official entry unavailable: GAUNTLET_PARA_DATA_DIR is not configured." }), settle: () => null, recover: async () => {} };
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  const version = db.prepare("PRAGMA user_version").get().user_version;
  if (version > 1) throw new Error("Unsupported Para database version.");
  if (!version) db.exec(fs.readFileSync(path.join(__dirname, "migrations/para/001_runtime.sql"), "utf8"));
  const all = (table) => db.prepare(`SELECT body FROM ${table} ORDER BY rowid`).all().map((row) => JSON.parse(row.body));
  const get = (table, id) => { const row = db.prepare(`SELECT body FROM ${table} WHERE id = ?`).get(id); return row ? JSON.parse(row.body) : null; };
  const insert = (table, row) => db.prepare(`INSERT INTO ${table}(id,body) VALUES (?,?)`).run(row.id, JSON.stringify(row));
  const save = (table, row) => db.prepare(`UPDATE ${table} SET body=? WHERE id=?`).run(JSON.stringify(row), row.id);
  function transaction(work) {
    db.exec("BEGIN IMMEDIATE");
    try { const result = work(); db.exec("COMMIT"); return result; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  const audit = (action, actorId, facts) => insert("para_audit", { id: crypto.randomUUID(), action, actorId, at: now(), ...facts });
  const activeAttempts = () => all("para_attempts").filter((a) => a.status === "registered" || a.status === "playing");
  function event(id) { const row = get("para_events", id); if (!row) fail("Unknown official event.", 404); return row; }
  function attempt(id, accountId) { const row = get("para_attempts", id); if (!row || (accountId && row.accountId !== accountId)) fail("Attempt unavailable.", 404); return row; }
  function sync() {
    const release = publication.published();
    const config = release.snapshot.paraLeague;
    transaction(() => {
      for (const definition of config?.events || []) {
        const season = config.seasons.find((s) => s.id === definition.seasonId);
        if (definition.status !== "scheduled" || season?.status !== "active" || get("para_events", definition.id)) continue;
        if (!get("para_seasons", season.id)) insert("para_seasons", { id: season.id, releaseId: release.id, definition: season });
        insert("para_events", { id: definition.id, seasonId: season.id, definition, release, definitionHash: hash(definition), status: "open", pinnedAt: now() });
        audit("pin-published-event", null, { eventId: definition.id, releaseId: release.id });
      }
      for (const a of activeAttempts()) {
        const e = event(a.eventId);
        if (now() >= e.definition.endsAt && !a.matchId) {
          a.status = a.played ? "incomplete" : "void"; a.completedAt = now(); save("para_attempts", a);
          audit("event-expired", null, { attemptId: a.id, played: a.played });
        }
      }
    });
    return release;
  }
  const awards = (accountId, seasonId) => all("para_awards").filter((a) => (!accountId || a.accountId === accountId) && (!seasonId || a.seasonId === seasonId));
  function progress(accountId, seasonId, beforeWeek = Infinity) {
    const season = get("para_seasons", seasonId);
    const results = awards(accountId, seasonId).filter((a) => a.week < beforeWeek);
    return { ...qualification(season.definition, results), seasonPrestige: awards(accountId, seasonId).reduce((sum, a) => sum + a.amount, 0), seasonId, season: season.definition, releaseId: season.releaseId };
  }
  function eligibility(e, accountId) {
    const score = progress(accountId, e.seasonId, e.definition.week);
    const t = now(), d = e.definition;
    const perfect = d.eventType === "invitational" ? score.season.perfectQualifierQualifies : score.season.perfectInvitationalQualifies;
    const reason = e.status !== "open" ? `Event ${e.status}.` : t >= d.endsAt ? "Event ended." : t < d.registrationOpensAt ? "Registration has not opened." : t >= d.registrationClosesAt ? "Registration closed." : !eligibleFor(d, score) ? `Requires ${d.eventType === "invitational" ? score.season.invitationalThreshold : score.season.championshipThreshold} Prestige${perfect ? " or a perfect run" : ""}.` : "Eligible for free entry.";
    return { eligible: reason === "Eligible for free entry.", reason, ...score };
  }
  function enroll(accountId, input) {
    sync();
    return transaction(() => {
      const e = event(input.eventId);
      const existing = activeAttempts().find((a) => a.accountId === accountId && a.eventId === e.id);
      if (existing) return existing;
      if (input.acceptedRules !== e.release.id || input.eligibilityConfirmed !== true) fail("Accept this event's published rules and confirm eligibility.", 422);
      const admission = eligibility(e, accountId);
      if (!admission.eligible) { fail(admission.reason, 403); }
      const prior = all("para_attempts").filter((a) => a.eventId === e.id && a.accountId === accountId);
      if (prior.filter((a) => a.status !== "void").length >= e.definition.scoringAttempts) fail("Official attempt limit reached. Re-entry cannot reset it.");
      const a = { id: crypto.randomUUID(), accountId, seasonId: e.seasonId, eventId: e.id, releaseId: e.release.id,
        number: prior.length + 1, status: "registered", wins: 0, losses: 0, draws: 0, played: 0,
        matchId: null, registeredAt: now(), completedAt: null, acceptedRules: input.acceptedRules, admission };
      insert("para_attempts", a); audit("register-free", accountId, { attemptId: a.id, eventId: e.id }); return a;
    });
  }
  function withdraw(accountId, id) {
    return transaction(() => {
      const a = attempt(id, accountId);
      if (a.matchId) fail("Finish or concede the current match first.");
      if (!["registered", "playing"].includes(a.status)) return a;
      a.status = a.played ? "withdrawn" : "void"; a.completedAt = now(); save("para_attempts", a);
      audit("withdraw", accountId, { attemptId: id, status: a.status }); return a;
    });
  }
  function canPlay(id, accountId) {
    const a = attempt(id, accountId), e = event(a.eventId), t = now();
    if (!["registered", "playing"].includes(a.status) || a.matchId) fail("This attempt cannot start another match.");
    if (e.status !== "open" || t < e.definition.startsAt || t >= e.definition.endsAt) fail("Event play window is not open.");
    return { attempt: a, event: e };
  }
  function reserve(matchId, firstId, secondId) {
    return transaction(() => {
      const first = canPlay(firstId), second = canPlay(secondId);
      if (first.attempt.accountId === second.attempt.accountId || first.event.id !== second.event.id) fail("Official play requires two different accounts in the same event.");
      const m = { id: matchId, eventId: first.event.id, releaseId: first.event.release.id, attemptIds: [firstId, secondId], accountIds: [first.attempt.accountId, second.attempt.accountId], status: "pending", reservedAt: now() };
      insert("para_matches", m);
      for (const a of [first.attempt, second.attempt]) { a.matchId = matchId; a.status = "playing"; save("para_attempts", a); }
      return m;
    });
  }
  function settle(record) {
    const reservation = get("para_matches", record.matchId);
    if (!reservation) return null; // Ordinary Gauntlet games never enter Para.
    if (record.completion?.status !== "finalized") fail("Canonical match finalization must commit before Para settlement.");
    return transaction(() => {
      const m = get("para_matches", record.matchId);
      const receipt = get("para_receipts", record.matchId);
      if (receipt) {
        if (receipt.evidenceHash !== hash(record)) fail("Canonical evidence changed after settlement.");
        return receipt;
      }
      if (m.status !== "pending") fail("Match reservation is no longer pending.");
      const e = event(m.eventId);
      const players = record.participants || [];
      const binding = record.para;
      if (players.length !== 2 || players.some((p) => !m.accountIds.includes(p.accountId) || p.identityType !== "account") || new Set(players.map((p) => p.accountId)).size !== 2 || record.campaign || record.ranked || record.contentVersion !== e.release.id || binding?.eventId !== e.id || binding?.releaseId !== e.release.id || hash(binding.attemptIds?.slice().sort() || null) !== hash(m.attemptIds.slice().sort())) fail("Canonical evidence does not match the authorized official human pairing.");
      const outcomes = players.map((p) => p.result).sort().join();
      if (!["loss,win", "draw,draw", "abandoned,abandoned"].includes(outcomes)) fail("Invalid authoritative outcomes.");
      const voided = outcomes === "abandoned,abandoned" || record.completedAt >= e.definition.endsAt || (e.cancelledAt && record.completedAt >= e.cancelledAt);
      const r = { id: record.matchId, eventId: e.id, releaseId: e.release.id, evidenceHash: hash(record), outcomes: players.map((p) => ({ accountId: p.accountId, result: p.result })), status: voided ? "void" : "applied", at: now() };
      insert("para_receipts", r);
      for (const id of m.attemptIds) {
        const a = attempt(id), player = players.find((p) => p.accountId === a.accountId);
        if (a.matchId !== m.id) fail("Attempt reservation mismatch.");
        a.matchId = null;
        if (!voided) {
          a.played++;
          if (player.result === "win") a.wins++;
          else if (player.result === "loss") a.losses++;
          else a.draws++;
          if (a.wins === e.definition.winTarget || a.losses === e.definition.lossLimit) {
            a.status = "completed"; a.completedAt = record.completedAt;
            const score = scoreRun(e.definition, a);
            const evidence = all("para_receipts").filter((entry) => entry.status === "applied" && get("para_matches", entry.id)?.attemptIds.includes(a.id)).map((entry) => ({ matchId: entry.id, sha256: entry.evidenceHash }));
            insert("para_awards", { id: `prestige:${a.id}`, idempotencyKey: `prestige:${a.id}`, accountId: a.accountId, seasonId: a.seasonId, attemptId: a.id,
              releaseId: e.release.id, scoringHash: e.definitionHash, amount: score.prestige, ...score, week: e.definition.week,
              awardedAt: now(), evidence, distinctions: e.definition.rewards.filter((reward) => a.wins >= reward.wins).map((reward) => ({ entitlementId: reward.entitlementId, fulfillment: "unavailable" })) });
          }
        }
        if (e.status === "cancelled" && a.status !== "completed") { a.status = a.played ? "cancelled" : "void"; a.completedAt = now(); }
        save("para_attempts", a);
      }
      m.status = r.status; save("para_matches", m);
      db.prepare("DELETE FROM para_failures WHERE id=?").run(m.id);
      return r;
    });
  }
  function failed(id, error) {
    db.prepare("INSERT INTO para_failures(id,body) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body").run(id, JSON.stringify({ id, at: now(), message: error.message }));
  }
  async function recover(findRecord, isLive = () => true) {
    for (const m of all("para_matches").filter((row) => row.status === "pending")) {
      try {
        const record = await findRecord(m.id);
        if (record?.completion?.status === "finalized") settle(record);
        else if (!isLive(m.id)) transaction(() => {
          // No completed canonical record and no recoverable room: release the
          // match slot without changing the durable run's counters.
          const current = get("para_matches", m.id);
          if (current.status !== "pending") return;
          for (const id of m.attemptIds) { const a = attempt(id); if (a.matchId === m.id) { a.matchId = null; save("para_attempts", a); } }
          current.status = "service-void"; save("para_matches", current);
          audit("service-recovery", null, { matchId: m.id });
        });
      } catch (error) { failed(m.id, error); }
    }
  }
  function operate(actorId, { eventId, action, reason }) {
    if (!["pause", "resume", "cancel"].includes(action) || typeof reason !== "string" || !reason.trim() || reason.length > 500) fail("Choose pause, resume or cancel and provide a reason.", 422);
    return transaction(() => {
      const e = event(eventId);
      if (e.status === "cancelled") fail("Cancellation is permanent. Publish a new event ID to replace it.");
      e.status = { pause: "paused", resume: "open", cancel: "cancelled" }[action]; save("para_events", e);
      if (action === "cancel") { e.cancelledAt = now(); save("para_events", e); }
      if (action === "cancel") for (const a of activeAttempts().filter((a) => a.eventId === eventId && !a.matchId)) {
        a.status = a.played ? "cancelled" : "void"; a.completedAt = now(); save("para_attempts", a);
      }
      audit(action, actorId, { eventId, reason: reason.trim() }); return { eventId, status: e.status };
    });
  }
  function view(accountId) {
    const active = sync();
    const mine = awards(accountId);
    return { enabled: true, membership: { automatic: true, free: true }, activeReleaseId: active.id,
      seasons: all("para_seasons").map((s) => progress(accountId, s.id)),
      events: all("para_events").map((e) => ({ ...e.definition, operationalStatus: e.status, releaseId: e.release.id, scoringHash: e.definitionHash,
        eligibility: eligibility(e, accountId), attempts: all("para_attempts").filter((a) => a.accountId === accountId && a.eventId === e.id),
        definitionMismatch: hash(active.snapshot.paraLeague?.events?.find((r) => r.id === e.id) || null) !== e.definitionHash })),
      awards: mine, lifetimePrestige: mine.reduce((sum, a) => sum + a.amount, 0), commerce: "inactive" };
  }
  function inspect() {
    const active = sync();
    const entrants = [...new Set(all("para_attempts").map((a) => a.accountId))];
    return { enabled: true, activeReleaseId: active.id, databaseVersion: 1,
      events: all("para_events").map(({ release, ...e }) => ({ ...e, releaseId: release.id, definitionMismatch: hash(active.snapshot.paraLeague?.events?.find((r) => r.id === e.id) || null) !== e.definitionHash })),
      attempts: all("para_attempts"), awards: awards(), matches: all("para_matches"), receipts: all("para_receipts"), audit: all("para_audit"), failures: all("para_failures"),
      standings: all("para_seasons").map((s) => ({ seasonId: s.id, releaseId: s.releaseId, definitionMismatch: hash(active.snapshot.paraLeague?.seasons?.find((row) => row.id === s.id) || null) !== hash(s.definition), entries: entrants.map((accountId) => ({ accountId, ...progress(accountId, s.id) })).sort((a, b) => compareStandings(s.definition, a, b)) })) };
  }
  function profile(accountId) {
    try {
      const results = awards(accountId), lifetimePrestige = results.reduce((sum, a) => sum + a.amount, 0);
      return { automaticMembership: true, lifetimePrestige, summary: `Para member · ${lifetimePrestige} lifetime Prestige · Official runs completed: ${results.length}` };
    } catch { return { summary: "Para record temporarily unavailable." }; }
  }
  return { enabled: true, status: () => ({ enabled: true, databaseVersion: 1, storage: "Private SQLite WAL on configured persistent volume" }),
    sync, enroll, withdraw, canPlay, reserve, settle, failed, recover, operate, view, inspect, profile, event,
    denied: (id, eventId, reason) => transaction(() => audit("registration-blocked", id, { eventId: String(eventId).slice(0, 80), reason: String(reason).slice(0, 500) })),
    content: (id) => { const e = event(id); if (e.release.snapshot.engine.compatibilityHash !== publication.published().snapshot.engine.compatibilityHash) fail("Pinned event requires a compatible engine deployment.", 503); return resolveEngineContent(e.release.snapshot, e.release.id); }, close: () => db.close() };
}

function registerParaRoutes(app, runtime, requireAccount) {
  const route = (method, url, operation, admin = false) => app[method](url, async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    try {
      const account = admin ? req.gauntletAdminAccount : (await requireAccount(req, res))?.account;
      if (!account) { if (!res.headersSent) res.status(403).json({ error: "Account required." }); return; }
      if (!runtime.enabled) return res.status(method === "get" ? 200 : 503).json(runtime.status());
      res.json(await operation(account.id, req.body || {}));
    } catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : "Para storage unavailable. Refresh before retrying." }); }
  });
  route("get", "/api/para", (id) => runtime.view(id));
  route("post", "/api/para/enroll", (id, input) => { try { return runtime.enroll(id, input); } catch (error) { runtime.denied(id, input.eventId, error.message); throw error; } });
  route("post", "/api/para/withdraw", (id, input) => runtime.withdraw(id, input.attemptId));
  route("post", "/api/para/pool", (id, input) => { const e = runtime.event(input.eventId); return { releaseId: e.release.id, cards: e.release.snapshot.domains.cards }; });
  route("get", "/api/admin/para", () => runtime.inspect(), true);
  route("post", "/api/admin/para/operation", (id, input) => runtime.operate(id, input), true);
}
module.exports = { createParaRuntime, registerParaRoutes };
