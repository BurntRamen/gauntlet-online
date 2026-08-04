# Constructed ability intent and semantic-command contract

The printed card text in `server/gameContent.js` is the design authority.
Legacy automatic behavior is not authoritative when the text says `may`,
`choose`, or `up to`.

## Identity invariant

Every constructed card has two identities:

- `id`: a stable match-instance ID used for commands, selection, animation,
  discard, replay, and idempotency.
- `definitionId`: the catalog ID used to identify the printed card and its
  rules.

The server previously replaced the catalog ID with a generated match ID and
then compared that match ID to catalog IDs. Many constructed effects therefore
could not trigger. Deck construction now preserves `definitionId`, and both
shared and server effect lookup use it.

## Explicit choices

| Effect | Semantic command field | Canonical no-choice behavior |
| --- | --- | --- |
| Forum Ledger Runner | `forumLedgerPaymentCardId` | No payment bonus; the card is not silently selected. |
| Jewel-Bank Contract | `useJewelBankBonus` | The readied effect remains available until used or the turn ends. Exactly one payment card is required when used. |
| Rumin lane weapons | `armWeaponCardIds` | No weapon arms. Ordinary hand attacks may choose at most one; Rumie Market Colossus may choose any eligible subset. |
| Beli Awakened | `useBeliAwakenedBonus` | Its readied +3 remains unused. |
| Sandstorm Processor | `useSandstormProcessor` | It attacks at its unmodified value. |
| Constanti Sunforge | `sunforgeAccelerationToSpend` | Zero counters are spent. The accepted range is zero through three and cannot exceed the player's counters. |
| Voltaric Ultimatum | `useVoltaricUltimatum` | No counters are spent and no +5 is applied. |
| Focus Prime Signal | `primeSignalBonus` | Zero bonus is applied. The selected amount cannot exceed four or the readied amount. It does not spend counters because the printed text does not say to remove them. |
| Gearplate Shield / Heat-Sink Matrix | `accelerationBlockerCardIds` | No blocker spends acceleration. Each selected blocker spends one for +2. |
| Deckhand Diver | `useDeckhandDiverPeek` | Placement completes without revealing the top deck card. A chosen peek is private. |
| The Last Gamble | `lastGambleChoice` | No +4 action is readied. A choice must be `attack` or `block`. |

Selections are represented in legal-action metadata before they are accepted.
Rejected choices do not mutate counters, cards, pending effects, or revision.

## Deterministic effects

The shared duel rules now identify and resolve the existing automatic
constructed effects for:

- Rumin payment, overpay, weapon, fourth-attack, and support cards.
- Sheen blocker value, prevention, life, delayed draw, and follow-up effects.
- Frumo lane-entry, lane-swap, empty-lane, consecutive-value, payment, and
  support effects.
- Bizi payment, different-suit, acceleration, overpay, delayed draw, and
  support effects.

Temporary bonuses clear at turn transition. Extra end-turn draws occur after
draw-to-eight. Attached weapons discard with their attacker. Payment cards,
attackers, blockers, attachments, and lane cards remain separate committed
entities.

## Privacy

- Deckhand Diver and Polea inspection include the inspected card only in the
  controlling player's projected event.
- Opponents and spectators receive the event without the card.
- Face-down placement and lane-entry events remove card IDs and definition
  sources from unauthorized projections.
- Legal actions never expose an opponent's hidden `definitionId`.

## The Last Gamble interpretation

The printed text does not state an independent activation window. Until the
content wording is revised, the canonical duel implementation retains the
existing qualifying Polea/private-peek window but makes the attack-versus-block
choice explicit. It no longer automatically assigns +4 to whichever action
happens next.

## Live compatibility boundary

The production renderer and deterministic adapter use this semantic contract.
For supported two-player Basic and faction matches, legacy React attack,
block, placement, pass, concession, Polea, Lafayette, and Focus socket events
now translate their index-based payloads into stable card IDs and execute the
same semantic command engine. Optional constructed fields are forwarded when
present; an omitted optional field retains the canonical no-choice behavior.

Free-for-all and other explicitly deferred compatibility modes retain their
legacy rule bodies. The React fallback UI does not become a second rules
authority merely because it remains available during rollout.
