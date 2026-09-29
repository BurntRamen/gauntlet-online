import { fireEvent, render, screen } from "@testing-library/react";
import LegaciesPanel from "./LegaciesPanel";

const generals = [
  { id: "monti", name: "Monti", ability: "Grand Celebration", identity: "Spectacular turns", text: "Monti draft ability" },
  { id: "hui", name: "Hui", ability: "Invite Everyone", identity: "Suit synergy", text: "Hui draft ability" }
];
const set = { number: 2, name: "Legacies", factions: [{ id: "mekan", name: "Mekan", story: [], festivals: [], generals, commander: { name: "Allegro" }, city: { name: "San Mikal" } }] };

test("previews one General at a time without claiming to save a deck or launch a match", () => {
  render(<LegaciesPanel set={set} />);
  fireEvent.click(screen.getByText("Explore Mekan lore and abilities"));
  expect(screen.getByText(/Mekan is not yet available for matches or saved decks/)).toBeVisible();
  expect(screen.getByText("Monti draft ability")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Explore a General"), { target: { value: "hui" } });
  expect(screen.getByText("Hui draft ability")).toBeVisible();
  expect(screen.queryByText("Monti draft ability")).not.toBeInTheDocument();
});

test("an older server without Legacies content remains supported", () => {
  const { container } = render(<LegaciesPanel />);
  expect(container).toBeEmptyDOMElement();
});

test("switches from Mekan to the playable Jali overview", () => {
  const jali = {
    id: "jali", name: "Jali", status: "playable", identity: "Revenants", story: [], festivals: [],
    generals: [{ id: "basho", name: "Basho", ability: "Call the Formation", identity: "Reveal lanes", text: "Reveal three cards." }],
    commander: { name: "Watane", text: "Create Revenants." }, city: { name: "Katana, Floating City", text: "Strengthen low cards." }
  };
  render(<LegaciesPanel set={{ ...set, factions: [...set.factions, jali] }} />);
  fireEvent.click(screen.getByRole("button", { name: /Jali/ }));
  expect(screen.getByRole("heading", { name: "Jali", level: 3 })).toBeVisible();
  fireEvent.click(screen.getByText("Explore Jali lore and abilities"));
  expect(screen.getByText(/complete standard 52-card deck/)).toBeVisible();
  expect(screen.getByText("Reveal three cards.")).toBeVisible();
});
