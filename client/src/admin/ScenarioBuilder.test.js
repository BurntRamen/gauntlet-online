import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import ScenarioBuilder, { initialScenario } from "./ScenarioBuilder";

const spec = { version: 1, suits: ["clubs", "spades"], values: [2, 4, 7], life: { min: 1, max: 77 }, turn: { min: 1, max: 200 }, counter: { min: 0, max: 20 }, laneCount: 3 };
const factions = [{ id: "rumin", name: "Rumin" }, { id: "bizi", name: "Bizi" }, { id: "jali", name: "Jali" }, { id: "xendra", name: "XenDra", campaignOnly: true }];
const cards = [{ id: "rumin-unit", name: "Legionary", value: 4, type: "servitor", factionId: "rumin" },
  { id: "rumin-arm", name: "Spear", value: 7, type: "armament", factionId: "rumin" },
  { id: "bizi-unit", name: "Worker", value: 2, type: "servitor", factionId: "bizi" }];
const request = jest.fn().mockResolvedValue({ scenarioSpec: spec });
function Harness({ initial = initialScenario("rumin"), onChange = jest.fn(), ...props }) {
  const [value, setValue] = useState(initial);
  return <ScenarioBuilder request={request} value={value} onChange={next => { setValue(next); onChange(next); }} factions={factions} cards={cards} {...props} />;
}
const playerOne = () => within(screen.getByRole("group", { name: "Player 1 setup" }));
beforeEach(() => request.mockReset().mockResolvedValue({ scenarioSpec: spec }));

test("initial selected card is tied to its published identity while setup contains only permitted fields", () => {
  const setup = initialScenario("rumin", cards[0]);
  expect(setup.players[1].hand).toEqual([{ cardId: "rumin-unit", value: 4, suit: "spades" }]);
  expect(setup.players[2].hand).toEqual([]);
  expect(setup.players[1].combat).toEqual([null, null, null]);
  expect(setup.players[1].support).toEqual([null, null, null]);
  expect(setup.players[1]).not.toHaveProperty("turnData");
  expect(setup).not.toHaveProperty("phase");
});

test("server scenario metadata determines visible bounds, suits and card values", async () => {
  render(<Harness />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading supported scenario controls");
  await screen.findByRole("region", { name: "Custom starting state" });
  expect(request).toHaveBeenCalledWith("/api/admin/authoring/playtest/scenario-spec");
  expect(screen.getByLabelText("Starting turn")).toHaveAttribute("max", "200");
  expect(screen.getByLabelText("Player 1 life")).toHaveAttribute("max", "77");
  expect(screen.getByLabelText("Player 1 attacks this turn")).toHaveAttribute("max", "20");
  expect(within(playerOne().getByLabelText("Previous played value")).getAllByRole("option").map(option => option.value)).toEqual(["", "2", "4", "7"]);
  expect(within(playerOne().getByLabelText("Previous attack suit")).getAllByRole("option").map(option => option.value)).toEqual(["", "clubs", "spades"]);
  expect(screen.queryByRole("option", { name: "XenDra" })).not.toBeInTheDocument();
});

test("adding slots avoids existing inventory; printed value is protected until a card becomes ordinary", async () => {
  const changed = jest.fn();
  render(<Harness initial={initialScenario("rumin", cards[0])} onChange={changed} />);
  await screen.findByRole("region", { name: "Custom starting state" });
  expect(screen.getByLabelText("Player 1 hand 1 value")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Add to player 1 hand" }));
  fireEvent.click(screen.getByRole("button", { name: "Add to player 1 hand" }));
  expect(changed.mock.calls.at(-1)[0].players[1].hand).toEqual([
    { cardId: "rumin-unit", value: 4, suit: "spades" }, { value: 2, suit: "clubs" }, { value: 4, suit: "clubs" }
  ]);
  const selector = screen.getByLabelText("Player 1 hand 1 card");
  expect(within(selector).queryByRole("option", { name: /Worker/ })).not.toBeInTheDocument();
  fireEvent.change(selector, { target: { value: "" } });
  expect(screen.getByLabelText("Player 1 hand 1 value")).toBeEnabled();
  expect(changed.mock.calls.at(-1)[0].players[1].hand[0]).toEqual({ value: 4, suit: "spades" });
  fireEvent.change(screen.getByLabelText("Player 1 hand 1 value"), { target: { value: "7" } });
  expect(changed.mock.calls.at(-1)[0].players[1].hand[0].value).toBe(7);
});

test("support and combat lane controls create compatible slots and removing preserves lane positions", async () => {
  const changed = jest.fn();
  render(<Harness onChange={changed} />);
  await screen.findByRole("region", { name: "Custom starting state" });
  const support = within(playerOne().getByRole("group", { name: "Support lanes" }));
  fireEvent.click(support.getByRole("button", { name: "Add card to lane 2" }));
  expect(changed.mock.calls.at(-1)[0].players[1].support).toEqual([null, { value: 7, suit: "clubs", cardId: "rumin-arm" }, null]);
  const choices = within(screen.getByLabelText("Player 1 support 2 card"));
  expect(choices.queryByRole("option", { name: "Ordinary playing card" })).not.toBeInTheDocument();
  expect(choices.queryByRole("option", { name: /Legionary/ })).not.toBeInTheDocument();
  expect(choices.getByRole("option", { name: /Spear/ })).toBeInTheDocument();
  fireEvent.click(support.getByRole("button", { name: "Remove" }));
  expect(changed.mock.calls.at(-1)[0].players[1].support).toEqual([null, null, null]);
  fireEvent.click(within(playerOne().getByRole("group", { name: "Combat lanes" })).getByRole("button", { name: "Add card to lane 1" }));
  expect(within(screen.getByLabelText("Player 1 combat 1 card")).queryByRole("option", { name: /Spear/ })).not.toBeInTheDocument();
});

test("deck reorder and faction change modify only the chosen player's temporary setup", async () => {
  const initial = initialScenario("rumin"), changed = jest.fn();
  initial.players[1].deck = [{ value: 2, suit: "clubs" }, { value: 4, suit: "spades" }];
  initial.players[2].life = 33;
  render(<Harness initial={initial} onChange={changed} />);
  await screen.findByRole("region", { name: "Custom starting state" });
  fireEvent.click(screen.getByRole("button", { name: "Draw earlier" }));
  expect(changed.mock.calls.at(-1)[0].players[1].deck).toEqual([{ value: 4, suit: "spades" }, { value: 2, suit: "clubs" }]);
  fireEvent.change(screen.getByLabelText("Player 1 faction"), { target: { value: "bizi" } });
  expect(changed.mock.calls.at(-1)[0].players[1].deck).toEqual([]);
  expect(changed.mock.calls.at(-1)[0].players[2].life).toBe(33);
  expect(screen.getByLabelText("Player 1 acceleration")).toBeInTheDocument();
  expect(screen.queryByLabelText("Player 1 revenants")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Player 1 faction"), { target: { value: "jali" } });
  expect(screen.getByLabelText("Player 1 revenants")).toBeInTheDocument();
  expect(screen.queryByLabelText("Player 1 acceleration")).not.toBeInTheDocument();
});

test("a failed metadata request exposes its error without editing controls", async () => {
  render(<Harness request={jest.fn().mockRejectedValue(new Error("Scenario definitions unavailable."))} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Scenario definitions unavailable.");
  expect(screen.queryByLabelText("Starting turn")).not.toBeInTheDocument();
});

test("busy scenario setup cannot change or close", async () => {
  const onClose = jest.fn(), onChange = jest.fn();
  render(<Harness disabled onClose={onClose} onChange={onChange} />);
  await screen.findByRole("region", { name: "Custom starting state" });
  expect(screen.getByLabelText("Starting turn")).toBeDisabled();
  expect(screen.getByLabelText("Player 1 faction")).toBeDisabled();
  const close = screen.getByRole("button", { name: "Use standard setup" });
  expect(close).toBeDisabled(); fireEvent.click(close);
  expect(onClose).not.toHaveBeenCalled(); expect(onChange).not.toHaveBeenCalled();
});
