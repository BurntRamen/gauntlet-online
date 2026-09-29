# Jali ranked draft rules

Jali is playable in two-player faction duels, practice, ranked BO1, and ranked
BO3. Jali uses a complete standard 52-card deck, so a player never needs
constructed replacements to queue. Basho is the first released Jali General
and is selected for the player's whole side of the table.

The implementation follows the shared Gauntlet draft:

- **Bested:** an attacker is bested when blockers prevent all of its damage. A
  blocker is bested when the attack deals damage through the block. Paying or
  placing a card does not best it.
- **Watane:** whenever one of your cards is bested, create a persistent
  Revenant. During your priority, destroy a Revenant to give one card in your
  hand or face-down lanes +2 value until end of turn. Multiple Revenants may be
  spent on the same card.
- **Basho:** once per turn during your priority, if you control one unrevealed
  face-down card in every lane, reveal all three and create a Revenant. Those
  cards remain in their lanes and are visible to the opponent and spectators.
- **Katana, Floating City:** after you create a Revenant that turn, you may
  prepare each controlled card with printed value 8 or less once. A prepared
  card gets +2 value until end of turn. This does not reduce its payment cost.

Revenant totals, revealed formations, chosen bonuses, ownership checks, and
once-per-turn limits are enforced by the shared deterministic rules package.
Legacies factions are excluded from the separate free-for-all compatibility
engine until that engine supports their resource actions.
