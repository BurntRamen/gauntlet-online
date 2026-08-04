# Official Babylon match experience

This directory contains one production-oriented match experience shared by the
local simulator, named visual fixtures, and explicitly flagged live matches.
The sandbox is a host for the real player-facing component; it is not a second
renderer.

## Boundaries

`ProductionMatchExperience` owns the HUD, contextual controls, accessibility,
privacy, reconnect, failure, and result presentation. `GauntletMatchCanvas`
owns one Babylon engine and scene. `createGauntletScene` owns stable meshes,
materials, camera fitting, animation targets, pointer handling, and disposal.

The renderer consumes a view model and semantic callbacks only. It never imports
the simulator, fixture controls, Socket.IO, room state, or server functions.

Adapters:

- `LocalDuelAdapter` runs deterministic Basic and two-player faction matches.
- `FixtureMatchAdapter` hosts static review snapshots.
- `LiveSocketAdapter` presents sanitized live snapshots and exposes the
  revisioned semantic-command bridge.

## Entry points

- `?babylon-test=1` opens Play mode at a deterministic opening deal. It exposes
  no fixture or developer controls and can progress through the complete rules
  engine to a result and a fresh match.
- `?babylon-test=1&babylon-dev=1` adds the optional seed, faction, fixture,
  perspective, rewind, legal-action, history, and state tools.
- `?babylon-test=1&review=1&fixture=<name>` opens a named review state with
  developer chrome hidden. `mode=factions&p1=frumo` selects a faction rules
  profile for faction-ability review.
- Supported two-player Basic and faction matches use this experience by default.
- `?renderer=babylon` remains an explicit diagnostic override for the production experience.
- `?renderer=react` activates the temporary emergency compatibility renderer.
  duel. The standard React match screen remains the default and automatic
  fallback.

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

`npm run test:e2e:usability` exercises the production Play-mode sequence without
developer controls: opening deal, independent attack, payment, hand block,
block payment, pass-pass closure, all six placement opportunities, next turn,
confirmed concession, result, and new match. This is automated interaction
evidence and does not replace the ordinary-player gate.

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
