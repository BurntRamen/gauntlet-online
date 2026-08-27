# Babylon corrective visual qualification — 2026-08-27

## Decision

The corrective Babylon visual pass on `codex/full-babylon-visuals` is ready for
independent human review. The runtime implementation was captured from clean
commit `55ea4d9479b187d529d824b93207d40e5f65ed87` and passed the repository's full
automated check plus the real production-path visual-review matrix.

This record qualifies the implementation and captured evidence. It does not
replace the moderated playtests, physical-device checks, browser-chrome zoom
review, or final listening approval required by the production review matrix.

## Isolation and commits

- Preserved qualified baseline: `aa5994dbf2294127c42f1b07545386d9f6a9cb70`.
- Candidate branch: `codex/full-babylon-visuals`.
- Basic art/data commit: `d16355e` — Add generated Basic playing-card art.
- Stage/cadence commit: `55ea4d9` — Refine Babylon stage hierarchy and combat cadence.
- Rules contract remained `gauntlet-duel-v2`; no game-rule or server-rule change
  was made.
- `main` remained at `7b33c9769492374cc10b44e670194d9b3295fa3c`.
  Its separate checkout and unrelated working changes were not modified by this
  pass. No merge to `main` was performed.

The commit containing this qualification record follows the clean runtime
commit and does not alter the captured implementation.

## Corrective scope

- Added an original neutral Basic Gauntlet card master and a deterministic
  52-card, 500 × 700 WebP family.
- Made Basic card art flow through the authoritative resolver, view model,
  presentation snapshot, actor registry, and renderer rather than through a
  Babylon-only substitute.
- Preserved one card actor and art path as a card moves from hand through
  combat, payment, and lane states.
- Added loud development diagnostics and capture metrics for expected face-up
  cards without resolved art.
- Reduced empty-lane rails, wells, trim, engraving, glow, and idle response so
  playable cards and current action hold the visual hierarchy.
- Removed the hand-combat dais at rest. It appears only for an active hand
  attack, block selection, or related resolution and retains the semantic
  `combat.dais` module contract.
- Enlarged and re-spaced the near hand, improved the far-hand silhouette, and
  scaled active attacker, blocker, payment, and attachment cards for direct
  comparison.
- Expanded the board inside the safe frame while integrating slimmer player
  plates and action guidance into the tabletop edge.
- Removed duplicated persistent event narration. Transport notices now dismiss
  after 2.2 seconds, while resolving guidance remains phase-driven.
- Preserved all ten native stage modules and the existing Babylon scene and
  adapter contracts.

## Generated Basic card art

The built-in OpenAI image generator created one original neutral master using
the four existing faction jacks as style references. The repository generator
then applies deterministic rank and suit overlays with Sharp.

- Checked-in master:
  `client/public/assets/gauntlet/playing-cards/basic-card-master.png`.
- Runtime pattern:
  `client/public/assets/gauntlet/playing-cards/basic-{rank}-{suit}.webp`.
- Master SHA-256:
  `c8b5cfb1e4a545cd0a6e69e796738e254e91fa40218249e4e40bf08a8d9a533d`.
- Ordered runtime-family SHA-256:
  `638caa2748ffc98be9f2d3a169e683cdfc36d9a8bf0cbc80d991402190942b72`.
- Exact prompt, reference list, and generator provenance:
  `docs/generated-assets/basic-card-art-2026-08-27.json`.
- Reproduction command: `npm run generate:basic-card-art`.

No ElevenLabs visual candidate entered the runtime. The previously attempted
ElevenLabs image endpoint remained unavailable on the connected account plan.
The approved ElevenLabs audio masters already on this branch were retained and
no audio file was changed in this corrective pass.

## Automated qualification

| Check | Result |
| --- | --- |
| `git diff --check` | Passed |
| Qualification tests | 29/29 passed |
| Server tests | 128/128 passed |
| Client tests | 406/406 passed across 36 suites |
| Focused Babylon/HUD tests after notice timing change | 42/42 passed |
| Production build | Passed; 19 WebGPU-only shader chunks pruned |
| Bundle budgets | Main 151.4 KiB; largest async 309.8 KiB; all JavaScript 677.0 KiB gzip |
| Production-path visual review | 1/1 passed in 4.0 minutes |

## Clean visual evidence

The final matrix is preserved at
`artifacts/babylon-visual-review/corrective-basic-cadence-qualified-2026-08-27-r2/`.
Its manifest records clean revision
`55ea4d9479b187d529d824b93207d40e5f65ed87`, no dirty paths, four real
scenarios, and the `gauntlet-duel-v2` rules contract.

| Evidence | Result |
| --- | --- |
| States and captures | 52 states; 114 captures |
| Viewports | 28 desktop, 22 desktop motion, 9 ultrawide, 9 tablet landscape, 9 tablet portrait, 18 phone landscape, 2 phone-landscape motion, 17 phone portrait |
| Native structure | 10/10 stage modules in every capture |
| Face art | Zero missing expected art across all captures |
| Basic rest state | 8 Basic face-art actors; hand-combat module disabled on desktop and both phone layouts |
| Incoming hand attack | 9 Basic face-art actors; hand-combat module enabled across desktop, ultrawide, and both tablet layouts |
| Image inventory | 114 JPEGs; 111 unique JPEG hashes |

Checksums:

- Manifest:
  `1b64576eb29d1a2883f2e334a1def08d601eab030b4ef248f8c72e8d1b789494`.
- Index:
  `23b2b3aa1f1ff9972935b79680fbf80dc930f9c5c1d10994e78ca0e4b11c1144`.
- Canonical codepoint-sorted `filename sha256\n` JPEG inventory:
  `0b6d50016fd205a30ad8ab440237e0592a97a06d365736861848bb7283db9895`.

## Remaining human gates

- Score the required visual categories with a named reviewer and date.
- Run moderated ordinary-player sessions on desktop and touch hardware.
- Repeat 80–200% checks using actual browser-chrome zoom.
- Record cold-load p95, settled FPS, and memory on physical targets.
- Complete final listening and level-balancing approval for the audiovisual
  cue set.
