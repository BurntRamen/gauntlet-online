import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Studio from "./Studio";

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test("exchanges the owner credential for a memory-only session and renders safe operations", async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ sessionToken: "short-session", expiresInMs: 3600000 }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({
      generatedAt: "2026-08-07T12:00:00.000Z",
      system: { backendReachable: true, matchStorage: "canonical-json-archive", matchArchive: { available: true }, accountStorage: "supabase-configured", supabaseConfigured: true },
      accounts: { total: 12, activeRecently: 4 },
      activePlay: { rooms: [], rankedQueue: 0, draftQueues: { player: 0, bot: 0 } },
      matches: { recent: [], exactFrameReplayCount: 0, eventOnlyReplayCount: 0, unavailableReferenceCount: 2 },
      season: { definition: { displayName: "Season Zero" }, participantCount: 3, gameCount: 4, activeMatchCount: 0, standings: [] },
      collector: { issuedCount: 2, redeemedCount: 1, pendingCount: 1, issuances: [] }
    }) });
  const onAuthorizedChange = jest.fn();
  render(<Studio serverUrl="http://localhost:4000" onAuthorizedChange={onAuthorizedChange} />);

  expect(screen.getByRole("heading", { name: "Owner authorization required" })).toBeVisible();
  fireEvent.change(screen.getByLabelText("Owner token"), { target: { value: "owner-secret" } });
  fireEvent.click(screen.getByRole("button", { name: "Open Studio" }));

  expect(await screen.findByRole("heading", { name: "Gauntlet Studio" })).toBeVisible();
  expect(screen.getByText("Canonical JSON durable")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Match Archive" })).toBeVisible();
  expect(onAuthorizedChange).toHaveBeenCalledWith(true);
  expect(global.fetch).toHaveBeenNthCalledWith(1, "http://localhost:4000/api/admin/session", expect.objectContaining({ body: JSON.stringify({ ownerToken: "owner-secret" }) }));
  await waitFor(() => expect(global.fetch).toHaveBeenNthCalledWith(2, "http://localhost:4000/api/admin/overview", { headers: { "x-owner-session": "short-session" } }));
  expect(document.body.textContent).not.toContain("owner-secret");
  expect(document.body.textContent).not.toContain("short-session");
});

test("keeps Studio closed when owner authorization fails", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Owner authorization required." }) });
  render(<Studio serverUrl="http://localhost:4000" />);
  fireEvent.change(screen.getByLabelText("Owner token"), { target: { value: "wrong" } });
  fireEvent.click(screen.getByRole("button", { name: "Open Studio" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Owner authorization required.");
  expect(screen.queryByRole("heading", { name: "Gauntlet Studio" })).not.toBeInTheDocument();
});
