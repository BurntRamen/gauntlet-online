import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SeasonStandings } from "./SeasonZero";
import { MatchThumbnail } from "./GauntletVisuals";
import {
  downloadCanonicalMatch,
  localEntryToMatch,
  localMatchLibrary,
  mergeMatchHistory
} from "./matchHistory";
import "./MatchesHub.css";

function formatDate(value) {
  if (!value) return "Unknown date";
  return new Date(value).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function titleCase(value) {
  return String(value || "match").replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function MatchPreview({ preview, sha256 }) {
  if (!preview) return null;
  const winner = preview.participants?.find((entry) => Number(entry.playerNum) === Number(preview.winnerPlayerNum));
  return (
    <dl className="matches-preview" aria-label={`Match ${preview.matchId} preview`}>
      <div><dt>Players</dt><dd>{(preview.participants || []).map((entry) => `${entry.displayName} (${entry.faction?.name || "Basic"})`).join(" vs ")}</dd></div>
      <div><dt>Winner</dt><dd>{winner?.displayName || "Draw"}</dd></div>
      <div><dt>Date</dt><dd>{formatDate(preview.completedAt)}</dd></div>
      <div><dt>Mode</dt><dd>{titleCase(preview.mode)}</dd></div>
      <div><dt>Turns</dt><dd>{preview.turnCount || 0}</dd></div>
      <div><dt>Final life</dt><dd>{(preview.participants || []).map((entry) => `${entry.displayName} ${entry.finalLife}`).join(" · ")}</dd></div>
      <div><dt>Largest attack</dt><dd>{preview.largestAttack?.value ?? "—"}</dd></div>
      <div><dt>Replay detail</dt><dd>{preview.evidenceCount ?? preview.replay?.evidenceCount ?? 0} events · {preview.replayFrameCount ?? preview.replay?.frameCount ?? 0} scenes</dd></div>
      {sha256 && <div><dt>File check</dt><dd>Match file verified · {sha256.slice(0, 12)}…</dd></div>}
    </dl>
  );
}

function MatchRow({ match, onOpenMatch, onOpenReplay, onDownload, previewOpen, onTogglePreview }) {
  const perspective = match.perspective || {};
  const player = perspective.player || match.participants?.[0] || {};
  const opponent = perspective.opponent || perspective.opponents?.[0]
    || match.participants?.find((entry) => entry.participantId !== player.participantId) || {};
  const previewPlayer = match.preview?.participants?.find((entry) => entry.displayName === player.displayName)
    || match.preview?.participants?.[0];
  const previewOpponent = match.preview?.participants?.find((entry) => entry.displayName === opponent.displayName)
    || match.preview?.participants?.find((entry) => entry.displayName !== previewPlayer?.displayName);
  const outcome = perspective.outcome || player.result || "recorded";
  const saved = !!match.local?.saved;
  const playerFaction = player.faction || previewPlayer?.faction;
  const opponentFaction = opponent.faction || previewOpponent?.faction;
  const playerFactionName = playerFaction?.name || "Basic Gauntlet";
  const opponentFactionName = opponentFaction?.name || "Basic Gauntlet";
  const matchupLabel = `${playerFactionName} versus ${opponentFactionName}`;
  return (
    <article className="matches-row" data-replay-state={match.replay?.available ? "available" : "unavailable"} data-local-match={saved ? "true" : "false"}>
      <MatchThumbnail
        playerFaction={playerFaction}
        opponentFaction={opponentFaction}
        outcome={outcome}
        explicitThumbnail={match.thumbnail || match.preview?.thumbnail || match.replay?.thumbnail}
        campaignImage={match.campaignEncounterImage || match.preview?.campaignEncounterImage}
        label={`${String(outcome).toUpperCase()} ${matchupLabel}`}
      />
      <div className="matches-row-main">
        <span>{titleCase(match.mode)}{match.season?.displayName ? ` · ${match.season.displayName}` : ""}</span>
        <h3>{`${playerFactionName} vs ${opponent.displayName || opponentFactionName}`}</h3>
        <p>{player.displayName || "You"} · opponent faction {opponentFactionName} · {formatDate(match.completedAt)} · {match.turnCount || 1} turns</p>
        <div className="matches-availability">
        <small className={saved ? "is-available" : "is-unavailable"}>{saved ? "Saved locally" : "Not saved locally"}</small>
        <small className={match.replay?.available ? "is-available" : "is-unavailable"}>
          {match.replay?.available
            ? match.replay.mode === "public-state-frames" ? "Exact battlefield replay" : "Event timeline replay"
            : match.replay?.unavailableReason || "Replay unavailable"}
        </small>
        </div>
      </div>
      <div className="matches-row-actions">
        {match.replay?.available && <button type="button" className="matches-primary-action" onClick={() => onOpenReplay(match)}>Watch Replay</button>}
        {!match.replay?.available && <span className="matches-unavailable-label">Replay unavailable</span>}
        <button type="button" className="matches-preview-action" aria-label={previewOpen ? "Hide Preview" : "Preview"} onClick={onTogglePreview}>{previewOpen ? "Hide Preview" : "Preview Record"}</button>
        <div className="matches-tertiary-actions">
          <button type="button" onClick={() => onOpenMatch(match)}>Match Record</button>
          {saved && <button type="button" onClick={() => onDownload(match.matchId)}>Export JSON</button>}
        </div>
      </div>
      {previewOpen && <MatchPreview preview={match.preview} sha256={saved ? match.local.sha256 : null} />}
    </article>
  );
}

function UnavailableReferenceRow({ reference }) {
  return (
    <article className="matches-row matches-reference" data-replay-state="unavailable">
      <MatchThumbnail outcome="recorded" label="Recorded match without faction information" />
      <div className="matches-row-main">
        <span>Result saved to your account</span>
        <h3>Match {String(reference.matchId || "").slice(0, 8)}</h3>
        <p>{formatDate(reference.completedAt)}</p>
        <small className="is-unavailable">Replay file not saved on this device.</small>
      </div>
      <div className="matches-row-actions"><span className="matches-unavailable-label">Import a saved match file to replay</span></div>
    </article>
  );
}

function MatchImporter({ library, onWatchReplay, onSaved }) {
  const inputRef = useRef(null);
  const [inspection, setInspection] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [dragging, setDragging] = useState(false);

  async function inspectFile(file) {
    if (!file) return;
    setStatus("");
    try {
      const text = await file.text();
      setInspection(library.inspect(text));
      setError("");
    } catch (importError) {
      setInspection(null);
      setError(`${importError.message}${importError.code ? ` (${importError.code})` : ""}`);
    }
  }

  async function saveImported() {
    if (!inspection) return;
    try {
      const result = await library.save(inspection.artifact.json, { source: "manual-import" });
      setStatus(result.status === "already-saved" ? "This match is already saved on this device." : "Saved to My Matches.");
      setError("");
      onSaved();
    } catch (saveError) {
      setError(`${saveError.message}${saveError.code ? ` (${saveError.code})` : ""}`);
    }
  }

  return (
    <section className="match-importer" aria-labelledby="match-import-title">
      <div>
        <span>Bring back a saved replay</span>
        <h3 id="match-import-title">Import Match File</h3>
        <p>Choose a Gauntlet match file to preview and replay it here. Importing never changes account progress, rewards, achievements, collection ownership, or Season Zero standings.</p>
      </div>
      <div
        className={`match-import-drop${dragging ? " is-dragging" : ""}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          inspectFile(event.dataTransfer.files?.[0]);
        }}
      >
        <input ref={inputRef} type="file" accept="application/json,.json" onChange={(event) => inspectFile(event.target.files?.[0])} />
        <button type="button" onClick={() => inputRef.current?.click()}>Choose Match File</button>
        <span>or drop a Gauntlet `.json` file here</span>
      </div>
      {error && <p className="matches-error" role="alert">{error}</p>}
      {status && <p className="matches-storage-note" role="status">{status}</p>}
      {inspection && (
        <div className="match-import-preview">
          <div className="match-import-integrity"><strong>Valid Gauntlet match file</strong><span>File integrity verified · {inspection.artifact.sha256}</span><small>This check confirms the file is complete and unchanged. Imported files remain player-owned local history.</small></div>
          <MatchPreview preview={inspection.preview} sha256={inspection.artifact.sha256} />
          <div className="matches-row-actions">
            <button type="button" className="matches-primary-action" onClick={() => onWatchReplay(inspection)}>Watch Replay</button>
            <button type="button" onClick={saveImported}>Save to My Matches</button>
          </div>
        </div>
      )}
    </section>
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
  onOpenReplay,
  onOpenRanked,
  matchLibrary = localMatchLibrary
}) {
  const [serverData, setServerData] = useState({ matches: [], unavailableMatchReferences: [], storage: null });
  const [localEntries, setLocalEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewMatchId, setPreviewMatchId] = useState("");

  const loadLocalMatches = useCallback(async () => {
    try {
      setLocalEntries(await matchLibrary.list());
    } catch (localError) {
      setError(localError.message);
    }
  }, [matchLibrary]);

  const loadMatches = useCallback(async () => {
    await loadLocalMatches();
    if (!authToken) {
      setServerData({ matches: [], unavailableMatchReferences: [], storage: null });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${serverUrl}/api/account/matches?limit=30`, { headers: { Authorization: `Bearer ${authToken}` } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load matches.");
      setServerData(body);
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [authToken, loadLocalMatches, serverUrl]);

  useEffect(() => { loadMatches(); }, [loadMatches, account?.stats?.gamesPlayed]);
  useEffect(() => matchLibrary.subscribe(loadLocalMatches), [loadLocalMatches, matchLibrary]);

  const data = useMemo(() => mergeMatchHistory(serverData, localEntries, account?.id), [account?.id, localEntries, serverData]);
  const replayCount = useMemo(() => (data.matches || []).filter((match) => match.replay?.available).length, [data.matches]);

  async function openReplay(match) {
    if (match.local?.saved) {
      const loaded = await matchLibrary.load(match.matchId);
      if (loaded) return onOpenReplay(match.matchId, loaded.replay, localEntryToMatch(loaded.entry, account?.id));
    }
    return onOpenReplay(match.matchId);
  }

  async function openMatch(match) {
    if (match.local?.saved) {
      const entry = await matchLibrary.get(match.matchId);
      if (entry) return onOpenMatch(match.matchId, localEntryToMatch(entry, account?.id));
    }
    return onOpenMatch(match.matchId);
  }

  async function downloadMatchJson(matchId) {
    try {
      const entry = await matchLibrary.get(matchId);
      if (!entry) throw new Error("Replay file not saved on this device.");
      downloadCanonicalMatch(entry);
      setError("");
    } catch (downloadError) {
      setError(downloadError.message);
    }
  }

  function watchImported(inspection) {
    onOpenReplay(inspection.artifact.record.matchId, inspection.replay, localEntryToMatch({
      ...inspection.artifact.index,
      canonicalJson: inspection.artifact.json,
      sha256: inspection.artifact.sha256,
      byteSize: inspection.artifact.byteSize,
      source: "preview-import"
    }, account?.id));
  }

  return (
    <div className="matches-hub">
      <section className="matches-overview" aria-labelledby="matches-overview-title">
        <div><span>Your match history</span><h3 id="matches-overview-title">Recent Matches</h3><p>Recent results and replays available on this device.</p></div>
        <div className="matches-overview-stats">
          <div><strong>{(data.matches || []).length + (data.unavailableMatchReferences || []).length}</strong><span>Recent matches</span></div>
          <div><strong>{localEntries.length}</strong><span>Saved on device</span></div>
          <div><strong>{replayCount}</strong><span>Replays available</span></div>
        </div>
        <button type="button" onClick={loadMatches} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
      </section>
      <p className="matches-storage-note"><strong>Your saved replays travel with you.</strong> Export a match file to keep it, back it up, or replay it on another device.</p>
      {!account && <p className="matches-storage-note">Sign in to see account results alongside replays saved on this device.</p>}
      {error && <p className="matches-error">{error}</p>}
      {!loading && !(data.matches || []).length && !(data.unavailableMatchReferences || []).length && <p className="matches-empty">No completed matches are saved on this device yet.</p>}
      <div className="matches-list">
        {(data.matches || []).map((match) => (
          <MatchRow
            key={match.matchId}
            match={match}
            onOpenMatch={openMatch}
            onOpenReplay={openReplay}
            onDownload={downloadMatchJson}
            previewOpen={previewMatchId === match.matchId}
            onTogglePreview={() => setPreviewMatchId((current) => current === match.matchId ? "" : match.matchId)}
          />
        ))}
        {(data.unavailableMatchReferences || []).map((reference) => <UnavailableReferenceRow key={reference.matchId} reference={reference} />)}
      </div>
      <MatchImporter library={matchLibrary} onWatchReplay={watchImported} onSaved={loadLocalMatches} />
      <section className="matches-season-section" aria-labelledby="matches-season-title">
        <div className="matches-section-heading"><span>Seasonal competition</span><h3 id="matches-season-title">Season Zero</h3><p>Ranked results appear here; imported match files never change the standings.</p></div>
        {onOpenRanked && <button type="button" className="matches-ranked-action" onClick={onOpenRanked}>Play Ranked</button>}
        <SeasonStandings season={season} standings={standings} playerStanding={playerStanding} lifetimeStandings={lifetimeStandings} error={seasonError} onOpenProfile={onOpenProfile} />
      </section>
    </div>
  );
}
