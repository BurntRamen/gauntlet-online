import { render } from "@testing-library/react";
import { Engine } from "@babylonjs/core/Engines/engine.js";
import { createGauntletScene } from "./createGauntletScene";
import GauntletMatchCanvas from "./GauntletMatchCanvas";

jest.mock("@babylonjs/core/Engines/engine.js", () => ({ Engine: jest.fn() }));
jest.mock("./createGauntletScene", () => ({ createGauntletScene: jest.fn() }));
jest.mock("./AccessibleMatchControls", () => () => null);

test("theme and card-back changes preserve the engine, renderer, view model and current command handlers", () => {
  const dimensions = ["clientWidth", "clientHeight"].map((key) => [
    key, Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, key)
  ]);
  for (const [key] of dimensions) {
    Object.defineProperty(HTMLCanvasElement.prototype, key, { configurable: true, get: () => 800 });
  }
  const engine = {
    setHardwareScalingLevel: jest.fn(), getHardwareScalingLevel: () => 1,
    runRenderLoop: jest.fn(), stopRenderLoop: jest.fn(), resize: jest.fn(), dispose: jest.fn()
  };
  const renderer = {
    scene: { activeCamera: {}, render: jest.fn() },
    update: jest.fn(), updatePresentation: jest.fn(), dispose: jest.fn(), getMetrics: () => ({})
  };
  Engine.mockReturnValue(engine);
  createGauntletScene.mockReturnValue(renderer);
  const viewModel = { matchId: "unchanged-match", revision: 7, mode: "factions" };
  const firstHandler = jest.fn();
  const latestHandler = jest.fn();
  const originalResizeObserver = global.ResizeObserver;
  let resizeTable;
  global.ResizeObserver = jest.fn((callback) => {
    resizeTable = callback;
    return { observe: jest.fn(), disconnect: jest.fn() };
  });
  const mounted = render(<GauntletMatchCanvas viewModel={viewModel} commands={{ activateHandCard: firstHandler }} />);
  try {
    // Keep the existing initialization draw without an extra empty-scene
    // repaint from the startup resize; subsequent resizes must paint now.
    expect(renderer.scene.render).toHaveBeenCalledTimes(1);
    engine.runRenderLoop.mock.calls[0][0]();
    // A control-panel resize must repaint before ResizeObserver returns;
    // the regular animation loop may skip its next idle frame.
    renderer.scene.render.mockClear();
    resizeTable();
    expect(renderer.scene.render).toHaveBeenCalledTimes(1);
    expect(engine.resize.mock.invocationCallOrder.at(-1))
      .toBeLessThan(renderer.scene.render.mock.invocationCallOrder[0]);
    const originalOptions = createGauntletScene.mock.calls[0][2];
    mounted.rerender(<GauntletMatchCanvas
      viewModel={viewModel} commands={{ activateHandCard: latestHandler }}
      battlefieldTheme="bizi" cardBackAsset="/existing-bizi-back.jpg"
    />);
    expect(Engine).toHaveBeenCalledTimes(1);
    expect(createGauntletScene).toHaveBeenCalledTimes(1);
    expect(renderer.updatePresentation).toHaveBeenLastCalledWith({
      battlefieldTheme: "bizi", cardBackAsset: "/existing-bizi-back.jpg"
    });
    expect(renderer.update).toHaveBeenCalledWith(viewModel);
    expect(renderer.dispose).not.toHaveBeenCalled();
    expect(engine.dispose).not.toHaveBeenCalled();
    const rail = { current: { enabled: true, version: 1, anchors: new Map() } };
    mounted.rerender(<GauntletMatchCanvas viewModel={viewModel} commands={{ activateHandCard: latestHandler }}
      battlefieldTheme="bizi" cardBackAsset="/existing-bizi-back.jpg" handRailPresentation={rail} />);
    expect(originalOptions.getHandRailPresentation()).toBe(rail.current);
    mounted.rerender(<GauntletMatchCanvas viewModel={viewModel} commands={{ activateHandCard: latestHandler }}
      battlefieldTheme="bizi" cardBackAsset="/existing-bizi-back.jpg" handRailPresentation={null} />);
    expect(originalOptions.getHandRailPresentation()).toBeUndefined();
    expect(Engine).toHaveBeenCalledTimes(1);
    expect(createGauntletScene).toHaveBeenCalledTimes(1);
    originalOptions.activateHandCard(3);
    expect(latestHandler).toHaveBeenCalledWith(3);
    expect(firstHandler).not.toHaveBeenCalled();
  } finally {
    mounted.unmount();
    global.ResizeObserver = originalResizeObserver;
    for (const [key, descriptor] of dimensions) {
      if (descriptor) Object.defineProperty(HTMLCanvasElement.prototype, key, descriptor);
      else delete HTMLCanvasElement.prototype[key];
    }
  }
  expect(renderer.dispose).toHaveBeenCalledTimes(1);
  expect(engine.dispose).toHaveBeenCalledTimes(1);
});
