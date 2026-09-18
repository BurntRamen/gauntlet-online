# Menu music choice — 2026-09-05

## Outcome

The outer Gauntlet menu now offers two persistent score choices in **Audio → Choose menu score**:

- **The Quiet Workshop** — calm, spacious, and selected by default for players without a saved preference.
- **The Living Table** — the existing kinetic, textured score, retained unchanged for players who prefer it.

Changing the score immediately crossfades through the existing menu music controller. It does not alter match/faction music, interface effects, ambience settings, cooldowns, ducking, or global mute behavior. The selected menu score is stored locally under `gauntlet_menu_music_track`.

## ElevenLabs generation

- API: ElevenLabs Music API (`POST /v1/music`)
- Model: `music_v2`
- Generation mode: `loop`
- Requested length: 40,000 ms
- Instrumental: yes
- Output: `mp3_48000_192`
- Song ID: `exqP5FNJk4VbAKgoxIct`
- Published asset: `client/public/assets/gauntlet/music/menu/gauntlet-menu-quiet-workshop-v1.mp3`
- SHA-256: `693a27ddc91a0bcd62f8bfbe72a818e6b08996c43b7f117fc27dc38544b8c68c`

The reproducible prompt and parameters are checked into `scripts/elevenlabs-menu-music.json`; full generation provenance is in `docs/generated-assets/elevenlabs/menu-music/menu-quiet-workshop.json`. The API key remains environment-only and is not stored in either file.

## Retained original

`gauntlet-menu-living-table-v1.mp3` remains unchanged. Its stronger rhythmic motion is a valid stylistic option even though it can feel too tense for some players. Retaining it as an opt-in choice preserves prior preference without forcing the higher-energy mood on everyone.

## Manual test

1. Open the outer menu and select **Audio** in the header.
2. Under **Choose menu score**, switch between **The Quiet Workshop** and **The Living Table**. The music should crossfade and the Audio trigger subtitle should update.
3. Reload the page. The selected score should remain active.
4. Start a faction or basic match. Match music should continue to use its existing match-specific selection.
