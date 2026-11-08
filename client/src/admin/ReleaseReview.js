import { useHelp } from "./AuthoringHelp";
import ReleaseProgress, { releaseProgress } from "./ReleaseProgress";
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

export default function ReleaseReview({ state, review, onInspect, onPublish, onDiscard, onRollback, onCompare, onValidate, onPreview, releaseName = "", onReleaseName, busy, unsaved, error, onRetry }) {
  const helpCopy = useHelp();
  const readiness = review?.readiness;
  const groups = (review?.groups || []).filter(group => group.changes?.length);
  const changes = groups.flatMap(group => group.changes);
  const records = new Set(changes.map(change => `${change.domain}:${change.id}`)).size;
  const warnings = state.validation?.warnings || [];
  const affected = changes.find(change => change.mechanical && !change.domain.startsWith("para:")) || changes.find(change => !change.domain.startsWith("para:"));
  const progress = releaseProgress(state, review, unsaved);
  const blocked = busy || unsaved || !state.writable || !!state.pending;
  const reason = busy ? "An operation is in progress." : !progress.ready ? progress.reason : !releaseName.trim() ? "Name this release before publishing." : helpCopy.releaseConfirm;
  return <section aria-label="Shared release review">
    <header className="design-header"><span className="admin-eyebrow">Publishing</span><h3>One release, across all workshops</h3><p className="admin-note">{helpCopy.releaseIntro}</p><ReleaseProgress state={state} receipt={review} unsaved={unsaved} /></header>
    {unsaved && <Help className="admin-alert" topic="ReleaseReview1" />}
    {!!review?.contributors?.length && <p className="admin-note">Included operators: {review.contributors.join(" · ")}. {review.unattributed > 0 ? `${review.unattributed} older changes have no recorded field author.` : helpCopy.releaseAuthors}</p>}
    <div className="admin-release-layout"><section className="admin-release-summary" aria-label="Release summary">
      {state.draft && readiness && !readiness.ready && <WorkshopSection title="Next steps" id="review-blockers"><div className="admin-release-blockers">
        {!state.writable && <Help topic="workspaceReleaseReview4" role="status" />}
        <Validation validation={{ ...state.validation, warnings: [] }} guide={state.guide} onInspect={onInspect} />
        {!readiness.validated && <><Help topic="workspaceReleaseReview5" />{onValidate && <button disabled={blocked} onClick={onValidate}>Validate draft</button>}</>}
        {!readiness.previewed && <><Help topic="workspaceReleaseReview6" />{onPreview && <button disabled={blocked || !readiness.validated} onClick={onPreview}>Preview saved draft</button>}</>}
        {readiness.engineTestRequired && !readiness.engineTested && <><Help topic="workspaceReleaseReview7" />{affected && onInspect && <button onClick={() => onInspect(affected.domain, affected.id, affected.field)}>Open {affected.label || affected.id} for testing</button>}</>}
        {state.pending && <Help topic="workspaceReleaseReview8" />}
      </div></WorkshopSection>}
      <WorkshopSection title="Release summary" id="review-publish"><dl className="design-facts"><div><dt>Saved changes</dt><dd>{review ? changes.length : "Unavailable"}</dd></div><div><dt>Affected records</dt><dd>{review ? records : "Unavailable"}</dd></div></dl>
        {state.draft ? <><label className="admin-search">Release name<input value={releaseName} maxLength={100} disabled={busy || !!state.pending} onChange={event => onReleaseName?.(event.target.value)} placeholder="Describe this release" /></label><button className="admin-primary" aria-describedby="release-action-reason" disabled={busy || !progress.ready || !releaseName.trim()} onClick={onPublish}>Publish release</button><p id="release-action-reason" role="status">{reason}</p><p className="admin-note">Includes all {changes.length} saved changes across {records}{helpCopy.releaseNote1}</p></> : <Help topic="workspaceReleaseReview3" className="admin-note" />}
        <details className="admin-json"><summary>Active release & source</summary><p>{state.publication?.message || "Publication service status is not available."}</p><code>{state.activeReleaseId || "Not recorded"}</code><p>Draft revision {state.revision ?? "not recorded"}</p></details>
      </WorkshopSection>
      {!!warnings.length && <details className="admin-json"><summary>{warnings.length} saved validation warnings</summary>{warnings.map((issue, index) => <p key={index}>{issue.message}{issue.domain && issue.id && onInspect && <button onClick={() => onInspect(issue.domain, issue.id, issue.field)}>Inspect warning</button>}</p>)}</details>}
    </section><div className="admin-release-changes">
      {!review ? <div role={error ? "alert" : "status"}><p>{error ? `Release review unavailable: ${error}` : "Loading release comparison…"}</p>{error && <button onClick={onRetry}>Retry release review</button>}</div> : !groups.length ? <div className="admin-player-empty"><h4>No saved changes to review.</h4><p>{helpCopy.releaseEmpty}</p></div> : groups.map(group => <WorkshopSection title={`${group.label} · ${group.changes.length}`} id={`review-${group.id}`} key={group.id}>{group.changes.map((change, index) => <Change key={`${change.domain}:${change.id}:${change.path || change.field}:${index}`} change={change} onInspect={onInspect} library={state.assetLibrary} />)}</WorkshopSection>)}
      {readiness?.engineTestRequired && <Help className="admin-note" topic="ReleaseReview3" />}
    </div></div>
    {state.draft && onDiscard && <details className="admin-recovery"><summary>Discard shared draft</summary><Help topic="workspaceReleaseReview10" /><button className="admin-danger" disabled={blocked} onClick={onDiscard}>Discard shared draft</button></details>}
    {onCompare && <WorkshopSection title="Release history" id="review-history">{(state.releases || []).map(release => <article className="design-change" key={release.id}><h5>{release.label || release.id}{release.id === state.activeReleaseId ? " · Live" : ""}</h5><p className="admin-note">{release.createdAt ? new Date(release.createdAt).toLocaleString() : "Date not recorded"}</p><div className="admin-actions"><button disabled={busy} onClick={() => onCompare(release.id)}>Compare {release.label || "release"}</button>{onRollback && <button disabled={blocked || !!state.draft || !release.compatible || !!release.rollbackBlocked || release.id === state.activeReleaseId} onClick={() => onRollback(release)}>Restore {release.label || "release"}</button>}</div></article>)}</WorkshopSection>}
    {review?.comparison && <WorkshopSection title="Rollback comparison" id="review-comparison"><Help className="admin-note" topic="ReleaseReview4" />{(review.comparison.groups || []).map(group => <div key={group.id}><h5>{group.label}</h5>{group.changes.map((change, index) => <Change key={index} change={change} onInspect={onInspect} library={state.assetLibrary} comparison />)}</div>)}</WorkshopSection>}
  </section>;
}
