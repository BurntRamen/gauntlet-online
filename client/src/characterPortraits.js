import { getFactionArtwork, getFactionAsset } from "./GauntletVisuals";

const CHARACTER_PORTRAITS = {
  augustus: "/assets/gauntlet/kaiser-gauntlet.webp",
  bobei: "/assets/gauntlet/kaiser-gauntlet.webp",
  brutis: "/assets/gauntlet/rumin-card.webp",
  brutus: "/assets/gauntlet/rumin-card.webp",
  cassius: "/assets/gauntlet/rumin-card.webp",
  kaiser: "/assets/gauntlet/kaiser-gauntlet.webp",
  rolmus: "/assets/gauntlet/kaiser-gauntlet.webp",
  remex: "/assets/gauntlet/rumin-card.webp",
  lafayette: "/assets/gauntlet/lafayette.webp",
  polea: "/assets/gauntlet/polea.webp",
  leafen: "/assets/gauntlet/leafen-gao.png",
  tang: "/assets/gauntlet/tang.webp",
  focus: "/assets/gauntlet/factions/bizi/focus-conductor-of-progress.webp",
  hera: "/assets/gauntlet/factions/bizi/hera-general.webp",
  alden: "/assets/gauntlet/factions/astral-vanguard/high-marshal-alden.webp",
  "myra cross": "/assets/gauntlet/factions/astral-vanguard/sergeant-myra-cross.webp",
  "sergeant myra cross": "/assets/gauntlet/factions/astral-vanguard/sergeant-myra-cross.webp"
};

const FACTION_CUES = {
  sheen: ["bark", "blackthorn", "blight", "briar", "dowan", "drought", "goldroot", "hollowvine", "hushan", "ironbark", "leshan", "reane", "renewal", "ringan", "serpent", "tang"],
  frumo: ["admiral", "carnot", "corsair", "danton", "deep", "ice leviathan", "ludvik", "marat", "mirabeau", "pirate", "robespier", "tide"],
  bizi: ["arel", "bizi", "constanti", "focus", "hera", "kharon", "maxor", "mekan"],
  "astral-vanguard": ["alden", "draven", "marshal", "myra", "orin vale", "sergeant", "vanguard"],
  xendra: ["arel voss", "defender", "elias", "elder", "krauth", "nulth", "syllith", "thrallmaker", "xen'dra", "xendra"],
  jali: ["basho", "revenant", "watane"],
  zynarth: ["brood", "k'lar", "klar", "queen", "zalara", "zynarth"],
  voltari: ["conduit", "regnum", "silicon", "voltari"]
};

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' -]/g, " ").replace(/\s+/g, " ").trim();
}

export function portraitAssetUrl(source) {
  if (!source || /^(?:[a-z]+:|\/\/)/i.test(source)) return source;
  return `${process.env.PUBLIC_URL || ""}${source.startsWith("/") ? source : `/${source}`}`;
}

export function resolveCharacterPortrait(speaker, factionId, explicitImage = "") {
  if (explicitImage) return getFactionAsset(factionId, explicitImage) || explicitImage;
  const name = normalize(speaker);
  const direct = Object.entries(CHARACTER_PORTRAITS).find(([key]) => name.includes(key));
  if (direct) return direct[1];
  const inferredFaction = Object.entries(FACTION_CUES).find(([, cues]) => cues.some((cue) => name.includes(cue)))?.[0];
  const resolvedFaction = inferredFaction || factionId;
  return getFactionArtwork(resolvedFaction) || "/assets/gauntlet/ui/faction-art-unavailable.svg";
}

export const CHARACTER_PORTRAIT_FRAME = "/assets/gauntlet/ui/animated-portrait-frame.png";
