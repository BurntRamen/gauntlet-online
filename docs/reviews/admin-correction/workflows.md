# Measured operator workflows

The previous implementation is rejected PR commit `7d86cce0`, not an earlier redesign baseline. Both versions were exercised in compiled browsers on isolated loopback fixtures. The twelve activities use 1440×1000; the five complete journeys use 1366×768.

## Measurement method

Counts come from recorded DOM click and change events on buttons, inputs, selects, textareas and summaries. They count the executed scripted path, including helper-driven Editor/Preview choices, not the theoretical minimum or every physical mouse gesture. Text filling is recorded when its native change event fires. Native option selection uses Playwright selectOption and is counted separately, not invented as a mouse click. Checkbox clicks can also generate change events. Routes are distinct URL states observed at interactions, not separate page loads. Forms is the peak visible native form count; many existing editor groups use sections, so zero does not mean no fields were edited. Setup seeding, API assertions, screenshots and waits are excluded.

Each JSON contains the ordered control log, routes and visible-form observations. These are reproducible browser measurements, not a human usability study or a claim that every task needs fewer interactions.

## Twelve activities

Values are previous → correction. Mechanics testing and publication/rollback continuations are measured in the five complete journeys below.

| Activity | Click events | Changed controls | Route states | Selector changes | Peak native forms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Create card | 5 → 2 | 1 → 1 | 4 → 2 | 0 → 0 | 1 → 1 |
| Change card artwork | 10 → 9 | 0 → 1 | 5 → 5 | 0 → 1 | 1 → 1 |
| Create/save mechanic | 4 → 2 | 3 → 1 | 5 → 2 | 2 → 0 | 1 → 1 |
| Add card inside set | 6 → 4 | 2 → 2 | 5 → 5 | 1 → 1 | 1 → 1 |
| Edit website heading | 2 → 2 | 1 → 1 | 2 → 2 | 0 → 0 | 0 → 0 |
| Edit website navigation | 2 → 2 | 0 → 2 | 2 → 2 | 0 → 1 | 0 → 0 |
| Write campaign introduction | 4 → 3 | 2 → 2 | 5 → 4 | 1 → 1 | 0 → 0 |
| Create encounter | 4 → 3 | 2 → 2 | 4 → 3 | 1 → 1 | 1 → 1 |
| Configure/save event | 7 → 4 | 1 → 1 | 3 → 3 | 0 → 0 | 1 → 1 |
| Change product price | 4 → 4 | 1 → 1 | 4 → 4 | 0 → 0 | 0 → 0 |
| Inspect player account | 2 → 2 | 0 → 0 | 2 → 2 | 0 → 0 | 1 → 1 |
| Review/validate shared draft | 2 → 2 | 0 → 0 | 2 → 2 | 0 → 0 | 0 → 0 |

The previous card activity opened Artwork after saving; the correction integrates a relevant preview with creation/editor. This row has different terminal sections and is not a strict same-screen benchmark. The complete card journey below compares saved cards with verified previews. Navigation editing was **unavailable** before: its two clicks only opened the limitation disclosure. The correction saves a real navigation label. The review/validate activity ends at successful validation; the full release and rollback are Journey 5.

The group tab is removed for cards, campaigns and encounters; one flat type selector remains. Desktop browsing no longer requires returning to a hidden list. Set context exposes Create card directly instead of a planning panel. Mechanics starts directly from Home. Events opens the actual definitions rather than an overview and another Events choice. Operations inspection, product price changes and safe release validation were already short and remain so.

Raw data: [previous activity log](before/measurements.json), [corrected activity log](after-activities/measurements.json). Each activity also has a same-named PNG in those folders.

## Five complete journeys

### 1. Create card, associate set, preview and save

Previous: Home → Create a card → name and Set → save → Preview.

Correction: Home → Card → name and Set → actual card face visible in creation → save; saved face and membership verified after reload.

Removed the separate Preview action. Another acceptance case creates and selects a new set inside the unfinished card without losing its name.

| Measure | Previous | Correction |
| --- | ---: | ---: |
| Click events | 3 | 2 |
| Changed controls | 2 | 2 |
| Route states | 2 | 1 |
| Selector changes | 1 | 1 |
| Peak native forms | 1 | 1 |

[Previous ordered actions](before-journeys/card-saved.json) · [Corrected ordered actions](after/card-saved.json)

### 2. Change an existing card's mechanics and execute gameplay

Previous: Create & Edit → Mechanics & Rules → Mechanics type → Create → name, compatible type and effect → save → Cards → existing card → Mechanics → replace binding/select module → save → Test → saved draft → custom hand/payment → start → execute.

Correction: Home → Mechanic → name, compatible type and effect → save → Use on card → existing card directly in its Mechanics editor → save → Test → saved draft → custom hand/payment → start → execute.

Both runs execute the real paid support action, observe gainLife +2, inspect the mechanic event and assert current draft-hash qualification. Direct attachment removes group/type/list navigation and manual binding reconstruction.

| Measure | Previous | Correction |
| --- | ---: | ---: |
| Click events | 19 | 12 |
| Changed controls | 11 | 9 |
| Route states | 8 | 4 |
| Selector changes | 6 | 4 |
| Peak native forms | 1 | 1 |

[Previous ordered actions](before-journeys/engine.json) · [Corrected ordered actions](after/engine.json)

### 3. Website edit, preview, published consumer and rollback

Previous: Website → heading/description → image picker → save → Publishing → validate → preview → name/confirm release → verify actual player → restore/confirm original release. Navigation/composition/type controls did not exist.

Correction: Website → heading/description/image picker → presentation inspector → Editorial + List → hide Basic vs AI → move Factions vs AI → navigation inspector → rename Play and move Campaign → save → Publishing → validate/preview/name/confirm → verify actual player → restore/confirm original release.

More operations deliver new capability, not a shorter equivalent task. The test verifies actual computed fonts/grid, image, order, visibility and navigation before and after release, then exact rollback.

| Measure | Previous | Correction |
| --- | ---: | ---: |
| Click events | 12 | 15 |
| Changed controls | 3 | 9 |
| Route states | 3 | 3 |
| Selector changes | 0 | 4 |
| Peak native forms | 1 | 1 |

[Previous ordered actions](before-journeys/website-rolled-back.json) · [Corrected ordered actions](after/website-rolled-back.json)

### 4. Configure and verify a product

Previous: Events & Commerce → Deck products → Create offer → name/recipe → save → price/availability → save → Publishing → preview.

Correction: Home → Product → name/recipe → save → price/availability → save → Publishing → preview.

Removed the intermediate commerce/subworkspace navigation. The actual storefront manifest contains gold price 30 and available status; live content stays unchanged before publication.

| Measure | Previous | Correction |
| --- | ---: | ---: |
| Click events | 7 | 5 |
| Changed controls | 4 | 4 |
| Route states | 4 | 3 |
| Selector changes | 2 | 2 |
| Peak native forms | 1 | 1 |

[Previous ordered actions](before-journeys/product-verified.json) · [Corrected ordered actions](after/product-verified.json)

### 5. Review cross-workspace edits, publish and roll back

Previous: Create & Edit → Cards group → existing card → edit/save → Website → edit/save → Publishing → validate/preview/name/confirm → inspect manifest → restore/confirm original release.

Correction: Create & Edit → existing card → edit/save → Website → edit/save → Publishing → validate/preview/name/confirm → inspect manifest → restore/confirm original release.

Removed the Cards group choice and six-step release status component. Required publication/rollback confirmations are preserved. Both records appear in one shared release; the live snapshot equals the original after rollback.

| Measure | Previous | Correction |
| --- | ---: | ---: |
| Click events | 14 | 13 |
| Changed controls | 3 | 3 |
| Route states | 5 | 4 |
| Selector changes | 0 | 0 |
| Peak native forms | 0 | 0 |

[Previous ordered actions](before-journeys/publication-rolled-back.json) · [Corrected ordered actions](after/publication-rolled-back.json)

## Repetition and interruptions

The previous engine path recorded Editor three times as the helper moved between workshops/sections; the correction records it once. The shared-release script clicks Publishing twice in both versions (one redundant helper activation); this is disclosed rather than counted as an eliminated portal step. Set creation no longer opens the related-work planning summary. Product creation no longer traverses the commerce hierarchy. Ordinary successful saves introduce no confirmation dialog. Publication and rollback retain their deliberate confirmations; dirty-departure protection is verified separately.

Initial failed attempts are excluded from successful interaction counts and described in verification: stale selectors, an invalid audit season seed, HTTP socket reuse, and the corrected List-grid bug. They are not presented as successful measurements. [Paired screenshots](comparisons.md) show the actual structural result.
