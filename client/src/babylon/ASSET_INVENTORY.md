# Babylon match asset inventory

The supplied board composites are visual direction and provenance records, not
runtime layout. Production structure is composed from native Babylon modules;
runtime images remain independently addressable.

| Purpose | Runtime source | Status |
| --- | --- | --- |
| Visible 5:7 fronts | `/assets/gauntlet/playing-cards/{faction}-*.webp` through the card-art resolver | Integrated and cached by path |
| Hidden cards | `/assets/gauntlet/match/gauntlet-card-back-official.jpg` | Approved; deterministic card back remains the failure fallback |
| Board base | Babylon tabletop slab, inset field, frame, edges, and corner caps | Native modular geometry; art is provisional |
| Lane modules | One Babylon lane definition instanced three times with wells, rails, sigil, anchors, bounds, and interaction volume | Native modular geometry; art is provisional |
| Combat dais | Babylon attacker/blocker wells, versus socket, value/readout anchors, and FX anchor | Native module; art is provisional |
| Payment tray | Babylon tray with eight stable wells, readout, light, and discharge anchors | Native module; art is provisional |
| Pile docks | One aggregate dock definition instantiated four times with card/count anchors | Native modules; art is provisional |
| Base material | `/assets/gauntlet/match/graphite-table-v1.png` as a tiling material texture | Provisional; no gameplay layout is baked into it |
| Full-board concept | `gauntlet-core-v1/materials/board-surface-candidate.webp` | Reference-only, checksum preserved, not runtime-selectable |
| State masks | Nine independently addressable transparent WebPs | Approved; localized idle/legal/active/opposed/blocked/resolving/payment/priority/turn channels |
| Effects | Seven independently addressable transparent WebPs | Approved; attack, block, payment, placement, damage, priority, and turn hooks |
| Gameplay markers | Fourteen original SVG icons plus Babylon/DOM semantic readouts | Integrated; code-native marker art remains provisional |
| Audio | Seventeen kit-addressable WAV files keyed by presentation cue occurrence | Approved; deterministic tone fallback retained |
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
