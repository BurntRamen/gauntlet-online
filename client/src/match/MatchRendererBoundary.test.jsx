import { fireEvent, render, screen } from "@testing-library/react";
import MatchRendererBoundary from "./MatchRendererBoundary";

function BrokenRenderer() {
  throw new Error("renderer failed");
}

test("reports render failures and allows restarting the current interface", () => {
  const onFailure = jest.fn();
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

  const { rerender } = render(
    <MatchRendererBoundary resetKey="match-1" onFailure={onFailure}>
      <BrokenRenderer />
    </MatchRendererBoundary>
  );

  expect(screen.getByRole("alert")).toHaveTextContent("The match screen needs to restart");
  expect(onFailure).toHaveBeenCalledWith(expect.any(Error), expect.any(Object));
  rerender(<MatchRendererBoundary resetKey="match-1" onFailure={onFailure}><div>Recovered table</div></MatchRendererBoundary>);
  fireEvent.click(screen.getByRole("button", { name: "Retry match screen" }));
  expect(screen.getByText("Recovered table")).toBeVisible();
  consoleError.mockRestore();
});

test("a new mission clears the previous mission's error", () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  const { rerender } = render(<MatchRendererBoundary resetKey="mission-1"><BrokenRenderer /></MatchRendererBoundary>);
  rerender(<MatchRendererBoundary resetKey="mission-2"><div>Next mission</div></MatchRendererBoundary>);
  expect(screen.getByText("Next mission")).toBeVisible();
  consoleError.mockRestore();
});
