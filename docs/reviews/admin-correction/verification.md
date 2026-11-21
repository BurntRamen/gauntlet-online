# Verification and limits

Review uses Windows, Node 24.16.0 and Playwright Chromium with compiled production assets. Node 24 is inside the repository's supported range; CI uses its existing Node 22 pin. All mutation tests run on loopback fixtures. No deployment, merge or live content publication is performed.

## Automated checks

| Check | Result |
| --- | --- |
| Full client suite | 132 suites, 1,069 tests passed. |
| Final Home / Operations / Website component recheck | 3 suites, 17 tests passed after final simplification. |
| Final Admin navigation recheck | 10 tests passed after restoring the recent record when switching content types. |
| Final encounter / card-creation rechecks | 6 encounter tests and 9 catalog-control tests passed, including campaign navigation and duplicate artwork identity. |
| Final shared player / Website renderer recheck | 5 suites, 81 tests passed after preserving unedited navigation defaults. |
| Website schema, authorization, workshop and relationship server regression | 15 tests passed, including 8 Website cases. The final Website server rerun also passed 8/8. |
| Compact Home / publication-summary regression | 3 tests passed; prohibited dashboard reads fail the tests. |
| Qualification | 60 tests passed. |
| Toolchain | 4 tests passed. |
| Approved art | 70 hashes, 66 illustrations, 330 sources, 4 covers verified. |
| Production build | Compilation, lint and WebGPU pruning passed. |
| Original bundle budgets | Passed; exact bytes in [bundle.json](bundle.json). No limits or dependencies changed. |
| Correction acceptance | All 9 cases pass across repair runs: five full journeys, phone, twelve measured activities, native zoom and nested set creation. |
| Retained browser regressions | All 28 cases pass after targeted repairs, plus all 3 production-path cases. [Per-case results and repair history](verification-results.json) record 40 passing browser cases including correction acceptance. |

The old 133-suite count included the now-deleted `ProductionGuide` test. New card-preview and Website behavior assertions are included in the corrected 1,069-test corpus. A focused command initially named a nonexistent ContentBrowser test file; the corrected command against the three actual files passed all 17 tests.

The retained 28-case run initially passed 22 cases. Repairs added the missing encounter-to-campaign link and restored the recent record/list position when changing content types. Three assertions/selectors were updated for the persistent browser, immediate local card preview and simplified release review. The remaining release test encountered a previously customized local fixture navigation label; that fixture was preserved and targeted reruns used a freshly created local fixture. The three production-path checks additionally cover guarded printing navigation, released Website copy/rollback and authorized account repair. Their navigation test was updated to expand the existing Show all references disclosure before choosing a printing. Initial outcomes and final per-case outcomes are retained in the sanitized browser report.

The browser checks use normal UI actions to create, edit, save, validate, preview, test, publish and roll back. Read-only API assertions inspect resulting authoritative state. Setup seeding is excluded from interaction counts. External HTTP(S) origins are blocked in the correction acceptance contexts. Fixture tokens, accounts and complete trace archives are not committed.

## Accessibility and rendering

Phone checks use 390×844, verify no horizontal overflow, retain local Website edits through search/departure protection and run Axe on Admin. Keyboard checks cover search focus, Escape restoration, navigation drawer focus, exact validation-field focus and return to release issues.

Native zoom uses a fresh persistent Chromium profile and the actual `chrome://settings/appearance` Page zoom selector at 200%. The test asserts a 1366×768 physical viewport becomes 683×384 CSS pixels with `devicePixelRatio=2` and `visualViewport.scale=1`; it does not substitute CSS zoom, pinch scaling or a narrower emulated viewport. Card, Home, Website, collection, preview, validation and release review views are captured and checked for overflow/Axe violations. See [native-zoom/native-zoom.json](native-zoom/native-zoom.json).

The Website journey asserts actual computed Georgia headings and one-column List layout in both the Studio rendering and the full player after publication, along with image, hidden section, reordered section and changed navigation. This caught and corrected an inherited wide-tile grid span that initially created an implicit second column.

## Performance

| Gzip JavaScript | Measured bytes | Original cap |
| --- | ---: | ---: |
| Main | 183,549 | 184,320 |
| Player | 777,964 | 779,264 |
| Initial Admin | 10,989 | 20,480 |
| All lazy Admin | 76,669 | 76,800 |
| Largest async | 275,731 | 358,400 |

Source-map attribution still charges every Admin module to the Admin budget; shared economy retains both charges. The actual player renderer is shared with Website Studio without importing Admin controls into the player payload. Optional account-layout persistence remains compiled out when customization is disabled. Home avoids editor/catalog/history requests and no longer performs dashboard reads on the server. Budgets have little remaining room; future functionality must pay for its code size.

## Existing full-server failures

The first-pass full server run had 674/677 passing tests. The unchanged Windows backup test was rerun outside the junction restriction and passed 4/4. Two repeat-clear reward assertions also fail on unchanged main `41d8801f`:

- `server/test/admin-deck-journey.test.js:102`: expected 2 packs, actual 3.
- `server/test/content-publication-routes.test.js:338`: expected 2 packs, actual 3.

Those assertions and reward semantics are unchanged here. The correction's focused server regressions pass, but the entire repository/remote CI must not be described as green. See the [historical full-server evidence](../admin-studio/verification.md#existing-server-failures-and-environment-recheck).

## Reproduction

```powershell
$env:REACT_APP_SOCKET_URL='http://127.0.0.1:4188'
$env:REACT_APP_MENU_LAYOUT_CUSTOMIZATION='false'
npm run build:client
npm run check:bundle
$env:GAUNTLET_ADMIN_USE_BUILD='true'
npx playwright test --config=playwright.admin-correction.config.js
npx playwright test --config=playwright.admin-studio.config.js
```

Keep ports 4188/3188 free. Correction runs create fresh ignored `.playwright-data/correction-*` fixtures. Studio regression uses the separate `admin-redesign` fixture. Preserve/move that ignored fixture before a clean rerun if an interrupted prior publication left customized live state; the server then seeds a new fixture. Baseline evidence was captured from a detached `7d86cce0` checkout on ports 4300/3300; the small audit/spec/config files used there are retained in [baseline-scripts](baseline-scripts). Run those scripts in that original checkout with its own isolated fixture, not against production.

## Scope limits

The presentation editor supports registered components and approved presets, not arbitrary scripts, routes, HTML or CSS. Guest previews do not simulate an authenticated player's personal data. Unsupported gameplay effects still require engine implementation and qualification. Hosted publication credentials, payment activation, production storage capacity and real deployment readiness are outside these local tests. Automated accessibility checks cover the recorded views and journeys, not every assistive technology.
