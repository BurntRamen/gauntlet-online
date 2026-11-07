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
