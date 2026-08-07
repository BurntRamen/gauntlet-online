const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ACTIVE_SEASON,
  applySeasonResult,
  buildSeasonMatchIdentity,
  buildSeasonProfile,
  buildSeasonStandings,
  emptySeasonStats,
  getActiveSeason,
  normalizeSeasonStats
} = require("../seasons");

function context(matchId, overrides = {}) {
  return {
    matchId,
    completedAt: "2026-08-07T12:00:00.000Z",
    season: buildSeasonMatchIdentity(ACTIVE_SEASON, 1),
    matchIndex: { recordVersion: 2, completedAt: "2026-08-07T12:00:00.000Z" },
    playerNum: 1,
    ...overrides
  };
}

test("Season Zero has one active, independently versioned canonical definition", () => {
  assert.equal(getActiveSeason("2026-08-07T12:00:00.000Z").seasonId, "season-zero");
  assert.equal(ACTIVE_SEASON.displayName, "Season Zero");
  assert.deepEqual(ACTIVE_SEASON.rankedFormats, ["ranked-bo1", "ranked-bo3"]);
  assert.equal(buildSeasonMatchIdentity(ACTIVE_SEASON, 1).format, "ranked-bo1");
  assert.equal(buildSeasonMatchIdentity(ACTIVE_SEASON, 3).format, "ranked-bo3");
});

test("win, loss, and draw update game buckets and deterministic standings points", () => {
  const stats = {};
  applySeasonResult(stats, "win", context("match-win"));
  applySeasonResult(stats, "draw", context("match-draw"));
  applySeasonResult(stats, "loss", context("match-loss"));
  const season = normalizeSeasonStats(stats);
  assert.deepEqual(
    { games: season.gamesPlayed, wins: season.wins, losses: season.losses, draws: season.draws, units: season.seriesPlayed, points: season.points },
    { games: 3, wins: 1, losses: 1, draws: 1, units: 3, points: 4 }
  );
});

test("BO3 records every game but scores standings only when the series completes", () => {
  const stats = {};
  const season = buildSeasonMatchIdentity(ACTIVE_SEASON, 3);
  const first = applySeasonResult(stats, "win", context("bo3-game-1", {
    season,
    series: { seriesId: "series-1", targetWins: 2, scoreAfter: { 1: 1, 2: 0 } }
  }));
  const second = applySeasonResult(stats, "loss", context("bo3-game-2", {
    season,
    series: { seriesId: "series-1", targetWins: 2, scoreAfter: { 1: 1, 2: 1 } }
  }));
  const final = applySeasonResult(stats, "win", context("bo3-game-3", {
    season,
    series: { seriesId: "series-1", targetWins: 2, scoreAfter: { 1: 2, 2: 1 } }
  }));
  const record = normalizeSeasonStats(stats);
  assert.equal(first.pointsDelta, 0);
  assert.equal(second.pointsDelta, 0);
  assert.equal(final.pointsDelta, 3);
  assert.deepEqual(
    { games: record.gamesPlayed, wins: record.wins, losses: record.losses, series: record.seriesPlayed, seriesWins: record.seriesWins, points: record.points },
    { games: 3, wins: 2, losses: 1, series: 1, seriesWins: 1, points: 3 }
  );
});

test("season standings use the documented tiebreak order", () => {
  const accounts = [
    { id: "b", name: "Beta", stats: { seasons: { "season-zero": { ...emptySeasonStats(), gamesPlayed: 4, wins: 3, losses: 1, seriesPlayed: 2, seriesWins: 2, points: 6 } } } },
    { id: "a", name: "Alpha", stats: { seasons: { "season-zero": { ...emptySeasonStats(), gamesPlayed: 5, wins: 4, losses: 1, seriesPlayed: 3, seriesWins: 2, seriesLosses: 1, points: 6 } } } },
    { id: "c", name: "Gamma", stats: { seasons: { "season-zero": { ...emptySeasonStats(), gamesPlayed: 3, wins: 1, losses: 2, seriesPlayed: 1, seriesWins: 1, points: 3 } } } }
  ];
  const standings = buildSeasonStandings(accounts);
  assert.deepEqual(standings.map((entry) => [entry.rank, entry.name]), [[1, "Alpha"], [2, "Beta"], [3, "Gamma"]]);
});

test("season rollover starts isolated stats while preserving Season Zero", () => {
  const stats = {};
  applySeasonResult(stats, "win", context("zero-match"));
  const nextSeason = { ...ACTIVE_SEASON, seasonId: "season-one", seasonCode: "S1", displayName: "Season One" };
  const nextIdentity = buildSeasonMatchIdentity(nextSeason, 1);
  applySeasonResult(stats, "loss", context("one-match", { season: nextIdentity }), nextSeason);
  assert.equal(normalizeSeasonStats(stats, ACTIVE_SEASON).points, 3);
  assert.equal(normalizeSeasonStats(stats, nextSeason).losses, 1);
  assert.equal(buildSeasonProfile(stats, null, ACTIVE_SEASON).recentMatchReferences[0].matchId, "zero-match");
});
