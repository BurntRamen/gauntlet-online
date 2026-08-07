import {
  createCompletionAccountRefreshCoordinator,
  fetchAuthoritativeAccount
} from "./completionAccountRefresh";

test("fetches the complete authoritative account from auth/me", async () => {
  const account = { id: "account-1", progression: { campaign: { rumin: ["chapter-1"] } } };
  const fetchImpl = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ account })
  });

  await expect(fetchAuthoritativeAccount({
    apiBaseUrl: "https://gauntlet.example",
    authToken: "session-token",
    fetchImpl
  })).resolves.toBe(account);
  expect(fetchImpl).toHaveBeenCalledWith("https://gauntlet.example/api/auth/me", {
    headers: { Authorization: "Bearer session-token" }
  });
});

test("refreshes once per completed match and shares concurrent requests", async () => {
  const coordinator = createCompletionAccountRefreshCoordinator();
  const account = { id: "account-1", stats: { collection: { packCredits: 1 } } };
  const loadAccount = jest.fn().mockResolvedValue(account);

  const [first, concurrent] = await Promise.all([
    coordinator.refresh("match-1", loadAccount),
    coordinator.refresh("match-1", loadAccount)
  ]);
  const repeated = await coordinator.refresh("match-1", loadAccount);

  expect(loadAccount).toHaveBeenCalledTimes(1);
  expect(first).toEqual({ account, refreshed: true });
  expect(concurrent).toEqual({ account, refreshed: true });
  expect(repeated).toEqual({ account, refreshed: false });
  expect(coordinator.hasRefreshed("match-1")).toBe(true);
});

test("allows a failed account refresh to retry for the same match", async () => {
  const coordinator = createCompletionAccountRefreshCoordinator();
  const account = { id: "account-1" };
  const loadAccount = jest.fn()
    .mockRejectedValueOnce(new Error("temporary failure"))
    .mockResolvedValueOnce(account);

  await expect(coordinator.refresh("match-1", loadAccount)).rejects.toThrow("temporary failure");
  await expect(coordinator.refresh("match-1", loadAccount)).resolves.toEqual({ account, refreshed: true });
  expect(loadAccount).toHaveBeenCalledTimes(2);
});
