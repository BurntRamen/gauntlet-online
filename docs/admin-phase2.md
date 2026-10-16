# Admin Phase 2 — implementation and evidence

Updated 15 October 2026. Continues `codex/modular-admin-suite` from `cb6725c` in the isolated `para-gold-live` worktree. Case's original checkout is not an implementation target. This document supersedes the earlier unsupported-feature list only for rows explicitly verified below.

## Authority and reconciliation

The user authorized local implementation and isolated tests, not deployment, merging, production publication, production data migration, payment activation or paid provisioning. The payment decision is **provider adapter only**. No concrete provider or live merchant integration is implied. Opening Gold remains the previously agreed import of existing value outside seasonal earning caps.

Read-only remote reconciliation: main `aa00d80`; PR72 open at `53c2060`; PR77 open at `0620b2e`; unrelated remote work retained. The existing seven-area console, release system, private authoring, finite Gold/deck transaction integration and storage recovery remain the foundation. Local implementation is not evidence of production availability. Production observations are recorded in `modular-admin-suite.md`.

## Capability matrix

Status columns are independent: a local test does not establish production readiness or activation.

| Capability | Implemented | Verified locally | Production-ready | Live | Remaining work / blocker |
| --- | --- | --- | --- | --- | --- |
| Reusable declarative mechanics | Engine interpreter, strict V1 schema, shared catalog, guided CRUD, card attachment, release diffs and captured versions | 447 server / 751 client tests; browser creation → engine → publication, mobile accessibility | Two-player interpreter qualified locally; deployment/storage prerequisites remain | No | FFA interpreter is explicitly unavailable |
| New card identities | Existing Card Workshop plus reusable mechanics, unique IDs and explicit acquisition channels | Catalog, publication and browser new-card engine journey | Qualified local authoring; full acquisition → multiplayer journey remains | No | Full player deck acquisition journey |
| Mechanic structural revision | Same release authority; definition hash and interpreter pinned into every game | Real attack before/after revision, captured match unchanged, restart and compatible rollback | Qualified local release behavior | No | Future production activation |
| Rule modifiers | Not yet extended | No | No | No | Next dependency phase |
| New factions / encounters | Existing definition editing retained | Baseline tests | Existing scope only | Existing source content only | Extend creation and real consumers |
| Cosmetic equipment | Existing exact printing/deck product delivery retained | Baseline tests | Existing scope only | Existing supported selections only | Remaining ownership/selection/display destinations |
| Timetwister refunds | Not yet extended | No | No | No | Receipt contribution and audited reversal contract |
| Gold deck purchases | One finite-ledger authority after cutover; captured delivery/projection/refunds | Prior phase concurrency/restart/browser journeys | Infrastructure prerequisites apply | Disabled | Persistent ledger and separate production authorization |
| Gems / multi-price | Not yet extended | No | No | No | Authoritative currency, atomic transaction contract and UI |
| Payments | Provider adapter requested; not yet extended | No | No | No | Implement independent adapter contract; provider/merchant activation deliberately deferred |

## Dependency milestones

1. Reconcile and preserve the current implementation — done.
2. Mechanics/card creation, authoritative engine and publication integration — in progress. The reusable-mechanic milestone passed engine, adapter, publication, browser, security and unchanged budget tests. Remaining player-acquisition scope is tracked separately.
3. Explicit rule modifiers and eligible consumer selection.
4. Faction/encounter creation and cosmetic destinations.
5. Timetwister, Gems and multi-price transaction completeness.
6. Provider adapter with deterministic contract tests, no live activation.
7. Full operator journeys A–J, restart/recovery, authorization, usability and unchanged performance gates.

## Mechanics control-to-consumer traceability

| Operator control | Authoritative storage | Consumer / constraints | Evidence |
| --- | --- | --- | --- |
| Create / duplicate / archive mechanic | Optional `studio` catalog inside the existing immutable release snapshot | Stable UUID retained after publication; archival prevents new assignments, captured games remain valid | `authored-mechanics-publication.test.js` |
| Trigger / conditions / ordered effects | `mechanicContract` V1; no executable input | `mechanicRuntime` called by production priority, placement, combat, payment and turn paths | `authored-mechanics-engine.test.js` |
| Activation payment / target / limits | Captured ability and game state | Recomputed legal actions, normal hand payment, private command clone, fixed authoritative target | Engine tests and `matchAdapters.test.js` |
| Acceleration | Captured primitive | Existing `gainAcceleration`, including existing faction interactions | Regression coverage; dedicated primitive expansion pending |
| Attach mechanic to card | Canonical mechanic ID, no editor-supplied runtime program | Release compiler embeds exact definition/revision; `pinGameContent` captures it in games | Publication test |
| Revise / review / publish | One revision-checked draft, exact preview and real-engine playtest receipt | Shared publication gate; future games use new revision | Publication test |
| Compatible rollback | Existing immutable release history | Cannot remove published mechanic/card identities; old receipts and matches unchanged | Publication test |

## Operator workflow — mechanics

In Content → Engine / Rules → Mechanics Studio, create a reusable definition. Choose compatible card types, then configure abilities in execution order. Automatic triggers cannot ask for optional payment or a selected target; use an activation or combat response for those choices. Non-Servitors stay in support and cannot attack or block. Placement triggers use the ordinary current placement rules. Each ability has explicit turn and optional match limits. Mechanic counters are shared by mechanic identity for that player and bounded to 0–99; use limits are per physical source card and ability.

Save the mechanic to the shared draft. In Cards, create a card using the mechanic or attach it in Mechanics. Creation grants neither ownership nor storefront availability. Configure set membership and each acquisition/legality channel separately. Use the card's engine test and verify its actual effects, then preview and review the shared release. Publishing activates only the configured content backend; it does not deploy missing code. Revisions affect future matches. Existing games retain captured definitions, interpreter version and printing references.

## Evidence in this phase

- `server/test/authored-mechanics-engine.test.js`: support placement/cantrip timing; non-Servitor attack/block rejection; ordered attack and reduction; paid target recovery/use limits; combat response prevention; invalid executable input rejected atomically.
- `server/test/authored-mechanics-publication.test.js`: new mechanic/card through the shared publication store; exact test gate; structural revision; captured behavior; restart and rollback; malformed schema rejection.
- `client/src/babylon/matchAdapters.test.js`: 41 passing adapter cases, including authored paid activation through real selection/confirmation controls.
- Focused Studio-era existing UI suites: 9 passing cases. This focused result is superseded by the milestone results below.

## Production and recovery prerequisites

The prior phase activation/recovery checklist remains mandatory. No Phase 2 code is deployed. Before any later activation: qualify the full suite and unchanged bundle ceilings; verify both exact operator IDs; deploy compatible client/server/interpreter code; verify private authoring and persistent storage; back up and rehearse restore into an isolated destination; separately authorize production content and currency activation. Restore captured releases alongside account/ledger/checkpoint records. Never activate an unavailable provider from a UI configuration switch.

## Required decisions from Case

No additional payment choice is needed now: the provider adapter is the agreed scope. Concrete provider credentials, merchant/tax/jurisdiction configuration and separate authorization would be needed only for a later provider integration or activation. Local implementation can continue without them.

## Reusable-mechanic milestone qualification

- Server suite: **447 passed** (`artifacts/phase2-server-final.log`). Client suite: **751 passed**, 103 suites (`artifacts/phase2-client.log`).
- Nine focused authoritative mechanic/publication cases cover ordered effects, paid and conditional activations, targeting, movement, expiration, counter costs, faction acceleration interactions, captured revisions, restart, rollback and malformed definitions.
- Browser: `npm exec playwright test -- --config=playwright.phase2.config.js` passed one full guided authoring journey. The operator creates a mechanic and a new card, follows the cross-link to its actual engine test, executes attack + life gain, publishes, verifies the public compiled definition and rendered printing. Desktop and 390-pixel mobile verified; zero Axe violations in the Studio.
- Screenshots: `artifacts/phase2-mechanic-studio.png`, `phase2-mechanic-mobile.png`, `phase2-mechanic-engine.png`, `phase2-new-card-preview.png`.
- Production build/lint passed. Unchanged gzip limits: main 168.4/180 KiB; player 722.7/753; Admin entry 17.3/20; aggregate Admin 62,462/62,464 bytes; largest async 274.2/350 KiB. The next UI phase needs further consolidation; the budget is not raised.
- Operator help now comes from the existing private server guide projection through one shared Help provider, aligning deployed contract explanations and avoiding repeated bundled prose. No code or functionality is hidden from budget attribution.
- The V1 interpreter is two-player only. Free-For-All rejects affected decks before creating match state; standard source cards and existing FFA behavior remain covered by regression tests. Extending it requires explicit multiplayer target contracts and engine hooks.
- Structural card identity, exact printings, acquisition channels and historical versions are retained. Creation still grants no ownership. Remaining full player acquisition/deck and later commerce journeys are not claimed complete by this milestone.
