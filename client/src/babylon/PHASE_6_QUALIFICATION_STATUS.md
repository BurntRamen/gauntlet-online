# Phase 6 production qualification status

This record separates automated evidence from the human decisions required
before internal all-mode qualification. Automated success does not approve the
renderer for rollout.

## Automated qualification

| Area | Evidence | Status |
| --- | --- | --- |
| Responsive layout | Ultrawide, three desktop widths, tablet landscape, tablet portrait, phone landscape, and phone portrait guard | Passed |
| Browser scaling | Production controls exercised at 80%, 100%, 125%, 150%, 175%, and 200% CSS browser-layout scale | Passed |
| Input | Direct Babylon hand-card and placed-lane picking with mouse and touch, payment/block staging, click/tap flows, same-zone arrow/Home/End navigation, H/L/A zone focus, confirm/cancel/pass shortcuts, inspection close and focus return | Passed |
| Accessible DOM | Semantic cards, lanes, actions, player state, current action, live contextual instruction, explicit unavailable-lane reasons, result, reconnect status, and axe scan excluding the non-semantic canvas | Passed |
| High contrast | Forced-colors system surfaces, text, buttons, disabled states, and visible focus | Passed |
| Reduced motion | Production shell selects reduced motion and caps CSS motion | Passed |
| Touch target size | Visible production and accessible controls are at least 44 by 44 CSS pixels | Passed |
| Renderer lifecycle | One scene across five new matches and ten resets, stable mesh/material counts, bounded texture settling, and less than 64 MiB browser-heap growth | Passed locally |
| Ordinary scene budget | At most 150 meshes, 26 materials, and 26 retained textures with the approved card back/table assets; one active scene and stable counts across resets | Passed |
| Visual-state evidence | 18 required states, eight viewports, 144 final captures, and 15 motion samples; regenerated after the source-clarity audit on 2026-07-31 | Captured; human review pending |
| Renderer failure | Initialization, state-update, render-loop, and WebGL context failures stop Babylon; context loss returns the current live match to React and persists the per-match fallback | Passed |
| Live recovery | Player reconnect, spectator privacy, stale selection clearing, and match rehydration | Passed |
| Animation interruption | A newer or reset revision cancels the active effect and queued stale effects; rapid damage, priority, lane-attack, and result fixture updates settle on the authoritative result with one scene | Passed |
| Event audio | Accepted stable event IDs trigger one of 15 preloaded, sample-free WAV masters once; duplicate IDs do not replay, mute prevents context creation, failed assets fall back to procedural tones, and the audio context is disposed on unmount | Passed; human mix approval pending |
| Event effect assets | Six transparent WebP effects are preloaded once and displayed through one reusable event plane driven by accepted event IDs; revisions can cancel or fast-forward them to the authoritative pose | Passed; human visual approval pending |
| Production build | Main 146.2 KiB, largest async chunk 315.4 KiB, all JavaScript 657.9 KiB compressed | Passed |
| Compiled-client load safeguard | 10 desktop cold loads at 1438 ms p95; 5 phone-landscape emulations at 1087 ms p95 | Passed locally |

The build now enforces compressed limits of 175 KiB for the main bundle,
350 KiB for the largest asynchronous chunk, and 700 KiB for all client
JavaScript. Granular Babylon engine, GUI-control, and geometry-builder imports
replaced the former 1.68 MiB all-in-one Babylon chunk.

The local desktop sandbox reported a 38 ms warm engine/scene initialization
sample and 60 FPS after settling. The compiled-client safeguard records its
latest samples in `artifacts/babylon-performance/current.json` and runs
separately in CI after the production build. These are local/emulated
diagnostics, not the required target-device p95 result.

The browser-layout scaling check uses CSS `zoom` because Playwright does not
expose browser chrome zoom uniformly. Manual qualification must still repeat
80% through 200% using the browser's actual zoom control.

The 2026-08-03 hardening pass added all six required CSS scaling checkpoints,
real touch-generated canvas picking at phone-landscape size, and guarded the
asynchronous Babylon render loop so a frame exception stops the engine and
enters the existing renderer-fallback path instead of repeatedly throwing.
The complete 21-scenario Playwright suite then passed in one shared run,
including real lobby entry, live semantic combat and placement, spectator and
reconnect behavior, renderer fallback, direct mouse and touch manipulation,
accessibility checks, and the full visual-state capture matrix. The separate
compiled-client performance safeguard also passed with the measurements above.

A direct Play-mode audit found and corrected presentation defects that the
earlier automated checks did not identify. Lane attacks now retain the neutral
lane surface with restrained danger rails and a directional path instead of
turning the full lane bright pink. Accepted-event callouts explicitly name
hand combat or the source lane. The independent hand-combat rail and payment
tray recede when unused, and Basic matches use neutral Gauntlet identity rather
than inheriting a provisional faction portrait. The current review matrix was
regenerated after these corrections.

A subsequent port-3002 manual-play audit found that semantic DOM actions were
working while Babylon mesh picking was not. The renderer now resolves pointer
hits against projected interactive card and lane bounds, preserving direct
manipulation across canvas scaling. Browser coverage now clicks the visible
canvas to start both a hand attack and a placed-lane attack; DOM-only controls
are no longer accepted as proof that the 3D table is playable.

## Human visual review

Review `artifacts/babylon-visual-review/current/index.html`. Every state must
receive an explicit decision for rule clarity, spacing, card readability,
visual hierarchy, interaction feedback, Gauntlet brand identity, and animation
quality. All 18 rows remain pending until a named reviewer records a decision.

## Human playability sessions

| Session | Participant not on implementation | New to developer sandbox | Device | Result | Critical confusion resolved |
| --- | --- | --- | --- | --- | --- |
| 1 | Pending | Pending | Desktop or touch | Pending | Pending |
| 2 | Pending | Pending | Desktop or touch | Pending | Pending |
| 3 | Pending | Pending | Desktop or touch | Pending | Pending |
| 4 | Pending | Pending | Desktop or touch | Pending | Pending |
| 5 | Pending | Pending | Desktop or touch | Pending | Pending |

At least three rows must be new-to-sandbox participants, and the final set must
include desktop and touch. Use one `HUMAN_PLAYTEST_SESSION_TEMPLATE.md` per
session.

## Gate decision

The automated production cutover gate passed on 2026-08-04, and the owner
explicitly authorized making `ProductionMatchExperience` the default supported
two-player renderer. The following human qualification remains required during
the stabilization release and must be completed before removing the emergency
React fallback:

1. Human scoring of the full visual-state matrix.
2. Five moderated ordinary-player sessions.
3. Remediation and retest of any critical workflow confusion.
4. Manual browser-chrome zoom verification at 80% through 200%.
5. Target-device frame-time, initialization p95, and heap-memory sampling.

Fifteen original, sample-free synthesized match sounds are now integrated as
provisional production masters. They require human listening, level balancing,
and explicit approval before public cutover; the procedural tones remain only
as resilient load/decode fallbacks. The six generated effect sprites likewise
remain provisional until the visual-state review approves their timing,
composition, and restraint over the battlefield.

Create or resume the non-destructive qualification packet with:

```text
npm run prepare:experience-gate
```

This creates the pending gate record, five moderated-session forms, and the
qualification runbook under `artifacts/babylon-qualification`. Re-running it
preserves every existing evidence file. Record only real review evidence, then
run:

```text
npm run check:experience-gate
```

The validator requires all 18 visual states, five independent playtests,
three participants new to the sandbox, desktop and touch coverage, all six
manual zoom levels, and passing desktop/mobile device profiles. Its own
positive and negative cases run in the normal repository check.

The temporary React fallback remains available until these stabilization checks
and the agreed reliability thresholds pass. See `MATCH_RENDERER_FALLBACK.md`.
