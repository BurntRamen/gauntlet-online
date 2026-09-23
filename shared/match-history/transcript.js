const { formatMatchLogEntry } = require("./formatLog");

const UNKNOWN = "Not recorded";
const readable = (value) => String(value || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[._-]/g, " ");
const recorded = (value) => value == null ? UNKNOWN : String(value);

function describeCard(card) {
  if (!card || card.hidden) return "Hidden card";
  const face = [card.rank, card.suit].filter(Boolean).join(" ");
  return [card.name || face || "Unnamed public card", card.name && face,
    `Type: ${card.type || (card.rank && card.suit ? "playing card" : UNKNOWN)}`,
    card.value != null && `Value: ${card.value}`, card.factionId && `Faction: ${card.factionId}`,
    (card.text || card.rulesText) && `Text: ${card.text || card.rulesText}`].filter(Boolean).join(" · ");
}

function stateLines(state, participants) {
  if (!state) return ["State not recorded for this moment."];
  const lines = [`Turn ${recorded(state.turn)} · ${readable(state.phase) || UNKNOWN} · Priority: ${state.priority == null ? UNKNOWN : playerName(participants, state.priority)}`];
  for (const participant of participants) {
    const player = state.players?.[participant.playerNum];
    lines.push(`${participant.displayName}: life ${recorded(player?.life)} · hand ${recorded(player?.handCount)} (identities obscured) · deck ${recorded(player?.deckCount)} · discard ${recorded(player?.discardCount)}`);
  }
  for (const [index, lane] of (state.lanes || []).entries()) {
    const slots = participants.map((p) => `${p.displayName}: ${lane.facedown?.[p.playerNum] ? "face-down card" : "empty"}`);
    lines.push(`Lane ${index + 1}: ${slots.join("; ")}`);
    if (lane.attack) lines.push(`  Attack: ${describeCard(lane.attack.card)} · effective ${recorded(lane.attack.effectiveValue)}`);
    for (const block of lane.block || []) lines.push(`  Block: ${describeCard(block.card)} · effective ${recorded(block.effectiveValue)}`);
  }
  for (const attack of state.handAttacks || []) {
    lines.push(`Hand attack by ${playerName(participants, attack.player)}: ${describeCard(attack.card)} · effective ${recorded(attack.effectiveValue)}`);
    for (const block of attack.block || []) lines.push(`  Block: ${describeCard(block.card)} · effective ${recorded(block.effectiveValue)}`);
  }
  return lines;
}

function playerName(participants, number) {
  return number == null ? "Match system" : participants.find((p) => Number(p.playerNum) === Number(number))?.displayName || `Player ${number}`;
}

// Unknown typed effects remain readable facts, rather than being silently dropped.
function factLines(value, path = "") {
  if (value == null) return [];
  if (typeof value !== "object") return [`${readable(path)}: ${value}`];
  if (Array.isArray(value)) return value.flatMap((entry, index) => factLines(entry, `${path} ${index + 1}`));
  return Object.entries(value).filter(([key]) => !["publicTotals", "turn", "phase", "command", "card", "cards", "cardId", "cardIds"].includes(key))
    .flatMap(([key, child]) => factLines(child, path ? `${path} / ${key}` : key));
}

function describeEvent(entry, participants, action) {
  const payload = entry.publicPayload || {};
  const type = entry.eventType;
  const actor = entry.actorPlayerNum ?? payload.player ?? action.actorPlayerNum;
  const players = Object.fromEntries(participants.map((p) => [p.playerNum, { name: p.displayName }]));
  const formatted = formatMatchLogEntry({ ...payload, type, player: actor,
    targetPlayer: entry.targetPlayerNum ?? payload.targetPlayer,
    laneIndex: entry.laneIndex ?? payload.laneIndex }, { players });
  const command = payload.command;
  const title = type === "command.accepted" || command
    ? `${playerName(participants, actor)}: ${readable(command?.type || action.commandType)}`
    : formatted.title === "Match state updated." ? `${playerName(participants, actor)}: ${readable(type)}` : formatted.title;
  const cards = [payload.card, ...(payload.cards || []), payload.calculation?.attack?.card,
    ...(payload.calculation?.blocks || []).map((b) => b.card), ...(payload.calculation?.cards || [])].filter(Boolean);
  const uniqueCards = [...new Map(cards.map((card) => [card.id || JSON.stringify(card), card])).values()];
  const details = [formatted.detail, ...uniqueCards.map(describeCard), ...factLines(payload)].filter(Boolean);
  if (command?.abilityId) details.push(`Ability: ${readable(command.abilityId)}`);
  if (command?.laneIndex != null) details.push(`Lane ${Number(command.laneIndex) + 1}`);
  if (payload.publicTotals) {
    for (const [number, totals] of Object.entries(payload.publicTotals)) {
      details.push(`${playerName(participants, number)}: life ${recorded(totals.life)} · hand ${recorded(totals.handCount)} (obscured) · deck ${recorded(totals.deckCount)} · discard ${recorded(totals.discardCount)}`);
    }
  }
  return { sequence: entry.sequence, turn: entry.turn ?? action.turn, phase: entry.phase ?? action.phase,
    timestamp: entry.serverTimestamp || null, title, details: [...new Set(details)], type };
}

function buildMatchTranscript(replay) {
  const participants = replay.participants || [];
  const frames = new Map((replay.frames || []).map((f) => [Number(f.frameIndex), f.publicState]));
  const metadata = replay.metadata || {};
  const firstState = replay.frames?.[0]?.publicState;
  const header = [`Gauntlet Match #${replay.matchId}`, "Perspective: Public — hand identities and deck order obscured.",
    `Mode: ${metadata.mode || firstState?.gameMode || UNKNOWN} · Ranked: ${metadata.ranked == null ? UNKNOWN : metadata.ranked ? "Yes" : "No"}`,
    `Started: ${metadata.startedAt || UNKNOWN} · Completed: ${replay.result?.completedAt || UNKNOWN}`,
    `Rules: ${metadata.rulesVersion || firstState?.rulesVersion || UNKNOWN} · Content: ${metadata.contentVersion || firstState?.cardContentVersion || UNKNOWN}`];
  for (const p of participants) {
    const deck = metadata.formats?.find((f) => Number(f.playerNum) === Number(p.playerNum));
    header.push(`${p.displayName} · ${p.faction?.name || UNKNOWN} · Format: ${deck?.format || UNKNOWN} · Deck version: ${deck?.deckVersionId || UNKNOWN}`);
  }
  const actions = (replay.actions || []).map((action, index) => {
    const before = frames.get(Number(action.frameBeforeIndex));
    const after = frames.get(Number(action.frameAfterIndex));
    // A starting scene is setup, not an inferred pre-command state.
    const commandEvidence = action.evidence?.find((e) => e.eventType === "command.accepted");
    return { id: action.id, index, turn: commandEvidence?.turn ?? action.turn,
      phase: commandEvidence?.phase ?? action.phase, title: action.summary || action.label,
      timestamp: commandEvidence?.serverTimestamp || action.evidence?.[0]?.serverTimestamp || null,
      before: stateLines(before, participants), after: stateLines(after, participants),
      cards: [action.cards?.primary, ...(action.cards?.payments || []), ...(action.cards?.blockers || []), ...(action.cards?.attachments || [])].filter(Boolean).map(describeCard),
      events: (action.evidence || []).map((entry) => describeEvent(entry, participants, action)),
      evidenceStart: action.evidenceSequenceStart, evidenceEnd: action.evidenceSequenceEnd };
  });
  const winner = replay.result?.winnerPlayerNum;
  const outcome = winner != null ? `${playerName(participants, winner)} wins` : participants.every((p) => p.result === "draw") && participants.length ? "Draw" : "No winner recorded";
  const footer = [`Result: ${outcome} · Reason: ${replay.result?.completionReason || UNKNOWN}`,
    ...participants.map((p) => `${p.displayName}: ${p.result || UNKNOWN} · Final life ${recorded(replay.result?.finalLife?.[p.playerNum] ?? p.finalLife)}`)];
  return { schemaVersion: "gauntlet.match-transcript.v1", matchId: replay.matchId, header, actions, footer,
    coverage: "Battlefield snapshots are after complete commands. Event totals are shown only when recorded; timestamps are command capture times. Missing historical detail is not reconstructed." };
}

function formatMatchTranscript(transcript) {
  const lines = [...transcript.header, transcript.coverage];
  for (const action of transcript.actions) {
    lines.push("", `TURN ${action.turn} — PLAY ${action.index + 1} — ${readable(action.phase)}`, action.title,
      `Time: ${action.timestamp || UNKNOWN} · Evidence ${action.evidenceStart}–${action.evidenceEnd}`,
      "Before command:", ...action.before.map((line) => `  ${line}`), ...action.cards.map((line) => `Card: ${line}`));
    for (const event of action.events) lines.push(`  #${event.sequence} · Turn ${event.turn} · ${readable(event.phase)} · ${event.title}`, ...event.details.map((line) => `    ${line}`));
    lines.push("After command:", ...action.after.map((line) => `  ${line}`));
  }
  return [...lines, "", ...transcript.footer, ""].join("\n");
}

module.exports = { buildMatchTranscript, formatMatchTranscript, describeCard };
