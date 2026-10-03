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
beforeEach(() => { window.history.replaceState({}, "", "/"); request.mockReset().mockImplementation(respond); jest.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());
function select(area) { fireEvent.click(within(screen.getByRole("navigation", { name: "Administration sections" })).getByText(area)); }

test("provides six operational sections with Design, player state and original match evidence", async () => {
  render(<GauntletAdmin request={request} onClose={() => {}} />);
  await screen.findByText("content-v1");
  fireEvent.click(screen.getByText("Advanced / Technical · content and rules versions"));
  expect(screen.getByText("content-v1")).toBeVisible();
  const navigation = within(screen.getByRole("navigation", { name: "Administration sections" }));
  for (const area of ["Overview", "Design", "Players", "Matches", "Publishing", "System"]) expect(navigation.getByText(area)).toBeVisible();
  expect(navigation.queryByText("Content")).not.toBeInTheDocument();
  expect(navigation.queryByText("Game")).not.toBeInTheDocument();
  select("Design");
  expect(await screen.findByText("Authoring area: Design")).toBeVisible();
  select("Players");
  await screen.findByText("Player A");
  expect(screen.getByText("Next players")).toBeDisabled();
  select("Matches");
  fireEvent.click(await screen.findByRole("button", { name: `Inspect match ${id}` }));
  const inspection = await screen.findByRole("region", { name: "Match design inspection" });
  expect(within(inspection).getByText("canonical archive")).toBeVisible();
  fireEvent.click(screen.getByText("Advanced / Technical · match identity and provenance"));
  expect(screen.getByText("canonical archive")).toBeVisible();
  expect(screen.getByText(/#1 · turn 1 · game_completed/)).toBeVisible();
  const replay = screen.getByRole("link", { name: "Open recorded replay" });
  expect(replay).toHaveAttribute("target", "_blank");
  expect(replay).toHaveAttribute("href", `/?match=${id}&replay=1`);
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
  await screen.findByText("content-v1");
  fireEvent.click(screen.getByText("Advanced / Technical · content and rules versions"));
  expect(screen.getByText("content-v1")).toBeVisible();
});

test("player edits retain typed metadata on failure and protect section navigation and Admin exit", async () => {
  let playerName = "Player A";
  let failSave = true;
  const editorRequest = jest.fn(async (path, options) => {
    if (path.endsWith("/metadata")) {
      expect(options.method).toBe("PATCH");
      expect(JSON.parse(options.body)).toEqual({ expectedName: "Player A", metadata: { name: "Player B" } });
      if (failSave) throw new Error("This player's name changed elsewhere.");
      playerName = "Player B";
      return { player: { id, name: playerName } };
    }
    const data = await respond(path);
    return data.players ? { ...data, players: data.players.map((player) => ({ ...player, name: playerName })) } : data;
  });
  const exitGuard = { current: () => true };
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  try {
    render(<GauntletAdmin request={editorRequest} exitGuard={exitGuard} onClose={() => {}} />);
    select("Players");
    fireEvent.click(await screen.findByRole("button", { name: "View player Player A" }));
    expect(screen.queryByLabelText("Player name")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit metadata" }));
    expect(screen.getByRole("button", { name: "Save metadata" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Player name"), { target: { value: "Player B" } });
    select("Matches");
    expect(screen.getByLabelText("Player name")).toHaveValue("Player B");
    expect(exitGuard.current()).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Refresh admin" }));
    expect(screen.getByLabelText("Player name")).toHaveValue("Player B");
    fireEvent.click(screen.getByRole("button", { name: "Save metadata" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("changed elsewhere");
    expect(screen.getByLabelText("Player name")).toHaveValue("Player B");
    failSave = false;
    fireEvent.click(screen.getByRole("button", { name: "Save metadata" }));
    await screen.findByRole("heading", { name: "Player B" });
    expect(screen.getByRole("status")).toHaveTextContent("Player metadata saved");
    expect(screen.queryByLabelText("Player name")).not.toBeInTheDocument();
    expect(exitGuard.current()).toBe(true);
  } finally { confirm.mockRestore(); }
});

test("Players protects browser Back before a workshop has mounted and resolves discard once", async () => {
  const go = jest.spyOn(window.history, "go").mockImplementation(() => {});
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  const downstream = jest.fn(), onClose = jest.fn();
  window.addEventListener("popstate", downstream);
  try {
    render(<GauntletAdmin request={request} onClose={onClose} />);
    select("Players");
    fireEvent.click(await screen.findByRole("button", { name: "View player Player A" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit metadata" }));
    fireEvent.change(screen.getByLabelText("Player name"), { target: { value: "Player B" } });
    fireEvent(window, new PopStateEvent("popstate", { state: null }));
    expect(go).toHaveBeenLastCalledWith(1);
    expect(downstream).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Player name")).toHaveValue("Player B");
    fireEvent(window, new PopStateEvent("popstate", { state: {} }));
    expect(downstream).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledTimes(1);
    confirm.mockReturnValue(true);
    fireEvent(window, new PopStateEvent("popstate", { state: null }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(downstream).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Player name")).not.toBeInTheDocument();
  } finally {
    window.removeEventListener("popstate", downstream);
    go.mockRestore(); confirm.mockRestore();
  }
});

test("returning from Design preserves the match filter and page scroll", async () => {
  const scrollDescriptor = Object.getOwnPropertyDescriptor(window, "scrollY");
  try {
    render(<GauntletAdmin request={request} onClose={() => {}} />);
    select("Matches");
    fireEvent.change(await screen.findByLabelText("Search recent records"), { target: { value: "Player A" } });
    Object.defineProperty(window, "scrollY", { configurable: true, value: 720 });
    select("Design");
    Object.defineProperty(window, "scrollY", { configurable: true, value: 140 });
    fireEvent.click(screen.getByRole("button", { name: "Return to match inspection" }));
    expect(screen.getByLabelText("Search recent records")).toHaveValue("Player A");
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 720);
  } finally { Object.defineProperty(window, "scrollY", scrollDescriptor); }
});
