# Mechanics decisions and content activation

## Mechanics

Interpreter 1 retains its published meaning. New Studio mechanics may use interpreter 2; use **Copy with controller decisions** to convert an existing definition into an independent identity. Assign the new mechanic to the intended cards. Changing wording alone never changes execution.

Automatic abilities may offer an optional payment/target or require a free target choice. The triggering controller chooses before other commands proceed. Decline spends nothing. Effects retain their declared order; the queue is bounded at 64 and effects cannot recursively enqueue triggers. Turn-end choices finish before refill. Basic combat waits for block modifiers. Accepted commands capture choice, target, payment and effect evidence.

The server captures a deadline using the existing reconnect-grace duration (10 minutes by default). Reconnecting does not restart it. On expiry, optional choices decline without spending; mandatory free choices use the first stable legal target, or skip when no target remains. The lifecycle sweep submits the actual authoritative command. A disconnected choice never silently purchases a cost. Temporary Admin tests have no automatic deadline; the operator executes the offered choice.

Private queues contain captured definitions and context and are removed from player projections. Only the controller receives legal target/payment descriptors. Existing games keep their captured definitions, use counts and pending decisions through restart.

Free-for-All qualifies v2 automatic Servitor attack, block and combat-end effects: attack/block value, life, damage, draw, mill and mechanic counters. “You” means source controller; “opposing player” means the other participant in the declared combat. Other seats are unaffected. Queued choices, support windows, payment reductions, acceleration and movement are explicitly gated in this mode until their multiplayer command paths are qualified. Studio explains the exact incompatibility and room creation rejects unsupported decks before starting a match.

## Data-only releases

Set `GAUNTLET_DATA_RELEASES=true` only after deploying this backend and qualifying it against the private Supabase authoring store. It requires the existing GitHub credential and private store. No additional service is required.

The operator saves, validates, previews, tests mechanical changes, reviews the exact revision and publishes as usual. GitHub's named validation check and remaining checks must pass. Admin merges only the exact release-file change. It verifies the current main package and immutable assets, commits the runtime activation through the private store's revision guard, then swaps the server's complete content view.

New starts use the new release; existing games keep their captures. An interrupted response is recovered by loading the committed activation. A restart reads that same record before accepting traffic. Rollback uses the same checked process and changes content only; it never reverses balances, grants or player support transactions.

If main includes code changes beyond the release package, activation waits for code deployment. This switch does not remove Render's automatic deploy trigger; it removes the dependency on that restart for compatible content activation. Publishing reports the release actually served by this process. All launch flags remain independent.

Do not disable data-only activation after using it without first reconciling the packaged GitHub release with the active private record. Otherwise a rollback to an older code/package could serve different content. Export the private authoring state and reconcile the exact active release before changing providers.
