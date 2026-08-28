import "./CompetitiveIdentity.css";
import { DeckVisual } from "./GauntletVisuals";
import { PlayerAvatar } from "./ProfileAvatar";
import { CardBackArt, getCardBackDefinition } from "./CardBackArt";

const DOSSIER_FACTIONS = new Set(["rumin", "sheen", "frumo", "bizi", "xendra"]);

function factionArt(factionId) {
  return factionId ? `${process.env.PUBLIC_URL || ""}/assets/gauntlet/${factionId}-card.webp` : "";
}

function contentArt(path) {
  if (!path) return "";
  if (/^(?:data:|https?:)/i.test(path)) return path;
  return `${process.env.PUBLIC_URL || ""}${path.startsWith("/") ? path : `/${path}`}`;
}

function recordForProfile(profile, match) {
  return match?.participants?.find((participant) => participant.accountId === profile?.accountId) || null;
}

function formatDate(value) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function resultClass(result) {
  return result === "win" ? "win" : result === "loss" ? "loss" : "draw";
}

function identityFaction(profile) {
  const selectedBadge = profile?.identity?.selectedFactionBadge;
  if (DOSSIER_FACTIONS.has(selectedBadge)) return selectedBadge;
  const recorded = profile?.factionRecords?.[0]?.factionId;
  if (DOSSIER_FACTIONS.has(recorded)) return recorded;
  return [...(profile?.campaignRecords || [])]
    .sort((left, right) => (right.completed || 0) - (left.completed || 0))[0]?.factionId || "basic";
}

function recordLabel(record = {}) {
  return `${record.wins || 0}W ${record.losses || 0}L ${record.draws || 0}D`;
}

function percentage(value, total) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function MatchRows({ profile, matches, onOpenMatch, onOpenReplay }) {
  if (!matches?.length) {
    return (
      <div className="competitive-history-empty">
        <CardBackArt cardBackId={profile?.identity?.selectedCardBack} className="competitive-empty-card-back" decorative />
        <div>
          <span>Archive awaiting first entry</span>
          <strong>No verified match records yet</strong>
          <p>Completed matches will appear here with opponent, faction, turn count, result, and replay access.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="competitive-match-list">
      {matches.map((match) => {
        const participant = recordForProfile(profile, match);
        const opponent = match.participants?.find((entry) => entry.accountId !== profile.accountId && entry.identityType !== "ai")
          || match.participants?.find((entry) => entry.accountId !== profile.accountId)
          || null;
        const participantFactionId = participant?.faction?.id;
        const matchArt = contentArt(match.campaign?.image) || factionArt(participantFactionId);
        const matchLabel = `${String(participant?.result || "record").toUpperCase()} ${participant?.faction?.name || "Basic"} vs ${opponent?.displayName || "Opponent"}`;
        return (
          <div className="competitive-match-row" key={match.matchId}>
            <button type="button" className="competitive-match-main" aria-label={matchLabel} onClick={() => onOpenMatch(match.matchId)}>
              <span className="competitive-faction-mark" aria-hidden="true" style={matchArt ? { backgroundImage: `linear-gradient(rgba(5,8,12,0.08), rgba(5,8,12,0.58)), url(${matchArt})` } : undefined} />
              <span className={`competitive-result ${resultClass(participant?.result)}`}>{String(participant?.result || "record").toUpperCase()}</span>
              <span>
                <strong>{participant?.faction?.name || "Basic"} vs {opponent?.displayName || "Opponent"}</strong>
                <small>{match.season?.displayName || (match.ranked ? "Ranked" : match.mode)} / {formatDate(match.completedAt)}</small>
              </span>
              <span className="competitive-match-meta">T{match.turnCount || 1}</span>
            </button>
            {match.replay?.available && (
              <button type="button" className="competitive-replay-direct" aria-label={`Replay ${participant?.faction?.name || "Basic"} vs ${opponent?.displayName || "Opponent"}`} onClick={() => onOpenReplay?.(match.matchId)}>Replay</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProfileBody({ profile, serverUrl, onOpenMatch, onOpenReplay }) {
  const ranked = profile.competitiveRecord?.ranked || {};
  const all = profile.competitiveRecord?.all || {};
  const activeSeason = profile.competitiveRecord?.activeSeason || null;
  const seasonRecord = activeSeason?.record || {};
  const identityFactionId = identityFaction(profile);
  const cardBack = getCardBackDefinition(profile.identity?.selectedCardBack);
  const campaignRecords = profile.campaignRecords || [];
  const achievements = profile.achievements || [];
  const factionRecords = profile.factionRecords || [];
  return (
    <>
      <div className="competitive-profile-header" style={identityFactionId !== "basic" ? { backgroundImage: `linear-gradient(90deg, rgba(5,11,18,0.99), rgba(5,11,18,0.86) 43%, rgba(5,11,18,0.35)), url(${factionArt(identityFactionId)})` } : undefined}>
        <div className="competitive-profile-persona">
          <PlayerAvatar subject={profile} name={profile.displayName} serverUrl={serverUrl} size="large" />
          <div>
            <span className="competitive-kicker">{profile.identity?.selectedTitleName || profile.identity?.selectedTitle || "Recruit"}</span>
            <h1>{profile.displayName}</h1>
            <p>Joined {formatDate(profile.memberSince)} · {profile.verifiedMatchCount || 0} verified match archives</p>
            <div className="competitive-identity-tags">
              <span>{profile.identity?.selectedFactionBadgeName || "No Badge"}</span>
              <span>{cardBack.name}</span>
              <span>{profile.lastSeenAt ? `Active ${formatDate(profile.lastSeenAt)}` : "Activity private"}</span>
            </div>
          </div>
        </div>
        <div className="competitive-record-block">
          <span>Lifetime command record</span>
          <strong>{recordLabel(all)}</strong>
          <small>{all.winRate || 0}% win rate across recorded modes</small>
        </div>
        <aside className="competitive-equipped-back" aria-label={`Equipped card back: ${cardBack.name}`}>
          <CardBackArt cardBackId={cardBack.id} decorative />
          <span>Equipped card back</span>
          <strong>{cardBack.name}</strong>
          <small>{cardBack.description}</small>
        </aside>
      </div>

      <section className="competitive-dossier-ribbon" aria-label="Dossier summary">
        <div><span>Dossier status</span><strong>{profile.verifiedMatchCount ? "Verified competitor" : "Record established"}</strong></div>
        <div><span>Current insignia</span><strong>{profile.identity?.selectedFactionBadgeName || "No Badge"}</strong></div>
        <div><span>Collected honors</span><strong>{achievements.length}</strong></div>
        <div><span>Campaign clears</span><strong>{campaignRecords.reduce((sum, record) => sum + (record.completed || 0), 0)}</strong></div>
      </section>

      <section className="competitive-stat-band" aria-label="Competitive statistics">
        <div><span>Lifetime record</span><strong>{recordLabel(all)}</strong><small>{all.gamesPlayed || 0} games tracked</small></div>
        <div><span>Ranked record</span><strong>{recordLabel(ranked)}</strong><small>{ranked.winRate || 0}% win rate</small></div>
        <div><span>Largest attack</span><strong>{profile.notableStats?.largestAttack?.value || 0}</strong><small>verified value</small></div>
        <div><span>Damage dealt</span><strong>{profile.notableStats?.totalDamageDealt || 0}</strong><small>verified archives</small></div>
        <div><span>Damage prevented</span><strong>{profile.notableStats?.totalDamagePrevented || 0}</strong><small>verified archives</small></div>
      </section>

      {activeSeason && (
        <section className="competitive-season" aria-label={`${activeSeason.season?.displayName || "Season"} record`}>
          <div className="competitive-season-title"><span>Current season</span><h2>{activeSeason.season?.displayName}</h2><small>{activeSeason.season?.code || "Competitive circuit"}</small></div>
          <div><span>Rank</span><strong>{activeSeason.rank ? `#${activeSeason.rank}` : "Unranked"}</strong></div>
          <div><span>Points</span><strong>{seasonRecord.points || 0}</strong></div>
          <div><span>Game record</span><strong>{recordLabel(seasonRecord)}</strong></div>
          <div><span>Series record</span><strong>{seasonRecord.seriesWins || 0}W {seasonRecord.seriesLosses || 0}L {seasonRecord.seriesDraws || 0}D</strong></div>
        </section>
      )}

      <section className="competitive-dossier-section competitive-campaign-archive" aria-labelledby="competitive-campaign-title">
        <header className="competitive-section-heading">
          <div><span>Commander archives</span><h2 id="competitive-campaign-title">Campaign progress</h2></div>
          <p>Chapter clears are recorded by faction campaign.</p>
        </header>
        <div className="competitive-campaign-grid">
          {campaignRecords.map((campaign) => {
            const progress = percentage(campaign.completed, campaign.total);
            const art = contentArt(campaign.coverImage) || factionArt(campaign.factionId);
            return (
              <article className="competitive-campaign-card" key={campaign.factionId} style={art ? { backgroundImage: `linear-gradient(180deg, rgba(3,9,15,.08), rgba(3,9,15,.95)), url(${art})` } : undefined}>
                <span>{campaign.factionName} archive</span>
                <strong>{campaign.title || `${campaign.factionName} campaign`}</strong>
                <p>{campaign.pitch}</p>
                <div><span>{campaign.completed}/{campaign.total} chapters</span><b>{progress}%</b></div>
                <i aria-label={`${campaign.factionName}: ${progress}% complete`}><b style={{ width: `${progress}%` }} /></i>
              </article>
            );
          })}
        </div>
      </section>

      <section className="competitive-dossier-section" aria-labelledby="competitive-honors-title">
        <header className="competitive-section-heading">
          <div><span>Honor case</span><h2 id="competitive-honors-title">Earned achievements</h2></div>
          <p>{achievements.length ? `${achievements.length} verified honors on display.` : "The first verified honor is still ahead."}</p>
        </header>
        {achievements.length ? (
          <div className="competitive-honor-grid">
            {achievements.slice(0, 8).map((achievement) => {
              const wonFaction = String(achievement.id || "").startsWith("win-") ? String(achievement.id).slice(4) : identityFactionId;
              const art = DOSSIER_FACTIONS.has(wonFaction) ? factionArt(wonFaction) : factionArt(identityFactionId);
              return (
                <article className="competitive-honor-card" key={achievement.id} style={art ? { backgroundImage: `linear-gradient(100deg, rgba(5,13,21,.35), rgba(5,13,21,.96)), url(${art})` } : undefined}>
                  <span aria-hidden="true">✦</span>
                  <div><small>Verified honor</small><strong>{achievement.name}</strong><p>{achievement.description}</p></div>
                  <time dateTime={achievement.unlockedAt || undefined}>{formatDate(achievement.unlockedAt)}</time>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="competitive-honor-empty" style={identityFactionId !== "basic" ? { backgroundImage: `linear-gradient(90deg, rgba(4,11,18,.94), rgba(4,11,18,.72)), url(${factionArt(identityFactionId)})` } : undefined}>
            <span aria-hidden="true">✦</span><div><strong>First honor pending</strong><p>A first victory, faction win, campaign clear, or booster claim will place a permanent commendation here.</p></div>
          </div>
        )}
      </section>

      <div className="competitive-columns">
        <section className="competitive-dossier-section">
          <header className="competitive-section-heading"><div><span>Combat ledger</span><h2>Faction record</h2></div></header>
          {factionRecords.length ? factionRecords.map((faction) => {
            const games = (faction.wins || 0) + (faction.losses || 0) + (faction.draws || 0);
            return (
              <div className="competitive-faction-line" key={faction.factionId}>
                <span className="competitive-faction-portrait" aria-hidden="true" style={{ backgroundImage: `linear-gradient(rgba(5,8,12,.12), rgba(5,8,12,.68)), url(${factionArt(faction.factionId)})` }} />
                <span><strong>{faction.factionName}</strong><small>{games} verified games · {percentage(faction.wins, games)}% wins</small></span>
                <b>{recordLabel(faction)}</b>
              </div>
            );
          }) : (
            <div className="competitive-ledger-empty"><strong>No faction record filed</strong><p>The first completed faction match will establish this combat ledger.</p></div>
          )}
        </section>

        <section className="competitive-dossier-section">
          <header className="competitive-section-heading"><div><span>Armory display</span><h2>Featured decks</h2></div></header>
          {profile.featuredDecks?.length ? profile.featuredDecks.map((deck) => (
            <div className="competitive-featured-deck" key={deck.id}>
              <DeckVisual deck={deck} art={deck.featuredArt} decorative />
              <span><strong>{deck.name}</strong><small>{deck.factionName} · {deck.format}</small></span>
              <span>{deck.record?.wins || 0}W {deck.record?.losses || 0}L</span>
            </div>
          )) : (
            <div className="competitive-deck-empty">
              <CardBackArt cardBackId={cardBack.id} decorative />
              <div><strong>No deck on display</strong><p>A deck marked Featured in the Build archive will appear here with its live record.</p></div>
            </div>
          )}
        </section>
      </div>

      <section className="competitive-history competitive-dossier-section">
        <header className="competitive-section-heading"><div><span>Verified record</span><h2>Match History</h2></div><p>Recent public results and available replays.</p></header>
        <MatchRows profile={profile} matches={profile.recentMatches || []} onOpenMatch={onOpenMatch} onOpenReplay={onOpenReplay} />
      </section>
      {activeSeason?.recentMatchReferences?.length > 0 && (
        <section className="competitive-history competitive-dossier-section">
          <header className="competitive-section-heading"><div><span>Season ledger</span><h2>{activeSeason.season?.displayName} Earlier Results</h2></div></header>
          <p className="competitive-empty">These ranked results are saved to the account, but their replay files are not available on this device.</p>
          <div className="competitive-events">
            {activeSeason.recentMatchReferences.slice(0, 12).map((reference) => (
              <div key={reference.matchId}><strong>{String(reference.result || "match").toUpperCase()} · {reference.pointsDelta > 0 ? "+" : ""}{reference.pointsDelta || 0} pts</strong><span>{reference.format} · {formatDate(reference.completedAt)} · {reference.matchId}</span></div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export function CompetitiveIdentityPanel({ profile, loading, error, onOpenProfile, onOpenMatch, onOpenReplay }) {
  const identityFactionId = profile ? identityFaction(profile) : "basic";
  return (
    <section className="competitive-panel" aria-labelledby="competitive-panel-title" style={identityFactionId !== "basic" ? { "--identity-art": `url(${factionArt(identityFactionId)})` } : undefined}>
      <div className="competitive-panel-heading">
        <div><span>Competitive Identity</span><h3 id="competitive-panel-title">Verified Record</h3></div>
        {profile && <button type="button" onClick={() => onOpenProfile(profile.accountId)}>Public Profile</button>}
      </div>
      {loading && <p className="competitive-empty">Loading verified matches...</p>}
      {error && <p className="competitive-error">{error}</p>}
      {profile && !loading && (
        <>
          <section className="competitive-panel-stats">
            <div><span>{profile.competitiveRecord?.activeSeason?.season?.displayName || "Season"}</span><strong>{profile.competitiveRecord?.activeSeason?.record?.points || 0} pts{profile.competitiveRecord?.activeSeason?.rank ? ` · #${profile.competitiveRecord.activeSeason.rank}` : ""}</strong></div>
            <div><span>Ranked</span><strong>{profile.competitiveRecord?.ranked?.wins || 0}W {profile.competitiveRecord?.ranked?.losses || 0}L</strong></div>
            <div><span>Verified</span><strong>{profile.verifiedMatchCount || 0}</strong></div>
            <div><span>Best Attack</span><strong>{profile.notableStats?.largestAttack?.value || 0}</strong></div>
          </section>
          <MatchRows profile={profile} matches={(profile.recentMatches || []).slice(0, 5)} onOpenMatch={onOpenMatch} onOpenReplay={onOpenReplay} />
        </>
      )}
    </section>
  );
}

export function PublicProfileScreen({ profile, loading, error, serverUrl, onBack, onOpenMatch, onOpenReplay }) {
  return (
    <main className="competitive-page" style={{ "--dossier-background": `url(${process.env.PUBLIC_URL || ""}/assets/gauntlet/backgrounds/gauntlet-menu-identity-v2.jpg)` }}>
      <div className="competitive-page-inner">
        <button type="button" className="competitive-back" onClick={onBack}>Back</button>
        {loading && <p className="competitive-empty">Loading player profile...</p>}
        {error && <p className="competitive-error">{error}</p>}
        {profile && <ProfileBody profile={profile} serverUrl={serverUrl} onOpenMatch={onOpenMatch} onOpenReplay={onOpenReplay} />}
      </div>
    </main>
  );
}

export function MatchRecordScreen({ match, loading, error, serverUrl, onBack, onOpenProfile, onWatchReplay }) {
  return (
    <main className="competitive-page">
      <div className="competitive-page-inner">
        <button type="button" className="competitive-back" onClick={onBack}>Back</button>
        {loading && <p className="competitive-empty">Loading verified match...</p>}
        {error && <p className="competitive-error">{error}</p>}
        {match && (
          <>
            <div className="competitive-profile-header">
              <div><span className="competitive-kicker">Verified Match</span><h1>{match.mode}</h1><p>{match.season?.displayName ? `${match.season.displayName} / ` : ""}{formatDate(match.completedAt)} / {match.completionReason} / {match.turnCount} turns</p></div>
              <div className="competitive-record-actions">
                {match.replay?.available && <button type="button" className="competitive-export" onClick={() => onWatchReplay(match.matchId)}>Watch Replay</button>}
                <a className="competitive-export" href={`${serverUrl}/api/matches/${encodeURIComponent(match.matchId)}/export/para?version=2`} target="_blank" rel="noreferrer">Para Export</a>
              </div>
            </div>
            {match.replay && (
              <p className="competitive-replay-status">
                {match.replay.available
                  ? match.replay.mode === "public-state-frames"
                    ? "Replay available with exact public state after each authoritative command."
                    : "Replay available as an authoritative event timeline; this match predates public battlefield frames."
                  : match.replay.unavailableReason || "Replay unavailable after server replacement."}
                {!match.replay.survivesProcessReplacement && " Full replay remains process-local in the current account-only storage mode."}
              </p>
            )}
            <section className="competitive-participants">
              {(match.participants || []).map((participant) => (
                <button type="button" key={participant.participantId} disabled={!participant.accountId} onClick={() => participant.accountId && onOpenProfile(participant.accountId)}>
                  <span className={`competitive-result ${resultClass(participant.result)}`}>{participant.result.toUpperCase()}</span>
                  <strong>{participant.displayName}</strong>
                  <small>{participant.faction?.name} / {participant.finalLife} life</small>
                  <small>{participant.deck?.format} / version {String(participant.deck?.deckVersionId || "standard").slice(0, 12)}</small>
                </button>
              ))}
            </section>
            <section className="competitive-stat-band">
              <div><span>Largest Attack</span><strong>{match.notableMoments?.largestAttack?.value || 0}</strong></div>
              <div><span>Damage Dealt</span><strong>{match.combatStats?.totalDamageDealt || 0}</strong></div>
              <div><span>Damage Prevented</span><strong>{match.combatStats?.totalDamagePrevented || 0}</strong></div>
              <div><span>Audit Events</span><strong>{match.auditEvents?.length || 0}</strong></div>
            </section>
            <section className="competitive-history">
              <h2>Public Event Record</h2>
              <div className="competitive-events">
                {(match.auditEvents || []).slice(-40).reverse().map((event) => (
                  <div key={event.sequence}><strong>#{event.sequence} / T{event.turn}</strong><span>{event.publicPayload?.message}</span></div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
