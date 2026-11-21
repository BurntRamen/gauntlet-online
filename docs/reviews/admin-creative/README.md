# SuitFire creative studio

This update extends PR #116 with working card/artwork, Website, campaign, format and competition workflows. Screenshots come from the rendered application with an isolated authoring service, uploaded immutable media and real engine sessions. They are not mockups or production content.

## An operator's card journey

1. **Create.** Home's Card action opens the creation form. Choose an existing set or create one in place, choose a supported executable mechanic, and inspect the player card. [Creation screen](02-new-card.png).
2. **Choose artwork.** Artwork opens the shared image library for the selected printing. Upload includes attribution; selection retains the exact immutable version. The player card reflects local presentation changes. [Artwork assignment](01-card-artwork-local.png).
3. **Save.** The gold Save bar names the record and changed fields. Saving creates a shared draft; it does not publish. The saved card and exact artwork survive reload. [Saved card](02-new-card-saved.png).
4. **Test.** The next-step cue opens Test and focuses the real source control. Gameplay changes need an accepted command against the current saved draft. The cue then confirms “Saved draft tested” and leads directly to release review. Editing again invalidates that receipt. [Tested card](02-new-card-tested.png), [phone test guidance](10-phone-test-guidance.png).
5. **Publish.** Shared review combines saved changes from every workspace. Its readiness cue highlights the next missing validation, presentation preview or engine test. Publication names the complete release; rollback uses retained release identity. [Card ready to publish](02-new-card-release.png), [shared review](08-shared-review.png), [published player](09-published-player.png), [rollback](09-rolled-back.png).

The active section has a visible dot and accessible current-step state. Gold indicates the next action or unsaved work; saved/tested status uses text and recorded evidence as well as color. Back to list preserves the editor buffer. Leaving with local changes opens Keep editing, Save and continue, or Discard local changes. [Phone preservation](10-phone-unsaved.png).

## Ten acceptance workflows

| Workflow | Functional evidence | Screens |
| --- | --- | --- |
| Existing printing artwork | Upload and save a versioned reference; public release resolves its immutable bytes | [Artwork](01-card-artwork-local.png) |
| New card, mechanic, set and artwork | Create a set in context, save an executable card, upload art, reload persisted fields, test this exact card in a real game and publish its identity/artwork | [Create](02-new-card.png), [Saved](02-new-card-saved.png), [Receipt](created-card.json) |
| Menu artwork | Click the actual player tile, upload/select art, select an approved icon | [Desktop](03-menu-artwork-desktop.png), [Mobile](03-menu-artwork-mobile.png) |
| Website presentation | Save heading, navigation label/order, type/layout and background; verify actual published renderer | [Saved Website](04-website-saved.png), [Publication receipt](imagery-publication.json) |
| Campaign encounter | Create story/dialogue, opponent life/AI, rules, cards and media; duplicate and reorder with preserved relationships; accept an actual game command | [Campaign journey](05-campaign-journey.png), [Media](05-encounter-media.png), [Test](05-encounter-tested.png), [Receipt](campaign-test.json) |
| Supported format | Change shared hand size and verify the actual initial hand and public configuration | [Settings](06-format-settings.png), [Game](06-format-engine.png), [Receipt](format-test.json) |
| Event setup | Save season eligibility/Gold budget, event format, attempts, dates and Prestige; run eligibility simulator; retain draft/live distinction | [Overview](07-event-overview.png), [Test](07-event-tested.png), [Receipt](event-test.json) |
| Cross-workspace review | Card printing and Website records appear in the same shared release | [Review](08-shared-review.png) |
| Publication and rollback | Publish in an isolated provider, verify the actual player consumer, restore the exact prior release | [Published](09-published-player.png), [Restored](09-rolled-back.png) |
| Desktop and phone navigation | Retain unsaved fields through browse/editor changes and blocked navigation; Axe and horizontal-overflow checks | [Catalog](02-card-catalog.png), [Phone](10-phone-unsaved.png) |

The six cases in `e2e/admin-creative.spec.js` jointly cover these ten workflows. All operations use isolated accounts and storage. Reversible release journeys restore their baseline. The new-card publication runs last in a disposable provider because published card identities cannot be erased by rollback. Production drafts are not involved.

## Contracts and boundaries

- Website fields are versioned, validated and consumed by the actual player menu/shell. The preview renders that same component tree inside desktop/mobile viewports. It uses representative guest data; it does not enter matches or change account state.
- Campaign ordering changes only additional active encounters. Original chapters retain their progression, and archived relationships remain resolvable. Every reorder clears prior preview/test receipts.
- The format catalog describes supported engine contracts and opens their actual shared settings, sets, campaigns or event definitions. Existing games retain captured rules.
- Events separate saved definitions, published definitions, active runtime operations and captured results. A draft-only event cannot be operated.
- Creation forms use server contract limits. Asset selection remains private, versioned and immutable. Search and typed links can open registered Website image/icon fields directly.
- Authorization, expected revisions, exact draft hashes, qualification, publication audit and rollback remain authoritative. No dependencies, performance ceilings or payment activation flags are changed.

## Verification

The release workflow runs the complete client/server suites, content contracts, browser and accessibility journeys, security audits and performance gates. The new creative suite is included in the existing Admin release job. Local qualification includes 60 engine/tooling checks, four build-configuration checks, validation of 1,218 cards and 2,732 immutable asset references, and all 70 approved artwork hashes.

Local verification passes all six creative browser cases, covering the ten acceptance workflows, and all twelve measured operator activities. Hosted checks confirm 683 server tests and 135 client suites / 1,087 client tests. The corrected-editor and visual-guidance groups pass, including phone accessibility, native 200% zoom, and unsaved-work protection. Immutable asset releases, authored deck purchases/restarts, separate Gold/Gem purchases, and production editor/support paths pass. All three dependency audits report zero vulnerabilities. [Browser results](browser-verification.json) and [unchanged bundle budgets](bundle.json) record the original creative evidence; the latest PR checks remain the release authority.

Final check and deployment status is recorded with PR #116. Passing local journeys alone are not a claim that production has deployed. The code release must not publish, discard or overwrite unrelated production content drafts.
