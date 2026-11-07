# Admin production implementation

Updated: 2026-10-29. Branch: `codex/admin-production-system`.
Baseline: `b6d80ff4a85b751a7a8d91c59c6a644366d9535e` (current main and inspected production).

## Scope and safety

Implement the complete operator content-production assignment. Keep Render Free, the two stable-ID administrators, existing economy launch flags and approved game/economic policies. Use isolated fixtures for writes, purchases and recovery. No production draft, balance or content changes are test fixtures. No paid service or real charging activation.

Status vocabulary: **pending**, **implementing**, **implemented**, **verified**, **deployed**, **external blocker**. A configured service is not a verified recovery path. A testable library is not an integrated feature.

## Starting state

- The attached clean checkout was on the older durable-storage branch. This branch starts at current main, preserving that work.
- Open PR #93 covers completed-match client exports and browser-check repairs; do not overwrite that work. Open stacked PR #77 contains older durability work already incorporated into main; do not merge it again.
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
| Export/backup/isolated restore and truthful health | implemented for rooms/drafts and operational scopes; hourly private backups with explicit budget | 8 remote runtime tests passed including scheduler readback, restart status, capacity stop and isolated restore | no production restore; account/media disaster coverage still pending |
| Remote immutable image/audio library and legacy import | implemented, opt-in | SQL privacy/capacity, legacy import, image rollback, WAV dialogue consumer and 7 client media checks passed | private bucket/config pending |
| Connected set/card/printing/distribution and deck/product workflows | pending | pending complete browser journeys | shared release integration |
| Existing pack rules exposed as validated configuration | pending | pending equivalence tests | no economy changes |
| Engine vocabulary, automatic decisions, FFA and faction families | implementing; v2 queued decisions, qualified FFA automatic combat subset, sixteen family bindings and Studio controls | 13 legacy/family checks, 8 decision/FFA checks and 52 focused client checks passed; full network qualification pending | v1 retained; decisions in FFA/support windows explicitly unavailable |
| Campaign objectives, AI profiles and encounter workflow | pending | pending real-engine journey | undefined designs remain explicit |
| Cohesive accessible workspace and resumable operator preferences | pending | pending desktop/mobile/keyboard evidence | bundle checks required |
| Exact-revision data release activation, history and rollback | implemented opt-in through existing GitHub checks/merge and private CAS activation | isolated publish/lost reply/restart/rollback/captured-content/source-incompatibility test passed; full provider suite pending | GAUNTLET_DATA_RELEASES; no production activation |
| Website prose registry and audited player corrections | pending | pending invariants/authorization tests | no arbitrary JSON editing |
| Competition and commerce sandbox qualification | pending | pending settlement/purchase/refund recovery | no real payment provider configured |
| Operator guide, configuration, cutover/recovery instructions | pending | review against final implementation | no secrets |
| Full checks, browser demonstrations, capability registry and review handoff | pending | pending | distinguish deployed from prepared |

## Decisions and evidence

- Reuse existing Supabase REST/service-role patterns and executable PostgreSQL tests. New private tables deny `anon` and `authenticated`; privileged RPCs use security invoker and restricted execute privileges.
- Supabase current changelog reviewed: upcoming legacy TLS cipher removal does not affect the supported Node runtime; no dependency on deprecated framework adapters or writable storage/realtime system schemas.
- Existing tests and CI are retained. Tests must prove consumer wiring and failure behavior, not just the presence of new controls.

## Resume notes

No implementation is deployed. Room and operational commits withhold acknowledgements and responses until remote persistence succeeds; failures quarantine the writer. A forced server stop with a fresh local filesystem recovered a real active game and picked draft pool. This is a single-writer, 64 MiB per-scope implementation, not production recovery evidence. Continue content workflows, distribution, prose/player support, encounter profiles, broader backup coverage, browser journeys and final checks. FFA decision queues remain unavailable; only qualified v2 automatic Servitor attack/block/combat-end operations execute in FFA. Data-only activation remains opt-in, after checked GitHub merge; code changes still require deployment.
