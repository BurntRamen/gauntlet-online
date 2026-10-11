import { fireEvent, render, screen } from "@testing-library/react";
import RelatedContent from "./RelatedContent";

test("shows named authored references and keeps missing references explicit", () => {
  const inspect = jest.fn();
  render(<RelatedContent domain="cards" id="spear" onInspect={inspect} data={{ nodes: [{ key: "cards:spear", domain: "cards", id: "spear", label: "Spear" }, { key: "encounters:first", domain: "encounters", id: "first", label: "First battle" }], edges: [{ from: "encounters:first", to: "cards:spear", kind: "uses-card" }, { from: "cards:spear", to: "unknown", kind: "uses-effect" }] }} />);
  expect(screen.getByText("Used by")).toBeVisible();
  expect(screen.getByText("Reference unavailable")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "First battle" }));
  expect(inspect).toHaveBeenCalledWith("encounters", "first");
});

test("keeps long usage lists focused while preserving every named link and coverage", () => {
  const inspect = jest.fn();
  const refs = Array.from({ length: 10 }, (_, index) => ({ key: `encounters:${index}`, domain: "encounters", id: String(index), label: `Battle ${index}` }));
  render(<RelatedContent domain="cards" id="spear" onInspect={inspect} data={{ nodes: [{ key: "cards:spear", domain: "cards", id: "spear" }, ...refs], edges: refs.map(node => ({ from: node.key, to: "cards:spear", kind: "uses-card" })), coverage: "Authored snapshot references only." }} />);
  expect(screen.getByText("Authored snapshot references only.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Battle 5" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Battle 6" })).not.toBeVisible();
  fireEvent.click(screen.getByText("Show all references (10)"));
  fireEvent.click(screen.getByRole("button", { name: "Battle 9" }));
  expect(inspect).toHaveBeenCalledWith("encounters", "9");
});
