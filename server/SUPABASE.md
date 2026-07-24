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

When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present, the backend stores accounts, friends, messages, leaderboard data, account stats, and durable match records in Supabase. If either value is missing, it falls back to local JSON storage for development.

The match tables are accessed only by the backend service role. They are not granted to `anon` or `authenticated`; public match pages must use the privacy-filtered server API. Current Supabase projects may require the explicit `service_role` grants in `supabase-schema.sql` because newly created tables are no longer automatically exposed to the Data API.
