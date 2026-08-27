export const PRESENTATION_EFFECT_WINDOW_CONTRACT_VERSION = "gauntlet.presentation-effect-windows.v1";

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

export function planPresentationEffectWindows(presentations = []) {
  const ordered = presentations
    .slice()
    .sort((left, right) => Number(left.cue?.offsetMs || 0) - Number(right.cue?.offsetMs || 0));
  let frameCursorMs = 0;
  return ordered.map((presentation, index) => {
    const frameDurationMs = Math.max(0, Number(presentation.durationMs) || 0);
    const absoluteDelayMs = clamp(presentation.cue?.offsetMs || 0, 0, frameDurationMs);
    const nextAbsoluteDelayMs = presentation.cue && ordered[index + 1]?.cue
      ? clamp(ordered[index + 1].cue.offsetMs || 0, absoluteDelayMs, frameDurationMs)
      : frameDurationMs;
    // The board owns one restrained FX surface. Give each semantic cue the
    // window until the next onset so grouped cues share, rather than extend,
    // the authored beat clock.
    const visualWindowMs = presentation.cue && ordered.length > 1
      ? Math.max(20, nextAbsoluteDelayMs - absoluteDelayMs)
      : Number(presentation.cue?.effectDurationMs || frameDurationMs - absoluteDelayMs);
    const effectDurationMs = Math.max(
      20,
      Math.min(Math.max(20, frameDurationMs - absoluteDelayMs), visualWindowMs)
    );
    const delayMs = Math.max(0, absoluteDelayMs - frameCursorMs);
    frameCursorMs = absoluteDelayMs + effectDurationMs;
    return {
      ...presentation,
      effectWindow: {
        contract: PRESENTATION_EFFECT_WINDOW_CONTRACT_VERSION,
        absoluteDelayMs,
        delayMs,
        effectDurationMs,
        frameDurationMs
      }
    };
  });
}
