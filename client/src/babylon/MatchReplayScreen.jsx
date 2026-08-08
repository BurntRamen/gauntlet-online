import { useEffect, useMemo, useRef, useState } from "react";
import { getPlayingCardArtPath } from "../cardArt";
import ProductionMatchExperience from "./ProductionMatchExperience";
import { createReplayMatchAdapter } from "./ReplayMatchAdapter";
import "./MatchReplayScreen.css";

function cardArt(card) {
  const path = card?.collector?.art || getPlayingCardArtPath(card, card?.factionId);
  if (path) return /^https?:/i.test(path) ? path : `${process.env.PUBLIC_URL || ""}${path}`;
  return card?.factionId && card.factionId !== "basic"
    ? `${process.env.PUBLIC_URL || ""}/assets/gauntlet/${card.factionId}-card.webp`
    : "";
}

function cardLabel(card) {
  return card?.name || [card?.rank || card?.value, card?.suit].filter(Boolean).join("") || "Public card";
}

function ReplayCard({ card, role }) {
  if (!card) return null;
  const art = cardArt(card);
  return (
    <article className={`replay-focus-card ${role || "supporting"}`} aria-label={`${role || "Public"} card: ${cardLabel(card)}`}>
      <div className="replay-focus-art" style={art ? { backgroundImage: `url(${art})` } : undefined} aria-hidden="true">
        {!art && <strong>{card.rank || card.value || "◆"}<small>{card.suit || ""}</small></strong>}
      </div>
      <div>
        <strong>{cardLabel(card)}</strong>
        <span>{[card.rank && `${card.rank}${card.suit || ""}`, card.value != null && `Value ${card.value}`, card.factionId].filter(Boolean).join(" · ")}</span>
        {card.collector?.finish && <small>{card.collector.finish} · {card.collector.edition}</small>}
        {card.rulesText && (
          <details className="replay-card-details">
            <summary>Card details</summary>
            <p>{card.rulesText}</p>
          </details>
        )}
      </div>
    </article>
  );
}

function SupportingCards({ label, cards }) {
  if (!cards?.length) return null;
  return (
    <div className="replay-supporting-cards">
      <span>{label}</span>
      <div>{cards.map((card, index) => <ReplayCard card={card} role="supporting" key={`${card.runtimeId || card.gameplayCardId || label}-${index}`} />)}</div>
    </div>
  );
}

function ReplayActionLayer({ action }) {
  if (!action) return null;
  const tableauPrimary = ["attack", "block", "defense-declined", "resolution"].includes(action.kind);
  const values = action.values || {};
  const supportingBlockers = (action.cards?.blockers || []).filter((card) => (
    card.runtimeId !== action.cards?.primary?.runtimeId
    || card.gameplayCardId !== action.cards?.primary?.gameplayCardId
  ));
  const facts = [
    action.laneIndex != null ? `Lane ${Number(action.laneIndex) + 1}` : null,
    values.paymentRequired ? `Paid ${values.paymentTotal}/${values.paymentRequired}` : null,
    values.attack ? `Attack ${values.attack}` : null,
    values.block ? `Block ${values.block}` : null,
    values.damage ? `${values.damage} damage` : null
  ].filter(Boolean);
  return (
    <section className={`replay-action-layer kind-${action.kind}${tableauPrimary ? " is-tableau-primary" : ""}`} aria-live="polite" aria-atomic="true">
      <div className="replay-action-copy">
        <span>{action.actorName || "Gauntlet broadcast"} · Turn {action.turn || 0}</span>
        <h2>{action.summary || action.label}</h2>
        {facts.length > 0 && <p>{facts.join(" · ")}</p>}
      </div>
      <div className="replay-action-cards" aria-label="Focused public cards">
        <ReplayCard card={action.cards?.primary} role="primary" />
        <SupportingCards label="Payment" cards={action.cards?.payments} />
        <SupportingCards label="Blockers" cards={supportingBlockers} />
        <SupportingCards label="Armed" cards={action.cards?.attachments} />
      </div>
    </section>
  );
}

async function shareReplay(setStatus) {
  const url = window.location.href;
  try {
    await navigator.clipboard.writeText(url);
    setStatus("Replay link copied.");
  } catch {
    setStatus(url);
  }
}

function useReplayShortcuts(update) {
  const controls = update?.replayControls;
  const playing = update?.replay?.playing;
  useEffect(() => {
    if (!controls) return undefined;
    function onKeyDown(event) {
      const target = event.target;
      if (target?.matches?.("input, textarea, select, button, a, [contenteditable='true']")) return;
      const action = {
        " ": () => playing ? controls.pause() : controls.play(),
        ArrowLeft: controls.previous,
        ArrowRight: controls.next,
        Home: controls.restart,
        End: () => controls.jump(Math.max(0, (update?.replay?.totalActions || 1) - 1))
      }[event.key];
      if (!action) return;
      event.preventDefault();
      action();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [controls, playing, update?.replay?.totalActions]);
}

function useReplayExitShortcut(onExit) {
  useEffect(() => {
    if (!onExit) return undefined;
    function onKeyDown(event) {
      if (event.key !== "Escape") return;
      const target = event.target;
      if (target?.matches?.("input, textarea, select, button, a, [contenteditable='true']")) return;
      if (document.querySelector("details[open]")) return;
      event.preventDefault();
      onExit();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onExit]);
}

function ReplayNavigation({ onOpenMatches, onOpenMatchRecord }) {
  return (
    <header className="replay-navigation" aria-label="Replay navigation">
      <span>Replay</span>
      <button type="button" className="replay-exit" onClick={onOpenMatches} title="Return to Matches (Escape)">← Matches</button>
      <button type="button" onClick={onOpenMatchRecord}>Match Record</button>
    </header>
  );
}

function ReplayControls({ update }) {
  const replay = update?.replay;
  const action = replay?.action;
  const controls = update?.replayControls;
  const [shareStatus, setShareStatus] = useState("");
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef(null);
  useReplayShortcuts(update);
  useEffect(() => {
    function active() {
      setIdle(false);
      window.clearTimeout(idleTimer.current);
      if (replay?.playing) idleTimer.current = window.setTimeout(() => setIdle(true), 1800);
    }
    const events = ["pointermove", "pointerdown", "touchstart", "keydown"];
    events.forEach((name) => window.addEventListener(name, active, { passive: true }));
    active();
    return () => {
      events.forEach((name) => window.removeEventListener(name, active));
      window.clearTimeout(idleTimer.current);
    };
  }, [replay?.playing]);
  if (!replay || !controls) return null;
  const lastIndex = Math.max(0, replay.totalActions - 1);
  return (
    <aside className={`replay-transport${idle && replay.playing ? " is-idle" : ""}`} aria-label="Replay controls" data-testid="replay-transport">
      <div className="replay-transport-core">
        <div className="replay-action-position">
          <span>Action {replay.currentIndex + 1} of {replay.totalActions}</span>
          <strong>Turn {action?.turn || 0} · {action?.label || "Recorded match"}</strong>
        </div>
        <div className="replay-buttons">
          <button type="button" aria-label="Previous action" title="Previous action (Left)" disabled={replay.currentIndex === 0} onClick={controls.previous}>‹</button>
          {replay.playing
            ? <button type="button" className="replay-play" onClick={controls.pause}>Pause</button>
            : <button type="button" className="replay-play" onClick={controls.play}>Play</button>}
          <button type="button" aria-label="Next action" title="Next action (Right)" disabled={replay.currentIndex === lastIndex} onClick={controls.next}>›</button>
        </div>
        <label className="replay-scrubber">
          <span className="sr-only">Action {replay.currentIndex + 1} of {replay.totalActions}</span>
          <input aria-label="Replay action timeline" type="range" min="0" max={lastIndex} value={replay.currentIndex} onChange={(event) => controls.jump(Number(event.target.value))} />
        </label>
        <div className="replay-speed" aria-label="Playback speed">
          {[0.5, 1, 2, 4].map((speed) => (
            <button type="button" aria-pressed={replay.speed === speed} className={replay.speed === speed ? "active" : ""} key={speed} onClick={() => controls.setSpeed(speed)}>{speed}×</button>
          ))}
        </div>
        <details className="replay-more">
          <summary>More</summary>
          <div>
            <button type="button" onClick={() => shareReplay(setShareStatus)}>Share</button>
            {replay.notableMoments?.map((moment) => (
              <button type="button" key={moment.id} onClick={() => controls.jumpToEvidence(moment.evidenceSequence)}>{moment.label}</button>
            ))}
            <p>Evidence #{action?.evidenceSequenceStart || 0}–{action?.evidenceSequenceEnd || 0} · {action?.commandType || action?.phase || "recorded action"}</p>
          </div>
        </details>
      </div>
      {shareStatus && <p role="status" className="replay-share-status">{shareStatus}</p>}
    </aside>
  );
}

function ReplayConclusion({ update, onBack, onOpenMatches }) {
  const [visible, setVisible] = useState(false);
  const replay = update?.replay;
  const final = replay?.currentIndex === Math.max(0, (replay?.totalActions || 1) - 1) && !replay?.playing;
  useEffect(() => {
    if (!final) {
      setVisible(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setVisible(true), 900);
    return () => window.clearTimeout(timer);
  }, [final]);
  if (!visible) return null;
  const winnerNum = replay?.result?.winnerPlayerNum;
  const winner = replay?.participants?.find((participant) => Number(participant.playerNum) === Number(winnerNum));
  const title = winner ? `${winner.displayName} wins` : "Match complete";
  return (
    <section className="replay-conclusion" aria-label="Replay conclusion">
      <span>Final authoritative result</span>
      <h2>{title}</h2>
      <p>The final battlefield remains visible behind this broadcast result.</p>
      <div>
        <button type="button" onClick={update.replayControls.restart}>Restart Replay</button>
        <button type="button" onClick={onOpenMatches}>Matches</button>
        <button type="button" onClick={onBack}>Match Record</button>
      </div>
    </section>
  );
}

function EventOnlyReplay({ adapter }) {
  const [update, setUpdate] = useState(() => adapter.createUpdate());
  useEffect(() => adapter.subscribe(setUpdate), [adapter]);
  const action = update?.replay?.action;
  return (
    <section className="replay-event-only">
      <div className="replay-event-stage">
        <div className="replay-event-card">
          <span>Partial visual coverage</span>
          <h1>Authoritative event replay</h1>
          <p>This record predates public replay frames. Public actions are exact; missing battlefield positions are not inferred.</p>
          <dl>
            <div><dt>Actor</dt><dd>{action?.actorName || "Match system"}</dd></div>
            <div><dt>Action</dt><dd>{action?.summary || action?.label || "Recorded action"}</dd></div>
            <div><dt>Turn</dt><dd>{action?.turn || 0}</dd></div>
            <div><dt>Phase</dt><dd>{action?.phase || "unknown"}</dd></div>
            {action?.targetName && <div><dt>Target</dt><dd>{action.targetName}</dd></div>}
            {action?.values?.damage > 0 && <div><dt>Damage</dt><dd>{action.values.damage}</dd></div>}
          </dl>
          <ReplayCard card={action?.cards?.primary} role="primary" />
          <details className="replay-raw-evidence"><summary>Inspect authoritative evidence</summary><pre>{JSON.stringify(action?.evidence || [], null, 2)}</pre></details>
        </div>
      </div>
      <ReplayControls update={update} />
    </section>
  );
}

function VisualReplay({ adapter, audioEnabled, onBack, onOpenMatches }) {
  const [update, setUpdate] = useState(() => adapter.createUpdate());
  useEffect(() => adapter.subscribe(setUpdate), [adapter]);
  return (
    <div className="replay-visual-shell">
      <div className="replay-stage" data-testid="replay-battlefield-stage">
        <ProductionMatchExperience adapter={adapter} options={{ audioEnabled }} />
        <ReplayActionLayer action={update?.replay?.action} />
        <ReplayConclusion update={update} onBack={onBack} onOpenMatches={onOpenMatches} />
      </div>
      <ReplayControls update={update} />
    </div>
  );
}

export default function MatchReplayScreen({ matchId, serverUrl, onBack, onOpenMatches, audioEnabled = true }) {
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
  const adapter = useMemo(() => replay?.availability?.available ? createReplayMatchAdapter({ replay }) : null, [replay]);
  useEffect(() => () => adapter?.dispose(), [adapter]);
  const openMatches = onOpenMatches || onBack;
  useReplayExitShortcut(openMatches);

  if (loading) return <main className="match-replay-page"><ReplayNavigation onOpenMatches={openMatches} onOpenMatchRecord={onBack} /><section className="replay-status"><strong>Loading authoritative replay...</strong></section></main>;
  if (error) return <main className="match-replay-page"><ReplayNavigation onOpenMatches={openMatches} onOpenMatchRecord={onBack} /><section className="replay-status"><strong>Replay unavailable</strong><p>{error}</p></section></main>;
  if (!replay?.availability?.available || !adapter) {
    return <main className="match-replay-page"><ReplayNavigation onOpenMatches={openMatches} onOpenMatchRecord={onBack} /><section className="replay-status"><strong>Replay no longer available</strong><p>{replay?.availability?.unavailableReason || "The complete record is no longer available."}</p></section></main>;
  }
  return (
    <main className="match-replay-page" data-replay-mode={replay.availability.mode}>
      <ReplayNavigation onOpenMatches={openMatches} onOpenMatchRecord={onBack} />
      {replay.availability.mode === "public-state-frames"
        ? <VisualReplay adapter={adapter} audioEnabled={audioEnabled} onBack={onBack} onOpenMatches={openMatches} />
        : <EventOnlyReplay adapter={adapter} />}
    </main>
  );
}
