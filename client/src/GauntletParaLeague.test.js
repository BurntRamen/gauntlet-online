import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import GauntletParaLeague from "./GauntletParaLeague";

function fixture() {
  const season = { id: "season-one", name: "First season", goldBudget: 4000, status: "draft" };
  const fields = { seasons: { id: { type: "text", label: "ID" }, name: { type: "text", label: "Name" }, goldBudget: { type: "integer", label: "Gold cap", min: 0, max: 10000 }, status: { type: "choice", label: "State", options: ["draft", "archived"] } } };
  return { state: { revision: 5, writable: true, live: { paraLeague: { seasons: [season], events: [], products: [] } }, validation: { valid: true, errors: [], warnings: [] }, assetLibrary: [], para: { fields, templates: { seasons: { ...season, id: "", name: "" } }, capabilities: { message: "Configuration only" }, invariants: ["Free entry"], summary: [] } }, act: jest.fn(async () => true), busy: false, request: jest.fn(), onDirty: jest.fn() };
}
function tab(name) { fireEvent.click(within(screen.getByRole("navigation", { name: "Para workspaces" })).getByRole("button", { name, exact: true })); }

test("structured creation sends typed fields with no source or JSON editing", async () => {
  const props = fixture(); render(<GauntletParaLeague {...props} />);
  tab("Seasons"); fireEvent.click(screen.getByRole("button", { name: "New season" }));
  fireEvent.change(screen.getByLabelText("ID"), { target: { value: "second-season" } });
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Second season" } });
  fireEvent.change(screen.getByLabelText("Gold cap"), { target: { value: "3200" } });
  expect(props.onDirty).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole("button", { name: "Save definition to draft" }));
  await waitFor(() => expect(props.act).toHaveBeenCalledWith("para-draft", { operation: "create", domain: "seasons", id: "second-season", value: { id: "second-season", name: "Second season", goldBudget: 3200, status: "draft" } }));
  expect(props.state.live.paraLeague.seasons).toHaveLength(1);
  await waitFor(() => expect(screen.queryByLabelText("Name")).not.toBeInTheDocument());
});

test("failed save preserves values; navigation cancellation protects unsaved work", async () => {
  const props = fixture(); props.act.mockResolvedValue(false);
  render(<GauntletParaLeague {...props} />); tab("Seasons");
  fireEvent.click(screen.getByRole("button", { name: /First season/ }));
  expect(screen.getByLabelText("ID")).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Keep this edit" } });
  fireEvent.click(screen.getByRole("button", { name: "Save definition to draft" }));
  await waitFor(() => expect(props.act).toHaveBeenCalled());
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  tab("Overview");
  expect(screen.getByLabelText("Name")).toHaveValue("Keep this edit");
  expect(confirm).toHaveBeenCalled(); confirm.mockRestore();
});

test("read-only stores deny creation and mutation", () => {
  const props = fixture(); props.state.writable = false;
  render(<GauntletParaLeague {...props} />); tab("Seasons");
  expect(screen.getByRole("button", { name: "New season" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /First season/ }));
  expect(screen.getByLabelText("Name")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Archive definition" })).toBeDisabled();
});

test("simulator sends outcomes and revision, then clears projections when configuration changes", async () => {
  const props = fixture();
  props.state.live.paraLeague.events = [{ id: "first-run", seasonId: "season-one", name: "Faction Open", week: 1, status: "draft", winTarget: 7, lossLimit: 3 }, { id: "event-one", seasonId: "season-one", name: "Invitational", week: 7, status: "draft" }];
  props.request.mockResolvedValue({ qualifyingPrestige: 30, combinedPrestige: 30, countedEventIds: ["first-run"], targetEligibleByScore: true });
  const view = render(<GauntletParaLeague {...props} />); tab("Prestige");
  fireEvent.change(screen.getByLabelText("Target event"), { target: { value: "event-one" } });
  fireEvent.change(screen.getByLabelText("Week 1: Faction Open"), { target: { value: "7-0" } });
  fireEvent.click(screen.getByRole("button", { name: "Simulate saved rules" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Qualifying Prestige: 30");
  expect(JSON.parse(props.request.mock.calls.find(([path]) => path.endsWith("para-simulate"))[1].body)).toEqual({ expectedRevision: 5, seasonId: "season-one", eventId: "event-one", results: [{ eventId: "first-run", wins: 7, losses: 0 }] });
  view.rerender(<GauntletParaLeague {...props} state={{ ...props.state, revision: 6 }} />);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
