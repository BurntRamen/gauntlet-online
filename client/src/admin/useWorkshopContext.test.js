import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import useWorkshopContext, { targetFromLocation, workshopTarget } from "./useWorkshopContext";
import UnsavedChangesDialog from "./UnsavedChangesDialog";

let workspace;
function Harness({ initialDirty = false, busy = false, onDiscard = jest.fn(), onBusy = jest.fn(), onNavigate = jest.fn(), beforeNavigate, onExit }) {
  const [dirty, setDirty] = useState(initialDirty);
  workspace = useWorkshopContext({ initialTarget: { domain: "cards", id: "spear" }, dirty, busy, onDiscard: () => { onDiscard(); setDirty(false); }, onBusy, onNavigate, beforeNavigate, onExit });
  return <><p>{dirty ? "Local values present" : "Local values clear"}</p><p data-testid="target">{workspace.target.domain}:{workspace.target.id}</p><button onClick={() => workspace.navigate({ domain: "encounters", id: "first", section: "story" })}>Open encounter</button>{workspace.pending && <UnsavedChangesDialog onKeep={workspace.cancel} onDiscard={workspace.discard} />}</>;
}

beforeEach(() => { window.history.replaceState(null, "", "/admin/gauntlet"); jest.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

test("departure retains dirty values on cancel and only discards local values before continuation", () => {
  const discarded = jest.fn(), navigated = jest.fn();
  render(<Harness initialDirty onDiscard={discarded} onNavigate={navigated} />);
  fireEvent.click(screen.getByText("Open encounter"));
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.getByText("Local values present")).toBeVisible();
  expect(screen.getByTestId("target")).toHaveTextContent("cards:spear");
  expect(discarded).not.toHaveBeenCalled();
  expect(navigated).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Open encounter"));
  fireEvent.click(screen.getByRole("button", { name: "Discard local edits and continue" }));
  expect(discarded).toHaveBeenCalledTimes(1);
  expect(navigated).toHaveBeenCalledWith({ domain: "encounters", id: "first", section: "story" });
  expect(screen.getByText("Local values clear")).toBeVisible();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("busy operations refuse departure and execute neither callbacks nor history changes", () => {
  const onBusy = jest.fn(), next = jest.fn();
  render(<Harness busy onBusy={onBusy} />);
  act(() => expect(workspace.requestLeave(next)).toBe(false));
  expect(next).not.toHaveBeenCalled();
  expect(onBusy).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(window.location.search).toBe("");
});

test("returning from Publishing to the selected object reopens Design without duplicating history or losing context", () => {
  window.history.replaceState(null, "", "/admin/gauntlet?workshop=cards&object=spear");
  let area = "Publishing";
  const onNavigate = jest.fn(() => { area = "Design"; });
  const push = jest.spyOn(window.history, "pushState");
  render(<Harness onNavigate={onNavigate} />);
  act(() => workspace.remember({ query: "spear", section: "mechanics", scroll: 480 }));
  const target = workspace.target;
  act(() => workspace.navigate({ domain: "cards", id: "spear" }));
  expect(area).toBe("Design");
  expect(onNavigate).toHaveBeenCalledWith(target);
  expect(workspace.target).toBe(target);
  expect(workspace.context).toEqual({ query: "spear", section: "mechanics", scroll: 480 });
  expect(workspace.backCount).toBe(0);
  expect(push).not.toHaveBeenCalled();
});

test("same-object return navigation still resolves local edits before changing the visible view", () => {
  window.history.replaceState(null, "", "/admin/gauntlet?workshop=cards&object=spear");
  const onNavigate = jest.fn(), onDiscard = jest.fn();
  render(<Harness initialDirty onNavigate={onNavigate} onDiscard={onDiscard} />);
  act(() => workspace.navigate({ domain: "cards", id: "spear" }));
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(onNavigate).not.toHaveBeenCalled();
  expect(onDiscard).not.toHaveBeenCalled();
  expect(screen.getByText("Local values present")).toBeVisible();
  act(() => workspace.navigate({ domain: "cards", id: "spear" }));
  fireEvent.click(screen.getByRole("button", { name: "Discard local edits and continue" }));
  expect(onDiscard).toHaveBeenCalledTimes(1);
  expect(onNavigate).toHaveBeenCalledTimes(1);
  expect(workspace.target.id).toBe("spear");
  expect(workspace.backCount).toBe(0);
});

test("URL navigation carries identifiers only and rejects unsupported domains and section values", () => {
  expect(workshopTarget({ domain: "script", id: "one" })).toEqual({ domain: "encounters", id: null });
  expect(workshopTarget({ domain: "cards", id: "x".repeat(241), section: "<script>" })).toEqual({ domain: "cards", id: null, section: null });
  window.history.replaceState(null, "", "/?match=old-public-view&token=private-token");
  render(<Harness />);
  act(() => workspace.navigate({ domain: "card-effects", id: "spear-effect", cardId: "spear", section: "mechanics", formValues: "private-edits", token: "private-token" }));
  expect(window.location.search).not.toContain("private");
  expect(window.location.pathname).toBe("/admin/gauntlet");
  expect(window.location.search).not.toContain("match=");
  expect(window.history.state.workshopTarget).toEqual({ domain: "card-effects", id: "spear-effect", cardId: "spear", section: "mechanics" });
  expect(targetFromLocation()).toEqual(window.history.state.workshopTarget);
});

test("per-workshop search context survives navigation and browser back/forward restores targets", () => {
  render(<Harness />);
  act(() => workspace.remember({ query: "spear", scroll: 150, section: "mechanics" }));
  act(() => workspace.navigate({ domain: "encounters", id: "first" }));
  act(() => workspace.remember({ query: "campaign", section: "story" }));
  act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: { gauntletWorkshop: 0 } })));
  expect(workspace.target).toEqual({ domain: "cards", id: "spear" });
  expect(workspace.context).toMatchObject({ query: "spear", scroll: 0, section: "mechanics" });
  act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: { gauntletWorkshop: 1 } })));
  expect(workspace.target).toEqual({ domain: "encounters", id: "first", section: null });
  expect(workspace.context.query).toBe("campaign");
});

test("dirty browser departure is restored until discard and refresh warns about local values", () => {
  const go = jest.spyOn(window.history, "go").mockImplementation(() => {});
  render(<Harness initialDirty />);
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: null })));
  expect(go).toHaveBeenLastCalledWith(1);
  expect(screen.getByRole("dialog")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Discard local edits and continue" }));
  // The replacement traversal waits until history has returned to this entry.
  expect(go).toHaveBeenCalledTimes(1);
  act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: { gauntletWorkshop: 0 } })));
  expect(go).toHaveBeenLastCalledWith(-1);
});

test("capture blocks downstream public routing until a dirty departure is resolved", () => {
  const go = jest.spyOn(window.history, "go").mockImplementation(() => {});
  const downstream = jest.fn(), onExit = jest.fn();
  // App registers its handler before the lazy Admin module mounts.
  window.addEventListener("popstate", downstream);
  try {
    render(<Harness initialDirty onExit={onExit} />);
    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: null })));
    expect(downstream).not.toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();
    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: { gauntletWorkshop: 0 } })));
    expect(downstream).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByText("Local values present")).toBeVisible();
    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: null })));
    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: { gauntletWorkshop: 0 } })));
    fireEvent.click(screen.getByRole("button", { name: "Discard local edits and continue" }));
    expect(go).toHaveBeenLastCalledWith(-1);
    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: null })));
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(downstream).toHaveBeenCalledTimes(1);
  } finally { window.removeEventListener("popstate", downstream); }
});

test("a separate Players guard cancels browser Back before workshop context changes", () => {
  const go = jest.spyOn(window.history, "go").mockImplementation(() => {});
  const beforeNavigate = jest.fn().mockReturnValue(true), downstream = jest.fn();
  window.addEventListener("popstate", downstream);
  try {
    render(<Harness beforeNavigate={beforeNavigate} />);
    act(() => workspace.navigate({ domain: "encounters", id: "first" }));
    act(() => workspace.remember({ query: "Remember this filter" }));
    beforeNavigate.mockReturnValue(false);
    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: { gauntletWorkshop: 0 } })));
    expect(go).toHaveBeenLastCalledWith(1);
    expect(workspace.target).toEqual({ domain: "encounters", id: "first", section: null });
    expect(workspace.context.query).toBe("Remember this filter");
    expect(workspace.backCount).toBe(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(downstream).not.toHaveBeenCalled();
    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: { gauntletWorkshop: 1 } })));
    beforeNavigate.mockReturnValue(true);
    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: { gauntletWorkshop: 0 } })));
    expect(workspace.target.id).toBe("spear");
    expect(workspace.backCount).toBe(0);
  } finally { window.removeEventListener("popstate", downstream); }
});

test("pending requests stop both a browser departure and its compensating event", () => {
  const go = jest.spyOn(window.history, "go").mockImplementation(() => {});
  const downstream = jest.fn(), onExit = jest.fn();
  window.addEventListener("popstate", downstream);
  try {
    render(<Harness busy onExit={onExit} />);
    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: null })));
    expect(go).toHaveBeenLastCalledWith(1);
    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: { gauntletWorkshop: 0 } })));
    expect(onExit).not.toHaveBeenCalled();
    expect(downstream).not.toHaveBeenCalled();
  } finally { window.removeEventListener("popstate", downstream); }
});

test("browser Forward also waits for a pending request without advancing the selected object", () => {
  const go = jest.spyOn(window.history, "go").mockImplementation(() => {});
  const { rerender } = render(<Harness />);
  act(() => workspace.navigate({ domain: "encounters", id: "first" }));
  act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: { gauntletWorkshop: 0 } })));
  rerender(<Harness busy />);
  act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: { gauntletWorkshop: 1 } })));
  expect(go).toHaveBeenLastCalledWith(-1);
  expect(workspace.target.id).toBe("spear");
});

test("workspace tabs restore the same object's scroll while a new object starts at the top", async () => {
  const scrollDescriptor = Object.getOwnPropertyDescriptor(window, "scrollY");
  try {
    render(<Harness />);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 630 });
    act(() => workspace.navigate({ domain: "encounters", id: "first" }));
    Object.defineProperty(window, "scrollY", { configurable: true, value: 240 });
    act(() => workspace.navigate({ domain: "cards", id: "spear" }));
    await waitFor(() => expect(window.scrollTo).toHaveBeenLastCalledWith(0, 630));
    act(() => workspace.navigate({ domain: "cards", id: "shield" }));
    await waitFor(() => expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0));
  } finally { Object.defineProperty(window, "scrollY", scrollDescriptor); }
});

test("dialog keeps keyboard focus inside, supports escape, and restores its trigger", () => {
  render(<Harness initialDirty />);
  const trigger = screen.getByText("Open encounter"); trigger.focus(); fireEvent.click(trigger);
  const keep = screen.getByText("Keep editing"), discard = screen.getByText("Discard local edits and continue");
  fireEvent.keyDown(keep, { key: "Tab", shiftKey: true }); expect(discard).toHaveFocus();
  fireEvent.keyDown(discard, { key: "Tab" }); expect(keep).toHaveFocus();
  fireEvent.keyDown(keep, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(trigger).toHaveFocus();
});
