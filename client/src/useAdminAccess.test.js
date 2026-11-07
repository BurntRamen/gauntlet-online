import { act, renderHook, waitFor } from "@testing-library/react";
import useAdminAccess from "./useAdminAccess";

const originalFetch = global.fetch;
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { global.fetch = originalFetch; localStorage.clear(); sessionStorage.clear(); });
const response = (authorized, ok = true, accountId, status = ok ? 200 : 503) => ({ ok, status, json: async () => ({ authorized, accountId }) });
const rememberWorkspace = scope => {
  const value = JSON.stringify({ version: 1, recent: [{ domain: "cards", id: "private-card", name: "Unpublished card name" }], filters: { cards: { query: "Private draft search" } } });
  sessionStorage.setItem("gauntlet-admin-operator", scope);
  localStorage.setItem(`gauntlet-admin:${scope}`, value);
  return value;
};

test("guests make no access request; signed-in navigation requires server approval", async () => {
  global.fetch = jest.fn().mockResolvedValue(response(true));
  const { result, rerender } = renderHook(({ token }) => useAdminAccess("/server", token), { initialProps: { token: "" } });
  expect(result.current[0]).toBe(false);
  expect(global.fetch).not.toHaveBeenCalled();
  rerender({ token: "allowed" });
  await waitFor(() => expect(result.current[0]).toBe(true));
  expect(global.fetch).toHaveBeenCalledWith("/server/api/admin/access", { headers: { Authorization: "Bearer allowed" } });
  rerender({ token: "" });
  expect(result.current[0]).toBe(false);
});

test.each([response(false), response(true, false)])("a denied or unsuccessful access check keeps navigation hidden", async (reply) => {
  global.fetch = jest.fn().mockResolvedValue(reply);
  const { result } = renderHook(() => useAdminAccess("/server", "visitor"));
  await act(async () => {});
  expect(result.current[0]).toBe(false);
});

test("late approval from an old account cannot show Admin for its replacement", async () => {
  let approveOld;
  global.fetch = jest.fn().mockImplementationOnce(() => new Promise((resolve) => { approveOld = resolve; }))
    .mockResolvedValue(response(false));
  const { result, rerender } = renderHook(({ token }) => useAdminAccess("/server", token), { initialProps: { token: "allowed" } });
  rerender({ token: "visitor" });
  await act(async () => approveOld(response(true)));
  expect(result.current[0]).toBe(false);
});

test("network failures stay closed and Studio can clear discovered access", async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error("offline"));
  const { result } = renderHook(() => useAdminAccess("/server", "allowed"));
  await act(async () => {});
  expect(result.current[0]).toBe(false);
  act(() => result.current[1](true));
  expect(result.current[0]).toBe(true);
  act(() => result.current[1](false));
  expect(result.current[0]).toBe(false);
});

test("logout clears the previous operator's private workspace even outside Admin", async () => {
  const scope = "/server:operator";
  rememberWorkspace(scope);
  localStorage.setItem("unrelated-setting", "keep");
  global.fetch = jest.fn().mockResolvedValue(response(true, true, "operator"));
  const { result, rerender } = renderHook(({ token }) => useAdminAccess("/server", token), { initialProps: { token: "signed-in" } });
  await waitFor(() => expect(result.current[0]).toBe(true));
  expect(localStorage.getItem(`gauntlet-admin:${scope}`)).not.toBeNull();
  rerender({ token: "" });
  expect(localStorage.getItem(`gauntlet-admin:${scope}`)).toBeNull();
  expect(sessionStorage.getItem("gauntlet-admin-operator")).toBeNull();
  expect(localStorage.getItem("unrelated-setting")).toBe("keep");
});

test.each([response(false, true, "visitor"), response(false, false, undefined, 401), response(false, false, undefined, 403)])("a confirmed denial clears the prior operator's private workspace", async reply => {
  rememberWorkspace("/server:operator");
  global.fetch = jest.fn().mockResolvedValue(reply);
  const { result } = renderHook(() => useAdminAccess("/server", "visitor"));
  await act(async () => {});
  expect(result.current[0]).toBe(false);
  expect(localStorage.getItem("gauntlet-admin:/server:operator")).toBeNull();
  expect(sessionStorage.getItem("gauntlet-admin-operator")).toBeNull();
});

test.each([["/server", "another-operator"], ["/other-environment", "operator"]])("authorized access for %s / %s clears preferences from the previous scope", async (server, accountId) => {
  rememberWorkspace("/server:operator");
  global.fetch = jest.fn().mockResolvedValue(response(true, true, accountId));
  const { result } = renderHook(() => useAdminAccess(server, "authorized"));
  await waitFor(() => expect(result.current[0]).toBe(true));
  expect(localStorage.getItem("gauntlet-admin:/server:operator")).toBeNull();
  expect(sessionStorage.getItem("gauntlet-admin-operator")).toBeNull();
});

test("the same operator and environment retain preferences across token rotation", async () => {
  const scope = "/server:operator", saved = rememberWorkspace(scope);
  global.fetch = jest.fn().mockResolvedValue(response(true, true, "operator"));
  const { result, rerender } = renderHook(({ token }) => useAdminAccess("/server", token), { initialProps: { token: "first-token" } });
  await waitFor(() => expect(result.current[0]).toBe(true));
  rerender({ token: "rotated-token" });
  await waitFor(() => expect(result.current[0]).toBe(true));
  expect(localStorage.getItem(`gauntlet-admin:${scope}`)).toBe(saved);
  expect(sessionStorage.getItem("gauntlet-admin-operator")).toBe(scope);
});

test.each(["network", "server"])("a transient %s failure retains the previous workspace while access stays closed", async failure => {
  const scope = "/server:operator", saved = rememberWorkspace(scope);
  global.fetch = failure === "network" ? jest.fn().mockRejectedValue(new Error("offline")) : jest.fn().mockResolvedValue(response(undefined, false));
  const { result } = renderHook(() => useAdminAccess("/server", "authorized"));
  await act(async () => {});
  expect(result.current[0]).toBe(false);
  expect(localStorage.getItem(`gauntlet-admin:${scope}`)).toBe(saved);
  expect(sessionStorage.getItem("gauntlet-admin-operator")).toBe(scope);
});

test.each([response(true, true, "old-operator"), response(false, false, undefined, 403)])("a late response from the previous account cannot clear the current operator's workspace", async oldReply => {
  let completeOld;
  rememberWorkspace("/server:old-operator");
  global.fetch = jest.fn().mockImplementationOnce(() => new Promise(resolve => { completeOld = resolve; })).mockResolvedValue(response(true, true, "new-operator"));
  const { result, rerender } = renderHook(({ token }) => useAdminAccess("/server", token), { initialProps: { token: "old-token" } });
  rerender({ token: "new-token" });
  await waitFor(() => expect(result.current[0]).toBe(true));
  expect(localStorage.getItem("gauntlet-admin:/server:old-operator")).toBeNull();
  const scope = "/server:new-operator", saved = rememberWorkspace(scope);
  await act(async () => completeOld(oldReply));
  expect(result.current[0]).toBe(true);
  expect(localStorage.getItem(`gauntlet-admin:${scope}`)).toBe(saved);
  expect(sessionStorage.getItem("gauntlet-admin-operator")).toBe(scope);
});

test("an old response body finishing after account replacement cannot clear the new scope", async () => {
  let completeBody;
  const json = jest.fn(() => new Promise(resolve => { completeBody = resolve; }));
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, status: 200, json }).mockResolvedValue(response(true, true, "new-operator"));
  const { result, rerender } = renderHook(({ token }) => useAdminAccess("/server", token), { initialProps: { token: "old-token" } });
  await waitFor(() => expect(json).toHaveBeenCalled());
  rerender({ token: "new-token" });
  await waitFor(() => expect(result.current[0]).toBe(true));
  const scope = "/server:new-operator", saved = rememberWorkspace(scope);
  await act(async () => completeBody({ authorized: true, accountId: "old-operator" }));
  expect(result.current[0]).toBe(true);
  expect(localStorage.getItem(`gauntlet-admin:${scope}`)).toBe(saved);
  expect(sessionStorage.getItem("gauntlet-admin-operator")).toBe(scope);
});
