import { useState } from "react";

export default function Competition({ request, revision, useData, State, Json, label }) {
  const [updated, setUpdated] = useState(0), [error, setError] = useState("");
  const [source, setSource] = useState("Para"), [query, setQuery] = useState("");
  const state = useData(request, "/api/admin/para", `${revision}-${updated}`);
  const managed = useData(request, "/api/admin/competition", `${revision}-${updated}`);
  const name = id => managed.data?.players?.find(p => p.id === id)?.name || id;
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
    <h4>Standings</h4>{data.standings.map(season => <article key={season.seasonId}><h5>{season.entries[0]?.season.name || season.seasonId}</h5>{season.entries.filter(row => name(row.accountId).toLowerCase().includes(query.toLowerCase())).map((row, i) => <p key={row.accountId}>#{i + 1} · {name(row.accountId)} · {row.seasonPrestige} Prestige · Invitational {row.invitationalEligible ? "qualified" : "not yet qualified"} · Championship {row.championshipEligible ? "qualified" : "not yet qualified"}</p>)}</article>)}
    <h4>Participation</h4>{data.attempts.filter(a => name(a.accountId).toLowerCase().includes(query.toLowerCase())).map(a => <p key={a.id}>{name(a.accountId)} · {data.events.find(e => e.id === a.eventId)?.definition.name} · {a.status} · {a.wins} wins / {a.losses} losses</p>)}
    <h4>Settlement failures</h4>{!data.failures.length && <p>No pending Para settlement failures.</p>}{data.failures.map(f => <article key={f.id}><p>{f.message}</p><p>Inspect match {f.id} under Operations. Preserve the canonical record; restart recovery retries its original settlement after storage is repaired.</p></article>)}
    {data.awards.map((award) => <details key={award.id}><summary>{name(award.accountId)} · {award.amount} Prestige</summary><p>{data.events.find(e => e.id === award.eventId)?.definition.name}</p>{award.evidence.map(e => <p key={e.matchId}>Match <code>{e.matchId}</code></p>)}<Json title="Award details" value={award} /></details>)}
    {["matches", "receipts", "audit"].map((key) => <Json key={key} title={label(key)} value={data[key]} />)}
  </>}</State>}</>;
}


