import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import GauntletAuthoring from "./GauntletAuthoring";

const clone = (value) => JSON.parse(JSON.stringify(value));
let state, request;
const props = () => ({ request, area: "Content", revision: 0, onPublished: jest.fn(), onUnsavedChange: jest.fn() });
beforeEach(() => {
  const domains = { campaigns: [{ id: "rumin", commanderName: "Campaign", pitch: "Live story" }], encounters: [], factions: [], cards: [{ id: "card-one", name: "First card", text: "Engine effect wording", value: 3 }], decks: [], characters: [], assets: [], game: [{ id: "practice", name: "Practice", description: "Practice description" }] };
  state = { revision: 0, writable: true, activeReleaseId: "release-one", live: { domains, engine: { startingLife: 42 } }, draft: null, changes: [], validation: { valid: true, errors: [], warnings: [] }, releases: [{ id: "release-one", label: "Original release", sha256: "hash", compatible: true, createdAt: "2026-10-02" }], activations: [], fields: {
    campaigns: { rumin: { pitch: { label: "Introduction", type: "text", maxLength: 4000 } } },
    cards: { "card-one": { name: { label: "Name", type: "text", maxLength: 160 }, text: { label: "Displayed rules text", type: "text", maxLength: 2000 } } },
    game: { practice: { name: { label: "Mode name", type: "text", maxLength: 80 } } }
  } };
  request = jest.fn(async (path, options) => {
    const body = options ? JSON.parse(options.body) : null;
    if (path.endsWith("/draft")) {
      expect(body.expectedRevision).toBe(state.revision);
      state.draft ||= { snapshot: clone(state.live), previewedHash: null };
      const live = state.live.domains[body.domain].find((row) => row.id === body.id);
      const row = state.draft.snapshot.domains[body.domain].find((entry) => entry.id === body.id);
      row[body.field] = body.revert ? live[body.field] : body.value;
      state.changes = state.changes.filter((entry) => entry.id !== row.id || entry.field !== body.field);
      if (row[body.field] !== live[body.field]) state.changes.push({ domain: body.domain, id: row.id, field: body.field, live: live[body.field], draft: row[body.field] });
      state.draft.previewedHash = null; state.revision++;
    }
    if (path.endsWith("/preview")) { state.draft.previewedHash = "previewed"; state.revision++; return { ...clone(state), preview: { manifest: { cards: clone(state.draft.snapshot.domains.cards), collectorVariants: [], campaigns: {} } } }; }
    if (path.endsWith("/publish")) { state.live = state.draft.snapshot; state.draft = null; state.changes = []; state.activeReleaseId = "release-two"; state.revision++; }
    if (path.endsWith("/discard")) { state.draft = null; state.changes = []; state.revision++; }
    return clone(state);
  });
});

async function selectCard() { fireEvent.click(await screen.findByRole("button", { name: /^Cards/ })); fireEvent.click(screen.getByRole("button", { name: "Inspect First card" })); }

test("pending GitHub publication keeps the deployed release active and cancellation preserves the draft", async () => {
  state.writable = false;
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
});

test("structured fields show live/draft values, save cross-domain changes, and revert without editing mechanics", async () => {
  const properties = props(); const view = render(<GauntletAuthoring {...properties} />);
  await selectCard();
  expect(screen.getByLabelText("Draft name")).toHaveValue("First card");
  expect(screen.queryByLabelText("Draft value")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Draft name"), { target: { value: "Edited card" } });
  expect(screen.getByText("Unsaved")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Save name to draft" }));
  await screen.findByText("1 saved field change");
  expect(state.live.domains.cards[0].name).toBe("First card");
  expect(screen.getByLabelText("Draft name")).toHaveValue("Edited card");
  view.rerender(<GauntletAuthoring {...properties} area="Game" />);
  fireEvent.click(screen.getByRole("button", { name: "Inspect Practice" }));
  fireEvent.change(screen.getByLabelText("Draft mode name"), { target: { value: "New practice" } });
  fireEvent.click(screen.getByRole("button", { name: "Save mode name to draft" }));
  await screen.findByText("2 saved field changes");
  fireEvent.click(screen.getByRole("button", { name: "Revert mode name to live" }));
  await screen.findByText("1 saved field change");
  expect(screen.getByLabelText("Draft mode name")).toHaveValue("Practice");
});

test("preview uses the real card component and publication requires explicit review confirmation", async () => {
  const properties = props(); const view = render(<GauntletAuthoring {...properties} />);
  await selectCard();
  fireEvent.change(screen.getByLabelText("Draft name"), { target: { value: "Preview card" } });
  fireEvent.click(screen.getByRole("button", { name: "Save name to draft" }));
  await screen.findByText("1 saved field change");
  fireEvent.click(screen.getByRole("button", { name: "Preview saved draft" }));
  const preview = await screen.findByRole("region", { name: "Isolated draft preview" });
  expect(within(preview).getByAltText("Preview card illustration")).toBeVisible();
  expect(state.live.domains.cards[0].name).toBe("First card");
  expect(request.mock.calls.every(([path]) => path.startsWith("/api/admin/authoring"))).toBe(true);
  view.rerender(<GauntletAuthoring {...properties} area="Publishing" />);
  expect(screen.getByRole("button", { name: "Publish release" })).toBeDisabled();
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
  request = jest.fn((path, options) => path.endsWith("/draft") ? Promise.reject(new Error("Content changed in another session. Refresh before saving.")) : successful(path, options));
  render(<GauntletAuthoring {...props()} />);
  await selectCard();
  expect(screen.getAllByText(/Name is required/).length).toBeGreaterThan(1);
  expect(screen.getByRole("button", { name: "Preview saved draft" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Draft name"), { target: { value: "Keep my edit" } });
  fireEvent.click(screen.getByRole("button", { name: "Save name to draft" }));
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
  fireEvent.click(await screen.findByRole("button", { name: new RegExp("^" + tab) }));
  fireEvent.click(screen.getByRole("button", { name: "Inspect " + name }));
  fireEvent.change(screen.getByLabelText("Draft " + fieldLabel.toLowerCase()), { target: { value: "asset-selected" } });
  fireEvent.click(screen.getByRole("button", { name: "Save " + fieldLabel.toLowerCase() + " to draft" }));
  await screen.findByText("1 saved field change");
  fireEvent.click(screen.getByRole("button", { name: "Preview saved draft" }));
  const preview = await screen.findByRole("region", { name: "Isolated draft preview" });
  expect(within(preview).getByRole("img", { name })).toHaveAttribute("src", resolvedArtwork);
});
