import { fireEvent, render, screen } from "@testing-library/react";
import RecoverableMatchCanvas from "./RecoverableMatchCanvas";

jest.mock("./GauntletMatchCanvas", () => function MockCanvas({ onRendererError }) {
  return <button onClick={() => onRendererError(new Error("WebGL context lost"))}>Simulate graphics failure</button>;
});

test("graphics failure keeps live commands usable and allows retrying the animated table", () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  const commands = { activateHandCard: jest.fn(), activateLane: jest.fn(), passPriority: jest.fn() };
  const viewModel = {
    phase: "priority", perspective: { player: 1 }, selection: {},
    hand: [{ id: "card-1", label: "7♥", value: 7 }],
    lanes: [{ id: "lane-1", index: 0, hasLocalCard: true, localCard: { label: "4♣" }, hasOpponentCard: true, blocks: [] }],
    interactions: { abilities: [], legalLanes: [0] }
  };
  const { rerender } = render(<RecoverableMatchCanvas viewModel={viewModel} commands={commands} />);
  fireEvent.click(screen.getByText("Simulate graphics failure"));
  expect(screen.getByText("Your card: 4♣")).toBeVisible();
  expect(screen.getByText("Opponent: Face-down card")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "7♥, value 7" }));
  fireEvent.click(screen.getByRole("button", { name: "Lane 1" }));
  expect(commands.activateHandCard).toHaveBeenCalledWith(0);
  expect(commands.activateLane).toHaveBeenCalledWith(0, "local");
  rerender(<RecoverableMatchCanvas viewModel={viewModel} commands={commands} interactionLocked />);
  expect(screen.getByRole("button", { name: "7♥, value 7" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Retry animated table" }));
  expect(screen.getByText("Simulate graphics failure")).toBeVisible();
  consoleError.mockRestore();
});
