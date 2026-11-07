import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  if (path.endsWith("/home")) return { seasons: [], events: [], purchases: [], modules: [], tasks: [], storefront: { accountProducts: 0, digitalProducts: 0 }, players: { seenLastDay: 1, scope: "Account sample" }, publication: { activeReleaseId: "content-v1" } };
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
function select(area) {
  fireEvent.click(within(screen.getByRole("navigation", { name: "Administration sections" })).getByText(({ Design: "Content", Matches: "Operations", System: "Operations" })[area] || area));
  if (area === "Matches" && screen.queryByRole("button", { name: "Match evidence" })) fireEvent.click(screen.getByRole("button", { name: "Match evidence" }));
  if (area === "System") fireEvent.click(screen.getByRole("button", { name: "Health" }));
}

test("provides seven modular areas with content, player state and original match evidence", async () => {
  render(<GauntletAdmin request={request} onClose={() => {}} />);
  await screen.findByText("content-v1");
  fireEvent.click(screen.getByText("Advanced · active content release"));
  expect(screen.getByText("content-v1")).toBeVisible();
  const navigation = within(screen.getByRole("navigation", { name: "Administration sections" }));
  for (const area of ["Home", "Content", "Competition", "Store & Economy", "Players", "Publishing", "Operations"]) expect(navigation.getByText(area)).toBeVisible();
  expect(navigation.getAllByRole("button")).toHaveLength(7);
  expect(navigation.queryByText("Game")).not.toBeInTheDocument();
  select("Design");
  expect(await screen.findByText("Authoring area: Content")).toBeVisible();
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
  const flaky = jest.fn((path) => path.endsWith("home") && failing ? Promise.reject(new Error("Registry unavailable")) : request(path));
  render(<GauntletAdmin request={flaky} onClose={() => {}} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Registry unavailable");
  failing = false;
  fireEvent.click(screen.getByText("Refresh admin"));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  await screen.findByText("content-v1");
  fireEvent.click(screen.getByText("Advanced · active content release"));
  expect(screen.getByText("content-v1")).toBeVisible();
});

test("player edits retain typed metadata on failure and protect section navigation and Admin exit", async () => {
  let playerName = "Player A";
  let failSave = true;
  const editorRequest = jest.fn(async (path, options) => {
    if (path.endsWith("/metadata")) {
      expect(options.method).toBe("PATCH");
      expect(JSON.parse(options.body)).toEqual({ expectedName: "Player A", metadata: { name: "Player B" }, reason: "Support requested correction" });
      if (failSave) throw new Error("This player's name changed elsewhere.");
      playerName = "Player B";
      return { player: { id, name: playerName } };
    }
    const data = await respond(path);
    return data.players ? { ...data, players: data.players.map((player) => ({ ...player, name: playerName })) } : data;
  });
  const exitGuard = { current: () => true };
  render(<GauntletAdmin request={editorRequest} exitGuard={exitGuard} onClose={() => {}} />);
  select("Players");
  fireEvent.click(await screen.findByRole("button", { name: "View player Player A" }));
  expect(screen.queryByLabelText("Player name")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Edit player name" }));
  expect(screen.getByRole("button", { name: "Save player name" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Player name"), { target: { value: "Player B" } });
  fireEvent.change(screen.getByLabelText("Correction reason"), { target: { value: "Support requested correction" } });
  fireEvent.click(screen.getByRole("button", { name: "Navigation", exact: true }));
  expect(screen.getByRole("dialog", { name: "Workspace navigation" })).toBeVisible();
  select("Matches");
  expect(screen.queryByRole("dialog", { name: "Workspace navigation" })).not.toBeInTheDocument();
  expect(screen.getByRole("dialog")).toHaveTextContent("immediately");
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.getByLabelText("Player name")).toHaveValue("Player B");
  act(() => expect(exitGuard.current()).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  const options = screen.getByLabelText("Workspace options");
  fireEvent.click(options);
  expect(options.closest("details")).toHaveAttribute("open");
  fireEvent.click(screen.getByText("Refresh admin"));
  expect(options.closest("details")).not.toHaveAttribute("open");
  expect(screen.getByRole("dialog")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(options).toHaveFocus();
  expect(screen.getByLabelText("Player name")).toHaveValue("Player B");
  fireEvent.click(screen.getByRole("button", { name: "Save player name" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("changed elsewhere");
  expect(screen.getByLabelText("Player name")).toHaveValue("Player B");
  failSave = false;
  fireEvent.click(screen.getByRole("button", { name: "Save player name" }));
  await screen.findByRole("heading", { name: "Player B" });
  expect(screen.getByRole("status")).toHaveTextContent("Player metadata saved");
  expect(screen.queryByLabelText("Player name")).not.toBeInTheDocument();
  act(() => expect(exitGuard.current()).toBe(true));
});

test("Players protects browser Back before a workshop has mounted and resumes only an accepted discard", async () => {
  const go = jest.spyOn(window.history, "go").mockImplementation(() => {});
  const back = jest.spyOn(window.history, "back").mockImplementation(() => {});
  const downstream = jest.fn(), onClose = jest.fn();
  window.addEventListener("popstate", downstream);
  try {
    render(<GauntletAdmin request={request} onClose={onClose} />);
    select("Players");
    fireEvent.click(await screen.findByRole("button", { name: "View player Player A" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit player name" }));
    fireEvent.change(screen.getByLabelText("Player name"), { target: { value: "Player B" } });
    fireEvent.change(screen.getByLabelText("Correction reason"), { target: { value: "Support requested correction" } });
    fireEvent(window, new PopStateEvent("popstate", { state: null }));
    expect(go).toHaveBeenLastCalledWith(1);
    expect(downstream).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Player name")).toHaveValue("Player B");
    fireEvent(window, new PopStateEvent("popstate", { state: {} }));
    expect(downstream).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(back).not.toHaveBeenCalled();
    fireEvent(window, new PopStateEvent("popstate", { state: null }));
    fireEvent.click(screen.getByRole("button", { name: "Discard local edits and continue" }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent(window, new PopStateEvent("popstate", { state: {} }));
    expect(back).toHaveBeenCalledTimes(1);
    fireEvent(window, new PopStateEvent("popstate", { state: null }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(downstream).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Player name")).not.toBeInTheDocument();
  } finally {
    window.removeEventListener("popstate", downstream);
    go.mockRestore(); back.mockRestore();
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
