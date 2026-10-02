# Gauntlet Admin deployment and GitHub publishing

The release integrates Admin v2 with production commit `28651afe464f1915ff4cfaca031a28de36ee0da2`, preserving the current ten playable factions, 126 cards, commander announcers, and set-specific Sealed play. Earlier Admin reports describe the original 72-card implementation; they are historical qualification, not the deployment status of this release.

## Private access

Open https://gauntlet-online.vercel.app/admin/gauntlet and use the existing account sign-in. Every `/api/admin` endpoint, including older owner endpoints, and direct backend `/admin/gauntlet` routes require an authenticated account on this exact allowlist:

| Account | Stable authenticated ID |
| --- | --- |
| simply | `47d97ddb-65f9-4014-be92-9b677467d943` |
| BurntRamen | `9a9dcf5c-1d3f-422e-b0eb-ca1a32a699e5` |

Names and owner tokens grant no access. Empty/invalid environment overrides disable that account slot. There are no roles or permission-management features. The frontend serves a static sign-in shell; private data and operations always use the server gate.

## One-time production connection

The backend is https://gauntlet-online.onrender.com. Configure its server environment:

- `GAUNTLET_CONTENT_PROVIDER=github` (also the default on Render and in production).
- `GAUNTLET_GITHUB_TOKEN`: a credential scoped to **BurntRamen/gauntlet-online**, with Contents and Pull requests read/write, Checks read, and Commit statuses read. Existing server `GITHUB_TOKEN` or `GH_TOKEN` is also recognized, so verify the live connection before requesting new setup. A repository owner can create a repository-limited fine-grained token when needed. Use an expiration and rotate it in the server environment. Do not put it in client variables, source files, chat, or browser storage.

[GitHub's permission reference](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens) describes those API permissions. Repository protections and required reviews continue to apply; the server does not bypass them. A missing/expired credential leaves the deployed release intact and blocks authoring with an explicit connection error.

Admin content needs **no persistent server disk or new database**. Player/account persistence and existing live-room recovery are separate existing systems and are unchanged by this choice. Production deployments still use the existing GitHub main → Vercel/Render connections. Check the live authoring connection first; dashboard access is necessary only if its server credential needs configuration.

## Content lifecycle

1. Both approved accounts share `content/gauntlet-draft.json` on `codex/gauntlet-admin-draft`. Every saved field/receipt uses an expected revision and GitHub file SHA; stale writes fail without overwriting another operator.
2. Validation, exact-draft presentation preview, and required mechanical playtest use the deployed engine. Playtests remain private process-local sessions with no rewards, competitive effects or authoritative production match records; a restart ends the session but its accepted draft receipt remains in GitHub.
3. Publish creates a dedicated content branch and a pull request changing only `server/content/gauntlet-release.json`. This lies inside the backend service root so content-only changes trigger its deployment. A named `Validate Gauntlet content` check and other reported checks/statuses must pass. Normal repository merge protections remain authoritative.
4. Admin shows checks, blocked/failed checks, merge, and deployment separately. Keep an Admin authoring page open to reconcile; reopening it resumes the saved publication. Cancel closes an unmerged PR and preserves the draft. A merged release must finish deploying before another draft or rollback.
5. Only the validated release file bundled with the running backend is live. GitHub drafts and merged-but-undeployed releases cannot change the running process. New games pin their release, typed contracts, rules, configuration and immutable asset references. Existing games and historical records retain their captured definitions.
6. Rollback uses the same checked PR and deployment path. It restores an earlier compatible release for future games. It does not alter history or bypass deployment time.

The repository is public, so draft **content** on its dedicated branch is public too. Admin never writes player records, credentials or session tokens there. Content history is capped at 16 MiB; exceeding it stops writes with an explicit error rather than dropping history. Git remains the full audit trail. Source/engine changes after a content release must preserve its compatible contract or deliberately migrate the packaged release; incompatible packages fail validation before rollout.

The `file` provider remains for isolated development and tests. Compatible v1 content migrates deterministically, carrying authored edits forward without reverting newer source defaults. Original release snapshots remain unchanged.

## Release validation

Current integration: 2,800 captured production engine outcomes match both legacy ingress and explicit effect contracts; 56 encounter setups retain their bounded behavior. The asset validator verifies 1,191 immutable references and their file digests. Run `npm run check:content-release`, server/client suites, bundle checks, and browser suites. Admin browser tests use isolated accounts and a test backend, never production data.

After merge, verify Vercel's deployment and the backend's `X-Gauntlet-Commit`, confirm guest API/direct-route denial, verify both authorized sessions and an unrelated account, and inspect the live authoring connection before claiming publishing is operational. A successful frontend build alone does not establish backend deployment or GitHub credential configuration.
