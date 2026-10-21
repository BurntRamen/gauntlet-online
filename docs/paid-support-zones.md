# Paid Non-Servitor Support Zones — Case review

Implementation branch: `codex/paid-support-zones-v12`, based on public main `aa00d80` (PR #76). The original dirty checkout on `codex/para-league-economy` was left in place. Its nonignored files were also captured in snapshot commit `916a146082f46cc2aabf426c3cffdcf9a49f1a98`, retained by `codex/paid-support-zones`. Do not merge that preservation snapshot into this feature.

The user subsequently authorized merge and live deployment. [Release PR #79](https://github.com/BurntRamen/gauntlet-online/pull/79) tracks current CI and deployment status. The initial local qualification below is not itself deployment evidence. Release review also preserves legacy log wording, adds the paid-support Field Rulebook explanation, and uses readable card-inspection instructions.

## Rule specification

- Exactly three lanes per player. Existing `lane.facedown[player]` is the Commitment Zone; existing `lane.support[player]` is the Support Zone. No parallel board state was introduced.
- In new `gauntlet-duel-v12` faction duels, a player with open priority can play a registered non-Servitor from their hand into an empty own Support Zone. The current catalog contains no printed permission to play support during pending combat. Revealing an already placed Ambush is a separate existing trigger.
- `playSupport` requires an authenticated player, stable `commandId`, expected `baseRevision`, `cardId`, integer `laneIndex` 0–2, and explicit `paymentCardIds`. Stale revisions, conflicting IDs, foreign cards, duplicated payments, self-payment, unsupported definitions, illegal choices, occupied zones and insufficient payment reject without changing the game.
- Cost uses the printed card value and existing applicable payment adjustments. Existing pitch effects and faction payment modifiers apply; non-Servitors in hand remain payment cards. A temporary value bonus does not change printed cost. Attack-only discounts do not become support discounts.
- Resolution order: validate all choices and payment, discard payment, apply payment triggers using supports already present, enter the Support Zone, resolve printed on-entry instructions once, retain the card or discard it if its definition requires consumption. The command is atomic; presentation reconstructs the entry beat before the discard beat.
- Successful paid play resets pass flags and retains priority. One-shot resolution frees the zone for another paid play; ongoing support cannot be replaced. No support attack or block is introduced. Existing explicit Arm equipment choices remain available.
- Deep Dive's private inspection is optional. Declining keeps the Ambush concealed; accepting reveals and discards it after inspection. Coordinated Strike reveals, readies its bonus and discards. Interference Matrix remains in the zone; its next-card choice expires on that next card even when declined, and its bonus is bounded by current acceleration counters.
- Ongoing supports survive triggers. Per-card state records contract version, entry revision/turn, duration, charges, exit condition and entry permission. Once/second/first-two triggers use their printed limits. Assembly Station's printed “may” payment enhancement is an explicit choice. Different Frumo next-attack/block bonuses are kept separately so one does not overwrite another.
- Ordinary end-turn placement is now commitment-only. The existing commitment restrictions, combat sequence, one-card block limit, pass/pass handling, draw-to-eight and victory checks are unchanged.
- Polea's printed “put a card … into an empty lane” is the explicit free exception, recorded as `permission: "polea-put-empty-lane"`. Both own zones must be empty. It is a put, not a paid play; on-entry instructions still resolve once. Its support entry does not gain a combat response window. Deep Dive's choice is available through Polea. Lafayette remains a commitment-card exchange; deployment/hatching does not acquire a free-support permission.

## End-to-end example

At revision 0, Player 1 has open priority, Coordinated Strike (printed 7), payment cards worth 2 and 5, and an empty Support Zone in Lane 1:

```json
{
  "commandId": "support-example-001",
  "baseRevision": 0,
  "actorPlayerId": 1,
  "rulesVersion": "gauntlet-duel-v12",
  "command": {
    "type": "playSupport",
    "cardId": "strike-instance",
    "laneIndex": 0,
    "paymentCardIds": ["two-instance", "five-instance"]
  }
}
```

The engine discards 2+5, emits `payment.discarded`, then `card.supportPlaced`, readies +1 for the next attack or block, and emits `support.discarded`. Revision becomes 1, Lane 1's Support Zone is empty again, and Player 1 retains priority. The UI shows the card entering before leaving. A second instant can use that lane. Retrying the same envelope cannot charge again or duplicate evidence, including after room recovery; using only the 2 rejects with no state change.

## Compatibility and boundaries

New faction, constructed, draft, faction practice/training, and campaign player duels share v12 support rules. Campaign action limits still apply. Basic and free-for-all cannot play support; their combat rules are unchanged. The initial release left automated strategy unchanged; the training follow-up below adds paid support decisions without altering scripted campaign choices.

### Training opponent follow-up

The follow-up starts from main `046f3be` on `codex/support-zones-followup` and incorporates main `7b4fce1` after PR #80 merged during release qualification. Ordinary v12 faction training and private Admin playtests can now choose paid support through the same authoritative command envelope used by players. Selection is deterministic and does not mutate the current match or consult an opponent's concealed hand/deck.

The policy uses registered support contracts and the shared payment preview. It keeps payment-only cards available for payment, reserves a combat card when setting up lanes, respects occupied slots, and only prepares Coordinated Strike when a paid follow-up attack remains possible. Deep Dive's optional peek is explicitly chosen when the deck is nonempty. Armament, Assembly Station, Vital Grove and Interference Matrix combat choices use the existing legal-action options. Supports still cannot become independent attackers or blockers.

Hand blockers come from the engine's legal source entities, fixing a rejected-command loop when the cheapest hand card was a non-Servitor. Payment selection includes printed payment effects and Indela adjustments. It examines single cards and ascending payment prefixes rather than an exponential search; it is a bounded training policy, not an optimal opponent.

Campaign bosses retain their authored attacks and action budget. Legacy paid-support eligibility and free end placement are unchanged. This changes automated decision-making, not the rules, printed balance, snapshots, or replay contracts; the duel rules version remains v12.

Support inspection and preview also omit the combat-value readout for non-combat cards; their printed value and support instructions remain visible. The phone screenshot exposed this contradictory label, and a component regression covers both surfaces.

Release qualification also updates `e2e/slot-workshop.spec.js` to assert the exact current set of 14 constructible factions after main added the four Frontier factions; the former hardcoded count of 10 was obsolete. This adds no factions or gameplay permissions.

`e2e/admin.spec.js` preserves main's stable-ID search for the portrait owner because current content also has a same-named character. The test cleans up its isolated draft in `finally` to prevent cascading failures. The reconciliation retains main's modular authoring, bounded captured mechanics, support-recovery presentation, build toolchain, and expanded release checks. An added AI regression pays for a captured authored support and proves its draw resolves once, while selection remains side-effect free.

Follow-up files: `server/paidSupportAi.js`, `server/index.js`, `server/test/paid-support-ai.test.js`, `client/src/babylon/cardDetails.js`, `client/src/babylon/ProductionMatchExperience.jsx`, `client/src/babylon/ProductionMatchExperience.test.js`, `e2e/paid-support-server.js`, `e2e/paid-support.spec.js`, `docs/paid-support-test-results.md`, and this review packet. Case should run the new AI tests alongside `server/test/automated-opponents.test.js`, then `npm run test:e2e:support`; the added phone-browser case passes priority to the training opponent and verifies paid Hospital placement and public slot inspection.

Existing matches retain their stored rules version, including v11 free end-turn support behavior. Unversioned recovered duels explicitly use the pre-change v11 compatibility behavior, never v12. Snapshots without a support map receive empty projection defaults without being repriced or upgraded. Historical replay remains snapshot-driven under its recorded version. Snapshot schema 2 and command/event schema 1 remain compatible additive contracts. New support metadata uses `gauntlet.support.v1`; completed match records now retain the duel's actual rules version.

Concealed Ambush identity is removed from opponent/spectator projections, public entry events and replay. Derived previous-card values, played suits and concealed support cost calculations remain owner-only; discarded payment cards and their paid total remain public. Public supports are visible to spectators. Private peek results and command receipts are not exposed. Localhost browser fixtures use temporary file stores and are never loaded by production.

## Supported authoring scope

Admin authoring and previews expose derived support cost, timing, on-play instruction, ongoing/activated effect text, duration, charges and discard condition. Existing effect selectors/parameters remain the editing boundary; unsupported effect/category/faction combinations are rejected. Support timing is not an arbitrary script editor. Printed card text, values and balance parameters were not edited.

Payment-only Think, Voltage Ration and Signal Relay gain no invented on-zone effect. Playing them into a zone is legal but has no printed benefit there; their payment benefit applies while in hand. No new combat response timing or generic removal mechanic is invented. Existing Arm semantics remain combat-duration equipment consumption. Future mechanics require a registered handler, contract, tests and version decision.

## Validation

Final commands and results are recorded in `paid-support-test-results.md`. The regression set covers paid play, atomic rejection, ID/revision handling, ongoing and one-shot effects, optional choices, repeated instants, concealed information, Polea, end-turn exclusion, replay, durable room recovery and legacy snapshots. Browser cases exercise desktop Babylon, phone Babylon and the React fallback with keyboard actions, insufficient payment, ordered entry/discard beats, reconnect/recovery, viewport overflow and axe checks.

## Changed file manifest

| Area | Files |
| --- | --- |
| Authoritative rules and contracts | `shared/duel-rules/index.js`, `supportContract.js`, `contentContracts.d.ts`, `effects.js` |
| Server authority, records, Admin preview | `server/index.js`, `server/matchRecords.js`, `server/adminPreview.js` |
| History and public projection | `shared/match-history/evidence.js`, `formatLog.js`, `replay.js` |
| Match entry and accessible fallback | `client/src/App.js`, `client/src/babylon/AccessibleMatchControls.jsx`, `RecoverableMatchCanvas.jsx`, `ProductionMatchExperience.jsx` |
| UI actions, models and inspection | `client/src/babylon/matchAdapters.js`, `matchViewModel.js`, `cardDetails.js` |
| Presentation ordering | `client/src/babylon/battlefieldPlayback.js`, `presentationCadence.js`, `presentationTransitionPlanner.js` |
| Admin authoring | `client/src/admin/CardWorkshop.js`, `SupportContractSummary.js` |
| Engine/authority tests | `server/test/paid-support.test.js`, `paid-support-authority.test.js`, `deployment-diagnostics.test.js` |
| Client tests | `client/src/babylon/paidSupport.test.jsx`, `basicGauntletRules.test.js`, `matchAdapters.test.js` |
| Historical equivalence | `scripts/content-equivalence-scenarios.js` (explicit v11 pin; golden fixture unchanged) |
| Browser tests and runner | `e2e/paid-support-server.js`, `e2e/paid-support.spec.js`, `e2e/babylon-live.spec.js`, `playwright.support.config.js`, `package.json` |
| Release checks | `.github/workflows/pull-request.yml` (runs paid-support browser coverage) |
| Bundle budget | `scripts/check-build-budgets.js`, `scripts/check-build-budgets.test.js` (explicit +5 KiB player / +1 KiB Admin allocation for this feature; every chunk remains counted) |
| Review evidence | `docs/paid-support-zones.md`, `docs/paid-support-test-results.md` |

## Case's review steps

1. Review PR #85 against main `7b4fce1`; its first candidate was qualified against `046f3be` before PR #80 merged. The initial feature in PR #79 was based on `aa00d80`; leave the original dirty checkout and preservation branch alone.
2. Run `npm ci`, `npm --prefix server ci`, `npm --prefix client ci`, then `npm run test:server` and the client command in the results file. Run `npx playwright install chromium` once, then `npm run test:e2e:support`.
3. Review the generated `playwright-report/support/index.html` and `test-results/support-*.png`. Check that payment is required, entry precedes discard, persistent supports occupy their zones, and the phone/fallback controls remain usable.
4. Inspect `supportContract.js` beside printed card text; pay particular attention to Deep Dive, Coordinated Strike, Interference Matrix, ongoing shelters, Arm equipment and Polea's auditable exception.
5. Review v11 golden-equivalence results and the authority/recovery test. Follow PR #79 for release checks and verify the deployed Vercel client plus Render commit/rules headers before treating a merge as live.
