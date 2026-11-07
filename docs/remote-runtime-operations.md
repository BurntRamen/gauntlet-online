# Remote runtime storage on Render Free

This implementation is opt-in. It does not activate economy, Para, Gems or charging. The existing local provider remains the default until cutover. Supabase runtime tables contain hidden hands, future deck/pack order and reconnect secrets: only the backend service role may access them. Never put an export in Git, a public bucket, screenshots or client code.

## Commit contract

With `GAUNTLET_ROOM_STATE_PROVIDER=supabase`, room mutations run in one server queue, including socket handlers, AI and lifecycle timers. State and direct/broadcast responses are captured. Success acknowledgements and state updates leave the outbox only after the PostgreSQL RPC commits. The same transaction stores its unique request receipt. A lost HTTP response retries the identical request; a stale writer cannot overwrite a newer revision. Failure discards the success outbox and stops further room writers until a compatible restart reads the committed authority.

Match finalization first commits its pending state, then invokes existing idempotent match/account consequence handling. This is a recoverable sequence, not a claim of one transaction across separate account and runtime operations. Account metadata and existing economy writes retain their own authorities.

Captured rooms retain content, deck order, draft pools, command receipts, membership, reconnect credentials, absolute AI deadlines and server evidence. Sockets and timer handles are rebuilt. Existing human reconnect-grace behavior is preserved. Engine contract mismatch refuses startup rather than falling back to empty local rooms.

The first adapter is a single-writer aggregate with a 64 MiB RPC limit; it serializes operations across rooms. It is bounded, not a high-concurrency sharded runtime. PostgreSQL request receipts are retained. Watch capacity and receipt growth before scaling; no automatic history deletion is implemented.

## Migration and cutover

1. Run isolated SQL and process-replacement checks. Apply `20261029211614_authoritative_runtime_state.sql` to the existing project. It is repeatable and does not touch account balances, identities or ownership. Check RLS, service-role-only privileges and absence of public RPC execution.
2. Stop new room admission and quiesce the existing server. Preserve its latest private `rooms.json` while its ephemeral filesystem still exists. Do not redeploy first or copy a changing checkpoint.
3. From a trusted backend environment with existing Supabase credentials, run `node scripts/remote-runtime.js import-local /absolute/private/rooms.json`. It creates only an empty remote authority; repeating the exact import is a no-op. A different existing remote state is a hard conflict. Keep the original file unchanged.
4. Set only `GAUNTLET_ROOM_STATE_PROVIDER=supabase` on the backend. Keep all economy and league flags unchanged. Start one compatible backend writer and inspect Operations. No persistent Render disk is required for room state.
5. Reconnect the test participants; verify their match identity, hand, deck/pool order and last accepted command. Perform the approved deployment recovery drill before describing production recovery as verified.

If there are no active rooms, intentionally begin with an empty remote authority after confirming that fact. There is no automatic import from a possibly stale filesystem.

## Export and isolated restore

Run from a trusted environment; paths must be absolute and private:

```
node scripts/remote-runtime.js export /absolute/private/runtime.json
node scripts/remote-runtime.js verify /absolute/private/runtime.json
node scripts/remote-runtime.js restore-isolated /absolute/private/runtime.json restore-drill-20261029
```

Export refuses to overwrite a file. Restore requires a separate `restore-*` store and refuses to replace different existing state. It reads back the restored payload before reporting success. Hash verification proves integrity, not a successful playable recovery. The automated process test additionally starts a new server process and reconnects synthetic game/draft players.

The room export command covers rooms and drafts only. Operational exports and scheduled remote recovery points are described below and in `remote-operational-storage.md`. The [full private project export](project-recovery.md) captures account tables, private authoring, archive indexes and immutable object bytes together. Retain an independent off-project copy. No production recovery drill has been performed.

## Rollback and incident recovery

On storage failure, preserve logs and committed remote state. Do not disable the provider to resume from an old local file. Restart the same compatible engine after fixing the database connection; the last commit and command receipts remain authoritative. An uncertain action may have committed: reconnect and inspect before retrying.

Rollback application code only to a build supporting the captured runtime contract. To return to local storage, first stop writers, export the current remote authority, convert and verify it offline, and arrange genuinely durable local storage. Render Free does not provide that storage, so reverting to its local provider is not a durable rollback.

## Verification commands

```
node --test server/test/remote-runtime.test.js server/test/remote-room-process.test.js
node --test server/test/socket-boundary.test.js server/test/room-state-store.test.js
```

The process test uses a local PostgreSQL-compatible database and HTTP fixture, synthetic guests, and separate temporary filesystems. It kills the first process without graceful shutdown, restores both a game and draft plus exact purchased entitlements and ledger records through production startup, verifies private projections, and rejects an action during a simulated database outage.
# Remote recovery-point backups

With remote room authority, `GAUNTLET_RUNTIME_BACKUPS=supabase` now schedules verified private Storage recovery points without a persistent Render disk. It captures committed room and operational scopes after the shared writer checkpoint. Scope names, captured revisions and engine contracts travel in the gzip object. Status persists remotely across restarts. The default budget is 128 MiB (`GAUNTLET_BACKUP_MAX_BYTES`), separate from the Supabase project's total quota; at 48 objects or the byte budget the job stops with an actionable capacity error and preserves every existing recovery point. No automatic deletion or paid upgrade occurs.

Use the object key reported in Operations with `node scripts/remote-backups.js download OBJECT_KEY ABSOLUTE_PRIVATE_FILE`, then `verify OBJECT_KEY ABSOLUTE_PRIVATE_FILE`. `restore-isolated OBJECT_KEY ABSOLUTE_PRIVATE_FILE drill-name` restores each scope to a new `restore-drill-name-*` authority, verifies readback, and refuses different pre-existing data. It never activates the restored scopes. Explicitly export and reconcile old recovery points before manually rotating the backup bucket; always retain a verified off-service copy.

Scheduled coverage is **active rooms/drafts and configured operational ledgers**. Use the separate [full project export](project-recovery.md) for account rows, private authoring and actual media/archive object bytes. Restoring ledger state without the corresponding account grants, match evidence and media can create inconsistencies; perform the complete cutover drill in isolation. Configuration, backup integrity, restore readback and production recovery remain separate facts.
