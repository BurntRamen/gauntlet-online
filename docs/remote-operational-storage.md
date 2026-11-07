# Remote operational storage on Render Free

Prepared implementation; no production migration or economy activation has been performed.

## Authority and commit point

`GAUNTLET_OPERATIONAL_PROVIDER=supabase` uses the private `gauntlet_runtime_states` and receipt tables introduced by `20261029211614_authoritative_runtime_state.sql`. The `operational-systems` scope holds Para and finite Gold/Gems/payment/entitlement records. Existing SQLite transactions, constraints and append-only receipts execute in disposable **memory** projections. A local file is never the remote mode's recovery source.

The shared server queue serializes HTTP, sockets, AI and room timers. Operational records commit with compare-and-swap and a retry identity before room state commits and before any HTTP response, socket acknowledgement or broadcast is delivered. A stale writer or unconfirmed database commit stops the writer; it never falls back to local storage. Restart restores the last committed records into empty projections and verifies schema, row identity, constraints and full snapshot hash before accepting traffic.

Operational and room records are separate recoverable commits, not a distributed transaction. Match finalization retains canonical match evidence and the existing settlement receipts; replaying settlement is idempotent. Account Gold/Timetwister CAS, finite Gold, Gems and payment-provider evidence remain distinct authorities with their existing compensation rules. A database outage can leave an operation committed but its response lost; retry the original request key after recovery. Never retry a purchase with a freshly generated key merely because the response was lost.

## Configure without changing launch policy

Apply the runtime migration, then set `GAUNTLET_ROOM_STATE_PROVIDER=supabase` and `GAUNTLET_OPERATIONAL_PROVIDER=supabase`. Existing `GAUNTLET_PARA_DATA_DIR` and `GAUNTLET_ECONOMY_DATA_DIR` remain the activation switches; do not set them merely to configure persistence. If set in remote mode, their local paths are ignored and memory projections are used. Keep `GAUNTLET_GOLD_MIGRATION`, `GAUNTLET_GEMS_ENABLED` and all payment launch controls unchanged until their separate sandbox qualification and approved cutover.

An empty remotely configured service is not proof of a currency launch, available checkout or completed recovery drill. Operations reports provider, revision, commit health, enabled scopes and `recoveryVerified: false` separately. Real charging still requires an approved connected provider and its policy/configuration; this adapter cannot fabricate provider success.

## Existing SQLite cutover

1. Quiesce game settlement, purchases, claims and event operations on the old writer. Preserve its SQLite files and WALs; use a consistent SQLite backup, not a raw copy of only the main file while it is running.
2. On the compatible application revision, set `GAUNTLET_IMPORT_GOLD_FILE` and/or `GAUNTLET_IMPORT_PARA_FILE` to the private SQLite source files. Run `node scripts/remote-operations.js export-local ABSOLUTE_PRIVATE_EXPORT.json`. Sources open read-only. Old database schema versions require a backed-up compatible migration before export.
3. Run `verify` against that export. It restores every row into isolated memory databases and checks schema, constraints and hashes. The report includes row counts and hashes without player data.
4. With server Supabase credentials in the environment, run `restore-isolated ABSOLUTE_PRIVATE_EXPORT.json restore-operations-drill`. Then run `import ABSOLUTE_PRIVATE_EXPORT.json` while the live remote scope is empty and the old writer remains stopped. Import refuses different existing records; identical repeats are no-ops.
5. Start exactly one remote writer. Verify the operators' existing counts, balances, ownership, attempt and settlement evidence against the export before re-enabling traffic. Keep source backups. No account IDs, balance rules, purchase limits or scores are migrated by invention.

The `export ABSOLUTE_PRIVATE_EXPORT.json` command reads authoritative remote state. `verify` and `restore-isolated` are the corresponding restore drill. Store exports off the application filesystem. An isolated readback is not automatically proof that production recovery has been exercised.

## Rollback and limits

Do not switch a running ledger back to its pre-cutover local file: that would lose later purchases and awards. Keep remote persistence on during a code rollback to a compatible reader. For a storage cutback, quiesce the remote writer, export current state, restore and reconcile into fresh compatible databases in isolation, then explicitly change the authority. No overwrite or live destructive restore command is provided.

This adapter is intended for the current single Render writer. It has a 64 MiB operational JSON envelope and serializes supported API responses; it is not a horizontally scaled database execution layer. Capacity exhaustion fails closed with retained records. Before reaching that limit, move operational SQL to native remote tables or introduce bounded, transactional partitions; do not prune immutable receipts to hide capacity pressure. Disabled store scopes are retained when another scope commits. Enabling a new scope restores its old records if present.
