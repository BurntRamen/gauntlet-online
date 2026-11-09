# SuitFire artwork audit — current checkpoint

This is an explicit partial audit inventory, not a completed artwork release. Current main is integrated; new artwork remains inactive pending the exact complete handoff. Public GO and real saved appearance choices are unchanged.

- 66 constructed illustration candidates; 4 covers pending. 22 superseded Rumin illustrations are excluded.
- Frumo: 21 source-name differences, zero current type differences. Filenames do not rename cards. Actual semantic compatibility remains blocked on pixels, not rejected for rare warmth.
- Historical card type disagreement retains the exact old face. New character artwork cannot silently replace an old armament record.
- Leafen retained byte-for-byte: e7db39aeb8f4a467cdc17b0eb9aa52c8d851c959c31654fa429c44ac59ed1b06. Nu and unrelated identities cannot borrow that image.
- No new portrait, chapter-scene, held Kaiser/Meerus, or unreviewed symbolic study is included.

| Surface | Status | Release action | Remaining work |
|---|---|---|---|
| public-and-account-choice | completed-code-inspection | retain-public-GO-and-existing-two-account-choice | Final desktop/mobile GO and both-choice checks on final commit. |
| constructed-cards-66 | pending-assets | replace-only-approved-66-after-review | Verify 66 hashes/pixels/semantics and all supported suits/reveals. |
| ordinary-playing-cards-208 | retained | retain-original | No claim that this subset replaces every visible card. |
| superseded-rumin-constructed-22 | retained | exclude-new-art-retain-existing | Keep explicit exclusion in release validator. |
| city-and-campaign-covers-4 | pending-assets | approved-covers-decorative-contexts-only | Inspect all four pixels/crops; wire exact city/source routes without overwriting chapter scenes. |
| masthead-backdrop | pending-assets | four-approved-covers-outside-unchanged-logo | Desktop/phone contrast and crop check after mappings. |
| faction-identity | retained-code-inspected | retain-own-faction-or-neutral | Final review of all factions; do not substitute covers for named characters. |
| leafen-and-retained-portraits | completed-code-inspection | retain-exact-identities | Final rendered dialogue/lore/board check. |
| held-kaiser-meerus-and-draft-portraits | retained-code-inspected | exclude-held-and-draft-sources | New likenesses require their own approved handoff; not included here. |
| lore-characters-and-chronicle | pending-visual-review | retain-text-and-exact-character-identities | Review all faction lore at desktop/phone; current audit includes prior Frumo screenshots only. |
| campaign-chapter-scenes | retained-code-inspected | retain-event-art-and-text | Review scene pixels independently; held human-Kharon draft remains excluded. |
| campaign-dialogue-and-cinematics | pending-visual-review | retain-scenes-exact-retained-portraits-neutral-for-unapproved | Check speaker aliases, focus changes, unknown-speaker fallback, mobile layout. |
| packs-earned-collector-and-reveals | pending-assets | approved-set-covers-and-unchanged-crest | Inspect all set/faction tiles and actual approved-art reveals. |
| collector-claim-and-deck-thumbnails | completed-code-inspection | exact-source-decorative-thumbnails | Verify pixels after assets arrive; no purchases or claims required. |
| loading | completed-code-inspection | neutral-existing-table-art-in-selected-preview | Check initial/auth-loading and network-error states on final build. |
| tutorial | retained-code-inspected | retain-existing-neutral-table-and-ordinary-faces | Final tutorial visual check; do not imply new full tutorial art. |
| live-board-phone-inspection | pending-visual-review | approved-card-presentation-and-exact-named-portraits | Final browser match/phone/inspector and retained Leafen check. |
| immutable-replay | completed-code-inspection | ephemeral-display-only | Final replay checks including old armament versus current servitor and current approved mapping. |
| generic-and-failed-image-fallbacks | pending-visual-review | retain-own-faction-or-existing-neutral-fallback | Final unavailable-target and delayed-registry browser checks. |
| private-admin-authoring | completed-code-inspection | retain-stored-original-art | Required Admin release checks remain mandatory on final commit. |

## Exact blocker

Sole uploader reports 64/70 images plus the manifest uploaded. GitHub create_blob for client/public/assets/gauntlet/faction-art-2026-11-07/bizi/bizi-focus-overclock.webp was denied because the available instruction did not explicitly authorize public upload. The uploader stopped and requested the missing permission. No tree/commit/branch/deployment exists at this checkpoint. This task did not retry or use another transfer route.

The six pending payload names, 66 current card definitions with exact original/hash paths, Frumo semantic review criteria, retained Leafen hash, and all final checks are in suitfire-art-audit-inventory.json. Neither the 21 title differences nor matching types alone establish a need to redraw; inspect the verified image first.

## Current checkpoint validation

- 63 focused client tests in 12 suites and two server account-eligibility tests passed.
- Compiled optional-brand browser journey passed at 1440 x 1000 and 390 x 844, including public GO, opt-in, return to GO and no horizontal overflow. Desktop and phone viewport screenshots were inspected.
- All five unchanged bundle limits passed after correcting stale local dependency/cache links; zero stale shared modules remain. Player payload is 777,042 / 777,216 bytes gzip.
- All 1,195 original-image aliases match; exact Leafen hash is retained. No server/gameplay diff against integrated main and no new approved image files.
- These checks validate the code checkpoint. They do not replace the complete-handoff pixel review or the required checks on the final release commit.

Broader checkpoint checks also passed: all 1,001 client tests across 133 suites, four client toolchain tests, 54 qualification tests, and the strict match-asset report (zero production cutover blockers and zero checksum mismatches). Existing aliases were verified: 1,194 are byte-identical pairs; the remaining Continuants SVG is identical after line-ending normalization. Neither original file was changed.

The full server suite passed: 666 tests, zero failures. Server syntax, qualification, full server/client suites, production compilation and bundle checks therefore all pass for this code checkpoint. The original CI fix is already merged as PR #105; its final GitHub check, Admin release journeys, dependency audit and Vercel preview checks are green. The artwork checkpoint itself has not been pushed, merged or deployed, and its final asset release/browser checks remain pending.
