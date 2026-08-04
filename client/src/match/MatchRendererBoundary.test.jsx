import { render, screen } from "@testing-library/react";
import MatchRendererBoundary from "./MatchRendererBoundary";

function BrokenRenderer() {
  throw new Error("renderer failed");
}

test("reports render failures and presents a compatible-renderer handoff", () => {
  const onFailure = jest.fn();
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

  render(
    <MatchRendererBoundary resetKey="match-1" onFailure={onFailure}>
      <BrokenRenderer />
    </MatchRendererBoundary>
  );

  expect(screen.getByRole("status")).toHaveTextContent("Switching to the compatible match renderer");
  expect(onFailure).toHaveBeenCalledWith(expect.any(Error), expect.any(Object));
  consoleError.mockRestore();
});
