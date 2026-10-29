/** One vocabulary for navigation, page headings, and accessible destinations. */
export const DESTINATIONS = Object.freeze({
  play: { id: "play", label: "Play", title: "Ready to play?", description: "Choose a game. Every great match starts here.", outcome: "Open game choices", route: "play", requiresAuthentication: false },
  campaign: { id: "campaign", label: "Campaign", title: "Campaign", description: "Choose a faction story or pick up where you left off.", outcome: "Open faction stories and progress", route: "campaign", requiresAuthentication: false },
  decks: { id: "decks", label: "Decks & Cards", mobileLabel: "Decks", title: "Decks & Cards", description: "Build your deck, explore your collection, and open earned packs.", outcome: "Open decks and collection", route: "decks", requiresAuthentication: false },
  draft: { id: "draft", label: "Draft", title: "Draft & Sealed", description: "Build from a fresh pool of cards. Choose a limited format to begin.", outcome: "Choose a limited game format", route: "draft", requiresAuthentication: false },
  compete: { id: "compete", label: "Compete", title: "Compete", description: "Find your next ranked match, official event, or league.", outcome: "Open competitive formats", route: "compete", requiresAuthentication: false },
  matches: { id: "matches", label: "Matches", title: "Matches", description: "Find your match records and watch available replays.", outcome: "Open match history and replays", route: "matches", requiresAuthentication: false },
  community: { id: "community", label: "Community", title: "Community", description: "Find friends, send challenges, and keep the conversation going.", outcome: "Open friends and messages", route: "community", requiresAuthentication: false },
  learn: { id: "learn", label: "Learn & Rules", title: "Learn & Rules", description: "Learn the basics, practice a format, or look up a rule.", outcome: "Open tutorials and rules", route: "learn", requiresAuthentication: false },
  profile: { id: "profile", label: "Profile", title: "Your Profile", description: "Your account, competitive record, rewards, and personal style.", outcome: "Open your account and personal style", route: "profile", requiresAuthentication: false },
  settings: { id: "settings", label: "Settings", title: "Settings", description: "Make Gauntlet comfortable with audio, display, and accessibility preferences.", outcome: "Open sound and display preferences", route: "settings", requiresAuthentication: false },
});

export const PRIMARY_DESTINATIONS = Object.freeze(["play", "campaign", "decks", "draft", "compete", "matches", "community", "learn"]);
export const MOBILE_DESTINATIONS = Object.freeze(["play", "campaign", "decks", "compete"]);
export const MORE_DESTINATIONS = Object.freeze(["draft", "matches", "community", "learn", "profile", "settings"]);

export function getDestination(id) {
  return DESTINATIONS[id] || DESTINATIONS.play;
}
