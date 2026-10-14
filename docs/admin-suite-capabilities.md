# Gauntlet Admin suite — implementation and evidence

Initial inspection: 12 October 2026 at `138c76154a5670399943c02eacb14866882bb06e`. Resumed 14 October; release branch `5dceb73599d14ffe99a5be41cb6ede3e59f59293` includes current main `804d9fe` (blocking/tutorial updates and campaign/faction voices).
Work branch: `codex/admin-content-lifecycle`. The subsequent request “and then make all live” authorizes deployment. Production activation remains blocked by the prerequisites below; no production purchases, grants or data mutations have been performed.

## Purpose-connected decks and products — current pass

Security follow-up (14 October): the CRA toolchain has been replaced with explicit maintained Webpack/Babel/Jest/ESLint configuration. The client audit now reports zero findings at all severities. The full 738-test client suite and four tooling security checks pass, and production bundles remain within unchanged limits (main 172.7 KiB, player 712.6, initial Admin 17.5, total Admin 55.9). See [the current security disposition](admin-dependency-audit.md); earlier audit and build measurements below describe the pre-remediation branch. Clean-install, full browser/CI evidence and Case's migration remain separate release gates.

The user confirmed that a deck product is a recipe, deck box, exact selected printings (“treatment”), and card back. Admin sets explicit Gold/Timetwister prices; blank disables a currency and zero means a free claim. Ranked and constructed events permit every legal gameplay card. Cosmetics still require ownership. Draft and Sealed retain their captured generated pools. Casual and campaign replacement cards still require earned gameplay access.

### Control-to-destination contract

All authoring writes below use the two immutable account IDs enforced by the existing `/api/admin` middleware. Ordinary accounts cannot read drafts, notes, private images or playtests. Saved draft fields become effective only after the shared immutable release activates; local form edits are never published. Every consumer resolves the captured release, not a competing mutable catalog.

| Controls / fields | Purpose and persistence | Actual destination and verification | Revision / retirement behavior |
|---|---|---|---|
| Deck create / duplicate; name, description, strategy | Permanent `auth-deck-*` identity in optional v4 shared snapshot; public copy | Deck and Store workshops; actual player shop renders public description and strategy; real engine subject `deck` | Independent copy; archiving retains identity and references. Legacy standard/encounter descriptors stay explicit; duplication creates a composition without changing their original setup. |
| Deck composition: faction, General, card + printing selectors | Shared 52-slot replacement contract; fixed rank/suit, unique cards, faction + neutral; commander/city derive from faction | Production `createGameFromLobby`, isolated exact-deck test, product fulfillment through existing saved-deck validator | Display order is never draw order. New matches resolve current permitted rules; running games keep definitions. Purchased saved decks are independent compositions. |
| Deck destinations: player, practice, encounter | Independent consumer permissions on an authored recipe; no account grant | Store requires player-compatible legal deck; practice uses exact composition; encounters require Rumin and qualified passive effects | Validation rechecks card/printing dependencies even if only a shared card changes. Scripted AI cannot author optional payment/arming/target choices. Unsupported decks remain player/practice only. |
| Private deck notes | Authoring state `privateNotes`, outside snapshot/release package; revision checked | Internal operator notes, save/reopen only | Does not stale exact-content receipts. GitHub rejects notes on a public repository. No public API or purchased deck receives these notes. |
| Store create / duplicate; name, description, recipe, box, back, prices, availability | Permanent `auth-offer-*` in the same release; new offers unavailable, prices unset | Actual `DeckOfferCard` shared by Admin preview and player shop; `buy-deck-product` uses normal account store and normal deck saver | Quote revision binds offer, recipe and full release. Changed terms reject a new purchase. Retry returns original receipt, even after recipe revision or retirement. |
| Purchase / receipt | One atomic account commit: debit, selected printing counts, back unlock, independent active saved deck, receipt | Ordinary authenticated shop route; local balances in acceptance fixtures only | Same request cannot debit/grant twice. Previous deck retained. Three existing deck boxes were already free; product selects the specified style. Duplicate printing counts increment by one, backs remain unlocked, no compensation is invented. |
| Encounter `opponentDeckId` | Reference to compatible authored recipe; legacy boss additions must be cleared | `prepareCampaignRoom` → actual boss loadout and General → production engine/AI | Boss life, attack progression, scripts, player additions, eligibility and rewards stay separate. Assignment grants no player recipe/cosmetics. Existing reward idempotency remains in the campaign system. |
| Card wording / flavor / name; selected effect, bounded parameters and structured composition | Existing card fields and finite versioned handlers | Published collection, actual card face and captured gameplay definition; accepted-command evidence | Wording is not mechanics. Source/default handler code and unsupported timings stay source controlled. New cards use permanent IDs; published structural slots remain protected. |
| Printings: name, edition, collector number, order, art, finish/frame/border, discoverability | Existing collector-presentation records and immutable references | Actual card/deck/match presentation, product preview and exact cosmetic grant | Creation does not grant ownership or put cards in packs. Configured deck products now provide an explicit acquisition path; archived historical references remain resolvable. |
| Sets: name/description, member cards, Draft/Sealed availability, archive | Existing set schema and unchanged pack recipe | Set discovery and limited pool generation with complete rarity checks | Membership is separate from legality, ownership and product fulfillment. Source sets remain source controlled. |
| Campaign headings, pitch and cover; encounter story/dialogue/voice/image; character labels/biography/portrait | Existing shared text/asset fields | Campaign entry, chapter briefing/dialogue and actual opponent labels; field guidance and presentation previews | Routing, chapter creation, objectives and reward policies remain source controlled. No invented encounter portrait field. |
| Faction name/card artwork; supported faction parameters | Existing faction presentation and registered mechanics owners | Release manifest and captured faction effects | Creating a faction, unsupported parameters and dynamic commander/city mechanics are still missing. |
| Website mode labels, descriptions and supported hero/menu prose | Explicit mode copy fields | Home/mode/campaign surfaces use the published manifest; prose search links to owner | Other hard-coded help/page copy remains roadmap work; no arbitrary HTML or code. |
| Shared hand size | Existing game configuration field | Initial draw and refill use captured configuration | Life, deck size, ranks/suits, lanes and orchestration stay source controlled. |
| Validate / preview / playtest / review / publish / rollback | One publication core and GitHub provider; exact content hash gates | Validation, real presentation/engine, checks/merge/deploy status, immutable activation history | Deck references, prices and printing changes are reviewed together. Rollback refuses removal of retained identities. Private notes are excluded. No tooling release changes game balance/content itself. |
| Relationships / search | Derived index; no relationship database | Deck ↔ card/printing/faction, product ↔ recipe, encounter ↔ opponent recipe, existing asset/effect links | Snapshot keyed; excludes dynamic player decks/history from exhaustive claims. |
| Players metadata / operational inspection | Existing separately guarded metadata route; otherwise safe read projections | Existing player profile and account metadata; real match/release/storage diagnostics | No new moderation, wallet editor, privileged product grant or role system. Historical evidence remains captured; unavailable archive evidence stays explicit. |

### Verification and production gates

`server/test/admin-deck-journey.test.js` proves real HTTP authoring by both allowed IDs; unauthorized requests; private-note exclusion; saved/reopened composition; exact-deck/encounter real-engine tests; coherent R1; concurrent ordinary purchases with exactly one debit/grant/deck; exact printing/card back reaching a production game; actual campaign command execution; existing duplicate-clear reward protection; later recipe revision, stale quote rejection, unchanged purchase/saved deck/running game, compatible rollback and reopened file stores. Negative validation covers forged/duplicate cards, printings, General, product references, unsupported AI effects, invalid prices and dependency changes. Local test prices are fixture-only, never defaults or live offers.

`account-store-concurrency.test.js` verifies atomic file replacement, interrupted writes, stale writers and busy locks. The new PostgreSQL migration is executed against PGlite: stale account writes abort, a preceding consequence receipt rolls back in the same transaction, and `anon` cannot call the service capability function. This is executable SQL evidence, not a claim of verification on production Supabase.

The compiled-browser deck/store journey proved ordinary-player purchase, exact printing/card back in the saved deck, service restart and a fresh browser (artifacts/purpose/browser/). Desktop and 390px phone views were inspected; oversized checkbox controls and unstyled deck preferences found during that inspection were corrected. At `74fd6e7`, CI passed 99 client suites / 734 tests and browser gates for player flows (43 passed, 3 intentionally skipped), Draft (6), Deck Workshop (5), collectors (1), usability (6), performance (1), and Admin (19). Its immutable-asset journey timed out because the isolated fixture's HTTP shutdown left upgraded WebSockets open. The fixture now closes those connections and exercises the same shutdown via IPC on Windows and Linux; production shutdown was not changed.

After integrating main `804d9fe`, local server regression passed **366 tests**, client regression passed **99 suites / 738 tests**, qualification passed **49**, and content validation passed for **144 cards, 1,602 immutable asset references and 1,606 source delivery dependencies**. Current measured JavaScript: main **179.9 KiB / 180**, player **742.0 / 750**, initial Admin **18.8 / 20**, total Admin **60.1 / 61**, largest async **280.1 / 350**. The player ceiling is the already-merged main branch's 750 KiB ceiling; this integration did not increase it. The existing 61 KiB total Admin ceiling remains unchanged. The security audit is independently failing and is not waived by functional test results.

The current compiled asset/printing journeys passed locally (2 tests), and the purchase/restart/fresh-browser journey passed (1 test). The purchased-deck screenshot was inspected. Linux CI at `5dceb73` passed all **19 Admin tests** and the printing journey, then exposed an idle API socket reset in the asset journey. Release-test API assertions now use fresh connections, while browser HTTP/WebSocket behavior remains unchanged. Local ports are configurable so another worktree's test server cannot interfere. Linux verification of this last fixture change and the full player CI rerun remain pending at this evidence checkpoint; [PR #72](https://github.com/BurntRamen/gauntlet-online/pull/72) carries the current check status. This is not an all-green CI or deployment claim.

Local verification logs are in `artifacts/purpose/`: `server-current-main.log`, `client-current-main.log`, `qualification-current-main.log`, `content-current-main.log`, `bundle-current-main.log`, `printings-final-resume.log`, and `purpose-isolated-ports.log`. Windows CRA test discovery needed relative `--testMatch` patterns because it produced a mixed-separator absolute glob under `.codex`; the same 99 suites ran. For concurrent local browser runs, set `GAUNTLET_ADMIN_FIXTURE_PORT` and `GAUNTLET_ADMIN_CLIENT_PORT`, and rebuild with `REACT_APP_SOCKET_URL` pointing to that fixture port before running the release configs. The defaults and CI ports remain 4117/3117.

Production observations on 12 October (local time): GitHub reports `BurntRamen/gauntlet-online` is public. Private uploads/notes therefore cannot use it; visibility was not changed. The running backend reports Supabase account storage, process-local complete match records and unavailable canonical archive (`gauntlet_match_archive_index` absent). The connected Supabase account does not list Gauntlet's database. The user confirmed Case will apply the tested migration; see `docs/deck-purchases-database-setup.md`. Deck purchases fail closed until `supabase/migrations/20261013013808_account_stats_concurrency_guard.sql` is applied and its service-only capability verifies. Client dependency findings remain a separate production-readiness blocker, documented in `admin-dependency-audit.md`. No live purchase, grant or archive repair was attempted.

Read-only production checks on 14 October: frontend and `/api/game-content` returned 200; anonymous `/api/admin/authoring` returned 401; `/api/economy/deck-products` returned 404. The existing service is running, and this tooling/purchase release is not deployed. Vercel's PR frontend preview is not an integrated production release. Case has not yet confirmed applying the database migration.

The full suite is **not complete**. New factions, broader reusable mechanics, full campaign/encounter creation, additional website prose, general media upload, private production asset storage and durable historical archives remain explicit work. The next dependency-ready workflow is qualifying additional opponent capabilities and public recipe-copy UX, followed by faction-definition consumers; neither is represented as completed CRUD.

The destination is the complete connected authoring, testing, publication and inspection suite. Milestone 1 established new sets and cards. Milestone 2 added real structured ability authoring for the bounded Rumin armament context. Milestone 3 added private image uploads, immutable versions and complete uploaded-byte release packaging. Milestone 4 adds printing creation, digital-edition organization, explicit appearance entitlement checks and captured limited-session releases. The broader suite remains in the roadmap.

## Capability map

| Admin outcome | Current state after this pass | Persistence / consumers | Remaining dependency | Completion evidence |
|---|---|---|---|---|
| Edit existing card wording, compatible effect and declared parameters | Working; regression suites passed | Shared publication snapshot → card presentation and pinned engine effects | Additional mechanical capabilities remain below | Exact-hash draft action, publication, new/old match comparison |
| Create / duplicate / archive cards; configure values and artwork | Working locally for supported contracts | v3 shared snapshot, permanent card/standard-printing IDs → published collection/deck/pack/encounter catalogs | Source card structural edits and published deck-slot changes remain protected; duplicate instead | Server lifecycle/validation and guided desktop/phone browser journey passed |
| Compose supported abilities | Implemented locally: bounded Rumin armament composition, guided blocks, strict versioned contract and private engine trace | Same shared snapshot and transactional engine; per-card owner | Additional contexts need reusable timing/target executors; no universal rules language | Ordered attack/life outputs, negative commands, local R1/R2 and pinned matches |
| Create sets and manage membership | Implemented locally for new authored sets; legacy sets remain source-controlled | v3 set definitions → public set menu and Draft/Sealed pack generation | Deck products have explicit configured fulfillment; arbitrary pack recipes and general product types remain unsupported | Both limited formats use only configured eligible members with the unchanged pack recipe |
| Separate legality, acquisition, ownership and printing | Working for new cards and printings; source card availability remains protected | Per-channel availability / existing account entitlements / standard collector variant / replacement slots | Configured deck products grant exact printings; source-card availability authoring remains protected | Publishing grants nothing; ranked/event gameplay access is separate from cosmetic ownership; casual/campaign retain earned access; archive retains references |
| Create / duplicate / organize / archive printings | Implemented locally, with real renderer and exact uploaded art | Existing collector variants, digital sets, shared releases and saved decks | Exact deck-product grant path is implemented; production purchase migration and rollout remain pending | P1/P2 browser release, entitled deck, real match, revision, rollback, restart and replay |
| Create factions / commander and city mechanics | Source-code-bound | Source faction catalog and faction-specific handlers | Dynamic faction consumers and supported mechanic contracts | New faction selected, tested and used across modes |
| Author deck templates | Connected and verified locally | Optional v4 shared snapshot → real practice game, shop fulfillment and Rumin opponent loadout | Additional AI qualifications and standalone public recipe-copy UX | HTTP and compiled-browser deck → purchase → saved composition; real campaign commands; revision, rollback and restart |
| Store deck products | Connected locally; blocked in production | Shared offers → normal account debit, printing/back entitlements, saved deck and durable retry receipt | Case applies existing-account concurrency migration; deployment security gate | Concurrent identical requests debit/grant once; stale terms rejected; lost-response UI retains same key; no production charges |
| Full campaign structure | Source-code-bound | Existing source progression, objectives, rewards and ordering | Structural campaign contracts and consumers | Existing supported assignment/completion tests do not prove full campaign creation |
| Edit existing encounters and exact-draft playtest | Working, including newly authored card additions | Shared snapshot → encounter setup → real engine | Structural creation remains above | Existing 56-encounter equivalence plus new-card encounter factory coverage |
| Select / replace immutable assets | Working locally: exact versions, private searchable picker, dependencies and archive | Version references in shared snapshots; source and uploaded image dependencies in release packages | No destructive cleanup or general media manager | A/B replacement preserves old matches and retained releases |
| Upload card images | Implemented locally for still PNG/JPEG/WebP, normalized to immutable WebP | Atomic content-state file; private GitHub draft and self-contained release JSON through existing provider | Production repository verified public: private uploads/notes are blocked there. Private delivery is not verified; 6 MiB retained upload cap | UI upload → saved exact draft → real engine → R1/R2 → rollback → process restart and fresh browser |
| Upload audio/video/fonts | Not implemented | Existing shipped audio remains selectable | Separate validation, delivery and authoring milestone | No completeness claim |
| Website prose and presentation | Partial | Shared mode/campaign/character text → published client manifest | Inventory additional help/page sections and wire each consumer | Published text visibly updates intended page |
| Draft / validate / preview / test / review / publish | Working locally for additions as well as existing edits | File and GitHub providers share publication core | Production-readiness audit gate remains blocked; GitHub runtime authoring credentials not changed | Two local content releases; mocked GitHub checks/merge/deploy; stale receipts refused |
| Safe rollback after content creation | Working with conservative refusal of incompatible history | Immutable release history; account/deck IDs | Future migration tools require separate design; no destructive fallback | Rollback R2 → R1 succeeds; rollback before card existed refused; ownership retained |
| Relationships and search | Extended with decks, products, opponent references, printings and set-membership edges | Derived snapshot index and searchable private projections | No claims about exhaustive dynamic/historical usage | New card/set links covered by server tests; existing navigation browser flow retained |
| Players / matches / system inspection | Working existing surfaces; scope read-only | Existing account, match archive and runtime projections | Expose new content references where useful | Historical definitions stay historical; unauthorized reads rejected |
| Server authorization / concurrent editing | Working, extended to creation | Immutable two-account allowlist / revision checks | No role-management expansion | Both approved identities allowed; anonymous/other account denied; stale creation revision returns 409 |

## Milestone 1 checklist

- [x] Inspect current code, including publication, registry, packs, decks and match creation.
- [x] Add validated new set/card identities within the shared draft.
- [x] Add guided create, duplicate, membership, availability and archive controls.
- [x] Resolve published definitions in downstream catalogs, packs, decks and encounters.
- [x] Reuse immutable artwork, exact-draft preview and real-engine testing.
- [x] Prove local releases R1/R2 change a mechanical parameter while an existing match stays pinned.
- [x] Prove reference-preserving rollback and explicit refusal of unsafe rollback.
- [x] Exercise server authorization, conflict, invalid effect, missing reference and stale receipt failures.
- [x] Run relevant server/client/browser checks and record measured results below.

## Compatibility policy

Legacy v2 snapshots remain unchanged and readable. The first structural authoring operation upgrades the draft to v3; published legacy snapshots remain immutable. Existing source cards and set behavior are preserved by ingress adapters. Newly created cards have server-generated permanent identities, a free standard presentation, and separate visibility, legality and acquisition settings. New set membership never grants ownership or creates a new paid product.

Retirement retains definitions and entitlements. A rollback that removes published identities or changes their faction/slot contract is refused even if no currently loaded account references them; the server must not infer global absence from a partial account cache. Operators can publish a compatible retirement release instead.

Rollback also refuses to remove existing constructed legality. An intentional legality change must go through a reviewed publication. If that makes a saved deck illegal, future game entry reports an actionable error, preserving the saved deck and collection instead of silently substituting a basic deck. Queued/cached decks are checked against the captured release before game creation. Other selected factions/basic play are unaffected; the private test harness can still test cards before they are legal for normal play.

Before publication, a new card can change faction, type, rarity, printed value and fixed suit within supported contracts. After publication, faction, type, value and suit are locked because they define existing deck references; duplication creates the new identity needed to change those fields. Wording, artwork, compatible effect/declared parameters, rarity, availability and retirement remain editable. The current UI does not claim arbitrary identity migration.

Archived cards stop appearing in future earned/Draft/Sealed acquisition pools. Their definitions, owned copies and separately configured gameplay legality remain intact. A set's membership does not grant ownership. Enabling a limited format requires complete common/uncommon/rare/mythic pools for each included faction, including at least one non-neutral faction. Existing source sets exclude new cards unless an authored set explicitly includes them; existing pack sizes and rarity probabilities are unchanged.

No content migration rewrites the shipped v2 release. An empty v3 upgrade produces exactly the same resolved runtime manifest. Game creation captures its release and effect bindings; the lifecycle test changes a bonus from 2 to 6 and observes attack values 4 versus 8 in old and new games.

## Milestone 1 verification results (prior pass)

Local evidence is under ignored `artifacts/` in this worktree. Tests use temporary file stores, fixture accounts and local services; GitHub publication tests use a mocked repository.

| Check | Result |
|---|---|
| Complete server suite | 341 passed, including engine equivalence, encounter equivalence, publication providers, authorization, decks and acquisition |
| Complete client suite | 79 suites / 664 tests passed |
| Final focused client regression | 5 suites / 20 tests passed after creation-form, required-art and lazy-field changes |
| Lifecycle after earned-pack coverage | Passed: actual earned pack grant, constructed deck, both limited pack formats, exact-draft encounter, two releases, pinned old/new games, rollback and retirement |
| Malformed catalog / atomic creation / availability | 3 tests passed, including 21 malformed snapshots |
| Qualification scripts | 42 passed |
| Existing shipped release validation | Passed: unchanged release `fc2f00e61ebc394f3547c053bcb9affd0d14ab688ab852ce0dff02d890fc85c0`, 144 cards, 1,281 immutable asset references |
| Admin browser suite | 18 passed; another 2 focused browser checks passed after the required-artwork fix |
| Player deck/pack workshop browser suite | 5 passed: exact slot swaps, deck naming, pack opening, gallery/zoom, neutral labels and responsive card rows |
| Legality / socket / deck / rule regression | 34 passed, including a published legality change, queued-deck refusal and unchanged ownership |
| Production build / bundle ceilings | Passed; final measurements recorded below |

The browser journey covers keyboard focus, guarded creation, direct set/card targets, availability, real card presentation, real payment/weapon selection, two local publications, rollback refusal/restoration, 390px phone layout, accessibility and local-discard behavior. Existing browser checks cover both admins, direct unauthorized requests, second-operator conflicts, encounter evidence, assets and history navigation. The fixture's API assertions close idle connections to avoid a Node/Playwright keep-alive race; browser traffic uses normal connections.

Measured gzip size: main 179.9 KiB / 180; player JavaScript 746.1 / 747; initial Admin 17.6 / 20; all lazy Admin JavaScript 51.7 / 52; largest asynchronous chunk 285.8 / 350. The explicit total Admin allowance increased from 48 to 52 KiB for catalog creation and guided membership/availability. Main/player/initial Admin/largest-chunk limits are unchanged, and all named Admin modules remain counted. Shared contract controls were deduplicated and fields load lazily.

On Windows this checkout's default Jest glob misses files under `.codex`. The successful client command used `npm --prefix client test -- --watchAll=false --runInBand --testMatch '**/src/**/*.test.js'`; focused runs added `--testPathPattern`. Browser builds use the isolated backend `http://127.0.0.1:4117` and `GAUNTLET_ADMIN_USE_BUILD=true`.

No credentials, hosting configuration or storage changes were needed for this local milestone. Actual GitHub/Render/Vercel connectivity and production publication were not tested or changed. No external blocker prevented local implementation. No new accounts, economy adjustments or moderation tools were introduced; previously authorized Players metadata behavior was preserved.

## Remaining suite checklist and next milestone

- [x] Add a bounded Rumin armament composition contract, editor and deterministic executor with tests.
- [ ] Extend composition to additional contexts using reusable executors and demonstrated legacy equivalence; new timings/costs/targets need their own contracts.
- [ ] Extend availability authoring to source cards with explicit compatibility policy; retain protected published identity/slot contracts unless a separately verified migration exists.
- [x] Add multiple printing/variant creation and edition management, preserving independent ownership and acquisition rules.
- [ ] Author deck template inventories through the shared snapshot, with slot/faction/reference validation and actual mode consumers.
- [ ] Create factions through published definitions and finite supported faction-mechanics contracts; reconcile every faction selector and gameplay consumer.
- [ ] Create campaign/encounter structures and supported objectives/progression/rewards without changing existing reward semantics.
- [x] Ingest bounded still-image uploads through immutable validation and the existing single-file GitHub release package; verify historical bytes remain available locally.
- [ ] Verify the existing production repository's private storage, deployment and public image delivery before enabling uploads there; add audio only with a separate complete validation/delivery path.
- [ ] Finish the website/help prose inventory and connect additional supported page sections to publication.
- [ ] Expand read-only operational inspection of content/deck/match references and release failures without guessing missing historical evidence.
- [ ] Prove a mixed-domain release, archival/ownership compatibility and rollback across the expanded workflows, including both authorized accounts and mobile/keyboard use.

The next dependency-ready implementation milestone is authored deck/template creation, using the established gameplay, printing, immutable asset and release boundaries. Broader mechanics, new factions, authored decks, campaign structure and website prose remain required work, with explicit runtime-consumer and compatibility contracts. No existing ability was migrated automatically. Production storage/delivery verification is a separate release prerequisite, not another local implementation claim.

## Milestone 2 — inspected vocabulary and composition contract

Inventory inspected before exposing controls: shared/duel-rules/index.js (attack payment, arming, post-attack effects, combat resolution, legal choices), effectRegistry.js, effects.js (turn modifiers), faction modules, encounterContract.js, authoredContent.js and the private scenario/action controllers.

| Engine vocabulary | Existing authority | Authoring status in this milestone |
|---|---|---|
| Finite card handlers | 144 registered source contracts, exact faction/type compatibility | Existing selector retained. Only three handlers expose armBonus 0–8. No legacy card was converted. |
| Rumin armament selection | Controlled support; hand attacks; normally one weapon, Crown of Authority can use multiple | Composable at this exact existing window. Selection stays in production legal descriptors. |
| Payment and requirements | Normal attack cost, selected hand payment, existing bonuses, overpayment | Payment remains engine-owned. Ability conditions: always; overpay at least 0–14; diamonds paid this turn including current payment; printed attack value at least 2–14; attack ordinal equals 1–20. |
| Attack bonuses | Existing arming / faction modifiers | Ordered additive attack effects 1–8, selected attacker only, this combat only. |
| Life gain | Existing Rumin overpay and Executive Authority Blade behavior | Ordered immediate self life effects 1–8; life gain does not expire. Combining these effects is a reusable interpreter extension, not a new resource or response system. |
| Source use / expiration | Weapon attached to attack then discarded when combat resolves | Once per arming, no per-turn reset. Fixed target/duration/cost/limit are labeled engine-owned, not offered as fictitious choices. |
| Turn modifiers, draws, counters, block reactions, faction activations, tokens, lane swaps and optional choices | Existing specific handlers and faction modules | Retained through legacy effects. Need separate reusable context executors and equivalence coverage before composition controls may expose them. |
| Encounter boss/setup rules and faction parameters | Six boss abilities, bounded setup; ten faction contracts | Existing authoring retained, not migrated into this composer. |
| Randomness, recursion, arbitrary event triggers, scripts, new timings/resources | Existing authoritative engine only | Not composable. Unknown fields/versions/operations fail validation; no script or recursive dispatch path exists. |

### Executable semantics

Composition version gauntlet.composition.armament.v1 is immutable. Definitions carry id + version; only snapshots containing compositions add the compositionVersion content binding. Existing v2/v3 releases and legacy handlers retain their original contracts. Future interpreters must retain v1 execution rather than reinterpret it. Unknown definition versions fail validation/loading/publication/rollback compatibility; unknown captured interpreter bindings reject command execution. An old binary cannot validate a composed release and must not load it as compatible.

Conditions are captured once after payment validation using pre-attack facts, including the current accepted payment. The command revalidates source control, lane presence, source/attacker eligibility, selected payment, timing and priority before commitment. No client-provided result is trusted. Normal payment and attachment are committed on applyCommand's private clone, then abilities and their effects run in list order before legacy overpay/post-attack hooks and priority transfer. Failed conditions apply no effects but still consume the selected armament. There is no deferred target resolution or second arming response window. Existing block/decline and combat priority responses remain available; attack bonuses last on that combat object and are removed when it resolves. Prior life gain remains.

Each source has 1–4 abilities, each with 1–4 effects. Current boards have three support positions; the preserved legacy facedown-support adapter can expose three additional positions. Only the existing multi-arm attacker permits more than one selected source. Even with all six legacy/current sources, a command executes at most 96 primitive effects. Primitives cannot enqueue triggers; unsupported recursion is rejected instead of silently truncated. No random primitive is exposed. These are interpreter bounds, not new match rules.

The generated explanation uses the same validated definition as runtime. Flavor (optional on authored cards), editable printed wording and executable mechanics have separate saves. Wording is flagged unless it exactly matches the generated explanation; this is deliberately not a claim of semantic equivalence for arbitrary prose. Composition belongs to its card; changing it does not change a shared handler or another card. Duplicating it copies the definition under a fresh stable identity.

Private test traces come directly from the executor and combat-expiration hook. They report eligibility, accepted payment, condition observations, ordered before/amount/after values, consumed source use and expiration. Rejected previews report the authoritative engine rejection and no committed costs. Accepted traces are retained in the owner-bound test session (bounded to 2,000 steps with an explicit omitted count). Normal applyCommand calls omit diagnostics, and traces never enter game state, animation events, public logs, player projections or archived match state.

The deterministic custom setup remains explicitly a fixture, not a played history. Test receipts still require an accepted real command at the exact saved hash. They do not certify balance or exhaustive coverage. Production data and the shipped release remain untouched.

### Milestone 2 acceptance and evidence

- [x] Inventory real handlers/timings and distinguish fixed engine rules from this interpreter's temporary authoring bounds.
- [x] Create a new permanent card, add/duplicate/remove ability blocks, edit conditions and ordered effects, save and reopen through Card Workshop.
- [x] Keep flavor, printed wording, executable definition and generated explanation separate; warn on unmatched wording.
- [x] Use one strict shared schema in the editor, server save, snapshot validation, explanation and runtime. Reject unsupported context, version, fields, targets, duration, cost and recursion.
- [x] Use production payment and legal choices; preserve priority/block responses and atomic rejection. Execute maximum supported effects without skipping.
- [x] Explain accepted payment, conditions, ordered values, usage and expiration with private authoritative traces and exact session identity.
- [x] Publish two isolated local releases, prove actual match-factory/deck consumption, preserve the running R1 definition, and exercise reference-safe rollback.
- [x] Preserve per-card historical compositions and captured replay bindings; do not collapse different cards under their common interpreter ID.
- [x] Verify both allowlisted accounts, unauthorized requests, conflicts, desktop/phone layout, keyboard and accessibility.
- [x] Run server/client/qualification/content/build/browser checks and record their actual scopes below.

Demonstration: a newly created Rumin armament requires overpayment of at least 2, then adds 2 attack value for this combat and gains 1 life. With a printed 2 attacker and 14 payment, R1 produces attack 4 and life 43. R2 changes the requirement to diamonds paid and reverses effect order. The identical heart-payment fixture now produces attack 2 and life 42. R1's already-created match still produces 4/43, deals 4 damage after the real decline/pass response sequence, and carries R1's frozen definition. Compatible rollback restores that behavior for future matches without changing ownership. Rollback before the new identity existed is rejected. The browser composes/saves/reopens/tests/publishes both releases and restores R1, all against the isolated local fixture server.

Representative legacy Executive Authority Blade outputs are compared with an explicit equivalent two-block composition at three payment boundaries. Existing cards are never automatically converted. Additional cases cover false conditions, payment reuse/shortfall, lost source, wrong priority, wrong target/duration/schema, consumed-source reuse, stacked Rumin bonuses, combat expiration, unknown interpreter loading/rollback and maximum execution (including the legacy support adapter). The production player action adapter also selects and executes the new composed weapon.

| Check | Actual result / local log |
|---|---|
| Full server suite | 348 passed, artifacts/structured-mechanics-server.log |
| Final server additions and historical projection | 10 focused passed, including three cases added after the full run (351 distinct server cases verified across runs); artifacts/structured-mechanics-final-focused-server.log |
| Maximum/legacy-slot runtime boundary after final assertions | 7 passed, artifacts/structured-mechanics-runtime-final.log |
| Real factory/release/authorization journey | Passed, artifacts/structured-mechanics-lifecycle.log |
| Full client suite | 80 suites / 667 passed, artifacts/structured-mechanics-client-final.log |
| New composed-card player interaction regression | 39 adapter cases passed, including one added after the full client run (668 distinct client cases across runs); artifacts/structured-mechanics-player-adapter.log |
| Focused guided editor / workshop / evidence | 4 suites / 21 passed |
| Qualification scripts | 42 passed, artifacts/structured-mechanics-qualification.log |
| Admin browser suite | 19 passed, artifacts/structured-mechanics-admin-suite.log; also the focused new journey passed separately |
| Player deck/pack browser suite | 5 passed, artifacts/structured-mechanics-player-browser.log |
| Release validation | Unchanged shipped release fc2f00e61ebc394f3547c053bcb9affd0d14ab688ab852ce0dff02d890fc85c0; 144 cards / 1,281 assets |
| Production build and budget check | Passed with the explicit revised ceilings below; artifacts/structured-mechanics-build.log and structured-mechanics-budgets.log |

The initial full client run had one lazy Publishing import timeout while server and qualification suites ran concurrently. Its isolated focused check passed, and the complete client rerun passed all 667 tests. No product behavior was changed to mask that timeout. A new browser assertion initially matched two headings; scoping it to Selected content fixed the test, after which the complete browser suite passed.

Measured gzip: main 179.9 KiB (ceiling 180), player 747.7 (ceiling explicitly changed 747 → 748), initial Admin 17.6 (ceiling 20), deferred Admin 38.3, total Admin 55.9 (ceiling explicitly changed 52 → 57), largest async 285.8 (ceiling 350). Compared with milestone 1, the shared validator/runtime costs about 1.6 KiB in player code; guided composition/explanation/trace and wiring add about 4.2 KiB total Admin code. Editor/explanation UI is in the named lazy gauntlet-admin-mechanics module, outside player code. Splitting does not reduce the aggregate charge. Main, initial Admin and largest-chunk ceilings are unchanged. The earlier failed check at 52/747 is recorded in the build log, not hidden.

Visual evidence: artifacts/structured-mechanics-desktop.png and structured-mechanics-mobile.png, inspected at 1440px and 390px widths. Existing player screenshots were copied to artifacts/structured-mechanics-player-evidence before restoring their tracked originals; they are evidence, not intended source changes. All evidence is local/ignored by Git.

Current limitations: composition v1 covers Rumin arming only; costs, target family, duration and usage are fixed engine semantics, not freely combinable controls. Other cards retain their compatible registered handlers and declared parameter edits. Flavor is stored and shown separately in the Admin preview; it is not merged into gameplay rules wording. No new factions, uploads, printings, authored deck templates or campaign structures were added. Those remain in the suite checklist. Historical replay renders captured evidence; it is not a promise to re-execute unsupported future interpreters. The two-account server allowlist is unchanged.

No production deployment, production content publication, push, merge, credentials, hosting configuration or storage mutation was performed. GitHub packaging/check/merge/deployment behavior was exercised only through the existing mocked provider. Actual external GitHub/Render connectivity and production archive availability were not exercised. The implementation and all prior lifecycle work remain local in the existing worktree.

## Milestone 3 — immutable images and coherent release packages

This is a local implementation, following the two preceding milestones. It does not grant ordinary players upload or metadata access. The existing two stable account IDs remain the only authorized operators. Rumin armament composition is unchanged; other mechanics remain compatible registered handlers or declared parameter edits. General timing/cost/target authoring is still incomplete.

### Inspected starting path

The source manifest contains 1,281 approved entries (116,352,922 bytes), independently of collector-presentation records. It maps source aliases and stable asset IDs to digest paths in `client/public/assets/gauntlet/releases`. The original GitHub provider wrote one JSON release and had no binary-ingestion path. Card artwork belongs to a collector variant's `art` field. Faction/character images, campaign/encounter scenes, and existing audio use the same manifest resolver. Frames are source-controlled CSS/renderer behavior; four existing card-back files now also have verified immutable copies and explicit presentation dependencies. No approved artwork was redesigned.

### Authoring and persistence

- The card editor's existing image picker supports upload, title, description and attribution/source notes, search, exact-version selection, replacement upload, dimensions, size, status and archive/restore. Notes are descriptive private metadata, not licensing verification. Replacement adds a new version to the selected logical asset; it does not change any field until the operator selects and saves that version.
- Logical `image-…` IDs own private metadata. Immutable `image-version-…` records contain sequence, decoder contract, normalized MIME/dimensions/size, SHA-256 of stored bytes and original-upload digest. Display metadata is separate from published version metadata. Identical normalized bytes deduplicate by digest without merging logical records. No “latest” alias, original filename or browser URL is persisted.
- File-provider metadata, exact bytes encoded as base64, drafts, retained releases and the active pointer live in the existing persistent `content-state.json` transaction. Bytes and activation cannot commit separately. Test directories are fixtures, not production storage guarantees. File-provider production still requires the existing configured persistent volume.
- The GitHub provider stores private image records and bytes in its existing draft JSON. Before accepting an upload it checks repository metadata and requires `private: true`. A public or unverified repository fails closed; publishing private draft bytes to a public branch would violate the access boundary. No repository visibility or external storage settings were changed.
- GitHub's existing release JSON now carries an `assetPackage`: exact uploaded version records and bytes for current **and retained published** versions, plus shipped dependency identity/manifest. Unpublished uploads, titles, descriptions and source notes are excluded. This deliberately keeps the existing one-file comparison, PR, CI, exact revision, merge/deployment and rollback machinery rather than introducing a second pointer or publication service.
- Each normalized image is at most 1 MiB. The retained uploaded-byte store is bounded to 6 MiB and 500 version records; the provider retains its 16 MiB JSON limit. Limits fail explicitly and never delete history. Larger libraries require a separately authorized storage expansion.

### Validation and delivery

Uploads accept actual still PNG, JPEG or WebP contents only. Extensions and submitted MIME types do not authorize a format. Magic bytes are checked before decoding; `sharp` 0.35.5 fully decodes with warning rejection, an 8-megapixel limit, 16–4,096 pixels per side, one processing operation at a time and a 10-second processing timeout. Uploads are bounded to 3 MiB. Animation, SVG, HTML, unsupported formats, malformed images and unknown input fields are rejected. The fixed processing step rotates by orientation, strips metadata and encodes WebP at quality 90. The normalized output is the immutable version, never a derivative regenerated on read. Originals are not retained; their digests are. No separate thumbnails, cropping, focal-point editor, audio/video/font ingestion or arbitrary files are implemented.

Private reads use the same authenticated namespace as uploads and archive operations, with `private, no-store`. The Admin-only image provider fetches displayed versions with the existing bearer-authenticated request, deduplicates those reads in the mounted Admin session, and feeds ephemeral data URLs into the real card component. Draft content/game JSON retains exact private version paths; it does not repeat base64 artwork throughout every card definition. These browser values are disposable display caches, not durable identities or storage. Retrieval failures remain visible.

Published bytes are served by the backend from the activated package through `/api/content-assets/<version>/<digest>.webp`, with digest verification, MIME type, `nosniff`, ETag and immutable one-year caching. A private-only version returns 404 even when its digest is known or its bytes deduplicate with another version. Published URLs do not contain credentials or expiring signatures. The server origin is derived from the existing Render external URL or local listening address; paths are not filesystem locations.

Before activation, content/reference validation and exact preview/test/revision gates remain decisive. Packaging verifies every required and retained uploaded blob, verifies the 1,285 shipped presentation dependencies, and finishes before the existing atomic pointer changes. Shipped source assets remain delivered by the frontend's immutable build paths; new uploaded bytes are embedded in the backend release, so their delivery needs neither a private GitHub browser URL nor an accidental source-checkout file. The source dependency total is 117,268,577 bytes, including the four unchanged backs. Missing/corrupt bytes, incompatible packages and interrupted writes fail without activating the candidate release.

New games capture selected collector presentation, image ID, digest, URL and release. Existing game state and public replay frames keep those values; a compatible rollback changes future games while retaining B's bytes. Live and replay card backs resolve captured immutable mappings where available. Legacy matches without captured bindings are not retroactively reconstructed, and rollback does not rewind deployed renderer/CSS code.

### Local acceptance evidence

The dedicated `playwright.assets.config.js` journey uses actual uploaded PNG buffers, the production Admin picker and card component, the real game factory, accepted engine commands, production room persistence and the production WebGL replay renderer. Its replay envelope is a test fixture built from the captured authoritative frame; it does not claim a production match-archive integration test. The server process is stopped and started again against the same disk store, then the checks run in a fresh browser context. No live accounts or production matches are used.

The journey uploads A, saves and reopens the collector artwork, checks the actual draft card and exact-draft hand, publishes R1, captures an R1 game, uploads B as version 2, changes only that draft field, publishes R2, verifies both captured games, rolls back future games to A, retrieves retained B, restarts and renders recovered R1 with A. Delivered bytes are hashed against captured version digests; image decoding and the real rendered card are also checked. Evidence is in `artifacts/immutable-assets/`, including `journey.json`, `measurements.json`, phone upload/replacement views, draft-match and recovered A/B table captures. The solid-color fixtures test byte/version identity, not art direction.

Both approved account IDs can retrieve private images; unauthenticated and same-name unauthorized accounts cannot. Failure coverage includes invalid/oversized/animated uploads, wrong media, unknown fields, missing/corrupt package bytes, unknown versions, stale revision, removal refusal, interrupted activation and GitHub reconciliation, private-repository refusal, repeated upload request identity, independent author records sharing bytes, archive retention and old/new release delivery. A separate regression reverses attack-bonus/life-gain order with the same condition, asserting authoritative trace order while the commuting final values remain equal.

### Verification and performance

| Check | Actual local result / evidence |
|---|---|
| Full server suite | 358 passed; `artifacts/immutable-assets-server-final.log` |
| Final upload, HTTP authorization, GitHub packaging and effect-order checks after decoder update | 28 passed; `artifacts/immutable-assets-server-focused-final.log` |
| Client `.test.js` suites | 82 suites / 672 passed; `artifacts/immutable-assets-client-final.log` |
| Final card-presentation normalization regression | 2 suites / 13 passed; `artifacts/immutable-assets-face-final.log` |
| Replay-screen `.test.jsx` coverage | 7 passed; `artifacts/immutable-assets-replay-final.log` |
| Qualification scripts | 42 passed; `artifacts/immutable-assets-qualification.log` |
| Existing Admin browser suite | 19 passed; `artifacts/immutable-assets-admin-all.log` |
| Final uploaded-image journey, including public library/deck views, replay, rollback and restart | Passed in 43.1 seconds; `artifacts/immutable-assets-browser-final.log` |
| Player deck/pack workshop browser checks | 5 passed; `artifacts/immutable-assets-player-browser.log` |
| Final production client build and aggregate budgets | Passed; `artifacts/immutable-assets-build-final.log`, `artifacts/immutable-assets-budgets-final.log` and `artifacts/immutable-assets/bundles.json` |
| Content release validation | Passed, unchanged shipped `fc2f00e61ebc394f3547c053bcb9affd0d14ab688ab852ce0dff02d890fc85c0`; 144 cards / 1,281 existing references and 1,285 verified delivery dependencies |

The dedicated browser run caught a stale picker revision after upload; successful operations now advance only that picker's matching revision, leaving independent conflicted field buffers unchanged. It also caught a replacement textarea label whose accessible name included entered text; explicit labels now remain stable. A later concurrent run timed out at five seconds while publication was still verifying source files; the final test awaits and checks the actual publish response, and passed. Selected collector versions now feed their own presentation into the real card renderer while a different release cannot overwrite a captured card's artwork. Final focused tests cover that distinction.

Representative fixture measurements after restart: one logical asset, two immutable 240×320 WebP versions, 224 bytes each (448 combined); atomic store 1,230,749 bytes; compact JSON release plus current/retained upload package 996,229 bytes. These flat-color fixtures are deliberately small and are not a claim about typical artwork compression. The GitHub provider's formatted serialization is larger. Shipped dependency bytes total 117,268,577 and remain frontend build assets; opening the picker does not download all of them. It pages 24 entries and fetches displayed private images, bounded to 1 MiB each. There are no regenerated thumbnail bytes. Exact delivery hashes and successful image decoding are asserted in addition to screenshots.

Final gzip measurements (the player-browser build targets local port 4104; the uploaded-image journey build targets 4117):

| Bundle | Measured | Ceiling |
|---|---:|---:|
| Main | 184,258 bytes / 179.9 KiB | 180 KiB, unchanged |
| Player JavaScript, aggregate | 765,791 bytes / 747.8 KiB | 748 KiB, unchanged |
| Initial Admin | 18,803 bytes / 18.4 KiB | 20 KiB, unchanged |
| Deferred Admin | 40,794 bytes / 39.8 KiB | Included in total below |
| Total Admin | 59,597 bytes / 58.2 KiB | Explicitly 57 → 59 KiB |
| Largest async chunk | 292,632 bytes / 285.8 KiB | 350 KiB, unchanged |

The total Admin increase from the prior measured 55.9 to 58.2 KiB is the upload/replacement UI, version/dependency presentation, authenticated image reads and revision/retry protection. The 59 KiB allowance covers that measured 2.3 KiB delta; splitting does not exempt any Admin code. The decoder is server-only. Player impact is about 0.1 KiB for release-aware presentation and canvas image delivery. A first final build exceeded the main ceiling by 46 bytes; normalizing optional card input once removed repeated defensive expressions, and the limit remains unchanged. Build warnings report an outdated Browserslist dataset; there were no compilation failures in the final build.

The 19 existing Admin journeys ran after the upload/private-preview integration. The final dedicated asset journey and five player journeys additionally cover the later collector-selection/card-back rendering fixes. The full client run preceded the final small normalization; its affected card tests were rerun afterward. Visual inspection confirmed the red A and blue B on the actual WebGL table, blue B in the deck preview, and the responsive 390px replacement form. Nineteen generated player screenshots were copied to ignored `artifacts/immutable-assets-player-evidence`; tracked originals were restored. `git diff --check` passed apart from informational line-ending conversion notices.

### Production boundaries and remaining work

No push, merge, deployment, production publication, external infrastructure, credentials, repository visibility change or production data mutation was performed. The existing worktree and preceding local milestones are preserved. Actual GitHub/Render connectivity, production repository privacy, persistence, frontend/backend rollout and cross-origin image delivery were not exercised. GitHub behavior was tested with a mocked provider; file persistence and backend serving were exercised with restarted local processes and a fresh browser.

The production GitHub upload path requires the existing repository to be private. A public repository is explicitly refused; enabling it would require an approved private storage adapter. This milestone provisions none. File-provider production requires a persistent volume already configured for its atomic store. The 6 MiB retained-upload / 500-version cap is intentionally small; the existing 16 MiB provider payload limit also applies. Growth fails explicitly without destructive cleanup. Delivery/deployment must be verified against the real hosting environment before describing uploads as production-ready.

The server decoder is pinned to [sharp 0.35.5](https://sharp.pixelplumbing.com/changelog/v0.35.5). The final production-dependency audit no longer flags the decoder, but still reports eight pre-existing transitive advisories (one low, two moderate, four high and one critical), including `proxy-addr`; see `artifacts/immutable-assets-server-audit.json`. Unrelated Express/Socket.IO dependency upgrades were not folded into this asset milestone. A passing functional suite is not a clean dependency-security audit.

Still-image upload and exact-version card artwork are implemented. Audio/video/fonts, original-file retention, cropping/focal-point editing, separate thumbnails and destructive cleanup are not. Archived assets retain their versions and dependencies. Legacy historical records without captured artwork cannot be reconstructed, and renderer/CSS history is not rolled back. Rumin composition remains bounded; no new timings, costs, targets or mechanics were introduced.

Next dependency-ready implementation: additional printing/variant creation and edition management, consuming these exact image versions while preserving gameplay IDs, ownership and acquisition contracts. New factions, authored decks/templates, campaigns/encounter structure and website-content authoring remain on the roadmap, alongside broader mechanics contracts and production delivery verification.

## Milestone 4 — Printings and digital editions (local, October 2026)

This section supersedes the printing roadmap item and dependency-audit status above. It extends the same uncommitted local suite; no deployment or production content publication is included.

### Identity and resolution

| Identity | Authoritative representation | Behavior |
|---|---|---|
| Gameplay card | Existing `cards.id` / `gameplayCardId` | Owns faction, type, printed slot and executable effect. Printings cannot override any of them. |
| Rules revision | Release-captured effect/definition, with `presentation.gameplayRevision` digest | One mechanics definition applies to every printing in a release. Old games retain `contentDefinitions`. The digest identifies the card's definition; complete engine/faction/config bindings remain separately captured. |
| Printing | Existing collector variant ID, new server-generated `auth-printing-UUID` | Permanently bound to one gameplay card. No patch can rebind it, including before publication. |
| Printing revision | Digest of exact authored variant metadata, plus exact image-version reference | Captured in `presentation.printingRevision` and the release snapshot. A metadata change creates a new revision of the same printing. |
| Digital set / edition | Existing source sets plus authored `sets` | A printing's `edition`, collector identifier and display order organize it. This is unrelated to A5 Gauntlet Publication Editions. |
| Release | Existing immutable content snapshot, dependency package and active pointer | Same preview, validation, accepted-action requirements, concurrency, deployment and rollback system. |
| Ownership | Existing gameplay entitlements and collector-variant counts | Gameplay ownership and appearance ownership stay separate. Selecting an appearance neither grants nor consumes either. |

`shared/duel-rules/printings.js` resolves an explicit printing only inside the supplied release catalog and checks that it belongs to the gameplay card. Missing legacy selection deterministically uses the card's existing standard/default printing. An explicit unknown or mismatched selection does not silently switch artwork. Server deck resolution, release pinning, client content-art lookup and deck selection use this resolver. Already captured game/replay presentation remains authoritative; history never resolves an old printing against today's metadata.

There is no destructive data migration. Existing standard and paid collector IDs, set IDs and account/deck records are retained. Repeatable collection normalization grants the same legacy standard appearance with gameplay ownership and never invents ownership of a new alternate printing. Valid legacy decks still work. A saved selection that is unknown or no longer entitled now returns an actionable `CONTENT_DECK_UNAVAILABLE` error while retaining the saved record, instead of silently replacing that selection with the default. Archive preserves resolvability and entitlement.

### Authoring and player workflow

Cards → Artwork lists the card's printings, with search, edition filtering, archived discovery, creation and duplication. New printings receive permanent server IDs. Supported fields are label, digital edition, collector identifier, display order, standard/foil finish, discovery status and exact artwork. Frames and card backs remain approved source assets. Comparison uses the actual card renderer and saved content; the existing field buffers, save controls, conflicts and navigation guards apply. The test subject includes the chosen printing without changing the card's mechanics.

The collector identifier is unique, case-insensitively, inside its digital edition, including archived records. Reuse in another edition is allowed. Unsupported fields, mechanics overrides, unknown images, wrong media and mismatched duplicate sources fail server validation. Edition membership links and ordering appear in Sets; source sets are inspectable but retain their source-controlled settings. Authored set labels, status and limited-format settings retain their existing controls. Printing membership does not add gameplay membership or change a limited pool. Related content shows the gameplay card, edition and exact image usage; player-owned decks and historical matches remain explicitly outside that derived index.

Publication review names the changed printing and fields, resolves edition names, compares artwork and states that presentation editing changes neither ownership nor acquisition pools. New printing acquisition is explicitly unavailable. There is no new grant policy, purchase product, price or distribution control. Existing paid variants keep their existing entitlement policy; new alternates require an explicit count in the existing collector entitlement map. The minimum player integration exposes owned alternates in the existing Styles view and Card version selector, persists them in saved decks and carries them into the real game factory. Browser tests seed an entitlement only in isolated fixture data; this is not a production grant interface.

Earned packs and Draft/Sealed select gameplay-card identities, not printing rows. Paid pack generation still requires the existing paid acquisition contract; new rows are excluded. Tests compare the complete eligible card/rarity/faction and collector-variant lists, rather than estimating probabilities from a few pack draws. Existing limited sessions keep their captured pool/content. Deck quantity, faction and printed slot validation still uses the gameplay card; passing a printing ID as a gameplay ID cannot create another slot or copy. A rollback that would lose a published printing/set/card, change a printing's owner or invalidate protected deck identities is refused. Compatible rollback retains later bytes and account references.

### Asset capacity and publication prerequisites

The asset picker now reports used/remaining bytes and versions, distinct blobs, encoded image bytes, upload-catalog metadata size and formatted state payload size. Limits are unchanged:

| Limit | What counts |
|---|---|
| 3 MiB per incoming file | Decoded upload input length before image processing; PNG/JPEG/WebP only. |
| 1 MiB per normalized image | The retained WebP output, after decoding, pixel limits and normalization. |
| 6 MiB retained images in the authoring store | Sum of distinct SHA-256-addressed normalized byte blobs across current, draft, archived and historical uploads. It is aggregate storage, not a per-file allowance or total publication-payload limit. |
| 500 retained image versions | Distinct immutable version records, including separate versions that happen to share identical bytes. Reusing a reference in a printing or release creates neither a version nor another blob. |
| 16 MiB GitHub content payload | The provider's serialized JSON file, including base64, content snapshots, retained image bytes, dependencies and metadata. This independent check can be reached before the image allowance. |

The original file is not retained; its digest is metadata. The normalized WebP is the only generated image: no separate thumbnail or other derivative bytes exist. Metadata and base64 overhead do not count toward 6 MiB, but do count in serialized state/publication files. Private upload labels and provenance stay in private authoring state; public packages carry delivery metadata and immutable bytes. Source artwork and the four approved backs (1,285 dependencies, 117,268,577 bytes) are separate build assets and outside this upload allowance. Multiple references share the same digest-keyed blob inside a state/package; successive immutable Git commits/packages may contain that blob again. This is not a promise about GitHub's physical storage deduplication.

At the maximum processed size, 6 images consume the byte allowance; at 100 KiB each, roughly 61 distinct images fit. These examples exclude metadata/encoding and do not predict typical compression or override the independent payload cap. Up to 500 very small version records can hit the version limit first. Archiving never frees retained history. At a limit, reuse an existing version; the next viable expansion is a separately reviewed private content-addressed storage adapter with immutable public release delivery, equivalent integrity/retention tests and a smaller metadata-only Git package. No limits were raised, old versions deleted or infrastructure provisioned.

The GitHub provider needs a credential with existing publishing permissions **and a verified private repository** for private uploads. A token alone does not satisfy privacy. The repository's `private` flag is checked before uploading; public or unverified targets fail with an actionable 503 and save no image bytes. Missing credentials surface the existing connection-required state. The implementation never changes repository visibility. Existing production connectivity, privacy, payload headroom and cross-origin delivery remain unverified. The file-provider journey runs in an isolated local directory and survives a process restart; production file use still needs durable storage.

### Security disposition

See [the complete dependency audit and disposition](admin-dependency-audit.md) for package versions, advisory IDs, dependency paths, context and unresolved risk. Compatible updates cleared all reported critical findings and leave root/server audits at zero. The client audit still reports 99 affected packages (0 critical, 63 high, 33 moderate, 3 low), propagated from 13 directly advised packages in the CRA toolchain. These findings remain production-readiness blockers, including build/CI execution; being development tooling is not an exemption. No force-upgrade or suppression was used. A controlled toolchain migration/backport and deployment-specific verification are required before any production-readiness claim.

### Verification and remaining scope

Final measurements and browser evidence are recorded below after the final integration run. Raw logs and fixture results live under ignored `artifacts/printings/`; tests and this capability map are source-controlled deliverables. The isolated server journey compares deterministic real-engine results while excluding presentation fields and the checksum derived from presentation-bearing replay frames. Game instance IDs, seed, timestamp, executable definitions, counters, effects and outcomes are otherwise held constant. Later Rumin arm-bonus changes affect both printings in new games; old game definitions and persisted replay presentations remain pinned.

No push, merge, deploy, external publication, visibility change, infrastructure provisioning or production data mutation is authorized or performed for this milestone. Full historical renderer/CSS versioning and reconstruction of uncaptured legacy presentation are still unsupported. New printing acquisition/grant policy is unresolved and intentionally blocked. Rumin composition is still bounded to the previously implemented vocabulary; printings add no mechanics.

Next dependency-ready content milestone: authored deck/template creation, using the now-stable gameplay/printing/release boundaries and preserving existing pool and ownership rules. New factions, campaigns, structural encounter authoring, broader mechanics and website prose remain roadmap work. Security toolchain remediation and production prerequisite verification are parallel release prerequisites.

Legacy source variants use presentation edition labels such as `foundation`, which do not name a Draft set. Those labels and the existing paid/free variant semantics are preserved. New printings select an actual existing digital set ID; source edition labels are not silently migrated or used to create a second edition registry. Standard defaults remain usable under legacy gameplay ownership, paid variants still require their explicit count, and newly authored alternates are explicitly entitlement-gated even though they are not a paid product.

Some approved source card-face images also contain legacy baked-in names: the fixture's default image reads “Vault Shield Bearer,” while its current gameplay record and composed alternate read “Rumin Sentry.” The comparison intentionally retains the approved source image. This existing presentation discrepancy is not a second gameplay definition, and this milestone does not repaint source artwork or claim to repair baked-in legacy copy.

### Production-readiness checklist

- [x] Clear critical findings and run compatible root/server dependency fixes.
- [ ] Resolve the remaining CRA build/test/development advisories; verify clean installation and all release gates after migration.
- [ ] Verify deployment proxy topology, actual private repository and GitHub permissions.
- [ ] Verify production persistence, backend/frontend compatibility and immutable cross-origin image delivery.
- [ ] Decide and implement an explicit acquisition/grant policy before distributing newly authored printings.

Newly started Draft and Sealed rooms now persist their full resolved public release alongside generated packs. Later match creation uses that binding, including after room persistence; private draft data or image bytes are not exposed by the public limited-session projection. Legacy running rooms with only a release ID can continue when it matches active content. If it differs and the full binding is missing, match creation refuses explicitly, retains the pool and requires restoration of its original content; it never guesses current rules for that pool. This compatibility case must be reviewed before a production rollout. Existing saved limited decks used outside the original event retain their established current-release behavior.

### Milestone 4 measured evidence

The final isolated printing journey creates a real authored edition and alternate printing for Rumin Sentry, selects uploaded blue B, saves/reopens the draft, compares P1/P2 with the production card renderer, executes a printing-bound test action, publishes locally, saves an explicitly entitled P2 in a real 52-card deck and executes an accepted attack from that deck's actual game-factory instance. A later purple C revision changes new games; both old/new captured frames render through the production replay adapter and WebGL table after compatible rollback and a real service restart in a fresh browser. The replay envelope is a fixture around genuine captured states, not a production archived-match availability claim. Mechanics equivalence and later shared armBonus revision are separately asserted deterministically in the server journey.

Both printing/immutable-asset journeys passed together (2 tests). Screenshots and IDs are in `artifacts/printings/browser/`, with `journey.json` identifying P1, P2, edition, both exact image versions and the persistent test directory. Visual inspection confirmed the blue selected printing in the saved deck and the retained blue/purple revisions on the replay battlefield. Phone layout was checked at 390 pixels; comparison uses saved content, never unsaved form values.

The fixture's two flat-color WebP images total 448 stored bytes, with 600 base64 bytes and 1,177 bytes of upload-catalog metadata. The complete formatted state is 1,919,228 bytes across the baseline and two authored releases. These are tiny test images, not a typical artwork compression estimate. Remaining capacity is 6,291,008 raw bytes and 498 versions; `capacity-evidence.json` records the exact accounting. Repeated references and later releases do not duplicate blobs inside the retained store. The reported metadata meter measures upload-catalog records; the full state-payload meter also includes publication/history and idempotency bookkeeping.

| Final check | Outcome / evidence |
|---|---|
| Full server suite after release-binding changes | 361 passed; `artifacts/printings/server-suite.log` |
| Full client JavaScript suite | 676 passed, 83 suites; `client-suite.log` |
| Replay JSX suite | 7 passed; `replay-client.log` |
| Final affected UI tests after label/guard refinements | 23 passed; `final-ui-regression.log` |
| Qualification | 42 passed; `qualification.log` |
| Content validation | 144 cards, 1,281 manifest entries, 1,285 delivery dependencies including backs; `content-validation.log` |
| Printing / immutable-asset browser journeys | 2 passed on final build; `browser.log` |
| Existing Admin browser coverage | 18 passed in the full run; the remaining test passed on focused rerun after updating its expected printing-bound subject label; `admin-browser.log`, `admin-printing-subject-regression.log` |
| Existing player workshop browser coverage | 5 passed on the final compiled build, including desktop/mobile deck selection, saving and card views; `player-browser.log` |
| Syntax and whitespace checks | Passed; `syntax.log`, `diff-check.log` (Git emits informational line-ending warnings) |

The compiled Admin fixture build measures:

| Gzip metric | Bytes | KiB | Ceiling |
|---|---:|---:|---:|
| Main | 183,753 | 179.4 | 180, unchanged |
| Player JavaScript | 753,712 | 736.0 | 748, unchanged |
| Initial Admin | 18,897 | 18.5 | 20, unchanged |
| Deferred Admin | 42,993 | 42.0 | Included below |
| Total Admin | 61,890 | 60.4 | 61 |
| Largest async | 286,802 | 280.1 | 350, unchanged |

Total Admin increased by 2,293 bytes (2.24 KiB) from the previous 59,597-byte measurement. The explicit 59 → 61 KiB allowance covers printing search/edition controls, creation/duplication/comparison, scope disclosure and capacity reporting. Every named Admin split remains counted; initial Admin and player ceilings were not raised. Compatible compiler/transitive updates also reduced the measured player aggregate by about 11.8 KiB; this is a build-size observation, not a performance benchmark. Builds compile successfully, with the existing Node fs.F_OK deprecation warning.

The final player-fixture rebuild differs only in its loopback API address: main is 183,751 bytes and player aggregate is 753,710 bytes; all other measurements and rounded KiB figures above are unchanged. `final-budgets.log` and `final-bundle-metrics.json` record the passing result. The player suite's 19 generated screenshots are preserved in ignored `artifacts/printings/player-evidence/`; only its generated evidence changes were restored, after confirming those evidence directories were clean before the run. The combined browser coverage is 26 distinct passing cases (19 Admin, 2 printing/assets, 5 player).

Intermediate failures remain in raw logs for diagnosis: the new browser test originally used a label polluted by option text (fixed with an explicit accessible label), and a publication response exceeded 15 seconds during simultaneous full-suite I/O. The final journey waits for the real publication result with a bounded timeout and passed without competing full-suite load. The player selector unit fixture was corrected to include the gameplay identity present in actual server responses, preserving strict mismatch rejection.
