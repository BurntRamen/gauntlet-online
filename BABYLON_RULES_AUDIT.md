# Babylon match renderer rules audit

This document fixes the authority boundary for the player-facing Babylon match
screen. It is not a second rulebook. Live two-player behavior remains defined by
the server until each transition is proven against the deterministic shared
package.

## Authority boundary

| Concern | Current live authority | Shared/local boundary | Required parity |
| --- | --- | --- | --- |
| Match creation, shuffle, opening deal | `createGameFromLobby` in `server/index.js` | `createMatch`, `createSeededRandom`, `createStandardDeck` | Same life, deck size, eight-card deal, lanes, and starting priority |
| Card value | `getBaseCardValue` plus current-value modifiers | `cardValue` | J=11, Q=12, K=13, A=14; temporary modifiers audited separately |
| Attack declaration | `confirmAttack` | `applyCommand`: `declareHandAttack`, `declareLaneAttack` | Priority, one unresolved attack, card ownership, payment, discard, target, and priority transfer |
| Attack payment | `getAttackPaymentRequirement`, `getPaymentTotal`, `consumePaymentBonuses` | `validatePayment` plus faction extension points | Committed attacker excluded; payment discarded once at acceptance |
| Hand attack storage | `game.handAttacks.push` | `game.handAttacks.push` with `sourceLane: null` | Never assign a hand attack to a lane |
| Lane attack storage | `game.lanes[lane].attack` | Same lane-local storage | Attack remains attached to its source lane |
| Hand blocking | `confirmBlock` with `blockCardIndexes` | `declareHandBlock` | One or more unique hand blockers; blockers cannot pay for themselves |
| Lane blocking | `confirmBlock` with `lane` | `declareLaneBlock` | Only the defender's face-down card in the attacked lane |
| Block payment | `getPaymentTotal` with block context | `validatePayment` | Requirement equals combined blocker value; payment discarded once |
| Declining a block | `confirmBlock` with no blocker | `declineBlock` | Only the active defender; Basic resolves immediately |
| Damage and cleanup | `resolveDamage`, `resolveCombatAndResumePriority` | `resolveAttack` | `max(0, attack-block)`; attacker/blockers to owner discard; defender receives priority |
| Priority pass | `passPriority` | `passPriority` | First pass transfers priority; pass-pass closes the round |
| Life check | `finishGameIfLifeCheckFails`, `applyGameOverState` | `checkVictory` | Check after the priority round, not in the middle of Basic combat |
| End placement | `startEndPhase`, `advanceEndPlacement`, `placeFacedown`, `skipEndPlacement` | Matching shared transitions | Six opportunities: starting-priority player then opponent in each of three lanes |
| Draw and next turn | `advanceEndPlacement` | `drawToEight`, `startNextTurn` | Draw to eight, reset turn state, rotate starting priority |
| Perspective projection | `sanitizeGameForViewer` | `projectForPerspective` | Opponent hands/decks and all unauthorized face-down cards remain hidden |
| Faction attack/passive bonuses | `calculateAttackBonuses`, `getAttackPaymentRequirement`, payment and post-declaration helpers | Shared deterministic Rumin, Sheen, Frumo, and Bizi profiles and counters | Standard-card paths covered; constructed-card hooks remain on the server |
| Polea | `usePolea` | `useFactionAbility`: `polea-place`, `polea-swap`, `polea-peek`, `polea-buff` | Place, lane swap, private peek, temporary +1, and once-per-turn behavior |
| Lafayette | `useLafayette` | `useFactionAbility`: `lafayette-swap` | Hand/lane swap and turn flag |
| Focus and Hera | `useFocusBuff`, `getPaymentTotal` | `focus-buff`, acceleration events, and optional Hera payment bonus | Standard faction path covered; constructed-card payment modifiers remain server-owned |
| Training AI | server scheduling functions | Never owned by Babylon | AI submits the same semantic server commands |
| Undo | server snapshot/approval workflow | Local developer rewind only | No production renderer-side undo |
| Reconnect | room lifecycle and sanitized state emission | Adapter hydration | Clear unconfirmed UI state and reconstruct the latest revision |

## Confirmed gameplay invariants

- Exactly three lanes exist.
- Only one attack may be unresolved.
- Hand attacks are independent combat objects and have no lane.
- Lane attacks remain in their source lane.
- Hand attacks may be blocked by multiple hand cards.
- Lane attacks may only be blocked by the defender's face-down card in that
  same lane.
- Attackers, blockers, and payment cards are distinct.
- Payment cards enter discard when the declaration is accepted.
- Basic combat resolves when the defender blocks or declines.
- Life totals are checked when the priority round closes.

## Versioned command boundary

The shared package now accepts both the compatibility command shape and:

```js
{
  commandId,
  baseRevision,
  actorPlayerId,
  command
}
```

Accepted commands increment the match revision and return stable animation-event
IDs. A stale `baseRevision` is rejected without mutating state. The live React
screen may continue using compatibility Socket.IO events while it is the default
renderer. Basic priority passing now enters the same semantic executor as
Babylon; remaining compatibility handlers must be translated by mode rather
than becoming a second rules authority.

## Current parity boundary

The Basic deterministic path has direct unit, full-match, and live semantic
socket coverage. The live server stamps sanitized snapshots with the same
schema/rules versions and rejects stale Basic semantic commands.

Standard two-player faction profiles and all 72 catalog constructed card IDs
are now mapped into shared local transitions and the same renderer. Optional
constructed effects use the explicit command fields documented in
`CONSTRUCTED_ABILITY_INTENT.md`; server-authored constructed card instances
preserve catalog `definitionId` while commands continue to use instance `id`.

Live Basic and faction rooms accept semantic `duelCommand` envelopes. Results
are idempotent by command ID plus actor/revision/payload fingerprint, and an
explicit resync can recover an acknowledgement after transport interruption.
React's index-based two-player attack, block, placement, pass, concession,
Polea, Lafayette, and Focus events are compatibility translators over that same
executor. Their separate legacy rule bodies remain reachable only for deferred
match modes such as free-for-all. The production Babylon adapter remains the
intended player-facing command boundary.
