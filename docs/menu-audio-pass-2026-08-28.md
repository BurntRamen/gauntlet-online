# Gauntlet outer-menu audio pass — 2026-08-28

## Scope and before/after assessment

This pass is intentionally limited to the outer application menu: Play, Journey, Matches, Build, Identity, Tutorial, Campaign, and Collection. The match screen, lobby, draft table, public match/profile views, faction songs, match SFX routing, and gameplay-event semantics are unchanged.

Before this pass the outer menu had a music track and music-volume controls, but no semantic interface sound family, no ambient layer, no menu-only activation boundary, no cue cooldown/polyphony policy, and no music ducking around meaningful feedback.

After this pass the menu uses a related physical-material language of felt, laminated cards, graphite, wood, and aged brass. Minor navigation is quiet; panel movement is distinct; commitments are materially heavier; confirmation and denial remain restrained; match-ready is the strongest menu event. The controller is limited to two simultaneous effects, has per-cue cooldowns, ducks menu music for important events, fades music and ambience at outer-menu boundaries, and stops all of these additions before lobby/draft/match entry.

## ElevenLabs calls and active files

Nine fixed-asset calls were made to the ElevenLabs Sound Effects API using `eleven_text_to_sound_v2`. Every result below is active; no runtime ElevenLabs call is made by the client.

| Generation ID | Active file | Purpose |
| --- | --- | --- |
| `sound-effect:8f4e42bafa6187f5` | `menu_area_index.wav` | Primary Play/Journey/Matches/Build/Identity area change |
| `sound-effect:c946098c84d58146` | `menu_tab_seat.wav` | Sub-tab selection |
| `sound-effect:9d11a52e002f5ec1` | `menu_panel_open.wav` | Tutorial, Campaign, Collection, mixer, and workshop opening |
| `sound-effect:ed4d0285668bc822` | `menu_panel_close.wav` | Returning from outer-menu panels and closing the mixer |
| `sound-effect:329b1518c4af205e` | `menu_commit.wav` | Creating/joining a table, starting AI/campaign play, queue entry, account submit, pack opening, and deck save |
| `sound-effect:4cb1b76cccbfae4e` | `menu_success_token.wav` | Successful account, profile, collection, or deck state change |
| `sound-effect:00ed76f08fb5b977` | `menu_denied.wav` | Rejected or unavailable menu action |
| `sound-effect:928a88006bcc233b` | `menu_match_ready.wav` | Match found after a matchmaking or draft-league queue |
| `sound-effect:78c775bfd047dfe5` | `menu_room_ambience.mp3` | Seamless 30-second quiet tabletop-chamber bed |

The source manifest is `scripts/elevenlabs-menu-audio.json`. Full prompts, model parameters, timestamps, sizes, and SHA-256 hashes remain in `docs/generated-assets/elevenlabs/menu-audio/`. The API key is never written to client code, generated assets, or provenance.

## Assets retained

- `gauntlet-menu-living-table-v1.mp3` remains the active menu score because it already supplies the intended timeless growth/creation/entropy mood. The new sound family is mixed around it rather than replacing a successful identity anchor.
- All faction music and all existing match SFX are retained unchanged because they are outside this pass.
- Existing account-level mute behavior is retained and now also governs the outer-menu effects and ambience.

No previous outer-menu UI sounds were replaced because none were routed there. The new files occupy a dedicated `assets/gauntlet/menu/audio/` family and do not duplicate match-screen sources.

## Intentionally silent interactions

- Hover, focus, scrolling, text entry, range-slider movement, and ordinary card/deck inspection stay silent.
- Re-clicking an already selected area or tab stays silent.
- Friend-message typing/sending, passive data refresh, unread-count updates, and leaderboard refresh stay silent.
- Queue waiting remains silent until match-ready.
- No narration or menu voiceover was added.
- No generated menu cue plays in lobbies, drafts, public/replay views, or matches.

## Where to test

Use the header's **Audio** control to adjust Music, Interface, and Ambience independently or to play the confirmation test cue.

- Area index: switch among Play, Journey, Matches, Build, and Identity.
- Tab seat: switch Practice/Tables/Ranked/Draft or Profile/Community/Record.
- Panel open/close: open and return from Tutorial, Campaign, or Collection; opening/closing the Audio mixer also demonstrates the pair.
- Commitment: create/join a table, start AI/campaign play, enter matchmaking, submit sign-in, open an earned pack, or save a constructed deck.
- Success token: complete a profile/cosmetic/account/deck/pack update, or use **Audio → Test table**.
- Denied stop: attempt signed-out matchmaking or encounter a rejected menu request.
- Match-ready: enter a matchmaking or draft-league queue and wait for assignment.
- Ambience: remain on any outer-menu area and temporarily mute Music in the Audio mixer to audition the room layer alone.

## Deferred opportunities

No hover texture, randomized cue variants, stereo-positioned area cues, faction-specific menu accents, or spoken menu elements were added. These could add variation later, but they would increase stimulation or fragment the single restrained tabletop language before repeated-play feedback justifies them.
