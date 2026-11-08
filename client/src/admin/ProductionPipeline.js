import { useState } from "react";
import { releaseProgress } from "./ReleaseProgress";
import useAdminData from "./useAdminData";
import { ProductionSteps } from "./ProductionGuide";

export default function ProductionPipeline({ request, state, task, onRoot, onClose, onInspect, onCreate, onReview, busy, unsaved }) {
  const help = state.guide.help;
  const [attempt, retry] = useState(0);
  const [expanded, setExpanded] = useState(!task.root);
  const { data, error } = useAdminData(request, `/api/admin/workshops/production?${new URLSearchParams({ pipeline: task.id, id: task.root || "", source: state.draft ? "draft" : "live", ...(state.draft ? { hash: state.draft.hash } : {}) })}`, `${state.revision}:${state.activeReleaseId}:${attempt}`);
  if (error) return <section className="admin-alert" role="alert"><p>{error}</p><button onClick={() => retry(value => value + 1)}>{help.pipeline1}</button><button onClick={() => onRoot(null)}>{help.pipeline2}</button><button onClick={onClose}>{help.pipeline3}</button></section>;
  if (!data) return <p role="status">{help.pipeline4}</p>;
  const progress = releaseProgress(state, data, unsaved);
  const close = () => setExpanded(false);
  const go = target => onInspect(target.domain, target.id, target.section, target.field, close);
  const create = input => onCreate(input, close);
  return <section className="admin-production-task" aria-label={help.pipeline5}>
    <header><div><span className="admin-eyebrow">{help.pipeline6}</span><h3>{data.definition.name}{data.root && <> · {data.root.label}</>}</h3></div><div className="admin-actions">{data.root && <button onClick={() => go(data.open)}>{help.pipeline7}{data.definition.noun}</button>}<button aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? help.pipeline8 : help.pipeline9}</button><button onClick={onClose}>{help.pipeline10}</button></div></header>
    {expanded && <div className="admin-task-plan"><p>{data.definition.outcome}</p><div className="admin-actions"><label>Working {data.definition.noun}<select disabled={busy} value={task.root || ""} onChange={event => onRoot(event.target.value || null)}><option value="">{help.pipeline11}{data.definition.noun}</option>{data.choices.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>{data.create ? <button disabled={busy || !state.writable || !!data.prerequisite} onClick={() => create(data.create)}>{data.create.label}</button> : <button disabled={busy} onClick={() => go(data.open)}>{help.pipeline12}</button>}</div>
      {data.prerequisite && <p>{data.prerequisite.detail} <button disabled={busy || !state.writable} onClick={() => create(data.prerequisite.create)}>{data.prerequisite.label}</button></p>}
      <ProductionSteps steps={data.steps} busy={busy} writable={state.writable} onInspect={go} onCreate={create} />
      <footer><strong>{help.pipeline13}</strong><p>{progress.reason}</p><button disabled={busy} onClick={onReview}>{help.pipeline14}</button><p className="admin-note">{data.releaseScope}</p></footer>
    </div>}
  </section>;
}
