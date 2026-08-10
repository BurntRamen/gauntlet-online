# Local-First Portable Match History

Gauntlet match history has one portable artifact: canonical match record-v2 JSON. Match preview, Match Record, Replay, Studio inspection, JSON export, and Para projections all derive from that record. IndexedDB is a local convenience index, not a second source of truth.

## Canonical JSON and integrity

Only a finalized `recordVersion: 2` object is accepted. The shared browser/server verifier checks participant and result consistency, completion receipts, evidence ordering, public replay-frame checksums, internal match IDs, supported versions, and the absence of private session, reconnect, hand/deck-order, peek, socket, password, token, or credential fields.

Canonical serialization recursively sorts object keys, preserves array order, emits compact UTF-8 JSON, normalizes negative zero, and rejects undefined, cyclic, unsupported, or non-finite values. SHA-256 of those canonical UTF-8 bytes is the artifact's content identity. A matching hash proves canonical-content integrity; an unsigned imported file is not thereby proven to have been issued by the Gauntlet server.

The filename is `gauntlet-match-<matchId>.json`. A duplicate match ID with the same SHA-256 is a safe no-op. The same match ID with a different SHA-256 is a `LOCAL_MATCH_CONFLICT` and never silently replaces the saved artifact.

## Device Match Library

The browser stores full canonical JSON in IndexedDB under `gauntlet-match-library`. Discovery metadata includes match ID, SHA-256, completion time, participants, mode, season summary, winner, record version, and replay capability. Metadata can always be recreated from the JSON.

After a signed-in live match finalizes, the client requests the authorized canonical record from `GET /api/matches/:matchId/archive`, validates it locally, and saves it automatically. The route can serialize a complete finalized record still held by the normal match store; optional cloud object storage is not required. Supported local/offline adapter matches generate the same record-v2/evidence/frame contract and enter the same save path after completion. In-progress state is never stored as completed history.

Matches merges compact account references with full records saved in the current browser. A full local artifact is labeled `Saved on this device` and supports Preview, Watch Replay, Match Record, and Export JSON. A compact server reference without local JSON remains an honest result reference labeled `Replay file not saved on this device`.

## Client-only import and replay

`Import Match JSON` uses a file picker or drag and drop:

```text
select file -> parse -> validate -> preview -> Watch Replay
```

No upload is required. The shared projector transforms the validated record into the existing `ReplayMatchAdapter -> ProductionMatchExperience` path. Choosing Watch Replay does not persist the file. `Save to My Matches` is a separate explicit action.

Export writes the exact stored canonical JSON. An exported file can be imported in a fresh browser and replayed without the original backend process.

## Competitive trust boundary

Imported JSON is player-controlled local history. It is never attached to an account by participant-name similarity and never changes:

- Season standings or account wins/losses;
- campaign progression, rewards, achievements, or booster credits;
- collector ownership;
- Para league submission.

UI copy therefore says `Valid Gauntlet record` and `Canonical hash verified`, not `Official verified match`. Server signatures may be added in a future milestone if imported files ever become eligible to create official competitive consequences.

## Optional cloud archive

The existing private object/index abstractions remain isolated for future use. If configured, they can provide global record persistence and Studio diagnostics, but they are not required for player history, local replay, JSON export, or portability. Missing optional cloud archive infrastructure is informational and must not make Matches appear broken or block normal completion.

Compact historical account references cannot be expanded into records after their original full data is gone. Gauntlet does not fabricate evidence; importing a player-owned canonical JSON file is the recovery path.
