import { render, screen } from "@testing-library/react";
import DeckShowcase from "./DeckShowcase";

const card = { id: "sheen-raincall-mender", name: "Raincall Mender", value: 4, suit: "hearts", factionId: "sheen" };

test("uses the current version's box, exact front card and collector presentation", () => {
  const variant = { gameplayCardId: card.id, variantId: card.id + ":collector-foil", finish: "foil" };
  const version = { id: "current", deckBoxId: "obsidian", frontCardSlot: "4:hearts", cardQuantities: { [card.id]: 1 }, collectorVariantSelections: { [card.id]: variant.variantId } };
  const deck = { name: "Menders", factionId: "sheen", currentVersionId: "current", versions: [version, { id: "other", deckBoxId: "classic" }] };
  const { container, rerender } = render(<DeckShowcase deck={deck} cards={[card]} collectorCatalog={[variant]} />);
  expect(screen.getByRole("img", { name: "Obsidian deck box for Sheen" })).toBeVisible();
  expect(screen.getByLabelText("Front card: Raincall Mender").querySelector("img")).toHaveAttribute("src", expect.stringContaining("raincall-mender-hearts.webp"));
  expect(container.querySelector(".is-animated-collector")).toBeInTheDocument();
  rerender(<DeckShowcase deck={{ ...deck, versions: [{ ...version, cardQuantities: {} }] }} cards={[card]} />);
  expect(screen.getByRole("img", { name: "4 of hearts standard playing card" })).toBeVisible();
});

test("legacy decks showcase their first replacement and empty decks show an ace", () => {
  const { rerender } = render(<DeckShowcase deck={{ factionId: "sheen", cardQuantities: { [card.id]: 1 } }} cards={[card]} />);
  expect(screen.getByLabelText("Front card: Raincall Mender")).toBeInTheDocument();
  rerender(<DeckShowcase deck={{ factionId: "sheen" }} />);
  expect(screen.getByRole("img", { name: "A of spades standard playing card" })).toBeVisible();
});

test("public profile showcases retain the selected neutral card's faction and foil", () => {
  const neutral = { id: "neutral-guard", name: "Neutral Guard", factionId: "neutral", value: 3, suit: "clubs", collector: { finish: "foil" } };
  const { container } = render(<DeckShowcase deck={{ factionId: "sheen", deckBoxId: "faction", frontCardSlot: "3:clubs", frontCard: neutral }} compact />);
  expect(screen.getByLabelText("Front card: Neutral Guard")).toBeVisible();
  expect(container.querySelector(".is-animated-collector")).toBeInTheDocument();
});
