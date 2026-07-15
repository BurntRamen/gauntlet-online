const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const MATCH_RECORD_VERSION = 1;
const RULES_VERSION = "gauntlet-rules-v1";
const CONTENT_VERSION = "gauntlet-content-v1";

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
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
  const snapshot = {
    source,
    name: deck?.name || null,
    factionId: deck?.factionId || gamePlayer?.faction?.id || "basic",
    savedAt: deck?.savedAt || null,
    replacementCount: Number(deck?.replacementCount || deck?.additionCount || campaignCards.length || 0),
    cards: (deck?.cards || campaignCards).map((card) => ({
      id: card.id || card.cardId || null,
      value: card.value ?? null,
      suit: card.suit || null
    }))
  };
  return {
    deckId: deck?.deckId || null,
    deckVersionId: deck?.versionId || `legacy-${stableHash(snapshot).slice(0, 24)}`,
    format: source === "draft" ? "draft" : "constructed",
    source,
    factionId: snapshot.factionId,
    replacementCount: snapshot.replacementCount
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
    auditEvents
  };
}

function publicMatchRecord(record) {
  if (!record) return null;
  return clonePlain(record);
}

function publicMatchSummary(record) {
  if (!record) return null;
  const { auditEvents, ...summary } = record;
  return clonePlain({ ...summary, auditEventCount: Array.isArray(auditEvents) ? auditEvents.length : 0 });
}

function buildParaMatchExport(record, matchUrl = null, exportedAt = new Date().toISOString()) {
  if (!record) return null;
  return {
    schemaVersion: "gauntlet.para-match.v1",
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
  RULES_VERSION,
  CONTENT_VERSION,
  buildMatchRecord,
  buildParaMatchExport,
  captureAuditEvent,
  createLocalMatchStore,
  createMatchMetadata,
  publicMatchRecord,
  publicMatchSummary,
  recordCombatResolution
};
