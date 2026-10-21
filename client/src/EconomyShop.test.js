import { render, screen } from "@testing-library/react";
import EconomyShop from "./EconomyShop";
jest.mock("./DeckProducts", () => ({ balance }) => <section aria-label="Deck products">Authoritative Gold {balance.gold}</section>);

test("finite wallet connects deck products without restoring old earning or pack checkout", () => {
  render(<EconomyShop economy={{ source: "finite-gold-ledger", gold: 70, timetwisters: 10 }} deckStore={{ endpoint: "/fixture" }} />);
  expect(screen.getByRole("region", { name: "Deck products" })).toHaveTextContent("Authoritative Gold 70");
  expect(screen.getByText("Timetwisters", { exact: true })).toBeVisible();
  expect(screen.queryByText("Gems", { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByText("Daily Quests")).not.toBeInTheDocument();
  expect(screen.queryByText("Buy Timetwisters")).not.toBeInTheDocument();
  expect(screen.queryByText("Gameplay Packs")).not.toBeInTheDocument();
});
test("pending legacy settlements cannot expose a new Gold purchase against their old balance", () => {
  render(<EconomyShop economy={{ source: "legacy-event-settlement", gold: 100 }} deckStore={{}} />);
  expect(screen.getByText(/Finish or resign your existing event runs/)).toBeVisible();
  expect(screen.queryByRole("region", { name: "Deck products" })).not.toBeInTheDocument();
});
