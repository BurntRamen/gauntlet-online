# Official Babylon match experience

This directory contains the production match experience used by supported live,
training, and campaign matches.

## Boundaries

`ProductionMatchExperience` owns the HUD, contextual controls, accessibility,
privacy, reconnect, failure, and result presentation. `GauntletMatchCanvas`
owns one Babylon engine and scene. `createGauntletScene` owns stable meshes,
materials, camera fitting, animation targets, pointer handling, and disposal.
`BoardStage`, `PresentationSnapshot`, `PresentationTransitionPlanner`, and
`CardActorRegistry` explicitly separate physical modules from persistent cards.

The replaceable production boundary and cue lifecycle are defined in
`PRESENTATION_ARCHITECTURE.md`. The runtime kit is versioned separately from
gameplay. Native modular Babylon geometry is the production board. Approved
mask, FX, and audio resources augment it; the former full-board concept is
reference-only and never supplies runtime layout.

The renderer consumes a view model and semantic callbacks only. It never imports
Socket.IO, room state, or server functions.

`LiveSocketAdapter` presents sanitized live snapshots and exposes the revisioned
semantic-command bridge. `LocalDuelAdapter` is the shared engine-backed base used
for local match behavior and unit coverage; it is not exposed through a browser
test route.

## Entry points

- Supported Basic, faction, training, campaign, ranked, and draft matches use
  this experience through their normal application entry points.
- `?renderer=babylon` remains an explicit diagnostic override for the production experience.
- `?renderer=react` activates the temporary emergency compatibility renderer.
  The standard React match screen remains the automatic emergency fallback.

## Player-facing guidance

- Neutral priority names the active player and the available hand attack, lane
  attack, faction-action, and pass choices.
- Occupied lane cards are directly clickable whenever the authoritative legal
  actions include `declareLaneAttack`. During lane combat, only the legal
  same-lane blocker is clickable. Neutral lanes remain visually restrained;
  sapphire rails appear after selection or during a required response.
- End placement is numbered from 1 through 6 and always names the acting
  player, lane, and place-or-skip choice.
- Accepted engine commands return to the authoritative current instruction;
  action-log labels do not replace the next required decision.
- Rejections remain visible beside the attempted action.
- The collapsed Match menu exposes confirmed concession in the local simulator
  and the supported room controls in live matches.

`npm run test:e2e` exercises the normal lobby, training, campaign, ranked, and
draft entry paths without production fixture routes. This automated interaction
evidence does not replace the ordinary-player gate.

## Spatial and orientation invariants

- The table always has exactly three lanes.
- Independent hand combat uses the raised rail centered above the three lanes;
  it is never transformed into a lane.
- Lane attacks remain attached to their source lane.
- Payment, blockers, hand combat, lane combat, hands, deck, discard, and
  face-down cards use separate anchors.
- Every visible front and the lettered official card back use a dedicated face
  plane and are normalized upright to the current viewer.
- Opponent and spectator projections never contain unauthorized card fronts.

The interaction hierarchy is inspired by polished digital card games—physical
cards, direct manipulation, responsive staging, and progressive information—
without copying another game's board, frames, mechanics, branding, or effects.
