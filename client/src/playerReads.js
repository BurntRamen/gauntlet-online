// Shared, bounded player reads. Coalesce identical in-flight requests only;
// never persist authenticated responses or treat a previous result as current.
export const PLAYER_READ_TIMEOUT_MS = 20000;

export function createPlayerReadCoordinator({ fetchImpl = (...args) => fetch(...args), timeoutMs = PLAYER_READ_TIMEOUT_MS } = {}) {
  const pending = new Map();
  return function read(url, { authToken = "", errorMessage = "Could not load this information." } = {}) {
    const key = JSON.stringify([url, authToken]);
    if (pending.has(key)) return pending.get(key);
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error("The server is taking too long to respond. Please try again."));
        controller.abort();
      }, timeoutMs);
    });
    const request = Promise.race([
      deadline,
      Promise.resolve().then(async () => {
        const response = await fetchImpl(url, {
          signal: controller.signal,
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || data == null) {
          const failure = new Error(data?.error || errorMessage);
          failure.status = response.status;
          throw failure;
        }
        return data;
      })
    ]).finally(() => {
      clearTimeout(timer);
      pending.delete(key);
    });
    pending.set(key, request);
    return request;
  };
}

export const readPlayerJson = createPlayerReadCoordinator();
