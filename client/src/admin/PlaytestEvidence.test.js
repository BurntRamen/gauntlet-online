import { render, screen } from "@testing-library/react";
import PlaytestEvidence from "./PlaytestEvidence";

test("calculated results distinguish engine events from snapshot differences and absent evidence", () => {
  render(<PlaytestEvidence result={{ kind: "calculated-preview", accepted: true, payment: { total: 7, required: 5, notes: ["Card bonus +2"] },
    changes: [{ player: 2, field: "life", before: 42, after: 37 }, { player: 1, field: "support", laneIndex: 0, before: null, after: "instance" }],
    events: [{ type: "attack.declared", effectiveValue: 5 }], command: { type: "declareHandAttack", player: 1 } }} />);
  expect(screen.getByRole("region", { name: "Calculated command preview" })).toBeInTheDocument();
  expect(screen.getByText("Calculated preview · no state changes applied")).toBeInTheDocument();
  expect(screen.getByText(/Payment 7 \/ 5 required/)).toHaveTextContent("Card bonus +2");
  expect(screen.getByText("Observed snapshot differences")).toBeInTheDocument();
  expect(screen.getByText("Player 2 · life: 42 → 37")).toBeInTheDocument();
  expect(screen.getByText("Player 1 · support lane 1: Not recorded → instance")).toBeInTheDocument();
  expect(screen.getByText("Engine events · 1")).toBeInTheDocument();
});

test("executed rejected result reports the actual engine reason without fabricating state changes", () => {
  render(<PlaytestEvidence result={{ kind: "executed", accepted: false, error: "Need 5 payment.", changes: [], events: [], command: { type: "declareHandAttack" } }} />);
  expect(screen.getByRole("region", { name: "Executed command result" })).toBeInTheDocument();
  expect(screen.getByText("Rejected by the engine: Need 5 payment.")).toBeInTheDocument();
  expect(screen.getByText("No observed state changes.")).toBeInTheDocument();
  expect(screen.getByText("Engine events · 0")).toBeInTheDocument();
});

test("missing result renders no invented evidence and arrays are labeled as card instances", () => {
  const view = render(<PlaytestEvidence />);
  expect(view.container).toBeEmptyDOMElement();
  view.rerender(<PlaytestEvidence result={{ kind: "executed", accepted: true, changes: [{ field: "hand", before: ["one", "two"], after: ["two"] }] }} />);
  expect(screen.getByText("hand: 2 card instances → 1 card instances")).toBeInTheDocument();
});
