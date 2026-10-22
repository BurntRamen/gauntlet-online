import { render, screen } from "@testing-library/react";
import CurrencyWallet from "./CurrencyWallet";
test("Gold, Timetwisters and Gems remain distinct and a disabled empty Gem wallet stays hidden", () => {
  const { rerender } = render(<CurrencyWallet economy={{ gold: 12, timetwisters: 35, gems: 7, gemsEnabled: true }} />);
  expect(screen.getByText("Gold").parentElement).toHaveTextContent("12");
  expect(screen.getByText("Timetwisters").parentElement).toHaveTextContent("35");
  expect(screen.getByText("Gems").parentElement).toHaveTextContent("7");
  rerender(<CurrencyWallet economy={{ gold: 12, timetwisters: 35, gems: 0, gemsEnabled: false }} />);
  expect(screen.queryByText("Gems")).not.toBeInTheDocument(); expect(screen.getByText("Timetwisters")).toBeVisible();
});
