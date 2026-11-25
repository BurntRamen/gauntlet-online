import { useEffect, useRef, useState } from "react";

function samplesFor(stage) {
  try {
    const values = JSON.parse(sessionStorage.getItem("suitfire.tableTime." + stage) || "[]");
    return values.filter(value => Number.isFinite(value) && value > 0);
  } catch { return []; }
}

// Record only completed waits. Leaving the page, cancelling or receiving an error
// must never make a future opening look faster than it really is.
export function useTableTiming(stage, waiting, ready) {
  const attempt = useRef(null);
  useEffect(() => {
    if (waiting) {
      if (attempt.current?.stage !== stage) {
        const samples = samplesFor(stage).sort((a,b) => a-b);
        attempt.current = {stage, start:Date.now(), estimate:samples.length >= 2 ? samples[Math.floor(samples.length/2)] : null};
      }
    } else if (attempt.current) {
      const last = attempt.current;
      attempt.current = null;
      if (ready) {
        const ms = Date.now() - last.start;
        if (ms > 0) try {
          sessionStorage.setItem("suitfire.tableTime." + last.stage, JSON.stringify([...samplesFor(last.stage),ms].slice(-7)));
        } catch {}
      }
    }
  }, [stage, waiting, ready]);
  return attempt;
}

export function Elapsed({ start, attempt, deadline, expectedEnd }) {
  const [mountedAt] = useState(Date.now);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = () => {
      const time = Date.now();
      setNow(time);
      if (expectedEnd && time >= expectedEnd) clearInterval(timer);
    };
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expectedEnd]);
  const began = start ?? attempt?.current?.start ?? mountedAt;
  const elapsed = Math.max(0, now - began);
  const seconds = Math.floor(elapsed / 1000);
  const estimate = attempt?.current?.estimate;
  const timing = estimate == null ? "" : elapsed >= estimate ? " · Taking longer than usual" :
    " · About " + Math.max(1, Math.ceil((estimate - elapsed)/1000)) + "s left based on recent tables";
  const limit = deadline ? " · Request timeout in " + Math.max(0,Math.ceil((deadline-now)/1000)) + "s" : "";
  if (expectedEnd) return <small role="timer" aria-live="off">About {Math.max(1,Math.ceil((expectedEnd-now)/1000))}s left</small>;
  return <small role="timer" aria-live="off">{seconds}s elapsed{timing}{limit}</small>;
}
