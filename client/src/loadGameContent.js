export const GAME_CONTENT_TIMEOUT_MS = 20000;

export async function fetchGameContent(apiBaseUrl, fetchImpl = fetch) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("The game server is taking too long to respond. It may be waking up or temporarily unavailable. Please retry."));
      controller.abort();
    }, GAME_CONTENT_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      timeout,
      (async () => {
        const response = await fetchImpl(`${apiBaseUrl}/api/game-content`, { signal: controller.signal });
        if (!response.ok) throw new Error("The game server is temporarily unavailable. Please retry.");
        const data = await response.json();
        if (!data.content?.contentVersion || !data.content?.campaigns || !data.content?.deckRules) {
          throw new Error("The server returned an unsupported game-content manifest.");
        }
        return data.content;
      })()
    ]);
  } finally {
    clearTimeout(timer);
  }
}
