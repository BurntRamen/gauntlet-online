"use strict";

// The ledger owns purchased grants. Account collection/deck fields are a
// rebuildable projection, never another balance or fulfillment transaction.
// Subtract only our previous contribution before adding current active grants,
// so independently earned/legacy-owned copies survive revocation.
function projectLedgerAccount(account, grants, { collection, progression, library, syncDecks }) {
  const relevant = grants.filter(g => g.term.delivery.kind === "deck");
  if (!relevant.length && !account.stats?.ledgerProjection) return account;
  const stats = structuredClone(account.stats || {}), previous = stats.ledgerProjection || {};
  const active = relevant.filter(g => g.state === "active"), counts = {}, backs = new Set();
  for (const grant of active) {
    const delivery = grant.term.delivery;
    for (const [id, count] of Object.entries(delivery.printingCounts)) counts[id] = (counts[id] || 0) + count;
    backs.add(delivery.cardBackId);
  }
  const cards = collection(stats);
  for (const id of new Set([...Object.keys(previous.printingCounts || {}), ...Object.keys(counts)])) {
    const value = Math.max(0, Number(cards.collectorVariants[id] || 0) - Number(previous.printingCounts?.[id] || 0)) + (counts[id] || 0);
    if (value) cards.collectorVariants[id] = value; else delete cards.collectorVariants[id];
  }
  stats.collection = cards;
  const progress = progression(stats), baseBacks = new Set([...(previous.baseBacks || []), ...progress.cosmetics.unlockedCardBacks.filter(id => !previous.backIds?.includes(id))]);
  if (Number(stats.gamesPlayed || 0) >= 10 || progress.matchHistory.length >= 10) baseBacks.add("arenaCircuit");
  if (progress.achievements["first-win"]) baseBacks.add("victorGold");
  if (progress.achievements["first-campaign-clear"]) baseBacks.add("campaignMap");
  progress.cosmetics.unlockedCardBacks = [...new Set([...baseBacks, ...backs])]; stats.progression = progress;
  const decks = library(stats, account.id), applied = new Set(previous.applied || []);
  for (const grant of relevant) {
    const delivery = grant.term.delivery;
    if (grant.state === "active" && !applied.has(grant.id)) {
      if (!decks.decks.some(d => d.id === delivery.deckRecord.id)) decks.decks.push(structuredClone(delivery.deckRecord));
      decks.activeConstructedDeckId = delivery.deckRecord.id;
    }
    applied.add(grant.id);
    stats.economy ||= {};
    stats.economy.purchaseReceipts ||= {};
    stats.economy.purchaseReceipts[`deck:${delivery.receipt.requestId}`] = structuredClone(delivery.receipt);
  }
  stats.deckLibrary = decks;
  stats.ledgerProjection = { schemaVersion: 1, applied: [...applied], printingCounts: counts, backIds: [...backs], baseBacks: [...baseBacks] };
  syncDecks(stats);
  return { ...account, stats };
}
module.exports = { projectLedgerAccount };
