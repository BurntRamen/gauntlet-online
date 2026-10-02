> Historical implementation report. The current production integration, expanded 126-card registry, resolved two-account IDs, and GitHub persistence supersede the original counts/storage assumptions below. See [the current deployment guide](gauntlet-admin-deployment.md).

> Historical report. See [Gauntlet Admin v2](gauntlet-admin-v2.md) for the current implementation and removed boundaries.

# Gauntlet Admin v1 — controlled authoring

Implemented locally on 2026-10-02. This extends the inspection surface described in `gauntlet-admin-architecture.md`. It introduces no new factions, cards, campaigns, roles, gameplay rules or production data migrations.

## Operator workflow

1. Open `/admin/gauntlet` and authenticate through the existing account login.
2. In Content or Game, select an existing object. Compare its current live values with the draft form. Save each changed field to the shared draft. Revert restores that field to its current live value.
3. Validate the complete draft. Global and object/field messages report errors and warnings. Invalid drafts may be saved for correction but cannot be previewed or published.
4. Preview the saved draft. Campaigns/encounters reuse `CampaignChapterBriefing`; cards reuse `SpecialCardFace`. Other objects show their presentation metadata/artwork. Preview performs no socket command, game creation, account update, reward grant or history write. Battle launch and automatic audio are disabled.
5. In Publishing, review the live/draft comparison, supply a release name and confirm publication. Publication requires a successful preview of the exact current draft hash and revalidates the complete draft.
6. Restore a compatible previous release from history to roll back future content. A pending shared draft must first be published or discarded. Both operations have an explicit review confirmation in the interface.

Two operators share one draft. Every write carries the last observed storage revision. A stale write returns HTTP 409 instead of overwriting the other operator. Unsaved form values remain available after a conflict; refresh to inspect the current saved draft before retrying. Saving another field invalidates the prior preview receipt.

## Editable fields and protected boundaries

| Domain | Editable authored data | Protected / derived data |
| --- | --- | --- |
| Campaigns (5) | Heading, introduction/pitch, cover reference | Faction identity, encounter IDs/order, progression gating |
| Encounters (56) | Title, story, player-character label, before/after prose, opening/closing dialogue, scene artwork and aligned voice-file references | Campaign/faction/deck/opponent IDs, linear routing, branch destinations, difficulty, boss ability and scripted turns |
| Factions (5, including campaign-only XenDra) | Display name, faction artwork reference | Stable ID, campaign-only availability, executable powers |
| Cards (72) | Display name and displayed rules wording | Gameplay ID/effect dispatch, type, rarity, value, faction, free acquisition, default variant identity |
| Deck/templates (57) | Template name and description | Standard deck slots, encounter card plans, card counts/suits, shuffle, player-owned saved deck versions |
| Characters/opponents (92) | Faction-role names/portraits, campaign opponent names, existing narrative character descriptions | Role/faction/encounter IDs, faction-power text/effects, narrative lookup keys and Training AI identity/behavior |
| Assets (144 collector references, plus inline scene/faction/portrait/voice fields) | Existing local artwork references | Collector/paid acquisition semantics, variant and gameplay IDs; no uploads or file mutation |
| Game (8 mode metadata records) | Mode names and descriptions | Starting life (42), hand size (8), deck rules, supported commands, mode availability, matchmaking, seasons, AI and socket behavior |

Card rules wording is **presentation**, never executable configuration. Editing it produces a warning to check that it still describes the unchanged effect. Training AI's name stays locked because client logic currently tests that literal string. Faction-power wording is locked alongside its behavior.

Campaign deck-template copy is included in the real chapter dossier. The standard template's metadata is included in the public manifest; this release does not add a separate player-facing standard-deck screen. Narrative character descriptions remain structured campaign metadata; there is no new character browser. The Game metadata is consumed by the existing play menus. Player account collection responses use active card labels and collector metadata. Public menus refresh when the client reloads its manifest; running game snapshots do not depend on a menu refresh.

## Shared schema, validation and typed engine interface

`server/authoredContent.js` defines `gauntlet.authored-content.v1`, field descriptors and the whole-snapshot validator. It normalizes existing content into eight domains, preserving all existing IDs (including prior admin composite IDs for derived templates and opponents). Routing is represented explicitly but is read-only in v1. Current campaigns have linear destinations and empty branch lists; changes to either require an engine contract update.

Validation checks:

- Exact schema/domain shape, stable unique IDs and order; no new/deleted content or unknown fields.
- Required text, field type/length and dialogue count bounds.
- Campaign membership, encounter destinations/branches, opponent/template links, faction/card/collector links and deck-plan card references.
- Local `/assets/gauntlet/` paths with supported image/audio extensions, without traversal, remote hosts or query strings. Blank audio slots retain alignment; nonempty voice lists must match dialogue length.
- Exact protected values, engine/card/rules versions, starting constants and deck rules.

Warnings cover changed asset references, changed voiced dialogue and edited card rules wording. Asset existence on the deployed frontend is an operator preview check: this server may be deployed separately from the client and does not certify or upload asset bytes.

`resolveEngineContent()` produces the `gauntlet.engine-content.v1` presentation interface declared in `server/engineContentContract.d.ts` and referenced by JSDoc. The runtime validator is the enforcement boundary. It resolves the published snapshot into the existing public manifest and faction presentation objects; it never evaluates code or enables new effect identifiers. Compatibility compares the deployed protected content and explicit engine version labels. Engine changes still require responsible rules/card-version increments; this is not a proof that two arbitrary engine binaries are identical.

## Draft and release storage

`server/contentPublication.js` stores the shared draft, immutable release snapshots, active pointer and activation history in one atomic `content-state.json` under `GAUNTLET_CONTENT_DATA_DIR`.

- Development default: `${ACCOUNT_DATA_FILE}.content/content-state.json` (ignored for the standard local account path).
- Production writes are disabled unless `GAUNTLET_CONTENT_DATA_DIR` is explicitly configured on a persistent, backed-up server volume. This change does not provision that volume or deploy the application.
- The source baseline is available immediately. The first authoring write durably stores it along with the draft, so it can later be restored.
- Each release ID is `gauntlet-content-<full SHA-256 of canonical authored snapshot>`. Publishing identical content reuses its existing immutable release and original metadata.
- Snapshot insertion, pointer switch, draft removal and activation audit append commit together through a flushed temporary file and same-directory rename. An exclusive lock serializes writers; optimistic revisions protect against stale browsers.
- The API has no release-edit/delete operation. Reads verify stored snapshot hashes. Corrupt, missing-after-use or engine-incompatible active content fails closed instead of silently resetting to source defaults.
- Actors and timestamps are recorded for draft updates, release creation and pointer activations. This is not a per-keystroke audit log.

This v1 storage adapter is for one persistent server volume. Independent replicas must not use separate copies. It does not synchronize with Supabase, automatically back up data, prune old releases or provide cloud failover. All releases are retained, so monitor file growth and back up the entire directory. Filesystem access must remain server-private. A future transactional database/object-store adapter can keep the same schema/API.

Crash recovery: inspect the state file and backups, stop publishers, and confirm that no writer is running before removing a leftover `content-state.lock`. Do not remove or regenerate the state file to clear a lock. Incompatible engine deployments require an explicit reviewed migration; the application refuses to reinterpret stored releases automatically. Asset references are versioned; asset bytes are not archived by this store.

## Runtime activation and match evidence

`GET /api/game-content` resolves the active release and sends `Cache-Control: no-store`. Collection summaries and lobby faction presentations use the active release too. Future duel/FFA creation captures an active contract once, clones faction/card presentation into the game, and writes its ID to `game.contentVersion` before the first evidence capture. Campaign creation uses one captured release for its narrative, opponent and ensuing game even when account reads span an asynchronous boundary.

Existing games hold their own materialized presentation and do not reread active content. Room recovery serializes the content version and those materialized fields. A later game in a series resolves the active release for that new game. Legacy recovered games without a content version retain the legacy fallback label when finalized.

`buildMatchRecord()` now records the game's pinned release in the existing **`contentVersion`** field. No canonical record schema, audit event verifier, archive verifier or historical record is rewritten. The registry/engine rules and card-effect version labels remain separate. Saved player deck versions retain their original records; newly materialized game cards receive the active presentation without changing their identities, values or composition.

## Discovered coupling and remaining seams

- Card and faction effects dispatch on stable IDs in `shared/duel-rules/index.js`; the active server also owns campaign scripts, FFA, room assembly and automated turns. `server/game/*` remains legacy code.
- Starting constants and deck-slot assumptions are used in multiple creation/execution paths. They are exposed read-only instead of offering inconsistent partial configuration.
- Chapter order also controls progression, difficulty and card-plan tiers. Routing and composition are frozen until those consumers share one typed setup contract.
- Training AI's display name doubles as a behavior flag in the client, so its identity cannot yet be safely authored.
- Full pre-rendered card faces and ordinary playing-card art are selected by client mappings. Updating rules labels or collector illustration references does not regenerate text/art already baked into those faces. The real preview shows this limit, alongside the selected illustration. Generated engine cards and some legacy draft/presentation paths still use code-owned defaults.
- Artwork/music availability belongs to the separately deployed frontend. A content release is not a client-binary or asset-byte release.

The next smallest useful extraction is an explicit encounter setup contract for boss starting life and bounded attack parameters, shared by creation and scripted execution, with isolated reward-free playtests through the existing engine. Before making card mechanics writable, add a finite, versioned effect registry with typed parameters and compatibility tests. Before promising complete visual rollback, add an asset manifest with immutable paths/digests and migrate baked card-face selection to that manifest. Replace the Training AI name check with an explicit opponent-kind flag before allowing its name to change.

## Authorization and untouched surfaces

All reads and mutations remain under the existing `/api/admin` account middleware; direct server `/admin/gauntlet` routes share that gate. Names and owner keys grant no access. The two UUID slots are unchanged. Simply's production ID is pinned; Burnt Ramen's production ID remains unconfigured and therefore denied until the real authenticated ID is supplied. Test identities are isolated fixtures.

Players, Matches and System remain inspection surfaces. No general permissions system, player repair tool, new moderation, archive reconstruction, production reward path or match-history mutation was added. Existing explicitly gated Studio operations remain as they were.

## Verification

- 158 server tests passed, including full draft lifecycle, all eight domains, invalid references/schemas/engine changes, exact-preview requirement, immutable release restoration/restart, stale-write rejection, integrity failures, two-ID authorization on every authoring endpoint, real duel/FFA pinning, room recovery, and account/history isolation.
- 475 client tests passed across 51 suites, including structured edits/revert, cross-domain drafts, field/global errors, conflict retention, real card preview and publication confirmation.
- 33 qualification tests passed; existing engine/history suites remain intact.
- Production build passed. Player JavaScript: 697.9 KiB gzip / 700 KiB budget; main: 169.4 / 175 KiB. Inspection and authoring are separate admin-only chunks totaling 13.0 / 16 KiB; player budgets were not raised.
- Two browser tests passed: both authorized accounts, denied visitors/guests, every section, saved draft isolation, real campaign preview with disabled battle launch, publication, rollback and unchanged historical matches. Accessibility checks found no violations on the tested System and mobile editor surfaces; mobile editor had no page overflow.
- Reviewed screenshots: `artifacts/admin-authoring-preview.png`, `artifacts/admin-publication-desktop.png`, `artifacts/admin-authoring-mobile.png`.

No production content was authored or published during implementation. Browser/unit fixtures use temporary local stores. No deployment or push was performed.
