# Babylon experience qualification runbook

This packet records the human and target-device evidence required to complete
Phase 6. It does not approve the renderer by itself. Record only observed
results, retain failed sessions, and rerun affected checks after remediation.

## 1. Identify the reviewed build

Set `rendererVersion` in `experience-gate.json` to an unambiguous local build
identifier. Record the branch, date, seed, and `gauntlet-duel-v2` rules version
in each playtest form. Do not use a commit identifier unless that commit exists.

## 2. Review the visual-state matrix

Open `artifacts/babylon-visual-review/current/index.html`. A named reviewer must
review every viewport and motion sample for all 18 required states. For each
state, record the reviewer and date in `experience-gate.json`, then set each of
these categories to `"pass"` only when it genuinely passes:

- `ruleClarity`
- `spacing`
- `cardReadability`
- `visualHierarchy`
- `interactionFeedback`
- `brandIdentity`
- `animationQuality`

Record and remediate failures before regenerating the affected captures.

## 3. Run five ordinary-player sessions

Use `playtest-session-1.md` through `playtest-session-5.md`. Keep the developer
drawer closed and do not explain the board before the participant begins. All
participants must be outside implementation, at least three must be new to the
developer sandbox, and the final set must include desktop and touch input.

After each session, transfer the observed result to the `playtests` array in
`experience-gate.json`. Never convert facilitator help or unresolved critical
confusion into a passing value.

## 4. Verify real browser zoom

Using supported Chrome or Edge browser chrome—not CSS `zoom` or devtools device
emulation—test 80%, 100%, 125%, 150%, 175%, and 200%. At every level verify the
three lanes, hand-combat rail, active hand, contextual actions, inspection,
focus indicator, and game result remain usable without horizontal page scroll.
Record reviewer and date for each level.

## 5. Qualify target devices

Use at least one target desktop and one physical target mobile device. For each
device:

1. Run cold page loads of `?babylon-test=1` and record usable-scene time. Use at
   least ten desktop and five mobile samples, then record p95.
2. Open `?babylon-test=1&babylon-dev=1` and record the minimum settled FPS during
   attack, block, damage, placement, priority transfer, and victory.
3. Complete five consecutive matches or ten resets and verify memory settles
   instead of growing continuously.
4. Record device/browser details and the evidence location alongside the
   `targetDevices` entry.

The desktop gate requires p95 below 3000 ms and at least 60 FPS. The mobile gate
requires p95 below 5000 ms and at least 30 FPS. Both require stable memory.

## 6. Validate the completed record

From the repository root run:

```text
npm run check:experience-gate
```

The command must pass without editing the validator or inventing evidence.
Phase 7 begins only after this record passes and any failed human workflow has
been remediated and retested.
