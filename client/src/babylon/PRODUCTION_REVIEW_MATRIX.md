# Babylon production experience gate

The Basic vertical slice is not approved by a passing build or an attractive
neutral screenshot alone. Approval requires the complete visual-state matrix
and an ordinary-player playability session using Play mode with developer tools
closed.

## Capture protocol

- Use the real `ProductionMatchExperience` at
  `?babylon-test=1&review=1&fixture=<fixture>`.
- Hide developer chrome and browser inspection UI.
- Capture desktop at 1920×1080, 1536×864, and 1366×768, plus ultrawide,
  tablet landscape, tablet portrait, phone landscape, and the phone portrait
  rotate/accessibility state.
- Capture animation states both during motion and in their authoritative final
  pose. Reduced-motion behavior is reviewed separately.
- Do not use developer reveal for player-perspective captures.
- Score every state for rule clarity, spacing, card readability, visual
  hierarchy, interaction feedback, Gauntlet brand identity, and animation
  quality. A state fails if any category hides ownership, value, or role.

Run the complete capture with:

```text
npm run capture:babylon-review
```

The generated review is written to
`artifacts/babylon-visual-review/current/index.html`. The 2026-07-31 run used
seed `production-review-v1` and rules version `gauntlet-duel-v2`. It produced
144 final-pose captures and 15 motion samples across 18 states. The generated
index deliberately labels every qualitative category `Human pending`.

## Visual-state approval matrix

| State | Review fixture or path | Rule clarity | Spacing | Card readability | Hierarchy | Feedback | Brand | Animation | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Neutral battlefield | `populated-priority` | Pending | Pending | Pending | Pending | Pending | Pending | N/A | Captured; human pending |
| Local priority | `populated-priority` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Captured; human pending |
| Attack selection | `select-attacker` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Captured; human pending |
| Payment selection | `select-payment` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Captured; human pending |
| Hand attack | `incoming-hand` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Captured; human pending |
| Lane attack | `lane-attack` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Captured; human pending |
| Multiple hand blockers | `select-blockers` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Captured; human pending |
| Same-lane block | `same-lane-block` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Captured; human pending |
| Damage | `damage-resolution` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Captured; human pending |
| Placement | `end-placement` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Captured; human pending |
| Draw | `card-draw` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Captured; human pending |
| Priority transfer | `priority-change` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Captured; human pending |
| Faction ability | `mode=factions&p1=frumo&fixture=faction-ability` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Captured; human pending |
| Disconnect | `connection=disconnected&fixture=populated-priority` | Pending | Pending | Pending | Pending | Pending | Pending | N/A | Captured; human pending |
| Reconnect restored | reconnect the preceding state | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Captured; human pending |
| Victory | `victory` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Captured; human pending |
| Defeat | `defeat` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Captured; human pending |
| Draw result | `draw` | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Captured; human pending |

Automated checks additionally require the faction fixture to expose a selected
legal Polea action, disconnect to preserve the table while disabling Pass,
lane attack context to identify its lane, and the multiple-hand-blocker state
to identify blocking or payment. These checks prevent a technically rendered
but semantically incorrect fixture from entering the review set.

## Human playability gate

Run moderated sessions with at least five participants who were not involved
in implementation. At least three must not have used the developer sandbox.
Include both desktop and touch users. Do not brief participants on the current
layout before they begin. Every participant must be able to:

- identify whose priority it is immediately;
- distinguish a hand attack from a lane attack without explanation;
- identify attackers, blockers, payment cards, and face-down lane cards;
- complete attack, block, pass, and six-step placement sequences without logs;
- understand why an unavailable or rejected action cannot proceed;
- follow damage, payment discard, attack movement, block movement, placement,
  draw, priority transfer, and turn transition visually;
- finish a complete seeded Basic match from deal through victory without
  opening developer tools.

For each session record:

- time to identify priority and the active combat area;
- hesitation before each semantic action;
- mistaken clicks and attempted double submissions;
- confused attacker, blocker, payment, or lane roles;
- missed or misunderstood damage and card movement;
- unclear priority, phase, placement, reconnect, and result transitions;
- whether the participant consulted accessible controls, card inspection, or
  asked for explanation.

The gate fails if a player needs a log, inspector, fixture control, or verbal
rules explanation to complete the core sequence. The final validation round
must have no unresolved critical workflow confusion or facilitator
intervention. Visual approval alone is not sufficient.

## Internal walkthrough record

The 2026-07-25 internal walkthrough used
`?babylon-test=1&review=1&fixture=default&seed=playability-audit-2` with the
developer drawer closed. It completed these semantic sequences through the
real `LocalDuelAdapter`:

1. Select a hand attacker, select separate payment, confirm, hand the hidden
   perspective to the defender, decline the block, and follow three damage.
2. Pass priority from both player perspectives, enter end placement, place one
   real face-down card, skip the other five opportunities, draw to eight, and
   observe turn and starting-priority rotation.
3. Declare a second independent hand attack, select two hand blockers, continue
   to a separate payment step, confirm the block, and verify that life did not
   change.
4. Interrupt and restore the review fixture, preserving the table while
   disabling commands and returning the local plate from `Reconnecting` to
   `Priority`.

The walkthrough found and corrected four interaction defects: staged
selections no longer permit Pass, neutral lanes no longer glow as legal
targets, fixture damage now changes life and reaches the initial subscriber,
and reconnect status is shown on the active player plate. Event callouts now
expire instead of remaining over the table.

This is implementation evidence, not the required ordinary-player sign-off.
The external human session, timing/hesitation notes, and natural full-match
completion remain pending.

## 2026-07-30 automated review findings

- All 18 required states rendered through the real
  `ProductionMatchExperience` at four target viewports.
- The neutral view presents exactly three dominant lanes and a separate,
  elevated hand-combat rail.
- Hand attackers, multiple hand blockers, lane attackers, same-lane blockers,
  payment cards, lane cards, hands, deck, and discard use distinct anchors in
  their review states.
- Player identity, life, priority, phase, contextual instruction, and actions
  remain present at desktop and phone-landscape sizes.
- Visible fronts in the captured states are viewer-upright; the generated set
  is the evidence source for final human readability review.
- Damage, placement, priority transfer, result, disconnect, and restored states
  are captured in authoritative final poses, with motion samples where
  applicable.
- The first run found that the faction fixture could assign priority to Sheen
  while only Frumo exposed the reviewed ability. The fixture now assigns
  priority and perspective to a player with a legal ability, selects Polea,
  and asserts its targeting instruction before capture.

No qualitative row is marked approved yet. Use one copy of
`HUMAN_PLAYTEST_SESSION_TEMPLATE.md` per participant and record the five-session
gate in `PHASE_6_QUALIFICATION_STATUS.md`.

## 2026-07-30 unaided-flow audit

The production Play-mode path was exercised from a deterministic opening deal
with developer controls absent. The audit exposed and corrected two lifecycle
problems:

- Play mode previously defaulted to the `incoming-hand` review fixture instead
  of the real opening deal.
- After pass-pass closure and after each placement, action-log text replaced
  the next placement instruction. Players could see `End Placement` but were
  not told whose opportunity it was, which lane was active, or how far they
  were through the six-step sequence.

Play mode now starts at Turn 1 with eight cards per player. Neutral priority
names the current options. Placement guidance names `Placement 1 of 6` through
`Placement 6 of 6`, the acting player, the lane, and whether to place or skip.
The local production Match menu now exposes confirmed concession and the
existing result/new-match flow.

`e2e/babylon-usability.spec.js` verifies the complete core interaction sequence
through the real Babylon renderer and `LocalDuelAdapter`: attack selection,
separate payment, privacy handoff, hand blocking, block payment, resolution,
pass-pass closure, six real card placements, Turn 2, a placed-lane attack,
same-lane blocking, confirmed concession, defeat, and a fresh opening deal.
This automated path is a regression guard, not an ordinary-player approval.

The placed-lane audit found that shared rules exposed legal lane attacks while
the adapter left `legalLanes` empty until a lane had already been selected.
That circular gate disabled both the 3D lane cards and semantic lane buttons.
Lane interactivity is now derived directly from recipient-safe legal actions
for `declareLaneAttack` and `declareLaneBlock`. A separate highlighted-lane
contract preserves the restrained neutral board and applies sapphire feedback
only after selection or during a required combat/placement response.

## Approval record

Each approved capture records viewport, fixture, perspective, rules version,
revision, reduced-motion setting, reviewer, and date. Open issues link to the
state and category they block. The Basic vertical slice is approved only when
all Basic rows pass and one full ordinary-player session passes. Faction,
reconnect, responsive, and rollout gates remain explicit later milestones.

`Captured; human pending` means deterministic state, canvas, semantic checks,
and screenshot generation passed. It is deliberately not `Pass`: the reviewer
must score all seven categories and an ordinary player must complete the
required full-match sequence unaided.
