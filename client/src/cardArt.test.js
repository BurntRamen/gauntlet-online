import { getPlayingCardArtPath, normalizeCardDisplayText } from "./cardArt";

test("maps an ordinary card to its faction playing-card face", () => {
  expect(getPlayingCardArtPath({ rank: "A", value: 14, suit: "diamonds" }, "rumin"))
    .toBe("/assets/gauntlet/playing-cards/rumin-a-diamonds.webp");
  expect(getPlayingCardArtPath({ value: 13, suit: "\u2663" }, "frumo"))
    .toBe("/assets/gauntlet/playing-cards/frumo-k-clubs.webp");
});

test("keeps replacement cards and Basic mode on their existing treatment", () => {
  expect(getPlayingCardArtPath({ value: 8, suit: "hearts", draftCard: true }, "sheen")).toBe("");
  expect(getPlayingCardArtPath({ value: 8, suit: "hearts", type: "weapon" }, "sheen")).toBe("");
  expect(getPlayingCardArtPath({ value: 8, suit: "hearts" }, "basic")).toBe("");
});

test("normalizes malformed suit text used by legacy match messages", () => {
  expect(normalizeCardDisplayText("Ace of â™  (value 14)")).toBe("Ace of \u2660 (value 14)");
  expect(normalizeCardDisplayText("Queen of Ã¢â„¢Â¦")).toBe("Queen of \u2666");
});
