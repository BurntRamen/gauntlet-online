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
import { downloadMatchTranscript } from "./matchTranscript";

function formatDate(value) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function titleCase(value) {
  return String(value || "match").replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function MatchPreview({ preview, sha256, id }) {
  if (!preview) return null;
  const winner = preview.participants?.find((entry) => Number(entry.playerNum) === Number(preview.winnerPlayerNum));
  return (
    <dl id={id} className="matches-preview" aria-label="Match record preview">
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
        campaignImage={match.campaignEncounterImage || match.campaign?.image || match.preview?.campaignEncounterImage || match.preview?.campaign?.image}
        label={`${String(outcome).toUpperCase()} ${matchupLabel}`}
      />
      <div className="matches-row-main">
        <div className="matches-result-line"><strong className={`matches-outcome is-${outcome}`}>{titleCase(outcome)}</strong><span>{titleCase(match.mode)}{match.season?.displayName ? ` · ${match.season.displayName}` : ""}</span></div>
        <h3>{`vs ${opponent.displayName || opponentFactionName}`}</h3>
        <p>{player.displayName || "You"} · {playerFactionName} vs {opponentFactionName}</p>
        <p><time dateTime={match.completedAt || undefined}>{formatDate(match.completedAt)}</time>{match.turnCount ? ` · ${match.turnCount} turns` : ""}</p>
        <div className="matches-availability">
        <small className={saved ? "is-available" : "is-unavailable"}>{saved ? "Saved on this device" : "Account record · not saved on device"}</small>
        <small className={match.replay?.available ? "is-available" : "is-unavailable"}>
          {match.replay?.available
            ? match.replay.mode === "public-state-frames" ? "Exact battlefield replay" : "Event timeline replay"
            : match.replay?.unavailableReason || "Replay unavailable"}
        </small>
        </div>
      </div>
      <div className="matches-row-actions">
        <button type="button" className="matches-record-action" onClick={() => onOpenMatch(match)}>View Match Record</button>
        {match.replay?.available && <button type="button" className="matches-primary-action" onClick={() => onOpenReplay(match)}>Watch Replay</button>}
        <div className="matches-tertiary-actions">
          {(match.preview || saved) && <button type="button" className="matches-preview-action" aria-expanded={previewOpen} aria-controls={`match-preview-${match.matchId}`} onClick={onTogglePreview}>{previewOpen ? "Hide Preview" : "Preview Record"}</button>}
          {saved && <button type="button" onClick={() => onDownload(match.matchId)}>Export Match File</button>}
          {saved && <button type="button" onClick={() => onDownload(match.matchId, "txt")}>Export Transcript</button>}
        </div>
      </div>
      {previewOpen && <MatchPreview id={`match-preview-${match.matchId}`} preview={match.preview} sha256={saved ? match.local.sha256 : null} />}
    </article>
  );
}

function UnavailableReferenceRow({ reference }) {
  return (
    <article className="matches-row matches-reference" data-replay-state="unavailable">
      <div className="matches-row-main">
        <span>Result saved to your account</span>
        <h3>Full match record unavailable</h3>
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
        <h2 id="match-import-title">Import Match File</h2>
        <p>Preview a saved Gauntlet file, then watch or save it on this device. Importing does not change account progress, rewards, or standings.</p>
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
        <input ref={inputRef} type="file" aria-label="Choose a Gauntlet match file" accept="application/json,.json" onChange={(event) => inspectFile(event.target.files?.[0])} />
        <button type="button" onClick={() => inputRef.current?.click()}>Choose Match File</button>
        <span>or drop a Gauntlet .json file here</span>
      </div>
      {error && <p className="matches-error" role="alert">{error}</p>}
      {status && <p className="matches-storage-note" role="status">{status}</p>}
      {inspection && (
        <div className="match-import-preview">
          <div className="match-import-integrity"><strong>Valid Gauntlet match file</strong><span>File integrity verified · {inspection.artifact.sha256}</span><small>This check confirms the file is complete and unchanged. Imported files remain player-owned local history.</small></div>
          <MatchPreview preview={inspection.preview} sha256={inspection.artifact.sha256} />
          <div className="matches-row-actions">
            {inspection.replay?.availability?.available
              ? <button type="button" className="matches-primary-action" onClick={() => onWatchReplay(inspection)}>Watch Replay</button>
              : <span className="matches-unavailable-label">{inspection.replay?.availability?.unavailableReason || "This file has no playable replay."}</span>}
            <button type="button" onClick={saveImported}>Save to My Matches</button>
          </div>
        </div>
      )}
    </section>
  );
}

export function RecentMatchShortcut({ account, authToken, serverUrl, onOpenReplay, onOpenMatches, matchLibrary = localMatchLibrary }) {
  const scope = `${account?.id || 'guest'}:${authToken || ''}`;
  const [recent, setRecent] = useState({ scope: '', match: null });
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      const [local, cloud] = await Promise.allSettled([
        matchLibrary.list(),
        authToken ? fetch(`${serverUrl}/api/account/matches?limit=1`, { headers: { Authorization: `Bearer ${authToken}` }, signal: controller.signal }).then(async (response) => {
          if (!response.ok) throw new Error('Account history unavailable');
          return response.json();
        }) : Promise.resolve({ matches: [] })
      ]);
      if (!active) return;
      const matches = mergeMatchHistory(cloud.status === 'fulfilled' ? cloud.value : {}, local.status === 'fulfilled' ? local.value : [], account?.id).matches;
      setRecent({ scope, match: matches[0] || null });
      setError(local.status === 'rejected' || cloud.status === 'rejected' ? 'Some history is unavailable. Open Matches to retry.' : '');
    }
    load();
    const unsubscribe = matchLibrary.subscribe?.(load);
    return () => { active = false; controller.abort(); unsubscribe?.(); };
  }, [account?.id, authToken, serverUrl, matchLibrary, scope]);
  const match = recent.scope === scope ? recent.match : null;
  const opponent = match?.perspective?.opponent?.displayName || match?.perspective?.opponents?.[0]?.displayName;
  async function watch() {
    try {
      if (match.local?.saved) {
        const loaded = await matchLibrary.load(match.matchId);
        if (!loaded) throw new Error('This device replay is no longer available. Open Matches to review it.');
        return onOpenReplay(match.matchId, loaded.replay, localEntryToMatch(loaded.entry, account?.id));
      }
      onOpenReplay(match.matchId);
    } catch (failure) { setError(failure.message); }
  }
  return <section className="cd-utility"><div><span>Recent match</span>
    <strong>{match ? `${titleCase(match.perspective?.outcome || 'Recorded')}${opponent ? ` · vs ${opponent}` : ''}` : 'Your match history'}</strong>
    <small>{match ? `${titleCase(match.mode)} · ${formatDate(match.completedAt)}` : 'Results and available replays, including device saves.'}</small>
    {error && <small role="status">{error}</small>}
    {match && !match.replay?.available && <small>Replay unavailable · view the record in Matches.</small>}
  </div>{match?.replay?.available ? <button onClick={watch}>Watch Replay</button> : <button onClick={onOpenMatches}>Open Matches</button>}</section>;
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
  view = "recent",
  hideStandings = false,
  matchLibrary = localMatchLibrary
}) {
  const [serverData, setServerData] = useState({ matches: [], unavailableMatchReferences: [], storage: null });
  const [localEntries, setLocalEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewMatchId, setPreviewMatchId] = useState("");
  const [loadedPreviews, setLoadedPreviews] = useState({});
  const [visibleCount, setVisibleCount] = useState(20);
  const requestVersion = useRef(0);

  const loadLocalMatches = useCallback(async () => {
    try {
      setLocalEntries(await matchLibrary.list());
    } catch (localError) {
      setError(localError.message);
    }
  }, [matchLibrary]);

  const loadMatches = useCallback(async () => {
    const version = ++requestVersion.current;
    await loadLocalMatches();
    if (version !== requestVersion.current) return;
    if (!authToken) {
      setServerData({ matches: [], unavailableMatchReferences: [], storage: null, scope: authToken });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${serverUrl}/api/account/matches?limit=30`, { headers: { Authorization: `Bearer ${authToken}` } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load matches.");
      if (version !== requestVersion.current) return;
      setServerData({ ...body, scope: authToken });
      setError("");
    } catch (loadError) {
      if (version === requestVersion.current) setError(loadError.message);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [authToken, loadLocalMatches, serverUrl]);

  useEffect(() => { loadMatches(); return () => { requestVersion.current += 1; }; }, [loadMatches, account?.stats?.gamesPlayed]);
  useEffect(() => matchLibrary.subscribe(loadLocalMatches), [loadLocalMatches, matchLibrary]);
  useEffect(() => { setVisibleCount(20); setPreviewMatchId(""); setLoadedPreviews({}); }, [authToken, view]);

  const data = useMemo(() => mergeMatchHistory(serverData.scope === authToken ? serverData : {}, localEntries, account?.id), [account?.id, authToken, localEntries, serverData]);
  const replayCount = useMemo(() => (data.matches || []).filter((match) => match.replay?.available).length, [data.matches]);
  const replayView = view === "replays";
  const standingsOnly = view === "standings";
  const matchingRecords = replayView ? (data.matches || []).filter((match) => match.replay?.available) : data.matches || [];
  const references = replayView ? [] : data.unavailableMatchReferences || [];
  const totalCount = matchingRecords.length + references.length;
  const visibleMatches = matchingRecords.slice(0, visibleCount);
  const visibleReferences = references.slice(0, Math.max(0, visibleCount - matchingRecords.length));

  async function togglePreview(match) {
    if (previewMatchId === match.matchId) { setPreviewMatchId(""); return; }
    setPreviewMatchId(match.matchId);
    // Preserve lazy reads: old device entries are verified only when requested,
    // not while rendering a potentially large local match library.
    if (!match.preview && !loadedPreviews[match.matchId] && match.local?.saved) {
      try {
        const entry = await matchLibrary.get(match.matchId);
        if (!entry) throw new Error("Replay file not saved on this device.");
        const { preview } = localEntryToMatch(entry, account?.id);
        setLoadedPreviews((current) => ({ ...current, [match.matchId]: preview }));
      } catch (previewError) { setError(previewError.message); }
    }
  }

  async function openReplay(match) {
    try {
      if (match.local?.saved) {
        const loaded = await matchLibrary.load(match.matchId);
        if (loaded) return onOpenReplay(match.matchId, loaded.replay, localEntryToMatch(loaded.entry, account?.id));
      }
      return onOpenReplay(match.matchId);
    } catch (replayError) {
      setError(replayError.message || "This replay could not be opened. Try importing the saved match file again.");
    }
  }

  async function openMatch(match) {
    try {
      if (match.local?.saved) {
        const entry = await matchLibrary.get(match.matchId);
        if (entry) return onOpenMatch(match.matchId, localEntryToMatch(entry, account?.id));
      }
      return onOpenMatch(match.matchId);
    } catch (recordError) {
      setError(recordError.message || "This match record could not be opened.");
    }
  }

  async function downloadMatchJson(matchId, format = "json") {
    try {
      const entry = await matchLibrary.get(matchId);
      if (!entry) throw new Error("Replay file not saved on this device.");
      if (format === "txt") {
        const loaded = await matchLibrary.load(matchId);
        if (!loaded?.replay) throw new Error("Match history unavailable.");
        downloadMatchTranscript(loaded.replay);
      } else downloadCanonicalMatch(entry);
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
      {!standingsOnly && <>
      <section className="matches-overview" aria-labelledby="matches-overview-title">
        <div><h2 id="matches-overview-title">{replayView ? "Replay Library" : "Recent Matches"}</h2><p>{replayView ? "Watch available replays or import a saved match." : "Open a result for details, or watch an available replay."}</p></div>
        <span className="matches-overview-count">{replayView ? `${replayCount} available` : `${(data.matches || []).length + (data.unavailableMatchReferences || []).length} results · ${replayCount} replays`}</span>
        <button type="button" onClick={loadMatches} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
      </section>
      {!account && <p className="matches-storage-note">Sign in to see account results alongside replays saved on this device.</p>}
      {localEntries.length > 0 && <p className="matches-storage-note">Device replays stay in this browser. Export a match file to back it up or watch it on another device.</p>}
      {error && <p className="matches-error" role="alert">{error}</p>}
      {!loading && !visibleMatches.length && !visibleReferences.length && <p className="matches-empty">{replayView ? "No playable replays are available yet. Import a saved match file below." : "No completed match records are available yet."}</p>}
      <div className="matches-list" aria-busy={loading}>
        {visibleMatches.map((match) => (
          <MatchRow
            key={match.matchId}
            match={loadedPreviews[match.matchId] ? { ...match, preview: loadedPreviews[match.matchId] } : match}
            onOpenMatch={openMatch}
            onOpenReplay={openReplay}
            onDownload={downloadMatchJson}
            previewOpen={previewMatchId === match.matchId}
            onTogglePreview={() => togglePreview(match)}
          />
        ))}
        {visibleReferences.map((reference) => <UnavailableReferenceRow key={reference.matchId} reference={reference} />)}
      </div>
      {visibleCount < totalCount && <button type="button" className="matches-ranked-action" onClick={() => setVisibleCount((count) => count + 20)}>Show more matches ({Math.min(visibleCount, totalCount)} of {totalCount})</button>}
      <MatchImporter library={matchLibrary} onWatchReplay={watchImported} onSaved={loadLocalMatches} />
      </>}
      {!hideStandings && <section className="matches-season-section" aria-labelledby="matches-season-title">
        <div className="matches-section-heading"><h2 id="matches-season-title">{season?.displayName || "Season Standings"}</h2><p>Ranked results appear here; imported match files never change the standings.</p></div>
        {onOpenRanked && <button type="button" className="matches-ranked-action" onClick={onOpenRanked}>Open Ranked Setup</button>}
        <SeasonStandings season={season} standings={standings} playerStanding={playerStanding} lifetimeStandings={lifetimeStandings} error={seasonError} onOpenProfile={onOpenProfile} />
      </section>}
    </div>
  );
}
