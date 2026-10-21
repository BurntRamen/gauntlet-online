# Enable safe deck purchases on the existing Gauntlet database

Case owns this production step. No database credentials belong in chat or GitHub.
This uses the existing Supabase database; it creates no hosting service or new account table.

1. In Render, open Gauntlet's backend and identify its existing `SUPABASE_URL` project reference. In Supabase, open that exact project. Verify that `public.gauntlet_accounts` is Gauntlet's account table before running SQL. Do not use the unrelated Creative OS projects.
2. Follow the project's normal database backup/change process. Open the Supabase SQL Editor and run the complete contents of [the migration](../supabase/migrations/20261013013808_account_stats_concurrency_guard.sql). It is one transaction and is safe to run again. It creates a revision-check trigger and a service-only capability function; it does not debit, grant, rename, remove or backfill accounts.
3. In the SQL Editor, run `select public.gauntlet_account_write_capability();`. The result must be `1`.
4. Once the new backend release is deployed, open its `/api/economy/deck-products` endpoint. With the existing account-based economy, confirm `capability.ready` is `true` and `capability.storage` is `supabase-revision-guard`. The application checks this automatically. A missing migration leaves purchases disabled. No new environment variable is needed.
5. Verify a normal sign-in and inspect existing account information. A stale simultaneous account write may now ask the client to refresh and retry instead of overwriting another purchase or reward. Do not use real purchases or grants as a deployment smoke test.

If SQL fails, preserve the error and check the project/table identity. Do not bypass the capability check or remove the trigger to make a purchase succeed. If the PostgREST schema cache has not refreshed after successful SQL, reload its schema using the project's normal administration procedure and retry the read-only capability check.

The separately released finite Gold ledger is a different purchase system. If `GAUNTLET_ECONOMY_DATA_DIR` enables it, deck products deliberately report `ready: false`: atomic deck fulfillment across that ledger and the account store is not implemented. This migration does not enable that integration. Do not disable or roll back an active ledger to force deck purchases through an old account balance. Leave the existing economy configuration unchanged during this rollout.

## What this protects

Broader storage work is a separate rollout: see [durable runtime, match and private authoring setup](durable-storage-setup.md). The account revision migration above can proceed independently.

Each account stats write carries the revision it read. PostgreSQL compares that revision against the current row and increments it on success. A stale writer fails atomically, including any match consequence receipt in the same transaction. Deck fulfillment commits its Gold/Timetwister debit, printing entitlements, card back, independent saved deck and retry receipt together. Retrying the same purchase identity returns the original receipt.

The migration has passed executable PostgreSQL tests through PGlite, including stale writes, transaction rollback and denial of anonymous capability access. It has **not** been applied to or verified on the production database from this session.

The client dependency findings have a separate tooling fix and release checks in [the security disposition](admin-dependency-audit.md). This SQL does not change GitHub repository visibility, enable private uploads/notes in a public repository, or create the unavailable canonical match archive. Those limitations remain recorded in [the capability map](admin-suite-capabilities.md).
