# Admin production guide

Admin is private to the existing stable identities for simply and Burnt Ramen. Sign in on Gauntlet Online and open Admin. Public players cannot use its editing APIs. Home groups Content, Competition, Store & Economy, Players, Publishing and Operations. Search opens the owning object and field. Recent objects and workspace filters resume on the same browser; unsaved form values are never stored in the URL or those preferences.

## Understand the two kinds of work

Content edits enter one **shared saved draft**. Save each edited field, resolve validation, preview and playtest that exact saved content, then review and release it through Publishing. A second operator's conflicting save retains your local values and original revision; compare and explicitly retry. Leaving an object with unsaved edits requires keeping the editor open or discarding only local edits. Discarding local edits does not discard the shared draft.

Player corrections, refunds and operational controls apply **immediately**, with authorization, a reason and audit evidence. They are not content releases. Content rollback does not reverse them. Keep the original operation identity when retrying a failed response; the server reconciles duplicates.

## Produce content

Open **Production steps** on a set, card, printing, faction, campaign, encounter, deck or offer. It shows related editing steps, where players see the result, mode/access restrictions, current validation issues and release readiness. These are derived from the selected Live or Saved draft content. A saved definition is not automatically live, mode-eligible or owned by a player.

| Job | Operator path | Player result |
| --- | --- | --- |
| Set and cards | Create set → create/add cards → choose registered or authored mechanics → select artwork/printings → configure channels and distribution → real-engine test → release | Eligible cards enter Card Library, constructed selection or the enabled Draft/Sealed pool. Set membership alone grants nothing. |
| Faction campaign | Create faction using a qualified existing rules family → edit roles/presentation → campaign and encounters → assign decks/setup → test → release | Journey uses the chosen family's actual behavior. New factions remain campaign/test content; competitive and limited eligibility are separately restricted. |
| Encounter | Story/dialogue → opponent and setup → optional deck/modifier/AI profile → image/audio → preview briefing → playtest → release | The released chapter runs through the production engine and existing progression routes. |
| Deck product | Saved recipe → exact printings, deckbox/treatment/card back → offer with approved currency price/availability → validate → sandbox purchase/delivery → release | The product grants its captured recipe and cosmetic package. Ranked and constructed access to gameplay cards remains separate from cosmetic ownership. |
| Website prose | Website prose → search a registered page or mode → edit title/introduction → saved preview → release | The corresponding player menu displays that release's wording. Arbitrary HTML, navigation code and game rules are not prose fields. |

Pack controls expose the existing thirteen-slot recipe. Four common slots keep suit guarantees. Other slots select supported rarities/wild/face rules and the wild mythic percentage. Validation checks the actual eligible pool. These controls do not introduce a price, currency, duplicate policy or collector-pack economy.

## Mechanics and AI

Card wording and executable mechanics are separate. Registered effects can be selected only for compatible card types/factions. Mechanics Studio composes bounded triggers, conditions, decisions, costs, targets and effects. Editing a shared mechanic affects every listed card in the next release; copy it first for an independent behavior. Captured games keep their prior definition.

V2 mechanics can offer explicit optional payments/targets or required free choices. The controller resolves the offer before other commands proceed. Decline spends nothing. Production reconnect and timeout handling retains the captured deadline. FFA supports only the qualified automatic Servitor combat subset; Studio explains unsupported combinations and mode admission rejects them.

Encounter AI offers existing scripted pressure or **support first**. Support first spends the same action budget as attacks/blocks, so a one-action boss may play support instead of attacking. The objective remains defeat the opponent. Survive-turn objectives need a defined turn boundary and defeat precedence; protect-target objectives need target, removal/revival and loss-timing rules. Those undefined designs are shown as unavailable.

## Media and tests

Upload or choose an immutable image/audio version through its field picker. Uploading alone does not save the field or publish it. Images are normalized to WebP; new audio accepts PCM WAV. Existing manifest MP3s remain selectable. Replacing a reference creates/selects a version without rewriting prior releases, printings or captured games. Inspect capacity and usage; archived media remains retained for recovery.

Choose **Live** or **Saved draft** when testing. Every session names its subject, release/hash, contract versions and scenario. Live tests are useful even when draft persistence is unavailable but cannot satisfy draft publication gates. A changed draft makes its old session stale; evidence remains visible. Restart creates a replacement only after the new setup succeeds. Custom starting states are labeled as such and do not claim a historically played sequence. One accepted engine command meets the existing publication receipt policy; it is not a balance certification.

## Release and verify

Publishing groups Story, Presentation, Mechanics and Game configuration changes, shows before/after values and recorded contributors, and checks the saved hash against validation, preview and engine receipts. Older changes without contributor metadata are labeled unattributed. No local unsaved form value is included.

GitHub checks and exact merge remain required. Normally the application serves the packaged release after deployment. With the separately configured data-only capability, compatible content activates through the private revision guard without waiting for a code restart; code changes still require deployment. Check the **actually served release**, then open the relevant player destination. Publishing configuration never enables a disabled economy or payment provider. Rollback selects an immutable compatible release and preserves purchases, grants and player corrections.

## Support players and operations

Players starts with a compact summary and focused tabs. Name corrections preserve stable account IDs and protected operator identities. **Review missing progress** proposes only missing campaign clears, achievements and earned cosmetic unlocks supported by recorded account receipts. Review its before/after evidence and enter a reason before applying. It does not replay money, packs, rankings, match totals or printing purchases. Use the existing receipt-based commerce refund controls for supported refunds.

Operations distinguishes configured storage, last commits, backup attempts and actual recovery evidence. A healthy probe is not proof of a restart drill. Remote rooms/ledgers can run on Render Free; they require their migrations/configuration and one writer. Finite Gold, account Gold/Timetwisters, Gems and real-payment funding retain their separate policies and launch controls. No approved live charging provider is supplied by this implementation.

Recovery instructions: [runtime](remote-runtime-operations.md), [operational ledgers](remote-operational-storage.md), [immutable media](immutable-media-operations.md), [full project export](project-recovery.md), and [mechanics/data activation](mechanics-decisions-and-data-releases.md). Preserve private exports and deployment secrets outside the repository. Do not restore over an active project.
