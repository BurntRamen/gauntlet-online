import { buildDeckSlots, replaceDeckSlot } from "./deckSlots";

const cards = [
  { id: "guard", value: 7, suit: "hearts" },
  { id: "mender", value: 7, suit: "clubs" },
  { id: "queen", value: 12, suit: "spades" }
];
const owned = { guard: 2, mender: 1, queen: 1 };

test("one-for-one swaps preserve all 52 unique slots and restore the exact standard card", () => {
  let slots = buildDeckSlots(cards, {}, {});
  expect(slots).toHaveLength(52);
  expect(new Set(slots.map((slot) => slot.key)).size).toBe(52);
  const first = replaceDeckSlot(slots, "7:hearts", cards[0], owned);
  slots = buildDeckSlots(cards, first.quantities, first.suitChoices);
  const second = replaceDeckSlot(slots, "7:clubs", cards[1], owned);
  slots = buildDeckSlots(cards, second.quantities, second.suitChoices);
  const swapped = replaceDeckSlot(slots, "7:hearts", cards[0], owned);
  expect(swapped).toEqual({ quantities: { guard: 1, mender: 1 }, suitChoices: { guard: ["hearts"], mender: ["clubs"] } });
  slots = buildDeckSlots(cards, swapped.quantities, swapped.suitChoices);
  const restored = replaceDeckSlot(slots, "7:hearts", null, owned);
  expect(restored).toEqual({ quantities: { mender: 1 }, suitChoices: { mender: ["clubs"] } });
  expect(buildDeckSlots(cards, restored.quantities, restored.suitChoices)).toHaveLength(52);
});

test("a swap cannot use the wrong fixed rank or suit", () => {
  const slots = buildDeckSlots(cards, { mender: 1 }, { mender: ["clubs"] });
  expect(replaceDeckSlot(slots, "7:hearts", cards[1], owned)).toBeNull();
  expect(replaceDeckSlot(slots, "7:hearts", cards[2], owned)).toBeNull();
  expect(replaceDeckSlot(slots, "7:hearts", cards[0], owned)).not.toBeNull();
});
