# Gauntlet sonic identity v2 selection report

Date: 2026-08-26

The batch uses one repeated material vocabulary: dark walnut, graphite, dense
linen-laminated cards, dark leather, and restrained aged-bronze mechanics. All
files are static 48 kHz mono WAV assets generated with
`eleven_text_to_sound_v2`; the live client makes no ElevenLabs calls.

## Generation accounting

- Successful Sound Effects API calls: 24
- Reported generation character cost: 244
- Rejected validation attempts: 1. The first over-length prompt was rejected
  before any WAV was produced; the prompts were shortened and resubmitted.
- Exact prompts, request parameters, hashes, and output paths are stored in the
  adjacent per-job JSON provenance records and
  `scripts/elevenlabs-sonic-identity-v2.json`.

## Active selections

| Cue | Selected file | Source comparison | Post-mix active RMS proxy |
| --- | --- | --- | ---: |
| Card placement | `card_seat_apparatus_b_master.wav` | Longer tactile seating sequence than A; materially distinct from the generic original | -32.3 dBFS |
| Payment commit/release | `payment_commit_apparatus_b_master.wav` | Denser, more readable lock than A; avoids coin/reward language | -28.7 / -27.5 dBFS |
| Attack declaration | `attack_commit_apparatus_b.wav` | Stronger, cleaner forward transient than A | -27.5 dBFS |
| Block commitment | `block_commit_apparatus_b_master.wav` | Lower, less bright braced transient than A; contrasts with attack | -27.8 dBFS |
| Fully blocked resolution | `fully_blocked_absorption_b_master.wav` | Stronger absorbed-force body than A with very low brightness | -26.0 dBFS |
| Ordinary damage | `damage_consequence_apparatus_a_master.wav` | Slightly faster and more decisive than B while remaining compact | -26.5 dBFS |
| Major damage | `major_damage_consequence_b_master.wav` | Materially denser and heavier than A and ordinary damage | -24.3 dBFS |
| Victory | `match_victory_apparatus_b_master.wav` | Mechanical rhythmic closure instead of a musical/reward stinger | -23.9 dBFS |
| Defeat | `match_defeat_apparatus_a_master.wav` | Fuller controlled decay than B; sober without a failure buzzer | -23.6 dBFS |
| Draw | `match_draw_apparatus_b_master.wav` | Balanced mechanical closure without rising/falling melody | -24.2 dBFS |

The prior files remain present at their original paths. The active kit records
each one as `previousPath` and `previousChecksum`, so reverting a subjective
choice does not require regenerating or recovering an overwritten binary.

Selected raw ElevenLabs candidates are also preserved. Nine use deterministic
offline mastered derivatives made by `scripts/master-match-audio.js`; attack B
keeps the raw generated source because compression weakened its directional
transient. The mastering step performs no network calls and exists to make the
runtime hierarchy hold under Web Audio's unity gain clamp.

## Originals retained after comparison

| Cue | Retained file | Reason |
| --- | --- | --- |
| Ability activation | `ability_activate.wav` | The already-active ElevenLabs token/socket cue is shorter, darker, and less fatiguing than v2 A, B, and C. |
| Priority acceptance | `priority_change.wav` | The generated priority-index candidate was markedly brighter and risked reading as a chirp; the existing neutral mechanism remains clearer. |
| Card lift/draw and basic UI | Existing kit files | They already serve subordinate interaction roles and replacing them would broaden the pass without improving core combat identity. |

## Candidate decisions

- A/B alternates not selected remain `candidate` in provenance and are not
  referenced by the presentation kit.
- Ability A/B/C and priority A remain candidates only.
- Outcome A/B variants were compared again after the first outcome family
  proved too glass-forward. Victory B and draw B use the refined damped
  mechanical language; defeat A remained the stronger controlled source.
- No candidate reintroduces per-card travel, settle, or discard stacking.

## Automated acceptance limits

Selection used in-context semantic timing plus waveform measurements: onset,
active duration, peak, gated active RMS, crest factor, transient density, and a
brightness proxy. Repeated-play automation verifies cooldown, suppression,
single-source polyphony, duplicate-event rejection, and mute cancellation.
A final subjective pass on the user's actual speakers/headphones is still the
authority for timbre and fatigue.
