import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import PlayerMenuExperience from "./PlayerMenuExperience";
import { GUEST_LAYOUT_STORAGE_KEY } from "./layoutPreferences";
import { getLayoutModuleIds } from "./layoutRegistry";

test("release menus ignore saved layouts and never initialize layout storage or account requests", () => {
  localStorage.setItem(GUEST_LAYOUT_STORAGE_KEY, JSON.stringify({ version: 1, pages: { play: { order: ["draft"], hidden: ["basic-ai"] } } }));
  const reads = jest.spyOn(Storage.prototype, "getItem");
  const writes = jest.spyOn(Storage.prototype, "setItem");
  const previousFetch = global.fetch;
  global.fetch = jest.fn();
  const props = {
    account: { id: "signed-player", name: "River" }, authToken: "signed-token", serverUrl: "https://example.invalid",
    onNavigate: jest.fn(), factionIds: ["ember"], content: { factions: [], campaigns: { ember: { factionName: "Ember", commanderName: "Ash", chapters: [] } } },
    actions: { roomCode: "" }, slots: {}, state: { ranked: {}, draftQueue: {}, invitations: [], savedDraftDecks: [], constructedDecks: [], completedChapters: 0 },
  };
  try {
    const view = route => <PlayerMenuExperience {...props} route={{ page: route, view: "" }} />;
    const { rerender } = render(view("play"));
    for (const page of ["play", "campaign", "decks", "compete", "matches", "community", "learn", "profile"]) {
      rerender(view(page));
      expect([...document.querySelectorAll("[data-layout-module]")].map(node => node.dataset.layoutModule)).toEqual(getLayoutModuleIds(page));
      fireEvent.click(screen.getAllByRole("button", { name: "More", exact: true })[0]);
      expect(screen.queryByRole("button", { name: "Customize this page", exact: true })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Close More menu" }));
      expect(screen.queryByText("Customize menu layouts")).not.toBeInTheDocument();
      expect(screen.queryByRole("switch", { name: "Customize Mode" })).not.toBeInTheDocument();
    }
    expect(global.fetch).not.toHaveBeenCalled();
    expect(reads.mock.calls.filter(([key]) => key.includes("player_layout"))).toEqual([]);
    expect(writes.mock.calls.filter(([key]) => key.includes("player_layout"))).toEqual([]);
  } finally {
    reads.mockRestore(); writes.mockRestore(); global.fetch = previousFetch; localStorage.clear();
  }
});

