import { fireEvent, render, screen } from "@testing-library/react";
import MechanicStudio from "./MechanicStudio";
import contract from "@gauntlet/duel-rules/mechanicContract";
const definition = { id: "mechanic-11111111-1111-4111-8111-111111111111", name: "Recovery", interpreter: 1, status: "active", cardTypes: ["spell"], abilities: [contract.ability("activate")] };
const state = { writable: true, live: { studio: { mechanics: [definition] } }, studio: { definitions: [{ ...definition, usedBy: [{ id: "card", name: "New spell" }] }] } };
test("guided costs and primitive bounds prevent invalid saves and preserve unsaved editing", () => {
  const dirty = jest.fn(), act = jest.fn().mockResolvedValue(false);
  render(<MechanicStudio state={state} initialId={definition.id} act={act} onDirty={dirty} />);
  fireEvent.change(screen.getByLabelText("Ability 1 Payment value"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("Effect 1.1 amount"), { target: { value: "9" } });
  expect(screen.getByRole("alert")).toHaveTextContent("unsupported timing, target, duration or amount");
  expect(screen.getByRole("button", { name: "Save mechanic to draft" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Duplicate mechanic" })).toBeDisabled();
  expect(dirty).toHaveBeenLastCalledWith(true);
  fireEvent.change(screen.getByLabelText("Effect 1.1 amount"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Save mechanic to draft" }));
  expect(act).toHaveBeenCalledWith("studio-draft", expect.objectContaining({ operation: "update", id: definition.id, value: expect.objectContaining({ abilities: [expect.objectContaining({ cost: expect.objectContaining({ payment: 3 }), effects: [{ kind: "draw", amount: 2, duration: "instant" }] })] }) }));
});
test("existing card references lead to real card editing and tests; archive requires confirmation", () => {
  const act = jest.fn().mockResolvedValue(false), inspect = jest.fn(), testCard = jest.fn();
  render(<MechanicStudio state={state} initialId={definition.id} act={act} onDirty={jest.fn()} onInspect={inspect} onTest={testCard} />);
  fireEvent.click(screen.getByRole("button", { name: "New spell" })); expect(inspect).toHaveBeenCalledWith("cards", "card");
  fireEvent.click(screen.getByRole("button", { name: "Test New spell in engine" })); expect(testCard).toHaveBeenCalledWith("card");
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false); fireEvent.click(screen.getByRole("button", { name: "Archive mechanic" })); expect(act).not.toHaveBeenCalled();
  confirm.mockReturnValue(true); fireEvent.click(screen.getByRole("button", { name: "Archive mechanic" })); expect(act).toHaveBeenCalledWith("studio-draft", { operation: "archive", id: definition.id }); confirm.mockRestore();
});
