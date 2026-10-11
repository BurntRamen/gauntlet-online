import { useCallback, useEffect, useRef, useState } from "react";

// Mutations are never buffered while offline: a delayed pick could otherwise
// be replayed against a different pack after reconnecting.
export default function useDraftRequest(socket, onError) {
  const [pending, setPending] = useState(null);
  const active = useRef(null);
  const errorHandler = useRef(onError);
  errorHandler.current = onError;

  const clear = useCallback(() => {
    if (active.current) {
      clearTimeout(active.current.timer);
      socket.off("connect", active.current.send);
    }
    active.current = null;
    setPending(null);
  }, [socket]);

  const finishEntry = useCallback(() => {
    if (active.current?.action === "enter") clear();
  }, [clear]);

  useEffect(() => {
    const disconnected = () => {
      if (!active.current?.sent) return;
      clear();
      errorHandler.current("Connection lost. Your draft will reload when you reconnect; check it before trying again.");
    };
    socket.on("disconnect", disconnected);
    return () => {
      socket.off("disconnect", disconnected);
      clear();
    };
  }, [socket, clear]);

  const run = useCallback((action, event, payload = {}) => {
    if (active.current) return false;
    if (!socket.connected && action !== "enter") {
      errorHandler.current("Reconnect to your draft before trying again.");
      return false;
    }
    errorHandler.current("");
    const request = { action, sent: false };
    const finish = (error, response) => {
      if (active.current !== request) return;
      clear();
      if (error || response?.error || !response?.ok) {
        errorHandler.current(response?.error || "The draft server did not respond. Check your connection and try again.");
      }
    };
    request.send = () => {
      if (active.current !== request || request.sent) return;
      if (!socket.connected) return;
      request.sent = true;
      setPending({ action, connecting: false });
      socket.timeout(20000).emit(event, payload, finish);
    };
    request.timer = setTimeout(() => finish(new Error("timeout")), 20000);
    active.current = request;
    setPending({ action, connecting: !socket.connected });
    if (socket.connected) request.send();
    else {
      socket.once("connect", request.send);
      socket.connect();
    }
    return true;
  }, [socket, clear]);

  return { pending, run, clear, finishEntry };
}
