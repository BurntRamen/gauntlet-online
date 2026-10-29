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
      : `On homeworld ${arc.world}, ${arc.hero} confronts ${foe} as the faction tests whether ${arc.conflict}.`);
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

const CAMPAIGNS = Object.fromEntries(Object.entries(ARC).map(([id, arc]) => [id, arc.titles.map((_, index) => makeChapter(id, arc, index))]));
const NARRATION = Object.fromEntries(Object.values(CAMPAIGNS).flat().map((entry) => [entry.id, { beforeBattle: entry.dialogue[0].replace(/^Narrator:\s*/, ""), afterBattle: entry.endDialogue[0].replace(/^Narrator:\s*/, "") }]));
const METADATA = Object.fromEntries(Object.entries(ARC).map(([id, arc]) => [id, { commanderName: arc.theme, pitch: `Follow the ${FACTIONS[id].name} across homeworld ${arc.world}, test whether ${arc.conflict}, and reach Reath as a convergence point rather than an origin.`, coverImage: FACTIONS[id].cardImage }]));
function oppositionArchive(factionId) {
  const arc = ARC[factionId];
  return Object.fromEntries(arc.foes.map((name, index) => [
    `opposition-${index + 1}`,
    {
      name,
      role: `Opposition in ${arc.titles[index]}`,
      description: `${name} turns the conflict of “${arc.titles[index]}” into a test of whether ${arc.conflict}. The encounter matters because its answer changes who may speak, coordinate, and carry the faction's values into the next crisis.`
    }
  ]));
}

const CHARACTERS = {
  ingles: {
    elian: { name: "Elian Wren", role: "First Speaker", description: "A constitutional reformer who treats law as a revisable promise among people rather than a sacred machine. Elian's authority comes from making disagreement legible, preserving the right to amend a decision even while Albion Reach is under attack." },
    rowan: { name: "Rowan Vale", role: "Marshal of the Common Fleet", description: "A disciplined defender who accepts civilian argument as part of command rather than an obstacle to it. Rowan proves that a formation can remain decisive without turning temporary military necessity into a returning crown." },
    ...oppositionArchive("ingles")
  },
  mercaw: {
    mara: { name: "Mara Kest", role: "Federal Convener", description: "A patient coalition builder who knows that unity chosen noisily is stronger than obedience imposed efficiently. Mara keeps the many aeries inside the Accord by protecting their right to refuse, renegotiate, and still return to the common flight." },
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
  }
};

module.exports = { FRONTIER_FACTIONS: FACTIONS, FRONTIER_CAMPAIGNS: CAMPAIGNS, FRONTIER_CAMPAIGN_NARRATION: NARRATION, FRONTIER_CAMPAIGN_METADATA: METADATA, FRONTIER_CAMPAIGN_CHARACTERS: CHARACTERS };
