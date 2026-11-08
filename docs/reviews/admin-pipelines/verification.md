# Connected pipelines verification

This is the follow-up to the original Admin refinement. All browser mutations use synthetic local accounts and isolated content stores. Live Admin is unchanged; PR #106 remains draft, unmerged and undeployed.

## Checks

The modular-engine follow-up passed the full server suite: **658 tests**, including 11 new mechanic-program tests. The full client suite passed **131 suites / 982 tests**. Final shared capture/publication changes passed **25 affected server tests**; private playtest guidance, scenario loading and the module editor passed **21 affected client tests**, followed by **12 catalog/editor tests** after consolidating the generated explanation and fixing modular-card duplication (including two new duplication cases). Qualification passed **53 tests**; toolchain passed **4 tests**. Production compilation, lint, server syntax and bundle checks passed. Content qualification passed for **644 cards, 1,850 immutable references and 1,854 delivery dependencies**.

The 11 new engine tests cover real module order, frozen eligibility, distinct manual actions, physical-card consumption, queued controller choices, private capture/recovery, payment reduction, atomic rejection and stale retries, normal arming, schema/size limits, all-consumer capture, FFA qualification, shared revision publication, pinned games, restart/rollback and established vocabulary. The unchanged single-mechanic browser journeys also passed **2 tests** after the runtime changes.

Review caught a duplication gap in the client form: the server could clone a complete program, but the picker only recognized older arming compositions. Both now use the same copy path. The final browser recheck verifies duplicate creation preserves the original ordered references and arming behavior, with no injected runtime definitions.

The following earlier pipeline checks remain relevant to unchanged workflows: navigation **39 tests / 3 suites**, then **36 tests / 5 suites** after the saved-registry selection correction. The table distinguishes those broader pipeline runs from the final modular-engine checks.

The mechanic creation browser journey caught a cross-workshop defect: creating a prerequisite set while in Mechanics did not open its form. Both production guides now use guarded navigation to the destination before opening contextual creation. The screenshot review also caught overlapping mobile status text and step numbers; layout checks now cover both.

Three legacy economy/Para journeys exposed a saved-selection race: a registry could request navigation before its parent had cleared the acknowledged editor's dirty state. Selection now uses the existing post-save navigation queue. Shared seasons also retain the current economy workspace. The original unsaved-change assertions were kept; the affected journeys were rerun against the rebuilt client.

The previous remote refinement run timed out waiting for hidden lazy images during screenshot capture. Capture now waits for visible viewport images and fonts. Existing accessibility, overflow, focus and behavior assertions remain intact.

| Production-build browser suite | Result |
| --- | --- |
| Connected pipelines and modular effects | 6 passed in one production-build run: set/card/artwork/reload/review; campaign/chapter/guard; event registry/reload; mechanic/prerequisite set/card consumer; ordered card modules/save/reload/dependency/real engine; native 200% zoom matrix. Both module and zoom journeys passed again after the duplicate-form correction, including actual card duplication. |
| Existing mechanics, after modular runtime changes | 2 passed: paid support preview/execution exactly once; mechanic/card creation, execution and captured publication |
| Refinement | 6 passed, including all 15 matched captures with Axe and overflow checks, validation focus return, read-only retry and mobile save/focus separation |
| Redesign | 12 passed, including atomic saves, failure retention, concurrent edits, save-and-continue, printing selection, account boundaries, player/match detail, exact-draft engine evidence and responsive keyboard operation |
| Production | 3 passed: retained dependency context; website text preview/publication/rollback; authorized, audited player repair |
| Printing and immutable assets | 2 passed, including captured matches, rollback, restart, retained asset bytes, player ownership and recovery |
| Legacy Admin | All 27 journeys passed across the full run and targeted rerun: 24 initially passed; after fixing saved-registry selection, all 4 affected economy/competition journeys passed (including one previously passing season journey) |

These supplement the nine requested journeys described in the [original verification matrix](../admin-refinement/verification.md#requested-journeys). The matched after views have been refreshed for this follow-up; original baseline captures are retained.

## Bundle limits

| Gzip JavaScript | Current | Unchanged ceiling |
| --- | ---: | ---: |
| Initial Admin | 11,747 B | 20,480 B |
| Aggregate Admin | 76,737 B | 76,800 B |
| Player | 768,581 B | 777,216 B |
| Main | 183,041 B | 184,320 B |
| Largest async chunk | 275,721 B | 358,400 B |

The completed build passes checks under Node 24.16.0 and Node 22.23.4. Aggregate headroom is **63 bytes**, so future client changes require a fresh build/budget check. Existing Operations and match inspection code are deferred; unchanged operator copy is supplied by existing private Home, authoring, player, match and system responses. One module picker replaces overlapping single/multiple mechanic controls; capture validation is shared with the server and scenario loading uses the existing guarded loading hook. No budget was raised and no feature was removed.

## Load and interaction measurements

[Exact samples and bundle counts](performance.json) retain the original main baseline, the first refinement, the pipeline checkpoint and the final modular-engine build. The final measurements use the completed production build, isolated localhost fixtures, three cold host-speed contexts and one 4× CPU simulation, with no concurrent test suites. Local uncompressed/no-store delivery is not a production CDN or mobile-network benchmark.

| Host-speed median | Main baseline | Modular pipelines |
| --- | ---: | ---: |
| Cold Home entry | 1,574 ms | 1,504 ms |
| First Content navigation | 1,416 ms | 1,100 ms |
| Open editor | 213 ms | 205 ms |
| Typing to two animation frames | 28 ms | 21 ms |

Every host-speed sample recorded **zero typing long tasks** and no page errors. Home requested **no catalog and no workshop chunks**. Home JavaScript totals 235,420 B gzip, including shared application code, versus 241,019 B in the main baseline.

The single 4× CPU sample measured Home 4,232 ms, Content 4,482 ms and editor 1,239 ms; typing samples were 267/144/167 ms with four long tasks. This run is slower on entry/navigation than the previous pipeline checkpoint (2,798/3,191 ms). Slower-device responsiveness remains a limitation; these small local samples do not establish a statistically significant speedup or isolate a cause for that difference.

## Boundaries and remaining verification

The pipeline projection reuses authoritative snapshot identity and shared release readiness. It is read-only and adds no database tables or new publication authority. Discovery is covered for all eleven tasks; creation is supported by existing engine contracts. An unassigned mechanic correctly reports zero saved consumers. Publication includes all saved changes in the shared draft, not only the active task.

Actual native **200% browser zoom passes** using Chromium's Page zoom control at `chrome://settings/appearance`, with a fresh persistent isolated profile. The browser has a 1366 × 768 content surface at 100%; selecting 200% yields 683 × 384 CSS pixels and devicePixelRatio 2 while visualViewport.scale stays 1. Home, collection, editor/preview, validation and release review have no horizontal overflow or Axe violations. Search and navigation dialog focus return also pass. [Metrics and capture method](native-zoom/native-zoom.json) accompany the five screenshots. No CSS zoom or page-scale emulation is used. This is an after-state matrix, not a native-zoom capture of the main baseline; no full assistive-technology audit is claimed.

No migrations or deployment dependencies are required. Matching client/server versions are required for the private guidance, pipeline responses and new program content binding. Deploy the supporting runtime before publishing a modular card. Existing games retain their captured content. New executable rule families, arbitrary victory conditions and unrestricted page/navigation construction still require engine or runtime implementation; existing card-specific handlers are not automatically converted. See the [mechanic-program contract](mechanic-program.md).
