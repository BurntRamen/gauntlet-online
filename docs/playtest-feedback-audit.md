# Playtest feedback audit

This audit records the actionable findings from the October 2026 shared playtest feedback. It separates fixes that are safe to ship from economy, voice, and content changes that need an explicit product decision.

## Stability fixes included in this change

### End-placement deadlock

The shared duel engine always opened an end-placement decision for both players in all three lanes, even when the active player had no legal card to place. A player with an empty hand, an occupied lane, or only support cards while the support contract was active could therefore be left waiting on a decision that had no useful choice. This affected every faction and was especially easy to encounter in Indela games after cards had been spent on spell and tax interactions.

The engine now checks the same legal-placement predicate used by `getLegalActions`. When no legal placement exists, the authoritative game state records an automatic `lanePlacement.skipped` event and advances. It handles one blocked player, both blocked players, and all three lanes without requiring a client command. Because this happens in the shared server-owned rules engine, single-player, multiplayer, Training AI, and campaign opponents receive the same result.

### Faction artwork identity

The visual identity normalizer omitted Gracus, Indela, Zynarth, and Astral Vanguard. Those playable factions could resolve to the neutral Basic Gauntlet presentation on selection, deck, and match-history surfaces even though faction art existed.

All ten playable faction IDs are now recognized. Gracus and Indela also have explicit emblem entries, while Zynarth and Astral Vanguard use their existing faction artwork.

## Indela investigation

The focused Indela rules suites pass. Constructed card effects, spell interactions, the Mandala loop guard, and campaign opponent execution did not expose an Indela-only infinite loop. The reproducible systemic risk was the end-placement decision described above: depleted or constrained hands could stop the match at the phase boundary. The new regression cases cover empty hands, occupied lanes, one-sided availability, and a complete automatic transition into the next turn.

If a freeze is reported after this fix, capture the room code, mode, turn, phase, and most recent visible action. Those fields will distinguish a network recovery failure from a new card-specific loop.

## Reward economy review

No reward values are changed in this patch.

Current legacy rewards are:

- 250 gold for completing two games, 500 gold for one win, and 500 gold for completing a faction game, for a maximum of 1,250 daily quest gold.
- One gameplay pack costs 1,000 gold or 200 Timetwisters where legacy currency purchases remain enabled.
- A campaign chapter grants one pack credit on its first clear only. The completed chapter ID prevents repeat farming.
- Scheduled events use explicit configurable tiers, currently awarding one to six pack credits at milestones.

Gameplay boosters currently permit duplicate cards and increment entitlement counts; there is no pack-level duplicate protection. Purchased collector packs similarly permit duplicate variants. The newer finite gold ledger prevents duplicate evidence claims and enforces an account-season award budget, but it does not change booster contents.

Granting two packs for every eligible win would be worth 2,000 legacy gold per win and would bypass the 1,250-gold daily ceiling through repeatable play. A safer option is two pack credits for a first clear of a campaign finale or another capped milestone, while ordinary chapter first clears remain at one. The amount should become an explicit reward field rather than another hard-coded increment before such a change ships.

## Artwork inventory

- All 144 gameplay cards have dedicated art, and all 288 collector variants resolve to an art asset.
- Every declared campaign image path resolves; the match presentation audit reports no cutover blockers or checksum mismatches.
- Rumin and Bizi each reference 13 campaign images. Astral Vanguard references 13.
- Mekan, Jali, Gracus, Indela, Voltari, and Zynarth currently rely on a single campaign cover or emblem reference each.
- Sheen, Frumo, and XenDra have no explicit per-chapter campaign image references, so their campaign presentation depends on shared fallback art.

The sparse campaigns need authored homeworld, travel, Reath-arrival, and climax scenes. Existing unrelated faction art should not be silently substituted. The identity fix in this patch only connects each playable faction to art that already belongs to it.

## Dialogue and voice review

The campaign text preserves the established high-level identities: Rumin are militaristic Roman-inspired reptilians; Sheen are defensive, philosophical treants; Frumo are revolutionary merfolk; Bizi are Byzantine automata shaped by invention and political intrigue; and Indela are mystical beetle scholars and spellcasters. Later editing should continue to distinguish each faction's homeworld story from its arrival on Reath.

Voice coverage in the current manifest is uneven:

| Campaign | Voiced dialogue | Finding |
| --- | ---: | --- |
| Rumin | 127 / 127 | Complete; preserve current mappings. |
| Sheen | 119 / 120 | One closing line lacks an audio asset. |
| Frumo | 120 / 120 | Complete; preserve current mappings. |
| Bizi | 169 / 169 | Complete and the most extensive script. |
| XenDra | 24 / 24 | Complete; review performance for the requested abstract, resonant character before regenerating. |
| Astral Vanguard | 0 / 144 | Scripted but not voiced. |
| Mekan, Jali, Gracus, Indela, Voltari, Zynarth | 0 / 120 each | Scripted but not voiced. |

Faction-selection and interaction voice manifests are present for all ten playable factions, including leader/general interactions. The current ElevenLabs mappings and generated files pass their manifest tests. Any rewritten campaign line needs a separate regeneration list so working audio is not replaced accidentally.

## Pet Gauntlet

The accessible shared transcript did not include a concrete Pet Gauntlet behavior, screen, progression rule, or acceptance criterion. No pet system was invented in this patch. The feature can be scoped once its intended role and reference material are available.

## Verification

- Full server suite: 427 passing, including every configured campaign encounter.
- Focused client faction-visual suite: 2 passing.
- ElevenLabs asset, campaign voice, and interaction manifests: 20 passing.
- Syntax and whitespace checks pass.
