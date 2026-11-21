import { useHelp } from "./AuthoringHelp";
import { releaseProgress } from "./ReleaseProgress";
import Validation from "./WorkshopValidation";
import Help from "./AuthoringHelp";
import { PrivateImage } from "./PrivateAsset";
import { WorkshopSection } from "./WorkshopShell";

const text = value => value === null || value === undefined || value === "" ? "Empty" : Array.isArray(value) ? value.join(", ") || "None" : typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
function Value({ value, library, label, resolvedAsset }) {
  const asset = resolvedAsset || library?.find(entry => [entry.id, entry.source, entry.path].includes(value));
  return <div><small>{label}</small>{asset?.mediaType?.startsWith("image/") ? <PrivateImage className="admin-art-preview" loading="lazy" src={asset.path} alt={`${label} artwork`} /> : asset?.mediaType?.startsWith("audio/") ? <audio controls preload="none" src={asset.path} aria-label={`${label} audio`} /> : null}<p>{text(value)}</p></div>;
}
function Change({ change, onInspect, library, comparison = false }) {
  return <article className="design-change"><div className="admin-title-row"><div><small>{change.fieldLabel || change.field}</small><h5>{change.label || change.id}</h5></div>{onInspect && <button type="button" onClick={() => onInspect(change.domain, change.id, change.field)}>Open {change.label || change.id}</button>}</div>{change.scope && <p className="admin-note">{change.scope}</p>}<div className="design-change-values"><Value label="Live" value={change.before ?? change.live} library={library} resolvedAsset={change.liveAsset} /><Value label={comparison ? "Selected release" : "Saved draft"} value={change.after ?? change.draft} library={library} resolvedAsset={change.draftAsset} /></div></article>;
}

export default function ReleaseReview({ state, review, onInspect, onPublish, onDiscard, onValidate, onPreview, releaseName = "", onReleaseName, busy, unsaved, error, onRetry }) {
  const helpCopy = useHelp();
  const readiness = review?.readiness;
  const groups = (review?.groups || []).filter(group => group.changes?.length);
  const changes = groups.flatMap(group => group.changes);
  const records = new Set(changes.map(change => `${change.domain}:${change.id}`)).size;
  const warnings = state.validation?.warnings || [];
  const affected = changes.find(change => change.mechanical && !change.domain.startsWith("para:")) || changes.find(change => !change.domain.startsWith("para:"));
  const progress = releaseProgress(state, review, unsaved);
  const blocked = busy || unsaved || !state.writable || !!state.pending;
  const reason = busy ? helpCopy.releaseBusy : !progress.ready ? progress.reason : !releaseName.trim() ? helpCopy.releaseNameHint : helpCopy.releaseConfirm;
  return <section aria-label="Shared release review">
    <header className="design-header"><span className="admin-eyebrow">Publishing</span><h3>Review saved changes</h3></header>
    {unsaved && <Help className="admin-alert" topic="ReleaseReview1" />}
    <div className="admin-release-layout"><section className="admin-release-summary" aria-label="Release summary">
      <p className="admin-journey" id="release-action-reason" role="status" aria-label="Release readiness"><span className="admin-journey-symbol" aria-hidden="true">{progress.ready ? "✓" : "◇"}</span><span>{state.draft ? reason : <>{progress.reason} · {progress.deployment}</>}</span></p>
      {state.draft && <div id="review-blockers" tabIndex={-1}><Validation validation={{...state.validation,warnings:[]}} guide={state.guide} onInspect={onInspect}/>{readiness?.engineTestRequired && !readiness.engineTested && affected && onInspect && <button className={progress.next==="test"?"admin-primary":""} onClick={()=>["cards","encounters","decks"].includes(affected.domain)?onInspect(affected.domain,affected.id,"test",null):onInspect(affected.domain,affected.id,affected.field)}>Open {affected.label || affected.id} for testing</button>}</div>}
      {state.draft && <div className="admin-actions admin-release-actions"><button className={progress.next==="validate"?"admin-primary":""} data-complete={progress.current && !!readiness?.validated} aria-describedby="release-action-reason" disabled={blocked} onClick={onValidate}>Validate draft</button><button className={progress.next==="preview"?"admin-primary":""} data-complete={progress.current && !!readiness?.previewed} aria-describedby="release-action-reason" disabled={blocked || !state.validation?.valid} onClick={onPreview}>Preview saved draft</button></div>}
      <WorkshopSection title="Release summary" id="review-publish"><dl className="design-facts"><div><dt>Saved changes</dt><dd>{review ? changes.length : "Unavailable"}</dd></div><div><dt>Affected records</dt><dd>{review ? records : "Unavailable"}</dd></div></dl>
        {!!review?.contributors?.length && <p className="admin-note">Included operators: {review.contributors.join(" · ")}. {review.unattributed > 0 ? review.unattributed + helpCopy.releaseOlderAuthors : helpCopy.releaseAuthors}</p>}
        {state.draft ? <><label className="admin-search">Release name<input data-next={progress.next==="publish" && !releaseName.trim()} value={releaseName} maxLength={100} disabled={busy || !!state.pending} onChange={event => onReleaseName?.(event.target.value)} placeholder="Describe this release" /></label><button className="admin-primary" aria-describedby="release-action-reason" disabled={busy || !progress.ready || !releaseName.trim()} onClick={onPublish}>Publish release</button><p className="admin-note">Includes all {changes.length} saved changes across {records}{helpCopy.releaseNote1}</p></> : <Help topic="workspaceReleaseReview3" className="admin-note" />}
        <details className="admin-json"><summary>Active release & source</summary><p>{state.publication?.message || helpCopy.releaseStatusUnavailable}</p><code>{state.activeReleaseId || "Not recorded"}</code><p>Draft revision {state.revision ?? "not recorded"}</p></details>
      </WorkshopSection>
      {!!warnings.length && <details className="admin-json"><summary>{warnings.length} saved validation warnings</summary>{warnings.map((issue, index) => <p key={index}>{issue.message}{issue.domain && issue.id && onInspect && <button onClick={() => onInspect(issue.domain, issue.id, issue.field)}>Inspect warning</button>}</p>)}</details>}
    </section><div className="admin-release-changes">
      {!review ? <div role={error ? "alert" : "status"}><p>{error ? `Release review unavailable: ${error}` : helpCopy.releaseLoading}</p>{error && <button onClick={onRetry}>Retry release review</button>}</div> : !groups.length ? <div className="admin-player-empty"><h4>No saved changes to review.</h4><p>{helpCopy.releaseEmpty}</p></div> : groups.map(group => <WorkshopSection title={`${group.label} · ${group.changes.length}`} id={`review-${group.id}`} key={group.id}>{group.changes.map((change, index) => <Change key={`${change.domain}:${change.id}:${change.path || change.field}:${index}`} change={change} onInspect={onInspect} library={state.assetLibrary} />)}</WorkshopSection>)}
      {readiness?.engineTestRequired && <Help className="admin-note" topic="ReleaseReview3" />}
    </div></div>
    {state.draft && onDiscard && <details className="admin-recovery"><summary>Discard shared draft</summary><Help topic="workspaceReleaseReview10" /><button className="admin-danger" disabled={blocked} onClick={onDiscard}>Discard shared draft</button></details>}
    {review?.comparison && <WorkshopSection title="Rollback comparison" id="review-comparison"><Help className="admin-note" topic="ReleaseReview4" />{(review.comparison.groups || []).map(group => <div key={group.id}><h5>{group.label}</h5>{group.changes.map((change, index) => <Change key={index} change={change} onInspect={onInspect} library={state.assetLibrary} comparison />)}</div>)}</WorkshopSection>}
  </section>;
}
