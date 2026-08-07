export async function fetchAuthoritativeAccount({ apiBaseUrl, authToken, fetchImpl = fetch }) {
  if (!authToken) throw new Error("An auth token is required to refresh the account.");
  const response = await fetchImpl(`${apiBaseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not refresh the signed-in account.");
  if (!data.account) throw new Error("The account refresh returned no account.");
  return data.account;
}

export function createCompletionAccountRefreshCoordinator() {
  const refreshedAccounts = new Map();
  const pendingRefreshes = new Map();

  function refresh(matchId, loadAccount) {
    if (!matchId) return Promise.reject(new Error("A match ID is required to refresh completion account state."));
    if (refreshedAccounts.has(matchId)) {
      return Promise.resolve({ account: refreshedAccounts.get(matchId), refreshed: false });
    }
    if (pendingRefreshes.has(matchId)) return pendingRefreshes.get(matchId);

    const request = Promise.resolve()
      .then(loadAccount)
      .then((account) => {
        refreshedAccounts.set(matchId, account);
        return { account, refreshed: true };
      })
      .finally(() => pendingRefreshes.delete(matchId));
    pendingRefreshes.set(matchId, request);
    return request;
  }

  return {
    refresh,
    hasRefreshed: (matchId) => refreshedAccounts.has(matchId)
  };
}
