import { renderMatchFrame } from "./rendererLifecycle";

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
