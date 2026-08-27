# Gauntlet match-screen audiovisual audit — 2026-08-26

## Sonic identity v2 — current implementation

This pass made actual ElevenLabs Sound Effects API calls and replaces the core
recurring source material, while preserving the verified routing, timing,
silence, cooldown, suppression, polyphony, and result-perspective behavior from
the baseline below. It changes no Babylon board, layout, animation, or approved
visual asset.

### One related material language

Every v2 prompt uses the same physical palette: dark walnut, graphite, dense
linen-laminated cards, dark leather, and aged-bronze mechanisms recorded dry
and close. Attack moves forward; block plants and braces; full block absorbs;
damage transfers consequence through the apparatus; major damage uses the same
materials at greater mass. Match results resolve stored mechanical tension
instead of playing reward/failure jingles.

Twenty-four successful ElevenLabs calls produced A/B candidates for the
recurring family, A/B/C candidates for ability, a priority candidate, and two
iterations of the result family. One initial over-length request was rejected
before audio generation. Exact prompts, API parameters, hashes, status, and
outputs are in `scripts/elevenlabs-sonic-identity-v2.json` and
`docs/generated-assets/elevenlabs/sonic-identity-v2`.

### Active replacements

| Gameplay cue | Active v2 file | Prior file retained at |
| --- | --- | --- |
| Card placement / seating | `card_seat_apparatus_b_master.wav` | `audio/lane_placement.wav` |
| Payment commitment and release | `payment_commit_apparatus_b_master.wav` | `audio/payment_commit.wav` |
| Attack declaration | `attack_commit_apparatus_b.wav` | `audio/attack_declare.wav` |
| Block commitment | `block_commit_apparatus_b_master.wav` | `audio/block_commit.wav` |
| Fully blocked resolution | `fully_blocked_absorption_b_master.wav` | `audio/combat_fully_blocked.wav` |
| Ordinary damage | `damage_consequence_apparatus_a_master.wav` | `audio/damage_impact.wav` |
| Major damage | `major_damage_consequence_b_master.wav` | `audio/damage_impact_major.wav` |
| Victory | `match_victory_apparatus_b_master.wav` | `audio/victory_stinger.wav` |
| Defeat | `match_defeat_apparatus_a_master.wav` | `audio/defeat_stinger.wav` |
| Draw | `match_draw_apparatus_b_master.wav` | `audio/turn_transition.wav` |

The kit maps active cues to new descriptive paths under
`audio/elevenlabs/sonic-identity-v2`. Nine selections use deterministic offline
mastered derivatives; attack keeps the raw candidate because compression
weakened its forward transient. The mastering script makes no network calls
and ensures the hierarchy remains true under Web Audio's unity gain clamp.
Nothing was overwritten: each mapping also records `previousPath` and
`previousChecksum`. Raw generated sources and unselected candidates remain
available and are not referenced at runtime.

### Originals deliberately retained

- `ability_activate.wav`: the already-active ElevenLabs token/socket cue is
  shorter, darker, and less fatiguing than v2 ability A, B, and C.
- `priority_change.wav`: the new priority-index candidate measured markedly
  brighter and risked reading as a UI chirp; the original remains neutral.
- UI select/confirm/cancel, card lift/draw, and turn transition: these continue
  to perform subordinate interaction/boundary roles without competing with the
  new core family.
- Hover, card travel, card settle, card discard, and premature priority pass
  remain intentionally silent. No per-card stacking was restored.

### Revised hierarchy for the new sources

The shared policy was retuned against gated active RMS rather than reused
blindly. Current post-mix proxies are:

| Tier | Examples | Active RMS proxy |
| --- | --- | ---: |
| Interaction | Card seat | −32.3 dBFS |
| Commitment | Payment, attack, block, ability | −28.7 to −27.5 dBFS |
| Resolution | Full block, ordinary damage | −26.5 to −26.0 dBFS |
| Major | Major damage, result | −24.6 to −23.6 dBFS |

The mastered sources use positive or negative source-specific trims according
to density; sample peaks, final gains, and the Web Audio unity clamp are checked
together. The loudest projected peak remains below 0 dBFS, and major/result
suppression prevents clutter from minor actions. Recurring commitment
cooldowns increased to 420–500 ms and resolution suppression to 520 ms to
match the longer physical candidates.

### Before and after

Before v2, most recurring actions still used the original heterogeneous pack,
so the prior routing and mix fixes were intentionally subtle. After v2, card
seating, payment, attack, block, absorbed force, both damage tiers, and all
three results share an immediately different apparatus vocabulary. The two
retained semantic cues were kept because comparison favored clarity over
novelty.

### Test location and cue map

Run this specific isolated worktree, not the original checkout:

`C:\Users\gjoep\OneDrive\Desktop\parapoker github\para-poker-site\gauntlet-online-audio`

Start the server and client in separate PowerShell windows:

```powershell
npm --prefix server start
```

```powershell
$env:REACT_APP_SOCKET_URL='http://localhost:4000'
npm --prefix client start
```

Open `http://localhost:3000`, then choose **Play → Practice → Basic vs AI**.
Use **Factions vs AI** for ability comparison. In the actual match:

- seat a facedown card in a lane for the new card cue;
- stage/commit payment for the new tray lock;
- confirm an attack for the forward commitment;
- confirm a block for the planted brace;
- resolve zero damage for absorbed force;
- resolve 1–7 damage for ordinary consequence;
- resolve 8 or more damage for major consequence;
- win, concede/lose, or accept a draw for the three new result closures;
- use a faction ability to hear the deliberately retained ability cue;
- pass and wait for accepted priority to hear the deliberately retained
  priority cue; the button press itself remains silent.

`npm run report:match-audio` prints the active files and hierarchy. Detailed
selection evidence is in
`docs/generated-assets/elevenlabs/sonic-identity-v2/selection-report.md`.

## Prior runtime-policy pass (historical baseline)

The following section records the completed routing/mix baseline that v2 builds
upon. Its asset-selection statements are historical and are superseded by the
current implementation above.

This continuation treats the verified implementation below as its baseline and
establishes one explicit sonic system for every active match cue. All work was
performed in the isolated `codex/gauntlet-sonic-identity` worktree. No Babylon
board, scene, layout, fabrication, animation, or visual-review file is changed.

### Sonic system

Gauntlet's material grammar is dense card stock and paper against wood, stone,
restrained metal, and small mechanical seats. Sapphire/bronze resonance may
support a commitment, but never replaces the physical transient. Offense moves
forward with a sharper attack; defense is braced and seated; a full block is a
short absorption; damage is the consequence after contact. The neutral table
is silent apart from the existing optional music layer.

`matchAudioPolicy.json` is the source of truth for tier, cooldown, maximum
polyphony, semantic gain trim, and suppression. The active mix is intentionally
stepped rather than normalized to one loudness:

| Tier | Meaning | Representative post-mix active-RMS proxy |
| --- | --- | --- |
| 0 — silence | Passive/routine states | Silent |
| 1 — interaction | Selection, draw, placement, accepted priority | Approximately −35 to −29 dBFS; most cues near −32 |
| 2 — commitment | Payment, attack, block, ability | Approximately −29 to −27 dBFS |
| 3 — resolution | Full block and ordinary damage | Approximately −26 dBFS |
| 4 — major | Major damage and match result | Approximately −24 to −23 dBFS |

These values use the repository's 20 ms gated active-RMS proxy, not broadcast
LUFS. `npm run report:match-audio` prints raw and post-mix values from the actual
kit and shared policy. Sample peaks remain below 0 dBFS and Web Audio gain is
clamped at unity, preserving headroom.

### Retained

- `ui_click.wav`, `card_lift.wav`, and `card_draw.wav`: short, low-weight,
  tactile interaction cues that remain below commitment.
- `attack_declare.wav`: retained without EQ or gain trim. Its longer forward
  transient communicates engagement at approximately −27.5 dBFS post-mix.
- `block_commit.wav`: retained without EQ or gain trim. Its braced decay remains
  distinct from attack at approximately −28.0 dBFS post-mix.
- `payment_commit.wav` for payment release, plus the existing ordinary damage,
  priority, turn, victory, defeat, and draw source files. The samples remain
  unchanged; only the semantic mix values listed below change.
- All original approved files and the two inactive ElevenLabs alternates remain
  available. Nothing was deleted or destructively overwritten.

### Refined

Refinement is reversible playback processing; the source WAV files are intact.

| Semantic cue | Trim | Result and rationale |
| --- | ---: | --- |
| `ui.confirm` | −3 dB | Aligns with the light UI family |
| `ui.cancel` | −6 dB | Corrects a raw active level roughly 3 dB above confirm |
| `card.place` | −4 dB | Makes ordinary placement clearly lighter than attack/block |
| `priority.transfer` | −3 dB | Reduces fatigue on the most frequent state transition |
| `turn.start` | −2 dB | Keeps the boundary readable without competing with commitment |
| `payment.commit` | +1 dB | Gives mechanical tray seating a modest commitment weight |
| `ability.activate` | +4 dB | Raises the short physical token cue into the commitment family |
| `combat.blocked` | +3.5 dB | Makes absorbed force readable without implying damage |
| `damage.impact` / `combat.resolve` | +2 dB | Establishes ordinary consequence above commitment |
| `damage.major` | +3 dB | Reserves clearly greater weight without a trailer-style boom |
| `match.victory` | +2 dB | Brings the result family to the top tier |
| `match.defeat` | −2 dB | Corrects its approximately 4 dB raw loudness advantage over victory |
| `match.draw` | +1.5 dB | Gives the retained neutral transition match-ending presence |

The playback system now stops active lower-tier sounds when a resolution or
major cue earns focus. Tier-3 cues suppress tiers 0–1 for 420 ms. Major damage
suppresses tiers 0–3 for 720 ms; match results do so for their meaningful tail.
Every audible semantic cue has one-source polyphony and a purpose-specific
90–2000 ms cooldown. Muting cancels scheduled timers and stops active sources,
so a cue queued before mute cannot leak through afterward.

### Replaced

No additional WAV was replaced in this continuation. The verified baseline's
only active replacement remains `ability_activate.wav` in place of reusing
`priority_change.wav`. That separation is now reinforced by the tiered mix.

### Added

- `matchAudioPolicy.json`: data-owned five-tier hierarchy and mix contract.
- `matchAudioSystem.js`: gain, silence, cooldown, polyphony, and cross-tier
  suppression behavior consumed by the existing match audio hook.
- Focused tests for hierarchy, intentional silence, relative trims, suppression,
  machine-gun prevention, duplicate match-result cooldowns, and muting a pending
  cue.

No new active sound file or variant was added in this continuation. After the
baseline removed per-card micro-layering, the remaining placement, attack,
block, and damage samples occur once per authoritative event and do not justify
extra variants. Singular cues improve learnability, while cooldown and
polyphony controls address repetition without increasing asset count. This
decision should be revisited only after human multi-match listening finds a
specific fatigue case.

### Silent by design

- Hover and passive board state.
- Premature `priority.pass`; accepted `priority.transfer` is the only pass cue.
- Routine `card.travel`, `card.settle`, and `card.discard` motion hooks when a
  semantic event already communicates draw, placement, payment, or resolution.
- Illegal/failed input, disabled controls, decorative effects, and continuous
  board ambience.
- Replay staging micro-motion. Replayed authoritative events retain their one
  semantic cue.

Tier-0 silence is enforced in playback policy as well as by the absence of
motion hooks, preventing an accidental future caller from making these routine
states noisy.

### Ability activation

One universal ability cue remains the correct choice. The cue's token/socket
transient and restrained resonance communicate mechanical commitment without
assigning fantasy elements to factions. Faction variants would expand memory
and mix complexity without improving the semantic fact the player needs:
an ability has committed. Its +4 dB trim makes it equal in importance to attack
and block while remaining materially distinct.

### Controlled variation

No active variation family was introduced. Tiny pitch-only variations would
weaken the purpose-built physical impression, and unreviewed generated variants
would be less coherent than the approved originals. The highest-frequency cue,
priority transfer, is handled with a lower tier, −3 dB trim, 300 ms cooldown,
and one-source polyphony. Card placement occurs once per authoritative event
rather than once per animation micro-step.

### Stereo and spatial treatment

Stereo positioning is explicitly deferred. The shipped WAV family is mono and
there is not yet evidence that subtle lane panning improves comprehension on
headphones, laptop speakers, and ordinary desktop speakers. Player-side and
lane orientation are also presentation details the simultaneous Babylon branch
may adjust. Mono preserves center clarity and avoids coupling audio to an
unstable visual coordinate system. The semantic cue target retains side and lane
metadata, so restrained panning can be evaluated later without changing events.

### ElevenLabs generation

No ElevenLabs credits were spent in this continuation. Signal analysis found
mix-balance issues rather than weak material that justified replacement. The
active generated baseline remains:

- `combat_fully_blocked.wav` — absorbed-force resolution.
- `damage_impact_major.wav` — major damage.
- `ability_activate.wav` — universal ability commitment.

Their existing prompts, model, hashes, candidates, and approval state remain in
`docs/generated-assets/elevenlabs/match-audio` and the presentation-kit source
record. Generation is still development-only; no API key or runtime call enters
the client.

### Device and repetition review

Automated verification covers signal levels, clipping headroom, semantic
routing, cooldowns, suppression, mute behavior, full match simulations, build
integrity, and the real Training Grounds browser route. This environment cannot
perform honest subjective listening through physical headphones, laptop
speakers, or desktop speakers. Final human acceptance should therefore play
several consecutive Basic and Factions-vs-AI matches at low and normal volume,
then replay victory, defeat, draw, rapid combat, and ability sequences. Any
change requested from that listening should target a named cue rather than
reopen the whole family.

### Deferred integration checks

The audio branch does not change authoritative event semantics or Babylon
implementation. After the visual branch is integrated, recheck only these
presentation offsets against the final choreography:

- Placement: `card.placedFacedown` cue at 760 ms.
- Attack commitment: `attack.declared` cue at 820 ms.
- Block commitment: `block.declared` cue at 900 ms.
- Damage/full-block/major-damage resolution: 260 ms after the authoritative
  `damage.calculated` event begins presentation.
- Payment release: 620 ms into its accepted event frame.
- Match result: zero offset on authoritative `match.ended`; it must never move
  earlier than the gameplay result.

If Babylon durations change, adjust presentation offsets in the later
audiovisual integration pass. Do not move, duplicate, or reinterpret the shared
gameplay events.

## Baseline implementation record

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
npm --prefix client test -- --watch=false --runInBand src/babylon/matchAudioSystem.test.js src/babylon/presentationCues.test.js src/babylon/battlefieldPlayback.test.js src/babylon/cardMotion.test.js src/babylon/ProductionMatchExperience.test.js
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
