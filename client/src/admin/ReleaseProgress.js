// Presentation only. The publication service remains the authority for every action.
export function releaseProgress(state, receipt, unsaved = false) {
  const help = state.guide?.help || {};
  const current = !!receipt && receipt.revision === state.revision && receipt.hash === state.draft?.hash;
  const ready = current ? receipt.readiness : null;
  const pending = state.pending;
  const live = !state.draft && !pending && state.publication?.deployment === "active-on-this-server" && state.publication?.activeReleaseId === state.activeReleaseId;
  const reason = unsaved ? help.releaseProgress1
    : pending ? `Publication ${pending.phase.replaceAll("-", " ")}. Check its recorded outcome before retrying.`
    : !state.writable ? help.releaseProgress2
    : !state.draft ? help.releaseProgressEmpty
    : !current ? help.releaseProgressChecking
    : !ready.validated ? help.releaseProgress3
    : !ready.previewed ? help.releaseProgressPreview
    : ready.engineTestRequired && !ready.engineTested ? help.releaseProgress5
    : !ready.ready ? help.releaseProgressNoChanges : help.releaseProgressReview;
  return { ready: !!ready?.ready && !unsaved && !pending && state.writable,
    reason, current,
    steps: [["Draft", unsaved ? "Unsaved" : state.draft ? "Saved" : "No draft"],
      ["Validate", ready?.validated ? "Passed" : state.draft ? "Required" : "—"],
      ["Preview / test", ready?.previewed && (!ready.engineTestRequired || ready.engineTested) ? "Current" : state.draft ? "Required" : "—"],
      ["Review", ready?.ready ? "Ready" : "Waiting"],
      ["Publish", pending ? pending.phase.replaceAll("-", " ") : "Separate action"],
      ["Deployment / live", pending ? "Unverified" : live ? "Active on this server" : "Unverified"]] };
}

export default function ReleaseProgress({ state, receipt, unsaved }) {
  const progress = releaseProgress(state, receipt, unsaved);
  return <div className="admin-release-progress">
    <ol aria-label="Release readiness">{progress.steps.map(([label, status]) => <li key={label}><strong>{label}</strong><span>{status}</span></li>)}</ol>
    <p className="admin-note">{state.draft ? `Shared candidate · revision ${state.revision} · ${(state.draft.hash || "").slice(0, 12)}` : "Published content"} · {progress.reason}</p>
  </div>;
}
