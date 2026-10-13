import { fireEvent, render, screen } from "@testing-library/react";
import WorkshopField from "./WorkshopField";

test("missing prose uses its default while an invalid null override remains visible and revertible", () => {
  const onSave = jest.fn();
  const state = { writable: true, guide: {}, validation: { errors: [], warnings: [] },
    fields: { game: { practice: { heroTitle: { label: "Page heading", type: "text", defaultValue: "Shipped heading", maxLength: 160 } } } },
    live: { domains: { game: [{ id: "practice" }] } } };
  const props = { state, domain: "game", field: "heroTitle", onSave };
  const view = render(<WorkshopField {...props} row={{ id: "practice" }} />);
  expect(screen.getByRole("textbox")).toHaveValue("Shipped heading");
  expect(screen.getByRole("button", { name: "Revert page heading to live" })).toBeDisabled();
  view.rerender(<WorkshopField {...props} row={{ id: "practice", heroTitle: null }} />);
  expect(screen.getByRole("textbox")).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: "Revert page heading to live" }));
  expect(onSave).toHaveBeenCalledWith(undefined, true);
});
