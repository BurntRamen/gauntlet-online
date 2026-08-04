const {
  FACTION_PROFILES,
  HAND_SIZE,
  STARTING_LIFE,
  applyCommand,
  createCommandEnvelope,
  createMatch,
  createStandardDeck,
  currentPlacementPlayer,
  getLegalActions,
  projectForPerspective
} = require("@gauntlet/duel-rules");

function drawOrderedDeck(player, values) {
  const deck = createStandardDeck(player);
  const chosen = [];
  values.forEach((value) => {
    const index = deck.findIndex((card) => card.value === value);
    if (index < 0) throw new Error(`No remaining ${value} in test deck.`);
    chosen.push(deck.splice(index, 1)[0]);
  });
  return [...deck, ...chosen.reverse()];
}

function setup(options = {}) {
  return createMatch({
    seed: "rules-test",
    startingPriority: options.startingPriority || 1,
    playerNames: { 1: "One", 2: "Two" },
    decks: {
      1: options.p1 || drawOrderedDeck(1, [2, 3, 4, 5, 6, 7, 8, 9]),
      2: options.p2 || drawOrderedDeck(2, [2, 3, 5, 6, 7, 8, 9, 10])
    }
  }).state;
}

function setupFaction(playerOneFaction = "rumin", playerTwoFaction = "sheen") {
  return createMatch({
    seed: "faction-rules-test",
    startingPriority: 1,
    gameMode: "factions",
    factions: {
      1: FACTION_PROFILES[playerOneFaction],
      2: FACTION_PROFILES[playerTwoFaction]
    },
    decks: {
      1: drawOrderedDeck(1, [2, 3, 4, 5, 6, 7, 8, 9]),
      2: drawOrderedDeck(2, [2, 3, 5, 6, 7, 8, 9, 10])
    }
  }).state;
}

function accepted(state, command) {
  const result = applyCommand(state, command);
  expect(result.accepted).toBe(true);
  return result.state;
}

function handAttack(state, player, attackerIndex = 0, paymentIndexes = [1]) {
  const hand = state.players[player].hand;
  return applyCommand(state, {
    type: "declareHandAttack",
    player,
    attackerCardId: hand[attackerIndex].id,
    paymentCardIds: paymentIndexes.map((index) => hand[index].id)
  });
}

function enterPlacement(state) {
  state = accepted(state, { type: "passPriority", player: state.priority });
  state = accepted(state, { type: "passPriority", player: state.priority });
  expect(state.phase).toBe("end");
  return state;
}

function finishPlacementWithSkips(state) {
  while (state.phase === "end") {
    state = accepted(state, {
      type: "skipPlacement",
      player: currentPlacementPlayer(state),
      laneIndex: state.endPlacementLaneIndex
    });
  }
  return state;
}

function prepareLaneOne(state) {
  state = enterPlacement(state);
  const p1Card = state.players[1].hand[0];
  state = accepted(state, { type: "placeFacedown", player: 1, laneIndex: 0, cardId: p1Card.id });
  const p2Card = state.players[2].hand[0];
  state = accepted(state, { type: "placeFacedown", player: 2, laneIndex: 0, cardId: p2Card.id });
  state = finishPlacementWithSkips(state);
  return state;
}

function makeConstructed(card, definitionId, overrides = {}) {
  Object.assign(card, {
    definitionId,
    name: overrides.name || definitionId,
    factionId: overrides.factionId || definitionId.split("-")[0],
    type: overrides.type || "unit",
    ...overrides
  });
  return card;
}

function constructedAttackScenario({
  faction,
  definitionId,
  source = "hand",
  configure = () => {},
  command = {}
}) {
  const state = setupFaction(faction, faction === "rumin" ? "sheen" : "rumin");
  const attacker = state.players[1].hand[0];
  const payment = state.players[1].hand[1];
  attacker.value = 4;
  attacker.rank = "4";
  payment.value = 10;
  payment.rank = "10";
  makeConstructed(attacker, definitionId);
  configure(state, attacker, payment);
  if (source === "lane") {
    state.players[1].hand = state.players[1].hand.filter((card) => card.id !== attacker.id);
    state.lanes[0].facedown[1] = attacker;
  }
  const semanticCommand = {
    type: source === "lane" ? "declareLaneAttack" : "declareHandAttack",
    player: 1,
    ...(source === "lane" ? { laneIndex: 0 } : { cardId: attacker.id }),
    paymentCardIds: [payment.id],
    ...command
  };
  const result = applyCommand(state, semanticCommand);
  const replay = applyCommand(JSON.parse(JSON.stringify(state)), semanticCommand);
  expect(result.accepted).toBe(true);
  expect(replay).toEqual(result);
  return {
    state: result.state,
    attack: source === "lane" ? result.state.lanes[0].attack : result.state.handAttacks[0],
    attacker,
    payment
  };
}

function constructedHandBlockScenario({ faction, definitionId, configure = () => {} }) {
  let state = setupFaction(faction === "rumin" ? "sheen" : "rumin", faction);
  const attacker = state.players[1].hand[0];
  const attackPayment = state.players[1].hand[1];
  attacker.value = 8;
  attacker.rank = "8";
  attackPayment.value = 10;
  attackPayment.rank = "10";
  state = accepted(state, {
    type: "declareHandAttack",
    player: 1,
    cardId: attacker.id,
    paymentCardIds: [attackPayment.id]
  });
  const blocker = state.players[2].hand[0];
  const blockPayment = state.players[2].hand[1];
  blocker.value = 4;
  blocker.rank = "4";
  blockPayment.value = 10;
  blockPayment.rank = "10";
  makeConstructed(blocker, definitionId);
  configure(state, blocker, blockPayment);
  const semanticCommand = {
    type: "declareHandBlock",
    player: 2,
    attackId: state.handAttacks[0].id,
    blockerCardIds: [blocker.id],
    paymentCardIds: [blockPayment.id]
  };
  const result = applyCommand(state, semanticCommand);
  const replay = applyCommand(JSON.parse(JSON.stringify(state)), semanticCommand);
  expect(result.accepted).toBe(true);
  expect(replay).toEqual(result);
  return {
    state: result.state,
    block: result.state.handAttacks[0].block[0],
    blocker,
    payment: blockPayment
  };
}

describe("shared Basic Gauntlet simulator rules", () => {
  test("starts at 42 life and deals eight cards to each player", () => {
    const state = setup();
    expect(state.players[1].life).toBe(STARTING_LIFE);
    expect(state.players[2].life).toBe(STARTING_LIFE);
    expect(state.players[1].hand).toHaveLength(HAND_SIZE);
    expect(state.players[2].hand).toHaveLength(HAND_SIZE);
  });

  test("accepts command envelopes and rejects stale revisions", () => {
    let state = setup();
    const first = createCommandEnvelope(state, 1, { type: "passPriority" }, "command-1");
    const acceptedResult = applyCommand(state, first);
    expect(acceptedResult.accepted).toBe(true);
    expect(acceptedResult.commandId).toBe("command-1");
    expect(acceptedResult.revision).toBe(1);
    state = acceptedResult.state;

    const staleResult = applyCommand(state, {
      commandId: "command-stale",
      baseRevision: 0,
      actorPlayerId: 2,
      command: { type: "passPriority" }
    });
    expect(staleResult.accepted).toBe(false);
    expect(staleResult.rejection).toEqual(expect.objectContaining({
      code: "STALE_REVISION"
    }));
    expect(staleResult.revision).toBe(1);
  });

  test("completes a hand attack with sufficient payment", () => {
    const result = handAttack(setup(), 1);
    expect(result.accepted).toBe(true);
    expect(result.state.handAttacks).toHaveLength(1);
    expect(result.state.handAttacks[0].payment.total).toBe(3);
  });

  test("rejects a hand attack with insufficient payment", () => {
    const state = setup();
    const result = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      attackerCardId: state.players[1].hand[4].id,
      paymentCardIds: [state.players[1].hand[0].id]
    });
    expect(result.accepted).toBe(false);
    expect(result.rejectionReason).toMatch(/Need 6 payment/);
    expect(result.state).toBe(state);
  });

  test("creates a hand attack with no lane assignment", () => {
    const result = handAttack(setup(), 1);
    const attack = result.state.handAttacks[0];
    expect(attack.source).toBe("hand");
    expect(attack.sourceLane).toBeNull();
    expect(result.state.lanes.every((lane) => lane.attack === null)).toBe(true);
  });

  test("blocks a hand attack with multiple hand cards", () => {
    let state = handAttack(setup(), 1).state;
    const defenderHand = state.players[2].hand;
    const blockerIds = [defenderHand[0].id, defenderHand[1].id];
    const result = applyCommand(state, {
      type: "declareHandBlock",
      player: 2,
      attackId: state.handAttacks[0].id,
      blockerCardIds: blockerIds,
      paymentCardIds: [defenderHand[2].id]
    });
    expect(result.accepted).toBe(true);
    expect(result.animationEvents.some((event) => event.type === "block.declared")).toBe(true);
    expect(result.state.handAttacks).toHaveLength(0);
    expect(result.state.players[2].discard.map((card) => card.id)).toEqual(expect.arrayContaining(blockerIds));
  });

  test("declining a hand block applies damage", () => {
    let state = handAttack(setup(), 1).state;
    state = accepted(state, { type: "declineBlock", player: 2, attackId: state.handAttacks[0].id });
    expect(state.players[2].life).toBe(40);
    expect(state.handAttacks).toHaveLength(0);
    expect(state.priority).toBe(2);
  });

  test("keeps a lane attack associated with its source lane", () => {
    let state = prepareLaneOne(setup());
    const attacker = state.lanes[0].facedown[2];
    const payment = state.players[2].hand.find((card) => card.value >= attacker.value);
    state = accepted(state, {
      type: "declareLaneAttack",
      player: 2,
      laneIndex: 0,
      paymentCardIds: [payment.id]
    });
    expect(state.lanes[0].attack.source).toBe("lane");
    expect(state.lanes[0].attack.sourceLane).toBe(0);
    expect(state.handAttacks).toHaveLength(0);
  });

  test("only allows the corresponding same-lane blocker", () => {
    let state = prepareLaneOne(setup());
    const attacker = state.lanes[0].facedown[2];
    const payment = state.players[2].hand.find((card) => card.value >= attacker.value);
    state = accepted(state, { type: "declareLaneAttack", player: 2, laneIndex: 0, paymentCardIds: [payment.id] });
    const wrong = applyCommand(state, {
      type: "declareLaneBlock",
      player: 1,
      laneIndex: 1,
      paymentCardIds: []
    });
    expect(wrong.accepted).toBe(false);
    expect(wrong.rejectionReason).toMatch(/attacked lane/);
  });

  test("discards payment cards exactly once", () => {
    const state = setup();
    const attackerId = state.players[1].hand[0].id;
    const paymentId = state.players[1].hand[1].id;
    const result = handAttack(state, 1);
    expect(result.state.players[1].hand.some((card) => card.id === attackerId)).toBe(false);
    expect(result.state.players[1].hand.some((card) => card.id === paymentId)).toBe(false);
    expect(result.state.players[1].discard.filter((card) => card.id === paymentId)).toHaveLength(1);
  });

  test("advances pass-pass into end placement", () => {
    let state = setup();
    state = accepted(state, { type: "passPriority", player: 1 });
    expect(state.priority).toBe(2);
    state = accepted(state, { type: "passPriority", player: 2 });
    expect(state.phase).toBe("end");
    expect(state.endPlacementLaneIndex).toBe(0);
  });

  test("uses starting-priority player first in every lane", () => {
    let state = enterPlacement(setup());
    const actors = [];
    const lanes = [];
    while (state.phase === "end") {
      actors.push(currentPlacementPlayer(state));
      lanes.push(state.endPlacementLaneIndex);
      state = accepted(state, {
        type: "skipPlacement",
        player: currentPlacementPlayer(state),
        laneIndex: state.endPlacementLaneIndex
      });
    }
    expect(actors).toEqual([1, 2, 1, 2, 1, 2]);
    expect(lanes).toEqual([0, 0, 1, 1, 2, 2]);
  });

  test("supports skipping placement without replacing an occupied lane", () => {
    let state = enterPlacement(setup());
    const existing = state.players[1].hand[0];
    state.lanes[0].facedown[1] = existing;
    state.players[1].hand = state.players[1].hand.filter((card) => card.id !== existing.id);
    state = accepted(state, { type: "skipPlacement", player: 1, laneIndex: 0 });
    expect(state.lanes[0].facedown[1].id).toBe(existing.id);
  });

  test("draws each player back to eight after placement", () => {
    let state = setup();
    state.players[1].hand.splice(0, 3);
    state.players[2].hand.splice(0, 2);
    state = finishPlacementWithSkips(enterPlacement(state));
    expect(state.players[1].hand).toHaveLength(8);
    expect(state.players[2].hand).toHaveLength(8);
  });

  test("rotates starting priority after the turn", () => {
    const state = finishPlacementWithSkips(enterPlacement(setup()));
    expect(state.turn).toBe(2);
    expect(state.startingPriorityThisTurn).toBe(2);
    expect(state.priority).toBe(2);
  });

  test("conceals hands and lane cards by perspective", () => {
    const state = setup();
    state.lanes[0].facedown[1] = state.players[1].hand.shift();
    state.lanes[0].facedown[2] = state.players[2].hand.shift();
    const p1 = projectForPerspective(state, 1);
    expect(p1.players[1].hand[0].value).toBeDefined();
    expect(p1.players[2].hand[0]).toEqual(expect.objectContaining({ hidden: true }));
    expect(p1.lanes[0].facedown[1].value).toBeDefined();
    expect(p1.lanes[0].facedown[2]).toEqual(expect.objectContaining({ hidden: true }));
  });

  test("resolves victory at the end-turn life check", () => {
    let state = setup();
    state.players[2].life = 2;
    state = handAttack(state, 1).state;
    state = accepted(state, { type: "declineBlock", player: 2, attackId: state.handAttacks[0].id });
    state = accepted(state, { type: "passPriority", player: 2 });
    state = accepted(state, { type: "passPriority", player: 1 });
    expect(state.phase).toBe("gameOver");
    expect(state.winner).toBe(1);
  });

  test("plays a deterministic legal match from initial deal to victory", () => {
    const p1Deck = drawOrderedDeck(1, [14, 13, 2, 14, 12, 3, 4, 5, 14, 13, 2]);
    let state = setup({ p1: p1Deck });

    function attackWithIndexes(attackerIndex, paymentIndexes) {
      const result = handAttack(state, 1, attackerIndex, paymentIndexes);
      expect(result.accepted).toBe(true);
      state = result.state;
      state = accepted(state, { type: "declineBlock", player: 2, attackId: state.handAttacks[0].id });
    }

    attackWithIndexes(0, [1, 2]);
    state = accepted(state, { type: "passPriority", player: 2 });
    attackWithIndexes(0, [1, 2]);
    state = accepted(state, { type: "passPriority", player: 2 });
    state = accepted(state, { type: "passPriority", player: 1 });
    state = finishPlacementWithSkips(state);
    state = accepted(state, { type: "passPriority", player: 2 });
    attackWithIndexes(2, [3, 4]);
    state = accepted(state, { type: "passPriority", player: 2 });
    state = accepted(state, { type: "passPriority", player: 1 });

    expect(state.phase).toBe("gameOver");
    expect(state.players[2].life).toBe(0);
    expect(state.winner).toBe(1);
    expect(state.actionHistory.some((entry) => /New deterministic match/.test(entry.label))).toBe(true);
  });

  test("applies deterministic Rumin consecutive-suit attack value", () => {
    let state = setupFaction("rumin", "sheen");
    let result = handAttack(state, 1, 0, [1]);
    expect(result.accepted).toBe(true);
    state = accepted(result.state, {
      type: "declineBlock",
      player: 2,
      attackId: result.state.handAttacks[0].id
    });
    state = accepted(state, { type: "passPriority", player: 1 });
    state = accepted(state, { type: "passPriority", player: 2 });
    const attacker = state.players[1].hand.find((card) => card.value === 4);
    const payment = state.players[1].hand.find((card) => card.value >= 4 && card.id !== attacker.id);
    result = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id]
    });
    expect(result.accepted).toBe(true);
    expect(result.state.handAttacks[0].effectiveValue).toBe(5);
    expect(result.state.handAttacks[0].notes).toContain("Rumie +1");
  });

  test("applies Kaiser's fourth-attack bonus", () => {
    const state = setupFaction("rumin", "sheen");
    const attacker = state.players[1].hand[0];
    const payments = state.players[1].hand.filter((card) => card.id !== attacker.id);
    state.players[1].turnData.attacksDeclaredThisTurn = 3;
    state.players[1].turnData.ruminMatchingSuitBonuses = 2;

    const result = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: payments.map((card) => card.id)
    });

    expect(result.accepted).toBe(true);
    expect(result.state.handAttacks[0].effectiveValue).toBe(attacker.value + 3);
    expect(result.state.handAttacks[0].notes).toContain("Kaiser +3");
  });

  test("applies Sheen block bonuses through authoritative combat events", () => {
    let state = setupFaction("rumin", "sheen");
    state = handAttack(state, 1, 0, [1]).state;
    const blocker = state.players[2].hand[0];
    const payment = state.players[2].hand.find((card) => card.id !== blocker.id && card.value >= blocker.value);
    let result = applyCommand(state, {
      type: "declareHandBlock",
      player: 2,
      attackId: state.handAttacks[0].id,
      blockerCardIds: [blocker.id],
      paymentCardIds: [payment.id]
    });
    expect(result.accepted).toBe(true);
    result = applyCommand(result.state, { type: "passPriority", player: 1 });
    expect(result.accepted).toBe(true);
    expect(result.animationEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "damage.calculated", blockValue: blocker.value + 1 })
    ]));
  });

  test("applies Tang on the second block and readies Beli", () => {
    let state = setupFaction("rumin", "sheen");
    state = handAttack(state, 1, 0, [1]).state;
    state.players[2].turnData.blocksDeclaredThisTurn = 1;
    const blocker = state.players[2].hand[0];
    const payment = state.players[2].hand.find((card) => card.id !== blocker.id && card.value >= blocker.value);
    const lifeBefore = state.players[2].life;

    const result = applyCommand(state, {
      type: "declareHandBlock",
      player: 2,
      attackId: state.handAttacks[0].id,
      blockerCardIds: [blocker.id],
      paymentCardIds: [payment.id]
    });

    expect(result.accepted).toBe(true);
    expect(result.state.players[2].life).toBe(lifeBefore + 2);
    expect(result.state.players[2].turnData.sheenLargeAttackReady).toBe(true);
    expect(result.state.handAttacks[0].block[0].notes).toContain("Tang +2 life");
  });

  test("applies Beli to the next qualifying large Sheen attack", () => {
    const state = setupFaction("sheen", "rumin");
    const attacker = state.players[1].hand[0];
    attacker.value = 10;
    attacker.rank = "10";
    const payments = state.players[1].hand.filter((card) => card.id !== attacker.id);
    state.players[1].turnData.sheenLargeAttackReady = true;

    const result = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: payments.map((card) => card.id)
    });

    expect(result.accepted).toBe(true);
    expect(result.state.handAttacks[0].effectiveValue).toBe(12);
    expect(result.state.handAttacks[0].notes).toContain("Beli +2");
    expect(result.state.players[1].turnData.sheenLargeAttackReady).toBe(false);
  });

  test("earns and spends Bizi acceleration with Focus", () => {
    let state = setupFaction("bizi", "rumin");
    const attacker = state.players[1].hand.find((card) => card.value === 2);
    const overpayment = state.players[1].hand.find((card) => card.value === 4);
    let result = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [overpayment.id]
    });
    expect(result.accepted).toBe(true);
    expect(result.state.players[1].accelerationCounters).toBe(1);
    state = accepted(result.state, {
      type: "declineBlock",
      player: 2,
      attackId: result.state.handAttacks[0].id
    });
    state = accepted(state, { type: "passPriority", player: 1 });
    state = accepted(state, { type: "passPriority", player: 2 });
    const laneCard = state.players[1].hand.shift();
    state.lanes[0].facedown[1] = laneCard;
    expect(getLegalActions(state, 1)).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "useFactionAbility", abilityId: "focus-buff" })
    ]));
    result = applyCommand(state, {
      type: "useFactionAbility",
      player: 1,
      abilityId: "focus-buff",
      laneIndex: 0
    });
    expect(result.accepted).toBe(true);
    expect(result.state.players[1].accelerationCounters).toBe(0);
    expect(result.state.lanes[0].facedown[1].temporaryValueBonus).toBe(1);
  });

  test("applies Constanti to the first two post-opening different-suit attacks", () => {
    const state = setupFaction("bizi", "rumin");
    const attacker = state.players[1].hand[0];
    const payment = state.players[1].hand.find((card) => card.id !== attacker.id && card.value >= attacker.value);
    state.players[1].turnData.attacksDeclaredThisTurn = 1;
    state.players[1].turnData.previousAttackSuit = attacker.suit === "♠" ? "♥" : "♠";

    const result = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id]
    });

    expect(result.accepted).toBe(true);
    expect(result.state.handAttacks[0].effectiveValue).toBe(attacker.value + 1);
    expect(result.state.handAttacks[0].notes).toContain("Constanti +1");
    expect(result.state.players[1].turnData.biziDifferentSuitBonuses).toBe(1);
  });

  test("supports Frumo placement, swaps, and private Polea inspection", () => {
    let state = setupFaction("frumo", "rumin");
    const placedCard = state.players[1].hand[0];
    let result = applyCommand(state, {
      type: "useFactionAbility",
      player: 1,
      abilityId: "polea-place",
      cardId: placedCard.id,
      laneIndex: 0
    });
    expect(result.accepted).toBe(true);
    expect(result.state.lanes[0].facedown[1].id).toBe(placedCard.id);

    state = setupFaction("frumo", "rumin");
    const enemyCard = state.players[2].hand.shift();
    state.lanes[2].facedown[2] = enemyCard;
    result = applyCommand(state, {
      type: "useFactionAbility",
      player: 1,
      abilityId: "polea-peek",
      laneIndex: 2,
      targetPlayerId: 2
    });
    expect(result.accepted).toBe(true);
    const ownerProjection = projectForPerspective(result.state, 1);
    const opponentProjection = projectForPerspective(result.state, 2);
    expect(ownerProjection.lastEvents.find((entry) => entry.type === "card.peeked").card.id).toBe(enemyCard.id);
    expect(opponentProjection.lastEvents.find((entry) => entry.type === "card.peeked").card).toBeUndefined();

    state = setupFaction("frumo", "rumin");
    const handCard = state.players[1].hand[0];
    const laneCard = state.players[1].hand.splice(1, 1)[0];
    state.lanes[1].facedown[1] = laneCard;
    result = applyCommand(state, {
      type: "useFactionAbility",
      player: 1,
      abilityId: "lafayette-swap",
      cardId: handCard.id,
      laneIndex: 1
    });
    expect(result.accepted).toBe(true);
    expect(result.state.lanes[1].facedown[1].id).toBe(handCard.id);
    expect(result.state.players[1].hand.some((card) => card.id === laneCard.id)).toBe(true);
  });

  test("implements Polea's written up-to-two-card lane movement", () => {
    const state = setupFaction("frumo", "rumin");
    const laneCard = state.players[1].hand.shift();
    state.lanes[0].facedown[1] = laneCard;
    state.priorityPassed = { 1: false, 2: true };

    const result = applyCommand(state, {
      type: "useFactionAbility",
      player: 1,
      abilityId: "polea-swap",
      laneA: 0,
      laneB: 2
    });

    expect(result.accepted).toBe(true);
    expect(result.state.lanes[0].facedown[1]).toBeNull();
    expect(result.state.lanes[2].facedown[1].id).toBe(laneCard.id);
    expect(result.state.priorityPassed).toEqual({ 1: false, 2: false });
    expect(result.animationEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "lanes.swapped", movedCardCount: 1 })
    ]));
  });

  test("lets Polea privately inspect either player's face-down card", () => {
    const state = setupFaction("frumo", "rumin");
    const ownCard = state.players[1].hand.shift();
    state.lanes[1].facedown[1] = ownCard;

    const result = applyCommand(state, {
      type: "useFactionAbility",
      player: 1,
      abilityId: "polea-peek",
      laneIndex: 1,
      targetPlayerId: 1
    });

    expect(result.accepted).toBe(true);
    expect(projectForPerspective(result.state, 1).lastEvents
      .find((entry) => entry.type === "card.peeked").card.id).toBe(ownCard.id);
    expect(projectForPerspective(result.state, 2).lastEvents
      .find((entry) => entry.type === "card.peeked").card).toBeUndefined();
  });

  test("uses Hera only when explicitly requested with a matching-suit payment", () => {
    const state = setupFaction("bizi", "rumin");
    const attacker = state.players[1].hand.find((card) => card.value === 4);
    const payment = state.players[1].hand.find((card) => card.value === 2);
    state.players[1].turnData.suitsPlayedThisTurn = [payment.suit];

    const withoutHera = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id]
    });
    expect(withoutHera.accepted).toBe(false);

    const withHera = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id],
      useHeraBonus: true
    });
    expect(withHera.accepted).toBe(true);
    expect(withHera.state.handAttacks[0].payment.total).toBe(4);
    expect(withHera.state.players[1].turnData.heraUsed).toBe(true);
    expect(withHera.animationEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "payment.modified", source: "Hera", amount: 2 })
    ]));

    state.players[1].turnData.heraUsed = true;
    const reused = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id],
      useHeraBonus: true
    });
    expect(reused.accepted).toBe(false);
    expect(reused.rejectionReason).toMatch(/already been used/);
  });

  test("keeps Meerus optional instead of silently consuming the free third attack", () => {
    const state = setupFaction("rumin", "sheen");
    const attacker = state.players[1].hand.find((card) => card.value === 2);
    state.players[1].turnData.attacksDeclaredThisTurn = 2;
    state.players[1].turnData.ruminFreeThirdReady = true;

    const withoutMeerus = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: []
    });
    expect(withoutMeerus.accepted).toBe(false);
    expect(state.players[1].turnData.ruminFreeThirdReady).toBe(true);

    const withMeerus = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [],
      useMeerusFreeAttack: true
    });
    expect(withMeerus.accepted).toBe(true);
    expect(withMeerus.state.handAttacks[0].payment.required).toBe(0);
    expect(withMeerus.state.players[1].turnData.ruminFreeThirdReady).toBe(false);
  });

  test("applies Ristus to the first consecutive blocking card and records its suit", () => {
    let state = setupFaction("rumin", "frumo");
    state = handAttack(state, 1, 0, [1]).state;
    const blocker = state.players[2].hand.find((card) => card.value === 5);
    const payment = state.players[2].hand.find((card) => card.id !== blocker.id && card.value >= 5);
    state.players[2].turnData.previousPlayedValue = 4;

    const result = applyCommand(state, {
      type: "declareHandBlock",
      player: 2,
      attackId: state.handAttacks[0].id,
      blockerCardIds: [blocker.id],
      paymentCardIds: [payment.id]
    });

    expect(result.accepted).toBe(true);
    expect(result.state.handAttacks[0].block[0].effectiveValue).toBe(7);
    expect(result.state.handAttacks[0].block[0].notes).toContain("Ristus +2");
    expect(result.state.players[2].turnData.suitsPlayedThisTurn).toContain(blocker.suit);
  });

  test("allows Focus to target an active attacker during combat priority", () => {
    let state = setupFaction("bizi", "rumin");
    state.players[1].accelerationCounters = 1;
    const attack = handAttack(state, 1, 0, [1]);
    expect(attack.accepted).toBe(true);
    state = accepted(attack.state, {
      type: "declineBlock",
      player: 2,
      attackId: attack.state.handAttacks[0].id
    });
    const attackId = state.handAttacks[0].id;
    expect(getLegalActions(state, 1)).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "useFactionAbility", abilityId: "focus-buff" })
    ]));

    const result = applyCommand(state, {
      type: "useFactionAbility",
      player: 1,
      abilityId: "focus-buff",
      targetType: "handAttack",
      attackId
    });

    expect(result.accepted).toBe(true);
    expect(result.state.handAttacks[0].effectiveValue).toBe(
      state.handAttacks[0].effectiveValue + 1
    );
    expect(result.state.priorityPassed).toEqual({ 1: false, 2: false });
  });

  test("campaign boss strikes require a server system envelope and replay deterministically", () => {
    const state = setupFaction("rumin", "sheen");
    state.priority = 2;
    state.startingPriorityThisTurn = 2;
    state.campaign = {
      chapterId: "boss-test",
      chapterNumber: 2,
      opponentName: "The Test Warden",
      attacksPerTurn: 2,
      bossAttacksThisTurn: 0,
      minAttackValue: 5,
      maxAttackValue: 8,
      bossAbility: {
        id: "first-strike",
        name: "Opening Pressure"
      }
    };

    const forged = applyCommand(state, {
      type: "declareCampaignBossAttack",
      player: 2
    });
    expect(forged.accepted).toBe(false);
    expect(forged.rejection).toEqual(expect.objectContaining({
      code: "INVALID_COMMAND",
      message: "Campaign boss commands are server-authenticated."
    }));

    const envelope = {
      commandId: "campaign-system-strike",
      baseRevision: state.revision,
      actorPlayerId: 2,
      system: true,
      command: { type: "declareCampaignBossAttack" }
    };
    const result = applyCommand(state, envelope);
    const replay = applyCommand(state, envelope);
    expect(result.accepted).toBe(true);
    expect(result.state.priority).toBe(1);
    expect(result.state.campaign.bossAttacksThisTurn).toBe(1);
    expect(result.state.handAttacks[0]).toEqual(expect.objectContaining({
      player: 2,
      targetPlayer: 1,
      source: "campaignBoss",
      sourceLane: null
    }));
    expect(result.state.handAttacks[0].id).toBe(replay.state.handAttacks[0].id);
    expect(result.state.handAttacks[0].card.id).toBe(replay.state.handAttacks[0].card.id);
    expect(result.animationEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "campaign.attackDeclared", attackNumber: 1 }),
      expect.objectContaining({ type: "attack.declared", source: "campaignBoss" })
    ]));
  });

  test.each([
    ["first-strike", 1, {}, 1],
    ["first-strike", 2, {}, 0],
    ["odd-pressure", 1, {}, 1],
    ["odd-pressure", 2, {}, 0],
    ["even-feint", 2, { evenBonus: 2 }, 2],
    ["even-feint", 3, { evenBonus: 2 }, 0],
    ["final-push", 4, { tier: 3 }, 2],
    ["final-push", 3, { tier: 3 }, 0],
    ["late-pressure", 3, {}, 1],
    ["late-pressure", 4, {}, 1],
    ["late-pressure", 2, {}, 0],
    ["first-and-final", 1, {}, 1],
    ["first-and-final", 4, {}, 1],
    ["first-and-final", 2, {}, 0]
  ])("campaign ability %s applies its canonical bonus on strike %i", (
    abilityId,
    attackNumber,
    abilityOptions,
    expectedBonus
  ) => {
    const state = setupFaction("rumin", "sheen");
    state.priority = 2;
    state.startingPriorityThisTurn = 2;
    state.turn = 3;
    state.campaign = {
      chapterId: "ability-intent",
      chapterNumber: 4,
      opponentName: "Intent Warden",
      attacksPerTurn: 4,
      bossAttacksThisTurn: attackNumber - 1,
      minAttackValue: 5,
      maxAttackValue: 8,
      bossAbility: {
        id: abilityId,
        name: `Intent ${abilityId}`,
        ...abilityOptions
      }
    };
    const valueRange = state.campaign.maxAttackValue - state.campaign.minAttackValue + 1;
    const baseValue = state.campaign.minAttackValue
      + ((state.turn + attackNumber + state.campaign.chapterNumber) % valueRange);

    const result = applyCommand(state, {
      commandId: `campaign-${abilityId}-${attackNumber}`,
      baseRevision: state.revision,
      actorPlayerId: 2,
      system: true,
      command: { type: "declareCampaignBossAttack" }
    });

    expect(result.accepted).toBe(true);
    expect(result.state.handAttacks[0].effectiveValue).toBe(baseValue + expectedBonus);
    expect(result.state.handAttacks[0].notes.some((note) => note.includes(`+${expectedBonus}`)))
      .toBe(expectedBonus > 0);
  });

  test("campaign turn-start healing is resolved by the shared turn transition", () => {
    let state = setupFaction("rumin", "sheen");
    state.players[2].life = 17;
    state.campaign = {
      chapterId: "living-siege",
      chapterNumber: 10,
      opponentName: "Living Warden",
      attacksPerTurn: 4,
      bossAttacksThisTurn: 4,
      minAttackValue: 5,
      maxAttackValue: 8,
      bossAbility: {
        id: "odd-pressure",
        name: "Living Warden: Living Siege",
        healAtTurnStart: 1
      }
    };

    state = finishPlacementWithSkips(enterPlacement(state));

    expect(state.players[2].life).toBe(18);
    expect(state.campaign.bossAttacksThisTurn).toBe(0);
    expect(state.lastEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "campaign.bossHealed",
        player: 2,
        amount: 1,
        abilityId: "odd-pressure"
      })
    ]));
  });

  test.each([
    {
      definitionId: "rumin-gilded-scale-legionary",
      faction: "rumin",
      note: "Gilded Scale Legionary +1",
      configure: (state, attacker, payment) => {
        payment.suit = "♦";
      }
    },
    {
      definitionId: "sheen-thornroot-counterstroke",
      faction: "sheen",
      note: "Thornroot Counterstroke +2"
    },
    {
      definitionId: "sheen-nus-calm-command",
      faction: "sheen",
      note: "Nu's Calm Command +3",
      configure: (state) => {
        state.players[1].turnData.blocksDeclaredThisTurn = 3;
      }
    },
    {
      definitionId: "bizi-dune-circuit-runner",
      faction: "bizi",
      note: "Dune Circuit Runner +1",
      configure: (state, attacker) => {
        state.players[1].turnData.attacksDeclaredThisTurn = 1;
        state.players[1].turnData.previousAttackSuit = attacker.suit === "♠" ? "♥" : "♠";
      }
    },
    {
      definitionId: "bizi-railspike-marshal",
      faction: "bizi",
      note: "Railspike Marshal +1",
      configure: (state, attacker) => {
        state.players[1].turnData.attacksDeclaredThisTurn = 1;
        state.players[1].turnData.previousAttackSuit = attacker.suit === "♠" ? "♥" : "♠";
      }
    },
    {
      definitionId: "frumo-tideglass-cutlass",
      faction: "frumo",
      source: "lane",
      note: "Tideglass Cutlass +1",
      configure: (state) => {
        state.players[1].turnData.frumoLaneSwappedThisTurn = true;
      }
    },
    {
      definitionId: "frumo-pressure-lock-pistol",
      faction: "frumo",
      note: "Pressure-Lock Pistol +2",
      configure: (state, attacker) => {
        state.players[1].turnData.previousPlayedValue = attacker.value - 1;
      }
    },
    {
      definitionId: "frumo-ristus-blackwake",
      faction: "frumo",
      source: "lane",
      note: "Frumo empty lane +1"
    },
    {
      definitionId: "frumo-ballast-hook",
      faction: "frumo",
      source: "lane",
      note: "Frumo empty lane +1"
    },
    {
      definitionId: "frumo-captains-bad-wager",
      faction: "frumo",
      source: "lane",
      note: "Captain's Bad Wager +3",
      configure: (state) => {
        state.players[1].turnData.previousPlayedValue = 6;
      }
    }
  ])("applies $definitionId from its canonical automatic attack trigger", (scenario) => {
    const { attack } = constructedAttackScenario(scenario);
    expect(attack.notes).toContain(scenario.note);
  });

  test("rumin-tax-road-scout reduces only its first attack payment requirement", () => {
    const state = setupFaction("rumin", "sheen");
    const attacker = state.players[1].hand[0];
    const payment = state.players[1].hand[1];
    attacker.value = 4;
    payment.value = 3;
    makeConstructed(attacker, "rumin-tax-road-scout");

    const result = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id]
    });

    expect(result.accepted).toBe(true);
    expect(result.state.handAttacks[0].payment).toEqual(expect.objectContaining({
      required: 3,
      total: 3
    }));
  });

  test.each([
    {
      definitionId: "rumin-edict-of-the-vault",
      faction: "rumin",
      paymentValue: 1,
      expectedTotal: 4,
      note: "Edict of the Vault payment +3",
      configure: (state) => {
        state.players[1].turnData.attacksDeclaredThisTurn = 3;
        state.players[1].turnData.ruminMatchingSuitBonuses = 2;
      }
    },
    {
      definitionId: "frumo-sunken-coin",
      faction: "frumo",
      paymentValue: 3,
      expectedTotal: 4,
      note: "Sunken Coin payment +1"
    },
    {
      definitionId: "bizi-voltage-ration",
      faction: "bizi",
      paymentValue: 3,
      expectedTotal: 4,
      note: "Bizi payment card +1",
      attackerDefinitionId: "bizi-dune-circuit-runner"
    },
    {
      definitionId: "bizi-brass-spark",
      faction: "bizi",
      paymentValue: 3,
      expectedTotal: 4,
      note: "Bizi payment card +1",
      attackerDefinitionId: "bizi-railspike-marshal"
    },
    {
      definitionId: "bizi-heras-calibration",
      faction: "bizi",
      paymentValue: 2,
      expectedTotal: 4,
      note: "Hera's Calibration payment +2",
      attackerDefinitionId: "bizi-dune-circuit-runner"
    }
  ])("$definitionId changes the accepted semantic payment total", ({
    definitionId,
    faction,
    paymentValue,
    expectedTotal,
    note,
    attackerDefinitionId,
    configure = () => {}
  }) => {
    const state = setupFaction(faction, faction === "rumin" ? "sheen" : "rumin");
    const attacker = state.players[1].hand[0];
    const payment = state.players[1].hand[1];
    attacker.value = 4;
    attacker.rank = "4";
    payment.value = paymentValue;
    payment.rank = String(paymentValue);
    makeConstructed(payment, definitionId, { type: "tactic" });
    if (attackerDefinitionId) makeConstructed(attacker, attackerDefinitionId);
    configure(state, attacker, payment);

    const result = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id]
    });

    expect(result.accepted).toBe(true);
    expect(result.state.handAttacks[0].payment).toEqual(expect.objectContaining({
      required: 4,
      total: expectedTotal
    }));
    expect(result.state.handAttacks[0].notes).toContain(note);
  });

  test("sheen-harmony-ward enhances payment only for a multi-card block", () => {
    let state = setupFaction("rumin", "sheen");
    const attackingCard = state.players[1].hand[0];
    const attackingPayment = state.players[1].hand[1];
    attackingCard.value = 2;
    attackingPayment.value = 2;
    state = accepted(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attackingCard.id,
      paymentCardIds: [attackingPayment.id]
    });
    const blockerA = state.players[2].hand[0];
    const blockerB = state.players[2].hand[1];
    const payment = state.players[2].hand[2];
    blockerA.value = 2;
    blockerB.value = 2;
    payment.value = 3;
    makeConstructed(payment, "sheen-harmony-ward", { type: "ward" });

    const result = applyCommand(state, {
      type: "declareHandBlock",
      player: 2,
      attackId: state.handAttacks[0].id,
      blockerCardIds: [blockerA.id, blockerB.id],
      paymentCardIds: [payment.id]
    });

    expect(result.accepted).toBe(true);
    expect(result.state.handAttacks[0].block[0].notes).toContain("Harmony Ward payment +1");
    expect(result.state.handAttacks[0].block[0].payment).toEqual(expect.objectContaining({
      required: 4,
      total: 4
    }));
  });

  test.each([
    {
      definitionId: "rumin-vault-shield-bearer",
      faction: "rumin",
      note: "Vault Shield Bearer prevents 1",
      expectedPrevention: 1
    },
    {
      definitionId: "rumin-marble-phalanx",
      faction: "rumin",
      note: "Marble Phalanx +1",
      configure: (state) => {
        state.players[2].turnData.attacksDeclaredThisTurn = 1;
      }
    },
    {
      definitionId: "sheen-rootwatch-initiate",
      faction: "sheen",
      note: "Rootwatch Initiate +1",
      configure: (state) => {
        state.players[2].turnData.blocksDeclaredThisTurn = 1;
      }
    },
    {
      definitionId: "sheen-living-bark-guard",
      faction: "sheen",
      note: "Living Bark Guard +1"
    },
    {
      definitionId: "sheen-seedwall-acolyte",
      faction: "sheen",
      note: "Seedwall Acolyte +1"
    },
    {
      definitionId: "sheen-beli-canopy-shield",
      faction: "sheen",
      note: "Beli Canopy Shield prevents 1",
      expectedPrevention: 1
    },
    {
      definitionId: "sheen-nus-verdant-edict",
      faction: "sheen",
      note: "Nu's Verdant Edict +1",
      configure: (state) => {
        state.players[2].turnData.blocksDeclaredThisTurn = 2;
      }
    }
  ])("applies $definitionId from its canonical hand-block trigger", (scenario) => {
    const { block } = constructedHandBlockScenario(scenario);
    expect(block.notes).toContain(scenario.note);
    if (scenario.expectedPrevention) {
      expect(block.preventDamage).toBe(scenario.expectedPrevention);
    }
  });

  test.each([
    {
      definitionId: "sheen-mossbound-staff",
      blockerCount: 1,
      note: "Mossbound Staff +1"
    },
    {
      definitionId: "sheen-sapling-chorus",
      blockerCount: 2,
      note: "Sapling Chorus +1"
    }
  ])("$definitionId enhances the first blocker when used as payment", ({
    definitionId,
    blockerCount,
    note
  }) => {
    let state = setupFaction("rumin", "sheen");
    const attacker = state.players[1].hand[0];
    const attackPayment = state.players[1].hand[1];
    attacker.value = 8;
    attackPayment.value = 10;
    state = accepted(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [attackPayment.id]
    });
    const blockers = state.players[2].hand.slice(0, blockerCount);
    blockers.forEach((card) => {
      card.value = 2;
    });
    const payment = state.players[2].hand[blockerCount];
    payment.value = blockerCount * 2;
    makeConstructed(payment, definitionId, { type: "relic" });

    const result = applyCommand(state, {
      type: "declareHandBlock",
      player: 2,
      attackId: state.handAttacks[0].id,
      blockerCardIds: blockers.map((card) => card.id),
      paymentCardIds: [payment.id]
    });

    expect(result.accepted).toBe(true);
    expect(result.state.handAttacks[0].block[0].notes).toContain(note);
  });

  test.each([
    {
      definitionId: "rumin-rumie-vault-shield",
      name: "Rumie Vault Shield",
      expectedBonus: 3
    },
    {
      definitionId: "rumin-imperial-scale-pike",
      name: "Imperial Scale Pike",
      expectedBonus: 4,
      configure: (state, attacker) => {
        state.players[1].turnData.previousAttackSuit = attacker.suit;
      }
    },
    {
      definitionId: "rumin-aurelian-clawblade",
      name: "Aurelian Clawblade",
      expectedBonus: 4,
      expectLife: true
    },
    {
      definitionId: "rumin-triumphal-ram",
      name: "Triumphal Ram",
      attackValue: 8,
      expectedBonus: 5
    },
    {
      definitionId: "rumin-kaisers-gold-claw",
      name: "Kaiser's Gold Claw",
      expectedBonus: 6,
      configure: (state) => {
        state.players[1].turnData.attacksDeclaredThisTurn = 3;
        state.players[1].turnData.ruminMatchingSuitBonuses = 2;
      }
    }
  ])("$definitionId arms from its lane with the canonical combat value", ({
    definitionId,
    name,
    attackValue = 4,
    expectedBonus,
    expectLife = false,
    configure = () => {}
  }) => {
    const state = setupFaction("rumin", "sheen");
    const attacker = state.players[1].hand[0];
    const payment = state.players[1].hand[1];
    const weapon = state.players[1].hand[2];
    attacker.value = attackValue;
    attacker.rank = String(attackValue);
    payment.value = 10;
    payment.rank = "10";
    makeConstructed(weapon, definitionId, { type: "weapon", name });
    state.players[1].hand = state.players[1].hand.filter((card) => card.id !== weapon.id);
    state.lanes[0].facedown[1] = weapon;
    configure(state, attacker, payment, weapon);
    const lifeBefore = state.players[1].life;

    const result = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id],
      armWeaponCardIds: [weapon.id]
    });

    expect(result.accepted).toBe(true);
    expect(result.state.handAttacks[0].notes).toContain(`${name} armed +${expectedBonus}`);
    expect(result.state.handAttacks[0].attachedCards.map((card) => card.id)).toEqual([weapon.id]);
    expect(result.state.players[1].life).toBe(lifeBefore + (expectLife ? 1 : 0));
  });

  test("rumin-basilisk-standard adds its printed fourth-attack weapon bonus", () => {
    const state = setupFaction("rumin", "sheen");
    const attacker = state.players[1].hand[0];
    const payment = state.players[1].hand[1];
    const weapon = state.players[1].hand[2];
    const standard = state.players[1].hand[3];
    attacker.value = 4;
    payment.value = 10;
    makeConstructed(weapon, "rumin-coin-scale-spear", { type: "weapon", name: "Coin-Scale Spear" });
    makeConstructed(standard, "rumin-basilisk-standard", { type: "standard" });
    state.players[1].hand = state.players[1].hand.filter((card) => ![weapon.id, standard.id].includes(card.id));
    state.lanes[0].facedown[1] = weapon;
    state.lanes[1].facedown[1] = standard;
    state.players[1].turnData.attacksDeclaredThisTurn = 3;
    state.players[1].turnData.ruminMatchingSuitBonuses = 2;

    const result = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id],
      armWeaponCardIds: [weapon.id]
    });

    expect(result.accepted).toBe(true);
    expect(result.state.handAttacks[0].notes).toEqual(expect.arrayContaining([
      "Basilisk Standard +2",
      "Coin-Scale Spear armed +4"
    ]));
  });

  test("rumin-rumie-market-colossus is the only attacker that arms multiple lane weapons", () => {
    const state = setupFaction("rumin", "sheen");
    const attacker = state.players[1].hand[0];
    const payment = state.players[1].hand[1];
    const weapons = [state.players[1].hand[2], state.players[1].hand[3]];
    attacker.value = 4;
    payment.value = 10;
    makeConstructed(attacker, "rumin-rumie-market-colossus");
    weapons.forEach((weapon, index) => {
      makeConstructed(weapon, "rumin-coin-scale-spear", { type: "weapon", name: `Spear ${index + 1}` });
      state.lanes[index].facedown[1] = weapon;
    });
    state.players[1].hand = state.players[1].hand.filter((card) => !weapons.some((weapon) => weapon.id === card.id));

    const result = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id],
      armWeaponCardIds: weapons.map((weapon) => weapon.id)
    });

    expect(result.accepted).toBe(true);
    expect(result.state.handAttacks[0].attachedCards).toHaveLength(2);
    expect(result.state.handAttacks[0].notes).toEqual(expect.arrayContaining([
      "Spear 1 armed +3",
      "Spear 2 armed +3"
    ]));
  });

  test("rumin-marble-market-tribune readies exactly one bonus for the next armed weapon", () => {
    const { state, attack } = constructedAttackScenario({
      faction: "rumin",
      definitionId: "rumin-marble-market-tribune"
    });
    expect(attack.notes).toContain("Marble Market Tribune next weapon +1");
    expect(state.players[1].turnData.ruminNextWeaponArmBonus).toBe(1);
  });

  test("rumin-senate-vault-guard rewards its first qualifying overpayment", () => {
    const state = setupFaction("rumin", "sheen");
    const attacker = state.players[1].hand[0];
    const payment = state.players[1].hand[1];
    attacker.value = 2;
    payment.value = 10;
    makeConstructed(attacker, "rumin-senate-vault-guard");
    const lifeBefore = state.players[1].life;

    const result = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id]
    });

    expect(result.accepted).toBe(true);
    expect(result.state.players[1].life).toBe(lifeBefore + 1);
    expect(result.state.handAttacks[0].notes).toContain("Senate Vault Guard +1 life");
  });

  test("rumin-counting-house-aegis rewards the first overpaid Rumin card it supports", () => {
    const state = setupFaction("rumin", "sheen");
    const attacker = state.players[1].hand[0];
    const payment = state.players[1].hand[1];
    const aegis = state.players[1].hand[2];
    attacker.value = 2;
    payment.value = 10;
    makeConstructed(attacker, "rumin-gilded-scale-legionary");
    makeConstructed(aegis, "rumin-counting-house-aegis", { type: "relic" });
    state.players[1].hand = state.players[1].hand.filter((card) => card.id !== aegis.id);
    state.lanes[0].facedown[1] = aegis;
    const lifeBefore = state.players[1].life;

    const result = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id]
    });

    expect(result.accepted).toBe(true);
    expect(result.state.players[1].life).toBe(lifeBefore + 1);
    expect(result.state.handAttacks[0].notes).toContain("Counting-House Aegis +1 life");
  });

  test.each([
    {
      definitionId: "bizi-copperline-technician",
      assertion: (result) => {
        expect(result.state.players[1].accelerationCounters).toBe(2);
        expect(result.state.handAttacks[0].notes).toContain("Copperline Technician +1 acceleration");
      }
    },
    {
      definitionId: "bizi-clockwork-caravan",
      assertion: (result) => {
        expect(result.state.players[1].turnData.biziEndTurnDraws).toBe(1);
        expect(result.state.handAttacks[0].notes).toContain("Clockwork Caravan end-turn draw");
      }
    }
  ])("$definitionId resolves its qualifying overpayment state", ({ definitionId, assertion }) => {
    const state = setupFaction("bizi", "rumin");
    const attacker = state.players[1].hand[0];
    const payment = state.players[1].hand[1];
    attacker.value = 2;
    payment.value = 10;
    makeConstructed(attacker, definitionId);
    const result = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id]
    });
    expect(result.accepted).toBe(true);
    assertion(result);
  });

  test("bizi-regnum-voltage-bank and bizi-solar-array-adept react to acceleration deterministically", () => {
    const state = setupFaction("bizi", "rumin");
    const attacker = state.players[1].hand[0];
    const payment = state.players[1].hand[1];
    const bank = state.players[1].hand[2];
    const solar = state.players[1].hand[3];
    attacker.value = 2;
    payment.value = 10;
    makeConstructed(attacker, "bizi-dune-circuit-runner");
    makeConstructed(bank, "bizi-regnum-voltage-bank", { type: "relic" });
    makeConstructed(solar, "bizi-solar-array-adept");
    state.players[1].hand = state.players[1].hand.filter((card) => ![bank.id, solar.id].includes(card.id));
    state.lanes[0].facedown[1] = bank;
    state.lanes[1].facedown[1] = solar;
    const lifeBefore = state.players[1].life;

    const result = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id]
    });

    expect(result.accepted).toBe(true);
    expect(result.state.players[1].life).toBe(lifeBefore + 1);
    expect(result.state.players[1].accelerationCounters).toBe(2);
    expect(result.state.lanes[1].facedown[1].temporaryValueBonus).toBe(2);
  });

  test.each([
    {
      definitionId: "bizi-constanti-conduit",
      note: "Constanti Conduit +1"
    },
    {
      definitionId: "bizi-desert-logic-engine",
      note: "Desert Logic Engine +2"
    }
  ])("$definitionId supports a different-suit attack from its lane", ({ definitionId, note }) => {
    const state = setupFaction("bizi", "rumin");
    const attacker = state.players[1].hand[0];
    const payment = state.players[1].hand[1];
    const support = state.players[1].hand[2];
    attacker.value = 4;
    payment.value = 10;
    makeConstructed(attacker, "bizi-dune-circuit-runner");
    makeConstructed(support, definitionId, { type: "relic" });
    state.players[1].hand = state.players[1].hand.filter((card) => card.id !== support.id);
    state.lanes[0].facedown[1] = support;
    state.players[1].turnData.attacksDeclaredThisTurn = 1;
    state.players[1].turnData.previousAttackSuit = attacker.suit === "♠" ? "♥" : "♠";

    const result = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id]
    });

    expect(result.accepted).toBe(true);
    expect(result.state.handAttacks[0].notes).toContain(note);
  });

  test("bizi-focus-overclock changes Focus to its printed +3 while still spending one counter", () => {
    const state = setupFaction("bizi", "rumin");
    const overclock = state.players[1].hand.shift();
    const target = state.players[1].hand.shift();
    makeConstructed(overclock, "bizi-focus-overclock", { type: "tactic" });
    state.lanes[0].facedown[1] = overclock;
    state.lanes[1].facedown[1] = target;
    state.players[1].accelerationCounters = 1;

    const result = applyCommand(state, {
      type: "useFactionAbility",
      player: 1,
      abilityId: "focus-buff",
      laneIndex: 1
    });

    expect(result.accepted).toBe(true);
    expect(result.state.players[1].accelerationCounters).toBe(0);
    expect(result.state.lanes[1].facedown[1].temporaryValueBonus).toBe(3);
  });

  test("bizi-focus-prime-signal gains two counters and readies its bounded next-card choice", () => {
    const { state, attack } = constructedAttackScenario({
      faction: "bizi",
      definitionId: "bizi-focus-prime-signal"
    });
    expect(attack.notes).toEqual(expect.arrayContaining([
      "Focus Prime Signal +2 acceleration",
      "Focus Prime Signal readied up to +3"
    ]));
    expect(state.players[1].accelerationCounters).toBe(3);
    expect(state.players[1].turnData.biziPrimeSignalAvailable).toBe(3);
  });

  test.each([
    {
      definitionId: "sheen-ringroot-bastion",
      faction: "sheen",
      note: "Ringroot Bastion +2"
    },
    {
      definitionId: "frumo-coral-hull-guard",
      faction: "frumo",
      note: "Coral-Hull Guard +1",
      assertState: (state) => expect(state.players[2].turnData.frumoLaneSwappedThisTurn).toBe(true)
    }
  ])("$definitionId resolves only as a same-lane blocker", ({
    definitionId,
    faction,
    note,
    assertState = () => {}
  }) => {
    const state = setupFaction("rumin", faction);
    const attacker = state.players[1].hand.shift();
    const blocker = state.players[2].hand.shift();
    const attackPayment = state.players[1].hand[0];
    const blockPayment = state.players[2].hand[0];
    attacker.value = 6;
    blocker.value = 4;
    attackPayment.value = 10;
    blockPayment.value = 10;
    makeConstructed(blocker, definitionId);
    state.lanes[0].facedown[1] = attacker;
    state.lanes[0].facedown[2] = blocker;
    let result = applyCommand(state, {
      type: "declareLaneAttack",
      player: 1,
      laneIndex: 0,
      paymentCardIds: [attackPayment.id]
    });
    expect(result.accepted).toBe(true);
    result = applyCommand(result.state, {
      type: "declareLaneBlock",
      player: 2,
      laneIndex: 0,
      paymentCardIds: [blockPayment.id]
    });

    expect(result.accepted).toBe(true);
    expect(result.state.lanes[0].block[0].notes).toContain(note);
    assertState(result.state);
  });

  test.each([
    {
      definitionId: "sheen-quiet-grove-sentinel",
      source: "Quiet Grove Sentinel"
    },
    {
      definitionId: "sheen-raincall-mender",
      source: "Raincall Mender"
    }
  ])("$definitionId gains life only after a damage-free resolution", ({ definitionId, source }) => {
    let state = setupFaction("rumin", "sheen");
    const attacker = state.players[1].hand[0];
    const attackPayment = state.players[1].hand[1];
    attacker.value = 4;
    attackPayment.value = 4;
    state = accepted(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [attackPayment.id]
    });
    const blocker = state.players[2].hand[0];
    const blockPayment = state.players[2].hand[1];
    blocker.value = 4;
    blockPayment.value = 4;
    makeConstructed(blocker, definitionId);
    const lifeBefore = state.players[2].life;
    state = accepted(state, {
      type: "declareHandBlock",
      player: 2,
      attackId: state.handAttacks[0].id,
      blockerCardIds: [blocker.id],
      paymentCardIds: [blockPayment.id]
    });
    const result = applyCommand(state, { type: "passPriority", player: 1 });

    expect(result.accepted).toBe(true);
    expect(result.state.players[2].life).toBe(lifeBefore + 1);
    expect(result.animationEvents).toContainEqual(expect.objectContaining({
      type: "life.gained",
      player: 2,
      source
    }));
  });

  test("sheen-beli-vinebinder readies the next attack after the second block", () => {
    const { state, block } = constructedHandBlockScenario({
      faction: "sheen",
      definitionId: "sheen-beli-vinebinder",
      configure: (game) => {
        game.players[2].turnData.blocksDeclaredThisTurn = 1;
      }
    });
    expect(block.notes).toContain("Beli Vinebinder next attack +1");
    expect(state.players[2].turnData.sheenNextAttackBonus).toBe(1);
  });

  test("sheen-tangs-patient-hand and sheen-roots-that-remember chain life and delayed state", () => {
    let state = setupFaction("rumin", "sheen");
    const attacker = state.players[1].hand[0];
    const attackPayment = state.players[1].hand[1];
    attacker.value = 8;
    attackPayment.value = 10;
    state = accepted(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [attackPayment.id]
    });
    const blocker = state.players[2].hand[0];
    const blockPayment = state.players[2].hand[1];
    const roots = state.players[2].hand[2];
    blocker.value = 4;
    blockPayment.value = 10;
    makeConstructed(blocker, "sheen-tangs-patient-hand", { type: "tactic" });
    makeConstructed(roots, "sheen-roots-that-remember", { type: "relic" });
    state.players[2].hand = state.players[2].hand.filter((card) => card.id !== roots.id);
    state.lanes[0].facedown[2] = roots;
    state.players[2].turnData.blocksDeclaredThisTurn = 1;
    const lifeBefore = state.players[2].life;

    const result = applyCommand(state, {
      type: "declareHandBlock",
      player: 2,
      attackId: state.handAttacks[0].id,
      blockerCardIds: [blocker.id],
      paymentCardIds: [blockPayment.id]
    });

    expect(result.accepted).toBe(true);
    expect(result.state.players[2].life).toBe(lifeBefore + 4);
    expect(result.state.players[2].turnData.sheenEndTurnDraws).toBe(1);
    expect(result.state.players[2].turnData.sheenNextBlockBonus).toBe(2);
    expect(result.state.handAttacks[0].block[0].notes).toEqual(expect.arrayContaining([
      "Tang's Patient Hand +2 life",
      "Tang's Patient Hand end-turn draw"
    ]));
  });

  test("sheen-emperors-heartwood improves every blocker and heals on the third block", () => {
    let state = setupFaction("rumin", "sheen");
    const attacker = state.players[1].hand[0];
    const attackPayment = state.players[1].hand[1];
    attacker.value = 8;
    attackPayment.value = 10;
    state = accepted(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [attackPayment.id]
    });
    const blocker = state.players[2].hand[0];
    const blockPayment = state.players[2].hand[1];
    const heartwood = state.players[2].hand[2];
    blocker.value = 4;
    blockPayment.value = 10;
    makeConstructed(heartwood, "sheen-emperors-heartwood", { type: "relic" });
    state.players[2].hand = state.players[2].hand.filter((card) => card.id !== heartwood.id);
    state.lanes[0].facedown[2] = heartwood;
    state.players[2].turnData.blocksDeclaredThisTurn = 2;
    const lifeBefore = state.players[2].life;

    const result = applyCommand(state, {
      type: "declareHandBlock",
      player: 2,
      attackId: state.handAttacks[0].id,
      blockerCardIds: [blocker.id],
      paymentCardIds: [blockPayment.id]
    });

    expect(result.accepted).toBe(true);
    expect(result.state.handAttacks[0].block[0].notes).toContain("Emperor's Heartwood +1");
    expect(result.state.players[2].life).toBe(lifeBefore + 1);
  });

  test("frumo-riptide-smuggler gains its once-per-turn value from Polea inspection", () => {
    const state = setupFaction("frumo", "rumin");
    const smuggler = state.players[1].hand.shift();
    const target = state.players[2].hand.shift();
    makeConstructed(smuggler, "frumo-riptide-smuggler");
    state.lanes[0].facedown[1] = smuggler;
    state.lanes[1].facedown[2] = target;

    const result = applyCommand(state, {
      type: "useFactionAbility",
      player: 1,
      abilityId: "polea-peek",
      laneIndex: 1,
      targetPlayerId: 2
    });

    expect(result.accepted).toBe(true);
    expect(result.state.lanes[0].facedown[1].temporaryValueBonus).toBe(1);
    expect(result.state.players[1].turnData.frumoRiptideSmugglerUsed).toBe(true);
  });

  test("frumo-lafayettes-chart and frumo-tide-debt-ledger stack their next-payment rewards", () => {
    const state = setupFaction("frumo", "rumin");
    const chart = state.players[1].hand.shift();
    const ledger = state.players[1].hand.shift();
    const laneCard = state.players[1].hand.shift();
    const handCard = state.players[1].hand[0];
    makeConstructed(chart, "frumo-lafayettes-chart", { type: "relic" });
    makeConstructed(ledger, "frumo-tide-debt-ledger", { type: "relic" });
    state.lanes[0].facedown[1] = chart;
    state.lanes[1].facedown[1] = ledger;
    state.lanes[2].facedown[1] = laneCard;

    const result = applyCommand(state, {
      type: "useFactionAbility",
      player: 1,
      abilityId: "lafayette-swap",
      laneIndex: 2,
      cardId: handCard.id
    });

    expect(result.accepted).toBe(true);
    expect(result.state.players[1].turnData.frumoNextPaymentBonus).toBe(2);
    expect(result.state.lanes[2].facedown[1].id).toBe(handCard.id);
  });

  test("frumo-poleas-sunken-order grants exactly one additional own-card Polea use", () => {
    let state = setupFaction("frumo", "rumin");
    const order = state.players[1].hand.shift();
    const ownTarget = state.players[1].hand.shift();
    const opposingTarget = state.players[2].hand.shift();
    makeConstructed(order, "frumo-poleas-sunken-order", { type: "tactic" });
    state.lanes[0].facedown[1] = order;
    state.lanes[1].facedown[1] = ownTarget;
    state.lanes[2].facedown[2] = opposingTarget;
    state = accepted(state, {
      type: "useFactionAbility",
      player: 1,
      abilityId: "polea-peek",
      laneIndex: 2,
      targetPlayerId: 2
    });

    const result = applyCommand(state, {
      type: "useFactionAbility",
      player: 1,
      abilityId: "polea-peek",
      laneIndex: 1,
      targetPlayerId: 1
    });

    expect(result.accepted).toBe(true);
    expect(result.state.players[1].turnData.poleaSunkenOrderUsed).toBe(true);
    expect(applyCommand(result.state, {
      type: "useFactionAbility",
      player: 1,
      abilityId: "polea-peek",
      laneIndex: 1,
      targetPlayerId: 1
    }).accepted).toBe(false);
  });

  test("frumo-leviathan-salvage gains life when it receives Ristus's consecutive bonus", () => {
    const state = setupFaction("frumo", "rumin");
    const attacker = state.players[1].hand[0];
    const payment = state.players[1].hand[1];
    attacker.value = 5;
    payment.value = 10;
    makeConstructed(attacker, "frumo-leviathan-salvage", { type: "relic" });
    state.players[1].turnData.previousPlayedValue = 4;
    const lifeBefore = state.players[1].life;

    const result = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id]
    });

    expect(result.accepted).toBe(true);
    expect(result.state.players[1].life).toBe(lifeBefore + 1);
    expect(result.state.handAttacks[0].notes).toEqual(expect.arrayContaining([
      "Ristus +2",
      "Leviathan Salvage +1 life"
    ]));
  });

  test.each([
    {
      definitionId: "frumo-kelpcloak-trickster",
      assertState: (state, card) => {
        expect(state.players[1].turnData.frumoLaneSwappedThisTurn).toBe(true);
        expect(card.temporaryValueBonus).toBeUndefined();
      }
    },
    {
      definitionId: "frumo-abyssal-switchboard",
      assertState: (state) => expect(state.players[1].turnData.frumoNextActionBonus).toBe(1)
    },
    {
      definitionId: "frumo-ristus-rises",
      assertState: (state, card) => {
        expect(state.players[1].turnData.frumoLaneSwappedThisTurn).toBe(true);
        expect(card.temporaryValueBonus).toBe(1);
      }
    }
  ])("$definitionId resolves when Polea places it into a lane", ({ definitionId, assertState }) => {
    const state = setupFaction("frumo", "rumin");
    const card = state.players[1].hand[0];
    makeConstructed(card, definitionId);

    const result = applyCommand(state, {
      type: "useFactionAbility",
      player: 1,
      abilityId: "polea-place",
      laneIndex: 0,
      cardId: card.id
    });

    expect(result.accepted).toBe(true);
    assertState(result.state, result.state.lanes[0].facedown[1]);
  });

  test("frumo-poleas-moonlit-map adds one beyond its Ristus blocking bonus", () => {
    let state = setupFaction("rumin", "frumo");
    const attacker = state.players[1].hand[0];
    const attackPayment = state.players[1].hand[1];
    attacker.value = 8;
    attackPayment.value = 10;
    state = accepted(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [attackPayment.id]
    });
    const blocker = state.players[2].hand[0];
    const blockPayment = state.players[2].hand[1];
    blocker.value = 5;
    blockPayment.value = 10;
    makeConstructed(blocker, "frumo-poleas-moonlit-map", { type: "tactic" });
    state.players[2].turnData.previousPlayedValue = 4;

    const result = applyCommand(state, {
      type: "declareHandBlock",
      player: 2,
      attackId: state.handAttacks[0].id,
      blockerCardIds: [blocker.id],
      paymentCardIds: [blockPayment.id]
    });

    expect(result.accepted).toBe(true);
    expect(result.state.handAttacks[0].block[0].notes).toEqual(expect.arrayContaining([
      "Ristus +2",
      "Polea's Moonlit Map +1"
    ]));
  });

  test("uses stable constructed definition identity and keeps Forum Ledger optional", () => {
    const state = setupFaction("rumin", "sheen");
    const attacker = state.players[1].hand.find((card) => card.value === 3);
    const payment = state.players[1].hand.find((card) => card.value === 2);
    makeConstructed(attacker, "rumin-forum-ledger-runner");

    const withoutChoice = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id]
    });
    expect(withoutChoice.accepted).toBe(false);

    const withChoice = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id],
      forumLedgerPaymentCardId: payment.id
    });
    expect(withChoice.accepted).toBe(true);
    expect(withChoice.state.handAttacks[0].payment.total).toBe(3);
    expect(withChoice.state.handAttacks[0].notes).toContain("Forum Ledger Runner payment +1");
  });

  test("readies Jewel-Bank Contract and only consumes it by explicit choice", () => {
    let state = setupFaction("rumin", "sheen");
    const contract = state.players[1].hand.find((card) => card.value === 2);
    const contractPayment = state.players[1].hand.find((card) => card.value === 3);
    makeConstructed(contract, "rumin-jewel-bank-contract", { type: "tactic" });
    let result = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: contract.id,
      paymentCardIds: [contractPayment.id]
    });
    expect(result.accepted).toBe(true);
    expect(result.state.players[1].turnData.ruminJewelBankAvailable).toBe(true);

    state = setupFaction("rumin", "sheen");
    const attacker = state.players[1].hand.find((card) => card.value === 4);
    const payment = state.players[1].hand.find((card) => card.value === 2);
    state.players[1].turnData.ruminJewelBankAvailable = true;
    expect(applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id]
    }).accepted).toBe(false);

    result = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id],
      useJewelBankBonus: true
    });
    expect(result.accepted).toBe(true);
    expect(result.state.handAttacks[0].payment.total).toBe(4);
    expect(result.state.players[1].turnData.ruminJewelBankAvailable).toBe(false);
  });

  test("arms only explicitly selected Rumin lane weapons", () => {
    const state = setupFaction("rumin", "sheen");
    const attacker = state.players[1].hand.find((card) => card.value === 2);
    const payment = state.players[1].hand.find((card) => card.value === 3);
    const weapon = state.players[1].hand.find((card) => card.value === 4);
    makeConstructed(weapon, "rumin-coin-scale-spear", { type: "weapon" });
    state.players[1].hand = state.players[1].hand.filter((card) => card.id !== weapon.id);
    state.lanes[0].facedown[1] = weapon;

    const withoutArm = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id]
    });
    expect(withoutArm.accepted).toBe(true);
    expect(withoutArm.state.handAttacks[0].attachedCards).toEqual([]);
    expect(withoutArm.state.lanes[0].facedown[1].id).toBe(weapon.id);

    const withArm = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id],
      armWeaponCardIds: [weapon.id]
    });
    expect(withArm.accepted).toBe(true);
    expect(withArm.state.handAttacks[0].attachedCards.map((card) => card.id)).toEqual([weapon.id]);
    expect(withArm.state.handAttacks[0].effectiveValue).toBe(
      withoutArm.state.handAttacks[0].effectiveValue + 2
    );
    expect(withArm.state.lanes[0].facedown[1]).toBeNull();
  });

  test("Constanti Sunforge spends the chosen amount instead of the automatic maximum", () => {
    const state = setupFaction("bizi", "sheen");
    const attacker = state.players[1].hand.find((card) => card.value === 4);
    const payment = state.players[1].hand.find((card) => card.value >= 4 && card.id !== attacker.id);
    makeConstructed(attacker, "bizi-constanti-sunforge");
    state.players[1].accelerationCounters = 3;

    const withoutSpend = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id]
    });
    expect(withoutSpend.accepted).toBe(true);
    expect(withoutSpend.state.players[1].accelerationCounters).toBe(3);

    const withSpend = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id],
      sunforgeAccelerationToSpend: 2
    });
    expect(withSpend.accepted).toBe(true);
    expect(withSpend.state.players[1].accelerationCounters).toBe(1);
    expect(withSpend.state.handAttacks[0].effectiveValue).toBe(
      withoutSpend.state.handAttacks[0].effectiveValue + 4
    );
  });

  test("Beli Awakened keeps its readied bonus until explicitly chosen", () => {
    const state = setupFaction("sheen", "rumin");
    const attacker = state.players[1].hand.find((card) => card.value === 4);
    const payment = state.players[1].hand.find((card) => card.value >= 4 && card.id !== attacker.id);
    makeConstructed(attacker, "sheen-beli-awakened");
    state.players[1].turnData.beliAwakenedReady = true;

    const withoutChoice = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id]
    });
    expect(withoutChoice.accepted).toBe(true);
    expect(withoutChoice.state.players[1].turnData.beliAwakenedReady).toBe(true);

    const withChoice = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id],
      useBeliAwakenedBonus: true
    });
    expect(withChoice.accepted).toBe(true);
    expect(withChoice.state.handAttacks[0].effectiveValue).toBe(
      withoutChoice.state.handAttacks[0].effectiveValue + 3
    );
    expect(withChoice.state.players[1].turnData.beliAwakenedReady).toBe(false);
  });

  test("Sandstorm Processor grants its optional bonus without spending acceleration", () => {
    const state = setupFaction("bizi", "sheen");
    const attacker = state.players[1].hand.find((card) => card.value === 4);
    const payment = state.players[1].hand.find((card) => card.id !== attacker.id && card.value >= attacker.value);
    makeConstructed(attacker, "bizi-sandstorm-processor");
    state.players[1].accelerationCounters = 2;

    const withoutChoice = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id]
    });
    const withChoice = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id],
      useSandstormProcessor: true
    });

    expect(withoutChoice.accepted).toBe(true);
    expect(withChoice.accepted).toBe(true);
    expect(withChoice.state.handAttacks[0].effectiveValue).toBe(
      withoutChoice.state.handAttacks[0].effectiveValue + 2
    );
    expect(withChoice.state.players[1].accelerationCounters).toBe(2);
  });

  test("Voltaric Ultimatum spends exactly two acceleration only when chosen", () => {
    const state = setupFaction("bizi", "sheen");
    const attacker = state.players[1].hand.find((card) => card.value === 4);
    const payment = state.players[1].hand.find((card) => card.id !== attacker.id && card.value >= attacker.value);
    makeConstructed(attacker, "bizi-voltaric-ultimatum");
    state.players[1].accelerationCounters = 2;

    const withoutChoice = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id]
    });
    const withChoice = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id],
      useVoltaricUltimatum: true
    });

    expect(withoutChoice.accepted).toBe(true);
    expect(withoutChoice.state.players[1].accelerationCounters).toBe(2);
    expect(withChoice.accepted).toBe(true);
    expect(withChoice.state.handAttacks[0].effectiveValue).toBe(
      withoutChoice.state.handAttacks[0].effectiveValue + 5
    );
    expect(withChoice.state.players[1].accelerationCounters).toBe(0);
  });

  test("Focus Prime Signal applies the chosen amount without removing acceleration", () => {
    const state = setupFaction("bizi", "sheen");
    const attacker = state.players[1].hand.find((card) => card.value === 4);
    const payment = state.players[1].hand.find((card) => card.id !== attacker.id && card.value >= attacker.value);
    state.players[1].accelerationCounters = 3;
    state.players[1].turnData.biziPrimeSignalAvailable = 3;

    const withoutChoice = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id]
    });
    const withChoice = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id],
      primeSignalBonus: 2
    });

    expect(withoutChoice.accepted).toBe(true);
    expect(withoutChoice.state.players[1].turnData.biziPrimeSignalAvailable).toBe(3);
    expect(withChoice.accepted).toBe(true);
    expect(withChoice.state.handAttacks[0].effectiveValue).toBe(
      withoutChoice.state.handAttacks[0].effectiveValue + 2
    );
    expect(withChoice.state.players[1].accelerationCounters).toBe(3);
    expect(withChoice.state.players[1].turnData.biziPrimeSignalAvailable).toBe(0);
  });

  test("Gearplate Shield spends acceleration only when its blocker is selected", () => {
    let state = setupFaction("rumin", "bizi");
    state = handAttack(state, 1, 0, [1]).state;
    const blocker = state.players[2].hand.find((card) => card.value === 2);
    const payment = state.players[2].hand.find((card) => card.value >= 2 && card.id !== blocker.id);
    makeConstructed(blocker, "bizi-gearplate-shield", { type: "relic" });
    state.players[2].accelerationCounters = 1;

    const withoutSpend = applyCommand(state, {
      type: "declareHandBlock",
      player: 2,
      attackId: state.handAttacks[0].id,
      blockerCardIds: [blocker.id],
      paymentCardIds: [payment.id]
    });
    expect(withoutSpend.accepted).toBe(true);
    expect(withoutSpend.state.handAttacks[0].block[0].effectiveValue).toBe(2);
    expect(withoutSpend.state.players[2].accelerationCounters).toBe(1);

    const withSpend = applyCommand(state, {
      type: "declareHandBlock",
      player: 2,
      attackId: state.handAttacks[0].id,
      blockerCardIds: [blocker.id],
      paymentCardIds: [payment.id],
      accelerationBlockerCardIds: [blocker.id]
    });
    expect(withSpend.accepted).toBe(true);
    expect(withSpend.state.handAttacks[0].block[0].effectiveValue).toBe(4);
    expect(withSpend.state.players[2].accelerationCounters).toBe(0);
  });

  test("Heat-Sink Matrix uses the same explicit blocker acceleration choice", () => {
    let state = setupFaction("rumin", "bizi");
    state = handAttack(state, 1, 0, [1]).state;
    const blocker = state.players[2].hand.find((card) => card.value === 2);
    const payment = state.players[2].hand.find((card) => card.value >= 2 && card.id !== blocker.id);
    makeConstructed(blocker, "bizi-heat-sink-matrix", { type: "relic" });
    state.players[2].accelerationCounters = 1;

    const result = applyCommand(state, {
      type: "declareHandBlock",
      player: 2,
      attackId: state.handAttacks[0].id,
      blockerCardIds: [blocker.id],
      paymentCardIds: [payment.id],
      accelerationBlockerCardIds: [blocker.id]
    });

    expect(result.accepted).toBe(true);
    expect(result.state.handAttacks[0].block[0].effectiveValue).toBe(4);
    expect(result.state.players[2].accelerationCounters).toBe(0);
  });

  test("Deckhand Diver peek remains optional and private during placement", () => {
    let state = enterPlacement(setupFaction("frumo", "rumin"));
    const diver = state.players[1].hand[0];
    makeConstructed(diver, "frumo-deckhand-diver");
    const result = applyCommand(state, {
      type: "placeFacedown",
      player: 1,
      laneIndex: 0,
      cardId: diver.id,
      useDeckhandDiverPeek: true
    });

    expect(result.accepted).toBe(true);
    const ownerEvent = projectForPerspective(result.state, 1).lastEvents
      .find((entry) => entry.type === "card.peeked");
    const opponentEvent = projectForPerspective(result.state, 2).lastEvents
      .find((entry) => entry.type === "card.peeked");
    expect(ownerEvent.card).toBeDefined();
    expect(opponentEvent.card).toBeUndefined();
    expect(projectForPerspective(result.state, 2).lastEvents
      .find((entry) => entry.type === "card.placedFacedown").cardId).toBeUndefined();
  });

  test("The Last Gamble explicitly chooses which next action receives +4", () => {
    const state = setupFaction("frumo", "rumin");
    const gamble = state.players[1].hand.shift();
    const target = state.players[2].hand.shift();
    makeConstructed(gamble, "frumo-the-last-gamble", { type: "tactic" });
    state.lanes[0].facedown[1] = gamble;
    state.lanes[1].facedown[2] = target;

    const peek = applyCommand(state, {
      type: "useFactionAbility",
      player: 1,
      abilityId: "polea-peek",
      laneIndex: 1,
      targetPlayerId: 2,
      lastGambleChoice: "attack"
    });
    expect(peek.accepted).toBe(true);
    expect(peek.state.players[1].turnData.frumoNextActionBonus).toBe(4);
    expect(peek.state.players[1].turnData.frumoNextActionKind).toBe("attack");

    const attacker = peek.state.players[1].hand
      .slice()
      .sort((left, right) => left.value - right.value)[0];
    const payment = peek.state.players[1].hand.find((card) => (
      card.id !== attacker.id && card.value >= attacker.value
    ));
    const attack = applyCommand(peek.state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id]
    });
    expect(attack.accepted).toBe(true);
    expect(attack.state.handAttacks[0].notes).toContain("Frumo next action +4");
    expect(attack.state.players[1].turnData.frumoNextActionBonus).toBe(0);
    expect(attack.state.players[1].turnData.frumoNextActionKind).toBeNull();
  });

  test("legal actions expose constructed choices without applying them", () => {
    const state = setupFaction("rumin", "sheen");
    const attacker = state.players[1].hand.find((card) => card.value === 3);
    const weapon = state.players[1].hand.find((card) => card.value === 4);
    makeConstructed(attacker, "rumin-forum-ledger-runner");
    makeConstructed(weapon, "rumin-coin-scale-spear", { type: "weapon" });
    state.players[1].hand = state.players[1].hand.filter((card) => card.id !== weapon.id);
    state.lanes[1].facedown[1] = weapon;

    const action = getLegalActions(state, 1)
      .find((entry) => entry.type === "declareHandAttack" && entry.cardId === attacker.id);
    expect(action.optionalEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "forum-ledger-payment" }),
      expect.objectContaining({
        id: "arm-rumin-weapons",
        cardIds: [weapon.id]
      })
    ]));
    expect(state.lanes[1].facedown[1].id).toBe(weapon.id);
  });

  test("constructed choices replay deterministically and reject invalid spending without mutation", () => {
    const state = setupFaction("bizi", "sheen");
    const attacker = state.players[1].hand.find((card) => card.value === 4);
    const payment = state.players[1].hand.find((card) => card.value >= 4 && card.id !== attacker.id);
    makeConstructed(attacker, "bizi-constanti-sunforge");
    state.players[1].accelerationCounters = 2;
    const envelope = createCommandEnvelope(state, 1, {
      type: "declareHandAttack",
      cardId: attacker.id,
      paymentCardIds: [payment.id],
      sunforgeAccelerationToSpend: 2
    }, "constructed-replay-command");

    const first = applyCommand(state, envelope);
    const replay = applyCommand(JSON.parse(JSON.stringify(state)), envelope);
    expect(first.accepted).toBe(true);
    expect(replay).toEqual(first);

    const invalid = applyCommand(state, {
      type: "declareHandAttack",
      player: 1,
      cardId: attacker.id,
      paymentCardIds: [payment.id],
      sunforgeAccelerationToSpend: 3
    });
    expect(invalid.accepted).toBe(false);
    expect(invalid.revision).toBe(state.revision);
    expect(invalid.state.players[1].accelerationCounters).toBe(2);
    expect(invalid.state.players[1].hand.map((card) => card.id)).toEqual(
      state.players[1].hand.map((card) => card.id)
    );
  });
});
