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

test("shows scheduled majors in local time and prevents early registration", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ events: [{
      id: "fall-grand-gauntlet-2026",
      name: "Fall Grand Gauntlet",
      description: "The first major faction championship.",
      format: "factions",
      scale: "major",
      maxWins: 12,
      maxLosses: 3,
      entryCost: { amount: 0 },
      schedule: {
        startsAt: "2099-10-23T17:00:00.000Z",
        entryClosesAt: "2099-10-26T00:00:00.000Z",
        endsAt: "2099-10-26T04:00:00.000Z"
      },
      availability: { state: "upcoming", label: "Upcoming", canEnter: false, canPlay: false },
      rewardTiers: [{ wins: 1, gold: 500, boosterCredits: 1 }]
    }] })
  });
  const socket = { on: jest.fn(), off: jest.fn(), emit: jest.fn() };
  render(<EventHub serverUrl="" socket={socket} account={{ events: { runs: {} } }} factions={[]} onAccountUpdated={() => {}} onError={() => {}} />);
  expect(await screen.findByRole("heading", { name: "Major Gauntlet weekends" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Fall Grand Gauntlet" })).toBeInTheDocument();
  expect(screen.getByText("500 gold + 1 booster credit")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Opens / })).toBeDisabled();
});
