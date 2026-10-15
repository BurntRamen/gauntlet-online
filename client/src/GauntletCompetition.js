import { useState } from "react";

export default function Competition({ request, revision, useData, State, Json, label }) {
  const [updated, setUpdated] = useState(0), [error, setError] = useState("");
  const [source, setSource] = useState("Para"), [query, setQuery] = useState("");
  const state = useData(request, "/api/admin/para", `${revision}-${updated}`);
  const managed = useData(request, "/api/admin/competition", `${revision}-${updated}`);
  return <><nav className="admin-subnav" aria-label="Competition results">{["Para", "Ranked & Gauntlet"].map(name => <button key={name} aria-pressed={source === name} onClick={() => setSource(name)}>{name}</button>)}</nav>
    <label className="admin-search">Find player or event<input value={query} onChange={e => setQuery(e.target.value)} /></label>
    {source === "Ranked & Gauntlet" ? <State state={managed}>{data => <><p>{data.note}</p>{data.seasons.map(season => <details key={season.definition.seasonId} className="admin-player-card"><summary>{season.definition.displayName} · {season.definition.status}</summary>
      {season.standings.filter(row => `${row.name} ${row.accountId}`.toLowerCase().includes(query.toLowerCase())).map(row => <p key={row.accountId}>#{row.rank} · {row.name} · {row.points} points · {row.wins} wins / {row.losses} losses / {row.draws} draws</p>)}{!season.standings.length && <p>No settled results.</p>}</details>)}
      {data.events.filter(event => event.name.toLowerCase().includes(query.toLowerCase()) || data.runs.some(run => run.eventId === event.id && run.playerName.toLowerCase().includes(query.toLowerCase()))).map(event => <details key={event.id} className="admin-player-card"><summary>{event.name} · {event.availability.label}</summary>{data.runs.filter(run => run.eventId === event.id).map(run => <p key={run.id}>{run.playerName} · {run.status} · {run.wins} wins / {run.losses} losses · {run.claimedTiers.length} reward tiers settled</p>)}<Json title="Captured run terms and evidence" value={data.runs.filter(run => run.eventId === event.id)} /></details>)}</>}</State> : <State state={state}>{(data) => !data.enabled ? <p>{data.reason}</p> : <>
    <p>Release: <code>{data.activeReleaseId}</code> · Free entry.</p>
    {error && <p role="alert">{error}</p>}
    {data.events.filter(event => event.definition.name.toLowerCase().includes(query.toLowerCase())).map((event) => <article key={event.id}><h4>{event.definition.name} · {event.status}</h4>
      <p>{event.definitionMismatch ? "Published definition differs; pinned rules retained." : "Published rules unchanged."}</p>
      <form className="admin-actions" onSubmit={async (e) => { e.preventDefault(); const form = e.currentTarget, fields = new FormData(form); if (!window.confirm(`${fields.get("action")} ${event.definition.name}? This changes official entry and matchmaking immediately. Completed evidence is retained.`)) return; try { await request("/api/admin/para/operation", { method: "POST", body: JSON.stringify({ eventId: event.id, action: fields.get("action"), reason: fields.get("reason") }) }); setError(""); setUpdated(updated + 1); } catch (failure) { setError(failure.message); } }}>
        <label>Operation<select name="action"><option value="pause">Pause</option><option value="resume">Resume</option><option value="cancel">Cancel permanently</option></select></label>
        <label>Reason<input name="reason" required maxLength={500} /></label><button disabled={event.status === "cancelled"}>Apply operation</button>
      </form><Json title="Pinned rules" value={event} />
    </article>)}
    {data.awards.map((award) => <article key={award.id}><h4>{award.accountId} · {award.amount} Prestige</h4><p>{award.eventId} · <code>{award.releaseId}</code></p>{award.evidence.map((e) => <p key={e.matchId}>Match <code>{e.matchId}</code> · SHA-256 {e.sha256}</p>)}<Json title="Award details" value={award} /></article>)}
    {["attempts", "standings", "matches", "receipts", "failures", "audit"].map((key) => <Json key={key} title={label(key)} value={data[key]} />)}
  </>}</State>}</>;
}


