> Historical implementation report. The current production integration, expanded 126-card registry, resolved two-account IDs, and GitHub persistence supersede the original counts/storage assumptions below. See [the current deployment guide](gauntlet-admin-deployment.md).

# Gauntlet Admin v2 — conversion and verification

This is the current implementation report. The v0 architecture audit and v1 authoring report describe earlier states. No production deployment, database migration, account change, push or external publication was performed by this work.

## Boundaries converted

| Boundary | New authority | Production consumers |
| --- | --- | --- |
| Encounter formulas, ability selection and chapter card-plan tables | `server/encounterDefinitions.json`, validated by `shared/duel-rules/encounterContract.js`; published `encounter.setup` | `prepareCampaignRoom` feeds production creation and admin playtest; shared engine handles scripted attacks with the same pinned values. Existing completion routing is checked against the recorded setup. |
| Card identity dispatch | 72 finite effect definitions, effect version and declared parameters in `shared/duel-rules/effectRegistry.js` / `effectDefinitions.json` | Shared duel engine and the active server multiplayer handlers dispatch on the effect contract. Card identity remains separate and unchanged. |
| Faction identity dispatch | Four finite mechanic contracts, version 1 | Both engine paths consume the same Rumin and Sheen parameters. Frumo/Bizi timing, targeting, choices and counters stay in their supported engine handlers. |
| Training AI name checks | `opponentKind: "training-ai"` | All three client behavior checks use this field. Production creation sets the editable name independently. Recovery derives identity from the stored room AI flag, never its name. |
| Ad-hoc authored asset paths | `server/contentAssetManifest.json` | 906 asset references resolve to SHA-256-addressed copies under `/assets/gauntlet/releases/`. Coverage includes faction, scene, portrait, constructed illustration/face, ordinary-card face and voice assets. |
| Baked card faces masking authored edits | Published card `presentation` | Collection/Admin use `SpecialCardFace`; the battlefield uses published composition in `createGauntletScene`. Unchanged content may use its pinned baked face. Changed labels/art use the release's illustration and text. Replays preserve that same presentation. |
| Duplicated hand/deck assumptions | `shared/duel-rules/gameConfig.js` and published `gameConfig` | Duel and multiplayer initial draws and refills consume the pinned hand size. Shared suit/rank/deck-size constants feed deck validation and the client slot editor. |

## Editable fields

The existing Content/Game shared draft exposes these additions:

- **Encounters:** boss life (1–100), attacks per turn (1–6), minimum/maximum attack value (1–14, ordered), attack progression offset (1–64), the six supported boss ability IDs, tier (1–3), optional even-attack bonus (1–4), optional turn-start healing (0–4), ability presentation, and bounded same-faction player/boss card lists. Existing encounter/opponent/story identities remain stable.
- **Cards:** choose a supported effect within the card's existing faction and type. Coin-Scale Spear, Rumie Vault Shield and Aurelian Clawblade expose an integer `armBonus` (0–8). The other effects expose no invented parameters. Existing name and displayed rules-text editing remains available; validation warns that wording must describe the selected mechanic.
- **Factions:** Rumin's fourth-attack bonus (0–8) and Sheen's readied large-attack bonus (0–8). Their displayed power text is derived from the selected values. Other faction mechanics remain explicit, versioned, read-only contracts.
- **Opponents:** Training AI's display name is now ordinary editable metadata.
- **Assets:** authored image/audio fields accept an existing manifest asset ID, its source-path alias, or its immutable path, with media-type validation. Image fields have a manifest-backed picker. The selected asset's identity, digest, associations and immutable path are inspectable. No upload service was added.
- **Game:** shared hand size (3–12), applied at creation and refill. All previously editable presentation fields remain supported.

These are authoring capabilities; the migrated baseline does **not** change balance, card identities, rewards, campaigns, factions or modes.

## Engine-controlled values

Starting life stays 42 because completion/achievement rules also rely on it. Deck size, ranks, suits, per-value replacement capacity, lane count, payment accounting, damage resolution, ordering, optional choices, activation costs, targets, timers, matchmaking, rewards and progression gates remain code-controlled. Existing deck replacement precedence is unchanged, including occupied slots in a player's saved deck.

Encounter attack timing supports only `clear-priority`; win routing supports only `first-uncompleted`; loss routing remains retry. Their identifiers are part of the typed setup, but this release does not invent alternate routing or scripts. Encounter order and `nextEncounterId` remain protected. The progression offset affects attack value/suit cycling, not campaign order or unlocks.

Every supported card effect still needs executable engine logic. The registry gives that logic an explicit finite interface; it does not make arbitrary mechanics data-driven. Frumo/Bizi faction mechanics retain their code-owned sequencing because changing just individual constants would not safely update their choice, cost and UI contracts.

## Old paths deleted and retained

Deleted: `CAMPAIGN_CARD_PLAN`, chapter-index difficulty/card-count/ability-selection formulas, all direct `cardIs(card, cardId)` dispatch, name-based Training AI behavior checks, the unused `legacyDeclareAiHandAttack`, `legacyDeclareCampaignBossAttack`, `legacyAiPassPriority`, `legacyAiEndPlacement` and their unused payment helper, and the unreferenced `server/game/gameFactory.js` / `gameLogic.js` implementations.

The active multiplayer path in `server/index.js` remains because its multi-seat orchestration differs from the two-player shared engine. It consumes the same finite card/faction contracts and extracted configuration; its multiplayer turn rules were not replaced with an unrelated simulation.

The registry retains a **legacy ingress adapter** for unversioned saved cards. Explicit invalid effects never fall back to card identity. Client card-art mappings remain only for old cards/replay records without a published presentation contract. New production games and new public replay cards carry pinned references. Legacy archive bytes are never backfilled or rewritten, and missing historical information is not fabricated.

`legacyAuthoredBaseline.v1.json` and `contentMigration.js` are migration data/validation, not a second executable rules implementation. V2 deck templates reference their encounter; the setup owns the card plan.

## Versions, storage and migration

| Component | Version |
| --- | --- |
| Authored schema | `gauntlet.authored-content.v2` |
| Resolved engine/content contract | `gauntlet.engine-content.v2` |
| Card effects | `gauntlet.card-effects.v1` |
| Faction effects | `gauntlet.faction-effects.v1` |
| Encounter setup | `gauntlet.encounter-setup.v1` |
| Shared configuration | `gauntlet.game-config.v1` |
| Asset manifest schema | `gauntlet.asset-manifest.v1`, plus a full content digest |
| Rules / command / evidence formats | Existing versions retained; default rules and command semantics remain equivalent. |

Each new game binds authored release, engine rules, card/faction effect contracts, encounter contract, configuration contract and asset manifest separately. It carries the exact card/faction definitions and configuration it uses. Match records retain those definitions and campaign setup; public replay cards retain their text, effects and presentation. Replay resolution uses captured content when present, without querying today's definitions.

The existing atomic content store and exclusive lock remain in use. Opening a compatible persisted v1 store automatically and deterministically creates v2 releases, preserves every original release unchanged, migrates the active pointer and shared draft, and clears old preview/playtest receipts. Older incompatible inactive releases remain preserved but cannot be activated. Unsupported active legacy contracts/references fail closed rather than silently dropping data. No historical game or match record is migrated.

Production authoring still requires `GAUNTLET_CONTENT_DATA_DIR` on a persistent, backed-up shared volume. The original server-side two-account stable-ID allowlist remains mandatory for every admin route, including playtest endpoints; no role system was introduced. The unresolved Burnt Ramen production-ID slot remains fail-closed until configured with that account's verified ID.

## Playtest and publication isolation

`POST /api/admin/authoring/playtest` creates a private temporary game from the validated selected draft. `POST /api/admin/authoring/playtest/command` invokes the same shared engine as production; opponent moves use the existing production AI selector. The factory is the production `createGameFromLobby` with an unregistered local room object, and campaign setup is the same `prepareCampaignRoom` used for real matches.

Sessions are owner-bound, expire after 30 minutes and are replaced when that operator starts another. They are not registered in production rooms and have no progression/reward, ranked/league or match-persistence entry point. A successful engine command records a receipt for the exact draft hash. A changed draft invalidates it. Mechanical publication requires both the exact saved preview and playtest receipts; presentation-only publication retains the preview requirement. This receipt records an exercised draft, not a claim that every possible balance interaction was tested.

Optimistic revision conflicts, immutable releases, atomic pointer activation and rollback remain intact. Publishing affects future games; existing games retain their copied definitions and references.

## Verification

Fixtures were captured before deleting the original configuration/dispatch paths:

- **1,728 engine outcomes** cover all 72 cards across four turn contexts, attack, available choices, placement, blocking, resolution and payment. Both legacy ingress and explicit effect definitions match the captured hashes.
- **56 encounter fixtures** preserve every initial difficulty/ability/card plan, with scripted attack sequences checked across eight turns and every attack slot. These preserve the actual prior late-pressure behavior, including its last-two-attacks rule.
- Targeted tests cover unsupported effect IDs/versions/parameters, faction and weapon parameters, hand-size creation/refill, Training AI rename and recovery, all asset digests, composed presentation/rollback, exact-draft playtest invalidation, authenticated playtest isolation, active-game pinning, v1 migration and unchanged historical evidence.
- **171 server tests passed**, including engine contract, access, persistence, archive and history checks. **476 client tests passed across 52 suites**, including the shared-engine suites and published-card rendering. **33 qualification checks passed.** All **3 Playwright workflows passed**, including desktop/mobile accessibility, two-account access, publication/rollback and the typed encounter playtest. The final playtest command-selection refinement also passed all four authenticated route tests.
- Production client build and server syntax checks passed. Measured gzip sizes: main **169.9 / 175 KiB**, largest async **310.4 / 350 KiB**, player code **702.5 / 704 KiB**, Admin **14.9 / 16 KiB**.

Immutable asset packaging adds approximately 101 MB of referenced media, stored by digest with duplicate bytes shared. It copies existing files; no new artwork was generated. Run `node scripts/build-content-asset-manifest.js` when packaging an intentional asset update, and retain old digest files needed by releases/replays. Deploy the packaged frontend assets with the corresponding server contract.

The player-code budget is 704 KiB gzip (previously 700 KiB), a measured 4 KiB allowance for the effect contracts, published-card composition and replay support. The 175 KiB main, 350 KiB async and 16 KiB Admin ceilings remain unchanged. This work does not deploy the local verification build, which uses the isolated test backend URL.
