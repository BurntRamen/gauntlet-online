import { createLiveMatchSession } from "./LiveMatchSession";

test("publishes the latest live session state without owning the socket connection", () => {
  const socket = { emit: jest.fn() };
  const session = createLiveMatchSession({ socket });
  const updates = [];
  const unsubscribe = session.subscribe((update) => updates.push(update));

  session.update({ game: { matchId: "match-1", revision: 3 }, player: 1, connected: true });

  expect(session.getSocket()).toBe(socket);
  expect(session.getCurrent().game.revision).toBe(3);
  expect(updates.at(-1)).toEqual(expect.objectContaining({ player: 1, connected: true }));
  unsubscribe();
});

test("resynchronizes a command and freezes only renderer submissions during fallback", async () => {
  const snapshot = { matchId: "match-1", revision: 5, snapshotSequence: 8 };
  const commandResult = { commandId: "command-1", accepted: true, revision: 5 };
  const socket = {
    emit: jest.fn((eventName, payload, acknowledge) => {
      expect(eventName).toBe("requestMatchState");
      expect(payload).toEqual({ commandId: "command-1" });
      acknowledge({ accepted: true, snapshot, commandResult });
    })
  };
  const session = createLiveMatchSession({ socket });

  session.freezeCommands("renderer failed");
  const result = await session.requestResync("command-1");

  expect(result.commandResult).toEqual(commandResult);
  expect(session.getCurrent()).toEqual(expect.objectContaining({
    game: snapshot,
    commandSubmissionFrozen: true,
    resyncing: false
  }));
});

test("ignores out-of-order snapshots while accepting newer connection-only snapshots", () => {
  const session = createLiveMatchSession({
    socket: { emit: jest.fn() },
    initialState: {
      game: { matchId: "match-ordered", revision: 5, snapshotSequence: 8, message: "current" }
    }
  });

  expect(session.update({
    game: { matchId: "match-ordered", revision: 9, snapshotSequence: 7, message: "stale" }
  })).toBe(false);
  expect(session.getCurrent().game.message).toBe("current");

  expect(session.update({
    game: { matchId: "match-ordered", revision: 5, snapshotSequence: 9, message: "connection restored" }
  })).toBe(true);
  expect(session.getCurrent().game.message).toBe("connection restored");
});

test("coalesces repeated renderer fallback requests onto one authoritative resync", async () => {
  const snapshot = { matchId: "match-fallback", revision: 7, snapshotSequence: 11 };
  const socket = {
    emit: jest.fn((eventName, payload, acknowledge) => {
      expect(eventName).toBe("requestMatchState");
      acknowledge({ accepted: true, snapshot, commandResult: null });
    })
  };
  const session = createLiveMatchSession({ socket, initialState: { game: snapshot } });

  const [first, second] = await Promise.all([
    session.prepareRendererFallback("context lost"),
    session.prepareRendererFallback("duplicate failure")
  ]);

  expect(first.snapshot).toEqual(snapshot);
  expect(second.snapshot).toEqual(snapshot);
  expect(socket.emit).toHaveBeenCalledTimes(1);
  expect(session.getCurrent().commandSubmissionFrozen).toBe(true);
});
