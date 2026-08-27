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
