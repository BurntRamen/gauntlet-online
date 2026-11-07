# Admin production implementation

Updated: 2026-11-07. Branch: `codex/admin-production-system`.
Original baseline: `b6d80ff4a85b751a7a8d91c59c6a644366d9535e` (production inspected 29 October). Implementation checkpoint: `c902aae`. Current main through `6498387` was integrated in `f45e887`, preserving the newer faction mechanics, voices, themes and animated portraits. Production was not reverified on 6 November.

## Scope and safety

Implement the complete operator content-production assignment. Keep Render Free, the two stable-ID administrators, existing economy launch flags and approved game/economic policies. Use isolated fixtures for writes, purchases and recovery. No production draft, balance or content changes are test fixtures. No paid service or real charging activation.

Status vocabulary: **pending**, **implementing**, **implemented**, **verified**, **deployed**, **external blocker**. A configured service is not a verified recovery path. A testable library is not an integrated feature.

## Starting state

- The attached clean checkout was on the older durable-storage branch. This branch starts at current main, preserving that work.
- November reconciliation integrated main through PR #100, including completed-match exports, browser repairs, newer faction behavior, voices/themes and animated portraits. Older stacked durability work is already incorporated; do not merge it again.
- Existing Admin has content workshops, typed mechanics, shared release gates, private Supabase authoring, immutable packaged images, account CAS, durable completed-match archives and extensive browser tests.
- Active rooms/drafts still use local snapshots; optional Para/economy use SQLite. Remote runtime durability is missing.
- Uploaded images are embedded, retained total 6 MiB. Audio upload and remote immutable media are missing.
- New factions use Rumin only; authored mechanics support two-player games and no automatic choice requests.
- Inspection reported production authoring writable; no production write journey or restart recovery was exercised.

## Execution checklist

| Work | Implementation | Verification | Deployment / dependencies |
|---|---|---|---|
| Repository, open work, current docs, baseline reconciliation | verified | current main and PRs inspected | no changes deployed |
| Durable active rooms/games/drafts; commit-before-ack; retries and concurrency | implemented, opt-in | 18 focused tests passed, including real process replacement and database outage | migration and backend rollout pending |
| Durable Para/economy/entitlements; migration and reconciliation | implemented, opt-in; remote commit boundary and memory projections integrated | 44 focused/legacy checks passed including purchase/refund recovery, duplicate settlement, stale writer, HTTP failure and migration | retain launch flags; migration/rollout pending |
| Export/backup/isolated restore and truthful health | implemented for rooms/drafts and operational scopes; hourly private backups with explicit budget; full project export and owner-only empty-project restore | 8 runtime backup checks plus 2 full-project SQL/object checks passed: credentials, balances, revisions, hidden rooms, private drafts, archive indexes/bytes, lost replies, corruption, schema mismatch and atomic rollback | no production restore; independent off-project copies and actual application disaster drill remain operational steps |
| Remote immutable image/audio library and legacy import | implemented, opt-in | SQL privacy/capacity, legacy import, image rollback, WAV dialogue consumer and 7 client media checks passed | private bucket/config pending |
| Connected set/card/printing/distribution and deck/product workflows | implemented; derived per-object production paths, linked owners and creation defaults | production-guide tests passed; desktop/390px phone guide inspected with no overflow; complete creation/delivery browser journeys running | shared release integration; no live content writes |
| Existing pack rules exposed as validated configuration | implemented; shared and authored-set recipes, fixed 13 cards and suit guarantees | 2 real Draft/Sealed/earned consumer checks plus existing catalog lifecycle and 11 monetization checks passed; UI controls passed | no economy changes; not deployed |
| Engine vocabulary, automatic decisions, FFA and faction families | implemented; v2 queued decisions, qualified FFA automatic combat subset, sixteen family bindings and Studio controls | legacy/family and decision/FFA checks passed; 3 real socket checks passed for paid choices, persistence/reconnect, timeout without payment, duplicate requests and explicit four-player opponent semantics | v1 retained; decisions in FFA/support windows explicitly unavailable |
| Campaign objectives, AI profiles and encounter workflow | implemented; captured scripted-pressure/support-first profiles and explicit undefined-objective boundaries | 22 encounter/AI/recovery checks passed; real paid support consumes the established action budget; broader campaign consumer checks passed | no invented survive/protect semantics; no content balance changes |
| Cohesive accessible workspace and resumable operator preferences | implemented; browser navigation preferences, recent objects and production shortcuts | client navigation tests passed; desktop/mobile guide inspected; existing keyboard/phone browser flows passing, full run ongoing | main 178.3/180 KiB; player 758.4/759; initial Admin 18.2/20; total Admin 65.6/66; largest chunk 274.2/350; expanded Admin-only ceiling documented |
| Exact-revision data release activation, history and rollback | implemented opt-in through existing GitHub checks/merge and private CAS activation | isolated publish/lost reply/restart/rollback/captured-content/source-incompatibility test passed; full provider suite pending | GAUNTLET_DATA_RELEASES; no production activation |
| Website prose registry and audited player corrections | implemented; 9 additional page headers, searchable surface editor, idempotent names and evidence-backed progress repair | 4 publication/rollback tests, 52 prose/player-page checks, 8 player authorization/invariant/lost-reply checks and 5 existing Admin UI checks passed | no arbitrary JSON editing, money replay or production corrections; new guide integration checks pending |
| Competition and commerce sandbox qualification | pending | pending settlement/purchase/refund recovery | no real payment provider configured |
| Operator guide, configuration, cutover/recovery instructions | implemented in admin-production-operator-guide and linked operations documents | reviewing against final test outcomes | no secrets |
| Full checks, browser demonstrations, capability registry and review handoff | implementing; capability registry and declarations synchronized | client 119 suites/909 tests covered (907 passed initially; two stale assertions corrected and both affected suites passed); content package validates 644 cards/1850 immutable references; 53 qualification tests covered after budget expectation update; full server/browser runs ongoing | distinguish deployed from prepared |

## Decisions and evidence

- Reuse existing Supabase REST/service-role patterns and executable PostgreSQL tests. New private tables deny `anon` and `authenticated`; privileged RPCs use security invoker and restricted execute privileges.
- Supabase current changelog reviewed: upcoming legacy TLS cipher removal does not affect the supported Node runtime; no dependency on deprecated framework adapters or writable storage/realtime system schemas.
- Existing tests and CI are retained. Tests must prove consumer wiring and failure behavior, not just the presence of new controls.

## Resume notes

No implementation is deployed. Room and operational commits withhold acknowledgements and responses until remote persistence succeeds; failures quarantine the writer. A forced server stop with a fresh local filesystem recovered a real active game and picked draft pool. This is a single-writer, 64 MiB per-scope implementation, not production recovery evidence. Complete full server/browser runs, rerun corrected expectations, qualify expanded creation/product/competition journeys, inspect final UI evidence and prepare the review handoff. Full project exports are private, bounded, independently retained and restored only by the owner into a different empty project. FFA decision queues remain unavailable; only qualified v2 automatic Servitor attack/block/combat-end operations execute in FFA. Data-only activation remains opt-in, after checked GitHub merge; code changes still require deployment.
