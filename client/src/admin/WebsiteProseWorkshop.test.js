import { fireEvent, render, screen } from "@testing-library/react";
import WebsiteProseWorkshop from "./WebsiteProseWorkshop";
const state = { live: { domains: { game: [{ id: "practice", name: "Practice", playPageTitle: "Saved heading" }] } }, fields: { game: { practice: { name: {}, description: {}, playPageTitle: { defaultValue: "Play" }, playPageDescription: { defaultValue: "Pick a match." } } } } };
test("surface selection renders only that surface's fields and follows the guarded target callback", () => {
  const field = jest.fn(key => <p key={key}>Edit {key}</p>), onTarget = jest.fn();
  render(<WebsiteProseWorkshop state={state} field={field} target={{ id: "practice", section: "play" }} onTarget={onTarget} context={{}} onContext={jest.fn()} />);
  expect(screen.getByRole("heading", { name: "Saved heading" })).toBeInTheDocument();
  expect(field.mock.calls.map(call => call[0])).toEqual(["playPageTitle", "playPageDescription", "playPageImage"]);
  fireEvent.click(screen.getByRole("button", { name: /Learn & Rules landing/ }));
  expect(onTarget).toHaveBeenCalledWith({ domain: "modes", id: "practice", section: "learn" });
});
test("a global prose search field opens its exact website surface", () => {
  render(<WebsiteProseWorkshop state={state} field={key => <p key={key}>{key}</p>} target={{ id: "practice", field: "settingsPageTitle" }} onTarget={jest.fn()} context={{}} onContext={jest.fn()} />);
  expect(screen.getByRole("heading", { level: 3, name: "Settings page header" })).toBeInTheDocument();
  expect(screen.queryByText("playPageTitle")).not.toBeInTheDocument();
});

test("mode copy keeps the release preview while page headers show their own saved values", () => {
  const props = { state, field: () => null, onTarget: jest.fn(), context: {}, onContext: jest.fn(), preview: <section aria-label="Isolated draft preview">Captured release copy</section> };
  const { rerender } = render(<WebsiteProseWorkshop {...props} target={{ id: "practice", section: "mode-practice" }} />);
  expect(screen.getByRole("region", { name: "Isolated draft preview" })).toHaveTextContent("Captured release copy");
  rerender(<WebsiteProseWorkshop {...props} target={{ id: "practice", section: "play" }} />);
  expect(screen.queryByRole("region", { name: "Isolated draft preview" })).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Website presentation preview" })).toHaveTextContent("Saved heading");
});

test("local prose is previewed with the same header as players while saved state remains unchanged", () => {
  const source = { ...state, assetLibrary: [{ id: "image-version-one", path: "/assets/header.webp" }] };
  render(<WebsiteProseWorkshop state={source} field={() => null} target={{ id: "practice", section: "play" }} context={{}} onContext={jest.fn()} buffers={{ "game:practice:playPageTitle": "Local heading", "game:practice:playPageImage": "image-version-one" }} />);
  expect(document.querySelector(".cd-page-header h1")).toHaveTextContent("Local heading");
  expect(screen.getByText("Local preview · unsaved changes")).toBeVisible();
  expect(document.querySelector(".cd-page-artwork")).toHaveAttribute("src", "/assets/header.webp");
  expect(state.live.domains.game[0].playPageTitle).toBe("Saved heading");
});

test("an unresolved local artwork edit cannot display the previous saved artwork", () => {
  const source = { ...state, previewContent: { manifest: { websiteProse: { play: { image: "/assets/previous.webp" } } } } };
  render(<WebsiteProseWorkshop state={source} field={() => null} target={{ id: "practice", section: "play" }} context={{}} onContext={jest.fn()} buffers={{ "game:practice:playPageImage": "unknown-version" }} />);
  expect(document.querySelector(".cd-page-artwork")).not.toBeInTheDocument();
  expect(screen.getByText("Local preview · unsaved changes")).toBeVisible();
});
