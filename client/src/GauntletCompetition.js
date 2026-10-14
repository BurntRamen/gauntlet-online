import { useState } from "react";

export default function Competition({ request, revision, useData, State, Json, label }) {
  const [updated, setUpdated] = useState(0), [error, setError] = useState("");
  const state = useData(request, "/api/admin/para", `${revision}-${updated}`);
  return <State state={state}>{(data) => !data.enabled ? <p>{data.reason}</p> : <>
    <p>Release: <code>{data.activeReleaseId}</code> · Free entry.</p>
    {error && <p role="alert">{error}</p>}
    {data.events.map((event) => <article key={event.id}><h4>{event.definition.name} · {event.status}</h4>
      <p>{event.definitionMismatch ? "Published definition differs; pinned rules retained." : "Published rules unchanged."}</p>
      <form className="admin-actions" onSubmit={async (e) => { e.preventDefault(); const form = e.currentTarget, fields = new FormData(form); try { await request("/api/admin/para/operation", { method: "POST", body: JSON.stringify({ eventId: event.id, action: fields.get("action"), reason: fields.get("reason") }) }); setError(""); setUpdated(updated + 1); } catch (failure) { setError(failure.message); } }}>
        <label>Operation<select name="action"><option value="pause">Pause</option><option value="resume">Resume</option><option value="cancel">Cancel permanently</option></select></label>
        <label>Reason<input name="reason" required maxLength={500} /></label><button disabled={event.status === "cancelled"}>Apply operation</button>
      </form><Json title="Pinned rules" value={event} />
    </article>)}
    {data.awards.map((award) => <article key={award.id}><h4>{award.accountId} · {award.amount} Prestige</h4><p>{award.eventId} · <code>{award.releaseId}</code></p>{award.evidence.map((e) => <p key={e.matchId}>Match <code>{e.matchId}</code> · SHA-256 {e.sha256}</p>)}<Json title="Award details" value={award} /></article>)}
    {["attempts", "standings", "matches", "receipts", "failures", "audit"].map((key) => <Json key={key} title={label(key)} value={data[key]} />)}
  </>}</State>;
}


