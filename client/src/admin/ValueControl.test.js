import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ValueControl, { EditorValues } from "./ValueControl";

test("nested array edits retain other records and clearing an optional value removes it", () => {
  const original = { rows: [{ amount: 2, optional: 4 }, { amount: 7 }] }, changed = jest.fn();
  function Editor() {
    const [value, setValue] = useState(original);
    return <EditorValues value={value} onChange={next => { changed(next); setValue(next); }}>
      <ValueControl label="Amount" type="number" path={["rows", 0, "amount"]} min={1} max={8} required />
      <ValueControl label="Optional amount" type="number" optional path={["rows", 0, "optional"]} />
    </EditorValues>;
  }
  render(<Editor />);
  fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "5" } });
  expect(changed.mock.calls.at(-1)[0]).toEqual({ rows: [{ amount: 5, optional: 4 }, { amount: 7 }] });
  expect(original.rows[0].amount).toBe(2);
  fireEvent.change(screen.getByLabelText("Optional amount"), { target: { value: "" } });
  expect(changed.mock.calls.at(-1)[0]).toEqual({ rows: [{ amount: 5 }, { amount: 7 }] });
  expect(screen.getByLabelText("Amount")).toHaveAttribute("max", "8");
});

test.each(["", 0, null])("numeric clearing preserves the editor's explicit empty value %p", empty => {
  const change = jest.fn();
  render(<ValueControl label="Amount" type="number" value={5} empty={empty} onChange={change} />);
  fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "" } });
  expect(change).toHaveBeenLastCalledWith(empty);
});

test("choice values stay strings unless numeric conversion is requested, and disabled is inherited", () => {
  const change = jest.fn();
  render(<EditorValues disabled>
    <ValueControl label="Locked" options={[1, 2]} value={1} onChange={change} />
    <ValueControl label="Text choice" disabled={false} options={[1, 2]} value={1} onChange={change} />
    <ValueControl label="Numeric choice" disabled={false} number options={[1, 2]} value={1} onChange={change} />
  </EditorValues>);
  expect(screen.getByLabelText("Locked")).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Text choice"), { target: { value: "2" } });
  expect(change).toHaveBeenLastCalledWith("2");
  fireEvent.change(screen.getByLabelText("Numeric choice"), { target: { value: "2" } });
  expect(change).toHaveBeenLastCalledWith(2);
});

test("checkbox paths edit booleans while retaining the surrounding contract", () => {
  const changed = jest.fn();
  function Editor() {
    const [value, setValue] = useState({ cost: { consumeSource: false, life: 3 } });
    return <EditorValues value={value} onChange={next => { setValue(next); changed(next); }}>
      <ValueControl label="Discard support" type="checkbox" path={["cost", "consumeSource"]} />
    </EditorValues>;
  }
  render(<Editor />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Discard support" }));
  expect(changed).toHaveBeenLastCalledWith({ cost: { consumeSource: true, life: 3 } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Discard support" }));
  expect(changed).toHaveBeenLastCalledWith({ cost: { consumeSource: false, life: 3 } });
});
