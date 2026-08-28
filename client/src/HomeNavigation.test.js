import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import HomeNavigation from "./HomeNavigation";

function NavigationHarness({ onContinue, onSound = () => {} }) {
  const [area, setArea] = useState("journey");
  return (
    <HomeNavigation
      activeArea={area}
      onSelectArea={setArea}
      onSound={onSound}
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

test("shows one next action and switches between all five player product areas", () => {
  const onContinue = jest.fn();
  render(<NavigationHarness onContinue={onContinue} />);

  expect(screen.getByRole("heading", { name: "Learn the core game" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Learn Gauntlet" }));
  expect(onContinue).toHaveBeenCalledTimes(1);

  for (const area of ["Play", "Journey", "Matches", "Build", "Identity"]) {
    const button = screen.getByRole("button", { name: new RegExp(`^${area}`) });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: area })).toBeInTheDocument();
  }
});

test("routes restrained sounds for area changes and the featured commitment", () => {
  const onSound = jest.fn();
  render(<NavigationHarness onContinue={() => {}} onSound={onSound} />);

  fireEvent.click(screen.getByRole("button", { name: /^Play/ }));
  expect(onSound).toHaveBeenLastCalledWith("area");
  fireEvent.click(screen.getByRole("button", { name: /^Play/ }));
  expect(onSound).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "Learn Gauntlet" }));
  expect(onSound).toHaveBeenLastCalledWith("commit");
});
