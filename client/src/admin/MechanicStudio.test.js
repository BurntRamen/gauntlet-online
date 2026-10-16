import { fireEvent, render, screen } from "@testing-library/react";
import MechanicStudio from "./MechanicStudio";
import contract from "@gauntlet/duel-rules/mechanicContract";
const definition = { id: "mechanic-11111111-1111-4111-8111-111111111111", name: "Recovery", interpreter: 1, status: "active", cardTypes: ["spell"], abilities: [contract.ability("activate")] };
const state = { writable: true, capabilities: { mechanicStudio: 1, ruleModifiers: 1 }, live: { studio: { mechanics: [definition] } }, studio: { definitions: [{ ...definition, usedBy: [{ id: "card", name: "New spell" }] }] } };
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
  fireEvent.click(screen.getByRole("button", { name: "Test New spell in engine" })); expect(testCard).toHaveBeenCalledWith("card", "cards");
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false); fireEvent.click(screen.getByRole("button", { name: "Archive mechanic" })); expect(act).not.toHaveBeenCalled();
  confirm.mockReturnValue(true); fireEvent.click(screen.getByRole("button", { name: "Archive mechanic" })); expect(act).toHaveBeenCalledWith("studio-draft", { operation: "archive", id: definition.id }); confirm.mockRestore();
});
test("modifier editor validates real starting rules and keeps engine buttons outside the saving form", () => {
  const row = { id: "modifier-11111111-1111-4111-8111-111111111111", name: "Short game", status: "active", interpreter: 1, playerLife: 25, opponentLife: 61, handSize: 5 };
  const act = jest.fn().mockResolvedValue(false), start = jest.fn();
  render(<MechanicStudio kind="modifiers" state={{ writable: true, capabilities: { mechanicStudio: 1, ruleModifiers: 1 }, live: { studio: { modifiers: [row] } } }} initialId={row.id} act={act} onDirty={jest.fn()} playtest={<button onClick={start}>Start engine test</button>} />);
  expect(screen.queryByText("Compatible card types")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Starting and refill hand size"), { target: { value: "2" } });
  expect(screen.getByRole("button", { name: "Save modifier to draft" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Starting and refill hand size"), { target: { value: "4" } });
  fireEvent.click(screen.getByRole("button", { name: "Start engine test" })); expect(start).toHaveBeenCalledTimes(1); expect(act).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Start engine test" }).closest("form")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Save modifier to draft" }));
  expect(act).toHaveBeenCalledWith("studio-draft", { kind: "modifiers", operation: "update", id: row.id, value: { ...row, handSize: 4 } });
});
test("an older backend cannot accidentally treat modifier creation as a mechanic request", () => {
  render(<MechanicStudio kind="modifiers" state={{ ...state, capabilities: { mechanicStudio: 1 } }} act={jest.fn()} onDirty={jest.fn()} />);
  expect(screen.getByRole("button", { name: "Create modifier" })).toBeDisabled(); expect(screen.getByRole("status")).toHaveTextContent("does not support");
});
