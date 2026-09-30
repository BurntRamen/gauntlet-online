import { act, fireEvent, render, screen } from "@testing-library/react";
import PackOpening, { PACK_PACING, sortPackForReveal } from "./PackOpening";

const cards = [
  { id: "c1", name: "Common One", rarity: "common", value: 2 },
  { id: "r1", name: "Rare One", rarity: "rare", value: 12 },
  { id: "u1", name: "Uncommon One", rarity: "uncommon", value: 7 },
  { id: "u2", name: "Uncommon Two", rarity: "uncommon", value: 8 },
  { id: "m1", name: "Mythic One", rarity: "mythic", value: 14 }
];
beforeEach(() => {
  jest.useFakeTimers();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

test("sorts a copy in uncommon, rare/mythic, common order, preserving duplicate pulls", () => {
  expect(sortPackForReveal([...cards, cards[0]]).map((card) => card.id)).toEqual(["u1", "u2", "r1", "m1", "c1", "c1"]);
  expect(cards[0].id).toBe("c1");
});

test.each(PACK_PACING)("$label reveals one card per interval and pauses without leaking later pulls", (pace) => {
  render(<PackOpening cards={cards} pacing={pace.id} />);
  expect(screen.getByRole("status")).toHaveTextContent("Breaking the seal");
  act(() => jest.advanceTimersByTime(pace.delay));
  expect(screen.getByRole("status")).toHaveTextContent("Uncommon One");
  expect(screen.queryByText("Rare One")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  act(() => jest.advanceTimersByTime(10000));
  expect(screen.getByRole("status")).toHaveTextContent("Uncommon One");
  fireEvent.click(screen.getByRole("button", { name: "Next card" }));
  expect(screen.getByRole("status")).toHaveTextContent("Uncommon Two");
  fireEvent.click(screen.getByRole("button", { name: "Reveal all" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getAllByRole("article")).toHaveLength(cards.length);
});

test("reduced motion retains sequential access and timers clean up on unmount", () => {
  const original = window.matchMedia;
  window.matchMedia = () => ({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  const { unmount } = render(<PackOpening cards={cards} />);
  expect(screen.getByRole("dialog")).toHaveClass("reduced-motion");
  act(() => jest.advanceTimersByTime(1400));
  expect(screen.getByRole("status")).toHaveTextContent("Uncommon One");
  unmount();
  expect(jest.getTimerCount()).toBe(0);
  window.matchMedia = original;
});

test("a previous pack stays in the summary when returning to the workshop", () => {
  const { rerender } = render(<PackOpening cards={cards} autoPlay={false} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getAllByRole("article")).toHaveLength(5);
  rerender(<PackOpening cards={cards} autoPlay={false} visible={false} />);
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  rerender(<PackOpening cards={cards} autoPlay={false} visible />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getAllByRole("article")).toHaveLength(5);
});
