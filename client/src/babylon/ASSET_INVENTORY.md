# Babylon match asset inventory

The supplied composite is used as visual direction only, never as a runtime
atlas. Runtime assets stay individually addressable and have neutral fallbacks.

| Purpose | Runtime source | Status |
| --- | --- | --- |
| Visible 5:7 fronts | `/assets/gauntlet/playing-cards/{faction}-*.webp` through the existing card-art resolver | Integrated and cached by path |
| Hidden cards | `/assets/gauntlet/match/gauntlet-card-back-official.jpg` supplied from the approved Gauntlet art archive | Integrated; procedural graphite/navy/sapphire/bronze back remains the load-failure fallback |
| Faction identity | `/assets/gauntlet/{rumin,bizi,sheen,frumo}-card.webp` | Used in the identity system where available |
| Table surface | `/assets/gauntlet/match/graphite-table-v1.png` generated as a seamless graphite/deep-navy material | Integrated with a neutral material fallback |
| Lanes, rails, slots | Separate Babylon geometry and materials using the approved production palette | Integrated; no composite-image sampling |
| Gameplay markers | Fourteen original SVG icons plus independent high-contrast Babylon GUI badges and DOM labels | SVG pack generated; approval and replacement of the current code-native markers remain pending |
| Effects | Six transparent original WebP effects plus stable-ID animation targets and restrained procedural light | Integrated through one reusable event plane; procedural light remains the load-failure fallback; human approval pending |
| Match audio | Fifteen original sample-free 48kHz/24-bit WAV masters decoded after user interaction and keyed by accepted event IDs | Integrated with the existing procedural tones as load/decode fallbacks; human mix and approval pending |
| Missing assets | Neutral label texture and neutral card back | Integrated |

Textures use anisotropic filtering, are cached for the scene lifetime, and are
disposed with the scene. Normal updates do not recreate textures.

The production delivery specification and machine-readable cutover checklist
are in `PRODUCTION_ASSET_BRIEF.md` and `MATCH_ASSET_REQUIREMENTS.json`. Run
`npm run report:match-assets` to see which approved production replacements are
still absent without treating current neutral fallbacks as runtime failures.
