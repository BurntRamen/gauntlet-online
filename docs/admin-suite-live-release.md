# Admin suite live release — 20 October 2026

The user explicitly requested: “complete it in funtionality and user interface and publish it live”. This authorizes the integrated Admin code release through the existing GitHub → Vercel/Render route. The provider decision remains adapter only; no live payment integration is included.

## Reconciliation

The release continues `codex/modular-admin-suite` and [PR80](https://github.com/BurntRamen/gauntlet-online/pull/80). Its previous head `803f25c` passed all hosted release checks. Main `046f3be` is now integrated, including PR78/79/83/84, paid-support rules v12, frontier factions, expanded campaigns and faction music. PR72 and PR77 implementation is included. Case's dirty checkout, the other worktrees and unmerged PR81/82 remain untouched.

The integration explicitly connects authored support and composed armaments to v12 printed-cost entry, priority, capacity and command receipts. Admin preview, suggested actions and execution issue server-owned support envelopes. A moved support retains its entry evidence and updates its lane. Matches pinned to v11 keep their original end-turn placement. Malformed or unresolved authored support remains unavailable; no free-entry substitute is introduced.

Main's expanded campaign/roster also exposed stale voice-planning qualification fixtures. Frumo's new epilogue maps to its existing narrator; the interaction manifest now explicitly names its existing ten-faction production scope. New playable factions without selected voices fail if requested. No voice generation, billing, audio replacement or new voice assignment was performed.

## Release verification

The complete implementation evidence and bounded engine contracts are in [Admin Phase 2](admin-phase2.md). Release CI runs the seven Phase 2/Gem browser journeys, paid-support browser journeys, and existing Admin, gameplay, security, dependency, build and performance checks. The 61 KiB total Admin ceiling is retained; the player ceiling follows main's existing 759 KiB ceiling. No gate is relaxed by this reconciliation.

For `803f25c`, hosted run `38872872742` passed on attempt 2. Attempt 1's first usability test reached its second rendered match just after the scene-readiness timeout; the identical rerun passed without code or timeout changes. Additional local compiled usability (6 tests) and performance (1 test) passed. This is historical evidence, not a substitute for validating the newly integrated tree.

Read-only inspection of the shared GitHub authoring record found an older source baseline, retained notes/history, and no draft or pending publication. Source-only deployments now reconcile that unused baseline in memory, retain every historical release and note, and append reconciliation evidence on the next normal revision-checked operator save. Drafts, pending publications, packaged releases and operator-created releases never qualify for automatic reconciliation. Integrity checks and concurrency guards remain mandatory. This code release does not write the production authoring record.

Current code deployment status: preparing release; no successful production deployment is claimed by this commit. Record exact PR, deployment commits, checks and smoke-test results after hosting readback.

## Activation prerequisites verified before release

Read-only production capture at 2026-10-21 01:19 UTC confirms backend `046f3be`, rules v12, 144 cards, 14 available factions and 188 campaign chapters. `/api/storage-status` reports Supabase accounts, account-only match storage, missing `gauntlet_match_archive_index`, and disabled Para/finite Gold/opening import. The available hosting accounts do not own the Gauntlet backend/database. The user confirmed these are under Case's account; no further login request is directed to the user. GitHub repository access and its existing deployment integrations are available.

Code may ship with the existing feature gates preserved. Complete production commerce/recovery activation additionally requires access to the existing Gauntlet Render service and its actual Supabase project, verified account CAS/private-authoring/match migrations, persistent single-writer storage, a coordinated backup/restore drill and explicit activation of the desired systems. See [the precise rollout procedure](durable-storage-setup.md). No substitute project or ephemeral financial ledger is acceptable.

Do not alter production balances, apply migrations, buy infrastructure, enable Gems/payments, or publish a competition/content definition as a side effect of deploying this code. Preserve the agreed opening-Gold import outside seasonal earning caps when a later cutover is authorized. Existing Timetwister and account Gold ownership remain under their current authority until then.

## Operator entry point

Use `/admin/gauntlet` with either existing approved account. The seven areas are Home, Content, Competition, Store & Economy, Players, Publishing and Operations. Follow the [operator guide](modular-admin-operator-guide.md) and [Phase 2 workflows](admin-phase2.md). Each runtime capability must show its actual storage/provider gate; saved configuration must never appear as successful activation of a missing backend.
