# Babylon official match mode contract

The Babylon production experience owns active two-player matches only. React
continues to own lobbies, deck construction, draft selection, campaign maps,
progression, and other surrounding flows. Free-for-all remains on React.

## Normalized descriptor

Every local, fixture, and live adapter update includes a `descriptor` with four
orthogonal axes:

| Axis | Values | Authority |
| --- | --- | --- |
| Ruleset | `basic`, `factions` | Authoritative game snapshot |
| Deck format | `standard`, `constructed`, `draft`, `campaign` | Match/deck metadata and card definitions |
| Opponent | `human`, `trainingAi`, `campaignBoss` | Sanitized lobby and campaign metadata |
| Series | `single`, `bestOf3` plus game and score | Authoritative series state |

The renderer may change labels, identity trim, encounter context, and series
status from this descriptor. It must not branch rule validation or mutate game
state from it.

## Mode boundaries

| Match type | Commands and transitions | Renderer additions | Privacy |
| --- | --- | --- | --- |
| Basic | Shared semantic duel commands | Neutral Gauntlet identity | Ordinary player/spectator projection |
| Faction/constructed | Shared semantic commands and explicit optional effect choices | Faction identity and contextual ability controls | Private peeks projected only to their controller |
| Training AI | AI selects shared legal actions; shared engine applies commands | AI status and pacing only | Same player projection as a human duel |
| Campaign | Shared player commands plus server-authenticated system commands | Boss identity, encounter ability, and in-match dialogue | Boss scripts never expose player hidden cards |
| Draft-deck | Shared faction commands with deterministic deck configuration | Draft-card inspection and identity | Same as constructed |
| Best-of-three | Shared per-game rules; room service owns series continuation | Game number and score | New-game hydration clears stale local state |

## Adapter update contract

An adapter update carries the sanitized `snapshot`, monotonic `revision`,
recipient `legalActions`, stable `events`, normalized `descriptor`, connection
and control state, view model, semantic commands, privacy curtain state, and
structured diagnostics. `ProductionMatchExperience` does not import simulator,
fixture, lobby, room, or Socket.IO code.

The live route uses a renderer-neutral `LiveMatchSession`. React creates it from
the real room session and continues to own lobby routing and socket reconnect.
The session exposes the latest projected snapshot, connection state, explicit
resynchronization, and a renderer-handoff command freeze. Both Babylon and the
React fallback use that same session; neither recreates the room during a
renderer change.

## Command lifecycle

1. A server-authored legal action is selected at one gameplay revision.
2. The adapter creates a remount-safe command ID and submits the semantic
   command with rules and command-schema versions.
3. The renderer locks submission while the command is pending.
4. The server authenticates the socket seat, validates the revision and rules,
   and caches the result against actor, revision, and normalized payload.
5. The adapter records `pending`, `acknowledged`, `presented`, `rejected`, or
   `superseded` status.
6. A missing acknowledgement triggers `requestMatchState`; the server returns
   the latest recipient projection and any cached result for that command ID.

Gameplay `revision` advances for gameplay transitions. `snapshotSequence`
advances for every delivery, including reconnect and presence refreshes.
Reconnect and spectator joins therefore do not invalidate an otherwise legal
command.

## Version contract

Live snapshots carry `snapshotSchemaVersion`, `commandSchemaVersion`,
`eventSchemaVersion`, `rulesVersion`, and `cardContentVersion`. Matches retain
their creation-time rules version. New command fields are backward-compatible
while React remains available; an explicit incompatible command/rules version
is rejected instead of silently switching the match.

## Recipient privacy

The server projects independently for Player 1, Player 2, and spectators.
Projection covers hands, decks, lane cards, legal actions, private peeks,
face-down placement events, draw identifiers, and animation events. Reconnect
and explicit resynchronization use the same projector. Private events retain
their stable type and sequence for renderer ordering, but their card, source,
or choice payload is never delivered to an unauthorized recipient.

## Renderer fallback states

The supported handoff is `active -> frozen -> resynchronizing -> React`.
Babylon initialization, adapter connection, render, scene, and WebGL failures
enter the same path. The client freezes Babylon submissions, requests the
latest projection without reconnecting, disposes the adapter/scene, and mounts
React from the existing session. A per-match session marker prevents a retry
loop for the same renderer build.

## Current preservation boundary

- Branch: `giuseppe/matchscreen-modernization`.
- React remains the default and failure fallback.
- Babylon remains available only through the sandbox and explicit renderer
  flags.
- No public renderer policy or cohort rollout is enabled.
- Existing provisional changes and unrelated dirty-worktree files are
  preserved.

## Phase 0 qualification status

Unit and socket integration coverage now exercises recipient event privacy,
schema metadata, stale revisions, duplicate retries, conflicting command-ID
reuse, reconnect without gameplay-revision changes, explicit resync, adapter
remount command identity, server-only live legality, and renderer-boundary
failure reporting. The existing Playwright suites cover the real lobby entry,
two clients, spectators, reconnect, context loss, accessibility, visual states,
and repeated scene use.

Full network reordering/loss fuzzing, browser sleep/mobile-lock qualification,
rolling-version deployment, and multi-tab authority remain production
qualification work; they are not treated as evidence that Phase 1A's single
semantic-pass boundary is complete.
