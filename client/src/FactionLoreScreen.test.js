import { fireEvent, render, screen } from "@testing-library/react";
import FactionLoreScreen from "./FactionLoreScreen";

const manifest = {
  factions: [
    { id: "rumin", name: "Rumin", cardImage: "/rumin.webp", commander: { name: "Kaiser", text: "Convert growth into public power." }, city: { name: "Rumie", text: "Institutions outlast rulers." } },
    { id: "zynarth", name: "Zynarth", cardImage: "/zynarth.webp", commander: { name: "Zalara", text: "Recycle every ending into growth." }, city: { name: "Brood Nest", text: "A living ecology remembers." } }
  ],
  draftSets: [{ id: "convergence", name: "Convergence", factionIds: ["zynarth"] }],
  campaigns: {
    rumin: { homeworld: "Orthea", origin: "River kingdoms became a republic.", arrivalOnReath: "Scouts crossed through a buried Timetwister.", pitch: "The rise and fracture of Rumie.", chapters: [{ id: "one", title: "The Republic", story: "Rumie tests divided power." }], characters: { kaiser: { name: "Kaiser", role: "The Jewel", description: "A reformer who centralizes power." } } },
    zynarth: { homeworld: "K'lar", origin: "A planetary chorus formed a living world.", arrivalOnReath: "Zalara carried a bounded brood to Reath.", pitch: "A wounded ecology seeks continuity.", chapters: [{ id: "seed", title: "The Seed", story: "The brood survives invasion." }], characters: { "K'Lar": "The planetary overmind and homeworld chorus." } }
  }
};

test("lets players search faction backgrounds and open the campaign archive", () => {
  const onOpenCampaign = jest.fn();
  render(<FactionLoreScreen manifest={manifest} onBack={jest.fn()} onOpenCampaign={onOpenCampaign} />);
  expect(screen.getByRole("heading", { name: "Before Reath" })).toBeInTheDocument();
  expect(screen.getByText("River kingdoms became a republic.")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search the archive" }), { target: { value: "planetary chorus" } });
  expect(screen.getByRole("heading", { name: "Zynarth" })).toBeInTheDocument();
  expect(screen.getByText("A planetary chorus formed a living world.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open Zynarth campaign" }));
  expect(onOpenCampaign).toHaveBeenCalledTimes(1);
  expect(onOpenCampaign).toHaveBeenCalledWith("zynarth");
});

test("embedded lore preserves all records inside the existing main landmark", () => {
  const onBack = jest.fn();
  render(<main><h1>Campaign</h1><FactionLoreScreen manifest={manifest} onBack={onBack} onOpenCampaign={jest.fn()} embedded /></main>);
  expect(screen.getAllByRole("main")).toHaveLength(1);
  expect(screen.getByRole("heading", { level: 2, name: "Peoples of Gauntlet" })).toBeInTheDocument();
  expect(document.querySelector(".faction-lore-page")).not.toHaveClass("menu-page");
  expect(screen.getByText("River kingdoms became a republic.")).toBeInTheDocument();
  expect(screen.getByText("Scouts crossed through a buried Timetwister.")).toBeInTheDocument();
  expect(screen.getByText("A reformer who centralizes power.")).toBeInTheDocument();
  expect(screen.getByText("Rumie tests divided power.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Back to Campaign" }));
  expect(onBack).toHaveBeenCalledTimes(1);
});
