# Verification and remaining work

Historical first-pass evidence. See the [correction review](../admin-correction/README.md) for the current implementation and its expanded Website capabilities.

Local review on 2026-11-20, based on `41d8801f`, using the compiled production client and isolated file-backed fixtures. No production publication, deployment, account correction or payment was performed. Browser publication/rollback assertions apply only to the local fixture provider. Existing authentication records, engine behavior, release gates, activation flags and bundle limits are unchanged.

Local runtime: Windows, Node 24.16.0, npm 11.13.0 and Playwright Chromium. Node 24 is within the repository's supported engine range; CI uses the checked-in Node 22 pin. Remote CI is separate from these local results.

## Automated checks

| Check | Result |
| --- | --- |
| Client, `CI=true npm --prefix client test -- --watchAll=false --runInBand` | 133 suites / 1,068 tests passed. After component changes, Authoring/ReleaseReview/Website passed 28 tests; the subsequent routing/Authoring recheck passed 37. New regressions cover unresolved local imagery and old pipeline URLs creating no extra history entry. |
| Server, `node --test --test-concurrency=3 server/test/*.test.js` | 677 tests: 674 passed, 3 failed. Two failures also reproduce on unchanged main; the third is the Windows sandbox junction restriction and passes outside that restriction. Details below. |
| Website server projection/validation | All 5 passed after correcting absent optional asset-field comparison. The full server run also includes this fix. |
| Qualification, `npm run test:qualification` | 60 passed. |
| Toolchain, `npm --prefix client run test:toolchain` | 4 passed. |
| Approved artwork, `npm run check:suitfire-art` | 70 hashes, 66 illustrations, 330 source assets and 4 covers verified. |
| Server syntax, `node --check server/index.js` | Passed. |
| Production client, `npm run build:client` | Passed, including lint, compilation and build pruning. |
| Bundle budgets, `npm run check:bundle` | Passed without changing limits; measurements below. |
| Browser, `npx playwright test --config=playwright.admin-studio.config.js` | All 28 distinct studio journeys passed across the full run and targeted reruns. The retained `playwright.admin.config.js` mechanical release/rollback and faction/portrait preview journeys also passed: 30 distinct passing cases. [Per-case results and run counts](verification-results.json). |
| Patch whitespace, `git diff --check` | Passed. |

The full server suite exercises the two-identity allowlist, stable IDs, revision conflicts, isolated playtests, publication/rollback gates, immutable media, historical match binding, entitlement/payment restrictions and audited operations. It is not an entirely green suite: the baseline failures below remain visible.

Browser refinement corrected preview/event-label contrast and placed the first phone repair action within the initial viewport. Test maintenance follows the new single Publishing destination, waits for save acknowledgement, uses the actual field labels and handles an omitted optional live offer list. Failed and initially unrun cases were rerun; the JSON records each case's latest outcome and earlier runs rather than claiming a single clean full-suite invocation.

To reproduce the browser suite in a fresh worktree with installed dependencies and Chromium (PowerShell):

```powershell
$env:REACT_APP_SOCKET_URL = 'http://127.0.0.1:4188'
$env:REACT_APP_MENU_LAYOUT_CUSTOMIZATION = 'false'
npm run build:client
$env:GAUNTLET_ADMIN_USE_BUILD = 'true'
$env:GAUNTLET_ADMIN_EVIDENCE_DIR = '../artifacts/studio-responsive'
npx playwright test --config=playwright.admin-studio.config.js
```

The config starts its own fixture/static servers on ports 4188/3188 and uses `.playwright-data/admin-redesign`. Keep those ports free and use owned test data. The evidence override preserves earlier review captures.

### Existing server failures and environment recheck

1. `server/test/admin-deck-journey.test.js:102` expects 2 packs after a repeat encounter clear; the implementation returns 3.
2. `server/test/content-publication-routes.test.js:338` has the same repeat-clear expectation (expected 2, actual 3).

Both assertions fail identically when run against a clean `git archive 41d8801f` extraction with the installed dependencies. Reward semantics and these assertions were not edited in this redesign. Next requirement: reconcile the intended repeat-clear award contract with the campaign reward service and qualification tests in a separate change. These failures can block the existing full-server CI job.

3. `server/test/runtime-backups.test.js:51` could not create its junction (`EPERM`) in the restricted Windows execution environment. Running the unchanged backup suite outside that restriction passed all 4 tests, including rejection of unsafe paths, symlinks and corrupted bytes. No test was skipped or weakened.

### Bundle measurements

| Gzipped JavaScript | Measured | Existing limit |
| --- | ---: | ---: |
| Main | 179.1 KiB | 180 KiB |
| Largest async chunk | 269.3 KiB | 350 KiB |
| Player | 758.6 KiB | 761 KiB |
| Initial Admin | 11.6 KiB | 20 KiB |
| All lazy Admin | 74.8 KiB | 75 KiB |

The Admin and main budgets have little spare room. Future additions need consolidation or another split; this change does not raise the limits. Home's browser assertions prohibit `/authoring`, `/catalog` and historical `/overview` reads before opening a workspace.

## Operator journeys and evidence

Browser fixture setup supplies test identities and initial data. The behaviors under test use the normal interface; service reads inspect resulting authoritative state. Release and rollback writes target only the isolated local provider.

| Requested journey | Observable coverage |
| --- | --- |
| 1. Find/edit/save/preview/validate/review a card | Studio combined card + Website release; card record editing, local buffers and shared review regression. |
| 2. Create and attach a reusable mechanic; execute it | Pipeline mechanic creation in the normal editor, attach to a new card, reload, find via Records search, custom engine scenario and recorded life/effect/revision evidence. |
| 3. Create a set and add a card | Direct set creation, contextual card creation, membership after reload and shared release comparison. |
| 4. Edit a campaign encounter and dependencies | Faction/campaign creation, related chapter creation, dependency navigation and dirty departure guard; separate exact-draft encounter engine test. |
| 5. Change website text/image in actual presentation | Local header preview uses the same component as PlayerShell; versioned picker, saved preview, fixture release and actual player page assertions. |
| 6. Configure eligibility and rewards | Season rules/eligibility and Gold cap, event Prestige definition, save/reload, release boundary assertions. |
| 7. Configure product terms | Create a deck and offer, save price/availability, reload, assert draft/live distinction and release gate. |
| 8. Inspect player/match evidence | Players and match detail through Operations; authoritative summary/detail and support navigation. |
| 9. Review changes across workspaces | Card and website changes in one release, shared draft disclosure, validate and preview acknowledgement. |
| 10. Rollback/history integrity | Fixture publication and UI rollback; exact prior active snapshot asserted. Server tests retain historical asset/match and compatibility gates. |
| 11. Failed request/stale revision recovery | Deliberately failed record save, retained input, second-operator conflict and explicit retry; failed review request and read-only retry. |
| 12. Keyboard, phone and zoom | Search focus trap/restore, Escape, guarded selection, phone Website editing, 390px overflow assertions and Axe; actual Chrome 200% Page zoom via a temporary profile, plus responsive review screens. |

The before/after captures in [comparisons.md](comparisons.md) use the same fixture records and viewport dimensions. They are rendered UI evidence, not production content history. Native zoom uses Chrome's actual Page zoom preference, not CSS scaling or a smaller emulated viewport.

## Explicit limitations

- Global navigation destinations/labels, arbitrary registered page sections, ordering/visibility and typography remain code-owned. Safe authoring requires an allowlisted, versioned presentation schema, validation, accessibility constraints and runtime consumer migration. Website identifies these boundaries and offers no inert controls.
- Website imagery is a decorative header slot on nine existing player pages. It does not implement an unrestricted page builder or arbitrary CSS/background editing.
- Reusable mechanics, runtime rules, event eligibility and economy controls remain bounded by their qualified contracts. Unsupported effect types require engine implementation and qualification.
- Live payment/provider configuration, hosted publication, deployment confirmation and production storage capacity were not exercised. Local release tests do not prove credentials or infrastructure readiness.
- The two baseline reward failures above remain unresolved. No claim is made that the entire repository or eventual remote CI is green.
- Automated accessibility coverage and rendered inspection are evidence for tested screens and sizes, not a claim of exhaustive assistive-technology certification.
