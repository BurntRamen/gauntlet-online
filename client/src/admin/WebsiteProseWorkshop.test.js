import { fireEvent, render, screen } from "@testing-library/react";
import WebsiteProseWorkshop from "./WebsiteProseWorkshop";
const state = { live: { domains: { game: [{ id: "practice", name: "Practice", playPageTitle: "Saved heading" }] } }, fields: { game: { practice: { name: {}, description: {}, playPageTitle: { defaultValue: "Play" }, playPageDescription: { defaultValue: "Pick a match." } } } } };
test("surface selection renders only that surface's fields and follows the guarded target callback", () => {
  const field = jest.fn(key => <p key={key}>Edit {key}</p>), onTarget = jest.fn();
  render(<WebsiteProseWorkshop state={state} field={field} target={{ id: "practice", section: "play" }} onTarget={onTarget} context={{}} onContext={jest.fn()} />);
  expect(screen.getByRole("heading", { name: "Saved heading" })).toBeInTheDocument();
  expect(field.mock.calls.map(call => call[0])).toEqual(["playPageTitle", "playPageDescription"]);
  fireEvent.click(screen.getByRole("button", { name: /Learn & Rules landing/ }));
  expect(onTarget).toHaveBeenCalledWith({ domain: "modes", id: "practice", section: "learn" });
});
test("a global prose search field opens its exact website surface", () => {
  render(<WebsiteProseWorkshop state={state} field={key => <p key={key}>{key}</p>} target={{ id: "practice", field: "settingsPageTitle" }} onTarget={jest.fn()} context={{}} onContext={jest.fn()} />);
  expect(screen.getByRole("heading", { level: 3, name: "Settings page header" })).toBeInTheDocument();
  expect(screen.queryByText("playPageTitle")).not.toBeInTheDocument();
});
