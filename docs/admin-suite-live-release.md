# Admin suite live release — 16 October 2026

The user explicitly requested: “complete it in funtionality and user interface and publish it live”. This authorizes the integrated Admin code release through the existing GitHub → Vercel/Render route. The provider decision remains adapter only; no live payment integration is included.

## Reconciliation

The release continues the tested `codex/modular-admin-suite` worktree at `6b56477`. Main `aa00d80` has been merged locally, preserving the already integrated Reath campaign and authored campaign lookups. Conflict resolution retained exactly the tested implementation; the reconciliation commit has no application-tree changes. PR72 and PR77 implementation is included. PR78 (campaign rewrite), PR79 (paid support zones), Case's dirty checkout and all other existing worktrees remain untouched.

## Release verification

The complete implementation evidence and bounded engine contracts are in [Admin Phase 2](admin-phase2.md). Release CI now runs the seven new Phase 2/Gem browser journeys in addition to existing Admin, gameplay, security, dependency, build and performance checks. No budget or test gate is relaxed.

Current code deployment status: preparing release; no successful production deployment is claimed by this commit. Record exact PR, deployment commits, checks and smoke-test results after hosting readback.

## Activation prerequisites verified before release

The live `/api/storage-status` response at approximately 07:24 UTC reports Supabase accounts, account-only match storage, missing `gauntlet_match_archive_index`, and disabled Para/finite Gold/opening import. The connected Supabase account lists three unrelated inactive Creative OS projects. The Render browser workspace `tea-d9doqibbc2fs73ei0lig` lists only `para-poker-site`; Vercel's browser session asks for login. GitHub repository access and its existing deployment integrations are available.

Code may ship with the existing feature gates preserved. Complete production commerce/recovery activation additionally requires access to the existing Gauntlet Render service and its actual Supabase project, verified account CAS/private-authoring/match migrations, persistent single-writer storage, a coordinated backup/restore drill and explicit activation of the desired systems. See [the precise rollout procedure](durable-storage-setup.md). No substitute project or ephemeral financial ledger is acceptable.

Do not alter production balances, apply migrations, buy infrastructure, enable Gems/payments, or publish a competition/content definition as a side effect of deploying this code. Preserve the agreed opening-Gold import outside seasonal earning caps when a later cutover is authorized. Existing Timetwister and account Gold ownership remain under their current authority until then.

## Operator entry point

Use `/admin/gauntlet` with either existing approved account. The seven areas are Home, Content, Competition, Store & Economy, Players, Publishing and Operations. Follow the [operator guide](modular-admin-operator-guide.md) and [Phase 2 workflows](admin-phase2.md). Each runtime capability must show its actual storage/provider gate; saved configuration must never appear as successful activation of a missing backend.
