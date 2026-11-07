# Full private project export and isolated recovery

Prepared implementation, not a production recovery claim. Render remains Free. The hourly runtime backup covers rooms and operational ledgers; this export additionally covers account identities and credential hashes, balances and ownership, match consequences/events, archive indexes, private authoring and notes, media reservations, and the actual referenced media/archive bytes.

Supabase database backups do not include Storage object bytes. Free projects should keep independent exports. See [Supabase database backup documentation](https://supabase.com/docs/guides/platform/backups).

## Configure and export

Apply `20261107045019_private_recovery_export.sql` after the existing account, durable-match/private-authoring, runtime and media migrations. Its export RPC is a single PostgreSQL statement snapshot. Client roles cannot call it. Import is deliberately unavailable to the application's service credential: it requires the database owner and retains exclusive table locks, emptiness checks and atomic rollback. It never updates, deletes or truncates existing rows.

From a trusted operator machine, with the backend's `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (or legacy service-role key) supplied privately:

```
node scripts/project-recovery.js export ABSOLUTE_NEW_PRIVATE_DIRECTORY
node scripts/project-recovery.js verify ABSOLUTE_PRIVATE_DIRECTORY
```

The output directory contains private account credential hashes, hidden game state and reconnect credentials. Keep it outside the repository and public/synchronized sharing locations. Encrypt the drive or archive and retain an independent off-project copy. No secret value belongs in a command, screenshot or issue. Do not commit the export.

The database JSON is bounded at 128 MiB; each object at 64 MiB; the default full-export budget is 512 MiB. `GAUNTLET_EXPORT_MAX_BYTES` can explicitly choose 128 MiB–4 GiB without purchasing capacity. Over-limit exports fail clearly. Larger installations need a PostgreSQL dump plus object export. There is no automatic deletion. A manifest is written only after all required bytes have passed hash verification. Interrupted directories are incomplete and retained for diagnosis; retry export into a new directory.

Media is immutable, so object copies remain consistent with the captured database even if a later draft changes. Missing **referenced** media or archive objects fail the export. Unreferenced reservations from interrupted uploads are explicitly recorded as missing; they keep their capacity accounting on restore. Orphan bytes without reservations and historical runtime backup files are not part of the authoritative inventory. The repository contains executable code and shipped assets and must also remain available at the matching commit.

## Restore to an empty isolated project

1. Prepare a separate Supabase project with the same account schema and committed migrations, including the recovery migration. Do not start an application writer or seed any records. Existing tables must be empty. This tool does not create or purchase a project.
2. Install PostgreSQL 16+ `psql` locally. Set `RECOVERY_TARGET_SUPABASE_URL`, its private `RECOVERY_TARGET_SUPABASE_SECRET_KEY`, and the same project's database-owner URI in `RECOVERY_TARGET_DATABASE_URL`. Use the direct or session-pooler `postgres` connection without URI query parameters. The CLI checks its project identity; TLS uses full certificate verification and system roots. No password is passed in process arguments.
3. Run `node scripts/project-recovery.js restore-isolated ABSOLUTE_PRIVATE_DIRECTORY`. The destination must differ from the export source. It verifies the export, checks the destination inventory, creates/verifies private buckets, uploads immutable bytes without upsert, verifies readback, then imports rows in one owner transaction. Exact retries reconcile lost upload/commit replies. Different existing data blocks import.
4. Inspect the returned database/object readback result. Keep the target isolated. Deploy the matching application commit against the target with production queues, outgoing integrations and charging disabled. Restore the independently retained application authentication secret only within this private drill if testing existing session continuity; otherwise use new isolated sessions.
5. Verify accounts and grants, reconnect synthetic game/draft participants, inspect canonical match evidence, open private draft media and the captured active release, and exercise an idempotent sandbox purchase/refund/settlement. Existing tests prove these components separately; a database/object readback is not proof of a completed production recovery drill.

Never point the tool at an active project. It cannot overwrite nonempty tables, but object uploads may precede a rejected import and remain retained. A later account write after a successful restore makes another import fail; it is not a synchronization tool. It never merges conflicting ledgers or rewinds purchases selectively.

## Consistency, cutover and rollback

For a planned cutover, quiesce admissions, gameplay settlement, purchases and Admin writes before exporting. A live read captures committed database state consistently but cannot turn already separate account/room/ledger transactions into one distributed transaction. Recovery must replay their existing idempotent pending work and reconcile receipts. Preserve the old project and export until the isolated application drill passes.

Change the backend connection only after reconciliation and approval for the actual cutover. Start exactly one compatible writer. Keep all economy and payment launch flags at their prior values. Roll back application code only to a version compatible with the captured engine, asset package and activation record. Once the new destination accepts writes, switching back to the old project would lose them: quiesce and export the current authority before any further move.

Application signing secrets, GitHub credentials, hosting configuration, external provider records and third-party Auth users are outside this app-owned export. Gauntlet's own accounts/credential hashes are included. Preserve the independent deployment secret/configuration inventory privately; a recovery package intentionally does not embed it.

Automated verification: `node --test server/test/project-recovery.test.js`. This uses isolated PostgreSQL-compatible databases and objects, covering private authorization, credentials and balances, snapshots, lost replies, identical retries, schema drift, missing/corrupt bytes and transaction rollback. Scheduled full-project/off-site export and an actual production disaster drill remain operator responsibilities.
