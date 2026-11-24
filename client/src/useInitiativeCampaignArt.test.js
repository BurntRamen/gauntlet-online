import { renderHook } from "@testing-library/react";
import { chooseBrand, setAccountBrand } from "./brand/brandPreview";
import { useInitiativeCampaignArt } from "./useInitiativeCampaignArt";
import art from "../public/assets/gauntlet/campaigns/initiative-art-v2.json";

test("both brands resolve every Initiative mission and cinematic on the first render", () => {
  const campaigns = Object.fromEntries(Object.entries(art).map(([id, faction]) => [id, {
    coverImage: faction.previousCover?.at(-1),
    chapters: Object.entries(faction.chapters).map(([id, entry]) => ({
      id, image: entry.replaces?.[0], cinematic: { image: entry.previousCinematic?.[0] }
    }))
  }]));
  const published = { campaigns, initiativeArtVersion: 2 };
  setAccountBrand({ id: "campaign-art-test", brandPreview: "suitfire" });
  try {
    for (const brand of ["gauntlet", "suitfire"]) {
      chooseBrand(brand);
      const view = renderHook(() => useInitiativeCampaignArt(published));
      for (const [id, faction] of Object.entries(view.result.current.campaigns)) {
        expect(faction.coverImage).toBe(art[id].cover);
        expect(faction.chapters).toHaveLength(12);
        for (const chapter of faction.chapters) {
          expect(chapter.image).toBe(art[id].chapters[chapter.id].image);
          expect(chapter.cinematic.image).toBe(chapter.image);
        }
      }
      view.unmount();
    }
  } finally { setAccountBrand(null); }
});

test("refreshing preserves a published custom chapter, cinematic, and campaign cover", () => {
  const id = Object.keys(art.bizi.chapters)[0];
  const campaign = { coverImage: "/custom-cover.webp", chapters: [{ id, image: "/custom-scene.webp", cinematic: { image: "/custom-cinematic.webp" } }] };
  const { result, rerender } = renderHook(({ content }) => useInitiativeCampaignArt(content), { initialProps: { content: null } });
  expect(result.current).toBeNull();
  rerender({ content: { campaigns: { bizi: campaign } } });
  expect(result.current.campaigns.bizi).toEqual(campaign);
});
