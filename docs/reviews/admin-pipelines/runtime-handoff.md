# Admin entry and deployment handoff follow-up

Production verification of PR #107 exposed two independent problems on the existing Render Free service (512 MiB, 0.15 CPU):

- Opening Home also requested the legacy Operations overview, which reconstructs recent match histories. The observed overview response took 45.9 seconds and the queued Home response took 55.2 seconds. Home now leaves that request to the Operations view. Direct Operations entry, refresh, archive controls and fresh reads on re-entry remain available.
- During rolling deployment, the outgoing server saved an unchanged empty room snapshot after its replacement loaded the previous revision. The replacement's first backup then encountered a real compare-and-swap conflict and correctly blocked further runtime work. A recovery restart loaded the committed revision; the next backup succeeded and public storage metadata reported healthy, unblocked storage with zero rooms.

Room checkpoints now compare canonical room content to the last confirmed snapshot. An unchanged shutdown or backup returns the existing receipt without advancing its revision or timestamp. Initial empty-store creation, recovery metadata changes, actual game changes, stale-writer rejection, uncertain-response deduplication and failed-store blocking retain their existing behavior. No database migration, permission change or runtime flag change is needed. This avoids the observed no-op handoff conflict; it does not introduce multi-writer ownership or silently reconcile genuinely conflicting game changes.

Local verification before CI:

- Both new storage regressions failed before the fix, including the reproduced replacement-process backup failure.
- 17 runtime, process-replacement, operational persistence and PostgreSQL privacy tests passed after the fix.
- 17 client integration tests passed, including real Studio/Admin navigation, deferred history loading, direct entry and failure recovery.
- Production build and all existing bundle budgets passed: initial Admin 11.5/20 KiB; aggregate Admin 75.0/75 KiB; main 179.5/180 KiB; player JavaScript 754.5/759 KiB (rounded report values).

The branch disables Vercel preview deployment while verification is pending. Full CI must pass before merging or deploying. Live verification must include the first scheduled backup after deployment, continued healthy storage, Home entry without the history request, and Operations loading when selected. Existing bounded Node heap settings remain necessary on the Free instance. A recovered Home refresh without queued history still took 12.8 seconds; this hosting configuration does not yet provide consistently fast server responses.
