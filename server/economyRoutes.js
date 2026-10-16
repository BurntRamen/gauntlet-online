"use strict";
const { playerView, adminView, quoteView } = require("./economyViews");
const { matchAnalysis } = require("./digitalDelivery");
const { assetEntry } = require("./contentAssets");
function registerEconomyRoutes(app, economy, { requireAccount, records, findRecord, findAccount, listAccounts, refundDeck }) {
  async function operations() {
    const data = economy.enabled ? economy.admin() : economy.status(), accounts = listAccounts ? await listAccounts() : data.accounts || [];
    const ledger = adminView({ ...data, accountOptions: accounts.map(a => ({ id: a.id, name: a.name || a.id })) });
    const account = require("./accountCommerce").adminView(accounts);
    return { ...ledger, tables: [...(ledger.tables || []), ...account.tables], forms: [...(ledger.forms || []), ...(refundDeck ? account.forms : [])], note: `${ledger.note || ""} Timetwister refunds use the captured receipt and the same atomic account storage as its purchase. Saved recipes remain; refunded printing grants are revoked.` };
  }
  async function reconcile(account) { for (const record of await records(account.id, 100)) economy.ingest(record); }
  const send = (admin, work, ledgerRequired = true) => async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    try {
      // Namespace middleware supplies only the allowlisted identity projection.
      // Ledger binding requires the same authoritative creation metadata used
      // by player actions, including when an operator owns a wallet.
      const account = admin ? req.gauntletAdminAccount && await findAccount(req.gauntletAdminAccount.id) : (await requireAccount(req, res))?.account;
      if (!account) { if (!res.headersSent) res.status(403).json({ error: "Admin authorization required." }); return; }
      if (ledgerRequired && !economy.enabled) { res.status(req.method === "GET" ? 200 : 503).json({ view: (admin ? adminView : playerView)(economy.status()), error: economy.status().reason }); return; }
      res.json(await work(account, req));
    } catch (e) { res.status([400, 401, 403, 404, 409, 422].includes(e.status) ? e.status : 503).json({ error: e.status ? e.message : "Gold service unavailable. Retry with the same request key." }); }
  };
  app.get("/api/economy", send(false, async (account) => { await reconcile(account); return { view: playerView(economy.player(account)) }; }));
  app.get("/api/admin/economy", send(true, async () => ({ view: await operations() }), false));
  app.post("/api/admin/economy/refund-deck", send(true, async (actor, req) => {
    if (!refundDeck || typeof req.body?.purchaseRef !== "string" || !/^[a-f0-9-]{36}\/[a-zA-Z0-9-]{16,80}$/.test(req.body.purchaseRef)) throw Object.assign(new Error("Choose an account Timetwister purchase."), { status: 422 });
    const [accountId, purchaseId] = req.body.purchaseRef.split("/");
    const receipt = await refundDeck(accountId, { purchaseId, key: req.body.key, reason: req.body.reason }, actor);
    return { view: await operations(), notice: `Refund ${receipt.id} restored ${receipt.amount} Timetwisters. ${receipt.cardBackPolicy}.` };
  }, false));
  for (const action of ["claim", "quote", "purchase"]) app.post(`/api/economy/${action}`, send(false, async (account, req) => {
    if (action === "claim") await reconcile(account);
    const receipt = economy[action](account, req.body);
    return action === "quote" ? { view: quoteView(receipt) } : { view: playerView(economy.player(account)), notice: `Recorded ${action} receipt ${receipt.id}.` };
  }));
  app.post("/api/economy/reconcile", send(false, async (account, req) => {
    const record = typeof req.body?.matchId === "string" && req.body.matchId.length <= 100 ? await findRecord(req.body.matchId) : null;
    if (!record || record.completion?.status !== "finalized" || !record.participants?.some((p) => p.accountId === account.id)) throw Object.assign(new Error("Finalized owned match evidence is required."), { status: 404 });
    economy.ingest(record); return { view: playerView(economy.player(account)), notice: "Canonical evidence reconciled; Para records award no Gold." };
  }));
  app.post("/api/economy/access", send(false, async (account, req) => {
    const { grant, delivery } = economy.access(account, req.body?.entitlementId);
    if (delivery.kind === "deck") return { view: { title: grant.term.name, summary: "This purchased recipe and its exact cosmetic grants are available in your Deck Library. Refunds revoke their purchased cosmetic contribution; saved recipe knowledge is retained.", tables: [{ title: "Captured recipe", columns: ["Card", "Printing"], rows: delivery.receipt.template.composition.cards.map(row => [row.cardId, row.printingId]) }] } };
    if (delivery.kind === "analysis") return { view: matchAnalysis(await records(account.id, 100), account.id) };
    // Existing assets are already public content. Entitlement access is checked
    // here; downloads cannot be revoked after delivery and are not DRM.
    return { view: { title: grant.term.name, summary: `Acquired ${grant.acquiredAt} · ${grant.expiresAt || "Permanent"} · Purchase ${grant.purchaseId}`, media: { kind: delivery.kind, url: assetEntry(grant.term.asset).path, name: grant.term.name } } };
  }));
  app.post("/api/admin/economy/operate", send(true, async (actor, req) => {
    const target = req.body?.operation === "adjust" && typeof req.body.accountId === "string" ? await findAccount(req.body.accountId) : null;
    const receipt = economy.operate(actor, req.body, target);
    return { view: await operations(), notice: `Operator receipt ${receipt.id} recorded.` };
  }));
}
module.exports = { registerEconomyRoutes };
