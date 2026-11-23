import { createPlayerReadCoordinator } from "./playerReads";

const response = (data) => ({ ok: true, json: async () => data });

test("coalesces identical requests, but never reuses a completed response", async () => {
  const fetchImpl = jest.fn().mockResolvedValue(response({ profile: { accountId: "one" } }));
  const read = createPlayerReadCoordinator({ fetchImpl });
  const first = read("/api/profiles/one");
  const second = read("/api/profiles/one");
  expect(second).toBe(first);
  await expect(first).resolves.toEqual({ profile: { accountId: "one" } });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  await read("/api/profiles/one");
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

test("does not share requests across different signed-in sessions", async () => {
  const fetchImpl = jest.fn().mockResolvedValue(response({ matches: [] }));
  const read = createPlayerReadCoordinator({ fetchImpl });
  await Promise.all([read("/api/account/matches", { authToken: "a" }), read("/api/account/matches", { authToken: "b" })]);
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(fetchImpl.mock.calls.map(([, options]) => options.headers.Authorization)).toEqual(["Bearer a", "Bearer b"]);
});

test("times out a stalled response body, aborts, and permits retry", async () => {
  jest.useFakeTimers();
  try {
    const fetchImpl = jest.fn().mockResolvedValueOnce({ ok: true, json: () => new Promise(() => {}) }).mockResolvedValueOnce(response({ matches: [] }));
    const read = createPlayerReadCoordinator({ fetchImpl, timeoutMs: 100 });
    const pending = read("/api/account/matches");
    const rejection = expect(pending).rejects.toThrow("taking too long");
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(100);
    await rejection;
    expect(fetchImpl.mock.calls[0][1].signal.aborted).toBe(true);
    await expect(read("/api/account/matches")).resolves.toEqual({ matches: [] });
  } finally {
    jest.useRealTimers();
  }
});

test("preserves HTTP status for expired sessions and tolerates a non-JSON error response", async () => {
  const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 401, json: async () => { throw new Error("not JSON"); } });
  const read = createPlayerReadCoordinator({ fetchImpl });
  await expect(read("/api/friends", { authToken: "expired", errorMessage: "Could not load friends." })).rejects.toMatchObject({ status: 401, message: "Could not load friends." });
});
