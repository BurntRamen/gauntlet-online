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
