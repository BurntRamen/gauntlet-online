import { createBasicGauntletMatchViewModel } from "./matchViewModel";

function card(id, value, suit = "♠") {
  return { id, value, rank: String(value), suit, factionId: "basic" };
}

function makeGame() {
  return {
    gameMode: "basic",
    phase: "priority",
    turn: 4,
    priority: 2,
    priorityPassed: { 1: false, 2: true },
    message: "Player 2 has priority.",
    players: {
      1: { accountName: "Ada", life: 38, hand: [card("a-1", 4), card("a-2", 7)], handCount: 2, faction: { id: "basic", name: "Basic Gauntlet" } },
      2: { accountName: "Babbage", life: 42, hand: [card("b-1", 5), card("b-2", 9), card("b-3", 12)], handCount: 3, faction: { id: "basic", name: "Basic Gauntlet" } }
    },
    lanes: [
      { facedown: { 1: card("p1-lane-0", 8), 2: card("p2-lane-0", 6) }, attack: null, block: [] },
      { facedown: { 1: null, 2: card("p2-lane-1", 3) }, attack: { id: "attack-1", player: 2, card: card("attack-card", 10), effectiveValue: 11 }, block: [] },
      { facedown: { 1: null, 2: null }, attack: null, block: [] }
    ],
    handAttacks: []
  };
}

test("maps the local player to the bottom and hides the opponent hand", () => {
  const view = createBasicGauntletMatchViewModel({ game: makeGame(), player: 1, role: "player" });

  expect(view.top.id).toBe(2);
  expect(view.bottom.id).toBe(1);
  expect(view.bottom.hand).toHaveLength(2);
  expect(view.top.hand).toEqual([]);
  expect(view.top.handCount).toBe(3);
});

test("keeps exactly three lanes and maps hidden lane occupancy by perspective", () => {
  const view = createBasicGauntletMatchViewModel({ game: makeGame(), player: 1, role: "player" });

  expect(view.lanes).toHaveLength(3);
  expect(view.lanes.map((lane) => lane.index)).toEqual([0, 1, 2]);
  expect(view.lanes[0].localCard.visible).toBe(true);
  expect(view.lanes[0].opponentCard.visible).toBe(false);
  expect(view.lanes[0].opponentCard.raw).toBeUndefined();
  expect(view.lanes[1].attack.value).toBe(11);
  expect(view.lanes[1].attack.owner).toBe(2);
});

test("maps life, phase, priority, and derived interaction selections", () => {
  const view = createBasicGauntletMatchViewModel({
    game: makeGame(),
    player: 2,
    role: "player",
    phaseLabel: "Command",
    interaction: {
      attackMode: { from: "hand" },
      handSelectionRole: "payment",
      selectedAttackCardIndex: 1,
      selectedBlockCardIndexes: [0],
      selectedPlacementCardIndex: 0,
      payments: [0],
      paymentTotal: 5,
      paymentRequired: 7,
      paymentActive: true,
      legalLanes: [1],
      handInteractionEnabled: true,
      canDeclareAttack: true
    }
  });

  expect(view.bottom.life).toBe(42);
  expect(view.top.life).toBe(38);
  expect(view.priority).toBe(2);
  expect(view.localHasPriority).toBe(true);
  expect(view.selection.role).toBe("payment");
  expect(view.hand[1].selected.attacker).toBe(true);
  expect(view.hand[0].selected.blocker).toBe(true);
  expect(view.hand[0].selected.payment).toBe(true);
  expect(view.selection.legalLanes).toEqual([1]);
  expect(view.payment).toEqual({ total: 5, required: 7, active: true });
});

test("keeps approved faction art paths on visible local cards", () => {
  const game = makeGame();
  game.players[1].faction = { id: "rumin", name: "Rumin" };
  game.players[1].hand[0].factionId = "rumin";
  const view = createBasicGauntletMatchViewModel({ game, player: 1, role: "player" });

  expect(view.hand[0].artPath).toBe("/assets/gauntlet/playing-cards/rumin-4-spades.webp");
});

test("spectator view has no private hand or lane identities", () => {
  const view = createBasicGauntletMatchViewModel({ game: makeGame(), role: "spectator", player: null });

  expect(view.perspective.spectator).toBe(true);
  expect(view.hand).toEqual([]);
  expect(view.top.hand).toEqual([]);
  expect(view.bottom.hand).toEqual([]);
  expect(view.lanes.every((lane) => !lane.localCard.visible && !lane.opponentCard.visible)).toBe(true);
  expect(view.perspective.topPlayer).toBe(1);
  expect(view.perspective.bottomPlayer).toBe(2);
  expect(view.lanes[0]).toEqual(expect.objectContaining({ hasLocalCard: true, hasOpponentCard: true }));
  expect(view.lanes[1]).toEqual(expect.objectContaining({ hasLocalCard: true, hasOpponentCard: false }));
  expect(view.lanes[0].playerOneCard.raw).toBeUndefined();
  expect(view.lanes[0].playerTwoCard.raw).toBeUndefined();
  expect(view.spectatorSafe).toBe(true);
});

test("keeps hand-attack blockers paired with the independent attack", () => {
  const game = makeGame();
  game.handAttacks = [{
    id: "hand-attack",
    player: 2,
    targetPlayer: 1,
    card: card("attacker", 8),
    effectiveValue: 8,
    block: [{
      id: "hand-block",
      player: 1,
      card: card("blocker", 5),
      effectiveValue: 5
    }]
  }];
  const view = createBasicGauntletMatchViewModel({ game, player: 1, role: "player" });

  expect(view.handAttacks[0].laneIndex).toBeUndefined();
  expect(view.handAttacks[0].blocks).toHaveLength(1);
  expect(view.handAttacks[0].blocks[0].card.label).toContain("5");
});
