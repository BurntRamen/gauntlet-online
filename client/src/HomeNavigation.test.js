import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import HomeNavigation from "./HomeNavigation";

function NavigationHarness({ onContinue }) {
  const [area, setArea] = useState("journey");
  return (
    <HomeNavigation
      activeArea={area}
      onSelectArea={setArea}
      nextStep={{
        title: "Learn the core game",
        description: "Start with Basic Gauntlet.",
        actionLabel: "Learn Gauntlet",
        onClick: onContinue
      }}
    >
      <div>Active content</div>
    </HomeNavigation>
  );
}

test("shows one next action and switches between all four product areas", () => {
  const onContinue = jest.fn();
  render(<NavigationHarness onContinue={onContinue} />);

  expect(screen.getByRole("heading", { name: "Learn the core game" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Learn Gauntlet" }));
  expect(onContinue).toHaveBeenCalledTimes(1);

  for (const area of ["Play", "Journey", "Build", "Identity"]) {
    const button = screen.getByRole("button", { name: new RegExp(`^${area}`) });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: area })).toBeInTheDocument();
  }
});
