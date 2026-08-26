import {
  MAJOR_DAMAGE_THRESHOLD,
  projectPresentationBeats,
  projectPresentationCueMetadata,
  resolvePresentationBeatTiming
} from "./presentationCadence";

export const PRESENTATION_CUE_CONTRACT_VERSION = "gauntlet.presentation-cues.v1";
export { MAJOR_DAMAGE_THRESHOLD };

const DEFINITION_FIXTURES = Object.freeze({
  "payment.discarded": { id: "definition-payment", type: "payment.discarded", cardIds: ["card"] },
  "attack.declared": { id: "definition-attack", type: "attack.declared" },
  "block.declared": { id: "definition-block", type: "block.declared", cardIds: ["card"] },
  "damage.calculated": { id: "definition-damage", type: "damage.calculated", damage: 4 },
  "damage.dealt": { id: "definition-damage-dealt", type: "damage.dealt", amount: 4 },
  "attack.fullyBlocked": { id: "definition-blocked", type: "attack.fullyBlocked" },
  "card.placedFacedown": { id: "definition-place", type: "card.placedFacedown" },
  "cards.drawn": { id: "definition-draw", type: "cards.drawn", cardIds: ["card"] },
  "priority.granted": { id: "definition-priority", type: "priority.granted" },
  "priority.passed": { id: "definition-pass", type: "priority.passed" },
  "turn.started": { id: "definition-turn", type: "turn.started" },
  "ability.activated": { id: "definition-ability", type: "ability.activated" },
  "acceleration.gained": { id: "definition-acceleration", type: "acceleration.gained" },
  "acceleration.spent": { id: "definition-acceleration-spent", type: "acceleration.spent" },
  "lanes.swapped": { id: "definition-lane-swap", type: "lanes.swapped" },
  "card.peeked": { id: "definition-peek", type: "card.peeked" },
  "card.buffApplied": { id: "definition-buff", type: "card.buffApplied" },
  "laneCard.swappedWithHand": { id: "definition-hand-swap", type: "laneCard.swappedWithHand" },
  "choice.committed": { id: "definition-choice", type: "choice.committed" },
  "campaign.attackDeclared": { id: "definition-campaign-attack", type: "campaign.attackDeclared" },
  "campaign.bossHealed": { id: "definition-boss-heal", type: "campaign.bossHealed" },
  "match.ended": { id: "definition-result", type: "match.ended", winner: 1 }
});

function definitionFromCadence(entry) {
  const beat = projectPresentationBeats([entry])[0];
  if (!beat) return null;
  const timing = resolvePresentationBeatTiming(beat);
  const metadata = projectPresentationCueMetadata(beat, {
    timing,
    perspectivePlayer: entry.type === "match.ended" ? 1 : null
  })[0];
  if (!metadata) return null;
  return Object.freeze({
    cueId: metadata.cueId,
    phase: metadata.phase,
    durationMs: timing.durationMs,
    offsetMs: metadata.offsetMs,
    effectDurationMs: metadata.effectDurationMs,
    visualAssetId: metadata.visualAssetId,
    audioAssetId: metadata.audioAssetId,
    gain: metadata.gain,
    effect: metadata.effect,
    cadence: metadata.cadence
  });
}

export const PRESENTATION_CUE_DEFINITIONS = Object.freeze(Object.fromEntries(
  Object.entries(DEFINITION_FIXTURES).map(([type, entry]) => [type, definitionFromCadence(entry)])
));

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
  "match.draw",
  "combat.blocked",
  "damage.major",
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

export function projectPresentationCues(entryOrBeat, options = {}) {
  const {
    matchId = "match",
    traversalId = "live",
    durationMs,
    result = null,
    perspectivePlayer = null,
    spectator = false
  } = options;
  const beat = Array.isArray(entryOrBeat?.events) && entryOrBeat?.kind
    ? entryOrBeat
    : projectPresentationBeats([entryOrBeat], options)[0];
  if (!beat) return [];
  const naturalTiming = options.timing || beat.timing || resolvePresentationBeatTiming(beat, options);
  const requestedDuration = durationMs == null ? naturalTiming.durationMs : Math.max(0, Number(durationMs) || 0);
  const scale = naturalTiming.durationMs > 0 ? requestedDuration / naturalTiming.durationMs : 1;
  const timing = requestedDuration === naturalTiming.durationMs
    ? naturalTiming
    : {
        ...naturalTiming,
        durationMs: requestedDuration,
        phases: Object.fromEntries(Object.entries(naturalTiming.phases || {}).map(([phase, offset]) => [
          phase,
          Math.round(Number(offset || 0) * scale)
        ]))
      };
  return projectPresentationCueMetadata(beat, {
    ...options,
    timing,
    result,
    perspectivePlayer,
    spectator
  }).map((metadata) => {
    const source = metadata.sourceEvent || beat.event || {};
    const target = cueTargetForEvent(source);
    const sourceEventId = source.id || beat.sourceEventIds?.[0] || null;
    return {
      contract: PRESENTATION_CUE_CONTRACT_VERSION,
      cueId: metadata.cueId,
      occurrenceId: presentationCueOccurrenceId({
        matchId,
        sourceEventId,
        cueId: metadata.cueId,
        phase: metadata.phase,
        target,
        traversalId
      }),
      sourceEventId,
      eventType: source.type || beat.event?.type || beat.kind,
      phase: metadata.phase,
      target,
      offsetMs: metadata.offsetMs,
      durationMs: timing.durationMs,
      effectDurationMs: metadata.effectDurationMs,
      effect: metadata.effect,
      cadence: metadata.cadence,
      visual: { assetId: metadata.visualAssetId, fallback: `procedural.${metadata.cueId}` },
      audio: { assetId: metadata.audioAssetId, gain: metadata.gain, variant: "stable-hash", fallback: `tone.${metadata.cueId}` }
    };
  });
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
