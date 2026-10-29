import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Authoring from "./GauntletAuthoring";
import { useRef, useState } from "react";
function GauntletAuthoring(props) {
  const [target, setTarget] = useState(props.initialDomain || { name: "cards" });
  const ownedGuard = useRef(action => action()), recent = useRef({});
  const guard = props.guard || ownedGuard;
  return <><nav aria-label="Fixture admin destinations">{[["cards", "Cards"], ["decks", "Decks"], ["campaigns", "Campaigns"], ["modes", "Website prose"], ["factions", "Factions"], ["characters", "Characters / opponents"]].map(([name,label]) => <button key={name} onClick={() => guard.current(() => setTarget({ name, id: recent.current[name] || null }))}>{label}</button>)}</nav><Authoring {...props} initialDomain={target} guard={guard} onStatus={status => { if(status.id) recent.current[status.domain] = status.id; }} /></>;
}

const guide = require("../../server/adminAuthoringGuide");
const clone = (value) => JSON.parse(JSON.stringify(value));
let state, request;
const props = () => ({ request, area: "Design", revision: 0, onPublished: jest.fn(), onNavigate: jest.fn() });
const resolvedPresentation = () => ({ releaseId: state.draft ? `draft:${state.draft.hash}` : state.activeReleaseId,
  manifest: { cards: clone((state.draft?.snapshot || state.live).domains.cards), collectorVariants: [], campaigns: {} } });
function reviewProjection() {
  const saved = !!state.draft && state.changes.length > 0, validated = state.validation.valid;
  const previewed = !!state.draft?.hash && state.draft.previewedHash === state.draft.hash;
  return { version: 1, hash: state.draft?.hash || null, revision: state.revision,
    groups: state.changes.length ? [{ id: "presentation", label: "Presentation", category: "Presentation", changes: state.changes.map(change => ({ ...change,
      label: (state.draft?.snapshot || state.live).domains[change.domain].find(row => row.id === change.id)?.name || change.id,
      fieldLabel: state.fields[change.domain][change.id][change.field].label, before: change.live, after: change.draft })) }] : [],
    readiness: { saved, validated, previewed, engineTestRequired: false, engineTested: false,
      ready: saved && validated && previewed && state.writable && !state.pending } };
}
beforeEach(() => {
  window.history.replaceState({}, "", "/");
  jest.spyOn(window, "scrollTo").mockImplementation(() => {});
  const domains = { campaigns: [{ id: "rumin", commanderName: "Campaign", pitch: "Live story" }], encounters: [], factions: [], cards: [{ id: "card-one", factionId: "rumin", type: "servitor", rarity: "common", name: "First card", text: "Engine effect wording", value: 3 }], decks: [], characters: [], assets: [], game: [{ id: "practice", name: "Practice", description: "Practice description" }] };
  state = { guide, revision: 0, writable: true, activeReleaseId: "release-one", live: { domains, engine: { startingLife: 42 } }, draft: null, changes: [], validation: { valid: true, errors: [], warnings: [] }, releases: [{ id: "release-one", label: "Original release", sha256: "hash", compatible: true, createdAt: "2026-10-02" }], activations: [], fields: {
    campaigns: { rumin: { pitch: { label: "Introduction", type: "text", maxLength: 4000 } } },
    cards: { "card-one": { name: { label: "Name", type: "text", maxLength: 160 }, text: { label: "Displayed rules text", type: "text", maxLength: 2000 } } },
    game: { practice: { name: { label: "Mode name", type: "text", maxLength: 80 } } }
  } };
  request = jest.fn(async (path, options) => {
    const body = options ? JSON.parse(options.body) : null;
    if (path === "/api/admin/workshops/review") return clone(reviewProjection());
    if (path.startsWith("/api/admin/workshops/relationships?")) return { source: state.draft ? "draft" : "live", hash: state.draft?.hash || "live-hash", nodes: [], edges: [], coverage: "Authored content" };
    if (path.startsWith("/api/admin/workshops/presentation?")) return { resolved: resolvedPresentation() };
    if (path.startsWith("/api/admin/workshops?")) return { version: 1, source: state.draft ? "draft" : "live", hash: state.draft?.hash || "live-hash", cardEffects: [], factionEffects: [], bossAbilities: [], encounterRules: {}, gameConfig: { handSize: 8 }, bindings: {} };
    if (path.endsWith("/record")) {
      expect(body.expectedRevision).toBe(state.revision);
      state.draft ||= { snapshot: clone(state.live), previewedHash: null };
      const live = state.live.domains[body.domain].find((row) => row.id === body.id);
      const row = state.draft.snapshot.domains[body.domain].find((entry) => entry.id === body.id);
      for (const change of body.changes) {
        row[change.field] = change.revert ? live[change.field] : change.value;
        state.changes = state.changes.filter((entry) => entry.id !== row.id || entry.field !== change.field);
        if (row[change.field] !== live[change.field]) state.changes.push({ domain: body.domain, id: row.id, field: change.field, live: live[change.field], draft: row[change.field] });
      }
      state.draft.previewedHash = null; state.revision++; state.draft.hash = `saved-hash-${state.revision}`;
    }
    if (path.endsWith("/preview")) { state.draft.previewedHash = state.draft.hash; state.revision++; return { ...clone(state), preview: resolvedPresentation() }; }
    if (path.endsWith("/publish")) { state.live = state.draft.snapshot; state.draft = null; state.changes = []; state.activeReleaseId = "release-two"; state.revision++; }
    if (path.endsWith("/discard")) { state.draft = null; state.changes = []; state.revision++; }
    if (path.endsWith("/cancel-publication")) { state.pending = null; state.writable = true; state.revision++; }
    if (!path.startsWith("/api/admin/authoring")) throw new Error(`Unexpected route: ${path}`);
    return clone(state);
  });
});
afterEach(() => jest.restoreAllMocks());

test("Para conflicts retain the original revision until the operator explicitly retries", async () => {
  const season = { id: "season-one", name: "Original season" };
  state.live.paraLeague = { seasons: [season], events: [], products: [] };
  state.para = { fields: { seasons: { id: { type: "text", label: "ID" }, name: { type: "text", label: "Name" } } }, templates: { seasons: season }, capabilities: {}, invariants: [], summary: [], catalog: [] };
  const normal = request, attempts = [];
  request = jest.fn(async (path, options) => {
    if (path === "/api/admin/economy") return { view: { title: "Economy operations" } };
    if (path.endsWith("/para-draft")) {
      const body = JSON.parse(options.body); attempts.push(body.expectedRevision);
      expect(body.value.name).toBe("Retained local season");
      if (body.expectedRevision === 0) { state.revision = 1; state.draft = { snapshot: clone(state.live), hash: "other-definition" }; state.draft.snapshot.paraLeague.seasons[0].name = "Other operator season"; throw Object.assign(new Error("Another operator saved this draft."), { status: 409 }); }
      state.revision = 2; state.draft.snapshot.paraLeague.seasons[0].name = body.value.name; return { ...clone(state), notice: "Definition saved." };
    }
    return normal(path, options);
  });
  render(<GauntletAuthoring {...props()} area="Para League & Economy" />);
  fireEvent.click(await screen.findByRole("button", { name: "Seasons", exact: true }, { timeout: 5000 }));
  fireEvent.click(screen.getByRole("button", { name: /Original season/ }));
  fireEvent.change(screen.getByLabelText("Name", { exact: true }), { target: { value: "Retained local season" } });
  fireEvent.click(screen.getByRole("button", { name: "Save definition to draft" }));
  const retry = await screen.findByRole("button", { name: "Use latest revision for retry" });
  fireEvent.click(screen.getByRole("button", { name: "Save definition to draft" }));
  await waitFor(() => expect(attempts).toEqual([0, 0]));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save definition to draft" })).toBeEnabled());
  expect(retry).toBeDisabled();
  fireEvent.click(screen.getByText("Compare definition values"));
  expect(screen.getByText(/Other operator season/, {selector:"pre"})).toBeVisible();
  fireEvent.click(screen.getByRole("button", {name:"Keep my definition after comparison"}));
  fireEvent.click(retry);
  fireEvent.click(screen.getByRole("button", { name: "Save definition to draft" }));
  await waitFor(() => expect(attempts).toEqual([0, 0, 1]));
  await waitFor(() => expect(screen.getByLabelText("Name", { exact: true })).toHaveValue("Retained local season"));
  fireEvent.change(screen.getByLabelText("Name", { exact: true }), { target: { value: "Another local change" } });
  fireEvent.click(screen.getByRole("button", { name: "Events", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Discard local edits and continue" }));
  expect(screen.getByRole("button", { name: "Events", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByLabelText("Name", { exact: true })).not.toBeInTheDocument();
});

async function selectCard() { fireEvent.click(await screen.findByRole("button", { name: "Cards", exact: true }, { timeout: 5000 })); fireEvent.click(await screen.findByRole("button", { name: "Inspect First card" }, { timeout: 5000 })); await screen.findByLabelText("Draft name", {}, { timeout: 5000 }); }
async function selectOther(tab) { fireEvent.click(await screen.findByRole("button", { name: tab, exact: true })); }

test("discard of a newly created shared record retains local values and refuses a false successful departure", async () => {
  state.draft = { snapshot: clone(state.live), hash: "created-record" };
  state.draft.snapshot.domains.cards.push({ ...state.live.domains.cards[0], id: "draft-card", name: "New card" });
  state.fields.cards["draft-card"] = clone(state.fields.cards[state.live.domains.cards[0].id]);
  const normal = request;
  request = jest.fn(async (path, options) => {
    if (path.endsWith("/record")) {
      state.draft = null; state.revision++; delete state.fields.cards["draft-card"];
      throw Object.assign(new Error("Another operator discarded the shared draft."), { status: 409 });
    }
    return normal(path, options);
  });
  render(<GauntletAuthoring {...props()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Cards", exact: true }));
  fireEvent.click(await screen.findByRole("button", { name: "Inspect New card" }, { timeout: 5000 }));
  fireEvent.change(await screen.findByLabelText("Draft name", {}, { timeout: 5000 }), { target: { value: "Retained new card" } });
  fireEvent.click(screen.getByRole("button", { name: /^Save changes to/ }));
  fireEvent.click(await screen.findByText("Retained local values", {}, { timeout: 5000 }));
  expect(screen.getByText(/Retained new card/, { selector: "pre" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Use latest revision for retry" }));
  await selectOther("Website prose");
  expect(screen.getByRole("button", { name: "Save and continue" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.getByText(/Retained new card/, { selector: "pre" })).toBeVisible();
});

test("pending GitHub publication keeps the deployed release active and cancellation preserves the draft", async () => {
  state.writable = false;
  state.draft = { snapshot: clone(state.live), hash: "saved-pending-hash", previewedHash: "saved-pending-hash" };
  state.draft.snapshot.domains.cards[0].name = "Preserved draft";
  state.pending = { releaseId: "release-two", phase: "checks-failed", url: "https://github.com/BurntRamen/gauntlet-online/pull/1" };
  render(<GauntletAuthoring {...props()} area="Publishing" />);
  const progress = await screen.findByRole("region", { name: "Publication progress" });
  expect(within(progress).getByText("Publication: checks failed")).toBeVisible();
  expect(screen.getByRole("button", { name: "Publish release" })).toBeDisabled();
  expect(state.activeReleaseId).toBe("release-one");
  fireEvent.click(within(progress).getByRole("button", { name: "Cancel publication" }));
  expect(screen.getByText("Close the unmerged publication and keep the shared draft for further editing.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Confirm cancel-publication" }));
  await waitFor(() => expect(request).toHaveBeenCalledWith("/api/admin/authoring/cancel-publication", expect.objectContaining({ method: "POST" })));
  await waitFor(() => expect(state.pending).toBeNull());
  expect(state.draft.snapshot.domains.cards[0].name).toBe("Preserved draft");
});

test("structured fields show live/draft values, save cross-domain changes, and revert without editing mechanics", async () => {
  render(<GauntletAuthoring {...props()} />);
  await selectCard();
  expect(screen.getByLabelText("Draft name")).toHaveValue("First card");
  expect(screen.queryByLabelText("Draft value")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Draft name"), { target: { value: "Edited card" } });
  expect(screen.getByText("Unsaved", { exact: true })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /^Save changes to/ }));
  await screen.findByText("1 saved field change");
  expect(state.live.domains.cards[0].name).toBe("First card");
  expect(screen.getByLabelText("Draft name")).toHaveValue("Edited card");
  await selectOther("Website prose");
  fireEvent.click(await screen.findByRole("button", { name: "Inspect Practice" }));
  fireEvent.change(await screen.findByLabelText("Draft mode name"), { target: { value: "New practice" } });
  fireEvent.click(screen.getByRole("button", { name: /^Save changes to/ }));
  await screen.findByText("2 saved field changes");
  fireEvent.click(screen.getByRole("button", { name: "Revert mode name to live", hidden: true }));
  fireEvent.click(screen.getByRole("button", { name: /^Save changes to/ }));
  await screen.findByText("1 saved field change");
  expect(screen.getByLabelText("Draft mode name")).toHaveValue("Practice");
});

test("preview uses the real card component and publication requires explicit review confirmation", async () => {
  const properties = props(); const view = render(<GauntletAuthoring {...properties} />);
  await selectCard();
  fireEvent.change(screen.getByLabelText("Draft name"), { target: { value: "Preview card" } });
  fireEvent.click(screen.getByRole("button", { name: /^Save changes to/ }));
  await screen.findByText("1 saved field change");
  fireEvent.click(screen.getByRole("button", { name: "Preview saved draft", hidden: true }));
  const preview = await screen.findByRole("region", { name: "Card Workshop preview and test" });
  expect(within(preview).getByAltText("Preview card illustration")).toBeVisible();
  expect(state.live.domains.cards[0].name).toBe("First card");
  expect(request.mock.calls.every(([path]) => path.startsWith("/api/admin/authoring") || path.startsWith("/api/admin/workshops"))).toBe(true);
  expect(request).toHaveBeenCalledWith("/api/admin/authoring/preview", expect.objectContaining({ method: "POST" }));
  view.rerender(<GauntletAuthoring {...properties} area="Publishing" />);
  expect(await screen.findByRole("button", { name: "Publish release" })).toBeDisabled();
  await screen.findByText("Ready for review and publishing");
  fireEvent.change(screen.getByLabelText("Release name"), { target: { value: "Reviewed update" } });
  fireEvent.click(screen.getByRole("button", { name: "Publish release" }));
  expect(state.activeReleaseId).toBe("release-one");
  fireEvent.click(screen.getByRole("button", { name: "Confirm publish" }));
  await waitFor(() => expect(properties.onPublished).toHaveBeenCalled());
  expect(state.activeReleaseId).toBe("release-two");
});

test("field errors block preview, protected objects remain read-only, and conflict errors preserve typed values", async () => {
  state.validation = { valid: false, errors: [{ domain: "cards", id: "card-one", field: "name", message: "Name is required." }], warnings: [] };
  const successful = request;
  request = jest.fn((path, options) => path.endsWith("/record") ? Promise.reject(new Error("Content changed in another session. Refresh before saving.")) : successful(path, options));
  render(<GauntletAuthoring {...props()} />);
  await selectCard();
  expect(screen.getAllByText(/Name is required/).length).toBeGreaterThan(1);
  expect(screen.getByRole("button", { name: "Preview saved draft", hidden: true })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Draft name"), { target: { value: "Keep my edit" } });
  fireEvent.click(screen.getByRole("button", { name: /^Save changes to/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("another session");
  expect(screen.getByLabelText("Draft name")).toHaveValue("Keep my edit");
});

test.each([
  ["factions", "Factions", "Rumin", "cardImage", "Artwork"],
  ["characters", "Characters / opponents", "Commander", "image", "Portrait"]
])("%s preview resolves manifest asset IDs through the saved release", async (domain, tab, name, field, fieldLabel) => {
  const id = domain === "factions" ? "rumin" : "rumin:commander";
  state.live.domains[domain] = [{ id, name, factionId: "rumin", kind: "faction-role", role: "commander", [field]: "asset-original" }];
  state.fields[domain] = { [id]: { [field]: { label: fieldLabel, type: "asset", media: "image", maxLength: 512 } } };
  const resolvedArtwork = "/assets/gauntlet/releases/immutable-draft-artwork.webp";
  const originalRequest = request;
  request = jest.fn(async (path, options) => {
    const result = await originalRequest(path, options);
    if (path.endsWith("/preview")) result.preview.factions = {
      rumin: { id: "rumin", name: "Rumin", cardImage: resolvedArtwork, commander: { name: "Commander", image: resolvedArtwork } }
    };
    return result;
  });
  render(<GauntletAuthoring {...props()} />);
  await selectOther(tab);
  fireEvent.click(await screen.findByRole("button", { name: "Inspect " + name }));
  fireEvent.change(await screen.findByLabelText("Draft " + fieldLabel.toLowerCase()), { target: { value: "asset-selected" } });
  fireEvent.click(screen.getByRole("button", { name: /^Save changes to/ }));
  await screen.findByText("1 saved field change");
  fireEvent.click(screen.getByRole("button", { name: "Preview saved draft", hidden: true }));
  const preview = await screen.findByRole("region", { name: "Isolated draft preview" });
  expect(within(preview).getByRole("img", { name })).toHaveAttribute("src", resolvedArtwork);
});

test("leaving protects unsaved typing and an accepted discard clears only local values", async () => {
  const guard = { current: () => true };
  render(<GauntletAuthoring {...props()} guard={guard} />);
  await selectCard();
  fireEvent.change(screen.getByLabelText("Draft name"), { target: { value: "Local only" } });
  fireEvent.click(screen.getByRole("button", { name: "Campaigns" }));
  const dialog = screen.getByRole("dialog", { name: "Unsaved local changes" });
  expect(within(dialog).getByRole("button", { name: "Keep editing" })).toHaveFocus();
  expect(screen.getByLabelText("Draft name")).toHaveValue("Local only");
  expect(state.draft).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Keep editing" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Draft name")).toHaveValue("Local only");
  fireEvent.click(screen.getByRole("button", { name: "Campaigns" }));
  fireEvent.click(screen.getByRole("button", { name: "Discard local edits and continue" }));
  await screen.findByRole("button", { name: "Inspect Campaign" });
  fireEvent.click(screen.getByRole("button", { name: "Cards", exact: true }));
  expect(await screen.findByLabelText("Draft name")).toHaveValue("First card");
  expect(state.draft).toBeNull();
});

test("a 409 keeps the original save revision until the operator explicitly selects the latest shared draft", async () => {
  const successful = request, attempts = [];
  request = jest.fn(async (path, options) => {
    if (path.endsWith("/record")) {
      const body = JSON.parse(options.body); attempts.push(body.expectedRevision);
      if (!state.draft) {
        state.revision = 1;
        state.draft = { snapshot: clone(state.live), hash: "other-operator-hash", previewedHash: null };
        state.draft.snapshot.domains.cards[0].name = "Other operator name";
        state.changes = [{ domain: "cards", id: "card-one", field: "name", live: "First card", draft: "Other operator name" }];
      }
      if (body.expectedRevision !== state.revision) throw Object.assign(new Error("Content changed in another session."), { status: 409 });
    }
    return successful(path, options);
  });
  render(<GauntletAuthoring {...props()} />);
  await selectCard();
  fireEvent.change(screen.getByLabelText("Draft name"), { target: { value: "Retained local name" } });
  fireEvent.click(screen.getByRole("button", { name: /^Save changes to/ }));
  const retry = await screen.findByRole("button", { name: "Use latest revision for retry" });
  expect(screen.getByLabelText("Draft name")).toHaveValue("Retained local name");
  fireEvent.click(screen.getByText("Saved shared draft value"));
  expect(screen.getByText("Other operator name", { selector: "pre" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /^Save changes to/ }));
  await waitFor(() => expect(attempts).toEqual([0, 0]));
  await waitFor(() => expect(screen.getByRole("button", { name: /^Save changes to/ })).toBeEnabled());
  expect(retry).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Keep my name" }));
  fireEvent.click(retry);
  fireEvent.click(screen.getByRole("button", { name: /^Save changes to/ }));
  await waitFor(() => expect(attempts).toEqual([0, 0, 1]));
  await waitFor(() => expect(state.draft.snapshot.domains.cards[0].name).toBe("Retained local name"));
  expect(state.live.domains.cards[0].name).toBe("First card");
});


test("deployed content stays inspectable and live tests available during an authoring outage", async () => {
  Object.assign(state, { liveOnly: true, revision: null, writable: false, releases: [], authoringError: "Shared draft unavailable. Live tests remain available." });
  const normal = request;
  request = jest.fn(async (path, options) => {
    const response = await normal(path, options);
    return path.startsWith("/api/admin/workshops?") ? { ...response, capabilities: { liveTests: true } } : response;
  });
  render(<GauntletAuthoring {...props()} />);
  await selectCard();
  expect(screen.getByText("Live content · shared draft unavailable")).toBeVisible();
  expect(screen.getByText(state.authoringError)).toBeVisible();
  expect(screen.getByLabelText("Draft name")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Test", exact: true }));
  expect(await screen.findByRole("button", { name: "Start live duel playtest" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Preview saved draft", hidden: true })).toBeDisabled();
});

test("a lost authoring connection retains conflict values without offering an unknown retry revision", async () => {
  state.revision = 7;
  const normal = request;
  request = jest.fn(async (path, options) => {
    if (path.endsWith("/record")) {
      expect(JSON.parse(options.body).expectedRevision).toBe(7);
      Object.assign(state, { liveOnly: true, revision: null, writable: false, authoringError: "Shared draft unavailable." });
      throw Object.assign(new Error("Refresh to inspect the shared draft."), { status: 409 });
    }
    return normal(path, options);
  });
  render(<GauntletAuthoring {...props()} />);
  await selectCard();
  fireEvent.change(screen.getByLabelText("Draft name"), { target: { value: "Retained through outage" } });
  fireEvent.click(screen.getByRole("button", { name: /^Save changes to/ }));
  await screen.findByText("Live content · shared draft unavailable");
  expect(screen.getByLabelText("Draft name")).toHaveValue("Retained through outage");
  expect(screen.getByLabelText("Draft name")).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Use latest revision for retry" })).not.toBeInTheDocument();
});

test("Publishing returns to its caller rather than the previous card in history", async () => {
  state.live.domains.cards.push({ ...state.live.domains.cards[0], id: "card-two", name: "Second card" });
  state.fields.cards["card-two"] = state.fields.cards["card-one"];
  const options = props(), view = render(<GauntletAuthoring {...options} />);
  await selectCard();
  fireEvent.change(screen.getByLabelText("Search cards"), { target: { value: "Second" } });
  fireEvent.click(screen.getByRole("button", { name: "Inspect Second card" }));
  view.rerender(<GauntletAuthoring {...options} area="Publishing" />);
  fireEvent.click(await screen.findByRole("button", { name: "Back to previous view" }));
  expect(options.onNavigate.mock.calls.at(-1)[0]).toBe("Content");
  view.rerender(<GauntletAuthoring {...options} />);
  expect(screen.getByRole("heading", { name: "Second card" })).toBeVisible();
  expect(screen.getByLabelText("Search cards")).toHaveValue("Second");
  expect(window.location.search).toContain("object=card-two");
});

test("focused section changes retain local values and save multiple fields in one transaction", async () => {
  render(<GauntletAuthoring {...props()} />);
  await selectCard();
  fireEvent.change(screen.getByLabelText("Draft name"), { target: { value: "Local name" } });
  fireEvent.change(screen.getByLabelText("Draft displayed rules text"), { target: { value: "Local wording" } });
  fireEvent.click(screen.getByRole("button", { name: "Mechanics", exact: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Mechanics", exact: true })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Details", exact: true }));
  expect(screen.getByLabelText("Draft name")).toHaveValue("Local name");
  expect(screen.getByLabelText("Draft displayed rules text")).toHaveValue("Local wording");
  fireEvent.click(screen.getByRole("button", { name: /^Save changes to/ }));
  await screen.findByText("2 saved field changes");
  const saves = request.mock.calls.filter(([path]) => path.endsWith("/record"));
  expect(saves).toHaveLength(1);
  expect(JSON.parse(saves[0][1].body)).toMatchObject({ domain: "cards", id: "card-one", expectedRevision: 0, changes: [{field:"name",value:"Local name"},{field:"text",value:"Local wording"}] });
  expect(state.revision).toBe(1);
  expect(state.live.domains.cards[0].name).toBe("First card");
});


test("Save and continue waits for the record acknowledgement and a failed save leaves typing in place", async () => {
  const normal = request; let rejectSave, resolveSave;
  request = jest.fn((path, options) => path.endsWith("/record") ? new Promise((resolve, reject) => { resolveSave = () => resolve(normal(path, options)); rejectSave = reject; }) : normal(path, options));
  render(<GauntletAuthoring {...props()} />);
  await selectCard();
  fireEvent.change(screen.getByLabelText("Draft name"), { target: { value: "Retain until acknowledged" } });
  fireEvent.click(screen.getByRole("button", { name: "Campaigns" }));
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(screen.getByLabelText("Draft name")).toHaveValue("Retain until acknowledged");
  await act(async () => rejectSave(new Error("Network interrupted")));
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(screen.getByLabelText("Draft name")).toHaveValue("Retain until acknowledged");
  expect(state.draft).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await act(async () => resolveSave());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "Inspect Campaign" })).toBeVisible();
  expect(state.draft.snapshot.domains.cards[0].name).toBe("Retain until acknowledged");
});

test("deck record saves exclude private notes and note conflicts require a value choice", async () => {
  const deck = { id: "deck-one", name: "Notes deck", composition: { cards: [] }, status: "active" };
  state.live.domains.decks = [deck]; state.fields.decks = { [deck.id]: { name: { label: "Name", type: "text", maxLength: 160 } } };
  state.privateNotes = { [deck.id]: { value: "Original private note" } };
  const normal = request;
  request = jest.fn(async (path, options) => {
    if (path.endsWith("/notes")) {
      const body = JSON.parse(options.body);
      if (body.expectedRevision !== state.revision) throw Object.assign(new Error("The shared notes changed."), {status:409});
      state.privateNotes[body.id] = {value:body.value}; state.revision++; return clone(state);
    }
    return normal(path, options);
  });
  render(<GauntletAuthoring {...props()} initialDomain={{name:"decks",id:deck.id}} />);
  fireEvent.change(await screen.findByLabelText("Draft name"), { target: {value:"Changed deck name"} });
  fireEvent.change(screen.getByLabelText("Private deck notes"), { target: {value:"My private note"} });
  fireEvent.click(screen.getByRole("button", {name:/^Save changes to/}));
  await screen.findByText("1 saved field change");
  expect(state.privateNotes[deck.id].value).toBe("Original private note");
  expect(screen.getByLabelText("Private deck notes")).toHaveValue("My private note");
  state.privateNotes[deck.id].value = "Other operator note"; state.revision++;
  fireEvent.click(screen.getByRole("button", {name:"Save private notes"}));
  await screen.findByRole("region", {name:"Reconcile shared changes"});
  expect(screen.getByText("Other operator note", {selector:"dd"})).toBeVisible();
  expect(screen.getByRole("button", {name:"Use latest revision for retry"})).toBeDisabled();
  fireEvent.click(screen.getByRole("button", {name:"Use shared private notes"}));
  expect(screen.getByLabelText("Private deck notes")).toHaveValue("Other operator note");
  expect(state.privateNotes[deck.id].value).toBe("Other operator note");
});
