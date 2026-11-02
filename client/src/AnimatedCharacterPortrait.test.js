import { render, screen } from "@testing-library/react";
import AnimatedCharacterPortrait from "./AnimatedCharacterPortrait";
import { resolveCharacterPortrait } from "./characterPortraits";

test("resolves named characters before using faction fallback art", () => {
  expect(resolveCharacterPortrait("High Marshal Alden", "rumin")).toContain("high-marshal-alden.webp");
  expect(resolveCharacterPortrait("Unknown Watane adjutant", "jali")).toContain("jali");
});

test("marks a speaking portrait for mouth and command-frame animation", () => {
  const { container } = render(<AnimatedCharacterPortrait speaker="Kaiser" factionId="rumin" speaking />);
  expect(screen.getByRole("img", { name: "Kaiser portrait" })).toHaveClass("is-speaking", "is-animated");
  expect(container.querySelector(".animated-character-portrait-mouth")).toBeInTheDocument();
  expect(container.querySelector(".animated-character-portrait-frame")).toHaveAttribute("src", expect.stringContaining("animated-portrait-frame.png"));
});

test("static portraits remain available when animation is not unlocked", () => {
  render(<AnimatedCharacterPortrait speaker="Kaiser" factionId="rumin" animated={false} />);
  expect(screen.getByRole("img", { name: "Kaiser portrait" })).toHaveClass("is-static");
});
