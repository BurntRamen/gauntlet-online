import { useEffect, useMemo, useRef, useState } from "react";
import { buildMatchTranscript } from "@gauntlet/match-history";
import { downloadMatchTranscript } from "../matchTranscript";

export default function ReplayTranscript({ adapter }) {
  const [update, setUpdate] = useState(() => adapter.createUpdate());
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const current = useRef(null);
  const panel = useRef(null);
  const trigger = useRef(null);
  const transcript = useMemo(() => buildMatchTranscript(adapter.replay), [adapter]);
  useEffect(() => adapter.subscribe(setUpdate), [adapter]);
  const index = update.replay.currentIndex;
  useEffect(() => {
    if (open && index > 0) current.current?.scrollIntoView?.({ block: "nearest" });
  }, [index, open]);
  useEffect(() => {
    if (!open) return undefined;
    panel.current?.focus();
    const close = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    window.addEventListener("keydown", close, true);
    return () => window.removeEventListener("keydown", close, true);
  }, [open]);
  return <>
    <button className="replay-history-toggle" ref={trigger} type="button" aria-expanded={open} aria-controls="replay-history" onClick={() => setOpen(!open)}>Match History</button>
    {open && <section id="replay-history" className="replay-history" aria-label="Match history" ref={panel} tabIndex={-1}>
      <header>
        <h2>Match History</h2>
        <button type="button" onClick={() => downloadMatchTranscript(adapter.replay)}>Export TXT</button>
        <button type="button" onClick={() => setExpanded(!expanded)} aria-pressed={expanded}>{expanded ? "Compact view" : "Detailed view"}</button>
        <button type="button" aria-label="Close match history" onClick={() => { setOpen(false); trigger.current?.focus(); }}>Close</button>
      </header>
      <div className="replay-history-scroll">
        {transcript.header.map((line, n) => <p key={n}>{line}</p>)}
        <p>{transcript.coverage}</p>
        <ol className="replay-history-actions">
          {transcript.actions.map((action) => <li key={action.id} ref={action.index === index ? current : null} aria-current={action.index === index ? "step" : undefined}>
            <button type="button" onClick={() => { adapter.replayControls.pause(); adapter.replayControls.jump(action.index); }}>
              Turn {action.turn} · Play {action.index + 1} · {action.title}
            </button>
            {expanded && <>
              <p>{action.phase} · {action.timestamp || "Time not recorded"}</p>
              <details><summary>Before command</summary>{action.before.map((line, n) => <p key={n}>{line}</p>)}</details>
              {action.cards.map((line, n) => <p key={n}>{line}</p>)}
              <ol>{action.events.map((event) => <li key={event.sequence}>
                <strong>#{event.sequence} · Turn {event.turn} · {event.title}</strong>
                {event.details.map((line, n) => <p key={n}>{line}</p>)}
              </li>)}</ol>
              <details open><summary>After command</summary>{action.after.map((line, n) => <p key={n}>{line}</p>)}</details>
            </>}
          </li>)}
        </ol>
        {transcript.footer.map((line, n) => <p key={n}>{line}</p>)}
      </div>
    </section>}
  </>;
}
