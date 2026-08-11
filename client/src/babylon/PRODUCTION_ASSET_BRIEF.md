# Babylon production asset brief

The renderer already has the complete faction card-front library, the approved
Gauntlet card back, a usable graphite table texture, four faction music sets,
and campaign/ability voice files. New work should focus on the assets that make
the match feel authored rather than procedural. Do not supply a composite board
image or a runtime atlas; every element must remain independently addressable.

## Production kit boundary

The selected production form targets `gauntlet-core-v1/kit.json`: native
modular Babylon geometry with independently addressable material, light, FX,
and audio resources. Authored GLB replacements must follow the attachment-node
names and `2.3 x 3.22 x 0.1` card reference. No replacement may encode the full
gameplay layout in one raster.

Each module's PBR materials and emissive state masks remain independently
replaceable. Every delivery must update status, revision, creator/source,
license or approval owner, and checksum metadata before it can pass strict
cutover validation.

### Approved production delivery

The 2026-08-10 delivery established the approved cue resources without weakening
this boundary. Its full-board output is retained by checksum as art-direction
reference and is not loaded by production. The transparent state masks and FX
slices remain independently addressable runtime assets. Native module geometry
stays fully functional if any authored resource fails. GLB modules and expanded
PBR maps are optional fidelity enhancements, not blockers for the native-client
cutover.

The delivered audio pack is mapped directly to stable semantic cue IDs and
plays on the shared visual queue clock. It is approved for production use. The
supplied mask and FX atlases have deterministic independently addressable
runtime slices; displaying a complete atlas as one effect remains forbidden.

## Priority 1: table and identity kit

- One neutral Gauntlet crest and one crest for each faction as clean SVGs with
  transparent backgrounds and simple silhouettes that remain readable at 32px.
- One neutral commander portrait and one portrait for each faction. Deliver
  768x960 WebP plus the layered source. Keep faces and defining marks inside the
  center 70% so desktop and mobile crops both work.
- A tabletop material set: seamless 2048x2048 graphite/deep-navy albedo, optional
  1024x1024 normal and roughness maps, and separate bronze/steel trim materials.
- A transparent 1920x1080 table-frame overlay or separable top, bottom, and side
  ornaments. Keep the center transparent and do not bake lanes into the frame.
- Seamless lane-inlay and card-slot materials at 1024x1024. Lanes must support
  neutral, sapphire-active, pale-steel-defense, and restrained-danger tinting.

## Priority 2: gameplay icon kit

Supply attack, block, payment, priority, placement, damage, pass, inspect,
confirm, cancel, draw, discard, connection, and sound icons as individual SVGs.
Use a 24x24 viewBox, round-safe geometry, current-color fills/strokes, and no
embedded text. Every icon must remain identifiable without color and should be
reviewed at 16px, 24px, and 44px touch-control size.

## Priority 3: effect sprites

The most useful transparent effects are attack declaration, block raise,
payment discard, damage impact, priority transfer, turn transition, draw, and
victory/defeat. Deliver individual WebP sequences or sprite sheets with frame
metadata, premultiplied-alpha-safe edges, and no baked board background.

Use 512x512 for local effects and 1024x256 or 1024x512 for table-spanning
streaks. Effects should be brief and restrained: sapphire for interaction,
bronze for payment/commitment, pale steel for defense, and red-orange only for
damage. Do not imitate another game's targeting arrow or signature effects.

## Priority 4: match sound effects

The renderer currently uses temporary oscillator tones. The first production
audio delivery should include these short one-shots:

- UI select, confirm, cancel, and pass.
- Card lift, card place, card draw, and payment discard.
- Attack declaration, block declaration, and damage impact.
- Priority transfer and turn start.
- Ability activation.
- Victory and defeat.

Deliver 48kHz/24-bit mono WAV masters plus Ogg Vorbis runtime files. The first
in-repo generated pack uses the WAV masters directly because this workspace has
no approved Ogg encoder; the browser supports them and they can be transcoded
later without regenerating the sound design. UI sounds
should generally be 50-120ms, card/action sounds 150-350ms, and result stingers
600-1200ms. Normalize the set consistently, leave headroom below -1 dBTP, avoid
long reverb tails, and provide at least three subtle variants for frequently
repeated select, place, attack, block, and damage sounds.

Existing faction music and voice assets can be reused after ownership and
licensing are confirmed. A subtle seamless neutral-match ambience loop would be
helpful, but is lower priority than readable action SFX. Do not attach results
to mesh clicks: final audio remains keyed to accepted stable event IDs.

## Delivery and naming

The expected paths are recorded in `MATCH_ASSET_REQUIREMENTS.json`. Run
`npm run report:match-assets` after adding files. The report is informational
until assets are approved; `npm run report:match-assets -- --strict` fails when
any cutover-required file is absent.

For every delivery include creator/source, license or approval owner, revision,
and whether the asset is final or provisional. Preserve source files outside
the runtime asset directory and export only optimized runtime files into
`client/public/assets/gauntlet/match`.
