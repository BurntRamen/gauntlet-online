import { act, fireEvent, render, screen } from "@testing-library/react";
import ProductionPipeline from "./ProductionPipeline";

const state = { revision: 3, writable: true, draft: { hash: "current" }, guide: require("../../../server/adminAuthoringGuide") };
const task = { id: "set", root: "set-one" };
const data = { revision: 3, hash: "current", definition: { name: "Build a card set", noun: "set", outcome: "Playable cards in their configured modes." }, choices: [{ id: "set-one", label: "Working set" }], root: { id: "set-one", label: "Working set" }, open: { domain: "sets", id: "set-one" },
  steps: [{ name: "Cards", detail: "One saved card", targets: [{ domain: "cards", id: "card-one", section: "artwork", label: "Working card" }], create: { domain: "cards", defaults: { setId: "set-one" }, label: "Add card to this set" } }], readiness: { validated: true, ready: false }, releaseScope: "All saved changes are included." };

test("a guarded dependency detour keeps its originating controls until navigation is accepted", async () => {
  let accept;
  const inspect = jest.fn((domain, id, section, field, accepted) => { accept = accepted; });
  render(<ProductionPipeline request={async () => data} state={state} task={task} onInspect={inspect} />);
  await screen.findByRole("button", { name: "Continue pipeline" });
  fireEvent.click(screen.getByRole("button", { name: "Continue pipeline" }));
  const button = screen.getByRole("button", { name: "Working card", exact: true });
  fireEvent.click(button);
  expect(inspect).toHaveBeenCalledWith("cards", "card-one", "artwork", undefined, expect.any(Function));
  expect(button).toBeVisible();
  act(() => accept());
  expect(screen.queryByRole("button", { name: "Working card", exact: true })).not.toBeInTheDocument();
});

test("creating a dependency retains the pipeline's root defaults and never publishes", async () => {
  const create = jest.fn(), review = jest.fn();
  render(<ProductionPipeline request={async () => data} state={state} task={task} onCreate={create} onReview={review} />);
  fireEvent.click(await screen.findByRole("button", { name: "Continue pipeline" }));
  fireEvent.click(screen.getByRole("button", { name: "Add card to this set", exact: true }));
  expect(create).toHaveBeenCalledWith({ domain: "cards", defaults: { setId: "set-one" }, label: "Add card to this set" }, expect.any(Function));
  expect(review).not.toHaveBeenCalled();
  expect(screen.getByText("All saved changes are included.")).toBeVisible();
});

test("late task responses cannot reopen an earlier working object", async () => {
  let old;
  const request = jest.fn(url => url.includes("id=set-one") ? new Promise(resolve => { old = resolve; }) : Promise.resolve({ ...data, root: { id: "set-two", label: "Second set" } }));
  const view = render(<ProductionPipeline request={request} state={state} task={task} />);
  view.rerender(<ProductionPipeline request={request} state={state} task={{ ...task, root: "set-two" }} />);
  await screen.findByRole("heading", { name: "Build a card set · Second set" });
  await act(async () => old(data));
  expect(screen.queryByRole("heading", { name: "Build a card set · Working set" })).not.toBeInTheDocument();
});
