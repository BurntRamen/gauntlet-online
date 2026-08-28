import { render, screen } from "@testing-library/react";
import { CardBackArt, getCardBackDefinition, resolveCardBackAsset } from "./CardBackArt";

test("resolves every earned card back to a production artwork", () => {
  expect(resolveCardBackAsset("classic")).toContain("classic-gauntlet-v2.webp");
  expect(resolveCardBackAsset("victorGold")).toContain("victor-gold-v1.webp");
  expect(resolveCardBackAsset("campaignMap")).toContain("campaign-map-v1.webp");
  expect(getCardBackDefinition("unknown").id).toBe("classic");
});

test("renders an accessible selected card-back preview", () => {
  render(<CardBackArt cardBackId="campaignMap" />);
  expect(screen.getByRole("img", { name: "Campaign Map card back" })).toHaveStyle({
    backgroundImage: expect.stringContaining("campaign-map-v1.webp")
  });
});
