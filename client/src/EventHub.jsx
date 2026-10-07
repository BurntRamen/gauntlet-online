import { useEffect, useRef, useState } from "react";
import FactionLoadoutPicker from "./FactionLoadoutPicker";
import "./EventHub.css";

function Reward({ tier, earned }) {
  const parts = [];
  if (tier.boosterCredits) parts.push(`${tier.boosterCredits} booster credit${tier.boosterCredits === 1 ? "" : "s"}`);
  if (tier.cardStyleId) parts.push("animated collector card style");
  return <li className={earned ? "is-earned" : ""}>
    <strong>{tier.wins} win{tier.wins === 1 ? "" : "s"}</strong>
    <span>{parts.join(" + ")}</span>
    <small>{earned ? "Earned" : "Upcoming"}</small>
  </li>;
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
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  useEffect(() => {
    let active = true;
    fetch(`${serverUrl}/api/events`).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load events.");
      if (active) setDefinitions(data.events || []);
    }).catch((error) => { if (active) onErrorRef.current(error.message); });
    return () => { active = false; };
  }, [serverUrl]);
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
  const event = definitions.find((entry) => entry.id === selectedId) || definitions[0];
  const run = event ? account?.events?.runs?.[event.id] : null;
  const active = run?.status === "active";
  if (!event) return <section className="event-hub"><p>Events are unavailable right now.</p></section>;
  const entryAmount = Number(event.entryCost?.amount || 0);
  return <section className="event-hub">
    <header>
      <div><span className="event-eyebrow">Gauntlet Events</span><h2>{event.name}</h2><p>{event.description}</p></div>
      <div className="event-entry-cost"><small>Entry</small><strong>{entryAmount === 0 ? "Free" : `${entryAmount} booster credits`}</strong></div>
    </header>
    <nav aria-label="Available events">
      {definitions.map((entry) => <button key={entry.id} type="button" aria-pressed={entry.id === event.id} disabled={status.inQueue} onClick={() => setSelectedId(entry.id)}>{entry.name}<small>{entry.format === "basic" ? "Classic" : "Faction"}</small></button>)}
    </nav>
    <div className="event-layout">
      <div className="event-run-card">
        <h3>{active ? "Current run" : run ? "Last run" : "Start a run"}</h3>
        <div className="event-record"><strong>{run?.wins || 0}</strong><span>wins</span><strong>{run?.losses || 0}</strong><span>losses</span></div>
        <p>A run ends at {event.maxWins} wins or {event.maxLosses} losses. Draws do not change your record.</p>
        {active && event.format === "factions" && <FactionLoadoutPicker factions={factions} factionId={factionId} generalId={generalId} disabled={status.inQueue} onChange={(nextFactionId, nextGeneralId) => { setFactionId(nextFactionId); setGeneralId(nextGeneralId); }} />}
        {!account && <p className="event-notice">Sign in to enter and keep your prizes.</p>}
        {!active ? <button className="event-primary" type="button" disabled={!account || pending} onClick={() => updateRun(event.id, "join")}>{pending ? "Entering…" : entryAmount ? `Enter for ${entryAmount} credits` : "Enter free"}</button> : <>
          {!status.inQueue ? <button className="event-primary" type="button" disabled={pending} onClick={() => joinQueue(event)}>Find event match</button> : <button className="event-secondary" type="button" onClick={() => socket.emit("leaveEventMatchmaking")}>Leave queue</button>}
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
