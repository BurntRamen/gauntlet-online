import { render, screen } from "@testing-library/react";
import AccessibleMatchControls from "./AccessibleMatchControls";

function viewModelForAccessibleControls() {
  return {
    phase: "priority",
    instruction: "Choose an occupied lane or pass.",
    perspective: { player: 1, spectator: false },
    hand: [],
    lanes: [
      { id: "lane-1", index: 0 },
      { id: "lane-2", index: 1 },
      { id: "lane-3", index: 2 }
    ],
    selection: {
      attackMode: null,
      blockMode: null,
      placementMode: null,
      abilityMode: null
    },
    interactions: {
      abilities: [],
      legalLanes: [0],
      laneUnavailableReasons: {
        1: "Your lane is empty.",
        2: "Another attack is unresolved."
      },
      passDisabled: false,
      confirmDisabled: true,
      passLabel: "Pass Priority",
      confirmLabel: "Confirm"
    }
  };
}

test("announces current instructions and unavailable lane reasons semantically", () => {
  render(
    <AccessibleMatchControls
      viewModel={viewModelForAccessibleControls()}
      commands={{}}
    />
  );

  expect(screen.getByRole("status")).toHaveTextContent("Choose an occupied lane or pass.");
  expect(screen.getByRole("button", { name: "Lane 1" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Lane 2" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Lane 3" })).toBeDisabled();
  expect(screen.getByRole("list", { name: "Unavailable lane reasons" })).toHaveTextContent(
    "Lane 2: Your lane is empty."
  );
  expect(screen.getByRole("list", { name: "Unavailable lane reasons" })).toHaveTextContent(
    "Lane 3: Another attack is unresolved."
  );
});
