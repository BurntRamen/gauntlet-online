import "./GauntletVisuals.css";

export const FACTION_VISUALS = {
  mekan: { name: "Mekan", accent: "#e6b453", art: "/assets/gauntlet/mekan-emblem.svg" },
  jali: { name: "Jali", accent: "#ef6a78", art: "/assets/gauntlet/jali-emblem.svg" },
  gracus: { name: "Gracus", accent: "#f59e0b", art: "/assets/gauntlet/gracus-emblem.svg" },
  indela: { name: "Indela", accent: "#c4b5fd", art: "/assets/gauntlet/indela-emblem.svg" },
  voltari: { name: "Voltari", accent: "#edcc7a", art: "" },
  rumin: { name: "Rumin", accent: "#c97858", art: "/assets/gauntlet/rumin-card.webp" },
  sheen: { name: "Sheen", accent: "#71b187", art: "/assets/gauntlet/sheen-card.webp" },
  frumo: { name: "Frumo", accent: "#69a8dc", art: "/assets/gauntlet/frumo-card.webp" },
  bizi: { name: "Bizi", accent: "#b080ce", art: "/assets/gauntlet/factions/bizi/constanti-technology-hub.webp" },
  zynarth: { name: "Zynarth", accent: "#a3e635", art: "/assets/gauntlet/factions/zynarth/brood-nest.webp" },
  "astral-vanguard": { name: "Astral Vanguard", accent: "#60a5fa", art: "/assets/gauntlet/factions/astral-vanguard/vanguard-outpost.webp" },
  ingles: { name: "Ingles", accent: "#e9c46a", art: "/assets/gauntlet/ingles-emblem.svg" },
  mercaw: { name: "Mercaw", accent: "#60a5fa", art: "/assets/gauntlet/mercaw-emblem.svg" },
  mtano: { name: "M'Tano", accent: "#9ccf9b", art: "/assets/gauntlet/mtano-emblem.svg" },
  russo: { name: "Russo", accent: "#b9d7ea", art: "/assets/gauntlet/russo-emblem.svg" },
  xendra: { name: "XenDra", accent: "#a88ad8", art: "" },
  basic: { name: "Basic Gauntlet", accent: "#d0a863", art: "" }
};

export function resolveVisualAsset(path) {
  if (!path) return "";
  if (/^(?:data:|https?:)/i.test(path)) return path;
  const base = process.env.PUBLIC_URL || "";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

// Legacy images also ship under immutable release hashes. Preserve their actual
// faction identity when a published record still points at borrowed placeholder art.
// Sources and hashes: server/contentAssetManifest.json.
const LEGACY_ASSET_OWNERS = {
  "7ed4c19ad0b2088f6f07a892d1d0a3e905f05ecf2cd5287b9dbb9dc9281d6192": "sheen",
  "49cc76e7cbe160203e317fa8652e187c545b3844a99a7b36011b19c025e95f7b": "bizi",
  "f189ddef7733a9dcaf07601714a2b94c52d38f726a57db3b67e6108d1f3ae1a8": "bizi",
  "d4b039beb7238fad2e57f90ed89a713df3e5ef9b1acb141bd19c7e85b5a6f3b6": "frumo",
  "396da7f8f2a6b18517f2a2b738f0e1798013c04b90302763fa61a579685addb0": "gracus",
  "7f85b4c72b0cc4ce6389889b4f0545a6cd65cad66c2c607ea068a9949b08d042": "indela",
  "f4b880f173bc7797797011aa73f5709a621c81c861adee601b96c60047a5959c": "ingles",
  "8cb8a92db3b926938e4e3f2334acdd65d3b21e3771c48fbba66d20e189428f12": "jali",
  "363eadd857c518c5fed63e691f56cbc4d527e9ff0092e5ba1fa79cf35cb5d8b0": "rumin",
  "8299cdcbc9b309f59750ecde4eb106b56fb386f73afb3402b155201b1425e2a6": "frumo",
  "e7db39aeb8f4a467cdc17b0eb9aa52c8d851c959c31654fa429c44ac59ed1b06": "sheen",
  "ec2bb7f976df96003d216dcc86cb61005403ea5a85b448b4096a3948233d995c": "rumin",
  "24c73b99f7b051383db1e4fbab71d1c5ff6dfb37d671f5073e6f82f6c7ac9410": "mekan",
  "eb5319b89e274f122c0ed0b94075a7e75d0cc31dc5e25d316a6828af8697c917": "mercaw",
  "0df2f8b3bb1a36fb6268ef876606e271e2e7923bb15c24d74c8ba5b0632eb29b": "mtano",
  "43b80136c83389f8676e814517c218b17fa44123a2555b18ceee6aec656be944": "frumo",
  "2ffaf9bb987ba5bcd0201208f938f82cda3447566f1914cd700c9ecf7efde655": "frumo",
  "4a477cb909dfde7ae272305137e9f499a8c28405dc086f28b8ec6b9ed5aa04cd": "rumin",
  "9ca19b20fc4aeefc11241734a5c6142cc6f3b2edd10cefc06708d6ce08903dc4": "rumin",
  "41ec6123a2eb5fb35c6d8315e984b4a7d739c9a4c270b3038a29af979491fdb0": "russo",
  "0f0500bbab04885102a73a5427711c7079e3452489be158bd833672474d87678": "sheen",
  "149ee7713328f74b4a9be6cb4be403975280c41bd15201802b3e794fc66f367c": "sheen",
  beli: "sheen", "leafen-gao": "sheen", tang: "sheen",
  "kaiser-gauntlet": "rumin", "meerus-gauntlet-2": "rumin", rumie: "rumin",
  polea: "frumo", lafayette: "frumo", ristus: "frumo"
};

export function getFactionAsset(factionId, candidate) {
  if (typeof candidate !== "string" || !candidate) return "";
  const id = factionIdFrom(factionId);
  const path = candidate.split(/[?#]/)[0].toLowerCase();
  const basename = path.split("/").pop().replace(/\.[^.]+$/, "");
  const directoryFaction = path.match(/\/(?:factions|constructed|campaigns)\/([^/]+)\//)?.[1];
  const namedFaction = Object.keys(FACTION_VISUALS).find((key) => basename === key || basename.startsWith(`${key}-`));
  const owner = LEGACY_ASSET_OWNERS[basename] || directoryFaction || namedFaction;
  return owner && owner !== id ? "" : candidate;
}

export function getFactionArtwork(factionId, ...candidates) {
  return [...candidates, FACTION_VISUALS[factionIdFrom(factionId)]?.art]
    .map((candidate) => getFactionAsset(factionId, candidate)).find(Boolean) || "";
}

export function factionIdFrom(value) {
  const raw = typeof value === "string" ? value : value?.id || value?.factionId || value?.name || "";
  const normalized = String(raw).trim().toLowerCase().replace(/[^a-z]/g, "");
  if (normalized.includes("rumin")) return "rumin";
  if (normalized.includes("sheen")) return "sheen";
  if (normalized.includes("frumo")) return "frumo";
  if (normalized.includes("bizi")) return "bizi";
  if (normalized.includes("mekan")) return "mekan";
  if (normalized.includes("jali")) return "jali";
  if (normalized.includes("ingles") || normalized.includes("engles")) return "ingles";
  if (normalized.includes("mercaw")) return "mercaw";
  if (normalized.includes("mtano")) return "mtano";
  if (normalized.includes("russo")) return "russo";
  if (normalized.includes("gracus")) return "gracus";
  if (normalized.includes("indela")) return "indela";
  if (normalized.includes("voltari")) return "voltari";
  if (normalized.includes("zynarth")) return "zynarth";
  if (normalized.includes("astralvanguard")) return "astral-vanguard";
  if (normalized.includes("xendra")) return "xendra";
  return "basic";
}

export function FactionArtwork({ factionId, art: explicitArt = "", className = "", label, decorative = false, children, style = {} }) {
  const id = factionIdFrom(factionId);
  const visual = FACTION_VISUALS[id] || FACTION_VISUALS.basic;
  const art = resolveVisualAsset(getFactionArtwork(id, explicitArt));
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
