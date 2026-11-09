# Optional SuitFire approved artwork

Public/default branding remains Gauntlet Online. Only the existing eligible simply and BurntRamen accounts can select SuitFire or GO in Settings. This release does not change eligibility, real preferences, gameplay rules, names, stable IDs, URLs, saved data or replays.

## Approved baseline

The exact additive handoff bb39699fbfb9f44ff3bdf50d1476cb4641c05d1e provides 70 verified images: 66 constructed illustrations (22 each for Sheen, Frumo and Bizi) and four decorative city covers. All file sizes, SHA-256 and Git blob SHA-1 hashes and source pixels were reviewed. The runtime manifest activates 330 exact original-source mappings plus four covers only after eligible opt-in. Original images remain untouched; 1,195 content-hash aliases retain compatibility.

Actual card replacements require agreement on source, faction, stable card ID and captured card type. Composed faces retain captured names, rank, suit, rules and release metadata. Historical type disagreement preserves the old face. Admin previews retain stored originals. Decorative deck thumbnails use a separate checked surface; covers do not replace named portraits, board cities or chapter scenes.

The unchanged approved crest remains separate from modular Initiative cover artwork. The catalog grid also restores the intended 74-pixel art column after a general button style had squeezed some thumbnails to about 16 pixels; this readability fix applies to both appearances. Portrait-phone card inspection stacks art above the name/rules and scrolls vertically to prevent clipped text.

## Retained and excluded surfaces

Ordinary playing cards, superseded Rumin constructed art, chapter events and existing named portraits retain their sources. Leafen retains its exact original image (SHA-256 e7db39aeb8f4a467cdc17b0eb9aa52c8d851c959c31654fa429c44ac59ed1b06). Held Kaiser/Meerus artwork, draft scenes/portraits and unreviewed Voltari/XenDra studies are excluded. Unknown or mismatched portrait identities use the existing neutral mark.

Approved symbolic illustrations do not establish literal depictions of every current name. The per-card notes and 20-surface inventory in suitfire-art-audit-inventory.json and suitfire-art-audit-status.md distinguish completed baseline review from retained/pending broader artwork. No complete all-surface refresh is claimed.

## Verification and release

The artwork validator checks the exact handoff, all 70 hashes, current card identities/types, all 330 routes, four covers, retained originals and Leafen. Its negative tests reject tampered payloads, mismatched mappings and unexpected surfaces. Component tests render all 66 cards in all four suits, preserve frozen captured objects and Admin originals, and exercise image fallback. The browser journey checks public GO, local eligible opt-in/return, desktop/phone catalog targets, readable inspectors, all four lore covers/portrait sections, pack crest, overflow and a normal campaign entry. It never changes real account choices.

Final release requires the normal PR checks, Admin journeys, unchanged bundle limits, deployment and public live verification. Local and remote evidence are reported separately; previous pre-activation test results remain labeled as historical in the inventory.

Local activated-baseline evidence: 1,068 client tests across 134 suites, 57 qualification tests, four toolchain tests, strict match assets (zero checksum mismatches/cutover blockers), approved-art integrity checks, compiled desktop/phone art journey and unchanged bundle limits pass. Final remote release checks remain separate.
