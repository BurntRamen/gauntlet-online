// Reuse the shipped menu scenes; artwork never supplies a label or click target.
export const JOURNEY_ART = "/assets/gauntlet/menus/journey-expedition-v1.webp";
export const TUTORIAL_ART = "/assets/gauntlet/menus/tutorial-table-v1.webp";
export const GAUNTLET_CREST = "/assets/gauntlet/gauntlet-logo-transparent.png";
export const STANDARD_DECK_ART = ["basic-10-spades", "basic-k-diamonds", "basic-10-clubs"].map((card) => `/assets/gauntlet/playing-cards/${card}.webp`);

// Focal points preserve recognizable subjects within the compact tile crops.
export const ACTION_ART_POSITIONS = {
  "basic-ai": "76% 67%", "faction-ai": "50% 25%", ranked: "50% 42%",
  campaign: "72% 60%", tutorial: "76% 67%", lore: "72% 60%",
  packs: "50% 42%", collection: "50% 28%",
};

const ARENA = "/assets/gauntlet/backgrounds/gauntlet-menu-play-v1.jpg";
const WORKSHOP = "/assets/gauntlet/backgrounds/gauntlet-menu-build-v1.jpg";
const ARCHIVE = "/assets/gauntlet/backgrounds/gauntlet-menu-matches-v2.jpg";
const IDENTITY = "/assets/gauntlet/backgrounds/gauntlet-menu-identity-v2.jpg";
const VAULT = "/assets/gauntlet/ui/vault-pack-credits-v1.webp";

export const MENU_SCENES = {
  play: ARENA, campaign: JOURNEY_ART, decks: WORKSHOP, draft: WORKSHOP,
  compete: ARENA, matches: ARCHIVE, community: IDENTITY, learn: TUTORIAL_ART,
  profile: IDENTITY, settings: WORKSHOP,
};

export const ACTION_ART = {
  "basic-ai": TUTORIAL_ART,
  "faction-ai": "/assets/gauntlet/kaiser-gauntlet.webp",
  "private-duel": ARENA, "join-table": ARCHIVE,
  ranked: "/assets/gauntlet/rumie.webp",
  draft: WORKSHOP, campaign: JOURNEY_ART, competition: ARENA,
  events: ARENA, para: IDENTITY, standings: ARCHIVE,
  editor: WORKSHOP, collection: "/assets/gauntlet/rumin-card.webp",
  packs: VAULT, "draft-library": WORKSHOP,
  recent: ARCHIVE, replays: ARENA, record: ARCHIVE,
  friends: IDENTITY, challenges: ARENA, messages: IDENTITY,
  tutorial: TUTORIAL_ART, rulebook: JOURNEY_ART, practice: TUTORIAL_ART,
  formats: WORKSHOP, lore: JOURNEY_ART, library: VAULT,
};
