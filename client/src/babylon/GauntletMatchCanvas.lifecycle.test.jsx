import {
  GRAPHICS_QUALITY_OPTIONS,
  createAdaptiveResolutionController,
  IDLE_RENDER_FPS,
  matchHardwareScalingLevel,
  normalizeGraphicsQuality,
  renderMatchFrame,
  shouldRenderMatchFrame
} from "./rendererLifecycle";

test("turns an asynchronous render-loop exception into a renderer failure", () => {
  const error = new Error("render loop exploded");
  const renderer = {
    scene: {
      render: jest.fn(() => {
        throw error;
      })
    }
  };
  const onFailure = jest.fn();

  expect(renderMatchFrame(renderer, onFailure)).toBe(false);
  expect(onFailure).toHaveBeenCalledWith(error);
});

test("keeps rendering when a frame completes normally", () => {
  const renderer = { scene: { render: jest.fn() } };
  const onFailure = jest.fn();

  expect(renderMatchFrame(renderer, onFailure)).toBe(true);
  expect(onFailure).not.toHaveBeenCalled();
});

test("renders animations at display cadence while capping an idle or hidden table", () => {
  expect(IDLE_RENDER_FPS).toBe(30);
  expect(shouldRenderMatchFrame({
    now: 17,
    lastRenderedAt: 12,
    animationActive: true
  })).toBe(true);
  expect(shouldRenderMatchFrame({
    now: 20,
    lastRenderedAt: 0,
    animationActive: false
  })).toBe(false);
  expect(shouldRenderMatchFrame({
    now: 34,
    lastRenderedAt: 0,
    animationActive: false
  })).toBe(true);
  expect(shouldRenderMatchFrame({
    now: 200,
    lastRenderedAt: 0,
    animationActive: false,
    hidden: true
  })).toBe(false);
  expect(shouldRenderMatchFrame({
    now: 250,
    lastRenderedAt: 0,
    animationActive: false,
    hidden: true
  })).toBe(true);
});

test("offers bounded automatic, native, and supersampled graphics profiles", () => {
  expect(GRAPHICS_QUALITY_OPTIONS.map((option) => option.id)).toEqual([
    "performance",
    "balanced",
    "high",
    "ultra"
  ]);
  expect(normalizeGraphicsQuality("HIGH")).toBe("high");
  expect(normalizeGraphicsQuality("unknown")).toBe("balanced");
  expect(matchHardwareScalingLevel(1366, 588)).toBe(1);
  expect(matchHardwareScalingLevel(1904, 740)).toBe(1.251);
  expect(matchHardwareScalingLevel(2560, 1080)).toBe(1.753);
  expect(matchHardwareScalingLevel(7680, 4320)).toBeGreaterThan(6);
  expect(matchHardwareScalingLevel(1366, 588, "performance")).toBe(1.208);
  expect(matchHardwareScalingLevel(1904, 740, "performance")).toBe(1.601);
  expect(matchHardwareScalingLevel(7680, 4320, "high")).toBe(1);
  expect(matchHardwareScalingLevel(7680, 4320, "ultra")).toBe(0.75);
});

test("idle pacing tolerates display jitter without dropping to 20fps", () => {
  let lastRenderedAt = -Infinity;
  const paints = [];
  for (let frame = 0; frame < 120; frame++) {
    const now = frame * (1000 / 60) + (frame % 2 ? 0.15 : -0.15);
    if (shouldRenderMatchFrame({ now, lastRenderedAt, animationActive: false })) { paints.push(now); lastRenderedAt = now; }
  }
  expect(paints.length).toBe(60);
  expect(shouldRenderMatchFrame({now: 17, lastRenderedAt: 0, animationActive: true, hidden: true})).toBe(false);
});

test("balanced quality responds only to sustained slow frames and respects manual profiles", () => {
  const adapt = createAdaptiveResolutionController();
  let now = 0, scaling = 1;
  const sample = (delta, quality = "balanced", hidden = false) => { now += delta; scaling = adapt({now, hidden, quality, baseScaling: 1, currentScaling: scaling}); };
  for (let i = 0; i < 150; i++) sample(16.7);
  expect(scaling).toBe(1);
  sample(1000);
  expect(scaling).toBe(1);
  for (let i = 0; i < 120; i++) sample(33.3);
  expect(scaling).toBeCloseTo(1.15);
  const manualScaling = scaling;
  for (let i = 0; i < 150; i++) sample(40, "high");
  expect(scaling).toBe(manualScaling);
  for (let i = 0; i < 150; i++) sample(40, "balanced", true);
  expect(scaling).toBe(manualScaling);
  for (let i = 0; i < 1000; i++) sample(33.3);
  expect(scaling).toBe(1.6);
});
