# Optional SuitFire artwork integration

This presentation remains available only through the existing authenticated Settings choice for the two eligible player accounts. Gauntlet Online remains the public/default presentation. Eligibility, preferences, server data, URLs, gameplay rules, printing records, and saved replays are unchanged.

The browser resolves approved replacement images at display time. Exact original paths and immutable content-hash aliases select a replacement; faction, card identity where available, and surface checks prevent unrelated substitutions. Complete card faces replaced by illustrations are composed with the captured card's original rank, suit, name, rules and release metadata. Private Admin previews continue showing stored artwork.

Decorative covers have an explicit surface separate from portraits and chapter-event art. Pack artwork and the masthead backdrop sit outside the existing approved crest. Sets without approved covers retain a neutral pack layout. Optional artwork code loads after selecting SuitFire; faction lore loads on demand while keeping the masthead visible.

## Asset checkpoint — not yet ready to release

At this code checkpoint, zero new approved artwork files are present and zero replacement mappings are active. The 1,194 aliases in the manifest are derived from the repository's existing content asset manifest. Original files are retained.

The expected release subset is 66 approved non-Rumin card illustrations plus four city covers. Activation requires the exact verified handoff commit, all 70 file checksums, mapping review, and pixel inspection. The superseded Rumin illustrations, draft portraits/scenes and local faction studies are excluded. This checkpoint must not be presented as a completed artwork release.

## Verification

149 distinct focused client tests passed across 13 suites during implementation, including the seven new artwork boundary and composition tests. The two server account-eligibility tests passed. The compiled browser journey in `playwright.suitfire.config.js` passed at desktop 1440×1000 and phone 390×844: public GO has no appearance choice or manifest fetch; the eligible fixture account can select SuitFire and return to GO; pack crest images load; the lore screen remains navigable; and there is no document-width overflow. Screenshots were inspected.

Production compilation and the unchanged bundle budgets pass at this code checkpoint: main 177.9 KiB / 180 KiB, player JavaScript 756.3 KiB / 759 KiB, largest async 269.3 KiB / 350 KiB, initial Admin 14.3 KiB / 20 KiB, all lazy Admin 74.9 KiB / 75 KiB. No budget was increased. The browser test is added to pull-request checks.

Final asset integrity checks, rendered approved-art screenshots, remote checks on the final release commit, deployment, and live verification remain pending the handoff. No remote branch, PR, merge, or deployment has been made for this artwork integration checkpoint.

## 2026-11-08 current-main checkpoint

Integrated main a8a19757ca21656bca270ad723314ff23230f90b in merge 6daa3a01. The earlier verification numbers above describe the initial checkpoint. The current manifest contains 1,195 verified original image aliases and zero active replacement mappings; no new approved image files are present.

Actual card faces now require captured card identity, faction, source and type to agree before replacing an illustration. Decorative deck thumbnails use a separate surface. Exact retained portrait identities include Leafen; held or unknown identities use the existing neutral mark in SuitFire. GO rendering, rules, server code, original image files and real saved preferences remain unchanged.

The 20-group surface inventory and all 66 card candidates plus four covers are recorded in suitfire-art-audit-inventory.json and suitfire-art-audit-status.md. These distinguish code inspection, retained sources, pending pixels and release blockers. The 21 Frumo source-name differences are review criteria, not proven semantic mismatches. Rare story-appropriate warmth is permitted; the predominant direction remains frozen/underwater aquatic merfolk pirates.

Revalidation: 63 focused client tests across 12 suites and both server eligibility tests passed. The compiled desktop (1440 x 1000) and phone (390 x 844) opt-in/return-to-GO journey passed; viewport screenshots were inspected. All 1,195 aliases match their existing sources. The unchanged bundle limits pass: main 182,850 / 184,320 bytes gzip; player JavaScript 777,042 / 777,216; largest async 275,724 / 358,400; initial Admin 11,771 / 20,480; all Admin 76,788 / 76,800. The tight remaining margins are recorded without increasing budgets.

The apparent 4 KiB local overage came from stale local-package junctions and a shared build cache. Local packages and the cache now resolve inside this worktree. A clean rebuild contains zero shared-source references to the older worktree. No build configuration, functionality or budget was changed to obtain the pass.

The sole uploader reports 64/70 hash-matched image receipts plus the manifest, but no complete handoff commit or branch. Six Bizi payloads remain blocked by an automatic approval denial for public upload. This worktree did not retry or bypass that denial. Pixel inspection, final release-commit checks, merge, deployment and live validation remain pending the verified complete handoff.

Broader checkpoint checks also passed: all 1,001 client tests across 133 suites, four client toolchain tests, 54 qualification tests, and the strict match-asset report (zero production cutover blockers and zero checksum mismatches). Existing aliases were verified: 1,194 are byte-identical pairs; the remaining Continuants SVG is identical after line-ending normalization. Neither original file was changed.

The full server suite passed: 666 tests, zero failures. Server syntax, qualification, full server/client suites, production compilation and bundle checks therefore all pass for this code checkpoint. The original CI fix is already merged as PR #105; its final GitHub check, Admin release journeys, dependency audit and Vercel preview checks are green. The artwork checkpoint itself has not been pushed, merged or deployed, and its final asset release/browser checks remain pending.
