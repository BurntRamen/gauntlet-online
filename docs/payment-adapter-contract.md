# Payment adapter contract and recovery

This is a local implementation, not a connected payment provider. Case selected **provider adapter only**. `server/index.js` constructs `paymentService` without an adapter. It cannot create a merchant checkout or credit currency from a browser redirect. The deterministic signed fixture in `server/test/helpers` cannot collect money and is never imported by application startup.

## Operator workflow

1. In Store & Economy → Marketplace, create a product using the existing shared catalog. Select **Real money (requires provider)**, an explicit denomination, and a tax-inclusive price in minor units (`499` means `4.99`). USD, EUR and GBP are the currently supported two-decimal denominations. Set other currency prices to zero.
2. Select commercially authorized entitlements with implemented delivery, or select **Gem credit** and enter the delivered Gem amount. Gem credits cannot be bought with Gold, Timetwisters, Gems or free claims, and cannot hide bundled grants. Paid competition is not a product type.
3. Validate, preview and publish through the shared release workflow. Preview shows the captured price and deliverables. Publication does **not** connect a provider or enable Gems. Existing product revisions retain their original checkout terms.
4. Inspect **Payment readiness** in Economy operations. In this implementation it reports disconnected/disabled. The player catalog provides no cash-purchase button.
5. After a future provider is separately qualified, Economy operations distinguishes **payment status** from **delivery status**, lists verified events, and offers a payment selector with player/product names. Operators need not enter an order ID for routine recovery.
6. For a verified payment with interrupted delivery, choose **Retry captured fulfillment** and record a specific reason. This uses the original terms and verified inbox. It cannot invent a successful payment. An interrupted checkout creation retries the original provider idempotency key.
7. For a verified successful payment, choose **Request full provider refund** and record the reason. Acknowledgement means requested, not refunded. Grants are revoked or funding reversed only after a verified full-refund/dispute event. Ordinary Gold/Gem refund controls reject cash receipts.

The two existing stable administrator identities control all recovery/refund operations under `/api/admin`. Ordinary accounts can inspect only their own payment orders. Private checkout URLs, grant references and operational audit do not appear on public player profiles.

## Authoritative contracts

| Control or evidence | Authoritative destination | Consumer and guarantee |
| --- | --- | --- |
| Cash price, denomination, Gem quantity, inclusions, sale window, limit | `paraLeague.products` in the existing publication snapshot | Server captures active published terms, checks jurisdiction/currency support and ownership before contacting a provider |
| Create checkout | Authenticated `/api/payments/checkout` → `paymentLedger.capture` | Stable account/request key, immutable intent and quote, reserved lifetime limit; no client-supplied price or account destination |
| Provider response | `gold_payment_checkouts` | HTTPS host allowlist, bounded provider reference, canonical expiry and unique provider/checkout binding |
| Verified event | Raw `/api/payments/webhook` → qualified verifier → `gold_payment_events` | Exact amount, currency, inclusive tax mode, billing country, intent and checkout binding; globally unique provider/event fingerprint |
| Fulfillment | Existing `gold_purchases`, `gold_entitlements`, `gold_gem_transactions` plus `gold_payment_settlements` | Purchase, all grants or Gem credit, and settlement marker commit in one SQLite transaction |
| Refund/dispute | Same purchase plus append-only refund/revocation/funding-reversal | Full compensation exactly once; never alters the original receipt or unrelated entitlements |
| Operator retry/refund request | `gold_payment_commands`, `gold_payment_actions`, existing private audit | Stable command ID, actor, reason, provider acknowledgement, and failure evidence |
| Backup/restore | Currency database schema 4, compatible release/assets and account identity store | Existing `VACUUM INTO` backup captures all financial tables and committed WAL data |

No additional financial database, balance cache, generic issuance endpoint or second publication system is introduced. Versions 1–3 upgrade additively; opening Gold, account Timetwisters and previous purchases are not rewritten. Production migration remains separately authorized.

## Future adapter interface

`createPaymentService({ ledger, adapter, allowLive: false, acceptCheckouts: true })` accepts a trusted server adapter with:

- `contract`: version `1`; stable provider/merchant identity `id`; `mode` (`sandbox` or `live`); explicitly qualified billing `countries`; supported `currencies`; exact `checkoutHosts`; `taxMode: "inclusive"`; `taxConfigured: true`.
- `createCheckout(intent)`: creates the exact captured inclusive-price purchase, uses `intent.id` as the provider idempotency key, binds the provider object to this server-owned intent, and returns `{ checkoutId, url, expiresAt }`. Do not accept a browser-supplied customer, amount, destination or return address.
- `verifyWebhook(rawBytes, headers)`: verifies the provider's actual signature, freshness and merchant/environment identity before returning the normalized event below. It must verify settled payment/refund/dispute facts and provider-owned checkout metadata, not merely forward arbitrary signed client metadata. No card details are collected or stored here.
- `requestRefund(intent, command)`: requests the full original payment against its captured checkout, uses `command.id` as the provider idempotency key, and returns `{ requestId }`. Financial completion still requires a verified event.

Normalized event fields are exactly `id`, `intentId`, `checkoutId`, `status`, `amountMinor`, `currency`, `country`, `taxMode`, `occurredAt`. Status is pending, succeeded, failed, refunded or disputed. Amounts are positive safe integers in minor units, bounded at 1,000,000; full refunds/disputes report the original amount. Dates use canonical UTC ISO timestamps. A separate, fresh delivery signature may authenticate replay of an old event; event identity and facts remain immutable.

A live adapter cannot be constructed unless `allowLive` is explicitly enabled in a separately reviewed integration. There is currently no environment shortcut that loads the test adapter or activates payments. Pausing `acceptCheckouts` blocks new checkout creation while retaining verified webhook processing, recovery and refund requests. Existing provider identity and credentials must remain available for outstanding orders.

## Ordering, failure and compensation policy

- The verified inbox commits before fulfillment. A database/asset/Gem-gate failure returns an error, retains the inbox and audit, and leaves delivery pending recovery. Retry does not double-grant.
- An early webhook waits for the provider checkout response to be durably bound. An event with a different checkout reference remains unconfirmed and requires provider investigation; automatic recovery cannot silently remap it.
- Success wins over earlier/later pending or failed notifications. A refund or dispute is terminal for fulfillment, including when it arrives before success. Later success cannot resurrect revoked grants or mint funds.
- A full refund/dispute revokes only the entitlements from that cash purchase. Already downloaded files cannot be recalled; existing match presentation remains captured.
- Gem funding reversal subtracts only the funded quantity. If spent, the ledger records explicit reconciliation debt and spendable Gems are zero; further Gem purchases fail until the debt is covered. Future verified funding or a genuine refund of a Gem purchase offsets the debt. Gold, Timetwisters, competition and unrelated grants are not confiscated. This is a technical policy requiring merchant review before live activation.
- Refunded fulfilled orders retain their lifetime purchase count. Unresolved checkouts reserve limits. Browser abandonment or a success/cancel redirect cannot release a reservation. A verified failure can release an unfulfilled reservation; a later success must still meet its original lifetime limit or await a provider refund.
- Timed renewals start after currently active access; expired seasonal delivery fails visibly and requires a refund, rather than delivering expired access. If concurrent paid orders collide with permanent ownership, the blocked order remains recoverable/refundable.
- Partial refunds, dispute reversals, tax added after quoting, subscriptions/recurring billing, physical goods, Timetwister cash funding, transfers and currency conversion are outside contract v1. They require separate explicit transaction contracts and tests. No UI claims they work.

## Isolated recovery rehearsal and activation prerequisites

1. Back up the private ledger with `node scripts/backup-gold-ledger.js <source> <new-backup>`; keep account identity/revision data, published releases, authoring assets and active-match checkpoints at a coordinated recovery point. Protect backups as private data. Never copy just the live SQLite main file while WAL writes are active.
2. Restore into a distinct isolated directory with compatible schema-4 code. Verify database integrity, original receipts, event IDs, grant states, Gem balances/debt, both administrator identities and the pinned assets/releases before allowing any writes.
3. Retry a captured pending fulfillment and replay an already processed signed event in the test adapter. Expect one purchase and one grant/credit. Test a failed compensation and replay after recovery. The contract tests execute these paths, including independent-process contention and backup restore.
4. For an eventual provider integration, Case must select the provider and merchant account. Qualify that provider's sandbox checkout, actual signature scheme, merchant identity, webhook retry behavior, idempotency, full refunds and disputes against this contract. The deterministic adapter does not satisfy this external step.
5. Merchant review must approve actual supported countries, inclusive-tax handling, currency/amount limits, refund/debt terms and deliverable rights. Configuration flags are boundaries, not claims of legal or tax compliance.
6. Separately authorize deployment, production schema upgrade/storage changes, Gem activation, live adapter activation and production content publication. Verify persistent storage and perform a restore rehearsal first. Then qualify the actual player checkout/return UI for that provider; it is deliberately absent while no provider is selected.

Nothing is required from Case to run the local adapter tests. No credentials or merchant decision are being requested now.
