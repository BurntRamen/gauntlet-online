# SuitFire account preview

Public branding remains **Gauntlet Online**. Only the existing player accounts simply (47d97ddb-65f9-4014-be92-9b677467d943) and BurntRamen (9a9dcf5c-1d3f-422e-b0eb-ca1a32a699e5) receive server-issued preview eligibility. These IDs were verified against the public player standings. A guest name, profile nickname, URL parameter or browser preference does not grant eligibility.

In Settings → Game appearance, those accounts can select Gauntlet Online or SuitFire preview. The default is Gauntlet Online. The choice is saved per account in that browser, applied only after authenticated account verification, and cleared from the active presentation on logout or account switch. The other account's preference is never inherited. Storage failure leaves the selector usable for the current session.

Public HTML, default app metadata, recovery emails, repository name and hosting URLs retain Gauntlet branding. The selected preview changes browser title/icons/manifest, logo, navigation, loading/lobby surfaces and player-facing text. Gameplay, saved data, internal identifiers, historical card names and collectible assets remain compatible.

The attached approved v14 crest and full logo are copied byte-for-byte into client/public/brand/suitfire-v14. provenance.json records source SHA-256 hashes. Browser/PWA PNGs are resized from the approved compact crest. SuitFireBrand draws a separate decorative artwork layer: change activeBrandSet or add a BRAND_SETS entry in client/src/brand/brandArtwork.js for a later set. Initiative is the initial set. Never paint set artwork into the approved crest.

The location display and enlarged side portrait remain separate. The original full-rebrand implementation is preserved in local commit 56104c376276ac41ec4295511a77452c9b3d1f12; this follow-up limits release to the user-requested optional two-account preview. The original implementation passed its production build, unchanged bundle budgets, focused tests and desktop/mobile inspection. This rollout adds eligibility, account switching, opt-in/opt-out and public-brand regression checks.

GitHub connector write access was repaired by installing the authorized OpenAI connector on only BurntRamen/gauntlet-online. The release branch is codex/suitfire-complete-rebrand. Additional card/city artwork from a separate handoff is outside this rollout.

Focused rollout validation: 75 client behavior tests, 10 Admin tests, 9 server/auth/recovery tests, and 80 browser combinations (guest, ordinary account, simply, BurntRamen; ten destinations; desktop/mobile) passed. Browser checks cover opt-in, opt-out, refresh persistence, logout reset, logo decoding, header overlap, and page overflow. Approved image hashes remain unchanged.

The public Command Deck retains its existing compact masthead. The enlarged logo, current-location caption and side portrait apply only while SuitFire is selected. Existing Ranked & Gauntlet competition-mode labels remain unchanged in both presentations. Focused follow-up browser checks cover the Admin season/publication journey and public mobile/tablet/zoom layout.
