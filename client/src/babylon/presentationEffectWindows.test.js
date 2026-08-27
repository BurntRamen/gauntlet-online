import {
  PRESENTATION_EFFECT_WINDOW_CONTRACT_VERSION,
  planPresentationEffectWindows
} from "./presentationEffectWindows";

function presentation(cueId, offsetMs, durationMs = 980) {
  return {
    entry: { id: cueId },
    cue: { cueId, offsetMs, effectDurationMs: durationMs },
    durationMs
  };
}

test("partitions payment, attack, and priority cues across one authored frame", () => {
  const windows = planPresentationEffectWindows([
    presentation("priority.transfer", 640),
    presentation("payment.release", 420),
    presentation("attack.declare", 560)
  ]);

  expect(windows.map(({ cue, effectWindow }) => ({
    cueId: cue.cueId,
    delayMs: effectWindow.delayMs,
    effectDurationMs: effectWindow.effectDurationMs
  }))).toEqual([
    { cueId: "payment.release", delayMs: 420, effectDurationMs: 140 },
    { cueId: "attack.declare", delayMs: 0, effectDurationMs: 80 },
    { cueId: "priority.transfer", delayMs: 0, effectDurationMs: 340 }
  ]);
  expect(windows.reduce((total, entry) => (
    total + entry.effectWindow.delayMs + entry.effectWindow.effectDurationMs
  ), 0)).toBe(980);
  expect(windows.every((entry) => (
    entry.effectWindow.contract === PRESENTATION_EFFECT_WINDOW_CONTRACT_VERSION
  ))).toBe(true);
});

test("keeps close draw and turn signals inside their shared attention beat", () => {
  const windows = planPresentationEffectWindows([
    presentation("card.draw", 90, 620),
    presentation("turn.start", 120, 620)
  ]);

  expect(windows[0].effectWindow).toMatchObject({
    delayMs: 90,
    effectDurationMs: 30
  });
  expect(windows[1].effectWindow).toMatchObject({
    delayMs: 0,
    effectDurationMs: 500
  });
});

test("lets a single major effect occupy the remainder of its frame", () => {
  const [window] = planPresentationEffectWindows([
    presentation("damage.major", 220, 1350)
  ]);
  expect(window.effectWindow).toMatchObject({
    absoluteDelayMs: 220,
    delayMs: 220,
    effectDurationMs: 1130,
    frameDurationMs: 1350
  });
});
