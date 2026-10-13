import { act, render, screen, waitFor } from "@testing-library/react";
import { lazy, Suspense } from "react";
import WorkshopNavigation from "./WorkshopNavigation";

const target = { domain: "encounters", id: "chapter-one", section: "story" };
let oldScroll;
beforeEach(() => {
  oldScroll = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = jest.fn();
});
afterEach(() => { HTMLElement.prototype.scrollIntoView = oldScroll; jest.restoreAllMocks(); });

test("direct section links open their collapsed ancestors, scroll and focus the actual section", () => {
  render(<><details aria-label="Story drawer"><summary>Story</summary><section id="workshop-story" aria-label="Story section" tabIndex={-1}>Encounter story</section></details><WorkshopNavigation target={target} /></>);
  expect(screen.getByRole("group", { name: "Story drawer" })).toHaveAttribute("open");
  expect(screen.getByRole("region", { name: "Story section" })).toHaveFocus();
  expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ block: "start" });
});

test("the direct link waits for a lazily arriving section and disconnects once focused", async () => {
  const disconnect = jest.spyOn(MutationObserver.prototype, "disconnect");
  const view = render(<><p>Loading card workshop</p><WorkshopNavigation target={{ domain: "cards", id: "card-one", section: "mechanics" }} /></>);
  expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
  view.rerender(<><section id="card-mechanics" aria-label="Card mechanics" tabIndex={-1}>Effect editor</section><WorkshopNavigation target={{ domain: "cards", id: "card-one", section: "mechanics" }} /></>);
  await waitFor(() => expect(screen.getByRole("region", { name: "Card mechanics" })).toHaveFocus());
  expect(disconnect).toHaveBeenCalled();
});

test("unknown or hidden sections do not steal focus and missing section starts no observer", async () => {
  const observe = jest.spyOn(MutationObserver.prototype, "observe");
  const view = render(<><button autoFocus>Current editor</button><div hidden><section id="engine-mechanics" tabIndex={-1}>Hidden editor</section></div><WorkshopNavigation target={{ domain: "engine", section: "mechanics" }} /></>);
  expect(screen.getByRole("button", { name: "Current editor" })).toHaveFocus();
  expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
  view.rerender(<><button>Current editor</button><WorkshopNavigation target={{ domain: "engine", section: "unknown-section" }} /></>);
  expect(screen.getByRole("button", { name: "Current editor" })).toHaveFocus();
  const calls = observe.mock.calls.length;
  view.rerender(<><button>Current editor</button><WorkshopNavigation target={{ domain: "cards", id: "one" }} /></>);
  expect(observe).toHaveBeenCalledTimes(calls);
});

test("unmount cleans up a pending observer and later sections are left alone", async () => {
  const disconnect = jest.spyOn(MutationObserver.prototype, "disconnect");
  const view = render(<WorkshopNavigation target={target} />);
  view.unmount();
  expect(disconnect).toHaveBeenCalled();
  render(<><button autoFocus>Another editor</button><section id="workshop-story" tabIndex={-1}>Late section</section></>);
  await waitFor(() => expect(screen.getByRole("button", { name: "Another editor" })).toHaveFocus());
  expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
});

test("field links wait for the selected object before focusing its editor", async () => {
  const fieldTarget = { domain: "modes", id: "practice", field: "heroTitle" };
  const view = render(<><button autoFocus>Old selection</button><form id="admin-field-heroTitle"><textarea aria-label="Old heading" /></form><WorkshopNavigation target={fieldTarget} ready={false} /></>);
  expect(screen.getByRole("button")).toHaveFocus();
  view.rerender(<><form id="admin-field-heroTitle"><textarea aria-label="New heading" /></form><WorkshopNavigation target={fieldTarget} /></>);
  await waitFor(() => expect(screen.getByRole("textbox", { name: "New heading" })).toHaveFocus());
});

test("selecting the same search result again returns focus without adding navigation history", () => {
  const fieldTarget = { domain: "modes", id: "practice", field: "heroTitle" };
  const content = request => <><button>Search result</button><form id="admin-field-heroTitle"><textarea aria-label="Page heading" /></form><WorkshopNavigation target={fieldTarget} focusRequest={request} /></>;
  const view = render(content({}));
  screen.getByRole("button").focus();
  view.rerender(content({}));
  expect(screen.getByRole("textbox")).toHaveFocus();
});

test("a late preview restores field focus after the workshop is hidden and revealed", async () => {
  let resolvePreview;
  const Preview = lazy(() => new Promise(resolve => { resolvePreview = resolve; }));
  const fieldTarget = { domain: "modes", id: "practice", field: "heroTitle" };
  const content = preview => <Suspense fallback={<p>Loading preview</p>}>
    <WorkshopNavigation target={fieldTarget} />
    <form id="admin-field-heroTitle"><textarea aria-label="Page heading" /></form>
    {preview && <Preview />}
  </Suspense>;
  const view = render(content(false));
  const heading = screen.getByRole("textbox");
  expect(heading).toHaveFocus();
  view.rerender(content(true));
  expect(screen.getByText("Loading preview")).toBeVisible();
  // Real browsers blur controls when Suspense hides them with display:none.
  heading.blur();
  await act(async () => { resolvePreview({ default: () => <p>Preview ready</p> }); });
  expect(screen.getByText("Preview ready")).toBeVisible();
  expect(heading).toHaveFocus();
});
