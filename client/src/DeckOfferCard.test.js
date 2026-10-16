import { fireEvent, render, screen } from "@testing-library/react";
import DeckOfferCard from "./DeckOfferCard";
test("Gem-priced recipes select Gems explicitly and remain disabled without its backend currency", () => {
  const offer = { name: "Exact recipe", revision: "revision", template: { composition: { factionId: "rumin", cards: [] } }, terms: {}, prices: { gold: 10, timetwisters: 5, gems: 7 }, status: "available" }, onBuy = jest.fn();
  const { rerender } = render(<DeckOfferCard offer={offer} balance={{ gold: 100, timetwisters: 20, gems: 10, gemsEnabled: false }} onBuy={onBuy} />);
  expect(screen.getByRole("button", { name: "7 Gems" })).toBeDisabled(); expect(screen.getByRole("button", { name: "5 Timetwisters" })).toBeEnabled();
  rerender(<DeckOfferCard offer={offer} balance={{ gold: 100, timetwisters: 20, gems: 10, gemsEnabled: true }} onBuy={onBuy} />);
  fireEvent.click(screen.getByRole("button", { name: "7 Gems" })); expect(onBuy).toHaveBeenCalledWith(offer, "gems");
});
