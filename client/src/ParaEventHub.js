import { useEffect, useState } from "react";
import "./EventHub.css";

export default function EventHub({ serverUrl, authToken, socket, onOpenMatch }) {
  const [data, setData] = useState(null), [error, setError] = useState(""), [status, setStatus] = useState("");
  const [selected, setSelected] = useState(""), [accepted, setAccepted] = useState(false), [busy, setBusy] = useState(false);
  const [pool, setPool] = useState([]), [faction, setFaction] = useState(""), [cards, setCards] = useState([]);
  const event = data?.events?.find((e) => e.id === selected);
  const request = async (route = "", body) => {
    const response = await fetch(`${serverUrl}/api/para${route}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || result.reason); return result;
  };
  const refresh = async () => { try { setData(await request()); setError(""); } catch (e) { setError(e.message); } };
  useEffect(() => {
    let live = true;
    setData(null);
    if (authToken) fetch(`${serverUrl}/api/para`, { headers: { Authorization: `Bearer ${authToken}` } }).then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body.error); if (live) setData(body); }).catch((e) => { if (live) setError(e.message); });
    const update = (value) => { setStatus(value.message || ""); setError(value.error || ""); };
    socket.on("paraStatus", update);
    return () => { live = false; socket.off("paraStatus", update); };
  }, [authToken, serverUrl, socket]);
  async function act(route, input) { setBusy(true); try { await request(route, input); await refresh(); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  const run = event?.attempts?.find((a) => ["registered", "playing"].includes(a.status));
  return <section className="para-hub" aria-label="Para League Event Hub"><h3>Para League</h3>
    <p>Automatic free membership with your Gauntlet account. Prestige comes from official completed runs and is separate from ranked points. Gold and Gems do not affect qualification.</p>
    {!authToken ? <p>Sign in through Identity to enter.</p> : <button onClick={refresh}>Refresh Para League</button>}
    {error && <p role="alert">{error}</p>}{status && <p role="status">{status}</p>}
    {data && !data.enabled && <p>{data.reason}</p>}
    {data?.enabled && <>
      <p>Lifetime Prestige: {data.lifetimePrestige}</p>
      {data.seasons.map((s) => <article key={s.seasonId}><h4>{s.season.name}</h4><p>{s.season.startsAt} – {s.season.endsAt}</p><p>Qualifying Prestige: {s.qualifyingPrestige} / {s.season.invitationalThreshold} · best {s.season.countedResults} of {s.season.qualifyingEventCount}</p><p>Combined Prestige: {s.combinedPrestige} / {s.season.championshipThreshold} · Invitational {s.invitationalEligible ? "eligible" : "not yet eligible"} · Championship {s.championshipEligible ? "eligible" : "not yet eligible"}</p></article>)}
      <label>Official event<select value={selected} onChange={async (e) => { const id = e.target.value; setSelected(id); setError(""); setStatus(""); setAccepted(false); setCards([]); setPool([]); setFaction(""); if (id) try { setPool((await request("/pool", { eventId: id })).cards); } catch (failure) { setError(failure.message); } }}><option value="">Choose event</option>{data.events.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.operationalStatus}</option>)}</select></label>
      {!data.events.length && <p>No official events published.</p>}
      {event && <article><h4>{event.name}</h4><p>{event.description}</p><p>{event.format} · {event.winTarget} wins / {event.lossLimit} losses · {event.scoringAttempts} official attempt(s)</p><p>Play: {event.startsAt} – {event.endsAt}<br />Registration: {event.registrationOpensAt} – {event.registrationClosesAt}</p><p>{event.eligibility.reason}</p>
        <details><summary>Published rules and scoring</summary><p>Release: {event.releaseId}</p><p>Prestige by wins: {event.prestige.join(", ")}</p><p>Completed runs only. Draws replay without win/loss credit. Withdrawal after play keeps the attempt consumed. Disconnects forfeit after the reconnect grace period. Unrecoverable service failures leave the run score unchanged.</p></details>
        {!run && <><label><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />I accept these published rules and confirm my eligibility.</label><button disabled={busy || !accepted || !event.eligibility.eligible} onClick={() => act("/enroll", { eventId: event.id, acceptedRules: event.releaseId, eligibilityConfirmed: true })}>Enter free</button></>}
        {run && <><p>Official run: {run.wins} wins · {run.losses} losses · {run.draws} draws · {run.status}</p>
          {event.format !== "classic" && <fieldset><legend>Equal official card pool</legend><label>Faction<select value={faction} onChange={(e) => { setFaction(e.target.value); setCards([]); }}><option value="">Choose faction</option>{[...new Set(pool.map((c) => c.factionId))].map((id) => <option key={id}>{id}</option>)}</select></label>
            {cards.map((card, i) => <div key={i}><label>Card {i + 1}<select value={card.id} onChange={(e) => setCards(cards.map((c, n) => n === i ? { ...c, id: e.target.value } : c))}>{pool.filter((c) => c.factionId === faction).map((c) => <option key={c.id} value={c.id}>{c.name} · {c.value}</option>)}</select></label><label>Suit {i + 1}<select value={card.suit} onChange={(e) => setCards(cards.map((c, n) => n === i ? { ...c, suit: e.target.value } : c))}>{["hearts", "diamonds", "clubs", "spades"].map((s) => <option key={s}>{s}</option>)}</select></label><button onClick={() => setCards(cards.filter((_, n) => n !== i))}>Remove card {i + 1}</button></div>)}
            <button disabled={!faction || cards.length >= 26} onClick={() => setCards([...cards, { id: pool.find((c) => c.factionId === faction).id, suit: "hearts" }])}>Add card</button></fieldset>}
          <button disabled={busy || !!run.matchId || event.operationalStatus !== "open" || (event.format !== "classic" && !faction)} onClick={() => socket.emit("joinParaQueue", { authToken, attemptId: run.id, factionId: faction, cards })}>Find official opponent</button>
          <button onClick={() => socket.emit("leaveParaQueue")}>Leave official queue</button>
          <button disabled={busy || !!run.matchId} onClick={() => act("/withdraw", { attemptId: run.id })}>Withdraw run</button>
          {run.matchId && <p>Match in progress. Reconnect to your original seat.</p>}
        </>}
        {event.attempts.map((a) => <p key={a.id}>Attempt {a.number}: {a.status} · {a.wins}–{a.losses}</p>)}
      </article>}
      <h4>Historical accomplishments</h4>{data.awards.map((a) => <article key={a.id}><p>{a.eventId}: {a.amount} Prestige{a.perfect ? " · Perfect run" : ""}</p>{a.distinctions.map((d) => <p key={d.entitlementId}>{d.entitlementId} · earned eligibility; fulfillment unavailable</p>)}{a.evidence.map((e) => <button key={e.matchId} onClick={() => onOpenMatch(e.matchId)}>Match {e.matchId.slice(0, 8)}</button>)}</article>)}
    </>}
  </section>;
}
