import { fireEvent, render, screen } from "@testing-library/react";
import AccessibleMatchControls from "./AccessibleMatchControls";

test.each(["pending", "unavailable"])("%s cards remain readable without submitting a gameplay action", state => {
  const raw = { id: "visible-card", value: 7 };
  const commands = { inspectCard: jest.fn(), activateHandCard: jest.fn(), previewCard: jest.fn() };
  render(<AccessibleMatchControls interactionLocked={state === "pending"} commands={commands}
    viewModel={{ perspective: { player: 1 }, selection: {}, lanes: [], interactions: {},
      hand: [{ id: raw.id, raw, label: "Seven", value: 7, visible: true, unavailable: state === "unavailable" }] }} />);
  const card = screen.getByRole("button", { name: /Seven.*inspect only/ });
  expect(card).toBeEnabled();
  fireEvent.focus(card);
  expect(commands.previewCard).toHaveBeenCalled();
  fireEvent.click(card);
  expect(commands.inspectCard).toHaveBeenCalledWith(raw);
  expect(commands.activateHandCard).not.toHaveBeenCalled();
});

test("hidden cards cannot be activated for inspection", () => {
  const commands = { inspectCard: jest.fn(), activateHandCard: jest.fn() };
  render(<AccessibleMatchControls commands={commands}
    viewModel={{ perspective: { player: 1 }, selection: {}, lanes: [], interactions: {},
      hand: [{ id: "redacted", label: "Face-down card", visible: false }] }} />);
  expect(screen.getByRole("button", { name: /Face-down/ })).toBeDisabled();
});

test("faction abilities display their purpose or the exact reason they are unavailable", () => {
  render(<AccessibleMatchControls commands={{ activateAbility: jest.fn() }}
    viewModel={{ perspective: { player: 1 }, selection: {}, lanes: [], hand: [], interactions: { abilities: [
      { id: "zynarth:hatch", label: "Zalara · hatch an Egg", available: false,
        intent: "Hatch one Egg.", reason: "Zalara needs an Egg in one of your lanes." },
      { id: "astral:stage:card-1", label: "Myra Cross · stage a card", available: true,
        intent: "Put one hand card on top of your deck." }
    ] } }} />);
  expect(screen.getByText("Zalara needs an Egg in one of your lanes.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Zalara · hatch an Egg" })).toBeDisabled();
  expect(screen.getByText("Put one hand card on top of your deck.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Myra Cross · stage a card" })).toBeEnabled();
});
