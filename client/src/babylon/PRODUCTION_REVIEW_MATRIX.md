# Native Babylon production experience gate

The match client is not approved by a passing build or an attractive static
capture alone. Approval requires real product routes, transition evidence, and
an ordinary-player playability session with developer tools closed.

## Capture protocol

- Create a real two-player socket room through the tracked `/play` flow. Do not
  use query-string fixtures or production-only test routes.
- Drive the same match through the production `ProductionMatchExperience`,
  finish it, and open its authoritative Replay.
- Open `/training` separately to prove the local adapter uses the same native
  board, actor registry, transition planner, materials, and responsive layout.
- Capture desktop, ultrawide, tablet, 390×844 portrait, and 844×390 short
  landscape layouts.
- Capture meaningful actions before selection, while selected, at transition
  start and midpoint, after settlement, during resolution/departure, and in the
  final canonical pose.
- Keep private information private. Development diagnostics may report actor
  counts and zones, but production diagnostics must not expose card identities.
- Score every state for rule clarity, spacing, card readability, hierarchy,
  interaction feedback, Gauntlet identity, and animation quality.

Run the automated capture with:

```text
npm run capture:babylon-review
```

The review is written to
`artifacts/babylon-visual-review/current/index.html`. Its manifest records the
viewport, dimensions, scene contract, module counts, actor counts, duplicate
identity count, active motions, structural-raster count, and responsive
profile for each capture.

Set `BABYLON_REVIEW_OUTPUT` to a new path under
`artifacts/babylon-visual-review/` for any evidence that must be retained. A
named output will not be overwritten accidentally. The manifest includes Git,
rules, reduced-motion, output, and discovered real-match seed provenance.

For art-direction review, generate a side-by-side package after both matrices
exist:

```text
npm run compare:babylon-review -- --before artifacts/babylon-visual-review/<baseline> --after artifacts/babylon-visual-review/<candidate> --output artifacts/babylon-visual-comparison/<new-package>
```

Default mappings cover neutral/rest, priority, attack availability and
commitment, legal and committed blocks, fully blocked resolution, ordinary and
major damage, ability activation, placement, victory, and mobile combat. A
missing source frame is reported as unavailable and remains a visible review
gap.

## Required visual and motion states

| State | Production path | Required evidence |
| --- | --- | --- |
| Neutral and local priority | Real socket room | Three native lanes, restrained state lights, readable shell hierarchy |
| Attack selection | Real socket room | Actor remains in hand; destination illuminates |
| Payment | Real socket room | Selected cards remain in hand, then each actor enters a distinct tray slot and departs |
| Hand attack | Real socket room | One actor travels once and settles on the combat dais |
| Multi-block | Real socket room | Distinct blocker paths and slots; attacker remains readable |
| Combat resolution | Real socket room | Impact, life response, and clean discard departures |
| Placement | Real socket room | Selection remains in hand; accepted actor moves to a lane and becomes facedown |
| Draw and turn transition | Real socket room | New actors originate at the deck and settle into hand without collision |
| Lane attack and block | Real socket room | Existing lane actors travel through lane-owned anchors without duplicates |
| Reconnect | Real socket room reload | Canonical scene reconciles without replaying stale motion |
| Replay and seek | Authoritative Replay | Same registry and geometry; seek rebuilds without stale actors |
| Local adapter | `/training` | Same scene contract, modules, and zero-duplicate gate |

Every capture fails if one logical card appears twice, selection moves a card
prematurely, a replacement actor pops into existence, important cards overlap,
the board relies on a structural composite raster, or broad flat overlays
replace physical module state.

## Automated gates

`e2e/babylon-live.spec.js` exercises the full native client through a real
two-player room: attack selection and cancellation, payment, hand blocking,
decline, resolution, pass-pass closure, six-step placement, Turn 2, lane
attack, lane block, reconnect, result handling, Replay, responsive layouts,
accessibility, and renderer fallback.

`e2e/babylon-visual-review.spec.js` records the transition matrix above and
asserts native scene diagnostics at every state. The capture test is evidence
for review; it is not a substitute for human approval.

The strict asset report additionally rejects a runtime-selectable full-board
structural composite. Authored textures may be used only as materials, decals,
masks, icons, card art, or transient FX.

## Human playability gate

Run moderated sessions with participants who were not involved in
implementation, including desktop and touch users. Without fixture controls,
logs, or a layout explanation, each participant must be able to:

- identify turn, priority, and the active combat area;
- distinguish hand and lane attacks;
- identify attackers, blockers, payment cards, and facedown lane cards;
- select and cancel before confirming without moving the source card;
- complete attack, payment, block/decline, placement, draw, and result flows;
- understand movement, settlement, damage, discard, priority, and turn cues;
- finish a Basic match and understand its Replay.

Record hesitation, mistaken clicks, duplicate submissions, role confusion,
missed state changes, responsive-layout issues, and use of accessibility
controls. The gate fails on unresolved critical workflow confusion or required
facilitator intervention.

## Approval record

Each approved capture or session records viewport, route/source, rules version,
revision, reduced-motion setting, reviewer, and date. Automated success means
the state is ready for review; qualitative approval and production smoke
qualification remain explicit release gates.
