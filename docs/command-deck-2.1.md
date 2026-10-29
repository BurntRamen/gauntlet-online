# Command Deck 2.1 implementation report

The player menu hierarchy is replaced by a compact Command Deck. Play is the ordinary entry point, with eight primary game actions arranged for visibility at the target desktop sizes. The current release is **prepared pending final release checks**. Menu customization is disabled; this release requires no layout database migration.

## Latest release candidate — October 29

Action cards show **titles only**. Artwork fills the entire card and stays bright; a light text shadow protects the lettering without a dark image overlay, gradient plate, or separate text panel. The click outcome remains available as an accessible description. Desktop Play uses four columns to show more of each illustration while keeping the eight main choices together. Smaller screens retain two columns and a compact introductory panel. The complete campaign catalog remains scrollable.

The latest pass adds **17 distinct neutral illustrations**. Together with existing assets, all **27 unique action IDs have their own image**; a repeated action retains its identity across menus. The three illustrations from the previous pass—duel station, tournament dais and drafting workbench—remain in use. New subjects distinguish invitations, ranked play, official competition, collection, earned packs, saved draft decks, replays, records, social actions, training and references. These are interface illustrations, with no invented faction identity, named lore, mechanics or promised rewards.

Exact prompts, built-in generation method, original source paths and saved WebP paths are recorded in the [core-menu artwork manifest](generated-assets/distinct-menu-art-root.json), [collection and profile artwork manifest](generated-assets/distinct-menu-art-profile.json), and [social and learning artwork manifest](generated-assets/distinct-menu-art-deck.json). The [earlier three-image manifest](generated-assets/command-deck-menu-art-2026-10-29.json) retains their provenance. Generated PNG originals are preserved.

Faction lore now has a searchable illustrated index, a prominent faction hero, compact record facts, section navigation and clearer story, figure and chapter presentation. It uses published faction content and the faction's own artwork where available. XenDra and Voltari use neutral fallback presentation instead of borrowing another faction's identity. The profile presents the player's portrait, actual progress, record and library actions more clearly, while retaining account, portrait, cosmetic and featured-deck controls.

The header exposes persistent menu-audio mute on desktop and mobile. Its pressed state, icon and tooltip communicate the current state. It shares the Settings master mute; unmuting also clears an existing account mute override.

Existing deck customization is preserved. The deck editor still offers card-back selection and the Deck settings box picker. A real API browser regression selected a card back and Obsidian box, saved and reloaded the deck, then changed to account-default card back and Faction box on mobile and confirmed persistence again. The editor also restores the active saved deck when account loading finishes after the editor opens; later account refreshes preserve an intentional unfinished New deck. Menu layout customization is a separate feature and is disabled in this release.

Final client validation: **879 tests passed** in 113 suites, followed by **15 focused campaign identity tests**. Full-source lint and the final isolated production build passed; main is **176.3/180 KiB**, player JavaScript **752.7/759 KiB**. All 27 action images have unique content hashes. Browser checks confirm core navigation/desktop fit, profile editing, card-back/box persistence, default-disabled menu customization, and 32 faction surfaces without known cross-faction artwork. The full server suite passed **575 tests** before the final Admin response repair; all **12 content-publication tests** passed after that repair. Hosted release status is tracked in PR #92.

Release checks exposed oversized Admin responses: every card repeated all 644 effect definitions. The authoring response now includes only the same faction/type choices already permitted by that card's editor, without changing validation metadata, engine behavior or published content. Regression tests cover response size and refreshed choices after saving an authored card's faction or type. Workshop browser tests use six isolated fixture accounts so the added cosmetic regression does not exhaust production signup limits; those limits remain unchanged.

Earlier iterations passed focused menu/audio tests, the complete client suite, navigation/reflow checks and deck-cosmetic persistence checks. These establish regression coverage but do not substitute for the final release checks. Historical qualification results below are retained as earlier evidence.

Latest previews: [Play desktop](reviews/command-deck/artwork-play-desktop.png), [Compete](reviews/command-deck/artwork-compete.png), [Decks](reviews/command-deck/artwork-decks.png), [Campaign](reviews/command-deck/artwork-campaign.png), [Draft](reviews/command-deck/artwork-draft.png), [Play mobile](reviews/command-deck/artwork-play-mobile.png), [Compete mobile](reviews/command-deck/artwork-compete-mobile.png), [Profile](reviews/command-deck/profile-final-1280.png), and [Faction lore](reviews/command-deck/lore-viewport-1280.png).

![Command Deck with distinct full-card artwork](reviews/command-deck/artwork-play-desktop.png)

## Player experience

| Area | Result |
| --- | --- |
| Global navigation | 190px desktop rail, 60px header, five labeled mobile destinations, accessible More sheet, Profile and Settings. Server-authorized Admin remains separate. |
| Play | Contextual resume/invitation/campaign/practice action, eight explicit action tiles, active deck, actual recent match/replay when available. |
| Private tables | Direct Duel creation; Free-for-All, room code, Join as Player and Spectate on a focused screen. Existing sharing and room lobbies retained. |
| Ranked | Classic/Faction format, BO1/BO3, faction, General, applicable saved deck, explicit queue/leave actions. Deck editor returns to the retained setup. |
| Draft | Published set and availability, Live Draft, Bot Draft, Sealed and their saved-deck Limited League queues. |
| Campaign | Actual published factions and progress, Continue Campaign, quick references, preserved chapter briefings, dialogue and lore. |
| Decks and cards | Active deck/editor, card-back and deck-box selection, collection, earned packs, collector purchases, saved versions/legality, Draft/Sealed library. Unsaved edits warn before leaving. |
| Competition | Separate Ranked, Events, Para League and Standings destinations using existing server data and eligibility. |
| Matches | Opponent/result/format/date first; record and replay actions distinct; local/cloud provenance, imports, exports and transcripts retained. |
| Community | Direct Friends, Challenges, Messages and Invitations views, persistent actionable notices and actual unread counts. |
| Profile and Settings | Account/recovery controls, record, Gold & Library, portrait/cosmetics/featured decks, audio, helper labels and gameplay shortcuts. Menu layout controls are disabled. |

Browser navigation preserves invitation, public match/replay/profile, claim, recovery and Admin links. Active queues remain visible while browsing. Existing gameplay handlers, engines, rewards, economies, content and operator authorization are reused. Draft sign-in returns to Draft, and published Admin presentation overrides still reach the corresponding focused player screens.

## Menu customization release gate

Menu layout customization is **disabled by default**. Normal builds use StaticLayoutProvider: menus retain their default ordering and visible actions, ignore saved guest/account layouts, and never initialize the layout-storage or account-layout request hook. More, Profile and Settings do not expose Customize, layout reset or layout preferences controls. This does not disable card backs, deck boxes, portraits, card printings or other existing player customization.

The unfinished Layout Studio remains in the codebase for explicitly enabled review builds only. REACT_APP_MENU_LAYOUT_CUSTOMIZATION=true opts into that review path; the dedicated Command Deck customization test configuration sets it explicitly. The release-menu browser configuration forces it off and checks a signed-in account across destinations, including default order, ignored saved preferences, absent controls and zero layout storage/network access.

**No layout database migration is required or executed for this release.** The dormant authenticated layout API and [command-deck-layouts.sql](../server/migrations/command-deck-layouts.sql) are unused by the default player menus. Any later decision to release account layout persistence needs its own deployment review and migration readiness checks.

Historical opt-in implementation: handle-only dragging, keyboard/touch movement, hide/show, confirmed resets, guest storage, versioned account persistence and conflict recovery were tested during development. Those capabilities and their historical screenshots below describe the gated review path, not the current player-facing release.

## Historical qualification results

These results cover earlier implementation revisions, including the opt-in Layout Studio. Final release results belong in the latest-release section above.

- Server: 574 tests passed, 0 failed, 0 skipped, including original gameplay/account/Admin integration coverage.
- Layout/storage: guest fallback, schema bounds, stale scopes, account conflicts, delayed saves, private SQL grants/RLS, backup/restore and local concurrency exercised. The migration was executed only in an isolated PGlite test database.
- Client full run: **110 suites and 851 tests passed** with `--runInBand --testTimeout=20000`. An earlier run had six failures from an obsolete lore assertion and timing-sensitive tests while the server suite was running concurrently. The obsolete assertion was corrected; the final full run and targeted regression runs passed.
- Final focused client checks: **8 suites and 107 tests passed** after the published-copy, heading-level and sign-in refinements. A final **48 menu/shell tests passed** after preserving custom overlines and descriptions. The dedicated server prose checks also passed all 3 tests.
- Qualification: 52 tests passed. Content validation verified 644 cards and 1,814 immutable asset references.
- Command Deck browser suite: **12 scenarios passed in the final consolidated run** covering core menu journeys, native dragging and alternative controls, resets, invitations, real queues, account isolation and cross-context persistence, blocked-storage round trips, campaign briefings and guarded deck editing. Screenshots and desktop measurements were refreshed from this run.
- Existing browser usability suite: **6 scenarios passed**, including two live clients, reconnect, faction abilities, spectator privacy, context loss and renderer recovery, keyboard access, responsive layout and reduced motion.
- Deck workshop suite: **5 scenarios passed** across the initial run and targeted rerun. The run exposed generic shell button styles overriding compact deck-card sizes; the shell now leaves the card grid's measured styles intact. Tests cover rename/version behavior, swaps and boxes, responsive previews, collector card display, full rules and sequential pack reveals.
- Migrated player-flow and Draft regressions: **21 scenarios passed** across the initial run and targeted rerun. These include all 39 Bot Draft picks, saving and retry, Limited League entry, invitation entry, startup recovery, returning after sign-in, queue/account isolation, replay export/import, four-player matches and disconnected Draft recovery. Initial failures from retired heading expectations, the startup fixture and heading-level accessibility were corrected and the affected cases rerun successfully.
- Existing collection, economy and Admin browser fixtures now use the replacement menus and retain their underlying assertions. The complete Admin/economy/renderer CI matrix was not rerun locally; those checks remain in the PR workflow.
- Earlier desktop geometry: the eighth action ended at 711.47px in a 768px viewport and 692.47px in a 720px viewport. The [measurement file](reviews/command-deck/above-the-fold.json) is refreshed for the current candidate and may differ from these historical values.
- Reflow and axe checks: 320px, 390px, 820px tablet, and 683×384 CSS viewport as 200%-equivalent desktop reflow; keyboard focus, More sheet, reduced motion and horizontal overflow checked. Actual browser chrome zoom and physical assistive devices were not separately exercised.
- Production build and all existing bundle budgets passed: main **173.1 / 180 KiB**, player JavaScript **748.6 / 759 KiB**, largest async chunk **274.2 / 350 KiB**, initial Admin **17.3 / 20 KiB**, all lazy Admin **61.0 / 61 KiB** (gzip, rounded). The menu and Layout Studio load in a dedicated lazy chunk; budget ceilings were unchanged.

Run `npm run test:e2e:command-deck` for the isolated opt-in customization suite. Run `npx playwright test --config=playwright.release-menus.config.js` for the default-disabled release gate. Both use ports 3110/4110 and local test accounts, so run them sequentially. Standard build, bundle, client, server and content checks remain available. Browser tests create only local test data.

## Historical review images

The following images document the earlier implementation, including the gated layout editor. Use the latest-preview links above for the release candidate.

Before desktop:

![Previous player menu](reviews/command-deck/before-desktop.png)

Command Deck at 1280×720 (full-page capture; the eighth action is above the 720px fold):

![New Play Command Deck](reviews/command-deck/after-desktop-1280.png)

Mobile navigation and editing:

![Mobile Play](reviews/command-deck/after-reflow-390.png)

![Mobile layout editor](reviews/command-deck/after-mobile-editing.png)

Additional views: [Campaign](reviews/command-deck/after-campaign.png), [Chapter briefing](reviews/command-deck/after-campaign-briefing.png), [Decks & Cards](reviews/command-deck/after-decks-cards.png), [Deck Editor](reviews/command-deck/after-deck-editor.png), [Draft](reviews/command-deck/after-draft.png), [Compete](reviews/command-deck/after-compete.png), [Ranked Setup](reviews/command-deck/after-ranked-setup.png), [Matches](reviews/command-deck/after-matches.png), [Community](reviews/command-deck/after-community.png), [Learn & Rules](reviews/command-deck/after-learn-rules.png), [Profile](reviews/command-deck/after-profile.png), [Settings](reviews/command-deck/after-settings.png), [More](reviews/command-deck/after-more.png).

## Historical review boundary

The initial implementation was based on main at d5778d6596588cea0d8f927adc53de89181e22ef; subsequent main integration and release work are recorded in Git history. The original checkout's pre-existing edits were preserved; the proposed changes live in a separate worktree and branch. Legacy menu components and their dedicated styles/tests were retired; shared gameplay styling remains.

No rule, reward, entitlement or economic behavior was redesigned. Layout preferences do not alter those stores. Live production event registration and purchases were outside that historical verification run. The current user request authorizes deployment after final release checks; the layout migration remains unnecessary while menu customization is disabled.
