import { act, renderHook, waitFor } from "@testing-library/react";
import usePlayerNavigation, { readPlayerRoute } from "./usePlayerNavigation";

beforeEach(() => window.history.replaceState(null, "", "/"));

test.each([
  ["/", { page: "play", view: "" }],
  ["/?join=ABC123", { page: "play", view: "tables" }],
  ["/?resetToken=recovery", { page: "profile", view: "" }],
  ["/?join=ABC123&resetToken=recovery", { page: "profile", view: "" }],
  ["/?resetToken=recovery&page=play", { page: "play", view: "" }],
  ["/?resetToken=recovery&page=decks&view=library", { page: "decks", view: "library" }],
  ["/?resetToken=%20%20", { page: "play", view: "" }],
  ["/?page=unknown&view=ranked", { page: "play", view: "" }],
  ["/?page=draft&view=sealed", { page: "draft", view: "sealed" }],
  ["/?page=matches&view=replays", { page: "matches", view: "replays" }],
  ["/?page=matches&view=standings", { page: "matches", view: "" }],
  ["/?studio=1&page=play", { page: "studio", view: "" }],
  ["/?admin=1&resetToken=recovery", { page: "studio", view: "" }],
  ["/admin/gauntlet/content?page=play", { page: "studio", view: "" }],
  ["/admin/gauntlet-extra", { page: "play", view: "" }],
])("reads safe route %s", (url, expected) => {
  expect(readPlayerRoute(new URL(url, "https://example.test"))).toEqual(expected);
});

test("navigation retains invite, recovery, claim, public links, and hash while leaving the admin route", () => {
  window.history.replaceState(null, "", "/admin/gauntlet/cards?admin=1&studio=1&join=ABC123&resetToken=recovery&claim=gift&profile=player&match=record#details");
  const { result } = renderHook(() => usePlayerNavigation());
  expect(result.current.route).toEqual({ page: "studio", view: "" });
  act(() => result.current.navigate("decks", "library"));
  expect(result.current.route).toEqual({ page: "decks", view: "library" });
  const url = new URL(window.location.href);
  expect(url.pathname).toBe("/");
  expect(url.hash).toBe("#details");
  expect(Object.fromEntries(url.searchParams)).toEqual({ join: "ABC123", resetToken: "recovery", claim: "gift", profile: "player", match: "record", page: "decks", view: "library" });
  expect(readPlayerRoute()).toEqual(result.current.route);
});

test("explicit navigation can leave recovery, validates views, and avoids duplicate history entries", () => {
  window.history.replaceState(null, "", "/?resetToken=recovery");
  const { result } = renderHook(() => usePlayerNavigation());
  expect(result.current.route.page).toBe("profile");
  act(() => result.current.navigate("play", "invalid-view"));
  expect(result.current.route).toEqual({ page: "play", view: "" });
  expect(readPlayerRoute()).toEqual(result.current.route);
  const length = window.history.length;
  act(() => result.current.navigate("play"));
  act(() => result.current.navigate("unknown", "ranked"));
  expect(window.history.length).toBe(length);
  expect(result.current.route).toEqual({ page: "play", view: "" });
  act(() => result.current.navigate("journey"));
  expect(result.current.route.page).toBe("campaign");
});

test("browser back and forward restore the URL route without losing an invitation", async () => {
  window.history.replaceState(null, "", "/?join=ABC123");
  const { result } = renderHook(() => usePlayerNavigation());
  act(() => result.current.navigate("draft", "sealed"));
  act(() => result.current.navigate("matches", "replays"));
  act(() => window.history.back());
  await waitFor(() => expect(result.current.route).toEqual({ page: "draft", view: "sealed" }));
  act(() => window.history.forward());
  await waitFor(() => expect(result.current.route).toEqual({ page: "matches", view: "replays" }));
  expect(new URLSearchParams(window.location.search).get("join")).toBe("ABC123");
});

test("canceling browser Back preserves the editor route and prevents workflow cleanup", async () => {
  window.history.replaceState({ from: "invitation" }, "", "/?join=ABC123&page=play");
  const beforeNavigate = jest.fn(() => false);
  const { result, rerender } = renderHook(({ guard }) => usePlayerNavigation({ beforeNavigate: guard }), { initialProps: { guard: beforeNavigate } });
  act(() => result.current.navigate("decks", "library"));
  const editorUrl = window.location.href;
  const editorState = window.history.state;
  const discardEditor = jest.fn();
  window.addEventListener("popstate", discardEditor);
  try {
    act(() => window.history.back());
    await waitFor(() => expect(beforeNavigate).toHaveBeenCalledWith({ page: "play", view: "" }));
    expect(window.location.href).toBe(editorUrl);
    expect(window.history.state).toEqual(editorState);
    expect(result.current.route).toEqual({ page: "decks", view: "library" });
    expect(discardEditor).not.toHaveBeenCalled();
    rerender({ guard: () => true });
    act(() => window.history.back());
    await waitFor(() => expect(result.current.route).toEqual({ page: "play", view: "" }));
    expect(discardEditor).toHaveBeenCalledTimes(1);
  } finally { window.removeEventListener("popstate", discardEditor); }
});
