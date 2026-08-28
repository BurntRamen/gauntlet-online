import { FactionArtwork, FACTION_VISUALS } from "./GauntletVisuals";

const KNOWN_FACTIONS = new Set(["rumin", "sheen", "frumo", "bizi"]);
const IDENTITY_ARCHIVE_ART = "/assets/gauntlet/backgrounds/gauntlet-menu-identity-v2.jpg";
const PACK_ARCHIVE_ART = "/assets/gauntlet/ui/vault-pack-credits-v1.webp";

function campaignLeader(campaign = {}) {
  return Object.entries(campaign)
    .filter(([factionId]) => KNOWN_FACTIONS.has(factionId))
    .sort((left, right) => (right[1]?.length || 0) - (left[1]?.length || 0))[0]?.[0] || "";
}

export function resolveAchievementVisual(achievement, campaign = {}, selectedFactionBadge = "none", campaigns = {}) {
  const achievementId = String(achievement?.id || "");
  const wonFaction = achievementId.startsWith("win-") ? achievementId.slice(4) : "";
  const leadingFaction = campaignLeader(campaign);
  const factionId = KNOWN_FACTIONS.has(wonFaction)
    ? wonFaction
    : KNOWN_FACTIONS.has(selectedFactionBadge)
      ? selectedFactionBadge
      : leadingFaction || "basic";
  const art = achievementId === "first-booster"
    ? PACK_ARCHIVE_ART
    : achievementId === "first-campaign-clear" && leadingFaction
      ? campaigns[leadingFaction]?.coverImage || FACTION_VISUALS[leadingFaction]?.art
      : factionId === "basic"
        ? IDENTITY_ARCHIVE_ART
        : FACTION_VISUALS[factionId]?.art;
  return { factionId, art };
}

export function AchievementHonorCard({ achievement, campaign, selectedFactionBadge, campaigns }) {
  const visual = resolveAchievementVisual(achievement, campaign, selectedFactionBadge, campaigns);
  return (
    <article className="achievement-tile is-earned" style={{ "--faction-accent": FACTION_VISUALS[visual.factionId]?.accent || FACTION_VISUALS.basic.accent }}>
      <FactionArtwork factionId={visual.factionId} art={visual.art} className="achievement-art" decorative>
        <span className="achievement-art-shade" />
        <span className="achievement-emblem" aria-hidden="true">✦</span>
      </FactionArtwork>
      <div className="achievement-copy"><span>Verified honor</span><strong>{achievement.name}</strong><p>{achievement.description}</p></div>
      <span className="achievement-state">Earned</span>
    </article>
  );
}

export function CampaignArchiveCard({ factionId, entry, completed }) {
  const total = entry.chapters.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <article className={`identity-campaign-progress ${completed === total && total > 0 ? "is-complete" : ""}`} style={{ "--faction-accent": FACTION_VISUALS[factionId]?.accent || FACTION_VISUALS.basic.accent }}>
      <FactionArtwork factionId={factionId} art={entry.coverImage} className="identity-campaign-art" decorative>
        <span className="identity-campaign-art-shade" />
        <span className="identity-campaign-index">{completed}/{total}</span>
      </FactionArtwork>
      <div className="identity-campaign-copy">
        <span>Commander archive</span>
        <strong>{entry.factionName}</strong>
        <p>{entry.title || `${entry.factionName} campaign`}</p>
        <span className="identity-progress-label">{completed}/{total} chapters · {percent}% complete</span>
        <span className="identity-progress-track" aria-label={`${entry.factionName}: ${percent}% complete`}><i style={{ width: `${percent}%` }} /></span>
      </div>
    </article>
  );
}
