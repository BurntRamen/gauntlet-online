import { render, screen, waitFor } from "@testing-library/react";
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
