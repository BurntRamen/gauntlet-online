# Gauntlet Admin — Design Workshops

Approved implementation plan, 3 October 2026. Planning baseline: `c192ef558cf6d96c4b7e58e648a09717c0090f30`.

This document records the approved design, implementation boundaries, module ownership, and acceptance criteria. It is not a production-deployment or final-validation certificate. The implementation extends the existing Encounter Workshop; the earlier recommendation to build it from scratch is obsolete.

## Architecture and constraints

Keep **Overview, Design, Players, Matches, Publishing, System** as the operational navigation. Design contains **Encounters, Cards, Engine / Rules, Other content**. Other content retains the existing campaign, character, faction-presentation, deck-template, mode-copy, and collector-presentation editors.

All workshops share **Live → Shared Draft → Validate → Preview/Test → Publish → Rollback**. `GauntletAuthoring` remains the single publication controller. There is one local editing context and one temporary real-engine session per operator. Workshop-specific layouts share small field, validation, preview, relationship, and navigation components rather than a universal form framework.

- Every Admin route and mutation remains behind the existing two-account stable-ID allowlist. No general role/permission system is introduced. Players metadata retains its separate guard and server authorization.
- Stable card IDs, faction, type, rarity, value, collector identity, campaign order, routes, and executable contract versions remain read-only.
- Card effects can change only to registered handlers with the same faction/type. Only declared bounded parameters can be edited. Registry defaults/implementations stay in source.
- Payment accounting, damage/target algorithms, priority sequencing, multiplayer, matchmaking, timers, progression, and rewards remain engine-controlled.
- No arbitrary JavaScript, uploader, mutable relationship database, second simulator, additional draft store, or new hosting service is introduced.
- Player-facing battlefield/readability work remains a separate stream. Shared card/briefing renderers may be reused without importing Admin into the player bundle.

### Editing context

Resolve unsaved edits before changing an object, workshop, related link, Publishing, Back, Close, or Refresh. Offer **Keep editing** or **Discard local edits and continue**; existing field saves remain available. Discarding local values never discards the shared draft. Block departure during pending saves or commands.

Preserve object selection, search/filter, active section, scroll, and return context after departure is resolved. URL state contains only workspace/object/section identifiers. Browser Back/Forward use the same guard; closing/refreshing the tab uses `beforeunload`. Do not promise recovery after the tab closes.

On a revision conflict, retain local values and their original revision, show the newly saved shared value, and require an explicit retry. Never silently rebase or overwrite another operator's edits.

### Real-engine test identity

Each test records subject, Live or Saved draft source, content hash, revision/release identity, rules/effect/faction/encounter/config/asset bindings, scenario identity, and setup hash. Show names first; complete identifiers belong in Technical.

Draft hash changes make draft tests stale; publication bookkeeping revisions alone do not. Live tests use their captured deployed content, never create draft receipts, and become visibly outdated when a newer release deploys. Stale/expired sessions retain evidence and disable execution. Create a valid replacement before retiring its predecessor. Keep owner checks and 30-minute expiry.

Custom starting states are explicit test fixtures, not claimed historical sequences. Configure factions, life (1–100), turn (1–1,000), priority, hands, three combat/support lanes, ordered remaining decks/discards, supported faction counters and turn context (nonnegative counters up to 1,000). Preserve the 52-card inventory and slot rules; generate instances server-side. Enter pending responses/combat and create tokens through accepted engine actions, not raw internal-state editing.

Command selection uses production legal-action descriptors for sources, ordered choices, payments, targets, and optional effects. Preview commands without mutation; execute only through the existing engine. Separate previews, recorded events, and observed state differences. Rejected commands do not advance a session or record publication evidence. An accepted action on the current saved draft preserves the existing publication gate; it does not prove exhaustive balance testing.

## Verified baseline and current implementation map

The baseline has eight authored domains, 126 cards and card-effect definitions, 10 faction-mechanics contracts, six boss abilities, 56 encounters, an immutable asset manifest, and 252 collector-presentation records. The only exposed card parameter is `armBonus` on three registered handlers, bounded 0–8. Rumin/Sheen each have one bounded faction parameter. Hand size (3–12) is editable; starting life 42, deck size 52, and three lanes remain fixed/derived.

| Area | Implementation modules |
| --- | --- |
| Existing publication authority | `server/authoredContent.js`, `contentPublication.js`, `githubContentPublication.js`; existing validation/preview/test gates and immutable rollback retained |
| Shared UI/context | `client/src/GauntletAuthoring.js`, `GauntletAdmin.js`, `admin/useWorkshopContext.js`, `admin/UnsavedChangesDialog.js`, shared Workshop components |
| Encounter workflow | Existing `EncounterWorkshop.js`, `GauntletContractFields.js`, and `server/encounterAuthoring.js` extended |
| Card, rules, assets, release and match panels | `client/src/admin/CardWorkshop.js`, `EngineWorkshop.js`, `AssetPicker.js`, `ReleaseReview.js`, `RelatedContent.js`, `MatchInspector.js` |
| Scenario/actions/evidence | `server/adminPlaytest.js`, `adminTestScenarios.js`, `adminPlaytestActions.js`, `adminPlaytestEvidence.js`; `GauntletPlaytest.js` and `admin/ScenarioBuilder.js` |
| Private workshop projections | `server/adminWorkshopData.js`, `adminLiveAvailability.js`, `adminCardAuthoring.js`, `adminRulesAuthoring.js`, `adminContentRelationships.js`, `adminReleaseReview.js`, `adminMatchDesign.js` |
| Contract declarations | `server/adminWorkshopContract.d.ts`, `shared/duel-rules/contentContracts.d.ts` |
| Bundle qualification | `scripts/check-build-budgets.js`, `scripts/check-build-budgets.test.js` |

This mapping describes the implementation locations, including modules being integrated. Final behavior is established by the acceptance checks below, not merely by file presence.

## Phases and acceptance

### 1. Consolidate protection and test identity

Extract shared editing/navigation context and an accessible departure dialog; preserve the separate Players guard. Add server-validated test subjects and explicit content bindings while retaining existing session ownership/replacement semantics.

**Accept:** every departure path can be canceled without losing values; discard affects local values only; pending requests block navigation; 409 retains the buffer/base revision; selected-object changes never relabel an active test; stale/expired evidence stays inspectable. **Risk/size:** medium. No authored schema migration.

### 2. Shared shell, navigation and relationship foundation

Introduce Design navigation, focused workspace shell/fields/validation/preview, direct named references, return context, and validated URL targets. Add private metadata/presentation/relationship/review projections. Synchronize type declarations with all current finite handlers.

**Accept:** direct links and Back restore object/filter/section; malformed targets fail helpfully; all new reads deny non-admins, use no-store, identify their source/hash, and reject stale requested hashes. The read-only presentation endpoint does not create a publication preview receipt. **Risk/size:** medium. Relationship foundation precedes workshops because Cards/Rules depend on it.

### 3. Refine the existing Encounter Workshop

Add campaign filtering and remembered context. Present Story, Opponent/Setup, Mechanics, Deck/Cards, Presentation, Validation. Keep `setup` one saved contract. Retain true progression-offset semantics, faction restrictions and 12 additions per side; do not invent a portrait field. Reuse the real briefing preview and factual evidence summaries.

**Accept:** existing encounter capabilities survive; bounds and validation locations are clear; related links return correctly; missing evidence reads “Not recorded”; mobile has no horizontal overflow or nested scrolling traps. **Risk/size:** medium. Depends on phase 2.

### 4. Live testing, scenarios and Card Workshop

First extend the isolated backend with Live/Saved draft sources, typed custom starting state, side-effect-free command preview, complete action descriptors, and recorded evidence. Then integrate Card Workshop, real card/suit/collector previews, separate wording/mechanics sections, effect-keyed shipped guidance and bounded parameters. Artwork edits patch existing collector-presentation `art`, never card ownership or a competing card field.

**Accept:** invalid/duplicate cards, illegal slots/counters and unsupported internals fail before replacing the session; Live tests write no draft receipts; preview mutates nothing; no rooms/accounts/rewards/history are touched. Test parameterized/parameterless/optional-choice effects and newer factions, real targets/payment, rejection retention, and exact subject labels. **Risk/size:** large/high. Depends on phase 2 contracts; integrate after phase 3.

### 5. Engine / Rules Workshop

Browse finite card effects, faction contracts, encounter abilities, shared configuration, tests and versions. Registry entries are read-only; every edit names an authored owner (card, faction, encounter, shared rules). Effect tests select a compatible card instance. Editable hand size must govern both initial draw and refill.

**Accept:** runtime registries appear completely; only supported owner fields are writable; fixed/derived configuration cannot be patched; representative faction scenarios expose actual counters/costs/choices. **Risk/size:** medium. Depends on phase 4.

### 6. One release review

Group saved changes into Story, Presentation, Mechanics and Game configuration. Flatten nested differences into named before/after values, with card names and artwork comparisons. Derive readiness from saved content, validation, exact preview hash and required accepted-engine-action receipt. Preserve existing GitHub checks, content-only merge/deployment, cancellation and rollback gates. Provide a read-only comparison before rollback.

**Accept:** mixed changes group correctly; unsaved UI buffers never appear as saved; later saves invalidate readiness; missing/stale receipts cannot publish; failed checks preserve recovery; release comparison never changes immutable history. **Risk/size:** medium. Depends on phase 5.

### 7. Relationships and impact

Complete one derived live/draft graph, cached by content hash and deployed contracts. Include card/effect/faction, campaign/encounter/opponent/template, collector-presentation and effective immutable asset references. Normalize asset aliases and derive deck additions from encounter-owned setup. Show added/removed/unchanged draft references.

**Accept:** aliases do not duplicate links; changes update “Used by”; stale responses cannot replace current results; missing references are explicit and not clickable. Clearly exclude player-owned decks, historical matches and dynamic engine references from exhaustive coverage claims. **Risk/size:** medium. Depends on phases 2, 4–6.

### 8. Shared asset browser

Provide lazy/paged thumbnails, search/media filtering, preview/audio controls, current/draft comparison, usage links and Technical immutable identity/digest. Keep manual reference entry under Advanced. Selection stays local until the existing field save. Preserve voice-line positions/null semantics.

**Accept:** wrong media types are rejected; cancel keeps the prior value; audio never autoplays; only visible/selected media loads; keyboard focus returns to the originating field. No upload/manifest mutation. **Risk/size:** medium. Depends on phase 7.

### 9. Historical match links

Extract readable match inspection and link captured events to card/effect/encounter workspaces. Historical names, definitions and artwork come only from captured evidence. Present Recorded in this match, Current live and Saved draft distinctly; explicitly mark unavailable historical definitions. Offer tests of current supported content, not an unsupported historical engine. Open replay in a separate tab.

**Accept:** later edits do not rewrite recorded evidence; legacy/missing bindings remain usable without guessed links; archive failures stay visible; Back restores event/filter/scroll context. **Risk/size:** medium–large/high. Depends on phases 4–7.

## Interfaces

New reads remain inside the mandatory private namespace, with a secondary approved-account-presence check:

- `GET /api/admin/workshops?source=live|draft&hash=…`: finite guidance, bounds, source identity, contract bindings and capabilities.
- `GET /api/admin/workshops/presentation?source=live|draft&hash=…`: real resolved presentation without writing preview evidence. Invalid draft presentation returns 422; guidance remains readable to fix invalid fields.
- `GET /api/admin/workshops/relationships?source=live|draft&hash=…`: canonical `domain:id` nodes and derived edges. Draft edges carry added/removed/unchanged status and the live comparison hash. Immutable media uses `asset-library`; collector presentations use `assets`.
- `GET /api/admin/workshops/review`: current saved-draft review/readiness.
- `GET /api/admin/workshops/releases/:id/review`: immutable release comparison. Publication providers expose a read-only cloned `releaseSnapshot(id)`.
- `POST /api/admin/authoring/playtest/preview-command`: isolated real-engine command preview. Existing start/command contracts receive additive source, subject and scenario support.

Keep existing requests backward-compatible where practical. No authored-content schema, database, account-permission or hosting migration is required. Deploy backend capabilities before dependent UI. Do not publish content/balance changes while shipping these tools.

## Delivery and validation

Execution order is **1 → 2 → 3 → 4 backend → 4 UI → 5 → 6 → 7 → 8 → 9**. Once phase 2 freezes interfaces, Encounter UI and scenario backend may proceed separately. Card UI may use fixed scenario fixtures while backend tests run. Asset presentation and historical-match projection may proceed after the relationship interface is stable. One integration owner controls authoring state, Admin navigation, shared styles, route registration and build configuration.

Gzip ceilings: **main 177 KiB; player JavaScript 740 KiB; initial `gauntlet-admin` entry 20 KiB; all `gauntlet-admin-*` JavaScript together 48 KiB; largest async chunk 350 KiB**. Count every named Admin split in the aggregate; source-map evidence of unnamed Admin splits or player imports fails qualification. Lazy-load specialized panels; reuse shared renderers rather than importing the full battlefield.

Run focused component/server tests during each phase, then the repository's complete server/client, qualification, content-validation, build-budget and browser gates. Final acceptance covers both permitted accounts; unauthorized direct requests; second-operator conflicts; desktop/mobile/keyboard/Back/unload behavior; Live versus Saved draft; custom inventory/slots/counters; payment/choices/targets; stale/expired sessions; release readiness/recovery; and historical match links. Record actual final counts, screenshots and bundle measurements with the release evidence after integration; this plan does not assert that those final checks or deployment have completed.

### Operational limitations

At the last production inspection, runtime GitHub authoring configuration and canonical match-archive storage were unavailable. Recheck status instead of assuming these have changed. Deploy credentials and runtime authoring credentials are separate. Browse/test capabilities must identify availability accurately; live-content testing must not require a writable draft provider. The plan neither adds credentials nor copies a developer credential into production.

Current match evidence availability still depends on the existing persistence/archive configuration. Missing canonical storage must remain visible. The authoring rollout adds no new storage system and does not claim complete historical coverage.

If a configured GitHub authoring connection fails, Admin exposes its captured deployed snapshot with `liveOnly: true`, no shared revision, disabled edits, and an explicit draft/history-unavailable message. Live metadata, presentation and engine tests do not read the remote draft. Existing draft/history reads and all mutations retain their normal failure behavior. Local unsaved values keep their original revision until authoring recovers. This fallback neither fabricates a saved draft nor supplies publication readiness.

## Approved first implementation prompt

> Implement phase 1 from current main in an isolated `codex/` worktree, preserving unrelated work. Extend the existing guards and Encounter Workshop rather than rebuilding them. Consolidate resolve-before-leaving behavior, retained navigation context and conflict buffers, keeping Players metadata separate. Add validated test subjects and explicit captured content bindings while retaining owner checks, expiry, replacement and existing publication receipts. Keep this phase draft-only; Live/custom setup follows in phase 4. Add focused departure/conflict/session tests and verify desktop, mobile, keyboard and unload behavior. Run applicable checks and measured bundle limits. Report actual evidence and remaining limitations. Do not deploy as part of phase 1.


## Implementation record — 3 October 2026

Implemented on `codex/gauntlet-design-workshops` in the existing isolated Admin worktree. The original checkout was not changed. All nine phases share the existing publication controller; no production deployment or authored-content change is included.

Some small components remain colocated with their owner: target parsing lives in `useWorkshopContext.js`, focused encounter setup controls in `EncounterWorkshop.js`, and bounded mechanics editing in `WorkshopField.js` / `GauntletContractFields.js`. This retains one setup save and existing field-level revision checks rather than introducing parallel editing state.

The private action projection supplements production legal-action descriptors with Hera and pending Jewel Bank block-payment choices. Eligibility is checked through the existing engine payment calculator. No payment or combat algorithm changed.

### Verified integration checks

| Check | Result |
| --- | --- |
| Client components and behavior | 83 suites, 669 tests passed |
| Server, engine, publication, authorization and archive behavior | 309 tests passed; includes engine equivalence and all 56 encounters |
| Qualification scripts | 41 tests passed |
| Main player browser flows | 36 passed; one existing opt-in baseline screenshot capture skipped |
| Player deck workshop / collector styles | 4 / 1 browser tests passed |
| Accessibility, recovery and responsive layout | 6 browser tests passed |
| Compiled performance safeguards | 1 browser test passed, with 10 desktop and 5 phone-emulation cold-load samples |
| Admin browser acceptance | All 15 journeys passed: 13 in the full run, then two corrected test expectations passed in a focused rerun |
| Content validation | Same release `gauntlet-content-968da29febd2a2a948cb2b478ac8a621d991b26267bef75c29136554a5dc9dc2`; 126 cards and 1,191 immutable asset references |

Admin acceptance uses isolated fixtures for both approved stable IDs, denied API callers, another operator's conflicting save, live-only authoring-outage fallback, guarded browser history, custom starting states, rejected/accepted payments, stale and expired evidence, release review/rollback, visual assets, and return to the same match event. Screenshots were checked for desktop and 390-pixel mobile layouts. No production service configuration was changed.

For the Windows checkout, the complete client test command specifies `--testMatch="**/src/**/*.test.js" --testMatch="**/src/**/*.test.jsx"` with `--watchAll=false --runInBand`; this avoids the existing default discovery issue with mixed path separators. The existing browser configurations exercise compiled builds and isolated account/match data.

The full browser verification covers 63 passing journeys/checks, plus the unchanged optional baseline-capture skip. Cold-load p95 was 2201 ms for desktop and 1929 ms for phone-landscape-emulation. These are local Chromium measurements with phone emulation; they do not claim physical-device qualification.

### Final production build

The optimized production build and every bundle gate passed. Main/player/largest-chunk ceilings are unchanged; every Admin split is included in the new aggregate cap.

| JavaScript metric | Gzip bytes | KiB | Ceiling |
| --- | ---: | ---: | ---: |
| Main entry | 181,161 | 176.9 | 177 KiB |
| Player JavaScript | 750,203 | 732.6 | 740 KiB |
| Initial Admin entry | 19,962 | 19.5 | 20 KiB |
| All named Admin JavaScript | 46,443 | 45.4 | 48 KiB |
| Largest async chunk | 292,685 | 285.8 | 350 KiB |

Deployment is intentionally not performed. Runtime GitHub authoring configuration and canonical match-archive availability remain operational dependencies; this implementation adds neither credentials nor storage. No content release was published as part of the tooling change.
