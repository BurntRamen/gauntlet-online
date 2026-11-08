# Modular effect programs

The reusable unit is an existing saved mechanic, not a new script language. A mechanic still has its immutable interpreter version and validated abilities: trigger → conditions → optional costs/choice → ordered effects → duration and usage limits. A card program references up to four distinct mechanics, with at most six total abilities including any embedded arming composition. Resolved generated behavior must fit the existing 2,000-character wording boundary.

```json
{
  "id": "mechanic-program",
  "version": 1,
  "mechanics": [
    { "id": "authored-mechanic", "version": 2, "mechanicId": "mechanic-<uuid>" }
  ],
  "armament": null
}
```

The editor sends references only. `server/mechanicAuthoring.js` resolves them from the saved Studio catalog, verifies interpreter/card-type compatibility, and captures each complete definition and SHA-256 revision. Supplied runtime definitions, unknown primitives, nested programs, duplicate references and excessive programs are rejected. The published content binding declares `gauntlet.mechanic-program.v1`; runtimes reject unknown program versions.

`shared/duel-rules/mechanicRuntime.js` executes the existing v1/v2 primitives. For one trigger, it fixes eligibility across all modules before executing any effects, then visits modules and their abilities in order. Reordering Draw and Mill therefore changes the actual card drawn. Effects do not recursively dispatch new triggers. Existing v2 choices retain their queue, controller ownership, private information, payment rules and captured source definition.

The physical card identity remains shared across modules. Ability usage keys include physical card ID, mechanic ID and ability index; mechanic counters retain their established shared-mechanic scope. Manual actions have distinct module identities. Consuming a support discards its complete physical card, never a synthetic single-module copy. Payment reductions combine before normal payment selection, and rejected commands commit neither state nor usage. Command revisions continue to reject stale retries.

Rumin arming remains the existing `composed-rumin-armament` contract. It requires its normal eligible hand attack, payment and attachment lifecycle; the complete physical source is discarded once after combat. The program adapter does not grant extra arming, new timing windows or additional charges. Existing single-mechanic and card-specific effect records keep their original semantics until explicitly replaced in the editor.

## Language and capabilities

The operator glossary uses `server/cardWording.js` definitions. `shared/duel-rules/mechanicVocabulary.js` relates the supported primitives to Heal (life gain), Ward (current-combat damage prevention), Charge (acceleration) and Overpay; Arm describes the existing arming contract. Primitive IDs and their old meanings remain unchanged. Signed acceleration adjustments still use their explicit amount and adjustment behavior; the glossary does not add a new resource.

Existing operations include attack/block modifiers, prevention, life, damage, draw, mill, recovery, discard, mechanic/acceleration counters, turn modifiers, lane movement, support removal and payment reduction. Each retains its legal trigger, target, amount, duration and decision constraints. Peek, Swap, arbitrary code, new victory conditions and new timing families are not implied by their presence elsewhere in printed wording. They need qualified engine contracts before becoming authorable primitives.

FFA retains its existing mode qualification: supported automatic v2 Servitor combat modules target the declared opponent. Optional decisions and other unsupported FFA combinations stay gated. Duel playtests and publication continue to require the appropriate exact saved content evidence.

## Change and recovery

Relationships, mechanic consumers and pipeline links account for every referenced module. A shared definition edit invalidates stale evidence and changes all its consumers in the candidate release. The existing single atomic record save and revision conflict response remain authoritative. Publication captures definitions for new games; active games, replay, rollback and audit history retain their release identity.

To add a new primitive, extend a versioned shared contract and its runtime, legal-action/preview behavior, mode qualification, explanation and tests together. Do not reinterpret an already published primitive or treat display wording as code. Keep amounts, choices and execution finite; use the existing release validation and content-binding checks. No job platform, database schema, migration or deployment dependency is introduced.
