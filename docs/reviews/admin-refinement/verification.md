# Verification record

Review date: 2026-11-07. Base: `d3e6f364f5ea061cb85f9156ec99049900a8fdb6`. All browser writes, publication, recovery and rollback operations used isolated synthetic fixtures. No production content or account data was changed.

## Automated checks

| Check | Result |
| --- | --- |
| `npm --prefix client run lint -- --quiet` | Passed |
| `npm run check:server` | Passed |
| `npm run test:server` | 643 passed |
| Publication and production-guide server recheck | 14 passed after the validation metadata/hash change |
| Home server recheck | 1 passed |
| `CI=true npm --prefix client test -- --watchAll=false --runInBand` | 129 suites, 974 tests passed |
| Final authoring, release-review and lifecycle unit recheck | 3 suites, 27 passed after the return-focus fix and blocker ordering |
| `npm --prefix client run test:toolchain` | 4 passed |
| `npm run test:qualification` | 53 passed |
| `npm run build:client` | Passed |
| `npm run check:bundle` | Passed on Node 24.16.0 and rechecked with Node 22.23.4; every existing ceiling retained |
| `npm run check:content-release` | Passed: 644 cards, 1,850 immutable asset references, 1,854 source delivery dependencies |
| `playwright.admin-redesign.config.js` | 12 passed |
| `playwright.admin-refinement.config.js` | 6 passed; Axe and overflow checks on all 15 main captures and the mobile save/focus capture; validation repair visible without scrolling at all three sizes |
| `playwright.admin.config.js` | All 27 journeys passed across clean-fixture runs and targeted reruns |
| `playwright.production.config.js` | 3 passed |
| `playwright.printings.config.js` | 2 passed, including immutable assets and the complete printing/player/recovery journey |
| `playwright.phase2.config.js admin-mechanics.spec.js` | 2 passed, including reusable mechanics, card creation and exact engine evidence |
| `git diff --check` | Passed |

The complete client suite ran before the final return-focus correction and release blocker ordering; the affected 27 authoring/review/lifecycle tests then passed. The complete server suite was followed by focused checks after the hash reuse and Home classification adjustments.

Earlier browser attempts exposed outdated navigation assumptions after the laptop collection began collapsing. The shared helper opens Back to list when needed, the rules test uses the visible Content type selector, and comparison tests open the consolidated disclosure. Status assertions target their specific announcement alongside player preview statuses. Existing behavioral assertions are retained. Interrupted creation/release journeys left fixture drafts behind; affected journeys were restarted with fresh stores rather than treating subsequent failures as independent regressions.

Local checks use Windows, Node 24.16.0 and npm 11.13.0 (within the declared `>=22 <25` range). The repository selects Node 22 in CI. A separate Node 22.23.4 run also passes the bundle check. The 45 selected Admin component entries in the final build's source maps match the current source files.

## Requested journeys

| Journey | Evidence |
| --- | --- |
| Card save and reload | Redesign suite: edits remain local across sections/Back, atomic record save, acknowledged shared values survive reload |
| Artwork versions | Redesign suite: creation selects the new printing, comparison retains the selected version; full printing/immutable asset journeys listed above |
| Set context and dependency navigation | Printing journey creates an edition and assigns an alternate printing; production journey checks guarded dependency detours and restores the card, filter and section |
| Validation repair | Refinement suite: invalid name opens the exact control, announces its associated error, saves, then returns keyboard focus to release blockers |
| Exact-revision review | Lifecycle unit tests reject both old hashes and revisions; browser tests invalidate old evidence and require a new saved preview; real engine evidence remains separate |
| Failure/retry without duplicates | Read-only review retry leaves revision unchanged; failed saves retain typing; transport suite does not replay mutations; server publication tests recover lost replies and interrupted reconciliation; printing journey checks three captured games after a dropped acknowledgement |
| Concurrent edits | Redesign suite: two operators compare conflicting values and explicitly acknowledge the current revision before retry |
| Rollback | Fixture release journeys compare and restore releases; server tests preserve immutable releases, captured games and activation history |
| Keyboard operation | Modal search and drawer focus return, Escape, field repair focus, error/help associations, mobile save/focused-field separation, responsive Axe checks |

Populated, empty, loading, failed, publication-blocked, stale-evidence and concurrent-edit states are exercised across these fixtures and unit tests. The new held/503 review response test distinguishes loading from failure and verifies a successful read-only retry.

## Bundle and timing evidence

Exact gzip byte counts and every timing sample are in [performance.json](performance.json). The baseline build's 51 Admin source-map entries were compared with the base commit before reuse.

| Bundle | Before | After | Unchanged ceiling |
| --- | ---: | ---: | ---: |
| Initial Admin | 14,674 B | 14,470 B | 20,480 B |
| Aggregate Admin | 76,666 B | 76,794 B | 76,800 B |
| Main | 183,135 B | 183,135 B | 184,320 B |
| Player total | 770,355 B | 770,355 B | 777,216 B |
| Largest async | 275,721 B | 275,721 B | 358,400 B |

The aggregate Admin allowance is tight: **6 bytes remain** in this build. Copy uses the existing private Home and authoring guide responses; no extra request, budget increase or feature removal is used to make the build pass. Any further client change must rerun the build budget check.

| Host-speed median, three cold contexts | Before | After |
| --- | ---: | ---: |
| Home ready | 1,574 ms | 1,535 ms |
| First Content navigation | 1,416 ms | 1,196 ms |
| Open editor | 213 ms | 303 ms |
| Input to two animation frames | 28 ms | 33 ms |

Normal-speed typing produced zero long tasks in all six samples. At laptop width the refined editor also opens the player preview by default. Home loads no catalog requests and no workshop chunks in either build. Home JavaScript is 240,815 B gzip after refinement versus 241,019 B before; this includes shared player/application code, not only the Admin entry.

The single 4× CPU simulation was slower for entry/navigation: Home 2,519 → 2,580 ms, Content 3,600 → 3,856 ms, editor 1,537 → 1,809 ms. Typing-to-two-frame samples were 328/111/175 ms before and 292/104/213 ms after, with five versus three long tasks. This is a diagnostic sample, not evidence of a statistically significant speedup. Slow-device entry remains a performance limitation.

Measurements use local uncompressed, `no-store` production assets, no network throttle, 1366×768 Chromium, fresh contexts and no concurrent test suites. They do not establish production CDN or mobile-network timings. An earlier baseline run under test load is excluded from the comparison. The performance harness is `e2e/admin-refinement-performance.cjs`; set `GAUNTLET_EXPECT_DEFERRED_CATALOG=true` to assert deferred catalog loading. It supports existing baseline servers through `ADMIN_PERF_EXTERNAL`, `ADMIN_PERF_CLIENT`, `ADMIN_PERF_SERVER`, `ADMIN_PERF_BUILD` and `ADMIN_PERF_FIXTURE`.

## Visual and manual limits

The [review gallery](README.md) contains matched Home, collection, editor/preview, validation and review views at 1366×768, 1920×1080 and 390×844. The mobile save/focus state has an [additional capture](after/mobile-save-focus.png). Responsive Axe and overflow checks include a 683×384 CSS reflow viewport.

Actual 200% native browser zoom was unresolved at this original refinement checkpoint. The [subsequent pipeline verification](../admin-pipelines/verification.md) closes that item using Chromium's real Page zoom setting and captures all five surfaces. CSS reflow remains a separate check. No full manual assistive-technology audit is claimed.

No migrations or new deployment dependencies are required. Deploy the matching client/server when this draft is eventually approved: new explanatory copy is supplied by the existing private responses. Keep this review **draft, unmerged and undeployed**; Git-triggered Vercel deployment is disabled for this branch in `client/vercel.json`.
