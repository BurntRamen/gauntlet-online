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

Production cannot provide durable global record-v2 persistence in `account-only` mode. Enabling either the existing preferred schema or the existing compatibility journal immediately closes that capability gap; do not work around it by duplicating full records into account rows or unrelated tables.

The match tables are accessed only by the backend service role. They are not granted to `anon` or `authenticated`; public match pages must use the privacy-filtered server API. Current Supabase projects may require the explicit `service_role` grants in `supabase-schema.sql` because newly created tables are no longer automatically exposed to the Data API.
