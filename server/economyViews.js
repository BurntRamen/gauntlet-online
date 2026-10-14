"use strict";
// Data-only view models. React renders escaped text, forms and semantic tables;
// currency amounts, eligibility and all authorization remain server-side.
const table = (title, columns, rows) => ({ title, columns, rows });
const field = (name, label, type = "text", extra = {}) => ({ name, label, type, required: true, ...extra });
const form = (label, action, values = {}, fields = []) => ({ label, action, values, fields });
const receiptColumns = ["Receipt", "Account", "Product", "Gold", "Release", "Acquired", "Fulfillment"];
const purchaseRow = (p) => [p.id, p.accountId, p.product.name, p.gold, p.releaseId, p.at, p.fulfillment];
const grantColumns = ["Grant", "Account", "Content", "Source purchase", "Acquired", "Expires", "State", "Release"];
const grantRow = (g) => [g.id, g.accountId, g.term.name, g.purchaseId, g.acquiredAt, g.expiresAt || "Permanent", g.state, g.releaseId];
const transactions = (rows) => table("Gold transactions", ["Transaction", "Account", "Kind", "Gold", "Season", "Receipt / claim", "At", "Reason"], rows.map((t) => [t.id, t.accountId, t.kind, t.delta, t.seasonId, t.purchaseId || t.claimId, t.at, t.reason]));
function playerView(data) {
  if (!data.enabled) return { title: "Gold & Library", summary: data.reason };
  return { title: "Gold & Library", summary: `${data.balance} Gold · Published release ${data.activeReleaseId}. Gold buys optional digital content only. Basic history, replay, Para entry and the legal card pool remain free.`,
    tables: [table("Seasonal Gold eligibility", ["Season", "Issued", "Cap", "Remaining", "Pinned release"], data.seasons.map((s) => [s.id, s.issued, s.budget, Math.max(0, s.budget - s.issued), s.releaseId])),
      table("Gold awards", ["Award", "Gold", "Progress", "Claims", "Eligibility", "Release", "Terms"], data.awards.map((a) => [a.name, a.amount, `${a.progress}/${a.minimumOccurrences}`, `${a.claimed}/${a.claimLimit}`, a.reason, a.releaseId, a.currentDefinitionChanged ? "Original terms pinned" : "Current"])),
      table("Published storefront", ["Product", "Gold", "Status", "Includes"], data.catalog.map((o) => [o.product.name, o.product.goldPrice, o.available ? "Available" : o.reason, o.terms?.map((t) => `${t.name} (${t.duration === "days" ? t.durationDays + " days" : t.duration})`).join("; ") || "Unavailable"])),
      table("Your library", grantColumns, data.grants.map(grantRow)), table("Purchase receipts", receiptColumns, data.purchases.map(purchaseRow)), transactions(data.transactions)],
    forms: [...data.awards.filter((a) => a.eligible).map((a) => form(`Claim ${a.name} · ${a.amount} Gold`, "claim", { awardId: a.id })),
      ...data.catalog.filter((o) => o.available).map((o) => form(`Review ${o.product.name} · ${o.product.goldPrice} Gold`, "quote", { productId: o.product.id })),
      ...data.grants.filter((g) => g.state === "active").map((g) => form(`Open ${g.term.name}`, "access", { entitlementId: g.id })),
      form("Recover older match evidence", "reconcile", {}, [field("matchId", "Canonical match ID")])],
    note: "Evidence recovery scans your latest 100 records. Supply an older canonical match ID to recover a missed award; client results never qualify. Timed renewals extend existing access. Refunds revoke only their own grants; retired products retain ownership." };
}
function adminView(data) {
  if (!data.enabled) return { title: "Economy operations", summary: data.reason };
  return { title: "Economy operations", summary: `Imported ${data.totals.imported || 0} · Issued ${data.totals.issued} · Retired ${data.totals.retired} · Refunds restored ${data.totals.restored} · Outstanding ${data.totals.balance} Gold · Pending ${data.totals.pending}. Delivery is committed with the debit. Active deployed release ${data.activeReleaseId}.`,
    tables: [table("Player balances", ["Account", "Gold", "Created", "Ledger binding"], data.accounts.map((a) => [a.id, a.balance, a.createdAt, a.boundAt])),
      table("Seasonal issuance budgets", ["Account", "Season", "Issued", "Cap", "Remaining", "Pinned release"], data.budgets.map((b) => [b.accountId, b.seasonId, b.issued, b.budget, b.budget - b.issued, b.releaseId])),
      table("Award claims", ["Receipt", "Account", "Award", "Occurrence", "Gold", "Season", "Release", "Evidence", "At"], data.claims.map((c) => [c.id, c.accountId, c.awardId, c.ordinal, c.amount, c.seasonId, c.releaseId, c.evidence.join(", "), c.at])),
      table("Verified evidence", ["Evidence", "Account", "Condition", "Match / source", "At", "SHA-256"], data.evidence.map((e) => [e.id, e.accountId, e.condition, e.matchId || e.source, e.at, e.sourceHash || e.identityHash])),
      table("Published products", ["Product", "Name", "State", "Pricing", "Gold", "Limit", "Start", "End"], data.catalog.map((p) => [p.id, p.name, p.status, p.pricing, p.goldPrice, p.purchaseLimit, p.startsAt, p.endsAt])),
      table("Pinned definitions and versions", ["Definition", "Name", "Release", "Gold / price", "Cap / limit", "Delivery", "Recorded"], data.definitions.map((d) => [d.id, d.definition.name, d.releaseId, d.definition.amount ?? d.definition.goldPrice, d.definition.claimLimit ?? d.definition.purchaseLimit, d.terms?.map((t) => `${t.id}: ${t.asset} (${t.duration})`).join("; "), d.at])),
      table("Purchase receipts", receiptColumns, data.purchases.map(purchaseRow)), table("Fulfillment and expirations", grantColumns, data.grants.map(grantRow)), transactions(data.transactions),
      table("Operator audit and failures", ["Audit", "Actor", "Action", "Operation", "Reason", "Receipt / match", "At"], data.audit.map((a) => [a.id, a.actorId, a.action, a.operation, a.reason, a.purchaseId || a.claimId || a.transactionId || a.matchId, a.at]))],
    forms: [form("Record Gold correction", "operate", { operation: "adjust" }, [field("accountId", "Existing account ID"), field("seasonId", "Gold season ID (required for credits)", "text", { required: false }), field("delta", "Signed Gold correction", "number", { min: -1000000, max: 1000000 }), field("reason", "Correction reason", "text", { minLength: 8, maxLength: 1000 })]),
      form("Refund purchase and revoke its grants", "operate", { operation: "refund" }, [field("purchaseId", "Purchase receipt ID"), field("reason", "Refund reason", "text", { minLength: 8, maxLength: 1000 })])],
    note: `Claims: ${data.claims.length}. Failures: ${data.audit.filter((a) => a.action.includes("failed")).length}. Search applies across loaded records. Author catalog and price changes in the definition editor, then preview and publish; these operator forms affect accounts immediately and append an audit trail. Credits consume the original season cap; refunds do not reset issuance or purchase limits. Local volume only; this does not verify remote activation.` };
}
function quoteView(q) {
  return { title: `Review ${q.product.name}`, summary: `${q.product.goldPrice} Gold · Quote expires ${q.expiresAt} · Release ${q.releaseId}`,
    tables: [table("Purchase terms", ["Content", "Access", "Rights reference"], q.terms.map((t) => [t.name, t.duration === "days" ? `${t.durationDays} days (extends current access)` : t.duration === "season" ? `Until ${t.endsAt}` : "Permanent", t.rightsReference]))],
    forms: [form(`Confirm purchase · ${q.product.goldPrice} Gold`, "purchase", { quoteId: q.id })], note: "Only this quoted price and these terms can be accepted. A new release requires a new quote." };
}
module.exports = { playerView, adminView, quoteView };
