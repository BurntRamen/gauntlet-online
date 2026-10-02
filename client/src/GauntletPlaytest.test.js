import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import GauntletPlaytest from "./GauntletPlaytest";

const state = { revision: 7, draft: {}, validation: { valid: true }, live: { domains: { factions: [
  { id: "rumin", name: "Rumin" }, { id: "sheen", name: "Sheen" }, { id: "xendra", name: "XenDra", campaignOnly: true }
] } } };

test.each(["sheen", "xendra"])("displayed content faction %s is the one sent to the engine", async (factionId) => {
  const request = jest.fn().mockResolvedValue({ playtest: null });
  render(<GauntletPlaytest request={request} state={state} domain="encounters" row={{ id: "encounter", title: "Test encounter", factionId }} />);
  expect(screen.getByLabelText("Test faction")).toHaveValue(factionId);
  expect(screen.getByLabelText("Test faction")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Start Test encounter playtest" }));
  await waitFor(() => expect(request).toHaveBeenCalled());
  expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ expectedRevision: 7, factionId, encounterId: "encounter" });
});

test("a generic draft duel honors the operator's faction selection", async () => {
  const request = jest.fn().mockResolvedValue({ playtest: null });
  render(<GauntletPlaytest request={request} state={state} domain="game" />);
  const selector = screen.getByLabelText("Test faction");
  expect(selector).toBeEnabled();
  expect(screen.queryByRole("option", { name: "XenDra" })).not.toBeInTheDocument();
  fireEvent.change(selector, { target: { value: "sheen" } });
  fireEvent.click(screen.getByRole("button", { name: "Start draft duel playtest" }));
  await waitFor(() => expect(request).toHaveBeenCalled());
  expect(JSON.parse(request.mock.calls[0][1].body).factionId).toBe("sheen");
});

test("a saved revision change keeps evidence visible but disables stale engine actions", () => {
  const session = { id: "test", draftHash: "original-hash", draftRevision: 7, acceptedCommands: 1, expiresAt: "2099-01-01T00:00:00Z", opponentCanAct: true,
    context: { encounter: "Pinned encounter", campaign: "Pinned campaign", chapter: 3, faction: "Rumin", factionId: "rumin" },
    game: { turn: 1, phase: "priority", priority: 1, players: {}, message: "Pinned engine message" },
    actions: [{ label: "Pass priority", command: { type: "passPriority", player: 1 } }],
    evidence: { status: "In progress", facts: { "Combat damage dealt": null, "Largest player attack (declared)": 8 }, events: [], references: [] } };
  const properties = { request: jest.fn(), state: { ...state, draft: { hash: "original-hash" } }, session, domain: "game" };
  const view = render(<GauntletPlaytest {...properties} />);
  expect(screen.getByText("Current saved draft · at last refresh")).toBeVisible();
  expect(screen.getByRole("button", { name: "Pass priority" })).toBeEnabled();
  view.rerender(<GauntletPlaytest {...properties} state={{ ...state, revision: 9, draft: { hash: "edited-hash" } }} />);
  expect(screen.getByText("Stale playtest · saved draft changed")).toBeVisible();
  expect(screen.getByText(/Pinned campaign/, { selector: "p" })).toBeVisible();
  expect(screen.getByText("Pinned engine message")).toBeVisible();
  expect(screen.getByRole("button", { name: "Pass priority" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Run opponent action" })).toBeDisabled();
  expect(screen.getAllByText("Not recorded").length).toBeGreaterThan(0);
  view.rerender(<GauntletPlaytest {...properties} session={{ ...session, expired: true }} />);
  expect(screen.getByText("Expired session · start again")).toBeVisible();
  expect(screen.getByRole("button", { name: "Pass priority" })).toBeDisabled();
});
