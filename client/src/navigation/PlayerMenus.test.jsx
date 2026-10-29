import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import PlayerMenus from "./PlayerMenus";
import { PlayerLayoutProvider } from "./PlayerLayoutStudio";
import { GUEST_LAYOUT_STORAGE_KEY } from "./layoutPreferences";
import { getLayoutModuleIds } from "./layoutRegistry";
import { getModePresentation } from "./modePresentation";

const callbackNames = ["basicAi", "factionAi", "createDuel", "createFreeForAll", "joinRoom", "setRoomCode", "resume", "campaign", "tutorial", "joinRanked", "leaveRanked", "activateDeck", "createDraft", "createBotDraft", "createSealed", "setDraftSet", "joinDraftQueue", "leaveDraftQueue", "collection", "joinChallenge", "declineChallenge"];
const slotNames = ["account", "events", "standings", "liveMatches", "matches", "community", "rulebook", "lore", "record", "economy", "profileExtras", "settings", "draftLibrary"];

function createProps(overrides = {}) {
  return {
    route: { page: "play", view: "" }, onNavigate: jest.fn(), account: null, ownerAuthorized: false,
    content: { factions: [{ id: "ember", name: "Ember", general: { id: "ash", name: "Ash Commander" }, generals: [{ id: "ash", name: "Ash Commander" }, { id: "cinder", name: "Cinder General" }] }], campaigns: {}, draftSets: [{ id: "initiative", number: 1, name: "Initiative", draftAvailable: true, sealedAvailable: true, factionIds: ["ember"] }] },
    slots: Object.fromEntries(slotNames.map((name) => [name, <div key={name} data-testid={`slot-${name}`}>{name} content</div>])),
    ...overrides,
    actions: { ...Object.fromEntries(callbackNames.map((name) => [name, jest.fn()])), roomCode: "", pending: false, ...overrides.actions },
    state: { ranked: { inQueue: false, message: "" }, draftQueue: { inQueue: false, message: "" }, draftSetId: "initiative", hasSavedRoom: false, savedRoomCode: "", completedChapters: 0, nextCampaign: null, deck: null, packCredits: 0, constructedDecks: [], savedDraftDecks: [], season: null, invitations: [], unread: 0, error: "", ...overrides.state },
  };
}

function renderMenus(overrides = {}) {
  const props = createProps(overrides);
  // Account persistence has its own integration suite; guest preferences keep these
  // navigation tests independent of the network while using the real layout UI.
  const view = (next) => <PlayerLayoutProvider factionIds={Object.keys(next.content.campaigns || {})}><PlayerMenus {...next} /></PlayerLayoutProvider>;
  const result = render(view(props));
  return { ...result, props, rerenderRoute: (page, viewName = "") => result.rerender(view({ ...props, route: { page, view: viewName } })) };
}

const getTile = (id) => document.querySelector(`[data-action-id="${id}"]`);
const openMore = () => fireEvent.click(screen.getAllByRole("button", { name: "More" })[0]);

beforeEach(() => localStorage.clear());

test("Play exposes all eight actions with concise labels and accurate click outcomes", () => {
  const { props } = renderMenus();
  const cases = [
    ["basic-ai", "Basic vs AI", "Start game", "basicAi"],
    ["faction-ai", "Factions vs AI", "Open faction setup", "factionAi"],
    ["private-duel", "Private Duel", "Create room", "createDuel"],
    ["join-table", "Join a Table", "Open room entry", ["play", "tables"]],
    ["ranked", "Ranked Match", "Open ranked setup", ["compete", "ranked"]],
    ["draft", "Draft & Sealed", "Choose format", ["draft", ""]],
    ["campaign", "Campaign", "Open campaigns", ["campaign", ""]],
    ["competition", "Official Competition", "Open competition", ["compete", ""]],
  ];
  expect(document.querySelectorAll("[data-action-id]")).toHaveLength(8);
  for (const [id, title, outcome, expected] of cases) {
    const tile = getTile(id);
    expect(tile).toHaveTextContent(title);
    expect(tile).toHaveTextContent(outcome);
    expect(tile.querySelector(".cd-action-description")).toBeNull();
    expect(tile.querySelector(".cd-action-icon svg")).toBeInTheDocument();
    fireEvent.click(tile);
    if (Array.isArray(expected)) expect(props.onNavigate).toHaveBeenLastCalledWith(...expected);
    else expect(props.actions[expected]).toHaveBeenCalledTimes(1);
  }
  expect(props.actions.joinRanked).not.toHaveBeenCalled();
  expect(props.actions.joinDraftQueue).not.toHaveBeenCalled();
});

test("a new guest can start Basic immediately and recover a saved seat without another setup", () => {
  const first = renderMenus();
  fireEvent.click(screen.getByRole("button", { name: "Start Basic vs AI" }));
  expect(first.props.actions.basicAi).toHaveBeenCalledTimes(1);
  first.unmount();
  const saved = renderMenus({ state: { hasSavedRoom: true, savedRoomCode: "ROOM42" } });
  expect(screen.getByRole("region", { name: "Suggested next action" })).toHaveTextContent("Resume room ROOM42");
  fireEvent.click(screen.getByRole("button", { name: "Resume Match" }));
  expect(saved.props.actions.resume).toHaveBeenCalledTimes(1);
});

test("Private Tables directly creates Duel and multiplayer rooms and preserves invitation join/spectate", () => {
  const { props } = renderMenus({ route: { page: "play", view: "tables" }, actions: { roomCode: "ABCD12" } });
  fireEvent.click(screen.getByRole("button", { name: /^Create Duel/ }));
  fireEvent.click(screen.getByRole("button", { name: /^Create Free-for-All/ }));
  expect(props.actions.createDuel).toHaveBeenCalledTimes(1);
  expect(props.actions.createFreeForAll).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Room code")).toHaveValue("ABCD12");
  fireEvent.click(screen.getByRole("button", { name: "Join as Player" }));
  expect(props.actions.joinRoom).toHaveBeenLastCalledWith(false);
  fireEvent.click(screen.getByRole("button", { name: "Spectate" }));
  expect(props.actions.joinRoom).toHaveBeenLastCalledWith(true);
  fireEvent.change(screen.getByLabelText("Room code"), { target: { value: "lower1" } });
  expect(props.actions.setRoomCode).toHaveBeenCalledWith("LOWER1");
});

test("empty room entry cannot submit and an invitation remains visible when navigating elsewhere", () => {
  const first = renderMenus({ route: { page: "play", view: "tables" } });
  expect(screen.getByRole("button", { name: "Join as Player" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Spectate" })).toBeDisabled();
  first.unmount();
  const { props } = renderMenus({ route: { page: "decks", view: "" }, actions: { roomCode: "INV123" } });
  expect(screen.getByText("Room invitation: INV123")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open Invitation" }));
  expect(props.onNavigate).toHaveBeenCalledWith("play", "tables");
  expect(props.actions.joinRoom).not.toHaveBeenCalled();
});

test("Ranked only queues on explicit submission and preserves format, faction, General, and BO3 choices", () => {
  const { props } = renderMenus({ account: { id: "account-1", name: "River" }, route: { page: "compete", view: "ranked" } });
  expect(screen.getByRole("button", { name: "Profile — River" })).toBeInTheDocument();
  expect(props.actions.joinRanked).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Match length"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("Faction"), { target: { value: "ember" } });
  expect(screen.getByLabelText("General")).toHaveValue("ash");
  fireEvent.change(screen.getByLabelText("General"), { target: { value: "cinder" } });
  fireEvent.click(screen.getByRole("button", { name: "Find Ranked Match" }));
  expect(props.actions.joinRanked).toHaveBeenCalledWith(3, { format: "factions", factionId: "ember", generalId: "cinder" });
  fireEvent.change(screen.getByLabelText("Ranked format"), { target: { value: "basic" } });
  expect(screen.queryByLabelText("General")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Find Ranked Match" }));
  expect(props.actions.joinRanked).toHaveBeenLastCalledWith(3, { format: "basic", factionId: null, generalId: null });
});

test("Ranked guest status and actual queue state expose the appropriate action", () => {
  const first = renderMenus({ route: { page: "compete", view: "ranked" } });
  expect(screen.getByRole("button", { name: "Find Ranked Match" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Sign in / Create Account" })).toBeInTheDocument();
  first.unmount();
  const { props } = renderMenus({ route: { page: "learn", view: "" }, state: { ranked: { inQueue: true, message: "Waiting for another player" } } });
  expect(screen.getByRole("region", { name: "Ranked queue" })).toHaveTextContent("Waiting for another player");
  fireEvent.click(screen.getByRole("button", { name: "View Queue" }));
  expect(props.onNavigate).toHaveBeenCalledWith("compete", "ranked");
  expect(props.actions.joinRanked).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Leave Queue" }));
  expect(props.actions.leaveRanked).toHaveBeenCalledTimes(1);
});

test("Draft actions distinguish room creation, bot drafting, Sealed pools and each Limited queue", () => {
  const { props, rerenderRoute } = renderMenus({ account: { id: "one", name: "River" }, route: { page: "draft", view: "live" }, state: { savedDraftDecks: [{ id: "limited-one", draftType: "player", name: "Ember draft" }, { id: "sealed-one", draftType: "sealed", name: "Ember Sealed" }] } });
  expect(props.actions.joinDraftQueue).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Create Draft Room" }));
  expect(props.actions.createDraft).toHaveBeenCalledTimes(1);
  rerenderRoute("draft", "bot");
  fireEvent.click(screen.getByRole("button", { name: "Start Bot Draft" }));
  expect(props.actions.createBotDraft).toHaveBeenCalledTimes(1);
  rerenderRoute("draft", "sealed");
  expect(screen.getByLabelText("Limited set")).toHaveValue("initiative");
  expect(screen.getByText("Includes Ember.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open Sealed Pool" }));
  expect(props.actions.createSealed).toHaveBeenCalledTimes(1);
  rerenderRoute("draft", "league");
  fireEvent.change(screen.getByLabelText("Match length"), { target: { value: "3" } });
  expect(props.actions.joinDraftQueue).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Find Limited Match" }));
  expect(props.actions.joinDraftQueue).toHaveBeenCalledWith("player", 3);
  fireEvent.change(screen.getByLabelText("Deck source"), { target: { value: "sealed" } });
  expect(screen.getByText("Active deck: Ember Sealed")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Find Limited Match" }));
  expect(props.actions.joinDraftQueue).toHaveBeenLastCalledWith("sealed", 3);
});

test("limited sets respect draft and Sealed availability independently", () => {
  const { props, rerenderRoute } = renderMenus({ route: { page: "draft", view: "sealed" }, state: { draftSetId: "draft-only" }, content: { factions: [], campaigns: {}, draftSets: [
    { id: "draft-only", number: 1, name: "Draft Only", draftAvailable: true, sealedAvailable: false, unavailableReason: "Sealed is not published for this set." },
    { id: "sealed-only", number: 2, name: "Sealed Only", draftAvailable: false, sealedAvailable: true },
  ] } });
  expect(screen.getByRole("button", { name: "Open Sealed Pool" })).toBeDisabled();
  expect(screen.getByText("Sealed is not published for this set.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Limited set"), { target: { value: "sealed-only" } });
  expect(props.actions.setDraftSet).toHaveBeenCalledWith("sealed-only");
  expect(props.actions.createSealed).not.toHaveBeenCalled();
  rerenderRoute("draft", "live");
  expect(screen.getByRole("button", { name: "Create Draft Room" })).toBeEnabled();
  expect(screen.getByRole("option", { name: "Set 2: Sealed Only — unavailable for this format" })).toBeDisabled();
});

test("Ranked excludes campaign-only factions and activates a chosen deck before joining", async () => {
  let completeActivation;
  const activateDeck = jest.fn(() => new Promise((resolve) => { completeActivation = resolve; }));
  const { props } = renderMenus({ account: { id: "one", name: "River" }, route: { page: "compete", view: "ranked" }, actions: { activateDeck }, content: { factions: [
    { id: "story", name: "Story Opponent", campaignOnly: true },
    { id: "ember", name: "Ember", general: { id: "ash", name: "Ash Commander" } },
  ] }, state: { constructedDecks: [{ id: "chosen-deck", name: "Ember Constructed", factionId: "ember", generalId: "ash" }] } });
  expect(screen.queryByRole("option", { name: "Story Opponent" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Active constructed deck"), { target: { value: "chosen-deck" } });
  fireEvent.click(screen.getByRole("button", { name: "Find Ranked Match" }));
  expect(activateDeck).toHaveBeenCalledWith("chosen-deck");
  expect(props.actions.joinRanked).not.toHaveBeenCalled();
  completeActivation();
  await waitFor(() => expect(props.actions.joinRanked).toHaveBeenCalledWith(1, { format: "factions", factionId: "ember", generalId: "ash" }));
});

test("saved room recovery and a different invitation coexist on Play and focused workflows", () => {
  const { props, rerenderRoute } = renderMenus({ state: { hasSavedRoom: true, savedRoomCode: "SAVED1" }, actions: { roomCode: "INVITE2" } });
  expect(screen.getByRole("button", { name: "Resume Match" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Room invitation" })).toHaveTextContent("INVITE2");
  fireEvent.click(screen.getByRole("button", { name: "Open Invitation" }));
  expect(props.onNavigate).toHaveBeenCalledWith("play", "tables");
  rerenderRoute("play", "tables");
  expect(screen.getByRole("region", { name: "Saved match recovery" })).toHaveTextContent("SAVED1");
  expect(screen.getByLabelText("Room code")).toHaveValue("INVITE2");
});

test("Profile retains account, layout preferences, and supplied progression and identity controls", () => {
  renderMenus({ route: { page: "profile", view: "" }, account: { id: "one", name: "River" } });
  expect(screen.getByTestId("slot-account")).toBeInTheDocument();
  expect(screen.getByTestId("slot-profileExtras")).toBeInTheDocument();
  expect(screen.getByRole("switch", { name: "Customize Mode" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reset all page layouts" })).toBeInTheDocument();
});

test("Faction Lore preserves the full published story screen supplied by the application", () => {
  renderMenus({ route: { page: "campaign", view: "lore" } });
  expect(screen.getByTestId("slot-lore")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Faction Lore" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Back to Campaign" })).not.toBeInTheDocument();
});

test("Campaign shortcuts derive from actual content and continuing uses the exact next chapter", () => {
  const campaigns = {
    newly_published: { factionName: "Tideward", commanderName: "The Navigator", chapters: [{ id: "intro" }, { id: "crossing" }] },
    ember: { factionName: "Ember", commanderName: "Ash Commander", chapters: [{ id: "arrival" }] },
  };
  const { props } = renderMenus({ route: { page: "campaign", view: "" }, content: { campaigns }, account: { id: "account", name: "River", progression: { campaign: { newly_published: ["intro"] } } }, state: { completedChapters: 1, nextCampaign: { factionId: "newly_published", chapter: { id: "crossing", title: "The Crossing" } } } });
  const faction = getTile("faction-newly_published");
  expect(faction).toHaveTextContent("Tideward");
  expect(faction).toHaveTextContent("Chapters · 1 of 2 cleared");
  fireEvent.click(faction);
  expect(props.actions.campaign).toHaveBeenCalledWith("newly_published");
  fireEvent.click(screen.getByRole("button", { name: "Continue next chapter" }));
  expect(props.actions.campaign).toHaveBeenLastCalledWith("newly_published", "crossing");
  expect(getTile("tutorial")).toHaveTextContent("Tutorial");
  expect(getTile("lore")).toHaveTextContent("Faction Lore");
  expect(getTile("rulebook")).toHaveTextContent("Rulebook");
});

test("hiding every Play shortcut preserves the feature directory and required recovery/queue notices", () => {
  localStorage.setItem(GUEST_LAYOUT_STORAGE_KEY, JSON.stringify({ version: 1, pages: { play: { order: getLayoutModuleIds("play"), hidden: getLayoutModuleIds("play") } } }));
  const { props } = renderMenus({ state: { hasSavedRoom: true, savedRoomCode: "KEEP12", ranked: { inQueue: true, message: "Still queued" } } });
  expect(getTile("basic-ai")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Resume Match" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Ranked queue" })).toHaveTextContent("Still queued");
  const directory = screen.getByText("All play actions").closest("details");
  fireEvent.click(within(directory).getByText("All play actions"));
  fireEvent.click(within(directory).getByRole("button", { name: "Basic vs AI" }));
  expect(props.actions.basicAi).toHaveBeenCalledTimes(1);
  fireEvent.click(within(directory).getByRole("button", { name: "Ranked Match" }));
  expect(props.onNavigate).toHaveBeenCalledWith("compete", "ranked");
  expect(props.actions.joinRanked).not.toHaveBeenCalled();
});

test.each([["play", "tables"], ["compete", "ranked"], ["draft", "live"], ["settings", ""]])("%s/%s is a focused workflow with no page-customization entry", (page, view) => {
  renderMenus({ route: { page, view } });
  openMore();
  expect(screen.getByRole("dialog", { name: "More destinations" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Customize this page" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Panel options/)).not.toBeInTheDocument();
});

test("landing-page customization can be activated from More without launching a game", () => {
  const { props } = renderMenus();
  openMore();
  fireEvent.click(screen.getByRole("button", { name: "Customize this page" }));
  expect(screen.getByLabelText("Panel options for Basic vs AI")).toBeInTheDocument();
  fireEvent.click(getTile("basic-ai"));
  expect(props.actions.basicAi).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole("button", { name: "Done Editing" })[0]);
  fireEvent.click(getTile("basic-ai"));
  expect(props.actions.basicAi).toHaveBeenCalledTimes(1);
});

test("decks, match records, replays and Community retain direct, distinct destinations", () => {
  const { props, rerenderRoute } = renderMenus({ route: { page: "decks", view: "" }, state: { packCredits: 2 } });
  fireEvent.click(getTile("editor"));
  expect(props.actions.collection).toHaveBeenCalledWith("decks");
  fireEvent.click(getTile("collection"));
  expect(props.actions.collection).toHaveBeenCalledWith("catalog");
  expect(getTile("packs")).toHaveTextContent("Open Earned Packs · 2");
  fireEvent.click(getTile("packs"));
  expect(props.actions.collection).toHaveBeenCalledWith("packs");
  rerenderRoute("matches");
  fireEvent.click(getTile("recent"));
  expect(props.onNavigate).toHaveBeenLastCalledWith("matches", "recent");
  fireEvent.click(getTile("replays"));
  expect(props.onNavigate).toHaveBeenLastCalledWith("matches", "replays");
  expect(screen.getByTestId("slot-matches")).toBeInTheDocument();
  rerenderRoute("community");
  const actions = within(screen.getByRole("navigation", { name: "Community actions" }));
  for (const label of ["Friends", "Challenges", "Messages", "Invitations"]) {
    fireEvent.click(actions.getByRole("button", { name: label }));
    expect(props.onNavigate).toHaveBeenLastCalledWith("community", label.toLowerCase());
  }
  expect(screen.getByTestId("slot-community")).toBeInTheDocument();
});

test("guest collection shortcuts explain the sign-in step before opening it", () => {
  const guest = renderMenus({ route: { page: "decks", view: "" } });
  expect(getTile("editor")).toHaveTextContent("Sign in to build");
  expect(getTile("collection")).toHaveTextContent("Sign in to browse");
  expect(getTile("packs")).toHaveTextContent("Sign in to open");
  fireEvent.click(getTile("collection"));
  expect(guest.props.actions.collection).toHaveBeenCalledWith("catalog");
  guest.unmount();
  renderMenus({ route: { page: "decks", view: "" }, account: { id: "one", name: "River" } });
  expect(getTile("collection")).toHaveTextContent("Open card catalog");
  expect(getTile("packs")).toHaveTextContent("Open packs");
});

test("published practice prose reaches the focused player surface without changing action names", () => {
  const { props } = renderMenus({ route: { page: "play", view: "practice" }, content: { modeMetadata: { practice: { heroTitle: "A reviewed practice heading", heroDescription: "A published introduction for new players." } } } });
  expect(screen.getByRole("heading", { name: "A reviewed practice heading" })).toBeVisible();
  expect(screen.getByText("A published introduction for new players.")).toBeVisible();
  expect(getTile("basic-ai")).toHaveTextContent("Basic vs AI");
  fireEvent.click(getTile("basic-ai"));
  expect(props.actions.basicAi).toHaveBeenCalledTimes(1);
});

test.each([
  ["practice", "play", "practice", "Master your next move.", "Find your rhythm at the table. Learn the core game or put a faction through its paces against AI.", "Practice", "Start with core rules, or choose a faction in the AI lobby."],
  ["freeForAll", "play", "tables", "A seat at your table.", "Challenge a friend to a duel, bring a group together, or watch a match unfold.", "Private Tables", "Create a private room or enter an invitation code."],
  ["ranked", "compete", "ranked", "Make your mark.", "Bring your best game. Find an opponent, build your record, and climb the seasonal standings.", "Ranked Match", "Review your setup. Queue only when you choose Find Ranked Match."],
  ["draft", "draft", "live", "Every pick is a possibility.", "Draft your picks or open a Sealed pool. Build a deck that is yours, one card at a time.", "Draft & Sealed", "Build from a fresh pool of cards. Choose a limited format to begin."],
  ["campaign", "campaign", "", "Begin your journey.", "Learn the rhythm of Gauntlet, then follow a commander through their campaign. Your next chapter is waiting.", "Choose a Faction", "Guests can play every published campaign. Sign in to retain chapter progress and rewards."],
])("shipped %s prose keeps the clear Command Deck heading and compact introduction", (mode, page, view, heroTitle, heroDescription, title, description) => {
  const secondaryDefaults = {
    practice: ["The training grounds", "Learn & experiment"], freeForAll: ["Private matches", "Play with friends"],
    ranked: ["The ranked arena", "Enter the competition"], draft: ["The drafting room", "Draft & sealed"], campaign: ["The academy & the archives"],
  };
  const [heroEyebrow, menuDetail] = secondaryDefaults[mode];
  renderMenus({ route: { page, view }, content: { modeMetadata: { [mode]: { heroTitle, heroDescription, heroEyebrow, menuDetail } } } });
  expect(screen.getByRole("heading", { name: title, exact: true })).toBeVisible();
  expect(screen.getByText(description, { exact: true })).toBeVisible();
  expect(screen.queryByRole("heading", { name: heroTitle, exact: true })).not.toBeInTheDocument();
  expect(screen.queryByText(heroDescription, { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByText(heroEyebrow, { exact: true })).not.toBeInTheDocument();
  if (menuDetail) expect(screen.queryByText(menuDetail, { exact: true })).not.toBeInTheDocument();
});

test("custom published overlines and menu details remain in each existing compact mode header", () => {
  for (const [mode, page, view] of [["practice", "play", "practice"], ["freeForAll", "play", "tables"], ["ranked", "compete", "ranked"], ["draft", "draft", "live"], ["campaign", "campaign", ""]]) {
    const { unmount } = renderMenus({ route: { page, view }, content: { modeMetadata: { [mode]: { heroTitle: "An authored mode title", heroEyebrow: "Published overline", menuDetail: "Published short menu description" } } } });
    const header = screen.getByRole("heading", { name: "An authored mode title" }).closest("header, .cd-context");
    expect(within(header).getByText("Published overline")).toBeVisible();
    expect(within(header).getByText("Published short menu description")).toBeVisible();
    expect(screen.getAllByText("Published overline")).toHaveLength(1);
    expect(screen.getAllByText("Published short menu description")).toHaveLength(1);
    unmount();
  }
});

test("mode prose fields resolve independently so changing one preserves the compact other field", () => {
  const defaults = { title: "Faction Campaigns", description: "Choose a commander and chapter." };
  expect(getModePresentation("campaign", { campaign: { heroTitle: "A custom archive", heroDescription: "Learn the rhythm of Gauntlet, then follow a commander through their campaign. Your next chapter is waiting." } }, defaults)).toEqual({ title: "A custom archive", description: defaults.description });
  expect(getModePresentation("campaign", { campaign: { heroTitle: "Begin your journey.", heroDescription: "A custom introduction" } }, defaults)).toEqual({ title: defaults.title, description: "A custom introduction" });
  expect(getModePresentation("campaign", undefined, defaults)).toEqual(defaults);
});

test.each([
  ["freeForAll", "play", "tables", "Create Free-for-All"],
  ["ranked", "compete", "ranked", "Find Ranked Match"],
  ["draft", "draft", "sealed", "Open Sealed Pool"],
])("published %s prose uses the existing focused heading without changing actions", (mode, page, view, actionName) => {
  const { props, rerenderRoute } = renderMenus({ route: { page, view }, content: { modeMetadata: { [mode]: { heroTitle: "A published mode heading", heroDescription: "The reviewed introduction for this format." } } } });
  expect(screen.getAllByRole("heading", { name: "A published mode heading" })).toHaveLength(1);
  expect(screen.getByText("The reviewed introduction for this format.")).toBeVisible();
  expect(screen.getByRole("button", { name: new RegExp(`^${actionName}\\b`) })).toBeVisible();
  expect(props.actions.joinRanked).not.toHaveBeenCalled();
  expect(props.actions.joinDraftQueue).not.toHaveBeenCalled();
  rerenderRoute("play");
  expect(screen.getByRole("heading", { name: "Ready to play?" })).toBeVisible();
  expect(getTile("ranked")).toHaveTextContent("Ranked Match");
  expect(getTile("draft")).toHaveTextContent("Draft & Sealed");
  expect(getTile("private-duel")).toHaveTextContent("Private Duel");
});

test("published campaign prose shares the existing context with saved progression", () => {
  const { props } = renderMenus({ route: { page: "campaign", view: "" }, account: { id: "one", name: "River" }, content: { modeMetadata: { campaign: { heroTitle: "The next chapter awaits", heroDescription: "Follow the published commander stories." } } }, state: { completedChapters: 4, nextCampaign: { factionId: "ember", chapter: { id: "crossing", title: "The Crossing" } } } });
  const context = screen.getByRole("heading", { name: "The next chapter awaits" }).closest(".cd-context");
  expect(document.querySelectorAll(".cd-context")).toHaveLength(1);
  expect(context).toHaveTextContent("Follow the published commander stories.");
  expect(context).toHaveTextContent("4 chapters cleared. Progress and earned packs stay with your account.");
  fireEvent.click(within(context).getByRole("button", { name: "Continue next chapter" }));
  expect(props.actions.campaign).toHaveBeenCalledWith("ember", "crossing");
});

test.each([
  ["decks", "", "Current deck"],
  ["draft", "live", "Live Draft"],
  ["draft", "bot", "Bot Draft"],
  ["draft", "sealed", "Sealed"],
  ["draft", "league", "Limited League"],
  ["play", "tables", "Join a Table"],
])("%s/%s uses section headings without skipping from the page title to level three", (page, view, title) => {
  renderMenus({ route: { page, view } });
  expect(screen.getByRole("heading", { level: 2, name: title, exact: true })).toBeVisible();
  expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
});

test("campaign references remain above the faction list when their optional tiles are hidden", () => {
  localStorage.setItem(GUEST_LAYOUT_STORAGE_KEY, JSON.stringify({ version: 1, pages: { campaign: { order: [], hidden: ["tutorial", "lore", "rulebook"] } } }));
  const campaigns = Object.fromEntries(Array.from({ length: 16 }, (_, index) => [`faction_${index}`, { factionName: `Faction ${index}`, commanderName: "Commander", chapters: [{ id: "intro" }] }]));
  const { props } = renderMenus({ route: { page: "campaign", view: "" }, content: { campaigns } });
  const references = screen.getByRole("navigation", { name: "Campaign references" });
  expect(references.compareDocumentPosition(getTile("faction-faction_0")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  for (const id of ["tutorial", "lore", "rulebook"]) expect(getTile(id)).not.toBeInTheDocument();
  fireEvent.click(within(references).getByRole("button", { name: "Open Tutorial" }));
  expect(props.actions.tutorial).toHaveBeenCalledTimes(1);
  fireEvent.click(within(references).getByRole("button", { name: "Read Faction Lore" }));
  expect(props.onNavigate).toHaveBeenLastCalledWith("campaign", "lore");
  fireEvent.click(within(references).getByRole("button", { name: "Open Rulebook" }));
  expect(props.onNavigate).toHaveBeenLastCalledWith("learn", "rulebook");
});

test("entering and leaving a focused workflow moves keyboard focus to the new heading", () => {
  const { rerenderRoute } = renderMenus();
  getTile("join-table").focus();
  fireEvent.click(getTile("join-table"));
  rerenderRoute("play", "tables");
  expect(screen.getByRole("heading", { name: "Private Tables" })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Back to Play" }));
  rerenderRoute("play");
  expect(screen.getByRole("heading", { name: "Ready to play?" })).toHaveFocus();
  rerenderRoute("compete", "ranked");
  expect(screen.getByRole("heading", { name: "Ranked Match" })).toHaveFocus();
});
