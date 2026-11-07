import { useEffect, useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Players from "./Players";
const profiles = [{ id: "one", name: "First player", campaigns: [], decks: [], matchReferences: [], unlocks: {} }, { id: "two", name: "Second player", campaigns: [], decks: [], matchReferences: [], unlocks: {} }];
function useData(request, path, revision) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => { let active = true; request(path).then(data => { if (active) setState({ data }); }); return () => { active = false; }; }, [request, path, revision]);
  return state;
}
const State = ({ state, children }) => state.data ? children(state.data) : <p>Loading</p>;
const Facts = () => null, Json = ({ title }) => <details><summary>{title}</summary></details>;
const makeProps = request => ({ request, guard: { current: action => { action?.(); return true; } }, revision: 1, useData, State, Facts, Json, date: value => value || "Not recorded", label: value => value });
async function edit() {
  fireEvent.click(await screen.findByRole("button", { name: "View player First player" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit player name" }));
  fireEvent.change(screen.getByLabelText("Player name"), { target: { value: "Corrected name" } });
  fireEvent.change(screen.getByLabelText("Correction reason"), { target: { value: "Requested by account owner" } });
}
test("profile sections preserve corrections and failed departure save retains input until acknowledged", async () => {
  let failure = true;
  const request = jest.fn(async (path, options) => {
    if (path.endsWith("/metadata")) { expect(JSON.parse(options.body)).toEqual({ expectedName: "First player", metadata: { name: "Corrected name" }, reason: "Requested by account owner" }); if (failure) throw new Error("Save unavailable"); return {}; }
    return { players: profiles, hasMore: false };
  });
  render(<Players {...makeProps(request)} />); await edit();
  fireEvent.click(within(screen.getByRole("navigation", { name: "Player details" })).getByRole("button", { name: "Decks" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Player name")).toHaveValue("Corrected name");
  fireEvent.click(screen.getByRole("button", { name: "View player Second player" }));
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent("immediately, with its reason");
  fireEvent.click(within(dialog).getByRole("button", { name: "Save and continue" }));
  await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent("Save unavailable"));
  expect(screen.getByLabelText("Player name")).toHaveValue("Corrected name");
  expect(screen.queryByRole("heading", { name: "Second player" })).not.toBeInTheDocument();
  failure = false;
  fireEvent.click(within(dialog).getByRole("button", { name: "Save and continue" }));
  expect(await screen.findByRole("heading", { name: "Second player" })).toBeVisible();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
test("stale player metadata shows both names and requires explicit reconciliation", async () => {
  let revision = false;
  const request = jest.fn(async path => {
    if (path.endsWith("/metadata")) { revision = true; throw Object.assign(new Error("Name changed elsewhere"), { status: 409 }); }
    return { players: revision ? [{ ...profiles[0], name: "Other operator name" }] : profiles, hasMore: false };
  });
  render(<Players {...makeProps(request)} />); await edit();
  fireEvent.click(screen.getByRole("button", { name: "Save player name" }));
  const conflict = await screen.findByRole("region", { name: "Player name conflict" });
  expect(conflict).toHaveTextContent("Other operator name"); expect(conflict).toHaveTextContent("Corrected name");
  expect(screen.getByRole("button", { name: "Save player name" })).toBeDisabled();
  fireEvent.click(within(conflict).getByRole("button", { name: "Use latest name as correction baseline" }));
  expect(screen.getByRole("button", { name: "Save player name" })).toBeEnabled();
  expect(screen.getByLabelText("Player name")).toHaveValue("Corrected name");
});

test("departure save explains invalid corrections without sending a write or losing input", async () => {
  const request = jest.fn(async () => ({ players: profiles, hasMore: false }));
  render(<Players {...makeProps(request)} />); await edit();
  fireEvent.change(screen.getByLabelText("Correction reason"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "View player Second player" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Save and continue" }));
  expect(within(dialog).getByRole("alert")).toHaveTextContent("Complete a valid player name and correction reason");
  expect(request.mock.calls.some(([path]) => path.endsWith("/metadata"))).toBe(false);
  fireEvent.click(within(dialog).getByRole("button", { name: "Keep editing" }));
  expect(screen.getByLabelText("Player name")).toHaveValue("Corrected name");
});
