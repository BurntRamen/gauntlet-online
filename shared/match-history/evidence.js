function clonePlain(value) { return JSON.parse(JSON.stringify(value)); }

function sanitizeLeagueCommand(command = {}) {
  const type = String(command.type || "unknown");
  const safe = { type };
  const copyScalar = (field) => {
    if (["string", "number", "boolean"].includes(typeof command[field])) safe[field] = command[field];
  };
  for (const field of [
    "abilityId", "laneIndex", "laneA", "laneB", "targetPlayerId", "source",
    "useMeerusFreeAttack", "useJewelBankBonus", "useBeliAwakenedBonus",
    "useSandstormProcessor", "sunforgeAccelerationToSpend", "useVoltaricUltimatum",
    "primeSignalBonus", "lastGambleChoice"
  ]) copyScalar(field);
  // This ability targets a private hand/lane card; keep intent, not its identity.
  if (type === "useFactionAbility" && /^mekan:monti:/.test(safe.abilityId || "")) safe.abilityId = "mekan:monti";
  if (["declareHandAttack", "declareLaneAttack"].includes(type)) {
    safe.attackerCardId = command.attackerCardId || command.cardId || null;
    safe.paymentCardIds = [...(command.paymentCardIds || [])];
    safe.armWeaponCardIds = [...(command.armWeaponCardIds || [])];
  }
  if (["declareHandBlock", "declareLaneBlock"].includes(type)) {
    safe.blockerCardIds = [...(command.blockerCardIds || [])];
    safe.paymentCardIds = [...(command.paymentCardIds || [])];
    safe.accelerationBlockerCardIds = [...(command.accelerationBlockerCardIds || [])];
  }
  return safe;
}

function replayPublicCard(card) {
  if (!card || card.hidden) return null;
  const allowed = [
    "id", "definitionId", "gameplayCardId", "name", "rank", "value", "suit",
    "factionId", "variantId", "type", "text"
  ];
  return Object.fromEntries(allowed.filter((key) => card[key] != null).map((key) => [key, clonePlain(card[key])]));
}

function findGameCard(game, cardId) {
  if (!cardId) return null;
  const cards = [];
  const addCards = (entries) => cards.push(...(Array.isArray(entries) ? entries : []).filter(Boolean));
  const addAttack = (attack) => {
    if (!attack) return;
    addCards([attack.card]);
    addCards(attack.attachedCards);
    addCards(Array.isArray(attack.payment) ? attack.payment : attack.payment?.cards);
    for (const block of attack.block || []) {
      addCards([block.card]);
      addCards(block.payment?.cards);
    }
  };
  for (const player of Object.values(game?.players || {})) {
    addCards(player.hand);
    addCards(player.deck);
    addCards(player.discard);
    addCards(player.removedFromGame);
  }
  for (const lane of game?.lanes || []) {
    addCards(Object.values(lane.facedown || {}));
    addAttack(lane.attack);
    for (const block of lane.block || []) {
      addCards([block.card]);
      addCards(block.payment?.cards);
    }
  }
  for (const attack of game?.handAttacks || []) addAttack(attack);
  return cards.find((card) => card?.id === cardId) || null;
}

function enrichPublicEventCards(game, payload, beforeGame = null) {
  const enriched = payload;
  if (enriched.cardId) {
    const card = replayPublicCard((findGameCard(game, enriched.cardId) || findGameCard(beforeGame, enriched.cardId)));
    if (card) enriched.card = card;
  }
  if (Array.isArray(enriched.cardIds)) {
    const cards = enriched.cardIds.map((cardId) => replayPublicCard(findGameCard(game, cardId) || findGameCard(beforeGame, cardId))).filter(Boolean);
    if (cards.length) enriched.cards = cards;
  }
  return enriched;
}

function sanitizeLeagueEvent(event = {}) {
  const type = String(event.type || "unknown");
  const { id: _id, sequence: _sequence, revision: _revision, type: _type, ...detail } = clonePlain(event);
  // Lane-entry source is a runtime ID of the still face-down card.
  if (type === "laneEntry.resolved") {
    const { source: _source, cardId: _cardId, card: _card, ...publicDetail } = detail;
    return publicDetail;
  }
  if (type === "card.buffApplied") {
    const { cardId: _cardId, card: _card, ...publicDetail } = detail;
    return publicDetail;
  }
  if (type === "cards.drawn") {
    return {
      ...(detail.publicTotals ? { publicTotals: detail.publicTotals } : {}),
      player: detail.player ?? null,
      count: Array.isArray(detail.cardIds) ? detail.cardIds.length : Number(detail.count || 0),
      ...(detail.source ? { source: detail.source } : {})
    };
  }
  if (type === "card.peeked") {
    return {
      ...(detail.publicTotals ? { publicTotals: detail.publicTotals } : {}),
      player: detail.player ?? null,
      viewer: detail.viewer ?? null,
      targetPlayer: detail.targetPlayer ?? null,
      laneIndex: detail.laneIndex ?? null
    };
  }
  if (type === "card.placedFacedown") {
    return {
      ...(detail.publicTotals ? { publicTotals: detail.publicTotals } : {}),
      player: detail.player ?? null,
      laneIndex: detail.laneIndex ?? null,
      ...(detail.source ? { source: detail.source } : {})
    };
  }
  function stripPrivateFields(value) {
    if (Array.isArray(value)) return value.map(stripPrivateFields);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !/(reconnect|session|token|secret|credential|deckOrder|internal|serverAudit|privateAudit)/i.test(key))
      .map(([key, child]) => [key, stripPrivateFields(child)]));
  }
  return stripPrivateFields(detail);
}


module.exports = { sanitizeLeagueCommand, sanitizeLeagueEvent, enrichPublicEventCards };
