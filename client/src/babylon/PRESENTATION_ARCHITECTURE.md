# Gauntlet match presentation architecture

The match renderer has an authored-asset boundary. Gameplay and adapters expose
authoritative view models and accepted event IDs; they do not select meshes,
textures, effects, or sounds.

## Runtime contracts

- `gauntlet.match-presentation.v1` maps stable presentation IDs to independently
  replaceable modules, PBR material sets, emissive masks, FX, and audio.
- `gauntlet.board-presentation.v1` projects the current view model into board
  states: idle, legal, active, opposed, blocked, and resolving.
- `gauntlet.presentation-cues.v1` gives visual and audio playback one timeline.
  Accepted events use match ID + event ID + cue + phase + target occurrence IDs.
- `gauntlet.battlefield-playback.queued.v1` decides when that timeline becomes
  visible. Networking and legality are never delayed.

The active kit is loaded from
`/assets/gauntlet/match/kits/gauntlet-core-v1/kit.json`. Candidate or approved
GLB modules may replace one procedural module at a time through the optional
`presentationModelLoader` bootstrap hook. The loader returns a cached source
with an `instantiate(instance)` method, keeping model decoding out of gameplay
and out of the always-loaded bundle. Missing loaders, provisional assets, or
failed modules independently retain their deterministic fallback; no asset
failure may stop a match.

## Authored module contract

GLB modules use Babylon Y-up coordinates, positive Z toward the opponent, and
an origin at the module mount center. A card is `2.3 x 3.22 x 0.1` board units.
The runtime owns module repetition and responsive transforms.

Required modules and attachment nodes are recorded in `kit.json`. Attachment
nodes locate card slots, readouts, state lights, effects, and generous invisible
interaction bounds. Authored visual bounds never define game legality.

## Asset approval

Every kit item is `provisional`, `candidate`, or `approved` and inherits or
declares provenance, ownership, licensing, revision, and checksum metadata.
The selected surface, mask, FX, and audio assets are approved. Generated and
code-native assets remain deterministic per-module fallbacks.

`npm run report:match-assets` reports normal fallback readiness. Add
`-- --strict` to enforce the production cutover gate; strict mode fails while a
required file is absent or not approved.

## Cue lifecycle

Board events publish semantic phases such as anticipate, travel, settle,
impact, and release. Babylon state light, sprite FX, contact/settle motion, and
audio resolve those cues through the active kit. Replay starts a new traversal
generation after an explicit seek or restart, allowing one fresh playback while
still rejecting duplicate snapshots.

Local UI feedback is created by semantic command wrappers with occurrence
tokens. Audio is never attached directly to a mesh click.
