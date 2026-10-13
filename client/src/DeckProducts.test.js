import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DeckProducts from "./DeckProducts";

jest.mock("./DeckOfferCard", () => ({ offer, onBuy, pending }) => <button disabled={pending} onClick={() => onBuy(offer, "gold")}>Buy {offer.name}</button>);
const offer = { id: "offer", revision: "release-one", name: "Recipe", prices: { gold: 30 }, terms: { savedDeck: "A saved deck", duplicates: "No compensation" } };
const receipts = { requestId: "purchase-request-key", template: { name: "Recipe", revision: "abc123" }, purchasedAt: "2026-10-12", price: 30, currency: "gold" };
const response = (body, ok = true) => ({ ok, json: async () => body });
beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: { randomUUID: () => receipts.requestId } });
});
afterEach(() => jest.restoreAllMocks());
function fixture(purchase) {
  global.fetch = jest.fn(async (url, options) => {
    if (url.endsWith("deck-products")) return response({ offers: [offer], capability: { ready: true } });
    if (url.endsWith("deck-receipts")) return response({ receipts: [] });
    return purchase(JSON.parse(options.body));
  });
  render(<DeckProducts endpoint="/server" token="private" accountId="one" onAccount={jest.fn()} />);
}
test("a lost response retains the same purchase identity on retry", async () => {
  const calls = [];
  const purchase = jest.fn(async body => { calls.push(body); if (calls.length === 1) throw new Error("Connection lost"); return response({ receipt: receipts, account: { id: "one" } }); });
  fixture(purchase);
  fireEvent.click(await screen.findByText("Buy Recipe")); fireEvent.click(screen.getByText("Confirm purchase"));
  await screen.findByRole("alert");
  expect(JSON.parse(localStorage.getItem("gauntlet_deck_purchase_one")).requestId).toBe(receipts.requestId);
  expect(screen.queryByText("Keep browsing")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Retry same purchase"));
  await screen.findByText(/Purchased Recipe/);
  expect(calls[0]).toEqual(calls[1]);
  expect(localStorage.getItem("gauntlet_deck_purchase_one")).toBeNull();
});
test("a definitive pre-commit rejection releases the quote and allows reviewing a new offer", async () => {
  fixture(async () => response({ error: "Product changed", purchaseRejected: true }, false));
  fireEvent.click(await screen.findByText("Buy Recipe")); fireEvent.click(screen.getByText("Confirm purchase"));
  await screen.findByText(/No payment was taken/);
  await waitFor(() => expect(screen.getByText("Buy Recipe")).toBeEnabled());
  expect(screen.queryByText("Retry same purchase")).not.toBeInTheDocument();
  expect(localStorage.getItem("gauntlet_deck_purchase_one")).toBeNull();
});
test("a persisted unknown purchase is resumed before allowing a new charge", async () => {
  const quote = { offerId: offer.id, revision: offer.revision, currency: "gold", requestId: receipts.requestId };
  localStorage.setItem("gauntlet_deck_purchase_one", JSON.stringify(quote));
  const purchase = jest.fn(async () => response({ receipt: receipts, account: { id: "one" } })); fixture(purchase);
  await waitFor(() => expect(screen.getByText("Retry same purchase")).toBeEnabled());
  expect(screen.getByText("Buy Recipe")).toBeDisabled(); fireEvent.click(screen.getByText("Retry same purchase"));
  await screen.findByText(/Purchased Recipe/); expect(purchase).toHaveBeenCalledWith(quote);
});
