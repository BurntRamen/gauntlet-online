# Account-Bound Physical Collector Entitlements

Gauntlet's first physical-to-digital bridge is personalized fulfillment, not a transferable retail-code system. A trusted operator associates one physical order or manual fulfillment with one existing Gauntlet account and receives a signed claim URL. Only that signed-in account can preview or redeem it.

## Contract and signing

The token payload uses `gauntlet.collector-entitlement.v1` and contains an entitlement ID, account ID, product ID and type, issuance source, SHA-256 external-reference hash, issue time, and optional expiration. The raw order reference, credentials, and payment data are not included. The server authenticates the base64url payload with HMAC-SHA-256.

Set a long random `COLLECTOR_ENTITLEMENT_SECRET` on the server for independent key rotation. When omitted, the server derives a domain-separated signing key from the required production `ACCOUNT_AUTH_SECRET`; neither value is sent to the client. Rotating the effective signing key invalidates unredeemed links but does not affect receipts already stored. Never place a token or either secret in logs, analytics, source control, or a client environment variable.

The entitlement ID is deterministic over fulfillment source, external reference, product ID, and immutable account ID. Reissuing the same fulfillment may produce a newly timestamped token, but it resolves to the same claim identity and cannot grant twice. Account display names are not part of identity.

## Product mapping and payment power

The representative product is `rumin-foundation-physical-box`. It maps to eight validated Rumin Foundation collector-foil variants in the existing `rumin-collector` product rules. Redemption reuses `grantPurchasedCollectorPack`; it does not create a second pack engine.

Physical fulfillment changes collector ownership and provenance only. It cannot change gameplay entitlements, card copies, values, rules text, faction abilities, deck limits, legal actions, combat, or win conditions. An owned variant can be selected for deck and Babylon presentation, while mechanics and record-v2 snapshots continue to resolve through the same `gameplayCardId`.

## Trusted fulfillment procedure

Prerequisites:

- Confirm the order or fulfillment independently. This API does not verify a payment provider.
- Confirm the customer's existing Gauntlet account ID or exact account name.
- Use a unique stable order/fulfillment reference. Do not use payment credentials or private customer data.
- Call the production Render server from a trusted operator environment with `OWNER_STATS_TOKEN`. Do not expose that token to a browser.

Issue a personalized claim:

```powershell
$headers = @{ "x-owner-token" = $env:GAUNTLET_OWNER_TOKEN }
$body = @{
  accountName = "Customer Account"
  productId = "rumin-foundation-physical-box"
  issuanceSource = "physical-order"
  externalReference = "provider-order-12345"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "https://gauntlet-online.onrender.com/api/admin/collector-entitlements/issue" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $body
```

The response contains the safe entitlement summary, `token`, and a personalized `claimUrl` under `PUBLIC_CLIENT_URL`. Deliver that URL only to the bound customer, such as through their fulfillment email, personalized packing slip, or order-specific QR code. Repeating the call with the exact same source/reference/product/account returns the same entitlement ID.

## Claim and durable idempotency

The stable client format is `/?claim=<signed-token>`. A signed-out visitor keeps the claim in the URL while authenticating. The client then calls the authenticated preview endpoint and requires an explicit **Redeem Collector Item** action. A different account receives `ENTITLEMENT_ACCOUNT_MISMATCH` and cannot redeem.

Redemption reloads the current account inside the server's account queue, applies the existing validated collector grant, and writes collector ownership plus `collection.collectorRedemptionReceipts[entitlementId]` in the same account-state write. The receipt stores only the entitlement/product identity, redemption time, granted variant IDs, provenance/source, and hashed external reference. With production Supabase configured, this is one update of the existing `gauntlet_accounts.stats` JSONB; no new schema is required.

After refresh, sign-out/sign-in, or backend replacement, the receipt remains authoritative. A retry returns the receipt and existing variants as **Already redeemed** without another write or grant. `collectorVariantProvenance` is normalized from receipts and distinguishes physical fulfillment from existing paid digital collector-pack acquisition without altering mechanical identity.

## Security boundary and limitation

Ordinary users cannot issue entitlements. The issuance endpoint requires existing owner authorization, signatures are checked with constant-time comparison, expiration is enforced when present, and unknown products, malformed tokens, unsigned payloads, tampering, and account mismatches fail closed.

This design is safe for personalized account-bound fulfillment because each signed claim names its only eligible account and its receipt lives with that account. It is not a general inventory-code ledger.

**Transferable one-use retail redemption requires a durable global redemption ledger and remains a future capability.** A code redeemable by arbitrary accounts must not be implemented using per-account JSONB, process memory, fake accounts, client trust, or obscurity.
