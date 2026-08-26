# Babylon art-direction and presentation-cadence qualification — 2026-08-26

## Decision

The art-direction and presentation-cadence implementation on
`codex/full-babylon-visuals` is ready for independent human review. Automated
qualification and independent machine and visual audits passed against clean
implementation commit `4979fa0eccc76cb600d592723b3634c56d9d011c`.

This record does not claim the independent moderated playtests, physical target-
device qualification, real browser-chrome zoom review, or final listening
approval required by `QUALIFICATION_RUNBOOK.md` and
`PRODUCTION_REVIEW_MATRIX.md`.

## Reviewed build and isolation

- Qualified baseline: `aa5994dbf2294127c42f1b07545386d9f6a9cb70`.
- Candidate branch: `codex/full-babylon-visuals`.
- Candidate implementation: `4979fa0eccc76cb600d592723b3634c56d9d011c`.
- Rules contract: `gauntlet-duel-v2`.
- `main` remained clean and unmodified at
  `7b33c9769492374cc10b44e670194d9b3295fa3c`.
- The separate audio worktree remained at that same base revision with its 98
  pre-existing status entries untouched. The SHA-256 of its raw
  `git status --porcelain=v1 -z --untracked-files=all` output is
  `9fe89dcbe60196eadefd413252c66a92c356b068b7ed1bcc46e4fdcb50a1a486`.
- No merge to `main` was performed.

The implementation commits after the preserved baseline are:

1. `df75c85` — Implement Babylon presentation cadence.
2. `1496d98` — Harden Babylon motion evidence capture.
3. `4eab6b1` — Make Babylon cadence capture atomic.
4. `5637c4f` — Use live renderer state for settled capture.
5. `249b5a7` — Correlate Babylon release motion evidence.
6. `113cc9b` — Keep spectator cadence copy state-safe.
7. `130017b` — Capture Babylon cadence at semantic progress.
8. `4979fa0` — Align Babylon controls with presentation release.

The commit containing this qualification record follows the implementation
commit and does not change the reviewed runtime.

## Reviewed scope

- Added `gauntlet.presentation-cadence.v1` as the shared rest, attention,
  commitment, resolution, and major-resolution timing authority.
- Coalesced related payment, attack, block, damage, priority, draw, turn, and
  supported ability events into readable beats.
- Delayed projected board and life consequences to their authored visual impact
  instead of revealing them at queue start.
- Gave attack, block, payment, placement, draw, discard, damage, priority,
  ability, and result events distinct restrained physical grammar.
- Rebalanced localized material response, rings, light, glow, and effects so
  cards and current action remain dominant over ornament.
- Hardened capture around exact actor occurrence, source event, semantic
  progress, renderer frame, and playback frame identity.
- Required two consecutive live renderer snapshots before declaring final
  captures settled.
- Kept resolving guidance on the current beat for players and spectators and
  removed premature next-action controls.
- Applied the temporary presentation input gate consistently to React controls,
  keyboard shortcuts, accessible controls, and Babylon hit targets. Networking,
  legality, and authoritative state remain immediate; read-only inspection and
  Match-menu information remain available.
- Corrected the ability evidence session so both players remain connected.
- Increased phone-portrait action-rail height, retained readable three-line
  guidance, prevented CTA collision and horizontal ability-row overflow, and
  preserved faction-action access through Match → Faction abilities.

## Automated qualification

| Check | Result |
| --- | --- |
| `git diff --check` | Passed |
| Qualification tests | 29/29 passed |
| Server tests | 128/128 passed |
| Client tests | 400/400 passed across 36 suites |
| Production build | Passed; 19 WebGPU-only shader chunks pruned from the WebGL build |
| Bundle budgets | Main 151.3 KiB; largest async 309.8 KiB; all JavaScript 676.3 KiB gzip |
| Strict asset report | Passed; zero cutover blockers and zero runtime structural composite rasters |
| Audio report | Passed; 25 semantic cue mappings across 20 approved WAV masters |
| Main browser E2E | 10/10 passed |
| Usability/accessibility E2E | 6/6 passed |
| Compiled-client performance E2E | 1/1 passed |

The strict asset report found all required manifest, reference, source-atlas,
texture, mask, effect, and audio files present. The selected 60-entry
`gauntlet-core-v1` kit contains 49 approved and 11 provisional entries, five
missing optional authored files, zero checksum mismatches, and zero production
cutover blockers.

## Immutable visual evidence

The final production-path matrix is preserved at
`artifacts/babylon-visual-review/cadence-art-direction-2026-08-26-r13/`.
Its manifest records clean revision `4979fa0eccc76cb600d592723b3634c56d9d011c`,
the candidate branch, four real scenarios, and no dirty paths.

| Evidence | Result |
| --- | --- |
| States and captures | 52 states; 114 captures; 114 referenced JPEGs |
| Viewport distribution | 28 desktop, 22 desktop motion, 9 ultrawide, 9 tablet landscape, 9 tablet portrait, 18 phone landscape, 2 phone-landscape motion, 17 phone portrait |
| Native scene | 114/114 `gauntlet.board-stage.native.v1`; 10 modules each |
| Actor and structure safety | Zero duplicate visible identities; zero structural composite rasters |
| Atomic semantic evidence | 22 card-motion and 2 event-effect captures bracketed and renderer/playback paused |
| Paired motion | Eight start→midpoint/release pairs retain exact occurrence IDs and increase progress |
| Settled evidence | Eleven named settled states with no transition, queue, effect, event, catch-up, departure, or motion |
| Canonical release | Payment and combat zones are empty in their final resolution states |

Checksums:

- Manifest: `ea0eb2175811ee635ba5af1c66ec2e1eb61ba4812c896f414ac52d821043c8f5`.
- Index: `107887288d9a92c63a08bdab1d31e4ab12511db9381aeba0113c4ccac17fe4af`.
- Canonical codepoint-sorted `filename sha256\n` JPEG inventory:
  `70a17a169b84e25bbe64c93606fb8f70f6ba5eb0eed339a6e235bbca6163ed2b`.

There are 111 unique JPEG hashes. The only identical pairs are the expected
`attack-available` / `live-priority` rest-state captures at desktop, phone
landscape, and phone portrait.

Independent original-file visual review found no release-blocking defect.
Resolving frames retain current-action guidance without a command; both mobile
spectator captures retain neutral resolving copy; the ability opponent is
connected; phone names, controls, guidance, and CTAs fit; and all semantic beats
remain visually distinct before returning to a quiet actionable board.

## Before/after packages

Two standalone comparison packages were generated without modifying either
source matrix:

- `artifacts/babylon-visual-comparison/full-babylon-to-cadence-r13/` — 13
  mappings; all 13 candidate frames present; five unavailable baseline frames.
  - `comparison.json`:
    `3e495a41cc1d460ff865c84cc57c113c7ebeb323b49dff5d28ff012eaa51d033`
  - `index.html`:
    `ccdfc96272a8fb61a12b2f9bcad980d101e543460aca8873c2dd0d87a0c38867`
- `artifacts/babylon-visual-comparison/aa5994d-supplement-to-cadence-r13/` —
  13 mappings; all 13 candidate frames present; six unavailable supplement
  baseline frames.
  - `comparison.json`:
    `4dab673e304df8fdaffc048b1b85fa49131eca6145cdb82d1499bee704affd3a`
  - `index.html`:
    `a8ab0b890becceac4406b5f4434d24d495e99552047b5a0aca06fb6ac3bae7de`

The preserved full baseline manifest is
`8f73e6d03702c0f98ba8fef42717ccbdafd8af78d6fe31a13be32d71542b5d37`.
The cadence supplement r3 manifest is
`81f97887b39822cd1ccd2dc0250093732c0aebd56f4855a16efea3eaa02ffb89`;
it is comparison imagery rather than clean candidate proof because its manifest
records contemporaneous evidence-tooling and documentation changes.

## Generated-asset and audio decision

No newly generated bitmap or video entered the runtime. Two generated surface
candidates were rejected rather than installed:

- ornate/loud candidate:
  `b5ac0710f5216cc4f3920b39479fa6412a53c537c7b7a5a6bfce647db610c70c`;
- baked-checkerboard/no-alpha candidate:
  `684b9ed12a5f9fd0c63924454372a52bf328cde54e1667109d3f6ef83853f16b`.

The repository ElevenLabs Image & Video pipeline submitted the restrained
priority-transfer keyframe request with explicit cost confirmation. The service
returned HTTP 402 `paid_plan_required` before generation because the connected
account lacks the required Pro plan. No credit was consumed, no candidate was
published, and the dependent full-frame video was not requested.

No audio asset or audio-worktree file was changed. The approved audio masters
and provenance remain intact. Presentation cue timing did change as part of the
shared cadence, so this record does not claim that audible behavior is
unchanged; final human listening and level approval remains open.

## Superseded evidence

All prior r1–r12 capture directories remain preserved. R12 is mechanically
valid and checksum-preserved, but it is visually superseded by r13 because its
player controller advanced during resolving, its ability session left the peer
disconnected, and its phone-portrait controller was too cramped. R13 is the
only final candidate used by this record.

## Remaining human gates

- Score all seven required visual categories with a named reviewer and date.
- Run five moderated ordinary-player sessions, including desktop and touch.
- Repeat 80–200% checks using actual browser-chrome zoom.
- Record cold-load p95, settled FPS, and memory on physical desktop and mobile
  targets.
- Complete final listening and level-balancing approval for the audiovisual
  cue set.
