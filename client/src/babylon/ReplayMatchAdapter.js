import { createGauntletMatchViewModel } from "./matchViewModel";
import { createMatchDescriptor } from "./matchDescriptor";
import { getPlayingCardArtPath } from "../cardArt";

export const MIN_REPLAY_ACTION_INTERVAL_MS = 1100;

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function replayEvent(step) {
  return {
    id: step.evidenceId,
    sequence: step.evidenceSequence,
    type: step.eventType,
    player: step.actorPlayerNum,
    targetPlayer: step.targetPlayerNum,
    laneIndex: step.laneIndex,
    ...(step.publicPayload || {})
  };
}

function actionEvent(action) {
  if (action?.primaryEvent) return clone(action.primaryEvent);
  return action ? replayEvent(action) : null;
}

function actionEvents(action) {
  const evidenceEvents = (action?.evidence || []).map((entry) => ({
    id: entry.eventId || `replay-event-${entry.sequence}`,
    sequence: Number(entry.sequence || 0),
    type: entry.eventType,
    player: entry.actorPlayerNum ?? entry.publicPayload?.player ?? action.actorPlayerNum,
    targetPlayer: entry.targetPlayerNum ?? entry.publicPayload?.targetPlayer ?? action.targetPlayerNum,
    laneIndex: entry.laneIndex ?? entry.publicPayload?.laneIndex ?? action.laneIndex,
    ...(entry.publicPayload || {})
  })).filter((entry) => entry.type);
  const primary = actionEvent(action);
  if (primary && !evidenceEvents.some((entry) => entry.id === primary.id)) evidenceEvents.push(primary);
  return evidenceEvents;
}

function visualCard(card) {
  if (!card) return null;
  return {
    ...clone(card),
    artPath: card.collector?.art || getPlayingCardArtPath(card, card.factionId) || null,
    label: card.name || [card.rank || card.value, card.suit].filter(Boolean).join("") || "Public card"
  };
}

function visualAction(action) {
  if (!action) return null;
  return {
    ...clone(action),
    cards: {
      primary: visualCard(action.cards?.primary),
      payments: (action.cards?.payments || []).map(visualCard).filter(Boolean),
      blockers: (action.cards?.blockers || []).map(visualCard).filter(Boolean),
      attachments: (action.cards?.attachments || []).map(visualCard).filter(Boolean)
    }
  };
}

function fallbackAction(step) {
  if (!step) return null;
  return {
    ...step,
    id: `evidence-${step.evidenceSequence}`,
    kind: "event",
    summary: step.label,
    evidenceSequenceStart: step.evidenceSequence,
    evidenceSequenceEnd: step.evidenceSequence,
    frameBeforeIndex: step.frameIndex > 1 ? step.frameIndex - 1 : null,
    frameAfterIndex: step.frameIndex,
    durationMs: null,
    cards: { primary: null, payments: [], blockers: [], attachments: [] },
    values: {},
    primaryEvent: replayEvent(step),
    evidence: [{
      sequence: step.evidenceSequence,
      eventId: step.evidenceId,
      eventType: step.eventType,
      label: step.label,
      publicPayload: step.publicPayload || {}
    }]
  };
}

export class ReplayMatchAdapter {
  constructor({ replay, playbackIntervalMs = 1200 } = {}) {
    this.source = "replay";
    this.replay = replay || null;
    this.playbackIntervalMs = playbackIntervalMs;
    this.listeners = new Set();
    this.currentIndex = 0;
    this.playing = false;
    this.speed = 1;
    this.timer = null;
    this.commands = Object.freeze({});
    this.replayControls = Object.freeze({
      play: () => this.play(),
      pause: () => this.pause(),
      previous: () => this.previous(),
      next: () => this.next(),
      restart: () => this.restart(),
      jump: (index) => this.jump(index),
      jumpToEvidence: (sequence) => this.jumpToEvidence(sequence),
      setSpeed: (speed) => this.setSpeed(speed)
    });
  }

  connect() {
    if (!this.replay?.availability?.available) {
      return Promise.reject(new Error(this.replay?.availability?.unavailableReason || "Replay is unavailable."));
    }
    this.emit();
    return Promise.resolve();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.createUpdate());
    return () => this.listeners.delete(listener);
  }

  currentStep() {
    const action = this.currentAction();
    if (this.replay?.actions?.length) {
      return this.replay?.steps?.find((step) => Number(step.evidenceSequence) === Number(action?.evidenceSequenceEnd)) || null;
    }
    return this.replay?.steps?.[this.currentIndex] || null;
  }

  actions() {
    return this.replay?.actions?.length
      ? this.replay.actions
      : (this.replay?.steps || []).map(fallbackAction);
  }

  currentAction() {
    return this.actions()[this.currentIndex] || null;
  }

  frameForAction(action) {
    const frameIndex = action?.frameAfterIndex ?? action?.frameIndex;
    if (!frameIndex) return null;
    return this.replay?.frames?.find((frame) => Number(frame.frameIndex) === Number(frameIndex)) || null;
  }

  createUpdate() {
    const action = this.currentAction();
    const step = this.currentStep();
    const frame = this.frameForAction(action);
    const snapshot = frame?.publicState ? clone(frame.publicState) : null;
    const events = actionEvents(action);
    if (snapshot) snapshot.lastEvents = events;
    const viewModel = snapshot ? createGauntletMatchViewModel({
      game: snapshot,
      player: null,
      role: "spectator",
      instruction: action?.summary || action?.label || "Recorded match action.",
      phaseLabel: snapshot.phase === "gameOver" ? "Match Complete" : String(snapshot.phase || "Replay"),
      currentTurnLabel: `Turn ${Number(snapshot.turn || step?.turn || 0)}`,
      activePlayer: snapshot.priority,
      events,
      interaction: {
        handInteractionEnabled: false,
        legalLanes: [],
        highlightedLanes: [],
        laneUnavailableReasons: [],
        abilities: []
      },
      confirmDisabled: true,
      confirmReason: "Replay is read-only."
    }) : null;
    if (viewModel) viewModel.replayAction = visualAction(action);
    return {
      source: "replay",
      presentation: {
        renderer: "babylon-shared",
        motionContract: "gauntlet.card-motion.collision-safe.v1"
      },
      connected: true,
      descriptor: snapshot ? createMatchDescriptor(snapshot, {}) : null,
      snapshot,
      revision: Number(snapshot?.revision || 0),
      legalActions: [],
      events,
      viewModel,
      commands: this.commands,
      controls: null,
      replayControls: this.replayControls,
      replay: {
        schemaVersion: this.replay?.schemaVersion || null,
        visualCoverage: this.replay?.availability?.visualCoverage || "event-only",
        currentIndex: this.currentIndex,
        totalActions: this.actions().length,
        totalSteps: this.replay?.steps?.length || 0,
        playing: this.playing,
        speed: this.speed,
        step,
        action,
        result: clone(this.replay?.result || null),
        participants: clone(this.replay?.participants || []),
        notableMoments: this.replay?.notableMoments || []
      },
      broadcast: {
        kind: "replay",
        label: "Replay",
        season: this.replay?.season?.displayName || null,
        series: clone(this.replay?.series || null),
        matchId: this.replay?.matchId || null,
        participants: clone(this.replay?.participants || []),
        result: clone(this.replay?.result || null)
      },
      privacy: { required: false, player: null },
      inspection: null,
      diagnostics: {
        readOnly: true,
        evidenceSequence: step?.evidenceSequence || null,
        frameChecksum: frame?.publicStateChecksum || null
      }
    };
  }

  emit() {
    const update = this.createUpdate();
    this.listeners.forEach((listener) => listener(update));
  }

  schedule() {
    clearTimeout(this.timer);
    if (!this.playing) return;
    this.timer = setTimeout(() => {
      const finalIndex = Math.max(0, (this.actions().length || 1) - 1);
      if (this.currentIndex >= finalIndex) {
        this.playing = false;
        this.emit();
        return;
      }
      this.currentIndex += 1;
      if (this.currentIndex >= finalIndex) this.playing = false;
      this.emit();
      if (this.playing) this.schedule();
    }, Math.max(
      MIN_REPLAY_ACTION_INTERVAL_MS,
      Number(this.currentAction()?.durationMs || this.playbackIntervalMs) / this.speed
    ));
  }

  play() {
    if (this.currentIndex >= (this.actions().length || 1) - 1) this.currentIndex = 0;
    this.playing = true;
    this.emit();
    this.schedule();
  }

  pause() {
    this.playing = false;
    clearTimeout(this.timer);
    this.emit();
  }

  previous() {
    this.pause();
    this.currentIndex = Math.max(0, this.currentIndex - 1);
    this.emit();
  }

  next() {
    this.pause();
    this.currentIndex = Math.min(Math.max(0, (this.actions().length || 1) - 1), this.currentIndex + 1);
    this.emit();
  }

  restart() {
    this.pause();
    this.currentIndex = 0;
    this.emit();
  }

  jump(index) {
    this.pause();
    const finalIndex = Math.max(0, (this.actions().length || 1) - 1);
    this.currentIndex = Math.max(0, Math.min(finalIndex, Number(index) || 0));
    this.emit();
  }

  jumpToEvidence(sequence) {
    const index = this.actions().findIndex((action) => Number(sequence) >= Number(action.evidenceSequenceStart)
      && Number(sequence) <= Number(action.evidenceSequenceEnd));
    if (index >= 0) this.jump(index);
  }

  setSpeed(speed) {
    const next = [0.5, 1, 2, 4].includes(Number(speed)) ? Number(speed) : 1;
    this.speed = next;
    this.emit();
    if (this.playing) this.schedule();
  }

  dispose() {
    clearTimeout(this.timer);
    this.timer = null;
    this.playing = false;
    this.listeners.clear();
  }
}

export function createReplayMatchAdapter(options) {
  return new ReplayMatchAdapter(options);
}
