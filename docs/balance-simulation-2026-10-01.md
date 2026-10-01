# Faction balance simulation — 2026-10-01

The deterministic rules simulator ran 10 games for every ordered faction matchup, so every pairing was tested with both seat orders.

## Standard 52-card decks

This matrix used faction leaders with ordinary playing cards and covered all ten playable factions: 900 games total.

| Faction | Win rate |
| --- | ---: |
| Indela | 66.1% |
| Bizi | 56.1% |
| Gracus | 53.3% |
| Frumo | 52.2% |
| Sheen | 48.3% |
| Rumin | 46.7% |
| Astral Vanguard | 46.1% |
| Jali | 45.0% |
| Zynarth | 43.3% |
| Mekan | 42.8% |

The first seat won 451 games and the second seat won 449, so this matrix did not show meaningful seat advantage. Indela is the clear automated-play outlier. Its default Ramar configuration can produce a two-point omen cost swing, and the deterministic attacker understands that passive advantage reliably.

## Faction-card decks

This matrix replaced all 18 available faction slots and covered the six factions with complete constructed catalogs: 300 games total.

| Faction | Win rate |
| --- | ---: |
| Bizi | 67.0% |
| Sheen | 51.0% |
| Frumo | 51.0% |
| Rumin | 50.0% |
| Astral Vanguard | 44.0% |
| Zynarth | 37.0% |

The faction-card matrix showed a second-seat skew of 167–133. Because each faction played the same number of games in each seat, the faction totals remain directly comparable, but individual matchup percentages should be read with that skew in mind. Bizi is the clear high outlier, while Zynarth is the low outlier for this agent.

## Interpretation

This is a screening test, not a substitute for player data. The deterministic agent uses attacks, blocks, payments, and supported automatic card choices consistently. It does not yet plan every manual faction ability, token engine, or multi-turn setup. That limitation particularly understates factions such as Mekan and Zynarth and makes passive cost engines such as Indela easier for the agent to exploit.

No live card or leader values were changed from this run alone. The strongest follow-up candidates are Ramar's stacked omen cost adjustment, Bizi's constructed engine, and better automated use of Zynarth's Eggs and Underlings. The full reproducible result, including ordered matchup records, is in `balance-simulation-2026-10-01.json`.
