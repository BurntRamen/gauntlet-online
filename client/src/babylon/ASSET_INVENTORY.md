# Babylon match asset inventory

The supplied board composites are visual direction and provenance records, not
runtime layout. Production structure is composed from native Babylon modules;
runtime images remain independently addressable.

| Purpose | Runtime source | Status |
| --- | --- | --- |
| Visible 5:7 fronts | `/assets/gauntlet/playing-cards/{faction}-*.webp` through the card-art resolver, including the complete neutral `basic-*` family | Integrated and cached by path; Basic master and deterministic overlay provenance recorded |
| Hidden cards | `/assets/gauntlet/card-backs/classic-gauntlet-v2.webp` plus earned variants | C-30-aligned; selected cosmetic is used with a deterministic Classic fallback |
| Board base | Babylon tabletop slab, inset field, frame, edges, and corner caps | Integrated visual baseline; native modular geometry; independent human signoff pending |
| Lane modules | One Babylon lane definition instanced three times with wells, rails, sigil, anchors, bounds, and interaction volume | Integrated visual baseline; native modular geometry; independent human signoff pending |
| Combat dais | Babylon attacker/blocker wells, versus socket, value/readout anchors, and FX anchor | Integrated visual baseline; independent human signoff pending |
| Payment tray | Babylon tray with eight stable wells, readout, light, and discharge anchors | Integrated visual baseline; independent human signoff pending |
| Pile docks | One aggregate dock definition instantiated four times with card/count anchors | Integrated visual baseline; independent human signoff pending |
| Base material | `/assets/gauntlet/match/graphite-table-v1.png` as a tiling material texture | Integrated neutral graphite/stone material; no gameplay layout is baked into it; independent human signoff pending |
| Full-board concept | `gauntlet-core-v1/materials/board-surface-candidate.webp` | Reference-only, checksum preserved, not runtime-selectable |
| State masks | Independently addressable transparent WebPs | Approved and revalidated; localized idle/legal/active/opposed/blocked/resolving/payment/priority/turn channels |
| Effects | Independently addressable transparent WebPs | Approved and revalidated; attack, block, payment, placement, damage, priority, and turn hooks |
| Gameplay markers | Fourteen original SVG icons plus Babylon/DOM semantic readouts | Integrated visual baseline; independent human signoff pending |
| Audio | Twenty unique approved WAV masters mapped across 25 semantic cue keys | Manifest-approved; deterministic tone fallback retained; final human listening approval pending |
| Optional GLBs | Board, lane, combat, payment, and pile module paths in `kit.json` | Provisional future authored replacements; not required for current cutover |
| Optional PBR sets | Engraved graphite, bronze, steel, wells, and sapphire definitions | Provisional future fidelity replacements |

Textures are cached for the scene lifetime and disposed with the scene. Stable
card actors keep their material and texture across ordinary revisions and zone
changes.

The 2026-08-10 delivery and its source/output checksums remain recorded in
`gauntlet-core-v1/source/delivery-2026-08-10.json`. The 2026-08-11 native-board
cutover reclassifies the full-board output as art-direction reference while
preserving that history. Opaque concept sheets and unsliced atlases are never
presented as runtime modules.

Run `npm run report:match-assets` for the informational inventory and
`npm run report:match-assets -- --strict` for approved required assets,
integrity, and the zero-runtime-structural-composite gate.

The 2026-08-26 full visual pass did not add a generated bitmap. It retained the
native fabrication system and independently addressable approved cue assets,
then qualified 91 production-path captures with zero structural composite
rasters. See `FULL_BABYLON_VISUAL_QUALIFICATION_2026-08-26.md`.

The subsequent 2026-08-26 art-direction and cadence pass also leaves the asset
approval table unchanged. Two generated surface candidates were rejected during
review. An ElevenLabs priority-transfer keyframe request was also submitted,
but the service rejected it before generation because the connected account
lacks the required Pro plan; no visual/video candidate entered the runtime.
The pass instead subordinates the existing ornaments and approved transient
assets to a shared native presentation cadence. Native board modules,
fabrication details, and optional authored replacements remain provisional
pending independent human art-direction signoff. See
`BABYLON_ART_DIRECTION_CADENCE_QUALIFICATION_2026-08-26.md`.
