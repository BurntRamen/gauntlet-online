import "./SeasonZero.css";

export function SeasonQueueSummary({ season, bestOf = 1 }) {
  if (!season) return null;
  return (
    <div className="season-queue-summary">
      <span>{season.status === "active" ? "Active season" : season.status}</span>
      <strong>{season.displayName}</strong>
      <small>Ranked {Number(bestOf) === 3 ? "BO3" : "BO1"} · {Number(bestOf) === 3 ? "series result scores standings points" : "each completed match scores standings points"}</small>
    </div>
  );
}

function StandingTable({ standings, onOpenProfile, compact = false }) {
  return (
    <div className="season-table-wrap">
      <table className="season-table">
        <thead><tr><th>Rank / Player</th><th>G</th><th>W</th><th>L</th><th>D</th><th>Pts</th><th>Rate</th></tr></thead>
        <tbody>
          {standings.map((entry, index) => (
            <tr key={entry.accountId || entry.name}>
              <td><button type="button" onClick={() => onOpenProfile(entry.accountId)} disabled={!entry.accountId}>{entry.rank || index + 1}. {entry.name}</button></td>
              <td>{entry.gamesPlayed}</td><td>{entry.wins}</td><td>{entry.losses}</td><td>{entry.draws}</td>
              <td>{compact ? "—" : entry.points}</td><td>{entry.winRate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SeasonStandings({ season, standings = [], playerStanding = null, lifetimeStandings = [], error = "", onOpenProfile = () => {} }) {
  return (
    <section className="season-surface" aria-labelledby="season-standings-title">
      <div className="season-surface-heading"><span>Competitive standings</span><h3 id="season-standings-title">{season?.displayName || "Active Season"}</h3></div>
      {error && <p className="season-error">{error}</p>}
      {!error && standings.length === 0 && <p className="season-empty">No seasonal ranked results yet.</p>}
      {standings.length > 0 && <StandingTable standings={standings.slice(0, 8)} onOpenProfile={onOpenProfile} />}
      {playerStanding && !standings.slice(0, 8).some((entry) => entry.accountId === playerStanding.accountId) && (
        <div className="season-own-standing"><span>Your position</span><strong>#{playerStanding.rank} · {playerStanding.points} points · {playerStanding.wins}W {playerStanding.losses}L {playerStanding.draws}D</strong></div>
      )}
      {lifetimeStandings.length > 0 && (
        <details className="season-lifetime"><summary>Lifetime ranked record</summary><StandingTable standings={lifetimeStandings.slice(0, 8)} onOpenProfile={onOpenProfile} compact /></details>
      )}
    </section>
  );
}

export function ActiveSeasonMatches({ season, matches = [], error = "", onSpectate = () => {} }) {
  return (
    <section className="season-surface" aria-labelledby="season-matches-title">
      <div className="season-surface-heading"><span>Watch live competition</span><h3 id="season-matches-title">Active {season?.displayName || "Season"} Matches</h3></div>
      {error && <p className="season-error">{error}</p>}
      {!error && matches.length === 0 && <p className="season-empty">No seasonal matches are available to spectate right now.</p>}
      <div className="season-match-list">
        {matches.map((match) => (
          <div className="season-match-row" key={match.matchId || match.roomCode}>
            <span><strong>{match.players?.map((player) => player.displayName).join(" vs ") || "Ranked match"}</strong><small>{String(match.format || "ranked-bo1").toUpperCase()} · Turn {match.turn || 1} · {match.spectatorCount || 0} watching</small></span>
            <button type="button" onClick={() => onSpectate(match.roomCode)}>Spectate</button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SeasonResultFacts({ seasonResult }) {
  if (!seasonResult) return null;
  const record = seasonResult.record || {};
  return (
    <>
      <div><dt>Season</dt><dd>{seasonResult.displayName || "Season"}</dd></div>
      <div><dt>Season result</dt><dd>{String(seasonResult.seriesResult || seasonResult.result || "complete").toUpperCase()}</dd></div>
      <div><dt>Season points</dt><dd>{seasonResult.pointsDelta > 0 ? `+${seasonResult.pointsDelta}` : seasonResult.pointsDelta || 0} · {record.points || 0} total</dd></div>
      <div><dt>Season record</dt><dd>{record.wins || 0}W {record.losses || 0}L {record.draws || 0}D{seasonResult.rank ? ` · #${seasonResult.rank}` : ""}</dd></div>
    </>
  );
}
