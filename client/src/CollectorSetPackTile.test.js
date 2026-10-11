import { fireEvent, render, screen } from "@testing-library/react";
import CollectorSetPackTile from "./CollectorSetPackTile";

const product = {
  id: "legacies-set-collector",
  name: "Legacies Collector Pack",
  displayName: "Legacies",
  subtitle: "The second age of Reath",
  setId: "legacies",
  setNumber: 2,
  plannedFactionIds: ["mekan", "jali", "gracus", "indela"],
  variantCount: 8,
  priceUsd: 1,
  available: true,
  description: "Eight animated collector variants."
};

test("collector set checkout becomes actionable only when fulfillment is configured", () => {
  const onBuyPack = jest.fn();
  const { rerender } = render(<CollectorSetPackTile product={product} checkoutConfigured={false} onBuyPack={onBuyPack} />);
  expect(screen.getByRole("button", { name: "Checkout Setup Required" })).toBeDisabled();

  rerender(<CollectorSetPackTile product={product} checkoutConfigured onBuyPack={onBuyPack} />);
  fireEvent.click(screen.getByRole("button", { name: "Buy for $1.00" }));
  expect(onBuyPack).toHaveBeenCalledWith(product.id);
});

test("unreleased sets cannot accept a purchase", () => {
  render(<CollectorSetPackTile product={{ ...product, available: false, unavailableReason: "Catalog pending." }} checkoutConfigured onBuyPack={jest.fn()} />);
  expect(screen.getByRole("button", { name: "Catalog in Development" })).toBeDisabled();
  expect(screen.getByText("Catalog pending.")).toBeInTheDocument();
});
