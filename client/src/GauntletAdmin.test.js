import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import GauntletAdmin from "./GauntletAdmin";

jest.mock("./GauntletAuthoring", () => ({ __esModule: true, default: ({ area }) => <p>Authoring area: {area}</p> }));

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const record = { matchId: id, mode: "campaign", recordVersion: 2, contentVersion: "content-v1", participants: [{ playerNum: 1, displayName: "Player A", faction: { name: "Rumin" }, result: "win", deck: { deckVersionId: "deck-v1" } }], campaign: { title: "First battle" }, auditEvents: [{ sequence: 1, turn: 1, eventType: "game_completed", publicPayload: { message: "Player 1 wins." }, stateChecksum: "checksum" }], leagueEvidence: [] };
const catalog = {
  versions: { content: "content-v1", registryRules: "registry-v1", engineRules: "engine-v2" },
  counts: { campaigns: 1, encounters: 0, factions: 0, cards: 1, decks: 0, characters: 0 },
  domains: { campaigns: [{ id: "rumin", name: "Rumin campaign", source: "server/gameContent.js", storage: "source-controlled", editable: false, definition: { pitch: "Campaign story" } }], cards: [{ id: "card-one", name: "First Card", source: "server/gameContent.js", storage: "source-controlled", editable: false, definition: { factionId: "rumin", text: "Actual card ability" } }] },
  game: { modes: [{ id: "basic", name: "Basic duel" }], startingState: { life: 42 }, deckRules: { size: 52 }, abilities: {}, season: {} },
  publishing: { model: "source-controlled", source: "server/gameContent.js", snapshot: { sha256: "fingerprint" }, stages: [{ name: "Draft", status: "Source branch", detail: "No stored draft." }] }
};
const system = { environment: "test", checkedAt: "2026-10-02T00:00:00Z", issues: [], versions: {}, storage: {}, sources: [], boundaries: [], validation: { message: "Registry passed." } };
const respond = async (path) => {
  if (path.endsWith("/catalog")) return catalog;
  if (path.endsWith("/system")) return system;
  if (path.endsWith(`/matches/${id}`)) return { match: record, provenance: { source: "canonical archive", integrity: "verified" } };
  if (path.endsWith("/matches")) return { matches: [record], issues: [], scope: "Recent 100 per store" };
  if (path.includes("/players?")) return { players: [{ id, name: "Player A", campaigns: [], decks: [], matchReferences: [], unlocks: {} }], source: "local JSON", hasMore: false };
  throw new Error("Unexpected route");
};
const request = jest.fn();
beforeEach(() => request.mockImplementation(respond));
function select(area) { fireEvent.click(within(screen.getByRole("navigation", { name: "Administration sections" })).getByText(area)); }

test("provides all seven sections, searchable sourced content, player state and original match evidence", async () => {
  render(<GauntletAdmin request={request} onClose={() => {}} />);
  expect(await screen.findByText("content-v1")).toBeVisible();
  for (const area of ["Overview", "Content", "Game", "Players", "Matches", "Publishing", "System"]) expect(within(screen.getByRole("navigation")).getByText(area)).toBeVisible();
  select("Content");
  expect(await screen.findByText("Authoring area: Content")).toBeVisible();
  select("Game");
  expect(await screen.findByText("Authoring area: Game")).toBeVisible();
  select("Players");
  await screen.findByText("Player A");
  expect(screen.getByText("Next players")).toBeDisabled();
  select("Matches");
  fireEvent.click(await screen.findByRole("button", { name: `Inspect match ${id}` }));
  expect(await screen.findByText("canonical archive")).toBeVisible();
  expect(screen.getByText(/#1 · turn 1 · game_completed/)).toBeVisible();
  select("Publishing");
  expect(await screen.findByText("Authoring area: Publishing")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
  select("System");
  expect(await screen.findByText("Registry passed.")).toBeVisible();
});

test("data failure is visible and can be retried without claiming zero counts", async () => {
  let failing = true;
  const flaky = jest.fn((path) => path.endsWith("catalog") && failing ? Promise.reject(new Error("Registry unavailable")) : request(path));
  render(<GauntletAdmin request={flaky} onClose={() => {}} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Registry unavailable");
  failing = false;
  fireEvent.click(screen.getByText("Refresh admin"));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  expect(await screen.findByText("content-v1")).toBeVisible();
});
