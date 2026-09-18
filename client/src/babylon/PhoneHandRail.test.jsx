import { fireEvent, render, screen } from "@testing-library/react";
import PhoneHandRail, { usesPhoneHandRail } from "./PhoneHandRail";

const cards = Array.from({ length: 8 }, (_, index) => ({
  id: "hand-" + index, rank: String(index + 2), suit: "♥", label: (index + 2) + "♥",
  value: index + 2, visible: true, artPath: "/existing/" + index + ".webp", selected: {},
  raw: { id: "hand-" + index }
}));
const viewModel = { perspective: { player: 1 }, hand: cards };
const presentation = () => ({ current: { enabled: true, anchors: new Map(), version: 0 } });

test("each visible card has independent art, identity and command index", () => {
  const commands = { activateHandCard: jest.fn(), inspectCard: jest.fn() };
  const ref = presentation();
  render(<PhoneHandRail viewModel={viewModel} commands={commands} presentationRef={ref} />);
  const buttons = screen.getAllByRole("button");
  expect(buttons).toHaveLength(8);
  buttons.forEach((button, index) => {
    expect(button).toHaveAttribute("data-card-index", String(index));
    expect(button).toHaveAttribute("data-hand-actor-id", "card:hand-" + index);
    expect(button.querySelector("img")).toHaveAttribute("src", cards[index].artPath);
  });
  fireEvent.click(buttons[7]);
  expect(commands.activateHandCard).toHaveBeenLastCalledWith(7);
  fireEvent.contextMenu(buttons[3]);
  expect(commands.inspectCard).toHaveBeenLastCalledWith(cards[3].raw);
  expect(ref.current.anchors.size).toBe(8);
});

test("scroll-generated clicks are suppressed without disabling keyboard selection or a new tap", () => {
  const commands = { activateHandCard: jest.fn() };
  render(<PhoneHandRail viewModel={viewModel} commands={commands} presentationRef={presentation()} />);
  const rail = screen.getByTestId("phone-hand-rail");
  const button = screen.getAllByRole("button")[0];
  fireEvent.pointerDown(rail);
  fireEvent.scroll(rail);
  fireEvent.click(button, { detail: 1 });
  expect(commands.activateHandCard).not.toHaveBeenCalled();
  fireEvent.click(button, { detail: 0 });
  expect(commands.activateHandCard).toHaveBeenCalledTimes(1);
  fireEvent.pointerDown(button);
  fireEvent.click(button, { detail: 1 });
  expect(commands.activateHandCard).toHaveBeenCalledTimes(2);
});

test("selection scrolls the chosen identity into view and existing anchors survive a committed card leaving the rail", () => {
  const scroll = jest.fn();
  const previous = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = scroll;
  const ref = presentation();
  const mounted = render(<PhoneHandRail viewModel={viewModel} commands={{}} presentationRef={ref} />);
  try {
    mounted.rerender(<PhoneHandRail viewModel={{ ...viewModel, hand: cards.map((card, index) => ({
      ...card, selected: index === 7 ? { attacker: true } : {}
    })) }} commands={{}} presentationRef={ref} />);
    expect(scroll).toHaveBeenCalledWith({ block: "nearest", inline: "nearest", behavior: "instant" });
    expect(screen.getAllByRole("button")[7]).toHaveAttribute("aria-pressed", "true");
    mounted.rerender(<PhoneHandRail viewModel={{ ...viewModel, hand: cards.slice(0, 7) }} commands={{}} presentationRef={ref} />);
    expect(ref.current.anchors.has("card:hand-7")).toBe(true);
  } finally {
    if (previous) HTMLElement.prototype.scrollIntoView = previous;
    else delete HTMLElement.prototype.scrollIntoView;
  }
});

test("concealed cards never expose their art, value or raw data; failed art retains a usable label", () => {
  const commands = { activateHandCard: jest.fn(), inspectCard: jest.fn() };
  const hidden = { ...cards[0], visible: false, label: "SECRET", value: 14, artPath: "/secret-art.webp" };
  render(<PhoneHandRail viewModel={{ ...viewModel, hand: [hidden, cards[1]] }} commands={commands} presentationRef={presentation()} />);
  expect(screen.getByRole("button", { name: "Face-down card" })).toBeDisabled();
  expect(document.querySelector('img[src="/secret-art.webp"]')).toBeNull();
  fireEvent.contextMenu(screen.getByRole("button", { name: "Face-down card" }));
  expect(commands.inspectCard).not.toHaveBeenCalled();
  fireEvent.error(document.querySelector("img"));
  expect(document.querySelector("img")).toBeNull();
  expect(screen.getByRole("button", { name: "3♥, value 3" })).toBeEnabled();
});

test("phone portrait and short phone landscape use the rail, ordinary tablet and desktop retain canvas hands", () => {
  expect(usesPhoneHandRail(390, 844)).toBe(true);
  expect(usesPhoneHandRail(844, 390)).toBe(true);
  expect(usesPhoneHandRail(1024, 768)).toBe(false);
  expect(usesPhoneHandRail(1440, 900)).toBe(false);
});
