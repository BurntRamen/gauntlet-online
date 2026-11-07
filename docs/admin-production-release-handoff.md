# Admin production release handoff

Prepared on 7 November 2026. Branch `codex/admin-production-system`. This is a backend and Admin tooling release; it does not publish authored balance/content changes. Render remains Free. No launch flag or live payment service has been enabled.

## What ships

- Remote room, game and draft checkpoints; operational ledger recovery; acknowledgements only after confirmed durable commits.
- Immutable private artwork/audio storage, capacity accounting and retained release references.
- Connected content production paths, resumable navigation, supported pack configuration and nine additional website prose surfaces.
- V2 authoritative mechanic choices, qualified multiplayer operations, sixteen existing faction families and captured encounter AI profiles.
- Exact-revision data-only release activation behind an explicit opt-in, contributor review and rollback.
- Audited, idempotent player name corrections and evidence-based progression repairs.
- Bounded runtime backups and complete private project export/isolated restore, including account credentials, portraits, friends/messages, layouts, ledger records, drafts and canonical match bytes.

## Deployment sequence

1. Keep one writer and preserve current server configuration privately. Preserve the active release, private authoring data and any existing room/SQLite files. Back up SQLite consistently with its WAL. Do not use production accounts as verification fixtures.
2. Apply the pending migrations in order: `20261029211614_authoritative_runtime_state.sql`, `20261029212907_immutable_media_library.sql`, then `20261107045019_private_recovery_export.sql`. Existing account concurrency, durable-match/private-authoring migrations and `server/migrations/command-deck-layouts.sql` are prerequisites. Apply only missing migrations; the new migrations are repeatable. The application never applies them automatically.
3. Prepare/verify the private media bucket with `node scripts/prepare-media-storage.js`; prepare/verify the backup bucket using `node scripts/prepare-durable-storage.js`. Use the existing backend-only Supabase credentials. Inspect current project quota before selecting budgets; no plan upgrade is implied.
4. If existing room or SQLite state is present, quiesce the old writer and follow the export → verify → isolated restore → idempotent import procedures linked below. An empty new remote scope must not replace a populated source silently.
5. Deploy the compatible backend with `GAUNTLET_ROOM_STATE_PROVIDER=supabase`, `GAUNTLET_OPERATIONAL_PROVIDER=supabase`, and `GAUNTLET_MEDIA_PROVIDER=supabase`. Configure `GAUNTLET_RUNTIME_BACKUPS=true` only after verifying its private bucket and budget. Existing `GAUNTLET_PARA_DATA_DIR`/`GAUNTLET_ECONOMY_DATA_DIR` remain activation switches; leave them and Gold/Gems/payment launch controls at their prior values. Remote mode uses in-memory SQLite projections, not those local directories as authority.
6. Verify storage status, current release/engine identities, both approved administrators and unauthorized denials. Confirm a synthetic isolated restart drill and reconciliation before reopening the corresponding migrated operations. Configuration health alone is not recovery proof.
7. Deploy the frontend. Existing request forms remain compatible, while capability metadata exposes the new controls. Migrate embedded artwork through the revision-checked Admin asset migration after preserving its private export. It preserves asset/version identities and hashes.
8. Data-only content activation is optional: enable `GAUNTLET_DATA_RELEASES=true` only with the existing GitHub provider, exact checks/merge and private authoring CAS configured. Engine/source changes continue through code deployment.

The public read-only check on 7 November returned frontend HTTP 200 and backend content HTTP 200, rules `gauntlet-duel-v12`, 644 cards, commit `6498387a7ec105476a725ba8e4259fd4b4d7414b`. Guest Admin requests returned 401. This verifies the existing deployment, not this branch or production recovery.

## Recovery and rollback

Use [remote room operations](remote-runtime-operations.md), [operational ledger cutover](remote-operational-storage.md), [immutable media operations](immutable-media-operations.md), [full private project recovery](project-recovery.md), and [mechanic/data release compatibility](mechanics-decisions-and-data-releases.md).

Keep exports private and off the application filesystem. Full isolated restore requires an empty separate project, matching schemas, its owner database connection and PostgreSQL 16+ `psql`. Object/readback checks and actual playable application recovery are distinct. Never restore over the live project. A code rollback must keep readers compatible with captured rooms, v2 mechanics and remote asset references. Once a new authority accepts writes, returning to an old file/project loses those writes; reconcile an export of the current authority first. Content rollback never reverses purchases or player repairs.

## External dependencies and explicit limits

- Production migration/configuration and deployment remain outstanding. No production recovery drill or production authoring write was performed for this implementation.
- Real-money charging remains disabled pending an approved connected provider and its policy/configuration. Test funding is never live payment evidence.
- Undefined encounter goals such as survive-turn/protect-target remain unavailable until their exact victory/loss semantics are defined. FFA decision queues and unqualified timing combinations remain rejected explicitly.
- Remote runtime uses one writer and bounded 64 MiB state scopes. Scheduled backups have explicit retention/capacity limits; full-project off-site exports require an operator schedule and independent retention.
- This export covers app-owned data and referenced objects. Deployment secrets, GitHub/provider records, repository code and external authentication systems require independent retention.

See [implementation checklist](admin-production-implementation.md) for current test status and [operator guide](admin-production-operator-guide.md) for normal use. Browser qualification is still in progress; do not treat this handoff as a completed release gate until the checklist records its final results.
