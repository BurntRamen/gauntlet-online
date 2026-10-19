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
  frumo: { homeworld: "Pelagos", origin: "The ocean world Pelagos, where amphibious merfolk captains sail between reef kingdoms and the underwater capital Ristus", reathArrival: "After restoring the Council of Captains, Frumo navigators charted a submerged Timetwister beneath Ristus and sent a voluntary expedition through its verified current into Reath's seas." },
  bizi: { homeworld: "Volaris", origin: "The storm-lit industrial world Volaris, where human Mekanists built self-repairing automatons to save the failing empire of Constanti; the Bizi awakened, claimed personhood, and inherited its machinery and unfinished arguments", reathArrival: "After Constanti fell, Bizi archivists deliberately powered a receiver stone and carried protected minds, blueprints, tools, and Titan records to Reath while Volaris remained their world of origin." },
  mekan: { homeworld: "Teyotl", origin: "The flower-ringed lake continent Teyotl, where San Mikal surrounds a vast ancestral burial complex", reathArrival: "San Mikal encoded consenting travelers as error-corrected memory patterns in an entangled ceremonial stone; a receiver on Reath reconstructed those patterns into local matter while a living record on Teyotl verified identity and continuity." },
  jali: { homeworld: "Aozora", origin: "The low-gravity cloud world Aozora, where aeromagnetic mineral islands support the Celestial Archipelago", reathArrival: "After the Mirror crisis, Katana’s navigators isolated a fragment quantum-correlated with a Reath receiver; its stable interference pattern supplied the reference and error correction needed to reconstruct consenting travelers without making Reath their place of origin." },
  gracus: { homeworld: "Thalassa", origin: "The marble island world Thalassa, where sentient-stone city-states surround Athun's brilliant seas", reathArrival: "The First Stone beneath Athun unfolded into a Timetwister after the Keepers' defeat, carrying a voluntary Gracus delegation to Reath while Thalassa remained their living home." },
  indela: { homeworld: "Varuna", origin: "The observatory world Varuna, where the beetle-wizard city of Kashi surrounds the Grand Academy and Eternal Archive", reathArrival: "Centuries after Kashi's golden age, Indela archivists recognized a Reath signal in Aryabhata's celestial equations, answered through a dormant Timetwister receiver, and only later sent a scholarly delegation from Varuna." },
  voltari: { homeworld: "Voltara", origin: "A human colony transformed by centuries of life beneath electrically charged oceans, permanent storms, and voluntary cybernetic augmentation", reathArrival: "Voltari scientists isolated a receiver quantum-correlated with Reath, then sent consenting travelers through one-way verified relays while Voltara retained protected continuity records and remained their home." },
  zynarth: { homeworld: "K'lar", origin: "The living world K'lar, a planetary Overmind whose Zynarth broods function as its cells and organs", reathArrival: "After an offworld coalition wounded K'lar, Zalara carried eggs, ecological memory, and consenting biological patterns through a Timetwister to establish a bounded new brood on Reath." },
  "astral-vanguard": { homeworld: "The Meridian Reach", origin: "A plural human and post-biological commonwealth centered on Meridian, where mortal volunteers can Ascend into long-lived sentinels bound by law, Aegis doctrine, and retained personal choice", reathArrival: "The Vanguard exploration ship Resolute reached Reath by conventional starflight, then discovered that the planet's stones connect worlds their drives could never reach." },
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
    before: "Zalara offers a ceasefire and explains that this Reath brood crossed from the wounded living world K'lar, whose distant planetary chorus can no longer direct every choice.",
    lines: ["Zalara: A brood is a conversation written in bodies.", "Alden: Then we will speak to the mind choosing peace.", "K'Lar: Not every queen chooses it.", "Myra Cross: Feral signatures incoming from three tunnels.", "Zalara: Defend the meeting, and I will teach you what followed us."],
    after: "The meeting survives. Zalara reveals that Zynarth queens remain individuals, capable of diplomacy, rivalry, and fear.",
    end: ["Zalara: K'lar still lives in our memory-patterns.", "Dr. Sera Venn: You transmitted minds inside the eggs.", "K'Lar: Bodies are local. Continuity is the pattern.", "Alden: The stones rebuilt you here.", "Zalara: And something listened during the rebuilding. Your thoughts are becoming loud."]
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
    after: "Touching the stone produces glimpses of Orthea, Gao, Pelagos, Volaris, K'lar, and civilizations the Vanguard has never met.",
    end: ["Dr. Sera Venn: It is not a time machine. It is a receiver index.", "Myra Cross: For planets?", "Oru: For compatible histories.", "Unknown Voice: You finally arrived.", "Alden: Seal the chamber. No one touches it alone again."]
  },
  {
    id: "fracture", title: "Blackreach: Veilfract", foe: "The Unreliable Battlefield", hero: "Commander Jonah Hale",
    story: "In Blackreach Basin, Hale's contact team restores anchor coverage while XenDra manifestations alter distance, sound, objectives, and the evidence soldiers use to recognize one another.",
    before: "Three stationary figures appear in Blackreach Basin. Every instrument reports ordinary ground, ordinary air, and impossible agreement; Captain Elara Venn is the first to realize the horizon is bending for her alone.",
    lines: ["Jonah Hale: Hold formation. Report only what two observers can verify.", "Soren Ilias: Contact is unreliable. Visuals are shifting.", "Elara Venn: They are not shifting. We are.", "Tamsin Rook: Thermals show one temperature. Motion says everything is moving.", "XenDra: You resist incorrectly."],
    after: "Automated extraction returns the team to agreed reality with no confirmed casualties and severe cognitive disruption. Elara insists the XenDra were showing them something; Hale records that this may be worse than an attack.",
    end: ["Tamsin Rook: Soren was beside me. Then nobody else could see him.", "Soren Ilias: I never moved.", "Elara Venn: They are not enemies. I do not think that question works anymore.", "Jonah Hale: Archive every contradiction. None of us gets to decide alone which memory is real.", "XenDra: You are consistent. That is why you fail."]
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
    id: "world-between", title: "The World Between", foe: "The Convergence Storm", hero: "High Marshal Alden and Commander Jonah Hale",
    story: "Defend the central convergence site as distant homeworlds overlap Reath and Marek Solis invokes Unified Command Protocol Nine, arguing that only centralized certainty can coordinate the crisis.",
    before: "Frumo vessels appear inland, Sheen vegetation crosses steel walls, Bizi instruments record tomorrow, and Rumin standards rise beside Vanguard antennas. Blackreach has convinced High Command that independent judgment is now a strategic vulnerability.",
    lines: ["Dr. Sera Venn: Reath is not suffering random anomalies. It is routing arrivals.", "Marek Solis: Protocol Nine places every unit on one verified command layer.", "Jonah Hale: Shared evidence is not surrendered judgment.", "Elara Venn: If every officer improvises, the convergence becomes twelve private wars.", "Alden: Hold the site. Share what is true. No system chooses for the people inside it."],
    after: "The defenders learn that Timetwisters rebuild travelers from protected biological information. Lieutenant Adrian Kade disobeys a faulty centralized order and saves a shelter, forcing the command dispute into the open.",
    end: ["Dr. Sera Venn: The stone carries the constraints needed to rebuild a living pattern.", "Adrian Kade: Protocol Nine marked those civilians as an acceptable loss.", "Marek Solis: An army cannot survive if every soldier decides which orders are real.", "Jonah Hale: A civilization cannot survive if nobody remains responsible for obeying them.", "Alden: Reath connects histories. It must not erase the choices that made them distinct."]
  },
  {
    id: "when-stars-remember", title: "When the Stars Remember", foe: "The XenDra Intelligence and the Astral Nexus", hero: "The Free Vanguard Coalition",
    story: "Stabilize Reath through Vanguard, Voltari, Zynarth, and historical-faction operations while Hale prevents Marek's Astral Nexus from turning shared information into compulsory command.",
    before: "Reath must be held in one coherent state long enough to close the uncontrolled paths. The Astral Nexus offers perfect information and optimized orders, but removes uncertainty by transferring every battlefield decision to one authority.",
    lines: ["Marek Solis: The Voltari coordinate better than us. The Zynarth adapt faster. The XenDra understand minds. What advantage remains?", "Jonah Hale: We disagree.", "Marek Solis: You call that an advantage?", "Jonah Hale: We connect different answers without making them one. We get to choose.", "Alden: Vanguard protects the settlements. Every ally keeps command of its own people."],
    after: "Hale disables compulsory control while preserving the Nexus as a voluntary information network. The fractures close, Protocol Nine is abolished, and Reath survives as a permanent meeting point whose strength comes from coordinated differences.",
    end: ["XenDra: Reath opened it.", "Elara Venn: Then we decide what answering makes us.", "Marek Solis: Uncertainty will cost lives.", "Jonah Hale: So will certainty without responsibility.", "Alden: Anchors synchronized. Close the final path.", "XenDra: You have mistaken postponement for victory.", "Narrator: Months later, the Resolute turns toward another unknown signal. The crew begins by arguing what to do."],
    cinematic: { kicker: "The network remembers", title: "When the Stars Remember", subtitle: "Reath survives because different minds choose to stand together.", image: ASTRAL_ART }
  }
];

const SCENE_STARTERS = Object.freeze({
  "new-horizon": { where: "Low orbit and the Horizon landing basin, Reath", when: "The first day of the Astral Vanguard landing", perspective: "Sergeant Myra Cross" },
  "something-beneath-us": { where: "The living tunnels beneath Outpost Horizon", when: "Twelve days after landing", perspective: "Myra leading the missing-colonist search" },
  "the-brood": { where: "The Horizon defensive perimeter", when: "The third week of the colony", perspective: "High Marshal Alden during first contact" },
  "other-intelligence": { where: "A neutral nursery chamber below Horizon", when: "Hours after the first ceasefire", perspective: "Alden across the table from Broodmother Zalara" },
  "golden-machine": { where: "The western sky above Horizon", when: "The first Voltari arrival on Reath", perspective: "Myra watching a fortress call itself an instrument" },
  conduit: { where: "The unfinished reality-anchor line in Mirror Valley", when: "The morning after Voltari first contact", perspective: "Alden coordinating three incompatible command systems" },
  "city-that-wasnt-there": { where: "A city absent from every previous orbital scan", when: "Expedition day forty-two—and seventeen years too early", perspective: "Myra confronting evidence of her future" },
  fracture: { where: "Blackreach Basin, beyond the nearest reliable anchor", when: "The first recorded Veilfract contact event", perspective: "Hale, Elara, Soren, and Rook experiencing incompatible versions of one encounter" },
  "enemy-of-my-enemy": { where: "The widening convergence scar", when: "The coalition's first joint offensive", perspective: "Alden translating between Vanguard, Voltari, and Zynarth methods" },
  "first-empire": { where: "The ancient-road breach at the convergence site", when: "After the coalition's apparent victory", perspective: "Myra meeting an army from Orthea" },
  "world-between": { where: "Reath's central convergence complex", when: "As distant homeworlds share one sky and Protocol Nine goes live", perspective: "Alden and Hale deciding whether coordination requires surrendered judgment" },
  "when-stars-remember": { where: "Every active convergence point and the Astral Nexus on Reath", when: "The final night of the uncontrolled opening", perspective: "Hale preserving choice while Alden coordinates a coalition of distinct commands" }
});

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
  sceneStarter: SCENE_STARTERS[spec.id],
  dialogue: [`Narrator: ${spec.before}`, ...spec.lines],
  endDialogue: [`Narrator: ${spec.after}`, ...spec.end],
  image: ASTRAL_ART,
  setup: setupFor(index, spec),
  ...(spec.cinematic ? { cinematic: spec.cinematic } : {})
}));

const METADATA = Object.freeze({
  commanderName: "The World Between",
  pitch: "Lead the plural civilization of the Meridian Reach from first landing through Voltari precision, Zynarth adaptation, XenDra uncertainty, and a crisis over whether humanity can coordinate without surrendering choice.",
  coverImage: ASTRAL_ART,
  homeworld: HOMEWORLDS["astral-vanguard"].homeworld,
  arrivalOnReath: HOMEWORLDS["astral-vanguard"].reathArrival,
  transitModel: TRANSIT_MODEL
});

const CHARACTERS = Object.freeze({
  "High Marshal Alden": "The expedition commander, committed to protecting settlements without turning first contact into occupation or coordination into ownership.",
  "Sergeant Myra Cross": "A field leader whose practical adaptability becomes the coalition's strongest shared language.",
  "Dr. Sera Venn": "A physicist who recognizes that Timetwisters preserve biological information across an error-corrected spacetime network.",
  "Commander Jonah Hale": "Leader of the Blackreach contact team and defender of accountable field judgment. Hale accepts command, coordination, and disagreement as compatible duties.",
  "Captain Elara Venn": "A disciplined officer whose unusual sensitivity recognizes XenDra distortions before instruments do. She fears fractured authority but refuses easy certainty after Veilfract.",
  "Lieutenant Soren Ilias": "A xenological analyst who records conflicting observations without forcing them into one premature answer, later building first-contact doctrine around understanding before combat.",
  "Sergeant Tamsin Rook": "A direct, capable soldier whose experience at Blackreach turns distrust into careful restraint. She becomes the practical voice behind the Vanguard's new contact protocols.",
  "Marek Solis": "The political architect of Protocol Nine and the Astral Nexus. Marek sincerely believes optimized central command is humanity's only defense against civilizations that coordinate, adapt, or alter reality better than it can.",
  "Lieutenant Adrian Kade": "An officer arrested after disobeying a tactically correct but morally catastrophic order. His case makes responsibility for obedience the campaign's human question.",
  "Colonel Adrian Vale": "An officer recovered after eleven missing years without aging. His impossible memories suggest the greatest threat may lie inside Vanguard institutions rather than beyond them.",
  "Broodmother Zalara": "An individual Zynarth queen carrying the living memory of K'lar and seeking survival on Reath without turning coexistence into assimilation.",
  "Voltari Custodian Oru": "A heavily augmented human-descended engineer from Voltara whose reality anchors protect observers as much as battlefields."
});

module.exports = { REATH_CAMPAIGN: CAMPAIGN, REATH_CAMPAIGN_METADATA: METADATA, REATH_CAMPAIGN_CHARACTERS: CHARACTERS, TIMETWISTER_TRANSIT_MODEL: TRANSIT_MODEL, FACTION_HOMEWORLDS: HOMEWORLDS };
