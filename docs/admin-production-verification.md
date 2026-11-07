# Admin production verification

Qualification date: 7 November 2026; final code checkpoint `1c5a8df`. All writes, purchases, repairs, releases and recovery experiments below use isolated fixtures. No production account or shared production draft was changed. Final GitHub workflow results are attached to [PR #104](https://github.com/BurntRamen/gauntlet-online/pull/104/checks); require passing checks on the reviewed code before merging.

## Automated and browser evidence

| Gate | Result |
| --- | --- |
| Complete client suite after dependency updates and final fixes | 120 suites, 911 tests passed together; build-tool suite 4 passed. |
| Complete server suite | Initial local run: 624/625 passed. The remaining assertion expected an obsolete FFA error; corrected assertion passed. GitHub CI subsequently passed the complete server step. |
| Crash recovery through actual production startup | Passed: killed a server during an active game/draft; replacement with a fresh filesystem recovered exact captured state and purchased entitlements/ledger records. Database outage denied further commands. |
| Full private project recovery | 2 passed against executable PostgreSQL and an isolated object store: fourteen app-owned tables, credentials, portraits, social records, layouts, private drafts, hidden runtime states, canonical archives, lost replies, corrupted/missing bytes, owner-only empty-destination import and atomic rollback. |
| Main Admin browser matrix | All 25 distinct cases passed locally across the initial run and focused rechecks; the complete CI step then passed. Corrected the missing mode-prose preview and stale name-save notice assertion; retained per-action deadlines while allowing full release journeys sufficient time. |
| Production guide, website header and player repair browser flows | 3/3 passed together after correcting a skipped heading level and readable repair labels. Includes mobile Axe checks, edit guards, filter/section resumption, actual player prose publication/rollback, unauthorized denials, a reviewed repair and retained audit evidence. |
| Extended mechanics/campaign/cosmetic/payment browsers | All seven journeys covered. Five passed initially; a closed connection in the test interceptor interrupted the modifier save and left a draft that correctly blocked the subsequent publication. The interceptor now closes its transport after each write and never retries mutations. Modifier/payment rechecks passed together with the strengthened Sheen-family creation → engine → publication → actual campaign case (3/3). |
| Printing/media and exact deck-product delivery browsers | Immutable-media release/rollback/restart passed. The complete printing journey then passed its focused recheck, including ownership, saved deck and captured real-game presentation. Both account-currency and finite-Gold deck purchase/restart journeys passed together; Gems/split-price/refund passed separately. Initial printing/deck runs exceeded a 5-second cold-readiness expectation; these configurations now use the existing main Admin gate's 15-second expectation. |
| Immutable content validation | Passed: 644 cards, 1,850 immutable references and 1,854 delivery dependencies. |
| Root qualification checks | 53 covered, including six updated bundle-budget assertions. |
| Production build | Compiles without warnings; main 178.4/180 KiB, player 758.4/759, initial Admin 18.3/20, total Admin 65.8/66, largest async chunk 274.2/350. |
| Dependency audit | Root, server and client runtime clean. One unpatched low-severity Jest dependency produces five tooling-chain entries; see [security check](admin-production-security-check.md). |

The main Admin matrix covers both approved identities, direct unauthorized requests, phone layouts, keyboard use, shared-draft conflicts, stale tests, live/custom testing, asset selection, creation of a set/card, mechanical execution, publication/rollback, earned Gold purchases/refunds, Ranked season terms and actual Para event settlement. It is not a claim of one uninterrupted clean local run.

Final compiled regression checks passed: browser Forward/guarded departure three consecutive times, keyboard context and second-operator conflicts (2/2), and the production journeys (3/3). The modal now contains browser-restored/programmatic focus. The two player regression journeys also passed: campaign music follows the selected faction, survives dialogue pause/resume, switches faction and returns to menu music on exit; the responsive dock retains the same canvas and usable-area/non-overlap requirements across four viewports. Its measurement waits for the HUD resize observer rather than sampling the intermediate viewport state. Earlier CI failures and their corrections are retained in the PR history, not represented as an uninterrupted green run.

Three additional socket tests cover v2 paid controller choices, persistent reconnect/deadline handling, timeout without payment, duplicate commands and explicit opposing-player semantics in four-player combat. Unit and PostgreSQL tests exercise the remote storage adapter; browser tests exercise the common UI with isolated providers. They are distinct kinds of evidence.

## Repeatable commands

Run root `npm run test:server`, `npm run test:client`, `npm --prefix client run test:toolchain`, `npm run check:content-release`, `npm run build:client` and `npm run check:bundle`.

Run the browser configurations sequentially: `playwright.admin.config.js`, `playwright.production.config.js`, `playwright.phase2.config.js`, `playwright.printings.config.js`, `playwright.purpose.config.js` and `playwright.gems.config.js`. The Admin workflow builds its compiled client with the fixture socket URL. Reuse that build with `GAUNTLET_ADMIN_USE_BUILD=true` for compatible configurations. To avoid another worktree, set `GAUNTLET_ADMIN_FIXTURE_PORT` and `GAUNTLET_ADMIN_CLIENT_PORT`, and compile with the matching `REACT_APP_SOCKET_URL`. Never reuse another checkout's running fixture.

Focused recovery commands:

```sh
node --test server/test/remote-room-process.test.js
node --test server/test/project-recovery.test.js
```

## Visual review

Representative screenshots are retained in [the review gallery](reviews/admin-production/README.md). Browser runs additionally generate `artifacts/admin-production-player-prose.png` and engine, campaign, printing and purchase evidence. Desktop production paths and the 390px workspace/player repair displays were inspected for hierarchy, overflow, readable labels and separation of draft versus immediate actions. Axe checks pass on the production guide and player profile.

## Not established by these checks

- Production migration, new configuration or deployment; neither a production authoring mutation nor a production recovery drill was performed.
- Owner-connection `psql` restoration into an actual separate Supabase project followed by a complete playable application disaster drill. The SQL/object recovery path and real process restart path passed separately.
- Live payment charging; the approved provider/account remains absent and checkout stays disabled.
- Undefined encounter victory/loss semantics or unsupported FFA decision queues. These remain explicitly unavailable.
- Unlimited scale: runtime is a single writer with bounded snapshots and media/backup budgets. Independent export retention remains an operational responsibility.
