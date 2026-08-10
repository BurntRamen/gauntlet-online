# Portable Match Archive

Gauntlet treats the server-authored match record v2 as its one canonical historical artifact. Match Record, Replay, completion reconstruction, Studio previews, and Para v1/v2 are projections of the same retrieved record; none has separate long-term truth.

## Canonical JSON and identity

Only a finalized `recordVersion: 2` object is archivable. The verifier validates participant/result consistency, completion receipts, evidence ordering, public replay-frame checksums, internal match IDs, supported versions, and the absence of private session, reconnect, hand/deck-order, peek, socket, password, token, or credential fields.

Canonical serialization recursively sorts object keys, preserves array order, emits compact UTF-8 JSON, normalizes negative zero, and rejects undefined, cyclic, unsupported, or non-finite values. Presentation indentation is not part of the identity. SHA-256 of those canonical UTF-8 bytes is the archive identity.

Objects use this private layout:

```text
matches/<UTC year>/<UTC month>/<matchId>/record-v2.json
```

The object is immutable. A duplicate match ID with the same SHA-256 is a safe no-op. The same match ID with a different SHA-256 is an `ARCHIVE_CONFLICT` and is never overwritten.

## Lightweight index

`gauntlet_match_archive_index` contains discovery metadata only:

- match ID and record/index versions;
- completion time, mode, ranked flag, and compact season/result facts;
- participant account IDs and public participant summaries;
- private object key, SHA-256, canonical byte size, status, and object version.

Evidence, replay frames, full completion data, and the canonical record are not duplicated into this index. The durable read path is match ID → index → private object → canonical SHA/size validation → record-v2/replay validation → consumer projection.

Legacy `gauntlet_match_records`, event rows, and compatibility journals remain readable during migration. They are compatibility sources, not a second archive format.

## Finalization and recovery

For archive-enabled completion, the server:

1. builds record v2;
2. prepares account consequence facts without mutating account state;
3. builds and validates the finalized record;
4. canonicalizes and hashes it;
5. writes the immutable private object;
6. inserts the lightweight index;
7. commits prepared account applications through the preferred RPC or compatibility receipt path;
8. exposes the completed match.

Object and index writes are idempotent. An object without an index is reconciled by retrying the same canonical record. An indexed object is re-downloaded and verified before a duplicate is accepted. Account applications retain the `(matchId, accountId)` receipt identity, so a lost response or retry does not duplicate rewards or season points.

When archive infrastructure is optional during rollout, failure is explicitly reported as `archive-unavailable`/degraded and existing completion behavior continues. Production should set `MATCH_ARCHIVE_REQUIRED=true` after the private bucket and index are verified; then archive failure stops finalization before account mutation.

## Access and workflows

Canonical objects are private and have no public raw URL. `GET /api/matches/:matchId/archive` streams verified canonical JSON only to a participating signed-in account or a valid short-lived Studio owner session. The filename is `gauntlet-match-<matchId>.json`.

Matches presents a friendly preview and `Archived · Verified` state before raw export. Studio provides Preview, Match Record, Replay, Download JSON, Para Export, Verify Integrity, and an owner-only recovery import.

Import is `select → parse → validate → preview → explicit commit`. It accepts only a complete authoritative record-v2 artifact. It never reconstructs evidence from compact history and never applies account consequences. Exact duplicates are no-ops; conflicting bytes fail closed.

The owner-only `POST /api/admin/match-archive/archive-process-local` path can archive complete finalized records still available in the current process. Compact account references are never promoted into fabricated records and remain visibly unavailable.

## Supabase activation

Use the existing Gauntlet Supabase project only:

1. apply the `gauntlet_match_archive_index` portion of `server/supabase-schema.sql`;
2. create a private Files bucket named `gauntlet-match-archives` through the Supabase Storage API or dashboard;
3. do not add public object policies—the backend service role is the only storage client;
4. set `MATCH_ARCHIVE_BUCKET` if a different reviewed name is used;
5. verify `GET /api/storage-status` reports an available private canonical archive;
6. set `MATCH_ARCHIVE_REQUIRED=true` and restart the backend;
7. complete the before/after restart qualification with one real production match.

Do not insert or update `storage.objects` directly. Supabase Storage metadata is read-only application infrastructure; object operations go through the Storage API.

## Historical limitation

An account-only compact match reference has only match ID, record version, completion time, and deck-version reference. If its full process-local record was already lost, the canonical archive, Match Record, Replay, and JSON export remain unavailable. Gauntlet reports that limitation instead of inventing historical evidence.
