# SuitFire Admin: functional redesign correction

This continues draft PR #116 from the rejected first-pass commit `7d86cce0bff83b715a17a54aeae2250b424cad3f`. The established dark appearance is restored. The differences below are changes to workflows, components, authoring contracts and player consumers.

## What changed

- **Home:** exactly Create something, Continue working and Needs attention. Seven direct creation choices open the actual editor. Recent and pinned records open their identities. Saved changes, publication progress and reported failures produce actionable attention items. Removed dashboard inventories and duplicate notices. The server now reads one compact publication summary plus operational failure summaries; it does not sample accounts, collect purchases, construct catalogs, call module inventories or probe storage for Home.
- **One authoring environment:** a persistent record browser, contextual creation, editor sections, immediate relevant preview and one acknowledged record save. One content-type selector replaces the seven intermediate groups and their extra selectors. Switching content types resumes the recent record and its per-session browser position. Desktop keeps the record list alongside the editor; phone provides a focused list/editor switch.
- **Related creation:** a card can create and select a set in place without losing its local name. Creating a card from a set carries membership automatically. Mechanics have a compatible-card chooser and direct attachment. Campaigns create the next encounter with the campaign relationship retained. Related records link directly to their owning editor.
- **Mechanics:** structured When / Only if / Pay & target / Then assembly uses the deployed interpreter contracts. Supported amounts, target choices, duration and limits remain typed and validated. Real engine tests execute the saved draft and retain exact-hash evidence. Fixed engine definitions remain inspectable with direct links to actual consumers; contract details are under Advanced.
- **Website Studio:** visual page list, actual player component tree, selectable page headings/registered sections/navigation and an inspector. Supported headings, descriptions and immutable artwork combine with released navigation labels/order, section order/visibility, typography and arrangement presets. Every exposed presentation setting has a runtime consumer.
- **Events and commerce:** events and products open their actual definitions directly. Scheduling, eligibility, rewards, price, availability and entitlements remain editable through their existing services. The duplicated overview/prestige calendar and introductory planning layers are removed; optional eligibility simulation remains discoverable.
- **Publishing:** one readiness explanation and primary next action, specific validation/engine blockers, affected-record counts and all changes. The six-step status display is removed. Validation, preview, engine qualification where required, explicit publication confirmation and rollback remain enforced.

## Consolidation beyond styling

Deleted `ProductionGuide` and its duplicated planning interface. Removed `ReleaseProgress` as a rendered stepper while retaining its exact-revision gating helper. Merged gallery/table record presentations into one thumbnail/context browser for content and printings. Removed the engine category switch and duplicated parameter table. Reused `WorkshopShell` for creation and registry-backed editors. Removed the old Home dashboard projections, frontend panels and duplicate publication action. The previous first pass had already removed `ProductionPipeline`; these changes go further rather than relabeling that removal.

The six outer destinations remain because they separate authoring, website composition, events/commerce, shared publication and operational records. The measured reductions come from direct creation, removal of intermediate groups, persistent browsing and related-record actions inside those destinations.

## Authority and real consumers

| Editable capability | Existing authority / mutation | Preview and released consumer |
| --- | --- | --- |
| Card identity, text, artwork, set membership | `domains.cards`, `domains.sets`, immutable media; create/record endpoints with revision checks | `PrivateCard` → actual `SpecialCardFace`, including local names/ranks/text; resolved manifest and gameplay adapters |
| Reusable mechanics and attachment | `studio.mechanics`, card effect bindings; studio-draft/record | Typed contract explanation; real server duel playtest and executed events; current draft hash qualification |
| Campaigns, encounters, decks, factions, characters | Existing authored domains, contracts and creation operations | Existing campaign/encounter/deck/player components and pinned gameplay setup |
| Products, prices, availability | `domains.offers` / Para definitions and existing draft endpoints | Saved preview resolves actual `manifest.deckOffers`; existing storefront and server fulfillment |
| Website copy and imagery | Optional registered fields on the existing `domains.game` owners | `projectProse` → `manifest.websiteProse` → actual `PlayerMenus` / `PlayerPageHeader` |
| Navigation labels and ordering | `practice.websiteNavigation`, version 1 | `manifest.websitePresentation.navigation` → desktop navigation, phone destinations and More menu |
| Registered section ordering/visibility | Per-page `*PageLayout`, version 1 | `manifest.websitePresentation.pages` → actual `PlayerLayoutGrid` registered modules |
| Type and arrangement presets | Same per-page versioned layout | Actual `PlayerShell` data attributes and CSS: standard/editorial/plain; tiles/list/compact |
| Publication and rollback | Existing shared publication provider and receipts | Isolated publication resolves real `/api/game-content`; rollback verifies exact original live snapshot |

`shared/websitePresentation.js`, `websiteSections.json` and `websiteRegistry.json` define the allowlist and validator. Schemas reject unknown keys, versions, IDs, duplicate destinations/sections, arbitrary URLs/code, invalid labels and hiding every section. Older snapshots keep existing hashes/defaults; newly registered sections append visibly to older layouts. Protected account/recovery controls stay outside editable section grids. Settings exposes typography, heading and artwork; it has no unsupported arrangement control. Optional personal layout preferences retain precedence for a player's explicitly customized ordering.

The Website preview uses `PlayerMenus`, `PlayerShell`, `PlayerLayoutGrid`, `PlayerPageHeader` and the real action tiles with representative guest data. Navigation is compacted inside the preview frame; no match, account or payment action is executed there. Content, section membership/order, typography and arrangement use the same published data consumers. The full-size player page is separately verified after isolated publication. This is a bounded registered-component editor, not arbitrary HTML/CSS/JavaScript.

## Evidence

- [Measured activities and five complete journeys](workflows.md)
- [Paired structural screenshots](comparisons.md)
- [Checks, native zoom and limitations](verification.md)
- [Exact gzip bytes and original limits](bundle.json)

All authoring, publication, rollback, event and product writes in this review use isolated loopback fixtures. The two existing administrator identities, authorization checks, compare-and-swap revision handling, shared draft lifecycle, engine qualification, immutable assets and historical releases retain their existing authorities. No production publication, deployment or merge is authorized or performed. PR #116 remains draft for review.
