# Supabase Setup

Supabase is the right long-term place for Gauntlet Online accounts, friends, and messages. It keeps player data outside the Render filesystem, so accounts survive redeploys and server restarts.

## Create Tables

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Run `server/supabase-schema.sql`.

## Render Environment Variables

Add these to the Render backend service:

```text
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ACCOUNT_AUTH_SECRET=make-this-a-long-random-secret
```

Keep `SUPABASE_SERVICE_ROLE_KEY` on the backend only. Do not put it in Vercel or client code.

## Current Code Path

The server currently reports whether Supabase credentials are configured at:

```text
GET /api/storage-status
```

When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present, the backend stores accounts, friends, messages, leaderboard data, and account stats in Supabase. Match-record storage is selected independently and reported with explicit capabilities:

- `preferred`: complete record v2 is durable in the dedicated match tables and finalization RPC.
- `compatibility`: complete record v2 is durable in namespaced `gauntlet_faction_stats` journal rows.
- `account-only`: account consequences, receipts, progression, rewards, deck aggregates, and a compact match-reference index are durable; complete record v2, public records, completion reconstruction, and audit history are process-local and do not survive backend replacement.
- `local`: development records and accounts use configured local JSON files.

The account match index is not an authoritative match record. It intentionally contains only a match ID, record version, completion timestamp, and deck-version reference. APIs never reconstruct a fake record v2 from that incomplete projection.

In `account-only` mode, global full record-v2 persistence is unavailable after backend replacement. Player history does not depend on filling that gap: completed canonical JSON is retained in the browser's IndexedDB Match Library and can be exported/imported independently. The private Storage object plus `gauntlet_match_archive_index` path remains an optional future global archive. Missing optional archive infrastructure is not a player-history failure, and `MATCH_ARCHIVE_REQUIRED` should remain `false` for the local-first workflow.

The match tables are accessed only by the backend service role. They are not granted to `anon` or `authenticated`; public match pages must use the privacy-filtered server API. Current Supabase projects may require the explicit `service_role` grants in `supabase-schema.sql` because newly created tables are no longer automatically exposed to the Data API.

If the optional canonical cloud archive is enabled later, its objects remain backend-only. Do not make the bucket public or add `anon`/`authenticated` Storage policies. See `docs/match-archive.md` for canonical bytes, local-library identity, import conflict handling, and the competitive trust boundary.
