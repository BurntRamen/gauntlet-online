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

export default function ReleaseReview({ state, review, onInspect, onPublish, onDiscard, onRollback, onCompare, onValidate, onPreview, releaseName = "", onReleaseName, busy, unsaved }) {
  const readiness = review?.readiness;
  const groups = (review?.groups || []).filter(group => group.changes?.length);
  const changes = groups.flatMap(group => group.changes);
  const records = new Set(changes.map(change => `${change.domain}:${change.id}`)).size;
  const errors = state.validation?.errors || [], warnings = state.validation?.warnings || [];
  const affected = changes.find(change => change.mechanical && !change.domain.startsWith("para:")) || changes.find(change => !change.domain.startsWith("para:"));
  const steps = readiness && state.draft && [["Saved draft", readiness.saved], ["Validated", readiness.validated], ["Saved preview current", readiness.previewed], ...(readiness.engineTestRequired ? [["Accepted engine action recorded", readiness.engineTested]] : []), ["Ready for review", readiness.ready]];
  const blocked = busy || unsaved || !state.writable || !!state.pending;
  const activeVerified = !state.pending && state.publication?.deployment === "active-on-this-server" && state.publication?.activeReleaseId === state.activeReleaseId;
  const publicationStatus = state.pending ? `Publication: ${state.pending.phase?.replaceAll("-", " ")}` : state.draft ? readiness?.ready ? "Ready for review and publishing" : "Complete the remaining release checks" : activeVerified ? "Published release verified active on this server" : "Active status unavailable";
  return <section aria-label="Shared release review">
    <header className="design-header"><span className="admin-eyebrow">Publishing</span><h3>One release, across all workshops</h3><Help topic="workspaceReleaseReview1" /><Help topic="workspaceReleaseReview2" className="admin-note" />{steps && <ol className="design-readiness" aria-label="Release readiness">{steps.map(([label, complete]) => <li key={label} className={complete ? "is-complete" : ""}>{complete ? "✓" : "○"} {label}</li>)}</ol>}<p role="status">{publicationStatus}</p></header>
    {unsaved && <Help className="admin-alert" topic="ReleaseReview1" />}
    {!!review?.contributors?.length && <p className="admin-note">Included operators: {review.contributors.join(" · ")}. {review.unattributed > 0 ? `${review.unattributed} older changes have no recorded field author.` : "Field authors are recorded for this saved candidate."}</p>}
    <div className="admin-release-layout"><section className="admin-release-summary" aria-label="Release summary">
      <WorkshopSection title="Release summary" id="review-publish"><dl className="design-facts"><div><dt>Saved changes</dt><dd>{review ? changes.length : "Unavailable"}</dd></div><div><dt>Affected records</dt><dd>{review ? records : "Unavailable"}</dd></div></dl>
        {state.draft ? <><label className="admin-search">Release name<input value={releaseName} maxLength={100} disabled={busy || !!state.pending} onChange={event => onReleaseName?.(event.target.value)} placeholder="Describe this release" /></label><button className="admin-primary" disabled={blocked || !readiness?.ready || !releaseName.trim()} onClick={onPublish}>Publish release</button><p className="admin-note">Includes all {changes.length} saved changes across {records} records. Your next step reviews a confirmation of this shared scope.</p></> : <Help topic="workspaceReleaseReview3" className="admin-note" />}
        <details className="admin-json"><summary>Active release & source</summary><p>{state.publication?.message || "Publication service status is not available."}</p><code>{state.activeReleaseId || "Not recorded"}</code><p>Draft revision {state.revision ?? "not recorded"}</p></details>
      </WorkshopSection>
      {state.draft && readiness && !readiness.ready && <WorkshopSection title="Next steps" id="review-blockers"><div className="admin-release-blockers">
        {!state.writable && <Help topic="workspaceReleaseReview4" role="status" />}
        {!readiness.validated && <><Help topic="workspaceReleaseReview5" />{onValidate && <button disabled={blocked} onClick={onValidate}>Validate draft</button>}</>}
        {errors.map((issue, index) => <article key={index}><strong>{issue.message}</strong>{issue.domain && issue.id && onInspect && <button onClick={() => onInspect(issue.domain, issue.id, issue.field)}>Fix {issue.field || "record"}</button>}</article>)}
        {!readiness.previewed && <><Help topic="workspaceReleaseReview6" />{onPreview && <button disabled={blocked || !readiness.validated} onClick={onPreview}>Preview saved draft</button>}</>}
        {readiness.engineTestRequired && !readiness.engineTested && <><Help topic="workspaceReleaseReview7" />{affected && onInspect && <button onClick={() => onInspect(affected.domain, affected.id, affected.field)}>Open {affected.label || affected.id} for testing</button>}</>}
        {state.pending && <Help topic="workspaceReleaseReview8" />}
      </div></WorkshopSection>}
      {!!warnings.length && <details className="admin-json"><summary>{warnings.length} saved validation warnings</summary>{warnings.map((issue, index) => <p key={index}>{issue.message}{issue.domain && issue.id && onInspect && <button onClick={() => onInspect(issue.domain, issue.id, issue.field)}>Inspect warning</button>}</p>)}</details>}
    </section><div className="admin-release-changes">
      {!review ? <Help topic="workspaceReleaseReview9" role="status" /> : !groups.length ? <div className="admin-player-empty"><h4>No saved changes to review.</h4><Help topic="ReleaseReview2" /></div> : groups.map(group => <WorkshopSection title={`${group.label} · ${group.changes.length}`} id={`review-${group.id}`} key={group.id}>{group.changes.map((change, index) => <Change key={`${change.domain}:${change.id}:${change.path || change.field}:${index}`} change={change} onInspect={onInspect} library={state.assetLibrary} />)}</WorkshopSection>)}
      {readiness?.engineTestRequired && <Help className="admin-note" topic="ReleaseReview3" />}
    </div></div>
    {state.draft && onDiscard && <details className="admin-recovery"><summary>Discard shared draft</summary><Help topic="workspaceReleaseReview10" /><button className="admin-danger" disabled={blocked} onClick={onDiscard}>Discard shared draft</button></details>}
    {onCompare && <WorkshopSection title="Release history" id="review-history">{(state.releases || []).map(release => <article className="design-change" key={release.id}><h5>{release.label || release.id}{release.id === state.activeReleaseId ? " · Live" : ""}</h5><p className="admin-note">{release.createdAt ? new Date(release.createdAt).toLocaleString() : "Date not recorded"}</p><div className="admin-actions"><button disabled={busy} onClick={() => onCompare(release.id)}>Compare {release.label || "release"}</button>{onRollback && <button disabled={blocked || !!state.draft || !release.compatible || !!release.rollbackBlocked || release.id === state.activeReleaseId} onClick={() => onRollback(release)}>Restore {release.label || "release"}</button>}</div></article>)}</WorkshopSection>}
    {review?.comparison && <WorkshopSection title="Rollback comparison" id="review-comparison"><Help className="admin-note" topic="ReleaseReview4" />{(review.comparison.groups || []).map(group => <div key={group.id}><h5>{group.label}</h5>{group.changes.map((change, index) => <Change key={index} change={change} onInspect={onInspect} library={state.assetLibrary} comparison />)}</div>)}</WorkshopSection>}
  </section>;
}
