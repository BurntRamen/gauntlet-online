import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CompetitionWorkshop from "./CompetitionWorkshop";

const row = { id: "event-one", name: "Original event", status: "draft", maxWins: 5, rewards: [{ wins: 1, gold: 10, boosterCredits: 0, cardStyleId: "" }] };
function fixture(status = "draft") {
  return { writable: true, live: { domains: { assets: [] }, competition: { ranked: [], events: [{ ...row, status }] } }, competition: {
    fields: { ranked: {}, events: { name: { type: "text", label: "Name" }, maxWins: { type: "integer", label: "Win target", min: 1, max: 12 } } }, sourceSeason: { displayName: "Original" }, sourceEvents: [], preview: { ranked: [], events: [] }
  } };
}
let previousClone;
beforeAll(() => { previousClone = global.structuredClone; global.structuredClone = value => JSON.parse(JSON.stringify(value)); });
afterAll(() => { global.structuredClone = previousClone; });

test("deep-linked event editing keeps failed changes and sends ordered numeric reward tiers", async () => {
  const action = jest.fn().mockResolvedValue(false);
  render(<CompetitionWorkshop state={fixture()} act={action} onDirty={jest.fn()} initialTarget={{ domain: "events", id: row.id, field: "name" }} />);
  await waitFor(() => expect(screen.getByLabelText("Name")).toHaveFocus());
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Local event" } });
  fireEvent.change(screen.getByLabelText("Tier 1 gold"), { target: { value: "25" } });
  fireEvent.click(screen.getByRole("button", { name: "Add tier" }));
  fireEvent.change(screen.getByLabelText("Tier 2 wins"), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Save competition draft" }));
  await waitFor(() => expect(action).toHaveBeenCalledWith("competition-draft", { domain: "events", operation: "update", id: row.id, value: { ...row, name: "Local event", rewards: [{ ...row.rewards[0], gold: 25 }, { wins: 3, gold: 0, boosterCredits: 0, cardStyleId: "" }] } }));
  expect(screen.getByLabelText("Name")).toHaveValue("Local event");
  expect(screen.getByRole("button", { name: "Duplicate definition" })).toBeDisabled();
});

test("published rules and rewards stay pinned while duplicate selects the server-created draft", async () => {
  const state = fixture("active"), duplicated = { ...row, id: "server-copy", name: "Draft copy" };
  const acknowledged = { ...state, draft: { snapshot: { ...state.live, competition: { ranked: [], events: [...state.live.competition.events, duplicated] } } } };
  const action = jest.fn().mockResolvedValue(acknowledged);
  render(<CompetitionWorkshop state={state} act={action} onDirty={jest.fn()} initialTarget={{ domain: "events", id: row.id }} />);
  expect(screen.getByLabelText("Win target")).toBeDisabled();
  expect(screen.getByLabelText("Tier 1 gold")).toBeDisabled();
  expect(screen.getByLabelText("Name")).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Duplicate definition" }));
  await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue("Draft copy"));
  expect(action).toHaveBeenCalledWith("competition-draft", { domain: "events", operation: "duplicate", sourceId: row.id });
  expect(screen.getByLabelText("Win target")).toBeEnabled();
});
