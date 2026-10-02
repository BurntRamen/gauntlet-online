import { useCallback, useEffect, useRef, useState } from "react";
import "./Studio.css";
import GauntletAdmin from "./GauntletAdmin";

function shortId(value) {
  return value ? String(value).slice(0, 10) : "—";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

function Status({ good, children }) {
  return <span className={`studio-status ${good ? "is-good" : "is-warning"}`}>{children}</span>;
}

export default function Studio({ serverUrl, authToken = "", onSignIn, onAuthorizedChange, onClose, exitGuard, onOpenMatch, onOpenReplay }) {
  const sessionRef = useRef("");
  const [authorizedToken, setAuthorizedToken] = useState("");
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewMatchId, setPreviewMatchId] = useState("");
  const [importRecord, setImportRecord] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importMessage, setImportMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  const closeAdmin = useCallback(() => {
    sessionRef.current = "";
    setAuthorizedToken("");
    setOverview(null);
    setImportRecord(null);
    setImportPreview(null);
    setImportMessage("");
    onAuthorizedChange?.(false);
  }, [onAuthorizedChange]);

  useEffect(() => {
    let active = true;
    closeAdmin();
    setError("");
    if (!authToken) return undefined;
    setLoading(true);
    fetch(`${serverUrl}/api/admin/access`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.authorized) throw new Error(body.error || "This account does not have admin access.");
        if (active) {
          sessionRef.current = authToken;
          setAuthorizedToken(authToken);
          onAuthorizedChange?.(true);
        }
      })
      .catch((failure) => { if (active) setError(failure.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; sessionRef.current = ""; };
  }, [authToken, serverUrl, closeAdmin, onAuthorizedChange, attempt]);

  const ownerRequest = useCallback(async (path, options = {}) => {
    const token = sessionRef.current;
    if (!token || token !== authToken) throw new Error("Sign in with an authorized account.");
    const response = await fetch(`${serverUrl}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}), Authorization: `Bearer ${token}` }
    });
    const body = await response.json();
    if (sessionRef.current !== token) throw new Error("Admin session closed.");
    if (response.status === 401 || response.status === 403) closeAdmin();
    if (!response.ok) throw Object.assign(new Error(body.error || "Admin data is unavailable."), { status: response.status });
    return body;
  }, [authToken, closeAdmin, serverUrl]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try { setOverview(await ownerRequest("/api/admin/overview")); setError(""); }
    catch (failure) { setError(failure.message); }
    finally { setLoading(false); }
  }, [ownerRequest]);

  useEffect(() => {
    if (authorizedToken && authorizedToken === authToken) loadOverview();
  }, [authorizedToken, authToken, loadOverview]);

  async function downloadMatchJson(matchId) {
    try {
      const response = await fetch(`${serverUrl}/api/matches/${encodeURIComponent(matchId)}/archive`, {
        headers: { Authorization: `Bearer ${sessionRef.current}` }
      });
      if (!response.ok) throw new Error((await response.json()).error || "Could not download match JSON.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `gauntlet-match-${matchId}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError.message);
    }
  }

  async function verifyArchive(matchId) {
    try {
      const result = await ownerRequest(`/api/admin/match-archive/${encodeURIComponent(matchId)}/verify`, { method: "POST", body: "{}" });
      setImportMessage(`Verified ${shortId(matchId)} · SHA ${result.sha256.slice(0, 16)}…`);
    } catch (verifyError) {
      setError(verifyError.message);
    }
  }

  async function previewImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImportMessage("");
    try {
      const parsed = JSON.parse(await file.text());
      const preview = await ownerRequest("/api/admin/match-archive/import/preview", {
        method: "POST",
        body: JSON.stringify({ record: parsed })
      });
      setImportRecord(parsed);
      setImportPreview(preview);
      setError("");
    } catch (importError) {
      setImportRecord(null);
      setImportPreview(null);
      setError(importError instanceof SyntaxError ? "The selected archive is not valid JSON." : importError.message);
    }
  }

  async function commitImport() {
    if (!importRecord || !importPreview?.sha256) return;
    try {
      const result = await ownerRequest("/api/admin/match-archive/import/commit", {
        method: "POST",
        body: JSON.stringify({ record: importRecord, expectedSha256: importPreview.sha256 })
      });
      setImportMessage(result.status === "already-archived" ? "Already archived · no changes made." : `Imported ${shortId(result.matchId)} successfully.`);
      setImportRecord(null);
      setImportPreview(null);
      await loadOverview();
    } catch (importError) {
      setError(importError.message);
    }
  }

  if (!authorizedToken || authorizedToken !== authToken) {
    return (
      <section className="studio-gate" aria-labelledby="studio-gate-title">
        <span>Gauntlet Admin · private operations</span>
        <h3 id="studio-gate-title">Private administration</h3>
        <p>Gauntlet Admin is restricted to simply and Burnt Ramen. Access is checked by the server using your existing account session.</p>
        {!authToken && <button onClick={onSignIn}>Sign in through Identity</button>}
        {authToken && <button disabled={loading} onClick={() => setAttempt((value) => value + 1)}>{loading ? "Checking access…" : "Check admin access"}</button>}
        {error && <p className="studio-error" role="alert">{error}</p>}
      </section>
    );
  }

  const rooms = overview?.activePlay?.rooms || [];
  const records = overview?.matches?.recent || [];
  const collector = overview?.collector || {};
  const system = overview?.system || {};
  const season = overview?.season || {};
  const operations = overview ? (
    <div className="studio" aria-busy={loading}>
      <header className="studio-header">
        <div><span>Owner operations</span><h3>Gauntlet Studio</h3><p>Safe production projections only—no player hands, deck contents, credentials, or signed claim tokens.</p></div>
        <button type="button" onClick={() => loadOverview()} disabled={loading}>{loading ? "Refreshing…" : "Refresh operations"}</button>
      </header>
      {error && <p className="studio-error" role="alert">{error}</p>}
      <section className="studio-metrics" aria-label="System status">
        <div><span>Backend</span><strong><Status good={system.backendReachable}>{system.backendReachable ? "Reachable" : "Unavailable"}</Status></strong><small>{system.backendCommit ? `Commit ${shortId(system.backendCommit)}` : "Commit not exposed"}</small></div>
        <div><span>Accounts</span><strong>{overview?.accounts?.total ?? 0}</strong><small>{overview?.accounts?.activeRecently ?? 0} active in 7 days</small></div>
        <div><span>Match archive</span><strong><Status good={system.matchArchive?.available}>{system.matchArchive?.available ? "Verified" : "Degraded"}</Status></strong><small>{system.matchArchive?.available ? "Canonical JSON durable" : "Archive target unavailable"}</small></div>
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
        <div className="studio-section-heading"><div><span>Portable canonical history</span><h4>Match Archive</h4></div><small>{overview?.matches?.eventOnlyReplayCount || 0} event-only · {overview?.matches?.unavailableReferenceCount || 0} unavailable</small></div>
        <div className="studio-archive-import">
          <div><strong>Owner recovery import</strong><small>Select canonical record-v2 JSON, validate it, preview it, then explicitly commit.</small></div>
          <label className="studio-file-action">Select JSON<input type="file" accept="application/json,.json" onChange={previewImport} /></label>
        </div>
        {importPreview && (
          <div className="studio-import-preview">
            <strong>{importPreview.status === "already-archived" ? "Already archived" : "Verified · Ready to import"}</strong>
            <span>{(importPreview.preview?.participants || []).map((entry) => entry.displayName).join(" vs ")} · {formatDate(importPreview.preview?.completedAt)}</span>
            <small>SHA-256 {importPreview.sha256} · {importPreview.byteSize} bytes</small>
            <details><summary>Inspect JSON</summary><pre>{JSON.stringify(importRecord, null, 2)}</pre></details>
            <div><button type="button" onClick={commitImport}>{importPreview.status === "already-archived" ? "Confirm No-op" : "Commit Import"}</button><button type="button" onClick={() => { setImportRecord(null); setImportPreview(null); }}>Cancel</button></div>
          </div>
        )}
        {importMessage && <p className="studio-success">{importMessage}</p>}
        {records.length === 0 ? <p className="studio-empty">No recent Match Records.</p> : (
          <div className="studio-records">{records.map((record) => (
            <article key={record.matchId}>
              <div><span>{record.mode || "match"} · {formatDate(record.completedAt)}</span><strong>{shortId(record.matchId)}</strong><small>Record v{record.recordVersion || "?"} · {record.archive?.integrity === "verified" ? `Cloud archived · ${record.archive.byteSize} bytes · ${record.archive.sha256.slice(0, 12)}…` : "Optional cloud archive not configured"}</small></div>
              <div className="studio-record-actions">
                <button type="button" onClick={() => setPreviewMatchId((current) => current === record.matchId ? "" : record.matchId)}>Preview</button>
                <button type="button" onClick={() => onOpenMatch?.(record.matchId)}>Match Record</button>
                {record.replay?.available && <button type="button" onClick={() => onOpenReplay?.(record.matchId)}>Replay</button>}
                {record.archive?.integrity === "verified" && <button type="button" onClick={() => downloadMatchJson(record.matchId)}>Download JSON</button>}
                <button type="button" onClick={() => window.open(`${serverUrl}/api/matches/${encodeURIComponent(record.matchId)}/export/para?version=2`, "_blank", "noopener,noreferrer")}>Para Export</button>
                {record.archive?.integrity === "verified" && <button type="button" onClick={() => verifyArchive(record.matchId)}>Verify Integrity</button>}
              </div>
              {previewMatchId === record.matchId && (
                <dl className="studio-record-preview">
                  <div><dt>Players</dt><dd>{(record.preview?.participants || []).map((entry) => `${entry.displayName} (${entry.faction?.name || "Basic"})`).join(" vs ")}</dd></div>
                  <div><dt>Winner</dt><dd>{record.preview?.participants?.find((entry) => Number(entry.playerNum) === Number(record.preview?.winnerPlayerNum))?.displayName || "Draw"}</dd></div>
                  <div><dt>Turns</dt><dd>{record.preview?.turnCount || 0}</dd></div>
                  <div><dt>Largest attack</dt><dd>{record.preview?.largestAttack?.value ?? "—"}</dd></div>
                  <div><dt>Damage</dt><dd>{record.preview?.damageDealt || 0}</dd></div>
                  <div><dt>Integrity</dt><dd>{record.archive?.integrity || "unavailable"}</dd></div>
                </dl>
              )}
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
  ) : <p role={error ? "alert" : "status"}>{error || "Loading existing operations…"}</p>;
  return <GauntletAdmin exitGuard={exitGuard} request={ownerRequest} onClose={onClose || closeAdmin} operations={operations} />;
}
