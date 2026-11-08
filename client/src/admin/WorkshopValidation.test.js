import { fireEvent, render, screen } from "@testing-library/react";
import WorkshopValidation from "./WorkshopValidation";

test("revision-scoped issues retain severity and navigate to the exact offending field", () => {
  const inspect = jest.fn();
  render(<WorkshopValidation onInspect={inspect} validation={{ source: "draft", hash: "abcdef", revision: 7,
    errors: [{ domain: "cards", id: "one", field: "name", message: "A name is required." }],
    warnings: [{ domain: "sets", id: "two", message: "No distribution channel selected." }] }} />);
  expect(screen.getByText(/revision 7/)).toBeVisible();
  expect(screen.getByText("Blocking error")).toBeVisible();
  expect(screen.getByText("Warning")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Fix name" }));
  expect(inspect).toHaveBeenCalledWith("cards", "one", "name");
});
