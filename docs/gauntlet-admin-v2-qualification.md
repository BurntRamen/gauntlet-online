> Historical implementation report. The current production integration, expanded 126-card registry, resolved two-account IDs, and GitHub persistence supersede the original counts/storage assumptions below. See [the current deployment guide](gauntlet-admin-deployment.md).

# Gauntlet Admin v2 independent qualification

The approved local conversion and automated regression work is complete. Six confirmed defects were corrected: display-name AI classification in two consumers, lost explicit AI identity in new replay frames, unresolved asset IDs in faction/character previews, destruction of a valid playtest on a failed restart, a socket-test fixture addressing the checkout match store, and Basic-art diagnostics that inferred identity from old filenames. Scalar inputs now use readable editor styling. Final software regression checks pass. The broader renderer experience record remains incomplete; no human or physical-device observations were fabricated. No deployment or live authorization was performed.

This report supplements [the implementation report](gauntlet-admin-v2.md), whose boundary inventory, editable-field list, retained code paths and schema descriptions remain applicable. The verification totals below supersede its earlier totals. The additional identity fixes qualify its earlier claim that every name-based AI consumer had already been removed.

## Authority and ownership

- Repository: `C:/Users/gjoep/OneDrive/Desktop/parapoker github/para-poker-site/gauntlet-online` on `main`; HEAD remained `bc1b7e70c5385935149007924fef622c46e4f8eb` throughout this pass. The checkout is deliberately still dirty with substantial prior work. No reset, rebase, commit, push or merge was performed.
- Actual approved scope: the user's **Gauntlet Admin v2 - Convert Remaining Hard-Coded Content Boundaries** attachment, recovered from the existing admin thread. Original path: `C:/Users/gjoep/.codex/attachments/43dd6d3e-9d28-4c8b-8cd9-068d0185a816/Pasted text.txt`. SHA-256: `bb1352aa7fc38b4059102d7547670a85ae5f02a14ef5cef5d79a9918fe02bf5a`.
- Prior writer `01a0fb03-b06a-7ff3-9728-4ac770ac2acf` completed the v2 turn at **2026-10-02 07:50:25.920 UTC**. Qualification ownership began at **07:51:31 UTC**, after the final handoff, a no-resumption check and the parent's conditional authorization. Its session lock was not modified.
- Baseline captured at **07:53:41.135 UTC**. A separate patch contains only this qualification pass. Hash comparisons verify that unrelated preexisting changes were preserved.
- The parent accepted the first admin qualification at 08:35 UTC, then explicitly requested the broader gameplay/performance pass. Ownership was rechecked; the prior writer remained finished and source hashes matched the accepted handoff. The follow-on pass used the same baseline and preserved unrelated work.
- Evidence workspace: `C:/Users/gjoep/Documents/Codex/2026-10-02/task`. The recovered instructions, original-file backups, ownership record, command logs, final evidence index and `qualification-only.patch` are retained there.

## Corrections and regression evidence

| Correction | Result and proof |
| --- | --- |
| `matchDescriptor.js` and `matchRecords.js` still treated the display name `Training AI` as bot identity. | They now use explicit opponent identity/AI state. A renamed training bot stays AI; a human with that name stays human. Focused tests failed before the fix and pass afterward. |
| Public replay projection discarded `opponentKind`. | New replay frames preserve known explicit kinds. Legacy frames without the property remain unchanged; display names never fabricate identity. A new replay regression failed before the fix and passes afterward. |
| Faction/character previews used authored asset IDs directly as image URLs. | They now use the resolved saved-preview metadata. Unit regressions failed before the fix. The added browser workflow selects a manifest ID, verifies the immutable URL and loaded image bytes for both previews, confirms the live pointer did not change, and discards the draft. |
| Starting an invalid/stale replacement playtest first deleted the operator's existing session. | Validation, game creation and projection now succeed before replacing the existing session. Regression tests cover failed/successful replacement, owner boundaries, invalid/stale/expired commands and draft edit/discard invalidation. |
| Socket integration tests set `MATCH_RECORD_DATA_FILE`, which the server does not consume. | The fixture now sets `MATCH_DATA_FILE`, `ACCOUNT_AUTH_SECRET`, and isolated archive/content directories, and clears external storage credentials. The initial run failed with checkout write permission errors; those writes did not succeed. The corrected tests pass using temporary stores. |
| Basic-art diagnostics still recognized artwork by `/playing-cards/basic-` filenames. | Published hash URLs rendered correctly but were counted as zero Basic faces. `presentationSnapshot.js` now uses explicit actor faction identity. Two new unit tests failed before the fix; both and the original reduced-motion/portrait browser assertion pass afterward. |
| New scalar asset/number fields retained narrow native styling. | Direct scalar inputs share the editor's colors, font, padding and available width, with a 42px minimum height. Existing contract controls remain independently styled. Verified through the rebuilt browser workflow and mobile screenshot. |

Broader browser failures also exposed stale test assumptions: capitalized mode labels, a removed persistent "Live" feed label, old voice paths, and named card-face filenames. Tests now check actual playback diagnostics and exact published immutable audio/card URLs, including decoded image bytes. No assertion or budget was removed to hide a software failure. The workshop test accepts an optional local screenshot directory, preserving previous proof images.

Additional tests exercise an injected failure during atomic draft replacement, lock cleanup and successful retry; repeated identical publication after rollback without mutating the original release; two-operator stale revision conflicts and invalid/stale previews over HTTP; and three-seat FFA initial draw/refill using its pinned hand size after the active release is rolled back.

## Seven requested conversion results

1. **Hard-coded boundaries removed.** Encounter formulas, ability selection and chapter card plans now feed one typed setup consumed at creation and scripted execution. Card-ID dispatch becomes a finite 72-effect registry; four faction mechanic contracts identify supported handlers. Training AI behavior uses explicit opponent identity. Authored media resolves through a versioned immutable manifest; card composition uses its published text/art instead of stale baked faces. Hand-size creation/refill and deck-slot validation share extracted configuration. The follow-on diagnostic fix removes another asset-filename identity dependency.

2. **Deleted and retained paths.** Removed: `CAMPAIGN_CARD_PLAN`, chapter-index setup formulas, direct `cardIs(card, cardId)` dispatch, name-based AI behavior checks, unused `legacyDeclareAiHandAttack`, `legacyDeclareCampaignBossAttack`, `legacyAiPassPriority`, `legacyAiEndPlacement` and their unused payment helper, plus unreferenced `server/game/gameFactory.js` and `gameLogic.js`. Retained: active multi-seat orchestration in `server/index.js` because it serves multiplayer rules; legacy ingress for unversioned saved cards; client art fallbacks only for old evidence without presentation contracts; deterministic migration data/validation, not a second executable engine. Historical record bytes are not rewritten. The detailed original implementation report identifies the remaining consumers.

3. **Newly editable fields.** Encounters: boss life 1-100, attacks per turn 1-6, ordered attack bounds 1-14, progression offset 1-64, six supported boss abilities, tier 1-3, optional even-attack bonus 1-4/healing 0-4, ability presentation and bounded same-faction card additions. Cards: supported same-faction/type effect selection and armBonus 0-8 for Coin-Scale Spear, Rumie Vault Shield and Aurelian Clawblade. Factions: Rumin fourth-attack and Sheen readied-large-attack bonuses 0-8. Opponents: Training AI display name. Assets: existing manifest IDs/aliases/immutable paths with media validation and image picker. Game: hand size 3-12. Prior v1 presentation fields remain in the existing shared draft editor; identities/routing are protected.

4. **Still engine-controlled.** Starting life 42; deck size/ranks/suits, per-value replacement capacity and lane count; costs, targeting, damage, timing, choices, ordering, AI decisions, timers, matchmaking, seasons, socket behavior, rewards and progression gates. Encounter execution supports only clear-priority attacks, first-uncompleted wins and retry losses; order and nextEncounterId remain protected. Frumo/Bizi sequencing is read-only.

5. **Schema and version changes.** Authored content is `gauntlet.authored-content.v2`; resolved content is `gauntlet.engine-content.v2`. Card effects, faction effects, encounter setup, shared game configuration and asset-manifest schemas each use their named v1 contract. Releases and full asset-manifest digests are pinned separately from engine rules. Existing rules `gauntlet-duel-v2`, command and evidence format versions remain; new games/replays capture exact definitions, and compatible persisted v1 content migrates deterministically without altering originals.

6. **Equivalence and regression results.** All 1,728 captured preconversion engine outcomes, 56 encounter fixtures/scripted sequences and 906 manifest-reference integrity checks pass inside the full suites. Final totals: 180 server tests, 481 client tests in 52 suites, 33 qualification checks, 17 general gameplay/usability workflows, one current workshop workflow, four admin workflows and one 15-sample compiled-client performance test. These prove the tested baseline/contracts, not exhaustive balance coverage.

7. **Executable coupling that remains necessary.** Finite effect IDs still require deployed engine handlers. Frumo/Bizi choices/counters and multiplayer turn sequencing retain executable code. Payment, combat, routing policy, progression/rewards, matchmaking and historical-command interpretation remain code-owned. No arbitrary scripts, new mechanic family or second simulation engine was introduced.

Authorization remains the existing exact two-stable-account-ID gate, including every authoring/playtest endpoint. Tests cover both configured fixture identities, unrelated/unauthenticated users, display-name impersonation, malformed/expired tokens, owner-token bypass and storage failure. The unresolved Burnt Ramen production slot stays denied. Fixture access does not configure or authorize live access.

## Final verification

All commands ran locally with the repository's installed dependencies. Test storage was isolated from production and external storage credentials were cleared from fixtures. Browser publication/rollback affected only the harness's temporary content store.

| Check | Final result | Workspace evidence |
| --- | --- | --- |
| Server: `node --test test/*.test.js` from `server` | **180 passed, 0 failed** | `qualification-server-final.log` |
| Client: `react-scripts test --watchAll=false --runInBand`, `CI=true` | **481 passed in 52 suites, 0 failed** | `qualification-client-final.log` |
| The seven Node files in `test:qualification` | **33 passed, 0 failed** | `qualification-checks-final.log` |
| Server and browser-test syntax | **Passed**: server entry point, admin, live-entry and workshop test files | `qualification-syntax-final.log` |
| `npm run build:client`, `CI=true` | **Passed**, including configured CRA build lint | `qualification-build-final.log` |
| `npm run check:bundle` | **Passed** | `qualification-bundle-final.log` |
| Playwright with `playwright.admin.config.js` | **4 passed, 0 failed** | `qualification-browser-final.log` |
| General gameplay/usability browser suite | **17 passed, 0 failed** | `qualification-gameplay-final.log`, `qualification-gameplay-results.json` |
| Current 52-card workshop and packs | **1 passed, 0 failed** | `qualification-workshop-final.log`, `qualification-workshop-results.json` |
| Existing compiled-client performance safeguard | **1 passed, 15 cold-load samples** | `qualification-performance-final.log`, `qualification-performance-metrics.json` |
| Broader human/device experience record | **Not qualified: missing acceptance evidence**; distinct from software regressions | `qualification-experience-evidence.json` |
| Scope/whitespace verification | **Passed**; unchanged HEAD and no unexpected source changes | `qualification-scope-verification.json`, `qualification-whitespace-final.log` |

The final Basic-art diagnostic fix was followed by the complete server/client/qualification suites, all 17 general browser workflows, a fresh production build, existing performance safeguard, bundle checks and all four admin workflows. The performance and admin suites used the exact same compiled build bytes. No runtime source changed afterward. Shared engine and match-history packages have no separate test scripts: their tests are exercised by the complete server/client suites. There is no standalone repository lint script; build-integrated lint is the lint check performed.

Measured gzip sizes: main **169.9 / 175 KiB**, largest async **310.4 / 350 KiB**, player JavaScript **702.6 / 704 KiB**, admin JavaScript **15.0 / 16 KiB**. The **704 KiB** player ceiling was introduced by the original v2 implementation (previously 700 KiB); this pass did not increase any ceiling. The build targets the isolated backend `http://127.0.0.1:4117` and is a verification artifact, not a production deployment package.

The four admin browser workflows cover access/all sections, shared authoring/publication/rollback, mechanical playtest/publication/rollback, and manifest-backed faction/portrait preview loading. Existing desktop/mobile accessibility assertions pass; mobile overflow assertions pass. Screenshots were visually inspected for the mobile editor, mechanical playtest and both fixed image previews. Relevant images are `artifacts/admin-authoring-mobile.png`, `artifacts/admin-v2-mechanical-playtest.png`, `artifacts/admin-qualification-faction-artwork.png` and `artifacts/admin-qualification-portrait.png`.

**Failed final software regression checks: none.** Red tests and fixture/assertion failures were resolved and retained as evidence. The separate experience-gate validator still fails because its human/device record is incomplete; these are checklist omissions, not 157 software defects. **Not run:** production/live-account verification or migration, physical-device qualification, independent human sessions, real browser-chrome zoom review, and the complete 18-state visual review matrix. The old pre-slot custom-card-workshop scenario was not used; the current 52-card workshop suite was run. No exhaustive balance or target-device approval is claimed.

## Broader regression and performance evidence

The existing live-entry and usability files were run together, serially, with unchanged assertions except the documented stale-contract corrections. They cover Basic combat/payment/placement, completion/replay, undo/draw/rematch, faction abilities, both AI modes, real dialogue media, campaign rewards/persistence, ranked and draft continuation, reconnect/privacy, WebGL/React fallback, reduced motion, viewport/keyboard/focus/target-size/CSS-zoom/forced-colors accessibility. Current workshop coverage verifies published artwork, exact replacements, saved versions, cosmetic boxes and pack playback on desktop/mobile. Selected workshop and dialogue screenshots were inspected.

Local wrapper configs preserve test bodies, projects, sample counts and thresholds, disable server reuse, clear external storage credentials and isolate storage. The performance backend uses port 4117 so performance and admin can exercise the same separately built client; its automatic rebuild was disabled after the explicit successful CI build. General/workshop helpers retain their existing local account-fixture paths; originals were backed up. New proof images are kept in the evidence workspace. No production stores or accounts were used.

Local cold-load results: **desktop p95 1655 ms / 3000 ms** from 10 samples; **phone-landscape emulation p95 1479 ms / 5000 ms** from 5 samples. Both profiles rendered at most 444 meshes and at least 354 frozen board meshes; buffer-size safeguards passed. These results are local Chromium safeguards, not physical-mobile, sustained-FPS or stable-memory qualification.

Player JavaScript is **719,424 / 720,896 bytes gzip**, leaving **1,472 bytes (0.20%)**. This is very little room for future code/dependency growth. Keep the ceiling and require measured reductions or deliberate lazy loading before material additions. No ceiling was raised. Build identity: `local-production-main-bc1b7e7-dirty-811b1bcaec55a305`; full build-manifest hash and chunk hashes are recorded locally.

## Human/device acceptance, separated from automated proof

The untouched broader renderer packet produced 157 missing-evidence findings. A separate local copy now supplies the verified machine-build identity and engine version; 156 human/device checklist findings remain. Human arrays, reviewers, scores, sessions and device observations were left unchanged. The findings fall into four acceptance groups; they do not represent that many independent bugs. The automated evidence addendum supplies build identity, test results, exact published-asset checks, selected screenshots, accessibility/fallback coverage and local cold-load measurements without marking human gates passed.

| Priority / scope | Manual acceptance or production prerequisite | Release consequence |
| --- | --- | --- |
| P0 - Admin v2 production prerequisites | Verify the real Burnt Ramen UUID and exact two-account mapping; review durable content storage/backup/recovery and compatible immutable asset/server packaging before authorized live enablement. Local fixtures cannot certify deployed identity or infrastructure. | Blocks separately authorized live enablement/deployment; local conversion review is complete. This is not a newly invented usability gate. |
| P1 - broader Babylon project | Five ordinary-player sessions outside implementation, including desktop/touch and three people new to the sandbox, completing required tasks without facilitator help or critical confusion. | Existing renderer runbook requirement; automated commands cannot supply independent comprehension evidence. |
| P1 - broader Babylon project | Target desktop and physical-mobile cold loads, minimum settled 60/30 FPS during gameplay and stable memory over five matches or ten resets. | Existing device gate; phone emulation does not satisfy it. |
| P2 - broader Babylon project | Named review of 18 visual states/seven categories plus real browser-chrome zoom at 80, 100, 125, 150, 175 and 200 percent. | Existing visual/zoom gate; selected screenshots and CSS zoom are supporting evidence only. |

The recovered Admin v2 task contains no additional mandatory human usability gate. The human/device requirements above come from `client/src/babylon/QUALIFICATION_RUNBOOK.md` and its experience-gate validator. See `qualification-experience-evidence.json` for the precise evidence/limit mapping. No request for live authorization is being made in this local handoff.

## Remaining constraints and handoff

There is no remaining failing automated software regression or blocker to reviewing the local Admin v2 changes. The broader renderer human/device acceptance and the separately authorized production prerequisites above remain outstanding. The approved local regression pass is complete; no features were added to fill the remaining work window.

Production readiness still requires the verified Burnt Ramen stable account ID and explicit action-time authorization before any live access change. Durable production content storage and coordinated frontend/server asset packaging must be configured and reviewed before a separately authorized deployment. No live account, permission, production data, publication or deployment was changed here.

The executable boundaries documented in `gauntlet-admin-v2.md` remain intentional: a finite effect registry requires supported engine handlers; multiplayer retains its active orchestration; Frumo/Bizi sequencing, choices, costs, routing, rewards, matchmaking, starting life and deck structure remain code-controlled. No arbitrary scripting or second simulation engine was introduced.

For review, use `qualification-only.patch` against the captured takeover baseline. It excludes unrelated existing dirty changes and is not a substitute for reviewing the original v2 implementation diff. `qualification-evidence.json` indexes command outcomes, scope hashes and screenshots; the ownership record marks this qualification pass complete so a parent can coordinate any subsequent writer.
