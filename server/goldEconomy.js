"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { hash } = require("./authoredContent"), { resolveDelivery } = require("./digitalDelivery");
const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
const id = () => crypto.randomUUID();

function createGoldEconomy({ filename, publication, legacyGoldImport = false, now = () => new Date().toISOString() }) {
  const status = { enabled: !!filename, reason: filename ? "Private local Gold ledger. No Gems, payments, transfers or competitive purchases." : "Gold unavailable: GAUNTLET_ECONOMY_DATA_DIR is not configured." };
  if (!filename) return { enabled: false, status: () => status, ingest: () => {}, failed: () => {} };
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new (require("node:sqlite").DatabaseSync)(filename);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000;");
  const version = db.prepare("PRAGMA user_version").get().user_version;
  if (version > 2) { db.close(); throw new Error("Unsupported Gold database version."); }
  if (!version) db.exec(fs.readFileSync(path.join(__dirname, "migrations/economy/001_gold.sql"), "utf8"));
  if (version < 2) db.exec(fs.readFileSync(path.join(__dirname, "migrations/economy/002_opening_balances.sql"), "utf8"));
  // All authoritative records are append-only, including compensations. There
  // is no mutable balance cache or account-store write in this database.
  for (const table of ["openings", "accounts", "seasons", "definitions", "evidence", "transactions", "claims", "claim_evidence", "quotes", "purchases", "entitlements", "refunds", "revocations", "requests", "audit"]) {
    for (const action of ["UPDATE", "DELETE"]) db.exec(`CREATE TRIGGER IF NOT EXISTS gold_${table}_${action} BEFORE ${action} ON gold_${table} BEGIN SELECT RAISE(ABORT,'Gold records are immutable'); END;`);
  }
  const rows = (table, where = "", args = []) => db.prepare(`SELECT body FROM gold_${table} ${where} ORDER BY rowid`).all(...args).map((r) => JSON.parse(r.body));
  const get = (table, key) => rows(table, "WHERE id=?", [key])[0];
  const put = (table, value, extra = {}) => {
    const data = { id: value.id, ...extra, body: JSON.stringify(value) }, keys = Object.keys(data);
    db.prepare(`INSERT INTO gold_${table}(${keys.join()}) VALUES (${keys.map(() => "?").join()})`).run(...Object.values(data));
    return value;
  };
  const owned = (table, accountId) => rows(table, "WHERE account_id=?", [accountId]);
  const audit = (action, actorId, facts) => put("audit", { id: id(), at: now(), action, actorId, ...facts });
  const pendingLegacyRuns = (account) => Object.values(require("./events").normalizeEventProgress(account.stats || {}).runs).some(run => run.status === "active");
  function transaction(work) {
    db.exec("BEGIN IMMEDIATE");
    try { const result = work(); db.exec("COMMIT"); return result; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  function bind(account) {
    if (!account?.id) fail("An authenticated account is required.", 401);
    const previous = get("accounts", account.id), identity = { id: account.id, createdAt: account.createdAt || null };
    if (previous && previous.createdAt !== identity.createdAt) fail("Account identity changed; operator recovery is required.", 403);
    if (!previous) put("accounts", { ...identity, boundAt: now() });
    if (!get("openings", account.id)) {
      if (pendingLegacyRuns(account)) fail("Finish or resign existing legacy event runs before opening Gold & Library. Their earned Gold will be included in your opening balance.");
      const source = account.stats?.economy || {}, amount = source.gold ?? 0;
      if (!Number.isSafeInteger(amount) || amount < 0) fail("Legacy Gold is invalid; operator recovery is required.", 503);
      if (amount && !legacyGoldImport) fail("Existing Gold requires the approved opening-balance migration before this wallet can open.", 503);
      // Enable only after legacy writers are quiesced. The account source is
      // retained unchanged; this store does not claim cross-database atomicity.
      const opening = { id: account.id, accountId: account.id, kind: "opening-balance", delta: amount, at: now(), seasonId: null,
        source: "legacy-account-economy-v1", sourceHash: hash(source), sourceSnapshot: source,
        reason: "Existing Gold preserved outside seasonal issuance caps" };
      put("openings", opening, { account_id: account.id, delta: amount });
      audit("opening-balance-import", account.id, { amount, sourceHash: opening.sourceHash });
    }
  }
  function sync() {
    const release = publication.published(), config = release.snapshot.paraLeague || require("./paraLeague").emptyConfig();
    for (const a of config.awards.filter((a) => a.status === "active")) {
      const s = config.seasons.find((s) => s.id === a.seasonId);
      if (!get("seasons", s.id)) put("seasons", { id: s.id, definition: s, releaseId: release.id, at: now() });
      if (!get("definitions", `award:${a.id}`)) put("definitions", { id: `award:${a.id}`, definition: a, releaseId: release.id, at: now() });
    }
    for (const p of config.products) {
      const terms = p.entitlements.map((key) => config.entitlements.find((e) => e.id === key));
      const key = `product:${release.id}:${p.id}`;
      if (!get("definitions", key)) put("definitions", { id: key, definition: p, terms, releaseId: release.id, at: now() });
    }
    return { release, config };
  }
  const balance = (accountId) => Number(db.prepare("SELECT COALESCE(SUM(delta),0) AS value FROM (SELECT delta FROM gold_transactions WHERE account_id=? UNION ALL SELECT delta FROM gold_openings WHERE account_id=?)").get(accountId, accountId).value);
  const history = (accountId) => [...owned("openings", accountId), ...owned("transactions", accountId)];
  const issued = (accountId, seasonId) => Number(db.prepare("SELECT COALESCE(SUM(delta),0) AS value FROM gold_transactions WHERE account_id=? AND season_id=? AND kind IN ('award','adjust-credit')").get(accountId, seasonId).value);
  const inWindow = (a) => !!a.startsAt && now() >= a.startsAt && now() < a.endsAt;
  function budget(accountId, seasonId, amount) {
    const s = get("seasons", seasonId);
    if (!s || !inWindow(s.definition)) fail("The pinned Gold season is outside its window.");
    if (issued(accountId, seasonId) + amount > s.definition.goldBudget) fail("Account-season Gold budget exhausted.");
  }
  function move(accountId, kind, delta, facts) {
    if (!Number.isSafeInteger(balance(accountId) + delta)) fail("Gold balance exceeds the exact supported integer range.");
    return put("transactions", { id: id(), accountId, kind, delta, at: now(), ...facts }, { account_id: accountId, season_id: facts.seasonId || null, kind, delta });
  }
  function execute(account, action, input, work) {
    try {
      if (!input || typeof input.key !== "string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(input.key)) fail("Supply a stable request key (8–100 letters, digits, _ or -).", 422);
      return transaction(() => {
        bind(account);
        const key = `${account.id}:${input.key}`, fingerprint = hash({ action, input }), prior = get("requests", key);
        if (prior) { if (prior.fingerprint !== fingerprint) fail("Request key was used for a different operation."); return prior.result; }
        const result = work(sync());
        put("requests", { id: key, fingerprint, result }, { fingerprint });
        return result;
      });
    } catch (error) { audit("failed-request", account?.id || null, { operation: action, reason: error.message, key: typeof input?.key === "string" ? input.key.slice(0, 100) : null }); throw error; }
  }
  function evidence(accountId, condition, key, at, facts) {
    const eid = hash({ accountId, condition, key });
    if (!get("evidence", eid)) put("evidence", { id: eid, accountId, condition, at, ...facts }, { account_id: accountId, condition, at });
  }
  function ingest(record) {
    if (record?.para || record?.completion?.status !== "finalized" || !record.matchId || !record.completedAt) return;
    transaction(() => {
      const people = record.participants || [], humans = people.filter((p) => p.identityType === "account" && p.accountId);
      const humanDuel = people.length === 2 && humans.length === 2 && humans[0].accountId !== humans[1].accountId;
      const trainingDuel = people.length === 2 && humans.length === 1 && people.some((p) => p.identityType === "ai");
      for (const p of humans) {
        if (!["win", "loss", "draw"].includes(p.result)) continue;
        const facts = { matchId: record.matchId, sourceHash: hash(record), result: p.result, mode: record.mode };
        if (record.campaign && trainingDuel && p.result === "win" && record.campaign.chapterId) evidence(p.accountId, "campaign", `${record.campaign.factionId}:${record.campaign.chapterId}`, record.completedAt, facts);
        else if (!record.campaign && trainingDuel && p.result === "win") evidence(p.accountId, record.mode === "basic" ? "basic-training" : "faction-training", record.matchId, record.completedAt, facts);
        else if (!record.campaign && humanDuel) evidence(p.accountId, "ordinary-play", record.matchId, record.completedAt, facts);
        if (record.draft && !record.campaign && (trainingDuel && p.result === "win" || humanDuel)) evidence(p.accountId, "draft-learning", record.matchId, record.completedAt, facts);
      }
    });
  }
  function awardProgress(accountId, a, config) {
    const pin = get("definitions", `award:${a.id}`), d = pin?.definition || a, season = get("seasons", d.seasonId);
    const claims = owned("claims", accountId).filter((c) => c.awardId === d.id);
    const evidenceRows = owned("evidence", accountId).filter((e) => e.condition === d.condition && (e.condition === "welcome" || e.at >= d.startsAt && e.at < d.endsAt) && !db.prepare("SELECT 1 FROM gold_claim_evidence WHERE account_id=? AND award_id=? AND evidence_id=?").get(accountId, d.id, e.id));
    const remaining = Math.max(0, (season?.definition.goldBudget || 0) - issued(accountId, d.seasonId));
    const reason = a.status !== "active" ? `Award ${a.status}.` : !inWindow(a) || !inWindow(d) || !inWindow(season?.definition || {}) ? "Outside the award or season window." : config.seasons.find((s) => s.id === d.seasonId)?.status === "archived" ? "Season archived." : claims.length >= d.claimLimit ? "Claim limit reached." : d.condition === "welcome" && owned("claims", accountId).some((c) => c.condition === "welcome") ? "Initial account award already claimed." : evidenceRows.length < d.minimumOccurrences ? "More verified activity required." : remaining < d.amount ? "Account-season Gold budget exhausted." : "Ready to claim.";
    return { ...d, releaseId: pin?.releaseId || null, currentDefinitionChanged: !!pin && hash(a) !== hash(d), claimed: claims.length, progress: evidenceRows.length, remaining, eligible: reason === "Ready to claim.", reason, evidence: evidenceRows.slice(0, d.minimumOccurrences).map((e) => e.id) };
  }
  function claim(account, input) {
    return execute(account, "claim", input, ({ config }) => {
      evidence(account.id, "welcome", account.id, account.createdAt || now(), { source: "authenticated-account", identityHash: hash({ id: account.id, createdAt: account.createdAt || null }) });
      const a = config.awards.find((a) => a.id === input.awardId); if (!a) fail("Unknown published award.", 404);
      const p = awardProgress(account.id, a, config); if (!p.eligible) fail(p.reason);
      budget(account.id, p.seasonId, p.amount);
      const receipt = { id: id(), accountId: account.id, awardId: p.id, condition: p.condition, ordinal: p.claimed + 1, amount: p.amount, seasonId: p.seasonId, releaseId: p.releaseId, evidence: p.evidence, at: now() };
      put("claims", receipt, { account_id: account.id, award_id: p.id, ordinal: receipt.ordinal });
      for (const eid of p.evidence) db.prepare("INSERT INTO gold_claim_evidence(claim_id,evidence_id,account_id,award_id) VALUES (?,?,?,?)").run(receipt.id, eid, account.id, p.id);
      move(account.id, "award", p.amount, { seasonId: p.seasonId, claimId: receipt.id, releaseId: p.releaseId });
      audit("claim", account.id, { claimId: receipt.id }); return receipt;
    });
  }
  function offer(productId, config) {
    const p = config.products.find((p) => p.id === productId);
    if (!p || p.status !== "active" || !inWindow(p) || !["gold", "free"].includes(p.pricing)) fail("Product is unavailable or outside its offer window.");
    const terms = p.entitlements.map((key) => {
      const term = config.entitlements.find((e) => e.id === key);
      if (!term || term.provenance !== "commercial" || term.fulfillment !== "available") fail("This entitlement cannot be sold.");
      const endsAt = term.duration === "season" ? config.seasons.find((s) => s.id === term.seasonId)?.endsAt : null;
      if (term.duration === "season" && (!endsAt || endsAt <= now())) fail("Seasonal access has expired.");
      const { filename, ...delivery } = resolveDelivery(term);
      return { ...term, endsAt, delivery };
    });
    if (!terms.length) fail("An offer must deliver content.");
    return { product: p, terms };
  }
  function quote(account, input) {
    return execute(account, "quote", input, ({ release, config }) => put("quotes", { id: id(), accountId: account.id, releaseId: release.id, ...offer(input.productId, config), createdAt: now(), expiresAt: new Date(Date.parse(now()) + 15 * 60000).toISOString() }));
  }
  function grants(accountId) {
    return owned("entitlements", accountId).map((g) => ({ ...g, state: rows("revocations", "WHERE entitlement_id=?", [g.id]).length ? "revoked" : g.expiresAt && g.expiresAt <= now() ? "expired" : "active" }));
  }
  function purchase(account, input) {
    return execute(account, "purchase", input, ({ release, config }) => {
      const q = get("quotes", input.quoteId);
      if (!q || q.accountId !== account.id) fail("Quote unavailable.", 404);
      if (rows("purchases", "WHERE quote_id=?", [q.id]).length) fail("Quote already purchased; inspect your receipt.");
      if (q.expiresAt <= now()) fail("Quote expired; request a new price.");
      if (q.releaseId !== release.id) fail("Quote is stale; review the current published price.");
      const current = offer(q.product.id, config);
      if (hash(current) !== hash({ product: q.product, terms: q.terms })) fail("Delivery or offer terms changed.");
      if (owned("purchases", account.id).filter((p) => p.product.id === q.product.id).length >= q.product.purchaseLimit) fail("Product purchase limit reached.");
      if (balance(account.id) < q.product.goldPrice) fail("Insufficient Gold.");
      const existing = grants(account.id), seen = new Set();
      const delivery = q.terms.map((term) => {
        if (seen.has(term.delivery.id)) fail("Bundle contains duplicate delivery assets."); seen.add(term.delivery.id);
        const previous = existing.filter((g) => g.term.delivery.id === term.delivery.id && g.state === "active");
        if (previous.some((g) => !g.expiresAt)) fail("Permanent access is already owned.");
        const start = previous.reduce((t, g) => g.expiresAt > t ? g.expiresAt : t, now());
        const expiresAt = term.duration === "permanent" ? null : term.duration === "season" ? term.endsAt : new Date(Date.parse(start) + term.durationDays * 86400000).toISOString();
        if (term.duration === "season" && previous.some((g) => g.expiresAt >= expiresAt)) fail("Seasonal access is already owned.");
        return { id: id(), accountId: account.id, term, acquiredAt: now(), expiresAt, releaseId: q.releaseId };
      });
      const receipt = { id: id(), accountId: account.id, product: q.product, terms: q.terms, releaseId: q.releaseId, quoteId: q.id, gold: q.product.goldPrice, at: now(), fulfillment: "fulfilled", entitlementIds: delivery.map((g) => g.id) };
      put("purchases", receipt, { account_id: account.id, product_id: q.product.id, quote_id: q.id });
      move(account.id, "purchase", -q.product.goldPrice, { purchaseId: receipt.id, releaseId: q.releaseId });
      for (const g of delivery) put("entitlements", { ...g, purchaseId: receipt.id }, { account_id: account.id, purchase_id: receipt.id });
      audit("purchase-fulfilled", account.id, { purchaseId: receipt.id }); return receipt;
    });
  }
  function access(account, entitlementId) {
    transaction(() => bind(account));
    const grant = grants(account.id).find((g) => g.id === entitlementId && g.state === "active");
    if (!grant) fail("Active owned access is required.", 403);
    const delivery = resolveDelivery(grant.term);
    if (delivery.sha256 !== grant.term.delivery.sha256) fail("Pinned content integrity failed.", 503);
    return { grant, delivery };
  }
  function operate(actor, input, target) {
    return execute(actor, "operator", input, ({ config, release }) => {
      if (typeof input.reason !== "string" || input.reason.trim().length < 8 || input.reason.length > 1000) fail("Record a specific operator reason (8–1000 characters).", 422);
      if (input.operation === "refund") {
        const p = get("purchases", input.purchaseId);
        if (!p) fail("Unknown purchase.", 404);
        if (rows("refunds", "WHERE purchase_id=?", [p.id]).length) fail("Purchase already refunded.");
        const refund = { id: id(), purchaseId: p.id, accountId: p.accountId, amount: p.gold, at: now(), actorId: actor.id, reason: input.reason };
        put("refunds", refund, { purchase_id: p.id });
        move(p.accountId, "refund", p.gold, { purchaseId: p.id, refundId: refund.id, actorId: actor.id, reason: input.reason });
        for (const eid of p.entitlementIds) put("revocations", { id: id(), entitlementId: eid, refundId: refund.id, at: now() }, { entitlement_id: eid });
        audit("refund", actor.id, refund); return refund;
      }
      if (input.operation !== "adjust" || !Number.isSafeInteger(input.delta) || !input.delta || Math.abs(input.delta) > 1000000 || target?.id !== input.accountId) fail("Choose an existing account and a nonzero integer correction within ±1,000,000 Gold.", 422);
      bind(target);
      if (input.delta > 0) {
        const s = config.seasons.find((s) => s.id === input.seasonId && s.status !== "archived");
        if (!s) fail("Choose a current Gold season.");
        if (!get("seasons", s.id)) put("seasons", { id: s.id, definition: s, releaseId: release.id, at: now() });
        budget(target.id, s.id, input.delta);
      }
      if (balance(target.id) + input.delta < 0) fail("Correction cannot make the balance negative.");
      const receipt = move(target.id, input.delta > 0 ? "adjust-credit" : "adjust-debit", input.delta, { seasonId: input.delta > 0 ? input.seasonId : null, actorId: actor.id, reason: input.reason });
      audit("correction", actor.id, { transactionId: receipt.id, reason: input.reason }); return receipt;
    });
  }
  function player(account) {
    return transaction(() => {
      bind(account); const { release, config } = sync();
      evidence(account.id, "welcome", account.id, account.createdAt || now(), { source: "authenticated-account", identityHash: hash({ id: account.id, createdAt: account.createdAt || null }) });
      return { ...status, accountId: account.id, activeReleaseId: release.id, balance: balance(account.id), awards: config.awards.map((a) => { const { evidence, ...p } = awardProgress(account.id, a, config); return p; }),
        seasons: rows("seasons").map((s) => ({ id: s.id, budget: s.definition.goldBudget, issued: issued(account.id, s.id), releaseId: s.releaseId })),
        catalog: config.products.map((p) => { try { const o = offer(p.id, config); return { ...o, available: true }; } catch (e) { return { product: p, available: false, reason: e.message }; } }),
        grants: grants(account.id), transactions: history(account.id), purchases: owned("purchases", account.id) };
    });
  }
  function admin() {
    return transaction(() => {
      const { release, config } = sync(), transactions = [...rows("openings"), ...rows("transactions")], accounts = rows("accounts"), seasons = rows("seasons");
      return { ...status, activeReleaseId: release.id, catalog: config.products, definitions: rows("definitions"),
        totals: { imported: rows("openings").reduce((n, t) => n + t.delta, 0), issued: transactions.filter((t) => ["award", "adjust-credit"].includes(t.kind)).reduce((n, t) => n + t.delta, 0), retired: -transactions.filter((t) => t.delta < 0).reduce((n, t) => n + t.delta, 0), restored: transactions.filter((t) => t.kind === "refund").reduce((n, t) => n + t.delta, 0), balance: transactions.reduce((n, t) => n + t.delta, 0), pending: 0 },
        accounts: accounts.map((a) => ({ ...a, balance: balance(a.id) })), budgets: accounts.flatMap((a) => seasons.map((s) => ({ accountId: a.id, seasonId: s.id, budget: s.definition.goldBudget, issued: issued(a.id, s.id), releaseId: s.releaseId }))),
        claims: rows("claims"), evidence: rows("evidence"), purchases: rows("purchases"), grants: accounts.flatMap((a) => grants(a.id)), transactions, audit: rows("audit"), refunds: rows("refunds") };
    });
  }
  return { enabled: true, status: () => status, wallet: (account) => transaction(() => {
    // Keep login and existing runs usable until their promised rewards settle.
    // New legacy runs are closed by the route layer before migration starts.
    if (!get("openings", account.id) && pendingLegacyRuns(account)) return { source: "legacy-event-settlement", daily: { quests: [] } };
    bind(account); return { gold: balance(account.id), source: "finite-gold-ledger", daily: { quests: [] } };
  }), ingest, claim, quote, purchase, access, operate, player, admin,
    failed: (matchId, error) => audit("evidence-import-failed", null, { matchId, reason: error.message }),
    backup: (destination) => db.prepare("VACUUM INTO ?").run(destination), close: () => db.close() };
}
module.exports = { createGoldEconomy };
