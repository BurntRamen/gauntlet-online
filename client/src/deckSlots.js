export const DECK_SUITS = [
  { id: "spades", symbol: "♠" }, { id: "hearts", symbol: "♥" },
  { id: "diamonds", symbol: "♦" }, { id: "clubs", symbol: "♣" }
];
export const DECK_VALUES = Array.from({ length: 13 }, (_, index) => index + 2);
export const rankLabel = (value) => ({ 11: "J", 12: "Q", 13: "K", 14: "A" })[value] || String(value);
export const slotLabel = (slot) => `${rankLabel(slot.value)} of ${slot.suit}`;

export function buildDeckSlots(cards, quantities, suitChoices) {
  return DECK_VALUES.flatMap((value) => DECK_SUITS.map(({ id: suit }) => {
    const card = cards.find((entry) => Number(entry.value) === value &&
      Array.from({ length: quantities[entry.id] || 0 }, (_, index) => suitChoices[entry.id]?.[index] || DECK_SUITS[index % 4].id).includes(suit));
    return { key: `${value}:${suit}`, value, suit, card: card || null };
  }));
}

// Change exactly one rank/suit slot. Rebuild quantities and suit choices together
// so replacing an existing faction card cannot leave duplicate or orphan copies.
export function replaceDeckSlot(slots, key, card, owned) {
  const target = slots.find((slot) => slot.key === key);
  if (!target || (card && Number(card.value) !== target.value)) return null;
  if (card && slots.filter((slot) => slot.key !== key && slot.card?.id === card.id).length >= Number(owned[card.id] || 0)) return null;
  const quantities = {};
  const suitChoices = {};
  slots.forEach((slot) => {
    const nextCard = slot.key === key ? card : slot.card;
    if (!nextCard) return;
    quantities[nextCard.id] = (quantities[nextCard.id] || 0) + 1;
    (suitChoices[nextCard.id] ||= []).push(slot.suit);
  });
  return { quantities, suitChoices };
}
