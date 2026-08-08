const crypto = require("crypto");
const { getCollectorVariantById, getGameplayCardById } = require("./gameContent");

const PUBLIC_REPLAY_FRAME_VERSION = "gauntlet.public-replay-frame.v1";
const REPLAY_TIMELINE_VERSION = "gauntlet.public-replay-timeline.v1";
const REPLAY_PRESENTATION_ACTION_VERSION = "gauntlet.replay-presentation-action.v1";
const LEAGUE_EVIDENCE_VERSION = "gauntlet.league-evidence.v1";

const PRIVATE_KEY_PATTERN = /(reconnect|session|token|secret|credential|deckorder|audit|server)/i;

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

function stableHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonicalValue(value))).digest("hex");
}

function publicCard(card) {
  if (!card || card.hidden) return null;
  const allowed = [
    "id", "definitionId", "gameplayCardId", "name", "rank", "value", "suit",
    "factionId", "variantId", "type", "text"
  ];
  return Object.fromEntries(allowed.filter((key) => card[key] != null).map((key) => [key, clonePlain(card[key])]));
}

function publicBlock(block) {
  if (!block) return null;
  return {
    id: block.id || null,
    player: block.player == null ? null : Number(block.player),
    effectiveValue: Number(block.effectiveValue ?? block.value ?? 0),
    preventDamage: Number(block.preventDamage || 0),
    notes: Array.isArray(block.notes) ? block.notes.map(String) : [],
    card: publicCard(block.card),
    payment: {
      cards: (block.payment?.cards || []).map(publicCard).filter(Boolean),
      total: Number(block.payment?.total || 0),
      required: Number(block.payment?.required || 0)
    }
  };
}

function publicAttack(attack) {
  if (!attack) return null;
  return {
    id: attack.id || null,
    player: attack.player == null ? null : Number(attack.player),
    targetPlayer: attack.targetPlayer == null ? null : Number(attack.targetPlayer),
    source: attack.source || null,
    effectiveValue: Number(attack.effectiveValue ?? attack.value ?? 0),
    notes: Array.isArray(attack.notes) ? attack.notes.map(String) : [],
    card: publicCard(attack.card),
    attachedCards: (attack.attachedCards || []).map(publicCard).filter(Boolean),
    payment: (Array.isArray(attack.payment) ? attack.payment : attack.payment?.cards || []).map(publicCard).filter(Boolean),
    paymentTotal: Number(attack.payment?.total || 0),
    paymentRequired: Number(attack.payment?.required || 0),
    block: (attack.block || []).map(publicBlock).filter(Boolean)
  };
}

function publicPlayer(player = {}, playerNum) {
  return {
    id: Number(player.id || playerNum),
    accountName: player.accountName || `Player ${playerNum}`,
    life: Number(player.life || 0),
    eliminated: !!player.eliminated,
    connected: player.connected !== false,
    faction: {
      id: player.faction?.id || "basic",
      name: player.faction?.name || "Basic Gauntlet"
    },
    hand: [],
    deck: [],
    discard: [],
    handCount: Number(player.handCount ?? player.hand?.length ?? 0),
    deckCount: Number(player.deckCount ?? player.deck?.length ?? 0),
    discardCount: Number(player.discardCount ?? player.discard?.length ?? 0)
  };
}

function publicFacedown(card, laneIndex, playerNum) {
  return card ? { id: `hidden-lane-${laneIndex}-p${playerNum}`, hidden: true } : null;
}

function publicCampaign(campaign) {
  if (!campaign) return null;
  const allowed = ["factionId", "chapterId", "title", "opponentName", "afterBattle"];
  return Object.fromEntries(allowed.filter((key) => campaign[key] != null).map((key) => [key, clonePlain(campaign[key])]));
}

function buildPublicReplaySnapshot(game) {
  const players = Object.fromEntries(Object.entries(game?.players || {}).map(([playerNum, player]) => [
    playerNum,
    publicPlayer(player, playerNum)
  ]));
  const lanes = (game?.lanes || []).map((lane, laneIndex) => ({
    facedown: Object.fromEntries(Object.keys(players).map((playerNum) => [
      playerNum,
      publicFacedown(lane?.facedown?.[playerNum], laneIndex, playerNum)
    ])),
    attack: publicAttack(lane?.attack),
    block: (lane?.block || []).map(publicBlock).filter(Boolean)
  }));
  return {
    schemaVersion: Number(game?.schemaVersion || 0),
    snapshotSchemaVersion: Number(game?.snapshotSchemaVersion || game?.schemaVersion || 0),
    commandSchemaVersion: Number(game?.commandSchemaVersion || 0),
    eventSchemaVersion: Number(game?.eventSchemaVersion || 0),
    rulesVersion: game?.rulesVersion || null,
    cardContentVersion: game?.cardContentVersion || null,
    matchId: game?.matchId || null,
    gameMode: game?.gameMode || "basic",
    revision: Number(game?.revision || 0),
    snapshotSequence: Number(game?.snapshotSequence || 0),
    phase: game?.phase || "unknown",
    turn: Number(game?.turn || 0),
    priority: game?.priority == null ? null : Number(game.priority),
    priorityPassed: clonePlain(game?.priorityPassed || {}),
    players,
    lanes,
    handAttacks: (game?.handAttacks || []).map(publicAttack).filter(Boolean),
    winner: game?.winner == null ? null : Number(game.winner),
    loser: game?.loser == null ? null : Number(game.loser),
    message: String(game?.message || ""),
    campaign: publicCampaign(game?.campaign),
    draftLeague: !!game?.draftLeague,
    bestOf3Series: game?.bestOf3Series ? clonePlain(game.bestOf3Series) : null,
    spectatorCount: Number(game?.spectatorCount || 0),
    lastEvents: [],
    legalActions: [],
    actionAvailability: {
      laneAttacks: [],
      factionAbilities: [],
      handAttack: { available: false, unavailableReason: "Replay viewers cannot act." }
    }
  };
}

function capturePublicReplayFrame(game, evidenceEntries = []) {
  if (!game || !Array.isArray(evidenceEntries) || evidenceEntries.length === 0) return null;
  game.serverPublicReplayFrames = Array.isArray(game.serverPublicReplayFrames)
    ? game.serverPublicReplayFrames
    : [];
  const snapshot = buildPublicReplaySnapshot(game);
  const first = evidenceEntries[0];
  const last = evidenceEntries[evidenceEntries.length - 1];
  const frame = {
    schemaVersion: PUBLIC_REPLAY_FRAME_VERSION,
    frameIndex: game.serverPublicReplayFrames.length + 1,
    matchId: game.matchId,
    evidenceSequenceStart: Number(first.sequence),
    evidenceSequence: Number(last.sequence),
    sourceEvidenceIds: evidenceEntries.map((entry) => entry.eventId),
    turn: Number(game.turn || 0),
    phase: game.phase || "unknown",
    resultingStateChecksum: last.resultingStateChecksum || null,
    publicStateChecksum: stableHash(snapshot),
    publicState: snapshot
  };
  game.serverPublicReplayFrames.push(frame);
  return frame;
}

function assertReplay(condition, code, message) {
  if (condition) return;
  const error = new Error(message);
  error.code = code;
  error.name = "MatchReplayIntegrityError";
  throw error;
}

function containsPrivateKey(value) {
  if (Array.isArray(value)) return value.some(containsPrivateKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => PRIVATE_KEY_PATTERN.test(key) || containsPrivateKey(child));
}

function validateEvidence(record) {
  assertReplay(Number(record?.recordVersion) === 2, "UNSUPPORTED_RECORD_VERSION", "Replay requires match record version 2.");
  const evidenceVersion = record.leagueEvidenceVersion || LEAGUE_EVIDENCE_VERSION;
  assertReplay(evidenceVersion === LEAGUE_EVIDENCE_VERSION, "UNSUPPORTED_EVIDENCE_VERSION", "The league evidence version is unsupported.");
  const evidence = [...(record.leagueEvidence || [])].sort((a, b) => Number(a.sequence) - Number(b.sequence));
  const eventIds = new Set();
  evidence.forEach((entry, index) => {
    assertReplay(Number(entry.sequence) === index + 1, "NON_CONTIGUOUS_EVIDENCE", "League evidence ordering is not contiguous.");
    assertReplay(typeof entry.eventId === "string" && entry.eventId.length > 0, "MISSING_EVIDENCE_ID", "League evidence contains a missing event ID.");
    assertReplay(!eventIds.has(entry.eventId), "DUPLICATE_EVIDENCE_ID", "League evidence contains a duplicate event ID.");
    eventIds.add(entry.eventId);
    if (entry.matchId != null) {
      assertReplay(entry.matchId === record.matchId, "MATCH_ID_MISMATCH", "League evidence belongs to a different match.");
    }
    assertReplay(!containsPrivateKey(entry.publicPayload || {}), "PRIVATE_EVIDENCE_FIELD", "League evidence contains a private field.");
  });
  return evidence;
}

function validateFrames(record, evidence) {
  const frames = [...(record.publicReplayFrames || [])].sort((a, b) => Number(a.frameIndex) - Number(b.frameIndex));
  const evidenceBySequence = new Map(evidence.map((entry) => [Number(entry.sequence), entry]));
  frames.forEach((frame, index) => {
    assertReplay(frame.schemaVersion === PUBLIC_REPLAY_FRAME_VERSION, "UNSUPPORTED_FRAME_VERSION", "A public replay frame version is unsupported.");
    assertReplay(Number(frame.frameIndex) === index + 1, "NON_CONTIGUOUS_FRAMES", "Public replay frame ordering is not contiguous.");
    assertReplay(frame.matchId === record.matchId, "FRAME_MATCH_ID_MISMATCH", "A public replay frame belongs to a different match.");
    const firstSequence = Number(frame.evidenceSequenceStart);
    const finalSequence = Number(frame.evidenceSequence);
    assertReplay(firstSequence > 0 && finalSequence >= firstSequence, "INVALID_FRAME_RANGE", "A public replay frame has an invalid evidence range.");
    const finalEvidence = evidenceBySequence.get(finalSequence);
    assertReplay(!!finalEvidence, "MISSING_FRAME_EVIDENCE", "A public replay frame references missing evidence.");
    assertReplay(frame.publicState?.matchId === record.matchId, "FRAME_STATE_MATCH_ID_MISMATCH", "A replay frame state belongs to a different match.");
    assertReplay(stableHash(frame.publicState) === frame.publicStateChecksum, "FRAME_CHECKSUM_MISMATCH", "A public replay frame checksum is invalid.");
    if (frame.resultingStateChecksum && finalEvidence.resultingStateChecksum) {
      assertReplay(frame.resultingStateChecksum === finalEvidence.resultingStateChecksum, "RESULT_CHECKSUM_MISMATCH", "A replay frame contradicts its authoritative evidence checksum.");
    }
    const expectedIds = evidence
      .filter((entry) => Number(entry.sequence) >= firstSequence && Number(entry.sequence) <= finalSequence)
      .map((entry) => entry.eventId);
    assertReplay(JSON.stringify(frame.sourceEvidenceIds || []) === JSON.stringify(expectedIds), "FRAME_EVIDENCE_ID_MISMATCH", "A replay frame references contradictory evidence IDs.");
    const serialized = JSON.stringify(frame.publicState);
    for (const forbidden of ["reconnectToken", "sessionToken", "serverAuditEvents", "serverLeagueEvidence", "serverPublicReplayFrames"]) {
      assertReplay(!serialized.includes(forbidden), "PRIVATE_FRAME_FIELD", "A public replay frame contains private server state.");
    }
  });
  return frames;
}

function eventLabel(entry) {
  const payload = entry.publicPayload || {};
  if (entry.eventType === "command.accepted") {
    const commandType = payload.command?.type || entry.commandType || "command";
    if (entry.actorPlayerNum != null) return `Player ${entry.actorPlayerNum}: ${commandType}`;
    if (commandType === "matchStarted") return "Match started";
    if (commandType === "finalizeMatch") return "Match finalized";
    return String(commandType).replace(/([a-z])([A-Z])/g, "$1 $2");
  }
  if (entry.eventType === "damage.dealt") return `${payload.amount || 0} damage to Player ${payload.player || entry.targetPlayerNum || "?"}`;
  if (entry.eventType === "damage.calculated") return `Combat: ${payload.attackValue || 0} attack, ${payload.blockValue || 0} block, ${payload.damage || 0} damage`;
  if (entry.eventType === "attack.declared") return `Player ${payload.player || entry.actorPlayerNum || "?"} declared an attack`;
  if (entry.eventType === "block.declared") return `Player ${payload.player || entry.actorPlayerNum || "?"} declared blocks`;
  if (entry.eventType === "match.ended") return `Player ${payload.winner || "?"} won the match`;
  return String(entry.eventType || "Match event").replace(/[._]/g, " ");
}

function participantName(participants, playerNum) {
  return participants.find((participant) => Number(participant.playerNum) === Number(playerNum))?.displayName
    || (playerNum == null ? "The match" : `Player ${playerNum}`);
}

function resolveReplayCard(card) {
  if (!card || card.hidden) return null;
  const gameplayCardId = card.gameplayCardId || card.definitionId || null;
  const gameplay = gameplayCardId ? getGameplayCardById(gameplayCardId) : null;
  const variant = card.variantId ? getCollectorVariantById(card.variantId) : null;
  const validVariant = variant && (!gameplayCardId || variant.gameplayCardId === gameplayCardId) ? variant : null;
  return {
    runtimeId: card.id || null,
    gameplayCardId: gameplay?.gameplayCardId || gameplayCardId,
    variantId: validVariant?.variantId || null,
    name: gameplay?.name || card.name || null,
    rank: card.rank || null,
    value: Number(card.value ?? gameplay?.value ?? 0),
    suit: card.suit || null,
    factionId: gameplay?.factionId || card.factionId || null,
    type: gameplay?.type || card.type || null,
    rulesText: gameplay?.text || card.text || null,
    collector: validVariant ? {
      name: validVariant.name,
      edition: validVariant.edition,
      finish: validVariant.finish,
      frame: validVariant.frame,
      art: validVariant.art || null
    } : null
  };
}

function publicAttacks(state) {
  return [
    ...(state?.handAttacks || []).map((attack) => ({ ...attack, laneIndex: null })),
    ...(state?.lanes || []).flatMap((lane, laneIndex) => lane?.attack ? [{ ...lane.attack, laneIndex }] : [])
  ];
}

function findAttack(state, entries) {
  const payload = entries.find((entry) => entry.eventType === "attack.declared")?.publicPayload || {};
  const command = entries.find((entry) => entry.eventType === "command.accepted")?.publicPayload?.command || {};
  const cardId = payload.cardId || command.attackerCardId || null;
  const actor = payload.player ?? entries.find((entry) => entry.actorPlayerNum != null)?.actorPlayerNum;
  const laneIndex = payload.laneIndex ?? command.laneIndex;
  return publicAttacks(state).find((attack) => (
    (cardId && attack.card?.id === cardId)
    || (Number(attack.player) === Number(actor) && (laneIndex == null || Number(attack.laneIndex) === Number(laneIndex)))
  )) || publicAttacks(state)[0] || null;
}

function exactEvidenceCard(cardId) {
  const gameplay = cardId ? getGameplayCardById(cardId) : null;
  return gameplay ? resolveReplayCard({ ...gameplay, id: cardId, definitionId: gameplay.gameplayCardId }) : null;
}

function actionKind(entries) {
  const eventTypes = new Set(entries.map((entry) => entry.eventType));
  const commandType = entries.find((entry) => entry.commandType)?.commandType || "unknown";
  if (eventTypes.has("match.ended") || eventTypes.has("match.abandoned") || commandType === "finalizeMatch") return "result";
  if (eventTypes.has("damage.calculated") || eventTypes.has("damage.dealt")) return "resolution";
  if (eventTypes.has("block.declared") || /Block$/.test(commandType)) return "block";
  if (eventTypes.has("attack.declared") || /Attack$/.test(commandType)) return "attack";
  if (commandType === "useFactionAbility" || [...eventTypes].some((type) => /(ability|buff|acceleration|swapped)/i.test(type))) return "ability";
  if (eventTypes.has("card.placedFacedown") || commandType === "placeCard") return "placement";
  if (eventTypes.has("turn.started") || /placement/i.test(commandType)) return "turn";
  if (eventTypes.has("match.started") || commandType === "matchStarted") return "start";
  if (eventTypes.has("payment.discarded")) return "payment";
  return "housekeeping";
}

function groupEvidence(evidence, frames) {
  if (frames.length) {
    return frames.map((frame) => ({
      entries: evidence.filter((entry) => Number(entry.sequence) >= Number(frame.evidenceSequenceStart)
        && Number(entry.sequence) <= Number(frame.evidenceSequence)),
      frame
    })).filter((group) => group.entries.length);
  }
  const groups = [];
  for (const entry of evidence) {
    const key = entry.commandId || [entry.serverTimestamp, entry.resultingStateChecksum, entry.commandType, entry.turn, entry.phase].join(":");
    const previous = groups.at(-1);
    if (previous?.key === key) previous.entries.push(entry);
    else groups.push({ key, entries: [entry], frame: null });
  }
  return groups;
}

function actionDuration(kind, entries) {
  if (kind === "result") return 2800;
  if (kind === "resolution") return entries.some((entry) => entry.eventType === "match.ended") ? 2800 : 2400;
  if (["attack", "block", "ability"].includes(kind)) return 2200;
  if (["placement", "payment"].includes(kind)) return 1400;
  if (["turn", "start"].includes(kind)) return 1000;
  return 700;
}

function humanizeIdentifier(value) {
  return String(value || "")
    .replace(/[-_.]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildPresentationAction({ group, index, frames, participants }) {
  const entries = group.entries;
  const kind = actionKind(entries);
  const command = entries.find((entry) => entry.eventType === "command.accepted")?.publicPayload?.command || {};
  const primaryEntry = [...entries].reverse().find((entry) => entry.eventType !== "command.accepted") || entries[0];
  const actorPlayerNum = primaryEntry?.actorPlayerNum ?? entries.find((entry) => entry.actorPlayerNum != null)?.actorPlayerNum ?? null;
  const actorName = participantName(participants, actorPlayerNum);
  const frameAfterIndex = group.frame?.frameIndex || null;
  const frameAfter = group.frame?.publicState || null;
  const frameBeforeIndex = frameAfterIndex && Number(frameAfterIndex) > 1 ? Number(frameAfterIndex) - 1 : null;
  const frameBefore = frameBeforeIndex ? frames.find((frame) => Number(frame.frameIndex) === frameBeforeIndex)?.publicState : null;
  const attackState = kind === "resolution" ? (frameBefore || frameAfter) : frameAfter;
  const attack = ["attack", "block", "resolution"].includes(kind) ? findAttack(attackState, entries) : null;
  const evidenceCardIds = entries.flatMap((entry) => [
    entry.publicPayload?.cardId,
    ...(entry.publicPayload?.cardIds || []),
    ...(entry.publicPayload?.command?.paymentCardIds || []),
    ...(entry.publicPayload?.command?.armWeaponCardIds || [])
  ]).filter(Boolean);
  const paymentEvent = entries.find((entry) => entry.eventType === "payment.discarded")?.publicPayload || null;
  const damageEvent = entries.find((entry) => entry.eventType === "damage.calculated")?.publicPayload
    || entries.find((entry) => entry.eventType === "damage.dealt")?.publicPayload || null;
  const attackCard = resolveReplayCard(attack?.card) || exactEvidenceCard(evidenceCardIds[0]);
  const blockers = (attack?.block || []).map((block) => ({
    card: resolveReplayCard(block.card),
    effectiveValue: Number(block.effectiveValue || 0),
    preventDamage: Number(block.preventDamage || 0),
    payment: (block.payment?.cards || []).map(resolveReplayCard).filter(Boolean)
  }));
  const payments = (attack?.payment || []).map(resolveReplayCard).filter(Boolean);
  const blockPayments = blockers.flatMap((block) => block.payment || []);
  const attachments = (attack?.attachedCards || []).map(resolveReplayCard).filter(Boolean);
  const exactCards = evidenceCardIds.map(exactEvidenceCard).filter(Boolean);
  const cards = {
    primary: kind === "block" ? blockers[0]?.card || exactCards[0] || null : attackCard,
    payments: kind === "block"
      ? (blockPayments.length ? blockPayments : exactCards.filter((card) => card.runtimeId !== blockers[0]?.card?.runtimeId))
      : (payments.length ? payments : (kind === "payment" ? exactCards : [])),
    blockers: blockers.map((block) => block.card).filter(Boolean),
    attachments
  };
  const targetPlayerNum = primaryEntry?.targetPlayerNum ?? attack?.targetPlayer ?? null;
  const laneIndex = primaryEntry?.laneIndex ?? attack?.laneIndex ?? command.laneIndex ?? null;
  const attackValue = Number(damageEvent?.attackValue ?? attack?.effectiveValue ?? primaryEntry?.publicPayload?.effectiveValue ?? 0);
  const blockValue = Number(damageEvent?.blockValue ?? blockers.reduce((total, block) => total + block.effectiveValue, 0));
  const damage = Number(damageEvent?.damage ?? (primaryEntry?.eventType === "damage.dealt" ? primaryEntry.publicPayload?.amount : 0) ?? 0);
  const abilityId = command.abilityId || null;
  let label = eventLabel(primaryEntry);
  let summary = label;
  if (kind === "attack") {
    label = `${actorName} attacks`;
    summary = `${actorName} attacks${attackCard?.name ? ` with ${attackCard.name}` : ""}${attackValue ? ` for ${attackValue}` : ""}`;
  } else if (kind === "block") {
    label = `${actorName} blocks`;
    const names = cards.blockers.map((card) => card.name || `${card.rank || ""}${card.suit || ""}`).filter(Boolean).join(", ");
    summary = `${actorName} blocks${names ? ` with ${names}` : ""}${blockValue ? ` for ${blockValue}` : ""}`;
  } else if (kind === "resolution") {
    label = "Combat resolves";
    summary = `${attackValue} attack − ${blockValue} block = ${damage} damage`;
  } else if (kind === "ability") {
    const abilityName = primaryEntry?.publicPayload?.source || humanizeIdentifier(abilityId) || "a faction ability";
    label = `${actorName} uses an ability`;
    summary = `${actorName} uses ${abilityName}`;
  } else if (kind === "placement") {
    label = `${actorName} places a card`;
    summary = `${actorName} places a card${laneIndex == null ? "" : ` in Lane ${Number(laneIndex) + 1}`}`;
  } else if (kind === "turn") {
    label = `Turn ${Number(primaryEntry?.turn || 0)}`;
    summary = `${label} begins`;
  } else if (kind === "start") {
    label = "Match started";
    summary = `${participants.map((participant) => participant.displayName).join(" vs ")} begins`;
  } else if (kind === "payment") {
    label = `${actorName} pays`;
    summary = `${actorName} pays ${Number(paymentEvent?.total || 0)} of ${Number(paymentEvent?.required || 0)}`;
  } else if (kind === "result") {
    const winnerNum = primaryEntry?.publicPayload?.winner ?? frameAfter?.winner;
    label = "Match complete";
    summary = winnerNum == null ? "The match ends" : `${participantName(participants, winnerNum)} wins`;
  }
  return {
    schemaVersion: REPLAY_PRESENTATION_ACTION_VERSION,
    id: `${group.frame ? `frame-${frameAfterIndex}` : `evidence-${entries[0].sequence}`}`,
    index,
    kind,
    label,
    summary,
    actorPlayerNum: actorPlayerNum == null ? null : Number(actorPlayerNum),
    actorName,
    targetPlayerNum: targetPlayerNum == null ? null : Number(targetPlayerNum),
    targetName: targetPlayerNum == null ? null : participantName(participants, targetPlayerNum),
    laneIndex: laneIndex == null ? null : Number(laneIndex),
    turn: Number(primaryEntry?.turn || 0),
    phase: primaryEntry?.phase || "unknown",
    commandId: entries[0]?.commandId || null,
    commandType: entries[0]?.commandType || null,
    evidenceSequenceStart: Number(entries[0].sequence),
    evidenceSequenceEnd: Number(entries.at(-1).sequence),
    evidenceIds: entries.map((entry) => entry.eventId),
    frameBeforeIndex,
    frameAfterIndex,
    durationMs: actionDuration(kind, entries),
    cards,
    values: {
      attack: attackValue,
      block: blockValue,
      damage,
      paymentTotal: Number(paymentEvent?.total ?? attack?.paymentTotal ?? 0),
      paymentRequired: Number(paymentEvent?.required ?? attack?.paymentRequired ?? 0)
    },
    primaryEvent: {
      id: primaryEntry.eventId,
      sequence: Number(primaryEntry.sequence),
      type: primaryEntry.eventType,
      player: primaryEntry.actorPlayerNum,
      targetPlayer: primaryEntry.targetPlayerNum,
      laneIndex: primaryEntry.laneIndex,
      ...clonePlain(primaryEntry.publicPayload || {})
    },
    evidence: entries.map((entry) => ({
      sequence: Number(entry.sequence),
      eventId: entry.eventId,
      eventType: entry.eventType,
      label: eventLabel(entry),
      publicPayload: clonePlain(entry.publicPayload || {})
    }))
  };
}

function findEvidenceSequence(evidence, predicate, fallbackTurn = null) {
  const exact = evidence.find(predicate);
  if (exact) return Number(exact.sequence);
  if (fallbackTurn != null) {
    const sameTurn = evidence.find((entry) => Number(entry.turn) === Number(fallbackTurn));
    if (sameTurn) return Number(sameTurn.sequence);
  }
  return evidence.length ? Number(evidence[evidence.length - 1].sequence) : null;
}

function buildNotableJumps(record, evidence) {
  const largest = record.notableMoments?.largestAttack || null;
  const decisiveTurn = Number(record.notableMoments?.decisiveTurn || record.turnCount || 0);
  return [
    largest ? {
      id: "largest-attack",
      label: `Largest attack (${Number(largest.value || 0)})`,
      evidenceSequence: findEvidenceSequence(evidence, (entry) => (
        Number(entry.turn) === Number(largest.turn)
        && ["attack.declared", "damage.calculated"].includes(entry.eventType)
        && Number(entry.publicPayload?.effectiveValue ?? entry.publicPayload?.attackValue ?? -1) === Number(largest.value)
      ), largest.turn)
    } : null,
    {
      id: "decisive-turn",
      label: `Decisive turn (${decisiveTurn})`,
      evidenceSequence: findEvidenceSequence(evidence, (entry) => (
        Number(entry.turn) === decisiveTurn && ["damage.dealt", "match.ended"].includes(entry.eventType)
      ), decisiveTurn)
    },
    {
      id: "match-ending",
      label: "Match ending",
      evidenceSequence: findEvidenceSequence(evidence, (entry) => ["match.ended", "match.abandoned"].includes(entry.eventType))
    }
  ].filter((entry) => entry?.evidenceSequence != null);
}

function replayAvailability(record, storage = null) {
  const evidenceCount = Array.isArray(record?.leagueEvidence) ? record.leagueEvidence.length : 0;
  const frameCount = Array.isArray(record?.publicReplayFrames) ? record.publicReplayFrames.length : 0;
  return {
    available: Number(record?.recordVersion) === 2 && evidenceCount > 0,
    mode: frameCount > 0 ? "public-state-frames" : evidenceCount > 0 ? "event-only" : "unavailable",
    visualCoverage: frameCount > 0 ? "exact-authoritative-command-results" : "event-only",
    evidenceCount,
    frameCount,
    storageMode: storage?.mode || "unknown",
    survivesProcessReplacement: !!storage?.capabilities?.publicRecordAfterProcessReplacement,
    unavailableReason: evidenceCount > 0
      ? null
      : "This match has no authoritative league evidence available for replay."
  };
}

function buildReplayTimeline(record, storage = null) {
  const availability = replayAvailability(record, storage);
  if (!availability.available) {
    return {
      schemaVersion: REPLAY_TIMELINE_VERSION,
      matchId: record?.matchId || null,
      availability,
      frames: [],
      steps: [],
      actions: [],
      notableMoments: []
    };
  }
  const evidence = validateEvidence(record);
  const frames = validateFrames(record, evidence);
  const frameForSequence = (sequence) => frames.find((frame) => (
    Number(sequence) >= Number(frame.evidenceSequenceStart)
    && Number(sequence) <= Number(frame.evidenceSequence)
  )) || null;
  const steps = evidence.map((entry, index) => {
    const frame = frameForSequence(entry.sequence);
    return {
      index,
      evidenceSequence: Number(entry.sequence),
      evidenceId: entry.eventId,
      eventType: entry.eventType,
      commandType: entry.commandType || null,
      turn: Number(entry.turn || 0),
      phase: entry.phase || "unknown",
      actorPlayerNum: entry.actorPlayerNum == null ? null : Number(entry.actorPlayerNum),
      targetPlayerNum: entry.targetPlayerNum == null ? null : Number(entry.targetPlayerNum),
      laneIndex: entry.laneIndex == null ? null : Number(entry.laneIndex),
      publicPayload: clonePlain(entry.publicPayload || {}),
      label: eventLabel(entry),
      resultingStateChecksum: entry.resultingStateChecksum || null,
      frameIndex: frame?.frameIndex || null,
      stateTiming: frame ? "after-authoritative-command" : "event-only"
    };
  });
  const participants = (record.participants || []).map((participant) => ({
    participantId: participant.participantId || `${record.matchId}:p${participant.playerNum}`,
    playerNum: Number(participant.playerNum),
    identityType: participant.identityType || "guest",
    displayName: participant.displayName || `Player ${participant.playerNum}`,
    faction: clonePlain(participant.faction || { id: "basic", name: "Basic Gauntlet" }),
    finalLife: Number(participant.finalLife || 0),
    result: participant.result || "unknown"
  }));
  const actions = groupEvidence(evidence, frames).map((group, index) => buildPresentationAction({
    group,
    index,
    frames,
    participants
  }));
  const notableMoments = buildNotableJumps(record, evidence).map((moment) => {
    const action = actions.find((entry) => Number(moment.evidenceSequence) >= entry.evidenceSequenceStart
      && Number(moment.evidenceSequence) <= entry.evidenceSequenceEnd);
    return { ...moment, actionId: action?.id || null, actionIndex: action?.index ?? null };
  });
  return {
    schemaVersion: REPLAY_TIMELINE_VERSION,
    evidenceSchemaVersion: record.leagueEvidenceVersion || LEAGUE_EVIDENCE_VERSION,
    frameSchemaVersion: frames.length ? PUBLIC_REPLAY_FRAME_VERSION : null,
    matchId: record.matchId,
    recordVersion: Number(record.recordVersion),
    availability,
    presentationActionSchemaVersion: REPLAY_PRESENTATION_ACTION_VERSION,
    participants,
    season: clonePlain(record.season || null),
    series: clonePlain(record.series || null),
    result: {
      winnerPlayerNum: record.winnerPlayerNum == null ? null : Number(record.winnerPlayerNum),
      completionReason: record.completionReason,
      completedAt: record.completedAt,
      finalLife: clonePlain(record.finalLife || {})
    },
    frames: clonePlain(frames),
    steps,
    actions,
    notableMoments
  };
}

module.exports = {
  LEAGUE_EVIDENCE_VERSION,
  PUBLIC_REPLAY_FRAME_VERSION,
  REPLAY_PRESENTATION_ACTION_VERSION,
  REPLAY_TIMELINE_VERSION,
  buildPublicReplaySnapshot,
  buildReplayTimeline,
  capturePublicReplayFrame,
  replayAvailability,
  stableHash
};
