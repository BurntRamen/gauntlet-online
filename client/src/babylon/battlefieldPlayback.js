import { projectPresentationCues } from "./presentationCues";
import {
  PRESENTATION_CADENCE_CONTRACT_VERSION,
  PRESENTATION_EVENT_PACING,
  isPresentationCadenceEvent,
  presentationEventDuration,
  presentationEventIdentity,
  projectPresentationBeats,
  resolvePresentationBeatTiming
} from "./presentationCadence";

export const BATTLEFIELD_PLAYBACK_CONTRACT_VERSION = "gauntlet.battlefield-playback.queued.v1";

export const BATTLEFIELD_EVENT_PACING = PRESENTATION_EVENT_PACING;

export function battlefieldEventDuration(entry, { reducedMotion = false, playbackRate = 1 } = {}) {
  return presentationEventDuration(entry, { reducedMotion, playbackRate });
}

export function battlefieldCommitEventIndex(events = []) {
  const preferredCommitTypes = [
    "damage.calculated",
    "damage.dealt",
    "attack.fullyBlocked",
    "match.ended",
    "attack.declared",
    "card.placedFacedown",
    "cards.drawn",
    "block.declared",
    "ability.activated",
    "lanes.swapped",
    "laneCard.swappedWithHand",
    "card.peeked",
    "card.buffApplied",
    "acceleration.gained",
    "acceleration.spent",
    "priority.granted",
    "turn.started"
  ];
  for (const type of preferredCommitTypes) {
    const index = events.findIndex((entry) => entry.type === type);
    if (index >= 0) return index;
  }
  return Math.max(0, events.length - 1);
}

export function createBattlefieldPlaybackFrames(update, seenEventIds, options = {}) {
  if (!update?.viewModel) return [];
  const events = update.events || update.viewModel.events || [];
  const freshEvents = events.filter((entry, index) => {
    const id = presentationEventIdentity(entry, index);
    if (!isPresentationCadenceEvent(entry) || seenEventIds.has(id)) return false;
    seenEventIds.add(id);
    return true;
  });
  const beats = projectPresentationBeats(freshEvents, options);

  if (beats.length === 0) {
    return [{ update, event: null, beat: null, durationMs: 0 }];
  }

  const commitEvent = freshEvents[battlefieldCommitEventIndex(freshEvents)];
  const selectedCommitBeatIndex = beats.findIndex((beat) => beat.events.includes(commitEvent));
  const commitBeatIndex = selectedCommitBeatIndex >= 0 ? selectedCommitBeatIndex : 0;
  const hasBaseUpdate = Boolean(options.baseUpdate?.viewModel);
  const eventFrames = beats.flatMap((beat, index) => {
    const timing = resolvePresentationBeatTiming(beat, options);
    const durationMs = timing.durationMs;
    const stateCommitted = !hasBaseUpdate || index >= commitBeatIndex;
    const visualSource = stateCommitted ? update : options.baseUpdate;
    const presentationCues = projectPresentationCues(beat, {
      matchId: update.viewModel.matchId || update.snapshot?.id,
      traversalId: options.traversalId || (update.source === "replay" ? "replay-0" : "live"),
      timing,
      durationMs,
      result: update.viewModel.result,
      perspectivePlayer: update.viewModel.perspective?.player,
      spectator: update.viewModel.perspective?.spectator
    });
    const frameForBeat = ({
      source,
      frameDurationMs,
      frameEvents,
      frameCues,
      frameEvent,
      frameTiming,
      committed,
      phase
    }) => ({
      event: frameEvent,
      beat: frameEvent ? beat : null,
      durationMs: frameDurationMs,
      update: {
        ...source,
        source: update.source,
        connected: update.connected,
        commands: update.commands,
        events: frameEvents,
        presentation: {
          ...source.presentation,
          playbackContract: BATTLEFIELD_PLAYBACK_CONTRACT_VERSION,
          activeEventIndex: index,
          activeEventCount: beats.length,
          activeEventType: frameEvent?.type || null,
          activeBeatId: beat.id,
          activeBeatKind: beat.kind,
          activeBeatPhase: phase,
          cadenceContract: PRESENTATION_CADENCE_CONTRACT_VERSION,
          cadenceTier: beat.tier,
          cadenceTiming: frameTiming,
          stateCommitted: committed,
          eventGate: true,
          cues: frameCues
        },
        viewModel: {
          ...source.viewModel,
          // Event-gated commitment frames intentionally hold the prior board
          // state, but cards referenced by accepted events are already public.
          // Carry the authoritative public catalog forward so their transient
          // payment/combat actors never fall back to placeholder faces.
          visibleCardCatalog: {
            ...(source.viewModel?.visibleCardCatalog || {}),
            ...(update.viewModel?.visibleCardCatalog || {})
          },
          events: frameEvents,
          presentationCues: frameCues,
          presentationEventGate: true,
          presentationPlayback: {
            contract: BATTLEFIELD_PLAYBACK_CONTRACT_VERSION,
            activeEventIndex: index,
            activeEventCount: beats.length,
            activeEventType: frameEvent?.type || null,
            activeBeatId: beat.id,
            activeBeatKind: beat.kind,
            activeBeatPhase: phase,
            cadenceContract: PRESENTATION_CADENCE_CONTRACT_VERSION,
            cadenceTier: beat.tier,
            cadenceTiming: frameTiming,
            commitBeatIndex,
            stateCommitted: committed,
            eventGate: true,
            playbackRate: Math.max(0.25, Number(options.playbackRate) || 1)
          }
        }
      }
    });
    const consequenceKinds = new Set(["combat.blocked", "damage.impact", "damage.major"]);
    const commitOffsetMs = stateCommitted && hasBaseUpdate && consequenceKinds.has(beat.kind)
      ? Math.max(0, Math.min(durationMs, Number(timing.phases?.impact || 0)))
      : 0;
    if (!commitOffsetMs) {
      return [frameForBeat({
        source: visualSource,
        frameDurationMs: durationMs,
        frameEvents: beat.events,
        frameCues: presentationCues,
        frameEvent: beat.event,
        frameTiming: timing,
        committed: stateCommitted,
        phase: "active"
      })];
    }
    const consequenceDurationMs = durationMs - commitOffsetMs;
    const segmentTiming = (startMs, segmentDurationMs) => ({
      ...timing,
      durationMs: segmentDurationMs,
      segmentStartMs: startMs,
      phases: Object.fromEntries(Object.entries(timing.phases || {}).map(([phase, offset]) => [
        phase,
        Math.max(0, Math.min(segmentDurationMs, Number(offset || 0) - startMs))
      ]))
    });
    const consequenceCues = presentationCues.map((cue) => ({
      ...cue,
      offsetMs: Math.max(0, Number(cue.offsetMs || 0) - commitOffsetMs),
      durationMs: consequenceDurationMs,
      effectDurationMs: Math.min(
        consequenceDurationMs,
        Number(cue.effectDurationMs || consequenceDurationMs)
      )
    }));
    return [
      frameForBeat({
        source: options.baseUpdate,
        frameDurationMs: commitOffsetMs,
        frameEvents: [],
        frameCues: [],
        frameEvent: null,
        frameTiming: segmentTiming(0, commitOffsetMs),
        committed: false,
        phase: "anticipation"
      }),
      frameForBeat({
        source: update,
        frameDurationMs: consequenceDurationMs,
        frameEvents: beat.events,
        frameCues: consequenceCues,
        frameEvent: beat.event,
        frameTiming: segmentTiming(commitOffsetMs, consequenceDurationMs),
        committed: true,
        phase: "consequence"
      })
    ];
  });
  return [
    ...eventFrames,
    {
      event: null,
      beat: null,
      durationMs: 0,
      update: {
        ...update,
        events: [],
        presentation: {
          ...update.presentation,
          playbackContract: BATTLEFIELD_PLAYBACK_CONTRACT_VERSION,
          stateCommitted: true,
          finalReconcile: true,
          cadenceContract: PRESENTATION_CADENCE_CONTRACT_VERSION,
          cues: []
        },
        viewModel: {
          ...update.viewModel,
          events: [],
          presentationCues: [],
          presentationEventGate: false,
          presentationPlayback: {
            contract: BATTLEFIELD_PLAYBACK_CONTRACT_VERSION,
            activeEventIndex: beats.length,
            activeEventCount: beats.length,
            activeEventType: null,
            activeBeatId: null,
            activeBeatKind: null,
            cadenceContract: PRESENTATION_CADENCE_CONTRACT_VERSION,
            commitBeatIndex,
            stateCommitted: true,
            finalReconcile: true,
            playbackRate: Math.max(0.25, Number(options.playbackRate) || 1)
          }
        }
      }
    }
  ];
}

export class BattlefieldPlaybackQueue {
  constructor({
    onPresent,
    onStateChange = () => {},
    reducedMotion = false,
    setTimer = (callback, duration) => setTimeout(callback, duration),
    clearTimer = (timer) => clearTimeout(timer)
  }) {
    this.onPresent = onPresent;
    this.onStateChange = onStateChange;
    this.reducedMotion = reducedMotion;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.frames = [];
    this.seenEventIds = new Set();
    this.activeFrame = null;
    this.timer = null;
    this.matchId = null;
    this.replayIndex = null;
    this.latestUpdate = null;
    this.traversalGeneration = 0;
    this.disposed = false;
  }

  push(update) {
    if (this.disposed || !update?.viewModel) return;
    const nextMatchId = update.viewModel.matchId || update.snapshot?.id || null;
    if (this.matchId && nextMatchId && this.matchId !== nextMatchId) this.reset();
    this.matchId = nextMatchId;
    const nextReplayIndex = Number(update.replay?.currentIndex);
    if (
      update.source === "replay"
      && Number.isInteger(nextReplayIndex)
      && Number.isInteger(this.replayIndex)
      && nextReplayIndex !== this.replayIndex + 1
    ) {
      this.traversalGeneration += 1;
      this.reset();
    }
    this.replayIndex = Number.isInteger(nextReplayIndex) ? nextReplayIndex : null;

    const incoming = createBattlefieldPlaybackFrames(update, this.seenEventIds, {
      reducedMotion: this.reducedMotion,
      playbackRate: update.replay?.speed || 1,
      baseUpdate: this.latestUpdate,
      traversalId: update.source === "replay" ? `replay-${this.traversalGeneration}` : "live"
    });
    this.latestUpdate = update;
    if (incoming.length === 1 && incoming[0].durationMs === 0) {
      const last = this.frames.at(-1);
      if (last?.durationMs === 0) this.frames[this.frames.length - 1] = incoming[0];
      else this.frames.push(incoming[0]);
    } else {
      this.frames.push(...incoming);
    }
    this.pump();
  }

  pump() {
    if (this.disposed || this.activeFrame || this.frames.length === 0) {
      this.notify();
      return;
    }
    const frame = this.frames.shift();
    this.activeFrame = frame;
    this.onPresent(frame.update, {
      event: frame.event,
      durationMs: frame.durationMs,
      queuedFrames: this.frames.length
    });
    this.notify();

    if (frame.durationMs <= 0) {
      this.activeFrame = null;
      this.pump();
      return;
    }
    this.timer = this.setTimer(() => {
      this.timer = null;
      this.activeFrame = null;
      this.pump();
    }, frame.durationMs);
  }

  notify() {
    this.onStateChange({
      active: Boolean(this.activeFrame),
      queuedFrames: this.frames.length,
      catchingUp: Boolean(this.activeFrame) || this.frames.length > 0,
      inputLocked: false
    });
  }

  reset() {
    if (this.timer != null) this.clearTimer(this.timer);
    this.timer = null;
    this.frames = [];
    this.activeFrame = null;
    this.seenEventIds.clear();
    this.replayIndex = null;
    this.latestUpdate = null;
    this.notify();
  }

  dispose() {
    this.disposed = true;
    this.reset();
  }
}
