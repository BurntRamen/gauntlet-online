import "./GauntletVisuals.css";

export const FACTION_VISUALS = {
  rumin: { name: "Rumin", accent: "#c97858", art: "/assets/gauntlet/rumin-card.webp" },
  sheen: { name: "Sheen", accent: "#71b187", art: "/assets/gauntlet/sheen-card.webp" },
  frumo: { name: "Frumo", accent: "#69a8dc", art: "/assets/gauntlet/frumo-card.webp" },
  bizi: { name: "Bizi", accent: "#b080ce", art: "/assets/gauntlet/bizi-card.webp" },
  xendra: { name: "XenDra", accent: "#a88ad8", art: "" },
  basic: { name: "Basic Gauntlet", accent: "#d0a863", art: "" }
};

export function resolveVisualAsset(path) {
  if (!path) return "";
  if (/^(?:data:|https?:)/i.test(path)) return path;
  const base = process.env.PUBLIC_URL || "";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function factionIdFrom(value) {
  const raw = typeof value === "string" ? value : value?.id || value?.factionId || value?.name || "";
  const normalized = String(raw).trim().toLowerCase().replace(/[^a-z]/g, "");
  if (normalized.includes("rumin")) return "rumin";
  if (normalized.includes("sheen")) return "sheen";
  if (normalized.includes("frumo")) return "frumo";
  if (normalized.includes("bizi")) return "bizi";
  if (normalized.includes("xendra")) return "xendra";
  return "basic";
}

export function FactionArtwork({ factionId, art: explicitArt = "", className = "", label, decorative = false, children, style = {} }) {
  const id = factionIdFrom(factionId);
  const visual = FACTION_VISUALS[id] || FACTION_VISUALS.basic;
  const art = resolveVisualAsset(explicitArt || visual.art);
  return (
    <span
      className={`faction-artwork faction-artwork-${id} ${art ? "has-art" : "is-neutral"} ${className}`.trim()}
      style={{ "--faction-accent": visual.accent, ...(art ? { backgroundImage: `url(${art})` } : {}), ...style }}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? "true" : undefined}
      aria-label={decorative ? undefined : label || `${visual.name} artwork`}
    >
      {!art && <span className="faction-artwork-sigil" aria-hidden="true">G</span>}
      {children}
    </span>
  );
}

export function DeckVisual({ deck, factionId, art = null, className = "", decorative = false }) {
  const id = factionIdFrom(factionId || deck?.factionId);
  const visual = FACTION_VISUALS[id] || FACTION_VISUALS.basic;
  const featuredArt = (Array.isArray(art) ? art : Array.isArray(deck?.featuredArt) ? deck.featuredArt : [])
    .map(resolveVisualAsset)
    .filter(Boolean)
    .slice(0, 3);
  return (
    <FactionArtwork
      factionId={id}
      className={`deck-visual ${className}`}
      decorative={decorative}
      label={`${deck?.name || visual.name} deck artwork`}
    >
      {featuredArt.length > 0 && (
        <span className={`deck-visual-card-stack count-${featuredArt.length}`} aria-hidden="true">
          {featuredArt.map((source, index) => <img key={`${source}-${index}`} src={source} alt="" loading="lazy" decoding="async" />)}
        </span>
      )}
      <span className="deck-visual-shade" />
      <span className="deck-visual-mark" aria-hidden="true">{visual.name.slice(0, 1)}</span>
      {deck?.name && <span className="deck-visual-caption">{deck.name}</span>}
    </FactionArtwork>
  );
}

export function MatchThumbnail({
  playerFaction,
  opponentFaction,
  outcome = "recorded",
  explicitThumbnail = "",
  campaignImage = "",
  label = "Match thumbnail"
}) {
  const playerId = factionIdFrom(playerFaction);
  const opponentId = factionIdFrom(opponentFaction);
  const priorityImage = resolveVisualAsset(explicitThumbnail || campaignImage);
  return (
    <div className={`match-thumbnail is-${outcome}`} role="img" aria-label={label}>
      {priorityImage ? (
        <img src={priorityImage} alt="" loading="lazy" />
      ) : (
        <>
          <FactionArtwork factionId={playerId} className="match-thumbnail-side match-thumbnail-player" decorative />
          <FactionArtwork factionId={opponentId} className="match-thumbnail-side match-thumbnail-opponent" decorative />
          <span className="match-thumbnail-vs" aria-hidden="true">VS</span>
        </>
      )}
      <span className="match-thumbnail-result">{String(outcome).toUpperCase()}</span>
    </div>
  );
}
