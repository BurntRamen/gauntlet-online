# Admin Phase 2 — implementation and evidence

Updated 16 October 2026. Continues `codex/modular-admin-suite` from `cb6725c` in the isolated `para-gold-live` worktree. Case's original checkout is not an implementation target. This document supersedes the earlier unsupported-feature list only for rows explicitly verified below.

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
| Rule modifiers | Shared Studio CRUD, captured V1 rules, explicit encounter assignment, actual engine setup/refill | Contract, recovery, HTTP publication/revision/rollback, guided editor and full browser publication journey | Local scope only until full regression qualification | No | Campaign and isolated tests only; broader variants require explicit engine support |
| Additional encounters | Guided creation/duplication, independent opponents, configuration, ordering, archival and real campaign consumer | Contract, HTTP engine/publication/reward/rollback and full browser journey | Qualified local scope; deployment prerequisites remain | No | New AI behavior requires a qualified handler |
| New campaign factions | Permanent identity, Rumin family binding, independent role presentation, custom card pools and campaigns | Contract/engine/recovery, production HTTP campaign/publication/retirement, browser and player payment adapter | Qualified local campaign/test scope only | No | Other family combinations, competitive and limited qualification remain unavailable |
| Cosmetic equipment | Owned card backs, box covers, profile titles, faction banners and soundtrack selection/display; exact printing/deck product delivery retained | HTTP acquisition/selection, real match pinning, restart/retirement/refund/expiry; browser profile/deck/match | Qualified local destinations; persistent ledger/account storage required | New destinations not live | Newly uploaded cosmetic image delivery and arbitrary global faction/match music replacement are outside this contract |
| Timetwister refunds | Receipt-aware full deck-product reversal, exact grant revocation, preserved independent ownership, private append-only correction audit | Contract and HTTP concurrent/restart/retirement/cross-currency tests; atomic failure and disabled-Gold tests | Requires verified account CAS storage; no new currency issuance | No | Old gameplay-pack purchases without immutable receipts cannot be reversed automatically; account Gold remains separate from ledger refunds |
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

## Rule modifier workflow and traceability

Content → Engine / Rules → Rule modifiers uses the same shared draft and review workflow as mechanics. Create a definition, set player/opponent starting life and starting/refill hand size, then save. Select the definition to test the captured starting state in the real engine. In an encounter’s Opponent / Setup section, explicitly select the saved modifier and save that assignment. Test the exact final draft, preview, review and publish. Archival retains references and captured games, while excluding the definition from new selections.

The `studio.modifiers` catalog is authoritative. `ruleModifierContract` validates its bounded V1 definition. The compiler records a definition hash; production campaign creation captures the rule before the opening draw, and the ordinary engine turn transition consumes its hand-size configuration. Standard, Ranked, Para and FFA games cannot select these modifiers. Revisions and rollback affect future campaign matches; already-started games keep their original life and refill configuration.

Evidence: `rule-modifiers.test.js` rejects unknown fields, unsupported versions, invalid bounds, duplicate application and ineligible scopes without mutation; serialized match recovery produces the same next turn. `content-publication-routes.test.js` creates, assigns, tests and publishes through authorized HTTP routes, then creates actual campaign matches, verifies refill, revises, and rolls back without changing a prior match. The Studio test verifies invalid-save prevention and independent engine buttons.

## Rule-modifier milestone qualification

- Two focused contract/recovery tests passed. The HTTP campaign creation/revision/rollback/refill journey passed. Thirteen focused Studio/Engine/Encounter UI tests passed.
- Both guided browser journeys passed (`artifacts/phase2-modifier-browser.log`): reusable mechanic → new card → actual engine → publication, and modifier → encounter assignment → actual engine → publication. The second journey verifies the assignment in the public compiled encounter.
- Client regression: 751 of 752 passed initially; the sole failure was a fixture missing the shared help provider. The corrected two-case Card Workshop suite passed (`phase2-modifier-client-repair.log`). Server regression completed: **450 passed** (`phase2-modifier-server.log`).
- Production build/lint and unchanged bundle gates passed: Admin **62,348 / 62,464 bytes**, player **740,603 / 771,072 bytes**, main 168.4/180 KiB, entry 17.3/20 KiB, largest async 274.2/350 KiB. Creation forms and engine category navigation are consolidated; labels/help come from the private authoritative field/guide projection.
- Screenshot: `artifacts/phase2-rule-modifier.png`. No code was deployed, pushed, merged, or published to production.

## Additional encounter workflow and traceability

Content → Encounters → Create encounter starts from a supported campaign setup. Give it a name and select its campaign. The new encounter owns its opponent identity; edit the opponent name through the linked Characters record. Configure narrative, artwork, real setup and any starting-state modifier, then test the exact saved draft in the actual engine. Preview, review and publish through the existing release workflow. Players find the new chapter after the original chapters, with normal progression unlocking it. Source chapter order, identities, rewards and existing results remain intact.

Additional encounter order is unique within its campaign. Archiving closes future starts and removes discovery while retaining identities, ongoing matches and earned progress. Restore by publishing an active revision or a compatible rollback. A rollback that would erase a published encounter or opponent is rejected. Duplicate creates independent permanent encounter/opponent identities, not aliases to the original.

| Control | Authority and actual consumer | Verification |
| --- | --- | --- |
| Create / duplicate / name / campaign | Existing authored snapshot; strict additional-encounter V1 contract; compiler emits actual campaign chapters | Catalog and HTTP creation tests |
| Story / opponent / scene / setup | Shared field contracts, immutable assets and registered boss handlers | Real engine test and browser player campaign/match |
| Order / archive | Published chapter list drives unlock, next mission, completion display and new starts | Existing source chapter preservation, first-clear reward idempotency, archival and rollback |
| Difficulty and recipe preview | Shared encounter presentation reads the same setup, modifier and recipe as the engine | All source setups plus modifier/recipe tests; browser changes life to 23 and attacks to 1, verifies preview and actual 23-life opponent |
| Test → review → publish | Exact saved-draft engine receipt and shared publication gate | Three browser journeys: mechanics/card, modifier assignment, additional encounter |

Evidence: three contract tests, the HTTP creation → engine → publication → unlock → first-clear → archive → compatible rollback journey, fifteen focused catalog/module regressions, and three campaign relationship/profile regressions passed. Browser journeys passed together (59.7 seconds); inspected screenshots: `artifacts/phase2-published-encounter.png` and `artifacts/phase2-encounter-real-match.png`. Production build/lint and unchanged bundle gates passed: main 171.6/180 KiB, player 723.2/753 KiB, Admin entry 17.3/20 KiB, aggregate Admin 61/61 KiB, largest async 274.2/350 KiB. Full regression: **454 server tests** passed (203.3 seconds) and **755 client tests** passed (103 suites). Evidence: `artifacts/phase2-encounter-server.log` and `artifacts/phase2-encounter-client.log`.

The creation contract reuses the qualified campaign attack scheduler and bounded registered boss abilities. Arbitrary AI scripts, new routing graphs and unqualified opponent recipes remain unavailable. This milestone does not establish new faction creation or any production deployment.

## Authored faction workflow and traceability

Content → Factions → Create faction creates an independent identity using the qualified Rumin rules family, three linked static-role records, and a campaign with its first playable encounter. Configure the fourth-attack bonus through bounded controls; edit role names and artwork through related Characters. Faction artwork is captured into ordinary card faces in the actual renderer. Original faction identities, role definitions and campaigns are untouched. New factions do not inherit another faction's spoken lore.

Create an authored mechanic and card, choose the new faction, and add that card to its encounter's player additions. These cards support library display and encounter use; creation does not grant ownership. Their competitive, earned-pack, Draft and Sealed channels remain unavailable until those modes are qualified. The selected Rumin family supplies the current commander, general and city behaviors; other executable families or new static-role behavior require explicit qualification, not unverified editor input.

Test the faction or its encounter in the real engine, preview and publish. Players discover its campaign through Journey. Campaign first-clear progress and normal reward idempotency are preserved. Archive the faction to remove campaign discovery and close new starts. Captured games, role identities, artwork and earned progress remain intact; compatible rollback reopens the prior campaign. Ordinary duels, competitive faction selection and FFA reject this campaign-only identity.

| Control | Authority and consumer | Evidence |
| --- | --- | --- |
| Create / duplicate / archive faction | Shared authored snapshot, strict `admin-faction-v1` identity and retained campaign/role records | `admin-factions.test.js`, HTTP publication/retirement journey |
| Rules family / bounded parameter | Captured `gauntlet.faction-families.v1` binding; existing authoritative faction dispatch and payment engine | Fourth-attack bonus before/after revision, serialized recovery, invalid version rejection |
| Commander / general / city presentation | Independent immutable role IDs; compiled faction payload and actual board cards | Browser shows renamed Glass Marshal in the production Babylon match |
| Faction artwork | Pinned ordinary-card composed presentation | Contract assertion and production-renderer browser screenshot |
| Authored card association | Existing set/card/mechanic identity and encounter addition contract | Strict card/pool validation and compiled campaign definitions |
| Third-attack free payment choice | Same qualified family binding in engine and player controls | Production adapter test executes the explicit free attack without silent payment |
| Mode scope | Campaign creation/selection; ordinary/FFA guards before state mutation | HTTP rejection and competitive picker tests |

Focused qualification: 18 server contract/regression cases, including all 2,800 captured pre-conversion engine outcomes; the new HTTP faction → real campaign → publication → archive → rollback journey; 50 client creation/picker/payment-adapter cases. The new guided browser journey passed in 19.7 seconds. Full client regression: **758 passed**, 103 suites. Full server regression: 456/457 initially passed; the failure exposed metadata compilation of an invalid draft faction parameter. The repair preserves invalid draft values for correction without compiling them into gameplay, and all six focused faction/workshop/module tests passed (`artifacts/phase2-faction-repair.log`). All four browser journeys then passed together; screenshots `phase2-faction-campaign.png` and `phase2-faction-real-match.png` were inspected, including the captured faction art on real cards. Final build/lint and unchanged bundle gates passed: main 171.7/180 KiB, player 723.4/753 KiB, Admin entry 17.4/20 KiB, aggregate Admin 61/61 KiB, largest async 274.2/350 KiB. Shared help remains in the private authoritative guide; no code was excluded from budget accounting. No production activation is implied.

## Timetwister receipt reversal milestone

Store & Economy → Economy operations now includes account Timetwister balances, immutable deck purchases, refund state and a guided purchase selector. Choose a purchase and supply a reason (8–1000 characters), confirm, then inspect the refund and Player support history. This is an immediate audited account operation, not a content publication. It remains available when the Gold runtime is disabled.

| Control | Authority / consumer | Compatibility policy |
| --- | --- | --- |
| Refund selected Timetwister purchase | `accountCommerce.prepareRefund` plus the purchase path's account lock and file/Supabase revision guard | Credit original captured price, debit exact captured printing contribution and append refund/actor evidence in one account commit |
| Repeated request / changed terms | Immutable request fingerprint inside account refund evidence | Exact retries return original result; a new key cannot refund the same purchase twice |
| Card-back reversal | Captured independent ownership, other active account purchases, earned achievements and Gold projection | Remove only this account purchase contribution; retain independently owned and ambiguous historical backs |
| Support and purchase monitoring | Existing guarded economy views and private player projection | Operator reasons and internal audit are excluded from public account/profile responses |

Saved deck versions and recipe knowledge remain intact. Future use of a revoked paid printing requires ownership. Lifetime purchase counts do not reset after refund; gross spent totals remain historical and refund totals are shown separately. The finite Gold ledger is never adjusted by this account operation. Historical account Gold and gameplay-pack purchases without qualified reversal evidence remain explicitly outside this operation.

Evidence: `account-commerce.test.js`, `unified-store-journey.test.js`, `admin-deck-journey.test.js`, `account-store-concurrency.test.js`; retained output in `artifacts/phase2-timetwister-server.log`. Cases cover duplicate concurrent requests, failed account commits and safe retry, product retirement/changed price, immutable receipts, restart, cross-currency ownership, independent/earned/legacy ownership, exact-safe-integer checks, unprivileged denial and operation without Gold storage. No client bundle code was added for this milestone: the existing shared operation-form renderer consumes authoritative server fields.

## Owned equipment milestone

Author in Store & Economy → Gold & Rewards → Entitlements. Select `card-back`, `deck-box`, `faction-banner`, `profile-music`, `faction-soundtrack` or `profile-title`; choose an existing immutable asset and record rights evidence. Titles use the “Profile title” service asset and the entitlement's name as their text. Configure permanent/timed/season access, mark delivery available, include it in a dated Gold/free product, then validate, preview and publish through the same release authority. Existing exact printing authoring/products remain the route for playable card treatments. A raw collector artwork download does not equip a printing; catalog preview now states this distinction.

The player acquires the product in Identity → Gold & Library, then selects each owned item by destination. “Use default” removes the selection. An equipped title/back takes precedence over progression defaults; the profile explains where to reset it. Audio has an explicit Play control and never autoplays. Faction banners decorate that player's profile; they do not change global faction art or mechanics. Box covers apply to the owner's Deck Library and public featured decks. Match card backs decorate the viewer's table, using their server-captured match profile.

| Control | Authoritative consumer | Preservation / rejection |
| --- | --- | --- |
| Entitlement category, asset, duration and rights | Immutable `digitalDelivery` terms inside the ledger purchase | Verified content hashes, supported media, scoped delivery identity; shared art may serve independent equipment destinations |
| Select owned appearance | `cosmeticEquipment` validates an active owned grant; atomic account CAS stores only selection | Foreign/revoked/expired grants and wrong destination are rejected; no gameplay grants or currency writes |
| Player/public profile | Server projects active selection into title/banner/back/music presentation | Private grant IDs and selection records are excluded from public responses |
| Deck cover | Same server projection → `DeckShowcase` → `DeckBox` | Card composition and exact printing selections are unchanged |
| New match presentation | Ownership revalidated at game creation → captured player profile → production Babylon card-back texture | A stale lobby cannot equip revoked content; already-started games remain unchanged |
| Expiry, refund and retirement | Server grant state drives all future projections | Expiry/refund use defaults; product retirement retains ownership and selection; historical receipts remain immutable |

Evidence: `cosmetic-equipment.test.js` uses real Admin publication and purchase endpoints, account persistence, ledger state, match factory and a new process restart. It covers all five slots, foreign access denial, retired products, refunds, stale lobby validation and the exact expiry boundary. `admin-cosmetics.spec.js` authors all five entitlements and a product through Admin, acquires and equips through player controls, visually displays profile/deck/match destinations and checks the accessible equipment console. Screenshots `artifacts/phase2-cosmetics-{profile,deck,match}.png` and logs `phase2-cosmetics-{server,integration,client,browser}.log` retain local evidence. New profile and deck rendering tests use the actual components. No production service has been activated.

Qualification at this milestone: **463/463 server tests**, **760/760 client tests** (103 suites), and **5/5 combined browser journeys** pass. A final legacy-card-back fallback repair then passed all eight targeted profile/cosmetic/unified-store cases. The combined browser rerun uses a scoped Journey selector because a saved deck can add a second Continue Campaign action; this was test ambiguity, not a skipped user journey. Desktop profile, Deck Library, production match and 390-pixel mobile screenshots were inspected. Build/lint and unchanged budgets pass: main 172.0/180 KiB, player 723.8/753 KiB, Admin entry 17.4/20 KiB, aggregate Admin 61/61 KiB, largest async 274.2/350 KiB. Full logs: `phase2-commerce-full-{server,client}.log`, `phase2-cosmetics-browser-all.log`, `phase2-cosmetics-ownership.log`, `phase2-cosmetics-budget.log`.

Final screenshot review caught a narrow-screen audio control being clipped and a Deck Library screenshot captured during a panel transition. The control is now bounded to its container, and the browser journey verifies real audio playback and control bounds before taking focused, animation-stable screenshots. Rebuild, bundle gates and the full cosmetic browser journey pass (`phase2-cosmetics-visual-repair.log`).
