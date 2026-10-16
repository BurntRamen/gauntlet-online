import { render, screen, fireEvent } from "@testing-library/react";
import { LocalDuelAdapter } from "./matchAdapters";
import AccessibleMatchControls from "./AccessibleMatchControls";
import { createBattlefieldPlaybackFrames } from "./battlefieldPlayback";
import { createGauntletMatchViewModel } from "./matchViewModel";
import SupportContractSummary from "../admin/SupportContractSummary";
const { createMatch, applyCommand, createCommandEnvelope, projectForPerspective } = require("@gauntlet/duel-rules");
const { buildPublicReplaySnapshot } = require("@gauntlet/match-history");
const card = (effect = "harmony-ward", factionId = "sheen", type = "shelter", value = 4) => ({ id: "support", definitionId: `${factionId}-${effect}`, name: effect, factionId, type, value, rank: String(value), suit: "spades" });
const pitch = { id: "pitch", value: 7, rank: "7", suit: "hearts" };
function state(support = card()) {
  const game = createMatch({ gameMode: "factions", seed: "support-ui", startingPriority: 1, factions: { 1: support.factionId, 2: "rumin" } }).state;
  game.players[1].hand = [support, pitch];
  return game;
}
function adapter(game = state()) {
  const result = new LocalDuelAdapter({ gameMode: "factions", autoSaveLocalHistory: false });
  result.game = game; result.controller = 1; result.perspective = 1; result.privacyRequired = false;
  return result;
}

test("adapter selects support, lane and payment, then commits with the authoritative envelope", async () => {
  const a = adapter();
  a.activateHandCard(0);
  expect(a.selection.kind).toBe("support");
  expect(a.confirmState().disabled).toBe(true);
  a.activateLane(2); a.activateHandCard(1);
  expect(a.confirmState()).toEqual({ label: "Play Support", disabled: false });
  expect(a.createUpdate().viewModel.payment).toMatchObject({ required: 4, total: 7, active: true });
  const result = await a.confirmCurrentAction();
  expect(result.accepted).toBe(true);
  expect(a.game.lanes[2].support[1].id).toBe("support");
  expect(a.game.players[1].hand).toHaveLength(0);
  a.dispose();
});

test("accessible controls expose named support targets, payment, optional choice and inspection", async () => {
  const a = adapter(state(card("deckhand-diver", "frumo", "ambush", 3)));
  a.activateHandCard(0);
  const update = a.createUpdate();
  const view = render(<AccessibleMatchControls viewModel={update.viewModel} commands={a.commands} />);
  expect(screen.getByRole("button", { name: "Support Zone 3" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Play Support" })).toBeDisabled();
  expect(screen.getByRole("button", { name: /Deep Dive/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Support Zone 3" }));
  a.activateHandCard(1); await a.confirmCurrentAction();
  view.rerender(<AccessibleMatchControls viewModel={a.createUpdate().viewModel} commands={a.commands} />);
  expect(screen.getByRole("button", { name: /Your Support Zone 3: deckhand-diver/ })).toBeInTheDocument();
  a.dispose();
});

test("one-shot playback has a visible entry frame before a separate discard frame", () => {
  const game = state(card("abyssal-switchboard", "frumo", "ambush", 7));
  const result = applyCommand(game, createCommandEnvelope(game, 1, { type: "playSupport", cardId: "support", laneIndex: 0, paymentCardIds: ["pitch"] }));
  expect(result.accepted).toBe(true);
  const makeUpdate = snapshot => ({ snapshot, viewModel: createGauntletMatchViewModel({ game: snapshot, player: 1 }), events: snapshot.lastEvents, source: "local" });
  const frames = createBattlefieldPlaybackFrames(makeUpdate(result.state), new Set(), { baseUpdate: makeUpdate(game) });
  const entryIndex = frames.findIndex(frame => frame.event?.type === "card.supportPlaced");
  const exitIndex = frames.findIndex(frame => frame.event?.type === "support.discarded");
  expect(entryIndex).toBeGreaterThanOrEqual(0); expect(exitIndex).toBeGreaterThan(entryIndex);
  expect(frames[entryIndex].update.viewModel.lanes[0].hasLocalSupport).toBe(true);
  expect(frames[entryIndex].durationMs).toBeGreaterThan(0);
  expect(frames[exitIndex].update.viewModel.lanes[0].hasLocalSupport).toBe(false);
});

test("spectator and replay show public supports but conceal Ambush identities", () => {
  const game = state(); game.lanes[0].support[1] = card(); game.lanes[1].support[2] = card("deckhand-diver", "frumo", "ambush", 3);
  for (const snapshot of [projectForPerspective(game, null), buildPublicReplaySnapshot(game)]) {
    const vm = createGauntletMatchViewModel({ game: snapshot, role: "spectator" });
    expect(vm.lanes[0].opponentSupport.visible).toBe(true);
    expect(vm.lanes[1].localSupport.visible).toBe(false);
  }
});

test("end-turn UI refuses ordinary support placement", () => {
  const game = state(); game.phase = "end";
  const a = adapter(game); a.activateHandCard(0);
  expect(a.selection.kind).toBe(null);
  expect(a.notice).toMatch(/not eligible/);
  a.dispose();
});

test("Admin shows only deployed support capabilities and rejects unsupported effect previews", () => {
  const view = render(<SupportContractSummary card={card()} />);
  expect(screen.getByText(/4 printed value/)).toBeInTheDocument();
  expect(screen.getByText(/No responsive play/)).toBeInTheDocument();
  expect(screen.getByText("explicit-removal-only")).toBeInTheDocument();
  view.rerender(<SupportContractSummary card={{ ...card(), effect: { id: "custom-script", version: 1, parameters: {} } }} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Unsupported support effect");
});

test("Assembly Station payment option is explicit in the adapter command", async () => {
  const game = state();
  game.lanes[0].support[1] = card("neutral-assembly-station", "neutral", "contraption", 7);
  game.players[1].hand = [{ ...card("neutral-soldier", "neutral", "servitor", 2), id: "attacker", definitionId: "neutral-soldier" }, { ...pitch, value: 1, rank: "1" }];
  game.lanes[0].support[1].definitionId = "neutral-assembly-station";
  const a = adapter(game);
  a.activateHandCard(0); a.activateHandCard(1);
  expect(a.confirmState().disabled).toBe(true);
  expect(a.createUpdate().viewModel.interactions.abilities.some(option => option.id === "constructed:assembly-station")).toBe(true);
  a.activateAbility("constructed:assembly-station");
  expect(a.confirmState().disabled).toBe(false);
  expect((await a.confirmCurrentAction()).accepted).toBe(true);
  expect(a.game.lanes[0].support[1]).toBeTruthy();
  a.dispose();
});
