import { useCallback, useEffect, useMemo, useState } from "react";
import { SeasonStandings } from "./SeasonZero";
import "./MatchesHub.css";

function formatDate(value) {
  if (!value) return "Unknown date";
  return new Date(value).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function titleCase(value) {
  return String(value || "match").replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function AvailableMatchRow({ match, onOpenMatch, onOpenReplay }) {
  const perspective = match.perspective || {};
  const player = perspective.player || match.participants?.[0] || {};
  const opponent = perspective.opponent || perspective.opponents?.[0]
    || match.participants?.find((entry) => entry.participantId !== player.participantId) || {};
  const outcome = perspective.outcome || player.result || "recorded";
  return (
    <article className="matches-row" data-replay-state={match.replay?.available ? "available" : "unavailable"}>
      <div className={`matches-result is-${outcome}`}><span>{String(outcome).toUpperCase()}</span></div>
      <div className="matches-row-main">
        <span>{titleCase(match.mode)}{match.season?.displayName ? ` · ${match.season.displayName}` : ""}</span>
        <h3>{player.faction?.name || "Basic Gauntlet"} vs {opponent.displayName || "Opponent"}</h3>
        <p>{formatDate(match.completedAt)} · {match.turnCount || 1} turns</p>
        <small className={match.replay?.available ? "is-available" : "is-unavailable"}>
          {match.replay?.available
            ? match.replay.mode === "public-state-frames" ? "Replay available · exact public battlefield" : "Replay available · event timeline"
            : match.replay?.unavailableReason || "Replay unavailable"}
        </small>
      </div>
      <div className="matches-row-actions">
        {match.replay?.available && <button type="button" className="matches-primary-action" onClick={() => onOpenReplay(match.matchId)}>Watch Replay</button>}
        {!match.replay?.available && <span className="matches-unavailable-label">Replay unavailable</span>}
        <button type="button" onClick={() => onOpenMatch(match.matchId)}>Match Record</button>
      </div>
    </article>
  );
}

function UnavailableReferenceRow({ reference }) {
  return (
    <article className="matches-row matches-reference" data-replay-state="unavailable">
      <div className="matches-result is-recorded"><span>RECORDED</span></div>
      <div className="matches-row-main">
        <span>Durable match reference</span>
        <h3>Match {String(reference.matchId || "").slice(0, 8)}</h3>
        <p>{formatDate(reference.completedAt)} · Record v{reference.recordVersion || 2}</p>
        <small className="is-unavailable">The result reference is durable, but the full record and replay were process-local and are no longer available.</small>
      </div>
      <div className="matches-row-actions"><span className="matches-unavailable-label">Replay unavailable</span></div>
    </article>
  );
}

export default function MatchesHub({
  account,
  authToken,
  serverUrl,
  season,
  standings,
  playerStanding,
  lifetimeStandings,
  seasonError,
  onOpenProfile,
  onOpenMatch,
  onOpenReplay
}) {
  const [data, setData] = useState({ matches: [], unavailableMatchReferences: [], storage: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const loadMatches = useCallback(async () => {
    if (!authToken) {
      setData({ matches: [], unavailableMatchReferences: [], storage: null });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${serverUrl}/api/account/matches?limit=30`, { headers: { Authorization: `Bearer ${authToken}` } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load matches.");
      setData(body);
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [authToken, serverUrl]);

  useEffect(() => { loadMatches(); }, [loadMatches, account?.stats?.gamesPlayed]);
  const replayCount = useMemo(() => (data.matches || []).filter((match) => match.replay?.available).length, [data.matches]);

  if (!account) {
    return <section className="matches-hub matches-signed-out"><span>Match Archive</span><h3>Sign in to see your matches</h3><p>Account matches, Match Records, and replay availability will appear here.</p></section>;
  }

  return (
    <div className="matches-hub">
      <section className="matches-overview" aria-labelledby="matches-overview-title">
        <div><span>Player match archive</span><h3 id="matches-overview-title">Recent Matches</h3><p>Your durable results and currently available authoritative replays.</p></div>
        <div className="matches-overview-stats">
          <div><strong>{(data.matches || []).length + (data.unavailableMatchReferences || []).length}</strong><span>Recent references</span></div>
          <div><strong>{replayCount}</strong><span>Replays available</span></div>
        </div>
        <button type="button" onClick={loadMatches} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
      </section>
      {data.storage?.mode === "account-only" && (
        <p className="matches-storage-note"><strong>Account results are durable.</strong> Full Match Records and replays are process-local, so they can become unavailable after a backend replacement.</p>
      )}
      {error && <p className="matches-error">{error}</p>}
      {!loading && !error && !(data.matches || []).length && !(data.unavailableMatchReferences || []).length && <p className="matches-empty">No completed matches yet.</p>}
      <div className="matches-list">
        {(data.matches || []).map((match) => <AvailableMatchRow key={match.matchId} match={match} onOpenMatch={onOpenMatch} onOpenReplay={onOpenReplay} />)}
        {(data.unavailableMatchReferences || []).map((reference) => <UnavailableReferenceRow key={reference.matchId} reference={reference} />)}
      </div>
      <section className="matches-season-section" aria-labelledby="matches-season-title">
        <div className="matches-section-heading"><span>Seasonal competition</span><h3 id="matches-season-title">Season Zero</h3><p>Season standings are one part of your broader match history.</p></div>
        <SeasonStandings season={season} standings={standings} playerStanding={playerStanding} lifetimeStandings={lifetimeStandings} error={seasonError} onOpenProfile={onOpenProfile} />
      </section>
    </div>
  );
}
