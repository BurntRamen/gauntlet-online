import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlayMenu, PlayModeCard } from "./PlayMenu";

function MenuHarness() {
  const [view, setView] = useState("practice");
  return <PlayMenu view={view} onSelectView={setView}>Scene content</PlayMenu>;
}

test("keyboard navigation selects, focuses, and links the active play scene", () => {
  render(<MenuHarness />);
  const practice = screen.getByRole("tab", { name: /Practice/ });
  const tables = screen.getByRole("tab", { name: /Tables/ });
  const draft = screen.getByRole("tab", { name: /Draft/ });
  fireEvent.keyDown(practice, { key: "ArrowRight" });
  expect(tables).toHaveFocus();
  expect(tables).toHaveAttribute("aria-selected", "true");
  expect(practice).toHaveAttribute("tabindex", "-1");
  expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", tables.id);
  expect(screen.getByRole("tabpanel")).toHaveAttribute("id", tables.getAttribute("aria-controls"));
  fireEvent.keyDown(tables, { key: "ArrowRight" });
  const ranked = screen.getByRole("tab", { name: "Ranked" });
  fireEvent.keyDown(ranked, { key: "ArrowRight" });
  expect(screen.getByRole("tab", { name: "Events" })).toHaveFocus();
  fireEvent.keyDown(tables, { key: "End" });
  expect(draft).toHaveFocus();
  fireEvent.keyDown(draft, { key: "ArrowRight" });
  expect(practice).toHaveFocus();
  fireEvent.keyDown(practice, { key: "ArrowLeft" });
  expect(draft).toHaveFocus();
  fireEvent.keyDown(draft, { key: "Home" });
  expect(practice).toHaveFocus();
});

test("mode cards preserve the disabled identity gate and invoke the selected mode once", () => {
  const start = jest.fn();
  const props = { title: "Basic vs AI", eyebrow: "Solo", description: "Learn the core game.", action: "Enter training", image: "/training.jpg", onClick: start };
  const { rerender } = render(<PlayModeCard {...props} disabled />);
  fireEvent.click(screen.getByRole("button", { name: /Basic vs AI/ }));
  expect(start).not.toHaveBeenCalled();
  rerender(<PlayModeCard {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /Basic vs AI/ }));
  expect(start).toHaveBeenCalledTimes(1);
});
