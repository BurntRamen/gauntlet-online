import { createPresentationTextureSlot } from "./presentationTextureSlot";

function fixture() {
  const requests = [];
  const applyTexture = jest.fn();
  const slot = createPresentationTextureSlot({
    applyTexture,
    loadTexture: (path) => {
      let finish;
      const request = {
        path, texture: { dispose: jest.fn() },
        ready: new Promise((resolve) => { finish = resolve; }),
        finish: (loaded = true) => finish(loaded)
      };
      requests.push(request);
      return request;
    }
  });
  return { requests, applyTexture, slot };
}

test("a loaded back stays visible until the latest replacement loads, without rebuilding its material", async () => {
  const { requests, applyTexture, slot } = fixture();
  slot.setPath("classic");
  requests[0].finish();
  await Promise.resolve();
  slot.setPath("rumin");
  slot.setPath("bizi");
  requests[1].finish();
  await Promise.resolve();
  expect(applyTexture).toHaveBeenCalledTimes(1);
  expect(requests[1].texture.dispose).toHaveBeenCalledTimes(1);
  expect(requests[0].texture.dispose).not.toHaveBeenCalled();
  requests[2].finish();
  await Promise.resolve();
  expect(applyTexture).toHaveBeenLastCalledWith(requests[2].texture);
  expect(requests[0].texture.dispose).toHaveBeenCalledTimes(1);
  slot.setPath("bizi");
  expect(requests).toHaveLength(3);
  slot.dispose();
  slot.dispose();
  expect(requests[2].texture.dispose).toHaveBeenCalledTimes(1);
});

test("failed replacements retain the released texture and can be retried", async () => {
  const { requests, applyTexture, slot } = fixture();
  slot.setPath("classic");
  requests[0].finish();
  await Promise.resolve();
  slot.setPath("missing");
  requests[1].finish(false);
  await Promise.resolve();
  expect(applyTexture).toHaveBeenCalledTimes(1);
  expect(requests[0].texture.dispose).not.toHaveBeenCalled();
  expect(requests[1].texture.dispose).toHaveBeenCalledTimes(1);
  slot.setPath("missing");
  expect(requests).toHaveLength(3);
  slot.dispose();
});

test("pending loads after disposal cannot update the material or double-dispose textures", async () => {
  const { requests, applyTexture, slot } = fixture();
  slot.setPath("classic");
  slot.dispose();
  requests[0].finish();
  await Promise.resolve();
  slot.setPath("bizi");
  expect(applyTexture).not.toHaveBeenCalled();
  expect(requests).toHaveLength(1);
  expect(requests[0].texture.dispose).toHaveBeenCalledTimes(1);
});
