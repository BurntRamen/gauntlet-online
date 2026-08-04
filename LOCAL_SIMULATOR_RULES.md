# Local duel simulator

The Babylon Play mode uses the versioned deterministic package at
`shared/duel-rules`. The same package supplies live-server constants,
perspective projection, stable IDs, revisions, legal actions, structured
rejections, and the explicit Basic `duelCommand` socket path.

## Supported lifecycle

- Seeded 52-card deck creation, shuffle, initial eight-card deal, and draw to
  eight.
- Exactly three lanes and six ordered end-placement opportunities.
- Independent hand attacks and source-lane attacks.
- Multi-card hand blocking and same-lane face-down blocking.
- Separate attacker, blocker, and payment commitments.
- Priority transfer, pass-pass closure, damage, cleanup, life checks, draw,
  victory, draw, and concession.
- Basic immediate combat resolution.
- Two-player faction profiles for Rumin, Sheen, Frumo, and Bizi, including the
  shared deterministic passive counters and direct Polea, Lafayette, Focus, and
  acceleration commands represented in this package. Optional effects such as
  Meerus and Hera require an explicit player choice rather than being consumed
  automatically.
- Perspective-safe hot-seat handoff, deterministic reset, command history, and
  developer-only rewind.

Every accepted command increments `revision`, records `commandId`, and emits
stable event IDs. Commands with a stale `baseRevision` are rejected without
mutating the match.

## Authority and compatibility

The existing live server remains authoritative for rooms, authentication,
persistence, records, undo approval, and AI scheduling. The deterministic local
adapter now resolves constructed-card effects through the shared package.
Existing React faction Socket.IO commands remain compatibility wrappers until
they are translated into the same semantic choices.

The shared Basic semantic path is available as `duelCommand`; faction live play
continues to use the compatibility adapter until every constructed-card effect
has an exact shared/server parity test. This avoids changing live balance while
still allowing the same Babylon renderer to display and control explicitly
flagged faction duels.

See `BABYLON_RULES_AUDIT.md` for the detailed extraction map and remaining
constructed-card parity boundary. See `FACTION_ABILITY_INTENT.md` for the
player-facing ability semantics, privacy requirements, and optional constructed
choices. See `CONSTRUCTED_ABILITY_INTENT.md` for stable card identity and the
constructed command contract.
