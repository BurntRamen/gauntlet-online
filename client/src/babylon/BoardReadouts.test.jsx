import { fireEvent, render, screen } from "@testing-library/react";
import BoardReadouts, { boardReadoutLayout } from "./BoardReadouts";

const players = { 1: { id: 1, name: "Blue player", deckCount: 44, discardCount: 0 },
  2: { id: 2, name: "Red player", deckCount: 37, discardCount: 7 } };

test("readouts show public values including zero, identify the players, and open the correct discard", () => {
  jest.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1800);
  jest.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(750);
  try {
    const attack = { owner: 2, value: 12, blocks: [{ value: 4 }, { value: 3 }] };
    const viewModel = { players, bottom: players[1], top: players[2], handAttacks: [attack], attacks: [attack],
      payment: { active: true, total: 3, required: 7 }, selection: {}, interactions: { legalLanes: [2] } };
    const openDiscard = jest.fn();
    const result = render(<BoardReadouts viewModel={viewModel} commands={{ openDiscard }} />);
    expect(result.container.querySelector('[data-combat-readout="attack"]')).toHaveTextContent("Attack12");
    expect(result.container.querySelector('[data-combat-readout="attack"]')).toHaveAttribute("data-player-color", "red");
    expect(result.container.querySelector('[data-combat-readout="block"]')).toHaveTextContent("Block7");
    expect(screen.getByText("4 more needed")).toBeVisible();
    expect(result.container.querySelector('[data-lane-readout="2"]')).toHaveTextContent("Available");
    fireEvent.click(screen.getByRole("button", { name: "Red player discard pile: 7 cards" }));
    expect(openDiscard).toHaveBeenCalledWith(2);
    expect(screen.getByRole("button", { name: "Blue player discard pile: 0 cards" })).toHaveTextContent("0");
    result.rerender(<BoardReadouts viewModel={{ ...viewModel, handAttacks: [], attacks: [], payment: { active: false } }} />);
    expect(result.container.querySelector('[data-combat-readout]')).toBeNull();
    expect(screen.queryByText("4 more needed")).not.toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeVisible();
  } finally { jest.restoreAllMocks(); }
});

test.each([[1890, 750, "desktop"], [2540, 750, "ultrawide"], [370, 380, "portrait"], [820, 270, "short-landscape"]])(
  "labels follow their board locations within a %i by %i frame", (width, height, profile) => {
    const layout = boardReadoutLayout(width, height, profile);
    const points = [...layout.lanes, ...Object.values(layout.combat), ...Object.values(layout.piles), layout.payment];
    points.forEach(({ left, top }) => {
      expect(left).toBeGreaterThan(0); expect(left).toBeLessThan(width);
      expect(top).toBeGreaterThan(0); expect(top).toBeLessThan(height);
    });
    expect(layout.combat.block.left - layout.combat.attack.left).toBeGreaterThanOrEqual(78);
    for (const owner of ["local", "opponent"]) {
      const deck = layout.piles[`${owner}Deck`], discard = layout.piles[`${owner}Discard`];
      expect(Math.abs(deck.left - discard.left) >= 77 || Math.abs(deck.top - discard.top) >= 54).toBe(true);
    }
  }
);

test("opponent counters stay below a play-order panel that would cover their labels", () => {
  const ledger = { left: 900, right: 1340, bottom: 100 };
  const layout = boardReadoutLayout(1340, 442, undefined, ledger);
  expect(layout.piles.opponentDeck.top - 28).toBeGreaterThan(ledger.bottom);
  expect(layout.piles.opponentDiscard.top - 28).toBeGreaterThan(ledger.bottom);
});
