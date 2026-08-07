# Season Zero competitive contract

`server/seasons.js` is the canonical season definition. Season Zero includes the authenticated ranked BO1 and ranked BO3 queues. Draft League, private tables, campaign, and Training Grounds are explicitly excluded.

Standings use completed matches or series as the scoring unit:

- BO1: each completed game awards 3 points for a win, 1 for a draw, and 0 for a loss.
- BO3: every game updates season game statistics and receives its own match record and idempotency receipt. Points and the series win/loss are applied only when one player reaches two game wins.

Standings are ordered by points, series wins, game win rate, fewer series losses, games played, display name, then account ID. The final two fields make otherwise identical standings deterministic.

Season state is stored under `account.stats.seasons[seasonId]`. The existing `matchId:accountId` consequence receipt protects all seasonal changes from duplicate finalization. Compact seasonal match references remain available in account-only storage; they do not substitute for unavailable full record-v2 history.

Active-match discovery exposes only public room, match, player, faction, format, series-score, turn, and spectator-count metadata. Spectators still join the existing authoritative room and receive the existing privacy-sanitized Babylon projection.
