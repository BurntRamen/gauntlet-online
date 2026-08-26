# Gauntlet native match-presentation architecture

The production match screen is a game client, not a board photograph with
interactive overlays. Gameplay owns authoritative state and legality. The
presentation projector turns that state into semantic actors, modules, and
cues; Babylon owns their physical representation; React owns application UI
and accessible controls.

## Runtime contracts

- `gauntlet.match-presentation.v1` maps semantic module, material, mask, FX,
  and audio IDs to independently replaceable resources.
- `gauntlet.board-stage.native.v1` defines the renderer-owned module graph,
  attachment anchors, bounds, interaction volumes, and responsive transforms.
- `gauntlet.presentation-snapshot.v1` describes what is legally visible,
  without animation instructions.
- `gauntlet.presentation-transitions.v1` diffs consecutive snapshots and emits
  one semantic transition per actor and accepted event.
- `gauntlet.card-actor-registry.v1` owns one runtime mesh hierarchy for each
  visible actor identity.
- `gauntlet.presentation-cues.v1` synchronizes actor motion, module lights, FX,
  feed timing, and audio.
- `gauntlet.presentation-cadence.v1` is the single tier, beat, and timing
  authority shared by live and replay presentation.
- `gauntlet.battlefield-playback.queued.v1` gives those cues readable visual
  pacing without delaying networking, legality, or authoritative state.

## Scene graph

`GauntletMatchScene` contains six explicit ownership layers:

- `BoardStage`: board base, three lane instances, combat dais, payment tray,
  and four pile-dock instances.
- `CardLayer`: persistent card roots, faces, backs, selection rims, and contact
  shadows.
- `StateLightingLayer`: localized lane, combat, payment, priority, and turn
  channels.
- `TransientFxLayer`: pooled, temporary semantic effects.
- `WorldReadoutLayer`: board-mounted values and pile counts.
- `ReactShell`: identity, life, navigation, action controls, history, replay
  transport, accessibility, results, and emergency fallback.

The board has ten physical module instances: one base, three lanes, one combat
dais, one payment tray, and four pile docks. Cards resolve destinations through
module-local anchors; responsive profiles transform each module and its anchors
together.

## Card actor lifecycle

Known cards prefer runtime/card-instance identity and retain one actor while
moving between hand, lane, combat, payment, and discard. Selection changes
lift, rim, and destination illumination only; it never changes the actor's
semantic zone. An accepted event causes one queued transition. Repeated
snapshots update the existing actor and do not recreate its mesh, texture, or
contact shadow.

Private opponent hand and lane cards use anonymous slot identities. If an
accepted public event proves continuity, the registry rebinds the anonymous
record to the known identity in place. Otherwise it performs a same-position
reconciliation and never displays hidden and revealed versions together.
Decks and discards are aggregate board modules; a newly visible draw actor is
created at the deck anchor, and a departing actor is released after it reaches
the discard anchor.

Live sockets, local/training adapters, authoritative replay, and imported JSON
replay all produce the same presentation snapshots and use the same transition
planner, registry, board modules, paths, materials, cues, and scene. Replay seek
reconciles directly; one-step traversal may animate an evidenced transition.

## Presentation cadence

`gauntlet.presentation-cadence.v1` gives every accepted presentation event one
of five intensity tiers: rest (0), attention (1), commitment (2), resolution
(3), or major resolution (4). The tier selects a restrained effect grammar,
material role, sprite and ring alpha, and local board response. This keeps
informational beats quiet, gives attack and block different physical language,
and reserves the strongest response for consequential damage and match results.

Related events are coalesced into one readable beat rather than presented as
competing notifications. Payment joins the attack or block it commits to;
damage consequences join the associated priority handoff; draw joins the turn
handoff; campaign aliases collapse into their canonical events; and supported
ability mutations resolve as one mutation beat. Empty payment and draw records
do not create visual beats.

The cadence contract owns event duration, cue offsets, and shared card-motion
profiles for hover, payment, draw, placement, attack, block, lane shift,
swap-return, replay staging, discard, and correction. Playback commits the
projected visual state at the resolution boundary of the beat, so life totals
and board consequences change when the corresponding impact is shown rather
than when a queued beat merely begins. The cue projector exposes the same
contract, kind, tier, grammar, material role, alpha limits, board response, and
effect duration to Babylon. Live play and replay consume that common projection
and therefore preserve the same event ordering, emphasis, and visual cadence.

While live playback is presenting a queued beat, the product shell temporarily
gates gameplay input across React controls, keyboard shortcuts, accessible
controls, and Babylon hit targets. Networking, legality, and authoritative state
remain immediate, while read-only inspection and Match-menu information remain
available. The gate releases with the presented frame so the visible action and
the next accepted command cannot contradict one another.

## Authored-asset boundary

The active kit is loaded from
`/assets/gauntlet/match/kits/gauntlet-core-v1/kit.json`. Authored GLB modules may
replace one native module at a time through `presentationModelLoader`; every
module retains deterministic geometry if its file or loader is unavailable.
Shared resources are cached for the scene lifetime and disposed with the scene.

GLBs use Babylon Y-up coordinates, positive Z toward the opponent, an origin at
the module mount center, and a `2.3 x 3.22 x 0.1` card reference. Attachment
nodes locate card slots, readouts, lights, effects, and generous invisible
interaction bounds. Visual bounds never define game legality.

The former full-board WebP is retained with its checksum as an art-direction
reference. It is marked `referenceOnly`, `runtimeSelectable: false`, and
`structuralComposite: true`; production code does not load it. Runtime images
are limited to tiling materials, decals, emissive masks, card art, icons, and
temporary FX. The strict asset report fails if a structural composite becomes
runtime-selectable.

## State, motion, and diagnostics

Idle modules remain readable without glow. Legal, active, opposed, blocked,
and resolving states illuminate narrow physical rails, inlays, masks, or
module-local effects rather than filled board rectangles. Card paths are
computed against actor bounds, module bounds, and reserved active trajectories.
Selection has no travel; accepted travel has one settle; departure keeps the
same actor until the aggregate pile receives it.

Safe diagnostics expose scene contract, module inventory and bounds, actor
counts by zone/privacy, active and queued transitions, duplicate visible
identities, structural composite count, active effects, and responsive profile.
Private identities are never emitted. Development builds log duplicate actor
metadata; normal production has no visible debug overlay.

## Approval and cutover

Every kit item is `provisional`, `candidate`, or `approved` and records revision,
provenance, ownership, licensing, and checksum metadata. Approved cue masks,
FX, and audio are current production assets. Native code geometry, the tiling
graphite material, future GLBs, and expanded PBR material sets remain explicitly
provisional and independently replaceable.

`npm run report:match-assets` reports fallback and provenance state. Run
`npm run report:match-assets -- --strict` for the runtime cutover gate.
