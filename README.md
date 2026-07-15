# Gauntlet Online

Gauntlet Online is a multiplayer card game with a Create React App client and a Node.js server. The client renders the menus, collection, campaigns, drafts, and tabletop match interface. The Express and Socket.IO server owns accounts, rooms, matchmaking, game rules, AI turns, progression, collection updates, and match results.

Faction, campaign, faction-card, and deck-rule definitions live in `server/gameContent.js`. The registry validates itself when the server starts and publishes its browser-safe manifest at `GET /api/game-content`; the React client loads that manifest instead of maintaining campaign and deck-rule copies. `rulesVersion` and `contentVersion` are also written into server-authored match records. Increment the appropriate version whenever a reviewed rules or content change is introduced.

## Requirements

- Node.js 22 or 24 (see `.nvmrc`)
- npm

## Install dependencies

Install the server and client dependency trees separately from the repository root:

```powershell
npm --prefix server ci
npm --prefix client ci
```

The root convenience command runs both installs:

```powershell
npm run install:all
```

## Local development

Start the backend in one PowerShell window:

```powershell
npm --prefix server start
```

It listens on `http://localhost:4000` by default.

Start the React client in a second PowerShell window and force it to use the local backend:

```powershell
$env:REACT_APP_SOCKET_URL='http://localhost:4000'
npm --prefix client start
```

Create React App normally opens `http://localhost:3000`. If that port is occupied, accept the prompt to use another port or set one explicitly before starting:

```powershell
$env:PORT='3001'
$env:REACT_APP_SOCKET_URL='http://localhost:4000'
npm --prefix client start
```

Alternatively, create an untracked `client/.env.local` containing:

```text
REACT_APP_SOCKET_URL=http://localhost:4000
```

Always set `REACT_APP_SOCKET_URL` for local development. Without it, the current client fallback is the production Render backend.

## Environment variables

Client variables are compiled into the browser bundle and must never contain secrets.

| Variable | Purpose | Local value |
| --- | --- | --- |
| `REACT_APP_SOCKET_URL` | Express API and Socket.IO server base URL | `http://localhost:4000` |
| `REACT_APP_PUBLIC_GAME_URL` | Public base URL used for room invite links | `http://localhost:3000` |
| `REACT_APP_DONATE_URL` | Optional support link | Empty for local development |
| `PUBLIC_URL` | Optional Create React App asset base path | Empty for normal hosting |

Server variables:

| Variable | Purpose | Local default |
| --- | --- | --- |
| `PORT` | HTTP and Socket.IO port | `4000` |
| `CLIENT_URL` | Primary allowed browser origin | `http://localhost:3000` |
| `CLIENT_URLS` | Additional comma-separated allowed origins | Empty |
| `ACCOUNT_DATA_FILE` | Local account JSON path when Supabase is unavailable | `server/accounts.json` |
| `FACTION_STATS_DATA_FILE` | Local faction statistics JSON path | `server/faction-stats.json` |
| `MATCH_DATA_FILE` | Local durable match-record JSON path | `server/matches.json` |
| `ROOM_RECONNECT_GRACE_MS` | Time an active match waits with no human players connected | `600000` (10 minutes) |
| `ROOM_LOBBY_TTL_MS` | Time an empty unstarted lobby remains available | `3600000` (1 hour) |
| `ROOM_COMPLETED_TTL_MS` | Time a completed or abandoned room remains available | `900000` (15 minutes) |
| `ROOM_SWEEP_INTERVAL_MS` | Frequency of stale-room lifecycle checks | `30000` (30 seconds) |
| `ACCOUNT_AUTH_SECRET` | HMAC secret for account sessions | Development fallback; required secret in production |
| `ACCOUNT_SESSION_TTL_MS` | Lifetime of a signed account session | `604800000` (7 days) |
| `OWNER_STATS_TOKEN` | Token for owner-only statistics endpoints | Empty |
| `SUPABASE_URL` | Supabase project URL | Empty; enables Supabase with the service key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase service key | Empty; never expose to the client |
| `PACK_PURCHASE_URL` | Optional checkout base URL for pack purchases | Empty |

Safe templates are available in `client/.env.example` and `server/.env.example`. Real `.env` files are ignored.

## Checks

From the repository root:

```powershell
npm run check:server
npm run test:server
npm run test:client
npm run build:client
npm run check
```

`check:server` runs `node --check server/index.js`. `test:server` runs the server rule-contract tests, and `test:client` runs focused client behavior tests once. `build:client` creates `client/build`, which is ignored. `check` runs all four commands.

## Git workflow

1. Update local `main` from `origin/main` with a fast-forward pull.
2. Create a focused feature branch; this project uses descriptive `giuseppe/` branch names for current work.
3. Keep generated builds, logs, local account data, and real environment files out of commits.
4. Run `npm run check` and any feature-specific manual validation.
5. Review the complete diff, commit only related files, and push only the feature branch.
6. Open a pull request targeting `main`. Do not merge or deploy directly from a local feature branch.

## Deployment and persistence

The React client is deployed from the `client` directory on Vercel at `https://gauntlet-online.vercel.app`. The Node/Express/Socket.IO server is deployed from the `server` directory on Render at `https://gauntlet-online.onrender.com`. These deployment roots remain separate; the repository does not use npm workspaces.

Production account, friend, message, progression, collection, and leaderboard data can be stored in Supabase when the server credentials are configured. See `server/SUPABASE.md`.

Completed matches are stored separately from active rooms. Each server-authored record includes public participant and deck-version snapshots, completion metadata, combat aggregates, and a privacy-filtered audit stream. `GET /api/matches/:matchId` returns a public record, while authenticated accounts can list their recent records at `GET /api/account/matches`.

Active rooms, matchmaking queues, draft queues, and live game state are held in server memory. Disconnected matches remain reconnectable for the configured grace period; after that, the server records them as abandoned without changing competitive statistics. Empty lobbies, abandoned drafts, and completed rooms are removed on separate expiry clocks. A graceful server shutdown records active matches as abandoned, but room state is not restored after a restart or redeploy.
