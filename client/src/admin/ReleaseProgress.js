// Presentation only. The publication service remains the authority for every action.
export function releaseProgress(state, receipt, unsaved = false) {
  const help = state.guide?.help || {};
  const current = !!receipt && receipt.revision === state.revision && receipt.hash === state.draft?.hash;
  const ready = current ? receipt.readiness : null;
  const pending = state.pending;
  const live = !state.draft && !pending && state.publication?.deployment === "active-on-this-server" && state.publication?.activeReleaseId === state.activeReleaseId;
  const [next, reason] = unsaved ? [null, help.releaseProgress1]
    : pending ? [null, `Publication ${pending.phase.replaceAll("-", " ")}. Check its recorded outcome before retrying.`]
    : !state.writable ? [null, help.releaseProgress2]
    : !state.draft ? [null, help.releaseProgressEmpty]
    : !current ? [null, help.releaseProgressChecking]
    : !ready.validated ? ["validate", help.releaseProgress3]
    : !ready.previewed ? ["preview", help.releaseProgressPreview]
    : ready.engineTestRequired && !ready.engineTested ? ["test", help.releaseProgress5]
    : !ready.ready ? [null, help.releaseProgressNoChanges] : ["publish", help.releaseProgressReview];
  return { ready: !!ready?.ready && !unsaved && !pending && state.writable,
    reason, current, next,
    deployment:live ? "Active on this server" : "Unverified" };
}
