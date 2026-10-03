import { WorkshopSection } from "./WorkshopShell";

const text = (value) => value === null || value === undefined || value === "" ? "Empty" : Array.isArray(value) ? value.join(", ") || "None" : typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);

function Value({ value, library, label, resolvedAsset }) {
  const asset = resolvedAsset || library?.find((entry) => [entry.id, entry.source, entry.path].includes(value));
  return <div><small>{label}</small>{asset?.mediaType?.startsWith("image/") ? <img className="admin-art-preview" loading="lazy" src={asset.path} alt={`${label} artwork`} /> : asset?.mediaType?.startsWith("audio/") ? <audio controls preload="none" src={asset.path} aria-label={`${label} audio`} /> : null}<p>{text(value)}</p></div>;
}

function Change({ change, onInspect, library, comparison = false }) {
  return <article className="design-change"><div className="admin-title-row"><h5>{change.label || change.id} · {change.fieldLabel || change.field}</h5>{onInspect && <button type="button" onClick={() => onInspect(change.domain, change.id)}>Open {change.label || change.id}</button>}</div><div className="design-change-values"><Value label="Live" value={change.before ?? change.live} library={library} resolvedAsset={change.liveAsset} /><Value label={comparison ? "Selected release" : "Saved draft"} value={change.after ?? change.draft} library={library} resolvedAsset={change.draftAsset} /></div></article>;
}

export default function ReleaseReview({ state, review, onInspect, onPublish, onDiscard, onRollback, onCompare, releaseName = "", onReleaseName, busy, unsaved }) {
  const readiness = review?.readiness;
  const groups = review?.groups || [];
  const steps = readiness && [
    ["Saved", readiness.saved], ["Validated", readiness.validated], ["Previewed", readiness.previewed],
    ...(readiness.engineTestRequired ? [["Accepted engine action recorded", readiness.engineTested]] : []), ["Ready", readiness.ready]
  ];
  const blocked = busy || unsaved || !state.writable;
  return <section aria-label="Shared release review"><header className="design-header"><span className="admin-eyebrow">Publishing</span><h3>One release, across all workshops</h3><p className="admin-note">Review saved changes together before they reach future games.</p>{steps && <ol className="design-readiness" aria-label="Release readiness">{steps.map(([label, complete]) => <li key={label} className={complete ? "is-complete" : ""}>{complete ? "✓" : "○"} {label}</li>)}</ol>}{readiness && <p role="status">{state.pending ? `Publication: ${state.pending.phase?.replaceAll("-", " ")}` : readiness.ready ? "Ready for review and publishing" : "Complete the remaining release checks"}</p>}</header>
    {unsaved && <p className="admin-alert">Local edits are not included. Save them or discard them before publishing.</p>}
    {!review ? <p role="status">Release comparison is loading or unavailable. Refresh Admin to retry.</p> : !groups.some((group) => group.changes?.length) ? <p>No saved changes to review.</p> : groups.filter((group) => group.changes?.length).map((group) => <WorkshopSection title={`${group.label} · ${group.changes.length}`} id={`review-${group.id}`} key={group.id}>{group.changes.map((change, index) => <Change key={`${change.domain}:${change.id}:${change.path || change.field}:${index}`} change={change} onInspect={onInspect} library={state.assetLibrary} />)}</WorkshopSection>)}
    {readiness?.engineTestRequired && <p className="admin-note">An accepted engine action is a release check, not a guarantee of comprehensive balance testing.</p>}
    <WorkshopSection title="Publish saved draft" id="review-publish"><label className="admin-search">Release name<input value={releaseName} maxLength={100} disabled={blocked || !state.draft} onChange={(event) => onReleaseName?.(event.target.value)} placeholder="Describe this release" /></label><div className="admin-actions"><button disabled={blocked || !state.draft || !readiness?.ready || !releaseName.trim()} onClick={onPublish}>Publish release</button><button disabled={blocked || !state.draft} onClick={onDiscard}>Discard shared draft</button></div></WorkshopSection>
    {onCompare && <WorkshopSection title="Release history" id="review-history">{(state.releases || []).map((release) => <article className="design-change" key={release.id}><h5>{release.label || release.id}{release.id === state.activeReleaseId ? " · Live" : ""}</h5><p className="admin-note">{release.createdAt ? new Date(release.createdAt).toLocaleString() : "Date not recorded"}</p><div className="admin-actions"><button disabled={busy} onClick={() => onCompare(release.id)}>Compare {release.label || "release"}</button>{onRollback && <button disabled={blocked || !!state.draft || !release.compatible || release.id === state.activeReleaseId} onClick={() => onRollback(release)}>Restore {release.label || "release"}</button>}</div></article>)}</WorkshopSection>}
    {review?.comparison && <WorkshopSection title="Rollback comparison" id="review-comparison"><p className="admin-note">Review the saved release before restoring it. Historical releases are immutable.</p>{(review.comparison.groups || []).map((group) => <div key={group.id}><h5>{group.label}</h5>{group.changes.map((change, index) => <Change key={index} change={change} onInspect={onInspect} library={state.assetLibrary} comparison />)}</div>)}</WorkshopSection>}
  </section>;
}
