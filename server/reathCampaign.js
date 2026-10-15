"use strict";

const PLAYER_CARDS = [
  "astral-vanguard-orbital-pathfinder",
  "astral-vanguard-breach-team",
  "astral-vanguard-shock-trooper",
  "astral-vanguard-electronic-warfare-specialist",
  "astral-vanguard-combat-medic",
  "astral-vanguard-jump-trooper",
  "astral-vanguard-powered-breacher",
  "astral-vanguard-emp-grenadier",
  "astral-vanguard-drop-pod-beacon",
  "astral-vanguard-forward-supply-cache"
];

const ASTRAL_ART = "/assets/gauntlet/factions/astral-vanguard/vanguard-outpost.webp";

const TRANSIT_MODEL = Object.freeze({
  name: "The Timetwister Transit Model",
  summary: "Timetwisters move an informational pattern through stabilized microscopic spacetime shortcuts rather than accelerating a body across ordinary space. Reath is the most stable receiver in a naturally occurring network of defects.",
  principles: Object.freeze([
    "Each stone contains a topologically protected quantum reference lattice wrapped around a microscopic traversable wormhole sustained by engineered negative vacuum energy. Entanglement verifies and corrects the pattern; it does not carry information faster than light by itself.",
    "A traveler is scanned as a layered biological pattern: connectome, active neural state, epigenetic markers, immune memory, and enough cellular instructions to rebuild a viable body.",
    "At the destination, local feedstock is reorganized around that pattern. The traveler experiences continuity because the origin pattern decoheres as the receiver resolves, preventing a stable duplicate under the no-cloning limit.",
    "Reath sits inside a persistent gravitational and vacuum-energy lens where many lattice paths reach unusually low error. That makes the planet a convergence hub, not the birthplace of every people who appears there.",
    "Bad phase alignment can omit memories, merge incompatible observations, or instantiate a traveler at the wrong historical boundary. XenDra influence attacks this error-correction layer, which is why witnesses can remember different versions of one event."
  ]),
  limits: "Transit needs a compatible receiver, stored matter, enormous energy, and a phase solution. Unanchored jumps are lethal; damaged stones can preserve a mind while rebuilding the wrong details."
});

const HOMEWORLDS = Object.freeze({
  rumin: { homeworld: "Orthea", origin: "The marble river kingdoms of Orthea", reathArrival: "Imperial scouts reached Reath through a buried Timetwister beneath Rumie." },
  sheen: { homeworld: "Gao", origin: "The forest moon Gao and its living canopy cities", reathArrival: "Root-bound receiver stones carried Sheen envoys into Reath's oldest forests." },
  frumo: { homeworld: "Pelagos", origin: "The ocean world Pelagos", reathArrival: "Frumo navigators mistook a submerged Timetwister aperture for a new current and emerged beneath Reath's seas." },
  bizi: { homeworld: "Volaris", origin: "The storm-lit industrial world Volaris", reathArrival: "Bizi engineers deliberately powered a receiver stone while searching for a world where Constanti could begin again." },
  mekan: { homeworld: "Teyotl", origin: "The lake continent Teyotl", reathArrival: "Mekan rites learned to encode memory into a stone long before they understood its physical machinery." },
  jali: { homeworld: "Aozora", origin: "The cloud world Aozora", reathArrival: "Katana's navigators stabilized a high-altitude receiver and opened a disciplined passage to Reath." },
  gracus: { homeworld: "Thalassa", origin: "The island world Thalassa", reathArrival: "A contest relic proved to be a dormant Timetwister and carried the first Gracus delegation to Reath." },
  indela: { homeworld: "Varuna", origin: "The observatory world Varuna", reathArrival: "Indela scholars solved the parity sequence of a receiver stone and followed its signal to Reath." },
  zynarth: { homeworld: "Ilyr-Vesh", origin: "The brood cradle Ilyr-Vesh", reathArrival: "A queen sent eggs and memory-patterns through a failing lattice as XenDra pressure consumed their outer hives." },
  "astral-vanguard": { homeworld: "The Meridian Reach", origin: "A human interstellar commonwealth centered on Meridian", reathArrival: "The Vanguard arrived by starship, then discovered that Reath's stones connect worlds their drives could never reach." },
  xendra: { homeworld: "The Nacre Rift", origin: "A nonlocal habitat the Voltari call the Nacre Rift", reathArrival: "XenDra manifestations propagate through corrupted receiver states rather than ordinary travel." }
});

const SPECS = [
  {
    id: "new-horizon", title: "New Horizon", foe: "The Glasswind Pack", hero: "Sergeant Myra Cross",
    story: "Establish Outpost Horizon, map the landing basin, and protect survey crews while an ancient structure returns impossible age readings.",
    before: "The first landing ships settle over a green world whose ruins register as eight thousand years old, several million years old, and forty-three seconds in the future.",
    lines: ["Myra Cross: Set the perimeter around people, not territory.", "Alden: We came to learn whether Reath can sustain a colony. Treat every ruin as someone else's history.", "Dr. Sera Venn: Marshal, the dating instruments disagree by six orders of magnitude.", "Glasswind Alpha: New fires. New meat. Old door.", "Myra Cross: Contact on the ridge. Survey teams behind the drop wall."],
    after: "Outpost Horizon stands. After the patrol leaves, a silhouette appears inside the sealed ruin for less than a second.",
    end: ["Dr. Sera Venn: The structure is reporting a negative age.", "Myra Cross: Instruments can break.", "Alden: Three instruments do not break into the same warning.", "Unknown Voice: You finally arrived.", "Narrator: The doorway is empty when the cameras look again."]
  },
  {
    id: "something-beneath-us", title: "Something Beneath Us", foe: "The Burrowing Brood", hero: "Sergeant Myra Cross",
    story: "Search the tunnels beneath Horizon for missing colonists and identify the organisms building new chambers under the settlement.",
    before: "Colonists vanish near tunnels that did not exist on the expedition's first orbital survey.",
    lines: ["Myra Cross: Nonlethal light first. We do not know what took them.", "Dr. Sera Venn: These walls are grown, not excavated.", "K'Lar: Surface minds burn what they cannot smell.", "Alden: That was language. Hold fire unless attacked.", "Myra Cross: Too late. The small ones are charging."],
    after: "The team destroys one nest and recovers the colonists. Orbital scans then reveal hundreds of fresh nests across the basin.",
    end: ["Myra Cross: One nest neutralized.", "Dr. Sera Venn: Updating that assessment. There are three hundred and twelve.", "Alden: They were absent yesterday.", "K'Lar: Yesterday is not where our children hatched.", "Narrator: The voice vanishes into the living tunnels."]
  },
  {
    id: "the-brood", title: "The Brood", foe: "Broodmother Zalara", hero: "High Marshal Alden",
    story: "Defend Horizon from a rapidly expanding brood and learn why destroying Zynarth bodies may strengthen the larger ecology.",
    before: "Biomass from each fallen organism is reclaimed by the next wave, turning a simple defense into an accelerating ecological war.",
    lines: ["Myra Cross: Every casualty feeds the next assault.", "Alden: Burn the reclamation lanes, not the nurseries.", "Zalara: Stop burning our children.", "Myra Cross: You can speak?", "Zalara: You never asked."],
    after: "The attack stops when Zalara enters the field. Both armies discover that the battle began from incompatible assumptions.",
    end: ["Alden: Why did you build beneath our colony?", "Zalara: We arrived beneath no colony. Your Horizon appeared above our future.", "Dr. Sera Venn: Two settlements occupying different causal histories.", "Myra Cross: Can we keep them from becoming one grave?", "Zalara: Ask before the next fire."]
  },
  {
    id: "other-intelligence", title: "The Other Intelligence", foe: "The Feral Brood", hero: "High Marshal Alden",
    story: "Protect a diplomatic meeting with Zalara from a rival brood and decide whether intelligence can exist without a single unified mind.",
    before: "Zalara offers a ceasefire and warns that the Zynarth were driven from Ilyr-Vesh by a presence she calls the Voice Behind Sleep.",
    lines: ["Zalara: A brood is a conversation written in bodies.", "Alden: Then we will speak to the mind choosing peace.", "K'Lar: Not every queen chooses it.", "Myra Cross: Feral signatures incoming from three tunnels.", "Zalara: Defend the meeting, and I will teach you what followed us."],
    after: "The meeting survives. Zalara reveals that Zynarth queens remain individuals, capable of diplomacy, rivalry, and fear.",
    end: ["Zalara: Ilyr-Vesh still lives in our memory-patterns.", "Dr. Sera Venn: You transmitted minds inside the eggs.", "K'Lar: Bodies are local. Continuity is the pattern.", "Alden: The stones rebuilt you here.", "Zalara: And something listened during the rebuilding. Your thoughts are becoming loud."]
  },
  {
    id: "golden-machine", title: "The Golden Machine", foe: "Voltari Custodian Oru", hero: "Sergeant Myra Cross",
    story: "Survive first contact with a colossal golden machine and determine why it orders both armies to stop firing.",
    before: "A non-humanoid Voltari fortress descends through Reath's atmosphere and interrupts every local sensor with one precise command.",
    lines: ["Oru: Cease engagement. Your sensory systems are compromised.", "Myra Cross: You landed a fortress inside our perimeter.", "Oru: This is a diagnostic instrument.", "Zalara: It smells like a weapon.", "Alden: All sides hold. Prove what you detected."],
    after: "The Voltari activate a reality anchor. Enemy markers vanish from friendly units, revealing that perception itself had been altered.",
    end: ["Dr. Sera Venn: The anchor did not move anything. It corrected our reference frame.", "Oru: Correct. You were attacking an edited observation.", "Myra Cross: Who edited it?", "Oru: The XenDra have no useful singular pronoun.", "Oru: Now you understand why we came."]
  },
  {
    id: "conduit", title: "Conduit", foe: "The Anchor Breakers", hero: "High Marshal Alden",
    story: "Escort Voltari engineers building a linked reality-anchor network while hostile manifestations target every unfinished node.",
    before: "One anchor clarifies a room. A connected network can hold an entire valley in one agreed version of reality.",
    lines: ["Oru: A component is weak. A verified system is difficult to deceive.", "Alden: Our people maintain the perimeter. Your engineers place the anchors.", "Zalara: My workers can grow insulation around the hot nodes.", "Myra Cross: Three methods, one line.", "Unknown Voice: Agreement is only a slower dream."],
    after: "The valley stabilizes. Oru admits the Voltari have contained XenDra manifestations elsewhere but never destroyed one.",
    end: ["Oru: Containment successful within expected error.", "Dr. Sera Venn: Expected error includes buildings remembering different floors.", "Oru: An acceptable improvement.", "Alden: You have fought them before.", "Oru: We have postponed them before."]
  },
  {
    id: "city-that-wasnt-there", title: "The City That Wasn't There", foe: "The Future Dead", hero: "Sergeant Myra Cross",
    story: "Explore a ruined city absent from yesterday's scans and recover the Timetwister at its center without losing the expedition to contradictory corridors.",
    before: "The city changes when unobserved. Its dead wear Vanguard identification and dates of death seventeen years in the future.",
    lines: ["Myra Cross: That body has my unit patch.", "Dr. Sera Venn: And a service record that has not been issued.", "Future Myra: Do not touch the stone with an unshielded mind.", "Alden: Sergeant, that voice is yours.", "Myra Cross: Then future me can wait until present me secures the room."],
    after: "Touching the stone produces glimpses of Orthea, Gao, Pelagos, Volaris, Ilyr-Vesh, and civilizations the Vanguard has never met.",
    end: ["Dr. Sera Venn: It is not a time machine. It is a receiver index.", "Myra Cross: For planets?", "Oru: For compatible histories.", "Unknown Voice: You finally arrived.", "Alden: Seal the chamber. No one touches it alone again."]
  },
  {
    id: "fracture", title: "Fracture", foe: "The Unreliable Battlefield", hero: "Sergeant Myra Cross",
    story: "Restore anchor coverage while objectives, maps, timers, and unit identities become unreliable beyond stabilized zones.",
    before: "XenDra influence spreads through the receiver network and begins altering the expedition's shared evidence instead of its physical defenses.",
    lines: ["Myra Cross: Trust the blue anchor light, not the minimap.", "Dr. Sera Venn: The timer is counting backward.", "Oru: Local chronology is intact. The interface is reporting another branch.", "Zalara: I can smell our real soldiers.", "Alden: Then biology guides the advance. Vanguard protects the anchors."],
    after: "The network restores a common battlefield. The expedition realizes Voltari technology protects the ability to perceive the world accurately.",
    end: ["Myra Cross: Friendly markers match friendly faces again.", "Oru: For now.", "Dr. Sera Venn: The XenDra attacked consensus itself.", "Zalara: Consensus can heal if enough minds remain distinct.", "Unknown Voice: Distinction is the oldest loneliness."]
  },
  {
    id: "enemy-of-my-enemy", title: "The Enemy of My Enemy", foe: "A XenDra Manifestation", hero: "High Marshal Alden",
    story: "Coordinate Vanguard adaptability, Voltari precision, and Zynarth biological efficiency against a manifestation destabilizing an entire region.",
    before: "Three forces that nearly destroyed one another must operate through different command systems without surrendering their identities.",
    lines: ["Alden: Vanguard holds the mobile line.", "Oru: Anchors will close the false approaches.", "Zalara: My brood consumes the corrupted biomass and returns clean matter.", "Myra Cross: It is ugly, improvised, and synchronized.", "Unknown Voice: Interesting."],
    after: "The manifestation collapses. Its final response reveals that the alliance was being observed as an experiment.",
    end: ["Zalara: It withdrew before we destroyed it.", "Oru: Correct. Our success was permitted.", "Myra Cross: Why study cooperation?", "Unknown Voice: To learn which bonds survive translation.", "Alden: Then let it learn that ours can change without breaking."]
  },
  {
    id: "first-empire", title: "The First Empire", foe: "Kaisar's Rumin Legion", hero: "Sergeant Myra Cross",
    story: "Meet a disciplined army emerging through a Timetwister breach and prevent first contact from becoming a war across worlds.",
    before: "Reptilian legionaries from Orthea arrive with standards, armor, and tactics refined centuries before the Vanguard's history began.",
    lines: ["Rumin Officer: Your weapon kills from farther away.", "Myra Cross: That usually ends the comparison.", "Rumin Officer: Your soldiers still stand incorrectly.", "Alden: We are not here to conquer Orthea.", "Envoy of Kaisar: Then stop placing a colony at the mouth of our sacred road."],
    after: "Neither side wins the misunderstanding. Both accept that Reath's stones can connect civilizations separated by distance and historical era.",
    end: ["Myra Cross: They predicted every breach pattern.", "Alden: Technology is not the same thing as intelligence.", "Envoy of Kaisar: At last, a useful sentence.", "Dr. Sera Venn: The passage remains open to Orthea.", "Envoy of Kaisar: Then Kaisar will expect an embassy, not an invasion report."]
  },
  {
    id: "world-between", title: "The World Between", foe: "The Convergence Storm", hero: "High Marshal Alden",
    story: "Defend the central convergence site as glimpses of distant homeworlds begin overlapping Reath and the transit network opens without permission.",
    before: "Frumo vessels appear inland, Sheen vegetation crosses steel walls, Bizi instruments record tomorrow, and Rumin standards rise beside Vanguard antennas.",
    lines: ["Dr. Sera Venn: Reath is not suffering random anomalies. It is routing arrivals.", "Oru: A stable intersection between receiver lattices.", "Zalara: A nest made from many skies.", "Myra Cross: And someone has opened every door at once.", "Alden: Hold the convergence site. Every world gets a road home."],
    after: "The defenders learn that Timetwisters connect compatible realities by reconstructing travelers from protected biological information.",
    end: ["Dr. Sera Venn: The stone does not carry a body. It carries the constraints needed to rebuild one.", "Myra Cross: An essence written as error-corrected biology.", "Oru: Crude wording. Accurate result.", "Alden: Reath lowers the error enough for distant histories to meet.", "Unknown Voice: And meeting changes every history involved."]
  },
  {
    id: "when-stars-remember", title: "When the Stars Remember", foe: "The XenDra Intelligence", hero: "High Marshal Alden and Sergeant Myra Cross",
    story: "Stabilize Reath through simultaneous Vanguard, Voltari, Zynarth, and historical-faction operations while a XenDra intelligence rewrites the network.",
    before: "The final event cannot be defeated as a single creature. Reath itself must be held in one coherent state long enough to close the uncontrolled paths.",
    lines: ["Alden: Vanguard protects the settlements and convergence towers.", "Oru: Voltari anchors resolve the network.", "Zalara: Zynarth structures keep living matter viable through the phase change.", "Envoy of Kaisar: The old roads remain guarded from our side.", "XenDra: You believe we opened the door."],
    after: "The fractures close and Reath survives as a permanent meeting point. The XenDra imply that the planet itself initiated the convergence.",
    end: ["XenDra: Reath opened it.", "Myra Cross: Then why were you waiting?", "XenDra: To see what answered.", "Alden: Anchors synchronized. Close the final path.", "XenDra: You have mistaken postponement for victory."],
    cinematic: { kicker: "The network remembers", title: "When the Stars Remember", subtitle: "Reath survives, and distant homeworlds illuminate across the dark.", image: ASTRAL_ART }
  }
];

function setupFor(index, spec) {
  const number = index + 1;
  return {
    version: 1,
    bossLife: Math.min(50, 18 + index * 3),
    attacksPerTurn: number < 5 ? 2 : number < 9 ? 3 : 4,
    minAttackValue: number < 4 ? 2 : 3,
    maxAttackValue: number < 5 ? 5 : number < 9 ? 6 : 7,
    chapterNumber: number,
    bossAbility: {
      id: index >= 7 ? "final-push" : "first-strike",
      title: index === 7 ? "Unreliable Reality" : index === 11 ? "Convergence Event" : "Escalating Contact",
      text: index === 7 ? "The first scripted action each turn distorts the battle record." : index === 11 ? "The final encounter makes four scripted actions each turn." : "The first scripted attack each turn gets +1 value.",
      tier: number < 5 ? 1 : 2,
      name: `${spec.foe}: ${index === 7 ? "Unreliable Reality" : index === 11 ? "Convergence Event" : "Escalating Contact"}`
    },
    playerAdditions: PLAYER_CARDS.slice(0, Math.min(PLAYER_CARDS.length, 2 + Math.floor(index * 0.8))),
    bossAdditions: PLAYER_CARDS.slice(0, Math.min(8, 2 + Math.floor(index * 0.7))),
    attackTiming: "clear-priority",
    winRoute: "first-uncompleted",
    lossRoute: "retry"
  };
}

const CAMPAIGN = SPECS.map((spec, index) => ({
  id: spec.id,
  playableName: spec.hero,
  opponentName: spec.foe,
  title: spec.title,
  story: spec.story,
  beforeBattle: spec.before,
  afterBattle: spec.after,
  dialogue: [`Narrator: ${spec.before}`, ...spec.lines],
  endDialogue: [`Narrator: ${spec.after}`, ...spec.end],
  image: ASTRAL_ART,
  setup: setupFor(index, spec),
  ...(spec.cinematic ? { cinematic: spec.cinematic } : {})
}));

const METADATA = Object.freeze({
  commanderName: "The World Between",
  pitch: "Lead the Astral Vanguard from an uncertain first landing through contact with the Zynarth and Voltari, then defend Reath as distant homeworlds begin sharing one sky.",
  coverImage: ASTRAL_ART,
  homeworld: HOMEWORLDS["astral-vanguard"].homeworld,
  arrivalOnReath: HOMEWORLDS["astral-vanguard"].reathArrival,
  transitModel: TRANSIT_MODEL
});

const CHARACTERS = Object.freeze({
  "High Marshal Alden": "The expedition commander, committed to protecting settlements without turning first contact into occupation.",
  "Sergeant Myra Cross": "A field leader whose practical adaptability becomes the coalition's strongest shared language.",
  "Dr. Sera Venn": "A physicist who recognizes that Timetwisters preserve biological information across an error-corrected spacetime network.",
  "Broodmother Zalara": "An individual Zynarth queen carrying the living memory of Ilyr-Vesh and seeking survival without assimilation.",
  "Voltari Custodian Oru": "A precise machine-intelligence whose reality anchors protect observers as much as battlefields."
});

module.exports = { REATH_CAMPAIGN: CAMPAIGN, REATH_CAMPAIGN_METADATA: METADATA, REATH_CAMPAIGN_CHARACTERS: CHARACTERS, TIMETWISTER_TRANSIT_MODEL: TRANSIT_MODEL, FACTION_HOMEWORLDS: HOMEWORLDS };
