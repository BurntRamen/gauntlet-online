"use strict";

const FACTIONS = {
  ingles: {
    id: "ingles", name: "Ingles", setId: "frontiers", draftRules: true,
    cardImage: "/assets/gauntlet/ingles-emblem.svg",
    commander: { name: "First Speaker Elian Wren", image: "/assets/gauntlet/ingles-emblem.svg", text: "Charter — Build a balanced hand, commit deliberately, and make every lane support the whole formation." },
    general: { name: "Marshal Rowan Vale", image: "/assets/gauntlet/ingles-emblem.svg", text: "Common Ground — Favor flexible cards and shared-suit formations that can answer changing threats." },
    city: { name: "Crownless Haven", image: "/assets/gauntlet/ingles-emblem.svg", text: "Open Council — Patient defense creates the strongest moment for a coordinated reply." },
    homeworld: "Albion Reach",
    origin: "The Ingles formed on the ocean world Albion Reach, where island cities replaced hereditary rule with negotiated charters after the Crownless War.",
    reathArrival: "An ancient standing stone beneath Crownless Haven resolved into a Timetwister, carrying a consent-bound expedition to Reath while Albion Reach remained its origin."
  },
  mercaw: {
    id: "mercaw", name: "Mercaw", setId: "frontiers", draftRules: true,
    cardImage: "/assets/gauntlet/mercaw-emblem.svg",
    commander: { name: "Convener Mara Kest", image: "/assets/gauntlet/mercaw-emblem.svg", text: "Many-Star Accord — Keep several useful lines open, then concentrate them when a common purpose is chosen." },
    general: { name: "Rook Talon", image: "/assets/gauntlet/mercaw-emblem.svg", text: "Frontier Initiative — Adapt quickly with the cards available instead of waiting for a perfect plan." },
    city: { name: "Accord Spire", image: "/assets/gauntlet/mercaw-emblem.svg", text: "Federated Signal — Diverse lanes become strongest when their independent choices converge." },
    homeworld: "Cairn",
    origin: "The Mercaw arose among Cairn's migrating aerie-cities, building a noisy federation from peoples who prized invention, local autonomy, and mutual defense.",
    reathArrival: "Cairn's buried star-beacon proved to be a Timetwister receiver, and a federation chosen by public compact crossed to Reath without claiming it as a frontier to own."
  },
  mtano: {
    id: "mtano", name: "M'Tano", setId: "frontiers", draftRules: true,
    cardImage: "/assets/gauntlet/mtano-emblem.svg",
    commander: { name: "Rainkeeper Amari", image: "/assets/gauntlet/mtano-emblem.svg", text: "Living Waters — Preserve options, redirect pressure, and let measured defense prepare the next advance." },
    general: { name: "Pathfinder Kito", image: "/assets/gauntlet/mtano-emblem.svg", text: "Highland Paths — A formation survives by moving knowledge and strength to the lane that needs them." },
    city: { name: "Mawingu Terraces", image: "/assets/gauntlet/mtano-emblem.svg", text: "Ancestral Watershed — Every victory must leave enough life and memory for what follows." },
    homeworld: "M'Kora",
    origin: "The M'Tano grew around M'Kora's mountain watersheds, where communities linked astronomy, oral memory, and ecological stewardship across generations.",
    reathArrival: "A resonant stone inside M'Kora's oldest observatory encoded consenting travelers into a Timetwister passage to Reath, leaving their living lineage rooted at home."
  },
  russo: {
    id: "russo", name: "Russo", setId: "frontiers", draftRules: true,
    cardImage: "/assets/gauntlet/russo-emblem.svg",
    commander: { name: "Warden Irina Volkov", image: "/assets/gauntlet/russo-emblem.svg", text: "Winter Oath — Endure early pressure, protect the formation, and commit strength only when the line can hold." },
    general: { name: "Mikhail Saran", image: "/assets/gauntlet/russo-emblem.svg", text: "Shared Hearth — Resources kept in reserve can preserve more than one lane through a long contest." },
    city: { name: "Novaya Hearth", image: "/assets/gauntlet/russo-emblem.svg", text: "The Long Thaw — Resilience is strongest when authority remains answerable to the people enduring beside it." },
    homeworld: "Moroz",
    origin: "The Russo survived the frozen world Moroz through communal heat networks, traveling foundries, and a political tradition divided between central command and local mutual aid.",
    reathArrival: "A glacial monolith opened a Timetwister during Moroz's Great Thaw, sending a carefully recorded expedition to Reath while every traveler retained a continuity archive at home."
  }
};

const ARC = {
  ingles: {
    hero: "First Speaker Elian Wren", ally: "Marshal Rowan Vale", world: "Albion Reach", city: "Crownless Haven",
    perspective: "Elian Wren as a charter becomes a living promise",
    titles: ["The Crownless Shore", "Ink and Salt", "The Island Compact", "The Unwritten Clause", "A Parliament Under Siege", "The Price of Protection", "The Broken Seal", "No King Returns", "The Common Fleet", "The Standing Stone", "A Charter Between Worlds", "The Open Door"],
    foes: ["The Last Royal Fleet", "The Salt Barons", "The Isolated Isles", "The Letter of the Law", "Admiral Corven", "The Emergency Council", "The Forged Signatories", "The Returning Crown", "The Tempest Armada", "The Stone's Custodian", "The Closed Horizon", "The Convergence Storm"],
    conflict: "negotiated freedom can survive fear without hardening into another crown",
    theme: "The Unwritten Charter"
  },
  mercaw: {
    hero: "Convener Mara Kest", ally: "Rook Talon", world: "Cairn", city: "Accord Spire",
    perspective: "Mara Kest inside a federation that argues before it acts",
    titles: ["Aeries in Motion", "The First Accord", "Engines of Independence", "The Copper Rush", "Votes in the Wind", "The Company Sky", "A Union of Rivals", "The Empty Ballot", "One Signal, Many Wings", "The Buried Beacon", "The Frontier Refused", "The Many-Star Accord"],
    foes: ["The Talon Raiders", "The Lone Aerie", "The Patent Houses", "The Claim Syndicate", "The Silent Delegation", "The Meridian Company", "The Secession Fleet", "The Counterfeit Convener", "The Black-Sky Armada", "The Beacon Warden", "The Annexation Bloc", "The Convergence Storm"],
    conflict: "pluralism can coordinate common action without converting independence into ownership",
    theme: "The Many-Star Accord"
  },
  mtano: {
    hero: "Rainkeeper Amari", ally: "Pathfinder Kito", world: "M'Kora", city: "Mawingu Terraces",
    perspective: "Amari listening to land, ancestors, and living witnesses",
    titles: ["Where Rain Remembers", "The Walking Archive", "Terraces of Plenty", "The River Taken", "Stars in the Well", "The Silent Generation", "The Mountain Council", "A Season Without Rain", "The Watershed War", "The Singing Stone", "Essence Across the Dark", "The Mountain Remembers"],
    foes: ["The Ash Drought", "The Nameless Collector", "The Valley Lords", "The Dam Builders", "The False Constellation", "The Erasure", "The Single Voice", "The Red Sun", "The Extractor Army", "The Stone's Echo", "The Severing Current", "The Convergence Storm"],
    conflict: "stewardship can guide change without turning ancestry into ownership of the future",
    theme: "The Mountain Remembers"
  },
  russo: {
    hero: "Warden Irina Volkov", ally: "Mikhail Saran", world: "Moroz", city: "Novaya Hearth",
    perspective: "Irina Volkov between necessary command and shared endurance",
    titles: ["The First White Night", "Fires Beneath Ice", "The Traveling Foundry", "The Hunger Line", "The Central Furnace", "Orders in the Blizzard", "The Hearth Councils", "The Iron Winter", "The Long Thaw", "The Glacial Monolith", "Continuity Protocol", "The Winter Oath"],
    foes: ["The Whiteout", "The Frozen Grid", "The Stranded Convoy", "The Hoarders", "Director Malenk", "The Unquestioned Order", "The Secret Police", "The Last Freeze", "The Flooded Command", "The Monolith Keeper", "The Archive Doubt", "The Convergence Storm"],
    conflict: "collective endurance can preserve order without allowing emergency authority to become permanent",
    theme: "The Long Winter Oath"
  }
};

function makeChapter(factionId, arc, index) {
  const number = index + 1;
  const title = arc.titles[index];
  const foe = arc.foes[index];
  const final = number === 12;
  const transit = number >= 10;
  const setting = transit ? (number === 12 ? "Reath, at a newly opened convergence site" : `An ancient Timetwister beneath ${arc.city}`) : `${arc.city} and the surrounding regions of ${arc.world}`;
  const story = final
    ? `${arc.hero} leads a consent-bound expedition from homeworld ${arc.world} through the Timetwister to Reath. They defend the crossing without treating the convergence world as their origin or a possession.`
    : transit
      ? `An ancient stone reveals a quantum-correlated receiver on Reath. ${arc.hero} must prove that identity, consent, and responsibility can survive reconstruction across worlds.`
      : `On homeworld ${arc.world}, ${arc.hero} confronts ${foe} as the faction tests whether ${arc.conflict}.`;
  const before = final
    ? `${arc.world}'s travelers emerge on Reath as histories from unrelated worlds overlap around the same unstable receiver.`
    : transit
      ? `The stone beneath ${arc.city} answers a sky that does not belong to ${arc.world}, and every measurement describes the distant world Reath.`
      : `${foe} threatens ${arc.city}, forcing an argument about power to become a battle with consequences beyond victory.`;
  const after = final
    ? `${arc.world} remains the faction's home and origin. The expedition establishes a bounded presence on Reath, the shared convergence point.`
    : transit
      ? `The first stable passage proves the Timetwister transmits an error-corrected pattern of a willing traveler and reconstructs that pattern from matter at the paired receiver.`
      : `${arc.city} survives, but the victory changes who may speak, decide, and carry the faction's values into the next crisis.`;
  const id = `${factionId}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const chapter = {
    id, playableName: arc.hero, opponentName: foe, title, story,
    sceneStarter: { where: setting, when: number === 1 ? `The founding crisis on ${arc.world}` : number < 10 ? `Generation ${number} of the ${arc.theme} chronicle` : "The first verified Timetwister contact with Reath", perspective: arc.perspective },
    dialogue: [
      `Narrator: ${before}`,
      `${arc.hero}: We will decide what survives this crisis by how we survive it.`,
      `${foe}: Your principles are delays dressed as courage.`,
      `${arc.ally}: A fast answer can still leave the wrong people carrying its cost.`,
      `${arc.hero}: Then we act together, record the cost, and leave the next choice open.`
    ],
    endDialogue: [
      `Narrator: ${after}`,
      `${foe}: You won this field. You did not settle the argument.`,
      `${arc.ally}: Good. A people that stops arguing has usually stopped choosing.`,
      `${arc.hero}: We carry the lesson forward without pretending it is the only lesson.`,
      `Narrator: Chapter ${number} closes, and ${arc.theme} gains another meaning.`
    ],
    setup: {
      version: 1, bossLife: Math.min(50, 18 + index * 3), attacksPerTurn: number < 5 ? 2 : number < 9 ? 3 : 4,
      minAttackValue: number < 4 ? 2 : 3, maxAttackValue: number < 5 ? 5 : number < 9 ? 6 : 7, chapterNumber: number,
      bossAbility: { id: number >= 10 ? "final-push" : "first-strike", title: number >= 10 ? "Convergence Pressure" : "Homeworld Pressure", text: number >= 10 ? "The boss takes one additional scripted action as the receiver destabilizes." : "The first scripted attack each turn gets +1 value.", tier: number < 5 ? 1 : 2, name: `${foe}: ${number >= 10 ? "Convergence Pressure" : "Homeworld Pressure"}` },
      playerAdditions: [], bossAdditions: [], attackTiming: "clear-priority", winRoute: "first-uncompleted", lossRoute: "retry"
    }
  };
  if (final) chapter.cinematic = { kicker: `The ${arc.theme.toLowerCase()} crosses worlds`, title, subtitle: `${arc.world} remains home as a new history begins at Reath.`, image: FACTIONS[factionId].cardImage };
  return chapter;
}

const CAMPAIGNS = Object.fromEntries(Object.entries(ARC).map(([id, arc]) => [id, arc.titles.map((_, index) => makeChapter(id, arc, index))]));
const NARRATION = Object.fromEntries(Object.values(CAMPAIGNS).flat().map((entry) => [entry.id, { beforeBattle: entry.dialogue[0].replace(/^Narrator:\s*/, ""), afterBattle: entry.endDialogue[0].replace(/^Narrator:\s*/, "") }]));
const METADATA = Object.fromEntries(Object.entries(ARC).map(([id, arc]) => [id, { commanderName: arc.theme, pitch: `Follow the ${FACTIONS[id].name} across homeworld ${arc.world}, test whether ${arc.conflict}, and reach Reath as a convergence point rather than an origin.`, coverImage: FACTIONS[id].cardImage }]));
const CHARACTERS = {
  ingles: { elian: { name: "Elian Wren", role: "First Speaker", description: "A constitutional reformer who treats law as a revisable promise among people rather than a sacred machine." }, rowan: { name: "Rowan Vale", role: "Marshal of the Common Fleet", description: "A disciplined defender who accepts civilian argument as part of command rather than an obstacle to it." } },
  mercaw: { mara: { name: "Mara Kest", role: "Federal Convener", description: "A patient coalition builder who knows that unity chosen noisily is stronger than obedience imposed efficiently." }, rook: { name: "Rook Talon", role: "Frontier Pathfinder", description: "An inventor and pilot who loves independence enough to defend other people's right to it." } },
  mtano: { amari: { name: "Amari", role: "Rainkeeper", description: "A scientist and oral historian who reads climate, memory, and consent as parts of the same living record." }, kito: { name: "Kito", role: "Pathfinder", description: "A mobile guardian who carries knowledge between communities without claiming to own what he preserves." } },
  russo: { irina: { name: "Irina Volkov", role: "Warden of the Long Thaw", description: "A crisis commander who gradually learns that endurance belongs to the people who bear it, not the office that coordinates it." }, mikhail: { name: "Mikhail Saran", role: "Keeper of the Shared Hearth", description: "An engineer and organizer who keeps local networks alive whenever central certainty fails." } }
};

module.exports = { FRONTIER_FACTIONS: FACTIONS, FRONTIER_CAMPAIGNS: CAMPAIGNS, FRONTIER_CAMPAIGN_NARRATION: NARRATION, FRONTIER_CAMPAIGN_METADATA: METADATA, FRONTIER_CAMPAIGN_CHARACTERS: CHARACTERS };
