import {
  findCollectorVariant,
  getDeckFeaturedArt,
  getGameplayCardArt,
  getNextCampaignChapter
} from "./contentArt";

const catalog = [
  { variantId: "card-a:standard", gameplayCardId: "card-a", paid: false, art: "/a.webp" },
  { variantId: "card-a:foil", gameplayCardId: "card-a", paid: true, art: "/a.webp" },
  { variantId: "card-b:standard", gameplayCardId: "card-b", paid: false, art: "/b.webp" }
];

test("collector presentation resolution preserves canonical gameplay art", () => {
  expect(findCollectorVariant("card-a", catalog, "card-a:foil")?.variantId).toBe("card-a:foil");
  expect(getGameplayCardArt("card-a", catalog, "card-a:foil")).toBe("/a.webp");
  expect(getGameplayCardArt("missing", catalog)).toBe("");
});

test("deck art uses up to three unique replacement-card illustrations", () => {
  const deck = {
    currentVersionId: "v1",
    versions: [{
      id: "v1",
      gameplayCardQuantities: { "card-a": 2, "card-b": 1 },
      collectorVariantSelections: { "card-a": "card-a:foil" }
    }]
  };
  expect(getDeckFeaturedArt(deck, catalog)).toEqual(["/a.webp", "/b.webp"]);
});

test("campaign continuation prefers the active faction and first uncleared chapter", () => {
  const campaigns = {
    rumin: { chapters: [{ id: "one", image: "/1.webp" }, { id: "two", image: "/2.webp" }] },
    sheen: { chapters: [{ id: "leaf" }] }
  };
  expect(getNextCampaignChapter(campaigns, { rumin: ["one"] }, "rumin")).toMatchObject({
    factionId: "rumin",
    chapterIndex: 1,
    chapter: { id: "two", image: "/2.webp" }
  });
});
