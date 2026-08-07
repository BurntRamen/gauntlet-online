const SEASON_DEFINITION_VERSION = "gauntlet.season.v1";

const ACTIVE_SEASON = Object.freeze({
  seasonDefinitionVersion: SEASON_DEFINITION_VERSION,
  seasonId: "season-zero",
  seasonCode: "S0",
  displayName: "Season Zero",
  status: "active",
  startsAt: "2026-08-07T00:00:00.000Z",
  endsAt: null,
  rankedFormats: Object.freeze(["ranked-bo1", "ranked-bo3"]),
  scoring: Object.freeze({ win: 3, draw: 1, loss: 0 }),
  standingsUnit: "completed-match-or-series",
  tiebreakOrder: Object.freeze([
    "points",
    "seriesWins",
    "gameWinRate",
    "fewerSeriesLosses",
    "gamesPlayed",
    "displayName",
    "accountId"
  ])
});

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function publicSeasonDefinition(season = ACTIVE_SEASON) {
  return clone(season);
}

function getActiveSeason(now = new Date(), season = ACTIVE_SEASON) {
  if (!season || season.status !== "active") return null;
  const timestamp = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (Number.isFinite(timestamp)) {
    if (season.startsAt && timestamp < new Date(season.startsAt).getTime()) return null;
    if (season.endsAt && timestamp >= new Date(season.endsAt).getTime()) return null;
  }
  return publicSeasonDefinition(season);
}

function seasonalFormatForBestOf(bestOf) {
  return Number(bestOf) === 3 ? "ranked-bo3" : "ranked-bo1";
}

function buildSeasonMatchIdentity(season = ACTIVE_SEASON, bestOf = 1) {
  const format = seasonalFormatForBestOf(bestOf);
  if (!season?.rankedFormats?.includes(format)) return null;
  return {
    seasonDefinitionVersion: season.seasonDefinitionVersion,
    seasonId: season.seasonId,
    seasonCode: season.seasonCode,
    displayName: season.displayName,
    format
  };
}

function emptySeasonStats(season = ACTIVE_SEASON) {
  return {
    seasonDefinitionVersion: season.seasonDefinitionVersion || SEASON_DEFINITION_VERSION,
    seasonId: season.seasonId,
    seasonCode: season.seasonCode || season.seasonId,
    displayName: season.displayName || season.seasonId,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    seriesPlayed: 0,
    seriesWins: 0,
    seriesLosses: 0,
    seriesDraws: 0,
    points: 0,
    recentMatches: [],
    lastPlayedAt: null
  };
}

function normalizeSeasonStats(stats = {}, season = ACTIVE_SEASON) {
  const source = stats?.seasons?.[season.seasonId] || {};
  const normalized = { ...emptySeasonStats(season), ...clone(source) };
  for (const field of [
    "gamesPlayed", "wins", "losses", "draws", "seriesPlayed",
    "seriesWins", "seriesLosses", "seriesDraws", "points"
  ]) {
    normalized[field] = Math.max(0, Number(normalized[field] || 0));
  }
  normalized.recentMatches = Array.isArray(normalized.recentMatches)
    ? normalized.recentMatches.filter((entry) => entry?.matchId).slice(0, 30)
    : [];
  return normalized;
}

function resolveStandingsUnit(result, context = {}) {
  const format = context.season?.format || "ranked-bo1";
  if (format !== "ranked-bo3") return { complete: true, result };
  const series = context.series;
  const playerNum = Number(context.playerNum);
  const opponentNum = playerNum === 1 ? 2 : 1;
  const targetWins = Number(series?.targetWins || 2);
  const playerScore = Number(series?.scoreAfter?.[playerNum] || series?.scoreAfter?.[String(playerNum)] || 0);
  const opponentScore = Number(series?.scoreAfter?.[opponentNum] || series?.scoreAfter?.[String(opponentNum)] || 0);
  if (playerScore < targetWins && opponentScore < targetWins) return { complete: false, result: null };
  return { complete: true, result: playerScore > opponentScore ? "win" : playerScore < opponentScore ? "loss" : "draw" };
}

function applySeasonResult(stats, result, context = {}, seasonDefinition = ACTIVE_SEASON) {
  const seasonIdentity = context.season;
  if (!seasonIdentity?.seasonId || !["win", "loss", "draw"].includes(result)) return null;
  const definition = seasonIdentity.seasonId === seasonDefinition.seasonId
    ? seasonDefinition
    : { ...seasonDefinition, ...seasonIdentity, rankedFormats: seasonDefinition.rankedFormats };
  stats.seasons = stats.seasons && typeof stats.seasons === "object" ? stats.seasons : {};
  const season = normalizeSeasonStats(stats, definition);
  const before = clone(season);

  season.gamesPlayed += 1;
  if (result === "win") season.wins += 1;
  if (result === "loss") season.losses += 1;
  if (result === "draw") season.draws += 1;

  const standingsUnit = resolveStandingsUnit(result, context);
  let pointsDelta = 0;
  if (standingsUnit.complete) {
    season.seriesPlayed += 1;
    if (standingsUnit.result === "win") season.seriesWins += 1;
    if (standingsUnit.result === "loss") season.seriesLosses += 1;
    if (standingsUnit.result === "draw") season.seriesDraws += 1;
    pointsDelta = Number(seasonDefinition.scoring?.[standingsUnit.result] || 0);
    season.points += pointsDelta;
  }

  season.lastPlayedAt = context.completedAt || new Date().toISOString();
  if (context.matchId) {
    season.recentMatches = season.recentMatches.filter((entry) => entry.matchId !== context.matchId);
    season.recentMatches.unshift({
      matchId: context.matchId,
      recordVersion: Number(context.matchIndex?.recordVersion || 2),
      completedAt: context.matchIndex?.completedAt || season.lastPlayedAt,
      seriesId: context.series?.seriesId || null,
      format: seasonIdentity.format,
      result,
      seriesResult: standingsUnit.complete ? standingsUnit.result : null,
      pointsDelta
    });
    season.recentMatches = season.recentMatches.slice(0, 30);
  }
  stats.seasons[seasonIdentity.seasonId] = season;
  return { before, after: clone(season), pointsDelta, standingsUnit };
}

function seasonWinRate(season) {
  const decidedGames = Number(season.wins || 0) + Number(season.losses || 0);
  return decidedGames > 0 ? Math.round((Number(season.wins || 0) / decidedGames) * 1000) / 10 : 0;
}

function compareSeasonStanding(a, b) {
  return Number(b.points || 0) - Number(a.points || 0)
    || Number(b.seriesWins || 0) - Number(a.seriesWins || 0)
    || Number(b.winRate || 0) - Number(a.winRate || 0)
    || Number(a.seriesLosses || 0) - Number(b.seriesLosses || 0)
    || Number(b.gamesPlayed || 0) - Number(a.gamesPlayed || 0)
    || String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" })
    || String(a.accountId || "").localeCompare(String(b.accountId || ""));
}

function buildSeasonStandings(accounts = [], season = ACTIVE_SEASON) {
  return accounts
    .map((account) => {
      const record = normalizeSeasonStats(account.stats || {}, season);
      return {
        accountId: account.id,
        name: account.name,
        gamesPlayed: record.gamesPlayed,
        wins: record.wins,
        losses: record.losses,
        draws: record.draws,
        seriesPlayed: record.seriesPlayed,
        seriesWins: record.seriesWins,
        seriesLosses: record.seriesLosses,
        seriesDraws: record.seriesDraws,
        points: record.points,
        winRate: seasonWinRate(record),
        lastPlayedAt: record.lastPlayedAt
      };
    })
    .filter((entry) => entry.gamesPlayed > 0)
    .sort(compareSeasonStanding)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function buildSeasonProfile(stats = {}, standing = null, season = ACTIVE_SEASON) {
  const record = normalizeSeasonStats(stats, season);
  return {
    season: publicSeasonDefinition(season),
    rank: standing?.rank || null,
    record: {
      gamesPlayed: record.gamesPlayed,
      wins: record.wins,
      losses: record.losses,
      draws: record.draws,
      seriesPlayed: record.seriesPlayed,
      seriesWins: record.seriesWins,
      seriesLosses: record.seriesLosses,
      seriesDraws: record.seriesDraws,
      points: record.points,
      winRate: seasonWinRate(record),
      lastPlayedAt: record.lastPlayedAt
    },
    recentMatchReferences: clone(record.recentMatches)
  };
}

module.exports = {
  ACTIVE_SEASON,
  SEASON_DEFINITION_VERSION,
  applySeasonResult,
  buildSeasonMatchIdentity,
  buildSeasonProfile,
  buildSeasonStandings,
  compareSeasonStanding,
  emptySeasonStats,
  getActiveSeason,
  normalizeSeasonStats,
  publicSeasonDefinition,
  resolveStandingsUnit,
  seasonalFormatForBestOf,
  seasonWinRate
};
