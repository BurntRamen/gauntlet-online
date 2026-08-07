import "./CompetitiveIdentity.css";

function factionArt(factionId) {
  return factionId ? `${process.env.PUBLIC_URL || ""}/assets/gauntlet/${factionId}-card.webp` : "";
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

function MatchRows({ profile, matches, onOpenMatch }) {
  if (!matches?.length) return <p className="competitive-empty">No verified matches yet.</p>;
  return (
    <div className="competitive-match-list">
      {matches.map((match) => {
        const participant = recordForProfile(profile, match);
        const opponent = match.participants?.find((entry) => entry.accountId !== profile.accountId && entry.identityType !== "ai")
          || match.participants?.find((entry) => entry.accountId !== profile.accountId)
          || null;
        const participantFactionId = participant?.faction?.id;
        return (
          <button type="button" className="competitive-match-row" onClick={() => onOpenMatch(match.matchId)} key={match.matchId}>
            <span className="competitive-faction-mark" aria-hidden="true" style={participantFactionId ? { backgroundImage: `linear-gradient(rgba(5,8,12,0.08), rgba(5,8,12,0.58)), url(${factionArt(participantFactionId)})` } : undefined} />
            <span className={`competitive-result ${resultClass(participant?.result)}`}>{String(participant?.result || "record").toUpperCase()}</span>
            <span>
              <strong>{participant?.faction?.name || "Basic"} vs {opponent?.displayName || "Opponent"}</strong>
              <small>{match.ranked ? "Ranked" : match.mode} / {formatDate(match.completedAt)}</small>
            </span>
            <span className="competitive-match-meta">T{match.turnCount || 1}</span>
          </button>
        );
      })}
    </div>
  );
}

function ProfileBody({ profile, onOpenMatch }) {
  const ranked = profile.competitiveRecord?.ranked || {};
  const all = profile.competitiveRecord?.all || {};
  const identityFactionId = profile.factionRecords?.[0]?.factionId;
  return (
    <>
      <div className="competitive-profile-header" style={identityFactionId ? { backgroundImage: `linear-gradient(90deg, rgba(5,11,18,0.98), rgba(5,11,18,0.72), rgba(5,11,18,0.18)), url(${factionArt(identityFactionId)})` } : undefined}>
        <div>
          <span className="competitive-kicker">{profile.identity?.selectedTitle || "Recruit"}</span>
          <h1>{profile.displayName}</h1>
          <p>Member since {formatDate(profile.memberSince)} / {profile.verifiedMatchCount || 0} verified matches</p>
        </div>
        <div className="competitive-record-block">
          <strong>{ranked.wins || 0}W {ranked.losses || 0}L {ranked.draws || 0}D</strong>
          <span>{ranked.winRate || 0}% ranked win rate</span>
        </div>
      </div>

      <section className="competitive-stat-band" aria-label="Competitive statistics">
        <div><span>All Matches</span><strong>{all.wins || 0}W {all.losses || 0}L {all.draws || 0}D</strong></div>
        <div><span>Largest Attack</span><strong>{profile.notableStats?.largestAttack?.value || 0}</strong></div>
        <div><span>Damage Dealt</span><strong>{profile.notableStats?.totalDamageDealt || 0}</strong></div>
        <div><span>Damage Prevented</span><strong>{profile.notableStats?.totalDamagePrevented || 0}</strong></div>
      </section>

      <div className="competitive-columns">
        <section>
          <h2>Faction Record</h2>
          {profile.factionRecords?.length ? profile.factionRecords.map((faction) => (
            <div className="competitive-line" key={faction.factionId}>
              <strong>{faction.factionName}</strong>
              <span>{faction.wins}W {faction.losses}L {faction.draws}D</span>
            </div>
          )) : <p className="competitive-empty">No faction results yet.</p>}
        </section>
        <section>
          <h2>Featured Decks</h2>
          {profile.featuredDecks?.length ? profile.featuredDecks.map((deck) => (
            <div className="competitive-line" key={deck.id}>
              <span><strong>{deck.name}</strong><small>{deck.factionName} / {deck.format}</small></span>
              <span>{deck.record?.wins || 0}W {deck.record?.losses || 0}L</span>
            </div>
          )) : <p className="competitive-empty">No featured decks.</p>}
        </section>
      </div>

      <section className="competitive-history">
        <h2>Verified Match History</h2>
        <MatchRows profile={profile} matches={profile.recentMatches || []} onOpenMatch={onOpenMatch} />
      </section>
    </>
  );
}

export function CompetitiveIdentityPanel({ profile, loading, error, onOpenProfile, onOpenMatch }) {
  const identityFactionId = profile?.factionRecords?.[0]?.factionId;
  return (
    <section className="competitive-panel" aria-labelledby="competitive-panel-title" style={identityFactionId ? { "--identity-art": `url(${factionArt(identityFactionId)})` } : undefined}>
      <div className="competitive-panel-heading">
        <div><span>Competitive Identity</span><h3 id="competitive-panel-title">Verified Record</h3></div>
        {profile && <button type="button" onClick={() => onOpenProfile(profile.accountId)}>Public Profile</button>}
      </div>
      {loading && <p className="competitive-empty">Loading verified matches...</p>}
      {error && <p className="competitive-error">{error}</p>}
      {profile && !loading && (
        <>
          <section className="competitive-panel-stats">
            <div><span>Ranked</span><strong>{profile.competitiveRecord?.ranked?.wins || 0}W {profile.competitiveRecord?.ranked?.losses || 0}L</strong></div>
            <div><span>Verified</span><strong>{profile.verifiedMatchCount || 0}</strong></div>
            <div><span>Best Attack</span><strong>{profile.notableStats?.largestAttack?.value || 0}</strong></div>
          </section>
          <MatchRows profile={profile} matches={(profile.recentMatches || []).slice(0, 5)} onOpenMatch={onOpenMatch} />
        </>
      )}
    </section>
  );
}

export function PublicProfileScreen({ profile, loading, error, onBack, onOpenMatch }) {
  return (
    <main className="competitive-page">
      <div className="competitive-page-inner">
        <button type="button" className="competitive-back" onClick={onBack}>Back</button>
        {loading && <p className="competitive-empty">Loading player profile...</p>}
        {error && <p className="competitive-error">{error}</p>}
        {profile && <ProfileBody profile={profile} onOpenMatch={onOpenMatch} />}
      </div>
    </main>
  );
}

export function MatchRecordScreen({ match, loading, error, serverUrl, onBack, onOpenProfile }) {
  return (
    <main className="competitive-page">
      <div className="competitive-page-inner">
        <button type="button" className="competitive-back" onClick={onBack}>Back</button>
        {loading && <p className="competitive-empty">Loading verified match...</p>}
        {error && <p className="competitive-error">{error}</p>}
        {match && (
          <>
            <div className="competitive-profile-header">
              <div><span className="competitive-kicker">Verified Match</span><h1>{match.mode}</h1><p>{formatDate(match.completedAt)} / {match.completionReason} / {match.turnCount} turns</p></div>
              <a className="competitive-export" href={`${serverUrl}/api/matches/${encodeURIComponent(match.matchId)}/export/para?version=2`} target="_blank" rel="noreferrer">Para Export</a>
            </div>
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
