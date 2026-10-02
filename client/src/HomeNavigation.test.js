import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import HomeNavigation from "./HomeNavigation";

function NavigationHarness({ onContinue, onSound = () => {}, onPreloadArea = () => {} }) {
  const [area, setArea] = useState("journey");
  return (
    <HomeNavigation
      activeArea={area}
      onSelectArea={setArea}
      onPreloadArea={onPreloadArea}
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

test("areas can omit an unrelated recommendation while retaining navigation", () => {
  render(<HomeNavigation activeArea="matches" nextStep={null} onSelectArea={() => {}}>History</HomeNavigation>);
  expect(screen.getByRole("navigation", { name: "Gauntlet areas" })).toBeInTheDocument();
  expect(screen.getByText("History")).toBeInTheDocument();
  expect(document.querySelector(".journey-next-step")).toBeNull();
});

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

test("preloads an area when its navigation target is approached", () => {
  const onPreloadArea = jest.fn();
  render(<NavigationHarness onContinue={() => {}} onPreloadArea={onPreloadArea} />);

  const matchesButton = screen.getByRole("button", { name: /^Matches/ });
  fireEvent.pointerEnter(matchesButton);
  fireEvent.focus(matchesButton);
  expect(onPreloadArea).toHaveBeenCalledWith("matches");
});

function rewardStep(player = "one", credits = 9, onClick = jest.fn()) {
  return { eyebrow: "Vault Reward", title: "Open " + credits + " earned packs", compactTitle: credits + " unused pack credits", description: "Claim your faction cards.", actionLabel: "Open Collection", onClick, minimizeKey: "test-vault-reward:" + player };
}

test("minimizes rewards, retains collection access, and remembers the player's preference", () => {
  localStorage.clear();
  const onClick = jest.fn();
  const props = { activeArea: "journey", onSelectArea: () => {}, nextStep: rewardStep("one", 9, onClick) };
  const { unmount } = render(<HomeNavigation {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Minimize reward" }));
  expect(screen.getByRole("button", { name: "Show reward" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByText("Claim your faction cards.")).not.toBeVisible();
  expect(screen.getByRole("heading", { name: "9 unused pack credits" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open Collection" }));
  expect(onClick).toHaveBeenCalledTimes(1);
  unmount();
  const { rerender } = render(<HomeNavigation {...props} nextStep={rewardStep("one", 10)} />);
  expect(screen.getByRole("heading", { name: "10 unused pack credits" })).toBeInTheDocument();
  rerender(<HomeNavigation {...props} nextStep={rewardStep("two")} />);
  expect(screen.getByRole("button", { name: "Minimize reward" })).toHaveAttribute("aria-expanded", "true");
  rerender(<HomeNavigation {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Show reward" }));
  expect(screen.getByText("Claim your faction cards.")).toBeVisible();
  expect(localStorage.getItem("test-vault-reward:one")).toBe("false");
});

test("does not offer minimize for ordinary recommendations", () => {
  render(<NavigationHarness onContinue={() => {}} />);
  expect(screen.queryByRole("button", { name: "Minimize reward" })).not.toBeInTheDocument();
});

test("reward minimization remains usable when browser storage is blocked", () => {
  const read = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  const write = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  render(<HomeNavigation activeArea="journey" onSelectArea={() => {}} nextStep={rewardStep()} />);
  fireEvent.click(screen.getByRole("button", { name: "Minimize reward" }));
  expect(screen.getByRole("button", { name: "Show reward" })).toBeInTheDocument();
  read.mockRestore();
  write.mockRestore();
});
