# Babylon match asset inventory

The supplied composite is used as visual direction only, never as a runtime
atlas. Runtime assets stay individually addressable and have neutral fallbacks.

| Purpose | Runtime source | Status |
| --- | --- | --- |
| Visible 5:7 fronts | `/assets/gauntlet/playing-cards/{faction}-*.webp` through the existing card-art resolver | Integrated and cached by path |
| Hidden cards | `/assets/gauntlet/match/gauntlet-card-back-official.jpg` supplied from the approved Gauntlet art archive | Integrated; procedural graphite/navy/sapphire/bronze back remains the load-failure fallback |
| Faction identity | `/assets/gauntlet/{rumin,bizi,sheen,frumo}-card.webp` | Used in the identity system where available |
| Table surface | Approved `gauntlet-core-v1/materials/board-surface-candidate.webp` over generated physical depth | Production default; the neutral procedural surface remains the load-failure fallback |
| Board modules | Authored 2D board, lane, combat, payment, and dock surfaces over deterministic Babylon depth | Production default; optional GLB depth modules remain future enhancements |
| Materials and masks | Nine independently addressable WebP emissive masks | Approved and selected for idle, legal, active, opposed, blocked, resolving, payment, priority, and turn states |
| Lanes, rails, slots | Separate Babylon geometry and materials using the production palette | Provisional fallback; no composite-image sampling |
| Gameplay markers | Fourteen original SVG icons plus independent high-contrast Babylon GUI badges and DOM labels | SVG pack generated; approval and replacement of the current code-native markers remain pending |
| Effects | Seven independently addressable WebP cue assets plus restrained procedural fallback light | Approved runtime slices cover attack, block, payment, placement, damage, priority, and turn transitions |
| Match audio | Kit-addressable WAV variants keyed by presentation-cue occurrence IDs | Seventeen delivered WAVs are approved; all active semantic hooks resolve to the production pack and retain tone fallback safety |
| Missing assets | Neutral label texture and neutral card back | Integrated |

Textures use anisotropic filtering, are cached for the scene lifetime, and are
disposed with the scene. Normal updates do not recreate textures.

The approved 2026-08-10 production delivery is recorded by source and output checksum in
`gauntlet-core-v1/source/delivery-2026-08-10.json`. Opaque concept sheets and
unsliced atlases are not presented as runtime-ready assets. The authored board
surface is deliberately non-interactive: Babylon's shared geometry continues
to own placement, collision, responsive layout, and input bounds.

The production delivery specification and machine-readable cutover checklist
are in `PRODUCTION_ASSET_BRIEF.md` and `MATCH_ASSET_REQUIREMENTS.json`. Run
`npm run report:match-assets -- --strict` to verify the selected production form.
Optional GLB and full-PBR enhancements are reported separately from cutover.
