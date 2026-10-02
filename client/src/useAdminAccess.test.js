import { act, renderHook, waitFor } from "@testing-library/react";
import useAdminAccess from "./useAdminAccess";

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
const response = (authorized, ok = true) => ({ ok, json: async () => ({ authorized }) });

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
