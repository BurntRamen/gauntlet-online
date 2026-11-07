import { fireEvent, render, screen } from "@testing-library/react";
import UnsavedChangesDialog from "./UnsavedChangesDialog";

test("browser-restored background focus stays in the departure dialog until it closes", () => {
  const input = document.createElement("input");
  document.body.append(input); input.focus();
  const onKeep = jest.fn(), onDiscard = jest.fn();
  const { unmount } = render(<UnsavedChangesDialog onKeep={onKeep} onDiscard={onDiscard} />);
  const keep = screen.getByRole("button", { name: "Keep editing" });
  const discard = screen.getByRole("button", { name: "Discard local edits and continue" });
  expect(keep).toHaveFocus();
  input.focus(); // Native history restoration can occur after the modal effect.
  expect(keep).toHaveFocus();
  discard.focus(); expect(discard).toHaveFocus();
  fireEvent.keyDown(discard, { key: "Tab" }); expect(keep).toHaveFocus();
  fireEvent.keyDown(keep, { key: "Tab", shiftKey: true }); expect(discard).toHaveFocus();
  fireEvent.keyDown(discard, { key: "Escape" }); expect(onKeep).toHaveBeenCalledTimes(1);
  expect(onDiscard).not.toHaveBeenCalled();
  unmount(); expect(input).toHaveFocus();
  input.remove();
});
