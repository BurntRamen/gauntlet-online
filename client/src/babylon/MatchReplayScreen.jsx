import { useEffect, useMemo, useState } from "react";
import ProductionMatchExperience from "./ProductionMatchExperience";
import { createReplayMatchAdapter } from "./ReplayMatchAdapter";
import "./MatchReplayScreen.css";

function ReplayControls({ update, adapter }) {
  const replay = update?.replay;
  const step = replay?.step;
  const controls = update?.replayControls;
  const [shareStatus, setShareStatus] = useState("");
  if (!replay || !controls) return null;
  const lastIndex = Math.max(0, replay.totalSteps - 1);
  async function share() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("Replay link copied.");
    } catch {
      setShareStatus(url);
    }
  }
  return (
    <aside className="replay-controls" aria-label="Replay controls">
      <div className="replay-heading">
        <div><span>Replay</span><strong>{step?.label || "Recorded match"}</strong></div>
        <button type="button" onClick={share}>Share</button>
      </div>
      <div className="replay-buttons">
        <button type="button" onClick={controls.restart}>Restart</button>
        <button type="button" disabled={replay.currentIndex === 0} onClick={controls.previous}>Previous event</button>
        {replay.playing
          ? <button type="button" onClick={controls.pause}>Pause</button>
          : <button type="button" onClick={controls.play}>Play</button>}
        <button type="button" disabled={replay.currentIndex === lastIndex} onClick={controls.next}>Next event</button>
      </div>
      <label className="replay-scrubber">
        <span>Event {replay.currentIndex + 1} of {replay.totalSteps}</span>
        <input
          aria-label="Replay timeline"
          type="range"
          min="0"
          max={lastIndex}
          value={replay.currentIndex}
          onChange={(event) => controls.jump(Number(event.target.value))}
        />
      </label>
      <div className="replay-speed" aria-label="Playback speed">
        {[0.5, 1, 2, 4].map((speed) => (
          <button
            type="button"
            className={replay.speed === speed ? "active" : ""}
            key={speed}
            onClick={() => controls.setSpeed(speed)}
          >
            {speed}x
          </button>
        ))}
      </div>
      {replay.notableMoments?.length > 0 && (
        <div className="replay-notable" aria-label="Notable moments">
          <span>Notable moments</span>
          {replay.notableMoments.map((moment) => (
            <button type="button" key={moment.id} onClick={() => controls.jumpToEvidence(moment.evidenceSequence)}>
              {moment.label}
            </button>
          ))}
        </div>
      )}
      <p className="replay-event-meta">T{step?.turn || 0} / {step?.phase || "unknown"} / evidence #{step?.evidenceSequence || 0}</p>
      {shareStatus && <p role="status" className="replay-share-status">{shareStatus}</p>}
    </aside>
  );
}

function EventOnlyReplay({ adapter }) {
  const [update, setUpdate] = useState(() => adapter.createUpdate());
  useEffect(() => adapter.subscribe(setUpdate), [adapter]);
  const step = update?.replay?.step;
  return (
    <section className="replay-event-only">
      <div className="replay-event-card">
        <span>Partial visual coverage</span>
        <h1>Authoritative event replay</h1>
        <p>This record predates public replay frames. Events are exact; missing battlefield state is not inferred.</p>
        <dl>
          <div><dt>Event</dt><dd>{step?.eventType || "Unavailable"}</dd></div>
          <div><dt>Turn</dt><dd>{step?.turn || 0}</dd></div>
          <div><dt>Phase</dt><dd>{step?.phase || "unknown"}</dd></div>
          <div><dt>Details</dt><dd>{step?.label || "Recorded event"}</dd></div>
        </dl>
        <pre>{JSON.stringify(step?.publicPayload || {}, null, 2)}</pre>
      </div>
      <ReplayControls update={update} adapter={adapter} />
    </section>
  );
}

function VisualReplay({ adapter, audioEnabled }) {
  const [update, setUpdate] = useState(() => adapter.createUpdate());
  useEffect(() => adapter.subscribe(setUpdate), [adapter]);
  return (
    <div className="replay-visual-shell">
      <ProductionMatchExperience adapter={adapter} options={{ audioEnabled }} />
      <ReplayControls update={update} adapter={adapter} />
    </div>
  );
}

export default function MatchReplayScreen({ matchId, serverUrl, onBack, audioEnabled = true }) {
  const [replay, setReplay] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetch(`${serverUrl}/api/matches/${encodeURIComponent(matchId)}/replay`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load replay.");
        if (active) setReplay(data.replay);
      })
      .catch((fetchError) => active && setError(fetchError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [matchId, serverUrl]);
  const adapter = useMemo(() => replay?.availability?.available
    ? createReplayMatchAdapter({ replay })
    : null, [replay]);
  useEffect(() => () => adapter?.dispose(), [adapter]);

  if (loading) return <main className="replay-status"><strong>Loading authoritative replay...</strong></main>;
  if (error) return <main className="replay-status"><strong>Replay unavailable</strong><p>{error}</p><button type="button" onClick={onBack}>Back to Match Record</button></main>;
  if (!replay?.availability?.available || !adapter) {
    return <main className="replay-status"><strong>Replay unavailable</strong><p>{replay?.availability?.unavailableReason || "The complete record is no longer available."}</p><button type="button" onClick={onBack}>Back to Match Record</button></main>;
  }
  return (
    <main className="match-replay-page" data-replay-mode={replay.availability.mode}>
      <button type="button" className="replay-back" onClick={onBack}>Back to Match Record</button>
      {replay.availability.mode === "public-state-frames"
        ? <VisualReplay adapter={adapter} audioEnabled={audioEnabled} />
        : <EventOnlyReplay adapter={adapter} />}
    </main>
  );
}
