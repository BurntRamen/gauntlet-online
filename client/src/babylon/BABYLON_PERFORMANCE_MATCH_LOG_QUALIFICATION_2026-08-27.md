# Babylon responsiveness and match-log qualification — 2026-08-27

## Decision

The responsiveness and match chronology pass on `codex/full-babylon-visuals`
is qualified for review. The implementation is preserved at clean commit
`cbcd2cfcd94f3ddde7668ea96f1545b65a66ad46` and passed the repository's full
automated gate plus the real production-path Babylon capture matrix.

This pass does not change game rules or server authority. The rules contract
remains `gauntlet-duel-v2`. No merge to `main` was performed; the separate
`main` worktree was not modified by this pass.

## Responsiveness changes

- Reduced the structural shadow map from 2048 to 1024 pixels, cutting its pixel
  workload by 75%, reduced its blur kernel from 24 to 16, and changed it from
  every-frame refresh to one-time refresh for the static board.
- Removed animated card meshes from the structural shadow map. Cards retain
  their lightweight contact shadows, so depth remains legible without forcing
  the large blurred map to update during every card movement.
- Disabled Babylon's parallel automatic pointer picking because the match uses
  its own explicit hit-test path. Pointer moves are now coalesced to one pick per
  animation frame, and repeated hover previews no longer trigger duplicate
  React updates.
- Static card actors no longer enter per-frame motion processing.
- Idle scene rendering is capped at 30 FPS and background-tab rendering at 4
  FPS. Active presentation motion remains uncapped by this scheduler.
- Scene-metric publication moved from one second to two seconds, and the parent
  HUD ignores metric snapshots whose meaningful values have not changed.

## Cadence changes

- Payment-card stagger was reduced from 170 ms to 70 ms.
- Blocker stagger was reduced to 55 ms and draw stagger to 35 ms.
- Payment and attack lead time was reduced to 120 ms.
- A three-blocker commitment now completes in 850 ms; five drawn cards plus the
  turn handoff complete in 490 ms.
- Ordinary damage resolves in 740 ms, major damage in 920 ms, and the final
  result beat remains the deliberate long beat at 1250 ms.
- Combat and payment settle holds were reduced to 100 ms and 120 ms.

The presentation grammar and semantic event grouping remain intact. These
changes shorten input-lock windows without skipping the visible cause,
commitment, impact, and handoff phases.

## Match chronology changes

- Added a persistent `Play order` ledger with the three latest semantic actions
  and stable sequence numbers.
- Added a full chronological log that reads oldest to newest and retains up to
  the authoritative 300-event server history.
- Added explicit payment totals and costs, attack and block values, blocker and
  card counts, lane numbers, targets, life deltas, and damage equations such as
  `12 attack − 4 block − 1 prevention = 7 damage`.
- The expanded log separates recent numerical resolution details from the
  authoritative server history so players can see both the calculation and the
  complete order of accepted actions.
- Responsive layouts keep one recent action visible on short landscape and
  phone portrait screens without obscuring the battlefield.

## Automated qualification

| Check | Result |
| --- | --- |
| `git diff --check` | Passed |
| Qualification tests | 29/29 passed |
| Server tests | 128/128 passed |
| Client tests | 410/410 passed across 37 suites |
| Focused cadence, lifecycle, log, and match UI tests | 91/91 passed |
| Production build | Passed; 19 WebGPU-only shader chunks pruned |
| Bundle budgets | Main 151.3 KiB; largest async 309.9 KiB; all JavaScript 679.4 KiB gzip |
| Production-path visual review | 1/1 passed in 2.5 minutes |

## Clean visual evidence

The final matrix is stored locally at
`artifacts/babylon-visual-review/current/`. Its manifest records clean revision
`cbcd2cfcd94f3ddde7668ea96f1545b65a66ad46`, no dirty paths, four real
scenarios, and the `gauntlet-duel-v2` rules contract.

| Evidence | Result |
| --- | --- |
| States and captures | 52 states; 114 captures |
| Native structure | `gauntlet.board-stage.native.v1` in every capture |
| Shadow configuration | 1024 map size and one-time refresh in all 114 captures |
| Face art | Zero missing expected art across all captures |
| Image inventory | 114 JPEGs; 112 unique JPEG hashes |

Checksums:

- Manifest:
  `be77f6d1ba613642bdf8d29629f918a6a03347ae045d45bea75633379a6b1249`.
- Index:
  `459f54266f588d3b71e614368b1b90f2af40a9e4bf935c660cfe7d11b8802b17`.
- Canonical codepoint-sorted `filename sha256\n` JPEG inventory:
  `a987b208d6afafd192a0bb9832e253430691b532abeafa5d968a92cb052c8eb4`.

## Remaining physical-device gate

The scheduler, cadence, and visual matrix are automated and reproducible, but a
physical-device pass should still record settled FPS, frame-time percentiles,
memory, and input latency on the intended minimum desktop and touch targets.

## Legibility and render-cost follow-up

The visibility and remaining client-lag follow-up is preserved at implementation
commit `14e5102121059564b0681c33262edbb6a1fd9688` on
`codex/full-babylon-visuals`. `main` was not modified.

### Player-facing changes

- Both player plates now show explicit, high-contrast `Deck` and `Discard`
  counts beside the hand count instead of relying on the physical board dials.
- The physical deck and discard dials use larger faces, labels, and numerals with
  stronger gold contrast.
- The former decorative payment tray is now a numerical status panel. It names
  the zone, shows `paid / required`, distinguishes incomplete, ready, and
  committed states, and gives a short instruction.
- The confirmation panel repeats the payment equation in a high-contrast card,
  includes a progress bar, and states either the exact remaining value or that
  the cost is met.
- Recent play-order event text increased from 9 px to 12 px, with its secondary
  line at 10 px. The full log now uses 15 px event text, 13 px explanation text,
  and 12 px sequence numbers.

### Rendering changes

- Low-value repeated board ornament was removed while preserving the rails,
  lane wells, combat module, pile modules, payment zone, materials, and authored
  visual language.
- The neutral live scene fell from 749 meshes to 444 meshes, a 40.7% reduction.
- 354 structural meshes now freeze their world matrices. Responsive layout
  changes explicitly thaw, recompute, and refreeze them.
- Large canvases use adaptive hardware scaling with a 900,000-pixel render-buffer
  target and a bounded 1x–2x scale. The ultrawide visual capture used 1.599x.
- Draw calls are measured per frame through Babylon scene instrumentation. The
  visual qualification now rejects more than 520 draw calls, more than 519 scene
  meshes, fewer than 301 frozen structural meshes, or an invalid hardware scale.
- The compiled-client performance safeguard also enforces a maximum 910,000-pixel
  render buffer.

### Follow-up qualification

| Check | Result |
| --- | --- |
| Focused lifecycle, board-presentation, and match UI tests | 42/42 passed |
| Qualification tests | 29/29 passed |
| Server tests | 128/128 passed |
| Client tests | 411/411 passed across 37 suites |
| Production build | Passed; no ESLint warnings; 19 WebGPU-only shader chunks pruned |
| Bundle budgets | Main 151.3 KiB; largest async 311.5 KiB; all JavaScript 681.3 KiB gzip |
| Production-path visual review | 1/1 passed; 52 states and 114 captures |
| Compiled desktop cold-load safeguard | 2.122 s p95 / 3.000 s budget |
| Compiled phone-landscape cold-load safeguard | 1.938 s p95 / 5.000 s budget |

The clean visual manifest in `artifacts/babylon-visual-review/current/` records
revision `14e5102121059564b0681c33262edbb6a1fd9688`, branch
`codex/full-babylon-visuals`, and no dirty paths. Across the 114 captures it
records 424–464 scene meshes, at least 354 frozen structural meshes, and no more
than 411 draw calls. The manifest SHA-256 is
`83e6411dd275024b2cd0eac02d66d4d392c6ddeb3a16b8c3afc16520140c7ac4`.

## User-controlled graphics profiles

Commit `0137dc56f0c12fd4bc33b06374d470611edbd841` adds a persistent
`Graphics quality` selector to the in-match Match menu. It changes Babylon's
hardware scaling immediately without reconstructing the authoritative match or
the presentation scene.

| Profile | Rendering policy |
| --- | --- |
| Performance | Automatically targets a 550,000-pixel buffer, bounded at 2x hardware scaling |
| Balanced (recommended) | Automatically targets a 900,000-pixel buffer, bounded at 2x hardware scaling |
| High | Uses the display's native pixel resolution |
| Ultra | Uses 0.75x hardware scaling, or approximately 133% supersampled resolution |

The selected profile is stored locally as `gauntlet.graphicsQuality`, applies
to later matches and reloads, and falls back safely to Balanced for absent or
invalid values. The menu explains the hardware expectation, shows the current
effective render percentage, and states that changes apply immediately.

Live localhost validation on a 1272 × 540 CSS canvas measured 549,171 buffer
pixels in Performance, 686,880 in High, and 1,221,120 in Ultra. Ultra remained
selected after a full reload; the preview was then restored to Balanced.

The full automated gate remained green: 29 qualification tests, 128 server
tests, 411 client tests across 37 suites, production build, and bundle budgets.
The clean compiled-client safeguard measured 1.507 s desktop p95 and 1.510 s
phone-landscape p95. The subsequent production-path review passed all 52 states
and 114 captures with Balanced recorded in every diagnostic, 424–464 scene
meshes, and at most 411 draw calls. Its clean manifest records revision
`0137dc56f0c12fd4bc33b06374d470611edbd841` and SHA-256
`90a8d948d536359f5a597bcaee731ab46a406ae98ddebc7e9a852f507c211b59`.
