import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import HomeNavigation, { useVaultRewardPreference, VaultCreditBadge } from "./HomeNavigation";

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


function RewardHarness({ player = "one", credits = 9 }) {
  const [minimized, setMinimized] = useVaultRewardPreference(player);
  return <>
    <aside aria-label="Utilities">{minimized && <VaultCreditBadge credits={credits} onRestore={() => setMinimized(false)} />}</aside>
    <HomeNavigation activeArea="journey" onSelectArea={() => {}} nextStep={minimized || !credits ? null : {
      title: "Open earned packs", description: "Claim your faction cards.", actionLabel: "Open Collection", onClick: () => {}, onMinimize: () => setMinimized(true)
    }} />
  </>;
}

test("moves minimized rewards to the utility badge and restores the banner", () => {
  localStorage.clear();
  const { unmount } = render(<RewardHarness />);
  fireEvent.click(screen.getByRole("button", { name: "Minimize reward" }));
  expect(document.querySelector(".journey-next-step")).toBeNull();
  const badge = screen.getByRole("button", { name: "9 unused pack credits. Show vault reward" });
  expect(screen.getByRole("complementary", { name: "Utilities" })).toContainElement(badge);
  unmount();
  const { rerender } = render(<RewardHarness credits={10} />);
  expect(screen.getByRole("button", { name: "10 unused pack credits. Show vault reward" })).toBeInTheDocument();
  rerender(<RewardHarness player="two" />);
  expect(screen.getByRole("button", { name: "Minimize reward" })).toBeInTheDocument();
  rerender(<RewardHarness />);
  fireEvent.click(screen.getByRole("button", { name: "9 unused pack credits. Show vault reward" }));
  expect(screen.getByRole("heading", { name: "Open earned packs" })).toBeInTheDocument();
  expect(document.querySelector(".vault-credit-badge")).toBeNull();
});

test("removes the badge once credits are spent", () => {
  localStorage.clear();
  const { rerender } = render(<RewardHarness />);
  fireEvent.click(screen.getByRole("button", { name: "Minimize reward" }));
  rerender(<RewardHarness credits={0} />);
  expect(document.querySelector(".vault-credit-badge")).toBeNull();
  expect(document.querySelector(".journey-next-step")).toBeNull();
});

test("does not offer minimize for ordinary recommendations", () => {
  render(<NavigationHarness onContinue={() => {}} />);
  expect(screen.queryByRole("button", { name: "Minimize reward" })).not.toBeInTheDocument();
});

test("remains usable when browser storage is blocked", () => {
  const read = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  const write = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  render(<RewardHarness />);
  fireEvent.click(screen.getByRole("button", { name: "Minimize reward" }));
  expect(screen.getByRole("button", { name: "9 unused pack credits. Show vault reward" })).toBeInTheDocument();
  read.mockRestore(); write.mockRestore();
});
