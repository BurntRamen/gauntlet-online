"use strict";

const SUITS = ["spades", "hearts", "clubs", "diamonds"];
const VALUE_ORDER = [2, 5, 8, 11, 3, 6, 9, 12, 4, 7, 10, 13, 14];

function normalizedSuit(value) {
  return ({ "♠": "spades", "♥": "hearts", "♣": "clubs", "♦": "diamonds" })[value] || String(value || "").toLowerCase();
}

function cardValue(card) {
  if (card?.value === "A" || card?.rank === "A") return 14;
  if (card?.value === "K" || card?.rank === "K") return 13;
  if (card?.value === "Q" || card?.rank === "Q") return 12;
  if (card?.value === "J" || card?.rank === "J") return 11;
  return Number(card?.value);
}

function campaignFactionCardTarget(chapterIndex, chapterCount = 12) {
  const index = Math.max(0, Number(chapterIndex) || 0);
  const lastIndex = Math.max(1, (Number(chapterCount) || 12) - 1);
  return Math.min(12, 4 + Math.floor((Math.min(index, lastIndex) * 8) / lastIndex));
}

function campaignFactionCardPool(cards = [], factionId) {
  const buckets = Object.fromEntries(SUITS.map((suit) => [suit, []]));
  for (const card of cards) {
    const suit = normalizedSuit(card?.replacementSuit || card?.suit);
    const value = cardValue(card);
    if (card?.factionId !== factionId || card?.availability?.encounters === false || !buckets[suit] || !VALUE_ORDER.includes(value)) continue;
    buckets[suit].push(card);
  }
  SUITS.forEach((suit, suitIndex) => {
    const offset = suitIndex * 3;
    const rotated = [...VALUE_ORDER.slice(offset), ...VALUE_ORDER.slice(0, offset)];
    buckets[suit].sort((left, right) => rotated.indexOf(cardValue(left)) - rotated.indexOf(cardValue(right)) || String(left.id).localeCompare(String(right.id)));
  });
  const pool = [];
  for (let row = 0; pool.length < cards.length; row += 1) {
    let added = false;
    for (const suit of SUITS) if (buckets[suit][row]) { pool.push(buckets[suit][row]); added = true; }
    if (!added) break;
  }
  return pool;
}

function resolveCampaignFactionCards({ cards = [], factionId, chapterIndex = 0, chapterCount = 12, explicitIds = [] } = {}) {
  const pool = campaignFactionCardPool(cards, factionId);
  const byId = new Map(pool.map((card) => [card.id, card]));
  const selected = [], occupied = new Set();
  const add = (card) => {
    if (!card) return;
    const slot = `${normalizedSuit(card.replacementSuit || card.suit)}:${cardValue(card)}`;
    if (occupied.has(slot) || selected.some((entry) => entry.id === card.id)) return;
    occupied.add(slot);
    selected.push(card);
  };
  for (const id of explicitIds || []) add(byId.get(id));
  const target = Math.max(selected.length, campaignFactionCardTarget(chapterIndex, chapterCount));
  for (const card of pool) {
    if (selected.length >= target) break;
    add(card);
  }
  return selected;
}

module.exports = { campaignFactionCardPool, campaignFactionCardTarget, resolveCampaignFactionCards };
