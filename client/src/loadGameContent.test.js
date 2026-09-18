import { fetchGameContent, GAME_CONTENT_TIMEOUT_MS } from "./loadGameContent";

const content = { contentVersion: "test", campaigns: {}, deckRules: {} };
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test("a stalled connection times out, aborts, and permits a successful retry", async () => {
  const fetchImpl = jest.fn().mockImplementationOnce(() => new Promise(() => {}))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ content }) });
  const pending = fetchGameContent("https://game.example", fetchImpl);
  const assertion = expect(pending).rejects.toThrow("taking too long");
  jest.advanceTimersByTime(GAME_CONTENT_TIMEOUT_MS);
  await assertion;
  expect(fetchImpl.mock.calls[0][1].signal.aborted).toBe(true);
  await expect(fetchGameContent("https://game.example", fetchImpl)).resolves.toEqual(content);
  expect(jest.getTimerCount()).toBe(0);
});

test("timeout also covers a response whose body never finishes", async () => {
  const pending = fetchGameContent("", async () => ({ ok: true, json: () => new Promise(() => {}) }));
  const assertion = expect(pending).rejects.toThrow("taking too long");
  await Promise.resolve();
  jest.advanceTimersByTime(GAME_CONTENT_TIMEOUT_MS);
  await assertion;
});

test("an HTML service failure produces an actionable error", async () => {
  await expect(fetchGameContent("", async () => ({ ok: false }))).rejects.toThrow("temporarily unavailable");
  expect(jest.getTimerCount()).toBe(0);
});

test("incompatible content is rejected", async () => {
  await expect(fetchGameContent("", async () => ({ ok: true, json: async () => ({ content: {} }) })))
    .rejects.toThrow("unsupported");
});
