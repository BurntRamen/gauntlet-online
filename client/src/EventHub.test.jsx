import { render, screen } from "@testing-library/react";
import EventHub from "./EventHub";

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test("shows free entry and the event win track", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ events: [{
      id: "open-gauntlet",
      name: "Open Gauntlet",
      description: "Play to seven wins.",
      format: "factions",
      maxWins: 7,
      maxLosses: 3,
      entryCost: { amount: 0 },
      rewardTiers: [{ wins: 1, boosterCredits: 1 }, { wins: 3, cardStyleId: "style" }]
    }] })
  });
  const socket = { on: jest.fn(), off: jest.fn(), emit: jest.fn() };
  render(<EventHub serverUrl="" socket={socket} account={{ events: { runs: {} } }} factions={[]} onAccountUpdated={() => {}} onError={() => {}} />);
  expect(await screen.findByRole("heading", { name: "Open Gauntlet" })).toBeInTheDocument();
  expect(screen.getByText("Free")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Enter free" })).toBeEnabled();
  expect(screen.getByText("animated collector card style")).toBeInTheDocument();
});
