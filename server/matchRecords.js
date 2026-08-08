const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { CONTENT_VERSION, RULES_VERSION } = require("./gameContent");
const {
  LEAGUE_EVIDENCE_VERSION,
  PUBLIC_REPLAY_FRAME_VERSION,
  capturePublicReplayFrame
} = require("./matchReplay");

const MATCH_RECORD_VERSION = 2;
const PARA_MATCH_V1 = "gauntlet.para-match.v1";
const PARA_MATCH_V2 = "gauntlet.para-match.v2";

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

function stableHash(value) {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function createMatchMetadata(options = {}) {
  return {
    matchId: options.matchId || crypto.randomUUID(),
    seriesId: options.seriesId || null,
    gameNumber: Number(options.gameNumber || 1),
    startedAt: options.startedAt || new Date().toISOString()
  };
}

function classifyAuditEvent(game) {
  const message = String(game?.message || "").toLowerCase();
  if (game?.phase === "gameOver") return "game_completed";
  if (message.includes("damage")) return "damage";
  if (message.includes("block")) return "block";
  if (message.includes("attack")) return "attack";
  if (message.includes("placed") || message.includes("skipped lane")) return "lane_placement";
  if (message.includes("pass")) return "priority_pass";
  if (message.includes("priority")) return "priority_change";
  return "game_message";
}

function getAuditActor(message) {
  const match = String(message || "").match(/Player\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function getPublicStateForChecksum(game) {
  const players = {};
  for (const [playerNum, player] of Object.entries(game?.players || {})) {
    players[playerNum] = {
      life: Number(player.life || 0),
      factionId: player.faction?.id || "basic",
      eliminated: !!player.eliminated,
      handCount: Array.isArray(player.hand) ? player.hand.length : 0,
      deckCount: Array.isArray(player.deck) ? player.deck.length : 0,
      discardCount: Array.isArray(player.discard) ? player.discard.length : 0
    };
  }
  return {
    turn: Number(game?.turn || 1),
    phase: game?.phase || "setup",
    priority: game?.priority ?? null,
    winner: game?.winner ?? null,
    players,
    lanes: (game?.lanes || []).map((lane) => ({
      facedown: Object.fromEntries(Object.entries(lane.facedown || {}).map(([playerNum, card]) => [playerNum, !!card])),
      attack: lane.attack ? {
        player: lane.attack.player,
        targetPlayer: lane.attack.targetPlayer ?? null,
        effectiveValue: Number(lane.attack.effectiveValue || 0)
      } : null,
      blockValues: (lane.block || []).map((block) => Number(block.effectiveValue || 0))
    })),
    handAttacks: (game?.handAttacks || []).map((attack) => ({
      player: attack.player,
      targetPlayer: attack.targetPlayer ?? null,
      effectiveValue: Number(attack.effectiveValue || 0),
      blockValues: (attack.block || []).map((block) => Number(block.effectiveValue || 0))
    }))
  };
}

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
  if (!card) return null;
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

function enrichPublicEventCards(game, payload) {
  const enriched = payload;
  if (enriched.cardId) {
    const card = replayPublicCard(findGameCard(game, enriched.cardId));
    if (card) enriched.card = card;
  }
  if (Array.isArray(enriched.cardIds)) {
    const cards = enriched.cardIds.map((cardId) => replayPublicCard(findGameCard(game, cardId))).filter(Boolean);
    if (cards.length) enriched.cards = cards;
  }
  return enriched;
}

function sanitizeLeagueEvent(event = {}) {
  const type = String(event.type || "unknown");
  const { id: _id, sequence: _sequence, revision: _revision, type: _type, ...detail } = clonePlain(event);
  if (type === "cards.drawn") {
    return {
      player: detail.player ?? null,
      count: Array.isArray(detail.cardIds) ? detail.cardIds.length : Number(detail.count || 0),
      ...(detail.source ? { source: detail.source } : {})
    };
  }
  if (type === "card.peeked") {
    return {
      player: detail.player ?? null,
      viewer: detail.viewer ?? null,
      targetPlayer: detail.targetPlayer ?? null,
      laneIndex: detail.laneIndex ?? null
    };
  }
  if (type === "card.placedFacedown") {
    return {
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

function captureLeagueEvidence(game, { commandId = null, actorPlayerNum = null, command = {}, events = [], timestamp } = {}) {
  if (!game) return [];
  const serverTimestamp = timestamp || new Date().toISOString();
  const stateChecksum = stableHash(getPublicStateForChecksum(game));
  game.serverLeagueEvidence = Array.isArray(game.serverLeagueEvidence) ? game.serverLeagueEvidence : [];
  const normalizedCommand = sanitizeLeagueCommand(command);
  const sourceEvents = [
    {
      id: commandId ? `${commandId}:accepted` : `${game.matchId}:command:${game.serverLeagueEvidence.length + 1}`,
      sequence: null,
      type: "command.accepted",
      player: actorPlayerNum,
      command: normalizedCommand
    },
    ...(Array.isArray(events) ? events : [])
  ];
  const captured = sourceEvents.map((event) => {
    const payload = event.type === "command.accepted"
      ? { command: clonePlain(event.command) }
      : enrichPublicEventCards(game, sanitizeLeagueEvent(event));
    const entry = {
      sequence: game.serverLeagueEvidence.length + 1,
      eventId: event.id || `${game.matchId}:league:${game.serverLeagueEvidence.length + 1}`,
      commandId,
      commandType: normalizedCommand.type,
      eventSequence: event.sequence != null && Number.isFinite(Number(event.sequence)) ? Number(event.sequence) : null,
      turn: Number(game.turn || 1),
      phase: game.phase || "setup",
      eventType: String(event.type || "unknown"),
      actorPlayerNum: event.player == null ? (actorPlayerNum == null ? null : Number(actorPlayerNum)) : Number(event.player),
      targetPlayerNum: event.targetPlayer == null ? null : Number(event.targetPlayer),
      sourceType: event.source || normalizedCommand.source || null,
      laneIndex: event.laneIndex == null ? null : Number(event.laneIndex),
      publicPayload: payload,
      serverTimestamp,
      resultingStateChecksum: stateChecksum
    };
    game.serverLeagueEvidence.push(entry);
    return entry;
  });
  capturePublicReplayFrame(game, captured);
  return captured;
}

function captureAuditEvent(game, timestamp = new Date().toISOString()) {
  if (!game?.message) return null;
  game.serverAuditEvents = Array.isArray(game.serverAuditEvents) ? game.serverAuditEvents : [];
  const last = game.serverAuditEvents[game.serverAuditEvents.length - 1];
  if (last && last.publicPayload?.message === game.message && last.turn === game.turn && last.phase === game.phase) return last;
  const event = {
    sequence: game.serverAuditEvents.length + 1,
    turn: Number(game.turn || 1),
    phase: game.phase || "setup",
    actorPlayerNum: getAuditActor(game.message),
    eventType: classifyAuditEvent(game),
    publicPayload: { message: String(game.message) },
    serverTimestamp: timestamp,
    stateChecksum: stableHash(getPublicStateForChecksum(game))
  };
  game.serverAuditEvents.push(event);
  if (game.serverAuditEvents.length > 300) {
    game.serverAuditEvents = game.serverAuditEvents.slice(-300).map((entry, index) => ({ ...entry, sequence: index + 1 }));
  }
  return event;
}

function ensureCombatStats(game) {
  if (!game.serverCombatStats) {
    game.serverCombatStats = {
      attacksResolved: 0,
      totalAttackValue: 0,
      totalBlockValue: 0,
      totalDamagePrevented: 0,
      totalDamageDealt: 0,
      largestAttack: null,
      byPlayer: {}
    };
  }
  return game.serverCombatStats;
}

function ensurePlayerCombatStats(stats, playerNum) {
  const key = String(playerNum);
  stats.byPlayer[key] = stats.byPlayer[key] || {
    attacksResolved: 0,
    attackValue: 0,
    blockValue: 0,
    damagePrevented: 0,
    damageDealt: 0,
    damageTaken: 0
  };
  return stats.byPlayer[key];
}

function recordCombatResolution(game, resolution) {
  const attackValue = Math.max(0, Number(resolution.attackValue || 0));
  const blockValue = Math.max(0, Number(resolution.blockValue || 0));
  const preventionValue = Math.max(0, Number(resolution.preventionValue || 0));
  const damage = Math.max(0, Number(resolution.damage || 0));
  const prevented = Math.max(0, attackValue - damage);
  const stats = ensureCombatStats(game);
  const attacker = ensurePlayerCombatStats(stats, resolution.attackerPlayerNum);
  const defender = ensurePlayerCombatStats(stats, resolution.defenderPlayerNum);

  stats.attacksResolved += 1;
  stats.totalAttackValue += attackValue;
  stats.totalBlockValue += blockValue;
  stats.totalDamagePrevented += prevented;
  stats.totalDamageDealt += damage;
  attacker.attacksResolved += 1;
  attacker.attackValue += attackValue;
  attacker.damageDealt += damage;
  defender.blockValue += blockValue;
  defender.damagePrevented += prevented;
  defender.damageTaken += damage;

  if (!stats.largestAttack || attackValue > stats.largestAttack.value) {
    stats.largestAttack = {
      playerNum: Number(resolution.attackerPlayerNum),
      targetPlayerNum: Number(resolution.defenderPlayerNum),
      value: attackValue,
      damage,
      blockValue,
      preventionValue,
      turn: Number(game.turn || 1)
    };
  }
}

function getDeckSnapshot(lobbyPlayer, gamePlayer) {
  const deck = lobbyPlayer?.savedDraftDeck || lobbyPlayer?.savedConstructedDeck || null;
  const campaignCards = Array.isArray(lobbyPlayer?.campaignDeckAdditions) ? lobbyPlayer.campaignDeckAdditions : [];
  const source = lobbyPlayer?.savedDraftDeck
    ? "draft"
    : lobbyPlayer?.savedConstructedDeck
      ? "constructed"
      : campaignCards.length > 0
        ? "campaign"
        : "standard";
  const cards = (deck?.cards || campaignCards).map((card) => ({
    gameplayCardId: card.gameplayCardId || card.definitionId || card.id || card.cardId || null,
    value: card.value ?? null,
    suit: card.suit || null,
    variantId: card.variantId || null
  }));
  const mechanicalCards = cards.map(({ gameplayCardId, value, suit }) => ({ gameplayCardId, value, suit }));
  const collectorVariants = cards
    .filter((card) => card.variantId)
    .map(({ gameplayCardId, variantId }) => ({ gameplayCardId, variantId }));
  const snapshot = {
    source,
    name: deck?.name || null,
    factionId: deck?.factionId || gamePlayer?.faction?.id || "basic",
    savedAt: deck?.savedAt || null,
    replacementCount: Number(deck?.replacementCount || deck?.additionCount || campaignCards.length || 0),
    cards: mechanicalCards.map((card) => ({ id: card.gameplayCardId, ...card })),
    mechanicalCards,
    collectorVariants
  };
  return {
    deckId: deck?.deckId || null,
    deckVersionId: deck?.versionId || `legacy-${stableHash(snapshot).slice(0, 24)}`,
    format: source === "draft" ? "draft" : "constructed",
    source,
    factionId: snapshot.factionId,
    replacementCount: snapshot.replacementCount,
    snapshot,
    gameplayCards: mechanicalCards,
    collectorVariants,
    gameplayConfigurationHash: deck?.gameplayConfigurationHash || stableHash({
      factionId: snapshot.factionId,
      cards: mechanicalCards
    }),
    collectorConfigurationHash: deck?.collectorConfigurationHash || stableHash({ variants: collectorVariants })
  };
}

function getParticipantIdentity(lobbyPlayer, gamePlayer, game, playerNum) {
  const campaignAi = game?.campaign && Number(playerNum) === 2;
  const isAi = !!lobbyPlayer?.isAI || campaignAi || gamePlayer?.accountName === "Training AI";
  return {
    identityType: lobbyPlayer?.accountId ? "account" : isAi ? "ai" : "guest",
    accountId: lobbyPlayer?.accountId || null,
    displayName: gamePlayer?.accountName || lobbyPlayer?.accountName || (isAi ? "Training AI" : `Player ${playerNum}`)
  };
}

function getSeriesSnapshot(roomState, winnerPlayerNum) {
  if (!roomState?.bestOf3Series) return null;
  const series = roomState.bestOf3Series;
  const scores = {
    1: Number(series.scores?.[1] || series.scores?.["1"] || 0),
    2: Number(series.scores?.[2] || series.scores?.["2"] || 0)
  };
  if (winnerPlayerNum != null) scores[winnerPlayerNum] = (scores[winnerPlayerNum] || 0) + 1;
  return {
    seriesId: roomState.matchMetadata?.seriesId || roomState.seriesId || null,
    bestOf: Number(series.bestOf || 3),
    targetWins: Number(series.targetWins || 2),
    gameNumber: Number(series.gameNumber || 1),
    scoreAfter: scores
  };
}

function buildMatchRecord(roomState, options = {}) {
  const game = roomState?.game;
  if (!game || game.phase !== "gameOver") throw new Error("A completed game is required to build a match record.");
  const metadata = roomState.matchMetadata || createMatchMetadata({
    seriesId: roomState.seriesId,
    gameNumber: roomState.bestOf3Series?.gameNumber
  });
  roomState.matchMetadata = metadata;
  const completionReason = options.completionReason || "life_total";
  const abandoned = completionReason === "abandoned";
  const playerNumbers = Object.keys(game.players || {}).map(Number).sort((a, b) => a - b);
  const participants = playerNumbers.map((playerNum) => {
    const lobbyPlayer = roomState.lobby?.players?.[playerNum] || {};
    const gamePlayer = game.players[playerNum] || {};
    const identity = getParticipantIdentity(lobbyPlayer, gamePlayer, game, playerNum);
    return {
      participantId: `${metadata.matchId}:p${playerNum}`,
      playerNum,
      ...identity,
      faction: {
        id: gamePlayer.faction?.id || "basic",
        name: gamePlayer.faction?.name || "Basic"
      },
      deck: getDeckSnapshot(lobbyPlayer, gamePlayer),
      finalLife: Number(gamePlayer.life || 0),
      result: abandoned ? "abandoned" : game.winner == null ? "draw" : Number(game.winner) === playerNum ? "win" : "loss"
    };
  });
  const auditEvents = Array.isArray(game.serverAuditEvents) && game.serverAuditEvents.length > 0
    ? clonePlain(game.serverAuditEvents)
    : (game.eventLog || []).map((event, index) => ({
        sequence: index + 1,
        turn: Number(event.turn || 1),
        phase: event.phase || "setup",
        actorPlayerNum: getAuditActor(event.text),
        eventType: "game_message",
        publicPayload: { message: String(event.text || "") },
        serverTimestamp: event.createdAt || options.completedAt || new Date().toISOString(),
        stateChecksum: null
      }));
  const combatStats = clonePlain(game.serverCombatStats || ensureCombatStats(game));
  const lifeValues = participants.map((participant) => participant.finalLife);
  const mode = game.campaign
    ? "campaign"
    : roomState.draftLeague || game.draftLeague
      ? "draftLeague"
      : game.gameMode || "duel";

  return {
    recordVersion: MATCH_RECORD_VERSION,
    matchId: metadata.matchId,
    seriesId: metadata.seriesId || null,
    mode,
    rulesVersion: RULES_VERSION,
    contentVersion: CONTENT_VERSION,
    ranked: !!roomState.ranked,
    season: roomState.season ? clonePlain(roomState.season) : null,
    startedAt: metadata.startedAt,
    completedAt: options.completedAt || new Date().toISOString(),
    completionReason,
    abandonmentReason: abandoned ? options.abandonmentReason || "unknown" : null,
    winnerPlayerNum: game.winner == null ? null : Number(game.winner),
    turnCount: Number(game.turn || 1),
    participants,
    finalLife: Object.fromEntries(participants.map((participant) => [participant.playerNum, participant.finalLife])),
    series: getSeriesSnapshot(roomState, game.winner),
    campaign: game.campaign ? {
      factionId: game.campaign.factionId,
      chapterId: game.campaign.chapterId,
      title: game.campaign.title,
      opponentName: game.campaign.opponentName
    } : null,
    draft: roomState.draftLeague || game.draftLeague ? {
      league: true,
      draftType: roomState.draftLeagueMatch?.draftType || null
    } : roomState.draft ? {
      league: !!roomState.draft.league,
      draftType: roomState.draft.botDraft ? "bot" : "player"
    } : null,
    combatStats,
    notableMoments: {
      largestAttack: combatStats.largestAttack,
      finalLifeGap: lifeValues.length === 2 ? Math.abs(lifeValues[0] - lifeValues[1]) : null,
      decisiveTurn: Number(game.turn || 1)
    },
    auditEvents,
    leagueEvidenceVersion: LEAGUE_EVIDENCE_VERSION,
    leagueEvidence: clonePlain(game.serverLeagueEvidence || []),
    publicReplayFrameVersion: PUBLIC_REPLAY_FRAME_VERSION,
    publicReplayFrames: clonePlain(game.serverPublicReplayFrames || []),
    leagueEvidenceCoverage: (game.serverLeagueEvidence || []).some((entry) => entry.eventType === "match.started")
      ? "complete"
      : (game.serverLeagueEvidence || []).length > 0 ? "partial" : "unavailable"
  };
}

function publicMatchRecord(record) {
  if (!record) return null;
  const publicRecord = clonePlain(record);
  publicRecord.publicReplayFrameCount = Array.isArray(publicRecord.publicReplayFrames)
    ? publicRecord.publicReplayFrames.length
    : 0;
  delete publicRecord.publicReplayFrames;
  if (publicRecord.completion) {
    publicRecord.completion = {
      status: publicRecord.completion.status,
      envelopeVersion: publicRecord.completion.envelopeVersion,
      finalizedAt: publicRecord.completion.finalizedAt || null,
      consequences: (publicRecord.completion.consequences || []).map((consequence) => {
        const { accountId, receiptKey: _receiptKey, ...publicConsequence } = consequence;
        return publicConsequence;
      })
    };
  }
  return publicRecord;
}

function finalPublicMessage(record) {
  return [...(record?.auditEvents || [])]
    .reverse()
    .find((event) => event?.publicPayload?.message)?.publicPayload?.message || null;
}

function projectMatchPerspective(record, options = {}) {
  if (!record) return null;
  const requestedPlayerNum = options.playerNum == null ? null : Number(options.playerNum);
  const participant = (record.participants || []).find((entry) => (
    options.accountId ? entry.accountId === options.accountId : requestedPlayerNum != null && Number(entry.playerNum) === requestedPlayerNum
  )) || (options.accountId || requestedPlayerNum != null ? null : record.participants?.[0]) || null;
  const opponents = participant
    ? (record.participants || []).filter((entry) => Number(entry.playerNum) !== Number(participant.playerNum))
    : [];
  const opponent = opponents[0] || null;
  const playerCombat = participant ? record.combatStats?.byPlayer?.[String(participant.playerNum)] || null : null;
  return {
    projectionVersion: "gauntlet.match-perspective.v1",
    recordVersion: record.recordVersion,
    matchId: record.matchId,
    seriesId: record.seriesId || null,
    mode: record.mode,
    ranked: !!record.ranked,
    season: clonePlain(record.season || null),
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    completionReason: record.completionReason,
    winnerPlayerNum: record.winnerPlayerNum ?? null,
    turnCount: record.turnCount,
    player: clonePlain(participant),
    opponent: clonePlain(opponent),
    opponents: clonePlain(opponents),
    outcome: participant?.result || "unknown",
    campaign: clonePlain(record.campaign || null),
    combat: clonePlain(playerCombat),
    notableMoments: clonePlain(record.notableMoments || null),
    finalMessage: finalPublicMessage(record)
  };
}

function buildAccountMatchIndexEntry(record, options = {}) {
  const perspective = projectMatchPerspective(record, options);
  if (!perspective?.player) return null;
  return {
    matchId: record.matchId,
    recordVersion: record.recordVersion,
    completedAt: record.completedAt,
    deckVersionId: perspective.player.deck?.deckVersionId || null
  };
}

function publicMatchSummary(record, perspectiveOptions = null) {
  if (!record) return null;
  const { auditEvents, leagueEvidence, ...summary } = publicMatchRecord(record);
  return clonePlain({
    ...summary,
    auditEventCount: Array.isArray(auditEvents) ? auditEvents.length : 0,
    leagueEvidenceCount: Array.isArray(leagueEvidence) ? leagueEvidence.length : 0,
    ...(perspectiveOptions ? { perspective: projectMatchPerspective(record, perspectiveOptions) } : {})
  });
}

function buildParaMatchExportV1(record, matchUrl, exportedAt) {
  if (!record) return null;
  return {
    schemaVersion: PARA_MATCH_V1,
    exportedAt,
    source: {
      product: "Gauntlet Online",
      serverAuthored: true,
      matchUrl
    },
    match: {
      matchId: record.matchId,
      seriesId: record.seriesId || null,
      mode: record.mode,
      ranked: !!record.ranked,
      rulesVersion: record.rulesVersion,
      contentVersion: record.contentVersion,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      completionReason: record.completionReason,
      winnerPlayerNum: record.winnerPlayerNum,
      turnCount: record.turnCount
    },
    participants: (record.participants || []).map((participant) => ({
      playerNum: participant.playerNum,
      accountId: participant.accountId,
      displayName: participant.displayName,
      identityType: participant.identityType,
      factionId: participant.faction?.id || "basic",
      deckId: participant.deck?.deckId || null,
      deckVersionId: participant.deck?.deckVersionId || null,
      result: participant.result,
      finalLife: participant.finalLife
    })),
    verification: {
      matchRecordVersion: record.recordVersion,
      auditEventCount: Array.isArray(record.auditEvents) ? record.auditEvents.length : 0,
      finalStateChecksum: record.auditEvents?.[record.auditEvents.length - 1]?.stateChecksum || null
    }
  };
}

function buildParaMatchExportV2(record, matchUrl, exportedAt, storage = null) {
  if (!record) return null;
  const participants = [...(record.participants || [])]
    .sort((left, right) => Number(left.playerNum) - Number(right.playerNum))
    .map((participant) => ({
      participantId: participant.participantId || `${record.matchId}:p${participant.playerNum}`,
      playerNum: Number(participant.playerNum),
      identityType: participant.identityType,
      gauntletAccountId: participant.identityType === "account" ? participant.accountId || null : null,
      displayName: participant.displayName,
      faction: clonePlain(participant.faction || { id: "basic", name: "Basic" }),
      deck: {
        deckId: participant.deck?.deckId || null,
        deckVersionId: participant.deck?.deckVersionId || null,
        source: participant.deck?.source || "standard",
        format: participant.deck?.format || "constructed"
      },
      finalLife: Number(participant.finalLife || 0),
      result: participant.result
    }));
  const evidence = [...(record.leagueEvidence || [])]
    .sort((left, right) => Number(left.sequence) - Number(right.sequence))
    .map((entry) => clonePlain(entry));
  const resolvedStorage = storage || {
    mode: "unknown",
    capabilities: {
      completeRecordV2: "unknown",
      publicRecordAfterProcessReplacement: false,
      auditHistoryAfterProcessReplacement: false
    }
  };
  const paraPerspectives = participants.map((participant) => {
    const perspective = projectMatchPerspective(record, { playerNum: participant.playerNum });
    // Season identity is additive Gauntlet product state, not part of the
    // established cross-repository Para v2 contract.
    delete perspective.season;
    return perspective;
  });
  const payload = {
    schemaVersion: PARA_MATCH_V2,
    exportedAt,
    contract: {
      producer: "Gauntlet Online",
      recordVersion: Number(record.recordVersion),
      rulesVersion: record.rulesVersion,
      contentVersion: record.contentVersion,
      evidenceSchemaVersion: LEAGUE_EVIDENCE_VERSION
    },
    source: {
      product: "Gauntlet Online",
      producerId: "gauntlet-online",
      serverAuthored: true,
      authoritativeMatchId: record.matchId,
      seriesId: record.seriesId || null,
      matchUrl,
      storage: {
        mode: resolvedStorage.mode || "unknown",
        completeRecordV2: resolvedStorage.capabilities?.completeRecordV2 || "unknown",
        fullRecordDurable: resolvedStorage.capabilities?.completeRecordV2 === "durable",
        publicRecordAfterProcessReplacement: !!resolvedStorage.capabilities?.publicRecordAfterProcessReplacement,
        evidenceAfterProcessReplacement: !!resolvedStorage.capabilities?.auditHistoryAfterProcessReplacement
      }
    },
    match: {
      matchId: record.matchId,
      seriesId: record.seriesId || null,
      mode: record.mode,
      ranked: !!record.ranked,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      completionReason: record.completionReason,
      abandonmentReason: record.abandonmentReason || null,
      turnCount: Number(record.turnCount || 0),
      campaign: clonePlain(record.campaign || null),
      series: clonePlain(record.series || null),
      draft: clonePlain(record.draft || null)
    },
    participants,
    evidence: {
      schemaVersion: LEAGUE_EVIDENCE_VERSION,
      coverage: record.leagueEvidenceCoverage || (evidence.length > 0 ? "complete" : "unavailable"),
      ordered: true,
      entries: evidence
    },
    results: {
      winnerPlayerNum: record.winnerPlayerNum == null ? null : Number(record.winnerPlayerNum),
      winnerParticipantId: record.winnerPlayerNum == null
        ? null
        : participants.find((participant) => participant.playerNum === Number(record.winnerPlayerNum))?.participantId || null,
      completionReason: record.completionReason,
      participants: participants.map(({ participantId, playerNum, result, finalLife }) => ({ participantId, playerNum, result, finalLife }))
    },
    recapEvidence: {
      perspectives: paraPerspectives,
      combatStats: clonePlain(record.combatStats || null),
      largestAttack: clonePlain(record.notableMoments?.largestAttack || null),
      damageDealt: Number(record.combatStats?.totalDamageDealt || 0),
      damagePrevented: Number(record.combatStats?.totalDamagePrevented || 0),
      decisiveTurn: Number(record.notableMoments?.decisiveTurn || record.turnCount || 0),
      finalPublicMessage: finalPublicMessage(record),
      notableMoments: clonePlain(record.notableMoments || null),
      campaignEncounter: clonePlain(record.campaign || null)
    },
    verification: {
      matchRecordVersion: Number(record.recordVersion),
      evidenceEventCount: evidence.length,
      auditEventCount: Array.isArray(record.auditEvents) ? record.auditEvents.length : 0,
      finalStateChecksum: evidence[evidence.length - 1]?.resultingStateChecksum
        || record.auditEvents?.[record.auditEvents.length - 1]?.stateChecksum
        || null
    }
  };
  const hashPayload = clonePlain(payload);
  hashPayload.exportedAt = null;
  payload.verification.contentHash = stableHash(hashPayload);
  return payload;
}

function buildParaMatchExport(record, matchUrl = null, exportedAt = new Date().toISOString(), options = {}) {
  const version = String(options.version || "1").replace(/^v/i, "");
  if (version === "1") return buildParaMatchExportV1(record, matchUrl, exportedAt);
  if (version === "2") return buildParaMatchExportV2(record, matchUrl, exportedAt, options.storage || null);
  throw new RangeError(`Unsupported Para export version: ${options.version}`);
}

function createLocalMatchStore(dataFile) {
  function load() {
    try {
      if (!fs.existsSync(dataFile)) return { matches: [] };
      const parsed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
      return { matches: Array.isArray(parsed.matches) ? parsed.matches : [] };
    } catch (error) {
      console.error("[Matches] Failed to load local match store", error);
      return { matches: [] };
    }
  }

  function save(store) {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
  }

  function upsert(record) {
    const store = load();
    const existingIndex = store.matches.findIndex((entry) => entry.matchId === record.matchId);
    if (existingIndex >= 0) store.matches[existingIndex] = record;
    else store.matches.push(record);
    save(store);
    return record;
  }

  function findById(matchId) {
    return load().matches.find((entry) => entry.matchId === matchId) || null;
  }

  function listByAccount(accountId, limit = 30) {
    return load().matches
      .filter((record) => record.participants?.some((participant) => participant.accountId === accountId))
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .slice(0, Math.max(1, Math.min(Number(limit) || 30, 100)));
  }

  return { findById, listByAccount, load, upsert };
}

module.exports = {
  MATCH_RECORD_VERSION,
  LEAGUE_EVIDENCE_VERSION,
  PUBLIC_REPLAY_FRAME_VERSION,
  PARA_MATCH_V1,
  PARA_MATCH_V2,
  RULES_VERSION,
  CONTENT_VERSION,
  buildMatchRecord,
  buildAccountMatchIndexEntry,
  buildParaMatchExport,
  captureLeagueEvidence,
  captureAuditEvent,
  createLocalMatchStore,
  createMatchMetadata,
  publicMatchRecord,
  publicMatchSummary,
  projectMatchPerspective,
  recordCombatResolution
};
