import {
  MatchArchiveError,
  buildMatchPreview,
  buildReplayTimeline,
  buildPublicReplaySnapshot,
  createArtifact,
  parseAndVerifyArchive,
  replayAvailability,
  stableHash
} from "@gauntlet/match-history";

const DATABASE_NAME = "gauntlet-match-library";
const DATABASE_VERSION = 1;
const STORE_NAME = "matches";
const PUBLIC_REPLAY_FRAME_VERSION = "gauntlet.public-replay-frame.v1";
const LEAGUE_EVIDENCE_VERSION = "gauntlet.league-evidence.v1";

function portableUuid(seed = "gauntlet-local") {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const hex = stableHash(`${seed}:${Date.now()}:${Math.random()}`);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function localDeckSnapshot(initialPlayer, playerNum, gameMode) {
  const cards = [...(initialPlayer?.hand || []), ...(initialPlayer?.deck || [])];
  return {
    deckId: null,
    deckVersionId: `local-${gameMode}-p${playerNum}`,
    source: "local-simulator",
    format: gameMode === "factions" ? "constructed" : "standard",
    gameplayCards: cards.map((card) => card.gameplayCardId || card.definitionId || card.id),
    collectorVariants: cards.map((card) => card.variantId).filter(Boolean)
  };
}

export function createLocalMatchRecorder({ initialGame, playerNames = {}, startedAt = new Date().toISOString() } = {}) {
  if (!initialGame?.matchId) throw new Error("A local match state is required.");
  const evidence = [];
  const frames = [];
  const checkpoints = [];

  function appendEvidence(game, { commandId, commandType, actorPlayerNum, publicPayload }) {
    const publicState = buildPublicReplaySnapshot(game);
    const sequence = evidence.length + 1;
    const resultingStateChecksum = stableHash(publicState);
    const entry = {
      sequence,
      eventId: `${game.matchId}:local-evidence:${sequence}`,
      matchId: game.matchId,
      commandId,
      commandType,
      turn: Number(game.turn || 0),
      phase: game.phase || "unknown",
      actorPlayerNum: actorPlayerNum == null ? null : Number(actorPlayerNum),
      targetPlayerNum: null,
      laneIndex: publicPayload?.command?.laneIndex == null ? null : Number(publicPayload.command.laneIndex),
      eventType: commandType === "matchStarted" ? "match.started" : "command.accepted",
      publicPayload,
      resultingStateChecksum
    };
    evidence.push(entry);
    frames.push({
      schemaVersion: PUBLIC_REPLAY_FRAME_VERSION,
      frameIndex: frames.length + 1,
      matchId: game.matchId,
      evidenceSequenceStart: sequence,
      evidenceSequence: sequence,
      sourceEvidenceIds: [entry.eventId],
      turn: Number(game.turn || 0),
      phase: game.phase || "unknown",
      resultingStateChecksum,
      publicStateChecksum: stableHash(publicState),
      publicState
    });
  }

  appendEvidence(initialGame, {
    commandId: `${initialGame.matchId}:local-start`,
    commandType: "matchStarted",
    actorPlayerNum: null,
    publicPayload: { command: { type: "matchStarted" } }
  });

  return {
    matchId: initialGame.matchId,
    recordAccepted(game, envelope) {
      checkpoints.push({ evidenceLength: evidence.length, frameLength: frames.length });
      appendEvidence(game, {
        commandId: envelope.commandId,
        commandType: envelope.command?.type || "unknown",
        actorPlayerNum: envelope.actorPlayerId,
        publicPayload: { command: JSON.parse(JSON.stringify(envelope.command || {})) }
      });
    },
    undo() {
      const checkpoint = checkpoints.pop();
      if (!checkpoint) return;
      evidence.splice(checkpoint.evidenceLength);
      frames.splice(checkpoint.frameLength);
    },
    buildRecord(game, completedAt = new Date().toISOString()) {
      if (game?.phase !== "gameOver") throw new Error("Only a completed local match can become portable history.");
      const players = Object.keys(game.players || {}).map(Number).sort((left, right) => left - right);
      const participants = players.map((playerNum) => {
        const player = game.players[playerNum];
        return {
          participantId: `${game.matchId}:p${playerNum}`,
          playerNum,
          identityType: "guest",
          accountId: null,
          displayName: playerNames[playerNum] || player.accountName || `Player ${playerNum}`,
          faction: { id: player.faction?.id || "basic", name: player.faction?.name || "Basic Gauntlet" },
          deck: localDeckSnapshot(initialGame.players[playerNum], playerNum, game.gameMode || "basic"),
          finalLife: Number(player.life || 0),
          result: game.winner == null ? "draw" : Number(game.winner) === playerNum ? "win" : "loss"
        };
      });
      const finalLife = Object.fromEntries(participants.map((participant) => [participant.playerNum, participant.finalLife]));
      const finalizedAt = new Date(Math.max(Date.parse(completedAt), Date.now())).toISOString();
      return createArtifact({
        recordVersion: 2,
        matchId: game.matchId,
        seriesId: null,
        mode: game.gameMode || "basic",
        rulesVersion: game.rulesVersion || "unknown",
        contentVersion: game.cardContentVersion || "unknown",
        ranked: false,
        season: null,
        startedAt,
        completedAt,
        completionReason: game.winner == null ? "draw" : "life_total",
        abandonmentReason: null,
        winnerPlayerNum: game.winner == null ? null : Number(game.winner),
        turnCount: Number(game.turn || 1),
        participants,
        finalLife,
        series: null,
        campaign: null,
        draft: null,
        combatStats: { attacksResolved: 0, totalAttackValue: 0, totalBlockValue: 0, totalDamagePrevented: 0, totalDamageDealt: 0, largestAttack: null, byPlayer: {} },
        notableMoments: { largestAttack: null, finalLifeGap: participants.length === 2 ? Math.abs(participants[0].finalLife - participants[1].finalLife) : null, decisiveTurn: Number(game.turn || 1) },
        auditEvents: evidence.map((entry) => ({ sequence: entry.sequence, turn: entry.turn, phase: entry.phase, actorPlayerNum: entry.actorPlayerNum, eventType: entry.eventType, publicPayload: entry.publicPayload, serverTimestamp: null, stateChecksum: entry.resultingStateChecksum })),
        leagueEvidenceVersion: LEAGUE_EVIDENCE_VERSION,
        leagueEvidence: evidence,
        publicReplayFrameVersion: PUBLIC_REPLAY_FRAME_VERSION,
        publicReplayFrames: frames,
        leagueEvidenceCoverage: "complete",
        completion: { status: "finalized", envelopeVersion: "gauntlet.match-completion.v1", startedAt: completedAt, finalizedAt, consequences: [] }
      });
    }
  };
}

export function createPortableLocalMatchId(seed) {
  return portableUuid(seed);
}

export class LocalMatchConflictError extends Error {
  constructor(matchId, existingSha256, incomingSha256) {
    super("This match ID is already saved with different canonical JSON.");
    this.name = "LocalMatchConflictError";
    this.code = "LOCAL_MATCH_CONFLICT";
    this.matchId = matchId;
    this.existingSha256 = existingSha256;
    this.incomingSha256 = incomingSha256;
  }
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
  });
}

function openDatabase(indexedDb = window.indexedDB) {
  if (!indexedDb) return Promise.reject(new Error("This browser does not provide IndexedDB."));
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "matchId" });
        store.createIndex("completedAt", "completedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open the local Match Library."));
  });
}

export function createIndexedDbMatchBackend(indexedDb = window.indexedDB) {
  return {
    kind: "indexeddb",
    async get(matchId) {
      const database = await openDatabase(indexedDb);
      try {
        return await idbRequest(database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(matchId));
      } finally {
        database.close();
      }
    },
    async list() {
      const database = await openDatabase(indexedDb);
      try {
        return await idbRequest(database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll());
      } finally {
        database.close();
      }
    },
    async put(entry) {
      const database = await openDatabase(indexedDb);
      try {
        await idbRequest(database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(entry));
        return entry;
      } finally {
        database.close();
      }
    }
  };
}

export function createMemoryMatchBackend(initialEntries = []) {
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const entries = new Map(initialEntries.map((entry) => [entry.matchId, copy(entry)]));
  return {
    kind: "memory",
    async get(matchId) { return entries.has(matchId) ? copy(entries.get(matchId)) : undefined; },
    async list() { return [...entries.values()].map((entry) => copy(entry)); },
    async put(entry) { entries.set(entry.matchId, copy(entry)); return copy(entry); }
  };
}

function metadataForArtifact(artifact, source) {
  const record = artifact.record;
  const replay = replayAvailability(record, {
    mode: "local-match-library",
    capabilities: { completeRecordV2: "local", publicRecordAfterProcessReplacement: true }
  });
  return {
    matchId: record.matchId,
    canonicalJson: artifact.json,
    sha256: artifact.sha256,
    byteSize: artifact.byteSize,
    completedAt: record.completedAt,
    participants: record.participants.map((participant) => ({
      playerNum: Number(participant.playerNum),
      accountId: participant.accountId || null,
      displayName: participant.displayName,
      faction: participant.faction,
      result: participant.result,
      finalLife: Number(participant.finalLife || 0)
    })),
    mode: record.mode,
    ranked: !!record.ranked,
    season: record.season || null,
    winnerPlayerNum: record.winnerPlayerNum == null ? null : Number(record.winnerPlayerNum),
    turnCount: Number(record.turnCount || 0),
    replay,
    recordVersion: Number(record.recordVersion),
    savedAt: new Date().toISOString(),
    source: source || "unknown"
  };
}

export function inspectMatchJson(input) {
  const artifact = parseAndVerifyArchive(input);
  const replay = buildReplayTimeline(artifact.record, {
    mode: "portable-json",
    capabilities: { completeRecordV2: "local", publicRecordAfterProcessReplacement: true }
  });
  return {
    artifact,
    replay,
    preview: buildMatchPreview(artifact.record, {
      ...artifact.index,
      integrity: "canonical-hash-verified"
    }, replay.availability)
  };
}

export function createLocalMatchLibrary({ backend = createIndexedDbMatchBackend() } = {}) {
  const listeners = new Set();
  const notify = (event) => listeners.forEach((listener) => listener(event));
  return {
    backend,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    inspect(input) { return inspectMatchJson(input); },
    async save(input, { source = "manual-import" } = {}) {
      const inspected = inspectMatchJson(input);
      const existing = await backend.get(inspected.artifact.record.matchId);
      if (existing?.sha256 && existing.sha256 !== inspected.artifact.sha256) {
        throw new LocalMatchConflictError(inspected.artifact.record.matchId, existing.sha256, inspected.artifact.sha256);
      }
      if (existing?.sha256 === inspected.artifact.sha256) {
        return { status: "already-saved", entry: existing, ...inspected };
      }
      const entry = metadataForArtifact(inspected.artifact, source);
      await backend.put(entry);
      notify({ type: "saved", matchId: entry.matchId, entry });
      return { status: "saved", entry, ...inspected };
    },
    async list() {
      return (await backend.list()).sort((left, right) => Date.parse(right.completedAt || 0) - Date.parse(left.completedAt || 0));
    },
    async get(matchId) { return backend.get(matchId); },
    async load(matchId) {
      const entry = await backend.get(matchId);
      return entry ? { entry, ...inspectMatchJson(entry.canonicalJson) } : null;
    }
  };
}

export const localMatchLibrary = createLocalMatchLibrary({
  backend: window.indexedDB ? createIndexedDbMatchBackend(window.indexedDB) : createMemoryMatchBackend()
});

export async function saveCompletedMatchFromServer({ serverUrl, matchId, authToken, library = localMatchLibrary, fetchImpl = fetch }) {
  if (!matchId || !authToken) return { status: "skipped", reason: "signed-in-authoritative-record-required" };
  const response = await fetchImpl(`${serverUrl}/api/matches/${encodeURIComponent(matchId)}/archive`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  const text = await response.text();
  if (!response.ok) {
    let message = "Could not save the completed match on this device.";
    try { message = JSON.parse(text).error || message; } catch {}
    throw new Error(message);
  }
  return library.save(text, { source: "live-completion" });
}

function localPerspective(record, accountId) {
  const player = record.participants.find((participant) => accountId && participant.accountId === accountId)
    || record.participants[0]
    || null;
  const opponents = record.participants.filter((participant) => participant.playerNum !== player?.playerNum);
  return { player, opponent: opponents[0] || null, opponents, outcome: player?.result || "recorded" };
}

export function localEntryToMatch(entry, accountId = null) {
  const { artifact, preview, replay } = inspectMatchJson(entry.canonicalJson);
  const record = artifact.record;
  return {
    ...record,
    auditEvents: undefined,
    leagueEvidence: undefined,
    publicReplayFrames: undefined,
    perspective: localPerspective(record, accountId),
    replay: replay.availability,
    archive: { status: "local", integrity: "canonical-hash-verified", sha256: entry.sha256, byteSize: entry.byteSize },
    preview,
    local: { saved: true, source: entry.source, sha256: entry.sha256 }
  };
}

export function mergeMatchHistory(serverData = {}, localEntries = [], accountId = null) {
  const localMatches = localEntries.map((entry) => localEntryToMatch(entry, accountId));
  const matchesById = new Map((serverData.matches || []).map((match) => [match.matchId, match]));
  for (const localMatch of localMatches) {
    const serverMatch = matchesById.get(localMatch.matchId);
    matchesById.set(localMatch.matchId, serverMatch
      ? { ...serverMatch, replay: localMatch.replay, archive: localMatch.archive, preview: localMatch.preview, local: localMatch.local, localRecord: localMatch }
      : localMatch);
  }
  const matches = [...matchesById.values()].sort((left, right) => Date.parse(right.completedAt || 0) - Date.parse(left.completedAt || 0));
  const localIds = new Set(localMatches.map((match) => match.matchId));
  return {
    ...serverData,
    matches,
    unavailableMatchReferences: (serverData.unavailableMatchReferences || []).filter((reference) => !localIds.has(reference.matchId))
  };
}

export function downloadCanonicalMatch(entry, documentImpl = document, urlImpl = URL) {
  const blob = new Blob([entry.canonicalJson], { type: "application/json" });
  const url = urlImpl.createObjectURL(blob);
  const link = documentImpl.createElement("a");
  link.href = url;
  link.download = `gauntlet-match-${entry.matchId}.json`;
  documentImpl.body.appendChild(link);
  link.click();
  link.remove();
  urlImpl.revokeObjectURL(url);
}

export { MatchArchiveError, createArtifact };
