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
  expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ source: "draft", subject: { kind: "encounter", id: "encounter" }, expectedRevision: 7, factionId, encounterId: "encounter" });
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
  fireEvent.click(screen.getByText("Quick actions"));
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

 test("live tests remain pinned to their subject and release, and work without draft writes", async () => {
  const request = jest.fn().mockResolvedValue({ playtest: null });
  const session = { id: "live-test", source: "live", subject: { kind: "card", id: "one", label: "Captured card" }, releaseId: "live-one", contentHash: "abc", acceptedCommands: 1, expiresAt: "2099-01-01T00:00:00Z", game: { players: {}, phase: "priority", priority: 1, turn: 1 }, actions: [{ label: "Pass priority", command: { type: "passPriority", player: 1 } }] };
  const props = { request, state: { ...state, activeReleaseId: "live-one", draft: null, writable: false }, session, domain: "game" };
  const view = render(<GauntletPlaytest {...props} />);
  expect(screen.getByText("Captured card", { selector: "strong" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Start live duel playtest" })).toBeEnabled();
  fireEvent.click(screen.getByText("Quick actions"));
  expect(screen.getByRole("button", { name: "Pass priority" })).toBeEnabled();
  view.rerender(<GauntletPlaytest {...props} state={{ ...props.state, activeReleaseId: "live-two" }} row={{ name: "Another selection" }} />);
  expect(screen.getByText("Captured card", { selector: "strong" })).toBeVisible();
  expect(screen.getByText("Outdated live release · restart test")).toBeVisible();
  expect(screen.getByRole("button", { name: "Pass priority" })).toBeDisabled();
});

test("unknown faction-effect targets cannot silently start another faction's test", async () => {
  const request = jest.fn().mockResolvedValue({ playtest: null });
  const props = { request, state, domain: "faction-effects", metadata: { factionEffects: [{ id: "living-defense", factionId: "sheen" }] } };
  const view = render(<GauntletPlaytest {...props} subjectTarget={{ id: "removed-effect" }} />);
  expect(screen.getByRole("button", { name: "Start draft duel playtest" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Configure custom starting state" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Start draft duel playtest" }));
  expect(request).not.toHaveBeenCalled();
  view.rerender(<GauntletPlaytest {...props} subjectTarget={{ id: "living-defense" }} />);
  expect(screen.getByLabelText("Test faction")).toHaveValue("sheen");
  fireEvent.click(screen.getByRole("button", { name: "Start draft duel playtest" }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  expect(JSON.parse(request.mock.calls[0][1].body).subject).toEqual({ kind: "faction", id: "sheen" });
});

const capturedSession = () => ({ id: "saved-test", source: "draft", subject: { kind: "game-config", id: "shared-rules", label: "Captured shared rules" },
  draftHash: "unchanged-hash", draftRevision: 7, acceptedCommands: 1, expiresAt: "2099-01-01T00:00:00Z",
  game: { revision: 3, turn: 2, phase: "priority", priority: 1, players: {}, lanes: [], message: "Captured engine state" },
  actions: [{ label: "Pass priority", command: { type: "passPriority", player: 1 } }],
  legalActions: [{ id: "pass", type: "passPriority", player: 1, label: "Pass priority", confirmationPayload: { fixed: {} }, selection: { sources: [], targets: [] } }],
  evidence: { status: "In progress", facts: { "Player life": 35 }, references: [], events: [{ id: "one", sequence: 1, turn: 2, title: "Previously accepted priority pass" }] } });

test("an expired preview preserves captured evidence and disables further execution", async () => {
  const session = capturedSession(), onSession = jest.fn(), onBusy = jest.fn();
  const request = jest.fn().mockRejectedValue(Object.assign(new Error("Playtest expired or is not yours."), { status: 404 }));
  render(<GauntletPlaytest request={request} state={{ ...state, draft: { hash: session.draftHash } }} domain="game" session={session} onSession={onSession} onBusy={onBusy} />);
  fireEvent.change(screen.getByLabelText("Action"), { target: { value: "pass" } });
  fireEvent.click(screen.getByRole("button", { name: "Calculate command preview" }));
  expect(await screen.findByText("Expired session · start again")).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("Playtest expired or is not yours.");
  expect(screen.getByText("Captured engine state")).toBeVisible();
  expect(screen.getByText("Previously accepted priority pass")).toBeVisible();
  expect(screen.getByRole("button", { name: "Execute selected action" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Calculate command preview" })).toBeDisabled();
  expect(onSession).toHaveBeenCalledWith({ ...session, expired: true });
  expect(onBusy.mock.calls.map(([busy]) => busy)).toEqual([true, false]);
  expect(request.mock.calls[0][0]).toBe("/api/admin/authoring/playtest/preview-command");
});

test("bookkeeping-only draft revision changes retain the captured identity and allow execution", async () => {
  const session = capturedSession(), onSession = jest.fn();
  const request = jest.fn().mockResolvedValue({ playtest: { ...session, acceptedCommands: 2 } });
  const props = { request, onSession, session, domain: "game", state: { ...state, draft: { hash: session.draftHash } } };
  const view = render(<GauntletPlaytest {...props} />);
  fireEvent.click(screen.getByText("Quick actions"));
  view.rerender(<GauntletPlaytest {...props} state={{ ...props.state, revision: 10, draft: { ...props.state.draft, previewedRevision: 10 } }} />);
  expect(screen.getByText("Current saved draft · at last refresh")).toBeVisible();
  expect(screen.getByText("Captured shared rules", { selector: "strong" })).toBeVisible();
  expect(screen.queryByText(/Stale playtest/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Pass priority" }));
  await waitFor(() => expect(onSession).toHaveBeenCalled());
  expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ id: session.id, gameRevision: 3, command: { type: "passPriority", player: 1 }, automated: false });
  expect(onSession.mock.calls[0][0].draftRevision).toBe(7);
});
