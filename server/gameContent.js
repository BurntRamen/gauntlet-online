"use strict";

const RULES_VERSION = "gauntlet-rules-v1";
const CONTENT_VERSION = "gauntlet-content-v1";

const RUMIN_COLLECTION_CARDS = [
  {
    id: "rumin-gilded-scale-legionary",
    factionId: "rumin",
    name: "Gilded Scale Legionary",
    type: "unit",
    rarity: "common",
    value: 3,
    text: "When this attacks after a diamond was paid this turn, it gets +1 value."
  },
  {
    id: "rumin-forum-ledger-runner",
    factionId: "rumin",
    name: "Forum Ledger Runner",
    type: "unit",
    rarity: "common",
    value: 2,
    text: "If this is your first attack this turn, you may treat one payment card as +1 value."
  },
  {
    id: "rumin-vault-shield-bearer",
    factionId: "rumin",
    name: "Vault Shield Bearer",
    type: "unit",
    rarity: "common",
    value: 4,
    text: "When blocking, prevent 1 damage if you overpaid for this block."
  },
  {
    id: "rumin-coin-scale-spear",
    factionId: "rumin",
    name: "Coin-Scale Spear",
    type: "weapon",
    rarity: "common",
    value: 4,
    text: "Arm from lane: when you attack from hand, reveal this from your lane to attach it. The attacker gets +2 value this combat, then discard this."
  },
  {
    id: "rumin-senate-vault-guard",
    factionId: "rumin",
    name: "Senate Vault Guard",
    type: "unit",
    rarity: "uncommon",
    value: 5,
    text: "The first time each turn you overpay for this by 2 or more, gain 1 life."
  },
  {
    id: "rumin-marble-market-tribune",
    factionId: "rumin",
    name: "Marble Market Tribune",
    type: "unit",
    rarity: "uncommon",
    value: 6,
    text: "After this attacks, your next Rumin weapon armed from a lane gives an additional +1 value."
  },
  {
    id: "rumin-rumie-vault-shield",
    factionId: "rumin",
    name: "Rumie Vault Shield",
    type: "weapon",
    rarity: "uncommon",
    value: 6,
    text: "Arm from lane: attach to a hand attacker. It gets +3 value this combat, then discard this."
  },
  {
    id: "rumin-imperial-scale-pike",
    factionId: "rumin",
    name: "Imperial Scale Pike",
    type: "weapon",
    rarity: "uncommon",
    value: 5,
    text: "Arm from lane: attach to a hand attacker. It gets +2 value, or +4 if it shares a suit with your previous attack."
  },
  {
    id: "rumin-aurelian-clawblade",
    factionId: "rumin",
    name: "Aurelian Clawblade",
    type: "weapon",
    rarity: "rare",
    value: 7,
    text: "Arm from lane: attach to a hand attacker. It gets +4 value this combat. If you overpaid by 2 or more, gain 1 life."
  },
  {
    id: "rumin-basilisk-standard",
    factionId: "rumin",
    name: "Basilisk Standard",
    type: "standard",
    rarity: "rare",
    value: 6,
    text: "Your fourth attack each turn gets +2 additional value if a weapon is armed to it."
  },
  {
    id: "rumin-jewel-bank-contract",
    factionId: "rumin",
    name: "Jewel-Bank Contract",
    type: "tactic",
    rarity: "rare",
    value: 5,
    text: "The next Rumin card you play this turn may be paid for with one card as though it had +2 value."
  },
  {
    id: "rumin-kaisers-gold-claw",
    factionId: "rumin",
    name: "Kaiser's Gold Claw",
    type: "weapon",
    rarity: "mythic",
    value: 9,
    text: "Arm from lane: attach to a hand attacker. It gets +5 value this combat, or +6 if it is your fourth attack this turn."
  },
  {
    id: "rumin-rumie-market-colossus",
    factionId: "rumin",
    name: "Rumie Market Colossus",
    type: "unit",
    rarity: "mythic",
    value: 10,
    text: "When this attacks, each Rumin weapon you control in a lane may arm to it. Each armed weapon gives an extra +1 value."
  }
];

const SHEEN_COLLECTION_CARDS = [
  {
    id: "sheen-rootwatch-initiate",
    factionId: "sheen",
    name: "Rootwatch Initiate",
    type: "unit",
    rarity: "common",
    value: 3,
    text: "When this blocks, it gets +1 value if you have already blocked this turn."
  },
  {
    id: "sheen-quiet-grove-sentinel",
    factionId: "sheen",
    name: "Quiet Grove Sentinel",
    type: "unit",
    rarity: "common",
    value: 4,
    text: "If this prevents all damage from an attack, gain 1 life."
  },
  {
    id: "sheen-mossbound-staff",
    factionId: "sheen",
    name: "Mossbound Staff",
    type: "relic",
    rarity: "common",
    value: 2,
    text: "When paid for a block, the first blocking card gets +1 value."
  },
  {
    id: "sheen-living-bark-guard",
    factionId: "sheen",
    name: "Living Bark Guard",
    type: "unit",
    rarity: "common",
    value: 5,
    text: "This may block hand attacks as though it had +1 value."
  },
  {
    id: "sheen-beli-vinebinder",
    factionId: "sheen",
    name: "Beli Vinebinder",
    type: "unit",
    rarity: "uncommon",
    value: 5,
    text: "After your second block each turn, your next attack gets +1 value."
  },
  {
    id: "sheen-harmony-ward",
    factionId: "sheen",
    name: "Harmony Ward",
    type: "ward",
    rarity: "uncommon",
    value: 4,
    text: "When you block with two or more cards, one payment card may pay +1 value."
  },
  {
    id: "sheen-thornroot-counterstroke",
    factionId: "sheen",
    name: "Thornroot Counterstroke",
    type: "tactic",
    rarity: "uncommon",
    value: 6,
    text: "If you took no damage this turn, this gets +2 value while attacking."
  },
  {
    id: "sheen-beli-canopy-shield",
    factionId: "sheen",
    name: "Beli Canopy Shield",
    type: "relic",
    rarity: "uncommon",
    value: 6,
    text: "Once each turn, after you block, prevent 1 additional damage."
  },
  {
    id: "sheen-nus-verdant-edict",
    factionId: "sheen",
    name: "Nu's Verdant Edict",
    type: "tactic",
    rarity: "rare",
    value: 7,
    text: "Your third block this turn gets +3 value instead of +2."
  },
  {
    id: "sheen-roots-that-remember",
    factionId: "sheen",
    name: "Roots That Remember",
    type: "relic",
    rarity: "rare",
    value: 5,
    text: "Whenever you gain life from blocking, your next block this turn gets +1 value."
  },
  {
    id: "sheen-tangs-patient-hand",
    factionId: "sheen",
    name: "Tang's Patient Hand",
    type: "tactic",
    rarity: "rare",
    value: 6,
    text: "After your second block each turn, gain 2 life and draw a card at end of turn."
  },
  {
    id: "sheen-emperors-heartwood",
    factionId: "sheen",
    name: "Emperor's Heartwood",
    type: "relic",
    rarity: "mythic",
    value: 9,
    text: "Your blocking cards get +1 additional value. If it is your third or later block this turn, gain 1 life."
  },
  {
    id: "sheen-beli-awakened",
    factionId: "sheen",
    name: "Beli Awakened",
    type: "unit",
    rarity: "mythic",
    value: 10,
    text: "After you block without taking damage, this may attack with +3 value this turn."
  }
];

const FRUMO_COLLECTION_CARDS = [
  {
    id: "frumo-deckhand-diver",
    factionId: "frumo",
    name: "Deckhand Diver",
    type: "unit",
    rarity: "common",
    value: 3,
    text: "When this is placed into a lane, you may look at your top deck card."
  },
  {
    id: "frumo-tideglass-cutlass",
    factionId: "frumo",
    name: "Tideglass Cutlass",
    type: "weapon",
    rarity: "common",
    value: 4,
    text: "If this attacks from a lane, it gets +1 value when you have swapped a lane card this turn."
  },
  {
    id: "frumo-sunken-coin",
    factionId: "frumo",
    name: "Sunken Coin",
    type: "relic",
    rarity: "common",
    value: 2,
    text: "When paid for an attack, block, or ability, this pays +1 value if you control an empty lane."
  },
  {
    id: "frumo-coral-hull-guard",
    factionId: "frumo",
    name: "Coral-Hull Guard",
    type: "unit",
    rarity: "common",
    value: 5,
    text: "When this blocks from a lane, it gets +1 value and counts as a lane swap for your Frumo cards this turn."
  },
  {
    id: "frumo-riptide-smuggler",
    factionId: "frumo",
    name: "Riptide Smuggler",
    type: "unit",
    rarity: "uncommon",
    value: 5,
    text: "The first time you peek at a face-down card each turn, this gets +1 value this turn."
  },
  {
    id: "frumo-lafayettes-chart",
    factionId: "frumo",
    name: "Lafayette's Chart",
    type: "relic",
    rarity: "uncommon",
    value: 4,
    text: "After you swap a lane card with a hand card, your next payment card pays +1 value."
  },
  {
    id: "frumo-pressure-lock-pistol",
    factionId: "frumo",
    name: "Pressure-Lock Pistol",
    type: "weapon",
    rarity: "uncommon",
    value: 6,
    text: "When this attacks after a consecutive-value card was played, it gets +2 value."
  },
  {
    id: "frumo-ristus-blackwake",
    factionId: "frumo",
    name: "Ristus Blackwake",
    type: "tactic",
    rarity: "uncommon",
    value: 6,
    text: "When this attacks from a lane while you control an empty lane, it gets +1 value."
  },
  {
    id: "frumo-captains-bad-wager",
    factionId: "frumo",
    name: "Captain's Bad Wager",
    type: "tactic",
    rarity: "rare",
    value: 7,
    text: "When this attacks from a lane after you played an even-value card, it gets +3 value this turn."
  },
  {
    id: "frumo-poleas-sunken-order",
    factionId: "frumo",
    name: "Polea's Sunken Order",
    type: "tactic",
    rarity: "rare",
    value: 6,
    text: "Use one Polea mode an additional time this turn, but only on your own cards."
  },
  {
    id: "frumo-leviathan-salvage",
    factionId: "frumo",
    name: "Leviathan Salvage",
    type: "relic",
    rarity: "rare",
    value: 5,
    text: "Whenever your first card played each turn gets a consecutive-value bonus, gain 1 life."
  },
  {
    id: "frumo-the-last-gamble",
    factionId: "frumo",
    name: "The Last Gamble",
    type: "tactic",
    rarity: "mythic",
    value: 9,
    text: "Peek at a face-down card, then choose attack or block. Your next card of that kind gets +4 value."
  },
  {
    id: "frumo-ristus-rises",
    factionId: "frumo",
    name: "Ristus Rises",
    type: "unit",
    rarity: "mythic",
    value: 10,
    text: "When this enters a lane, it gets +1 value this turn and counts as a lane swap for your Frumo cards."
  }
];

const BIZI_COLLECTION_CARDS = [
  {
    id: "bizi-copperline-technician",
    factionId: "bizi",
    name: "Copperline Technician",
    type: "unit",
    rarity: "common",
    value: 3,
    text: "When you overpay for this by 2 or more, gain 1 acceleration counter."
  },
  {
    id: "bizi-voltage-ration",
    factionId: "bizi",
    name: "Voltage Ration",
    type: "tactic",
    rarity: "common",
    value: 2,
    text: "When paid for a Bizi card, this pays +1 additional value once each turn."
  },
  {
    id: "bizi-dune-circuit-runner",
    factionId: "bizi",
    name: "Dune Circuit Runner",
    type: "unit",
    rarity: "common",
    value: 4,
    text: "If your previous attack had a different suit, this attacks with +1 value."
  },
  {
    id: "bizi-gearplate-shield",
    factionId: "bizi",
    name: "Gearplate Shield",
    type: "relic",
    rarity: "common",
    value: 5,
    text: "When blocking, you may remove 1 acceleration counter to give this +2 value."
  },
  {
    id: "bizi-heras-calibration",
    factionId: "bizi",
    name: "Hera's Calibration",
    type: "tactic",
    rarity: "uncommon",
    value: 5,
    text: "When paid for a Bizi card, this pays +2 additional value."
  },
  {
    id: "bizi-solar-array-adept",
    factionId: "bizi",
    name: "Solar Array Adept",
    type: "unit",
    rarity: "uncommon",
    value: 5,
    text: "Whenever you gain an acceleration counter, this gets +1 value until end of turn."
  },
  {
    id: "bizi-constanti-conduit",
    factionId: "bizi",
    name: "Constanti Conduit",
    type: "relic",
    rarity: "uncommon",
    value: 6,
    text: "Your first two different-suit attacks after the first get an additional +1 value."
  },
  {
    id: "bizi-sandstorm-processor",
    factionId: "bizi",
    name: "Sandstorm Processor",
    type: "unit",
    rarity: "uncommon",
    value: 6,
    text: "If you have 2 or more acceleration counters, this may attack with +2 value."
  },
  {
    id: "bizi-focus-overclock",
    factionId: "bizi",
    name: "Focus Overclock",
    type: "tactic",
    rarity: "rare",
    value: 7,
    text: "Remove 1 acceleration counter: give target card +3 value this turn instead of +1."
  },
  {
    id: "bizi-regnum-voltage-bank",
    factionId: "bizi",
    name: "Regnum Voltage Bank",
    type: "relic",
    rarity: "rare",
    value: 6,
    text: "The first time each turn you overpay by 2 or more, gain 1 life and 1 acceleration counter."
  },
  {
    id: "bizi-desert-logic-engine",
    factionId: "bizi",
    name: "Desert Logic Engine",
    type: "relic",
    rarity: "rare",
    value: 5,
    text: "When you attack with a different suit from your previous attack, that attack gets +2 value."
  },
  {
    id: "bizi-focus-prime-signal",
    factionId: "bizi",
    name: "Focus Prime Signal",
    type: "tactic",
    rarity: "mythic",
    value: 9,
    text: "Gain 2 acceleration counters. Your next card this turn gets up to +4 value, one for each acceleration counter you have."
  },
  {
    id: "bizi-constanti-sunforge",
    factionId: "bizi",
    name: "Constanti Sunforge",
    type: "unit",
    rarity: "mythic",
    value: 10,
    text: "When this attacks, remove up to 3 acceleration counters. It gets +2 value for each counter removed."
  }
];

const COLLECTION_CARDS = [...RUMIN_COLLECTION_CARDS, ...SHEEN_COLLECTION_CARDS, ...FRUMO_COLLECTION_CARDS, ...BIZI_COLLECTION_CARDS];
const DRAFT_CARD_SUITS = ["spades", "hearts", "diamonds", "clubs"];

const BASE_PLAYING_DECK_SIZE = 52;
const PLAYING_DECK_VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const MAX_REPLACEMENTS_PER_VALUE = 4;
const MAX_CONSTRUCTED_DECK_SIZE = BASE_PLAYING_DECK_SIZE;
const MAX_CONSTRUCTED_REPLACEMENTS = BASE_PLAYING_DECK_SIZE;
const MAX_CONSTRUCTED_ADDITIONS = MAX_CONSTRUCTED_REPLACEMENTS;

// ============ FACTION DATA ============
const factionsData = {
  rumin: {
    id: "rumin",
    name: "Rumin",
    cardImage: "/assets/gauntlet/rumin-card.webp",
    commander: { name: "Kaiser, the Jewel", image: "/assets/gauntlet/kaiser-gauntlet.webp", text: "Your fourth attack each turn gets +3 value." },
    general: { name: "Meerus", image: "/assets/gauntlet/meerus-gauntlet-2.webp", text: "Whenever you play your second attack each turn, you may play your third attack with cost 3 or less without paying its cost." },
    city: { name: "Rumie, City of the Empire", image: "/assets/gauntlet/rumie.webp", text: "Each turn, the first two attacks you play after your first that share a suit with your previous attack get +1 value." }
  },
  sheen: {
    id: "sheen",
    name: "Sheen",
    cardImage: "/assets/gauntlet/sheen-card.webp",
    commander: { name: "Emperor Nu", image: "/assets/gauntlet/leafen-gao.png", text: "Your blocking cards get +1 value. If it's your third or later time blocking, they get +2 instead." },
    general: { name: "Tang", image: "/assets/gauntlet/tang.webp", text: "Each turn, when you block for the second time, gain 2 life." },
    city: { name: "Beli, Living City", image: "/assets/gauntlet/beli.webp", text: "After your second block each turn, your next attack with cost 10+ gains +2 value." }
  },
  frumo: {
    id: "frumo",
    name: "Frumo",
    cardImage: "/assets/gauntlet/frumo-card.webp",
    commander: { name: "Lord Commander Polea", image: "/assets/gauntlet/polea.webp", text: "Once per turn, choose 1: put a card from your hand into an empty lane you control; switch the lanes of up to 2 cards you control; look at 1 face-down card; or one card you control gets +1 value until end of turn." },
    general: { name: "Lafayette", image: "/assets/gauntlet/lafayette.webp", text: "Once per turn, you may swap a lane card with a card from your hand." },
    city: { name: "Ristus, Sunken City", image: "/assets/gauntlet/ristus.webp", text: "Your first card played each turn with a consecutive value of the last card played gets +2." }
  },
  bizi: {
    id: "bizi",
    name: "Bizi",
    cardImage: "/assets/gauntlet/bizi-card.webp",
    commander: { name: "Focus, Conductor of Progress", image: "/assets/gauntlet/focus.jpg", text: "Whenever you overpay for a card by 2 or more, put an acceleration counter on this. Once per turn, you may remove an acceleration counter: target card gets +1 value until end of turn." },
    general: { name: "Hera", image: "/assets/gauntlet/hera.webp", text: "Once per turn: If you've played a card of a suit this turn, you may use a card of the same suit to pay 2 more than its value." },
    city: { name: "Constanti, Technology Hub", image: "/assets/gauntlet/constanti.webp", text: "Each turn, your first two attacks after the first that have a different suit from your previous attack get +1 value." }
  }
};

function listFactions() {
  return Object.values(factionsData);
}

function getFactionById(id) {
  return factionsData[id] || null;
}

const campaignChapters = {
  rumin: [
    { id: "brothers-of-destiny", playableName: "Rolmus", opponentName: "Remex", title: "Brothers of Destiny", story: "Two brothers found Rumie together, then clash over whether trade or conquest will define the city.", dialogue: ["Rolmus: Trade builds empires.", "Remex: Trade only survives behind walls.", "Rolmus: Then today we decide what Rumie is."], dialogueAudio: ["/assets/gauntlet/voices/rolmus-brothers-2.mp3", "/assets/gauntlet/voices/remex-brothers-1.mp3", "/assets/gauntlet/voices/rolmus-brothers-1.mp3"] },
    { id: "the-republic", playableName: "The Senate Guard", opponentName: "Tribune Marcell", title: "The Republic", story: "Generations pass. Rumie grows wealthy, but corrupt senators, banks, runes, and legions begin shaping a fragile republic.", dialogue: ["Senator: The Republic endures because it is slow.", "Marcell: Slow things are easy to buy.", "Young Kaiser: Then someone must become too expensive to own."] },
    { id: "the-jewel", playableName: "Kaiser", opponentName: "Corrupt Governor Severan", title: "The Jewel", story: "Kaiser rises as a beloved officer who walks among workers, pays debts, and exposes a governor protected by the aristocracy.", dialogue: ["Severan: You mistake popularity for authority.", "Kaiser: No. I mistake theft for treason.", "Crowd: Kaiser! Kaiser! Kaiser!"] },
    { id: "gaulic-wars", playableName: "Kaiser", opponentName: "Gaulic Warchief Vercan", title: "The Gaulic Wars", story: "Northern tribes unite against Rumie. Kaiser turns frontier war into fame, wealth, and open trade routes.", dialogue: ["Vercan: Your roads end here, jewel prince.", "Kaiser: Roads do not end. They arrive.", "Vercan: Then arrive with steel."] },
    { id: "three-runes", playableName: "Kaiser", opponentName: "Ancient Rune Guardian", title: "The Three Runes", story: "Kaiser discovers vaults of Strength, Protection, and Experience, then begins binding sacred runes to the legions.", dialogue: ["Guardian: Strength without wisdom breaks itself.", "Kaiser: Then I will take wisdom too.", "Guardian: All conquerors say that before the vault closes."] },
    { id: "first-empire-bank", playableName: "Kaiser", opponentName: "Market Collapse", title: "The First Empire Bank", story: "Kaiser returns to build roads, grain systems, public works, and banking reforms while saboteurs try to break Rumie's markets.", dialogue: ["Merchant: The city eats because credit moves.", "Brutus: And if one man commands the credit?", "Kaiser: Then one man answers if the people starve."] },
    { id: "the-crossing", playableName: "Kaiser", opponentName: "Senate General Cassius", title: "The Crossing", story: "The Senate orders Kaiser to surrender command. Brutus pleads for restraint, but Kaiser marches and civil war begins.", dialogue: ["Brutus: Kaiser, do not do this.", "Kaiser: If I surrender, Rumie returns to corruption.", "Brutus: Then save the Republic.", "Kaiser: I intend to."] },
    { id: "last-republic", playableName: "Kaiser", opponentName: "Brutus", title: "The Last Republic", story: "Rumie burns as legions and senators collide. Kaiser wins the city, but Brutus survives the fall of the old order.", dialogue: ["Brutus: You have saved Rumie by conquering it.", "Kaiser: I have saved Rumie from men who sold it.", "Brutus: Then we are both traitors."] },
    { id: "emperor-of-gold", playableName: "Kaiser", opponentName: "Rebel Senate Coalition", title: "Emperor of Gold", story: "At Kaiser's peak, roads, banks, and legions flourish, but prisoners, taxes, and central rule make citizens question the jewel.", dialogue: ["Senator: Prosperity is not freedom.", "Kaiser: Freedom without bread is a slogan.", "Brutus: And bread without law is obedience."] },
    { id: "ides-of-rumie", playableName: "Kaiser", opponentName: "Brutus and the Conspirators", title: "The Ides of Rumie", story: "Kaiser stabilizes the empire, yet the conspiracy reaches the Senate floor. This chapter frames the tragedy more than the victory.", dialogue: ["Kaiser: You too, Brutus?", "Brutus: I do this for Rumie.", "Kaiser: No. You do it because Rumie no longer needs you."] },
    { id: "war-of-successors", playableName: "Bobei", opponentName: "Brutus", title: "War of the Successors", story: "After Kaiser dies, Bobei seeks vengeance while Brutus tries to restore the Republic from the ruins.", dialogue: ["Bobei: You killed a man and woke an empire.", "Brutus: I killed a tyrant.", "Bobei: Then why does Rumie weep?"] },
    { id: "first-emperor", playableName: "Augustus", opponentName: "Bobei the Great", title: "The First Emperor", story: "Augustus defeats Bobei, keeps the bank, legions, and rune program, restores Senate traditions, and leaves Rumie with an empire wearing republican robes.", dialogue: ["Bobei: I was Kaiser's sword.", "Augustus: And I will be his law.", "Old Senator: Perhaps the better question is whether Rumie could have survived without him."] }
  ],
  sheen: [
    { id: "iron-roots", playableName: "Leafen Gao", opponentName: "Emperor Blackthorn", title: "The Iron Roots", story: "The Obsidian Lords drain the forests through Iron Root outposts while Leafen Gao begins a rebellion among starving villages.", dialogue: ["Leafen Gao: A root that drinks everything is not a root. It is a chain.", "Blackthorn: Chains hold kingdoms together.", "Leafen Gao: Then the forest will break yours."] },
    { id: "verdant-uprising", playableName: "Leafen Gao and Hushan", opponentName: "The Thorn Guard Commanders", title: "The Verdant Uprising", story: "Hushan joins Leafen as the rebellion spreads against Ironbark, Thornclaw, and Rootlash.", dialogue: ["Hushan: They say this rebellion is doomed.", "Leafen Gao: Seeds are buried before they rise.", "Ironbark: Then we will salt the soil."] },
    { id: "obsidian-throne", playableName: "Leafen Gao, Hushan, and Leshan", opponentName: "Blackthorn, Lord of Iron", title: "Fall of the Obsidian Throne", story: "Leshan and Dowan collapse the Iron Roots themselves, forcing Blackthorn into one last monstrous stand.", dialogue: ["Leshan: Strike the root, not the branch.", "Blackthorn: I am the root.", "Leafen Gao: Then fall with it."] },
    { id: "beli-living-city", playableName: "Leafen Gao", opponentName: "The Great Blight", title: "Beli, Living City", story: "The Sheen rebuild, found Beli, and begin the Root Network while a natural blight threatens the new kingdom.", dialogue: ["Leafen Gao: We won a forest. Now we must make it a home.", "Reane: Homes are grown, not declared.", "The Great Blight: All growth returns to hunger."] },
    { id: "root-network", playableName: "Bark Xin and Dowan", opponentName: "The Ash Serpent", title: "The Root Network", story: "Dowan expands Sheen botanical science with barriers, shields, greenhouses, and trade routes, but the Ash Serpent burns the nodes.", dialogue: ["Dowan: The network must bend before it spreads.", "Bark Xin: And if fire follows the roots?", "Dowan: Then we teach roots to carry rain."] },
    { id: "blooming-age", playableName: "Reane and Hushan", opponentName: "The Drought King", title: "The Blooming Age", story: "The Sheen enter a golden age of shelters, retreats, springs, and living greenhouses as a desert warlord tests the border.", dialogue: ["Reane: Prosperity is not how much we store. It is how much survives winter.", "Drought King: I bring a longer winter.", "Hushan: Then we bring deeper roots."] },
    { id: "court-of-blossoms", playableName: "Den", opponentName: "Minister Hollowvine", title: "The Court of Blossoms", story: "Political factions emerge in Beli as Den tries to preserve stability while Aime and Tang rise through the court.", dialogue: ["Den: A court can rot while every garden blooms.", "Hollowvine: Rot feeds the next garden.", "Den: Not while I still prune."] },
    { id: "the-reformer", playableName: "Tang", opponentName: "Lord Goldroot", title: "The Reformer", story: "Tang sees inequality and stagnation, introduces reforms that truly help, and wins sympathy against corrupt nobles.", dialogue: ["Tang: Tradition has become a fence around empty soil.", "Goldroot: Empty soil is still mine.", "Tang: Not after the roots remember the poor."] },
    { id: "thorned-crown", playableName: "Tang", opponentName: "Ringan", title: "Thorned Crown", story: "Tang centralizes power and creates the Thornblades, while Ringan, a former ally, tries to stop his imbalance.", dialogue: ["Ringan: You wanted reform. This is control.", "Tang: Control is reform that cannot be bribed.", "Ringan: And cannot be questioned."] },
    { id: "war-of-roots", playableName: "Dowan, Hushan, and Ringan", opponentName: "The Thornblade Generals", title: "The War of Roots", story: "Civil war burns the forests as shelters are weaponized and the Root Network collapses under Ashroot, Briarfang, and Ironvine.", dialogue: ["Dowan: I built these roads to feed cities.", "Ashroot: Roads also carry armies.", "Hushan: Then we cut the roads and save the roots."] },
    { id: "fall-of-thorn-mang", playableName: "Dowan and Reane", opponentName: "Tang, Crown of Thorns", title: "Fall of Thorn Mang", story: "Tang realizes too late what his reforms became, then falls as healer, commander, and living thorn avatar.", dialogue: ["Tang: I only wanted the kingdom to live.", "Reane: Then why does it bleed when you speak?", "Tang: Because I mistook pain for pruning."] },
    { id: "green-era", playableName: "Dowan", opponentName: "The Great Renewal", title: "The Green Era", story: "Dowan restores the Root Network, shelters, healing, greenhouses, and balance after the civil war.", dialogue: ["Dowan: Growth without harmony becomes overgrowth.", "Reane: Tradition without growth becomes ash.", "Dowan: Then wisdom is knowing when to nurture and when to prune."] }
  ],
  frumo: [
    { id: "tax-of-tides", playableName: "Lafayette", opponentName: "Royal Tax Collector", title: "The Tax of the Tides", story: "King Ludvik's tribute fleets bleed Ristus while royal collectors seize treasure from every captain and family.", dialogue: ["Lafayette: The sea gives enough for all Frumo.", "Tax Collector: Then all Frumo can pay the king.", "Lafayette: The tide is turning against your vaults."] },
    { id: "voices-of-revolution", playableName: "Privateer Mirabeau", opponentName: "Royal Governor of Coral Bay", title: "Voices of Revolution", story: "Hidden taverns and pirate dens fill with reformers as Mirabeau, Danton, Marat, Robespier, and Lafayette demand a freer kingdom.", dialogue: ["Mirabeau: A king who ignores his people will hear their cannons.", "Governor: Coral Bay answers only to Ludvik.", "Danton: Then Coral Bay will learn a new language."] },
    { id: "fall-of-silver-shoals", playableName: "Corsair Danton", opponentName: "General Carnot", title: "The Fall of Silver Shoals", story: "Revolutionary captains storm Ludvik's treasure fortress, proving common pirates can defeat royal formations.", dialogue: ["Danton: Silver Shoals was built to scare us.", "Carnot: It was built to contain you.", "Danton: Then watch what escapes."] },
    { id: "sunken-fortress", playableName: "Lafayette", opponentName: "King Ludvik", title: "The Sunken Fortress", story: "The capital floods with revolution as Ludvik discovers his treasure can buy armies, but not loyalty.", dialogue: ["Ludvik: You call it greed. I call it responsibility.", "Lafayette: Responsibility does not wear a jewel-covered crown.", "Ludvik: Do you know how difficult it is being king?"] },
    { id: "trial-of-king", playableName: "Robespier", opponentName: "Royal Loyalists", title: "The Trial of the King", story: "The monarchy falls, but Frumo divides over whether Ludvik should be imprisoned, spared, or executed.", dialogue: ["Robespier: No kingdom can be free while the crown still lives.", "Lafayette: Justice is not hunger with a blade.", "Robespier: Mercy is how tyrants learn to swim back."] },
    { id: "reign-of-revolution", playableName: "Marat", opponentName: "Robespier the Red Tide", title: "The Reign of the Revolution", story: "Victory curdles into suspicion as Robespier hunts enemies of freedom until the revolution itself becomes dangerous.", dialogue: ["Robespier: The enemies of freedom wear many faces.", "Marat: Then you will soon accuse the mirror.", "Robespier: Mercy is the weapon of tyrants."] },
    { id: "hero-of-republic", playableName: "Polea", opponentName: "Admiral of the Northern Coalition", title: "The Hero of the Republic", story: "As chaos spreads, Polea wins impossible naval battles, defeats Frumo-world invaders, and gives the republic hope.", dialogue: ["Polea: I did not come to rule the republic.", "Admiral: No. You came to make it need you.", "Polea: Today it needs victory."] },
    { id: "lord-commander", playableName: "Polea", opponentName: "Council Rivals", title: "Lord Commander", story: "Polea saves the republic, then takes control of it as the Council of Captains yields more power each year.", dialogue: ["Councilor: You were given command for one crisis.", "Polea: The crisis learned to change names.", "Councilor: So did ambition."] },
    { id: "frumo-empire", playableName: "Polea", opponentName: "Polea's Shadow", title: "The Frumo Empire", story: "Polea crowns himself Lord Commander of All Frumo: no king, no council, no election, only command.", dialogue: ["Polea: I freed the Frumo from kings.", "Shadow: And gave them a commander instead.", "Polea: Better one helm than a thousand drowning hands."] },
    { id: "hundred-fleets", playableName: "Polea", opponentName: "The Coral Crown, Kelpbound Princes, and Brasswater League", title: "The Hundred Fleets", story: "Polea's armadas dominate Reath's oceans as rival Frumo sea powers unite against his endless victories.", dialogue: ["Coral Envoy: The seas do not belong to one captain.", "Polea: Then why do they answer mine?", "Brasswater Admiral: Because fear sounds like obedience."] },
    { id: "frozen-sea", playableName: "Polea", opponentName: "The Ice Leviathan", title: "The Frozen Sea", story: "Polea attempts to conquer the northern oceans, but storms, ice, hunger, and a leviathan shatter the once-invincible navy.", dialogue: ["Polea: No tide has ever refused me.", "Ice Leviathan: This is not tide. This is silence.", "Polea: Then I will break silence too."] },
    { id: "last-tide", playableName: "The Restored Council", opponentName: "Lord Commander Polea", title: "The Last Tide", story: "Former allies and rival fleets face Polea one final time, then restore the Council with the uneasy knowledge that freedom can decay again.", dialogue: ["Polea: I freed the Frumo. I united them. I made them strong.", "Lafayette: And then you made them yours.", "Polea: If that makes me a tyrant, history may judge me."] }
  ],
  bizi: [
    { id: "kharons-vision", playableName: "Kharon", opponentName: "Maxor the Usurper", title: "Kharon's Vision", story: "A young inventor receives visions from Titan Machina, defeats Maxor at Iron River, and founds Constanti.", dialogue: ["Kharon: The future shall not belong to kings.", "Maxor: Then it will belong to tyrants with better machines.", "Kharon: No. It shall belong to builders."] },
    { id: "first-titan", playableName: "Kharon", opponentName: "The Assembly of Doubt", title: "The First Titan", story: "Machina sleeps beneath Constanti, dividing Bizi thinkers over whether the Titan created them or merely guides them.", dialogue: ["Assembly: You ask us to kneel before a machine.", "Kharon: I ask you to listen before you fear.", "Assembly: Faith is poor engineering."] },
    { id: "golden-empire", playableName: "Justine, Theo, and Beli", opponentName: "The Vandal Engine", title: "The Golden Empire", story: "Centuries later, Justine, Theo, and Beli attempt to restore the old Bizi world at the empire's dazzling peak.", dialogue: ["Theo: An empire cannot survive on steel alone.", "Justine: Then give it purpose.", "Beli: And give me the armies to defend it."] },
    { id: "riot-of-sparks", playableName: "Theo and Beli", opponentName: "The Riot Leader", title: "The Riot of Sparks", story: "Constanti burns in rebellion, Justine nearly flees, and Theo forces him to choose rule over escape.", dialogue: ["Justine: The factories are ash. The city hates me.", "Theo: Do you wish to be remembered as a ruler or a fugitive?", "Beli: Open the gates. I will restore order."] },
    { id: "last-victories", playableName: "Beli", opponentName: "The Desert Coalition, Iron Tribes, and Sea Raiders", title: "The Last Victories", story: "Beli wins impossible campaigns and reclaims ancient territories, but each victory stretches the empire thinner.", dialogue: ["Beli: We have won another province.", "Theo: And inherited another wound.", "Beli: Then the empire is made of wounds that refused to close."] },
    { id: "age-of-focus", playableName: "Focus", opponentName: "Emperor Maurice", title: "The Age of Focus", story: "After decline and exhaustion, Focus seizes power and promises order through absolute efficiency.", dialogue: ["Maurice: You call murder progress?", "Focus: Compassion is inefficient. Progress is not.", "Maurice: Then your empire will run perfectly without a soul."] },
    { id: "great-invasion", playableName: "Focus", opponentName: "Khosar the Conqueror", title: "The Great Invasion", story: "The eastern empire collapses, factories fall, shrines are destroyed, and the Bizi face extinction.", dialogue: ["Khosar: Your gears stop where my banners begin.", "Focus: Systems fail. Systems restart.", "Khosar: Not after I melt them."] },
    { id: "heras-counterattack", playableName: "Hera", opponentName: "Khosar", title: "Hera's Counterattack", story: "Hera rises when victory seems impossible, marches into enemy territory, and turns one victory into ten.", dialogue: ["Hera: Machines break. Empires fall.", "Khosar: Then kneel before the empire that remains.", "Hera: Determination endures."] },
    { id: "three-titans", playableName: "Iro, Leon, and Nike", opponentName: "Machina, Melech, and Meca Cult Leaders", title: "The Three Titans", story: "Followers of Machina, Melech, and Meca fight over creation, guidance, and control until faith becomes civil danger.", dialogue: ["Iro: A Titan should guide, not divide.", "Cult Leader: Division proves truth has enemies.", "Leon: Or that certainty has teeth."] },
    { id: "the-schism", playableName: "Theo's Disciples", opponentName: "Archon Severus", title: "The Schism", story: "The Titan faith fractures permanently as old allies become enemies and the empire weakens from certainty within.", dialogue: ["Severus: Unity built on compromise is rust.", "Disciple: The greatest enemy of an empire is certainty.", "Severus: Then certainty will rule what doubt could not hold."] },
    { id: "the-restoration", playableName: "Xios", opponentName: "Corrupt Governors and Invaders", title: "The Restoration", story: "The empire nearly collapses until Xios reforms the economy, repairs the military, and revives Bizi industry.", dialogue: ["Xios: The machine is damaged.", "Governor: Damaged things are replaced.", "Xios: Not destroyed. Repaired. Remember that."] },
    { id: "last-gear", playableName: "The Defenders of Constanti", opponentName: "The Iron Sultan", title: "The Last Gear", story: "Constanti falls under siege. Machina's engines fail, the Titans fall silent, and divided Bizi fight side by side so their knowledge survives.", dialogue: ["Defender: The Titans are silent.", "Iron Sultan: Then your city has no gods left.", "Kharon's Recording: Steel rusts. Cities fall. But ideas are eternal."] }
  ]
};

const CAMPAIGN_NARRATION = {
  "brothers-of-destiny": {
    beforeBattle: "Rumie begins as a fragile dream between two brothers: Rolmus, who sees trade as the road to greatness, and Remex, who believes only conquest can keep the city alive. Their argument will decide the soul of the empire before it is even born.",
    afterBattle: "Rolmus wins the first argument, but not the last. Rumie is founded on trade, ambition, and the unresolved truth that wealth will always need soldiers to guard it."
  },
  "the-republic": {
    beforeBattle: "Generations later, Rumie is rich, proud, and rotten beneath its marble. Senators speak of tradition while banks, legions, and private debts quietly decide the fate of citizens.",
    afterBattle: "The Republic survives, but its weakness has been exposed. Rumie's laws still stand, yet more people now wonder whether law without justice is only another kind of market."
  },
  "the-jewel": {
    beforeBattle: "Kaiser rises from officer to public champion, paying debts and walking among workers while the aristocracy protects its own. Governor Severan believes popularity cannot defeat power.",
    afterBattle: "Severan falls, and Kaiser becomes more than a soldier. To the people, he is the Jewel of Rumie; to the Senate, he is a warning."
  },
  "gaulic-wars": {
    beforeBattle: "Northern tribes unite against Rumie's frontier, threatening roads, trade, and imperial pride. Kaiser marches north, knowing victory will make him beloved and feared in equal measure.",
    afterBattle: "The frontier opens. Kaiser returns with wealth, veterans, and a legend too large for the Senate to comfortably contain."
  },
  "three-runes": {
    beforeBattle: "Beneath conquered lands, Kaiser finds ancient vaults of Strength, Protection, and Experience. The runes promise power, but every sacred weapon demands a price from the hand that holds it.",
    afterBattle: "The legions are changed forever. Rumie now commands not only soldiers and gold, but myth itself."
  },
  "first-empire-bank": {
    beforeBattle: "Kaiser turns from conquest to reform, building roads, grain systems, and public credit. His enemies strike at the markets, hoping the people will blame him when Rumie hungers.",
    afterBattle: "The markets hold. Kaiser proves that money can be a weapon of stability, and the people begin trusting him more than the institutions meant to govern him."
  },
  "the-crossing": {
    beforeBattle: "The Senate orders Kaiser to surrender command. Brutus begs him to preserve the Republic, but Kaiser believes the Republic has already been sold by the men claiming to save it.",
    afterBattle: "The line is crossed. Civil war begins, and Rumie must now choose between a corrupt freedom and an honest empire."
  },
  "last-republic": {
    beforeBattle: "Legions and senators collide while Brutus fights for a dying order. Kaiser fights for the city itself, even if saving Rumie means conquering it.",
    afterBattle: "Kaiser wins the city. The Republic still has voices, but no longer has control."
  },
  "emperor-of-gold": {
    beforeBattle: "Roads flourish, banks expand, and the legions obey one hand. Yet prosperity casts a long shadow: taxes, prisoners, and obedience gather beneath the gold.",
    afterBattle: "Kaiser reaches the height of power. Rumie is safer and richer than ever, but citizens begin asking whether rescue has become rule."
  },
  "ides-of-rumie": {
    beforeBattle: "The conspiracy reaches the Senate floor. Kaiser enters believing his work has saved Rumie; Brutus waits believing only betrayal can save what remains.",
    afterBattle: "Kaiser falls, but the empire does not. The assassins kill the man and accidentally preserve his myth."
  },
  "war-of-successors": {
    beforeBattle: "Bobei takes up vengeance while Brutus tries to restore the Republic from blood and ashes. Both claim Kaiser's death proves their cause.",
    afterBattle: "Brutus loses the future. The Republic he tried to save becomes a memory carried by the empire that replaces it."
  },
  "first-emperor": {
    beforeBattle: "Augustus and Bobei clash over Kaiser's legacy: sword or law, vengeance or settlement. Rumie waits to see what shape empire will finally take.",
    afterBattle: "Augustus wins. The Senate returns in ceremony, the empire remains in fact, and Rumie learns to call obedience tradition."
  },
  "iron-roots": {
    beforeBattle: "The Obsidian Lords drain the forest through Iron Root outposts, turning living land into tribute. Leafen Gao's rebellion begins among starving villages with little more than anger and patience.",
    afterBattle: "The first chains break. The Sheen learn that roots can strangle as well as nourish."
  },
  "verdant-uprising": {
    beforeBattle: "Hushan joins Leafen as the rebellion spreads through villages, groves, and hidden paths. The Thorn Guard believes a scattered forest cannot become an army.",
    afterBattle: "The rebellion becomes a people. What began as hunger has grown into a shared memory of injustice."
  },
  "obsidian-throne": {
    beforeBattle: "Leshan and Dowan strike at the Iron Roots themselves, forcing Blackthorn into a final stand. If the root survives, the forest will never be free.",
    afterBattle: "Blackthorn falls. The Sheen win their forest, but victory leaves them with the harder task of building a kingdom that does not become another chain."
  },
  "beli-living-city": {
    beforeBattle: "The Sheen found Beli and begin the Root Network, but nature itself tests the newborn kingdom through blight and scarcity. Rebellion must become stewardship.",
    afterBattle: "Beli survives. The Sheen discover that a city can grow like a forest if its people accept patience as power."
  },
  "root-network": {
    beforeBattle: "Dowan expands botanical science into roads, shields, greenhouses, and trade routes. The Ash Serpent burns the nodes, proving that connection also creates vulnerability.",
    afterBattle: "The network bends instead of breaking. The Sheen learn that defense is not a wall, but a living system."
  },
  "blooming-age": {
    beforeBattle: "Shelters, retreats, springs, and greenhouses bring abundance, but prosperity attracts enemies from dry borders. The Drought King comes to prove growth can be starved.",
    afterBattle: "The Blooming Age endures. The Sheen understand prosperity as preparation, not comfort."
  },
  "court-of-blossoms": {
    beforeBattle: "As Beli blooms, politics rot quietly inside the court. Den watches nobles and ministers turn harmony into influence.",
    afterBattle: "Den preserves stability for now. But the court has revealed a dangerous truth: a peaceful kingdom can still decay."
  },
  "the-reformer": {
    beforeBattle: "Tang rises against inequality and noble stagnation, promising reforms that return life to the poor. His cause is just, but justice can grow thorns.",
    afterBattle: "Tang wins the people's faith. Reform becomes power, and power begins asking for obedience."
  },
  "thorned-crown": {
    beforeBattle: "Tang creates the Thornblades and centralizes authority to protect reform from corruption. Ringan sees the danger: a cure becoming a crown.",
    afterBattle: "Tang defeats his critics, but the kingdom is no longer merely healing. It is being commanded."
  },
  "war-of-roots": {
    beforeBattle: "Civil war spreads through the forest. Shelters become forts, roads carry armies, and the Root Network becomes a battlefield.",
    afterBattle: "The old harmony burns. The Sheen learn that even living systems can be weaponized when fear takes root."
  },
  "fall-of-thorn-mang": {
    beforeBattle: "Tang stands as healer, reformer, ruler, and living thorn avatar. He finally sees the pain caused in the name of survival, but too late to step aside peacefully.",
    afterBattle: "Tang falls. The Sheen mourn both the tyrant he became and the reformer he once was."
  },
  "green-era": {
    beforeBattle: "Dowan inherits a wounded kingdom. The Root Network must be restored, not as a tool of control, but as a promise of balance.",
    afterBattle: "The Green Era begins. The Sheen choose renewal over revenge, and remember that growth without harmony becomes overgrowth."
  },
  "tax-of-tides": {
    beforeBattle: "King Ludvik's tribute fleets bleed Ristus dry while royal collectors seize treasure from captains and families. Lafayette sees a kingdom drowning in its own greed.",
    afterBattle: "The tax fleet is broken. The Frumo learn that the sea does not belong only to crowns."
  },
  "voices-of-revolution": {
    beforeBattle: "Taverns, pirate dens, and hidden harbors fill with reformers. Mirabeau, Danton, Marat, Robespier, and Lafayette speak different visions of freedom.",
    afterBattle: "The voices become a movement. The monarchy still stands, but the Frumo have learned to imagine life without it."
  },
  "fall-of-silver-shoals": {
    beforeBattle: "Silver Shoals guards Ludvik's treasure and the myth of royal invincibility. Danton leads common captains against trained formations and fortress guns.",
    afterBattle: "Silver Shoals falls. The revolution proves that courage, tide, and timing can defeat inherited power."
  },
  "sunken-fortress": {
    beforeBattle: "The capital floods with unrest. Ludvik believes treasure can buy loyalty, but Lafayette knows fear and gold cannot hold a kingdom forever.",
    afterBattle: "The monarchy breaks. Ludvik discovers too late that a crown is heavy only while people agree to carry it."
  },
  "trial-of-king": {
    beforeBattle: "The Frumo must decide whether Ludvik should be spared, imprisoned, or executed. Justice and vengeance begin wearing the same face.",
    afterBattle: "The king's fate divides the revolution. Freedom has won its first victory and immediately faces its first moral wound."
  },
  "reign-of-revolution": {
    beforeBattle: "Robespier hunts enemies of freedom until suspicion becomes government. Marat sees the revolution turning its blade inward.",
    afterBattle: "The terror consumes itself. The Frumo learn that a revolution can drown in the name of purity."
  },
  "hero-of-republic": {
    beforeBattle: "Coalition fleets gather while the republic trembles. Polea wins impossible battles and gives the Frumo a hero when they most need one.",
    afterBattle: "Polea saves the republic. In doing so, he becomes the one person the republic fears it cannot survive without."
  },
  "lord-commander": {
    beforeBattle: "The Council grants Polea more command with every crisis. Each emergency passes, but his authority remains.",
    afterBattle: "The Council yields piece by piece. Polea has not seized the republic all at once; he has taught it to depend on him."
  },
  "frumo-empire": {
    beforeBattle: "Polea crowns himself Lord Commander of All Frumo. He claims unity, order, and survival; his shadow whispers another word: ambition.",
    afterBattle: "The republic becomes an empire. The Frumo are strong, victorious, and no longer free in the way they once demanded."
  },
  "hundred-fleets": {
    beforeBattle: "Rival sea powers unite against Polea's endless victories. The oceans themselves seem to ask whether one commander can own every tide.",
    afterBattle: "Polea dominates the seas. But each victory makes his empire wider, colder, and harder to hold."
  },
  "frozen-sea": {
    beforeBattle: "Polea sails north to conquer what no fleet has held. Ice, hunger, storms, and silence await the navy that believed itself invincible.",
    afterBattle: "The fleet shatters. Polea survives, but his myth is cracked by a sea that refuses command."
  },
  "last-tide": {
    beforeBattle: "Former allies and rival fleets gather for one final reckoning. Polea insists history will understand him; Lafayette insists the living cannot wait for history.",
    afterBattle: "Polea falls. The Council is restored, but the Frumo remember how easily freedom can become command when fear asks for a hero."
  },
  "kharons-vision": {
    beforeBattle: "Kharon receives visions from Titan Machina and dreams of a city built by invention rather than kings. Maxor stands in the way with older claims to power.",
    afterBattle: "Maxor falls at Iron River. Constanti is founded, and the Bizi begin believing the future can be engineered."
  },
  "first-titan": {
    beforeBattle: "Machina sleeps beneath Constanti, dividing thinkers over whether the Titan is creator, guide, or dangerous machine. Faith and reason meet over the same engine.",
    afterBattle: "The debate does not end. Instead, it becomes the foundation of Bizi identity: progress powered by doubt."
  },
  "golden-empire": {
    beforeBattle: "Centuries later, Justine, Theo, and Beli try to restore the old empire at its dazzling height. The Vandal Engine threatens to prove that splendor cannot stop collapse.",
    afterBattle: "The empire shines again. Yet beneath the gold, every repair reveals how much machinery is already wearing thin."
  },
  "riot-of-sparks": {
    beforeBattle: "Constanti burns in rebellion, and Justine nearly flees from the city he was meant to rule. Theo forces him to choose between command and disappearance.",
    afterBattle: "Order returns, but trust does not. The Bizi learn that machines can restart faster than societies can forgive."
  },
  "last-victories": {
    beforeBattle: "Beli reclaims territory from desert coalitions, iron tribes, and sea raiders. Each triumph looks impossible, and each one stretches the empire thinner.",
    afterBattle: "Beli wins again, but victory becomes exhaustion. The empire is not dying from defeat, but from the cost of refusing to shrink."
  },
  "age-of-focus": {
    beforeBattle: "After decline and paralysis, Focus seizes power with a promise of absolute efficiency. Compassion is treated as waste; progress becomes command.",
    afterBattle: "Focus takes control. The empire runs cleaner, faster, and colder, proving that efficiency without mercy can become its own kind of ruin."
  },
  "great-invasion": {
    beforeBattle: "Khosar the Conqueror breaks the eastern empire, destroying factories, shrines, and old defenses. The Bizi face extinction as systems fail one after another.",
    afterBattle: "The Bizi survive the first collapse. Not because their machines never fail, but because they know how to restart."
  },
  "heras-counterattack": {
    beforeBattle: "Hera rises when defeat seems certain, marching into enemy territory with determination stronger than the machines around her. One victory must become many.",
    afterBattle: "Hera turns the war. The Bizi remember that progress is not only invention; sometimes it is refusal."
  },
  "three-titans": {
    beforeBattle: "Followers of Machina, Melech, and Meca argue over creation, guidance, and control. Faith becomes circuitry for civil danger.",
    afterBattle: "The Titan faith fractures. The Bizi gain a deeper mythology, but lose the unity that once made it powerful."
  },
  "the-schism": {
    beforeBattle: "The empire weakens as certainty hardens into doctrine. Old allies become enemies, each claiming the true meaning of the Titans.",
    afterBattle: "The schism becomes permanent. The Bizi discover that ideas can preserve an empire or split it from the inside."
  },
  "the-restoration": {
    beforeBattle: "Xios inherits a damaged machine of state: corrupt governors, broken armies, failing industry, and borders under pressure. Repair must become revolution.",
    afterBattle: "Xios restores the empire's engine. The Bizi prove that decline is not destiny while knowledge, discipline, and courage remain."
  },
  "last-gear": {
    beforeBattle: "Constanti stands under final siege. The Titans are silent, engines fail, and divided Bizi fight together so their knowledge will outlive the city.",
    afterBattle: "Constanti falls, but the Bizi do not vanish. Their final victory is not survival of stone, but survival of memory, design, and idea."
  }
};

const CAMPAIGN_METADATA = {
  rumin: { commanderName: "The Jewel of Rumie", pitch: "Follow Rumie from founding myth to republic, Kaiser, civil war, assassination, and imperial legacy." },
  sheen: { commanderName: "The Rise and Trials of the Sheen", pitch: "Guide the Sheen from rebellion and living-city prosperity through reform, civil war, and renewal." },
  frumo: { commanderName: "The Last Tide", pitch: "Fight through taxation, revolution, terror, Polea's rise, empire, disaster, and the uneasy restoration of the Council." },
  bizi: { commanderName: "The Gears of Eternity", pitch: "Endure impossible odds through invention, faith, schism, restoration, and the final defense of Constanti." }
};

const DECK_RULES = {
  basePlayingDeckSize: BASE_PLAYING_DECK_SIZE,
  playingDeckValues: PLAYING_DECK_VALUES,
  replacementSuits: DRAFT_CARD_SUITS,
  maxReplacementsPerValue: MAX_REPLACEMENTS_PER_VALUE,
  maxConstructedDeckSize: MAX_CONSTRUCTED_DECK_SIZE,
  maxConstructedReplacements: MAX_CONSTRUCTED_REPLACEMENTS
};

function requireText(value, pathName) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid game content: ${pathName} must be text.`);
}

function validateGameContent() {
  requireText(RULES_VERSION, "rulesVersion");
  requireText(CONTENT_VERSION, "contentVersion");
  const factionIds = Object.keys(factionsData);
  if (factionIds.length !== 4) throw new Error("Invalid game content: expected four factions.");
  for (const factionId of factionIds) {
    const faction = factionsData[factionId];
    if (faction.id !== factionId) throw new Error(`Invalid game content: faction key ${factionId} does not match its ID.`);
    requireText(faction.name, `factions.${factionId}.name`);
    for (const role of ["commander", "general", "city"]) {
      requireText(faction[role]?.name, `factions.${factionId}.${role}.name`);
      requireText(faction[role]?.text, `factions.${factionId}.${role}.text`);
    }
    if (!Array.isArray(campaignChapters[factionId]) || campaignChapters[factionId].length !== 12) {
      throw new Error(`Invalid game content: faction ${factionId} must have 12 campaign chapters.`);
    }
  }

  const chapterIds = new Set();
  for (const [factionId, chapters] of Object.entries(campaignChapters)) {
    if (!factionsData[factionId]) throw new Error(`Invalid game content: unknown campaign faction ${factionId}.`);
    for (const chapter of chapters) {
      requireText(chapter.id, `campaigns.${factionId}.id`);
      requireText(chapter.title, `campaigns.${factionId}.${chapter.id}.title`);
      requireText(chapter.story, `campaigns.${factionId}.${chapter.id}.story`);
      if (chapterIds.has(chapter.id)) throw new Error(`Invalid game content: duplicate chapter ID ${chapter.id}.`);
      chapterIds.add(chapter.id);
      requireText(CAMPAIGN_NARRATION[chapter.id]?.beforeBattle, `narration.${chapter.id}.beforeBattle`);
      requireText(CAMPAIGN_NARRATION[chapter.id]?.afterBattle, `narration.${chapter.id}.afterBattle`);
    }
  }

  const cardIds = new Set();
  const rarities = new Set(["common", "uncommon", "rare", "mythic"]);
  for (const card of COLLECTION_CARDS) {
    requireText(card.id, "cards.id");
    requireText(card.name, `cards.${card.id}.name`);
    requireText(card.type, `cards.${card.id}.type`);
    requireText(card.text, `cards.${card.id}.text`);
    if (cardIds.has(card.id)) throw new Error(`Invalid game content: duplicate card ID ${card.id}.`);
    if (!factionsData[card.factionId]) throw new Error(`Invalid game content: card ${card.id} has an unknown faction.`);
    if (!rarities.has(card.rarity)) throw new Error(`Invalid game content: card ${card.id} has an invalid rarity.`);
    if (!PLAYING_DECK_VALUES.includes(card.value)) throw new Error(`Invalid game content: card ${card.id} has an invalid value.`);
    cardIds.add(card.id);
  }

  if (BASE_PLAYING_DECK_SIZE !== DRAFT_CARD_SUITS.length * PLAYING_DECK_VALUES.length) {
    throw new Error("Invalid game content: deck size does not match suit and value slots.");
  }
  if (MAX_REPLACEMENTS_PER_VALUE !== DRAFT_CARD_SUITS.length) {
    throw new Error("Invalid game content: replacement limit must match the number of suits.");
  }
  return true;
}

function getPublicGameContent() {
  const campaigns = Object.fromEntries(Object.entries(campaignChapters).map(([factionId, chapters]) => [
    factionId,
    {
      factionName: factionsData[factionId].name,
      commanderName: CAMPAIGN_METADATA[factionId].commanderName,
      pitch: CAMPAIGN_METADATA[factionId].pitch,
      chapters: chapters.map((chapter) => ({ ...chapter, ...(CAMPAIGN_NARRATION[chapter.id] || {}) }))
    }
  ]));
  return {
    schemaVersion: 1,
    rulesVersion: RULES_VERSION,
    contentVersion: CONTENT_VERSION,
    factions: listFactions(),
    campaigns,
    cards: COLLECTION_CARDS,
    deckRules: DECK_RULES
  };
}

validateGameContent();

module.exports = {
  BASE_PLAYING_DECK_SIZE,
  BIZI_COLLECTION_CARDS,
  CAMPAIGN_NARRATION,
  COLLECTION_CARDS,
  CONTENT_VERSION,
  DECK_RULES,
  DRAFT_CARD_SUITS,
  FRUMO_COLLECTION_CARDS,
  MAX_CONSTRUCTED_ADDITIONS,
  MAX_CONSTRUCTED_DECK_SIZE,
  MAX_CONSTRUCTED_REPLACEMENTS,
  MAX_REPLACEMENTS_PER_VALUE,
  PLAYING_DECK_VALUES,
  RUMIN_COLLECTION_CARDS,
  RULES_VERSION,
  SHEEN_COLLECTION_CARDS,
  campaignChapters,
  factionsData,
  getFactionById,
  getPublicGameContent,
  listFactions,
  validateGameContent
};
