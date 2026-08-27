import {
  GRAPHICS_QUALITY_OPTIONS,
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
  expect(matchHardwareScalingLevel(7680, 4320)).toBe(2);
  expect(matchHardwareScalingLevel(1366, 588, "performance")).toBe(1.208);
  expect(matchHardwareScalingLevel(1904, 740, "performance")).toBe(1.601);
  expect(matchHardwareScalingLevel(7680, 4320, "high")).toBe(1);
  expect(matchHardwareScalingLevel(7680, 4320, "ultra")).toBe(0.75);
});
