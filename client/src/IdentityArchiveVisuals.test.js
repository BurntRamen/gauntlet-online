import { render, screen } from "@testing-library/react";
import { AchievementHonorCard, CampaignArchiveCard, resolveAchievementVisual } from "./IdentityArchiveVisuals";

const campaigns = {
  bizi: {
    factionName: "Bizi",
    title: "The Clockwork Concord",
    coverImage: "/assets/gauntlet/campaigns/bizi/bizi-campaign-cover.webp",
    chapters: [{ id: "one" }, { id: "two" }]
  }
};

test("uses faction and campaign art for earned honors", () => {
  expect(resolveAchievementVisual({ id: "win-bizi" }, {}, "none", campaigns)).toMatchObject({ factionId: "bizi" });
  expect(resolveAchievementVisual({ id: "first-campaign-clear" }, { bizi: ["one"] }, "none", campaigns)).toEqual({
    factionId: "bizi",
    art: campaigns.bizi.coverImage
  });

  const { container } = render(
    <AchievementHonorCard achievement={{ id: "win-bizi", name: "Bizi Victory", description: "Win with Bizi." }} campaign={{}} selectedFactionBadge="none" campaigns={campaigns} />
  );
  expect(screen.getByText("Bizi Victory")).toBeInTheDocument();
  expect(container.querySelector(".achievement-art")).toHaveStyle({ backgroundImage: "url(/assets/gauntlet/factions/bizi/constanti-technology-hub.webp)" });
});

test("renders campaign archives as image-backed progress cards", () => {
  const { container } = render(<CampaignArchiveCard factionId="bizi" entry={campaigns.bizi} completed={1} />);
  expect(screen.getByText("The Clockwork Concord")).toBeInTheDocument();
  expect(screen.getByLabelText("Bizi: 50% complete")).toBeInTheDocument();
  expect(container.querySelector(".identity-campaign-art")).toHaveStyle({ backgroundImage: `url(${campaigns.bizi.coverImage})` });
});
