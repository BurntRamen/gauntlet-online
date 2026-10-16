import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EconomyConsole from "./EconomyConsole";
const view = { title: "Gold & Library", summary: "500 Gold", forms: [{ label: "Confirm purchase · 300 Gold", action: "purchase", values: { quoteId: "quote-one" }, fields: [] }], tables: [{ title: "Receipts", columns: ["ID", "Gold"], rows: [["receipt-one", 300], ["receipt-two", 100]] }] };
test("uncertain purchase retries retain the exact idempotency key and quote", async () => {
  const originalCrypto = window.crypto;
  Object.defineProperty(window, "crypto", { configurable: true, value: { randomUUID: () => "request-unique" } });
  let attempts = 0;
  const request = jest.fn(async (route) => { if (!route.endsWith("purchase")) return { view }; if (++attempts === 1) throw new Error("Network interrupted"); return { view: { title: "Purchased", summary: "200 Gold" }, notice: "Receipt recorded" }; });
  render(<EconomyConsole request={request} />);
  fireEvent.click(await screen.findByRole("button", { name: "Confirm purchase · 300 Gold" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Network interrupted");
  fireEvent.click(screen.getByRole("button", { name: "Confirm purchase · 300 Gold" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Receipt recorded");
  const calls = request.mock.calls.filter(([route]) => route.endsWith("purchase"));
  expect(calls[0][1]).toEqual(calls[1][1]); expect(JSON.parse(calls[0][1].body)).toEqual({ quoteId: "quote-one", key: "request-unique" });
  Object.defineProperty(window, "crypto", { configurable: true, value: originalCrypto });
});
test("ledger tables are readable and searchable; operator cancellation sends no mutation", async () => {
  const request = jest.fn(async () => ({ view })); const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  render(<EconomyConsole request={request} admin />);
  await screen.findByText("receipt-two"); expect(screen.getByText("receipt-two")).not.toBeVisible(); fireEvent.change(screen.getByLabelText("Search economy records"), { target: { value: "receipt-one" } });
  expect(screen.queryByText("receipt-two")).not.toBeInTheDocument(); expect(screen.getByText("receipt-one")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Search economy records"), { target: { value: "no-matching-record" } }); expect(screen.queryByText(/Receipts ·/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirm purchase · 300 Gold" }));
  await waitFor(() => expect(confirm).toHaveBeenCalled()); expect(request).toHaveBeenCalledTimes(1); confirm.mockRestore();
});
