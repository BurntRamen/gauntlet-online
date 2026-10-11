import { act, renderHook } from "@testing-library/react";
import useDraftRequest from "./useDraftRequest";

function mockSocket(connected = true) {
  const listeners = {};
  const socket = {
    connected,
    on: jest.fn((event, callback) => { listeners[event] = callback; }),
    once: jest.fn((event, callback) => { listeners[event] = callback; }),
    off: jest.fn((event) => { delete listeners[event]; }),
    connect: jest.fn(),
    timeout: jest.fn(() => socket),
    emit: jest.fn(),
    trigger: (event) => listeners[event]?.()
  };
  return socket;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test("waits for confirmation and prevents duplicate picks", () => {
  const socket = mockSocket();
  const error = jest.fn();
  const { result } = renderHook(() => useDraftRequest(socket, error));
  act(() => {
    expect(result.current.run("pick", "draftPick", { cardCopyId: "first" })).toBe(true);
    expect(result.current.run("pick", "draftPick", { cardCopyId: "second" })).toBe(false);
  });
  expect(socket.emit).toHaveBeenCalledTimes(1);
  expect(result.current.pending.action).toBe("pick");
  act(() => socket.emit.mock.calls[0][2](null, { ok: true }));
  expect(result.current.pending).toBeNull();
  act(() => jest.advanceTimersByTime(21000));
  expect(error.mock.calls).toEqual([[""]]);
});

test("table state finishes entry without releasing an unrelated draft mutation", () => {
  const socket = mockSocket();
  const { result } = renderHook(() => useDraftRequest(socket, jest.fn()));
  act(() => result.current.run("enter", "createBotDraftRoom"));
  expect(result.current.pending.action).toBe("enter");
  act(() => result.current.finishEntry());
  expect(result.current.pending).toBeNull();
  act(() => result.current.run("pick", "draftPick"));
  act(() => result.current.finishEntry());
  expect(result.current.pending.action).toBe("pick");
});

test("connection wait times out without buffering a room creation for later", () => {
  const socket = mockSocket(false);
  const error = jest.fn();
  const { result } = renderHook(() => useDraftRequest(socket, error));
  act(() => result.current.run("enter", "createBotDraftRoom"));
  expect(result.current.pending.connecting).toBe(true);
  expect(socket.emit).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(20000));
  expect(result.current.pending).toBeNull();
  expect(error).toHaveBeenCalledWith(expect.stringMatching(/did not respond/));
  act(() => socket.trigger("connect"));
  expect(socket.emit).not.toHaveBeenCalled();
});

test("connects before entering and surfaces server rejection", () => {
  const socket = mockSocket(false);
  const error = jest.fn();
  const { result } = renderHook(() => useDraftRequest(socket, error));
  act(() => result.current.run("enter", "createBotDraftRoom"));
  act(() => { socket.connected = true; socket.trigger("connect"); });
  expect(result.current.pending.connecting).toBe(false);
  act(() => socket.emit.mock.calls[0][2](null, { ok: false, error: "Sign in or enter a guest name first." }));
  expect(error).toHaveBeenCalledWith("Sign in or enter a guest name first.");
  expect(result.current.pending).toBeNull();
});

test("never queues an offline pick to replay after reconnection", () => {
  const socket = mockSocket(false);
  const error = jest.fn();
  const { result } = renderHook(() => useDraftRequest(socket, error));
  act(() => expect(result.current.run("pick", "draftPick")).toBe(false));
  expect(result.current.pending).toBeNull();
  act(() => { socket.connected = true; socket.trigger("connect"); });
  expect(socket.emit).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalledWith(expect.stringMatching(/Reconnect/));
});

test("disconnect clears pending controls and late replies cannot clear a newer request", () => {
  const socket = mockSocket();
  const error = jest.fn();
  const { result } = renderHook(() => useDraftRequest(socket, error));
  act(() => result.current.run("pick", "draftPick"));
  const oldReply = socket.emit.mock.calls[0][2];
  act(() => socket.trigger("disconnect"));
  expect(result.current.pending).toBeNull();
  expect(error).toHaveBeenCalledWith(expect.stringMatching(/Connection lost/));
  act(() => result.current.run("build", "setDraftDeckAdditions"));
  act(() => oldReply(null, { ok: true }));
  expect(result.current.pending.action).toBe("build");
});
