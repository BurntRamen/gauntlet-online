# Match redesign — local technical tranche

This is implementation evidence, not an artwork/canon approval. The original
local-tranche sections below are a historical snapshot of the pre-release
checks and blockers. The owner-authorized code-release update at the end
records the later scoped authorization and current validation separately.
The requested full two-release redesign remains **incomplete**.

## Repository and scope

Fresh `origin/main` was verified at
`f19f764eb7c3cea2105dae16a0ecb3b4c4409576`. Work uses the already allocated
`gauntlet-online-menu-audio-main` worktree on `codex/gauntlet-match-redesign`.
The manifest-pilot checkout remains clean at `bacccd1`; no third worktree,
commit, push, merge, deployment or Drive writeback was performed.

The preflight skill's direct interactive local-code exception admits this
technical subset only. No output here claims a governed deliverable, identity
approval, card-text amendment, rights determination or publication authority.

## Implemented

- Shared Basic/Factions duel commands now require one hand blocker. Explicit
  lane-block arrays must also contain exactly the attacked lane's one card;
  normal implicit same-lane declarations remain supported.
- Empty/multiple declarations, self-payment and second declarations reject
  atomically. New block events retain array-shaped `cardIds` with one element.
- Choosing another hand blocker replaces the selection; choosing the selected
  card clears it. Payment stays multi-card and excludes the blocker. Legacy
  React selection mirrors these semantics. A legacy empty hand declaration
  no longer silently becomes a decline; explicit Take Damage still works.
- Shared legal-action constraints and AI responses advertise/observe one
  blocker. An already blocked defender passes combat priority rather than
  declaring or declining another block. New matches use `gauntlet-duel-v3`.
- Historical recorded multi-block frames/events are preserved and separately
  regression-tested; archives are not rewritten or replayed through new rules.
- Theme/card-back prop updates no longer dispose the engine or scene. Existing
  theme materials update in place; async card-back replacements retain the
  released texture on failure and discard obsolete loads. Illustrations,
  original Classic back, player portraits and palette values are unchanged.
- Phone portrait and short landscape now use a horizontally scrolling DOM
  hand: separate 80 × 112 CSS-pixel cards, 8-pixel gaps, contained (uncropped)
  existing art, readable rank/suit labels and individual selection controls.
  Pointer swipes suppress selection; keyboard selection scrolls into view.
  The same presented view model and commands remain in use, with selection
  retained through rotation. Privacy curtains, spectators and replay surfaces
  do not expose a phone rail. Failed art retains its playable identity label.
- Known local-hand Babylon actors remain registered but settled duplicates
  and their contact shadows are disabled. Stored visible rail anchors supply
  committed-card transition origins. The production scene uses unprojection
  rather than an unregistered Babylon picking-ray extension. Normal-route
  commitment travel still requires fresh local-backend acceptance evidence.
- HUD and hand dimensions are measured before camera fitting; canvas resize
  observation keeps the existing engine alive. Portrait framing remains
  portrait even when the hand reservation makes the remaining canvas wider.
  The short-phone landscape action panel uses a compact horizontal row.
- Individual lane and hand-combat wells now follow the portrait card aspect
  and actual displayed card scale rather than inheriting nonuniform module
  stretch. The combat platform is deeper, anchors are spaced to contain the
  wells without touching the opponent hand, and lane numerals sit beside the
  wells. All ten modular scene roots remain; no structural raster was added.
- The pre-existing missing placement/draw fallback texture path now resolves
  to the already approved, checksum-valid core lane-placement effect. No new
  asset, visual approval or governing record was created.
- Qualification now requires `single-hand-blocker` among its 18 review states
  and a matching runtime rules version. Old passing marks are not migrated.
  Normal local route baselines and current HUD-preserving renderer-recovery
  scenarios replace stale assumptions. CSS scale tests are explicitly not
  actual browser-chrome zoom qualification.

## Evidence

- Eight unchanged-main screenshots: local Basic practice and first Rumin
  campaign at desktop, tablet, phone portrait and short-landscape sizes, under
  `artifacts/match-redesign/main-f19f764-baseline-rerun-2026-09-17`.
- Server: 150 passing tests. Client: 52 suites / 456 passing tests, with
  a final focused 8-suite / 77-test pass after the last rendering changes.
  Qualification tooling: 33 passing tests. Server syntax passes.
- Initial normal-entry browser batch: 9 passed, 2 failed, 1 opt-in capture
  skipped. One failure was a stale "Live" selector; it now observes actual
  playback attributes. Draft setup exceeded the unchanged local signup quota.
  Both affected scenarios passed independently on rerun. The signup-fixture
  isolation problem still prevents claiming the full single batch is green.
- Fresh usability rerun: 6 passing checks, covering reconnect, faction actions,
  spectator privacy, renderer recovery/retry, emergency fallback, reduced
  motion, responsive sizing, keyboard focus, 44-pixel targets, CSS scaling and
  forced-color accessibility. Failed prior-run traces remain separate; its
  final connection failure resulted from another test runner shutting down
  their shared backend. Do not run shared-port suites concurrently.
- Compiled-client cold-load safeguard passes: desktop p95 1842 ms across ten
  samples; phone-landscape emulation p95 1965 ms across five. The frozen report
  is `artifacts/match-redesign/performance-safeguard-2026-09-17.json`. This is
  not physical-mobile qualification, sustained FPS or stable-memory evidence.
- Production build passes, but the current total-JavaScript bundle budget
  fails: main 166.0 / 175 KiB; largest async 310.4 / 350 KiB; total JS
  719550 / 716800 bytes (702.7 / 700 KiB). The phone/well patch exceeds the
  unchanged ceiling by 2750 bytes. The prior 699.7 KiB passing result predates
  this addition and does not qualify it. No budget was increased.
- Strict existing-asset reporting passes: zero cutover blockers, checksum
  mismatches or structural-composite rasters. Five optional authored files and
  eleven provisional entries remain in the existing kit; this does not approve
  missing assets or complete the authored-atmosphere release.
- Fresh blank v3 human qualification forms are retained under
  `artifacts/match-redesign/qualification-v3-2026-09-17`. The experience gate
  remains failed/pending: no 18-state human sign-off, five moderated sessions,
  actual 80–200% browser-zoom review or physical-device acceptance was invented.
- Refreshed real live/replay visual capture passes with v3 metadata and the
  `single-hand-blocker` state. The gallery/manifest are under
  `artifacts/babylon-visual-review/match-redesign-v3-2026-09-17`. These captures
  do not satisfy the outstanding 18-state human review.
- The new hand/well patch has genuine isolated-browser checks and screenshots
  on desktop 1440 × 900, tablet 1024 × 768, phone 390 × 844 and short landscape
  844 × 390. The actual renderer and LocalDuelAdapter are exercised without
  production sockets, accounts, a backend or archive writes. All four pass;
  phone touch swipes do not select, taps select independently, keyboard
  selection scrolls into view and survives rotation. Ten modules, retained
  external actors, zero duplicate visible identities, complete image loading,
  separate 80 × 112 cards and a non-obscured canvas were checked. There are
  zero browser/console errors, missing HTTP resources or external requests.
  This isolated engineering preview is **not** a normal practice/campaign
  route qualification, physical-device evidence or live deployment.
  Evidence: external review directory `gauntlet-match-redesign-2026-09-17`,
  `hand-well-browser-checks.json`; failed setup/rendering checks remain there.
  Interactive preview: `http://127.0.0.1:3102/`. The existing read-only gallery
  at port 3101 remains the older technical-tranche captures, not this patch.

## Blocked or intentionally outstanding

The pilot manifest requires provenance source
`1qG_EhBWSycVbm4YZmCPgUr_jI70LlpwDtY9kIbkIxRI` as verified governing
authority, but its live title/status is Draft for Review. No exact active Drive
Task Contract admits this identity-bearing redesign. Pilot push, merge,
deploy, publication and release remain denied. No draft was promoted.

Repository access and fresh main are verified. Dossier intake wording under
C-21 is stale/discrepant: the Decision Board's access condition concerns the
separate Creative-Systems1 migration. An authority owner must reconcile the
governed records; this is not evidence that Gauntlet Git access is unavailable.

Still outstanding: broader tactile arena/card readability; fresh normal-route
phone hand/anchor acceptance; consolidated HUD/log; shared-phase
combat/audio/life tuning; all per-asset rights/lineage/source briefs; Gate 0 and
visual admission; five landscape/portrait surround sets; four ability accents;
commander asset reuse/registration; genuine human/device review; PR-to-main
rollout and both Vercel/Render live verifications.
Also outstanding: reduce the measured total bundle below its existing ceiling.

Harmony Ward and Sapling Chorus still have multi-block-dependent legacy
effects; no replacement mechanics or registry text was invented. Priority
closure, lethal-life timing, broader registry coverage and the separate legacy
Free-for-All engine require separate conformance work. This correction is not
a claim of full-rulebook conformance.

## Next safe action

The Gauntlet game owner / EGGS founders must reconcile the draft provenance
binding and stale intake record and issue the exact governed redesign task
grant. That does not itself grant canon, rights or live release. Complete visual
admission before identity-bearing production; complete genuine acceptance and
obtain exact reconciled push/deploy permission before the existing PR workflow.

## Owner-authorized code release — subsequent update

Giuseppe reviewed the isolated actual-renderer preview, requested "push it all
live", and explicitly answered "yes" to reconciling the pilot manifest and
release contract for commit, push, merge and deployment of these code changes
to main, Vercel and Render, without changing artwork authority or production
data. The exact bounded grant is
`.eggs/releases/match-layout-2026-09-17.json`.

The reconciled local manifest is v1.1.0. Release actions require an exact Task
Contract; they are not blanket future permission. Drive writeback, canon,
manufacturing, spending and production-data mutation remain denied. AGENT-0062
is still Draft/internal and is optional/non-governing for this code-only release,
not promoted. C-21's separate Creative-Systems1 migration does not deny this
verified Gauntlet repository. The Drive dossier and all governing art sources
remain untouched. Both the fresh authority packet and execution packet validate.

The fixed arena now uses TargetCamera with the identical position, target,
up-vector and orthographic framing, rather than importing FreeCamera controllers
that were immediately disabled. This removes unused input machinery, not match
features. The unchanged bundle ceiling now passes: 713520 / 716800 bytes gzip
(696.8 / 700 KiB); main 166.0 / 175 KiB, largest async 304.5 / 350 KiB.
Fresh checks pass: qualification tooling 33, client 52 suites / 456 tests,
server 152 tests, syntax, production build and strict existing-asset report.

Ordinary browser combat/placement now runs on both desktop and phone clients,
including paid single blockers and the phone DOM rail. Browser signup fixtures
model distinct synthetic client addresses against the unchanged registration
limit; production authentication policy is not weakened. Public game-content
headers identify the rules runtime and a validated Render commit SHA without
changing the response body or exposing configuration; two tests cover this.

Remaining browser/PR/deployment results are recorded in the code-release handoff.
No claim here completes the broader tactile/HUD/combat/atmosphere redesign,
18-state human review, moderated sessions, actual browser zoom or physical-device
performance acceptance. Original evidence and failed attempts remain preserved.
