import { act, fireEvent, render, screen } from "@testing-library/react";
import ProductionGuide from "./ProductionGuide";
const data = hash => ({ hash, root: { label: "Fixture set" }, savedState: "Saved draft definition", problems: [], modes: [], destination: "Card Library", access: "Released definitions", steps: [{ label: "Cards", state: "saved", detail: "One card", targets: [{ label: "Fixture card", domain: "cards", id: "card", section: "mechanics" }], create: { domain: "cards", defaults: { setId: "set" } } }], url: "/?page=decks" });
test("production links use guarded object targets and create in the selected set", async () => {
  const onInspect = jest.fn(), onCreate = jest.fn();
  render(<ProductionGuide request={async () => data("hash")} domain="sets" id="set" source="draft" hash="hash" revision={1} onInspect={onInspect} onCreate={onCreate} />);
  await screen.findByText("Production path · Fixture set");
  fireEvent.click(screen.getByRole("button", { name: "Fixture card", hidden: true }));
  expect(onInspect).toHaveBeenCalledWith("cards", "card", "mechanics", undefined);
  fireEvent.click(screen.getByRole("button", { name: "Create card", hidden: true }));
  expect(onCreate).toHaveBeenCalledWith({ domain: "cards", defaults: { setId: "set" } });
});
test("late responses for an older content hash cannot replace the current guide", async () => {
  let finishOld; const request = jest.fn(url => url.includes("hash=old") ? new Promise(resolve => { finishOld = resolve; }) : Promise.resolve(data("new")));
  const view = render(<ProductionGuide request={request} domain="sets" id="set" source="draft" hash="old" />);
  view.rerender(<ProductionGuide request={request} domain="sets" id="set" source="draft" hash="new" />);
  await screen.findByText("Production path · Fixture set");
  await act(async () => finishOld({ ...data("old"), root: { label: "Stale set" } }));
  expect(screen.queryByText(/Stale set/)).not.toBeInTheDocument();
});
