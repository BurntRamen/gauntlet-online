import { useEffect, useState } from "react";
import "./WorkshopPanels.css";
const supported = ["sets", "cards", "assets", "factions", "campaigns", "encounters", "decks", "offers"];
export default function ProductionGuide({ request, domain, id, source, hash, revision, busy, onInspect, onCreate, onReview }) {
  const [data, setData] = useState(null), [error, setError] = useState("");
  const identity = `${source}:${hash}:${revision}:${domain}:${id}`;
  useEffect(() => {
    let active = true; setData(null); setError("");
    if (supported.includes(domain) && id && hash) request(`/api/admin/workshops/production?${new URLSearchParams({ domain, id, source, hash })}`).then(result => { if (active && result?.hash === hash) setData({ ...result, identity }); }, error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [request, domain, id, source, hash, revision, identity]);
  if (!supported.includes(domain) || !id || !hash) return null;
  if (error) return <p role="status">Production guide unavailable: {error}</p>;
  if (!data || data.identity !== identity) return <p className="admin-note">Loading production steps…</p>;
  const go = target => onInspect(target.domain, target.id, target.section, target.field);
  return <details className="admin-production-guide"><summary><span>Production path · {data.root.label}</span><small>{data.savedState}{data.problems.length ? ` · ${data.problems.length} related validation issues` : ""}</small></summary>
    <div className="admin-production-intro"><p><strong>Player destination</strong> {data.destination}</p><p><strong>Access</strong> {data.access}</p><p><strong>Modes / channels</strong> {data.modes.join(" · ") || "No authored destination enabled"}</p></div>
    <ol className="admin-production-steps">{data.steps.map(step => <li key={step.label}><h4>{step.label} <span className="admin-badge">{step.state.replaceAll("-", " ")}</span></h4><p>{step.detail}</p><div className="admin-actions">{step.targets.slice(0, 5).map(target => <button key={target.id} disabled={busy} onClick={() => go(target)}>{target.label}</button>)}{step.create && <button disabled={busy} onClick={() => onCreate(step.create)}>Create {step.create.domain === "offers" ? "product" : step.create.domain.slice(0, -1)}</button>}</div>{step.targets.length > 5 && <details><summary>All {step.targets.length} definitions</summary><div className="admin-actions">{step.targets.slice(5).map(target => <button key={target.id} disabled={busy} onClick={() => go(target)}>{target.label}</button>)}</div></details>}</li>)}</ol>
    {data.problems.length > 0 && <ul className="admin-alert">{data.problems.map((issue, i) => <li key={i}><button disabled={busy} onClick={() => go(issue)}>{issue.message}</button></li>)}</ul>}
    <footer><p>{data.boundary}</p><div className="admin-actions"><button disabled={busy} onClick={onReview}>Review shared release</button><a href={data.url} target="_blank" rel="noreferrer">Open live player destination ↗</a></div></footer>
  </details>;
}
