# Babylon match composition validation

Do not commit review screenshots into the client source tree. Generate the
repeatable review matrix locally with `npm run capture:babylon-review`; it uses
the normal room, match, and replay routes against the local server and writes
ignored evidence under `artifacts/babylon-visual-review/current/`. It does not
add or depend on production test/fixture routes.

## Current composition

- Exactly three full longitudinal lanes dominate the tabletop.
- Independent hand combat occupies its own elevated rail centered above the
  lanes and does not read as a fourth lane.
- Both players have compact identity, life, hand-count, connection, and priority
  plates.
- The local eight-card fan stays clear of the contextual action panel.
- Opponent hand, both lane rows, deck, discard, payment, and combat use distinct
  anchors.
- The camera selects authored desktop, ultrawide, portrait, and short-landscape
  module compositions instead of stretching one board across every ratio.
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

The full 2026-08-26 review candidate is preserved separately at
`artifacts/babylon-visual-review/full-babylon-2026-08-26/`: 40 states, 91
captures, four responsive profiles, 91 native-scene contracts, zero duplicate
visible identities, and zero structural composite rasters. Its qualification
record is `FULL_BABYLON_VISUAL_QUALIFICATION_2026-08-26.md`.

## Repeatable production-path states

The capture script creates a real Basic room, reconnects both players through
the normal client entry path, and drives priority, attacker selection, payment,
incoming combat, blocker/payment selection, immediate block resolution, match
completion, and public replay. Each stable state is captured at desktop,
ultrawide, tablet, and phone dimensions; the same-frame block resolution also
gets an early motion sample. The resulting manifest records the exact captures
for review without exposing any fixture route in the shipped application.
