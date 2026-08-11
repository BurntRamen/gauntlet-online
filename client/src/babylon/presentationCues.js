export const PRESENTATION_CUE_CONTRACT_VERSION = "gauntlet.presentation-cues.v1";

export const PRESENTATION_CUE_DEFINITIONS = Object.freeze({
  "payment.discarded": Object.freeze({ cueId: "payment.release", phase: "release", durationMs: 1000, offsetMs: 620, visualAssetId: "payment.release", audioAssetId: "payment.release", gain: 0.46 }),
  "attack.declared": Object.freeze({ cueId: "attack.declare", phase: "settle", durationMs: 1300, offsetMs: 820, visualAssetId: "attack.declare", audioAssetId: "attack.declare", gain: 0.48 }),
  "block.declared": Object.freeze({ cueId: "block.commit", phase: "settle", durationMs: 1450, offsetMs: 900, visualAssetId: "block.commit", audioAssetId: "block.commit", gain: 0.48 }),
  "damage.calculated": Object.freeze({ cueId: "damage.impact", phase: "impact", durationMs: 1400, offsetMs: 260, visualAssetId: "damage.impact", audioAssetId: "damage.impact", gain: 0.5 }),
  "card.placedFacedown": Object.freeze({ cueId: "card.place", phase: "settle", durationMs: 1050, offsetMs: 760, visualAssetId: "card.place", audioAssetId: "card.place", gain: 0.4 }),
  "cards.drawn": Object.freeze({ cueId: "card.draw", phase: "travel", durationMs: 950, offsetMs: 120, visualAssetId: "card.draw", audioAssetId: "card.draw", gain: 0.38 }),
  "priority.granted": Object.freeze({ cueId: "priority.transfer", phase: "impact", durationMs: 800, visualAssetId: "priority.transfer", audioAssetId: "priority.transfer", gain: 0.38 }),
  "turn.started": Object.freeze({ cueId: "turn.start", phase: "impact", durationMs: 1150, visualAssetId: "turn.start", audioAssetId: "turn.start", gain: 0.42 }),
  "acceleration.gained": Object.freeze({ cueId: "ability.activate", phase: "impact", durationMs: 900, visualAssetId: "ability.activate", audioAssetId: "ability.activate", gain: 0.4 }),
  "campaign.attackDeclared": Object.freeze({ cueId: "attack.declare", phase: "settle", durationMs: 1300, visualAssetId: "attack.declare", audioAssetId: "attack.declare", gain: 0.48 }),
  "campaign.bossHealed": Object.freeze({ cueId: "ability.activate", phase: "impact", durationMs: 1000, visualAssetId: "ability.activate", audioAssetId: "ability.activate", gain: 0.4 }),
  "match.ended": Object.freeze({ cueId: "match.result", phase: "impact", durationMs: 1600, visualAssetId: "match.result", audioAssetId: "match.victory", gain: 0.5 })
});

export const BOARD_ACTION_CUE_IDS = Object.freeze([
  "card.lift",
  "card.travel",
  "card.settle",
  "card.draw",
  "card.place",
  "payment.commit",
  "payment.release",
  "card.discard",
  "attack.declare",
  "block.commit",
  "combat.resolve",
  "damage.impact",
  "priority.pass",
  "priority.transfer",
  "turn.start",
  "ability.activate",
  "match.victory",
  "match.defeat",
  "ui.select",
  "ui.confirm",
  "ui.cancel"
]);

function stablePart(value, fallback) {
  const text = String(value ?? fallback ?? "unknown").trim();
  return text.replace(/[^a-zA-Z0-9_.-]+/g, "-");
}

export function cueTargetForEvent(entry = {}) {
  const numericLaneIndex = Number(entry.laneIndex);
  return {
    zone: entry.laneIndex != null ? "lane" : entry.type?.startsWith("card.") ? "card" : entry.type?.startsWith("payment") ? "payment" : "board",
    side: entry.player != null ? `player-${entry.player}` : null,
    laneIndex: entry.laneIndex != null && Number.isInteger(numericLaneIndex) ? numericLaneIndex : null,
    cardId: entry.cardId || entry.cardIds?.[0] || null,
    attackId: entry.attackId || null
  };
}

export function presentationCueOccurrenceId({ matchId, sourceEventId, cueId, phase, target, traversalId = "live" }) {
  return [
    stablePart(matchId, "match"),
    stablePart(traversalId, "live"),
    stablePart(sourceEventId, "event"),
    stablePart(cueId, "cue"),
    stablePart(phase, "impact"),
    stablePart(target?.cardId ?? target?.attackId ?? target?.laneIndex, "board")
  ].join(":");
}

export function projectPresentationCues(entry, {
  matchId = "match",
  traversalId = "live",
  durationMs,
  result = null
} = {}) {
  const definition = PRESENTATION_CUE_DEFINITIONS[entry?.type];
  if (!definition) return [];
  const target = cueTargetForEvent(entry);
  let cueId = definition.cueId;
  let audioAssetId = definition.audioAssetId;
  let visualAssetId = definition.visualAssetId;
  if (entry.type === "match.ended") {
    const localWon = result?.localWon ?? entry.localWon;
    cueId = localWon === false ? "match.defeat" : "match.victory";
    audioAssetId = cueId;
    visualAssetId = cueId;
  }
  const cue = {
    contract: PRESENTATION_CUE_CONTRACT_VERSION,
    cueId,
    occurrenceId: presentationCueOccurrenceId({
      matchId,
      sourceEventId: entry.id,
      cueId,
      phase: definition.phase,
      target,
      traversalId
    }),
    sourceEventId: entry.id || null,
    eventType: entry.type,
    phase: definition.phase,
    target,
    offsetMs: Math.min(Number(durationMs ?? definition.durationMs), Number(definition.offsetMs || 0)),
    durationMs: Number(durationMs ?? definition.durationMs),
    visual: { assetId: visualAssetId, fallback: `procedural.${cueId}` },
    audio: { assetId: audioAssetId, gain: definition.gain, variant: "stable-hash", fallback: `tone.${cueId}` }
  };
  return [cue];
}

export function createInteractionCue(cueId, {
  matchId = "match",
  revision = 0,
  token = 0,
  target = { zone: "shell" }
} = {}) {
  return {
    contract: PRESENTATION_CUE_CONTRACT_VERSION,
    cueId,
    occurrenceId: presentationCueOccurrenceId({
      matchId,
      sourceEventId: `interaction-${revision}-${token}`,
      cueId,
      phase: "anticipate",
      target,
      traversalId: "interaction"
    }),
    sourceEventId: null,
    eventType: cueId,
    phase: "anticipate",
    target,
    offsetMs: 0,
    durationMs: 120,
    visual: { assetId: cueId, fallback: null },
    audio: { assetId: cueId, gain: 0.34, variant: "stable-hash", fallback: `tone.${cueId}` }
  };
}

export class PresentationCueLedger {
  constructor() {
    this.played = new Set();
  }

  accept(cue) {
    if (!cue?.occurrenceId || this.played.has(cue.occurrenceId)) return false;
    this.played.add(cue.occurrenceId);
    if (this.played.size > 400) this.played = new Set(Array.from(this.played).slice(-220));
    return true;
  }

  reset() {
    this.played.clear();
  }
}
