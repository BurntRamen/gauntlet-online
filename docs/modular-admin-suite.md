# Modular Admin suite — working implementation record

## Scope and authority

15 October 2026. Direct user assignment: complete supported operator journeys in isolated environments. No production deployment, PR merge, payment activation, paid provisioning, database migration, balance changes or production publication is authorized. Local fixture migrations and transactions are acceptance tests, never production actions. Original dirty checkout and Case's other branches are preserved.

Worktree: `C:/Users/gjoep/.codex/worktrees/para-gold-live/gauntlet-online`; branch `codex/modular-admin-suite`. Base: PR 77 `0620b2e`, including PR 72 `53c2060` and merged PR 75. Main's Reath campaign commits `43071c9` and `6f02104` are applied locally; encounter setup resolution retains authored card availability and captured release lookups. No remote branch has been changed.

## Reconciled baseline

| Source | Verified state | Consequence |
| --- | --- | --- |
| PR 75 | Merged as `e1ef70a`; code deployed | Para/Gold definitions and interfaces shipped; runtime activation is independent |
| PR 72 | Open, `53c2060`, all checks passing | Cards, printings, sets, decks, deck products, captured gameplay integration and explicit toolchain are integrated locally, not production claims |
| PR 77 | Open against PR 72, `0620b2e`, all checks passing | Persistent volume, private authoring, canonical match tables and backup/restore implementation integrated locally; production prerequisites unapplied |
| Main | `aa00d80`, includes Reath campaign PR 76 | Campaign retained in this integration |
| Production frontend | Deployment 7083943381 successful at main `aa00d80` | Does not include PR 72/77 or this work |
| Production storage API | `/api/storage-status`, read 15 October | Supabase accounts; matches `account-only`; canonical archive missing table; Para disabled; finite Gold disabled; opening import disabled |

Do not interpret a preview deployment, an editable definition, or an installed backend as an activated operational capability.

Read-only reconfirmation at 14:47 America/New_York on 15 October: PR72/77 remain open at the heads above; main is unchanged. The production storage response still reports account-only match persistence, missing canonical archive, and disabled Para/Gold/opening import. The local branch has no upstream and has not been pushed.

## Verified capability matrix at entry

| Module | Authority / consumer | Live | Local / unmerged | Missing or blocked |
| --- | --- | --- | --- | --- |
| Content | Immutable content releases → captured game, collection and presentation | Existing workshops, validation and playtests | PR72 cards/sets/printings/decks/products; private staging PR77 | Faction creation, arbitrary mechanics, campaign chapter/objective authoring unsupported |
| Ranked | `seasons.js` → matchmaking identities, account results and standings | Source Season Zero | Existing result/series tests | Managed future seasons, pinned scoring, calendar |
| Legacy events | `events.js` → run registration, queues and account rewards | Source evergreen/major events | Existing account runtime | Managed definitions and immutable run terms; old promises must survive |
| Para | Shared `paraLeague` definitions → `paraRuntime` | Configuration/preview only | Official attempts, canonical settlement, standings, pause/resume/cancel | Persistent volume, canonical evidence, recovery qualification and explicit activation |
| Account store | Account CAS → deck/printing/back grants | Legacy pack/pricing routes | PR72 deck products and atomic receipt/grants | Supabase revision migration; safe integration with finite Gold |
| Finite Gold | SQLite ledger → awards, digital access, purchase/refund/correction receipts | Disabled | Finite budgets, once-only opening import, quotes and atomic local entitlement delivery | Production durable storage; deck/cosmetic integration |
| Payments | Existing guarded fulfillment routes | No verified payment provider | Definitions only | Gems, cash checkout, dual currency and premium price migration remain unavailable |
| Players | Account store, canonical matches and financial evidence | Profiles, progress/decks, name editing | PR72/77 storage improvements | Unified currency/purchase/entitlement history and scoped search |
| Publishing | One release system → packaged active snapshot | Shared GitHub drafts, checks/deployment, compatible rollback | Private authoring PR77 | Consistent module registry and activation disclosures |
| Operations | Storage probes, receipts, backups, checkpoints | Existing diagnostics; archive unavailable | PR77 verified private backups and restore tools | Production provisioning, migrations, coordinated recovery drill |

## Current local capability matrix

Every row below is implemented on `codex/modular-admin-suite`, not enabled on production by this task.

| Area | Working operator journey | Status / explicit boundary |
| --- | --- | --- |
| Home | Seven-area navigation, actionable source failures and pending releases, current season, pinned Para event status, storefront gates, sampled player activity and deck/digital receipts | Local; unavailable sources never become zero-success counts. Activity is a bounded sample, not online presence. |
| Content | Existing engine workshops plus PR72 card/set/printing/deck/product lifecycle, exact references, private notes/assets and real engine tests | Local/unmerged. New arbitrary engine handlers, faction identities and campaign objectives remain engineering work. |
| Competition | Create/duplicate future Ranked and free Gauntlet events, local-time calendar, UTC validation, saved player previews, formats/scoring/prizes, publication, pinned settlement, standings, pause/retire/cancel; Para authoring and runtime operations | Local/unmerged; optional Para requires durable runtime. Original source competitions retain their terms; duplicate their templates for managed successors. Finite Gold closes new legacy entries. |
| Store & Economy | Explicit Gold/Timetwister deck prices, windows, lifetime limits, actual product card, atomic purchases, captured receipts; finite Gold budgets, digital fulfillment, corrections and refunds | Local/unmerged. Gold ledger is the sole Gold authority after cutover. Timetwister/account receipt refunds and arbitrary standalone equip providers are not implemented; the UI does not offer them. |
| Players | Search all accounts, inspect results/progression/decks/collection/purchases/grants/currency evidence; reasoned, atomic name correction with private operator audit | Local/unmerged; no credential, role or arbitrary ownership editor. |
| Publishing | One draft and release system for all supported configuration, conflicts, validation, exact preview/test receipts, review, publish, deployment state, active-release verification and compatible rollback | Local fixture activation tested; hosted deployment still requires authorization and configured private authoring. Saved configuration cannot activate a missing service. |
| Operations | Storage/checkpoint/backup health, full match evidence, settlement failures, archive recovery and private restore tools | Local/unmerged; production infrastructure and a coordinated restore drill remain prerequisites. Restore is deliberately an offline operation into a new directory. |

Intentionally unavailable: Gems, dual-currency checkout, real-money payment activation, unsafe premium/pack-price migration, Variant Lab, arbitrary mechanics and unsupported cosmetic equipment. These are capability boundaries, not hidden successful controls. Timetwister refund support would require a new captured ownership-contribution/refund contract and migration policy for old receipts before exposing an operator action; never infer revocable ownership from a current aggregate collection.

## Dependency plan and milestones

1. **Reconcile — complete locally:** preserve branches, inspect runtime/contracts and production read-only evidence; establish this matrix and traceability.
2. **Shared foundation — complete locally:** module registry with truthful capability/source/consumer contracts, seven areas, shared states and actionable Home. Authorization and navigation checks passed before further dependencies.
3. **Competition — complete for supported managed definitions:** release-managed future Ranked/legacy configuration, captured historical rules, templates/calendar, Para authoring/operations under one area. Real result settlement and promises tested across publication.
4. **Store — complete for supported transaction contracts:** supported products/terms, safe prices/windows/limits and previews; one currency authority and durable idempotent delivery. Restart, retirement, price changes, duplicate requests, conflicts, retries and Gold compensation tested. Account/Timetwister refunds remain explicitly unsupported.
5. **Content/Players — complete locally:** retain PR72 destinations, disclose unsupported authoring, unify support evidence and narrow audited corrections.
6. **Publishing/Operations — complete locally:** consistent workflow, active-versus-pending verification, guided failure/recovery actions and audit evidence.
7. **Qualification — complete in isolated local fixtures:** all seven acceptance categories below have HTTP/engine/browser evidence, including 25 passing browser journeys, security/recovery regression and the strict existing bundle ceilings. Production recovery and activation remain unperformed prerequisites.

The following local commits separate the implementation for review. This qualifies the supported local contracts; it does not claim that every requested commerce/refund provider exists or that production is ready.

| Commit | Milestone / principal paths |
| --- | --- |
| `1514e1e` | Registry/navigation: `shared/admin/areas.json`, `server/adminModules.js`, Admin client entry and Home |
| `0011af2` | Competition: `server/competitionConfig.js`, `seasons.js`, `events.js`, shared publication and `client/src/admin/CompetitionWorkshop.js` |
| `58d0440` | Commerce: `server/goldEconomy.js`, `deckCommerce.js`, `ledgerAccountProjection.js`, account/player projections and offer terms |
| `0d3fd05` | Support: account search/audited metadata, player profiles and integrated workspaces |
| `378319a` | Authoritative Home status, dates, refund projection recovery and responsive competition layout |
| `fc585fa` | Player Shop exposes finite Gold deck purchases; Timetwisters keep their actual identity |
| `c96ddea` | Per-module operational/history contracts, plain format labels and real collector-printing prize settlement |

## Control-to-consumer traceability

| Control group | Write destination | Actual consumer | Evidence / retention |
| --- | --- | --- | --- |
| Existing content fields, decks/printings/products | Shared revision-checked draft → immutable release | `resolveEngineContent`, production game factory, collection, deck offer/player store | PR72 `admin-deck-journey.test.js`, retained IDs and receipts |
| Para seasons/events/scoring/eligibility | Same release `paraLeague` | `paraRuntime` captures rules; qualification and canonical settlement | `para-integration`, `para-runtime`, browser Para journey |
| Future Ranked/Gauntlet seasons, dates, formats, scoring and prizes | Same release `competition` extension | `seasons` matchmaking identity and points; `events` entry/queue/run rewards | `competition-admin-journey`; canonical record captures event definition; terms lock after publication |
| Deck prices, sale windows, limits, exact recipe/printing/back | Same release `domains.offers` | `deckCommerce`; finite Gold `purchaseDeck` or account Timetwister transaction | `unified-store-journey`; original captured receipt and grant survive new prices, retirement and process restart |
| Gold awards, budgets, products/access | Same release `paraLeague` | `goldEconomy` quotes/claims/purchases; `digitalDelivery` | `gold-economy`, `gold-integration`, browser Gold journey |
| Player name and reason | Account revision-checked metadata route; private `operatorAudit` appended in same write | Sign-in name and account profile | Two-operator authorization, before/after evidence, CAS conflict and private-audit redaction tests; no wallet permission inferred |
| Publish/revert | Existing publication provider | Exact packaged deployed content; future matches | Exact-hash preview/test gates and compatible retained identities |
| Event operations / Gold corrections | Existing runtime audit transactions | Pinned event state / append-only financial evidence | Reason and original identity retained; disabled runtime never reports success |

The module registry provides the in-app machine-readable contract, including distinct publication/history rules for immediate financial or player-support operations. Existing `docs/admin-suite-capabilities.md` retains detailed PR72 field destinations. Historical implementation documents are evidence for their recorded commit, not current production status.

## Operator workflow

Use Home to identify required actions. Content owns game material. Competition owns season/event configuration and runtime monitoring. Store & Economy owns products, earning and financial operations. Players owns support lookup. Publishing owns every configuration release. Operations owns health, evidence and recovery.

Routine configuration follows **Draft → Validate → Preview/Test → Review → Publish → Verify Active**. Saved drafts do not affect players. Required engine tests bind the exact saved content. A pending deployment is not active. Publishing cannot enable a missing ledger or private storage. New paid or competitive activation requires separate authorization.

## Production activation and recovery checklist

- Separately authorize final reviewed release and any infrastructure/database work. No actions below have been performed here.
- After separate authorization, apply `20261013013808_account_stats_concurrency_guard.sql`, then `20261015032055_durable_match_and_private_authoring.sql` to the verified existing Gauntlet project; verify service-only capabilities and denied ordinary access. See the exact [migration order, flags and read-only verification](durable-storage-setup.md#case-rollout-order).
- Provision/verify the existing backend's private persistent volume, one ledger owner, canonical match archive and private authoring; follow [the storage setup guide](durable-storage-setup.md) without overwriting old files. Provisioning or a paid disk is not authorized by this local assignment.
- Quiesce writers and preserve compatible account, match, room and enabled ledger backups before cutover. Use WAL-safe SQLite backups; verify remote readback and [restore into a new directory](durable-storage-setup.md#backup-and-restore-commands). Retain the original stores and secrets; never copy only a live SQLite main file or reset the database.
- Verify restart/reconnect, pending settlement retries, receipts/grants, operator audit and private draft access in a controlled environment. Database and object disaster backups are separate from the runtime archive.
- Enable optional Para/Gold only after recovery qualification and separately approved configuration. Preserve the already selected opening-balance policy: import once, outside seasonal earning caps. Do not restart old Gold writers after cutover.
- Verify active release and player-facing consumers. Keep payment/Gem/dual-currency capabilities disabled until actual provider and transaction/fulfillment contracts are verified and separately authorized.

## Exact Case prerequisites

No further input is required for the completed local qualification. For a later production rollout, Case must separately authorize the reviewed merge/deployment and database/infrastructure operations, and make the actual Gauntlet Render service and its matching Supabase project available to the rollout operator. Verify the project through the backend's existing `SUPABASE_URL`; do not create a substitute project. The available Render browser identity previously exposed the different `para-poker-site` service; GitHub/Vercel connectivity is already established. No credentials should be pasted into chat.

Agree on a maintenance window and verified backup/restore point, then follow the ordered checklist above. Authorize optional Para/Gold activation only after the recovery checks pass. The opening-balance choice is already settled: import existing Gold once outside seasonal caps; no repeat decision is needed. Payments need separate provider/fulfillment verification and authorization. Timetwister refunds, unsupported equip providers and new engine mechanics require engineering, not a deployment toggle or additional account access.

## Test evidence and milestone updates

Local implementation milestones (2026-10-15; none deployed):

- Foundation: seven areas, shared module registry, actionable Home and guarded source projections. 29 focused server, 8 HTTP authorization and 5 navigation checks passed.
- Competition: additive release-managed Ranked seasons and free Gauntlet event templates. Generated identities, local-time scheduling, exact saved player presentation, locked published scoring/schedules/prizes, reasoned pause/cancel/retirement and captured canonical event terms. Original source competitions remain unchanged. The real socket journey creates/publishes a 7-point Ranked season and a one-win event, completes matches, settles standings and promised rewards once, rejects stale edits, and retains history after retirement/reopen. 11 publication/competition checks and 13 focused client checks passed.
- Store: finite-ledger Gold deck debit, immutable captured receipt and grant commit in one SQLite transaction. Account collection/deck data is a rebuildable projection, not a second fulfillment commit. Timetwisters retain the account transaction and revision guard. Optional sale windows and lifetime limits preserve older offer snapshots. The HTTP journey verifies duplicate requests, both currencies, stale revisions, future pricing, retirement, WAL-safe backup/reopen, audited refund and preservation of independent ownership. Seven integrated commerce checks passed.
- Players: account-wide search; balances, receipts, grants and support evidence; reasoned name corrections save their private audit in the same revision-guarded account transaction. Fourteen player/store/authorization checks passed; 22 focused client checks passed.
- Broad regression: 436 server tests and 746 client tests passed in `artifacts/modular-server-final.log` and `artifacts/modular-client-final.log`. A later refund-before-projection edge case has 30 passing Gold/store regression checks in `artifacts/modular-final-refunds.log`: recipe knowledge survives refund even before the account projection is saved, while paid printings and backs are revoked and the engine refuses the unowned printing. Script qualification: 50 passed. Later focused suites passed: 7 player-Shop/client checks, 4 shared-form checks and 3 registry/competition checks, including a real match awarding the exact promised collector printing. No count implies production activation.
- Final build: `artifacts/modular-build-final.log` passes existing ceilings without increasing them: main 168.4/180 KiB, player 717.0/753 KiB, initial Admin 17.1/20 KiB, aggregate lazy Admin 60.8/61 KiB, largest async 274.2/350 KiB gzip. Shared layouts and lazy workspaces preserve the entry budget.

Important boundaries: the supported deployment remains a single service writer. Gold ledger grants must be restored with their source account checkpoint; account fields alone are not a financial backup. A refund revokes that purchase's printing/back contribution; saved recipe knowledge remains. Pre-existing ownership and later Timetwister grants survive. New legacy runs remain closed after finite Gold cutover; existing runs settle before opening import. Configuring a future legacy event does not bypass this gate. Generic image/audio entitlements deliver library assets, not automatic in-game equipment; use deck products for implemented printing/back grants. Arbitrary cosmetic equip providers, Variant Lab, payments and premium pricing migration remain unsupported.

Browser qualification: all 23 tests in `playwright.admin.config.js` passed (`artifacts/modular-browser-final.log`), including desktop/mobile accessibility, both administrators, publication/rollback, engine playtests, real Para matches and Gold fulfillment/refunds. Both account-currency and finite-Gold deck-store projects passed (`artifacts/modular-deck-browser-final.log`), including restart and a fresh browser. After the last plain-language format-label change, the affected competition browser journey passed again (`artifacts/modular-final-label-browser.log`); the build and existing budget check were rerun successfully. Desktop/mobile Home and competition screenshots were inspected.

## Final local acceptance evidence

| Journey | Verified local evidence | Production boundary |
| --- | --- | --- |
| Season | `competition-admin-journey`: create/schedule/publish, real Ranked and Gauntlet matches, 7-point standings, Gold/pack/exact-printing prizes, once-only settlement and retained history. `modular-admin.spec` verifies calendar, player preview and locked terms. `para-runtime.spec` completes two real browser matches and verifies 12 Prestige plus evidence. | Production Para remains disabled; future managed definitions are local/unmerged. |
| Store | `unified-store-journey` verifies exact deck/printing/back delivery, retirement and fresh-process recovery. Both `admin-decks.spec` projects publish and buy the actual product, restart and inspect owned receipts in a fresh browser. `gold-economy.spec` earns 1,000 Gold, buys real analysis for 200, retains retired access, then refunds and revokes it with audit. | Production deck prerequisite migrations and finite-ledger activation are unapplied. |
| Price change | Same test rejects stale revision and preserves original 30-Gold receipt after a 40-Gold release. New sale-window test rejects unstarted/ended purchases before preparation. | No production purchase or price changed. |
| Concurrency | Duplicate simultaneous requests commit once; account file CAS, actual PostgreSQL guard tests, SQLite cap/refund/idempotency tests and finalization retry tests pass in the broad 436-test run and later targeted commerce checks. | Single service writer is a required topology; multi-host account/SQLite atomicity is not claimed. |
| Publication | Shared exact revision/hash, preview/playtest gating, real consumers, immutable release reopen, compatible rollback and incompatible pinned-term rejection pass. Browser tests publish actual field/card/deck/mechanics/competition changes and verify their destinations. | Hosted merge/deployment requires separate authorization; no live activation performed. |
| Security | Missing, ordinary, tampered and expired sessions denied; only two stable operator IDs; private authoring/asset/SQL tests pass. Browser access and mobile accessibility checks pass. Name audit remains hidden from public account projection. | Verify the actual production migrations, grants and private buckets during the separately authorized rollout. |
| Recovery | `runtime-backup` restores active games, draft picks and committed SQLite WAL data into a fresh process; hash/path/private-bucket checks pass. New store test rebuilds 3 purchased decks/printing copies and 30 Gold from durable records after retirement in a fresh server process. | Coordinated production account/objects/volume backup and restore drill remains an infrastructure prerequisite. |

Read the complete [operator workflow guide](modular-admin-operator-guide.md). Artifacts are local test output; they are not production audit evidence.

## Reproduce the isolated browser qualification

From the worktree root in PowerShell, choose unused ports, build for that fixture, then run both suites:

```powershell
$env:GAUNTLET_ADMIN_FIXTURE_PORT = "4157"
$env:GAUNTLET_ADMIN_PORT = "4157"
$env:GAUNTLET_ADMIN_CLIENT_PORT = "3157"
$env:REACT_APP_SOCKET_URL = "http://127.0.0.1:4157"
npm --prefix client run build
npm run check:bundle
$env:GAUNTLET_ADMIN_USE_BUILD = "true"
npx playwright test --config=playwright.purpose.config.js
npx playwright test --config=playwright.admin.config.js
```

The fixtures create isolated account, content and SQLite stores under `.playwright-data`; they do not use production credentials or mutate the public service. Stop on a failing command before proceeding. For the broad checks use the existing `npm run check` pipeline; test logs above retain the actual run counts, and later focused checks cover the final changes.
