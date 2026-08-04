# Babylon match composition validation

Do not commit review screenshots into the client source tree. Generate the
repeatable review matrix locally with `npm run capture:babylon-review`; it uses
`?babylon-test=1&review=1`, hides developer chrome, and writes ignored evidence
under `artifacts/babylon-visual-review/current/`.

## Current composition

- Exactly three full longitudinal lanes dominate the tabletop.
- Independent hand combat occupies its own elevated rail centered above the
  lanes and does not read as a fourth lane.
- Both players have compact identity, life, hand-count, connection, and priority
  plates.
- The local eight-card fan stays clear of the contextual action panel.
- Opponent hand, both lane rows, deck, discard, payment, and combat use distinct
  anchors.
- The camera fits normalized table anchors instead of stretching lanes on wider
  screens.
- All visible local, opponent-attack, payment, blocker, and faction card fronts
  and all lettered card backs are normalized upright to the current viewer.

The current repeatable evidence set is generated with:

```text
npm run capture:babylon-review
```

It writes a browsable matrix, manifest, final poses, and motion samples to
`artifacts/babylon-visual-review/current/`. The complete capture and
ordinary-player requirements live in `PRODUCTION_REVIEW_MATRIX.md`; the
fillable observer record lives in `HUMAN_PLAYTEST_SESSION_TEMPLATE.md`.

## Repeatable review URLs

Open each URL at the target viewport with browser chrome and the developer
drawer closed:

- `?babylon-test=1&review=1&fixture=populated-priority`
- `?babylon-test=1&review=1&fixture=select-attacker`
- `?babylon-test=1&review=1&fixture=select-payment`
- `?babylon-test=1&review=1&fixture=incoming-hand`
- `?babylon-test=1&review=1&fixture=select-blockers`
- `?babylon-test=1&review=1&fixture=lane-attack`
- `?babylon-test=1&review=1&fixture=same-lane-block`
- `?babylon-test=1&review=1&fixture=damage-resolution`
- `?babylon-test=1&review=1&fixture=end-placement`
- `?babylon-test=1&review=1&fixture=card-draw`
- `?babylon-test=1&review=1&fixture=priority-change`
- `?babylon-test=1&review=1&fixture=victory`
- `?babylon-test=1&review=1&fixture=defeat`
- `?babylon-test=1&review=1&fixture=populated-priority&connection=disconnected`

Use
`?babylon-test=1&review=1&fixture=default&seed=<recorded-seed>` for the
ordinary-player flow. The reviewer records viewport, perspective, fixture or
seed, rules version, revision, reduced-motion setting, and date alongside each
capture. Reconnect evidence uses the same populated fixture before, during,
and after the interruption so role and position continuity can be compared.
