# Guided operator journeys

This refinement adds contextual visual guidance to the existing shared editors. It does not introduce another planning screen or a separate save/publication path.

- **Know where you are:** the active editor section has a visible marker and an accessible current-step state. One “Your next step” cue explains the current task and opens the next section, the preview, a validation field, or release review.
- **Know when to save:** record edits use the existing sticky Save bar, with an explicit next-action label. Registry editors offer “Go to save controls”; this focuses the real Save button or an invalid field without submitting. A conflict keeps record Save disabled until the comparison and retry acknowledgement are complete.
- **See what you are editing:** Website Studio outlines registered editable elements. Clicking one focuses its inspector; the selected element keeps its stronger outline, including selections made from the inspector dropdown. Card presentation uses one actual card preview instead of repeating its text and artwork below it.
- **Know what release needs:** the readiness message sits above the actions. The next eligible validation, preview or engine-test action is highlighted. Completed evidence gets a check only for the current draft revision and hash; a missing release name is highlighted when the draft is otherwise ready. The existing publication gates remain authoritative.
- **Keep state language accurate:** a shared draft is described as available, not as proof that the currently opened record was just saved. Local edits, saved changes and live publication remain distinct.
- **Land on the right field:** mode-copy search results open the matching Website page. Embedded player previews leave focus in the editor when they mount or update; normal player navigation still focuses its destination.

## Screens and verification

Browser results and screenshots are collected from fresh local fixtures by `e2e/admin-guidance.spec.js`. Each captured view checks for horizontal overflow and Axe accessibility violations. The native-zoom case uses Chromium’s real 200% browser zoom, not a smaller viewport or a CSS scale.

The four new browser journeys pass: card editing through release review, Website selection, phone save/preview guidance, and native 200% zoom. All recorded accessibility checks report zero violations and no horizontal page overflow. Subsequent targeted checks cover the search-focus and shared-build repairs below.

| Visual cue | Screenshot |
| --- | --- |
| Next editor section | [Card next step](card-next.png) |
| Clear save action | [Record save guidance](card-save.png) |
| Next release requirement | [Release review](release-next.png) |
| Selected real Website element | [Website selection](website-selection.png) |
| Phone guidance and focused preview | [Next step](phone-next.png), [Preview](phone-preview.png) |
| Native browser zoom | [Measurements](native-zoom/native-zoom.json), [Release at 200%](native-zoom/review-native-200-percent.png) |

The full client run passed 133 suites / 1,080 tests. The subsequent preview-focus repair passed 66 player-menu, direct-navigation and Website tests, including a new editor-focus regression. Twenty-seven focused server checks passed, covering private workshop data, lightweight Home reads, registered Website surfaces, publication, rollback and the shared player-layout contract. The layout contract test now resolves its authoritative JSON import when loading the actual client module through Node's data-URL harness.

Five retained browser safeguards pass: failed saves and two-operator conflict reconciliation; keep/discard/save-and-continue; private account-scoped preferences; validation-field repair; and exact-draft engine qualification. The engine case follows the new highlighted testing action. The compact Home request/route check also passes. Eight older browser journeys also pass across the targeted runs: authored support on phone; encounter editing/testing; artwork selection and release comparison; mobile navigation; prose search through publication/rollback; card/set creation through engine testing and rollback; Gold product purchase/retirement/refund; and Para definitions, simulation, publication and restore. The final five-case rerun passes on the final rebuilt client. There are 18 distinct passing browser cases in [verification-results.json](verification-results.json).

The first browser pass found a nested complementary landmark, duplicate mechanic landmarks, and decorative CSS glyphs affecting accessible button names. These were corrected in the product. The section assertion was also updated to support both responsive tab/dropdown layouts. The four-case guidance run is clean. Older browser assertions were updated for the consolidated screens, archive acknowledgement and the actual Website/Para previews; search exposed and now covers the real focus defect. Earlier failed runs are not presented as passing.

## Scope and performance

Guidance is delivered with the existing private authoring projection. The registered Website surface list is projected from the authoritative server definitions, avoiding a duplicate browser copy of unused default prose. Retired planning-task preferences and unused list-navigation props are removed. The shared player presentation chunk also owns its brand and layout-preference helpers, avoiding duplicate copies in the Website preview. The existing opt-in player-customization default is explicit at compilation so disabled dependencies can be removed before chunking; an explicit enabled setting still takes precedence, verified by four toolchain checks.

Home still avoids loading editor projections, and the player does not import Admin controls. Every existing bundle ceiling is unchanged. The final production build passes: main 183,564 / 184,320; player 777,677 / 779,264; all Admin 76,435 / 76,800 gzip bytes. [bundle.json](bundle.json) records every category.

These changes run only in local isolated fixtures. No production publication, merge or deployment is part of this refinement. See the [earlier full redesign evidence](../admin-correction/README.md) for the twelve activity comparisons and five complete publication/rollback journeys. Its two documented baseline server reward-test failures remain outside this change.
