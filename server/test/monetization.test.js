const test = require("node:test");
const assert = require("node:assert/strict");

const { getLegalActions } = require("../../shared/duel-rules");
const {
  COLLECTOR_VARIANT_MECHANICAL_FIELDS,
  COLLECTOR_VARIANTS,
  COLLECTION_CARDS,
  FREE_GAMEPLAY_ACQUISITION,
  PAID_COLLECTOR_ACQUISITION,
  getCollectorVariantById,
  validateCollectorVariant
} = require("../gameContent");
const { server, __test } = require("../index");

const {
  buildCompetitiveCapabilitySnapshot,
  calculateAttackBonuses,
  createTurnData,
  getSavedConstructedDeck,
  grantPurchasedCollectorPack,
  normalizeCollection,
  normalizeDeckLibrary,
  openCollectionBooster,
  redeemCollectorEntitlementStats,
  saveConstructedDeckToLibrary,
  validateConstructedDeckPayload
} = __test;

test.after(() => server.close());

const GAMEPLAY_CARD_ID = "rumin-gilded-scale-legionary";
const PAID_VARIANT_ID = `${GAMEPLAY_CARD_ID}:collector-foil`;
const OTHER_CARD_VARIANT_ID = "sheen-rootwatch-initiate:collector-foil";

function makeStats() {
  return {
    collection: {
      cards: { [GAMEPLAY_CARD_ID]: 2 }
    }
  };
}

function deckPayload(collectorVariantSelections = {}) {
  return {
    name: "Fair Play Guard",
    factionId: "rumin",
    gameplayCardQuantities: { [GAMEPLAY_CARD_ID]: 2 },
    cardSuitChoices: { [GAMEPLAY_CARD_ID]: ["spades", "hearts"] },
    collectorVariantSelections
  };
}

function mechanicalCardProjection(card) {
  return {
    gameplayCardId: card.gameplayCardId,
    factionId: card.factionId,
    type: card.type,
    value: card.value,
    text: card.text,
    rulesText: card.rulesText,
    suit: card.suit,
    replacementSuit: card.replacementSuit
  };
}

function makeSemanticGame(card) {
  const makePlayer = (player, factionId) => ({
    player,
    name: `Player ${player}`,
    faction: { id: factionId, name: factionId },
    factionId,
    life: 42,
    hand: player === 1 ? [{ ...card, id: "semantic-card-1" }] : [],
    deck: [],
    discard: [],
    turnData: createTurnData(),
    accelerationCounters: 0
  });
  return {
    gameMode: "factions",
    phase: "priority",
    turn: 1,
    priority: 1,
    startingPriorityThisTurn: 1,
    priorityPassed: { 1: false, 2: false },
    players: { 1: makePlayer(1, "rumin"), 2: makePlayer(2, "sheen") },
    lanes: Array.from({ length: 3 }, () => ({ facedown: { 1: null, 2: null }, attack: null, block: [] })),
    handAttacks: [],
    eventLog: [],
    endPlaced: { 1: [false, false, false], 2: [false, false, false] },
    winner: null,
    message: ""
  };
}

test("every competitive gameplay definition has a free acquisition path and free default presentation", () => {
  assert.equal(COLLECTION_CARDS.length, 72);
  for (const card of COLLECTION_CARDS) {
    assert.equal(card.gameplayCardId, card.id);
    assert.equal(card.freeAcquisition, FREE_GAMEPLAY_ACQUISITION);
    const defaultVariant = getCollectorVariantById(card.defaultVariantId);
    assert.equal(defaultVariant.gameplayCardId, card.gameplayCardId);
    assert.equal(defaultVariant.paid, false);
    assert.equal(defaultVariant.acquisition, FREE_GAMEPLAY_ACQUISITION);
  }
  assert.equal(COLLECTOR_VARIANTS.filter((variant) => variant.paid).every((variant) => (
    variant.acquisition === PAID_COLLECTOR_ACQUISITION
  )), true);
});

test("collector variants cannot contain mechanical overrides or unknown gameplay references", () => {
  const paidVariant = getCollectorVariantById(PAID_VARIANT_ID);
  assert.equal(validateCollectorVariant(paidVariant), true);
  for (const field of COLLECTOR_VARIANT_MECHANICAL_FIELDS) {
    assert.throws(
      () => validateCollectorVariant({ ...paidVariant, [field]: field === "value" ? 14 : "override" }),
      new RegExp(`cannot override mechanical field ${field}`)
    );
  }
  assert.throws(
    () => validateCollectorVariant({ ...paidVariant, variantId: "unknown:foil", gameplayCardId: "unknown" }),
    /references unknown gameplay content/
  );
});

test("legacy account collections and constructed decks normalize deterministically", () => {
  const stats = makeStats();
  const firstCollection = normalizeCollection(stats);
  stats.collection = firstCollection;
  const secondCollection = normalizeCollection(stats);
  assert.deepEqual(secondCollection, firstCollection);
  assert.deepEqual(firstCollection.gameplayEntitlements, { [GAMEPLAY_CARD_ID]: 2 });
  assert.equal(firstCollection.collectorVariants[`${GAMEPLAY_CARD_ID}:standard`], 2);

  stats.savedConstructedDeck = {
    name: "Legacy Guard",
    factionId: "rumin",
    factionName: "Rumin",
    cardQuantities: { [GAMEPLAY_CARD_ID]: 2 },
    cardSuitChoices: { [GAMEPLAY_CARD_ID]: ["spades", "hearts"] },
    savedAt: "2026-07-15T12:00:00.000Z"
  };
  const firstLibrary = normalizeDeckLibrary(stats, "legacy-account");
  const secondLibrary = normalizeDeckLibrary(stats, "legacy-account");
  assert.equal(firstLibrary.schemaVersion, 2);
  assert.deepEqual(secondLibrary, firstLibrary);
  const playable = getSavedConstructedDeck(stats);
  assert.equal(playable.replacementCount, 2);
  assert.deepEqual(playable.gameplayCardQuantities, { [GAMEPLAY_CARD_ID]: 2 });
  assert.equal(playable.collectorVariantSelections[GAMEPLAY_CARD_ID], `${GAMEPLAY_CARD_ID}:standard`);
  assert.match(firstLibrary.decks[0].versions[0].gameplayConfigurationHash, /^[0-9a-f]{64}$/);
  assert.match(firstLibrary.decks[0].versions[0].collectorConfigurationHash, /^[0-9a-f]{64}$/);
});

test("paid collector ownership cannot change authoritative competitive capability", () => {
  const unpaidStats = makeStats();
  const paidStats = structuredClone(unpaidStats);
  const beforePurchase = buildCompetitiveCapabilitySnapshot(paidStats);

  const granted = grantPurchasedCollectorPack(paidStats, "rumin-collector", {
    variantIds: Array.from({ length: 8 }, () => PAID_VARIANT_ID),
    openedAt: "2026-08-07T12:00:00.000Z",
    provenance: "monetization-invariant-test"
  });
  const afterPurchase = buildCompetitiveCapabilitySnapshot(paidStats);

  assert.equal(granted.length, 8);
  assert.deepEqual(afterPurchase, beforePurchase);
  assert.deepEqual(afterPurchase, buildCompetitiveCapabilitySnapshot(unpaidStats));
  assert.equal(paidStats.collection.collectorVariants[PAID_VARIANT_ID], 8);
  assert.deepEqual(paidStats.collection.gameplayEntitlements, { [GAMEPLAY_CARD_ID]: 2 });
  assert.equal(paidStats.collection.purchasedCollectorPacks, 1);
  assert.equal(paidStats.collection.openedGameplayPacks, 0);

  const unpaidValidated = validateConstructedDeckPayload(unpaidStats, deckPayload());
  const paidValidated = validateConstructedDeckPayload(paidStats, deckPayload({ [GAMEPLAY_CARD_ID]: PAID_VARIANT_ID }));
  assert.deepEqual(paidValidated.gameplayCardQuantities, unpaidValidated.gameplayCardQuantities);
  assert.deepEqual(paidValidated.cardSuitChoices, unpaidValidated.cardSuitChoices);
  assert.deepEqual(paidValidated.legality, unpaidValidated.legality);

  const unpaidDeck = saveConstructedDeckToLibrary(unpaidStats, deckPayload(), "unpaid-account").playableDeck;
  const paidDeck = saveConstructedDeckToLibrary(
    paidStats,
    deckPayload({ [GAMEPLAY_CARD_ID]: PAID_VARIANT_ID }),
    "paid-account"
  ).playableDeck;
  assert.deepEqual(unpaidDeck.cards.map(mechanicalCardProjection), paidDeck.cards.map(mechanicalCardProjection));
  assert.notEqual(unpaidDeck.cards[0].variantId, paidDeck.cards[0].variantId);
  assert.notDeepEqual(unpaidDeck.cards[0].collector, paidDeck.cards[0].collector);

  const tooMany = deckPayload();
  tooMany.gameplayCardQuantities[GAMEPLAY_CARD_ID] = 3;
  assert.throws(() => validateConstructedDeckPayload(unpaidStats, tooMany), /earned 2 gameplay copies/);
  assert.throws(() => validateConstructedDeckPayload(paidStats, tooMany), /earned 2 gameplay copies/);

  const unpaidGame = makeSemanticGame(unpaidDeck.cards[0]);
  const paidGame = makeSemanticGame(paidDeck.cards[0]);
  assert.deepEqual(getLegalActions(paidGame, 1), getLegalActions(unpaidGame, 1));
  assert.deepEqual(
    calculateAttackBonuses(paidGame, 1, paidGame.players[1].hand[0], "hand"),
    calculateAttackBonuses(unpaidGame, 1, unpaidGame.players[1].hand[0], "hand")
  );
  assert.equal(paidGame.players[1].hand[0].value, unpaidGame.players[1].hand[0].value);
  assert.equal(paidGame.players[1].hand[0].rulesText, unpaidGame.players[1].hand[0].rulesText);
  assert.deepEqual(afterPurchase.factions, beforePurchase.factions);
  assert.deepEqual(afterPurchase.winConditions, beforePurchase.winConditions);
  assert.equal(afterPurchase.startingLife, beforePurchase.startingLife);
});

test("constructed presentation selection requires an owned variant for the same gameplay definition", () => {
  const stats = makeStats();
  assert.throws(
    () => validateConstructedDeckPayload(stats, deckPayload({ [GAMEPLAY_CARD_ID]: PAID_VARIANT_ID })),
    /do not own/
  );
  const paidStats = makeStats();
  grantPurchasedCollectorPack(paidStats, "rumin-collector", {
    variantIds: Array.from({ length: 8 }, () => PAID_VARIANT_ID)
  });
  assert.throws(
    () => validateConstructedDeckPayload(paidStats, deckPayload({ [GAMEPLAY_CARD_ID]: OTHER_CARD_VARIANT_ID })),
    /made for Gilded Scale Legionary/
  );
});

test("earned gameplay packs change free entitlement while collector grants do not", () => {
  const earnedStats = { collection: { packCredits: 1 } };
  const opened = openCollectionBooster(earnedStats, "rumin-foundation");
  const earnedCollection = normalizeCollection(earnedStats);
  assert.equal(opened.length, 8);
  assert.equal(Object.values(earnedCollection.gameplayEntitlements).reduce((sum, count) => sum + count, 0), 8);
  assert.equal(opened.every((card) => card.acquisition === FREE_GAMEPLAY_ACQUISITION), true);
  assert.equal(earnedCollection.packCredits, 0);
  assert.equal(earnedCollection.openedGameplayPacks, 1);

  const collectorStats = { collection: { packCredits: 1 } };
  const before = buildCompetitiveCapabilitySnapshot(collectorStats);
  grantPurchasedCollectorPack(collectorStats, "rumin-collector", {
    variantIds: Array.from({ length: 8 }, () => PAID_VARIANT_ID)
  });
  assert.deepEqual(buildCompetitiveCapabilitySnapshot(collectorStats), before);
  assert.deepEqual(collectorStats.collection.gameplayEntitlements, {});
  assert.equal(collectorStats.collection.packCredits, 1);
  assert.equal(collectorStats.collection.openedGameplayPacks, 0);
});

test("a physical collector entitlement changes presentation provenance but no competitive capability", () => {
  const unpaidStats = makeStats();
  const physicalStats = structuredClone(unpaidStats);
  const before = buildCompetitiveCapabilitySnapshot(physicalStats);
  const entitlement = {
    entitlementId: "ce_payment_power_physical_test",
    productId: "rumin-foundation-physical-box",
    productType: "physical-collector-entitlement",
    issuanceSource: "owner-manual-fulfillment",
    externalReferenceHash: "a".repeat(64)
  };

  const redemption = redeemCollectorEntitlementStats(physicalStats, entitlement, {
    redeemedAt: "2026-08-07T14:00:00.000Z"
  });
  const retry = redeemCollectorEntitlementStats(physicalStats, entitlement, {
    redeemedAt: "2026-08-07T14:05:00.000Z"
  });

  assert.equal(redemption.alreadyRedeemed, false);
  assert.equal(retry.alreadyRedeemed, true);
  assert.equal(redemption.grantedVariants.length, 8);
  assert.deepEqual(buildCompetitiveCapabilitySnapshot(physicalStats), before);
  assert.deepEqual(physicalStats.collection.gameplayEntitlements, normalizeCollection(unpaidStats).gameplayEntitlements);
  assert.equal(physicalStats.collection.collectorRedemptionReceipts[entitlement.entitlementId].issuanceSource, "owner-manual-fulfillment");
  assert.equal(physicalStats.collection.collectorVariantProvenance[redemption.grantedVariants[0].variantId][0].entitlementId, entitlement.entitlementId);
});
