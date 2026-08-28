"use strict";

const RULES_VERSION = "gauntlet-rules-v1";
const CONTENT_VERSION = "gauntlet-content-v1";
const FREE_GAMEPLAY_ACQUISITION = "earned-gameplay-pack";
const PAID_COLLECTOR_ACQUISITION = "paid-collector-pack";
const COLLECTOR_VARIANT_SCHEMA_VERSION = 1;

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
    id: "rumin-tax-road-scout",
    factionId: "rumin",
    name: "Tax-Road Scout",
    type: "unit",
    rarity: "common",
    value: 2,
    text: "If this is your first attack this turn, it costs 1 less to play."
  },
  {
    id: "rumin-marble-phalanx",
    factionId: "rumin",
    name: "Marble Phalanx",
    type: "unit",
    rarity: "common",
    value: 5,
    text: "When blocking after you have already attacked this turn, this gets +1 value."
  },
  {
    id: "rumin-counting-house-aegis",
    factionId: "rumin",
    name: "Counting-House Aegis",
    type: "relic",
    rarity: "uncommon",
    value: 7,
    text: "The first time each turn you overpay for a Rumin card by 2 or more, gain 1 life."
  },
  {
    id: "rumin-triumphal-ram",
    factionId: "rumin",
    name: "Triumphal Ram",
    type: "weapon",
    rarity: "uncommon",
    value: 8,
    text: "Arm from lane: attach to a hand attacker. It gets +4 value, or +5 if the attacker has value 8 or more."
  },
  {
    id: "rumin-edict-of-the-vault",
    factionId: "rumin",
    name: "Edict of the Vault",
    type: "tactic",
    rarity: "rare",
    value: 8,
    text: "When paid for your fourth attack this turn, this pays +3 additional value."
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
    id: "sheen-seedwall-acolyte",
    factionId: "sheen",
    name: "Seedwall Acolyte",
    type: "unit",
    rarity: "common",
    value: 2,
    text: "When this blocks the first incoming attack each turn, it gets +1 value."
  },
  {
    id: "sheen-raincall-mender",
    factionId: "sheen",
    name: "Raincall Mender",
    type: "unit",
    rarity: "common",
    value: 4,
    text: "After this blocks, gain 1 life if you took no damage from that attack."
  },
  {
    id: "sheen-ringroot-bastion",
    factionId: "sheen",
    name: "Ringroot Bastion",
    type: "unit",
    rarity: "uncommon",
    value: 7,
    text: "When this blocks from a lane, it gets +2 value."
  },
  {
    id: "sheen-sapling-chorus",
    factionId: "sheen",
    name: "Sapling Chorus",
    type: "relic",
    rarity: "uncommon",
    value: 3,
    text: "When you block with two or more cards, your first blocker gets +1 value."
  },
  {
    id: "sheen-nus-calm-command",
    factionId: "sheen",
    name: "Nu's Calm Command",
    type: "tactic",
    rarity: "rare",
    value: 8,
    text: "If you have blocked three or more times this turn, this attacks with +3 value."
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
    id: "frumo-kelpcloak-trickster",
    factionId: "frumo",
    name: "Kelpcloak Trickster",
    type: "unit",
    rarity: "common",
    value: 2,
    text: "When this enters a lane, it counts as a lane swap for your Frumo cards this turn."
  },
  {
    id: "frumo-ballast-hook",
    factionId: "frumo",
    name: "Ballast Hook",
    type: "weapon",
    rarity: "common",
    value: 5,
    text: "When this attacks from a lane while you control an empty lane, it gets +1 value."
  },
  {
    id: "frumo-tide-debt-ledger",
    factionId: "frumo",
    name: "Tide-Debt Ledger",
    type: "relic",
    rarity: "uncommon",
    value: 4,
    text: "After you swap a lane card this turn, your next payment card pays +1 value."
  },
  {
    id: "frumo-abyssal-switchboard",
    factionId: "frumo",
    name: "Abyssal Switchboard",
    type: "relic",
    rarity: "uncommon",
    value: 7,
    text: "After this enters a lane, your next attack or block gets +1 value."
  },
  {
    id: "frumo-poleas-moonlit-map",
    factionId: "frumo",
    name: "Polea's Moonlit Map",
    type: "tactic",
    rarity: "rare",
    value: 8,
    text: "If this receives the Ristus consecutive-value bonus, it gets +1 additional value."
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
    id: "bizi-brass-spark",
    factionId: "bizi",
    name: "Brass Spark",
    type: "tactic",
    rarity: "common",
    value: 2,
    text: "When paid for your first Bizi card each turn, this pays +1 additional value."
  },
  {
    id: "bizi-railspike-marshal",
    factionId: "bizi",
    name: "Railspike Marshal",
    type: "unit",
    rarity: "common",
    value: 5,
    text: "If your previous attack had a different suit, this attacks with +1 value."
  },
  {
    id: "bizi-heat-sink-matrix",
    factionId: "bizi",
    name: "Heat-Sink Matrix",
    type: "relic",
    rarity: "uncommon",
    value: 4,
    text: "When blocking, you may remove 1 acceleration counter to give this +2 value."
  },
  {
    id: "bizi-clockwork-caravan",
    factionId: "bizi",
    name: "Clockwork Caravan",
    type: "unit",
    rarity: "uncommon",
    value: 7,
    text: "The first time each turn you overpay for this by 2 or more, draw 1 extra card at end of turn."
  },
  {
    id: "bizi-voltaric-ultimatum",
    factionId: "bizi",
    name: "Voltaric Ultimatum",
    type: "tactic",
    rarity: "rare",
    value: 8,
    text: "Remove 2 acceleration counters: this attacks with +5 value."
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
for (const card of COLLECTION_CARDS) {
  card.gameplayCardId = card.id;
  card.freeAcquisition = FREE_GAMEPLAY_ACQUISITION;
  card.defaultVariantId = `${card.id}:standard`;
}

function getConstructedCardArt(card) {
  if (!new Set(["rumin", "bizi"]).has(card.factionId)) return null;
  return `/assets/gauntlet/constructed/${card.factionId}/${card.id}.webp`;
}

const COLLECTOR_VARIANTS = COLLECTION_CARDS.flatMap((card) => ([
  {
    schemaVersion: COLLECTOR_VARIANT_SCHEMA_VERSION,
    variantId: card.defaultVariantId,
    gameplayCardId: card.gameplayCardId,
    name: `${card.name} Standard`,
    edition: "foundation",
    finish: "standard",
    frame: "faction-standard",
    border: "standard",
    art: getConstructedCardArt(card),
    collectorRarity: card.rarity,
    acquisition: FREE_GAMEPLAY_ACQUISITION,
    paid: false
  },
  {
    schemaVersion: COLLECTOR_VARIANT_SCHEMA_VERSION,
    variantId: `${card.id}:collector-foil`,
    gameplayCardId: card.gameplayCardId,
    name: `${card.name} Collector Foil`,
    edition: "foundation-collector",
    finish: "foil",
    frame: "collector-gilded",
    border: "collector",
    art: getConstructedCardArt(card),
    collectorRarity: card.rarity,
    acquisition: PAID_COLLECTOR_ACQUISITION,
    paid: true
  }
]));
const COLLECTOR_VARIANT_MECHANICAL_FIELDS = Object.freeze([
  "ability",
  "cardValue",
  "copyLimit",
  "factionAbility",
  "factionId",
  "legality",
  "maxReplacements",
  "replacementLimit",
  "rulesText",
  "text",
  "type",
  "value"
]);
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
    cardImage: "/assets/gauntlet/factions/bizi/focus-conductor-of-progress.webp",
    commander: { name: "Focus, Conductor of Progress", image: "/assets/gauntlet/factions/bizi/focus-conductor-of-progress.webp", text: "Whenever you overpay for a card by 2 or more, put an acceleration counter on this. Once per turn, you may remove an acceleration counter: target card gets +1 value until end of turn." },
    general: { name: "Hera", image: "/assets/gauntlet/factions/bizi/hera-general.webp", text: "Once per turn: If you've played a card of a suit this turn, you may use a card of the same suit to pay 2 more than its value." },
    city: { name: "Constanti, Technology Hub", image: "/assets/gauntlet/factions/bizi/constanti-technology-hub.webp", text: "Each turn, your first two attacks after the first that have a different suit from your previous attack get +1 value." }
  },
  xendra: {
    id: "xendra",
    name: "XenDra",
    campaignOnly: true,
    cardImage: "/assets/gauntlet/bizi-card.webp",
    commander: { name: "Elias Varen, Final Conduit", image: "/assets/gauntlet/rumin-card.webp", text: "Campaign faction: survive the Deep Currents while reality changes around the battle." },
    general: { name: "Syllith, the Echoing Child", image: "/assets/gauntlet/sheen-card.webp", text: "Campaign faction: memories, dialogue, and repeated attacks become unreliable." },
    city: { name: "The Deep Currents", image: "/assets/gauntlet/frumo-card.webp", text: "Campaign faction: each chapter reveals more of the XenDra ritual beneath Reath." }
  }
};

function listFactions() {
  return Object.values(factionsData).filter((faction) => !faction.campaignOnly);
}

function getFactionById(id) {
  return factionsData[id] || null;
}

const campaignChapters = {
  rumin: [
    { id: "brothers-of-destiny", playableName: "Rolmus", opponentName: "Remex", title: "Brothers of Destiny", story: "Two brothers found Rumie together, then clash over whether trade or conquest will define the city.", dialogue: ["Narrator: Before Rumie was an empire, it was an argument between two brothers.", "Rolmus: Trade builds cities. Trust builds roads.", "Remex: Roads invite armies unless walls come first.", "Rolmus: Then let Rumie be more than fear.", "Remex: Or let it survive long enough to become anything at all."], dialogueAudio: ["/assets/gauntlet/voices/rumin-ch01-before-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch01-before-02-rolmus.mp3", "/assets/gauntlet/voices/rumin-ch01-before-03-remex.mp3", "/assets/gauntlet/voices/rumin-ch01-before-04-rolmus.mp3", "/assets/gauntlet/voices/rumin-ch01-before-05-remex.mp3"], endDialogue: ["Narrator: Rolmus wins the first battle for Rumie's soul, but Remex's warning does not die.", "Rolmus: The first stones will be markets, not barracks.", "Remex: And when raiders come?", "Rolmus: Then we will defend what we built.", "Remex: No, brother. One day you will build because you learned to defend."], endDialogueAudio: ["/assets/gauntlet/voices/rumin-ch01-after-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch01-after-02-rolmus.mp3", "/assets/gauntlet/voices/rumin-ch01-after-03-remex.mp3", "/assets/gauntlet/voices/rumin-ch01-after-04-rolmus.mp3", "/assets/gauntlet/voices/rumin-ch01-after-05-remex.mp3"] },
    { id: "the-republic", playableName: "The Senate Guard", opponentName: "Tribune Marcell", title: "The Republic", story: "Generations pass. Rumie grows wealthy, but corrupt senators, banks, runes, and legions begin shaping a fragile republic.", dialogue: ["Narrator: Generations later, Rumie calls itself a republic, but gold has begun to vote louder than citizens.", "Senator: The Republic endures because it is slow.", "Tribune Marcell: Slow things are easy to buy.", "Young Kaiser: Then someone must become too expensive to own.", "Senator: Careful, boy. Men who speak that way become useful or dangerous."], dialogueAudio: ["/assets/gauntlet/voices/rumin-ch02-before-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch02-before-02-senator.mp3", "/assets/gauntlet/voices/rumin-ch02-before-03-marcell.mp3", "/assets/gauntlet/voices/rumin-ch02-before-04-young-kaiser.mp3", "/assets/gauntlet/voices/rumin-ch02-before-05-senator.mp3"], endDialogue: ["Narrator: The Republic survives, but its sickness has been named aloud.", "Tribune Marcell: You think exposing rot makes you clean?", "Young Kaiser: No. It means the people can smell it too.", "Senator: You have made enemies today.", "Young Kaiser: Good. Then I know where to begin."], endDialogueAudio: ["/assets/gauntlet/voices/rumin-ch02-after-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch02-after-02-marcell.mp3", "/assets/gauntlet/voices/rumin-ch02-after-03-young-kaiser.mp3", "/assets/gauntlet/voices/rumin-ch02-after-04-senator.mp3", "/assets/gauntlet/voices/rumin-ch02-after-05-young-kaiser.mp3"] },
    { id: "the-jewel", playableName: "Kaiser", opponentName: "Corrupt Governor Severan", title: "The Jewel", story: "Kaiser rises as a beloved officer who walks among workers, pays debts, and exposes a governor protected by the aristocracy.", dialogue: ["Narrator: Kaiser rises as a soldier of the people, paying debts the Senate pretends not to see.", "Severan: You mistake popularity for authority.", "Kaiser: No. I mistake theft for treason.", "Severan: The people cheer anyone who promises them bread.", "Kaiser: Then perhaps you should have fed them."], dialogueAudio: ["/assets/gauntlet/voices/rumin-ch03-before-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch03-before-02-severan.mp3", "/assets/gauntlet/voices/rumin-ch03-before-03-kaiser.mp3", "/assets/gauntlet/voices/rumin-ch03-before-04-severan.mp3", "/assets/gauntlet/voices/rumin-ch03-before-05-kaiser.mp3"], endDialogue: ["Narrator: Severan falls, and Kaiser becomes the Jewel of Rumie.", "Crowd: Kaiser! Kaiser! Kaiser!", "Severan: They will love you until you ask something of them.", "Kaiser: Then I will ask only what Rumie needs.", "Severan: That is how every tyrant introduces himself."], endDialogueAudio: ["/assets/gauntlet/voices/rumin-ch03-after-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch03-after-02-crowd.mp3", "/assets/gauntlet/voices/rumin-ch03-after-03-severan.mp3", "/assets/gauntlet/voices/rumin-ch03-after-04-kaiser.mp3", "/assets/gauntlet/voices/rumin-ch03-after-05-severan.mp3"] },
    { id: "gaulic-wars", playableName: "Kaiser", opponentName: "Gaulic Warchief Vercan", title: "The Gaulic Wars", story: "Northern tribes unite against Rumie. Kaiser turns frontier war into fame, wealth, and open trade routes.", dialogue: ["Narrator: The northern frontier burns, and Kaiser marches toward the war that will make his name too large for the Senate.", "Vercan: Your roads end here, jewel prince.", "Kaiser: Roads do not end. They arrive.", "Vercan: Then arrive with steel.", "Kaiser: I brought more than steel. I brought Rumie."], dialogueAudio: ["/assets/gauntlet/voices/rumin-ch04-before-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch04-before-02-vercan.mp3", "/assets/gauntlet/voices/rumin-ch04-before-03-kaiser.mp3", "/assets/gauntlet/voices/rumin-ch04-before-04-vercan.mp3", "/assets/gauntlet/voices/rumin-ch04-before-05-kaiser.mp3"], endDialogue: ["Narrator: The frontier opens, and Kaiser returns with veterans, wealth, and a legend the Senate cannot easily command.", "Vercan: You win land. You do not win memory.", "Kaiser: Memory follows roads too.", "Vercan: Then one day your empire will remember every place it wounded.", "Kaiser: And every place it raised from ruin."], endDialogueAudio: ["/assets/gauntlet/voices/rumin-ch04-after-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch04-after-02-vercan.mp3", "/assets/gauntlet/voices/rumin-ch04-after-03-kaiser.mp3", "/assets/gauntlet/voices/rumin-ch04-after-04-vercan.mp3", "/assets/gauntlet/voices/rumin-ch04-after-05-kaiser.mp3"] },
    { id: "three-runes", playableName: "Kaiser", opponentName: "Ancient Rune Guardian", title: "The Three Runes", story: "Kaiser discovers vaults of Strength, Protection, and Experience, then begins binding sacred runes to the legions.", dialogue: ["Narrator: Beneath conquered lands, Kaiser finds vaults older than Rumie itself.", "Guardian: Strength without wisdom breaks itself.", "Kaiser: Then I will take wisdom too.", "Guardian: All conquerors say that before the vault closes.", "Kaiser: I am not here to conquer the runes. I am here to make Rumie worthy of them."], dialogueAudio: ["/assets/gauntlet/voices/rumin-ch05-before-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch05-before-02-guardian.mp3", "/assets/gauntlet/voices/rumin-ch05-before-03-kaiser.mp3", "/assets/gauntlet/voices/rumin-ch05-before-04-guardian.mp3", "/assets/gauntlet/voices/rumin-ch05-before-05-kaiser.mp3"], endDialogue: ["Narrator: The runes answer Kaiser, and Rumie's legions become more than soldiers.", "Guardian: You have taken Strength. You have taken Protection. You have taken Experience.", "Kaiser: Then Rumie will endure.", "Guardian: No. Rumie will become harder to kill.", "Kaiser: For an empire, that may be the same thing."], endDialogueAudio: ["/assets/gauntlet/voices/rumin-ch05-after-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch05-after-02-guardian.mp3", "/assets/gauntlet/voices/rumin-ch05-after-03-kaiser.mp3", "/assets/gauntlet/voices/rumin-ch05-after-04-guardian.mp3", "/assets/gauntlet/voices/rumin-ch05-after-05-kaiser.mp3"] },
    { id: "first-empire-bank", playableName: "Kaiser", opponentName: "Market Collapse", title: "The First Empire Bank", story: "Kaiser returns to build roads, grain systems, public works, and banking reforms while saboteurs try to break Rumie's markets.", dialogue: ["Narrator: Kaiser turns from conquest to reform, but money resists command as fiercely as armies do.", "Merchant: The city eats because credit moves.", "Brutus: And if one man commands the credit?", "Kaiser: Then one man answers if the people starve.", "Brutus: Or one man decides who deserves bread."], dialogueAudio: ["/assets/gauntlet/voices/rumin-ch06-before-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch06-before-02-merchant.mp3", "/assets/gauntlet/voices/rumin-ch06-before-03-brutus.mp3", "/assets/gauntlet/voices/rumin-ch06-before-04-kaiser.mp3", "/assets/gauntlet/voices/rumin-ch06-before-05-brutus.mp3"], endDialogue: ["Narrator: The markets hold, and the people begin trusting Kaiser more than the Republic itself.", "Merchant: The grain arrives. The banks open. The streets are calm.", "Brutus: Calm is not the same as free.", "Kaiser: Hunger is not freedom either.", "Brutus: No. But a fed people may still wake in chains."], endDialogueAudio: ["/assets/gauntlet/voices/rumin-ch06-after-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch06-after-02-merchant.mp3", "/assets/gauntlet/voices/rumin-ch06-after-03-brutus.mp3", "/assets/gauntlet/voices/rumin-ch06-after-04-kaiser.mp3", "/assets/gauntlet/voices/rumin-ch06-after-05-brutus.mp3"] },
    { id: "the-crossing", playableName: "Kaiser", opponentName: "Senate General Cassius", title: "The Crossing", story: "The Senate orders Kaiser to surrender command. Brutus pleads for restraint, but Kaiser marches and civil war begins.", dialogue: ["Narrator: The Senate orders Kaiser to surrender command. Between law and loyalty, Rumie holds its breath.", "Brutus: Kaiser, do not do this.", "Kaiser: If I surrender, Rumie returns to corruption.", "Brutus: Then save the Republic.", "Kaiser: I intend to.", "Brutus: You cannot save a thing by standing above it."], dialogueAudio: ["/assets/gauntlet/voices/rumin-ch07-before-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch07-before-02-brutus.mp3", "/assets/gauntlet/voices/rumin-ch07-before-03-kaiser.mp3", "/assets/gauntlet/voices/rumin-ch07-before-04-brutus.mp3", "/assets/gauntlet/voices/rumin-ch07-before-05-kaiser.mp3", "/assets/gauntlet/voices/rumin-ch07-before-06-brutus.mp3"], endDialogue: ["Narrator: Kaiser crosses the line, and the Republic becomes a battlefield.", "Cassius: You have declared war on Rumie.", "Kaiser: I have declared war on the men who sold it.", "Brutus: You crossed with soldiers, not arguments.", "Kaiser: Arguments failed the hungry. Soldiers will not."], endDialogueAudio: ["/assets/gauntlet/voices/rumin-ch07-after-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch07-after-02-cassius.mp3", "/assets/gauntlet/voices/rumin-ch07-after-03-kaiser.mp3", "/assets/gauntlet/voices/rumin-ch07-after-04-brutus.mp3", "/assets/gauntlet/voices/rumin-ch07-after-05-kaiser.mp3"] },
    { id: "last-republic", playableName: "Kaiser", opponentName: "Brutus", title: "The Last Republic", story: "Rumie burns as legions and senators collide. Kaiser wins the city, but Brutus survives the fall of the old order.", dialogue: ["Narrator: The old order makes its final stand, and Brutus faces the man he once hoped would save it.", "Brutus: You have saved Rumie by conquering it.", "Kaiser: I have saved Rumie from men who sold it.", "Brutus: Then we are both traitors.", "Kaiser: Perhaps. But only one of us is still useful."], dialogueAudio: ["/assets/gauntlet/voices/rumin-ch08-before-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch08-before-02-brutus.mp3", "/assets/gauntlet/voices/rumin-ch08-before-03-kaiser.mp3", "/assets/gauntlet/voices/rumin-ch08-before-04-brutus.mp3", "/assets/gauntlet/voices/rumin-ch08-before-05-kaiser.mp3"], endDialogue: ["Narrator: The Republic still speaks, but it no longer rules.", "Brutus: Listen to the silence after victory.", "Kaiser: I hear rebuilding.", "Brutus: I hear fear learning to applaud.", "Kaiser: Then teach it courage, Brutus. Do not ask me to restore cowardice."], endDialogueAudio: ["/assets/gauntlet/voices/rumin-ch08-after-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch08-after-02-brutus.mp3", "/assets/gauntlet/voices/rumin-ch08-after-03-kaiser.mp3", "/assets/gauntlet/voices/rumin-ch08-after-04-brutus.mp3", "/assets/gauntlet/voices/rumin-ch08-after-05-kaiser.mp3"] },
    { id: "emperor-of-gold", playableName: "Kaiser", opponentName: "Rebel Senate Coalition", title: "Emperor of Gold", story: "At Kaiser's peak, roads, banks, and legions flourish, but prisoners, taxes, and central rule make citizens question the jewel.", dialogue: ["Narrator: Rumie prospers beneath Kaiser, but gold can gild a cage as easily as a crown.", "Senator: Prosperity is not freedom.", "Kaiser: Freedom without bread is a slogan.", "Brutus: And bread without law is obedience.", "Kaiser: Law failed when it served only those who could purchase it."], dialogueAudio: ["/assets/gauntlet/voices/rumin-ch09-before-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch09-before-02-senator.mp3", "/assets/gauntlet/voices/rumin-ch09-before-03-kaiser.mp3", "/assets/gauntlet/voices/rumin-ch09-before-04-brutus.mp3", "/assets/gauntlet/voices/rumin-ch09-before-05-kaiser.mp3"], endDialogue: ["Narrator: Kaiser reaches the height of power, and Rumie begins to wonder whether rescue has become rule.", "Senator: The roads are full. The banks are strong. The prisons are fuller.", "Kaiser: Order has a cost.", "Brutus: You once called that cost theft.", "Kaiser: I was younger then.", "Brutus: No. You were clearer."], endDialogueAudio: ["/assets/gauntlet/voices/rumin-ch09-after-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch09-after-02-senator.mp3", "/assets/gauntlet/voices/rumin-ch09-after-03-kaiser.mp3", "/assets/gauntlet/voices/rumin-ch09-after-04-brutus.mp3", "/assets/gauntlet/voices/rumin-ch09-after-05-kaiser.mp3", "/assets/gauntlet/voices/rumin-ch09-after-06-brutus.mp3"] },
    { id: "ides-of-rumie", playableName: "Kaiser", opponentName: "Brutus and the Conspirators", title: "The Ides of Rumie", story: "Kaiser stabilizes the empire, yet the conspiracy reaches the Senate floor. This chapter frames the tragedy more than the victory.", dialogue: ["Narrator: The conspiracy reaches the Senate floor, where gratitude, fear, and betrayal wear the same robes.", "Kaiser: You too, Brutus?", "Brutus: I do this for Rumie.", "Kaiser: No. You do it because Rumie no longer needs you.", "Brutus: I do it because Rumie should need no one man."], dialogueAudio: ["/assets/gauntlet/voices/rumin-ch10-before-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch10-before-02-kaiser.mp3", "/assets/gauntlet/voices/rumin-ch10-before-03-brutus.mp3", "/assets/gauntlet/voices/rumin-ch10-before-04-kaiser.mp3", "/assets/gauntlet/voices/rumin-ch10-before-05-brutus.mp3"], endDialogue: ["Narrator: Kaiser falls, but the empire does not. His killers destroy the man and preserve the myth.", "Brutus: It is done.", "Conspirator: Then why are they not cheering?", "Brutus: Because they loved him.", "Conspirator: And now?", "Brutus: Now they will remember him better than he was."], endDialogueAudio: ["/assets/gauntlet/voices/rumin-ch10-after-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch10-after-02-brutus.mp3", "/assets/gauntlet/voices/rumin-ch10-after-03-conspirator.mp3", "/assets/gauntlet/voices/rumin-ch10-after-04-brutus.mp3", "/assets/gauntlet/voices/rumin-ch10-after-05-conspirator.mp3", "/assets/gauntlet/voices/rumin-ch10-after-06-brutus.mp3"] },
    { id: "war-of-successors", playableName: "Bobei", opponentName: "Brutus", title: "War of the Successors", story: "After Kaiser dies, Bobei seeks vengeance while Brutus tries to restore the Republic from the ruins.", dialogue: ["Narrator: Kaiser's death leaves Rumie with grief, ambition, and armies looking for a name to follow.", "Bobei: You killed a man and woke an empire.", "Brutus: I killed a tyrant.", "Bobei: Then why does Rumie weep?", "Brutus: Because grief is easier than liberty."], dialogueAudio: ["/assets/gauntlet/voices/rumin-ch11-before-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch11-before-02-bobei.mp3", "/assets/gauntlet/voices/rumin-ch11-before-03-brutus.mp3", "/assets/gauntlet/voices/rumin-ch11-before-04-bobei.mp3", "/assets/gauntlet/voices/rumin-ch11-before-05-brutus.mp3"], endDialogue: ["Narrator: Brutus loses the future, and the Republic becomes a memory carried by the empire that replaces it.", "Brutus: I wanted Rumie to stand without a master.", "Bobei: You left it leaderless in a storm.", "Brutus: And you would give it another master?", "Bobei: I would give it an heir.", "Brutus: Then Kaiser wins, even dead."], endDialogueAudio: ["/assets/gauntlet/voices/rumin-ch11-after-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch11-after-02-brutus.mp3", "/assets/gauntlet/voices/rumin-ch11-after-03-bobei.mp3", "/assets/gauntlet/voices/rumin-ch11-after-04-brutus.mp3", "/assets/gauntlet/voices/rumin-ch11-after-05-bobei.mp3", "/assets/gauntlet/voices/rumin-ch11-after-06-brutus.mp3"] },
    { id: "first-emperor", playableName: "Augustus", opponentName: "Bobei the Great", title: "The First Emperor", story: "Augustus defeats Bobei, keeps the bank, legions, and rune program, restores Senate traditions, and leaves Rumie with an empire wearing republican robes.", dialogue: ["Narrator: Augustus and Bobei clash over Kaiser's legacy: vengeance or settlement, sword or law.", "Bobei: I was Kaiser's sword.", "Augustus: And I will be his law.", "Bobei: Law without fire is parchment.", "Augustus: Fire without law is only smoke.", "Old Senator: Perhaps the better question is whether Rumie could have survived without him."], dialogueAudio: ["/assets/gauntlet/voices/rumin-ch12-before-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch12-before-02-bobei.mp3", "/assets/gauntlet/voices/rumin-ch12-before-03-augustus.mp3", "/assets/gauntlet/voices/rumin-ch12-before-04-bobei.mp3", "/assets/gauntlet/voices/rumin-ch12-before-05-augustus.mp3", "/assets/gauntlet/voices/rumin-ch12-before-06-senator.mp3"], endDialogue: ["Narrator: Augustus wins. The Senate returns in ceremony, the empire remains in fact, and Rumie learns to call obedience tradition.", "Bobei: You kept the Senate's masks.", "Augustus: People fear naked power.", "Old Senator: And what should we call this new arrangement?", "Augustus: Peace.", "Bobei: Empire.", "Augustus: In Rumie, they will learn to mean the same thing."], endDialogueAudio: ["/assets/gauntlet/voices/rumin-ch12-after-01-narrator.mp3", "/assets/gauntlet/voices/rumin-ch12-after-02-bobei.mp3", "/assets/gauntlet/voices/rumin-ch12-after-03-augustus.mp3", "/assets/gauntlet/voices/rumin-ch12-after-04-senator.mp3", "/assets/gauntlet/voices/rumin-ch12-after-05-augustus.mp3", "/assets/gauntlet/voices/rumin-ch12-after-06-bobei.mp3", "/assets/gauntlet/voices/rumin-ch12-after-07-augustus.mp3"] }
  ],
  sheen: [
    { id: "iron-roots", playableName: "Leafen Gao", opponentName: "Emperor Blackthorn", title: "The Iron Roots", story: "The Obsidian Lords drain the forests through Iron Root outposts while Leafen Gao begins a rebellion among starving villages.", dialogue: ["Narrator: Before Beli had a crown, the Obsidian Lords taught the forest to starve.", "Leafen Gao: A root that drinks everything is not a root. It is a chain.", "Blackthorn: Chains hold kingdoms together.", "Leafen Gao: Then the forest will break yours.", "Blackthorn: Break a chain, rebel, and you will learn how much it was holding back."], dialogueAudio: ["/assets/gauntlet/voices/sheen-ch01-before-01-narrator.mp3", "/assets/gauntlet/voices/sheen-ch01-before-02-leafen-gao.mp3", "/assets/gauntlet/voices/sheen-ch01-before-03-blackthorn.mp3", "/assets/gauntlet/voices/sheen-ch01-before-04-leafen-gao.mp3", "/assets/gauntlet/voices/sheen-ch01-before-05-blackthorn.mp3"], endDialogue: ["Narrator: The first Iron Root falls, and the villages remember that hunger can become courage.", "Leafen Gao: Take the grain. Share it before nightfall.", "Blackthorn: You have fed one valley and doomed ten more.", "Leafen Gao: No. I have shown ten valleys where to begin.", "Blackthorn: Then I will teach them what rebellion costs."], endDialogueAudio: ["/assets/gauntlet/voices/sheen-ch01-after-01-narrator.mp3", "/assets/gauntlet/voices/sheen-ch01-after-02-leafen-gao.mp3", "/assets/gauntlet/voices/sheen-ch01-after-03-blackthorn.mp3", "/assets/gauntlet/voices/sheen-ch01-after-04-leafen-gao.mp3", "/assets/gauntlet/voices/sheen-ch01-after-05-blackthorn.mp3"] },
    { id: "verdant-uprising", playableName: "Leafen Gao and Hushan", opponentName: "The Thorn Guard Commanders", title: "The Verdant Uprising", story: "Hushan joins Leafen as the rebellion spreads against Ironbark, Thornclaw, and Rootlash.", dialogue: ["Narrator: Word of Leafen's victory moves faster than soldiers, and Hushan brings disciplined roots to wild hope.", "Hushan: They say this rebellion is doomed.", "Leafen Gao: Seeds are buried before they rise.", "Ironbark: Then we will salt the soil.", "Hushan: Salt washes away. Roots remember water."], dialogueAudio: ["/assets/gauntlet/voices/sheen-ch02-before-01-narrator.mp3","/assets/gauntlet/voices/sheen-ch02-before-02-hushan.mp3","/assets/gauntlet/voices/sheen-ch02-before-03-leafen-gao.mp3","/assets/gauntlet/voices/sheen-ch02-before-04-ironbark.mp3","/assets/gauntlet/voices/sheen-ch02-before-05-hushan.mp3"], endDialogue: ["Narrator: Thorn Guard banners fall in three valleys, and the uprising becomes a map.", "Ironbark: You cannot command forests with songs.", "Leafen Gao: No. But songs tell forests when to move.", "Hushan: We do not need every tree to fight. Only enough to make the tyrant afraid of shade.", "Ironbark: Then shade will burn."], endDialogueAudio: ["/assets/gauntlet/voices/sheen-ch02-after-01-narrator.mp3","/assets/gauntlet/voices/sheen-ch02-after-02-ironbark.mp3","/assets/gauntlet/voices/sheen-ch02-after-03-leafen-gao.mp3","/assets/gauntlet/voices/sheen-ch02-after-04-hushan.mp3","/assets/gauntlet/voices/sheen-ch02-after-05-ironbark.mp3"] },
    { id: "obsidian-throne", playableName: "Leafen Gao, Hushan, and Leshan", opponentName: "Blackthorn, Lord of Iron", title: "Fall of the Obsidian Throne", story: "Leshan and Dowan collapse the Iron Roots themselves, forcing Blackthorn into one last monstrous stand.", dialogue: ["Narrator: Leshan and Dowan find the hidden roots beneath Blackthorn's throne, where every stolen harvest has been counted.", "Leshan: Strike the root, not the branch.", "Blackthorn: I am the root.", "Leafen Gao: Then fall with it.", "Blackthorn: Without me, the forest will devour itself."], dialogueAudio: ["/assets/gauntlet/voices/sheen-ch03-before-01-narrator.mp3","/assets/gauntlet/voices/sheen-ch03-before-02-leshan.mp3","/assets/gauntlet/voices/sheen-ch03-before-03-blackthorn.mp3","/assets/gauntlet/voices/sheen-ch03-before-04-leafen-gao.mp3","/assets/gauntlet/voices/sheen-ch03-before-05-blackthorn.mp3"], endDialogue: ["Narrator: Blackthorn falls, and the Obsidian Throne cracks like winter bark.", "Leafen Gao: No lord will drink the forest dry again.", "Leshan: Then we must become more than rebels.", "Hushan: Rebellion cuts. A kingdom must heal.", "Leafen Gao: Then we begin with living soil, not stone."], endDialogueAudio: ["/assets/gauntlet/voices/sheen-ch03-after-01-narrator.mp3","/assets/gauntlet/voices/sheen-ch03-after-02-leafen-gao.mp3","/assets/gauntlet/voices/sheen-ch03-after-03-leshan.mp3","/assets/gauntlet/voices/sheen-ch03-after-04-hushan.mp3",null] },
    { id: "beli-living-city", playableName: "Leafen Gao", opponentName: "The Great Blight", title: "Beli, Living City", story: "The Sheen rebuild, found Beli, and begin the Root Network while a natural blight threatens the new kingdom.", dialogue: ["Narrator: The Sheen found Beli as a city grown from oath, root, and shelter.", "Leafen Gao: We won a forest. Now we must make it a home.", "Reane: Homes are grown, not declared.", "The Great Blight: All growth returns to hunger.", "Leafen Gao: Then hunger will find us planted together."], dialogueAudio: ["/assets/gauntlet/voices/sheen-ch04-before-01-narrator.mp3","/assets/gauntlet/voices/sheen-ch04-before-02-leafen-gao.mp3","/assets/gauntlet/voices/sheen-ch04-before-03-reane.mp3","/assets/gauntlet/voices/sheen-ch04-before-04-great-blight.mp3","/assets/gauntlet/voices/sheen-ch04-before-05-leafen-gao.mp3"], endDialogue: ["Narrator: Beli survives its first sickness, and the city learns that care can be a defense.", "Reane: The blight did not vanish. It retreated.", "Leafen Gao: Then we watch the soil.", "The Great Blight: Watch. Worry. Wither. I am patient.", "Reane: So are forests."], endDialogueAudio: ["/assets/gauntlet/voices/sheen-ch04-after-01-narrator.mp3","/assets/gauntlet/voices/sheen-ch04-after-02-reane.mp3","/assets/gauntlet/voices/sheen-ch04-after-03-leafen-gao.mp3","/assets/gauntlet/voices/sheen-ch04-after-04-great-blight.mp3","/assets/gauntlet/voices/sheen-ch04-after-05-reane.mp3"] },
    { id: "root-network", playableName: "Bark Xin and Dowan", opponentName: "The Ash Serpent", title: "The Root Network", story: "Dowan expands Sheen botanical science with barriers, shields, greenhouses, and trade routes, but the Ash Serpent burns the nodes.", dialogue: ["Narrator: Dowan begins the Root Network, binding distant shelters through living paths beneath the earth.", "Dowan: The network must bend before it spreads.", "Bark Xin: And if fire follows the roots?", "Dowan: Then we teach roots to carry rain.", "Ash Serpent: Rain becomes steam. Roots become smoke."], dialogueAudio: ["/assets/gauntlet/voices/sheen-ch05-before-01-narrator.mp3","/assets/gauntlet/voices/sheen-ch05-before-02-dowan.mp3","/assets/gauntlet/voices/sheen-ch05-before-03-bark-xin.mp3","/assets/gauntlet/voices/sheen-ch05-before-04-dowan.mp3","/assets/gauntlet/voices/sheen-ch05-before-05-ash-serpent.mp3"], endDialogue: ["Narrator: The first firebreak blooms, and the Root Network learns to survive attack.", "Bark Xin: The burned nodes are already budding.", "Dowan: A network is not one root. That is why it lives.", "Ash Serpent: I will find the heart.", "Dowan: You misunderstand us. We are learning not to have one."], endDialogueAudio: ["/assets/gauntlet/voices/sheen-ch05-after-01-narrator.mp3","/assets/gauntlet/voices/sheen-ch05-after-02-bark-xin.mp3","/assets/gauntlet/voices/sheen-ch05-after-03-dowan.mp3","/assets/gauntlet/voices/sheen-ch05-after-04-ash-serpent.mp3","/assets/gauntlet/voices/sheen-ch05-after-05-dowan.mp3"] },
    { id: "blooming-age", playableName: "Reane and Hushan", opponentName: "The Drought King", title: "The Blooming Age", story: "The Sheen enter a golden age of shelters, retreats, springs, and living greenhouses as a desert warlord tests the border.", dialogue: ["Narrator: Beli enters its blooming age, and prosperity spreads through shelters, springs, and greenhouses.", "Reane: Prosperity is not how much we store. It is how much survives winter.", "Drought King: I bring a longer winter.", "Hushan: Then we bring deeper roots.", "Drought King: Roots crack when the world forgets rain."], dialogueAudio: ["/assets/gauntlet/voices/sheen-ch06-before-01-narrator.mp3","/assets/gauntlet/voices/sheen-ch06-before-02-reane.mp3","/assets/gauntlet/voices/sheen-ch06-before-03-drought-king.mp3","/assets/gauntlet/voices/sheen-ch06-before-04-hushan.mp3","/assets/gauntlet/voices/sheen-ch06-before-05-drought-king.mp3"], endDialogue: ["Narrator: The Drought King's army breaks at the living springs, and Beli's borders flower instead of harden.", "Reane: Water belongs to need, not conquest.", "Hushan: The border villages will have reservoirs by autumn.", "Drought King: Mercy makes soft kingdoms.", "Reane: Mercy made this one hard to kill."], endDialogueAudio: ["/assets/gauntlet/voices/sheen-ch06-after-01-narrator.mp3","/assets/gauntlet/voices/sheen-ch06-after-02-reane.mp3","/assets/gauntlet/voices/sheen-ch06-after-03-hushan.mp3","/assets/gauntlet/voices/sheen-ch06-after-04-drought-king.mp3","/assets/gauntlet/voices/sheen-ch06-after-05-reane.mp3"] },
    { id: "court-of-blossoms", playableName: "Den", opponentName: "Minister Hollowvine", title: "The Court of Blossoms", story: "Political factions emerge in Beli as Den tries to preserve stability while Aime and Tang rise through the court.", dialogue: ["Narrator: In peace, Beli grows a court, and every blossom learns the shadow of ambition.", "Den: A court can rot while every garden blooms.", "Hollowvine: Rot feeds the next garden.", "Den: Not while I still prune.", "Hollowvine: Prune too much and you become the knife, not the gardener."], dialogueAudio: ["/assets/gauntlet/voices/sheen-ch07-before-01-narrator.mp3","/assets/gauntlet/voices/sheen-ch07-before-02-den.mp3","/assets/gauntlet/voices/sheen-ch07-before-03-hollowvine.mp3","/assets/gauntlet/voices/sheen-ch07-before-04-den.mp3","/assets/gauntlet/voices/sheen-ch07-before-05-hollowvine.mp3"], endDialogue: ["Narrator: Hollowvine is exposed, but the Court of Blossoms has learned how quietly poison travels.", "Den: Remove his seal. Leave his records.", "Hollowvine: You will read them and find half the court inside.", "Den: Then half the court will answer.", "Hollowvine: Careful, Den. Roots tangle below every throne."], endDialogueAudio: ["/assets/gauntlet/voices/sheen-ch07-after-01-narrator.mp3","/assets/gauntlet/voices/sheen-ch07-after-02-den.mp3","/assets/gauntlet/voices/sheen-ch07-after-03-hollowvine.mp3","/assets/gauntlet/voices/sheen-ch07-after-04-den.mp3","/assets/gauntlet/voices/sheen-ch07-after-05-hollowvine.mp3"] },
    { id: "the-reformer", playableName: "Tang", opponentName: "Lord Goldroot", title: "The Reformer", story: "Tang sees inequality and stagnation, introduces reforms that truly help, and wins sympathy against corrupt nobles.", dialogue: ["Narrator: Tang rises from the court with reform in his hands and anger beneath his patience.", "Tang: Tradition has become a fence around empty soil.", "Goldroot: Empty soil is still mine.", "Tang: Not after the roots remember the poor.", "Goldroot: The poor need shade, not power."], dialogueAudio: ["/assets/gauntlet/voices/sheen-ch08-before-01-narrator.mp3","/assets/gauntlet/voices/sheen-ch08-before-02-tang.mp3","/assets/gauntlet/voices/sheen-ch08-before-03-goldroot.mp3","/assets/gauntlet/voices/sheen-ch08-before-04-tang.mp3","/assets/gauntlet/voices/sheen-ch08-before-05-goldroot.mp3"], endDialogue: ["Narrator: Goldroot's estates open, and Tang becomes the voice of those Beli forgot.", "Tang: Every storehouse will answer to the hunger around it.", "Goldroot: You call seizure justice because applause makes it warm.", "Tang: I call it justice because children will eat tonight.", "Goldroot: Tonight is not a constitution."], endDialogueAudio: ["/assets/gauntlet/voices/sheen-ch08-after-01-narrator.mp3","/assets/gauntlet/voices/sheen-ch08-after-02-tang.mp3","/assets/gauntlet/voices/sheen-ch08-after-03-goldroot.mp3","/assets/gauntlet/voices/sheen-ch08-after-04-tang.mp3","/assets/gauntlet/voices/sheen-ch08-after-05-goldroot.mp3"] },
    { id: "thorned-crown", playableName: "Tang", opponentName: "Ringan", title: "Thorned Crown", story: "Tang centralizes power and creates the Thornblades, while Ringan, a former ally, tries to stop his imbalance.", dialogue: ["Narrator: Tang's reforms harden into command, and the Thornblades rise where councils once argued.", "Ringan: You wanted reform. This is control.", "Tang: Control is reform that cannot be bribed.", "Ringan: And cannot be questioned.", "Tang: Questions are how the hungry are delayed."], dialogueAudio: ["/assets/gauntlet/voices/sheen-ch09-before-01-narrator.mp3","/assets/gauntlet/voices/sheen-ch09-before-02-ringan.mp3","/assets/gauntlet/voices/sheen-ch09-before-03-tang.mp3","/assets/gauntlet/voices/sheen-ch09-before-04-ringan.mp3","/assets/gauntlet/voices/sheen-ch09-before-05-tang.mp3"], endDialogue: ["Narrator: Ringan retreats, and Tang takes the thorned crown no one officially offered.", "Ringan: You are protecting the people from their own voices.", "Tang: I am protecting them from the voices that purchase them.", "Ringan: You have made distrust into law.", "Tang: I have made weakness answerable."], endDialogueAudio: ["/assets/gauntlet/voices/sheen-ch09-after-01-narrator.mp3","/assets/gauntlet/voices/sheen-ch09-after-02-ringan.mp3","/assets/gauntlet/voices/sheen-ch09-after-03-tang.mp3","/assets/gauntlet/voices/sheen-ch09-after-04-ringan.mp3","/assets/gauntlet/voices/sheen-ch09-after-05-tang.mp3"] },
    { id: "war-of-roots", playableName: "Dowan, Hushan, and Ringan", opponentName: "The Thornblade Generals", title: "The War of Roots", story: "Civil war burns the forests as shelters are weaponized and the Root Network collapses under Ashroot, Briarfang, and Ironvine.", dialogue: ["Narrator: Civil war reaches the Root Network, and the roads built for bread begin carrying blades.", "Dowan: I built these roads to feed cities.", "Ashroot: Roads also carry armies.", "Hushan: Then we cut the roads and save the roots.", "Briarfang: Cut them, and the cities starve for your conscience."], dialogueAudio: ["/assets/gauntlet/voices/sheen-ch10-before-01-narrator.mp3","/assets/gauntlet/voices/sheen-ch10-before-02-dowan.mp3","/assets/gauntlet/voices/sheen-ch10-before-03-ashroot.mp3","/assets/gauntlet/voices/sheen-ch10-before-04-hushan.mp3","/assets/gauntlet/voices/sheen-ch10-before-05-briarfang.mp3"], endDialogue: ["Narrator: The Thornblade generals fall, but every victory severs another living path.", "Dowan: We saved the nodes by burning the bridges between them.", "Hushan: Better wounded roots than captured ones.", "Ringan: Do not comfort yourselves. We are pruning a kingdom with fire.", "Dowan: Then we remember every branch we took."], endDialogueAudio: ["/assets/gauntlet/voices/sheen-ch10-after-01-narrator.mp3","/assets/gauntlet/voices/sheen-ch10-after-02-dowan.mp3","/assets/gauntlet/voices/sheen-ch10-after-03-hushan.mp3","/assets/gauntlet/voices/sheen-ch10-after-04-ringan.mp3","/assets/gauntlet/voices/sheen-ch10-after-05-dowan.mp3"] },
    { id: "fall-of-thorn-mang", playableName: "Dowan and Reane", opponentName: "Tang, Crown of Thorns", title: "Fall of Thorn Mang", story: "Tang realizes too late what his reforms became, then falls as healer, commander, and living thorn avatar.", dialogue: ["Narrator: Tang waits at Thorn Mang, where reform, fear, and living thorn have become one body.", "Tang: I only wanted the kingdom to live.", "Reane: Then why does it bleed when you speak?", "Tang: Because I mistook pain for pruning.", "Dowan: Then let the wound close before the whole forest scars."], dialogueAudio: ["/assets/gauntlet/voices/sheen-ch11-before-01-narrator.mp3","/assets/gauntlet/voices/sheen-ch11-before-02-tang.mp3","/assets/gauntlet/voices/sheen-ch11-before-03-reane.mp3","/assets/gauntlet/voices/sheen-ch11-before-04-tang.mp3","/assets/gauntlet/voices/sheen-ch11-before-05-dowan.mp3"], endDialogue: ["Narrator: Tang falls, and for a moment even the thorns seem relieved.", "Tang: Was I wrong from the beginning?", "Reane: No. That is why this hurts.", "Dowan: Good roots can still strangle when they forget light.", "Tang: Then teach them better than I did."], endDialogueAudio: ["/assets/gauntlet/voices/sheen-ch11-after-01-narrator.mp3","/assets/gauntlet/voices/sheen-ch11-after-02-tang.mp3","/assets/gauntlet/voices/sheen-ch11-after-03-reane.mp3","/assets/gauntlet/voices/sheen-ch11-after-04-dowan.mp3","/assets/gauntlet/voices/sheen-ch11-after-05-tang.mp3"] },
    { id: "green-era", playableName: "Dowan", opponentName: "The Great Renewal", title: "The Green Era", story: "Dowan restores the Root Network, shelters, healing, greenhouses, and balance after the civil war.", dialogue: ["Narrator: After civil war, Dowan faces the hardest enemy left: rebuilding without repeating the wound.", "Dowan: Growth without harmony becomes overgrowth.", "Reane: Tradition without growth becomes ash.", "Dowan: Then wisdom is knowing when to nurture and when to prune.", "The Great Renewal: All new growth must decide what old roots deserve to remain."], dialogueAudio: ["/assets/gauntlet/voices/sheen-ch12-before-01-narrator.mp3","/assets/gauntlet/voices/sheen-ch12-before-02-dowan.mp3","/assets/gauntlet/voices/sheen-ch12-before-03-reane.mp3","/assets/gauntlet/voices/sheen-ch12-before-04-dowan.mp3","/assets/gauntlet/voices/sheen-ch12-before-05-great-renewal.mp3"], endDialogue: ["Narrator: The Root Network blooms again, slower now, wiser for every scar beneath it.", "Dowan: No single root will rule the forest.", "Reane: And no old branch will be kept only because it is old.", "The Great Renewal: Then Beli is not restored. It is changed.", "Dowan: That is how living things endure."], endDialogueAudio: ["/assets/gauntlet/voices/sheen-ch12-after-01-narrator.mp3","/assets/gauntlet/voices/sheen-ch12-after-02-dowan.mp3","/assets/gauntlet/voices/sheen-ch12-after-03-reane.mp3","/assets/gauntlet/voices/sheen-ch12-after-04-great-renewal.mp3","/assets/gauntlet/voices/sheen-ch12-after-05-dowan.mp3"] }
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
  ],
  xendra: [
    { id: "longest-night", playableName: "Elias Varen", opponentName: "Terrified Villager", title: "The Longest Night", story: "An impossible eclipse settles over Reath. Elias, a cartographer with no combat training, notices that the stars are moving.", dialogue: ["Narrator: Everyone celebrated the beautiful eclipse. Elias counted the stars and realized they had changed positions.", "Elias: Stars do not drift at noon.", "Terrified Villager: Don't look at the sky!"] },
    { id: "silent-village", playableName: "Elias Varen", opponentName: "The Village Elder", title: "The Silent Village", story: "Elias reaches a polite village where nobody blinks, children play without speaking, and every answer is the same.", dialogue: ["Elias: What did you see during the eclipse?", "Village Elder: The light was beautiful.", "Elias: That is what the children said. Word for word."] },
    { id: "dreams-that-remember", playableName: "Elias Varen", opponentName: "Syllith, the Echoing Child", title: "Dreams That Remember", story: "Elias dreams of rooms that rearrange themselves and voices that repeat his memories with one word wrong.", dialogue: ["Syllith: Stars do not drift at dawn.", "Elias: I said noon.", "Syllith: Did you?"] },
    { id: "beneath-observatory", playableName: "Elias Varen", opponentName: "The Thrallmaker", title: "Beneath the Observatory", story: "Ancient observatories reveal that civilizations before recorded history drew the same eclipse symbol: the XenDra glyph.", dialogue: ["Elias: Rumin stone. Sheen ink. Bizi brass. The same mark in every age.", "Thrallmaker: The first mercy is surrender.", "Elias: Then I am still cruel enough to refuse."] },
    { id: "deep-currents", playableName: "Elias Varen", opponentName: "Nulth, the Hollow Voice", title: "The Deep Currents", story: "Mountains become oceans, maps contradict themselves, and Nulth asks questions that make survival feel like an argument.", dialogue: ["Nulth: If pain could end, who would defend the wound?", "Elias: People are not wounds.", "Nulth: Then why do they spend their lives closing?"] },
    { id: "the-enlightened", playableName: "Elias Varen", opponentName: "Arel Voss, Enlightened Conduit", title: "The Enlightened", story: "A hidden settlement worships the XenDra willingly, not from fear, but from the belief that the Deep Currents ended suffering.", dialogue: ["Arel Voss: You still believe they are taking people.", "Elias: I have seen what they leave behind.", "Arel Voss: No. They are waiting."] },
    { id: "the-eclipse", playableName: "Elias Varen", opponentName: "Sovereign Krauth, Crown of Static", title: "The Eclipse", story: "Elias learns the terrible truth: every glyph investigated, every relic activated, and every Harbinger followed strengthened the ritual.", dialogue: ["Krauth: You did not uncover the door. You built it.", "Elias: I was trying to stop you.", "Krauth: Intent is a candle. Consequence is the sun."] },
    { id: "witness-oblivion", playableName: "Elias Varen", opponentName: "The Last Defenders of Reath", title: "Witness Oblivion", story: "Reality breaks into floating cities and watching stars. Elias becomes the final conduit, still believing he is saving everyone.", dialogue: ["Defender: Elias, step away from the sky.", "Elias: I found peace for us.", "Narrator: The Sovereign extended one silent hand, and Elias smiled."] }
  ]
};

const RUMIN_CAMPAIGN_ART = Object.freeze({
  "brothers-of-destiny": "/assets/gauntlet/campaigns/rumin/01-brothers-of-destiny.webp",
  "the-republic": "/assets/gauntlet/campaigns/rumin/02-the-republic.webp",
  "the-jewel": "/assets/gauntlet/campaigns/rumin/03-the-jewel.webp",
  "gaulic-wars": "/assets/gauntlet/campaigns/rumin/04-gaulic-wars.webp",
  "three-runes": "/assets/gauntlet/campaigns/rumin/05-three-runes.webp",
  "first-empire-bank": "/assets/gauntlet/campaigns/rumin/06-first-empire-bank.webp",
  "the-crossing": "/assets/gauntlet/campaigns/rumin/07-the-crossing.webp",
  "last-republic": "/assets/gauntlet/campaigns/rumin/08-last-republic.webp",
  "emperor-of-gold": "/assets/gauntlet/campaigns/rumin/09-emperor-of-gold.webp",
  "ides-of-rumie": "/assets/gauntlet/campaigns/rumin/10-ides-of-rumie.webp",
  "war-of-successors": "/assets/gauntlet/campaigns/rumin/11-war-of-successors.webp",
  "first-emperor": "/assets/gauntlet/campaigns/rumin/12-first-emperor.webp"
});

const BIZI_CAMPAIGN_ART = Object.freeze({
  "kharons-vision": "/assets/gauntlet/campaigns/bizi/01-kharons-vision.webp",
  "first-titan": "/assets/gauntlet/campaigns/bizi/02-first-titan.webp",
  "golden-empire": "/assets/gauntlet/campaigns/bizi/03-golden-empire.webp",
  "riot-of-sparks": "/assets/gauntlet/campaigns/bizi/04-riot-of-sparks.webp",
  "last-victories": "/assets/gauntlet/campaigns/bizi/05-last-victories.webp",
  "age-of-focus": "/assets/gauntlet/campaigns/bizi/06-age-of-focus.webp",
  "great-invasion": "/assets/gauntlet/campaigns/bizi/07-great-invasion.webp",
  "heras-counterattack": "/assets/gauntlet/campaigns/bizi/08-heras-counterattack.webp",
  "three-titans": "/assets/gauntlet/campaigns/bizi/09-three-titans.webp",
  "the-schism": "/assets/gauntlet/campaigns/bizi/10-the-schism.webp",
  "the-restoration": "/assets/gauntlet/campaigns/bizi/11-the-restoration.webp",
  "last-gear": "/assets/gauntlet/campaigns/bizi/12-last-gear.webp"
});

for (const chapter of campaignChapters.rumin) {
  chapter.image = RUMIN_CAMPAIGN_ART[chapter.id];
}

for (const chapter of campaignChapters.bizi) {
  chapter.image = BIZI_CAMPAIGN_ART[chapter.id];
}

const CAMPAIGN_NARRATION = {
  "brothers-of-destiny": {
    beforeBattle: "Before Rumie was an empire, it was an argument between two brothers.",
    afterBattle: "Rolmus wins the first battle for Rumie's soul, but Remex's warning does not die."
  },
  "the-republic": {
    beforeBattle: "Generations later, Rumie calls itself a republic, but gold has begun to vote louder than citizens.",
    afterBattle: "The Republic survives, but its sickness has been named aloud."
  },
  "the-jewel": {
    beforeBattle: "Kaiser rises as a soldier of the people, paying debts the Senate pretends not to see.",
    afterBattle: "Severan falls, and Kaiser becomes the Jewel of Rumie."
  },
  "gaulic-wars": {
    beforeBattle: "The northern frontier burns, and Kaiser marches toward the war that will make his name too large for the Senate.",
    afterBattle: "The frontier opens, and Kaiser returns with veterans, wealth, and a legend the Senate cannot easily command."
  },
  "three-runes": {
    beforeBattle: "Beneath conquered lands, Kaiser finds vaults older than Rumie itself.",
    afterBattle: "The runes answer Kaiser, and Rumie's legions become more than soldiers."
  },
  "first-empire-bank": {
    beforeBattle: "Kaiser turns from conquest to reform, but money resists command as fiercely as armies do.",
    afterBattle: "The markets hold, and the people begin trusting Kaiser more than the Republic itself."
  },
  "the-crossing": {
    beforeBattle: "The Senate orders Kaiser to surrender command. Between law and loyalty, Rumie holds its breath.",
    afterBattle: "Kaiser crosses the line, and the Republic becomes a battlefield."
  },
  "last-republic": {
    beforeBattle: "The old order makes its final stand, and Brutus faces the man he once hoped would save it.",
    afterBattle: "The Republic still speaks, but it no longer rules."
  },
  "emperor-of-gold": {
    beforeBattle: "Rumie prospers beneath Kaiser, but gold can gild a cage as easily as a crown.",
    afterBattle: "Kaiser reaches the height of power, and Rumie begins to wonder whether rescue has become rule."
  },
  "ides-of-rumie": {
    beforeBattle: "The conspiracy reaches the Senate floor, where gratitude, fear, and betrayal wear the same robes.",
    afterBattle: "Kaiser falls, but the empire does not. His killers destroy the man and preserve the myth."
  },
  "war-of-successors": {
    beforeBattle: "Kaiser's death leaves Rumie with grief, ambition, and armies looking for a name to follow.",
    afterBattle: "Brutus loses the future, and the Republic becomes a memory carried by the empire that replaces it."
  },
  "first-emperor": {
    beforeBattle: "Augustus and Bobei clash over Kaiser's legacy: vengeance or settlement, sword or law.",
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
  },
  "longest-night": {
    beforeBattle: "An eclipse opens over Reath like a beautiful mistake. Elias Varen records the weather, the ruins, and the sudden silence, then notices the impossible: the stars are moving in daylight.",
    afterBattle: "The terrified villager falls quiet. Elias survives his first fight, but the warning remains: do not look at the sky."
  },
  "silent-village": {
    beforeBattle: "Elias follows the eclipse road to a village that smiles too carefully. The people are healthy, polite, and synchronized in ways no living town should be.",
    afterBattle: "The Elder's calm breaks, revealing the first Thrall beneath the human mask. Elias leaves with a map that no longer matches the road behind him."
  },
  "dreams-that-remember": {
    beforeBattle: "Sleep becomes a second battlefield. Elias hears yesterday's words repeated by Syllith, the Echoing Child, but each memory returns altered by a single poisonous detail.",
    afterBattle: "Elias escapes the dream without defeating it. Syllith remains somewhere behind his thoughts, patiently editing the shape of what he remembers."
  },
  "beneath-observatory": {
    beforeBattle: "Ancient observatories beneath Reath show the same eclipse carved in incompatible civilizations. Before Rumin stone, Sheen ink, or Bizi brass, someone drew the XenDra glyph.",
    afterBattle: "The Thrallmaker dies or perhaps only changes shape. Elias now knows the eclipse is not an event, but a recurrence."
  },
  "deep-currents": {
    beforeBattle: "Reality begins to buckle. Mountains remember being oceans, maps contradict themselves, and Nulth asks questions designed to survive longer than answers.",
    afterBattle: "There is no corpse, no trophy, and no proof that Elias won. Only the terrible feeling that Nulth allowed the conversation to end."
  },
  "the-enlightened": {
    beforeBattle: "A hidden settlement welcomes Elias with peace instead of panic. Arel Voss claims the XenDra do not steal minds; they wait for exhausted souls to stop defending loneliness.",
    afterBattle: "Arel falls back smiling, not beaten so much as confirmed. Elias begins to wonder whether terror and mercy can wear the same face."
  },
  "the-eclipse": {
    beforeBattle: "The pattern closes. Every ruin Elias entered, every glyph he activated, and every Harbinger he followed has strengthened the connection he meant to sever.",
    afterBattle: "Krauth, the Crown of Static, is driven away, but the ritual is complete. Elias did not uncover the door. He built it."
  },
  "witness-oblivion": {
    beforeBattle: "Cities drift apart beneath a sky full of watching stars. The last defenders of Reath raise weapons against Elias, who still believes he is bringing peace.",
    afterBattle: "The eclipse returns exactly as it began. A tall, faceless Sovereign extends one silent hand. Elias smiles, takes it, and somewhere far away another child asks why stars are out during the day."
  }
};

const CAMPAIGN_METADATA = {
  rumin: { commanderName: "The Jewel of Rumie", pitch: "Follow Rumie from founding myth to republic, Kaiser, civil war, assassination, and imperial legacy.", coverImage: RUMIN_CAMPAIGN_ART["first-empire-bank"] },
  sheen: { commanderName: "The Rise and Trials of the Sheen", pitch: "Guide the Sheen from rebellion and living-city prosperity through reform, civil war, and renewal." },
  frumo: { commanderName: "The Last Tide", pitch: "Fight through taxation, revolution, terror, Polea's rise, empire, disaster, and the uneasy restoration of the Council." },
  bizi: { commanderName: "The Gears of Eternity", pitch: "Endure impossible odds through invention, faith, schism, restoration, and the final defense of Constanti.", coverImage: BIZI_CAMPAIGN_ART["golden-empire"] },
  xendra: { commanderName: "The Deep Currents", pitch: "Follow Elias Varen through an eclipse mystery that becomes first contact, psychological horror, and a tragic ritual." }
};

const CAMPAIGN_CHARACTER_DESCRIPTIONS = {
  sheen: {
    narrator: {
      name: "Sheen Narrator",
      role: "Mythic campaign narrator",
      description: "A calm, reflective voice that treats the Sheen story like a forest history told after many generations. The narrator should feel wise rather than dramatic, carrying both wonder and grief as the campaign moves from rebellion to renewal."
    },
    leafenGao: {
      name: "Leafen Gao",
      role: "Founder-rebel of Beli",
      description: "Leafen Gao begins as a gentle revolutionary who refuses to let hunger become normal. He is patient, soft-spoken, and deeply rooted in compassion, but his calm hides extraordinary resolve. In the early campaign he gives the Sheen their moral center: resistance is justified only if it grows into shelter, food, and a livable kingdom."
    },
    emperorBlackthorn: {
      name: "Emperor Blackthorn",
      role: "Obsidian tyrant",
      description: "Blackthorn is the ruler of the Obsidian Lords, an imperial figure who believes extraction, fear, and hierarchy are the only forces strong enough to keep the forest from chaos. He should feel cold, old, and immovable, like iron grown through living roots. He is not frantic; he is certain."
    },
    hushan: {
      name: "Hushan",
      role: "Disciplined rebel commander",
      description: "Hushan gives Leafen's uprising structure. Where Leafen inspires, Hushan organizes, protects, and makes hard battlefield decisions. He should sound grounded and dependable, with a soldier's economy of words and a guardian's concern for the villages under his care."
    },
    ironbark: {
      name: "Ironbark",
      role: "Thorn Guard enforcer",
      description: "Ironbark represents Blackthorn's military order: blunt, punitive, and contemptuous of rebellion. He is less philosophical than Blackthorn and more immediately threatening, the kind of commander who believes burning one valley can keep ten obedient."
    },
    leshan: {
      name: "Leshan",
      role: "Strategist of the Obsidian rebellion",
      description: "Leshan is a quiet tactical mind who sees systems beneath symbols. She understands that defeating Blackthorn requires attacking the hidden machinery of power, not merely winning battles. Her voice should be precise, restrained, and quietly brave."
    },
    reane: {
      name: "Reane",
      role: "Healer and civic philosopher",
      description: "Reane embodies Sheen care at its most mature. She is a healer, builder, and moral critic who understands that homes, laws, and traditions must be grown with attention. Her warmth should never sound weak; she is often the character who sees the wound before the warriors do."
    },
    greatBlight: {
      name: "The Great Blight",
      role: "Ancient hunger in the soil",
      description: "The Great Blight is less a villain than a living pressure: disease, scarcity, and decay given voice. It should sound slow, patient, and unsettling, as if it has watched forests rise and rot many times before. It opposes the Sheen by making survival itself uncertain."
    },
    dowan: {
      name: "Dowan",
      role: "Root Network architect",
      description: "Dowan is an engineer-scientist of living systems, responsible for turning Sheen ideals into infrastructure. He is curious, careful, and humane, but the civil war forces him to face how any network can be captured or weaponized. His voice should be thoughtful, analytical, and quietly burdened."
    },
    barkXin: {
      name: "Bark Xin",
      role: "Practical defender of the network",
      description: "Bark Xin is a field guardian who tests Dowan's ideas against danger. He is cautious without being cowardly, practical without being cynical, and often asks the question that keeps invention from becoming fantasy."
    },
    ashSerpent: {
      name: "The Ash Serpent",
      role: "Destroyer of the Root Network",
      description: "The Ash Serpent is wildfire with intent. It should feel dry, hissing, and predatory, a force that mocks the Sheen belief that every system can bend and survive. Its purpose is to test whether the Root Network is truly resilient."
    },
    droughtKing: {
      name: "The Drought King",
      role: "Border warlord of scarcity",
      description: "The Drought King is a severe ruler shaped by barren lands. He sees mercy as softness and abundance as something to seize before it disappears. His voice should be proud, harsh, and sun-baked, but not foolish; he is what survival looks like without compassion."
    },
    den: {
      name: "Den",
      role: "Guardian of court stability",
      description: "Den is a courtly stabilizer who understands that peace creates its own dangers. He is diplomatic, suspicious, and careful with power. He should sound controlled and observant, like someone pruning corruption before it becomes visible from the road."
    },
    hollowvine: {
      name: "Minister Hollowvine",
      role: "Court manipulator",
      description: "Hollowvine is rot with manners. He believes corruption is not a failure of politics but one of its natural nutrients. His voice should be smooth, patient, and poisonous, the kind of person who makes decay sound practical."
    },
    tang: {
      name: "Tang",
      role: "Reformer turned thorn-crowned ruler",
      description: "Tang begins with real compassion for the poor and real anger at stagnant elites. His tragedy is that he increasingly treats opposition as sabotage and delay as cruelty. He should start earnest and wounded, then become sharper, more commanding, and more isolated as reform hardens into control."
    },
    goldroot: {
      name: "Lord Goldroot",
      role: "Aristocrat of inherited shelter",
      description: "Goldroot is the voice of comfortable tradition. He does not think of himself as evil; he thinks order belongs to those who already own it. His voice should be entitled, polished, and dismissive, with flashes of fear when Tang proves popular."
    },
    ringan: {
      name: "Ringan",
      role: "Former ally and principled dissenter",
      description: "Ringan once believed in Tang's reforms, which makes his opposition personal and painful. He represents the line between justice and control. His voice should carry grief, frustration, and courage rather than simple hostility."
    },
    ashroot: {
      name: "Ashroot",
      role: "Thornblade general",
      description: "Ashroot is the military face of Tang's hardened reforms. He sees roads, shelters, and networks as strategic assets first and civic promises second. His voice should be severe and efficient."
    },
    briarfang: {
      name: "Briarfang",
      role: "Thornblade general",
      description: "Briarfang is a sharper, more mocking Thornblade commander who understands the moral leverage of necessity. He should sound like someone who knows cutting supply lines will hurt civilians and uses that fact as a weapon."
    },
    greatRenewal: {
      name: "The Great Renewal",
      role: "Spirit of postwar restoration",
      description: "The Great Renewal is the sacred pressure of regrowth after catastrophe. It is not sentimental; it asks what deserves to remain and what must be transformed. The voice should feel ancient, green, and impersonal, like a forest speaking in seasons."
    }
  }
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

function getGameplayCardById(gameplayCardId) {
  return COLLECTION_CARDS.find((card) => card.gameplayCardId === gameplayCardId) || null;
}

function getCollectorVariantById(variantId) {
  return COLLECTOR_VARIANTS.find((variant) => variant.variantId === variantId) || null;
}

function validateCollectorVariant(variant, gameplayCards = COLLECTION_CARDS) {
  if (!variant || typeof variant !== "object") throw new Error("Invalid collector variant: a variant object is required.");
  requireText(variant.variantId, "collectorVariants.variantId");
  requireText(variant.gameplayCardId, `collectorVariants.${variant.variantId}.gameplayCardId`);
  if (!gameplayCards.some((card) => card.gameplayCardId === variant.gameplayCardId)) {
    throw new Error(`Invalid collector variant: ${variant.variantId} references unknown gameplay content ${variant.gameplayCardId}.`);
  }
  for (const field of COLLECTOR_VARIANT_MECHANICAL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(variant, field)) {
      throw new Error(`Invalid collector variant: ${variant.variantId} cannot override mechanical field ${field}.`);
    }
  }
  requireText(variant.edition, `collectorVariants.${variant.variantId}.edition`);
  requireText(variant.finish, `collectorVariants.${variant.variantId}.finish`);
  requireText(variant.frame, `collectorVariants.${variant.variantId}.frame`);
  requireText(variant.acquisition, `collectorVariants.${variant.variantId}.acquisition`);
  return true;
}

function validateGameContent() {
  requireText(RULES_VERSION, "rulesVersion");
  requireText(CONTENT_VERSION, "contentVersion");
  const factionIds = Object.keys(factionsData);
  const playableFactionIds = factionIds.filter((factionId) => !factionsData[factionId].campaignOnly);
  if (playableFactionIds.length !== 4) throw new Error("Invalid game content: expected four playable factions.");
  for (const factionId of factionIds) {
    const faction = factionsData[factionId];
    if (faction.id !== factionId) throw new Error(`Invalid game content: faction key ${factionId} does not match its ID.`);
    requireText(faction.name, `factions.${factionId}.name`);
    for (const role of ["commander", "general", "city"]) {
      requireText(faction[role]?.name, `factions.${factionId}.${role}.name`);
      requireText(faction[role]?.text, `factions.${factionId}.${role}.text`);
    }
    const chapters = campaignChapters[factionId];
    if (!Array.isArray(chapters) || (faction.campaignOnly ? chapters.length === 0 : chapters.length !== 12)) {
      throw new Error(`Invalid game content: faction ${factionId} has an invalid campaign chapter count.`);
    }
  }

  const chapterIds = new Set();
  for (const [factionId, chapters] of Object.entries(campaignChapters)) {
    if (!factionsData[factionId]) throw new Error(`Invalid game content: unknown campaign faction ${factionId}.`);
    for (const chapter of chapters) {
      requireText(chapter.id, `campaigns.${factionId}.id`);
      requireText(chapter.title, `campaigns.${factionId}.${chapter.id}.title`);
      requireText(chapter.story, `campaigns.${factionId}.${chapter.id}.story`);
      if (factionId === "rumin") requireText(chapter.image, `campaigns.${factionId}.${chapter.id}.image`);
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
    if (card.gameplayCardId !== card.id) throw new Error(`Invalid game content: card ${card.id} has an unstable gameplay identity.`);
    if (card.freeAcquisition !== FREE_GAMEPLAY_ACQUISITION) {
      throw new Error(`Invalid game content: competitive card ${card.id} must have a non-paid acquisition path.`);
    }
    cardIds.add(card.id);
  }

  const variantIds = new Set();
  for (const variant of COLLECTOR_VARIANTS) {
    validateCollectorVariant(variant);
    if (variantIds.has(variant.variantId)) throw new Error(`Invalid game content: duplicate collector variant ${variant.variantId}.`);
    if (variant.paid && variant.acquisition !== PAID_COLLECTOR_ACQUISITION) {
      throw new Error(`Invalid game content: paid variant ${variant.variantId} has invalid acquisition semantics.`);
    }
    variantIds.add(variant.variantId);
  }
  for (const card of COLLECTION_CARDS) {
    const defaultVariant = getCollectorVariantById(card.defaultVariantId);
    if (!defaultVariant || defaultVariant.gameplayCardId !== card.gameplayCardId || defaultVariant.paid) {
      throw new Error(`Invalid game content: card ${card.id} is missing its free default presentation.`);
    }
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
      coverImage: CAMPAIGN_METADATA[factionId].coverImage || null,
      characters: CAMPAIGN_CHARACTER_DESCRIPTIONS[factionId] || {},
      chapters: chapters.map((chapter) => ({ ...chapter, ...(CAMPAIGN_NARRATION[chapter.id] || {}) }))
    }
  ]));
  return {
    schemaVersion: 2,
    rulesVersion: RULES_VERSION,
    contentVersion: CONTENT_VERSION,
    factions: listFactions(),
    campaigns,
    cards: COLLECTION_CARDS,
    collectorVariants: COLLECTOR_VARIANTS,
    deckRules: DECK_RULES
  };
}

validateGameContent();

module.exports = {
  BASE_PLAYING_DECK_SIZE,
  BIZI_COLLECTION_CARDS,
  BIZI_CAMPAIGN_ART,
  CAMPAIGN_CHARACTER_DESCRIPTIONS,
  CAMPAIGN_NARRATION,
  COLLECTOR_VARIANT_MECHANICAL_FIELDS,
  COLLECTOR_VARIANT_SCHEMA_VERSION,
  COLLECTOR_VARIANTS,
  COLLECTION_CARDS,
  CONTENT_VERSION,
  DECK_RULES,
  DRAFT_CARD_SUITS,
  FREE_GAMEPLAY_ACQUISITION,
  FRUMO_COLLECTION_CARDS,
  MAX_CONSTRUCTED_ADDITIONS,
  MAX_CONSTRUCTED_DECK_SIZE,
  MAX_CONSTRUCTED_REPLACEMENTS,
  MAX_REPLACEMENTS_PER_VALUE,
  PLAYING_DECK_VALUES,
  PAID_COLLECTOR_ACQUISITION,
  RUMIN_CAMPAIGN_ART,
  RUMIN_COLLECTION_CARDS,
  RULES_VERSION,
  SHEEN_COLLECTION_CARDS,
  campaignChapters,
  factionsData,
  getCollectorVariantById,
  getFactionById,
  getGameplayCardById,
  getPublicGameContent,
  listFactions,
  validateCollectorVariant,
  validateGameContent
};
