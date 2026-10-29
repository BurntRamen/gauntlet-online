// Decorative artwork never supplies a label or separate click target.
export const JOURNEY_ART = "/assets/gauntlet/menus/journey-expedition-v1.webp";
export const TUTORIAL_ART = "/assets/gauntlet/menus/tutorial-table-v1.webp";
export const GAUNTLET_CREST = "/assets/gauntlet/gauntlet-logo-transparent.png";
export const STANDARD_DECK_ART = ["basic-10-spades", "basic-k-diamonds", "basic-10-clubs"].map((card) => `/assets/gauntlet/playing-cards/${card}.webp`);

// Focal points preserve recognizable subjects within the compact tile crops.
export const ACTION_ART_POSITIONS = {
  "basic-ai": "76% 67%", "faction-ai": "50% 50%", ranked: "50% 55%",
  campaign: "72% 60%", tutorial: "50% 50%", lore: "50% 50%",
  packs: "50% 42%", collection: "50% 50%",
};

const DUEL = "/assets/gauntlet/menus/command-duel-v1.webp";
const TOURNAMENT = "/assets/gauntlet/menus/command-tournament-v1.webp";
const DRAFT = "/assets/gauntlet/menus/command-draft-v1.webp";

const ARENA = "/assets/gauntlet/backgrounds/gauntlet-menu-play-v1.jpg";
const WORKSHOP = "/assets/gauntlet/backgrounds/gauntlet-menu-build-v1.jpg";
const ARCHIVE = "/assets/gauntlet/backgrounds/gauntlet-menu-matches-v2.jpg";
const IDENTITY = "/assets/gauntlet/backgrounds/gauntlet-menu-identity-v2.jpg";
const VAULT = "/assets/gauntlet/ui/vault-pack-credits-v1.webp";

export const MENU_SCENES = {
  play: ARENA, campaign: JOURNEY_ART, decks: WORKSHOP, draft: DRAFT,
  compete: TOURNAMENT, matches: ARCHIVE, community: IDENTITY, learn: TUTORIAL_ART,
  profile: IDENTITY, settings: WORKSHOP,
};

export const ACTION_ART = {
  "basic-ai": TUTORIAL_ART,
  "faction-ai": "/assets/gauntlet/menus/action-faction-practice-v1.webp",
  "private-duel": DUEL, "join-table": "/assets/gauntlet/menus/action-join-table-v1.webp",
  ranked: "/assets/gauntlet/menus/action-ranked-v1.webp",
  draft: DRAFT, campaign: JOURNEY_ART, competition: "/assets/gauntlet/menus/action-competition-v1.webp",
  events: TOURNAMENT, para: IDENTITY, standings: ARENA,
  editor: WORKSHOP, collection: "/assets/gauntlet/menus/action-collection-v1.webp",
  packs: "/assets/gauntlet/menus/action-packs-v1.webp", "draft-library": "/assets/gauntlet/menus/action-draft-library-v1.webp",
  recent: ARCHIVE, replays: "/assets/gauntlet/menus/action-replays-v1.webp", record: "/assets/gauntlet/menus/action-record-v1.webp",
  friends: "/assets/gauntlet/menus/action-friends-v1.webp", challenges: "/assets/gauntlet/menus/action-challenges-v1.webp", messages: "/assets/gauntlet/menus/action-messages-v1.webp",
  tutorial: "/assets/gauntlet/menus/action-tutorial-v1.webp", rulebook: "/assets/gauntlet/menus/action-rulebook-v1.webp", practice: "/assets/gauntlet/menus/action-practice-v1.webp",
  formats: "/assets/gauntlet/menus/action-formats-v1.webp", lore: "/assets/gauntlet/menus/action-lore-v1.webp", library: VAULT,
};
