import { fireEvent, render, screen } from "@testing-library/react";
import CatalogControls, { CatalogField } from "./CatalogControls";
const state = { live: { domains: { cards: [], sets: [{ id: "set-one", name: "Example set", status: "active" }] } } };
const effects = [{ id: "coin-scale-spear", factionId: "rumin", cardType: "armament", label: "Blade", description: "Adds value when armed." }];
test("creation uses a guided effect contract and never sends a chosen identity or ownership", () => {
  const onCreate = jest.fn();
  render(<CatalogControls creation={{ domain: "cards" }} value={{ name: "New blade" }} state={state} effects={effects} onEdit={jest.fn()} onCreate={onCreate} />);
  expect(screen.getByLabelText("New content name")).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Save new card to draft" }));
  expect(onCreate).toHaveBeenCalledWith({ domain: "cards", setId: "set-one", name: "New blade", effectId: "coin-scale-spear", factionId: "rumin", type: "armament", value: 4, suit: "spades", rarity: "common" });
});
test("membership search keeps existing selections and availability changes only its own flag", () => {
  const onChange = jest.fn();
  const view = render(<CatalogField definition={{ type: "card-list" }} value={["one"]} cards={[{ id: "one", name: "First" }, { id: "two", name: "Second" }]} onChange={onChange} />);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Second" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Second/ }));
  expect(onChange).toHaveBeenLastCalledWith(["one", "two"]);
  view.rerender(<CatalogField definition={{ type: "catalog-flags", label: "Availability", keys: ["library", "constructed", "earnedPacks"] }} value={{ library: true, constructed: true, earnedPacks: false }} onChange={onChange} />);
  fireEvent.click(screen.getByLabelText("Eligible for existing earned packs"));
  expect(onChange).toHaveBeenLastCalledWith({ library: true, constructed: true, earnedPacks: true });
});
