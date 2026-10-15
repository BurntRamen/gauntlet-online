# Gauntlet Admin operator workflow

This guide describes the local modular suite, not a claim that its code or optional services are enabled in production. See `modular-admin-suite.md` for the verified production baseline and acceptance evidence. Only the two configured, stable administrator account IDs can access Admin. Renaming an account never grants or removes that authorization.

## Start in Home

Review **Needs attention** first. Disabled services, unreadable data, pending publication and storage failures are distinct states. Published offer counts do not promise checkout availability. Recent activity uses a bounded account sample and last-seen timestamps, not online presence. Open the relevant area from each task. Refresh Admin after another operator publishes or performs an operation.

## Content

Select a workshop, search by name, then open an item. Cards, printings, sets, authored deck recipes and deck products support creation/duplication; permanent identities are generated. Existing factions, supported mechanics, encounters, campaign prose, art/audio references and page prose use their existing engine contracts. Create new engine handlers, faction identities or campaign objective types through engineering; a prose editor does not implement those mechanics.

Save individual fields to the shared draft. A changed rules description does not change executable behavior. Choose exact printing versions and legal deck slots; historical releases retain those references. Private deck notes and unselected uploaded art stay in private authoring storage. The actual card/deck/product preview uses the same player presentation. Playtest mechanical changes with a legal accepted engine action in the exact saved draft. Saving another mechanical change invalidates that receipt.

## Competition

**Para definitions** manages seasons, events, Prestige, eligibility and earned rewards. Start from the provisional Season Zero template or create a definition. Names are the ordinary references; technical identities are under Advanced. Configure dates in local time; each control also shows its authoritative UTC timestamp. Check the eligibility simulator and proposed calendar. Draft/preview never registers players or grants Prestige.

**Ranked & Gauntlet** creates future Ranked seasons or free Classic/Faction events. Use an existing event as a reusable template, then choose the supported format, win/loss limits, entry limit, registration window and reward tiers. Preview the saved player presentation and calendar. Published non-draft scoring, schedule, format and prize terms become fixed. Duplicate a definition to change them. Ranked seasons cannot overlap retained history. Original source competitions and their promises remain unchanged.

New legacy Gauntlet entry is closed after finite Gold cutover. Publishing a managed event does not bypass this gate. Existing runs finish their promised rewards before opening balances import. Official Para competition always remains free and equally powered; Gold never buys qualification or extra official attempts.

**Results** shows authoritative standings, participation, reward evidence and failures. Para pause/resume/cancel operations take effect immediately after confirmation and require a reason. Managed Ranked/Gauntlet status changes require publication. Pause stops new matchmaking; cancellation is permanent; completed results retain their evidence. Retiring a managed Gauntlet event closes entry while existing runs may finish inside the original window. In-flight match consequences use their captured rules.

## Store & Economy

In **Products**, create a deck recipe first, enable its player destination, then create an offer referencing it. Set explicit prices: blank disables that currency; zero is a free claim. Set a sale window and optional lifetime purchase limit. The limit includes refunded purchases. Select only supported printing/back/box references. Existing box styles are already free to all players; the product chooses one, rather than claiming to sell exclusive box access.

The saved store preview is the player product card. Publish to expose an available offer. Change a future price by saving and publishing new terms; old receipts keep their original price, content and release. A stale purchase request must be reviewed again. An uncertain network result must retry the same request ID. Retire an offer to prevent new purchases; existing receipts and access survive.

Gold deck purchases commit debit, receipt and grant in the finite ledger when enabled. Collection/deck fields are rebuilt from those grants. Timetwisters commit through the account store. Neither path charges the old account Gold balance after cutover. All instances sharing this deployment must obey the supported single-writer topology.

In **Gold & Rewards**, manage finite awards, season budgets, digital products and entitlement inclusions. Available digital delivery supports verified publications, audio/image library assets and personal match analysis. Generic image/audio entitlements do not equip in-game cosmetics; use deck products for implemented printing/back grants. Variant Lab, Gems, dual pricing and real-money payment activation remain unavailable. Existing premium and pack prices remain source-controlled until their payment/transaction contracts are qualified.

Economy operations provides balances, seasonal issuance, purchases, grants, failures and audit evidence. Choose a player/season for a signed Gold correction, or choose an original purchase for a refund. Record a specific reason and confirm. A credit consumes the pinned seasonal budget. A refund returns the original price and revokes only that purchase's grants; it never resets issuance or purchase limits. Independently owned copies remain. Saved recipe knowledge cannot be unlearned. Existing account-currency receipts remain visible; the finite-ledger refund control does not falsely promise refunds for unrelated legacy or Timetwister transactions.

## Players

Search all accounts by name or exact account identity. Open a profile to inspect results, campaign progress, collections, saved deck versions, purchases/access and support history. Currency history identifies the authoritative source. Technical data is separate from the ordinary profile.

Name corrections also change the sign-in name. Enter the new name and a reason; saving records before/after values, operator and timestamp atomically with the account change. Concurrent edits fail instead of overwriting newer results or purchases. Refresh and reconcile a conflict. The editor cannot change credentials, roles, arbitrary balances or gameplay evidence.

## Publishing

Every supported configuration module shares **Draft → Validate → Preview/Test → Review → Publish → Verify Active**. The two operators share one revision-guarded draft; unsaved browser values are private to that browser. A conflict means another save won: refresh, compare and deliberately reapply. Do not discard another operator's work without reviewing the shared changes.

Review field differences, validation findings and exact preview/test readiness. Local fixture publishing atomically activates its immutable release. The hosted GitHub adapter produces the existing checked release/deployment workflow. Pending checks or a saved commit are not active deployment. Verify the packaged active release and its actual player-facing consumers. Deployment does not provision missing runtime services.

Compatible rollback affects future use only. It cannot remove published identities, rewrite purchased terms, unretire pinned competitions or undo financial evidence. Restore a compatible release when offered; otherwise make a corrective forward release. Refunds and operational status changes use their own audited controls.

## Operations and recovery

Check account, canonical match, private authoring, runtime volume and backup health. Inspect canonical match evidence when a result or entitlement appears missing. A finalized match and its idempotent settlement receipts are authoritative; browser results or an arbitrary JSON object cannot settle rewards.

For a storage failure, stop further activation, preserve existing files and identify the failed source. Repair access/storage first. Supported restart recovery reloads checkpoints and retries pending settlement with original IDs. Never reset a ledger or manually edit balances to clear an error.

Follow `durable-storage-setup.md` for the supported backup/restore commands. SQLite backups must include committed WAL state through the supplied backup API. Restore to a new isolated directory, verify hashes and replay/reconnect behavior, then separately authorize activation. Account database and immutable object backups need coordinated coverage beyond the runtime archive. Never restore over active stores or deploy an older writer that can spend pre-cutover account Gold.

Production merging, deployment, infrastructure, database migrations, content publication and balance operations require separate explicit authorization under this assignment. Routine local testing requires none.
