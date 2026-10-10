import { useEffect, useRef, useState } from "react";
import FactionLoadoutPicker from "./FactionLoadoutPicker";
import "./EventHub.css";

function Reward({ tier, earned }) {
  const parts = [];
  if (tier.gold) parts.push(`${Number(tier.gold).toLocaleString()} gold`);
  if (tier.boosterCredits) parts.push(`${tier.boosterCredits} booster credit${tier.boosterCredits === 1 ? "" : "s"}`);
  if (tier.cardStyleId) parts.push("animated collector card style");
  return <li className={earned ? "is-earned" : ""}>
    <strong>{tier.wins} win{tier.wins === 1 ? "" : "s"}</strong>
    <span>{parts.join(" + ")}</span>
    <small>{earned ? "Earned" : "Upcoming"}</small>
  </li>;
}

function localDate(value, options = {}) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", ...options
  }).format(new Date(value));
}

function scheduleSummary(event) {
  if (!event?.schedule) return "Always available";
  return `${localDate(event.schedule.startsAt)} – ${localDate(event.schedule.endsAt, { year: undefined })}`;
}

function liveAvailability(event, nowMs) {
  if (!event?.schedule) return event?.availability || { state: "open", label: "Open now", canEnter: true, canPlay: true };
  const startsAt = new Date(event.schedule.startsAt).getTime();
  const entryClosesAt = new Date(event.schedule.entryClosesAt).getTime();
  const endsAt = new Date(event.schedule.endsAt).getTime();
  if (nowMs < startsAt) return { state: "upcoming", label: "Upcoming", canEnter: false, canPlay: false };
  if (nowMs < entryClosesAt) return { state: "live", label: "Entry open", canEnter: true, canPlay: true };
  if (nowMs < endsAt) return { state: "entry-closed", label: "Entry closed", canEnter: false, canPlay: true };
  return { state: "ended", label: "Event ended", canEnter: false, canPlay: false };
}

function entryLabel(event, active) {
  if (active) return event.availability?.canPlay ? "Find event match" : "Event unavailable";
  if (event.availability?.state === "upcoming") return `Opens ${localDate(event.schedule?.startsAt, { year: undefined })}`;
  if (event.availability?.state === "entry-closed") return "Registration closed";
  if (event.availability?.state === "ended") return "Event ended";
  const amount = Number(event.entryCost?.amount || 0);
  return amount ? `Enter for ${amount} credits` : "Enter free";
}

export default function EventHub({
  serverUrl, socket, authToken, account, factions = [],
  onAccountUpdated, onError
}) {
  const [definitions, setDefinitions] = useState([]);
  const [selectedId, setSelectedId] = useState("open-gauntlet");
  const [pending, setPending] = useState(false);
  const [factionId, setFactionId] = useState("rumin");
  const [generalId, setGeneralId] = useState(null);
  const [status, setStatus] = useState({ inQueue: false, message: "", eventId: "" });
  const [clock, setClock] = useState(() => Date.now());
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  useEffect(() => {
    let active = true;
    fetch(`${serverUrl}/api/events`).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load events.");
      if (active) {
        const events = data.events || [];
        setDefinitions(events);
        const featured = events.find((entry) => entry.scale === "major" && entry.availability?.state !== "ended");
        if (featured) setSelectedId((current) => current === "open-gauntlet" ? featured.id : current);
      }
    }).catch((error) => { if (active) onErrorRef.current(error.message); });
    return () => { active = false; };
  }, [serverUrl]);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const onStatus = (nextStatus) => setStatus(nextStatus);
    socket.on("eventMatchmakingStatus", onStatus);
    return () => {
      socket.off("eventMatchmakingStatus", onStatus);
      socket.emit("leaveEventMatchmaking");
    };
  }, [socket]);
  async function updateRun(eventId, action) {
    if (!authToken || pending) return;
    setPending(true);
    try {
      const response = await fetch(`${serverUrl}/api/events/${encodeURIComponent(eventId)}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Could not ${action} the event.`);
      onAccountUpdated(data.account);
    } catch (error) {
      onError(error.message);
    } finally {
      setPending(false);
    }
  }
  function joinQueue(event) {
    if (!authToken) {
      setStatus({ inQueue: false, eventId: event.id, message: "Sign in to play events." });
      return;
    }
    socket.emit("joinEventMatchmaking", {
      authToken,
      eventId: event.id,
      factionId: event.format === "factions" ? factionId : null,
      generalId: event.format === "factions" ? generalId : null
    });
  }
  const visibleDefinitions = definitions.map((entry) => ({ ...entry, availability: liveAvailability(entry, clock) }));
  const event = visibleDefinitions.find((entry) => entry.id === selectedId) || visibleDefinitions[0];
  const run = event ? account?.events?.runs?.[event.id] : null;
  const active = run?.status === "active";
  const majors = visibleDefinitions.filter((entry) => entry.scale === "major");
  if (!event) return <section className="event-hub"><p>Events are unavailable right now.</p></section>;
  const canEnter = event.availability?.canEnter !== false;
  const canPlay = event.availability?.canPlay !== false;
  const entryAmount = Number(event.entryCost?.amount || 0);
  return <section className="event-hub">
    {majors.length > 0 && <section className="event-major-schedule" aria-labelledby="major-event-schedule-title">
      <div className="event-schedule-heading"><div><span className="event-eyebrow">Championship calendar</span><h2 id="major-event-schedule-title">Major Gauntlet weekends</h2></div><p>Free entry for the inaugural season · times shown locally</p></div>
      <div className="event-major-grid">{majors.map((major) => <button key={major.id} type="button" className={`event-major-card is-${major.availability?.state || "upcoming"}`} aria-pressed={major.id === event.id} onClick={() => setSelectedId(major.id)}>
        <span className="event-major-status">{major.availability?.label || "Scheduled"}</span>
        <strong>{major.name}</strong>
        <time dateTime={major.schedule.startsAt}>{scheduleSummary(major)}</time>
        <small>{major.maxWins} wins · {major.format === "basic" ? "Classic" : "Faction"}</small>
      </button>)}</div>
    </section>}
    <header>
      <div><span className="event-eyebrow">{event.scale === "major" ? "Featured major" : "Gauntlet Events"}</span><h2>{event.name}</h2><p>{event.description}</p>{event.schedule && <p className="event-selected-schedule"><strong>{event.availability?.label}</strong> · {scheduleSummary(event)}<br /><small>Registration closes {localDate(event.schedule.entryClosesAt)}.</small></p>}</div>
      <div className="event-entry-cost"><small>Entry</small><strong>{entryAmount === 0 ? "Free" : `${entryAmount} booster credits`}</strong></div>
    </header>
    <nav aria-label="Available events">
      {visibleDefinitions.map((entry) => <button key={entry.id} type="button" aria-pressed={entry.id === event.id} disabled={status.inQueue} onClick={() => setSelectedId(entry.id)}>{entry.name}<small>{entry.scale === "major" ? entry.availability?.label : entry.format === "basic" ? "Classic" : "Faction"}</small></button>)}
    </nav>
    <div className="event-layout">
      <div className="event-run-card">
        <h3>{active ? "Current run" : run ? "Last run" : "Start a run"}</h3>
        <div className="event-record"><strong>{run?.wins || 0}</strong><span>wins</span><strong>{run?.losses || 0}</strong><span>losses</span></div>
        <p>A run ends at {event.maxWins} wins or {event.maxLosses} losses. Draws do not change your record.</p>
        {active && event.format === "factions" && <FactionLoadoutPicker factions={factions} factionId={factionId} generalId={generalId} disabled={status.inQueue} onChange={(nextFactionId, nextGeneralId) => { setFactionId(nextFactionId); setGeneralId(nextGeneralId); }} />}
        {!account && <p className="event-notice">Sign in to enter and keep your prizes.</p>}
        {!active ? <button className="event-primary" type="button" disabled={!account || pending || !canEnter} onClick={() => updateRun(event.id, "join")}>{pending ? "Entering…" : entryLabel(event, false)}</button> : <>
          {!status.inQueue ? <button className="event-primary" type="button" disabled={pending || !canPlay} onClick={() => joinQueue(event)}>{entryLabel(event, true)}</button> : <button className="event-secondary" type="button" onClick={() => socket.emit("leaveEventMatchmaking")}>Leave queue</button>}
          <button className="event-link" type="button" disabled={status.inQueue || pending} onClick={() => updateRun(event.id, "resign")}>Resign run</button>
        </>}
        {status.message && status.eventId === event.id && <p className="event-status" role="status">{status.message}</p>}
      </div>
      <div className="event-rewards">
        <h3>Win rewards</h3>
        <ol>{event.rewardTiers.map((tier) => <Reward key={tier.wins} tier={tier} earned={(run?.claimedTiers || []).includes(tier.wins)} />)}</ol>
        <p>Booster credits can open any eligible gameplay booster. Card styles are cosmetic and appear in your collection.</p>
      </div>
    </div>
  </section>;
}
