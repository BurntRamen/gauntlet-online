import { fireEvent, render, screen } from "@testing-library/react";
import EngineWorkshop from "./EngineWorkshop";

const faction = { id: "rumin", name: "Rumin", mechanics: { id: "rhythm", version: 1, parameters: { bonus: 3 } } };
const shared = { id: "shared-rules", handSize: 8 };
const state = { live: { domains: { factions: [faction], cards: [{ id: "spear", name: "Spear", factionId: "rumin", type: "weapon", effect: { id: "spear-effect" } }], game: [shared] } }, workshopMetadata: { cardEffects: [{ id: "spear-effect", label: "Spear effect", factionId: "rumin", cardType: "weapon", parameters: {} }], factionEffects: [{ id: "rhythm", factionId: "rumin", label: "Rhythm", parameters: { bonus: { min: 0, max: 8, default: 3 } } }], gameConfig: { startingLife: 42, deckSize: 52, laneCount: 3, suits: ["spades"], values: [2, 3] } } };

test("effect contracts are read-only and direct editing to an authored card", () => {
  const inspect = jest.fn(), field = jest.fn(), target = jest.fn();
  render(<EngineWorkshop state={state} field={field} onInspect={inspect} onTarget={target} target={{ domain: "card-effects", id: "spear-effect" }} />);
  expect(field).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Spear" }));
  expect(inspect).toHaveBeenCalledWith("cards", "spear");
  fireEvent.change(screen.getByLabelText("Test using card"), { target: { value: "spear" } });
  expect(target).toHaveBeenCalledWith({ domain: "card-effects", id: "spear-effect", cardId: "spear" });
});

test("editable parameters bind to their faction and shared configuration stays bounded", () => {
  const field = jest.fn(() => <p>Owner field</p>);
  const { rerender } = render(<EngineWorkshop state={state} field={field} target={{ domain: "faction-effects", id: "rhythm" }} />);
  expect(field).toHaveBeenCalledWith("mechanics", { domain: "factions", row: faction });
  expect(screen.getByText("0–8")).toBeVisible();
  field.mockClear();
  rerender(<EngineWorkshop state={state} field={field} target={{ domain: "game", id: "shared-rules" }} />);
  expect(field).toHaveBeenCalledTimes(1);
  expect(field).toHaveBeenCalledWith("handSize", { domain: "game", row: shared });
  expect(screen.getByText("42")).toBeVisible();
  expect(screen.getByText("52")).toBeVisible();
});

test("an unused effect cannot claim a card executing a different effect as its test subject", () => {
  const source = { ...state, workshopMetadata: { ...state.workshopMetadata, cardEffects: [{ id: "unused-effect", label: "Unused effect", factionId: "rumin", cardType: "weapon", parameters: {} }] } };
  render(<EngineWorkshop state={source} field={() => null} target={{ domain: "card-effects", id: "unused-effect", cardId: "spear" }} />);
  expect(screen.getByLabelText("Test using card")).toBeDisabled();
  expect(screen.getByLabelText("Test using card")).toHaveValue("");
  expect(screen.getByText("Compatible cards to edit")).toBeVisible();
});

test("search restores remembered workshop context and reports edits without losing it", () => {
  const remember = jest.fn();
  render(<EngineWorkshop state={state} field={() => null} context={{ query: "spear" }} onContext={remember} target={{ domain: "card-effects" }} />);
  expect(screen.getByLabelText("Search rules")).toHaveValue("spear");
  fireEvent.change(screen.getByLabelText("Search rules"), { target: { value: "rumin" } });
  expect(remember).toHaveBeenCalledWith({ query: "rumin" });
});
