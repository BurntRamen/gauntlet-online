const FACTION_INTERACTION_QUOTES = Object.freeze({
  rumin: {
    commander: ["Discipline first. Then conquest.", "Rumie survives because we finish what hesitation begins.", "A road, a bank, a legion—each is a promise enforced."],
    city: ["Rumie remembers every road that returns with tribute.", "The Forum is loud because the empire is still alive.", "Stone records what rulers would rather forget."],
    general: ["The third line advances when the first two refuse to break.", "Orders become victories only after soldiers understand them.", "Keep the formation moving; history favors the army that arrives."]
  },
  sheen: {
    commander: ["Patience. Growth must be nourished.", "A forest is strongest when no single root commands it.", "We defend tomorrow by tending what can still grow."],
    city: ["Beli opens another living shelter beneath its canopy.", "Every scar in this bark became a doorway.", "The city breathes because its people breathe together."],
    general: ["Tradition has become a fence around empty soil.", "Prune the cruelty, not the memory.", "A reform that cannot take root is only a speech."]
  },
  frumo: {
    commander: ["I freed the Frumo from kings.", "The sea owes us nothing; that is why we share its gifts.", "Move the fleet before the ice decides for us."],
    city: ["Ristus keeps its lamps beneath the black water.", "The drowned avenues still know the tide's timetable.", "A sunken city learns to build with pressure."],
    general: ["The sea gives enough for all Frumo.", "Shift the line before the storm discovers it.", "No position is sacred when survival needs another course."]
  },
  bizi: {
    commander: ["Disorder has fallen below acceptable limits.", "Progress is a system that survives correction.", "Efficiency without purpose is only faster failure."],
    city: ["Constanti routes power where tomorrow needs it.", "Every tower is a question made from metal.", "The hub records the fault, repairs it, and improves."],
    general: ["Machines break. Empires fall. Determination endures.", "Velocity is useful only when command knows where to stop.", "Open the next route; I will make it defensible."]
  },
  mekan: {
    commander: ["Every ending is only another invitation.", "The procession carries grief so no guest carries it alone.", "Let the drums remember who cannot dance beside us."],
    city: ["San Mikal sets another place for the departed.", "Here, burial is not silence; it is attendance.", "The candles mark every name the festival refuses to lose."],
    general: ["The festival remembers every guest.", "Keep the rhythm honest and the mourners together.", "Joy without memory is only noise."],
    generals: {
      acama: ["I laid the first table before anyone believed guests would come.", "A celebration begins with shelter, not music.", "Build the square wide enough for strangers."],
      hui: ["The next procession enters on my count.", "Ceremony gives grief a road it can walk.", "Raise the lanterns; the living need to see one another."],
      monti: ["The festival remembers every guest.", "Nothing eternal stays unchanged.", "Keep one place open for the name we learn tomorrow."],
      ahu: ["Forward gently; sorrow is marching with us.", "A procession moves at the pace of its oldest mourner.", "The road becomes sacred because we cross it together."],
      temo: ["I call the departed; the living answer.", "Speak the names clearly. Absence is not erasure.", "The final drumbeat is also the first memory."]
    }
  },
  jali: {
    commander: ["A warrior bested is a warrior waiting to return.", "We inherit the fallen; we do not own them.", "Form the line with the living and the remembered."],
    city: ["Katana drifts above the wars it cannot forget.", "Every bridge is anchored to an oath below the clouds.", "The floating city carries its graves with it."],
    general: ["The fallen still know the road to battle.", "Honor is not obedience; it is a debt examined.", "Call one Revenant, and listen before commanding two."]
  },
  gracus: {
    commander: ["Give the crowd a battle worthy of legend.", "An arena reveals what comfort lets us hide.", "Win their roar, then deserve their memory."],
    city: ["Athun hears the giants beneath every breaking wave.", "The coast keeps monuments where the sea can challenge them.", "Every arena gate faces both glory and home."],
    general: ["A champion enters when the crowd needs courage.", "Measure the rival, then make the contest beautiful.", "Victory without risk teaches the audience nothing."]
  },
  indela: {
    commander: ["The next card is already written in the stars.", "An omen warns; it does not command.", "Fire and frost are answers to different questions."],
    city: ["Kashi opens another sealed theorem at moonrise.", "The Academy catalogs mistakes beside miracles.", "Every observatory window points toward a choice."],
    general: ["The omen is clear enough to act.", "Certainty is the most dangerous spell in the archive.", "Prepare both answers; fate dislikes being cornered."]
  },
  ingles: {
    commander: ["No voice stands above the common promise.", "A charter lives only while power agrees to read it.", "Take your place; no inherited chair outranks consent."],
    city: ["Ashbourne rings the assembly bell for every district.", "Its walls hold because their gates remain accountable.", "The city keeps amendments beside its oldest stones."],
    general: ["A formation is a promise every soldier can inspect.", "Authority borrowed from the ranks must return with an account.", "Hold the line without silencing the people inside it."]
  },
  mercaw: {
    commander: ["Argue freely. Act together.", "The federation is strongest after disagreement survives the vote.", "No aerie owns the sky between us."],
    city: ["Accord Spire carries twenty winds through one open hall.", "Every landing rail belongs to a different aerie.", "The Spire bends because rigid towers break."],
    general: ["The accord moves because each aerie chose it.", "Scatter to see; converge to decide.", "Leave every wing room to turn homeward."]
  },
  mtano: {
    commander: ["Listen before the water changes course.", "The mountain remembers every terrace we neglected.", "Carry the lesson downhill before the flood does."],
    city: ["Mawingu stores rain, seed, and testimony in equal measure.", "Each terrace supports the one below it.", "The city reads its history in waterlines."],
    general: ["Carry strength where the watershed needs it.", "A pathfinder returns with obligations, not trophies.", "We cross the ridge only after naming what it protects."]
  },
  russo: {
    commander: ["Endurance belongs to everyone beside us.", "No one freezes alone while the common hearth burns.", "Close the breach, then count who needs warmth."],
    city: ["Novaya Hearth keeps a lamp for every returning patrol.", "Its furnaces are public because winter is not.", "The city measures wealth in nights survived together."],
    general: ["Keep the shared hearth alive through the longest night.", "Reserve strength for the neighbor who cannot reserve their own.", "A wall is useful; the hands repairing it are essential."]
  },
  khevar: {
    commander: ["A verdict without evidence is authority wearing gold.", "Set the Living Scale where every witness can see it.", "Even the throne must submit its weight."],
    city: ["Iru-Nemeth stores testimony deeper than treasure.", "Its jackal gates open for the living and the remembered.", "Every avenue leads past a court of witnesses."],
    general: ["A preserved truth still needs a living witness.", "Record the contradiction; it may be the honest part.", "Archives defend the future from convenient memory."]
  },
  vardun: {
    commander: ["An oath matters most when breaking it would be easier.", "Call the clans; winter has found our harbor.", "Let the ravens carry names, not excuses."],
    city: ["Skeldheim drives its pilings through ice and saga.", "Every longhall keeps a seat for the storm-lost.", "The harbor chains are raised only by common oath."],
    general: ["The harbor remembers who returned and who did not.", "Fate is weather; preparation is our answer.", "Read the ravens, then trust the shield beside you."]
  },
  qhantari: {
    commander: ["A road lives only while people maintain it.", "Every station answers; begin the relay.", "Carry surplus toward need before need becomes tribute."],
    city: ["The High Storehouse counts grain by journeys remaining.", "Its doors face every road and belong to none.", "A full warehouse is failure if the last station starves."],
    general: ["No station is the whole road.", "Tie the line for the hands that follow ours.", "Distance becomes community when the relay holds."]
  },
  sahravi: {
    commander: ["Trust survives because the ledger stays open.", "Name the beneficiary before naming the price.", "A contract without exit is a decorated chain."],
    city: ["Sahra Gate records arrivals before profits.", "Every caravan shadow cools the public court.", "The gate remains neutral by making obligations visible."],
    general: ["Every promise must survive the distance between signatures.", "Read the margin; that is where power hides its fee.", "A fair commission leaves both parties able to refuse the next." ]
  },
  intari: {
    commander: ["Build together, and record who carried the stone.", "One feather cannot carry the sun. Form the Mita.", "The sunrise belongs to no throne."],
    city: ["Intiray climbs because every terrace bears another.", "Its sun courts begin with a roll of contributors.", "No golden wall forgets the hands beneath it."],
    general: ["A road serves the people who may choose where it leads.", "Fly high enough to see the whole obligation.", "Return with news that every valley can use." ]
  },
  thalassari: {
    commander: ["A profitable route must remain a route both shores can close.", "Open the harbors; everything between us is a road.", "Purple sails carry obligations farther than banners."],
    city: ["Tyrassa speaks in harbor bells and translated promises.", "Its quays belong first to safe arrival.", "The city prospers because strangers can leave it freely."],
    general: ["Empires conquer land. We govern everything between.", "Secure the passage, not the possession.", "A fleet is trusted when its wake remains open." ]
  },
  zynarth: {
    commander: ["Hatch. Adapt. Consume. Begin again.", "The brood does not waste what survival can transform.", "Many hungers become one ecology."],
    city: ["The Brood Nest pulses with meals remembered as structure.", "Resin corridors widen for the next useful form.", "Nothing entering the Nest remains without purpose."],
    general: ["The brood adapts through every keeper.", "Biomass is memory made available.", "Sacrifice is not loss when the swarm chooses what follows." ]
  },
  "astral-vanguard": {
    commander: ["Plan the descent. Control the ground. Finish the mission.", "Contradiction is terrain; map it before you judge it.", "We connect what refuses to become identical."],
    city: ["Vanguard Outpost converts every landing into a question.", "Its modules fit together because none pretends to be complete.", "The outpost survives by borrowing the right idea, not every idea."],
    general: ["Formation set. Await the descent.", "Improvisation is discipline applied to new evidence.", "Keep every unit distinct enough to adapt together." ]
  },
  voltari: {
    commander: ["Power serves civilization. Civilization does not serve the grid.", "Optimization without consent is merely elegant coercion.", "Keep every mind sovereign while the conduit opens."],
    city: ["Voltara Skyhold routes thunder through accountable gates.", "Every relay can be isolated by the people it serves.", "The Skyhold hums in harmonies no single tower controls."],
    general: ["Power flows through consent, or it becomes another prison.", "Transfer effort; never transfer away responsibility.", "Precision begins by asking who may stop the process." ]
  },
  xendra: {
    commander: ["A shape is only the angle from which you agreed to see it.", "We speak from the interval your certainty excludes.", "The door remembers being a wall."],
    city: ["The Deep Currents flow beneath locations that have never met.", "Here, distance is an aspect awaiting revision.", "The current arrives before the water chooses a past."],
    general: ["You hear one voice because the others are standing behind it.", "An echo may precede the sound that deserves it.", "Your next perception has already misplaced us." ]
  },
  morphlings: {
    commander: ["No form is final, but every life remains its own.", "Do not look away. The person you knew is still speaking.", "We survived the cure that refused to recognize us."],
    city: ["The Refuge records human names over laboratory numbers.", "Returning Light opens its airlocks to every chosen shape.", "This station calls adaptation survival, never contamination."],
    general: ["Adaptation is hope only when the changed may choose it.", "I witnessed continuity where the laboratory recorded failure.", "A body may become strange without becoming less its own." ]
  }
});

module.exports = { FACTION_INTERACTION_QUOTES };
