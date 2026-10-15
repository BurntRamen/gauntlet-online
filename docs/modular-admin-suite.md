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

## Dependency plan and milestones

1. **Reconcile:** preserve branches, inspect runtime/contracts and production read-only evidence; establish this matrix and traceability. Done; integration regression pending.
2. **Shared foundation:** module registry with truthful capability/source/consumer contracts, seven areas, shared states and actionable Home. Test authorization and navigation before further dependencies.
3. **Competition:** release-managed future Ranked/legacy configuration, captured historical rules, templates/calendar, Para authoring/operations under one area. Test real result settlement and promises across publication.
4. **Store:** consolidate supported products/terms, safe prices/windows/limits and previews; one currency authority and durable idempotent delivery. Prove restart, retirement, price changes, duplicate requests, conflicts, retries and compensation.
5. **Content/Players:** preserve PR72 destinations, expose unsupported authoring, unify support evidence and narrow audited corrections.
6. **Publishing/Operations:** consistent workflow, active-versus-pending verification, guided failure/recovery actions and audit evidence.
7. **Qualification:** required HTTP/engine/browser journeys; server/client/security/recovery regression; strict build and existing bundle ceilings. Record exact outcomes rather than inheriting old check claims.

Each milestone will record changed paths, tests and limitations below. A partial milestone is not completion of the assignment.

## Control-to-consumer traceability

| Control group | Write destination | Actual consumer | Evidence / retention |
| --- | --- | --- | --- |
| Existing content fields, decks/printings/products | Shared revision-checked draft → immutable release | `resolveEngineContent`, production game factory, collection, deck offer/player store | PR72 `admin-deck-journey.test.js`, retained IDs and receipts |
| Para seasons/events/scoring/eligibility | Same release `paraLeague` | `paraRuntime` captures rules; qualification and canonical settlement | `para-integration`, `para-runtime`, browser Para journey |
| Gold awards, budgets, products/access | Same release `paraLeague` | `goldEconomy` quotes/claims/purchases; `digitalDelivery` | `gold-economy`, `gold-integration`, browser Gold journey |
| Player name | Account revision-checked metadata route | Account profile | Existing authorization and metadata tests; no wallet permission inferred |
| Publish/revert | Existing publication provider | Exact packaged deployed content; future matches | Exact-hash preview/test gates and compatible retained identities |
| Event operations / Gold corrections | Existing runtime audit transactions | Pinned event state / append-only financial evidence | Reason and original identity retained; disabled runtime never reports success |

The module registry will provide the in-app machine-readable contract. Existing `docs/admin-suite-capabilities.md` retains detailed PR72 field destinations. Historical implementation documents are evidence for their recorded commit, not current production status.

## Operator workflow

Use Home to identify required actions. Content owns game material. Competition owns season/event configuration and runtime monitoring. Store & Economy owns products, earning and financial operations. Players owns support lookup. Publishing owns every configuration release. Operations owns health, evidence and recovery.

Routine configuration follows **Draft → Validate → Preview/Test → Review → Publish → Verify Active**. Saved drafts do not affect players. Required engine tests bind the exact saved content. A pending deployment is not active. Publishing cannot enable a missing ledger or private storage. New paid or competitive activation requires separate authorization.

## Production activation and recovery checklist

- Separately authorize final reviewed release and any infrastructure/database work. No actions below have been performed here.
- Apply PR72 account concurrency guard, then PR77 durable-match/private-authoring SQL to the verified existing Gauntlet project; verify service-only capabilities and denied ordinary access.
- Provision/verify the existing backend's private persistent volume, one ledger owner, canonical match archive and private authoring; follow `durable-storage-setup.md` without overwriting old files.
- Quiesce writers and preserve compatible account, match, room and enabled ledger backups before cutover. Use WAL-safe SQLite backups; verify remote readback and restore into a new directory.
- Verify restart/reconnect, pending settlement retries, receipts/grants, operator audit and private draft access in a controlled environment. Database and object disaster backups are separate from the runtime archive.
- Enable optional Para/Gold only after recovery qualification and separately approved configuration. Preserve the already selected opening-balance policy: import once, outside seasonal earning caps. Do not restart old Gold writers after cutover.
- Verify active release and player-facing consumers. Keep payment/Gem/dual-currency capabilities disabled until actual provider and transaction/fulfillment contracts are verified and separately authorized.

## Exact Case prerequisites

Access to the actual Gauntlet Render/Supabase resources is needed only for the later production work above. Existing available Render browser identity exposed the different `para-poker-site` service. GitHub/Vercel deployment connectivity is already established. No credentials should be pasted into chat. Current assignment continues locally without this access; no new confirmation is needed for local implementation.

## Test evidence and milestone updates

Local implementation milestones (2026-10-15; none deployed):

- Foundation: seven areas, shared module registry, actionable Home and guarded source projections. 29 focused server, 8 HTTP authorization and 5 navigation checks passed.
- Competition: additive release-managed Ranked seasons and free Gauntlet event templates. Generated identities, local-time scheduling, exact saved player presentation, locked published scoring/schedules/prizes, reasoned pause/cancel/retirement and captured canonical event terms. Original source competitions remain unchanged. The real socket journey creates/publishes a 7-point Ranked season and a one-win event, completes matches, settles standings and promised rewards once, rejects stale edits, and retains history after retirement/reopen. 11 publication/competition checks and 13 focused client checks passed.
- Store: finite-ledger Gold deck debit, immutable captured receipt and grant commit in one SQLite transaction. Account collection/deck data is a rebuildable projection, not a second fulfillment commit. Timetwisters retain the account transaction and revision guard. Optional sale windows and lifetime limits preserve older offer snapshots. The HTTP journey verifies duplicate requests, both currencies, stale revisions, future pricing, retirement, WAL-safe backup/reopen, audited refund and preservation of independent ownership. Seven integrated commerce checks passed.
- Players: account-wide search; balances, receipts, grants and support evidence; reasoned name corrections save their private audit in the same revision-guarded account transaction. Fourteen player/store/authorization checks passed; 22 focused client checks passed.
- Broad regression: 433 server tests and 746 client tests passed in `artifacts/modular-server-full.log` and `artifacts/modular-client-full.log`. Subsequent presentation changes have focused checks; final browser and bundle qualification is still in progress. Do not interpret these counts as production activation or complete acceptance.

Important boundaries: the supported deployment remains a single service writer. Gold ledger grants must be restored with their source account checkpoint; account fields alone are not a financial backup. A refund revokes that purchase's printing/back contribution; saved recipe knowledge remains. Pre-existing ownership and later Timetwister grants survive. New legacy runs remain closed after finite Gold cutover; existing runs settle before opening import. Configuring a future legacy event does not bypass this gate. Generic image/audio entitlements deliver library assets, not automatic in-game equipment; use deck products for implemented printing/back grants. Arbitrary cosmetic equip providers, Variant Lab, payments and premium pricing migration remain unsupported.

The seven requested journeys remain acceptance obligations until final evidence is recorded below.
