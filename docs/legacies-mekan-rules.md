# Mekan ranked draft rules

Mekan is playable in two-player faction duels, including ranked BO1 and BO3.
Choose a faction and exactly one General before queuing; confirm the match in
the lobby after an opponent is found. The same General carries across a series.
Saved standard 52-card decks can have zero constructed replacements and retain
their General choice. Mekan is not enabled in the separate free-for-all engine.

This implementation adapts the author's near-final draft to Gauntlet's existing
priority windows and single-General system. The original overview remains in
`legacies-mekan-overview.txt`; live card descriptions are authoritative for this
release. There are no lane-assigned Generals.

- **Encore:** during your priority, once per turn, optionally mark one of your
  cards paid this turn as a Guest. Guests stay marked in your discard pile.
- **Celebrate:** the first attack or block each turn sharing a suit or printed
  value with a Guest gets +1. It does not reduce payment costs.
- **San Mikal:** once per turn, optionally remember a card defeated this turn
  as a Guest. An attacker is defeated when blocked for all its value; a blocker
  is defeated when the attack exceeds the total block value. Merely paying a
  card or resolving an unblocked attack is not defeat.
- **The Guests Return:** optionally invite a particular Guest during your
  priority. Your next attack or block this turn with the same printed value
  removes that Guest from the game and receives +1. You can change or cancel the
  invitation before playing; unmatched invitations expire at turn end. Both
  Celebrate and the City can reward the same play.
- **Acama:** once per turn, while you control a face-down lane card, privately
  inspect your top deck card during your priority; keep it or bottom it. This
  uses an open priority window instead of interrupting end-of-turn placement.
- **Hui:** the first attack or block each turn sharing a suit with a card already
  in your discard pile gets +1. That play's own payment is excluded.
- **Monti:** after paying at least two cards this turn, once per turn give a
  chosen hand or face-down lane card +1 until turn end.
- **Ahu:** after winning a blocked combat this turn, once per turn privately
  inspect the top two deck cards, keep either on top and bottom the other.
  With one card left, keep or bottom it. The original Guest-discard rider is
  omitted: Gauntlet Guests are already in discard and cannot be paid again.
- **Temo:** your first defeated card each turn gives your next attack or block
  that turn +1. The readiness expires at turn end.

Optional effects are explicit faction-action buttons, not automatic Guest
consumption. Costs, eligibility, ownership, once-per-turn limits, and hidden
deck information are enforced on the server and deterministic replay rules.
Mekan uses a dedicated faction emblem and the neutral playing-card face art.
