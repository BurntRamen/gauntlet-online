# Constructed card functionality and balance audit

Audit date: 2026-09-29  
Content version: `gauntlet-content-v7`  
Rules version: `gauntlet-duel-v8`

## Functionality

- All 72 Initiative constructed cards have stable identities in server-authored decks.
- Every card is referenced by an explicit deterministic rules or interaction test.
- The authoritative registry rejects a card whose type does not match its faction's signature type.
- The production interaction tests cover selectable Armaments and constructed optional effects.
- The complete server and client suites pass after this audit.

The audit found two unreachable effects left over from the former multi-block rules. Harmony Lab and Floral Canopy required two or more blockers, while the current rules allow exactly one blocker. Both now trigger on the second or later block in a turn. Meditation Retreat was also reduced from 2 life plus a delayed draw to 1 life plus a delayed draw because it stacks with Tang's built-in 2-life second-block reward.

## Deterministic balance simulation

Run with:

```text
npm run audit:constructed-balance
```

The extended audit used 50 seeds for every ordered non-mirror matchup among Rumin, Sheen, Frumo, and Bizi: 600 completed matches total. Deck variants rotate cards when a value has more than four possible replacements, so every published card enters the sample while preserving the four-suits-per-value deck limit.

| Faction | Wins | Losses | Win rate |
|---|---:|---:|---:|
| Rumin | 132 | 168 | 44% |
| Sheen | 132 | 168 | 44% |
| Frumo | 168 | 132 | 56% |
| Bizi | 168 | 132 | 56% |

Average match length was 3.04 turns and 51.43 commands. Every simulated match reached a rules-defined winner within the command limit. The twelve-point total spread is acceptable for this initial deterministic check and did not justify another immediate card adjustment.

## Interpretation

This simulation is a regression and outlier detector, not a substitute for human competitive play. Its deterministic agent uses legal attacks, blocks, payments, Armaments, and constructed choices, but it does not model bluffing, long-term lane planning, or expert sequencing. Ranked telemetry and human matchup sessions should determine later tuning, especially Rumin fourth-attack turns and Bizi acceleration timing.
