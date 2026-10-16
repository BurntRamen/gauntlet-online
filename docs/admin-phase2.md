# Admin Phase 2 — implementation and evidence

Updated 16 October 2026. Continues `codex/modular-admin-suite` from `cb6725c` in the isolated `para-gold-live` worktree. Case's original checkout is not an implementation target. This document supersedes the earlier unsupported-feature list only for rows explicitly verified below.

Release update: the user subsequently authorized completing the interface/functionality and publishing the code live. The local qualification below remains the historical implementation record; current deployment and activation status is tracked in [the October 16 release record](admin-suite-live-release.md). Payments remain disconnected. Code deployment does not by itself authorize database migrations, paid infrastructure, balance cutover or competition/content activation.

## Authority and reconciliation

The user authorized local implementation and isolated tests, not deployment, merging, production publication, production data migration, payment activation or paid provisioning. The payment decision is **provider adapter only**. No concrete provider or live merchant integration is implied. Opening Gold remains the previously agreed import of existing value outside seasonal earning caps.

Read-only remote reconciliation: main `aa00d80`; PR72 open at `53c2060`; PR77 open at `0620b2e`; unrelated remote work retained. The existing seven-area console, release system, private authoring, finite Gold/deck transaction integration and storage recovery remain the foundation. Local implementation is not evidence of production availability. Production observations are recorded in `modular-admin-suite.md`.

## Capability matrix

Status columns are independent: a local test does not establish production readiness or activation.

| Capability | Implemented | Verified locally | Production-ready | Live | Remaining work / blocker |
| --- | --- | --- | --- | --- | --- |
| Reusable declarative mechanics | Engine interpreter, strict V1 schema, shared catalog, guided CRUD, card attachment, release diffs and captured versions | Full regression and browser creation → engine → publication, mobile accessibility | Two-player interpreter qualified locally; deployment/storage prerequisites remain | No | FFA interpreter is explicitly unavailable |
| New card identities | Existing Card Workshop plus reusable mechanics, unique IDs and explicit acquisition channels | Catalog, browser authoring/rendering and authenticated pack → saved deck → ordinary socket match → finalized evidence | Qualified local scope; deployment prerequisites remain | No | Future production activation |
| Mechanic structural revision | Same release authority; definition hash and interpreter pinned into every game | Real attack before/after revision, captured match unchanged, restart and compatible rollback | Qualified local release behavior | No | Future production activation |
| Rule modifiers | Shared Studio CRUD, captured V1 rules, explicit encounter assignment, actual engine setup/refill | Contract, recovery, HTTP publication/revision/rollback, guided editor and full browser publication journey | Qualified local campaign/test scope | No | Campaign and isolated tests only; broader variants require explicit engine support |
| Additional encounters | Guided creation/duplication, independent opponents, configuration, ordering, archival and real campaign consumer | Contract, HTTP engine/publication/reward/rollback and full browser journey | Qualified local scope; deployment prerequisites remain | No | New AI behavior requires a qualified handler |
| New campaign factions | Permanent identity, Rumin family binding, independent role presentation, custom card pools and campaigns | Contract/engine/recovery, production HTTP campaign/publication/retirement, browser and player payment adapter | Qualified local campaign/test scope only | No | Other family combinations, competitive and limited qualification remain unavailable |
| Cosmetic equipment | Owned card backs, box covers, profile titles, faction banners and soundtrack selection/display; exact printing/deck product delivery retained | HTTP acquisition/selection, real match pinning, restart/retirement/refund/expiry; browser profile/deck/match | Qualified local destinations; persistent ledger/account storage required | New destinations not live | Newly uploaded cosmetic image delivery and arbitrary global faction/match music replacement are outside this contract |
| Timetwister refunds | Receipt-aware full deck-product reversal, exact grant revocation, preserved independent ownership, private append-only correction audit | Contract and HTTP concurrent/restart/retirement/cross-currency tests; atomic failure and disabled-Gold tests | Requires verified account CAS storage; no new currency issuance | No | Old gameplay-pack purchases without immutable receipts cannot be reversed automatically; account Gold remains separate from ledger refunds |
| Gold deck purchases | One finite-ledger authority after cutover; captured delivery/projection/refunds | Prior phase concurrency/restart/browser journeys | Infrastructure prerequisites apply | Disabled | Persistent ledger and separate production authorization |
| Gems / multi-price | Distinct append-only Gem ledger; Gold-or-Gem alternatives; fixed Gold/Gem split payments; Gem deck products and exact-currency refunds | Atomic failures/retries, multiprocess contention, retirement/restart/backup, HTTP deck grants and guided browser purchase/refund | Requires separate Gem activation, schema-4 backup and a qualified real funding provider | No; disabled by default | Signed adapter funding is locally tested; real provider remains disconnected; no Timetwister cross-store split or conversion |
| Payments | Provider-neutral checkout, signed-event inbox, atomic fulfillment, refund/dispute compensation, guided recovery and shared cash catalog | 13 signed adapter/recovery/security/multiprocess tests; actual HTTP authoring/disabled-provider checks | Adapter contract qualified; real provider and merchant integration not production-ready | No; disconnected | Provider/merchant/tax/jurisdiction qualification and separate authorization deliberately deferred |

## Dependency milestones

1. Reconcile and preserve the current implementation — done.
2. Mechanics/card creation, authoritative engine and publication integration — locally implemented and verified, including acquisition and ordinary authenticated multiplayer.
3. Explicit rule modifiers and eligible consumer selection — locally implemented and verified.
4. Faction/encounter creation and cosmetic destinations — locally implemented and verified within the stated contracts.
5. Timetwister, Gems and multi-price transaction completeness — locally implemented and verified.
6. Provider adapter with deterministic contract tests — locally implemented and verified; no provider selected or live activation.
7. Full operator journeys A–J, restart/recovery, authorization, usability and unchanged performance gates — qualification results below; external provider and production activation remain separate.

## Mechanics control-to-consumer traceability

| Operator control | Authoritative storage | Consumer / constraints | Evidence |
| --- | --- | --- | --- |
| Create / duplicate / archive mechanic | Optional `studio` catalog inside the existing immutable release snapshot | Stable UUID retained after publication; archival prevents new assignments, captured games remain valid | `authored-mechanics-publication.test.js` |
| Trigger / conditions / ordered effects | `mechanicContract` V1; no executable input | `mechanicRuntime` called by production priority, placement, combat, payment and turn paths | `authored-mechanics-engine.test.js` |
| Activation payment / target / limits | Captured ability and game state | Recomputed legal actions, normal hand payment, private command clone, fixed authoritative target | Engine tests and `matchAdapters.test.js` |
| Acceleration | Captured primitive | Existing `gainAcceleration`, including existing faction interactions | Dedicated turn-start/counter/consumption and Bizi interaction test in authored-mechanics-engine.test.js |
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

## Distinct Gems and price options milestone

The same SQLite transaction now owns Gold, distinct Gem entries, purchases, grants and refunds. Schema v3 adds append-only Gem transaction evidence without rewriting opening Gold or converting Timetwisters. Gems are disabled by default (`GAUNTLET_GEMS_ENABLED` must be explicitly enabled on a qualified runtime). Publishing a Gem price alone cannot enable spending. No public Gem issuance endpoint exists in this milestone; these initial currency tests seed existing funding evidence. The subsequent payment milestone qualifies signed adapter funding without connecting a real provider.

In Marketplace, choose **Gold**, **Gems**, **Gold or Gems**, **Gold and Gems**, or **Free**. The alternative option creates an explicit choice; the combined option captures fixed quantities of both currencies. Quotes retain the exact selected amounts, release and delivery terms. Both debits and all grants commit together, with no cross-store transaction claim. Deck products expose independent Gold, Timetwister and Gem alternatives; their Gem debit and printing/back/recipe grants use the same finite ledger. Timetwisters retain their account authority and never participate in split payments.

| Operator/player control | Authority and consumer | Evidence / limits |
| --- | --- | --- |
| Currency price choice | `currencyPricing` + published product definition → captured quote | Exact whole amounts, explicit alternatives, disabled-currency rejection; no conversion |
| Combined Gold/Gem confirmation | One SQLite write transaction → both currency entries, purchase and entitlements | Failed delivery rolls everything back; same-key retry succeeds once |
| Gem deck product | Existing deck preparation + ledger purchase → account grant projection | HTTP concurrent request, exact paid printing, preserved account Gold/Timetwisters, receipt-aware refund |
| Financial support | Shared economy views → original payment, distinct Gem history and exact-currency refunds | Refund restores captured amounts, including after new Gem spending is disabled; gross history is unchanged |
| Wallet display | Server ledger projection → distinct Gold, Timetwister and Gem labels | Successful library purchase/claim refreshes the parent account display; no client-calculated credit |
| Backup / restart | Existing WAL-aware backup, updated supported schema and immutable DB triggers | Prior Gold schema upgrade, Gem receipts/grants and balances survive restart and restore |

Qualification: **39 targeted ledger/configuration/integration tests**, **5 unified deck/module cases**, **16 client cases** and the guided Gem browser journey pass. A separate-process contention test proves two split purchases cannot overspend either component. Historical price changes, stale quotes, retirement, refund replay, failure rollback, independent Timetwisters and immutable Gem SQL guards are exercised. Logs: `phase2-gems-{server,decks,client,browser,build,budget}.log`; screenshots `phase2-gems-{player,refund}.png`. Build/lint and all fixed budgets pass (aggregate Admin 62,457 / 62,464 bytes; no budget exclusions or increases). No production migration, configuration activation, publication or deployment occurred.

## Payment adapter milestone

The shared catalog now supports explicit tax-inclusive cash prices and distinct Gem-credit products. The private ledger schema is version 4. `paymentLedger` captures immutable terms and a verified inbox, fulfills direct digital grants or Gem funding atomically, and appends refund/dispute compensation. `paymentService` supplies the provider contract, signature-verifier boundary, HTTPS checkout constraints, authenticated order isolation and guided operator recovery. Startup deliberately supplies no provider. No client redirect can mint currency or access.

The [payment operator/adapter/recovery guide](payment-adapter-contract.md) contains the complete workflow, control-to-consumer matrix, ordering and debt policy, restore rehearsal, unsupported transaction types and future activation prerequisites. Payment state and delivery state are separate: a verified successful payment may remain pending recovery after an asset/storage failure. Admin can retry captured fulfillment or request a full provider refund; acknowledgement does not claim the refund is complete.

`server/test/payment-adapter.test.js` passes 13 cases: default-disabled and live gates; jurisdiction/tax boundaries; pinned prices after retirement; raw HMAC verification and replay freshness; duplicates and changed event facts; early webhooks; wrong checkout binding; atomic grant and compensation failures; restart/backup; out-of-order disputes/refunds; Gem debt; stable refund-request retry; independent-process replay contention; private HTTP orders and absence of a client-success credit route. These are contract-fixture tests, not evidence of a concrete payment provider sandbox. `unified-store-journey.test.js` also publishes a cash product through real Admin HTTP and proves both administrator access and ordinary-account denial while checkout remains disabled.

## Completed acquisition and ordinary-match journey

`server/test/authored-card-network.test.js` creates the mechanic, set, permanent card and artwork/acquisition configuration through authenticated Admin HTTP, executes the real private engine test and publishes. A separate player spends an existing earned pack credit through `/api/collection/open-pack`, acquires the new gameplay identity and exact printing, saves an eligible deck through the normal collection endpoint, and joins a second authenticated player through ordinary room sockets. The production game factory draws the acquired card, its semantic network command applies the authored attack bonus and life gain once, and concession finalizes release-pinned match evidence. Retry does not repeat the effect. The test fixes only randomness; it never replaces the network-created game state or inserts card ownership. Browser authoring/engine/printing rendering provides the corresponding visual check.

## Acceptance journeys A–J

| Journey | Local evidence | Scope and result |
| --- | --- | --- |
| A — new card | `authored-card-network.test.js`, `admin-catalog-lifecycle.test.js`, `admin-mechanics.spec.js` | Real Admin authoring, engine gate, publication, actual earned-pack acquisition, saved owned deck, authenticated ordinary match, exact artwork/printing reference, command and finalized evidence. Guided browser creation and rendering also pass. |
| B — new mechanic | `authored-mechanics-engine.test.js`, network journey, mechanic browser | Ordered attack/life effects, payment/priority, target validation and invalid-action atomicity execute in the authoritative engine. |
| C — revision | `authored-mechanics-publication.test.js` | New structural definition applies to future games; captured game behavior, serialized state and historical release survive revision, restart and compatible rollback. |
| D — non-Servitors | `authored-mechanics-engine.test.js`, `matchAdapters.test.js` | Normal placement/cantrip timing once, attack/block rejection, paid activations, explicit payment choices and authoritative targeting. |
| E — faction/encounter | Faction and encounter contract/integration tests plus both browser journeys | Real published campaigns and engine matches, source identity preservation, ordering, retirement and captured rules. New faction family is currently Rumin, campaign/test only. |
| F — cosmetics | `cosmetic-equipment.test.js`, `admin-cosmetics.spec.js`, existing printing/deck suites | Acquisition, ownership, selection, actual profile/deck/match rendering, audio playback, persistence, expiry, independent ownership and refund fallback. |
| G — economy | Gold, Gem, account-commerce and unified-store suites; Gold and Gem browsers | Original currency authority, opening balances, alternative/split terms, exact printing grants, original-price refunds, multiprocess contention, failed commit and retry. |
| H — payments | `payment-adapter.test.js`, cash Admin HTTP/browser | Signed deterministic adapter, duplicates, early/out-of-order events, failures, refund/dispute compensation, Gem debt and recovery pass. **Concrete provider sandbox remains blocked by the deliberate adapter-only scope.** |
| I — publication | Catalog/workshop/content lifecycle, mechanic/encounter/faction/modifier suites and browsers | One draft/release authority, exact preview and mechanical test gate, real consumers, conflict rejection, retained historical references and compatible rollback. |
| J — security/recovery | Full server suite including account concurrency, runtime storage, durable SQL, room state, private printing/asset and admin-authorization cases | Existing exact two-account guard, ordinary-account denial, private drafts/assets/orders, append-only records, process restart/restore, captured active-match state and existing engine regression. No production-storage qualification is claimed. |

## Current qualification evidence

- Full server run: **484 passed**, zero failures (`artifacts/phase2-final-server.log`, 235 seconds).
- Full client run: **762 passed in 105 suites**, zero failures (`artifacts/phase2-final-client.log`).
- Six Phase 2 browsers passed together (`artifacts/phase2-final-browser.log`): mechanics, modifiers, new encounters, new factions, cosmetic equipment, and disconnected payment authoring/readiness. The Gem alternative/split/refund browser also passed (`artifacts/phase2-final-gems-browser.log`).
- Payment review fixes were followed by all 13 payment contract tests. Shared economy usability now omits empty search sections and inapplicable refund forms, shows matching row counts, keeps routine storefront/readiness/balance summaries open, and collapses detailed financial evidence. The confirmation describes an audited operation accurately, including a provider refund request that has not yet settled.
- After the final payment/UI refinements, **49 affected server cases** passed (`artifacts/phase2-final-commerce-recheck.log`), the shared-console tests passed, and all four affected browser journeys passed again: cosmetics, payment readiness, Gem alternative/split/refund and Gold earned-purchase/retirement/refund (`phase2-final-visual-recheck.log`, `phase2-final-gems-recheck.log`, `phase2-final-gold-recheck.log`). Payment readiness and disabled-player-store screenshots were visually inspected after the empty-table repair.
- Final build/lint and unchanged budget gates pass (`artifacts/phase2-final-build.log`, `phase2-final-budget.log`): main 172.1/180 KiB, player JS 723.9/753 KiB, Admin entry 17.4/20 KiB, all lazy Admin **62,417/62,464 bytes**, largest async 274.2/350 KiB. No budget or attribution exclusion was introduced.

The earlier milestone counts are historical evidence, not additional tests to add to these totals. Final targeted rechecks and screenshots are recorded alongside their logs; generated artifacts remain local and ignored by Git.

## Remaining boundaries and Case's next steps

No input or credentials are needed for the completed local adapter scope. No Phase 2 changes are live, and no branch has been pushed or merged. Case's original working tree and separate paid-support worktree were not edited.

Before a later release, review this branch, authorize deployment/migration/publication separately, verify persistent authoring/account/currency/room storage and the two administrator identities, and rehearse a coordinated restore. Preserve the approved opening-Gold policy. Gem spending requires its own activation; publishing prices does not enable it. Real payments additionally require the provider/merchant qualification and checkout UI described in the [payment guide](payment-adapter-contract.md).

The bounded interpreter supports two-player games; FFA needs equivalent priority/targeting/serialization and client-adapter qualification. Rule modifiers currently apply only to campaigns and isolated tests. New factions use a captured Rumin family; further families and competitive/limited availability need explicit effect dispatch, AI, pool/legality and player-control qualification. Additional encounters use the existing qualified boss scheduler; new AI behavior needs a reviewed executable primitive.

New uploaded general-purpose cosmetic assets need a delivery provider that resolves immutable published upload bytes with entitlement/hash checks; exact-printing uploads already have their separate qualified pipeline. Global faction appearance and automatic live-match music replacement are not destinations in the equipment contract. Legacy gameplay-pack purchases without exact receipts cannot receive automated historical reversals. These limits are shown as boundaries, not working controls or hidden activations.
