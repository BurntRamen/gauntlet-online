import { getPlayingCardArtPath } from "./cardArt";

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
