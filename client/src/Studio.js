import { useCallback, useEffect, useRef, useState } from "react";
import "./Studio.css";

function shortId(value) {
  return value ? String(value).slice(0, 10) : "—";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

function Status({ good, children }) {
  return <span className={`studio-status ${good ? "is-good" : "is-warning"}`}>{children}</span>;
}

export default function Studio({ serverUrl, onAuthorizedChange, onOpenMatch, onOpenReplay }) {
  const sessionRef = useRef("");
  const [ownerToken, setOwnerToken] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async (sessionToken = sessionRef.current) => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const response = await fetch(`${serverUrl}/api/admin/overview`, {
        headers: { "x-owner-session": sessionToken }
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load Studio operations.");
      setOverview(body);
      setError("");
    } catch (loadError) {
      setError(loadError.message);
      if (/authorization/i.test(loadError.message)) {
        sessionRef.current = "";
        setAuthorized(false);
        onAuthorizedChange?.(false);
      }
    } finally {
      setLoading(false);
    }
  }, [onAuthorizedChange, serverUrl]);

  useEffect(() => () => {
    sessionRef.current = "";
  }, []);

  async function authorize(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${serverUrl}/api/admin/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerToken })
      });
      const body = await response.json();
      setOwnerToken("");
      if (!response.ok) throw new Error(body.error || "Owner authorization failed.");
      sessionRef.current = body.sessionToken;
      setAuthorized(true);
      onAuthorizedChange?.(true);
      await loadOverview(body.sessionToken);
    } catch (authorizationError) {
      setError(authorizationError.message);
      setAuthorized(false);
      onAuthorizedChange?.(false);
    } finally {
      setLoading(false);
    }
  }

  if (!authorized) {
    return (
      <section className="studio-gate" aria-labelledby="studio-gate-title">
        <span>Private operations</span>
        <h3 id="studio-gate-title">Owner authorization required</h3>
        <p>Studio is not linked from the player experience. The owner credential is exchanged for a short-lived, memory-only session and is never stored in the browser.</p>
        <form onSubmit={authorize}>
          <label htmlFor="studio-owner-token">Owner token</label>
          <input id="studio-owner-token" type="password" autoComplete="off" value={ownerToken} onChange={(event) => setOwnerToken(event.target.value)} />
          <button type="submit" disabled={!ownerToken || loading}>{loading ? "Authorizing…" : "Open Studio"}</button>
        </form>
        {error && <p className="studio-error" role="alert">{error}</p>}
      </section>
    );
  }

  const rooms = overview?.activePlay?.rooms || [];
  const records = overview?.matches?.recent || [];
  const collector = overview?.collector || {};
  const system = overview?.system || {};
  const season = overview?.season || {};
  return (
    <div className="studio" aria-busy={loading}>
      <header className="studio-header">
        <div><span>Owner operations</span><h3>Gauntlet Studio</h3><p>Safe production projections only—no player hands, deck contents, credentials, or signed claim tokens.</p></div>
        <button type="button" onClick={() => loadOverview()} disabled={loading}>{loading ? "Refreshing…" : "Refresh operations"}</button>
      </header>
      {error && <p className="studio-error" role="alert">{error}</p>}
      <section className="studio-metrics" aria-label="System status">
        <div><span>Backend</span><strong><Status good={system.backendReachable}>{system.backendReachable ? "Reachable" : "Unavailable"}</Status></strong><small>{system.backendCommit ? `Commit ${shortId(system.backendCommit)}` : "Commit not exposed"}</small></div>
        <div><span>Accounts</span><strong>{overview?.accounts?.total ?? 0}</strong><small>{overview?.accounts?.activeRecently ?? 0} active in 7 days</small></div>
        <div><span>Match storage</span><strong><Status good={system.matchStorage !== "account-only"}>{system.matchStorage || "unknown"}</Status></strong><small>{system.matchStorage === "account-only" ? "Results durable; full replays process-local" : "Full records durable"}</small></div>
        <div><span>Active play</span><strong>{rooms.length}</strong><small>{overview?.activePlay?.rankedQueue || 0} ranked queued</small></div>
        <div><span>Replay health</span><strong>{overview?.matches?.exactFrameReplayCount || 0}</strong><small>{overview?.matches?.unavailableReferenceCount || 0} unavailable references</small></div>
        <div><span>Collector</span><strong>{collector.redeemedCount || 0}</strong><small>{collector.pendingCount || 0} issued pending</small></div>
      </section>

      <section className="studio-panel">
        <div className="studio-section-heading"><div><span>Live service</span><h4>Active rooms</h4></div><small>Ranked {overview?.activePlay?.rankedQueue || 0} · Draft player {overview?.activePlay?.draftQueues?.player || 0} · bot {overview?.activePlay?.draftQueues?.bot || 0}</small></div>
        {rooms.length === 0 ? <p className="studio-empty">No rooms are active.</p> : (
          <div className="studio-table-scroll"><table><thead><tr><th>Room</th><th>Mode</th><th>Players</th><th>State</th><th>Spectators</th></tr></thead><tbody>{rooms.map((room) => (
            <tr key={room.roomCode}><td>{room.roomCode}</td><td>{room.mode}{room.ranked ? " · ranked" : ""}</td><td>{(room.players || []).map((player) => player.displayName || `P${player.playerNum}`).join(" vs ")}</td><td>{room.phase || room.lifecycleStatus || "lobby"}</td><td>{room.spectatorCount || 0}</td></tr>
          ))}</tbody></table></div>
        )}
      </section>

      <section className="studio-panel">
        <div className="studio-section-heading"><div><span>Authoritative history</span><h4>Recent Match Records</h4></div><small>{overview?.matches?.eventOnlyReplayCount || 0} event-only · {overview?.matches?.unavailableReferenceCount || 0} unavailable</small></div>
        {records.length === 0 ? <p className="studio-empty">No recent Match Records.</p> : (
          <div className="studio-records">{records.map((record) => (
            <article key={record.matchId}>
              <div><span>{record.mode || "match"} · {formatDate(record.completedAt)}</span><strong>{shortId(record.matchId)}</strong><small>Record v{record.recordVersion || "?"} · {record.replay?.actionCount || 0} replay actions · Para {record.paraExportAvailable ? "ready" : "unavailable"}</small></div>
              <div><button type="button" onClick={() => onOpenMatch?.(record.matchId)}>Record</button>{record.replay?.available && <button type="button" onClick={() => onOpenReplay?.(record.matchId)}>Replay</button>}</div>
            </article>
          ))}</div>
        )}
      </section>

      <section className="studio-two-column">
        <div className="studio-panel"><div className="studio-section-heading"><div><span>Competition</span><h4>{season.definition?.displayName || "Season"}</h4></div><small>{season.gameCount || 0} games · {season.participantCount || 0} players · {season.activeMatchCount || 0} live</small></div><ol className="studio-standings">{(season.standings || []).slice(0, 10).map((entry) => <li key={entry.accountId}><strong>{entry.name}</strong><span>{entry.points || 0} pts · {entry.wins || 0}W {entry.losses || 0}L</span></li>)}</ol></div>
        <div className="studio-panel"><div className="studio-section-heading"><div><span>Physical ↔ Digital</span><h4>Collector receipts</h4></div><small>{collector.issuedCount || 0} issued · {collector.redeemedCount || 0} redeemed</small></div><div className="studio-receipts">{(collector.issuances || []).slice(0, 10).map((receipt) => <div key={receipt.entitlementId}><strong>{receipt.productId}</strong><span>{receipt.account?.name || shortId(receipt.account?.id)} · {receipt.redeemed ? "redeemed" : "pending"}</span><small>{formatDate(receipt.issuedAt)}</small></div>)}</div></div>
      </section>
      <p className="studio-generated">Generated {formatDate(overview?.generatedAt)} · account storage {system.accountStorage || "unknown"} · Supabase {system.supabaseConfigured ? "configured" : "not configured"}</p>
    </div>
  );
}
