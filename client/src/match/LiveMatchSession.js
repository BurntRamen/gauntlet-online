const RESYNC_TIMEOUT_MS = 5000;

function acceptsSnapshot(current, incoming) {
  if (!incoming || !current || current.matchId !== incoming.matchId) return true;
  const currentSequence = Number(current.snapshotSequence || 0);
  const incomingSequence = Number(incoming.snapshotSequence || 0);
  if (currentSequence > 0 || incomingSequence > 0) {
    if (incomingSequence < currentSequence) return false;
    if (incomingSequence > currentSequence) return true;
  }
  return Number(incoming.revision || 0) >= Number(current.revision || 0);
}

function emptyState() {
  return {
    game: null,
    player: null,
    role: null,
    connected: false,
    controlState: {},
    commandSubmissionFrozen: false,
    resyncing: false
  };
}

export class LiveMatchSession {
  constructor({ socket, initialState = {} } = {}) {
    this.socket = socket;
    this.current = { ...emptyState(), ...initialState };
    this.listeners = new Set();
    this.fallbackPromise = null;
  }

  getCurrent() {
    return this.current;
  }

  getSocket() {
    return this.socket;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.current);
    return () => this.listeners.delete(listener);
  }

  update(next = {}) {
    const hasGame = Object.prototype.hasOwnProperty.call(next, "game");
    const acceptedGame = !hasGame || acceptsSnapshot(this.current.game, next.game);
    const acceptedNext = acceptedGame ? next : { ...next, game: this.current.game };
    this.current = { ...this.current, ...acceptedNext };
    this.listeners.forEach((listener) => listener(this.current));
    return acceptedGame;
  }

  freezeCommands(reason = "Renderer handoff in progress.") {
    this.update({ commandSubmissionFrozen: true, freezeReason: reason });
  }

  unfreezeCommands() {
    this.fallbackPromise = null;
    this.update({ commandSubmissionFrozen: false, freezeReason: "" });
  }

  requestResync(commandId = null) {
    if (!this.socket?.emit) {
      return Promise.reject(new Error("The live socket transport is unavailable."));
    }
    this.update({ resyncing: true });
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.update({ resyncing: false });
        reject(new Error("The latest match snapshot could not be acquired."));
      }, RESYNC_TIMEOUT_MS);
      this.socket.emit("requestMatchState", { commandId }, (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!result?.accepted || !result.snapshot) {
          this.update({ resyncing: false });
          reject(new Error(result?.rejection?.message || "The latest match snapshot is unavailable."));
          return;
        }
        this.update({ game: result.snapshot, resyncing: false });
        resolve(result);
      });
    });
  }

  async prepareRendererFallback(reason = "Babylon renderer failure") {
    if (this.fallbackPromise) return this.fallbackPromise;
    this.freezeCommands(reason);
    this.fallbackPromise = (async () => {
      try {
        return await this.requestResync();
      } catch {
        return { accepted: false, snapshot: this.current.game };
      }
    })();
    return this.fallbackPromise;
  }

  dispose() {
    this.fallbackPromise = null;
    this.listeners.clear();
  }
}

export function createLiveMatchSession(options) {
  return new LiveMatchSession(options);
}
