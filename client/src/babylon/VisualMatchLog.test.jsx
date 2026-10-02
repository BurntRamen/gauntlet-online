import { render, screen, fireEvent } from "@testing-library/react";
import { MatchLogRow } from "./VisualMatchLog";

test("shows icon shorthand first and exposes the original explanation through an accessible disclosure", () => {
  const { container } = render(<ol><MatchLogRow index={0} entry={{ sequence: 8, type: "damage.calculated", turn: 2,
    attackValue: 12, blockValue: 4, prevented: 1, damage: 7 }} /></ol>);
  const details = container.querySelector("details");
  const summary = container.querySelector("summary");
  expect(details).not.toHaveAttribute("open");
  expect(summary).toHaveAccessibleName(/12 attack − 4 block − 1 prevention = 7 damage/);
  expect(summary).toHaveTextContent("Damage");
  expect(summary).not.toHaveTextContent("damage calculated");
  fireEvent.click(summary);
  expect(details).toHaveAttribute("open");
  expect(screen.getByText("7 damage calculated")).toBeVisible();
  expect(screen.getByText("12 attack − 4 block − 1 prevention = 7 damage")).toBeVisible();
});

test("labels both player colors and leaves a legible card when its image cannot load", () => {
  const { container } = render(<ol><MatchLogRow index={0} compact players={{ 1: { name: "Ada", faction: { id: "sheen" } } }}
    entry={{ type: "attack.declared", player: 1, targetPlayer: 2, card: { rank: "9", suit: "♥" }, attackValue: 9 }} /></ol>);
  expect(container.querySelector('[data-player-color="blue"]')).toHaveTextContent("P1");
  expect(container.querySelector('[data-player-color="red"]')).toHaveTextContent("P2");
  fireEvent.error(container.querySelector("img"));
  expect(container.querySelector("img")).toHaveAttribute("hidden");
  expect(container.querySelector('[data-card-kind="faction"]')).toHaveTextContent("9♥");
});
