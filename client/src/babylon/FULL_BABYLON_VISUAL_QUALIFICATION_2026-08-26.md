# Full Babylon visual qualification — 2026-08-26

## Decision

The full Babylon visual implementation on `codex/full-babylon-visuals` is ready
for independent human review. Automated qualification and the implementer
visual review passed against implementation commit `e604083`.

This record does not claim the independent playtests, physical target-device
qualification, real browser-chrome zoom review, or final listening approval
required by `QUALIFICATION_RUNBOOK.md`.

## Reviewed scope

- Preserved all pre-existing visual and audio work in the isolated worktree;
  `main` remained clean.
- Kept the native Babylon scene, shared board modules, card actor registry,
  semantic controls, rules, routes, adapters, and replay contract intact.
- Rebalanced graphite, engraved stone, aged bronze, dark steel, well, and
  state materials around a restrained neutral light rig.
- Reduced idle ornament and glow competition while retaining physical frames,
  wells, medallions, dials, contact shadows, and state rails.
- Removed the floating hand-combat text that overlapped the opponent hand.
- Enlarged and recolored fallback card ranks for fast black/red suit parsing.
- Added purpose-built desktop, ultrawide, portrait, and short-landscape board
  profiles. Tablet portrait and ultrawide no longer inherit unsuitable camera
  or hand scaling.
- Kept action and player rails outside the battlefield at the reviewed phone
  and short-landscape sizes; removed the redundant tablet combat recap that
  covered Lane 3.
- Hardened the capture harness so short-lived lane damage/block motion is
  observed from before the accepted action.

## Automated evidence

| Check | Result |
| --- | --- |
| Full repository check | Passed: 25 qualification, 126 server, and 369 client tests |
| Production build | Passed |
| Bundle budgets | Main 151.3 KiB; largest async 309.8 KiB; all JavaScript 666.1 KiB gzip |
| Production-path visual capture | Passed: one real room/replay/training scenario |
| Visual-state coverage | 40 states and motion samples; 91 captures |
| Native scene contract | 91/91 `gauntlet.board-stage.native.v1` |
| Board modules | 91/91 report 10 native modules |
| Duplicate visible cards | 0 in 91/91 captures |
| Structural composite rasters | 0 in 91/91 captures |

The capture distribution was 49 desktop, 9 ultrawide, 21 portrait, and 12
short-landscape frames. Evidence is in
`artifacts/babylon-visual-review/full-babylon-2026-08-26/`.

## Implementer visual review

Representative idle, selection, payment, incoming combat, placement, lane
combat, damage, replay, reconnect, and local-training captures were reviewed at
1366×768, 2560×1080, 1180×820, 820×1180, 844×390, and 390×844.

The review found and corrected:

1. uniformly blue/self-lit structural materials;
2. ornament and lane medallions competing with cards;
3. tablet portrait using the desktop profile and leaving large gutters;
4. short landscape shrinking the battlefield and allowing selected actions to
   overlap it;
5. ultrawide inheriting phone-landscape card scale;
6. mobile player-name and confirm/cancel clipping;
7. the tablet combat recap covering a playable lane;
8. a motion-capture race after lane damage.

The regenerated matrix was reviewed again after those corrections. No new
blocking composition, hierarchy, card-readability, or HUD-overlap issue was
found in the representative set.

## Asset decision

No new generated bitmap was added. The existing graphite material, approved
state masks, approved transient effects, card art/card back, native geometry,
and approved audio masters covered the visual language without introducing a
structural board raster or another provisional art dependency. This preserves
the independently addressable module contract and responsive layouts.

Authored GLB replacements, full PBR map sets, and expanded identity art remain
optional future enhancements. They are not required for this review candidate.

## Remaining human gates

- Score every required visual category in the review matrix with a named
  reviewer and date.
- Run five moderated ordinary-player sessions, including desktop and touch.
- Repeat 80–200% checks using actual browser chrome zoom.
- Record cold-load p95, settled FPS, and memory behavior on physical desktop
  and mobile targets.
- Complete final listening and level-balancing approval for the audiovisual
  cue set.
