# Admin workspace review evidence

This is a local implementation review. Authentication, editing, testing and publication use the isolated `e2e/admin-server.js` fixture. No production account, content store, publication branch or deployment was changed by these browser journeys.

## Before and after

The before images were captured from the baseline specified in the brief at `b6d80ff4a85b751a7a8d91c59c6a644366d9535e`, using a separately built copy of its client sources. They are not historical screenshots from another revision. The local client and backend were explicitly bound to `127.0.0.1:3137` and `127.0.0.1:4137`. [Capture metadata](before/capture.json) records the source and observed request origins.

The after images come from this branch's compiled client, reconciled with current main `6498387` in merge `db4e157`, and fresh isolated fixture data, at `127.0.0.1:3138` and `127.0.0.1:4138`. The subsequent native 200% capture uses client `127.0.0.1:3188` and backend `127.0.0.1:4188`, avoiding ports taken by another local task after the twelve redesign journeys completed. Browser routing blocks every HTTP(S) request except the two declared local origins for each run. Each image is a viewport capture after fonts and visible image decoding settle. The primary comparisons use 1366 × 768.

| Workspace | Before | After |
| --- | --- | --- |
| Home | [Before](before/home-1366.png) | [After](after/home-1366.png) |
| Card: Dividend Yield Blade | [Before](before/card-1366.png) | [After](after/card-1366.png) |
| Deck: Standard playing deck | [Before](before/deck-1366.png) | [After](after/deck-1366.png) |
| Encounter: Brothers of Destiny | [Before](before/encounter-1366.png) | [After](after/encounter-1366.png) |
| Player: simply | [Before](before/players-1366.png) | [After](after/players-1366.png) |
| Publishing with a fixture draft | [Before](before/publishing-1366.png) | [After](after/publishing-1366.png) |

Additional evidence: [card preview](after/card-preview-1366.png), [authored deck composition](after/deck-composition-1366.png), [accepted engine action](after/encounter-tested.png), [wide desktop](after/card-desktop.png), [1280 × 720 laptop](after/card-laptop.png), [tablet](after/card-tablet.png), [phone](after/card-phone.png), [200% reflow equivalent](after/card-zoom-reflow.png), and [native 200% page zoom](after/card-native-200-percent.png).

## Workflow comparison

| Task | Previous interaction | New interaction |
| --- | --- | --- |
| Find the destination | Stacked area, workshop and secondary navigation, including “Other content” | Persistent seven-area rail, named Content destinations, contextual location and keyboard search |
| Edit several card fields | Repeated field save controls; section changes could enter the departure guard | Local record buffer across sections, one explicit scoped save with one server transaction |
| Inspect the result | Additional preview column competes with editor width | Labeled preview source and responsive editor/preview control, preserving the buffer |
| Leave unsaved work | General discard interruption | Keep editing, discard, or save and continue after acknowledgement; failed saves retain context |
| Resolve another operator's edit | Revision conflict blocks the save | Original, latest shared and local values are shown; choose a value before retrying |
| Return to work | Overview emphasizes diagnostics | Recent work, pinned items, supported creation, shared draft and actionable attention items |
| Resolve a release blocker | Locate the record and field separately | Direct field link, focused correction, scoped save and return to shared release review |
| Inspect player support | Dense overview and raw detail | Profile sections, readable campaign/deck/purchase/support evidence, explicit immediate correction scope |

## Reproduce the focused browser review

From the repository root, run:

```sh
npx playwright test --config=playwright.admin-redesign.config.js
```

The config builds with the explicit fixture backend and keeps player menu customization disabled. `GAUNTLET_ADMIN_USE_BUILD=true` reuses a client already built with `REACT_APP_SOCKET_URL=http://127.0.0.1:4188`; it must not be used with an unrelated build. The config defaults to client port 3188 and backend port 4188, requires free ports and does not reuse an existing server. Both the config and native zoom helper honor `GAUNTLET_ADMIN_CLIENT_PORT` and `GAUNTLET_ADMIN_FIXTURE_PORT`; the compiled backend URL must match. Temporary fixture state belongs under `.playwright-data/admin-redesign`; traces, machine-readable results and logs are ignored local artifacts.

The focused suite exercises multi-field atomic saving, preserved sections and browser history, correct preview source, creation/duplication, printing selection and comparison, keyboard search and focus restoration, operator-scoped preferences, player/match evidence, player correction departure, failed saves, concurrent revision reconciliation, exact-field validation recovery, accepted engine commands and freshness invalidation, and fixture publication verified against the public active manifest. The publication journey restores the fixture's baseline release afterward. Final current-main coverage combines three successful journeys from the targeted run with nine successful journeys from the complementary run. A repeated `ECONNRESET` during a read-only fixture inspection was resolved by the same bounded GET retry used in existing admin tests; mutation requests, HTTP status assertions and UI assertions remain strict.

The existing Admin matrix contains 37 journeys across `playwright.admin.config.js` (25), `playwright.purpose.config.js` (2), `playwright.printings.config.js` (2), `playwright.phase2.config.js` (7), and `playwright.gems.config.js` (1). The final local run used the same explicitly compiled backend on ports 3188/4188. Test navigation follows the new visible controls; saves still require server acknowledgement, and preview-to-review transitions wait for the successful preview response and ready status. Asset journeys wait for the active manifest body before entering the player collection. Immutable byte, ownership, engine-action, purchase, rollback and restart assertions remain intact.

The native browser zoom check is `node e2e/admin-native-zoom.cjs`. It requires the same local client and backend running with the fixture root `.playwright-data/admin-redesign` (or an explicit `GAUNTLET_NATIVE_FIXTURE_ROOT`). It creates a fresh ignored Chromium profile, selects 200% in Chrome's Page zoom setting, verifies the measured viewport/device pixel ratio, exercises keyboard search and the navigation drawer, and scans accessibility. It does not use a personal browser profile.

## Validation status

| Check | Result |
| --- | --- |
| Production client build, lint, compile and asset pruning | Passed after shared-editor consolidation with the explicit isolated backend; final release also reconciles optional appearance update `2ef9f1cc` |
| Full client tests | 121 suites, 935 tests passed after shared-editor consolidation and versioned guidance |
| Deferred catalog loading | 9 affected client tests passed, including first Content/Players access, direct links, navigation reuse and explicit refresh; final full-suite CI also includes the four new regressions |
| Full server tests | 597 passed, zero failures in CI on `646d2dea`, including the new guidance compatibility contract; the superseded run was canceled only after main advanced |
| Main reconciliation | 59 affected client tests passed across Admin, Studio, access, registry editing, match inspection, appearance eligibility, and PlayerShell; compiled appearance/dirty-exit smoke passed |
| Versioned guidance and workshop projections | 6 affected server tests passed, including authenticated writable and read-only outage responses, private access, and complete client guidance |
| Focused record-validation regressions | 49 affected server tests passed for `232ee6e`, plus 3 final schema/malformed-data checks; all 11 record-save cases covered |
| Qualification tests | 53 passed |
| Client toolchain tests | 4 passed after consolidation |
| Strict match-asset report | Passed; no cutover blockers or checksum mismatches |
| Focused redesign browser suite | 12 unique journeys passed on current main; final screenshots and preference coverage refreshed |
| Existing admin browser suites | All 37 unique journeys passed across the five configurations, including targeted reruns after navigation, heading and response-synchronization fixes |
| Native 200% browser zoom | Passed: actual 200% page zoom, keyboard focus, zero Axe violations and 1366×768 full-surface capture |
| Bundle checks | All five limits passed: aggregate Admin 71.3/75, main 178.7/180, player 755.0/759, initial Admin entry 14.4/20, largest async 274.2/350 KiB gzip |

The aggregate lazy Admin JavaScript is **71.3 KiB gzip against the operator-approved 75.0 KiB limit**. The original 61 KiB allowance had only 10 bytes of headroom in the captured `b6d80ff` baseline (62,454 of 62,464 bytes). The user approved a modest Admin-only allowance after reviewing the tradeoff, with fast loading as the requirement. All player limits and the 20 KiB initial Admin entry limit remain unchanged. Source-map accounting still rejects unnamed Admin chunks and accidental imports into the player bundle, and charges shared Economy code to both budgets.

The first redesign build used 74.5 KiB. Consolidating redundant imports within the existing lazy workshop boundary, registry edit-session behavior, typed value controls, and immutable field updates reduced it to 71.3 KiB without removing controls or workflows. All 56 relocated explanatory strings match their prior wording and add 5,735 raw bytes (1,503 gzip bytes in isolation) to the existing protected server guide, with no additional request; client behavior remains in counted JavaScript. There is no new rendering protocol or dependency. Home retains the small initial Admin entry, and the workshop code loads when needed.

Cold Home also defers the full private catalog until an authoring workspace or Players first needs it. The original request transferred 7,215,882 uncompressed bytes in the isolated fixture despite Home not consuming that data. Once requested, the catalog remains available across navigation and still reloads on explicit Refresh; direct Content and Players links request it immediately. This reduces unnecessary network, server and JSON parsing work independently of the JavaScript budget.

[Loading measurements](after/loading.json) record three fresh browser contexts plus a 4× CPU sample against the production build and isolated backend. Host-speed medians were 2.75 seconds to populated Home, 1.56 seconds for first Content, and 236 ms to open a selected editor. Typing took 26–73 ms through two animation frames with no typing long tasks in the host-speed samples. All four contexts confirmed that Home requested neither the catalog nor the workshop chunk. The local server sends uncompressed assets without caching; these are local QA measurements, not production latency or field INP. Host variability prevents a before/after timing claim, and the slower 4× CPU results remain in the evidence. The verified improvement is removing Home's unnecessary catalog download and parsing work.

The corrected Gold/Para release pair passed together after a CI trace revealed a click before the save response body completed. The helper now waits for the completed response, enabled editor, and saved editor/shell states. Cleanup covers setup failures too, preventing a failed Gold setup from leaving a draft in the next journey. Purchase, ownership, archive, refund, seed and rollback assertions remain intact.

Main advanced to `2ef9f1cc` during release checks. The reconciled build preserves its optional account-scoped SuitFire choice and the redesigned Admin shell. The [compiled appearance smoke](after/appearance-smoke.json) used a disposable local fixture with the allowlisted account identity, selected the appearance through Settings, reloaded it, and verified Admin labels plus Keep/Discard on dirty exit. Switching back restored Gauntlet branding; a public guest retained the default appearance and had no Admin access. No authoring mutation or revision change occurred.

Record saves require `PATCH /api/admin/authoring/record`, and the updated guidance requires `guide.workspaceVersion: 1`. Deploy the server before or with the client. During a mixed-version rollout, the client explicitly reports that the Admin update is deploying and withholds editors until refreshed compatible guidance arrives; the compatibility regression verifies recovery. Final-head CI and both frontend/backend production revisions must be checked before calling the release live.

Responsive coverage uses 1920 × 1080, 1280 × 720, 768 × 1024, 390 × 844, and 683 × 384 CSS pixels, with reduced motion enabled, overflow checks, drawer keyboard behavior, accessible names and zero Axe violations at all five sizes. The phone journey edits a field, switches sections and preview modes without losing the buffer, saves, and verifies the shared draft response. The 683 × 384 viewport is a reflow simulation. Separately, real browser page zoom changed the measured viewport from 1366 × 768 at device pixel ratio 1 to 683 × 384 at device pixel ratio 2, with `visualViewport.scale` remaining 1; [native zoom metrics](after/native-zoom.json) distinguish that check from viewport emulation.

Content list position is remembered while switching domains within an Admin session. Density and filters persist by operator and environment; transient list position resets on reload. Account switching clears the prior operator's private workspace state.

The local fixture has capabilities deliberately unavailable without production integrations. Its Home attention entries and Publishing activation status reflect those fixture capabilities. A successful local activation does not demonstrate GitHub checks or a production deployment. Those existing lifecycle contracts remain covered separately by server tests.
