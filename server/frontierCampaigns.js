"use strict";

const FACTIONS = {
  ingles: {
    id: "ingles", name: "Ingles", setId: "frontiers", draftRules: true,
    cardImage: "/assets/gauntlet/ingles-emblem.svg",
    commander: { name: "Queen Victoria Ashbourne", image: "/assets/gauntlet/ingles-emblem.svg", text: "Long Reign — Build institutions that outlast one battle, then decide what an empire owes the peoples carrying its cost." },
    general: { name: "Lord Arthur Wellington", image: "/assets/gauntlet/ingles-emblem.svg", text: "Measured Campaign — Favor disciplined formations, prepared reserves, and victories that leave room for negotiation." },
    city: { name: "Ashbourne", image: "/assets/gauntlet/ingles-emblem.svg", text: "The Living Chronicle — Each generation inherits power, debts, and unfinished arguments from the last." },
    homeworld: "Albion Reach",
    origin: "The Ingles arose on Albion Reach through successive reigns, religious divisions, foreign wars, industrial expansion, and an empire whose achievements cannot be separated from the peoples asked to pay for them.",
    reathArrival: "A late Ingles expedition reached Reath through a Timetwister. Reath is the meeting place of these histories, never the Ingles homeworld or the source of their civilization."
  },
  mercaw: {
    id: "mercaw", name: "Mercaw", setId: "frontiers", draftRules: true,
    cardImage: "/assets/gauntlet/mercaw-emblem.svg",
    commander: { name: "Gerrick Warclaw", image: "/assets/gauntlet/mercaw-emblem.svg", text: "Independence Line — Turn local initiative into a coordinated uprising without pretending every revolutionary wants the same future." },
    general: { name: "Rook Talon", image: "/assets/gauntlet/mercaw-emblem.svg", text: "Frontier Initiative — Adapt quickly with the cards available instead of waiting for a perfect plan." },
    city: { name: "Accord Spire", image: "/assets/gauntlet/mercaw-emblem.svg", text: "Federated Signal — Diverse lanes become strongest when their independent choices converge." },
    homeworld: "Cairn",
    origin: "The Mercaw arose among Cairn's migrating aerie-cities. Their modern federation was forged in revolt against Ingles rule, amid independence advocates, loyalists, rival revolutionary leaders, and broken promises of freedom.",
    reathArrival: "Cairn's buried star-beacon proved to be a Timetwister receiver, and a federation chosen by public compact crossed to Reath without claiming it as a frontier to own."
  },
  mtano: {
    id: "mtano", name: "M'Tano", setId: "frontiers", draftRules: true,
    cardImage: "/assets/gauntlet/mtano-emblem.svg",
    commander: { name: "Rainkeeper Amari", image: "/assets/gauntlet/mtano-emblem.svg", text: "Living Waters — Preserve options, redirect pressure, and let measured defense prepare the next advance." },
    general: { name: "Pathfinder Kito", image: "/assets/gauntlet/mtano-emblem.svg", text: "Highland Paths — A formation survives by moving knowledge and strength to the lane that needs them." },
    city: { name: "Mawingu Terraces", image: "/assets/gauntlet/mtano-emblem.svg", text: "Ancestral Watershed — Every victory must leave enough life and memory for what follows." },
    homeworld: "M'Kora",
    origin: "The elephant-like M'Tano arose across M'Kora's golden savannahs and stone highlands. Their ancestral kingdoms preserve the living and the dead through the Ancestral Veil, a memory network whose blessings depend upon consent and remembrance.",
    reathArrival: "A resonant stone beneath the Temple of Names proved to be a Timetwister. Amari opened a consent-bound passage to Reath while M'Kora, M'Tanora, and the restored names of the forgotten remained the M'Tano's origin."
  },
  russo: {
    id: "russo", name: "Russo", setId: "frontiers", draftRules: true,
    cardImage: "/assets/gauntlet/russo-emblem.svg",
    commander: { name: "Warden Irina Volkov", image: "/assets/gauntlet/russo-emblem.svg", text: "Winter Oath — Endure early pressure, protect the formation, and commit strength only when the line can hold." },
    general: { name: "Mikhail Saran", image: "/assets/gauntlet/russo-emblem.svg", text: "Shared Hearth — Resources kept in reserve can preserve more than one lane through a long contest." },
    city: { name: "Novaya Hearth", image: "/assets/gauntlet/russo-emblem.svg", text: "The Long Thaw — Resilience is strongest when authority remains answerable to the people enduring beside it." },
    homeworld: "Ruskovia",
    origin: "The bear-like Russo survived the cold world Ruskovia through shared stores, immense forests, mass industry, and a political history divided between collective responsibility and centralized power.",
    reathArrival: "Miners uncovered a Timetwister beneath Ruskovia's ice during Petrov's industrialization. Later governments turned the discovery toward exploration and rivalry before Irina Volkov led an accountable expedition to Reath."
  },
  khevar: {
    id: "khevar", name: "Khejari", setId: "crossroads", draftRules: true,
    cardImage: "/assets/gauntlet/khevar-emblem.svg",
    mechanic: { name: "Judgment", summary: "Weigh an opponent's commitment, then answer it with the correct verdict rather than raw force.", gameplay: "Khejari suits turn disciplined blocks, repeated suits, and rising attacks into judgments: Guard, Mercy, Truth, and Sentence each reward a different reading of the duel." },
    commander: { name: "Pharaoh Atenkar", image: "/assets/gauntlet/khevar-emblem.svg", text: "Judgment — Power is legitimate only when the scale, the evidence, and the cost of the verdict remain visible." },
    general: { name: "Archivist Meret", image: "/assets/gauntlet/khevar-emblem.svg", text: "Open Ledger — Preserve testimony that neither throne nor machine can silently revise." },
    city: { name: "Iru-Nemeth", image: "/assets/gauntlet/khevar-emblem.svg", text: "Hall of the Living Scale — Every verdict enters the public record beside the name of the judge who gave it." },
    homeworld: "Neshara",
    origin: "The jackal-like Khejari arose beside Neshara's great river. Their kingdoms joined flood agriculture, scarab armor, funerary memory, and courts of public judgment into a civilization forever asking whether a verdict preserves cosmic balance or merely sanctifies authority.",
    reathArrival: "A sealed funerary gate beneath Iru-Nemeth proved to be a Timetwister receiver. Atenkar opened it before the Living Scale and reached Reath carrying witnesses rather than a claim of origin."
  },
  vardun: {
    id: "vardun", name: "Varkyn", setId: "crossroads", draftRules: true,
    cardImage: "/assets/gauntlet/vardun-emblem.svg",
    mechanic: { name: "Oath", summary: "Declare what a battle must preserve, then gain strength by honoring that promise even when the efficient choice is to abandon it.", gameplay: "Varkyn suits embody Raid, Kin, Fate, and Saga. They reward launching from lanes, holding the first defense, striking first, and completing a late attack sequence." },
    commander: { name: "Ulfrik Ironjaw", image: "/assets/gauntlet/vardun-emblem.svg", text: "Wolf-Oath — Unify the clans through promises they can challenge, remember, and demand that you keep." },
    general: { name: "Veyra Fateweaver", image: "/assets/gauntlet/vardun-emblem.svg", text: "Raven-Sight — A prophecy is a warning about choices, not permission to surrender them." },
    city: { name: "Skeldheim", image: "/assets/gauntlet/vardun-emblem.svg", text: "The Broken Fjords — Wolf clans, sacred ravens, and longships bind a young kingdom whose unity is never finished." },
    homeworld: "Skeldheim",
    origin: "The wolf-like Varkyn arose among Skeldheim's frozen fjords. Clan oaths, longship exploration, sacred ravens of Veyra, and fear of a final winter shaped a culture where honor is measured by what one refuses to abandon.",
    reathArrival: "The Frozen Passage opened into a Timetwister current and carried a Varkyn expedition to Reath. They named it a meeting shore, never the birthplace of their people."
  },
  qhantari: {
    id: "qhantari", name: "Qhantari", setId: "crossroads", draftRules: true,
    cardImage: "/assets/gauntlet/qhantari-emblem.svg",
    mechanic: { name: "Relay", summary: "Move strength and information between linked lanes so no position stands alone.", gameplay: "Qhantari suits reward lane defense, rising sequences, and changing suits—the card-game equivalent of couriers handing a message across a living road." },
    commander: { name: "Courier-General Amaru", image: "/assets/gauntlet/qhantari-emblem.svg", text: "Relay — Every lane is a station; every card should leave the next station stronger than it found it." },
    general: { name: "Killa Ropekeeper", image: "/assets/gauntlet/qhantari-emblem.svg", text: "Linked Roads — A route belongs to the communities that maintain, question, and survive it." },
    city: { name: "The High Storehouse", image: "/assets/gauntlet/qhantari-emblem.svg", text: "Terraced Reserve — Stored abundance matters only when the road can deliver it to need." },
    homeworld: "Ayara",
    origin: "The vicuna-like Qhantari joined Ayara's mountain valleys with terraces, rope bridges, relay couriers, public storehouses, and knotted records. Their road system is both their greatest achievement and their oldest political argument.",
    reathArrival: "A relay station above the cloud line received an impossible answer from Reath. Amaru rebuilt the route as a consent-bound crossing, leaving Ayara unmistakably their homeworld."
  },
  sahravi: {
    id: "sahravi", name: "Sahravi", setId: "crossroads", draftRules: true,
    cardImage: "/assets/gauntlet/sahravi-emblem.svg",
    mechanic: { name: "Commission", summary: "Match the right resource to a promise and convert exact preparation into flexible action.", gameplay: "Sahravi cards reward matching suits, contrasting suits, and ordered value growth, reflecting contracts whose strength depends on context rather than raw size." },
    commander: { name: "Commander Naya", image: "/assets/gauntlet/sahravi-emblem.svg", text: "Commission — A promise becomes power only when its cost, beneficiary, and witness remain legible." },
    general: { name: "Idris of the Open Ledger", image: "/assets/gauntlet/sahravi-emblem.svg", text: "Counter-Signature — Trust is not innocence; it is a system that makes deception answerable." },
    city: { name: "Sahra Gate", image: "/assets/gauntlet/sahravi-emblem.svg", text: "Caravan University — Gold moves goods, scholarship moves meaning, and neither travels without people." },
    homeworld: "Taziri",
    origin: "The gazelle-like Sahravi linked Taziri's savannah cities and desert universities through caravans, merchant houses, manuscript culture, and layered contracts. Their prosperity depends less on ownership than on promises surviving distance.",
    reathArrival: "A disputed caravan crossed a mirage that was actually a Timetwister aperture. Naya made the route public and refused every house's attempt to record Reath as acquired property."
  },
  intari: {
    id: "intari", name: "Intari", setId: "crossroads", draftRules: true,
    cardImage: "/assets/gauntlet/intari-emblem.svg",
    mechanic: { name: "Mita", summary: "Build strength collectively: later commitments become stronger when earlier workers, defenders, and record keepers have established the formation.", gameplay: "Intari suits represent Terraces, Mita, Quipu, and the Sun. They reward lane defense, repeated cooperation, coordinated suits, and a late Solar Ascendance rather than one isolated champion." },
    commander: { name: "Sapa Intar", image: "/assets/gauntlet/intari-emblem.svg", text: "Great Expansion — Build roads, terraces, and formations that let the many lift one another, then answer for anyone compelled to carry the work." },
    general: { name: "Amaru Kuntur", image: "/assets/gauntlet/intari-emblem.svg", text: "Wings of the Empire — Military strength exists to protect civilization, not to make participation indistinguishable from obedience." },
    city: { name: "Intiray", image: "/assets/gauntlet/intari-emblem.svg", text: "City Above the Clouds — Golden temples and terraced abundance prove what collective labor can build, while every stone remembers who was required to place it." },
    homeworld: "Intara",
    origin: "The condor-like Intari arose among Intara's cloud-piercing mountains. Terraced agriculture, quipu records, sacred solar rites, and rotating Mita labor joined isolated valleys into an empire that sincerely offers prosperity while struggling to recognize the right to refuse it.",
    reathArrival: "Illari preserved a solar flame and the Intiray quipu archive when an invading army opened the city's Timetwister stones. The surviving Intari later reached Reath as a meeting place, never as the origin of their mountain civilization."
  },
  thalassari: {
    id: "thalassari", name: "Thalassari", setId: "crossroads", draftRules: true,
    cardImage: "/assets/gauntlet/thalassari-emblem.svg",
    mechanic: { name: "Trade Routes", summary: "Link different suits into an exchange network, then turn fulfilled contracts into flexible defense and carefully timed power.", gameplay: "Thalassari suits represent Harbors, Contracts, Purple Routes, and Consortia. They reward lane defense, later blocks, changing suits between attacks, and rising value sequences—wealth that becomes strength only while the network keeps moving." },
    commander: { name: "King Hiramor", image: "/assets/gauntlet/thalassari-emblem.svg", text: "Architect of the Seas — Make distant peoples need one another, then remain answerable for the moment interdependence becomes dependence." },
    general: { name: "Hannakor", image: "/assets/gauntlet/thalassari-emblem.svg", text: "Gold and Iron — Convert commercial reach into decisive force without allowing every contract to become a weapon." },
    city: { name: "Tyrassa", image: "/assets/gauntlet/thalassari-emblem.svg", text: "City of a Thousand Harbors — Purple guilds, foreign embassies, and merchant fleets make the sea between nations more powerful than any shore." },
    homeworld: "Thalassar",
    origin: "The amphibious Thalassari arose among the archipelagos of ocean world Thalassar. Their iridescent city-states joined Imperial Purple, navigation, diplomacy, and enforceable contracts into a civilization that offers real prosperity while making every partner ask when a useful route becomes a chain.",
    reathArrival: "A contract written on an impossible star chart led Hiramor, Elissara, and Hannakor through a Timetwister sea to Reath. They arrived as traders and witnesses at a convergence point, never as natives or discoverers entitled to own it."
  }
};

const MTANO_STORY = [
  {
    title: "The First Fire", playableName: "M'Tari", ally: "Obasi", foe: "The River Raiders",
    where: "A Tano village beside the River Tano on homeworld M'Kora", when: "The tribal age, during an eclipse and the first recorded opening of the Ancestral Veil", perspective: "M'Tari, a frightened child hearing the dead for the first time",
    story: "When raiders kill his father and burn his village, young M'Tari hears Obasi call through an unseen field of accumulated memory. The courage of the dead manifests around him, beginning the Ancestral Veil and the First Teaching: leadership is a debt, and sacrifice is honorable only when freely given for something greater.",
    before: "Smoke hides the River Tano as M'Tari lifts his father's broken spear and realizes the voices are memories with wills, not weapons waiting for an owner.", after: "The raiders flee. M'Tari refuses a crown and gives the gathered tribes three laws that bind sacrifice to protection rather than glory.",
    dialogue: ["M'Tari: Father, if that is truly you, stand beside me—do not stand in place of me.", "Obasi: I give you courage, my son. What you do with it must remain yours."],
    endDialogue: ["Elder: The tribes will ask you to rule.", "M'Tari: Teach them that a leader belongs to the people who carry the cost."]
  },
  {
    title: "The Seven Drums", playableName: "Sundaro", ally: "Queen Nalia", foe: "King Sumako",
    where: "The Plains of Kumbara on M'Kora", when: "Five centuries after the First Awakening", perspective: "Sundaro, an exiled prince coordinating seven peoples who do not wish to become one people",
    story: "Sundaro returns from exile with seven tribal armies against King Sumako. Each drum retains a tribe's voice while their rhythms coordinate a shared defense, founding the Golden Kingdom and its Council of Seven without requiring cultural sameness.",
    before: "Seven armies face Sumako beneath seven banners. Sundaro's victory depends upon coordination, not submission to a single rhythm.", after: "Sumako falls and M'Tanora is founded beside the sacred river. The Council of Seven makes unity an agreement that must be renewed.",
    dialogue: ["Sumako: Seven armies mean seven defeats.", "Sundaro: Seven voices can still choose one answer."],
    endDialogue: ["Nalia: They offer you an empire.", "Sundaro: Then build them a council."]
  },
  {
    title: "The Temple of Names", playableName: "Mansaro", ally: "Elder Kofi", foe: "The Vanishing Names",
    where: "M'Tanora and the gold roads of M'Kora", when: "The Golden Kingdom at the height of its wealth", perspective: "Mansaro, a generous king discovering that generosity can serve vanity",
    story: "Mansaro's pilgrimage distributes so much gold that distant economies buckle. Returning home, he builds the Temple of Names and discovers that ordinary ancestors are disappearing from the Veil while kings remain vivid. He conceals the loss, choosing reputation over warning.",
    before: "Caravans pour gold through the continent while masons carve royal names into walls already too small for everyone who made the kingdom possible.", after: "The Temple opens in splendor, but its silent spaces reveal a system that remembers monuments more easily than lives.",
    dialogue: ["Mansaro: How can a blessing cause suffering?", "Elder Kofi: A river gives life, Majesty. A river can also drown a village."],
    endDialogue: ["The Vanishing Names: You gave stone to those already remembered.", "Mansaro: Record the silence. One day someone must answer it."]
  },
  {
    title: "The Night of Broken Tablets", playableName: "N'Karu", ally: "Archivist Adisa", foe: "The Nameless One",
    where: "The burning Temple of Names beneath M'Tanora", when: "The kingdom's long decline and N'Karu's seizure of power", perspective: "N'Karu, a reforming general becoming the exploiter he condemns",
    story: "N'Karu destroys ancestral tablets to free the living from dead authority. The damaged Veil releases the Nameless One, a consciousness formed from forgotten lives. N'Karu accepts its power in exchange for the identities of fallen soldiers, turning reform into extraction.",
    before: "Tablets break beneath soldiers' hammers while the Veil loses the names it used to distinguish guardian from victim.", after: "N'Karu saves the capital and forfeits his army's dead to a being made from everyone the official record erased.",
    dialogue: ["N'Karu: A kingdom kneeling before its past cannot walk toward its future.", "Adisa: You are burning testimony, not chains."],
    endDialogue: ["The Nameless One: You purchased survival with lives you called yours to spend.", "N'Karu: Then history will judge me—if you leave anyone to remember."]
  },
  {
    title: "The Kingdom of Stone", playableName: "Queen Nyasha", ally: "The Stonekeepers", foe: "N'Karu's Nameless Host",
    where: "Zimbara's unmortared stone city in M'Kora's southern highlands", when: "The War of Two Kingdoms", perspective: "Queen Nyasha, defending every family's right to its own ancestors",
    story: "Nyasha resists N'Karu's spectral army by speaking each fallen warrior's name aloud. Mortally wounded, she divides her essence among Zimbara's defenders by choice and becomes the first Living Ancestor, proving ancestral strength can be given without being taken.",
    before: "Spectral soldiers rebuild after every blow until Zimbara's archivists discover that a spoken name restores enough identity to refuse N'Karu's command.", after: "Nyasha dies without becoming property of a throne. Her freely divided strength remains among the people who consented to carry it.",
    dialogue: ["Nyasha: The ancestors belong to no throne.", "Stonekeeper: We found the soldiers' names."],
    endDialogue: ["Nyasha: I am asking whether you will carry my strength.", "Defenders: We consent."]
  },
  {
    title: "The Black Spear", playableName: "Shakaro", ally: "Nandiya", foe: "The Cost of Unification",
    where: "The eastern grasslands of M'Kora", when: "The Age of Spears", perspective: "Shakaro, an exiled child remaking warfare so he will never feel powerless again",
    story: "Shakaro creates the Black Spear, the Buffalo's Horns formation, and the Ancestral Boon, through which warriors voluntarily lend strength to a champion. His victories unify the grasslands but displace entire communities, forcing him to confront the difference between shared sacrifice and conquest.",
    before: "Warriors offer Shakaro fragments of their ancestral strength while Nandiya asks whether consent given under fear is truly free.", after: "The unification succeeds, but its refugees make visible every cost that triumphal histories would omit.",
    dialogue: ["Shakaro: With one formation, no clan will make us powerless again.", "Nandiya: Strength does not end suffering. It decides who suffers."],
    endDialogue: ["Refugee: You gave us the safety of obeying you.", "Shakaro: Then unification remains unfinished until refusal can survive it."]
  },
  {
    title: "The Uncounted", playableName: "Rainkeeper Amari", ally: "Pathfinder Kito", foe: "The Court of Kings",
    where: "The sealed lower archive of the Temple of Names", when: "The present age on M'Kora", perspective: "Amari, finding millions of lives compressed beneath famous memories",
    story: "Amari discovers that the Veil preserves rulers and warriors clearly while farmers, caregivers, laborers, and unnamed children have merged into a painful collective. The court orders the chamber sealed to protect public faith; Amari instead begins an impossible census.",
    before: "Rainwater exposes an unmarked stair beneath the Temple, where millions of overlapping memories speak without names.", after: "Amari broadcasts the hidden archive across M'Kora and turns remembrance from royal ceremony into public work.",
    dialogue: ["Amari: These are people denied enough memory to remain separate.", "Court Speaker: Civilization cannot remember everyone."],
    endDialogue: ["Amari: An order built on erasure was already endangered.", "The Uncounted: Begin with one name."]
  },
  {
    title: "A Million Names", playableName: "Rainkeeper Amari", ally: "M'Tari's Spirit", foe: "The Nameless One",
    where: "The fractured interior of the Ancestral Veil", when: "The first public Rite of the Uncounted", perspective: "Amari entering a consciousness that remembers suffering but no longer knows whose suffering it was",
    story: "The Nameless One attacks the rite because separating its memories feels like another death. Amari rejects destruction and helps communities restore ordinary lives through testimony, artifacts, and volunteered memory. M'Tari confronts the unintended cruelty of his creation.",
    before: "The Veil folds battlefields, kitchens, farms, and graves into one landscape as forgotten memories fight against being divided again.", after: "The Nameless One does not vanish. Millions of distinct voices begin emerging from it, and M'Tari offers the apology no founder's monument preserved.",
    dialogue: ["The Nameless One: You carved kings into stone and left us to dissolve.", "Amari: I cannot return every fact. I can refuse to call your pain faceless."],
    endDialogue: ["M'Tari: I remember you. I am sorry.", "The Nameless One: We are still wounded."]
  },
  {
    title: "The Ancestral Covenant", playableName: "Rainkeeper Amari", ally: "Queen Nyasha's Living Memory", foe: "The Inheritance Trial",
    where: "The Council of Seven in restored M'Tanora", when: "After the Rite of the Uncounted", perspective: "Amari drafting limits on how the living may receive ancestral power",
    story: "The kingdoms debate an Ancestral Covenant: no spirit may be compelled, every Boon must be voluntarily given, inherited strength carries a duty to preserve testimony, and sacrifice cannot excuse exploitation. Traditionalists challenge the covenant through ritual combat.",
    before: "For the first time, ancestors and living delegates share the Council floor, each with an explicit right to refuse participation.", after: "The covenant passes narrowly. Ancestral inheritance becomes a relationship with revocable consent rather than a resource controlled by rulers.",
    dialogue: ["Nyasha: A gift that cannot be refused is tribute.", "Amari: A sacrifice demanded by power is exploitation."],
    endDialogue: ["Trial Champion: Your limits will make M'Kora weak.", "Amari: They reveal which strength was never ours."]
  },
  {
    title: "The Stone Beneath M'Tanora", playableName: "Rainkeeper Amari", ally: "Pathfinder Kito", foe: "The Buried Warden",
    where: "A resonant chamber below the oldest foundation of M'Tanora", when: "The first verified Timetwister contact with Reath", perspective: "Amari separating an alien transport signal from the voices of the Veil",
    story: "A stone beneath M'Tanora answers a quantum-correlated receiver on Reath. Its Warden treats minds as transferable patterns and tries to activate every compatible ancestor at once. Amari must prevent a mass involuntary crossing while preserving the bridge.",
    before: "The stone sings in intervals no M'Tano drum uses, and the Veil answers with images of a world none of its ancestors inhabited.", after: "The Warden is contained. The Timetwister can transmit a willing person's verified pattern without moving M'Kora or rewriting the M'Tano origin.",
    dialogue: ["Kito: The sky beyond the stone is not M'Kora's.", "Buried Warden: Compatible identities detected. Transfer all."],
    endDialogue: ["Amari: Compatibility is not consent.", "Kito: Then we will build a crossing that can hear no."]
  },
  {
    title: "The Passage of Names", playableName: "Rainkeeper Amari", ally: "Archivist Kito", foe: "The Severing Current",
    where: "The paired Timetwister laboratories of M'Tanora and Reath", when: "The first consent-bound transit trials", perspective: "Amari carrying a continuity record that must remain hers on both sides of the dark",
    story: "Amari and Kito test the passage using entanglement checks, error correction, local matter reconstruction, and personal continuity archives. A severing current corrupts identity data, forcing the travelers to choose delay over a politically valuable but unsafe demonstration.",
    before: "Every traveler records a name, memory, refusal condition, and return covenant before the stone is allowed to read their pattern.", after: "The passage succeeds only after the expedition accepts that no schedule, discovery, or ancestral command outranks the traveler's continuing consent.",
    dialogue: ["Amari: The checksum says part of me would arrive as someone else's certainty.", "Severing Current: Approximation is sufficient for history."],
    endDialogue: ["Kito: Do you choose passage to Reath?", "Amari: Yes—and M'Kora remains the home to which that choice refers."]
  },
  {
    title: "I Remember You", playableName: "Rainkeeper Amari", ally: "The Remembered Many", foe: "The Convergence Storm",
    where: "Reath, around a newly opened savannah convergence site", when: "The M'Tano's first permanent encounter with civilizations from unrelated worlds", perspective: "Amari representing a people whose unity includes the right to remain distinct",
    story: "The M'Tano expedition emerges on Reath as incompatible histories overlap around the receiver. Amari stabilizes the crossing with voluntarily shared ancestral memory and establishes an embassy that records ordinary lives before heroic monuments. Their homeworld M'Kora remains their home; Reath becomes the place where their inheritance meets other futures.",
    before: "M'Tano travelers step onto Reath beneath an unfamiliar sky while the Remembered Many speak as separate voices joined by choice.", after: "The storm closes without severing the route. The first M'Tano archive on Reath begins with workers, caregivers, and travelers rather than rulers.",
    dialogue: ["Convergence Storm: Histories without one origin cannot remain coherent.", "Amari: Coherence does not require sameness."],
    endDialogue: ["Amari: M'Kora is our origin. Reath is the convergence point.", "The Remembered Many: Carry us as witnesses, never as weapons."]
  }
];

const RUSSO_STORY = [
  {
    title: "The First Crown", playableName: "Prince Vladomir", ally: "Svetlana Snowfur", foe: "Boris Ironpaw",
    where: "Moskara and the northern principalities of homeworld Ruskovia", when: "The last winter before unification", perspective: "Vladomir, convinced divided villages cannot survive the invasion ahead",
    story: "Vladomir unites Ruskovia's rival principalities against invasion. His coalition proves collective defense can save the northern settlements, but the victory also teaches future rulers that survival can justify absolute authority.",
    before: "Winter closes the roads between principalities as Vladomir asks independent clans to accept one command before the southern army arrives.", after: "Ruskovia survives and receives its first crown. Boris accepts command of the northern armies but warns that emergency unity can become permanent obedience.",
    dialogue: ["Boris Ironpaw: Every ruler who speaks of unity eventually demands obedience.", "Vladomir: Every chieftain who speaks of freedom still demands soldiers from his neighbors."],
    endDialogue: ["Svetlana: History will test whether saving a people and winning a kingdom remain the same achievement.", "Vladomir: Then let the first crown remember why it was accepted."]
  },
  {
    title: "The Black Paw", playableName: "Anastasia Silverclaw", ally: "General Mikhail Ursov", foe: "Tsar Ivan's Fear",
    where: "The imperial court and forest provinces of Ruskovia", when: "The centralization of the first Russo empire", perspective: "Anastasia, a noble witness to fear becoming a governing system",
    story: "Tsar Ivan creates the Black Paw Guard to eliminate treason and centralize the empire. Anastasia and Ursov defend border settlements while resisting orders that classify disagreement as disloyalty.",
    before: "Black Paw lists arrive before the enemy does, and villages learn that the empire fears unapproved speech more than invasion.", after: "The frontier is secured, but Ivan's apparatus turns inward. Anastasia preserves evidence for a generation that may someday distinguish order from terror.",
    dialogue: ["Ivan: A kingdom divided is a kingdom conquered.", "Anastasia: A kingdom that fears its ruler is already conquered."],
    endDialogue: ["Ivan: The Guard has proven necessary.", "Anastasia: The soldiers proved necessary. Your fear did not."]
  },
  {
    title: "The City of Iron", playableName: "Petrov the Great", ally: "Engineer Yelena Borin", foe: "The Human Cost",
    where: "Petrograd's foundries above the frozen gulf of Ruskovia", when: "The first great industrialization campaign", perspective: "Petrov, modernizing a vulnerable empire faster than its people can safely bear",
    story: "Petrov imports knowledge, builds factories, and founds Petrograd so Ruskovia can resist technologically superior powers. Laborers die beneath impossible quotas, and miners uncover a sealed circular structure whose symbols predate every Russo dynasty.",
    before: "Foundries glow through polar night while exhausted crews excavate the foundation of a city promised to children they may not live to see.", after: "Petrograd stands and the buried ring remains sealed. Petrov has made the empire stronger without answering whether strength purchased through coerced lives is another form of conquest.",
    dialogue: ["Petrov: Our children will inherit an empire no enemy can destroy.", "Yelena: Will they thank us for the bodies under its foundations?"],
    endDialogue: ["Worker: Some of us were treated as material for the future.", "Petrov: Record every name. Modernity must answer for its construction."]
  },
  {
    title: "The Frozen Retreat", playableName: "Mikhail Kutuzar", ally: "Aleksei the Conscript", foe: "Corsair Bonapart",
    where: "The road from burning Moskara into Ruskovia's winter interior", when: "The Frumo invasion through an unstable Timetwister route", perspective: "Kutuzar, surrendering land and prestige to preserve a people and exhaust an invader",
    story: "Corsair Bonapart's Frumo army crosses worlds and advances toward Moskara. Kutuzar refuses a glorious battle, evacuates civilians, burns supplies, and lets distance and winter break the invasion. Victory saves Ruskovia while making its own homeland the weapon.",
    before: "Frumo banners enter empty Moskara as Russo engineers burn stores their own families built and retreat into the snow.", after: "Bonapart's army collapses on the frozen road. Kutuzar mourns the young invaders and citizens consumed by a strategy history will call inevitable.",
    dialogue: ["Bonapart: I defeated kings. I will not be defeated by snow.", "Kutuzar: Snow is only the distance between your ambition and your supplies."],
    endDialogue: ["Aleksei: Ruskovia is victorious.", "Kutuzar: Then why does victory look so much like defeat?"]
  },
  {
    title: "The Starving Empire", playableName: "Tsar Nikolai Frostborn", ally: "Nadia Snowclaw", foe: "The Failing Monarchy",
    where: "Petrograd during bread riots and continental war", when: "The final winter of the Russo monarchy", perspective: "Nikolai, discovering that inherited duty cannot substitute for accountable government",
    story: "War, hunger, and industrial inequality collapse the imperial order. Soldiers refuse to fire on bread protesters, Nadia organizes relief councils, and Nikolai must choose between preserving the dynasty and preventing civil slaughter.",
    before: "Bread lines surround the imperial palace while exhausted regiments receive one final order to disperse their own families.", after: "Nikolai abdicates. The crown is removed without solving hunger, war, or the question of who may claim to speak for the people.",
    dialogue: ["Nadia: We were told suffering was necessary for victories we never saw.", "Nikolai: I thought the Russo would always need us."],
    endDialogue: ["Soldier: What happens tomorrow?", "Nadia: Tomorrow we discover whether a revolution can feed the people who made it."]
  },
  {
    title: "The Broken Crown", playableName: "Vladimir Redpaw", ally: "Leon Trotskar", foe: "General Blackpaw",
    where: "The rail corridors and imperial palace of Petrograd", when: "The revolutionary seizure of power", perspective: "Vladimir, promising equality while learning how quickly protection of a revolution can become control of it",
    story: "Vladimir and Trotskar organize workers and soldiers to depose the remaining imperial command. Their promise of Bread, Peace, and Equality wins the capital, but emergency censorship and arrests begin before the celebration ends.",
    before: "Armored trains approach Petrograd while neighborhood councils debate whether liberation can be defended without concentrating power again.", after: "The palace falls and the Union of Russo Republics is declared. Nadia hears the new government using the old monarchy's language of necessity.",
    dialogue: ["Vladimir: When will our happiness become necessary?", "General Blackpaw: Every revolution becomes a government with prisons."],
    endDialogue: ["Trotskar: The capital is ours.", "Nadia: No. It belongs to the people outside it."]
  },
  {
    title: "The Red Winter", playableName: "Nadia Snowclaw", ally: "Leon Trotskar", foe: "The White Claws",
    where: "Ruskovia's frozen rail network during civil war", when: "The revolution's first struggle for survival", perspective: "Nadia, defending the revolution while documenting the freedoms it suspends",
    story: "Royalists, separatists, and foreign armies surround the new republic. Trotskar's armored trains mobilize defenders faster than the White Claws can coordinate, while Nadia protects civilian councils from both counterrevolution and the Red Paws' expanding secret police.",
    before: "Every rail junction is a battlefield and every emergency decree arrives with the claim that liberty can be restored later.", after: "The Red Paws win the civil war. Nadia's archive shows that a revolution may survive its enemies and still be consumed by the habits it adopted against them.",
    dialogue: ["Trotskar: Without discipline, the revolution dies.", "Nadia: Without limits, it survives as the thing it opposed."],
    endDialogue: ["Citizen: Was the sacrifice worth it?", "Nadia: No government gets to answer that for those it sacrificed."]
  },
  {
    title: "The Steel State", playableName: "Nadia Snowclaw", ally: "Sergei Starclaw", foe: "Josef Steelclaw",
    where: "Moskara's ministries, factories, and prison railways", when: "The industrial consolidation after Vladimir's death", perspective: "Nadia, watching collective ownership become personal rule",
    story: "Josef Steelclaw defeats his rivals, expands mass industry, and turns mobilization into permanent governance. Nadia and scientist Sergei Starclaw expose purges hidden inside production records while acknowledging that factories, schools, and heating grids have transformed millions of lives.",
    before: "Production boards celebrate impossible gains while erased engineers disappear from the photographs beside their machines.", after: "The evidence escapes Ruskovia, but Josef retains power. The chapter refuses the easy fiction that modernization cancels terror or that terror cancels every collective achievement.",
    dialogue: ["Josef: One bear may fall. A thousand will take its place.", "Nadia: People are not replacement parts for your plan."],
    endDialogue: ["Josef: History will remember the factories.", "Nadia: Then we will preserve the names beneath their foundations."]
  },
  {
    title: "The War of Survival", playableName: "Georgi Zhukor", ally: "Sergei Starclaw", foe: "The Invading Host",
    where: "The industrial heartland and forests west of Moskara", when: "The greatest mechanized invasion in Russo history", perspective: "Zhukor, coordinating mass defense without pretending its soldiers are limitless",
    story: "An invading host drives deep into Ruskovia. Zhukor combines factories, rail mobilization, local resistance, and winter warfare to reverse the assault. He rejects commands that treat casualties as proof of loyalty and makes logistics answer to lives rather than abstract production.",
    before: "Factories relocate east while volunteer brigades hold evacuation corridors long enough for entire cities to move.", after: "Ruskovia survives through organized collective effort. Its victory belongs to millions, challenging every leader who would compress them into one heroic name.",
    dialogue: ["High Command: Hold the line at any cost.", "Zhukor: Costs have names. Give me time, trains, and authority to retreat."],
    endDialogue: ["High Command: The capital expects a triumphal report.", "Zhukor: Send them the casualty ledger unabridged."]
  },
  {
    title: "The Buried Ring", playableName: "Sergei Starclaw", ally: "Warden Irina Volkov", foe: "The Monolith Keeper",
    where: "The sealed excavation beneath Petrograd's oldest foundry", when: "The scientific thaw after generations of secrecy", perspective: "Sergei, reopening Petrov's discovery under public observation",
    story: "Archived plans lead Sergei and Irina back to the circular structure found during industrialization. The Timetwister connects Ruskovia to Reath and other worlds, but its Keeper offers efficient transit only through centralized control of every traveler's identity record.",
    before: "Workers, scientists, and local councils watch the excavation together so no ministry can quietly own the road between worlds.", after: "The Keeper yields to a distributed continuity protocol. Ruskovia can reach Reath without giving one office the power to define who arrives.",
    dialogue: ["Keeper: One authority produces one verified identity.", "Sergei: One authority also produces one convenient disappearance."],
    endDialogue: ["Irina: Reath is a destination, not an entitlement.", "Keeper: Redundancy is inefficient."]
  },
  {
    title: "The Cold Horizon", playableName: "Warden Irina Volkov", ally: "Mikhail Saran", foe: "The Mercaw Directorate",
    where: "Competing Russo and Mercaw relay stations around Reath", when: "The first interworld contest for political influence", perspective: "Irina, defending collective institutions without exporting them by coercion",
    story: "Russo and Mercaw missions compete for influence among newly contacted societies. Each claims to defend freedom while manipulating aid and access. Irina and Mikhail expose provocateurs on both sides and negotiate transparent limits on technology transfer and military presence.",
    before: "Two powers call the same settlement free while secretly funding rival answers to what freedom should mean.", after: "The confrontation ends without ideological resolution. Both factions must let Reath's communities accept, combine, or refuse what they offer.",
    dialogue: ["Mercaw Envoy: Your planning turns every citizen into a quota.", "Irina: Your markets turn every need into leverage."],
    endDialogue: ["Mikhail: Reath is not a board on which our histories settle their argument.", "Irina: It is where those histories finally have to answer other people."]
  },
  {
    title: "The Winter Oath", playableName: "Warden Irina Volkov", ally: "Mikhail Saran", foe: "The Convergence Storm",
    where: "Reath, at a failing Timetwister convergence site", when: "The first accountable Russo settlement beyond Ruskovia", perspective: "Irina coordinating survival while keeping emergency authority temporary and reviewable",
    story: "A convergence storm traps Russo, Mercaw, and local forces around a damaged receiver. Irina mobilizes mass production, shared stores, and scorched-earth denial without treating soldiers or civilians as replaceable. When the crisis ends, she dissolves her emergency command and submits every sacrifice to public review. The Russo homeworld Ruskovia remains their origin while Reath becomes the shared convergence point.",
    before: "The storm cuts Reath's settlement from every homeworld, and familiar arguments insist that survival requires one unquestioned command.", after: "The crossing stabilizes. Ruskovia remains the Russo homeworld, while Reath becomes a meeting place where endurance is shared without exporting permanent rule.",
    dialogue: ["Convergence Storm: Centralize or be divided.", "Irina: Coordinate, record, and preserve the right to challenge the coordinator."],
    endDialogue: ["Mikhail: The emergency has passed. Dissolve the command.", "Irina: Ruskovia is our origin. Reath is the convergence point."]
  }
];

const ARC = {
  ingles: {
    hero: "Queen Victoria Ashbourne", ally: "Lord Arthur Wellington", world: "Albion Reach", city: "Ashbourne",
    perspective: "successive Ingles generations inheriting power, debts, and unfinished arguments",
    conflict: "institutions can endure change while acknowledging the people and territories made to bear their cost",
    theme: "The Isles Across the Ages",
    chapters: [
      { title: "The Learned Crown", playableName: "King Alfric the Learned", ally: "Archivist Edwyn", foe: "The North-Sea Raiders", when: "The first unification of the Ingles islands", perspective: "Alfric, defending learning and law while gathering divided kingdoms", story: "Alfric turns monasteries, local oaths, and coastal defenses into a common resistance. His victory begins the Ingles state, but also the recurring question of whether unity protects local voices or absorbs them." },
      { title: "The Book and the Blade", playableName: "King Alfric the Learned", ally: "Archivist Edwyn", foe: "The Unwritten Winter", when: "The rebuilding after invasion", perspective: "Alfric deciding what knowledge a kingdom preserves and whose testimony enters its history" },
      { title: "The Divided Faith", playableName: "Queen Elizara", ally: "Councillor Beatrice Vane", foe: "The Ashen Synod", when: "The Ingles religious settlement", perspective: "Elizara, balancing conscience, authority, and a realm ready to fracture" },
      { title: "The Armada Season", playableName: "Queen Elizara", ally: "Admiral Rowan Vale", foe: "The Meridian Armada", when: "A foreign fleet approaches Albion Reach", perspective: "Elizara coordinating rival ports that distrust one another more than the invader" },
      { title: "A Stage for the Realm", playableName: "Queen Elizara", ally: "Elian Wren", foe: "The Censor's Office", when: "The cultural flowering after the Armada", perspective: "Elizara hearing artists turn national confidence into criticism of the crown" },
      { title: "Engines of Empire", playableName: "Queen Victoria Ashbourne", ally: "Lord Arthur Wellington", foe: "The Furnace Compact", when: "The height of Ingles industrial expansion", perspective: "Victoria confronting the transfer of wealth and suffering hidden inside imperial efficiency" },
      { title: "The Mercaw Question", playableName: "Lord Arthur Wellington", ally: "Queen Victoria Ashbourne", foe: "Gerrick Warclaw's Continental Line", where: "The Ingles-held ports of Cairn", when: "The Mercaw independence war", perspective: "Arthur, facing an uprising whose grievances his orders cannot erase", story: "Arthur is ordered to preserve Ingles rule in Cairn while Mercaw revolutionaries, loyalists, laborers, merchants, and local nations pursue different futures. The mission refuses to make either population a single political mind." },
      { title: "Crown and Parliament", playableName: "Queen Victoria Ashbourne", ally: "Elian Wren", foe: "The Imperial Hardliners", when: "The crisis after the Mercaw war", perspective: "Victoria deciding whether defeat produces reform, retaliation, or merely a different justification for control" },
      { title: "The Cost of Peace", playableName: "Lord Arthur Wellington", ally: "Mara Kest", foe: "The Unfinished Treaty", where: "A neutral harbor between Albion Reach and Cairn", when: "The first postwar settlement", perspective: "Arthur and Mara negotiating with factions that reject the peace for opposite reasons" },
      { title: "The Standing Stone", playableName: "Elian Wren", ally: "Lord Arthur Wellington", foe: "The Closed Horizon", when: "The first verified Timetwister signal", perspective: "Elian discovering that Ingles history is one history among many" },
      { title: "A Chronicle Between Worlds", playableName: "Elian Wren", ally: "Queen Victoria Ashbourne", foe: "The Convergence Storm", when: "The preparation of the first Ingles interworld expedition", perspective: "Elian arguing that contact must not become another imperial frontier" },
      { title: "The Open Door", playableName: "Elian Wren", ally: "Lord Arthur Wellington", foe: "The Convergence Storm", where: "Reath, at a newly opened convergence site", when: "The first Ingles arrival on Reath", perspective: "Elian carrying a civilization-spanning chronicle into contact with histories it did not create" }
    ]
  },
  mercaw: {
    hero: "Gerrick Warclaw", ally: "Mara Kest", world: "Cairn", city: "Accord Spire",
    perspective: "Gerrick Warclaw trying to win independence without defining freedom for everyone else",
    conflict: "a revolution can coordinate common action while honoring the different freedoms its supporters were promised",
    theme: "The Many-Star Revolution",
    chapters: [
      { title: "Taxed Without a Voice", playableName: "Gerrick Warclaw", ally: "Mara Kest", foe: "The Ingles Customs Office", when: "The last years of Ingles rule on Cairn", perspective: "Gerrick turning a trade protest into a movement that still contains loyalists and cautious reformers" },
      { title: "The First Talon", playableName: "Gerrick Warclaw", ally: "Rook Talon", foe: "The Redcoat Aeries", when: "The first armed clash of the Mercaw revolution", perspective: "Gerrick learning that a symbolic victory can make compromise harder" },
      { title: "Loyal Wings", playableName: "Gerrick Warclaw", ally: "Mara Kest", foe: "The Cairn Loyalist Council", when: "Civil conflict spreads through the aerie-cities", perspective: "Gerrick facing Mercaw loyalists whose fears cannot be reduced to cowardice" },
      { title: "Promises at the Crossing", playableName: "Mara Kest", ally: "Gerrick Warclaw", foe: "The Deferred Freedom Bloc", when: "Revolutionary leaders bargain for soldiers and labor", perspective: "Mara recording which promised freedoms the provisional government intends to postpone", story: "The revolution asks disenfranchised communities to fight while several leaders plan to delay their freedom until after victory. Mara makes those contradictions public before they become the new nation's foundation." },
      { title: "Winter at Blackfeather", playableName: "Gerrick Warclaw", ally: "Rook Talon", foe: "General Wellington's Encirclement", when: "The revolution's hardest winter", perspective: "Gerrick holding a coalition together when hunger makes every principle negotiable" },
      { title: "Rivals of the Republic", playableName: "Gerrick Warclaw", ally: "Mara Kest", foe: "The Revolutionary Directorate", when: "Victory becomes plausible", perspective: "Gerrick confronting fellow revolutionaries who want independence under their permanent command" },
      { title: "The Aerie Surrenders", playableName: "Gerrick Warclaw", ally: "Rook Talon", foe: "The Ingles Expeditionary Line", when: "The decisive campaign for Cairn", perspective: "Gerrick winning a military end to the war without pretending it resolves the revolution's internal disputes" },
      { title: "A Republic of Debts", playableName: "Mara Kest", ally: "Gerrick Warclaw", foe: "The Unpaid Army", when: "The peace immediately after independence", perspective: "Mara forcing the new republic to account for the people who won a freedom they have not received" },
      { title: "One Signal, Many Wings", playableName: "Gerrick Warclaw", ally: "Mara Kest", foe: "The Counterfeit Convener", when: "The first constitutional crisis", perspective: "Gerrick defending plural government from a leader using his own legend as precedent" },
      { title: "The Buried Beacon", playableName: "Gerrick Warclaw", ally: "Rook Talon", foe: "The Beacon Warden", when: "The discovery of Cairn's Timetwister", perspective: "an aging Gerrick confronting a frontier that cannot be claimed through revolution" },
      { title: "The Frontier Refused", playableName: "Mara Kest", ally: "Gerrick Warclaw", foe: "The Annexation Bloc", when: "The vote on an expedition to Reath", perspective: "Mara insisting that independence gives Mercaw no right to colonize another people's meeting place" },
      { title: "The Many-Star Accord", playableName: "Gerrick Warclaw", ally: "Mara Kest", foe: "The Convergence Storm", where: "Reath, at a newly opened convergence site", when: "The first Mercaw arrival on Reath", perspective: "Gerrick carrying an unfinished revolution into contact with civilizations that owe it nothing" }
    ]
  },
  mtano: {
    hero: "Rainkeeper Amari", ally: "Pathfinder Kito", world: "M'Kora", city: "Mawingu Terraces",
    perspective: "Amari listening to ancestors and living witnesses without confusing inheritance with ownership",
    titles: MTANO_STORY.map((chapter) => chapter.title),
    foes: MTANO_STORY.map((chapter) => chapter.foe),
    conflict: "a civilization can honor inherited sacrifice without exploiting the living or erasing the forgotten",
    theme: "The Kingdom of a Thousand Ancestors",
    chapters: MTANO_STORY
  },
  russo: {
    hero: "Warden Irina Volkov", ally: "Mikhail Saran", world: "Ruskovia", city: "Moskara",
    perspective: "Irina Volkov between organized endurance and the agency of those asked to endure",
    titles: RUSSO_STORY.map((chapter) => chapter.title),
    foes: RUSSO_STORY.map((chapter) => chapter.foe),
    conflict: "collective endurance can outlive monarchy, revolution, and emergency rule without making individuals expendable",
    theme: "The Winter Crown",
    chapters: RUSSO_STORY
  },
  khevar: {
    hero: "Pharaoh Atenkar", ally: "Archivist Meret", world: "Neshara", city: "Iru-Nemeth",
    perspective: "Atenkar learning that judgment without accountable evidence becomes another form of conquest",
    conflict: "a civilization devoted to balance can judge power without making the throne the measure of truth",
    theme: "The Living Scale",
    chapters: [
      { title: "The Grain on the Scale", foe: "The Palace Guard", when: "The third failed flood", perspective: "Atenkar judging a royal reserve while villages starve", story: "A late queen's grain reserve is sealed inside her tomb while villages starve. Atenkar opens the case before the public and discovers that the law protects the dead more clearly than the living." },
      { title: "Scarab Witness", foe: "The Counterfeit Priests", perspective: "Meret proving ritual objects can preserve evidence" },
      { title: "The Missing Names", foe: "The Royal Redactors", perspective: "Atenkar finding workers removed from the monument they built" },
      { title: "Judgment of the Flood", foe: "The Upstream Houses", perspective: "Meret weighing testimony from communities with incompatible maps" },
      { title: "The Pharaoh's Measure", foe: "The Coronation Council", perspective: "Atenkar submitting his own succession to the Living Scale" },
      { title: "The Open Tomb", foe: "The Preservation Edict", perspective: "Meret asking whether honoring the dead can require contradicting them" },
      { title: "Sentence of the River", foe: "The River Reavers", perspective: "Atenkar distinguishing justice from vengeance" },
      { title: "The Mekan Equation", foe: "The Perfect Procedure", perspective: "Atenkar debating whether optimized outcomes can substitute for moral judgment" },
      { title: "The Crown Weighs Itself", foe: "The Last Seal", perspective: "Atenkar placing royal judgment under public law" },
      { title: "The Door Beneath Iru-Nemeth", foe: "The Funerary Warden", perspective: "Meret recognizing a receiver inside a sacred gate" },
      { title: "Witnesses to the Crossing", foe: "The Closed Record", perspective: "Atenkar refusing secret passage between worlds" },
      { title: "The Scale Between Worlds", foe: "The Convergence Storm", where: "Reath, beside a river that remembers impossible skies", perspective: "Atenkar carrying an accountable court into a world his people did not create" }
    ]
  },
  vardun: {
    hero: "Ulfrik Ironjaw", ally: "Veyra Fateweaver", world: "Skeldheim", city: "Skeldheim",
    perspective: "Ulfrik turning rival wolf clans into a kingdom without making unity another word for obedience",
    conflict: "honor can preserve kin, oath, and memory without sacrificing lives merely to prove devotion",
    theme: "The Final Saga",
    chapters: [
      { title: "The Broken Fjord", foe: "The Rival Clans", when: "The war for the first high kingship", perspective: "Ulfrik unifying clans that remember every inherited grievance", story: "Ulfrik Ironjaw wins the field but refuses to erase the laws and names of defeated clans, beginning a kingdom held together by challengeable oaths." },
      { title: "The Blood Price", foe: "The Rival Jarl", perspective: "Ulfrik seeking victory without spending his warriors as proof of courage" },
      { title: "The Great Voyage", foe: "The Coastal Defenders", perspective: "Varkyn crews learning that exploration, trade, and raiding create different obligations" },
      { title: "Honor Among Wolves", foe: "Bjorn Bloodhowl", perspective: "Ulfrik surviving an honorable rival who believes mercy weakens every oath" },
      { title: "The Frozen Passage", foe: "The Ancient Guardians", perspective: "Veyra protecting an expedition while sacred ravens reveal a road between worlds" },
      { title: "A Kingdom Divided", foe: "Sigvard and Eirik", perspective: "Ulfrik facing rival claimants whose visions of Skeldheim cannot coexist unchanged" },
      { title: "The Last Winter", foe: "The Winterborn", perspective: "Veyra deciding whether prophecy describes extinction or warns against causing it" },
      { title: "The Final Saga", foe: "The Oathbreaker Crown", perspective: "the clans deciding whether Skeldheim becomes kingdom, confederation, or endless feud" },
      { title: "The Rumin Standard", foe: "The Efficient General", perspective: "Ulfrik confronting an enemy who sacrifices soldiers for victory while the Varkyn sacrifice victory to preserve an oath" },
      { title: "Ravens Beyond the Storm", foe: "The Starless Current", perspective: "Veyra following sacred ravens into a Timetwister passage" },
      { title: "No Shore Is Ownerless", foe: "The Annexation Jarls", perspective: "Ulfrik refusing to turn discovery into title" },
      { title: "The Oath Between Worlds", foe: "The Convergence Storm", where: "Reath's inland sea", perspective: "Ulfrik naming Reath a meeting shore while Skeldheim remains the Varkyn homeworld" }
    ]
  },
  qhantari: {
    hero: "Courier-General Amaru", ally: "Killa Ropekeeper", world: "Ayara", city: "The High Storehouse",
    perspective: "Amaru carrying orders while learning that roads must answer the communities beneath them",
    conflict: "connection can distribute agency rather than merely extend central command",
    theme: "The Last Relay",
    chapters: [
      { title: "The Broken Road", foe: "The Capital Seal", when: "A landslide divides the high valleys", perspective: "Amaru ordered to abandon the lower villages", story: "Conflicting claimants send orders to the storehouses after a landslide cuts the imperial road. Amaru recruits bridgekeepers to reopen a route the official maps ignore." },
      { title: "Bridgekeepers", foe: "The Ravine Wind", perspective: "Killa recovering engineering knowledge held outside the capital" },
      { title: "The Living Dispatch", foe: "The Seal Hunters", perspective: "Amaru keeping one dispatch moving across every linked station" },
      { title: "Storehouse Winter", foe: "The Hoarding Governor", perspective: "Killa proving abundance without delivery is guarded waste" },
      { title: "Knots That Disagree", foe: "The Official Count", perspective: "Amaru preserving incompatible testimony instead of forcing one total" },
      { title: "The Road Votes", foe: "The Imperial Inspector", perspective: "couriers deciding whether neutrality protects injustice" },
      { title: "Across the Cloud Line", foe: "The Silent Relay", perspective: "Killa answering a message from no known valley" },
      { title: "The Unmapped Community", foe: "The Erasure Order", perspective: "Amaru recognizing connection without annexation" },
      { title: "The Last Imperial Courier", foe: "The Central Claimant", perspective: "Amaru surrendering a title so the relay remains public" },
      { title: "Rope Bridge of Stars", foe: "The Receiver Warden", perspective: "Killa building a crossing that can be closed from either side" },
      { title: "Every Station Consents", foe: "The Forced March", perspective: "Amaru requiring each community to ratify the passage" },
      { title: "The Road Beyond Mountains", foe: "The Convergence Storm", where: "Reath, at a terraced convergence site", perspective: "Amaru adding Reath as a destination, never as Ayara's origin" }
    ]
  },
  sahravi: {
    hero: "Commander Naya", ally: "Idris of the Open Ledger", world: "Taziri", city: "Sahra Gate",
    perspective: "Naya rebuilding trust after discovering that her own office authenticated the deception",
    conflict: "trade can transfer agency and knowledge instead of disguising extraction as exchange",
    theme: "The Price of a Promise",
    chapters: [
      { title: "Three Claims, One Cargo", foe: "The Forged Contract", when: "A caravan vanishes outside Sahra Gate", perspective: "Naya learning three houses sold the same promise", story: "Three merchant houses sell claims on one missing cargo. While Naya keeps a struggling city supplied, Idris traces the forged contracts back to the crown office Naya once led." },
      { title: "The Open Ledger", foe: "The Closed House", perspective: "Idris exposing evidence without collapsing every innocent contract" },
      { title: "Caravan of Rivals", foe: "The Salt-Road Raiders", perspective: "Naya making each house honor another's promise" },
      { title: "University of Dust", foe: "The Manuscript Fire", perspective: "Idris treating learning as infrastructure" },
      { title: "Gold Without Water", foe: "The Well Monopoly", perspective: "Naya confronting a legal contract that produces an intolerable result" },
      { title: "The Counter-Signature", foe: "The Crown Auditor", perspective: "Naya testifying against the system that made her powerful" },
      { title: "A Promise Across Distance", foe: "The Mirage Broker", perspective: "Idris identifying a temporal market no ledger can balance" },
      { title: "The City Owes the Road", foe: "The Gate Consortium", perspective: "Naya learning merchants are not the only authors of trade" },
      { title: "The Route Reopens", foe: "The Last Default", perspective: "rival houses honoring one another's commitments" },
      { title: "The Contract Between Worlds", foe: "The Timetwister Custodian", perspective: "Idris writing clauses for reconstructed identities" },
      { title: "No World for Sale", foe: "The Acquisition Houses", perspective: "Naya placing Reath outside ordinary property law" },
      { title: "The Fourth Signature", foe: "The Convergence Storm", where: "Reath, at the caravan aperture", perspective: "Naya asking Reath's communities to countersign their own terms" }
    ]
  },
  intari: {
    hero: "Sapa Intar", ally: "Illari", world: "Intara", city: "Intiray",
    perspective: "Sapa Intar building genuine abundance while learning that prosperity imposed without consent remains imperial power",
    conflict: "collective labor can sustain a civilization without turning every person and conquered community into an instrument of the state",
    theme: "The Empire Beneath the Sun",
    chapters: [
      { title: "Children of the Mountain", playableName: "The Golden Siblings", ally: "The First Quipu Keeper", foe: "The Stonefeather Chieftain", when: "The legendary founding of Intiray", perspective: "two siblings carrying a golden staff through divided mountain valleys", story: "Two siblings emerge from a sacred cavern carrying a fragment of celestial fire. Where their golden staff sinks into the valley soil, scattered condor settlements build Intiray and defend the first Temple of the Sun together." },
      { title: "The Emperor Who Reshaped the World", foe: "Warlord Chaska", perspective: "young Sapa Intar rallying farmers, laborers, and soldiers after the old court abandons the capital", story: "An invading coalition surrounds Intiray. Sapa Intar turns Mita rotations into terraces, walls, supply lines, and a citizen army, proving that coordination can defeat a stronger host." },
      { title: "The Four Quarters", foe: "Queen Yana", perspective: "Sapa Intar connecting four regions while an independent kingdom questions the cost of joining", story: "Roads and rope bridges bind four administrative quarters. Some valleys choose the empire's security; Queen Yana refuses a prosperity whose labor obligations were written without her people." },
      { title: "Roads Above the Clouds", foe: "The Broken Pass", perspective: "Amaru Kuntur defending workers whose road is becoming both lifeline and invasion route", story: "Mita crews raise an impossible mountain road. Amaru must protect the laborers while leaving local communities the power to close a route built across their homes." },
      { title: "The Price of Paradise", foe: "Governor Qhapaq", perspective: "Illari uncovering diverted supplies beneath the empire's golden abundance", story: "Terraces overflow and temples shine, but provincial governors redirect food and compulsory labor from conquered settlements. Illari asks whether a civilization can call itself benevolent when refusal is treated as treason." },
      { title: "The Emperor's Indispensable Judgment", foe: "The Imperial Council", perspective: "Sapa Intar protecting corrupt governors because he fears reform will fracture the state", story: "Amaru demands public trials while Sapa Intar prioritizes unity. The player must preserve roads and civilians without allowing the institutions that feed the empire to become shields for their administrators." },
      { title: "Solar Ascendance", foe: "The Eclipsed Priesthood", perspective: "Illari separating devotion from the throne's claim to divine certainty", story: "An eclipse activates the oldest solar mirrors. Selected defenders ascend through accumulated Sun marks, but Illari refuses to let transformation become proof that every imperial command is sacred." },
      { title: "The Broken Sun", playableName: "Amaru Kuntur", ally: "Illari", foe: "Prince Atar", perspective: "Amaru choosing between rival heirs after Sapa Intar's death", story: "Two heirs claim the Sun Crown: one promises tradition, the other reform through force. Roads built for unity carry civil war into every quarter while Illari declares that the Sun has turned its face from the empire." },
      { title: "The Last Sunrise", playableName: "Amaru Kuntur", ally: "Illari", foe: "The Conqueror Beyond the Gate", perspective: "the exhausted Intari reuniting after civil war against an army seeking their Timetwister stones", story: "Outsiders arrive through the ancient gate and exploit the empire's divided roads. Intiray falls, but Illari preserves the solar flame and Amaru evacuates quipu archives, workers, and children rather than sacrificing the people to preserve a throne." },
      { title: "The Quipu Beyond the Sky", playableName: "Illari", ally: "Amaru Kuntur", foe: "The Silent Receiver", perspective: "Illari discovering that the rescued quipu records answer a distant world", story: "Knotted records taken from Intiray begin changing beneath the preserved solar flame. Their pattern describes a paired receiver on Reath and a passage that can carry willing travelers between worlds." },
      { title: "A Road Must Be Chosen", playableName: "Amaru Kuntur", ally: "Illari", foe: "The Restoration Bloc", perspective: "surviving Intari deciding whether a new road repeats the empire's compulsory expansion", story: "Imperial loyalists would seize the Reath passage and rebuild the Four Quarters abroad. Amaru requires every refugee community to choose whether, how, and under whose authority the crossing will open." },
      { title: "The Sunrise Between Worlds", playableName: "Illari", ally: "Amaru Kuntur", foe: "The Convergence Storm", where: "Reath, on a mountain above the paired receiver", perspective: "Illari carrying a fragment of Intara's sacred flame into a convergence that no empire owns", story: "Illari leads a consent-bound expedition from homeworld Intara to Reath. Mita becomes voluntary mutual aid, the solar flame lights a shared refuge, and the Intari begin again without declaring the meeting world another quarter of their empire." }
    ]
  },
  thalassari: {
    hero: "King Hiramor", ally: "Queen Elissara", world: "Thalassar", city: "Tyrassa",
    perspective: "King Hiramor building peace through exchange while learning that a route can connect equal partners or quietly make one dependent upon the other",
    conflict: "trade can create mutual prosperity without converting need, debt, and access into instruments of domination",
    theme: "Everything Between",
    chapters: [
      { title: "The Purple Shores", playableName: "Hiramor", ally: "Dyer Tiros", foe: "Admiral Zarvek", when: "Before the Thousand Harbors were united", perspective: "young Hiramor defending coastal workshops whose purple dye draws both customers and raiders", story: "Crimson Corsairs sever the routes between Thalassar's rival ports. Hiramor organizes shared convoys and dye reserves, discovering that the sea between cities can become a common institution rather than empty territory." },
      { title: "The Broken Trade Routes", playableName: "Hiramor", ally: "Navigator Tiros", foe: "The Crimson Corsairs", perspective: "Hiramor persuading suspicious city-states to protect one another's cargo", story: "Zarvek scatters false signals across the archipelago. The player reconnects harbors with different goods and customs, earning victory only when every partner retains a route home." },
      { title: "The Merchant King", foe: "Lord Varekos", perspective: "Hiramor turning commercial influence into a crown while his oldest rival asks who consented to be organized", story: "Tyrassa becomes the City of a Thousand Harbors. Varekos accepts the prosperity but rejects contracts that let Hiramor's guilds determine which ports may flourish." },
      { title: "The Price of Unity", foe: "The Closed Harbor League", perspective: "Hiramor confronting a legal network that rewards Tyrassa by starving dissenting ports", story: "A treaty written to stop piracy has become a monopoly. Hiramor must reopen the sea and submit his own crown contracts to foreign review." },
      { title: "Across the Endless Sea", playableName: "Queen Elissara", ally: "Hannakor", foe: "The Storm Without Stars", perspective: "Elissara leading exiles beyond the known routes rather than accepting a ceremonial place in Hiramor's court", story: "Elissara crosses an uncharted ocean with merchants, refugees, and artisans. The fleet survives because each vessel carries a different necessity and no captain can command the whole expedition alone." },
      { title: "Shores of Opportunity", playableName: "Queen Elissara", ally: "Hannakor", foe: "Governor Maltheron", perspective: "Elissara deciding whether a promising colony may grow without repeating Tyrassa's dependencies", story: "Maltheron offers protection in exchange for permanent control of the new harbor. Elissara refuses, founding Kartheia through contracts that expire unless every district renews them." },
      { title: "The Exiled Queen", playableName: "Queen Elissara", ally: "Dyer Tiros", foe: "Admiral Kharos", perspective: "Elissara defending Kartheia from a commander who calls conquest the price of independence", story: "Kharos tries to turn the exile fleet into a colonial navy. Elissara must preserve the settlement while proving that a new city is not free if its prosperity depends upon taking another shore." },
      { title: "The Founding of Kartheia", playableName: "Queen Elissara", ally: "King Hiramor", foe: "The Tribute Compact", perspective: "Elissara and Hiramor recognizing one civilization can contain two politically distinct maritime traditions", story: "Tyrassa and Kartheia negotiate alliance without reunification. Their mechanical faction remains shared, but their governments, obligations, and histories stay separate." },
      { title: "Gold and Iron", playableName: "Hannakor", ally: "Queen Elissara", foe: "General Marcellion", perspective: "Hannakor converting wealth into military power against a Rumin army that calls territorial unity the only durable peace", story: "Marcellion's legions occupy the inland ends of every trade route. Hannakor fields contract fleets and hired specialists, then confronts how easily commercial coordination becomes an army answerable only to payment." },
      { title: "The War of Roads and Standards", playableName: "Hannakor", ally: "King Hiramor", foe: "General Marcellion", perspective: "Hannakor testing interdependence against the Rumin promise of peace through unified authority", story: "Neither side is a simple villain: Rumin roads provide security, and Thalassari routes preserve plurality. The player wins by keeping neutral ports supplied rather than merely destroying the legions." },
      { title: "The Contract Beyond the Tide", playableName: "King Hiramor", ally: "Queen Elissara", foe: "The Impossible Signatory", perspective: "Hiramor reading a star chart whose route terminates on a world no Thalassari vessel has visited", story: "A sealed contract begins adding clauses in an unknown hand. Its coordinates describe Reath and a Timetwister passage that transfers people like a promise reconstructed at its destination." },
      { title: "Everything Between Worlds", playableName: "Queen Elissara", ally: "Hannakor", foe: "The Convergence Blockade", where: "Reath, at a harbor formed around a Timetwister sea", perspective: "Elissara negotiating a route that belongs neither to Tyrassa nor Kartheia", story: "A joint expedition from homeworld Thalassar reaches Reath. Hiramor opens the route, Hannakor defends it, and Elissara gives Reath's communities the right to close it—proving the Thalassari can connect worlds without claiming the water between them." }
    ]
  }
};

function makeChapter(factionId, arc, index) {
  const number = index + 1;
  const plan = arc.chapters?.[index] || {};
  const title = plan.title || arc.titles[index];
  const foe = plan.foe || arc.foes[index];
  const playableName = plan.playableName || arc.hero;
  const ally = plan.ally || arc.ally;
  const final = number === 12;
  const transit = number >= 10;
  const setting = plan.where || (transit ? (number === 12 ? "Reath, at a newly opened convergence site" : `An ancient Timetwister beneath ${arc.city}`) : `${arc.city} and the surrounding regions of ${arc.world}`);
  const story = plan.story || (final
    ? `${arc.hero} leads a consent-bound expedition from homeworld ${arc.world} through the Timetwister to Reath. They defend the crossing without treating the convergence world as their origin or a possession.`
    : transit
      ? `An ancient stone reveals a quantum-correlated receiver on Reath. ${arc.hero} must prove that identity, consent, and responsibility can survive reconstruction across worlds.`
      : `On homeworld ${arc.world}, ${playableName} confronts ${foe} as the faction tests whether ${arc.conflict}.`);
  const before = plan.before || (final
    ? `${arc.world}'s travelers emerge on Reath as histories from unrelated worlds overlap around the same unstable receiver.`
    : transit
      ? `The stone beneath ${arc.city} answers a sky that does not belong to ${arc.world}, and every measurement describes the distant world Reath.`
      : `${foe} threatens ${arc.city}, forcing an argument about power to become a battle with consequences beyond victory.`);
  const after = plan.after || (final
    ? `${arc.world} remains the faction's home and origin. The expedition establishes a bounded presence on Reath, the shared convergence point.`
    : transit
      ? `The first stable passage proves the Timetwister transmits an error-corrected pattern of a willing traveler and reconstructs that pattern from matter at the paired receiver.`
      : `${arc.city} survives, but the victory changes who may speak, decide, and carry the faction's values into the next crisis.`);
  const id = `${factionId}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const chapter = {
    id, playableName, opponentName: foe, title, story,
    sceneStarter: { where: setting, when: plan.when || (number === 1 ? `The founding crisis on ${arc.world}` : number < 10 ? `Generation ${number} of the ${arc.theme} chronicle` : "The first verified Timetwister contact with Reath"), perspective: plan.perspective || arc.perspective },
    dialogue: plan.dialogue ? [
      `Narrator: ${before}`,
      ...plan.dialogue,
      `${ally}: A fast answer can still leave the wrong people carrying its cost.`,
      `${playableName}: Then we act together, record the cost, and leave the next choice open.`
    ] : [
      `Narrator: ${before}`,
      `${playableName}: We will decide what survives this crisis by how we survive it.`,
      `${foe}: Your principles are delays dressed as courage.`,
      `${ally}: A fast answer can still leave the wrong people carrying its cost.`,
      `${playableName}: Then we act together, record the cost, and leave the next choice open.`
    ],
    endDialogue: plan.endDialogue ? [
      `Narrator: ${after}`,
      ...plan.endDialogue,
      `${ally}: A people that stops arguing has usually stopped choosing.`,
      `${playableName}: We carry the lesson forward without pretending it is the only lesson.`
    ] : [
      `Narrator: ${after}`,
      `${foe}: You won this field. You did not settle the argument.`,
      `${ally}: Good. A people that stops arguing has usually stopped choosing.`,
      `${playableName}: We carry the lesson forward without pretending it is the only lesson.`,
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

const CAMPAIGNS = Object.fromEntries(Object.entries(ARC).map(([id, arc]) => [id, (arc.chapters || arc.titles).map((_, index) => makeChapter(id, arc, index))]));
const NARRATION = Object.fromEntries(Object.values(CAMPAIGNS).flat().map((entry) => [entry.id, { beforeBattle: entry.dialogue[0].replace(/^Narrator:\s*/, ""), afterBattle: entry.endDialogue[0].replace(/^Narrator:\s*/, "") }]));
const METADATA = Object.fromEntries(Object.entries(ARC).map(([id, arc]) => [id, { commanderName: arc.theme, pitch: `Follow the ${FACTIONS[id].name} across homeworld ${arc.world}, test whether ${arc.conflict}, and reach Reath as a convergence point rather than an origin.`, coverImage: FACTIONS[id].cardImage }]));
function oppositionArchive(factionId) {
  const arc = ARC[factionId];
  const foes = arc.chapters ? arc.chapters.map((chapter) => chapter.foe) : arc.foes;
  const titles = arc.chapters ? arc.chapters.map((chapter) => chapter.title) : arc.titles;
  return Object.fromEntries(foes.map((name, index) => [
    `opposition-${index + 1}`,
    {
      name,
      role: `Opposition in ${titles[index]}`,
      description: `${name} turns the conflict of “${titles[index]}” into a test of whether ${arc.conflict}. The encounter matters because its answer changes who may speak, coordinate, and carry the faction's values into the next crisis.`
    }
  ]));
}

const CHARACTERS = {
  ingles: {
    alfric: { name: "Alfric the Learned", role: "Early Defender and Unifier", description: "A scholar-king who joins divided island realms through law, education, and common defense. His reign begins the Ingles chronicle without resolving whether unification preserves local voices or absorbs them." },
    elizara: { name: "Queen Elizara", role: "Queen of the Divided Faith", description: "A ruler navigating religious fracture, foreign invasion, and cultural renewal while learning that national unity cannot require a single conscience." },
    victoria: { name: "Queen Victoria Ashbourne", role: "Monarch at the Height of Empire", description: "A long-reigning sovereign forced to confront how industrial achievement and imperial confidence transfer their costs to distant peoples." },
    arthur: { name: "Lord Arthur Wellington", role: "General and Imperial Adviser", description: "A disciplined commander sent to preserve Ingles rule in Cairn. Arthur can recognize the Mercaw cause without being able to step outside the institution whose orders he carries." },
    elian: { name: "Elian Wren", role: "Later Constitutional Reformer", description: "A supporting figure from a later generation who treats law as a revisable promise. Elian helps the Ingles meet Reath without reducing their entire civilization to his era." },
    rowan: { name: "Rowan Vale", role: "Admiral of the Island Fleet", description: "A defender who coordinates rival ports during the Armada crisis and demonstrates that decisive command need not become permanent authority." },
    ...oppositionArchive("ingles")
  },
  mercaw: {
    gerrick: { name: "Gerrick Warclaw", role: "Commander of the Mercaw Revolution", description: "A revolutionary commander who turns scattered resistance into an independence movement without ever fully controlling what independence means to its loyalists, radicals, merchants, soldiers, and promised-but-deferred citizens." },
    mara: { name: "Mara Kest", role: "Federal Convener and Revolutionary Witness", description: "A coalition builder who records the freedoms revolutionary leaders promise before victory. Mara remains essential without replacing Gerrick as the commander at the center of the independence story." },
    rook: { name: "Rook Talon", role: "Frontier Pathfinder", description: "An inventor and pilot who loves independence enough to defend other people's right to it. Rook turns engines, maps, and improvised relays into connective tissue without treating discovery as a claim of ownership." },
    ...oppositionArchive("mercaw")
  },
  mtano: {
    mtari: { name: "M'Tari", role: "Founder of the Ancestral Veil", description: "A child prophet who teaches that leadership is a debt and sacrifice is honorable only when freely given, yet unintentionally creates a memory system that favors those history already remembers." },
    sundaro: { name: "Sundaro", role: "Founder of the Golden Kingdom", description: "An exiled prince who coordinates seven independent tribes without erasing their identities and establishes the Council of Seven." },
    mansaro: { name: "Mansaro", role: "The Golden King", description: "A generous patron whose hunger to be remembered blinds him to the ordinary ancestors disappearing beneath his monuments." },
    nyasha: { name: "Queen Nyasha", role: "First Living Ancestor", description: "The defender of Zimbara who proves ancestral power may be freely distributed rather than taken by a throne." },
    shakaro: { name: "Shakaro", role: "Bearer of the Black Spear", description: "A brilliant unifier whose voluntary Ancestral Boons create collective strength while his conquests expose how fear can compromise consent." },
    amari: { name: "Amari", role: "Rainkeeper and Restorer of Names", description: "A scientist and oral historian who transforms remembrance from royal ceremony into public responsibility, then carries its consent-bound practice to Reath." },
    kito: { name: "Kito", role: "Pathfinder and Continuity Archivist", description: "A mobile guardian who carries knowledge between communities and across the Timetwister without claiming to own what he preserves." },
    nameless: { name: "The Nameless One", role: "The Unremembered Many", description: "A tragic consciousness formed when forgotten lives lost their individual memories inside the Veil. It seeks recognition because it remembers suffering but no longer knows whose suffering it was." }
  },
  russo: {
    vladomir: { name: "Prince Vladomir", role: "Bearer of the First Crown", description: "A unifier who saves divided principalities from invasion and leaves later rulers the dangerous precedent that survival justifies central authority." },
    anastasia: { name: "Anastasia Silverclaw", role: "Witness of the Black Paw", description: "A noble dissenter who preserves evidence when Tsar Ivan turns fear of disunity into a system of internal terror." },
    petrov: { name: "Petrov the Great", role: "Founder of Petrograd", description: "A modernizer who gives Ruskovia industry and discovers the buried Timetwister while forcing laborers to carry the human cost of his future." },
    kutuzar: { name: "Mikhail Kutuzar", role: "General of the Frozen Retreat", description: "A patient defender who sacrifices territory and prestige to exhaust the Frumo invasion, then refuses to describe the dead as the price of a clean victory." },
    nadia: { name: "Nadia Snowclaw", role: "Revolutionary Archivist", description: "A defender of the revolution who records every freedom suspended in its name and recognizes the old monarchy's reasoning inside new institutions." },
    josef: { name: "Josef Steelclaw", role: "Architect of the Steel State", description: "An industrial dictator who treats citizens as replaceable components while building public systems whose real achievements complicate any simple account of his rule." },
    zhukor: { name: "Georgi Zhukor", role: "Marshal of Survival", description: "A logistics commander who mobilizes an entire society while insisting that every cost has a name and every retreat may preserve irreplaceable lives." },
    irina: { name: "Irina Volkov", role: "Warden of the Winter Oath", description: "A crisis commander who coordinates collective endurance, distributes control of identity records, and relinquishes emergency authority when the danger passes." },
    mikhail: { name: "Mikhail Saran", role: "Keeper of the Shared Hearth", description: "An engineer and organizer who keeps local networks alive whenever central certainty fails and makes interworld assistance answer to the people receiving it." }
  },
  khevar: {
    satek: { name: "Pharaoh Atenkar", role: "Bearer of the Living Scale", description: "A jackal pharaoh who submits royal power—including his own succession—to public judgment rather than treating the throne as truth's author." },
    meret: { name: "Archivist Meret", role: "Keeper of the Open Ledger", description: "A priest-archivist who treats ritual preservation as evidence held in trust for the living, not secrecy owed to power." },
    neferet: { name: "Queen Neferet", role: "Author of the Disputed Reserve", description: "A dead sovereign whose intentions survive only through conflicting ledgers, sealed jars, and the people asked to interpret them." },
    ...oppositionArchive("khevar")
  },
  vardun: {
    yrsa: { name: "Ulfrik Ironjaw", role: "First High Jarl", description: "A wolf war leader who can win clan wars but must learn that a kingdom survives through contestable oaths rather than permanent victory." },
    torven: { name: "Veyra Fateweaver", role: "Raven Seer", description: "Keeper of the sacred ravens who treats prophecy as a warning that protects agency, never as an order to accept extinction." },
    asta: { name: "Bjorn Bloodhowl", role: "Honorable Rival", description: "A ferocious jarl whose courage is real and whose belief that mercy weakens honor repeatedly threatens the kingdom Ulfrik is trying to build." },
    ...oppositionArchive("vardun")
  },
  qhantari: {
    amaru: { name: "Courier-General Amaru", role: "Bearer of the Last Relay", description: "A vicuna courier who begins by carrying the capital's seal and ends by making the road answer the communities that sustain it." },
    killa: { name: "Killa Ropekeeper", role: "Bridge Engineer", description: "A keeper of local engineering traditions omitted from imperial maps, and the architect of routes that can be refused from either end." },
    seal: { name: "The Capital Seal", role: "Authority Without a Voice", description: "An object whose conflicting orders reveal how infrastructure can extend power while disguising the people who chose it." },
    ...oppositionArchive("qhantari")
  },
  sahravi: {
    naya: { name: "Commander Naya", role: "Former Chief Bookkeeper", description: "A gazelle commander who keeps a city supplied while tracing forged claims back to the crown office she once led." },
    idris: { name: "Idris of the Open Ledger", role: "Scholar of Counter-Signatures", description: "A young scholar who proves that trust is strongest when every promise preserves its cost, beneficiary, and witness." },
    houses: { name: "The Three Merchant Houses", role: "Rivals Bound by One Cargo", description: "Competing institutions forced to honor one another's promises before the desert route can function again." },
    ...oppositionArchive("sahravi")
  },
  intari: {
    sapa: { name: "Sapa Intar", role: "The Sun-Crowned Emperor", description: "A brilliant, disciplined, and paternalistic architect of Intari abundance who cannot initially understand why anyone would reject the prosperity his empire offers." },
    illari: { name: "Illari", role: "Voice of the Sun", description: "The high priestess who reads eclipses as warnings rather than commands. She protects the weakest members of Intari society and preserves the solar flame after Intiray falls." },
    amaru: { name: "Amaru Kuntur", role: "The Condor General", description: "A mountain commander loyal to the Intari people before any throne. He believes military strength should protect civilization rather than impose it." },
    yana: { name: "Queen Yana", role: "Sovereign of the Unjoined Valley", description: "A neighboring ruler who forces Sapa Intar to confront the difference between offering infrastructure and denying another people the right to refuse it." },
    ...oppositionArchive("intari")
  },
  thalassari: {
    hiramor: { name: "King Hiramor", role: "Architect of the Seas", description: "A merchant king who believes peace can be engineered through interdependence. His routes create genuine abundance, but his confidence makes it difficult to recognize when partners can no longer afford to refuse him." },
    elissara: { name: "Queen Elissara", role: "Founder of Kartheia", description: "An exiled queen who crosses the Endless Sea and founds the New Harbor. She insists that the Kartheian and Tyrian traditions can share a civilization without sharing a government." },
    hannakor: { name: "Hannakor", role: "General of Gold and Iron", description: "A military innovator who converts commercial networks into fleets, intelligence, and supply. He protects Thalassari autonomy while embodying the danger that every exchange may become leverage." },
    tiros: { name: "Tiros of the Purple Guild", role: "Navigator and Dyer", description: "A guild artisan who remembers that Imperial Purple begins as difficult labor and living ecology, not merely prestige in a royal ledger." },
    ...oppositionArchive("thalassari")
  }
};

module.exports = { FRONTIER_FACTIONS: FACTIONS, FRONTIER_CAMPAIGNS: CAMPAIGNS, FRONTIER_CAMPAIGN_NARRATION: NARRATION, FRONTIER_CAMPAIGN_METADATA: METADATA, FRONTIER_CAMPAIGN_CHARACTERS: CHARACTERS };
