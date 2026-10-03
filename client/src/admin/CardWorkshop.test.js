import { fireEvent, render, screen } from "@testing-library/react";
import CardWorkshop from "./CardWorkshop";

jest.mock("../SpecialCardFace", () => ({ __esModule: true, default: ({ card }) => <p data-testid="card-face">{card.name} · {card.suit} · {card.presentation?.illustration}</p> }));
const card = { id: "spear", name: "Coin Spear", factionId: "rumin", type: "weapon", rarity: "rare", value: 6, text: "Old wording", effect: { id: "spear-effect", version: 1, parameters: { armBonus: 2 } }, defaultVariantId: "spear-first" };
function state() { return { revision: 2, live: { domains: { cards: [card], factions: [{ id: "rumin", name: "Rumin" }], assets: [{ id: "spear-first", gameplayCardId: "spear", name: "Original", art: "first" }, { id: "spear-alt", gameplayCardId: "spear", name: "Alternate", art: "alt" }] } }, validation: { errors: [], warnings: [] }, workshopMetadata: { cardEffects: [{ id: "spear-effect", label: "Armed spear", description: "Uses the deployed arm bonus.", parameters: { armBonus: { min: 0, max: 8, default: 2 } } }] }, previewContent: { releaseId: "release-v1", manifest: { cards: [card], collectorVariants: [{ variantId: "spear-first", presentation: { illustration: "resolved-first" } }, { variantId: "spear-alt", presentation: { illustration: "resolved-alt" } }] } } }; }

test("keeps wording separate from mechanics and previews resolved suit and collector variants", () => {
  const field = jest.fn((name, override) => <div key={`${override?.row.id || "card"}:${name}`}>{name} field</div>);
  const inspect = jest.fn();
  render(<CardWorkshop row={card} state={state()} field={field} onInspect={inspect} />);
  expect(screen.getByRole("heading", { name: "Displayed wording" })).toBeVisible();
  expect(screen.getByText("Uses the deployed arm bonus.")).toBeVisible();
  expect(screen.getByTestId("card-face")).toHaveTextContent("spades · resolved-first");
  fireEvent.change(screen.getByLabelText("Preview suit"), { target: { value: "hearts" } });
  fireEvent.change(screen.getByLabelText("Collector version"), { target: { value: "spear-alt" } });
  expect(screen.getByTestId("card-face")).toHaveTextContent("hearts · resolved-alt");
  expect(field).toHaveBeenLastCalledWith("art", { domain: "assets", row: expect.objectContaining({ id: "spear-alt" }) });
  fireEvent.click(screen.getByText("Inspect effect and its uses"));
  expect(inspect).toHaveBeenCalledWith("card-effects", "spear-effect");
});

test("unsaved artwork prevents silently switching its owner and has no fabricated preview", () => {
  const data = state(); delete data.previewContent;
  render(<CardWorkshop row={card} state={data} field={() => null} unsaved />);
  expect(screen.getByLabelText("Collector version")).toBeDisabled();
  expect(screen.queryByTestId("card-face")).not.toBeInTheDocument();
  expect(screen.getByText(/Preview the saved draft/)).toBeVisible();
});
