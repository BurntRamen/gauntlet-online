# Gauntlet match-screen audiovisual audit — 2026-08-26

## Scope and direction

This pass audited the implemented Babylon match screen, authoritative event
playback, card-motion cues, interaction feedback, global match music, and
campaign dialogue. It preserves the approved Gauntlet board, effects, card art,
interaction model, original audio delivery, and deliberate physical-table
character. ElevenLabs was used only to fill three clear semantic gaps; it is not
called by the client or production server.

## Existing asset and trigger audit

| Asset or group | Implemented purpose and trigger | Decision |
| --- | --- | --- |
| `ui_click.wav` | Hand, lane, ability, and inspection selection | Retained; short and subordinate |
| `ui_hover.wav` | Available semantic hover asset | Retained but intentionally not auto-triggered; constant hover audio would be noisy |
| `ui_confirm.wav`, `ui_cancel.wav` | Explicit commit/cancel actions | Retained |
| `priority_change.wav` | Accepted `priority.granted` event; previously also fired immediately on pass and doubled as ability audio | Retained for accepted priority only; premature pass layer removed; ability use replaced |
| `card_lift.wav` | Anticipation on payment, placement, attack, and block card movement | Retained with a 90 ms repeat guard |
| `card_slide.wav`, `card_settle.wav` | Previously layered on nearly every travel/settle and multiplied during multi-card movement | Retained in the kit, but routine travel/settle hooks are now intentionally silent |
| `card_draw.wav` | One `cards.drawn` event cue at 120 ms | Retained; replaces per-card lift/travel/settle stacks |
| `lane_placement.wav` | `card.placedFacedown` at 760 ms, when the card visually settles | Retained |
| `payment_commit.wav` | Payment cards seat in the tray; payment release/discard event | Retained; redundant travel/settle/discard layers removed |
| `attack_declare.wav` | `attack.declared` at 820 ms, when commitment is visually clear | Retained; already communicates offense well |
| `block_commit.wav` | `block.declared` at 900 ms | Retained; already contrasts with attack declaration |
| `damage_impact.wav` | Positive damage at actual `damage.calculated` resolution | Retained for ordinary damage; no longer plays on zero damage |
| `turn_transition.wav` | `turn.started`; also reused for a deliberately neutral draw/spectator result | Retained |
| `victory_stinger.wav`, `defeat_stinger.wav` | Authoritative `match.ended` result | Retained; routing fixed to use winner and local perspective |
| Faction music (`rumin`, `sheen`, `frumo`, `bizi`, four MP3 tracks each) | Global match/menu music, default volume 0.18 | Retained without a new ambience bed |
| Campaign voice library | User-triggered before/after encounter dialogue | Retained; no automatic narration or combat voice lines added |
| Procedural Web Audio tones | Fallback when a semantic WAV cannot load | Retained as resilience, not the preferred mix |

The repository also contains the older provisional `assets/gauntlet/match/sfx`
set. The approved `gauntlet-core-v1` presentation kit remains authoritative, so
those fallback files were not duplicated or promoted.

## Improvements made

### New selected ElevenLabs assets

| Cue | File | Purpose | Runtime level |
| --- | --- | --- | --- |
| `combat.blocked` | `combat_fully_blocked.wav` | Dry defensive stop when resolved damage is zero | Below attack and damage |
| `damage.major` | `damage_impact_major.wav` | Heavier damage tier when resolved damage is 8 or more | Above ordinary damage, below match result |
| `ability.activate` | `ability_activate.wav` | Physical token/socket commitment distinct from priority transfer | Restrained meaningful commitment |

All three are 48 kHz mono 16-bit PCM WAV files. Prompts, generation metadata,
hashes, and review status are recorded under
`docs/generated-assets/elevenlabs/match-audio`. The former
`priority_change.wav` ability mapping remains available in source history.

Two alternates are retained in the kit's `audio/candidates` directory:
`combat_fully_blocked_b.wav` and `damage_impact_major_b.wav`. They are not mapped
to runtime cue IDs. The selected blocked cue was darker and more defensive; the
selected major-damage cue had the clearer weighted transient.

### Event correctness and synchronization

- Zero resolved damage now produces the dedicated successful-block sound and
  blocker visual, plus the readable callout “Attack stopped.”
- Damage of 8 or more selects the major-impact tier and “Major damage” callout.
- Ordinary positive damage retains the original impact at the authoritative
  resolution event, not attack declaration.
- Match victory, defeat, and draw are derived from the authoritative winner,
  local perspective, and spectator state. A missing local result can no longer
  default a loss to victory.
- Card placement, attack, and block cues remain aligned to their established
  settle offsets. Payment commitment remains aligned to tray settlement.
- Clicking Pass Priority is silent until the accepted `priority.granted` event,
  preventing an immediate cue followed by the same cue again.

### Audio hierarchy and clutter control

- Frequent minor cues have semantic cooldowns of 70–220 ms.
- One active source is allowed per semantic cue; a repeat replaces its own tail
  instead of stacking.
- Damage and match-ending cues briefly suppress and stop minor layers.
- Multi-card draw, replay staging, discard travel, routine travel, and routine
  settlement no longer emit per-card cue stacks. Their authoritative gameplay
  event supplies one readable sound when sound is useful.

## Intentionally silent gameplay moments

- Pointer hover, disabled controls, and failed/no-op input.
- Passive lane highlighting, legal-target glow, static priority indication, and
  health changes before authoritative resolution.
- Ordinary card travel and settle when a semantic placement, attack, block,
  payment, or draw cue already communicates the event.
- Replay staging motion itself; replayed authoritative events remain audible.
- The pass button press before server/local rules acceptance.
- Continuous board ambience. Existing faction music is the only continuous
  match layer, avoiding constant stimulation.

## Before and after

Before: the approved pack had strong physical attack, block, placement, and
result sounds, but one file served priority and abilities, fully blocked attacks
played damage, pass could double-fire priority, every card motion layered
generic lift/travel/settle sounds, and match losses could route to victory.

After: the original pack remains intact, three narrow semantic gaps have
dedicated sounds, damage has three readable outcomes (stopped, ordinary,
major), result routing is correct, and the motion mix is substantially less
repetitive. The presentation kit has checksum-valid mappings for all active
cues and no production cutover blockers.

## Test location

Run the backend and client from the repository root, then open the local client:

```powershell
npm --prefix server start
```

```powershell
$env:REACT_APP_SOCKET_URL='http://localhost:4000'
npm --prefix client start
```

At `http://localhost:3000`, choose a guest or account, open **Play**, select
**Practice**, and start **Basic vs AI**. This is the actual production Babylon
match screen. Use **Factions vs AI** to test ability activation. The Match menu
contains the sound mute control.

Useful validation commands:

```powershell
npm run report:match-audio
npm run report:match-assets -- --strict
npm --prefix client test -- --watch=false --runInBand src/babylon/presentationCues.test.js src/babylon/battlefieldPlayback.test.js src/babylon/cardMotion.test.js src/babylon/ProductionMatchExperience.test.js
```

## Deferred opportunities

- Optional music ducking during match-result stingers, after listening on the
  final music masters.
- Carefully limited stereo positioning by player side or lane; not implemented
  because mono readability and accessibility should be validated first.
- Faction-specific physical material accents, only if they can remain subtle
  and share the same semantic hierarchy.
- A dedicated neutral draw stinger. The retained turn transition is used for
  now rather than spending generation budget on a rare state.
- Additional voice work. Existing campaign narration is explicit and
  user-controlled; combat narration was not justified for repeated play.
