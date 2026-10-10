import { fireEvent, render, screen } from "@testing-library/react";
import { DraftCardTile } from "./App";

const card = {
  id: "neutral-think",
  draftCopyId: "copy-1",
  factionId: "neutral",
  name: "Think",
  rarity: "common",
  type: "spell",
  value: 3,
  suit: "clubs",
  text: "When used as payment, this pays one additional value.",
  image: "/assets/gauntlet/constructed/neutral/neutral-think.webp"
};

test("the whole limited card is interactive while rules stay in the inspector", () => {
  const onClick = jest.fn();
  const onInspect = jest.fn();
  render(<DraftCardTile card={card} actionLabel="Swap In" onClick={onClick} onInspect={onInspect} />);

  const tile = screen.getByRole("button", { name: "Swap In Think" });
  expect(tile).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByText("⇄ Swap in")).toBeInTheDocument();
  expect(screen.queryByText(card.text)).not.toBeInTheDocument();

  fireEvent.mouseEnter(tile);
  fireEvent.click(tile);
  expect(onInspect).toHaveBeenCalledWith(card);
  expect(onClick).toHaveBeenCalledTimes(1);
});

test("selected limited cards communicate their deck state", () => {
  render(<DraftCardTile card={card} selected actionLabel="Remove" onClick={() => {}} />);
  const tile = screen.getByRole("button", { name: "Remove Think" });
  expect(tile).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("✓ In deck")).toBeInTheDocument();
});
