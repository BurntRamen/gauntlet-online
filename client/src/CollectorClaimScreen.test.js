import { fireEvent, render, screen } from "@testing-library/react";
import CollectorClaimScreen from "./CollectorClaimScreen";

const product = {
  id: "rumin-foundation-physical-box",
  name: "Rumin Foundation Physical Collector Box",
  description: "Eight account-bound collector foils.",
  variantCount: 2,
  edition: "foundation-collector",
  finish: "foil",
  variants: [
    { variantId: "variant-a", name: "Gilded Scale Legionary", edition: "foundation-collector", finish: "foil" },
    { variantId: "variant-b", name: "Forum Ledger Runner", edition: "foundation-collector", finish: "foil" }
  ]
};

function props(overrides = {}) {
  return {
    token: "signed-entitlement",
    serverUrl: "https://api.example.test",
    account: null,
    authToken: "",
    authMode: "login",
    authForm: { name: "", password: "" },
    authError: "",
    onAuthModeChange: jest.fn(),
    onAuthFormChange: jest.fn(),
    onSubmitAuth: jest.fn(),
    onSignOut: jest.fn(),
    onAccountUpdated: jest.fn(),
    onOpenCollection: jest.fn(),
    onDismiss: jest.fn(),
    ...overrides
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

test("preserves a signed-out claim while asking the player to authenticate", () => {
  global.fetch = jest.fn();
  const claimProps = props();
  render(<CollectorClaimScreen {...claimProps} />);

  expect(screen.getByRole("heading", { name: "Sign in to continue" })).toBeInTheDocument();
  expect(screen.getByText(/non-transferable claim remains in this link/i)).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();

  fireEvent.change(screen.getByPlaceholderText("Account name"), { target: { value: "Collector Alpha" } });
  expect(claimProps.onAuthFormChange).toHaveBeenCalledWith({ name: "Collector Alpha", password: "" });
  fireEvent.submit(screen.getByRole("button", { name: "Sign In" }).closest("form"));
  expect(claimProps.onSubmitAuth).toHaveBeenCalledTimes(1);
});

test("previews and redeems an account-bound collector reward", async () => {
  const account = { id: "account-a", name: "Collector Alpha" };
  const updatedAccount = { ...account, stats: { collection: { collectorVariants: { "variant-a": 1 } } } };
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "available", boundAccount: account, product }) })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "already-redeemed",
        alreadyRedeemed: false,
        boundAccount: account,
        product,
        grantedVariants: product.variants,
        receipt: { grantedVariantIds: product.variants.map((variant) => variant.variantId) },
        account: updatedAccount
      })
    });
  const claimProps = props({ account, authToken: "account-session" });
  render(<CollectorClaimScreen {...claimProps} />);

  expect(await screen.findByText(product.name)).toBeInTheDocument();
  expect(screen.getByText(/never grants cards, copies, values, abilities/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Redeem Collector Item" }));

  expect(await screen.findByText(/Already redeemed\. These collector variants remain owned/)).toBeInTheDocument();
  expect(screen.getByText("Gilded Scale Legionary")).toBeInTheDocument();
  expect(claimProps.onAccountUpdated).toHaveBeenCalledWith(updatedAccount);
  expect(global.fetch).toHaveBeenLastCalledWith(
    "https://api.example.test/api/collection/collector-entitlement/redeem",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer account-session" }),
      body: JSON.stringify({ token: "signed-entitlement" })
    })
  );
});

test("treats an existing receipt as a successful already-redeemed claim", async () => {
  const account = { id: "account-a", name: "Collector Alpha" };
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      status: "already-redeemed",
      boundAccount: account,
      product,
      receipt: { grantedVariantIds: ["variant-a", "variant-b"] }
    })
  });
  render(<CollectorClaimScreen {...props({ account, authToken: "account-session" })} />);

  expect(await screen.findByText(/Already redeemed\. These collector variants remain owned/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Redeem Collector Item" })).not.toBeInTheDocument();
  expect(screen.getByText("Forum Ledger Runner")).toBeInTheDocument();
});

test("explains an account mismatch and never offers redemption", async () => {
  const account = { id: "account-b", name: "Collector Beta" };
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({
      code: "ENTITLEMENT_ACCOUNT_MISMATCH",
      error: "This collector entitlement belongs to another Gauntlet account."
    })
  });
  const claimProps = props({ account, authToken: "other-session" });
  render(<CollectorClaimScreen {...claimProps} />);

  expect(await screen.findByRole("heading", { name: "Bound to another account" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Redeem Collector Item" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));
  expect(claimProps.onSignOut).toHaveBeenCalledTimes(1);
});
