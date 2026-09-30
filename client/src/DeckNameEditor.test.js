import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import DeckNameEditor from "./DeckNameEditor";

function Editor(props) {
  const [name, setName] = useState("Original deck");
  return <DeckNameEditor name={name} onChange={setName} savedName="Original deck" {...props} />;
}

test("blank and unchanged names cannot be saved; pending saves cannot be submitted twice", async () => {
  let finish;
  const onSave = jest.fn(() => new Promise(resolve => { finish = resolve; }));
  render(<Editor onSave={onSave} />);
  const input = screen.getByRole("textbox", { name: "Deck name" });
  const save = screen.getByRole("button", { name: "Save name" });
  expect(save).toBeDisabled();
  fireEvent.change(input, { target: { value: "   " } });
  expect(save).toBeDisabled();
  fireEvent.change(input, { target: { value: "  Copper Guard  " } });
  fireEvent.click(save);
  expect(onSave).toHaveBeenCalledWith("Copper Guard");
  expect(input).toBeDisabled();
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await act(async () => finish());
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(input).toBeEnabled();
});

test("a rejected rename keeps the typed name and exposes an error for retry", async () => {
  const onSave = jest.fn().mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValueOnce({});
  render(<Editor onSave={onSave} />);
  const input = screen.getByRole("textbox", { name: "Deck name" });
  fireEvent.change(input, { target: { value: "Copper Guard" } });
  fireEvent.click(screen.getByRole("button", { name: "Save name" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost");
  expect(input).toHaveValue("Copper Guard");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save name" })));
  expect(onSave).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
