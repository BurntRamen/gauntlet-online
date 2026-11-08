import { HelpProvider } from "./AuthoringHelp";
const render = element => renderWithoutHelp(element, { wrapper: ({ children }) => <HelpProvider value={require("../../../server/adminAuthoringGuide").help}>{children}</HelpProvider> });
import { useState } from "react";
import { render as renderWithoutHelp, screen, fireEvent } from "@testing-library/react";
import MechanicsEditor, { GeneratedWording } from "./MechanicsEditor";
import contract from "@gauntlet/duel-rules/compositionContract";
import mechanic from "@gauntlet/duel-rules/mechanicContract";
import program from "@gauntlet/duel-rules/mechanicProgram";
const row = { factionId: "rumin", type: "armament", text: "Printed prose" };
const definition = { options: [{ id: "coin-scale-spear", version: 1, factionId: "rumin", cardType: "armament", parameters: { armBonus: { min: 0, max: 8, default: 2 } } }] };
function Editor({ onChange, initial = contract.create(), disabled }) { const [value, set] = useState(initial); return <MechanicsEditor value={value} row={row} definition={definition} disabled={disabled} onChange={next => { set(next); onChange?.(next); }} />; }
test("authors ordered abilities with authoritative explanation, duplication, removal and finite bounds", () => {
  const changed = jest.fn(); render(<Editor onChange={changed} />);
  fireEvent.change(screen.getByLabelText("Ability 1 requirement"), { target: { value: "overpay" } });
  fireEvent.change(screen.getByLabelText("Ability 1 threshold"), { target: { value: "2" } });
  fireEvent.click(screen.getByText("Add effect to ability 1"));
  fireEvent.change(screen.getByLabelText("Ability 1 effect 2"), { target: { value: "gainLife" } });
  expect(screen.getByRole("region", { name: "Generated mechanics explanation" })).toHaveTextContent("then gain 2 life");
  fireEvent.click(screen.getByText("Move effect 2 up"));
  expect(changed.mock.calls.at(-1)[0].abilities[0].effects.map(e => e.kind)).toEqual(["gainLife", "attackBonus"]);
  fireEvent.click(screen.getByText("Duplicate ability 1"));
  fireEvent.click(screen.getByText("Add ability")); fireEvent.click(screen.getByText("Add ability"));
  expect(screen.getByText("Add ability")).toBeDisabled();
  fireEvent.click(screen.getByText("Remove ability 2"));
  expect(screen.getByText("Add ability")).toBeEnabled();
  fireEvent.click(screen.getAllByText("Remove effect 1")[0]);
  fireEvent.change(screen.getByLabelText("Ability 1 effect 1 amount"), { target: { value: "9" } });
  expect(screen.getByRole("alert")).toHaveTextContent("from 1–8");
  expect(screen.getByRole("region", { name: "Generated mechanics explanation" })).toHaveTextContent("Invalid composition");
});
test("switching does not translate legacy prose; flavor/wording are not execution authority", () => {
  render(<Editor initial={{ id: "coin-scale-spear", version: 1, parameters: { armBonus: 6 } }} />);
  fireEvent.change(screen.getByLabelText("Execution model"), { target: { value: "composition" } });
  expect(screen.getByLabelText("Ability 1 effect 1 amount")).toHaveValue(2);
  expect(screen.getByRole("region", { name: "Generated mechanics explanation" })).toHaveTextContent("Printed wording differs");
});
test("generated wording is an explicit edit and disabled state prevents mechanics changes", () => {
  const change = jest.fn(); render(<><Editor disabled /><GeneratedWording row={{ ...row, effect: contract.create() }} onChange={change} /></>);
  expect(screen.getByLabelText("Ability 1 effect 1 amount")).toBeDisabled();
  expect(screen.getByText("Add ability")).toBeDisabled();
  fireEvent.click(screen.getByText("Use generated mechanics explanation as wording"));
  expect(change.mock.calls[0][0]).toMatch(/When this Rumin armament/);
});

test("card modules preserve executable references, keyboard order, arming and explicit generated wording", () => {
  const definitions = [1, 2].map(n => ({ id: `mechanic-0000000${n}-1111-4111-8111-111111111111`, name: `Module ${n}`, status: "active", interpreter: 2, cardTypes: ["armament"], abilities: [mechanic.ability("placed", 2)], explanation: `Draw ${n}` }));
  const studio = { definitions, programVersion: program.VERSION }, change = jest.fn(), inspect = jest.fn();
  function ModularEditor() { const [value, set] = useState(contract.create()); return <><MechanicsEditor value={value} row={row} definition={definition} studio={studio} onInspect={inspect} onChange={next => { change(next); set(next); }} /><GeneratedWording row={{ ...row, effect: value }} studio={studio} onChange={change} /></>; }
  render(<ModularEditor />);
  fireEvent.click(screen.getByText("Combine effect modules"));
  expect(screen.getByLabelText("Include arming effects")).toBeChecked();
  fireEvent.change(screen.getByLabelText("Add effect module"), { target: { value: definitions[0].id } }); fireEvent.change(screen.getByLabelText("Add effect module"), { target: { value: definitions[1].id } });
  expect(screen.getByLabelText("Add effect module")).toBeDisabled();
  expect(screen.getByLabelText("Add effect module").options.length).toBe(1);
  fireEvent.click(screen.getByText("Move module 2 up"));
  expect(change.mock.calls.at(-1)[0].mechanics.map(ref => ref.mechanicId)).toEqual([definitions[1].id, definitions[0].id]);
  expect(change.mock.calls.at(-1)[0].mechanics[0]).toEqual({ id: mechanic.ID, version: 2, mechanicId: definitions[1].id });
  fireEvent.click(screen.getByRole("button", { name: "Edit module 1" })); expect(inspect).toHaveBeenCalledWith("mechanics", definitions[1].id);
  fireEvent.click(screen.getByText("Use generated mechanics explanation as wording")); expect(change.mock.calls.at(-1)[0]).toMatch(/Rumin armament.*Module 2: Draw 2.*Module 1: Draw 1/s);
  fireEvent.click(screen.getByText("Remove module 2")); fireEvent.click(screen.getByText("Remove module 1"));
  fireEvent.click(screen.getByLabelText("Include arming effects"));
  expect(screen.getByRole("alert")).toHaveTextContent("six abilities");
});
