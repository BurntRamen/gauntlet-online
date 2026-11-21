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
    deployment:live ? "Active on this server" : "Unverified" };
}
