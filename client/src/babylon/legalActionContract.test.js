const {
  applyCommand,
  createMatch,
  getActionAvailability,
  getLegalActions,
  projectForPerspective
} = require("@gauntlet/duel-rules");

function paymentFor(hand, required, excluded = []) {
  const excludedIds = new Set(excluded);
  const selected = [];
  let total = 0;
  for (const card of hand) {
    if (excludedIds.has(card.id) || total >= required) continue;
    selected.push(card.id);
    total += Number(card.value || 0);
  }
  return selected;
}

test("normalizes attack sources, targets, payment, and confirmation payloads", () => {
  const game = createMatch({ seed: "legal-contract-basic", startingPriority: 1 }).state;
  const action = getLegalActions(game, 1).find((entry) => entry.type === "declareHandAttack");

  expect(action.available).toBe(true);
  expect(action.validSourceEntities).toEqual([
    expect.objectContaining({ type: "handCard", cardId: action.cardId, owner: 1 })
  ]);
  expect(action.validTargetEntities).toEqual([
    expect.objectContaining({ type: "player", playerId: 2 })
  ]);
  expect(action.payment).toEqual(expect.objectContaining({
    requiredValue: action.requiredPayment,
    mode: "cardValueTotal",
    excludedCardIds: [action.cardId],
    selectionOrderMatters: false
  }));
  expect(action.payment.eligibleCardIds).not.toContain(action.cardId);
  expect(action.confirmationPayload).toEqual(expect.objectContaining({
    type: "declareHandAttack",
    fixed: expect.objectContaining({ cardId: action.cardId, targetPlayerId: 2 })
  }));
});

test("normalizes hand blocking with distinct blocker and payment selections", () => {
  let game = createMatch({ seed: "legal-contract-block", startingPriority: 1 }).state;
  const attackAction = getLegalActions(game, 1).find((entry) => entry.type === "declareHandAttack");
  const attack = applyCommand(game, {
    player: 1,
    type: "declareHandAttack",
    cardId: attackAction.cardId,
    paymentCardIds: paymentFor(game.players[1].hand, attackAction.requiredPayment, [attackAction.cardId])
  });
  expect(attack.accepted).toBe(true);
  game = attack.state;

  const block = getLegalActions(game, 2).find((entry) => entry.type === "declareHandBlock");
  expect(block.selection.sources[0]).toEqual(expect.objectContaining({
    key: "blockerCardIds",
    role: "blocker",
    minimum: 1,
    maximum: game.players[2].hand.length,
    ordered: false
  }));
  expect(block.payment).toEqual(expect.objectContaining({
    mode: "selectedCardValueTotal",
    excludesSelections: ["blockerCardIds"]
  }));
  expect(block.validTargetEntities).toEqual([
    expect.objectContaining({ type: "handAttack", attackId: game.handAttacks[0].id })
  ]);
});

test("faction targeting is server-authored and does not expose hidden lane-card IDs", () => {
  const game = createMatch({
    seed: "legal-contract-faction",
    gameMode: "factions",
    startingPriority: 1,
    factions: {
      1: { id: "frumo", name: "Frumo" },
      2: { id: "sheen", name: "Sheen" }
    }
  }).state;
  const hiddenCard = game.players[2].hand.shift();
  game.lanes[1].facedown[2] = hiddenCard;

  const projected = projectForPerspective(game, 1);
  const place = projected.legalActions.find((entry) => entry.abilityId === "polea-place");
  const peek = projected.legalActions.find((entry) => entry.abilityId === "polea-peek");
  expect(place.selection.sources[0].entities).toHaveLength(game.players[1].hand.length);
  expect(place.selection.targets[0].entities.every((entity) => entity.type === "lane")).toBe(true);
  expect(peek.validTargetEntities).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "laneCard", laneIndex: 1, owner: 2 })
  ]));
  expect(JSON.stringify(projected)).not.toContain(hiddenCard.id);
});

test("server-derived availability explains every lane and faction action", () => {
  const game = createMatch({
    seed: "legal-contract-availability",
    gameMode: "factions",
    startingPriority: 1,
    factions: {
      1: { id: "frumo", name: "Frumo" },
      2: { id: "sheen", name: "Sheen" }
    }
  }).state;
  const availability = getActionAvailability(game, 1);

  expect(availability.laneAttacks).toHaveLength(3);
  expect(availability.laneAttacks.every((entry) => (
    entry.available === false && /no face-down card/i.test(entry.unavailableReason)
  ))).toBe(true);
  expect(availability.factionAbilities).toEqual(expect.arrayContaining([
    expect.objectContaining({ abilityId: "polea-place", available: true }),
    expect.objectContaining({ abilityId: "polea-swap", available: false, unavailableReason: expect.any(String) })
  ]));
});
