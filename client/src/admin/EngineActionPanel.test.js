import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import EngineActionPanel, { buildCommand } from "./EngineActionPanel";

const group = (key, entities, extra = {}) => ({ key, role: key, entities, minimum: 1, maximum: 1, ordered: false, ...extra });
const ability = targets => ({ id: "ability", type: "useFactionAbility", player: 1, label: "Focus · give a card +1",
  confirmationPayload: { fixed: { abilityId: "focus-buff" } }, selection: { sources: [], targets } });
const card = (id, name, value = 4) => ({ id, name, value, suit: "♠" });
const session = actions => ({ id: "session", legalActions: actions, game: { revision: 0,
  players: { 1: { hand: [card("attacker", "Attacker"), card("payment", "Payment", 10), card("second", "Second", 6)], deck: [], discard: [] },
    2: { hand: [], deck: [], discard: [] } }, lanes: [] } });

test.each([
  [{ id: "lane:2:player:2", type: "laneCard", owner: 2, laneIndex: 2 }, { laneIndex: 2, targetType: "laneCard", targetPlayerId: 2 }],
  [{ id: "event-attack", type: "laneAttack", owner: 1, attackId: "actual-attack", laneIndex: 0 }, { laneIndex: 0, targetType: "laneAttack", targetPlayerId: 1 }],
  [{ id: "event-attack", type: "handAttack", owner: 1, attackId: "actual-attack", laneIndex: null }, { attackId: "actual-attack", targetType: "handAttack", targetPlayerId: 1 }],
  [{ id: "card:hand", type: "handCard", owner: 1, cardId: "actual-card" }, { cardId: "actual-card", targetType: "handCard", targetPlayerId: 1 }]
])("maps target entity %j to its actual command identity", (entity, expected) => {
  expect(buildCommand(ability([group("cardTarget", [entity])]), {}, {})).toEqual({ type: "useFactionAbility", player: 1, abilityId: "focus-buff", ...expected });
});

test("ordered lane selections keep click order and fixed attack identity survives payment and optional choices", () => {
  const lanes = [0, 1, 2].map(laneIndex => ({ id: `lane:${laneIndex}`, laneIndex, owner: 1, type: "lane" }));
  const action = ability([group("laneIndexes", lanes, { minimum: 2, maximum: 2, ordered: true })]);
  expect(buildCommand(action, { laneIndexes: ["lane:2", "lane:0"] }, { lastGambleChoice: "block" })).toEqual({
    type: "useFactionAbility", player: 1, abilityId: "focus-buff", laneA: 2, laneB: 0, lastGambleChoice: "block"
  });
  const attack = { type: "declareHandAttack", player: 2, confirmationPayload: { fixed: { cardId: "attacker", targetPlayerId: 1 } },
    selection: { sources: [group("cardId", [{ id: "attacker", cardId: "attacker" }])], targets: [] },
    payment: { eligibleCardIds: ["attacker", "payment"], excludedCardIds: ["attacker"], excludesSelections: ["cardId"] } };
  expect(buildCommand(attack, { payment: ["attacker", "payment", "foreign"] }, { armWeaponCardIds: ["weapon"], useMeerusFreeAttack: false })).toEqual({
    type: "declareHandAttack", player: 2, cardId: "attacker", targetPlayerId: 1, paymentCardIds: ["payment"], armWeaponCardIds: ["weapon"], useMeerusFreeAttack: false
  });
});

test("a singleton blocker is automatically selected and cannot also be used as payment", () => {
  const action = { id: "block", type: "declareHandBlock", player: 1, label: "Block from hand", confirmationPayload: { fixed: { attackId: "incoming" } },
    selection: { sources: [group("blockerCardIds", [{ id: "attacker", cardId: "attacker", type: "handCard", owner: 1 }])], targets: [] },
    payment: { eligibleCardIds: ["attacker", "payment"], excludesSelections: ["blockerCardIds"], requiredValue: null } };
  const onExecute = jest.fn();
  render(<EngineActionPanel session={session([action])} onExecute={onExecute} onPreview={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Action"), { target: { value: "block" } });
  const payment = screen.getByRole("group", { name: /Payment cards/ });
  expect(within(payment).getByRole("checkbox", { name: /Attacker/ })).toBeDisabled();
  expect(within(payment).getByRole("checkbox", { name: /Attacker/ })).not.toBeChecked();
  fireEvent.click(within(payment).getByRole("checkbox", { name: /Payment/ }));
  fireEvent.click(screen.getByRole("button", { name: "Execute selected action" }));
  expect(onExecute).toHaveBeenCalledWith({ type: "declareHandBlock", player: 1, attackId: "incoming", blockerCardIds: ["attacker"], paymentCardIds: ["payment"] });
});

test("target limits preserve selected order and allow deselection", () => {
  const lanes = [0, 1, 2].map(laneIndex => ({ id: `lane:${laneIndex}`, laneIndex, owner: 1, type: "lane" }));
  const action = ability([group("laneIndexes", lanes, { minimum: 2, maximum: 2, ordered: true })]);
  const onExecute = jest.fn();
  render(<EngineActionPanel session={session([action])} onExecute={onExecute} onPreview={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Action"), { target: { value: "ability" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Lane 3/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Lane 1/ }));
  expect(screen.getByRole("checkbox", { name: /Lane 2/ })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Execute selected action" }));
  expect(onExecute.mock.calls[0][0]).toMatchObject({ laneA: 2, laneB: 0 });
  fireEvent.click(screen.getByRole("checkbox", { name: /Lane 3/ }));
  expect(screen.getByRole("checkbox", { name: /Lane 2/ })).toBeEnabled();
});

test("rejected calculated preview retains payment and effect choices for correction", async () => {
  const action = { id: "attack", label: "Attack from hand", type: "declareHandAttack", player: 1, confirmationPayload: { fixed: { cardId: "attacker" } },
    selection: { sources: [], targets: [] }, payment: { requiredValue: 4, eligibleCardIds: ["payment", "second"] },
    optionalEffects: [{ id: "pick", label: "Follow-up effect", kind: "choice", choices: ["attack", "block"], commandField: "lastGambleChoice" },
      { id: "amount", label: "Acceleration to spend", kind: "amount", minimum: 0, maximum: 3, commandField: "sunforgeAccelerationToSpend" }] };
  const onPreview = jest.fn().mockResolvedValue({ kind: "calculated-preview", accepted: false, error: "The selected effect is unavailable.", changes: [], events: [] });
  render(<EngineActionPanel session={session([action])} onExecute={jest.fn()} onPreview={onPreview} />);
  fireEvent.change(screen.getByLabelText("Action"), { target: { value: "attack" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Payment/ }));
  fireEvent.change(screen.getByLabelText("Follow-up effect"), { target: { value: "block" } });
  fireEvent.change(screen.getByLabelText("Acceleration to spend"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Calculate command preview" }));
  await screen.findByText(/Rejected by the engine: The selected effect is unavailable/);
  expect(onPreview).toHaveBeenCalledWith({ type: "declareHandAttack", player: 1, cardId: "attacker", paymentCardIds: ["payment"], lastGambleChoice: "block", sunforgeAccelerationToSpend: 2 });
  expect(screen.getByRole("checkbox", { name: /Payment/ })).toBeChecked();
  expect(screen.getByLabelText("Follow-up effect")).toHaveValue("block");
  expect(screen.getByLabelText("Acceleration to spend")).toHaveValue(2);
  fireEvent.change(screen.getByLabelText("Follow-up effect"), { target: { value: "attack" } });
  await waitFor(() => expect(screen.queryByText(/Rejected by the engine/)).not.toBeInTheDocument());
});
