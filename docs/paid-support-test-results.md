# Paid support validation evidence

## Training opponent follow-up, 20 October 2026

The follow-up on `codex/support-zones-followup`, based on main `046f3be`, adds paid support decisions and fixes illegal non-Servitor blocker selection. The focused AI suite passes **11 tests**, and the existing automated-opponent suite passes **14 tests**, including completion of every configured campaign encounter. The three original support browser cases pass, and the added training-opponent phone case passes after correcting its polling code to tolerate an absent support map before placement. Final release qualification is recorded in [PR #85](https://github.com/BurntRamen/gauntlet-online/pull/85).

The local client build passes. The first browser launch exceeded the four-minute compilation startup limit under concurrent machine load; building separately and running the unchanged browser assertions against that build resolved startup. The localhost-configured build exceeds the player bundle budget by 16 bytes; GitHub's production-configured build passes the budget. No budget was raised and no client implementation changed in this follow-up.

The additional `test:qualification` run reports **48 passed, 3 failed**. The failures are unchanged main-branch voice-manifest inputs: two Frumo voice tests report `No voice mapping for Epilogue in last-tide`, and the faction-interaction test reports `Missing ElevenLabs voice for ingles`. The relevant scripts, shared content and game-content sources have no diff from `046f3be`. These unrelated voice-generation failures remain visible; no test was disabled and no voice generation or billing was performed.

The new tests cover payment bonuses, tax adjustments, ongoing support, repeated one-shots, optional private choices, Ambush concealment, occupied/insufficient-payment exclusions, explicit Arm/Assembly choices, all registered support definitions, and legacy/Basic/FFA/campaign boundaries. Initial failures exposed two incomplete test fixtures and a policy tie that spent another useful instant before an equivalent payment card; the fixtures and payment tie-break were corrected. The final focused rerun passed without relaxing assertions.

Example: with Harmony Ward (4), Think (3 with its printed +1 payment effect), and a reserved combat card, the training opponent submits `playSupport` for Ward using Think. The authoritative command discards Think, enters Ward in Support Zone 1, records a payment total of 4, and leaves Ward active. Its stable command ID, revision checks, persistence and replay follow the same server lifecycle as player commands.

The policy is deterministic and bounded; it is not a strategic search. Campaign bosses keep their authored attack sequence. The initial-release limitations below describe the October 16 release; the training-strategy limitation is superseded for v12 faction training by this follow-up.

## Initial release

Run locally on Windows, Node 24.16.0, Chromium with software WebGL, 15–16 October 2026. No production services or deployment were used. Full local logs and screenshots are retained under `artifacts/paid-support/` (ignored generated files).

Release follow-up after the user's live-publication authorization: fixed historical support-log wording, added the Field Rulebook's paid-support guidance and readable card-inspection instructions, and enabled the three paid-support browser cases in CI. The focused server suite now passes **39 tests**, including the new legacy-log regression; the complete client suite still passes **735 tests**. The updated production build passes at **175.8 KiB main**, **757.7 KiB player**, and **48.7 KiB aggregate Admin**. [PR #79](https://github.com/BurntRamen/gauntlet-online/pull/79) records the release branch's CI and deployment results. The table below preserves the original full local qualification.

| Check | Result |
| --- | --- |
| Full server suite, `node --test --test-concurrency=1 test/*.test.js` from `server` | **423 passed**, 0 failed |
| Full client suite | **735 passed**, 96 suites, 0 failed |
| Final adapter/UI wording check | **46 passed**, 2 suites, 0 failed |
| Support and historical content-contract checks | **49 passed**, including the 2,800 unchanged v11 golden scenarios |
| Recovery follow-up | **40 passed**, including unversioned recovery and room-store checks |
| Final concealed-information/authority follow-up | **38 passed**, including owner-only derived values, concealed cost receipts and public replay |
| Qualification suite, `npm run test:qualification` | **50 passed**, 0 failed |
| Paid-support Chromium browser suite | **3 passed**, 0 failed |
| Existing default Chromium browser suite | **43 passed**, 0 failed, 3 existing opt-in skips (46 cases; 26.2 minutes) |
| Client production compilation | **Passed**, including a final isolated build of the review tree |
| Server syntax | Passed |
| Diff whitespace | Passed |
| Bundle accounting | **Passed** on the final isolated build with the explicit feature allocation below |

The Windows client runner needs explicit test globs: the repository's default CRA test path pattern discovers zero tests on this checkout. The executed command was:

```powershell
$env:CI = "true"
npm --prefix client test -- --watchAll=false --runInBand --forceExit --testMatch '**/*.test.js' '**/*.test.jsx'
```

Jest reports completion but retains existing asynchronous handles. `--forceExit` exits after every assertion and suite result is reported; it does not skip tests. The qualification and server runners exit normally.

Browser commands:

```powershell
npm run test:e2e:support
$env:GAUNTLET_E2E_COMPILED = "true"
$env:GAUNTLET_E2E_SOFTWARE_GL = "true"
npm run test:e2e -- --reporter=list --output=test-results/regression
```

The new browser cases use 1440×900 desktop Babylon, 390×844 phone Babylon, and 1024×768 React fallback. Each checks insufficient payment, successful payment, entry-before-discard event ordering, repeated instants, declining Deep Dive, concealed public replay, persistent Hospital, saved-room recovery/reconnect, no horizontal overflow, and zero serious/critical axe WCAG A/AA violations. Screenshots were visually inspected. Browser automation exercises keyboard-accessible controls; physical phone hardware and manual screen-reader testing are outside this run.

The initial browser failures identified a test synchronization race, a fixture incorrectly calling one-time startup recovery repeatedly, and a missing ARIA role in the fallback. Each was corrected; the three-case rerun passed. An initial server regression in the Jewel Bank guard was narrowed to support payments; existing block behavior and the full suite then passed.

Later full server runs while the compiler/browser suite was active hit `ECONNRESET` in publication HTTP fixtures (5 failures at default concurrency; 6 at two workers, including dependent fixture-state assertions). These runs are retained as `gauntlet-support-server-concurrent-failures.log` and `gauntlet-support-server-two-workers-failures.log`. The serial full-suite rerun without browser/compiler load passed all 423 tests; no assertion or timeout was relaxed to address these failures.

## Bundle allocation

Release CI at `cc3979e` passed all **424 server tests**, **735 client tests**, build/budgets, the **43-case default browser suite** (3 existing opt-in skips), **3 support cases**, **6 draft cases**, **5 workshop cases** and **1 collector case**. Its usability gate found two instances of the same missing ARIA group role and an obsolete fallback-container assertion. The named control groups now have explicit roles. The fallback test now verifies the v12 React table, no WebGL canvas, the original match ID and a successful authoritative pass command. The support control unit test also asserts its accessible group name. No accessibility rule or command assertion was disabled.

The pre-feature limits failed at **757.3 KiB player JavaScript** (753 KiB limit) and **48.7 KiB aggregate Admin JavaScript** (48 KiB limit). The feature explicitly allocates **+5 KiB player** and **+1 KiB Admin** in `scripts/check-build-budgets.js`, with boundary tests updated. All chunks remain counted, including shared Economy chunks in both relevant totals. No assets were excluded to pass the gate.

Final measured build: main **175.5/180 KiB**, largest asynchronous chunk **285.8/350 KiB**, player **757.4/758 KiB**, Admin entry **20.0/20 KiB**, all Admin **48.7/49 KiB**. Final output is retained at `artifacts/paid-support/final-build`; it was compiled with `node scripts/build.js` from `client`, using an isolated `BUILD_PATH`, then the repository's WebGL pruning and bundle-accounting functions. This avoids replacing the bundle while the regression browser server is using it.

## Review scope and limitations

- The rules version changes for new matches; historical snapshots are not replayed through the new engine or automatically upgraded.
- Current printed content authorizes no new responsive support play during pending combat. New timing/effect types need implementation and validation.
- Payment-only cards retain their printed hand-payment behavior; playing them into a Support Zone creates no invented on-zone effect.
- Training/campaign AI retains its existing strategy. Player support actions use the same authoritative engine, including campaign budget boundaries.
- Existing tests retain their explicit opt-in screenshot/performance skips; these are listed in the final browser result. Separate Admin, visual-review and performance configurations are not part of the default browser command. Admin authoring/preview is covered by the full server/client suites and the new contract component test.
- Build output includes the repository's existing Browserslist freshness/deprecation notices. No dependency upgrades or printed card balance edits were made.

See `paid-support-zones.md` for the rule specification, example command, complete changed-file manifest and Case's review steps.
