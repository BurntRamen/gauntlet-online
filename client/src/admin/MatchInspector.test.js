import { fireEvent, render, screen, within } from "@testing-library/react";
import MatchInspector from "./MatchInspector";

const match = { matchId: "match-1", mode: "campaign", campaign: { title: "Recorded battle" }, participants: [], auditEvents: [{ sequence: 1, turn: 2, eventType: "card_played", publicPayload: { message: "Old Spear entered play" } }] };
const reference = { key: "cards:spear", domain: "cards", id: "spear", recorded: { available: true, label: "Old Spear", definition: { text: "Old behavior", effect: { id: "old-effect", version: 1 } } }, current: { available: true, label: "New Spear", definition: { text: "Current behavior" } } };
const design = { references: [reference], events: [{ sequence: 1, text: "Old Spear entered play", references: [reference.key] }], recorded: { releaseId: "old-release" }, current: { releaseId: "current-release" } };

test("distinguishes immutable recorded evidence from current content and opens replay separately", () => {
  const inspect = jest.fn();
  render(<MatchInspector match={match} design={design} onInspect={inspect} />);
  expect(screen.getAllByText("Recorded in this match")[0]).toBeVisible();
  expect(screen.getAllByText("Old behavior")[0]).toBeVisible();
  expect(screen.getAllByText("Current behavior")[0]).toBeVisible();
  fireEvent.click(screen.getAllByRole("button", { name: "Open current live definition · New Spear" })[0]);
  expect(inspect).toHaveBeenCalledWith("cards", "spear");
  expect(screen.getByRole("link", { name: "Open recorded replay" })).toHaveAttribute("target", "_blank");
  expect(screen.getByRole("link", { name: "Open recorded replay" })).toHaveAttribute("href", "/?match=match-1&replay=1");
});

test("unknown current definitions have no guessed workshop link and event filtering preserves original text", () => {
  render(<MatchInspector match={match} design={{ ...design, references: [{ ...reference, current: { available: false } }] }} onInspect={jest.fn()} />);
  expect(screen.queryByRole("button", { name: /Open current/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Filter match events"), { target: { value: "no matching text" } });
  expect(screen.getByText("No matching events.")).toBeVisible();
});

test("audit and engine events sharing a sequence retain separate evidence and definition links", () => {
  const effect = { key: "card-effects:new-effect", domain: "card-effects", id: "new-effect", recorded: { available: true, label: "Captured effect" }, current: { available: true, label: "Current effect" } };
  const dual = { ...match, leagueEvidence: [{ sequence: 1, turn: 2, eventType: "effect_resolved", publicPayload: { message: "Effect fired" } }] };
  const projection = { ...design, references: [reference, effect], events: [{ sequence: 1, source: "audit", text: "Recorded audit message", references: [reference.key] }, { sequence: 1, source: "engine-evidence", text: "Recorded engine effect", references: [effect.key] }] };
  const inspect = jest.fn(), remember = jest.fn();
  render(<MatchInspector match={dual} design={projection} onInspect={inspect} context={{ event: "engine-evidence:1", query: "" }} onContext={remember} />);
  const audit = within(screen.getByRole("group", { name: "Audit event 1" }));
  const engine = within(screen.getByRole("group", { name: "Engine evidence event 1" }));
  expect(audit.getByText("Recorded audit message")).toBeVisible();
  expect(audit.queryByText("Recorded engine effect")).not.toBeInTheDocument();
  expect(engine.getByText("Recorded engine effect")).toBeVisible();
  expect(engine.queryByText("Old Spear")).not.toBeInTheDocument();
  fireEvent.click(engine.getByRole("button", { name: "Open current live definition · Current effect" }));
  expect(inspect).toHaveBeenCalledWith("card-effects", "new-effect");
  fireEvent.change(screen.getByLabelText("Filter match events"), { target: { value: "engine-evidence" } });
  expect(remember).toHaveBeenCalledWith({ event: "engine-evidence:1", query: "engine-evidence" });
});
