import { projectPresentationCues } from "./presentationCues";

export const BATTLEFIELD_PLAYBACK_CONTRACT_VERSION = "gauntlet.battlefield-playback.queued.v1";

export const BATTLEFIELD_EVENT_PACING = Object.freeze({
  "payment.discarded": 1100,
  "attack.declared": 1500,
  "block.declared": 1700,
  "damage.calculated": 1400,
  "card.placedFacedown": 1150,
  "cards.drawn": 1050,
  "priority.granted": 850,
  "turn.started": 1200,
  "match.ended": 1700,
  "campaign.attackDeclared": 1500,
  "campaign.bossHealed": 1100
});

const REDUCED_MOTION_EVENT_MS = 420;

function eventIdentity(entry, fallbackIndex = 0) {
  if (entry?.id) return entry.id;
  return [
    entry?.type || "event",
    entry?.revision || "revision",
    entry?.sequence ?? fallbackIndex,
    entry?.player ?? "player",
    entry?.cardId || (entry?.cardIds || []).join("-") || "card"
  ].join(":");
}

export function battlefieldEventDuration(entry, { reducedMotion = false, playbackRate = 1 } = {}) {
  const duration = BATTLEFIELD_EVENT_PACING[entry?.type] || 0;
  if (!duration) return 0;
  const rate = Math.max(0.25, Number(playbackRate) || 1);
  return Math.round((reducedMotion ? REDUCED_MOTION_EVENT_MS : duration) / rate);
}

export function battlefieldCommitEventIndex(events = []) {
  const preferredCommitTypes = [
    "match.ended",
    "damage.calculated",
    "attack.declared",
    "card.placedFacedown",
    "cards.drawn",
    "block.declared",
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
    const id = eventIdentity(entry, index);
    if (!battlefieldEventDuration(entry, options) || seenEventIds.has(id)) return false;
    seenEventIds.add(id);
    return true;
  });

  if (freshEvents.length === 0) {
    return [{ update, event: null, durationMs: 0 }];
  }

  const baseUpdate = options.baseUpdate?.viewModel ? options.baseUpdate : null;
  const commitIndex = baseUpdate ? battlefieldCommitEventIndex(freshEvents) : 0;
  return freshEvents.map((entry, index) => {
    const stateCommitted = index >= commitIndex;
    const sourceViewModel = stateCommitted ? update.viewModel : baseUpdate.viewModel;
    const visualViewModel = entry.type === "payment.discarded" && !stateCommitted
      ? { ...sourceViewModel, publicPayments: update.viewModel.publicPayments || [] }
      : sourceViewModel;
    const durationMs = battlefieldEventDuration(entry, options);
    const presentationCues = projectPresentationCues(entry, {
      matchId: update.viewModel.matchId || update.snapshot?.id,
      traversalId: options.traversalId || (update.source === "replay" ? "replay-0" : "live"),
      durationMs,
      result: update.viewModel.result
    });
    return {
      event: entry,
      durationMs,
      update: {
      ...(index < commitIndex ? baseUpdate : update),
      source: update.source,
      connected: update.connected,
      commands: update.commands,
      events: [entry],
      presentation: {
        ...(index < commitIndex ? baseUpdate?.presentation : update.presentation),
        playbackContract: BATTLEFIELD_PLAYBACK_CONTRACT_VERSION,
        activeEventIndex: index,
        activeEventCount: freshEvents.length,
        activeEventType: entry.type,
        stateCommitted,
        cues: presentationCues
      },
      viewModel: {
        ...visualViewModel,
        events: [entry],
        presentationCues,
        presentationPlayback: {
          contract: BATTLEFIELD_PLAYBACK_CONTRACT_VERSION,
          activeEventIndex: index,
          activeEventCount: freshEvents.length,
          activeEventType: entry.type,
          stateCommitted
        }
      }
      }
    };
  });
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
      inputLocked: this.activeFrame?.update?.presentation?.stateCommitted === false
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
