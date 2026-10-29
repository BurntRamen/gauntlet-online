# Admin workspace review evidence

This is a local implementation review. Authentication, editing, testing and publication use the isolated `e2e/admin-server.js` fixture. No production account, content store, publication branch or deployment was changed by these browser journeys.

## Before and after

The before images were captured from the current baseline at `b6d80ff4a85b751a7a8d91c59c6a644366d9535e`, using a separately built copy of its client sources. They are not historical screenshots from another revision. The local client and backend were explicitly bound to `127.0.0.1:3137` and `127.0.0.1:4137`. [Capture metadata](before/capture.json) records the source and observed request origins.

The after images come from this branch's compiled client and the same fixture data, at `127.0.0.1:3138` and `127.0.0.1:4138`. Browser routing blocks every HTTP(S) request except those two local origins. Each image is a viewport capture after fonts and visible image decoding settle. The primary comparisons use 1366 × 768.

| Workspace | Before | After |
| --- | --- | --- |
| Home | [Before](before/home-1366.png) | [After](after/home-1366.png) |
| Card: Dividend Yield Blade | [Before](before/card-1366.png) | [After](after/card-1366.png) |
| Deck: Standard playing deck | [Before](before/deck-1366.png) | [After](after/deck-1366.png) |
| Encounter: Brothers of Destiny | [Before](before/encounter-1366.png) | [After](after/encounter-1366.png) |
| Player: simply | [Before](before/players-1366.png) | [After](after/players-1366.png) |
| Publishing with a fixture draft | [Before](before/publishing-1366.png) | [After](after/publishing-1366.png) |

Additional evidence: [card preview](after/card-preview-1366.png), [accepted engine action](after/encounter-tested.png), [wide desktop](after/card-desktop.png), [1280 × 720 laptop](after/card-laptop.png), [tablet](after/card-tablet.png), [phone](after/card-phone.png), and [200% reflow equivalent](after/card-zoom-reflow.png).

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

The config builds with the explicit fixture backend and keeps player menu customization disabled. `GAUNTLET_ADMIN_USE_BUILD=true` reuses a client already built with `REACT_APP_SOCKET_URL=http://127.0.0.1:4138`; it must not be used with an unrelated build. The config requires free ports and does not reuse an existing server. Temporary fixture state belongs under `.playwright-data/admin-redesign`; traces, machine-readable results and logs are ignored local artifacts.

The focused suite exercises multi-field atomic saving, preserved sections and browser history, correct preview source, creation/duplication, printing selection and comparison, keyboard search and focus restoration, operator-scoped preferences, player/match evidence, player correction departure, failed saves, concurrent revision reconciliation, exact-field validation recovery, accepted engine commands and freshness invalidation, and fixture publication verified against the public active manifest. The publication journey restores the fixture's baseline release afterward.

## Validation status

Final verification is in progress. The initial browser run passed the save, concurrency, departure, keyboard search, publication, validation recovery and real-engine evidence journeys. It exposed two accessibility defects (shortcut text contrast and a nested complementary landmark) and three test locator mismatches; the defects and selectors are being corrected before the final run. This paragraph must be replaced with the final results before the draft PR is prepared.

Responsive coverage uses 1920 × 1080, 1280 × 720, 768 × 1024, 390 × 844, and 683 × 384 CSS pixels, with reduced motion enabled, overflow checks, drawer keyboard behavior, accessible names and Axe scans. The 683 × 384 case is the reflow equivalent of a 1366 × 768 viewport at 200% zoom; it is not a claim that native browser zoom was exercised.

The local fixture has capabilities deliberately unavailable without production integrations. Its Home attention entries and Publishing activation status reflect those fixture capabilities. A successful local activation does not demonstrate GitHub checks or a production deployment. Those existing lifecycle contracts remain covered separately by server tests.
