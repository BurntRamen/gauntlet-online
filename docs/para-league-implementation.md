# Para League runtime and Economy Admin handoff

## Live integration status (2026-10-14)

Release work is in the isolated `codex/para-gold-live` worktree, integrated with
`63044341c5c75055f7ed02cb85cbb55ccba73633` from current main. The original dirty
checkout and its two Para patches remain preserved. Historical sections below
describe the earlier local implementation; their old counts and provider limitations
are not claims about this release.

The user authorized production deployment and importing existing Gold as opening
balances outside seasonal earning caps. No new season, award, storefront offer,
Gem checkout or paid infrastructure is activated by this code release.

Current-main integration retains the existing gameplay, voice assets, legacy events,
account/collector ownership and GitHub publishing adapter. Para definitions now use
that adapter's shared drafts, review, checks, merge and deployment lifecycle. Runtime
configuration stays on the exact packaged deployed release, including while a newer
release is pending. Admin release review includes each Para/Gold field and compares
rollback additions/removals. Competition retains pause/resume/cancel and pinned evidence.

Gold schema version 2 adds immutable opening balances separately from earned
transactions. The approved policy is `GAUNTLET_GOLD_MIGRATION=legacy-opening-v1`.
Account ID and creation time remain bound; each account imports once on first wallet
access. Its original economy snapshot and digest are retained, premium balances and
historical purchases stay in the account store, and the opening amount never consumes
a seasonal budget. Invalid amounts and arithmetic overflow fail without partial writes.
Version 1 ledgers upgrade in place; backups include opening balances and grants.

With the new ledger enabled, repeatable daily Gold, new legacy event runs, gameplay-pack
currency purchases and premium fulfillment routes retire. Already-active legacy runs
remain playable and retain their promised rewards. Login remains available; Gold &
Library waits until those runs finish or are resigned, then imports the resulting
balance once. Before enabling migration, quiesce all old server writers and take
coordinated account/ledger backups. This is not a cross-database atomic migration.
Never roll back to old writers after cutover without reconciling ledger changes.

Production still requires verified persistent private storage for
`GAUNTLET_ECONOMY_DATA_DIR` and `GAUNTLET_PARA_DATA_DIR`, a single ledger-owning service,
and qualified canonical match persistence and restore procedures. Unconfigured
runtime features fail closed and existing live economy behavior continues. The public
storage diagnostic reports feature enablement without paths or credentials. Deployment
of the interface alone does not prove durable operational wallets or official events.

Verification and deployment evidence for this integrated release will be recorded
at the end of this document.

Updated 2026-10-12. Branch: `codex/para-league-economy`; starting commit: `bc1b7e7`.

**Current handoff:** see [Operational Gold and usable entitlements](#operational-gold-and-usable-entitlements) below.
The competition sections preceding it retain the prior release evidence. Their statements
that all Gold/commerce features are unfinished, and their bundle breakdowns, describe that
earlier slice. The new opt-in Gold runtime supersedes those statements; the original
Season Zero seed, Gem checkout and production activation remain inactive.

## Outcome and scope

The local vertical path is implemented: Admin authors and previews an event, the existing
publication system activates an immutable release, authenticated players enter free and
play through the existing server/Babylon game, canonical match finalization settles a
durable Prestige receipt, qualification updates, and Admin can inspect the pinned rules
and source evidence. Production data, deployments, external publication and commerce
were not changed. The original dirty checkout remains intact and uncommitted.

The earlier 17.5 KiB Admin failure is resolved without changing any budget ceiling.
Para and Economy are separately lazy-loaded Admin modules; all `gauntlet-admin*` chunks
count toward the aggregate 16 KiB gate. Reused inspection components, shared server field
metadata and normal four-pass Terser compression reduce duplicate code. Source maps remain
as hidden map artifacts. Static board gradients moved unchanged into CSS custom properties.
No Admin bytes are reclassified as player code.

This is completion of the locally tested competition slice, not activation of the entire
EGGS economy or a claim of production/GitHub readiness.

`countedResults` governs score selection. `qualifyingEventCount` is the expected calendar
count displayed to players; definition validation warns when the authored qualifier count
differs. Operators must resolve that warning when preparing the six-event seed calendar.
Gold budget/award and product fields remain previews, as described below.

## Repository findings and authority

This checkout has no `events.js`, `economy.js`, `githubContentPublication.js`, or preexisting
Event Hub. It has no Gold/Gem/Timetwister wallet to migrate. Existing pack credits, collector
ownership, purchased presentation variants, accounts and ranked `server/seasons.js` remain
separate from Para. The Play menu now contains the Para Event Hub.

`server/contentPublication.js` remains the single configuration authority: one shared draft,
expected revision checks, exact saved-preview/playtest gates, immutable SHA-256 releases,
atomic local pointer activation and compatible rollback. The optional `paraLeague` extension
preserves old snapshot hashes. The runtime reads `publication.published()` and records
immutable execution evidence; its database is not another editable configuration source.

There is no GitHub review/deployment adapter in the repository. Admin explicitly reports
local immediate activation and the unavailable GitHub adapter. Setting
`GAUNTLET_CONTENT_PUBLICATION_PROVIDER` to anything other than `local` disables mutations
with an unsupported-provider error; it never reports an external deployment as successful.
No credentials were requested or used to invent an external publisher.

Scheduled events belonging to active seasons pin their release when first observed by the
runtime. Each event ID retains its exact event rules and content snapshot. Each season ID
retains its qualification rules from its first pinned event. Subsequent publication or
rollback cannot rewrite those terms or awards. Admin shows event-definition mismatches
against the currently active release; season mismatch flags and pinned versions are also
visible in Standings. To change an already pinned event, cancel it with a
reason and publish a new event ID. To change pinned qualification rules, use a new season
ID. This also applies to events pinned before their registration opens. Archiving or
rolling back a definition does not cancel an already pinned competition; use Competition
operations. New unpinned IDs receive the newly published rules.

## Working capabilities

| Surface | Implemented behavior |
| --- | --- |
| Admin seasons/events | Structured create, edit, duplicate, archive, UTC windows, formats, run shapes, attempt limits, per-win Prestige, digital eligibility, validation and exact publication review. |
| Para membership | Automatic and free for an authenticated existing account. No second account, purchase, balance debit or membership Prestige. |
| Registration | Authenticated account identity, acceptance of the pinned release and explicit eligibility confirmation; registration windows and qualification enforced on the server. |
| Official matches | Classic and faction-constructed human-versus-human pairing through existing room/game creation. Faction events use the complete legal published pool independently of collection ownership. Card IDs and slots are validated and card statistics reconstructed on the server. |
| Run protection | Durable 5/2, 7/3 and 12/3 runs, configured attempt limits, match reservations and one outstanding match per attempt. Queue switching clears the old queue. Official rematch and undo cannot bypass reservations. |
| Prestige | Canonical finalized matches only; immutable award and match receipts, transactional score/award settlement and retry/restart recovery. No client score or reward claims. |
| Qualification | Shared simulator/runtime scoring functions, best configured number of qualifying events, thresholds and perfect-run exceptions. Permanent lifetime Prestige remains separate from seasonal qualification and ranked points. |
| Player surfaces | Para Event Hub: rules, schedule, eligibility reasons, current run, equal card pool, results, source matches and distinction eligibility. Identity and public profiles: automatic membership, lifetime Prestige and completed-run count. |
| Admin Competition | Actual pinned events, attempts, receipts, awards, source match IDs and SHA-256 hashes, standings, blocked registrations, current settlement failures, audit history and definition mismatches. Authenticated pause/resume/cancel operations require a reason. |
| Economy configuration | Finite Gold award definitions/cap forecasts, unavailable product catalog, independent Gold/Gem prices, entitlement duration/provenance and saved marketplace preview. All fulfillment and commerce remain inactive. |

All administrative routes retain the existing two-account UUID gate. Ordinary account,
collection, currency and ranked consequences are skipped for official Para matches. Their
canonical match records and replay/archive paths remain available. Ordinary gameplay,
AI, campaign, draft and ranked paths continue to use their existing rules.

The inactive Season Zero seed is still an explicit Admin action, never a startup write:
six qualifiers, week-seven Invitational, week-eight Championship, empty dates, one scoring
attempt, best four of six, Invitational threshold 45 or a perfect qualifier, Championship
threshold 80 combined or a perfect Invitational. These are editable definitions, not
runtime literals. The seed Championship scoring table remains zero because its awards
were unspecified; operators must review it before scheduling. The proposed 4000 Gold cap
and eight marketplace examples remain configuration only.

## Results, ties and interruption policy

- A run scores only on reaching its published win target or loss limit. The award uses
  the table pinned to that event, including a legitimate zero-Prestige completion.
- A perfect run reaches the target with zero losses. If multiple attempts are explicitly
  authorized, qualification uses the best completed result per event, never their sum.
  Lifetime and seasonal earned totals retain every legitimate award.
- Qualifying score uses the best configured number of qualifier results. Combined score
  adds Invitational results; Championship results do not feed back into qualification.
- Standings sort by combined score, then configured perfect/wins or wins/perfect order,
  earliest time that score was reached, then stable account ID. Equal candidate attempts
  resolve deterministically by score, perfect result, wins, award time and attempt ID.
- A canonical draw increments draws/played, changes neither wins nor losses, and continues
  the same run. A played draw therefore makes that attempt consumed if later withdrawn.
- Refresh/reconnect/repeated registration returns the existing active run. A player cannot
  reset counters or obtain another scoring attempt by leaving a completed/played run.
- Leaving an unplayed run marks it void and does not consume the official attempt limit.
  Withdrawing after any played match keeps the attempt consumed and awards no incomplete
  run Prestige. A reserved live match must finish or be conceded before withdrawal.
- One disconnected player forfeits after the existing reconnect grace period (default
  ten minutes, configured with `ROOM_RECONNECT_GRACE_MS`) if the opponent is online.
  Both absent players follow the existing abandonment policy, with no Para score change.
  Reconnection during the grace period preserves the seat and attempt.
- Pause blocks registration and new matches; a match already underway may finish. Resume
  reopens play within the original dates. Cancellation is permanent and audited; unplayed
  attempts are void, played incomplete attempts remain consumed, and existing awards stay.
  A canonical result completed before cancellation can still settle on retry.
- A result completed at/after event end or cancellation is void for Para. At event end,
  unplayed attempts become void and played incomplete attempts close without Prestige.
- On service recovery, a finalized canonical result is settled idempotently. Recoverable
  rooms retain their match reservation. If neither finalized evidence nor a recoverable
  room exists, the reservation is service-voided without changing the run's counters;
  its match ID can never later award. A new match can continue that same run.
- Settlement failures remain visible under Competition and retry during the normal room
  lifecycle sweep (approximately every 30 seconds). Restore the store/canonical evidence
  before retrying; do not edit awards. Successful retry clears the active failure record.

Every award contains account/season/event/attempt IDs, pinned release ID and scoring hash,
amount, win/loss result, award timestamp, idempotency key and all applied match IDs plus
canonical record hashes. Match receipts, awards and audit rows prohibit UPDATE/DELETE at
the SQLite layer. There is no correction endpoint: compensating adjustments require a
future authenticated/audited implementation; silent administrative overwrites are absent.

Digital reward thresholds create permanent evidence of earned eligibility. They do not yet
fulfill, equip or sell the referenced entitlement. UI labels explicitly say fulfillment is
unavailable. Gold/Gems cannot be awarded by an official event, buy Prestige, change access
to the legal pool or affect qualification.

## Storage, migration and compatibility

`server/migrations/para/001_runtime.sql` is a new private SQLite migration, not a Supabase
migration. With `GAUNTLET_PARA_DATA_DIR` configured, startup creates `para.sqlite` and
applies version 1 transactionally when empty. Tables: seasons, events, attempts, reserved
matches, match receipts, Prestige awards, operator audit and current settlement failures.
WAL, FULL synchronous writes, a busy timeout, foreign keys, uniqueness constraints and
`BEGIN IMMEDIATE` transactions protect local settlement. Future unknown schema versions
fail closed. No existing account, match, content or entitlement data is migrated.

Use Node 22.13+ or the tested Node 24.16 runtime for unflagged `node:sqlite`. The module is
loaded only when Para storage is enabled. Without that directory the ordinary server and
Admin configuration work, and official entry reports the missing configuration. An invalid
configured database fails startup rather than silently opening an empty fallback store.

For a local/staging operator installation:

1. Use a single authoritative game-server instance with a private persistent local volume.
2. Set `GAUNTLET_CONTENT_DATA_DIR` to the existing persistent publication directory and
   `GAUNTLET_PARA_DATA_DIR` to a separate private persistent directory. Keep
   `GAUNTLET_CONTENT_PUBLICATION_PROVIDER=local` until a real external adapter exists.
3. Keep existing account, canonical match/archive and room recovery stores persistent.
   Do not point these variables at the browser-test fixtures or production from a test.
4. Preserve the Para database together with its canonical records and release evidence.
   Back up using a SQLite-aware backup, or stop writers and checkpoint before copying.
   Copying only the main database during active WAL writes is not a valid backup.
5. Start the existing server. Verify Admin capability status, database version and content
   provider before scheduling. No startup action activates the inactive seed.

SQLite supports this single-server durable deployment; horizontal/multi-region queues,
shared network filesystems and production-scale query/load qualification are not provided.
Inspection currently scans finite operational tables; pagination/indexed projections are
future work. Do not deploy on ephemeral storage. A future PostgreSQL migration must preserve
IDs, original evidence hashes and idempotency keys and pass the same recovery tests.

Older content snapshots remain byte-compatible. An older pre-Para binary must first restore
a pre-Para release and discard a Para draft; it cannot service this operational database.
Do not delete the database to roll back a season. No production migration was executed.

## Admin operator walkthrough

1. Sign in as either authorized Admin account. Open **Para League & Economy**. The banner
   distinguishes local publication, enabled/disabled official runtime and inactive commerce.
2. Create the inactive Season Zero draft, or create a season. Review UTC start/end, formats,
   public rules version, counted qualifying results, both thresholds and perfect exceptions.
3. Create an event with a new stable ID. Choose its season, week/type, Classic or faction
   format, 5/2, 7/3 or 12/3 shape, attempts, Prestige table and earned-only reward references.
   Set complete registration/play windows. Active seasons and scheduled events require
   valid dates. Keep future products unavailable.
4. Save to the shared draft. Simulate completed earlier results under Prestige. The simulator
   calls the same scoring functions as settlement and makes no awards/account changes.
5. Validate, preview the exact saved draft, inspect all differences in **Publishing**, name
   the release and confirm using the existing publication UI. Changes after preview require
   another preview; existing engine-contract changes still require their engine playtest.
6. In **Competition**, verify the actual release and pinned event definition. Its initial
   observation pins the event and season rules. For later changes, follow the new-ID rule
   above. Local publication success means this server, not a GitHub deployment.
7. Players sign in, open Play → Para League (or the Identity link), select an event, accept
   the displayed rules, confirm eligibility and choose **Enter free**. Faction players select
   from the equal pool. **Find official opponent** matches another authenticated entrant.
8. After completion, refresh the hub/profile for Prestige, qualification and source matches.
   Admin can inspect the award receipt, pinned version and match hashes. Attempts, standings,
   failures and audit are expandable read-only evidence; ordinary configuration uses forms.
9. To pause/resume/cancel, choose the event operation, enter a reason and apply. Cancellation
   is permanent; publish a new ID for a replacement. It never deletes existing awards.
10. Existing rollback retains release history and compatibility checks. It affects future
    ordinary games and unpinned IDs, not pinned Para terms. Use operational controls to stop
    an existing event. Missing infrastructure is an explicit error, never simulated success.

## Verification and evidence

| Check | Result |
| --- | --- |
| `npm run check` | Passed: server syntax, qualification tests, complete server/client suites, production build and unchanged bundle gates. |
| Server suite | 204 passed; rerun after the final campaign-only faction guard. Includes contract/content/publication and recovery tests. |
| Client suite | 507 passed in 58 suites. |
| Qualification scripts | 33 passed. |
| Admin + Para browsers | 6 passed in 2.2 minutes; both Admin identities, denied visitor/guest, draft/preview/playtest/publication/rollback, mobile axe, official runtime and profile journey. |
| Existing gameplay browsers | 11 passed in 4.4 minutes; Basic, faction, AI, campaign progression, ranked BO3 and draft league. |
| SQL migration/recovery | Isolated SQLite version 1, restart/reopen, separate process settlement, duplicate and immutable-receipt checks passed. |
| Task patches | Combined and continuation-only patches reverse-application checked against the working files. |

Production gzip measurement (Node v24.16.0, level 9, after shader pruning):

| JavaScript budget | Bytes | KiB | Limit (bytes) |
| --- | ---: | ---: | ---: |
| Main | 177,236 | 173.082 | 179,200 |
| Largest async | 311,579 | 304.276 | 358,400 |
| All player | 720,586 | 703.697 | 720,896 |
| All Admin chunks | 16,367 | 15.983 | 16,384 |

The 3 counted Admin chunks are `gauntlet-admin-economy`: 581 bytes; `gauntlet-admin-para`: 4,015 bytes; `gauntlet-admin`: 11,771 bytes. Admin has 17 bytes
of remaining headroom; the player total has 310 bytes. All original ceilings remain unchanged.
The independently rebuilt loopback browser bundle also passed the same budget gate.
The final server guard changes no client bytes and was qualified by the full server rerun.

Logs: `artifacts/para-continuation-check.log`, `artifacts/para-continuation-server.log`,
`artifacts/para-continuation-browser.log`, `artifacts/para-gameplay-browser.log`, and
`artifacts/para-continuation-bundle.json`.

The Admin browser journey creates a new season and Classic event through labeled controls,
validates/previews/publishes it, enters two authenticated player accounts for free, completes two
real Babylon matches through server concessions, obtains one 12-Prestige award from the
published zero-win table, qualifies at the published 12 threshold, rejects re-entry, changes
the published table to 99 and proves the original receipt unchanged. Admin sees the exact
original rule version and both match hashes. The player's Identity shows the same Prestige.
Mobile checks run at 390 pixels with no horizontal overflow and no axe violations in the hub.

Additional integration tests cover the real faction engine, equal access without collection
ownership, forged cards/duplicate slots, campaign-only faction rejection, undo rejection, disconnect forfeits and unchanged
account-file bytes. SQLite tests cover duplicate evidence, write protection, reopened files,
a separate child-process recovery, service-voids, late results, pause/cancel/withdraw,
configured ties and simulator/runtime equivalence. Existing account, ownership, draft,
campaign, ranked, public historical match and content publication tests remain in the suite.

Screenshots (visually inspected):

- `artifacts/para-runtime-player-mobile.png`: published entry, awarded Prestige,
  qualification and historical source matches in the 390-pixel player surface.
- `artifacts/para-runtime-admin-evidence.png`: active versus pinned configuration,
  event operations, original award release and canonical match hashes.
- `artifacts/para-simulation-desktop.png`: saved-rule non-mutating eligibility simulation.
- `artifacts/para-marketplace-mobile.png`: structured inactive product/entitlement preview.

## Remaining boundaries and next implementation phase

There are no remaining known blockers to the tested single-server local competition path.
Production release still needs infrastructure qualification, database backup/restore drills
against its target volume, and a genuine GitHub review/deployment adapter if that publication
mode is required. That adapter must track pending/review/merged/deploying/active/failed states
and verify the deployed release hash before claiming activation. The local publisher must
not be relabeled as GitHub-backed.

Gold awards, operational Economy dashboards, wallets, spend/refund/correction endpoints,
marketplace fulfillment, payment processing, fraud adjudication and transferable currency
are not implemented. Human eligibility is an authenticated account plus explicit attestation;
there is no new age/jurisdiction/unique-person verification or collusion adjudication system.
No platform asset ownership or payment entitlement is inferred from a Para result.

The next economy phase should proceed in this order:

1. **Durable finance/entitlement contract.** Inventory existing credits/ownership and any
   newly introduced wallet source. Design append-only per-currency entries, unique evidence
   receipts, transaction boundaries, finite season budgets, SKU terms, ownership grants,
   expiration and audit-only compensating entries. Retain the existing two-account gate.
   Import only with explicit legacy mapping; never reinterpret collector purchases or ranked
   history. Qualify concurrent/replayed transactions and backup recovery in an isolated DB.
2. **Verified finite Gold milestones.** Consume server-authoritative welcome/training,
   campaign, learning and ordinary-play evidence. Pin the published award definition and
   occurrence threshold; atomically enforce per-award claim counts and the account-season
   cap. Record earned/claimed/remaining totals and rejection reasons. Exclude official Para
   currency awards by invariant. Prove retries and concurrent finalizations cannot overissue.
3. **Entitlement fulfillment.** Resolve each catalog reference to existing, rights-verified
   content. Fulfill earned Para eligibility idempotently using its immutable award ID.
   Persist provenance and permanent/day/season terms; establish visible pending/fulfilled/
   failed states and an audited retry path. Test asset availability, expiry, historical
   permanence and gameplay parity before marking any entitlement available.
4. **Gold storefront and operations.** Quote from the exact active SKU/version and price,
   atomically debit one wallet and grant all included entitlements, enforce purchase limits,
   and persist an immutable receipt. Add player history and Admin transaction/budget/failure
   inspection. Refund/reissue must append compensating entries with actor/reason and enforce
   ownership policy. Test insufficient funds, simultaneous purchases and crash-after-debit.
5. **Gem commerce, separately authorized.** Choose an actual payment provider and verified
   webhook contract; authenticate signatures, uniquely receipt provider events and grant
   Gems only after confirmed payment. Handle pending, duplicate, out-of-order, refunded and
   disputed events with compensating entries. Pin tax/price/product terms and qualify sandbox
   fulfillment. Never grant currency from a client callback. Keep purchases and production
   credentials disabled until that separate phase is tested and explicitly released.
6. **Release qualification.** Run the full current regression/browser/budget gates, payment
   sandbox and database concurrency/recovery tests, verify no ownership/balance migration,
   review operator procedures and perform the actual deployment activation verification.

The task is left uncommitted because its existing Admin foundation and other substantial
work were already dirty/untracked. `artifacts/para-implementation-only.patch` contains the combined 36-path change against the
original working files; `artifacts/para-continuation-only.patch` contains this continuation
against the first-slice files. Both exclude the unrelated existing work and were reverse-
application checked. They require the preexisting Admin foundation, not bare HEAD. Review
the patches and source together; do not stage all files or create a dependency-incomplete PR.

## Operational Gold and usable entitlements

This continuation implements the full local path: an operator creates dated Gold awards,
an entitlement backed by a real provider, and a priced product using Admin's existing
typed forms. The operator validates, previews and publishes through the **local** content
publisher. An authenticated player claims finite Gold from canonical evidence, reviews
a quote, purchases, and opens the delivered content from Identity → **Gold & Library**.
The database retains transactions, purchases and access through restart and offer retirement.
Admin's Economy workspace provides searchable tables and compensating refund/correction
operations. No application source edit is needed to create products or change future prices.

No suitable bundled first-party publication was found. The first useful noncosmetic provider
is `service:match-analysis-v1`: private faction, month and mode comparisons with counts,
wins/losses/draws, win rate, mean turns, damage dealt and the source match list. It computes
from the account's latest 100 canonical records, requires finalized owned evidence, and
excludes draws/abandonment from the win-rate denominator. Basic history, replay, rules,
qualification and all competitive information remain free in their existing surfaces.

### State of each capability

| Status | Scope |
| --- | --- |
| Operational locally | Opt-in SQLite Gold ledger; finite published awards; Gold/free offers; atomic local grants; analysis, existing manifest music/image delivery; dated and permanent grants; Admin inspection/refunds/corrections; local publication and the existing Para runtime. |
| Configuration-only | The editable inactive 4,000-Gold Season Zero proposal; unscheduled seed calendar; old unavailable SKUs; earned-only Para digital reward eligibility (automatic reward fulfillment is a separate follow-up). |
| Unavailable | Missing publication assets, Variant Lab and other unimplemented services; Gem/dual-currency activation; Gem wallet, payment checkout, transfers, conversion, cash-out; GitHub review/deployment publication. |
| Production-ready | No production readiness claim for this new ledger. The single-host implementation and isolated acceptance path are verified; target hosting/storage, restore objectives, identity lifecycle and capacity still require qualification. |
| Authorized, pending production integration | The user subsequently requested deployment to Gauntlet Online and explicitly selected importing existing live Gold as opening balances outside seasonal caps. Production integration and migration qualification are pending. |
| Requires additional authorization | Activation of unreviewed seasons, offers or awards; unrelated historical corrections/account mapping; real-money/Gem payment activation; new paid infrastructure. |

### Durable records and transaction boundaries

`server/goldEconomy.js` creates `economy.sqlite` only when `GAUNTLET_ECONOMY_DATA_DIR`
is explicitly configured. Empty configuration exposes a truthful unavailable state and
rejects mutations. `server/migrations/economy/001_gold.sql` creates version 1 on a new DB;
newer schemas fail closed. This is a new store, not a migration of pack credits, collector
variants, purchased card presentation, ranked history or Para. Node 24.16.0 was used for
verification. The deployment must provide a compatible built-in `node:sqlite` runtime.

Records include immutable account bindings, pinned season budgets and award definitions,
observed product/release versions, evidence with SHA-256 source hashes, Gold transactions,
claims and consumed evidence, quotes, purchases, grants, refunds, revocations, idempotent
requests and operator audit. Balances are the sum of signed ledger entries, not a second
mutable wallet cache. SQL triggers prohibit updates/deletes to authoritative tables.
Refunds and corrections append compensation records. Each purchase stores the exact
product, price, entitlement terms, rights reference, provider/content hash and release.

WAL, `synchronous=FULL`, foreign keys, a busy timeout and `BEGIN IMMEDIATE` serialize
writes. Claim ordinal/evidence uniqueness, one purchase per quote, one refund per purchase,
and account-scoped request keys protect replay and concurrent processes. Reusing a key
with changed inputs fails. A successful retry returns the original receipt. Quote lifetime
is 15 minutes; purchase also checks the offer window and exact current release. Insufficient
funds, stale quotes, duplicate quotes, unimplemented/forbidden inclusions, expired seasonal
content and lifetime SKU purchase limits all fail without a debit. Debit, receipt, grants,
audit and request result commit together; there is no external fulfillment worker or
partially committed delivery. **Pending = 0** is factual for this local provider set.

Account authority remains the existing account adapter (private local JSON or Supabase).
The ledger never writes that store. Every player request resolves a current account;
Admin uses the unchanged two-account middleware, then resolves full creation metadata.
Bindings use stable account ID and creation timestamp (or explicit null for legacy records).
A changed timestamp fails closed. IDs must never be recycled; absent legacy timestamps
cannot independently prove account generation. Deleted accounts cannot authenticate into
old grants; orphaned ledger evidence is retained. There is **no cross-database transaction**
between accounts, content, match archive, Para and Gold. Account deletion/migration must
be coordinated with the ledger; auth checks are request-time reads, not a database lock on
the account service. Production identity reassignment needs an explicit reviewed mapping.

Canonical match completion persists first. The independent Gold finalization hook copies
evidence without changing Para settlement or account consequences. A Gold failure does
not un-finalize a canonical match. Player refresh/claim recovers the latest 100 owned
records; the library also accepts an older exact match ID for server-side reconciliation.
It never accepts client-supplied results or amounts. This bounded backfill is not an
unlimited historical scan; missing canonical records cannot be reconstructed from claims.

### Finite awards and ownership policies

- Awards must be explicitly active, dated inside an unarchived dated season, positive,
  and published. A Gold season can stay draft so it does not activate a Para calendar.
  The original 4,000-Gold seed remains draft and editable.
- Welcome is one authenticated-account occurrence and one initial claim **across award
  IDs and seasons**. Basic/faction training requires a canonical win against AI; campaign
  milestones require an AI win and distinct faction/chapter pairs. Ordinary play requires
  two distinct authenticated human accounts. Draft learning requires a distinct-human duel
  or an AI draft win. Guests, self-play, abandoned/pending records and all official Para
  records do not produce qualifying evidence.
- Non-welcome evidence must fall within the pinned award window. Each claim consumes its
  exact occurrence count for that award. An occurrence can support separate authored
  milestones (as intended by the six progressively larger seed stamps), but never another
  claim of the same award. Per-award limits and the account-season cap apply atomically;
  awards are never partially paid.
- Award terms and season cap pin on first runtime observation of active configuration.
  Re-publishing the same ID cannot reset a limit or raise its pinned cap. The player sees
  the pinned release and an indication of changed current terms. Archive/deactivation and
  current windows can stop future claims. Intentionally different terms need a new award
  ID, still within the original season cap; a new season is a distinct issuance budget.
- Operator positive corrections consume that same cap. Negative corrections cannot make
  a balance negative. Refunds restore spent Gold, revoke only the refunded purchase's
  grants, and do not reset issuance or lifetime purchase limits. Actor and reason are
  mandatory. The dashboard distinguishes gross issued, gross retired, refund restorations
  and outstanding balance, avoiding a misleading net-issuance total.
- Permanent access remains after offer retirement and season end. Day access renews from
  the latest active expiry for that delivery; seasonal access uses the quoted season end.
  Server access checks enforce expiration/revocation. Permanent ownership is detected by
  canonical delivery identity even through another SKU or asset alias.

### Delivery and Admin operation

`server/digitalDelivery.js` permits only implemented category/provider pairs. Existing
manifest audio and images require a present file with the exact SHA-256 digest. PDF/text
publication delivery is implemented but cannot be activated without a real matching
manifest entry. Services use an explicit versioned provider and implementation digest.
No missing content or Variant Lab stub is marked available. Products can bundle supported
commercial entitlements; earned-only rewards cannot be sold. Rights references are required
operator evidence, not an automated license determination.

Music plays in the library; cosmetics/images can be viewed there; publication files can
be downloaded when supplied. These are not in-match equipment unlocks and confer no card
power. Existing manifest assets are already public: access checks and downloaded ownership
are not DRM, and received bytes cannot be withdrawn. Future assets requiring private-byte
distribution need a separately qualified private storage provider. Permanent delivery also
requires retaining referenced immutable assets and provider versions during future releases;
changing/removing bytes or an implementation fails integrity checks rather than substituting
different content silently.

Admin tables show balances, per-account season budgets, exact claims and evidence hashes,
published products and historical versions, purchase/fulfillment receipts, acquisition and
expiry, transactions and operator/failure audits. Search filters loaded records. Fields
remain distinct from the shared definition draft; changing a price requires publication,
while a confirmed account correction/refund takes effect immediately. This first local
dashboard loads ledger records rather than paginating the entire database server-side;
capacity/load qualification and paging are prerequisites for a large production population.

### Backup and recovery

Use `node scripts/backup-gold-ledger.js <economy.sqlite> <new-backup.sqlite>` for a local
consistent snapshot. It checks the schema, refuses to overwrite a path, uses `VACUUM INTO`
to include committed WAL data, and runs SQLite integrity validation on the copy. Never
back up only the main file of an active WAL database. Isolated tests reopen the backup
and verify balances, exact receipts and usable ownership.

For a complete restore, quiesce account/economy/publication/match writes, record the active
release and identity source, and take coordinated backups of all stores plus immutable
delivery assets. Restore Gold into a **new isolated directory** first; run integrity and
balance/issuance/receipt/grant checks, verify referenced account IDs/creation metadata,
published versions and asset/provider hashes, then reconcile retained canonical matches.
Do not merge ledger rows ad hoc, reapply old credits, or infer grants from collector data.
Choose and document RPO/RTO, deletion/tombstone and disaster reconciliation policies before
production. A Gold backup does not snapshot Supabase, account JSON, archive or content
publication atomically; this implementation does not claim that it does.

The target storage must support durable SQLite locking/fsync and persistent private files.
Independent replicas with separate volumes would create divergent wallets and are not
supported. The development checkout/OneDrive location is not evidence of production-volume
qualification. Use HTTPS for authenticated browser operations and browser request keys.

### Verification and bundle accounting

Before significant new UI, measured player gzip fell from 720,586 to 718,525 bytes
(2,371 bytes headroom), and Admin from 16,367 to 14,359 bytes (2,025 headroom, 23 bytes
short of the 2 KiB target). That small Admin shortfall was reported before proceeding.
258 static inline App layout objects became 172 deduplicated CSS rules, preview data
resolution moved to a server projection, and existing Admin modules share its single
lazy entry to avoid repeated chunk overhead. A compression-hoisting experiment regressed
player size and was reverted. Engine settings and original bundle ceilings remain intact.

The new shared Economy console is charged to **both** the player and Admin budgets;
no previously counted chunk was excluded or relabeled out of its budget. Final exact
sizes, test counts and screenshots are recorded in the completion evidence below.

### Separate next workstreams

1. **GitHub publishing:** reviewed immutable artifacts, explicit pending/review/merged/
   deploying/active/failed states, and verification of the remote release hash. Retain
   truthful local-only activation until that adapter is implemented and qualified.
2. **Production durability and operations:** choose the hosting/account/storage topology,
   qualify persistent locking, crash/restore and RPO/RTO, coordinate account lifecycle,
   retain provider/assets, add bounded Admin paging and load tests, and document fraud/
   collusion adjudication. No unique-person verification is inferred from an account.
3. **Gem payments and fulfillment:** separately authorize the provider, sandbox, verified
   webhooks, unique provider receipts, pending/settled/refund/dispute compensation and
   operational reconciliation. Gold is never purchasable, transferable or convertible.

All changes remain uncommitted in the existing dirty branch. The original two Para patches
were preserved and verified before work. The Gold-specific patch is relative to this
continuation's captured working-tree baseline, not bare HEAD; review it with the existing
Admin/Para foundation and preserve unrelated work.

### Local completion evidence (2026-10-12)

Full verification passed: 225 server tests, 509 client tests in 59 suites, 33 qualification tests, 7 Admin/Para/Gold browser tests and 11 gameplay browser tests. The final default production build and unchanged bundle ceilings pass.

| Gzip category | Exact bytes | Ceiling bytes |
| --- | ---: | ---: |
| main | 175,241 | 179,200 |
| largestAsync | 311,579 | 358,400 |
| player | 720,241 | 720,896 |
| admin | 16,044 | 16,384 |

Shared Economy bytes are counted in both player and Admin totals. Logs are in `artifacts/gold-{server-tests,client-tests,qualification-tests,admin-browser,gameplay-browser,final-build}.log`; exact measurements are in `artifacts/gold-final-budgets.json`.

Browser evidence: `artifacts/gold-player-purchase.png`, `artifacts/gold-analysis-desktop.png`, `artifacts/gold-analysis-mobile.png`, and `artifacts/gold-admin-receipt.png`. Desktop and 390px mobile delivery were visually inspected; browser accessibility and page-overflow checks pass.

`artifacts/gold-continuation-only.patch` isolates 30 paths (14 added) against the captured pre-Gold working tree and passes reverse-application checking. The original two Para patches are byte-identical; 343 captured baseline paths remain unchanged. File hashes are in `artifacts/gold-continuation-files.json`.

### Requested live release: compatibility checkpoint

The user has authorized deployment after completion and importing existing Gold as opening balances outside seasonal caps. The old local base is `bc1b7e70c5385935149007924fef622c46e4f8eb`; verified remote main is `cb89c7566c78952797a639cd77df86f10b8b73fd`. Remote main now includes daily Gold, Timetwisters, event engines and GitHub-backed Admin publishing that are absent from this local base. The local test counts above do not qualify that integration. Do not publish this older tree over current production. Preserve current main in an isolated release worktree, port the Para/Gold changes with current publication and engine contracts, replace repeatable Gold issuance, and prove a once-only opening-balance import before activation.

The live storage diagnostic reports durable Supabase accounts but process-local full match records and no canonical archive table. This is an actual durability gap for canonical evidence. The SQLite Para/Gold stores require a verified persistent private volume or a qualified transactional production adapter; neither may be represented as durable merely because a deploy succeeds. No production mutation has occurred at this checkpoint.

## Integrated release qualification (2026-10-14)

The release worktree passed 385 server tests and 50 qualification tests. The focused
client run passed 24 tests across Admin, Para editing and the shared Economy console,
including explicit revision retry after a conflicting Para edit. The prior full client
run passed 727 tests across 95 suites; the new full CI run must include the additional
conflict case before merge. Browser qualification and deployment are still pending.

The production build passes every unchanged current-main ceiling. Exact gzip bytes:
main 180,606 / 184,320; initial Admin 20,438 / 20,480; aggregate Admin 49,122 / 49,152;
player JavaScript 767,483 / 768,000; largest async chunk 292,617 / 358,400. Shared Economy
remains charged to both categories, including renamed chunks detected by source maps.
Static App layout values and board gradients moved into CSS without changing their
values. Related lazy Admin panels compress together; the Competition entry is lazy.
Four standard Terser passes preserve the existing compatibility options. The 2 KiB
headroom target is not achieved against the larger current-main integration: aggregate
Admin has 30 bytes and player JavaScript 517 bytes remaining. Further UI growth requires
real reductions; ceilings must not be increased or chunks excluded.

Local Admin browser runs can use GAUNTLET_ADMIN_PORT and GAUNTLET_ADMIN_CLIENT_PORT
to avoid another worktree's servers. The compiled client must target the matching
backend. GAUNTLET_ADMIN_USE_BUILD=true reuses that completed build. Test sessions are
issued only by the isolated fixture; production authentication and login throttling
remain unchanged. Read-only fixture requests retry connection resets, while mutations
are never automatically retried. Publishing tests wait for the saved preview before
leaving the editor, matching the current busy-state navigation guard.

The concurrent campaign release #74 was integrated after these measurements. It adds
all-faction campaigns, voiced dialogue and cinematics; those changes remain intact.
That upstream release independently set the player ceiling to 753 KiB. This release
retains the current-main ceilings and the stricter shared-Economy accounting. Final
combined build and CI results supersede the pre-merge figures above. The isolated
browser run passed all 17 existing Admin flows, the full Gold flow and official Para
settlement (19 passing). The remaining Para authoring assertion was updated to match
the shortened simulator copy and is pending a clean rerun.
