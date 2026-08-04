# Faction ability intent and parity contract

This contract interprets the player-facing rules text in `server/gameContent.js`
as the design authority. Legacy server behavior is evidence, not permission to
silently change optional choices into automatic effects or to narrow a target.

## Core faction abilities

| Ability | Canonical behavior | Required player choice | Privacy |
| --- | --- | --- | --- |
| Kaiser | The fourth attack each turn gets +3 value. | None; deterministic trigger. | Public. |
| Meerus | After the second attack, the third attack may be free if its printed value is 3 or less. | Whether to use the free attack when eligible. | Public once declared. |
| Rumie | The first two post-opening attacks that match the previous attack's suit get +1. | None. | Public. |
| Emperor Nu | Every blocker gets +1; blockers in the third or later block get +2 instead. | None. | Public when blockers commit. |
| Tang | The second block each turn gains 2 life. | None. | Public. |
| Beli | After the second block, the next printed-value-10-or-greater attack gets +2. | None once a legal qualifying attack commits. | Public. |
| Polea: place | Put one hand card into an empty lane. | Hand card and empty lane. | The card remains hidden. |
| Polea: move/switch | Move one controlled lane card to an empty lane, or exchange two controlled lane cards. This is the operational meaning of “switch the lanes of up to 2 cards.” | Two lane positions, with at least one occupied. | Card fronts remain hidden. |
| Polea: inspect | Look at one face-down lane card controlled by either player. | Owner and lane. | Only the Polea player receives the card identity. Spectators, opponents, logs, and generic animation events do not. |
| Polea: +1 | Give one controlled lane card or active attacker +1 until end of turn. | Controlled card. | Public modifier after commitment. |
| Lafayette | Exchange one hand card with one controlled lane card once per turn. | Hand card and occupied lane. | Both cards remain hidden from the opponent. |
| Ristus | The first attack or blocking card each turn whose value is consecutive with the previously played card gets +2. | None. | Public when the card commits. |
| Focus | Overpaying a card by at least 2 gains one acceleration counter. Once per turn, one counter may give a controlled lane card or active attacker +1 until end of turn. | Whether to spend and which controlled card. | Counter total and committed buff are public. |
| Hera | Once per turn, a payment card matching a suit already played that turn may provide +2 additional payment value. | Explicit opt-in and matching payment card. | Public after payment commits. |
| Constanti | The first two post-opening attacks whose suit differs from the previous attack get +1. | None. | Public. |

An accepted activated ability resets both pass markers, leaves priority with its
controller, and allows the opponent another response before combat or the
priority round can close.

“Played card” includes committed attackers and blockers. Face-down end
placement and Polea placement use “put/place” wording and do not trigger
Ristus or establish a Hera suit.

## Corrections from provisional behavior

- Polea no longer requires exactly two occupied lanes.
- Polea inspection is no longer opponent-only in the local interaction layer.
- Polea and Focus can target an active attacker during combat priority.
- Hera is not silently auto-spent; it is an explicit payment modifier with a
  visible +2 preview.
- Blocking cards now establish played suit/value and can receive the first
  Ristus consecutive-value bonus.
- Activated abilities reset stale pass markers.
- Legal-action payment requirements include deterministic faction reductions
  instead of always reporting printed value.

## Constructed-card semantic choices

The following constructed effects are represented as explicit shared-rule
choices:

- Forum Ledger Runner payment +1.
- Jewel-Bank Contract payment conversion.
- optional Rumin weapon arming, including choosing individual weapons;
- Deckhand Diver private top-card inspection;
- The Last Gamble attack-versus-block choice;
- Gearplate Shield and Heat-Sink Matrix acceleration spending;
- Sandstorm Processor attack bonus;
- Focus Prime Signal bonus amount;
- Voltaric Ultimatum acceleration spending;
- Constanti Sunforge spending zero through three counters.

Legacy automatic maximum spending is not canonical for effects that say “may”
or “up to.” The shared simulator now supplies legal-action metadata, explicit
command fields, deterministic rejection, and no-choice paths that preserve
resources. See `CONSTRUCTED_ABILITY_INTENT.md` for the complete contract and the
remaining live compatibility boundary.
