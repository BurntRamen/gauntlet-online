import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import DeckWorkshop from "./DeckWorkshop";

const card = { id: "test-card", name: "Test Guard", factionId: "rumin", value: 2, suit: "spades", defaultVariantId: "test-card:standard" };
const variants = [
  { variantId: card.defaultVariantId, finish: "standard", name: "Test Guard Standard" },
  { variantId: "test-card:foil", finish: "foil", name: "Test Guard Collector Foil", animationStyle: "gilded-march" }
];

test("the visible card version selector updates the slot, matching card and preview, then returns to standard", () => {
  function Workshop() {
    const [selections, setSelections] = useState({});
    return <DeckWorkshop name="My deck" factionId="rumin" factions={[{ id: "rumin", name: "Rumin" }]}
      cards={[card]} owned={{ [card.id]: 1 }} quantities={{ [card.id]: 1 }} suitChoices={{ [card.id]: ["spades"] }}
      variantsByCard={{ [card.id]: variants }} variantSelections={selections} boxId="classic"
      onVariantChange={(id, variantId) => setSelections({ [id]: variantId })} />;
  }
  localStorage.clear();
  const { container } = render(<Workshop />);
  const selector = screen.getByLabelText("Test Guard card version");
  expect(selector.closest("details")).toBeNull();
  expect(selector).toHaveValue(card.defaultVariantId);
  expect(container.querySelector(".is-animated-collector")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Cards", exact: true }));
  fireEvent.change(selector, { target: { value: "test-card:foil" } });
  [".deck-slot", ".deck-slot-preview", ".deck-candidate"].forEach((touchpoint) => {
    expect(container.querySelector(touchpoint + ' [data-collector-style="gilded-march"]')).toBeInTheDocument();
  });
  expect(screen.getByText("Used for this card in game when you save this deck.")).toBeVisible();
  fireEvent.change(selector, { target: { value: card.defaultVariantId } });
  expect(container.querySelector(".is-animated-collector")).toBeNull();
});
