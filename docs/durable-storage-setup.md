# Durable Gauntlet state — implementation and Case's rollout

This is a follow-on to PR 72. The account revision migration remains independent and can be applied first. This change is prepared in code; production SQL, buckets, disk and restore verification still require Case's access to Gauntlet's existing Supabase project and Render service.

## What is preserved

| State | Authoritative storage after configuration | Recovery |
| --- | --- | --- |
| Accounts, progression, collections, saved decks, account-based Gold/Timetwisters and purchase receipts | Existing Supabase account tables | Existing database, protected by the account revision guard; database backups are a separate operational requirement |
| Friends/messages | Existing Supabase tables | Same database; this change does not migrate or reset these records |
| Aggregate faction results / compatibility match journals | Private Supabase faction-stats table | The migration supplies this existing adapter's table/grants if missing; dedicated full match records remain authoritative evidence |
| Full completed match records, events, consequence receipts | Dedicated Supabase match tables | Readable after backend replacement; finalization and account applications commit together |
| Portable canonical match JSON | Private `gauntlet-match-archives` bucket plus its Supabase index | Hash-verified cloud copies, alongside the existing browser Match Library/export/import |
| Active games, lobbies, draft picks, private hands/deck order, reconnect identity | Private `rooms.json` checkpoint on the Render disk | Restored on startup; pending finalizations retry using the original completion facts and existing idempotent receipts |
| Enabled Para seasons, attempts, results, Prestige, settlements and audit | Existing Para SQLite database on that disk | Normal SQLite recovery plus verified SQLite backups |
| Enabled finite Gold ledger, quotes, claims, purchases, entitlements/refunds and audit | Existing Gold SQLite database on that disk | Normal SQLite recovery plus verified SQLite backups |
| Shared Admin drafts, pending publication, private notes, staged image bytes and upload provenance | Service-only `gauntlet_private_authoring` in Supabase | Version-checked writes shared by both approved admins; no fallback to public GitHub on failure |
| Published content, selected immutable images, release/rollback definitions | Existing GitHub release packages | Existing checks, merge, deployment and rollback; only selected published images leave private staging |
| Avatars | Existing private profile-image bucket or account JSONB fallback | Existing durable behavior; local-avatar fallback files are included in runtime backups when present |

Matchmaking queues, socket connections, presence, unsaved browser form values and temporary Admin playtest sessions intentionally expire. Durable test receipts and saved drafts survive. This is checkpoint recovery, not zero-loss replay of every acknowledged network packet.

## Case: rollout order

1. **Confirm the project and preserve existing state.** Match the Render backend's `SUPABASE_URL` to the actual Gauntlet Supabase project. Preserve a current database backup. Plan a maintenance window for disk cutover. Before attaching a disk or redeploying, let current games finish and export any needed existing local files from the old instance: room checkpoints, match/faction JSON, enabled SQLite ledgers, local content, archives and avatars. Adding a disk itself triggers a deployment and does not copy the old ephemeral filesystem. Never copy only an open SQLite main file: use SQLite `VACUUM INTO` (the existing `scripts/backup-gold-ledger.js` supports Gold) to include committed WAL data. Keep these exports private and off the service.
2. **Run SQL in this order**, each as a complete transaction in Supabase SQL Editor:
   - `supabase/migrations/20261013013808_account_stats_concurrency_guard.sql`
   - `supabase/migrations/20261015032055_durable_match_and_private_authoring.sql`
   The second adds the existing dedicated match contract and the private authoring store. It uses invoker functions, service-only grants, RLS and a restrictive Storage policy for the two default private buckets. It does not grant/debit currency or change player content. Re-running either migration is safe. Do not run a database reset.
3. **Attach a persistent disk to the existing Render backend**, mounted at `/var/data`. This requires a paid Render service/disk. Keep one service instance. Disk-backed deployments stop the old instance before starting the next, so expect a brief reconnect window. These are [Render's disk constraints](https://render.com/docs/disks); no disk or paid service has been provisioned by this change.
4. Deploy the follow-on code with the new storage flags still unset. From the repository root (containing `server/` and `scripts/`) in Render Shell, run:

   ```sh
   node scripts/initialize-runtime-storage.js /var/data/gauntlet
   node scripts/prepare-durable-storage.js
   ```

   The first verifies an actual persistent Linux mount and creates a private volume marker. The second uses the existing backend Supabase credential to create/verify private backup and match-archive buckets. It refuses existing public buckets. It never changes repository visibility. Existing custom `MATCH_ARCHIVE_BUCKET` values need equivalent restrictive Storage policies; the migration protects the default bucket name.
5. Before switching paths, restore the old exported files into the initialized data directory using their intended names. The defaults are `rooms.json`, `matches.json`, `faction-stats.json`, `accounts.json`, `match-archives/`, `avatars/`, and `content/`. Existing Supabase accounts stay in Supabase; an empty local account file is not a migration of them. If Para/Gold is already enabled, preserve the databases and their existing opening-balance policy; place them in `para/para.sqlite` and `economy/economy.sqlite`. Do not initialize replacement empty ledgers.
6. Set these backend-only variables and deploy:

   | Variable | Value |
   | --- | --- |
   | `GAUNTLET_RUNTIME_DATA_DIR` | `/var/data/gauntlet` |
   | `GAUNTLET_REQUIRE_DURABLE_STORAGE` | `true` |
   | `GAUNTLET_RUNTIME_BACKUPS` | `supabase` |
   | `GAUNTLET_CONTENT_PROVIDER` | `github` |
   | `GAUNTLET_PRIVATE_AUTHORING_PROVIDER` | `supabase` |
   | `ROOM_STATE_RECOVERY_ENABLED` | `true` |

   Retain the existing GitHub token, Supabase URL/backend secret, authentication secret and two stable admin IDs. Remove obsolete individual `*_DATA_FILE` overrides or point them inside `/var/data/gauntlet`; strict startup rejects paths outside the volume. Set `GAUNTLET_PARA_DATA_DIR=/var/data/gauntlet/para` and `GAUNTLET_ECONOMY_DATA_DIR=/var/data/gauntlet/economy` **only if those systems were already enabled**. Leave `GAUNTLET_GOLD_MIGRATION` unchanged. This rollout does not change the active economy or enable official events.
7. When private authoring is first read, the existing GitHub draft is imported on its first successful private save, preserving its revision, receipts and publication state. The old GitHub branch remains as historical evidence and stops receiving new draft writes. Coordinate both admins for this cutover; close old authoring tabs until the new backend is live. Do not switch back to GitHub-only drafts after private saves without an explicit reconciliation: the old branch is now stale.

## Verify before declaring durability live

SQL checks (read-only):

```sql
select public.gauntlet_account_write_capability(); -- 1
select to_regclass('public.gauntlet_match_records'),
       to_regclass('public.gauntlet_match_archive_index'),
       to_regclass('public.gauntlet_private_authoring'); -- all non-null
select relname, relrowsecurity from pg_class
where oid in ('public.gauntlet_match_records'::regclass,
              'public.gauntlet_match_archive_index'::regclass,
              'public.gauntlet_private_authoring'::regclass); -- all true
select has_table_privilege('anon', 'public.gauntlet_private_authoring', 'select'),
       has_function_privilege('authenticated', 'public.save_gauntlet_private_authoring(bigint,jsonb)', 'execute'); -- both false
```

Run Supabase's Security Advisor in the correct project after applying SQL and inspect existing policies. The local SQL tests exercise real PostgreSQL RLS/privileges through PGlite, but the full local Supabase Advisor could not run because no local Supabase Docker database was available. Production advisors have not been run from this session.

After deployment, `/api/storage-status` must report:

- `matchStorage: "preferred"` and full-record durability, with the private archive available/durable.
- `runtimeStorage.persistentMountVerified: true` and `activeRooms.enabled: true`.
- `privateAuthoring.provider: "supabase-private"`, `available: true`.
- `runtimeBackups.enabled: true`, then a non-null `lastSuccessfulAt` and `failed: false` after the first minute. A successful backup means the uploaded object was downloaded and hash-verified, not merely accepted for upload.

Admin → Operations → Health exposes volume/checkpoint/backup status without private room contents. The first backup runs a minute after startup, then hourly. A failure is reported and retains the previous successful recovery point. Backups are immutable and are not automatically pruned; Case should monitor Storage usage and manage retention after a restore drill. The initial backup envelope is bounded to 64 MiB; exceeding the bound fails visibly and requires a larger/streaming backup implementation.

Use both allowed Admin accounts to verify shared saved changes and a stale-revision rejection. Confirm ordinary accounts and signed-out requests still get denied. Private notes/unused image versions must not appear in a content PR; only explicitly published artwork does. No real purchase/grant is needed for a smoke test.

In a controlled test, capture an ordinary match and a draft, restart the backend and reconnect with the same client identities. Confirm the latest checkpoint, hand/deck state and picks restore and the reconnect grace period starts. Pending match finalization should retry once storage is available. Verify a completed record/replay remains readable after replacement. Do not test destructive restore against production.

## Backup and restore commands

Run with the existing backend environment from the repository root:

```sh
node scripts/runtime-backup.js create
node scripts/runtime-backup.js list
# Use list 100, list 200, ... to inspect older objects.
node scripts/runtime-backup.js restore 'runtime/EXACT-OBJECT-KEY.json.gz' /var/data/gauntlet-restore-drill
```

Use an exact object key returned by `create` or the Storage listing (the listing's filename needs the `runtime/` prefix). Restore requires a new absolute directory and refuses to overwrite the current one. It verifies the object digest, every file digest and restored SQLite integrity. The volume marker is written last, so an interrupted restore is not valid. Inspect the restored state offline before switching any service paths. Preserve the old directory and compare match receipts, Para settlements and Gold entitlements before accepting an older recovery point.

The runtime backup contains only configured private local stores. Each SQLite copy is transactionally consistent, including committed WAL entries. A backup is not a distributed transaction across SQLite, Supabase and live sockets. Do not restore an old ledger while account/match stores continue accepting writes. Quiesce the service, select compatible recovery points and reconcile immutable match/receipt identities. Never make compensating balance edits by guessing.

Supabase database durability and disaster backups are separate. Check Database → Backups in the existing project. Paid plans provide scheduled database backups; free projects need scheduled private exports. Database backups **do not contain Storage object bytes**. Keep independent protected copies of important Storage objects and database exports; deleting the Supabase project is outside the protection of a backup stored in that same project. See [Supabase's backup coverage](https://supabase.com/docs/guides/platform/backups). Enabling paid backup/PITR features or external retention is an operator action, not something this code has enabled.

The browser Match Library remains useful independent recovery. Old full match records already lost from ephemeral storage cannot be reconstructed from compact account indexes. Recover retained canonical JSON through the existing Admin archive import flow; do not fabricate records.

## Practical limits

- Room writes are atomic and fsynced, normally scheduled after 50 ms. A hard crash can lose changes since the last successful checkpoint. Finalization intent is checkpointed synchronously before remote consequence writes.
- Recovery requires compatible deployed engine/content code and retained authentication secrets. This is one authoritative server instance, not active-active failover.
- Private image staging retains the existing 3 MiB input, 1 MiB processed-image, 6 MiB image-library and 16 MiB authoring-envelope limits. This does not add arbitrary file upload or an unlimited asset store.
- Supabase table backups cover private drafts/notes/staged images because their existing bounded envelope is stored in JSONB. Published immutable image bytes remain bundled with their release in GitHub. Profile/archived-match Storage objects need object-level protection as described above.
- No balances, prices, rules, rewards, live content, administrator permissions or previously disabled systems are changed by this implementation.
