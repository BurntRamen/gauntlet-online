import {
  expectsPlayingCardArt,
  getPlayingCardArtPath,
  normalizeCardDisplayText
} from "./cardArt";

test("maps an ordinary card to its faction playing-card face", () => {
  expect(getPlayingCardArtPath({ rank: "A", value: 14, suit: "diamonds" }, "rumin"))
    .toBe("/assets/gauntlet/playing-cards/rumin-a-diamonds.webp");
  expect(getPlayingCardArtPath({ value: 13, suit: "\u2663" }, "frumo"))
    .toBe("/assets/gauntlet/playing-cards/frumo-k-clubs.webp");
});

test("maps Basic Gauntlet cards to the neutral production family", () => {
  expect(getPlayingCardArtPath({ value: 8, suit: "hearts" }, "basic"))
    .toBe("/assets/gauntlet/playing-cards/basic-8-hearts.webp");
  expect(getPlayingCardArtPath({ value: 10, suit: "spades", factionId: "basic" }))
    .toBe("/assets/gauntlet/playing-cards/basic-10-spades.webp");
});

test("gives Legacies factions the complete neutral 52-card face family", () => {
  expect(getPlayingCardArtPath({ value: 8, suit: "hearts" }, "mekan"))
    .toBe("/assets/gauntlet/playing-cards/basic-8-hearts.webp");
  expect(getPlayingCardArtPath({ value: 8, suit: "hearts" }, "jali"))
    .toBe("/assets/gauntlet/playing-cards/basic-8-hearts.webp");
  expect(getPlayingCardArtPath({ value: 8, suit: "hearts" }, "gracus"))
    .toBe("/assets/gauntlet/playing-cards/basic-8-hearts.webp");
  expect(getPlayingCardArtPath({ value: 8, suit: "hearts" }, "indela"))
    .toBe("/assets/gauntlet/playing-cards/basic-8-hearts.webp");
});

test("does not guess artwork for unregistered replacement cards", () => {
  expect(getPlayingCardArtPath({ value: 8, suit: "hearts", draftCard: true }, "sheen")).toBe("");
  expect(getPlayingCardArtPath({ value: 8, suit: "hearts", type: "weapon" }, "sheen")).toBe("");
  expect(expectsPlayingCardArt({ value: 8, suit: "hearts", draftCard: true })).toBe(false);
  expect(expectsPlayingCardArt({ value: 8, suit: "hearts" })).toBe(true);
});

test("registered custom cards use full playing-card faces with their assigned suit", () => {
  expect(getPlayingCardArtPath({ id: "instance-17", gameplayCardId: "rumin-gilded-scale-legionary", value: 3, suit: "hearts", draftCard: true }, "rumin"))
    .toBe("/assets/gauntlet/constructed/faces/rumin-gilded-scale-legionary-hearts.webp");
  expect(getPlayingCardArtPath({ definitionId: "sheen-rootwatch-initiate", value: 3, suit: "♣", type: "unit" }, "sheen"))
    .toBe("/assets/gauntlet/constructed/faces/sheen-rootwatch-initiate-clubs.webp");
  expect(expectsPlayingCardArt({ gameplayCardId: "frumo-deckhand-diver", draftCard: true })).toBe(true);
});

test("does not silently substitute an unsupported faction", () => {
  expect(getPlayingCardArtPath({ value: 8, suit: "hearts" }, "unknown-faction")).toBe("");
  expect(expectsPlayingCardArt({ value: 8, suit: "hearts" })).toBe(true);
});

test("normalizes malformed suit text used by legacy match messages", () => {
  expect(normalizeCardDisplayText("Ace of â™  (value 14)")).toBe("Ace of \u2660 (value 14)");
  expect(normalizeCardDisplayText("Queen of Ã¢â„¢Â¦")).toBe("Queen of \u2666");
});
