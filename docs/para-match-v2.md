# Gauntlet → Para match contract

`gauntlet.para-match.v2` is the server-authored integration contract for sending one completed Gauntlet match to Para Poker / Para League without transcribing actions or reconstructing a result. The legacy `gauntlet.para-match.v1` contract remains unchanged.

## Version selection

`GET /api/matches/:matchId/export/para` returns v1. A caller must request v2 explicitly with `?version=2` (or `?version=v2`). Unsupported versions fail with HTTP 400, so a v1 consumer cannot accidentally parse v2.

Contract versions are immutable once published. Additive match-record-v2 fields may feed a newer export contract, but changing a published field's meaning requires a new `gauntlet.para-match` version. The typed evidence extension is `gauntlet.league-evidence.v1` and is additive to match record v2.

## Top-level fields

- `contract` identifies the producer and the exact record, rules, content, and evidence versions.
- `source` identifies the authoritative match, canonical public URL, series, server authorship, and current storage capability.
- `match` contains mode, ranked status, timestamps, completion reason, turn count, and optional campaign, series, and draft facts.
- `participants` is ordered by player number. Each row has a stable match-scoped participant ID, identity type, optional Gauntlet account ID, display name, faction, deck identity/version/source/format, final life, and explicit result.
- `evidence.entries` is the ordered public league ledger. Each row identifies its command and event, turn/phase, actor/target/source/lane where applicable, safe typed payload, timestamp, and resulting public-state checksum.
- `results` explicitly identifies the winner and every participant outcome. Consumers must not infer outcomes from life totals.
- `recapEvidence` contains factual perspectives, combat totals, largest attack, damage, decisive turn, final public message, notable moments, and campaign encounter. It is evidence for editorial work, not generated prose.
- `verification` contains record/evidence counts, the final public-state checksum, and `contentHash`.

`verification.contentHash` is SHA-256 over canonical JSON with recursively sorted object keys, with `exportedAt` set to `null` and before adding `contentHash`. Therefore two exports of the same finalized record may have different `exportedAt` values but the same substantive hash.

## Evidence semantics and privacy

The server records evidence immediately after each accepted semantic command, before match finalization. A `command.accepted` row preserves the public command intent and subsequent rows preserve the shared duel engine's typed results. This covers attack source/declaration, public attacker and payment cards, blocks, faction ability intent/effects, priority, placements/skips, draw counts, damage/life resolution, and match end/concession.

Private hand/deck order is never exported. Draw events expose counts, not card IDs. Facedown placement omits the hidden card ID. Peek events expose that a peek occurred and its public target coordinates but never the card. Publicly committed attackers, blockers, discarded payment cards, and resulting values may be retained.

## Identity and consumer rules

Gauntlet account IDs are source identities, not Para player IDs. Para must explicitly map account-backed participants to stable league-player UUIDs. Guests remain guest identities and may be mapped deliberately. AI/campaign opponents remain source-only participants and must not cause creation of a fake human league player.

Consumers must validate the producer, schema/record/evidence versions, authoritative match ID, participant/result agreement, winner agreement, contiguous evidence order, timestamps, evidence count, final checksum, and content hash. Contradictions fail closed.

Idempotency is keyed by producer, authoritative match ID, contract version, and stable content hash. Re-importing the same match returns reconciliation information and must not duplicate sessions, actions, results, or recap evidence.

## Durability capability

The export reports storage capability rather than implying durability. In production `account-only` mode, consequences, receipts, progression, and compact match references are durable, but full match record v2 and its league evidence are process-local. A v2 export is available while the running backend still has that record; global survival after backend replacement is not guaranteed. Para stores the exact received bytes and canonical evidence revision once previewed/committed, but that does not improve Gauntlet's pre-export durability.

## Producer/consumer flow

1. A completed Gauntlet record captures typed evidence and authoritative results.
2. An operator downloads `.../export/para?version=2`.
3. Para validates exact bytes, contract consistency, privacy-safe ordered evidence, and source hash.
4. The operator resolves human identities and creates an immutable preview.
5. Explicit commit atomically writes the existing Para session, action, result, notable/recap, provenance, and evidence-revision model.
6. A repeated payload is recognized as already imported and is not duplicated.

The producer-generated fixture is `server/test/fixtures/gauntlet-para-match-v2.json`; `scripts/generate-para-match-v2-fixture.js` is its canonical generator. Para's contract tests consume the identical fixture bytes.
