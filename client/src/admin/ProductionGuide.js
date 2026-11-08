import { useState } from "react";
import "./WorkshopPanels.css";
import ReleaseProgress from "./ReleaseProgress";
import useAdminData from "./useAdminData";
const supported = ["sets", "cards", "assets", "factions", "campaigns", "encounters", "decks", "offers"];
export function ProductionSteps({ steps, busy, writable = true, onInspect, onCreate }) {
  const links = targets => targets.map((target, index) => <button key={index} disabled={busy} onClick={() => onInspect(target)}>{target.label}</button>);
  return <ol className="admin-production-steps">{steps.map(step => <li key={step.name || step.label}><h4>{step.name || step.label}{step.state && <> <span className="admin-badge">{step.state.replaceAll("-", " ")}</span></>}</h4><p>{step.detail}</p><div className="admin-actions">{links(step.targets.slice(0, 5))}{step.create && <button disabled={busy || !writable} onClick={() => onCreate(step.create)}>{step.create.label || "Create " + (step.create.domain === "offers" ? "product" : step.create.domain.slice(0, -1))}</button>}</div>{step.targets.length > 5 && <details><summary>All {step.targets.length} definitions</summary><div className="admin-actions">{links(step.targets.slice(5))}</div></details>}</li>)}</ol>;
}
export default function ProductionGuide({ request, domain, id, source, hash, revision, busy, onInspect, onCreate, onReview, state, unsaved }) {
  const [attempt, retry] = useState(0);
  const enabled = supported.includes(domain) && !!id && !!hash;
  const { data, error } = useAdminData(request, `/api/admin/workshops/production?${new URLSearchParams({ domain, id, source, hash })}`, `${revision}:${attempt}`, enabled);
  if (!enabled) return null;
  if (error) return <p role="alert">Production guide unavailable: {error} <button onClick={() => retry(value => value + 1)}>Retry production guide</button></p>;
  if (!data || data.hash !== hash) return <p className="admin-note">Loading production steps…</p>;
  const go = target => onInspect(target.domain, target.id, target.section, target.field);
  return <details className="admin-production-guide"><summary><span>Production path · {data.root.label}</span><small>{data.savedState}{data.problems.length ? ` · ${data.problems.length} related validation issues` : ""}</small></summary>
    {state && <ReleaseProgress state={state} receipt={data} unsaved={unsaved} />}
    <div className="admin-production-intro"><p><strong>Player destination</strong> {data.destination}</p><p><strong>Access</strong> {data.access}</p><p><strong>Modes / channels</strong> {data.modes.join(" · ") || "No authored destination enabled"}</p></div>
    <ProductionSteps steps={data.steps} busy={busy} writable={state?.writable} onInspect={go} onCreate={onCreate} />
    {data.problems.length > 0 && <ul className="admin-alert">{data.problems.map((issue, i) => <li key={i}><button disabled={busy} onClick={() => go(issue)}>{issue.message}</button></li>)}</ul>}
    <footer><p>{data.boundary}</p><div className="admin-actions"><button disabled={busy} onClick={onReview}>Review shared release</button><a href={data.url} target="_blank" rel="noreferrer">Open live player destination ↗</a></div></footer>
  </details>;
}
