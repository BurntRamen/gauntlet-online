import { fireEvent, render, screen } from "@testing-library/react";
import CatalogControls, { CatalogField } from "./CatalogControls";
const state = { live: { domains: { cards: [], sets: [{ id: "set-one", name: "Example set", status: "active" }] } } };
const effects = [{ id: "coin-scale-spear", factionId: "rumin", cardType: "armament", label: "Blade", description: "Adds value when armed." }];
test("pack controls keep suit guarantees fixed and only change the chosen slot or wild chance", () => {
  const recipe = require("../../../shared/duel-rules/packComposition").defaults, onChange = jest.fn();
  render(<CatalogField definition={{ type: "pack-composition", label: "Pack composition" }} value={recipe} onChange={onChange} />);
  expect(screen.getAllByRole("combobox")).toHaveLength(9);
  fireEvent.change(screen.getByLabelText("Slot 5"), { target: { value: "mythic" } });
  expect(onChange).toHaveBeenLastCalledWith({ ...recipe, slots: recipe.slots.map((slot, i) => i === 4 ? "mythic" : slot) });
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "30" } });
  expect(onChange).toHaveBeenLastCalledWith({ ...recipe, wildMythicPercent: 30 });
});
test("creation uses a guided effect contract and never sends a chosen identity or ownership", () => {
  const onCreate = jest.fn();
  render(<CatalogControls creation={{ domain: "cards" }} value={{ name: "New blade" }} state={state} effects={effects} onEdit={jest.fn()} onCreate={onCreate} />);
  expect(screen.getByLabelText("New content name")).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Save new card to draft" }));
  expect(onCreate).toHaveBeenCalledWith({ domain: "cards", setId: "set-one", name: "New blade", effectId: "coin-scale-spear", factionId: "rumin", type: "armament", value: 4, suit: "spades", rarity: "common" });
});
test.each(["composed-rumin-armament", "mechanic-program"])("duplicating %s preserves the selected complete behavior", effectId => {
  const source = { id: "source", name: "Saved blade", factionId: "rumin", type: "armament", value: 4, suit: "spades", effect: { id: effectId, version: 1 } }, onCreate = jest.fn();
  render(<CatalogControls creation={{ domain: "cards", sourceId: source.id }} state={{ ...state, live: { domains: { ...state.live.domains, cards: [source] } } }} effects={effects} onEdit={jest.fn()} onCreate={onCreate} />);
  expect(screen.getByRole("combobox", { name: "Mechanical effect" })).toHaveValue(effectId);
  const save = screen.getByRole("button", { name: "Save new card to draft" }); expect(save).toBeEnabled(); fireEvent.click(save);
  expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ sourceId: source.id, effectId, factionId: "rumin", type: "armament" }));
});
test("membership search keeps existing selections and availability changes only its own flag", () => {
  const onChange = jest.fn();
  const view = render(<CatalogField definition={{ type: "card-list" }} value={["one"]} cards={[{ id: "one", name: "First" }, { id: "two", name: "Second" }]} onChange={onChange} />);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Second" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Second/ }));
  expect(onChange).toHaveBeenLastCalledWith(["one", "two"]);
  view.rerender(<CatalogField definition={{ type: "catalog-flags", label: "Availability", labels: require("../../../server/catalogFlagLabels.json"), keys: ["library", "constructed", "earnedPacks"] }} value={{ library: true, constructed: true, earnedPacks: false }} onChange={onChange} />);
  fireEvent.click(screen.getByLabelText("Eligible for existing earned packs"));
  expect(onChange).toHaveBeenLastCalledWith({ library: true, constructed: true, earnedPacks: true });
});
test("encounter creation chooses a real campaign without supplying protected identities or rewards", () => {
  const onCreate = jest.fn();
  render(<CatalogControls domain="encounters" creation={{ domain: "encounters" }} value={{ name: "Additional challenge", campaignId: "rumin" }} state={{ live: { domains: { sets: [], campaigns: [{ id: "rumin", commanderName: "Rumin archive" }] } } }} onCreate={onCreate} onEdit={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Save new encounter to draft" }));
  expect(onCreate).toHaveBeenCalledWith({ domain: "encounters", name: "Additional challenge", campaignId: "rumin" });
});
test("shared reference controls retain selected archived modifiers and disable new archived assignments", () => {
  render(<CatalogField definition={{ type: "modifier-reference", label: "Rules" }} modifiers={[{ id: "one", name: "Archived selected", status: "archived" }, { id: "two", name: "Archived other", status: "archived" }]} value="one" onChange={jest.fn()} />);
  expect(screen.getByRole("option", { name: "Archived selected" })).toBeEnabled(); expect(screen.getByRole("option", { name: "Archived other" })).toBeDisabled();
  expect(screen.getByRole("combobox", { name: "Draft rules" })).toHaveValue("one");
});

test("faction creation uses only the backend-qualified rules families", () => {
  const onCreate = jest.fn();
  render(<CatalogControls domain="factions" creation={{ domain: "factions" }} value={{ name: "Glass dynasty" }} state={{ ...state, factionFamilies: [{ id: "rumin", name: "Rumin" }] }} onCreate={onCreate} onEdit={jest.fn()} />);
  expect(screen.getByRole("combobox", { name: "Rules family" })).toHaveValue("rumin");
  fireEvent.click(screen.getByRole("button", { name: "Save new faction to draft" }));
  expect(onCreate).toHaveBeenCalledWith({ domain: "factions", name: "Glass dynasty", family: "rumin" });
});
