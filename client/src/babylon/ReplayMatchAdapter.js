import { createGauntletMatchViewModel } from "./matchViewModel";
import { createMatchDescriptor } from "./matchDescriptor";

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
    return this.replay?.steps?.[this.currentIndex] || null;
  }

  frameForStep(step) {
    if (!step?.frameIndex) return null;
    return this.replay?.frames?.find((frame) => Number(frame.frameIndex) === Number(step.frameIndex)) || null;
  }

  createUpdate() {
    const step = this.currentStep();
    const frame = this.frameForStep(step);
    const snapshot = frame?.publicState ? clone(frame.publicState) : null;
    const event = step ? replayEvent(step) : null;
    if (snapshot) snapshot.lastEvents = event ? [event] : [];
    const viewModel = snapshot ? createGauntletMatchViewModel({
      game: snapshot,
      player: null,
      role: "spectator",
      instruction: step?.label || "Recorded match event.",
      phaseLabel: snapshot.phase === "gameOver" ? "Match Complete" : String(snapshot.phase || "Replay"),
      currentTurnLabel: `Turn ${Number(snapshot.turn || step?.turn || 0)}`,
      activePlayer: snapshot.priority,
      events: event ? [event] : [],
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
    return {
      source: "replay",
      connected: true,
      descriptor: snapshot ? createMatchDescriptor(snapshot, {}) : null,
      snapshot,
      revision: Number(snapshot?.revision || 0),
      legalActions: [],
      events: event ? [event] : [],
      viewModel,
      commands: this.commands,
      controls: null,
      replayControls: this.replayControls,
      replay: {
        schemaVersion: this.replay?.schemaVersion || null,
        visualCoverage: this.replay?.availability?.visualCoverage || "event-only",
        currentIndex: this.currentIndex,
        totalSteps: this.replay?.steps?.length || 0,
        playing: this.playing,
        speed: this.speed,
        step,
        notableMoments: this.replay?.notableMoments || []
      },
      broadcast: {
        kind: "replay",
        label: "Replay",
        season: this.replay?.season?.displayName || null,
        series: clone(this.replay?.series || null),
        matchId: this.replay?.matchId || null,
        participants: clone(this.replay?.participants || [])
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
      const finalIndex = Math.max(0, (this.replay?.steps?.length || 1) - 1);
      if (this.currentIndex >= finalIndex) {
        this.playing = false;
        this.emit();
        return;
      }
      this.currentIndex += 1;
      if (this.currentIndex >= finalIndex) this.playing = false;
      this.emit();
      if (this.playing) this.schedule();
    }, Math.max(80, this.playbackIntervalMs / this.speed));
  }

  play() {
    if (this.currentIndex >= (this.replay?.steps?.length || 1) - 1) this.currentIndex = 0;
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
    this.currentIndex = Math.min(Math.max(0, (this.replay?.steps?.length || 1) - 1), this.currentIndex + 1);
    this.emit();
  }

  restart() {
    this.pause();
    this.currentIndex = 0;
    this.emit();
  }

  jump(index) {
    this.pause();
    const finalIndex = Math.max(0, (this.replay?.steps?.length || 1) - 1);
    this.currentIndex = Math.max(0, Math.min(finalIndex, Number(index) || 0));
    this.emit();
  }

  jumpToEvidence(sequence) {
    const index = this.replay?.steps?.findIndex((step) => Number(step.evidenceSequence) === Number(sequence));
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
