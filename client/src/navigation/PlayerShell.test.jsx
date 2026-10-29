import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import PlayerShell from "./PlayerShell";
import ActionTile from "./ActionTile";
import SetupFrame from "./SetupFrame";
import { PRIMARY_DESTINATIONS, getDestination } from "./destinations";

function renderShell(props = {}) {
  const onNavigate = jest.fn();
  return { onNavigate, ...render(<PlayerShell onNavigate={onNavigate} {...props}><div>Landing content</div></PlayerShell>) };
}

test("keeps all eight primary destinations labeled and reachable", () => {
  const { onNavigate } = renderShell();
  const navigation = within(screen.getByRole("navigation", { name: "Main navigation" }));
  PRIMARY_DESTINATIONS.forEach((id) => {
    const button = navigation.getByRole("button", { name: getDestination(id).label });
    fireEvent.click(button);
    expect(onNavigate).toHaveBeenLastCalledWith(id);
  });
  expect(navigation.getByRole("button", { name: "Play" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ready to play?");
});

test("header mute exposes its current state and remains available while editing", () => {
  const onToggleAudio = jest.fn();
  const { rerender } = renderShell({ onToggleAudio, audioMuted: false });
  const toggle = screen.getByRole("button", { name: "Mute menu audio" });
  expect(toggle).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(toggle);
  expect(onToggleAudio).toHaveBeenCalledTimes(1);
  rerender(<PlayerShell onNavigate={() => {}} onToggleAudio={onToggleAudio} audioMuted editing onDoneEditing={() => {}} />);
  expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(toggle).toHaveAttribute("title", "Unmute menu audio");
  expect(screen.getByRole("button", { name: "Done Editing" })).toBeInTheDocument();
  fireEvent.click(toggle);
  expect(onToggleAudio).toHaveBeenCalledTimes(2);
});

test("More exposes truthful destinations and customization, traps keyboard focus, and restores its trigger", async () => {
  const onCustomize = jest.fn();
  renderShell({ customizable: true, onCustomize });
  const more = screen.getAllByRole("button", { name: "More" })[0];
  more.focus();
  fireEvent.click(more);
  const dialog = screen.getByRole("dialog", { name: "More destinations" });
  const close = within(dialog).getByRole("button", { name: "Close More menu" });
  expect(close).toHaveFocus();
  expect(screen.queryByRole("navigation", { name: "Main navigation" })).not.toBeInTheDocument();
  for (const title of ["Draft", "Matches", "Community", "Learn & Rules", "Profile", "Settings"]) {
    expect(within(dialog).getByRole("button", { name: new RegExp(`^${title}`) })).toBeInTheDocument();
  }
  const customize = within(dialog).getByRole("button", { name: "Customize this page" });
  fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
  expect(customize).toHaveFocus();
  fireEvent.keyDown(customize, { key: "Tab" });
  expect(close).toHaveFocus();
  fireEvent.keyDown(close, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await waitFor(() => expect(more).toHaveFocus());

  fireEvent.click(more);
  fireEvent.click(screen.getByRole("button", { name: "Customize this page" }));
  expect(onCustomize).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("closing More by backdrop restores body scrolling and entering a destination preserves navigation", () => {
  const { onNavigate } = renderShell();
  const more = screen.getAllByRole("button", { name: "More" })[0];
  fireEvent.click(more);
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.click(screen.getByRole("dialog").parentElement);
  expect(document.body.style.overflow).toBe("");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(more);
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Matches/ }));
  expect(onNavigate).toHaveBeenCalledWith("matches");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("focused workflows omit customization while Done Editing remains globally reachable", () => {
  const onDoneEditing = jest.fn();
  const { rerender } = renderShell({ customizable: false });
  fireEvent.click(screen.getAllByRole("button", { name: "More" })[0]);
  expect(screen.queryByRole("button", { name: "Customize this page" })).not.toBeInTheDocument();
  fireEvent.keyDown(document, { key: "Escape" });
  rerender(<PlayerShell onNavigate={() => {}} editing onDoneEditing={onDoneEditing}><div>Layout editor</div></PlayerShell>);
  fireEvent.click(screen.getByRole("button", { name: "Done Editing" }));
  expect(onDoneEditing).toHaveBeenCalledTimes(1);
});

test("Admin only appears with explicit authorization, never from account names", () => {
  const onAdmin = jest.fn();
  const { rerender } = renderShell({ account: { username: "admin" }, onAdmin });
  expect(screen.queryByRole("button", { name: /Admin workspace/ })).not.toBeInTheDocument();
  rerender(<PlayerShell onNavigate={() => {}} ownerAuthorized onAdmin={onAdmin} />);
  fireEvent.click(screen.getByRole("button", { name: /Admin workspace/ }));
  expect(onAdmin).toHaveBeenCalledTimes(1);
});

test("action tiles expose explanations and outcomes without hovering and setup preserves a return action", () => {
  const onClick = jest.fn();
  const onBack = jest.fn();
  render(<><ActionTile id="basic" title="Basic vs AI" description="Play the core game solo." outcome="Starts a game immediately" onClick={onClick} /><SetupFrame title="Ranked Match" description="Choose a format before joining the queue." onBack={onBack}>Format selection</SetupFrame></>);
  const tile = screen.getByRole("button", { name: /Basic vs AI Starts a game immediately/ });
  fireEvent.click(tile);
  expect(onClick).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("region", { name: "Ranked Match" })).toHaveTextContent("Format selection");
  fireEvent.click(screen.getByRole("button", { name: "Back to Play" }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test("choosing a destination in More focuses its heading after the sheet closes", async () => {
  function NavigableShell() {
    const [destination, setDestination] = React.useState("play");
    return <PlayerShell destination={destination} onNavigate={setDestination}><div>Page content</div></PlayerShell>;
  }
  render(<NavigableShell />);
  const more = screen.getAllByRole("button", { name: "More" })[0];
  more.focus();
  fireEvent.click(more);
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Matches/ }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  expect(screen.getByRole("heading", { level: 1, name: "Matches" })).toHaveFocus();
  fireEvent.click(more);
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Matches/ }));
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  expect(screen.getByRole("heading", { level: 1, name: "Matches" })).toHaveFocus();
});
