# SuitFire operator studio

Implementation review for `codex/suitfire-admin-studio`, based on main `41d8801f`. Development and browser writes use isolated local fixtures. No production content, authorization identities, activation flags, payment configuration or engine rules are changed.

## Audit and simplification

Inspected the compiled application at desktop, laptop and phone widths, the authoring/publication services and editor contracts, and the earlier [workspace verification](../admin-workspace/verification.md), [runtime follow-up](../admin-pipelines/runtime-follow-up.md) and [production handoff](../../admin-production-release-handoff.md). The earlier 61 KiB Admin budget finding is historical; the current checked-in limit is 75 KiB and is unchanged here.

| Original surface | Purpose and authority | Implemented decision |
| --- | --- | --- |
| Home / production dashboard | Compact `/api/admin/home` publication/tasks/operational summaries; browser-local recent work | Keep recent records, direct creation, shared draft and actionable attention. Move service detail to Operations. Remove pipeline launchers and repetitive status cards. |
| ProductionPipeline | A planning/navigation layer over existing editors; no content authority | Remove the component. Old pipeline links open their owning editor. Related-work guidance and dependency-aware creation remain contextual, collapsed and loaded on demand. |
| Content rail, workshop and type selectors | Route into one authoring snapshot | Seven grouped tabs under Create & Edit. Show a type selector only within multi-type groups. Remove the duplicate Engine category selector. |
| Card Workshop | Card identity, wording, supported effects, printing choice and engine test | Retain authoritative editor; unify fields, save strip, preview and responsive layout. Local changes save together per record. |
| Printings / sets | Editions, immutable printing metadata and gameplay membership | One browser/editor; contextual card creation retains set membership. Card artwork links to its exact printing. |
| Deck / offer editors | Recipes and storefront offers | Recipes in Create & Edit; products in Events & Commerce. Private notes remain outside releases. |
| Campaign / encounter editors | Story, routing, opponent/setup and boss contracts | Preserve typed editing, actual chapter briefing/playtest and direct faction/campaign/character/deck dependencies. |
| Faction / character editors | Public presentation and supported family bindings | Keep in content; Website links here. Fixed identities and registry contracts remain protected. |
| Engine / Rules and Mechanics Studio | Registry inspection, reusable effects/modifiers and supported configuration | One group and category selector. Structured authored effects retain uses and actual engine testing; registry-only behavior remains read-only. |
| Website prose | Mode copy and nine registered page headers | Dedicated Website destination. Add versioned header imagery and immediate local preview using the actual player header component. Explicitly identify code-defined boundaries. |
| Media / asset picker | Manifest assets, uploaded immutable versions, usage and capacity | Retain source/version details, previews, search, usage, upload/archive protections. Website uses the same picker. |
| Competition / Para / economy | Seasons/events, eligibility, rewards, offers, entitlements and results | Events & Commerce: Events & seasons, Ranked rules, Results, Deck products, Gold & rewards. Preserve internal service and publication boundaries. |
| Release review / footer actions | Exact shared-draft comparison, validation, preview, engine gates and history | Publishing owns global validation and saved-draft preview. Editors have one record save and review links. Remove duplicate global validation/progress panels. Render the acknowledged selected-record preview in Publishing. |
| Players | Search, metadata and audited corrections | Operations → Players; retain deliberate mutation acknowledgement and authoritative detail. |
| Match evidence | Captured match, content and engine provenance | Operations → Match evidence; retain historical versions, current/draft links and return context. |
| System / owner operations | Storage, reconciliation, failures, historical overview and recovery | Operations → Health & recovery; loaded on entry, away from daily creation. |
| Global finder | Destination labels and editable prose | Add Records filter for content, mechanics/modifiers, competition/Para and immutable media versions. Preserve prose field targets, private-data exclusion, keyboard/focus and dirty-buffer guards. |
| Preferences / pins | Browser-local view choices and shortcuts | Keep optional, scoped to the authenticated operator and cleared on account change. They do not become content authority. |

The shell retains one authoring session across destinations. Existing URLs/internal aliases, browser history, dirty buffers, save acknowledgements and revision checks remain. Common content needs one primary and one group choice. Section tabs and the dropdown are mutually exclusive by viewport.

## Capability and consumer matrix

**Working** denotes an implemented authoritative service and consumer. **Bounded** denotes the supported published contract. **Deferred** denotes a missing runtime capability, with no inert editing control. Observed verification is recorded separately.

Ordinary fields come from server-owned `fieldsFor` or mechanic/competition/Para definitions. `PATCH /authoring/record` saves a record with its expected shared revision; typed definition endpoints save their bounded objects. Content reaches players only through the existing immutable publication projection. Operational mutations use separate audited services.

| Capability | Coverage | Persisted source / write path | Runtime consumer and boundary |
| --- | --- | --- | --- |
| Cards and wording | Working, bounded | `snapshot.domains.cards`; record/create | `resolveRelease`, public manifest and duel bindings; exact release required. Fixed shipped identity restrictions remain. |
| Sets, collections, printings | Working | `domains.sets`, `domains.assets`; record/create | Collection, draft/sealed and actual card presentation. Membership alone does not grant ownership or enable every acquisition channel. |
| Deck recipes | Working, bounded | `domains.decks`; typed composition | Deck fulfillment, campaign/AI setup and captured matches. Private notes use a separate service and are excluded from search/release. |
| Deck products / price / availability | Working, bounded | `domains.offers`; record/create | `manifest.deckOffers`, server-owned purchase/fulfillment and captured offer revision. Existing currency and ownership restrictions remain. |
| Campaigns / encounters / dialogue | Working, bounded | `domains.campaigns`, `domains.encounters` | Campaign discovery, briefing, chapter engine setup and progression. Custom scripts/objectives require engine work. |
| Factions / characters | Working, bounded | `domains.factions`, `domains.characters` | Published names, biographies, portraits, encounters and qualified family bindings. |
| Artwork / audio | Working | Manifest and immutable uploaded versions; assets/upload/archive | Release-pinned references and private draft media routes. Replacements preserve historical references; remote capacity depends on configured storage. |
| Reusable mechanics | Working, bounded | `studio.mechanics`; studio-draft | Qualified interpreter: triggers, conditions, payments, choices, targets, ordered operations, duration and usage limits. Card bindings and server playtest execute the result. |
| Rule modifiers / configuration | Working, bounded | `studio.modifiers`, approved `game:shared-rules` fields | Deployed modifier/engine contracts and captured setup. Unsupported operations require qualification, not arbitrary JSON. |
| Nine website page headers | Working, improved | Optional title/description/image fields on registered `domains.game` owners | `projectProse` → `manifest.websiteProse` → PlayerMenus → PlayerPageHeader. Absent fields preserve old hashes/defaults; imagery resolves immutable references. |
| Mode prose | Working | Registered `hero*`, `menuDetail`, names/descriptions | Existing compact focused player surfaces. Local presentation is distinct from engine evidence. |
| Global navigation labels / destinations | Deferred | Code-owned navigation/route/action registry | Needs a versioned allowlisted presentation schema, validator and consumer migration. No arbitrary URLs/routes exposed. |
| Global sections, visibility/order, typography | Deferred | Code-owned layout registry/styles | Needs release-owned schema, accessibility constraints and account-layout precedence. Personal player layout preferences are not global publication. |
| Seasons/events, qualification/prestige | Working, bounded | `paraLeague`, `competition`; para-draft/competition-draft | Server eligibility, scoring, scheduling and results. Draft definitions are distinct from operational result records. |
| Gold awards / entitlements | Working, bounded | Para definitions and existing transaction/entitlement stores | Qualified award, claim and fulfillment services. No new payment processor, Gems control, free-form balance adjustment or activation flag. |
| Player support / corrections | Working, permission-scoped | Existing account metadata/correction stores and audit entries | Acknowledged CAS account mutation, separate from content release; only the two existing administrator identities. |
| Match/history evidence | Working | Immutable archive and captured release/engine versions | Inspector/replay; content edits do not rewrite historical games. |
| Shared release / rollback | Working | Existing publication provider, revision/hash and receipts | Explicit review/confirm, configured GitHub or data-only pipeline, then deployment verification. Compatibility and entitlement rollback gates remain. |

Exact website surface IDs, owners and defaults are in `shared/admin/websiteSurfaces.json`: Play, Decks & Cards, Compete, Matches, Community, Learn & Rules, Profile, Settings and Campaign. Header artwork is decorative; meaningful content remains text. Arbitrary HTML/CSS and external image URLs are not offered.

## Visual system and performance

Light neutral canvas, dark indigo navigation, restrained purple selection/draft context and ember primary actions use existing approved branding. Typed fields, dialogs, operational tables and media pickers share the same tokens; player previews retain their player presentation. Narrow views retain focus trapping, visible focus and reduced-motion behavior.

No dependency or budget changes. Authoring/catalog/history remain lazy. Related guidance loads only when opened and refreshes with the source hash/revision. Search uses compact publication state instead of a full status projection. Home still avoids full authoring and historical overview reads.

See [comparisons.md](comparisons.md) for paired rendered captures and [verification.md](verification.md) for commands, results and limitations.
