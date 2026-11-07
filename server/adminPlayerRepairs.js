"use strict";
const crypto = require("node:crypto"), storeIO = require("./accountStore");
const { hash } = require("./authoredContent");
const uuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const fail = (status, message) => { throw Object.assign(new Error(message), { name: "PlayerRepairError", status }); };
const safeId = value => typeof value === "string" && /^[\w:-]{1,160}$/.test(value) && !["__proto__", "constructor", "prototype"].includes(value);

// Restore durable, non-spendable facts from server-recorded match consequences.
// Never replay the match, its currencies, pack credits, rankings or transactions.
function proposal(account) {
  const stats = structuredClone(account.stats || {}), changes = [], evidence = [];
  const set = (path, value, receipt) => {
    let parent = stats;
    for (const key of path.slice(0, -1)) { parent[key] ||= {}; parent = parent[key]; }
    const key = path.at(-1), before = parent[key] ?? null;
    if (hash(before) === hash(value)) return;
    parent[key] = value; changes.push({ path: path.join("."), before, after: value, receipt });
  };
  for (const [receipt, facts] of Object.entries(stats.matchConsequenceReceipts || {})) {
    if (!facts || !["win", "loss", "draw"].includes(facts.result)) continue;
    const campaign = facts.campaign;
    if (facts.result === "win" && campaign?.outcome === "cleared" && safeId(campaign.factionId) && safeId(campaign.chapterId)) {
      const current = stats.progression?.campaign?.[campaign.factionId] || [];
      if (!Array.isArray(current)) fail(409, "Campaign records need manual reconciliation before an evidence repair.");
      if (!current.includes(campaign.chapterId)) set(["progression", "campaign", campaign.factionId], [...current, campaign.chapterId], receipt);
    }
    for (const item of facts.achievementsUnlocked || []) if (safeId(item?.id) && !stats.progression?.achievements?.[item.id]) set(["progression", "achievements", item.id], structuredClone(item), receipt);
    for (const item of facts.cosmeticsUnlocked || []) {
      const bucket = { titles: "unlockedTitles", cardBacks: "unlockedCardBacks", factionBadges: "unlockedFactionBadges" }[item?.bucket];
      if (!bucket || !safeId(item.id)) continue;
      const current = stats.progression?.cosmetics?.[bucket] || [];
      if (!Array.isArray(current)) fail(409, "Cosmetic records need reconciliation before an evidence repair.");
      if (!current.includes(item.id)) set(["progression", "cosmetics", bucket], [...current, item.id], receipt);
    }
    evidence.push(receipt);
  }
  const result = { action: "restore-recorded-progress", accountId: account.id, changes, evidenceCount: evidence.length,
    boundary: "Restores missing campaign clears, achievements and earned cosmetic unlocks proven by this account's saved match receipts. Does not replay currency, packs, purchases, standings or match results." };
  return { ...result, hash: hash([account.id, account.stats?._accountRevision ?? null, changes, evidence]), stats };
}
function createPlayerRepairService({ useSupabase, request, accountFile }) {
  async function read(id) {
    if (!uuid(id)) fail(400, "Invalid player identity.");
    const remote = useSupabase(), store = remote ? null : storeIO.read(accountFile);
    const account = remote ? (await request(`gauntlet_accounts?id=eq.${id}&select=id,name,stats`))?.[0] : store.accounts.find(account => account.id === id);
    if (!account) fail(404, "Player not found.");
    return { remote, store, account };
  }
  async function preview(id) { const { account } = await read(id), { stats, ...view } = proposal(account); return view; }
  async function apply(id, input, actorId) {
    if (!uuid(actorId) || !input || Object.keys(input).sort().join() !== "action,expectedHash,key,reason" || input.action !== "restore-recorded-progress" || !uuid(input.key) || !/^[a-f0-9]{64}$/.test(input.expectedHash) || typeof input.reason !== "string" || input.reason.trim().length < 8 || input.reason.length > 1000) fail(400, "Review the repair, then provide a reason (8–1000 characters) and a stable request key.");
    const { remote, store, account } = await read(id), operationKey = `${actorId}:${input.key}`, fingerprint = hash([id, input.action, input.expectedHash, input.reason.trim()]);
    const prior = account.stats?.operatorAudit?.find(row => row.operationKey === operationKey);
    if (prior) { if (prior.fingerprint !== fingerprint) fail(409, "This request key already records different repair terms."); return { receipt: prior, alreadyApplied: true }; }
    const next = proposal(account);
    if (next.hash !== input.expectedHash) fail(409, "The recorded evidence changed. Review a fresh repair proposal; nothing was changed.");
    if (!next.changes.length) fail(409, "No missing recorded progress to restore.");
    const receipt = { id: crypto.randomUUID(), accountId: id, actorId, action: input.action, operationKey, fingerprint, reason: input.reason.trim(), at: new Date().toISOString(),
      before: next.changes.map(row => ({ path: row.path, value: row.before })), after: next.changes.map(row => ({ path: row.path, value: row.after })), evidence: [...new Set(next.changes.map(row => row.receipt))] };
    next.stats.operatorAudit = [...(next.stats.operatorAudit || []), receipt];
    if (remote) {
      if (await request("rpc/gauntlet_account_write_capability", { method: "POST", body: "{}" }) !== 1) fail(503, "Account revision guard is unavailable.");
      try {
        const saved = await request(`gauntlet_accounts?id=eq.${id}&select=id`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ stats: next.stats }) });
        if (saved?.length !== 1) fail(409, "Player changed or disappeared. Review the repair again.");
      } catch (error) { if (error.code === "40001") fail(409, "The player changed during this repair. Review a fresh proposal."); throw error; }
    } else { account.stats = next.stats; storeIO.save(accountFile, store); }
    return { receipt, alreadyApplied: false };
  }
  return { preview, apply };
}
function registerPlayerRepairRoutes(app, { authorize, service }) {
  for (const method of ["get", "post"]) app[method]("/api/admin/players/:accountId/repair", async (req, res) => {
    res.set("Cache-Control", "private, no-store"); if (!authorize(req, res)) return;
    try { res.json(method === "get" ? await service.preview(req.params.accountId) : await service.apply(req.params.accountId, req.body, req.gauntletAdminAccount.id)); }
    catch (error) { const status = error.name === "PlayerRepairError" && [400, 404, 409].includes(error.status) ? error.status : 503; res.status(status).json({ error: status === 503 ? "Account repair is unavailable. Retain this request and retry; success has not been confirmed." : error.message }); }
  });
}
module.exports = { proposal, createPlayerRepairService, registerPlayerRepairRoutes };
