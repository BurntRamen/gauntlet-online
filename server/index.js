const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const CLIENT_URLS = (process.env.CLIENT_URLS || "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = [
  CLIENT_URL,
  "http://localhost:3000",
  "https://gauntlet-online.vercel.app",
  ...CLIENT_URLS
];
const ACCOUNT_DATA_FILE = process.env.ACCOUNT_DATA_FILE || `${__dirname}/accounts.json`;
const FACTION_STATS_DATA_FILE = process.env.FACTION_STATS_DATA_FILE || `${__dirname}/faction-stats.json`;
const ACCOUNT_AUTH_SECRET = process.env.ACCOUNT_AUTH_SECRET || "dev-gauntlet-auth-secret-change-me";
const OWNER_STATS_TOKEN = process.env.OWNER_STATS_TOKEN || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cors = require("cors");
const { Server } = require("socket.io");

function isAllowedOrigin(origin) {
  return !origin || ALLOWED_ORIGINS.includes(origin);
}

const corsOptions = {
  origin(origin, callback) {
    callback(isAllowedOrigin(origin) ? null : new Error("Not allowed by CORS"), isAllowedOrigin(origin));
  },
  methods: ["GET", "POST", "DELETE", "PATCH"],
  credentials: true
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST", "DELETE", "PATCH"],
    credentials: true
  }
});

app.use(cors(corsOptions));
app.use(express.json({ limit: "20kb" }));

app.get("/", (_req, res) => {
  res.send("Gauntlet server is running.");
});

app.get("/api/storage-status", (_req, res) => {
  res.json({
    accountStorage: SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? "supabase-configured" : "local-json",
    supabaseConfigured: !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  });
});

// ============ ACCOUNT AUTH ============
function loadAccountStore() {
  try {
    if (!fs.existsSync(ACCOUNT_DATA_FILE)) return { accounts: [] };
    const parsed = JSON.parse(fs.readFileSync(ACCOUNT_DATA_FILE, "utf8"));
    return { accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [] };
  } catch (error) {
    console.error("[Accounts] Failed to load account store", error);
    return { accounts: [] };
  }
}

function saveAccountStore(store) {
  fs.mkdirSync(path.dirname(ACCOUNT_DATA_FILE), { recursive: true });
  fs.writeFileSync(ACCOUNT_DATA_FILE, JSON.stringify(store, null, 2));
}

function emptyFactionStatsStore() {
  return {
    factions: {},
    matchups: {},
    totalGames: 0,
    updatedAt: null
  };
}

function loadLocalFactionStatsStore() {
  try {
    if (!fs.existsSync(FACTION_STATS_DATA_FILE)) return emptyFactionStatsStore();
    const parsed = JSON.parse(fs.readFileSync(FACTION_STATS_DATA_FILE, "utf8"));
    return {
      ...emptyFactionStatsStore(),
      ...parsed,
      factions: parsed.factions || {},
      matchups: parsed.matchups || {}
    };
  } catch (error) {
    console.error("[FactionStats] Failed to load local faction stats", error);
    return emptyFactionStatsStore();
  }
}

function saveLocalFactionStatsStore(store) {
  fs.mkdirSync(path.dirname(FACTION_STATS_DATA_FILE), { recursive: true });
  fs.writeFileSync(FACTION_STATS_DATA_FILE, JSON.stringify(store, null, 2));
}

function normalizeAccountName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function accountNameKey(name) {
  return normalizeAccountName(name).toLowerCase();
}

function isValidAccountName(name) {
  return /^[A-Za-z0-9 _-]{3,24}$/.test(name);
}

function normalizeGuestName(name) {
  return normalizeAccountName(name || "Guest");
}

function isValidGuestName(name) {
  return /^[A-Za-z0-9 _-]{2,24}$/.test(name);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 150000, 32, "sha256").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, account) {
  const candidate = hashPassword(password, account.passwordSalt);
  return crypto.timingSafeEqual(Buffer.from(candidate.hash, "hex"), Buffer.from(account.passwordHash, "hex"));
}

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function signAuthPayload(payload) {
  const body = base64Url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", ACCOUNT_AUTH_SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyAuthToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", ACCOUNT_AUTH_SECRET).update(body).digest("base64url");
  const signatureBuffer = Buffer.from(signature || "");
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.id || !payload.name) return null;
    return payload;
  } catch (_error) {
    return null;
  }
}

const PROGRESSION_COSMETICS = {
  titles: {
    recruit: { id: "recruit", name: "Recruit", requirement: "Create an account." },
    firstVictor: { id: "firstVictor", name: "First Victor", requirement: "Win your first game." },
    campaigner: { id: "campaigner", name: "Campaigner", requirement: "Clear a campaign chapter." },
    ruminChampion: { id: "ruminChampion", name: "Rumin Champion", requirement: "Win with Rumin." },
    sheenChampion: { id: "sheenChampion", name: "Sheen Champion", requirement: "Win with Sheen." },
    frumoChampion: { id: "frumoChampion", name: "Frumo Champion", requirement: "Win with Frumo." },
    biziChampion: { id: "biziChampion", name: "Bizi Champion", requirement: "Win with Bizi." }
  },
  cardBacks: {
    classic: { id: "classic", name: "Classic Gauntlet", requirement: "Default card back." },
    victorGold: { id: "victorGold", name: "Victor Gold", requirement: "Win your first game." },
    campaignMap: { id: "campaignMap", name: "Campaign Map", requirement: "Clear a campaign chapter." }
  },
  factionBadges: {
    none: { id: "none", name: "No Badge", requirement: "Default." },
    rumin: { id: "rumin", name: "Rumin Laurel", requirement: "Win with Rumin." },
    sheen: { id: "sheen", name: "Sheen Root", requirement: "Win with Sheen." },
    frumo: { id: "frumo", name: "Frumo Tide", requirement: "Win with Frumo." },
    bizi: { id: "bizi", name: "Bizi Gear", requirement: "Win with Bizi." }
  }
};

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
    text: "The first time you overpay for this each turn, gain 1 life."
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
    text: "Arm from lane: attach to a hand attacker or blocker. It gets +3 value this combat, then discard this."
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
    text: "Arm from lane: attach to a hand attacker. It gets +5 value this combat, or +7 if it is your fourth attack this turn."
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
    text: "The next card you block with this turn gets +1 value."
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
    text: "When paid for an ability, this pays +1 value if you control an empty lane."
  },
  {
    id: "frumo-coral-hull-guard",
    factionId: "frumo",
    name: "Coral-Hull Guard",
    type: "unit",
    rarity: "common",
    value: 5,
    text: "When this blocks from a lane, you may switch it with another lane card you control after combat."
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
    text: "Move one lane card you control. If it moves into an empty lane, it gets +1 value this turn."
  },
  {
    id: "frumo-captains-bad-wager",
    factionId: "frumo",
    name: "Captain's Bad Wager",
    type: "tactic",
    rarity: "rare",
    value: 7,
    text: "Choose a lane. If its face-down card has even value, it gets +3 value this turn. Otherwise, draw then discard."
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
    text: "When this enters a lane, you may switch any two lane cards you control. Each moved card gets +1 value this turn."
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
    text: "A same-suit payment card pays +1 value for your next Bizi card this turn."
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
    text: "The first same-suit payment card you use this turn pays +2 value instead of +1."
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
    text: "After you attack with a different suit from your previous attack, one payment card may pay +2 value."
  },
  {
    id: "bizi-focus-prime-signal",
    factionId: "bizi",
    name: "Focus Prime Signal",
    type: "tactic",
    rarity: "mythic",
    value: 9,
    text: "Gain 2 acceleration counters. Your next card this turn gets +1 value for each counter you have."
  },
  {
    id: "bizi-constanti-sunforge",
    factionId: "bizi",
    name: "Constanti Sunforge",
    type: "unit",
    rarity: "mythic",
    value: 10,
    text: "When this attacks, remove any number of acceleration counters. It gets +2 value for each counter removed."
  }
];

const COLLECTION_CARDS = [...RUMIN_COLLECTION_CARDS, ...SHEEN_COLLECTION_CARDS, ...FRUMO_COLLECTION_CARDS, ...BIZI_COLLECTION_CARDS];

const BOOSTER_PRODUCTS = {
  "rumin-foundation": {
    id: "rumin-foundation",
    name: "Rumin Foundation Pack",
    factionId: "rumin",
    cardCount: 8,
    slots: ["common", "common", "common", "common", "uncommon", "uncommon", "rare", "wild"],
    description: "Contains 4 commons, 2 uncommons, 1 rare, and 1 wild slot. The wild slot is usually rare and can upgrade to mythic."
  },
  "sheen-foundation": {
    id: "sheen-foundation",
    name: "Sheen Foundation Pack",
    factionId: "sheen",
    cardCount: 8,
    slots: ["common", "common", "common", "common", "uncommon", "uncommon", "rare", "wild"],
    description: "Contains 4 commons, 2 uncommons, 1 rare, and 1 wild slot. The wild slot is usually rare and can upgrade to mythic."
  },
  "frumo-foundation": {
    id: "frumo-foundation",
    name: "Frumo Foundation Pack",
    factionId: "frumo",
    cardCount: 8,
    slots: ["common", "common", "common", "common", "uncommon", "uncommon", "rare", "wild"],
    description: "Contains 4 commons, 2 uncommons, 1 rare, and 1 wild slot. The wild slot is usually rare and can upgrade to mythic."
  },
  "bizi-foundation": {
    id: "bizi-foundation",
    name: "Bizi Foundation Pack",
    factionId: "bizi",
    cardCount: 8,
    slots: ["common", "common", "common", "common", "uncommon", "uncommon", "rare", "wild"],
    description: "Contains 4 commons, 2 uncommons, 1 rare, and 1 wild slot. The wild slot is usually rare and can upgrade to mythic."
  }
};

function emptyProgression() {
  return {
    achievements: {},
    campaign: {},
    matchHistory: [],
    cosmetics: {
      unlockedTitles: ["recruit"],
      unlockedCardBacks: ["classic"],
      unlockedFactionBadges: ["none"],
      selectedTitle: "recruit",
      selectedCardBack: "classic",
      selectedFactionBadge: "none"
    }
  };
}

function emptyCollection() {
  return {
    cards: {},
    openedPacks: 0,
    lastPack: null
  };
}

function normalizeCollection(stats = {}) {
  const base = emptyCollection();
  const collection = stats.collection || {};
  return {
    cards: { ...base.cards, ...(collection.cards || {}) },
    openedPacks: Number(collection.openedPacks || 0),
    lastPack: collection.lastPack || null
  };
}

function collectionSummary(stats = {}) {
  return {
    ...normalizeCollection(stats),
    catalog: {
      rumin: RUMIN_COLLECTION_CARDS,
      sheen: SHEEN_COLLECTION_CARDS,
      frumo: FRUMO_COLLECTION_CARDS,
      bizi: BIZI_COLLECTION_CARDS
    },
    boosters: BOOSTER_PRODUCTS
  };
}

function normalizeProgression(stats = {}) {
  const base = emptyProgression();
  const progression = stats.progression || {};
  return {
    achievements: { ...base.achievements, ...(progression.achievements || {}) },
    campaign: { ...base.campaign, ...(progression.campaign || {}) },
    matchHistory: Array.isArray(progression.matchHistory) ? progression.matchHistory.slice(0, 30) : [],
    cosmetics: {
      ...base.cosmetics,
      ...(progression.cosmetics || {}),
      unlockedTitles: [...new Set([...(base.cosmetics.unlockedTitles || []), ...((progression.cosmetics || {}).unlockedTitles || [])])],
      unlockedCardBacks: [...new Set([...(base.cosmetics.unlockedCardBacks || []), ...((progression.cosmetics || {}).unlockedCardBacks || [])])],
      unlockedFactionBadges: [...new Set([...(base.cosmetics.unlockedFactionBadges || []), ...((progression.cosmetics || {}).unlockedFactionBadges || [])])]
    }
  };
}

function progressionSummary(stats = {}) {
  const progression = normalizeProgression(stats);
  return {
    ...progression,
    definitions: PROGRESSION_COSMETICS
  };
}

function publicAccount(account) {
  return {
    id: account.id,
    name: account.name,
    createdAt: account.createdAt,
    lastLoginAt: account.lastLoginAt || null,
    stats: account.stats || {},
    progression: progressionSummary(account.stats || {}),
    collection: collectionSummary(account.stats || {})
  };
}

function publicFriend(account) {
  return {
    id: account.id,
    name: account.name,
    lastSeenAt: account.lastSeenAt || null
  };
}

function publicFriendMessage(message) {
  return {
    id: message.id,
    fromId: message.fromId,
    fromName: message.fromName,
    toId: message.toId,
    toName: message.toName,
    text: message.text,
    createdAt: message.createdAt
  };
}

function issueAccountSession(account) {
  return {
    token: signAuthPayload({ id: account.id, name: account.name }),
    account: publicAccount(account)
  };
}

function findAccountByName(store, name) {
  const key = accountNameKey(name);
  return store.accounts.find((account) => account.nameKey === key) || null;
}

function useSupabaseStore() {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

async function supabaseRequest(pathname, options = {}) {
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.error || `Supabase request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

async function loadFactionStatsStore() {
  if (!useSupabaseStore()) return loadLocalFactionStatsStore();
  const rows = await supabaseRequest("gauntlet_faction_stats?id=eq.global&select=data");
  return {
    ...emptyFactionStatsStore(),
    ...(rows?.[0]?.data || {})
  };
}

async function saveFactionStatsStore(store) {
  const nextStore = {
    ...emptyFactionStatsStore(),
    ...store,
    factions: store.factions || {},
    matchups: store.matchups || {},
    updatedAt: new Date().toISOString()
  };
  if (useSupabaseStore()) {
    await supabaseRequest("gauntlet_faction_stats?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify([{ id: "global", data: nextStore, updated_at: nextStore.updatedAt }])
    });
    return nextStore;
  }
  saveLocalFactionStatsStore(nextStore);
  return nextStore;
}

function accountFromSupabaseRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    nameKey: row.name_key,
    passwordSalt: row.password_salt,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    lastSeenAt: row.last_seen_at,
    stats: row.stats || {}
  };
}

async function findSupabaseAccountByName(name) {
  const rows = await supabaseRequest(`gauntlet_accounts?name_key=eq.${encodeURIComponent(accountNameKey(name))}&select=*`);
  return accountFromSupabaseRow(rows?.[0]);
}

async function findSupabaseAccountById(id) {
  if (!id) return null;
  const rows = await supabaseRequest(`gauntlet_accounts?id=eq.${encodeURIComponent(id)}&select=*`);
  return accountFromSupabaseRow(rows?.[0]);
}

async function patchSupabaseAccount(id, patch) {
  await supabaseRequest(`gauntlet_accounts?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch)
  });
}

async function getAccountFromToken(token) {
  const payload = verifyAuthToken(token);
  if (!payload) return null;
  if (useSupabaseStore()) return publicAccount(await findSupabaseAccountById(payload.id));

  const store = loadAccountStore();
  const account = store.accounts.find((entry) => entry.id === payload.id);
  if (!account) return null;
  return publicAccount(account);
}

async function getAccountRecordFromToken(token) {
  const payload = verifyAuthToken(token);
  if (!payload) return null;
  if (useSupabaseStore()) return findSupabaseAccountById(payload.id);

  const store = loadAccountStore();
  return store.accounts.find((entry) => entry.id === payload.id) || null;
}

async function requireAccountRecord(req, res) {
  const authHeader = req.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const payload = verifyAuthToken(token);
  if (!payload) {
    res.status(401).json({ error: "Not signed in." });
    return null;
  }

  if (useSupabaseStore()) {
    const account = await findSupabaseAccountById(payload.id);
    if (!account) {
      res.status(401).json({ error: "Not signed in." });
      return null;
    }
    return { source: "supabase", account };
  }

  const store = loadAccountStore();
  const account = store.accounts.find((entry) => entry.id === payload.id);
  if (!account) {
    res.status(401).json({ error: "Not signed in." });
    return null;
  }

  account.friends = Array.isArray(account.friends) ? account.friends : [];
  account.messages = Array.isArray(account.messages) ? account.messages : [];
  return { source: "local", store, account };
}

function getLocalFriendPayload(store, account) {
  const friendIds = new Set(Array.isArray(account.friends) ? account.friends : []);
  const friends = store.accounts
    .filter((entry) => friendIds.has(entry.id))
    .map(publicFriend)
    .sort((a, b) => a.name.localeCompare(b.name));
  const messages = (account.messages || [])
    .map(publicFriendMessage)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return { friends, messages };
}

async function getSupabaseFriendPayload(account) {
  const friendRows = await supabaseRequest(`gauntlet_friends?account_id=eq.${encodeURIComponent(account.id)}&select=friend_id`);
  const friendIds = friendRows.map((row) => row.friend_id);
  const friends = friendIds.length > 0
    ? (await supabaseRequest(`gauntlet_accounts?id=in.(${friendIds.join(",")})&select=id,name,last_seen_at`))
        .map(accountFromSupabaseRow)
        .map(publicFriend)
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const messageRows = await supabaseRequest(`gauntlet_friend_messages?or=(from_id.eq.${encodeURIComponent(account.id)},to_id.eq.${encodeURIComponent(account.id)})&select=*&order=created_at.asc`);
  const participantIds = [...new Set(messageRows.flatMap((message) => [message.from_id, message.to_id]))];
  const participantRows = participantIds.length > 0
    ? await supabaseRequest(`gauntlet_accounts?id=in.(${participantIds.join(",")})&select=id,name`)
    : [];
  const namesById = new Map(participantRows.map((row) => [row.id, row.name]));
  const messages = messageRows.map((message) => publicFriendMessage({
    id: message.id,
    fromId: message.from_id,
    fromName: namesById.get(message.from_id) || "Unknown",
    toId: message.to_id,
    toName: namesById.get(message.to_id) || "Unknown",
    text: message.text,
    createdAt: message.created_at
  }));

  return { friends, messages };
}

async function getFriendPayload(context) {
  if (context.source === "supabase") return getSupabaseFriendPayload(context.account);
  return getLocalFriendPayload(context.store, context.account);
}

async function touchAccountStats(accountId, field) {
  if (!accountId) return;
  if (useSupabaseStore()) {
    const account = await findSupabaseAccountById(accountId);
    if (!account) return;
    const stats = account.stats || {};
    stats[field] = (stats[field] || 0) + 1;
    await patchSupabaseAccount(accountId, { stats, last_seen_at: new Date().toISOString() });
    return;
  }

  const store = loadAccountStore();
  const account = store.accounts.find((entry) => entry.id === accountId);
  if (!account) return;
  account.stats = account.stats || {};
  account.stats[field] = (account.stats[field] || 0) + 1;
  account.lastSeenAt = new Date().toISOString();
  saveAccountStore(store);
}

function unlockProgressionItem(progression, bucket, id) {
  const key = bucket === "titles" ? "unlockedTitles" : bucket === "cardBacks" ? "unlockedCardBacks" : "unlockedFactionBadges";
  if (!progression.cosmetics[key].includes(id)) progression.cosmetics[key].push(id);
}

function awardAchievement(progression, id, name, description, unlockedAt) {
  if (progression.achievements[id]) return;
  progression.achievements[id] = { id, name, description, unlockedAt };
}

function applyProgressionForResult(stats, result, context = {}) {
  const now = context.completedAt || new Date().toISOString();
  const progression = normalizeProgression(stats);
  const factionId = context.factionId || "basic";
  const factionName = context.factionName || (factionId === "basic" ? "Basic" : factionId);
  const opponentName = context.opponentName || "Opponent";

  progression.matchHistory.unshift({
    id: crypto.randomUUID(),
    completedAt: now,
    result,
    mode: context.mode || "duel",
    factionId,
    factionName,
    opponentName,
    life: context.life ?? null,
    opponentLife: context.opponentLife ?? null,
    campaign: context.campaign ? {
      factionId: context.campaign.factionId,
      chapterId: context.campaign.chapterId,
      title: context.campaign.title
    } : null
  });
  progression.matchHistory = progression.matchHistory.slice(0, 30);

  if (result === "win") {
    awardAchievement(progression, "first-win", "First Win", "Win your first account game.", now);
    unlockProgressionItem(progression, "titles", "firstVictor");
    unlockProgressionItem(progression, "cardBacks", "victorGold");

    if (factionId && factionId !== "basic") {
      awardAchievement(progression, `win-${factionId}`, `${factionName} Victory`, `Win a game with ${factionName}.`, now);
      unlockProgressionItem(progression, "titles", `${factionId}Champion`);
      unlockProgressionItem(progression, "factionBadges", factionId);
    }

    if ((context.life ?? 1) <= 10) awardAchievement(progression, "comeback", "Comeback", "Win while ending at 10 life or less.", now);
    if ((context.life ?? 0) >= 42) awardAchievement(progression, "perfect-defense", "Perfect Defense", "Win without losing life.", now);
  }

  if (context.campaign && result === "win") {
    const campaignFaction = context.campaign.factionId;
    const completed = Array.isArray(progression.campaign[campaignFaction]) ? progression.campaign[campaignFaction] : [];
    if (!completed.includes(context.campaign.chapterId)) completed.push(context.campaign.chapterId);
    progression.campaign[campaignFaction] = completed;
    awardAchievement(progression, "first-campaign-clear", "Campaigner", "Clear a campaign chapter.", now);
    unlockProgressionItem(progression, "titles", "campaigner");
    unlockProgressionItem(progression, "cardBacks", "campaignMap");
  }

  stats.progression = progression;
}

async function recordAccountGameResult(accountId, result, context = {}) {
  if (!accountId || !["win", "loss", "draw"].includes(result)) return;
  if (useSupabaseStore()) {
    const account = await findSupabaseAccountById(accountId);
    if (!account) return;
    const stats = account.stats || {};
    stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;
    if (result === "win") stats.gamesWon = (stats.gamesWon || 0) + 1;
    if (result === "loss") stats.gamesLost = (stats.gamesLost || 0) + 1;
    if (result === "draw") stats.gamesDrawn = (stats.gamesDrawn || 0) + 1;
    if (context.ranked !== false) {
      stats.rankedGamesPlayed = (stats.rankedGamesPlayed || 0) + 1;
      if (result === "win") stats.rankedGamesWon = (stats.rankedGamesWon || 0) + 1;
      if (result === "loss") stats.rankedGamesLost = (stats.rankedGamesLost || 0) + 1;
      if (result === "draw") stats.rankedGamesDrawn = (stats.rankedGamesDrawn || 0) + 1;
    }
    applyProgressionForResult(stats, result, context);
    await patchSupabaseAccount(accountId, { stats, last_seen_at: new Date().toISOString() });
    return;
  }

  const store = loadAccountStore();
  const account = store.accounts.find((entry) => entry.id === accountId);
  if (!account) return;

  account.stats = account.stats || {};
  account.stats.gamesPlayed = (account.stats.gamesPlayed || 0) + 1;
  if (result === "win") account.stats.gamesWon = (account.stats.gamesWon || 0) + 1;
  if (result === "loss") account.stats.gamesLost = (account.stats.gamesLost || 0) + 1;
  if (result === "draw") account.stats.gamesDrawn = (account.stats.gamesDrawn || 0) + 1;
  if (context.ranked !== false) {
    account.stats.rankedGamesPlayed = (account.stats.rankedGamesPlayed || 0) + 1;
    if (result === "win") account.stats.rankedGamesWon = (account.stats.rankedGamesWon || 0) + 1;
    if (result === "loss") account.stats.rankedGamesLost = (account.stats.rankedGamesLost || 0) + 1;
    if (result === "draw") account.stats.rankedGamesDrawn = (account.stats.rankedGamesDrawn || 0) + 1;
  }
  applyProgressionForResult(account.stats, result, context);
  account.lastSeenAt = new Date().toISOString();
  saveAccountStore(store);
}

function getFactionStatsPlayerEntries(game) {
  return Object.keys(game.players || {})
    .map(Number)
    .sort((a, b) => a - b)
    .map((playerNum) => ({
      playerNum,
      factionId: game.players[playerNum]?.faction?.id,
      factionName: game.players[playerNum]?.faction?.name
    }))
    .filter((entry) => entry.factionId && entry.factionId !== "basic");
}

function ensureFactionStatsEntry(store, factionId, factionName) {
  if (!store.factions[factionId]) {
    store.factions[factionId] = {
      factionId,
      factionName: factionName || factionId,
      games: 0,
      wins: 0,
      losses: 0,
      draws: 0
    };
  }
  if (factionName) store.factions[factionId].factionName = factionName;
  return store.factions[factionId];
}

function ensureMatchupStatsEntry(store, factionA, factionB) {
  const sortedIds = [factionA.factionId, factionB.factionId].sort();
  const key = sortedIds.join("__");
  if (!store.matchups[key]) {
    store.matchups[key] = {
      key,
      factions: sortedIds,
      factionNames: {
        [factionA.factionId]: factionA.factionName || factionA.factionId,
        [factionB.factionId]: factionB.factionName || factionB.factionId
      },
      games: 0,
      wins: {},
      draws: 0
    };
  }
  store.matchups[key].factionNames[factionA.factionId] = factionA.factionName || factionA.factionId;
  store.matchups[key].factionNames[factionB.factionId] = factionB.factionName || factionB.factionId;
  return store.matchups[key];
}

function applyFactionGameResult(store, game) {
  const entries = getFactionStatsPlayerEntries(game);
  if (entries.length < 2) return false;

  store.totalGames = (store.totalGames || 0) + 1;
  const winningPlayerNum = game.winner == null ? null : game.winner;
  for (const entry of entries) {
    const stats = ensureFactionStatsEntry(store, entry.factionId, entry.factionName);
    stats.games += 1;
    if (!winningPlayerNum) stats.draws += 1;
    else if (entry.playerNum === winningPlayerNum) stats.wins += 1;
    else stats.losses += 1;
  }

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      if (entries[i].factionId === entries[j].factionId) continue;
      const matchup = ensureMatchupStatsEntry(store, entries[i], entries[j]);
      matchup.games += 1;
      if (!winningPlayerNum) {
        matchup.draws += 1;
      } else if (entries[i].playerNum === winningPlayerNum || entries[j].playerNum === winningPlayerNum) {
        const winningFactionId = game.players[winningPlayerNum]?.faction?.id;
        matchup.wins[winningFactionId] = (matchup.wins[winningFactionId] || 0) + 1;
      }
    }
  }

  return true;
}

async function recordFactionGameStats(game) {
  if (!game || game.gameMode === "basic") return;
  try {
    const store = await loadFactionStatsStore();
    if (applyFactionGameResult(store, game)) await saveFactionStatsStore(store);
  } catch (error) {
    console.error("[FactionStats] Failed to record faction stats", error);
  }
}

function getFactionStatsSummary(store) {
  const factionRows = Object.values(store.factions || {})
    .map((entry) => ({
      ...entry,
      winRate: entry.games > 0 ? Number(((entry.wins / entry.games) * 100).toFixed(2)) : 0
    }))
    .sort((a, b) => b.winRate - a.winRate || b.games - a.games || a.factionName.localeCompare(b.factionName));

  const matchupRows = Object.values(store.matchups || {})
    .map((entry) => {
      const [firstFactionId, secondFactionId] = entry.factions;
      const firstWins = entry.wins?.[firstFactionId] || 0;
      const secondWins = entry.wins?.[secondFactionId] || 0;
      return {
        key: entry.key,
        factions: entry.factions,
        factionNames: entry.factionNames || {},
        games: entry.games || 0,
        draws: entry.draws || 0,
        wins: entry.wins || {},
        firstFactionId,
        secondFactionId,
        firstWinRate: entry.games > 0 ? Number(((firstWins / entry.games) * 100).toFixed(2)) : 0,
        secondWinRate: entry.games > 0 ? Number(((secondWins / entry.games) * 100).toFixed(2)) : 0
      };
    })
    .sort((a, b) => b.games - a.games || a.key.localeCompare(b.key));

  return {
    totalGames: store.totalGames || 0,
    updatedAt: store.updatedAt || null,
    factions: factionRows,
    matchups: matchupRows
  };
}

function getAccountMatchProfile(account) {
  const hasRankedStats =
    (account.stats?.rankedGamesPlayed || 0) > 0 ||
    (account.stats?.rankedGamesWon || 0) > 0 ||
    (account.stats?.rankedGamesLost || 0) > 0 ||
    (account.stats?.rankedGamesDrawn || 0) > 0;
  const wins = hasRankedStats ? account.stats?.rankedGamesWon || 0 : account.stats?.gamesWon || 0;
  const losses = hasRankedStats ? account.stats?.rankedGamesLost || 0 : account.stats?.gamesLost || 0;
  const draws = hasRankedStats ? account.stats?.rankedGamesDrawn || 0 : account.stats?.gamesDrawn || 0;
  const decidedGames = wins + losses;
  const gamesPlayed = wins + losses + draws;
  const winRatio = decidedGames > 0 ? wins / decidedGames : 0.5;
  return { wins, losses, draws, gamesPlayed, winRatio };
}

function pickCollectionCard(factionId, rarity) {
  const cardPool = COLLECTION_CARDS.filter((card) => card.factionId === factionId && card.rarity === rarity);
  if (cardPool.length === 0) return null;
  return cardPool[crypto.randomInt(cardPool.length)];
}

function resolveBoosterSlot(slot) {
  if (slot !== "wild") return slot;
  return crypto.randomInt(100) < 20 ? "mythic" : "rare";
}

function openCollectionBooster(stats, packId) {
  const pack = BOOSTER_PRODUCTS[packId];
  if (!pack) throw new Error("Unknown booster pack.");

  const collection = normalizeCollection(stats);
  const openedCards = pack.slots
    .map((slot) => pickCollectionCard(pack.factionId, resolveBoosterSlot(slot)))
    .filter(Boolean);

  openedCards.forEach((card) => {
    collection.cards[card.id] = (collection.cards[card.id] || 0) + 1;
  });

  collection.openedPacks += 1;
  collection.lastPack = {
    packId,
    openedAt: new Date().toISOString(),
    cardIds: openedCards.map((card) => card.id)
  };
  stats.collection = collection;

  const progression = normalizeProgression(stats);
  awardAchievement(progression, "first-booster", "First Pack", "Open your first faction booster pack.", collection.lastPack.openedAt);
  stats.progression = progression;

  return openedCards;
}

app.post("/api/auth/register", async (req, res) => {
  const name = normalizeAccountName(req.body?.name);
  const password = String(req.body?.password || "");

  if (!isValidAccountName(name)) {
    res.status(400).json({ error: "Account name must be 3-24 characters using letters, numbers, spaces, hyphens, or underscores." });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const passwordResult = hashPassword(password);
  const now = new Date().toISOString();
  const account = {
    id: crypto.randomUUID(),
    name,
    nameKey: accountNameKey(name),
    passwordSalt: passwordResult.salt,
    passwordHash: passwordResult.hash,
    createdAt: now,
    lastLoginAt: now,
    lastSeenAt: now,
    friends: [],
    messages: [],
    stats: { gamesCreated: 0, gamesJoined: 0, gamesSpectated: 0, progression: emptyProgression(), collection: emptyCollection() }
  };

  try {
    if (useSupabaseStore()) {
      if (await findSupabaseAccountByName(name)) {
        res.status(409).json({ error: "That account name is already taken." });
        return;
      }
      await supabaseRequest("gauntlet_accounts", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          id: account.id,
          name: account.name,
          name_key: account.nameKey,
          password_salt: account.passwordSalt,
          password_hash: account.passwordHash,
          created_at: account.createdAt,
          last_login_at: account.lastLoginAt,
          last_seen_at: account.lastSeenAt,
          stats: account.stats
        })
      });
    } else {
      const store = loadAccountStore();
      if (findAccountByName(store, name)) {
        res.status(409).json({ error: "That account name is already taken." });
        return;
      }
      store.accounts.push(account);
      saveAccountStore(store);
    }

    res.json(issueAccountSession(account));
  } catch (error) {
    console.error("[Accounts] Register failed", error);
    res.status(500).json({ error: "Could not create account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const name = normalizeAccountName(req.body?.name);
  const password = String(req.body?.password || "");

  try {
    const account = useSupabaseStore()
      ? await findSupabaseAccountByName(name)
      : findAccountByName(loadAccountStore(), name);

    if (!account || !verifyPassword(password, account)) {
      res.status(401).json({ error: "Invalid account name or password." });
      return;
    }

    account.lastLoginAt = new Date().toISOString();
    account.lastSeenAt = account.lastLoginAt;
    if (useSupabaseStore()) {
      await patchSupabaseAccount(account.id, { last_login_at: account.lastLoginAt, last_seen_at: account.lastSeenAt });
    } else {
      const store = loadAccountStore();
      const localAccount = store.accounts.find((entry) => entry.id === account.id);
      localAccount.lastLoginAt = account.lastLoginAt;
      localAccount.lastSeenAt = account.lastSeenAt;
      saveAccountStore(store);
    }

    res.json(issueAccountSession(account));
  } catch (error) {
    console.error("[Accounts] Login failed", error);
    res.status(500).json({ error: "Could not sign in." });
  }
});

app.get("/api/auth/me", async (req, res) => {
  const authHeader = req.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const account = await getAccountFromToken(token);
  if (!account) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  res.json({ account });
});

app.patch("/api/account/progression", async (req, res) => {
  const context = await requireAccountRecord(req, res);
  if (!context) return;

  const selected = req.body?.selected || {};
  const stats = context.account.stats || {};
  const progression = normalizeProgression(stats);
  const cosmetics = progression.cosmetics;

  if (selected.title && cosmetics.unlockedTitles.includes(selected.title)) cosmetics.selectedTitle = selected.title;
  if (selected.cardBack && cosmetics.unlockedCardBacks.includes(selected.cardBack)) cosmetics.selectedCardBack = selected.cardBack;
  if (selected.factionBadge && cosmetics.unlockedFactionBadges.includes(selected.factionBadge)) cosmetics.selectedFactionBadge = selected.factionBadge;

  stats.progression = progression;

  if (context.source === "supabase") {
    await patchSupabaseAccount(context.account.id, { stats, last_seen_at: new Date().toISOString() });
    const updated = await findSupabaseAccountById(context.account.id);
    res.json({ account: publicAccount(updated) });
    return;
  }

  context.account.stats = stats;
  context.account.lastSeenAt = new Date().toISOString();
  saveAccountStore(context.store);
  res.json({ account: publicAccount(context.account) });
});

app.post("/api/collection/open-pack", async (req, res) => {
  const context = await requireAccountRecord(req, res);
  if (!context) return;

  const packId = String(req.body?.packId || "rumin-foundation");
  try {
    const stats = context.account.stats || {};
    const openedCards = openCollectionBooster(stats, packId);

    if (context.source === "supabase") {
      await patchSupabaseAccount(context.account.id, { stats, last_seen_at: new Date().toISOString() });
      const updated = await findSupabaseAccountById(context.account.id);
      res.json({ account: publicAccount(updated), openedCards });
      return;
    }

    context.account.stats = stats;
    context.account.lastSeenAt = new Date().toISOString();
    saveAccountStore(context.store);
    res.json({ account: publicAccount(context.account), openedCards });
  } catch (error) {
    res.status(400).json({ error: error.message || "Could not open booster pack." });
  }
});

app.get("/api/friends", async (req, res) => {
  const context = await requireAccountRecord(req, res);
  if (!context) return;
  res.json(await getFriendPayload(context));
});

app.post("/api/friends", async (req, res) => {
  const context = await requireAccountRecord(req, res);
  if (!context) return;

  const friendName = normalizeAccountName(req.body?.name);
  const friend = context.source === "supabase"
    ? await findSupabaseAccountByName(friendName)
    : findAccountByName(context.store, friendName);
  if (!friend) {
    res.status(404).json({ error: "No account found with that name." });
    return;
  }
  if (friend.id === context.account.id) {
    res.status(400).json({ error: "You cannot add yourself as a friend." });
    return;
  }

  if (context.source === "supabase") {
    const rows = [
      { account_id: context.account.id, friend_id: friend.id },
      { account_id: friend.id, friend_id: context.account.id }
    ];
    await supabaseRequest("gauntlet_friends?on_conflict=account_id,friend_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows)
    });
    await patchSupabaseAccount(context.account.id, { last_seen_at: new Date().toISOString() });
  } else {
    friend.friends = Array.isArray(friend.friends) ? friend.friends : [];
    if (!context.account.friends.includes(friend.id)) context.account.friends.push(friend.id);
    if (!friend.friends.includes(context.account.id)) friend.friends.push(context.account.id);
    context.account.lastSeenAt = new Date().toISOString();
    saveAccountStore(context.store);
  }
  res.json(await getFriendPayload(context));
});

app.delete("/api/friends/:friendId", async (req, res) => {
  const context = await requireAccountRecord(req, res);
  if (!context) return;

  const friendId = req.params.friendId;
  if (context.source === "supabase") {
    await supabaseRequest(`gauntlet_friends?account_id=eq.${encodeURIComponent(context.account.id)}&friend_id=eq.${encodeURIComponent(friendId)}`, { method: "DELETE" });
    await supabaseRequest(`gauntlet_friends?account_id=eq.${encodeURIComponent(friendId)}&friend_id=eq.${encodeURIComponent(context.account.id)}`, { method: "DELETE" });
    await patchSupabaseAccount(context.account.id, { last_seen_at: new Date().toISOString() });
  } else {
    const friend = context.store.accounts.find((entry) => entry.id === friendId);
    context.account.friends = context.account.friends.filter((id) => id !== friendId);
    if (friend) {
      friend.friends = Array.isArray(friend.friends) ? friend.friends.filter((id) => id !== context.account.id) : [];
    }
    context.account.lastSeenAt = new Date().toISOString();
    saveAccountStore(context.store);
  }
  res.json(await getFriendPayload(context));
});

app.post("/api/friends/:friendId/messages", async (req, res) => {
  const context = await requireAccountRecord(req, res);
  if (!context) return;

  const friend = context.source === "supabase"
    ? await findSupabaseAccountById(req.params.friendId)
    : context.store.accounts.find((entry) => entry.id === req.params.friendId);
  const isFriend = context.source === "supabase"
    ? (await supabaseRequest(`gauntlet_friends?account_id=eq.${encodeURIComponent(context.account.id)}&friend_id=eq.${encodeURIComponent(req.params.friendId)}&select=friend_id`)).length > 0
    : !!friend && context.account.friends.includes(friend.id);
  if (!friend || !isFriend) {
    res.status(404).json({ error: "Friend not found." });
    return;
  }

  const text = String(req.body?.text || "").trim().slice(0, 500);
  if (!text) {
    res.status(400).json({ error: "Enter a message first." });
    return;
  }

  const now = new Date().toISOString();
  const message = {
    id: crypto.randomUUID(),
    fromId: context.account.id,
    fromName: context.account.name,
    toId: friend.id,
    toName: friend.name,
    text,
    createdAt: now
  };
  if (context.source === "supabase") {
    await supabaseRequest("gauntlet_friend_messages", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        id: message.id,
        from_id: message.fromId,
        to_id: message.toId,
        text: message.text,
        created_at: message.createdAt
      })
    });
    await patchSupabaseAccount(context.account.id, { last_seen_at: now });
  } else {
    friend.messages = Array.isArray(friend.messages) ? friend.messages : [];
    context.account.messages.push(message);
    friend.messages.push(message);
    context.account.lastSeenAt = now;
    saveAccountStore(context.store);
  }
  res.json(await getFriendPayload(context));
});

app.get("/api/admin/account-stats", async (req, res) => {
  const authHeader = req.get("authorization") || "";
  const providedToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : req.get("x-owner-token");
  if (!OWNER_STATS_TOKEN || providedToken !== OWNER_STATS_TOKEN) {
    res.status(403).json({ error: "Owner stats token required." });
    return;
  }

  const accounts = useSupabaseStore()
    ? (await supabaseRequest("gauntlet_accounts?select=*")).map(accountFromSupabaseRow)
    : loadAccountStore().accounts;
  res.json({
    storage: useSupabaseStore() ? "supabase" : "local-json",
    totalAccounts: accounts.length,
    accounts: accounts.map((account) => ({
      name: account.name,
      createdAt: account.createdAt,
      lastLoginAt: account.lastLoginAt || null,
      lastSeenAt: account.lastSeenAt || null,
      gamesCreated: account.stats?.gamesCreated || 0,
      gamesJoined: account.stats?.gamesJoined || 0,
      gamesSpectated: account.stats?.gamesSpectated || 0,
      gamesWon: account.stats?.gamesWon || 0,
      gamesLost: account.stats?.gamesLost || 0,
      gamesDrawn: account.stats?.gamesDrawn || 0
    }))
  });
});

app.get("/api/admin/faction-stats", async (req, res) => {
  const authHeader = req.get("authorization") || "";
  const providedToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : req.get("x-owner-token");
  if (!OWNER_STATS_TOKEN || providedToken !== OWNER_STATS_TOKEN) {
    res.status(403).json({ error: "Owner stats token required." });
    return;
  }

  try {
    const store = await loadFactionStatsStore();
    res.json(getFactionStatsSummary(store));
  } catch (error) {
    console.error("[FactionStats] Failed to load faction stats", error);
    res.status(500).json({ error: "Could not load faction stats." });
  }
});

app.get("/api/leaderboard", async (_req, res) => {
  const accounts = useSupabaseStore()
    ? (await supabaseRequest("gauntlet_accounts?select=*")).map(accountFromSupabaseRow)
    : loadAccountStore().accounts;
  const leaderboard = accounts
    .map((account) => {
      const hasRankedStats =
        (account.stats?.rankedGamesPlayed || 0) > 0 ||
        (account.stats?.rankedGamesWon || 0) > 0 ||
        (account.stats?.rankedGamesLost || 0) > 0 ||
        (account.stats?.rankedGamesDrawn || 0) > 0;
      const wins = hasRankedStats ? account.stats?.rankedGamesWon || 0 : account.stats?.gamesWon || 0;
      const losses = hasRankedStats ? account.stats?.rankedGamesLost || 0 : account.stats?.gamesLost || 0;
      const draws = hasRankedStats ? account.stats?.rankedGamesDrawn || 0 : account.stats?.gamesDrawn || 0;
      const gamesPlayed = wins + losses;
      const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 1000) / 10 : 0;
      return {
        name: account.name,
        wins,
        losses,
        draws,
        gamesPlayed,
        winRate
      };
    })
    .filter((entry) => entry.gamesPlayed > 0)
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || a.losses - b.losses || a.name.localeCompare(b.name))
    .slice(0, 25);

  res.json({ leaderboard });
});

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
    { id: "brothers-of-destiny", playableName: "Rolmus", opponentName: "Remex", title: "Brothers of Destiny", story: "Two brothers found Rumie together, then clash over whether trade or conquest will define the city.", dialogue: ["Rolmus: Trade builds empires.", "Remex: Trade only survives behind walls.", "Rolmus: Then today we decide what Rumie is."] },
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

function getCampaignChapter(factionId, chapterId) {
  return (campaignChapters[factionId] || []).find((chapter) => chapter.id === chapterId) || null;
}

function getCampaignDifficulty(factionId, chapterId) {
  const chapterIndex = Math.max(0, (campaignChapters[factionId] || []).findIndex((chapter) => chapter.id === chapterId));
  if (factionId === "rumin" || factionId === "sheen" || factionId === "frumo" || factionId === "bizi") {
    return {
      bossLife: Math.min(58, 18 + chapterIndex * 3),
      attacksPerTurn: Math.min(4, 2 + Math.floor(chapterIndex / 4)),
      minAttackValue: 2 + Math.floor(chapterIndex / 5),
      maxAttackValue: 5 + Math.floor(chapterIndex / 4),
      chapterNumber: chapterIndex + 1
    };
  }
  return {
    bossLife: [18, 24, 32][chapterIndex] || 32,
    attacksPerTurn: Math.min(4, 2 + chapterIndex),
    minAttackValue: 2 + chapterIndex,
    maxAttackValue: 5 + chapterIndex,
    chapterNumber: chapterIndex + 1
  };
}

const basicGameProfile = {
  id: "basic",
  name: "Basic Gauntlet",
  cardImage: null,
  commander: null,
  city: null,
  general: null
};

function getLobbyGameMode(roomState) {
  if (roomState.lobby.gameMode === "freeForAll") return "freeForAll";
  return roomState.lobby.gameMode === "basic" ? "basic" : "factions";
}

// ============ GAME STATE STORAGE ============
const rooms = new Map();
const matchmakingQueue = [];

function makeReconnectToken() {
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function createRoom() {
  let roomCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  while (rooms.has(roomCode)) {
    roomCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  }
  const roomState = {
    roomCode,
    lobby: {
      gameMode: "factions",
      players: {
        1: { socket: null, connected: false, factionId: null, reconnectToken: null },
        2: { socket: null, connected: false, factionId: null, reconnectToken: null }
      },
      spectators: []
    },
    game: null,
    damageConfirmed: { 1: false, 2: false },
    ranked: false
  };
  rooms.set(roomCode, roomState);
  return roomState;
}

function createFreeForAllRoom() {
  const roomState = createRoom();
  roomState.lobby.gameMode = "freeForAll";
  roomState.lobby.players = {
    1: { socket: null, connected: false, factionId: null, reconnectToken: null },
    2: { socket: null, connected: false, factionId: null, reconnectToken: null },
    3: { socket: null, connected: false, factionId: null, reconnectToken: null },
    4: { socket: null, connected: false, factionId: null, reconnectToken: null }
  };
  roomState.damageConfirmed = { 1: false, 2: false, 3: false, 4: false };
  return roomState;
}

function getLobbyPlayerNumbers(roomState) {
  return Object.keys(roomState.lobby.players).map(Number).sort((a, b) => a - b);
}

function getConnectedLobbyPlayerNumbers(roomState) {
  return getLobbyPlayerNumbers(roomState).filter((playerNum) => (
    roomState.lobby.players[playerNum].socket ||
    roomState.lobby.players[playerNum].connected ||
    roomState.lobby.players[playerNum].isAI
  ));
}

function isFreeForAllRoom(roomState) {
  return roomState?.lobby?.gameMode === "freeForAll" || roomState?.game?.gameMode === "freeForAll";
}

function removeFromMatchmaking(socketId) {
  const index = matchmakingQueue.findIndex((entry) => entry.socketId === socketId);
  if (index >= 0) matchmakingQueue.splice(index, 1);
}

function getMatchTolerance(waitMs) {
  return Math.min(1, 0.35 + Math.floor(waitMs / 20000) * 0.15);
}

function findMatchForEntry(entry) {
  const now = Date.now();
  let best = null;
  let bestScore = Infinity;

  for (const candidate of matchmakingQueue) {
    if (candidate.socketId === entry.socketId || candidate.accountId === entry.accountId) continue;
    const tolerance = Math.max(getMatchTolerance(now - entry.joinedAt), getMatchTolerance(now - candidate.joinedAt));
    const ratioGap = Math.abs(entry.winRatio - candidate.winRatio);
    if (ratioGap > tolerance) continue;
    const gamesGap = Math.abs(entry.gamesPlayed - candidate.gamesPlayed);
    const score = ratioGap + Math.min(gamesGap, 20) / 200;
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function createMatchedRoom(entryA, entryB) {
  const roomState = createRoom();
  roomState.ranked = true;
  const firstEntry = Math.random() < 0.5 ? entryA : entryB;
  const secondEntry = firstEntry === entryA ? entryB : entryA;
  const assignments = [
    { playerNum: 1, entry: firstEntry },
    { playerNum: 2, entry: secondEntry }
  ];

  for (const assignment of assignments) {
    const lobbyPlayer = roomState.lobby.players[assignment.playerNum];
    lobbyPlayer.reconnectToken = makeReconnectToken();
    lobbyPlayer.accountId = assignment.entry.accountId;
    lobbyPlayer.accountName = assignment.entry.accountName;
    lobbyPlayer.isGuest = false;
  }

  for (const assignment of assignments) {
    const playerSocket = io.sockets.sockets.get(assignment.entry.socketId);
    if (playerSocket) {
      attachPlayerSocket(roomState, playerSocket, assignment.playerNum);
      playerSocket.emit("matchmakingStatus", { inQueue: false, message: `Match found. Room ${roomState.roomCode}.` });
    }
  }

  emitLobbyState(roomState);
  return roomState;
}

function getRoom(roomCode) {
  return rooms.get(roomCode);
}

function deleteRoom(roomCode) {
  rooms.delete(roomCode);
}

function getRoomForSocket(socket) {
  for (const [code, room] of rooms) {
    if (getLobbyPlayerNumbers(room).some((playerNum) => room.lobby.players[playerNum].socket === socket.id) ||
        room.lobby.spectators.includes(socket.id)) {
      return room;
    }
  }
  return null;
}

function sanitizeLobbyPlayer(player) {
  return {
    connected: player.connected,
    factionId: player.factionId,
    accountName: player.accountName || null,
    isGuest: !!player.isGuest,
    readyToStart: !!player.readyToStart,
    isAI: !!player.isAI
  };
}

function emitLobbyState(roomState) {
  const players = {};
  getLobbyPlayerNumbers(roomState).forEach((playerNum) => {
    players[playerNum] = sanitizeLobbyPlayer(roomState.lobby.players[playerNum]);
  });
  io.to(roomState.roomCode).emit("lobbyState", {
    roomCode: roomState.roomCode,
    gameMode: getLobbyGameMode(roomState),
    players,
    factions: listFactions(),
    spectatorCount: roomState.lobby.spectators.length
  });
}

function sanitizeGameForViewer(game, viewerPlayerNum, spectatorCount) {
  const visibleGame = JSON.parse(JSON.stringify(game));
  for (const [rawPlayerNum, playerState] of Object.entries(visibleGame.players || {})) {
    const playerNum = Number(rawPlayerNum);
    const realPlayer = game.players?.[playerNum];
    playerState.handCount = realPlayer?.hand?.length || 0;
    playerState.deckCount = realPlayer?.deck?.length || 0;
    playerState.discardCount = realPlayer?.discard?.length || 0;
    if (viewerPlayerNum !== playerNum) playerState.hand = [];
    playerState.deck = [];
  }
  visibleGame.spectatorCount = spectatorCount;
  return visibleGame;
}

function emitState(roomState) {
  if (!roomState.game) return;
  captureGameEvent(roomState.game);
  const spectatorCount = roomState.lobby.spectators.length;

  for (const playerNum of getLobbyPlayerNumbers(roomState)) {
    const socketId = roomState.lobby.players[playerNum].socket;
    if (!socketId) continue;
    io.to(socketId).emit("state", sanitizeGameForViewer(roomState.game, playerNum, spectatorCount));
  }

  for (const socketId of roomState.lobby.spectators) {
    io.to(socketId).emit("state", sanitizeGameForViewer(roomState.game, null, spectatorCount));
  }
}

function getOtherPlayer(playerNum) {
  return playerNum === 1 ? 2 : 1;
}

function getActivePlayerNumbers(game) {
  return Object.keys(game.players || {})
    .map(Number)
    .filter((playerNum) => !game.players[playerNum].eliminated)
    .sort((a, b) => a - b);
}

function getNextActivePlayer(game, playerNum) {
  const active = getActivePlayerNumbers(game);
  if (active.length === 0) return playerNum;
  const currentIndex = active.indexOf(playerNum);
  return active[(currentIndex + 1 + active.length) % active.length] || active[0];
}

function getPlayerNumberBySocket(roomState, socketId) {
  for (const playerNum of getLobbyPlayerNumbers(roomState)) {
    if (roomState.lobby.players[playerNum].socket === socketId) return playerNum;
  }
  return null;
}

async function getReconnectPlayerNumber(roomState, reconnectToken, authToken) {
  const account = await getAccountFromToken(authToken);
  for (const playerNum of getLobbyPlayerNumbers(roomState)) {
    const lobbyPlayer = roomState.lobby.players[playerNum];
    if (reconnectToken && lobbyPlayer.reconnectToken === reconnectToken) return playerNum;
    if (account?.id && lobbyPlayer.accountId === account.id) return playerNum;
  }
  return null;
}

function getDisconnectedSeatForIdentity(roomState, identity, reconnectToken) {
  for (const playerNum of getLobbyPlayerNumbers(roomState)) {
    const lobbyPlayer = roomState.lobby.players[playerNum];
    if (lobbyPlayer.socket) continue;
    if (reconnectToken && lobbyPlayer.reconnectToken === reconnectToken) return playerNum;
    if (identity.type === "account" && lobbyPlayer.accountId && lobbyPlayer.accountId === identity.id) return playerNum;
    if (identity.type === "guest" && lobbyPlayer.isGuest && lobbyPlayer.accountName === identity.name) return playerNum;
  }
  return null;
}

function attachPlayerSocket(roomState, socket, playerNum) {
  const lobbyPlayer = roomState.lobby.players[playerNum];
  lobbyPlayer.socket = socket.id;
  lobbyPlayer.connected = true;
  if (!lobbyPlayer.reconnectToken) lobbyPlayer.reconnectToken = makeReconnectToken();
  if (roomState.game?.players?.[playerNum]) roomState.game.players[playerNum].connected = true;

  socket.join(roomState.roomCode);
  socket.data.roomCode = roomState.roomCode;
  socket.data.role = "player";
  socket.data.playerNum = playerNum;

  socket.emit("assign", {
    role: "player",
    playerNum,
    roomCode: roomState.roomCode,
    reconnectToken: lobbyPlayer.reconnectToken
  });
}

function detachSocketFromRoom(roomState, socket, { leaveSocket = true } = {}) {
  for (const p of getLobbyPlayerNumbers(roomState)) {
    if (roomState.lobby.players[p].socket === socket.id) {
      roomState.lobby.players[p].connected = false;
      roomState.lobby.players[p].socket = null;
      if (roomState.game?.players?.[p]) roomState.game.players[p].connected = false;
    }
  }

  roomState.lobby.spectators = roomState.lobby.spectators.filter((socketId) => socketId !== socket.id);
  if (leaveSocket) socket.leave(roomState.roomCode);
  socket.data.roomCode = null;
  socket.data.role = null;
  socket.data.playerNum = null;

  if (roomState.game) emitState(roomState);
  else emitLobbyState(roomState);
}

function roomPlayersReady(roomState) {
  if (isFreeForAllRoom(roomState)) {
    const seated = getConnectedLobbyPlayerNumbers(roomState);
    return seated.length >= 2 && seated.every((playerNum) => roomState.lobby.players[playerNum].factionId);
  }
  if (getLobbyGameMode(roomState) === "basic") {
    return roomState.lobby.players[1].socket && (roomState.lobby.players[2].socket || roomState.lobby.players[2].isAI);
  }
  return roomState.lobby.players[1].factionId && roomState.lobby.players[2].factionId;
}

function resetStartConfirmations(roomState) {
  for (const playerNum of getLobbyPlayerNumbers(roomState)) {
    roomState.lobby.players[playerNum].readyToStart = false;
  }
}

function playersConfirmedStart(roomState) {
  const seated = getConnectedLobbyPlayerNumbers(roomState);
  return seated.length >= 2 && seated.every((playerNum) => roomState.lobby.players[playerNum].readyToStart || roomState.lobby.players[playerNum].isAI);
}

async function requirePlayerIdentity(socket, authToken, guestName) {
  const account = await getAccountFromToken(authToken || socket.data.authToken);
  if (account) {
    socket.data.authToken = authToken || socket.data.authToken;
    socket.data.account = account;
    return { type: "account", id: account.id, name: account.name };
  }

  const normalizedGuestName = normalizeGuestName(guestName);
  if (isValidGuestName(normalizedGuestName)) {
    return { type: "guest", id: null, name: normalizedGuestName };
  }

  socket.emit("errorMessage", "Sign in, create an account, or enter a 2-24 character guest name.");
  return null;
}

function resetPriorityPassed(game) {
  if (game.gameMode === "freeForAll") {
    game.priorityPassed = {};
    getActivePlayerNumbers(game).forEach((playerNum) => {
      game.priorityPassed[playerNum] = false;
    });
    return;
  }
  game.priorityPassed = { 1: false, 2: false };
}

function enterDamagePhase(game, message = "Damage phase. Click Resolve Damage.") {
  game.phase = "damage";
  game.message = message;
  if (game.gameMode === "freeForAll") {
    return getActivePlayerNumbers(game).reduce((confirmed, playerNum) => {
      confirmed[playerNum] = false;
      return confirmed;
    }, {});
  }
  return { 1: false, 2: false };
}

function captureGameEvent(game) {
  if (!game?.message) return;
  game.eventLog = Array.isArray(game.eventLog) ? game.eventLog : [];
  const last = game.eventLog[game.eventLog.length - 1];
  if (last && last.text === game.message && last.turn === game.turn && last.phase === game.phase) return;
  game.eventLog.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    turn: game.turn || 1,
    phase: game.phase || "setup",
    text: game.message,
    createdAt: new Date().toISOString()
  });
  if (game.eventLog.length > 300) game.eventLog = game.eventLog.slice(-300);
}

function describeCardValue(card, effectiveValue, notes = []) {
  const base = getBaseCardValue(card);
  const total = Number.isFinite(effectiveValue) ? effectiveValue : getCardCurrentValue(card);
  const valueText = total !== base ? `value ${base} -> ${total}` : `value ${total}`;
  const noteText = Array.isArray(notes) && notes.length > 0 ? `; ${notes.join(", ")}` : "";
  return `${card?.name || "card"} (${valueText}${noteText})`;
}

function describeCardList(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return "none";
  return cards.map((card) => card?.name || "card").join(", ");
}

function getHandCardsByIndexes(player, indexes) {
  return (Array.isArray(indexes) ? indexes : [])
    .map((index) => player.hand[Number(index)])
    .filter(Boolean);
}

function recordPaymentLog(game, entry) {
  if (!game) return;
  if (!Array.isArray(game.paymentLog)) game.paymentLog = [];
  game.paymentLog.push({
    id: `pay-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    turn: game.turn || 1,
    phase: game.phase,
    createdAt: new Date().toISOString(),
    ...entry
  });
  if (game.paymentLog.length > 80) game.paymentLog = game.paymentLog.slice(-80);
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function cloneGameForUndo(game) {
  const snapshot = clonePlain(game);
  delete snapshot.undoRequest;
  return snapshot;
}

function clearUndoRequest(game) {
  if (game) game.undoRequest = null;
}

function getUndoSnapshots(roomState) {
  if (!roomState.undoSnapshots) roomState.undoSnapshots = {};
  if (roomState.undoSnapshot) {
    roomState.undoSnapshots[roomState.undoSnapshot.requester] = roomState.undoSnapshot;
    roomState.undoSnapshot = null;
  }
  return roomState.undoSnapshots;
}

function saveUndoSnapshot(roomState, playerNum, label) {
  if (!roomState?.game || roomState.game.phase === "gameOver") return;
  const snapshots = getUndoSnapshots(roomState);
  snapshots[playerNum] = {
    requester: playerNum,
    label,
    game: cloneGameForUndo(roomState.game),
    damageConfirmed: clonePlain(roomState.damageConfirmed || {})
  };
  clearUndoRequest(roomState.game);
}

function getUndoApprovalPlayers(roomState, requester) {
  return getLobbyPlayerNumbers(roomState)
    .filter((playerNum) => playerNum !== requester)
    .filter((playerNum) => roomState.game?.players?.[playerNum] && !roomState.game.players[playerNum].eliminated)
    .filter((playerNum) => !roomState.lobby.players[playerNum]?.isAI);
}

function restoreUndoSnapshot(roomState, requester) {
  const snapshots = getUndoSnapshots(roomState);
  const snapshot = snapshots[requester];
  if (!snapshot) return false;
  roomState.game = clonePlain(snapshot.game);
  roomState.damageConfirmed = clonePlain(snapshot.damageConfirmed || {});
  roomState.game.message = `Undo approved. Reverted Player ${snapshot.requester}'s most recent move: ${snapshot.label}.`;
  roomState.game.undoRequest = null;
  roomState.undoSnapshots = {};
  roomState.undoSnapshot = null;
  return true;
}

function createTurnData() {
  return {
    attacksDeclaredThisTurn: 0,
    blocksDeclaredThisTurn: 0,
    previousAttackSuit: null,
    previousPlayedValue: null,
    suitsPlayedThisTurn: [],
    ruminSharedSuitBuffsUsed: 0,
    biziDifferentSuitBuffsUsed: 0,
    meerusFreeAttackAvailable: false,
    beliHighCostAttackBuffAvailable: false,
    tangLifeGainUsed: false,
    ristusConsecutiveBuffUsed: false,
    poleaUsed: false,
    lafayetteUsed: false,
    focusBuffUsed: false,
    heraUsed: false
  };
}

function removeIndexesFromHandToDiscard(player, indexes) {
  const sorted = [...indexes].sort((a, b) => b - a);
  for (const idx of sorted) {
    if (idx >= 0 && idx < player.hand.length) {
      player.discard.push(player.hand[idx]);
      player.hand.splice(idx, 1);
    }
  }
}

function validateHandIndexes(player, indexes, excludedIndexes = []) {
  const rawIndexes = Array.isArray(indexes) ? indexes : [];
  const validIndexes = [];
  const seen = new Set();
  const excluded = new Set(Array.isArray(excludedIndexes) ? excludedIndexes : [excludedIndexes]);

  for (const rawIndex of rawIndexes) {
    const index = Number(rawIndex);
    if (!Number.isInteger(index) || index < 0 || index >= player.hand.length) {
      return { error: "Invalid payment card" };
    }
    if (excluded.has(index)) {
      return { error: "Selected card cannot also be payment" };
    }
    if (seen.has(index)) {
      return { error: "Duplicate payment card" };
    }
    seen.add(index);
    validIndexes.push(index);
  }

  return { indexes: validIndexes };
}

function removeSelectedCardsAndPayments(player, selectedIndexes, paymentIndexes) {
  const selectedCards = [];
  const removals = [
    ...selectedIndexes.map((index) => ({ index, role: "selected" })),
    ...paymentIndexes.map((index) => ({ index, role: "payment" }))
  ].sort((a, b) => b.index - a.index);

  for (const removal of removals) {
    const [card] = player.hand.splice(removal.index, 1);
    if (removal.role === "selected") selectedCards.unshift(card);
    else player.discard.push(card);
  }

  return selectedCards;
}

function removeSelectedCardAndPayments(player, selectedIndex, paymentIndexes) {
  return removeSelectedCardsAndPayments(player, [selectedIndex], paymentIndexes)[0] || null;
}

function registerCardPlayed(player, card) {
  const value = getBaseCardValue(card);
  if (card?.suit && !player.turnData.suitsPlayedThisTurn.includes(card.suit)) {
    player.turnData.suitsPlayedThisTurn.push(card.suit);
  }
  player.turnData.previousPlayedValue = value || null;
}

function applyPlayedCardBonuses(player, card) {
  const notes = [];
  const value = getBaseCardValue(card);

  if (
    player.faction?.id === "frumo" &&
    !player.turnData.ristusConsecutiveBuffUsed &&
    player.turnData.previousPlayedValue != null &&
    Math.abs(value - player.turnData.previousPlayedValue) === 1
  ) {
    card.tempBuff = (card.tempBuff || 0) + 2;
    player.turnData.ristusConsecutiveBuffUsed = true;
    notes.push("Ristus +2 consecutive value");
  }

  registerCardPlayed(player, card);
  return notes;
}

function getCardCurrentValue(card) {
  return getBaseCardValue(card) + (card?.tempBuff || 0);
}

function clearCardBuff(card) {
  if (card && card.tempBuff) delete card.tempBuff;
}

function clearEndTurnBuffs(game) {
  for (const p of [1, 2]) {
    const player = game.players[p];
    player.hand.forEach(clearCardBuff);
    player.deck.forEach(clearCardBuff);
    player.discard.forEach(clearCardBuff);
  }
  game.lanes.forEach((lane) => {
    clearCardBuff(lane.facedown[1]);
    clearCardBuff(lane.facedown[2]);
    clearCardBuff(lane.attack?.card);
    lane.block.forEach((block) => clearCardBuff(block.card));
  });
  game.handAttacks.forEach((attack) => {
    clearCardBuff(attack.card);
    attack.block.forEach((block) => clearCardBuff(block.card));
  });
}

function calculateAttackBonuses(player, card) {
  const notes = [];
  let value = 0;
  const attackNumber = player.turnData.attacksDeclaredThisTurn + 1;
  const cardBaseValue = getBaseCardValue(card);

  if (player.faction?.id === "rumin") {
    if (attackNumber === 4) {
      value += 3;
      notes.push("Kaiser fourth attack +3");
    }
    if (
      attackNumber > 1 &&
      player.turnData.ruminSharedSuitBuffsUsed < 2 &&
      player.turnData.previousAttackSuit === card.suit
    ) {
      value += 1;
      player.turnData.ruminSharedSuitBuffsUsed += 1;
      notes.push("Rumie shared suit +1");
    }
  }

  if (player.faction?.id === "sheen" && player.turnData.beliHighCostAttackBuffAvailable && cardBaseValue >= 10) {
    value += 2;
    player.turnData.beliHighCostAttackBuffAvailable = false;
    notes.push("Beli high-cost attack +2");
  }

  if (
    player.faction?.id === "bizi" &&
    attackNumber > 1 &&
    player.turnData.biziDifferentSuitBuffsUsed < 2 &&
    player.turnData.previousAttackSuit &&
    player.turnData.previousAttackSuit !== card.suit
  ) {
    value += 1;
    player.turnData.biziDifferentSuitBuffsUsed += 1;
    notes.push("Constanti different suit +1");
  }

  return { value, notes };
}

function getAttackPaymentRequirement(player, card) {
  const attackNumber = player.turnData.attacksDeclaredThisTurn + 1;
  const required = getBaseCardValue(card);

  if (
    player.faction?.id === "rumin" &&
    attackNumber === 3 &&
    player.turnData.meerusFreeAttackAvailable &&
    required <= 3
  ) {
    return { required: 0, freeAttackUsed: true };
  }

  return { required, freeAttackUsed: false };
}

function getPaymentTotal(player, paymentIndexes, useHeraBonus) {
  let total = 0;
  const paymentCards = paymentIndexes.map((idx) => player.hand[idx]).filter(Boolean);
  for (const idx of paymentIndexes) {
    if (player.hand[idx]) total += getBaseCardValue(player.hand[idx]);
  }
  let heraUsedNow = false;
  const hasHeraPaymentCard = paymentCards.some((card) => player.turnData.suitsPlayedThisTurn.includes(card.suit));
  if (
    useHeraBonus &&
    player.faction?.id === "bizi" &&
    !player.turnData.heraUsed &&
    player.turnData.suitsPlayedThisTurn.length > 0 &&
    hasHeraPaymentCard
  ) {
    total += 2;
    heraUsedNow = true;
  }
  return { total, heraUsedNow };
}

function finalizeAttackDeclaration(player, card, attackBonus, freeUsed) {
  const playedNotes = applyPlayedCardBonuses(player, card);
  let effectiveValue = getCardCurrentValue(card) + (attackBonus.value || 0);
  const notes = [...playedNotes, ...attackBonus.notes];
  if (freeUsed) notes.push("Meerus free attack");
  player.turnData.attacksDeclaredThisTurn++;
  player.turnData.previousAttackSuit = card?.suit;
  if (player.faction?.id === "rumin" && player.turnData.attacksDeclaredThisTurn === 2) {
    player.turnData.meerusFreeAttackAvailable = true;
  }
  if (player.faction?.id === "rumin" && player.turnData.attacksDeclaredThisTurn >= 3) {
    player.turnData.meerusFreeAttackAvailable = false;
  }
  return { effectiveValue, notes };
}

function applyBlockBonuses(player, card) {
  const playedNotes = applyPlayedCardBonuses(player, card);
  let effectiveValue = getCardCurrentValue(card);
  const notes = [...playedNotes];
  const faction = player.faction?.id;
  if (faction === "sheen") {
    effectiveValue += 1;
    notes.push("Emperor Nu +1");
    if (player.turnData.blocksDeclaredThisTurn >= 2) {
      effectiveValue += 1;
      notes.push("Emperor Nu third block +2");
    }
  }
  return { effectiveValue, notes };
}

function finalizeBlockDeclaration(player) {
  player.turnData.blocksDeclaredThisTurn++;
  if (player.faction?.id === "sheen" && player.turnData.blocksDeclaredThisTurn === 2) {
    if (!player.turnData.tangLifeGainUsed) {
      player.life += 2;
      player.turnData.tangLifeGainUsed = true;
    }
    player.turnData.beliHighCostAttackBuffAvailable = true;
  }
}

function addAccelerationIfOverpaid(player, paid, required) {
  if (player.faction?.id === "bizi" && paid - required >= 2) {
    player.accelerationCounters = (player.accelerationCounters || 0) + 1;
  }
}

function hasPendingAttacks(game) {
  return (game.handAttacks && game.handAttacks.length > 0) ||
    (game.lanes && game.lanes.some(l => l.attack));
}

function getAttackDefender(game, attack) {
  if (!attack) return null;
  if (game.gameMode === "freeForAll") return attack.targetPlayer || null;
  return getOtherPlayer(attack.player);
}

function getPendingAttackParticipants(game) {
  const attack = getPendingAttackList(game)[0] || null;
  if (!attack) return null;
  return { attack, attacker: attack.player, defender: getAttackDefender(game, attack) };
}

function getPriorityPlayerList(game) {
  return game.gameMode === "freeForAll" ? getActivePlayerNumbers(game) : [1, 2];
}

function allPriorityPlayersPassed(game) {
  return getPriorityPlayerList(game).every((playerNum) => !!game.priorityPassed?.[playerNum]);
}

function allDamagePlayersConfirmed(roomState) {
  const game = roomState.game;
  const confirmPlayers = game.gameMode === "freeForAll" ? getActivePlayerNumbers(game) : [1, 2];
  return confirmPlayers.every((playerNum) => !!roomState.damageConfirmed?.[playerNum]);
}

function getWaitingDamagePlayers(roomState) {
  const game = roomState.game;
  const confirmPlayers = game.gameMode === "freeForAll" ? getActivePlayerNumbers(game) : [1, 2];
  return confirmPlayers.filter((playerNum) => !roomState.damageConfirmed?.[playerNum]);
}

async function resolveCombatAndResumePriority(roomState) {
  const game = roomState.game;
  resolveDamage(game, roomState);
  if (game.gameMode === "freeForAll" && await finishGameIfLifeCheckFails(roomState)) {
    return true;
  }
  game.phase = "priority";
  game.priority = game.gameMode === "freeForAll"
    ? (game.mostRecentAttackDefender && !game.players[game.mostRecentAttackDefender]?.eliminated ? game.mostRecentAttackDefender : getActivePlayerNumbers(game)[0])
    : game.mostRecentAttackDefender || getOtherPlayer(game.priority);
  game.lastActivePlayer = game.priority;
  game.mostRecentAttackDefender = null;
  roomState.damageConfirmed = game.gameMode === "freeForAll"
    ? getActivePlayerNumbers(game).reduce((confirmed, playerNum) => {
        confirmed[playerNum] = false;
        return confirmed;
      }, {})
    : { 1: false, 2: false };
  resetPriorityPassed(game);
  game.message = `${game.lastDamageSummary ? `${game.lastDamageSummary} ` : ""}Damage resolved automatically. Player ${game.priority} has priority. Life totals will be checked at end of turn.`;
  return false;
}

async function handleFreeForAllPriorityPass(roomState, playerNum) {
  const game = roomState.game;
  game.priorityPassed[playerNum] = true;

  if (hasPendingAttacks(game)) {
    const participants = getPendingAttackParticipants(game);
    if (!participants?.defender) {
      return resolveCombatAndResumePriority(roomState);
    }
    if (playerNum === participants.defender) {
      game.priority = participants.attacker;
      game.message = `Player ${playerNum} chose not to block. Player ${participants.attacker} can pass to damage.`;
      return false;
    }
    if (playerNum === participants.attacker && game.priorityPassed[participants.defender]) {
      return resolveCombatAndResumePriority(roomState);
    }
    game.priority = participants.defender;
    game.message = `Player ${playerNum} passed priority. Player ${participants.defender} can respond.`;
    return false;
  }

  game.message = `Player ${playerNum} passed priority.`;
  if (allPriorityPlayersPassed(game)) {
    if (await finishGameIfLifeCheckFails(roomState)) return true;
    startEndPhase(game);
    resetPriorityPassed(game);
  } else {
    game.priority = getNextActivePlayer(game, playerNum);
  }
  return false;
}

function getControlledTargetCard(game, playerNum, targetType, lane, handAttackId) {
  const laneIndex = Number(lane);

  if (targetType === "laneCard") {
    if (!Number.isInteger(laneIndex) || laneIndex < 0 || laneIndex >= game.lanes.length) return null;
    return game.lanes[laneIndex].facedown[playerNum] || null;
  }

  if (targetType === "laneAttack") {
    if (!Number.isInteger(laneIndex) || laneIndex < 0 || laneIndex >= game.lanes.length) return null;
    const attack = game.lanes[laneIndex].attack;
    return attack?.player === playerNum ? attack.card : null;
  }

  if (targetType === "handAttack") {
    const attack = game.handAttacks.find((a) => a.id === handAttackId);
    return attack?.player === playerNum ? attack.card : null;
  }

  return null;
}

function canUsePriorityAbility(socket, game, playerNum, expectedFaction) {
  if (game.phase !== "priority") {
    socket.emit("errorMessage", "Not in priority phase");
    return false;
  }
  if (game.priority !== playerNum) {
    socket.emit("errorMessage", "Not your priority");
    return false;
  }
  if (game.players[playerNum].faction?.id !== expectedFaction) {
    socket.emit("errorMessage", "Wrong faction for this ability");
    return false;
  }
  return true;
}

function getBaseCardValue(card) {
  if (!card) return 0;
  const value = card.value;
  if (value === "A" || value === 14 || value === "14") return 14;
  if (value === "K" || value === 13 || value === "13") return 13;
  if (value === "Q" || value === 12 || value === "12") return 12;
  if (value === "J" || value === 11 || value === "11") return 11;
  return Number(value) || 0;
}

function applyGameOverState(game) {
  if (game.gameMode === "freeForAll") {
    const activePlayers = getActivePlayerNumbers(game);
    if (activePlayers.length > 1 && activePlayers.every((playerNum) => game.players[playerNum].life > 0)) return false;
    const bestLife = Math.max(...activePlayers.map((playerNum) => game.players[playerNum].life));
    const winners = activePlayers.filter((playerNum) => game.players[playerNum].life === bestLife);
    game.phase = "gameOver";
    game.winner = winners.length === 1 ? winners[0] : null;
    game.message = game.winner == null
      ? `Free-for-all ended in a draw at ${bestLife} life.`
      : `Free-for-all complete. Player ${game.winner} wins with ${bestLife} life!`;
    return true;
  }
  const p1Life = game.players[1].life;
  const p2Life = game.players[2].life;

  if (p1Life > 0 && p2Life > 0) return false;

  game.phase = "gameOver";
  if (p1Life === p2Life) {
    game.winner = null;
    game.message = `End of turn life check: both players are tied at ${p1Life}. Game Over - Draw!`;
  } else {
    game.winner = p1Life > p2Life ? 1 : 2;
    game.message = `End of turn life check: Player ${game.winner} has the higher life total and wins!`;
  }

  return true;
}

async function finishGameIfLifeCheckFails(roomState) {
  const game = roomState.game;
  if (!game || !applyGameOverState(game)) return false;
  captureGameEvent(game);
  await recordFinalGameStats(roomState);
  io.to(roomState.roomCode).emit("gameEnded", { winner: game.winner, tie: game.winner == null });
  return true;
}

async function recordFinalGameStats(roomState) {
  const game = roomState.game;
  if (!game || game.statsRecorded) return;
  if (game.phase !== "gameOver") return;
  if (isTrainingAiRoom(roomState)) {
    if (game.campaign && game.winner === 1) {
      await recordAccountGameResult(roomState.lobby.players[1].accountId, "win", {
        ranked: false,
        mode: "campaign",
        factionId: game.players[1]?.faction?.id,
        factionName: game.players[1]?.faction?.name,
        opponentName: game.campaign.opponentName,
        life: game.players[1]?.life,
        opponentLife: game.players[2]?.life,
        campaign: {
          factionId: game.campaign.factionId,
          chapterId: game.campaign.chapterId,
          title: game.campaign.title
        }
      });
    }
    game.statsRecorded = true;
    return;
  }

  await recordFactionGameStats(game);

  const completedAt = new Date().toISOString();
  const buildContext = (playerNum, result) => {
    const opponentNums = getLobbyPlayerNumbers(roomState).filter((entry) => entry !== playerNum);
    const primaryOpponent = opponentNums[0];
    return {
      ranked: true,
      completedAt,
      mode: game.gameMode || "duel",
      factionId: game.players[playerNum]?.faction?.id,
      factionName: game.players[playerNum]?.faction?.name,
      opponentName: primaryOpponent ? (game.players[primaryOpponent]?.accountName || `Player ${primaryOpponent}`) : "Opponent",
      life: game.players[playerNum]?.life,
      opponentLife: primaryOpponent ? game.players[primaryOpponent]?.life : null,
      result
    };
  };

  if (game.winner == null) {
    for (const playerNum of getLobbyPlayerNumbers(roomState)) {
      await recordAccountGameResult(roomState.lobby.players[playerNum].accountId, "draw", buildContext(playerNum, "draw"));
    }
  } else {
    await recordAccountGameResult(roomState.lobby.players[game.winner].accountId, "win", buildContext(game.winner, "win"));
    for (const playerNum of getLobbyPlayerNumbers(roomState)) {
      if (playerNum !== game.winner) await recordAccountGameResult(roomState.lobby.players[playerNum].accountId, "loss", buildContext(playerNum, "loss"));
    }
  }

  game.statsRecorded = true;
}

function resolveDamage(game, roomState) {
  if (game.gameMode === "freeForAll") {
    resolveFreeForAllDamage(game, roomState);
    return;
  }
  const damageMessages = [];

  for (const attack of game.handAttacks) {
    let totalBlock = 0;
    for (const block of attack.block) {
      totalBlock += block.effectiveValue || 0;
    }
    const damage = Math.max(0, (attack.effectiveValue || 0) - totalBlock);
    const defender = getOtherPlayer(attack.player);
    const blockedText = totalBlock > 0 ? ` after ${totalBlock} block` : "";
    if (damage > 0) {
      game.players[defender].life -= damage;
      damageMessages.push(`Hand attack ${describeCardValue(attack.card, attack.effectiveValue, attack.notes)}${blockedText} = ${damage} damage to Player ${defender}`);
    } else {
      damageMessages.push(`Hand attack ${describeCardValue(attack.card, attack.effectiveValue, attack.notes)} was fully blocked by ${totalBlock}`);
    }

    game.players[attack.player].discard.push(attack.card);
    for (const block of attack.block) {
      game.players[block.player].discard.push(block.card);
    }
  }
  
  for (let i = 0; i < game.lanes.length; i++) {
    const lane = game.lanes[i];
    if (lane.attack) {
      let totalBlock = 0;
      for (const block of lane.block) {
        totalBlock += block.effectiveValue || 0;
      }
      const damage = Math.max(0, (lane.attack.effectiveValue || 0) - totalBlock);
      const defender = getOtherPlayer(lane.attack.player);
      const blockedText = totalBlock > 0 ? ` after ${totalBlock} block` : "";
      if (damage > 0) {
        game.players[defender].life -= damage;
        damageMessages.push(`Lane ${i + 1} attack ${describeCardValue(lane.attack.card, lane.attack.effectiveValue, lane.attack.notes)}${blockedText} = ${damage} damage to Player ${defender}`);
      } else {
        damageMessages.push(`Lane ${i + 1} attack ${describeCardValue(lane.attack.card, lane.attack.effectiveValue, lane.attack.notes)} was fully blocked by ${totalBlock}`);
      }
      game.players[lane.attack.player].discard.push(lane.attack.card);
      for (const block of lane.block) {
        game.players[block.player].discard.push(block.card);
      }
      lane.attack = null;
      lane.block = [];
    }
  }
  
  game.handAttacks = [];
  roomState.damageConfirmed = { 1: false, 2: false };
  if (damageMessages.length > 0) {
    game.lastDamageSummary = damageMessages.join(" ");
    game.message = game.lastDamageSummary;
    captureGameEvent(game);
  }
}

function resolveFreeForAllDamage(game, roomState) {
  const damageMessages = [];
  const attacks = [
    ...(game.handAttacks || []),
    ...(game.lanes || []).map((lane, laneIndex) => lane.attack ? { ...lane.attack, laneIndex } : null).filter(Boolean)
  ];

  for (const attack of attacks) {
    const totalBlock = (attack.block || []).reduce((sum, block) => sum + (block.effectiveValue || 0), 0);
    const damage = Math.max(0, (attack.effectiveValue || 0) - totalBlock);
    const defender = attack.targetPlayer;
    if (damage > 0) {
      game.players[defender].life -= damage;
      damageMessages.push(`Player ${attack.player} hit Player ${defender} for ${damage}.`);
    } else {
      damageMessages.push(`Player ${defender} fully blocked Player ${attack.player}'s attack.`);
    }
    game.players[attack.player].discard.push(attack.card);
    (attack.block || []).forEach((block) => game.players[block.player].discard.push(block.card));
  }

  game.lanes.forEach((lane) => {
    lane.attack = null;
    lane.block = [];
  });
  game.handAttacks = [];
  getActivePlayerNumbers(game).forEach((playerNum) => {
    if (game.players[playerNum].life <= 0) game.players[playerNum].eliminated = true;
  });
  roomState.damageConfirmed = {};
  getActivePlayerNumbers(game).forEach((playerNum) => {
    roomState.damageConfirmed[playerNum] = false;
  });
  if (damageMessages.length > 0) {
    game.lastDamageSummary = damageMessages.join(" ");
    game.message = game.lastDamageSummary;
    captureGameEvent(game);
  }
}

function startEndPhase(game) {
  game.phase = "end";
  game.endPlacementLaneIndex = 0;
  game.endPlacementFirstPlayer = game.startingPriorityThisTurn;
  game.endPlacementStep = 0;
  if (game.gameMode === "freeForAll") {
    game.endPlaced = {};
    getActivePlayerNumbers(game).forEach((playerNum) => {
      game.endPlaced[playerNum] = [false, false, false];
    });
  } else {
    game.endPlaced = { 1: [false, false, false], 2: [false, false, false] };
  }
  game.message = "End of Turn Phase - Place facedown cards in lanes";
}

async function advanceEndPlacement(roomState) {
  const game = roomState.game;
  game.endPlacementStep++;
  
  const activeCount = game.gameMode === "freeForAll" ? getActivePlayerNumbers(game).length : 2;
  if (game.endPlacementStep >= activeCount) {
    game.endPlacementLaneIndex++;
    game.endPlacementStep = 0;
  }
  
  if (game.endPlacementLaneIndex >= 3) {
    const playerNumbers = game.gameMode === "freeForAll" ? getActivePlayerNumbers(game) : [1, 2];
    for (const p of playerNumbers) {
      const player = game.players[p];
      while (player.hand.length < 8 && player.deck.length > 0) {
        player.hand.push(player.deck.pop());
      }
    }

    game.phase = "priority";
    game.turn++;
    game.priority = game.gameMode === "freeForAll" ? getNextActivePlayer(game, game.startingPriorityThisTurn) : getOtherPlayer(game.startingPriorityThisTurn);
    game.startingPriorityThisTurn = game.priority;
    game.lastActivePlayer = game.priority;
    game.mostRecentAttackDefender = null;
    resetPriorityPassed(game);
    
    clearEndTurnBuffs(game);
    for (const p of playerNumbers) {
      game.players[p].turnData = createTurnData();
    }
    if (game.campaign) game.campaign.bossAttacksThisTurn = 0;
    game.message = `Turn ${game.turn} - Player ${game.priority} has priority`;
  }
}

function isTrainingAiRoom(roomState) {
  return !!roomState?.lobby?.players?.[2]?.isAI;
}

function getCurrentEndPlacementPlayer(game) {
  if (game.gameMode === "freeForAll") {
    const active = getActivePlayerNumbers(game);
    const startIndex = active.indexOf(game.endPlacementFirstPlayer);
    return active[(startIndex + game.endPlacementStep) % active.length] || active[0];
  }
  return game.endPlacementStep === 0 ? game.endPlacementFirstPlayer : getOtherPlayer(game.endPlacementFirstPlayer);
}

function findAiPaymentIndexes(hand, required, excludedIndexes = []) {
  const excluded = new Set(excludedIndexes);
  const candidates = hand
    .map((card, index) => ({ card, index, value: getBaseCardValue(card) }))
    .filter((entry) => !excluded.has(entry.index))
    .sort((a, b) => a.value - b.value);
  const indexes = [];
  let total = 0;
  for (const candidate of candidates) {
    indexes.push(candidate.index);
    total += candidate.value;
    if (total >= required) return indexes;
  }
  return null;
}

function declareAiHandAttack(roomState) {
  const game = roomState.game;
  const ai = game.players[2];
  const options = ai.hand
    .map((card, index) => ({ card, index, value: getBaseCardValue(card) }))
    .sort((a, b) => a.value - b.value);

  for (const option of options) {
    const paymentIndexes = findAiPaymentIndexes(ai.hand, option.value, [option.index]);
    if (!paymentIndexes) continue;

    const attackCard = ai.hand[option.index];
    const paymentTotal = getPaymentTotal(ai, paymentIndexes, false).total;
    removeSelectedCardAndPayments(ai, option.index, paymentIndexes);
    addAccelerationIfOverpaid(ai, paymentTotal, option.value);
    const attackInfo = finalizeAttackDeclaration(ai, attackCard, calculateAttackBonuses(ai, attackCard), false);
    const attack = {
      id: `attack-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      player: 2,
      card: attackCard,
      source: "hand",
      effectiveValue: attackInfo.effectiveValue,
      block: [],
      notes: attackInfo.notes
    };

    game.handAttacks.push(attack);
    resetPriorityPassed(game);
    game.priority = 1;
    game.mostRecentAttackDefender = 1;
    game.message = `Training AI attacked with ${describeCardValue(attackCard, attackInfo.effectiveValue, attackInfo.notes)} from hand. Player 1 can block or pass.`;
    return true;
  }

  return false;
}

function declareCampaignBossAttack(roomState) {
  const game = roomState.game;
  const ai = game.players[2];
  const campaign = game.campaign;
  if (!campaign) return false;

  const attackNumber = (campaign.bossAttacksThisTurn || 0) + 1;
  const minValue = campaign.minAttackValue || 5;
  const maxValue = campaign.maxAttackValue || 8;
  const valueRange = Math.max(1, maxValue - minValue + 1);
  const value = minValue + ((game.turn + attackNumber + (campaign.chapterNumber || 1)) % valueRange);
  const suits = ["â™ ", "â™¥", "â™¦", "â™£"];
  const suit = suits[(game.turn + attackNumber + (campaign.chapterNumber || 1)) % suits.length];
  const rankNames = { 11: "J", 12: "Q", 13: "K", 14: "A" };
  const rank = rankNames[value] || String(value);
  const attackCard = {
    id: `campaign-${campaign.chapterId}-${game.turn}-${attackNumber}-${Date.now()}`,
    value,
    suit,
    rank,
    name: `${campaign.opponentName} Strike ${attackNumber}`,
    faction: ai.faction.name,
    factionId: ai.faction.id,
    image: ai.faction.cardImage,
    campaignBossCard: true
  };
  const attack = {
    id: `attack-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    player: 2,
    card: attackCard,
    source: "campaignBoss",
    effectiveValue: value,
    block: [],
    notes: [`Boss strike ${attackNumber}/${campaign.attacksPerTurn}`],
    payment: { player: 2, cards: [], total: 0, required: 0, campaignBoss: true }
  };

  campaign.bossAttacksThisTurn = attackNumber;
  game.handAttacks.push(attack);
  resetPriorityPassed(game);
  game.priority = 1;
  game.mostRecentAttackDefender = 1;
  game.message = `${campaign.opponentName} launched scripted attack ${attackNumber}/${campaign.attacksPerTurn}: ${describeCardValue(attackCard, value, attack.notes)}. Player 1 can block or pass.`;
  return true;
}

async function aiResolveDamageIfReady(roomState) {
  const game = roomState.game;
  if (game.phase !== "damage") return false;
  await resolveCombatAndResumePriority(roomState);
  return true;
}

async function aiPassPriority(roomState) {
  const game = roomState.game;
  const aiName = game.campaign?.opponentName || "Training AI";
  game.priorityPassed[2] = true;
  game.message = `${aiName} passed priority.`;

    if (game.priorityPassed[1] && game.priorityPassed[2]) {
      if (hasPendingAttacks(game)) {
        await resolveCombatAndResumePriority(roomState);
      } else if (await finishGameIfLifeCheckFails(roomState)) {
        return true;
      } else {
        startEndPhase(game);
      }
    resetPriorityPassed(game);
  } else {
    game.priority = 1;
  }
}

function getPendingAttackList(game) {
  return [
    ...(game.handAttacks || []),
    ...(game.lanes || []).map((lane) => lane.attack).filter(Boolean)
  ];
}

function aiNeedsLaneSetup(game) {
  const ai = game.players[2];
  return ai.hand.length > 0 && game.lanes.some((lane) => !lane.facedown[2]);
}

async function aiEndPlacement(roomState) {
  const game = roomState.game;
  const ai = game.players[2];
  const aiName = game.campaign?.opponentName || "Training AI";
  const lane = game.endPlacementLaneIndex;
  if (game.phase !== "end" || getCurrentEndPlacementPlayer(game) !== 2) return false;

  if (!game.lanes[lane].facedown[2] && ai.hand.length > 0) {
    const card = ai.hand.splice(0, 1)[0];
    game.lanes[lane].facedown[2] = card;
    game.endPlaced[2][lane] = true;
    game.message = `${aiName} placed a face-down card in lane ${lane + 1}.`;
  } else {
    game.endPlaced[2][lane] = true;
    game.message = `${aiName} skipped lane ${lane + 1}.`;
  }

  await advanceEndPlacement(roomState);
  return true;
}

async function runTrainingAi(roomState) {
  if (!isTrainingAiRoom(roomState) || !roomState.game || roomState.game.phase === "gameOver") return;
  const game = roomState.game;
  let acted = false;

  if (game.phase === "damage") {
    acted = await aiResolveDamageIfReady(roomState);
  } else if (game.phase === "end") {
    acted = await aiEndPlacement(roomState);
  } else if (game.phase === "priority" && game.priority === 2) {
    const pendingAttacks = getPendingAttackList(game);
    const humanStillDefendingAiAttack = pendingAttacks.some((attack) => attack.player === 2 && !(game.priorityPassed?.[1]) && (!attack.block || attack.block.length === 0));
    if (humanStillDefendingAiAttack) {
      game.priority = 1;
      game.message = "Player 1 can block or pass.";
      acted = true;
    } else if (game.campaign) {
      if (pendingAttacks.length > 0) {
        await aiPassPriority(roomState);
        acted = true;
      } else if ((game.campaign.bossAttacksThisTurn || 0) < game.campaign.attacksPerTurn) {
        acted = declareCampaignBossAttack(roomState);
      } else {
        await aiPassPriority(roomState);
        acted = true;
      }
    } else if (pendingAttacks.length > 0 || aiNeedsLaneSetup(game)) {
      await aiPassPriority(roomState);
      acted = true;
    } else {
      acted = declareAiHandAttack(roomState);
      if (!acted) {
        await aiPassPriority(roomState);
        acted = true;
      }
    }
  }

  if (acted) {
    emitState(roomState);
    scheduleTrainingAi(roomState);
  }
}

function scheduleTrainingAi(roomState) {
  if (!isTrainingAiRoom(roomState) || roomState.aiMoveTimer) return;
  roomState.aiMoveTimer = setTimeout(() => {
    roomState.aiMoveTimer = null;
    runTrainingAi(roomState).catch((error) => console.error("[TrainingAI] Failed", error));
  }, 650);
}

function createGameFromLobby(roomState) {
  if (isFreeForAllRoom(roomState)) {
    createFreeForAllGameFromLobby(roomState);
    return;
  }
  const gameMode = getLobbyGameMode(roomState);
  const faction1 = gameMode === "basic" ? basicGameProfile : getFactionById(roomState.lobby.players[1].factionId);
  const faction2 = gameMode === "basic" ? basicGameProfile : getFactionById(roomState.lobby.players[2].factionId);
  const startingPriority = Math.random() < 0.5 ? 1 : 2;
  
  const suits = ["♠", "♥", "♦", "♣"];
  const values = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const rankNames = { 11: "J", 12: "Q", 13: "K", 14: "A" };
  
  function createDeck(faction) {
    const deck = [];
    for (const suit of suits) {
      for (const value of values) {
        deck.push({
          id: `card-${Math.random().toString(36).slice(2)}-${Date.now()}`,
          value: value,
          suit: suit,
          name: `${rankNames[value] || value} of ${suit}`,
          rank: rankNames[value] || String(value),
          faction: faction.name,
          factionId: faction.id,
          image: faction.cardImage
        });
      }
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }
  
  const game = {
    roomCode: roomState.roomCode,
    gameMode,
    phase: "priority",
    turn: 1,
    priority: startingPriority,
    startingPriorityThisTurn: startingPriority,
    lastActivePlayer: startingPriority,
    mostRecentAttackDefender: null,
    priorityPassed: { 1: false, 2: false },
    players: {
      1: {
        accountName: roomState.lobby.players[1].accountName || null,
        faction: faction1,
        life: 42,
        hand: [],
        deck: createDeck(faction1),
        discard: [],
        lanes: [null, null, null],
        connected: true,
        turnData: createTurnData(),
        accelerationCounters: 0
      },
      2: {
        accountName: roomState.lobby.players[2].accountName || null,
        faction: faction2,
        life: 42,
        hand: [],
        deck: createDeck(faction2),
        discard: [],
        lanes: [null, null, null],
        connected: true,
        turnData: createTurnData(),
        accelerationCounters: 0
      }
    },
    lanes: [
      { facedown: { 1: null, 2: null }, attack: null, block: [] },
      { facedown: { 1: null, 2: null }, attack: null, block: [] },
      { facedown: { 1: null, 2: null }, attack: null, block: [] }
    ],
    handAttacks: [],
    paymentLog: [],
    lastDamageSummary: "",
    endPlacementLaneIndex: 0,
    endPlacementFirstPlayer: null,
    endPlacementStep: 0,
    endPlaced: { 1: [false, false, false], 2: [false, false, false] },
    winner: null,
    drawOfferBy: null,
    message: `Turn 1 - Player ${startingPriority} starts with priority`,
    eventLog: []
  };
  
  for (const p of [1, 2]) {
    for (let i = 0; i < 8; i++) {
      if (game.players[p].deck.length > 0) {
        game.players[p].hand.push(game.players[p].deck.pop());
      }
    }
  }
  
  roomState.game = game;
  roomState.damageConfirmed = { 1: false, 2: false };
}

function createFreeForAllGameFromLobby(roomState) {
  const seatedPlayers = getConnectedLobbyPlayerNumbers(roomState).filter((playerNum) => roomState.lobby.players[playerNum].factionId);
  const startingPriority = seatedPlayers[Math.floor(Math.random() * seatedPlayers.length)];
  const suits = ["â™ ", "â™¥", "â™¦", "â™£"];
  const values = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const rankNames = { 11: "J", 12: "Q", 13: "K", 14: "A" };

  function createDeck(faction) {
    const deck = [];
    for (const suit of suits) {
      for (const value of values) {
        deck.push({
          id: `card-${Math.random().toString(36).slice(2)}-${Date.now()}`,
          value,
          suit,
          name: `${rankNames[value] || value} of ${suit}`,
          rank: rankNames[value] || String(value),
          faction: faction.name,
          factionId: faction.id,
          image: faction.cardImage
        });
      }
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  const players = {};
  const facedownTemplate = {};
  const endPlaced = {};
  const priorityPassed = {};
  const damageConfirmed = {};

  seatedPlayers.forEach((playerNum) => {
    const faction = getFactionById(roomState.lobby.players[playerNum].factionId);
    players[playerNum] = {
      accountName: roomState.lobby.players[playerNum].accountName || null,
      faction,
      life: 42,
      hand: [],
      deck: createDeck(faction),
      discard: [],
      lanes: [null, null, null],
      connected: true,
      turnData: createTurnData(),
      accelerationCounters: 0,
      eliminated: false
    };
    facedownTemplate[playerNum] = null;
    endPlaced[playerNum] = [false, false, false];
    priorityPassed[playerNum] = false;
    damageConfirmed[playerNum] = false;
  });

  const game = {
    roomCode: roomState.roomCode,
    gameMode: "freeForAll",
    playerOrder: seatedPlayers,
    phase: "priority",
    turn: 1,
    priority: startingPriority,
    startingPriorityThisTurn: startingPriority,
    lastActivePlayer: startingPriority,
    mostRecentAttackDefender: null,
    priorityPassed,
    players,
    lanes: [
      { facedown: { ...facedownTemplate }, attack: null, block: [] },
      { facedown: { ...facedownTemplate }, attack: null, block: [] },
      { facedown: { ...facedownTemplate }, attack: null, block: [] }
    ],
    handAttacks: [],
    paymentLog: [],
    lastDamageSummary: "",
    endPlacementLaneIndex: 0,
    endPlacementFirstPlayer: null,
    endPlacementStep: 0,
    endPlaced,
    winner: null,
    drawOfferBy: null,
    message: `Free-for-all started. Player ${startingPriority} starts with priority.`,
    eventLog: []
  };

  seatedPlayers.forEach((playerNum) => {
    for (let i = 0; i < 8; i++) {
      if (players[playerNum].deck.length > 0) players[playerNum].hand.push(players[playerNum].deck.pop());
    }
  });

  roomState.game = game;
  roomState.damageConfirmed = damageConfirmed;
}

// ============ SOCKET HANDLERS ============
io.on("connection", (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  socket.on("joinMatchmaking", async ({ authToken } = {}) => {
    console.log("[Socket] joinMatchmaking");
    const account = await getAccountRecordFromToken(authToken || socket.data.authToken);
    if (!account) {
      socket.emit("matchmakingStatus", { inQueue: false, message: "Sign in to use matchmaking." });
      return;
    }
    if (socket.data.roomCode) {
      socket.emit("matchmakingStatus", { inQueue: false, message: "Leave your current room before entering matchmaking." });
      return;
    }

    removeFromMatchmaking(socket.id);
    const profile = getAccountMatchProfile(account);
    const entry = {
      socketId: socket.id,
      accountId: account.id,
      accountName: account.name,
      winRatio: profile.winRatio,
      gamesPlayed: profile.gamesPlayed,
      joinedAt: Date.now()
    };

    const match = findMatchForEntry(entry);
    if (match) {
      removeFromMatchmaking(match.socketId);
      createMatchedRoom(entry, match);
      return;
    }

    matchmakingQueue.push(entry);
    socket.data.authToken = authToken || socket.data.authToken;
    socket.emit("matchmakingStatus", {
      inQueue: true,
      message: `Searching for a similar record... ${matchmakingQueue.length} player${matchmakingQueue.length === 1 ? "" : "s"} in queue.`,
      queueSize: matchmakingQueue.length
    });
  });

  socket.on("leaveMatchmaking", () => {
    removeFromMatchmaking(socket.id);
    socket.emit("matchmakingStatus", { inQueue: false, message: "Left matchmaking queue." });
  });
  
  socket.on("createRoom", async ({ authToken, guestName } = {}) => {
    console.log("[Socket] createRoom");
    removeFromMatchmaking(socket.id);
    const identity = await requirePlayerIdentity(socket, authToken, guestName);
    if (!identity) return;
    const roomState = createRoom();
    roomState.lobby.players[1].socket = socket.id;
    roomState.lobby.players[1].connected = true;
    roomState.lobby.players[1].reconnectToken = makeReconnectToken();
    roomState.lobby.players[1].accountId = identity.id;
    roomState.lobby.players[1].accountName = identity.name;
    roomState.lobby.players[1].isGuest = identity.type === "guest";
    await touchAccountStats(identity.id, "gamesCreated");
    attachPlayerSocket(roomState, socket, 1);
    emitLobbyState(roomState);
  });

  socket.on("createFreeForAllRoom", async ({ authToken, guestName } = {}, ack) => {
    console.log("[Socket] createFreeForAllRoom");
    removeFromMatchmaking(socket.id);
    const identity = await requirePlayerIdentity(socket, authToken, guestName);
    if (!identity) {
      if (typeof ack === "function") ack({ ok: false, error: "Sign in or enter a guest name first." });
      return;
    }
    const roomState = createFreeForAllRoom();
    const lobbyPlayer = roomState.lobby.players[1];
    lobbyPlayer.socket = socket.id;
    lobbyPlayer.connected = true;
    lobbyPlayer.reconnectToken = makeReconnectToken();
    lobbyPlayer.accountId = identity.id;
    lobbyPlayer.accountName = identity.name;
    lobbyPlayer.isGuest = identity.type === "guest";
    await touchAccountStats(identity.id, "gamesCreated");
    attachPlayerSocket(roomState, socket, 1);
    emitLobbyState(roomState);
    if (typeof ack === "function") ack({ ok: true, roomCode: roomState.roomCode, gameMode: "freeForAll" });
  });

  socket.on("createAiTutorialRoom", async ({ authToken, guestName, mode } = {}) => {
    console.log("[Socket] createAiTutorialRoom");
    removeFromMatchmaking(socket.id);
    const identity = await requirePlayerIdentity(socket, authToken, guestName);
    if (!identity) return;

    const aiMode = mode === "factions" ? "factions" : "basic";
    const aiFaction = listFactions()[Math.floor(Math.random() * listFactions().length)];
    const roomState = createRoom();
    roomState.lobby.gameMode = aiMode;
    roomState.lobby.players[1].socket = socket.id;
    roomState.lobby.players[1].connected = true;
    roomState.lobby.players[1].reconnectToken = makeReconnectToken();
    roomState.lobby.players[1].accountId = identity.id;
    roomState.lobby.players[1].accountName = identity.name;
    roomState.lobby.players[1].isGuest = identity.type === "guest";
    roomState.lobby.players[2].connected = true;
    roomState.lobby.players[2].accountId = null;
    roomState.lobby.players[2].accountName = "Training AI";
    roomState.lobby.players[2].factionId = aiMode === "factions" ? aiFaction.id : null;
    roomState.lobby.players[2].isGuest = false;
    roomState.lobby.players[2].isAI = true;
    await touchAccountStats(identity.id, "gamesCreated");
    attachPlayerSocket(roomState, socket, 1);

    if (aiMode === "factions") {
      emitLobbyState(roomState);
      return;
    }

    createGameFromLobby(roomState);
    roomState.game.players[2].connected = true;
    roomState.game.players[2].accountName = "Training AI";
    roomState.game.message = `Tutorial game started. Player ${roomState.game.priority} has priority.`;
    emitState(roomState);
    scheduleTrainingAi(roomState);
  });

  socket.on("createCampaignRoom", async ({ authToken, guestName, factionId, chapterId } = {}) => {
    console.log(`[Socket] createCampaignRoom: faction=${factionId}, chapter=${chapterId}`);
    removeFromMatchmaking(socket.id);
    const identity = await requirePlayerIdentity(socket, authToken, guestName);
    if (!identity) return;

    const faction = getFactionById(factionId);
    const chapter = getCampaignChapter(factionId, chapterId);
    if (!faction || !chapter) {
      socket.emit("errorMessage", "Choose a valid campaign chapter.");
      return;
    }

    const difficulty = getCampaignDifficulty(factionId, chapterId);
    const roomState = createRoom();
    roomState.lobby.gameMode = "factions";
    roomState.lobby.campaign = { factionId, chapterId, title: chapter.title, story: chapter.story, opponentName: chapter.opponentName, playableName: chapter.playableName || faction.commander?.name || faction.name, dialogue: chapter.dialogue || [], ...difficulty, bossAttacksThisTurn: 0 };
    roomState.lobby.players[1].socket = socket.id;
    roomState.lobby.players[1].connected = true;
    roomState.lobby.players[1].reconnectToken = makeReconnectToken();
    roomState.lobby.players[1].accountId = identity.id;
    roomState.lobby.players[1].accountName = identity.name;
    roomState.lobby.players[1].factionId = factionId;
    roomState.lobby.players[1].isGuest = identity.type === "guest";
    roomState.lobby.players[2].connected = true;
    roomState.lobby.players[2].accountId = null;
    roomState.lobby.players[2].accountName = chapter.opponentName;
    roomState.lobby.players[2].factionId = factionId;
    roomState.lobby.players[2].isGuest = false;
    roomState.lobby.players[2].isAI = true;
    await touchAccountStats(identity.id, "gamesCreated");
    attachPlayerSocket(roomState, socket, 1);

    createGameFromLobby(roomState);
    roomState.game.campaign = roomState.lobby.campaign;
    roomState.game.players[2].connected = true;
    roomState.game.players[2].accountName = chapter.opponentName;
    roomState.game.players[2].life = difficulty.bossLife;
    roomState.game.message = `${chapter.title}: ${chapter.story} ${chapter.opponentName} starts at ${difficulty.bossLife} life and can launch ${difficulty.attacksPerTurn} scripted attacks per turn. Player ${roomState.game.priority} has priority.`;
    emitState(roomState);
    scheduleTrainingAi(roomState);
  });

  socket.on("joinRoom", async ({ roomCode, asSpectator = false, authToken, guestName, reconnectToken } = {}) => {
    console.log(`[Socket] joinRoom: ${roomCode}, spectator: ${asSpectator}`);
    removeFromMatchmaking(socket.id);
    if (!roomCode) {
      socket.emit("errorMessage", "Enter a room code.");
      return;
    }
    const normalized = roomCode.toUpperCase();
    const roomState = getRoom(normalized);
    if (!roomState) {
      socket.emit("errorMessage", "Room not found.");
      return;
    }
    if (asSpectator) {
      roomState.lobby.spectators.push(socket.id);
      socket.join(normalized);
      socket.data.roomCode = normalized;
      socket.data.role = "spectator";
      socket.emit("assignSpectator", { role: "spectator", roomCode: normalized });
      const spectatorAccount = await getAccountFromToken(authToken);
      if (spectatorAccount) await touchAccountStats(spectatorAccount.id, "gamesSpectated");
      if (roomState.game) emitState(roomState);
      else emitLobbyState(roomState);
      return;
    }
    const identity = await requirePlayerIdentity(socket, authToken, guestName);
    if (!identity) return;
    const reconnectSeat = getDisconnectedSeatForIdentity(roomState, identity, reconnectToken);
    if (reconnectSeat) {
      attachPlayerSocket(roomState, socket, reconnectSeat);
      if (roomState.game) emitState(roomState);
      else emitLobbyState(roomState);
      return;
    }
    const openSeat = getLobbyPlayerNumbers(roomState).find((seat) => !roomState.lobby.players[seat].socket && !roomState.lobby.players[seat].reconnectToken);
    if (openSeat) {
      roomState.lobby.players[openSeat].reconnectToken = makeReconnectToken();
      roomState.lobby.players[openSeat].accountId = identity.id;
      roomState.lobby.players[openSeat].accountName = identity.name;
      roomState.lobby.players[openSeat].isGuest = identity.type === "guest";
      await touchAccountStats(identity.id, "gamesJoined");
      attachPlayerSocket(roomState, socket, openSeat);
      emitLobbyState(roomState);
      return;
    }
    socket.emit("errorMessage", "Room is full. Join as spectator instead.");
  });

  socket.on("reconnectToRoom", async ({ roomCode, reconnectToken, authToken, role } = {}) => {
    console.log(`[Socket] reconnectToRoom: ${roomCode}`);
    if (!roomCode) {
      socket.emit("errorMessage", "No room to reconnect to.");
      return;
    }

    const normalized = String(roomCode).toUpperCase();
    const roomState = getRoom(normalized);
    if (!roomState) {
      socket.emit("errorMessage", "That room is no longer active.");
      return;
    }

    const playerNum = await getReconnectPlayerNumber(roomState, reconnectToken, authToken);
    if (playerNum) {
      attachPlayerSocket(roomState, socket, playerNum);
      if (roomState.game) emitState(roomState);
      else emitLobbyState(roomState);
      return;
    }

    const requestedRole = role || socket.data.role;
    if (requestedRole === "spectator") {
      if (!roomState.lobby.spectators.includes(socket.id)) roomState.lobby.spectators.push(socket.id);
      socket.join(normalized);
      socket.data.roomCode = normalized;
      socket.data.role = "spectator";
      socket.emit("assignSpectator", { role: "spectator", roomCode: normalized });
      if (roomState.game) emitState(roomState);
      else emitLobbyState(roomState);
      return;
    }

    socket.emit("errorMessage", "Could not reconnect to that player seat.");
  });

  socket.on("selectFaction", ({ factionId }) => {
    console.log(`[Socket] selectFaction: ${factionId}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState || roomState.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    if (getLobbyGameMode(roomState) === "basic") {
      socket.emit("errorMessage", "Basic Mode does not use factions.");
      return;
    }
    if (!getFactionById(factionId)) {
      socket.emit("errorMessage", "Choose a valid faction.");
      return;
    }
    roomState.lobby.players[playerNum].factionId = factionId;
    resetStartConfirmations(roomState);
    emitLobbyState(roomState);
  });

  socket.on("setGameMode", ({ mode } = {}) => {
    console.log(`[Socket] setGameMode: ${mode}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState || roomState.game) return;
    if (isFreeForAllRoom(roomState)) {
      socket.emit("errorMessage", "Free-for-all rooms use faction mode.");
      return;
    }
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (playerNum !== 1) {
      socket.emit("errorMessage", "Only Player 1 can set the room mode.");
      return;
    }
    const nextMode = mode === "basic" ? "basic" : "factions";
    roomState.lobby.gameMode = nextMode;
    resetStartConfirmations(roomState);
    if (nextMode === "basic") {
      roomState.lobby.players[1].factionId = null;
      roomState.lobby.players[2].factionId = null;
    }
    emitLobbyState(roomState);
  });

  socket.on("startGame", () => {
    console.log(`[Socket] startGame`);
    const roomState = getRoomForSocket(socket);
    if (!roomState || roomState.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    if (!roomPlayersReady(roomState)) {
      const mode = getLobbyGameMode(roomState);
      socket.emit("errorMessage", mode === "basic" ? "Both player seats must be filled first." : mode === "freeForAll" ? "At least two connected players must select a faction first." : "Both players must select a faction first.");
      return;
    }
    roomState.lobby.players[playerNum].readyToStart = true;
    if (!playersConfirmedStart(roomState)) {
      emitLobbyState(roomState);
      socket.emit("errorMessage", isFreeForAllRoom(roomState) ? "Waiting for the other seated players to confirm start." : `Player ${getOtherPlayer(playerNum)} must also confirm start.`);
      return;
    }
    createGameFromLobby(roomState);
    emitState(roomState);
    scheduleTrainingAi(roomState);
  });

  socket.on("passPriority", async () => {
    console.log(`[Socket] passPriority`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    
    if (game.phase !== "priority") {
      socket.emit("errorMessage", "Not in priority phase");
      return;
    }
    if (game.priority !== playerNum) {
      socket.emit("errorMessage", "Not your priority to pass");
      return;
    }

    if (game.gameMode === "freeForAll") {
      saveUndoSnapshot(roomState, playerNum, "passed priority");
      const ended = await handleFreeForAllPriorityPass(roomState, playerNum);
      emitState(roomState);
      if (!ended) scheduleTrainingAi(roomState);
      return;
    }
    
    saveUndoSnapshot(roomState, playerNum, "passed priority");
    game.priorityPassed[playerNum] = true;
    const passingAsBasicDefender =
      game.gameMode === "basic" &&
      getPendingAttackList(game).some((attack) => attack.player === getOtherPlayer(playerNum) && (!attack.block || attack.block.length === 0));
    if (passingAsBasicDefender) {
      await resolveCombatAndResumePriority(roomState);
      emitState(roomState);
      scheduleTrainingAi(roomState);
      return;
    }

    game.message = `Player ${playerNum} passed priority (P1: ${game.priorityPassed[1] ? "✓" : "○"}, P2: ${game.priorityPassed[2] ? "✓" : "○"})`;
    
    if (game.priorityPassed[1] && game.priorityPassed[2]) {
      if (hasPendingAttacks(game)) {
        await resolveCombatAndResumePriority(roomState);
      } else if (await finishGameIfLifeCheckFails(roomState)) {
        emitState(roomState);
        scheduleTrainingAi(roomState);
        return;
      } else {
        startEndPhase(game);
      }
      resetPriorityPassed(game);
    } else {
      game.priority = getOtherPlayer(playerNum);
    }
    
    emitState(roomState);
    scheduleTrainingAi(roomState);
  });

  socket.on("resolveDamage", async () => {
    console.log(`[Socket] resolveDamage`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    
    if (game.phase !== "damage") {
      socket.emit("errorMessage", "Not in damage phase");
      return;
    }
    
    saveUndoSnapshot(roomState, playerNum, "confirmed damage");
    roomState.damageConfirmed[playerNum] = true;
    const waitingPlayers = getWaitingDamagePlayers(roomState);
    game.message = waitingPlayers.length === 0
      ? `Player ${playerNum} confirmed damage. Resolving damage now.`
      : `Player ${playerNum} confirmed damage. Waiting on ${waitingPlayers.map((p) => `Player ${p}`).join(", ")} to confirm resolve damage.`;
    emitState(roomState);
    scheduleTrainingAi(roomState);
    
    if (allDamagePlayersConfirmed(roomState)) {
      console.log("[resolveDamage] All confirmed - resolving");
      resolveDamage(game, roomState);
      if (game.gameMode === "freeForAll" && await finishGameIfLifeCheckFails(roomState)) {
        emitState(roomState);
        scheduleTrainingAi(roomState);
        return;
      }
      game.phase = "priority";
      game.priority = game.gameMode === "freeForAll"
        ? (game.mostRecentAttackDefender && !game.players[game.mostRecentAttackDefender]?.eliminated ? game.mostRecentAttackDefender : getActivePlayerNumbers(game)[0])
        : game.mostRecentAttackDefender || getOtherPlayer(game.priority);
      game.lastActivePlayer = game.priority;
      game.mostRecentAttackDefender = null;
      resetPriorityPassed(game);
      game.message = `${game.lastDamageSummary ? `${game.lastDamageSummary} ` : ""}Damage resolved. Player ${game.priority} has priority. Life totals will be checked at end of turn.`;
      
      emitState(roomState);
      scheduleTrainingAi(roomState);
    }
  });

  socket.on("concedeGame", async () => {
    console.log("[Socket] concedeGame");
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;

    if (game.phase === "gameOver") {
      socket.emit("errorMessage", "Game is already over");
      return;
    }

    if (game.gameMode === "freeForAll") {
      game.players[playerNum].eliminated = true;
      game.players[playerNum].life = Math.min(game.players[playerNum].life, 0);
      const activePlayers = getActivePlayerNumbers(game);
      game.drawOfferBy = null;
      if (activePlayers.length <= 1) {
        const winner = activePlayers[0] || null;
        game.phase = "gameOver";
        game.winner = winner;
        game.message = winner == null ? `Player ${playerNum} conceded. Free-for-all ends in a draw.` : `Player ${playerNum} conceded. Player ${winner} wins the free-for-all!`;
        await recordFinalGameStats(roomState);
        io.to(roomState.roomCode).emit("gameEnded", { winner, tie: winner == null, concededBy: playerNum });
      } else {
        if (game.priority === playerNum) game.priority = activePlayers[0];
        game.message = `Player ${playerNum} conceded and is eliminated. ${activePlayers.length} players remain.`;
      }
      emitState(roomState);
      scheduleTrainingAi(roomState);
      return;
    }

    const winner = getOtherPlayer(playerNum);
    game.phase = "gameOver";
    game.winner = winner;
    game.drawOfferBy = null;
    game.message = `Player ${playerNum} conceded. Player ${winner} wins!`;
    await recordFinalGameStats(roomState);
    io.to(roomState.roomCode).emit("gameEnded", { winner, tie: false, concededBy: playerNum });
    emitState(roomState);
    scheduleTrainingAi(roomState);
  });

  socket.on("offerDraw", async () => {
    console.log("[Socket] offerDraw");
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;

    if (game.phase === "gameOver") {
      socket.emit("errorMessage", "Game is already over");
      return;
    }

    if (game.gameMode === "freeForAll") {
      socket.emit("errorMessage", "Intentional draws are only available in two-player games.");
      return;
    }

    if (game.drawOfferBy && game.drawOfferBy !== playerNum) {
      game.phase = "gameOver";
      game.winner = null;
      game.drawOfferBy = null;
      game.message = "Players agreed to an intentional draw.";
      await recordFinalGameStats(roomState);
      io.to(roomState.roomCode).emit("gameEnded", { winner: null, tie: true, intentionalDraw: true });
      emitState(roomState);
      return;
    }

    if (game.drawOfferBy === playerNum) {
      socket.emit("errorMessage", "You already offered an intentional draw");
      return;
    }

    game.drawOfferBy = playerNum;
    game.message = `Player ${playerNum} offered an intentional draw. Player ${getOtherPlayer(playerNum)} may accept.`;
    emitState(roomState);
    scheduleTrainingAi(roomState);
  });

  socket.on("requestUndo", () => {
    console.log("[Socket] requestUndo");
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const snapshot = getUndoSnapshots(roomState)[playerNum];
    if (!snapshot || snapshot.requester !== playerNum) {
      socket.emit("errorMessage", "No recent move available to undo.");
      return;
    }

    const approvalPlayers = getUndoApprovalPlayers(roomState, playerNum);
    if (approvalPlayers.length === 0) {
      if (restoreUndoSnapshot(roomState, playerNum)) emitState(roomState);
      scheduleTrainingAi(roomState);
      return;
    }

    roomState.game.undoRequest = {
      requester: playerNum,
      label: snapshot.label,
      approvalsNeeded: approvalPlayers,
      approvals: {},
      createdAt: new Date().toISOString()
    };
    roomState.game.message = `Player ${playerNum} requested undo: ${snapshot.label}. Waiting for ${approvalPlayers.map((p) => `Player ${p}`).join(", ")} to approve.`;
    emitState(roomState);
  });

  socket.on("respondUndo", ({ approve } = {}) => {
    console.log("[Socket] respondUndo");
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game?.undoRequest) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const request = roomState.game.undoRequest;
    if (!request.approvalsNeeded?.includes(playerNum)) {
      socket.emit("errorMessage", "You are not the player who can approve this undo.");
      return;
    }

    if (!approve) {
      roomState.game.message = `Player ${playerNum} declined Player ${request.requester}'s undo request.`;
      roomState.game.undoRequest = null;
      emitState(roomState);
      return;
    }

    request.approvals[playerNum] = true;
    const allApproved = request.approvalsNeeded.every((approver) => request.approvals[approver]);
    if (allApproved) {
      restoreUndoSnapshot(roomState, request.requester);
    } else {
      roomState.game.message = `Player ${playerNum} approved undo. Waiting for the remaining approvals.`;
    }
    emitState(roomState);
    scheduleTrainingAi(roomState);
  });

  socket.on("confirmAttack", ({ from, lane, attackCardIndex, paymentIndexes, useHeraBonus, targetPlayer }) => {
    console.log(`[Socket] confirmAttack: from=${from}, lane=${lane}, idx=${attackCardIndex}, payments=${paymentIndexes}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];
    
    if (game.phase !== "priority") {
      socket.emit("errorMessage", "Not in priority phase");
      return;
    }
    if (game.priority !== playerNum) {
      socket.emit("errorMessage", "Not your priority to attack");
      return;
    }
    if (hasPendingAttacks(game)) {
      socket.emit("errorMessage", "Resolve current attacks and damage before declaring another attack");
      return;
    }
    if (from !== "hand" && from !== "lane") {
      socket.emit("errorMessage", "Invalid attack source");
      return;
    }

    const defender = game.gameMode === "freeForAll" ? Number(targetPlayer) : getOtherPlayer(playerNum);
    if (!Number.isInteger(defender) || !game.players[defender] || defender === playerNum || game.players[defender].eliminated) {
      socket.emit("errorMessage", "Choose an active opponent to attack");
      return;
    }

    const selectedAttackIndex = Number(attackCardIndex);
    const laneIndex = Number(lane);
    let attackCard;
    let paymentValidation;

    if (from === "hand") {
      if (!Number.isInteger(selectedAttackIndex) || !player.hand[selectedAttackIndex]) {
        socket.emit("errorMessage", "Invalid attack card");
        return;
      }
      attackCard = player.hand[selectedAttackIndex];
      paymentValidation = validateHandIndexes(player, paymentIndexes, [selectedAttackIndex]);
    } else {
      if (!Number.isInteger(laneIndex) || laneIndex < 0 || laneIndex >= game.lanes.length) {
        socket.emit("errorMessage", "Invalid lane");
        return;
      }
      if (game.lanes[laneIndex].attack) {
        socket.emit("errorMessage", "Lane already has an attack");
        return;
      }
      attackCard = game.lanes[laneIndex].facedown[playerNum];
      if (!attackCard) {
        socket.emit("errorMessage", "No face-down card in that lane");
        return;
      }
      paymentValidation = validateHandIndexes(player, paymentIndexes, []);
    }

    if (paymentValidation.error) {
      socket.emit("errorMessage", paymentValidation.error);
      return;
    }
    
    const attackPayment = getAttackPaymentRequirement(player, attackCard);
    const payment = getPaymentTotal(player, paymentValidation.indexes, useHeraBonus);
    const required = attackPayment.required;
    const paymentCards = getHandCardsByIndexes(player, paymentValidation.indexes);
    
    if (payment.total < required) {
      socket.emit("errorMessage", `Need ${required} payment, have ${payment.total}`);
      return;
    }

    saveUndoSnapshot(roomState, playerNum, from === "lane" ? `attacked from lane ${laneIndex + 1}` : "attacked from hand");

    if (from === "hand") {
      removeSelectedCardAndPayments(player, selectedAttackIndex, paymentValidation.indexes);
    } else {
      removeIndexesFromHandToDiscard(player, paymentValidation.indexes);
      game.lanes[laneIndex].facedown[playerNum] = null;
    }
    if (payment.heraUsedNow) player.turnData.heraUsed = true;
    addAccelerationIfOverpaid(player, payment.total, required);
    const attackInfo = finalizeAttackDeclaration(player, attackCard, calculateAttackBonuses(player, attackCard), attackPayment.freeAttackUsed);
    
    const attackId = `attack-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const attack = {
      id: attackId,
      player: playerNum,
      card: attackCard,
      source: from,
      effectiveValue: attackInfo.effectiveValue,
      block: [],
      targetPlayer: defender,
      notes: attackInfo.notes
    };
    attack.payment = {
      player: playerNum,
      cards: paymentCards,
      total: payment.total,
      required,
      heraUsed: payment.heraUsedNow
    };
    recordPaymentLog(game, {
      type: "attack",
      player: playerNum,
      cards: paymentCards,
      total: payment.total,
      required,
      label: `Player ${playerNum} paid ${payment.total}/${required} with ${describeCardList(paymentCards)} to attack with ${attackCard.name || "a card"}${from === "lane" ? ` from lane ${laneIndex + 1}` : " from hand"}.`
    });

    if (from === "hand") game.handAttacks.push(attack);
    else game.lanes[laneIndex].attack = attack;
    
    // Reset passed flags and give priority to defender
    resetPriorityPassed(game);
    game.priority = defender;
    game.mostRecentAttackDefender = game.priority;
    game.message = `Player ${playerNum} attacked with ${describeCardValue(attackCard, attackInfo.effectiveValue, attackInfo.notes)}${from === "lane" ? ` from lane ${laneIndex + 1}` : " from hand"}. Player ${game.priority} can block or pass.`;
    
    emitState(roomState);
    scheduleTrainingAi(roomState);
  });

  socket.on("confirmBlock", async ({ lane, handAttackId, blockCardIndex, blockCardIndexes, paymentIndexes, useHeraBonus }) => {
    console.log(`[Socket] confirmBlock: lane=${lane}, attackId=${handAttackId}, blockIdx=${blockCardIndex}, payments=${paymentIndexes}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];
    
    if (game.phase !== "priority") {
      socket.emit("errorMessage", "Not in priority phase");
      return;
    }
    
    const laneIndex = lane === undefined || lane === null ? null : Number(lane);
    const isLaneBlock = laneIndex !== null;
    const laneState = isLaneBlock && Number.isInteger(laneIndex) && laneIndex >= 0 && laneIndex < game.lanes.length
      ? game.lanes[laneIndex]
      : null;
    const attack = isLaneBlock ? laneState?.attack : game.handAttacks.find(a => a.id === handAttackId);
    if (!attack) {
      socket.emit("errorMessage", "Attack not found");
      return;
    }
    if (isLaneBlock && !Array.isArray(laneState.block)) laneState.block = [];
    const existingBlocks = isLaneBlock ? laneState.block : attack.block;
    if (existingBlocks && existingBlocks.length > 0) {
      socket.emit("errorMessage", "Attack is already blocked");
      return;
    }
    
    const defender = getAttackDefender(game, attack);
    if (playerNum !== defender) {
      socket.emit("errorMessage", "Not the defender");
      return;
    }
    if (game.priority !== defender) {
      socket.emit("errorMessage", "Defender does not have priority to block");
      return;
    }
    if (game.priorityPassed?.[defender]) {
      socket.emit("errorMessage", "You already passed on this attack and cannot block it now");
      return;
    }
    
    const noHandBlockSelected =
      !isLaneBlock &&
      (blockCardIndex === undefined || blockCardIndex === null || blockCardIndex === -1) &&
      (!Array.isArray(blockCardIndexes) || blockCardIndexes.length === 0);

    // If take damage (no block card)
    if (noHandBlockSelected) {
      console.log(`[Socket] No block card - passing priority to take damage`);
      saveUndoSnapshot(roomState, playerNum, "declined to block");
      game.priorityPassed[playerNum] = true;
      game.message = `Player ${playerNum} chose not to block.`;

      if (game.gameMode === "basic") {
        await resolveCombatAndResumePriority(roomState);
        emitState(roomState);
        scheduleTrainingAi(roomState);
        return;
      }
      if (game.gameMode === "freeForAll") {
        game.priority = attack.player;
        game.message = `Player ${playerNum} chose not to block. Player ${attack.player} can pass to damage.`;
        emitState(roomState);
        scheduleTrainingAi(roomState);
        return;
      }
      
      if (game.priorityPassed[1] && game.priorityPassed[2]) {
        if (hasPendingAttacks(game)) {
          await resolveCombatAndResumePriority(roomState);
        } else if (await finishGameIfLifeCheckFails(roomState)) {
          emitState(roomState);
          scheduleTrainingAi(roomState);
          return;
        } else {
          startEndPhase(game);
        }
        resetPriorityPassed(game);
      } else {
        game.priority = getOtherPlayer(playerNum);
      }
      emitState(roomState);
      scheduleTrainingAi(roomState);
      return;
    }
    if (isLaneBlock && !laneState.facedown[playerNum]) {
      console.log(`[Socket] No lane blocker - passing priority to take damage`);
      saveUndoSnapshot(roomState, playerNum, "declined to block");
      game.priorityPassed[playerNum] = true;
      game.message = `Player ${playerNum} chose not to block.`;

      if (game.gameMode === "basic") {
        await resolveCombatAndResumePriority(roomState);
        emitState(roomState);
        scheduleTrainingAi(roomState);
        return;
      }
      if (game.gameMode === "freeForAll") {
        game.priority = attack.player;
        game.message = `Player ${playerNum} chose not to block. Player ${attack.player} can pass to damage.`;
        emitState(roomState);
        scheduleTrainingAi(roomState);
        return;
      }

      if (game.priorityPassed[1] && game.priorityPassed[2]) {
        if (hasPendingAttacks(game)) {
          await resolveCombatAndResumePriority(roomState);
        } else if (await finishGameIfLifeCheckFails(roomState)) {
          emitState(roomState);
          scheduleTrainingAi(roomState);
          return;
        } else {
          startEndPhase(game);
        }
        resetPriorityPassed(game);
      } else {
        game.priority = getOtherPlayer(playerNum);
      }
      emitState(roomState);
      scheduleTrainingAi(roomState);
      return;
    }
    
    const selectedBlockIndexes = isLaneBlock
      ? []
      : (Array.isArray(blockCardIndexes) ? blockCardIndexes : [blockCardIndex])
          .map((index) => Number(index))
          .filter((index) => Number.isInteger(index));

    if (!isLaneBlock) {
      if (selectedBlockIndexes.length === 0) {
        socket.emit("errorMessage", "Select at least one block card");
        return;
      }
      const uniqueBlockIndexes = new Set(selectedBlockIndexes);
      if (uniqueBlockIndexes.size !== selectedBlockIndexes.length) {
        socket.emit("errorMessage", "Duplicate block card");
        return;
      }
      if (selectedBlockIndexes.some((index) => index < 0 || index >= player.hand.length || !player.hand[index])) {
        socket.emit("errorMessage", "Invalid block card");
        return;
      }
    }

    const blockCards = isLaneBlock
      ? [laneState.facedown[playerNum]]
      : selectedBlockIndexes.map((index) => player.hand[index]);
    const blockCardValue = blockCards.reduce((sum, card) => sum + getBaseCardValue(card), 0);
    const paymentValidation = validateHandIndexes(player, paymentIndexes, selectedBlockIndexes);
    if (paymentValidation.error) {
      socket.emit("errorMessage", paymentValidation.error);
      return;
    }
    const payment = getPaymentTotal(player, paymentValidation.indexes, useHeraBonus);
    const paymentCards = getHandCardsByIndexes(player, paymentValidation.indexes);
    
    console.log(`[Socket] Block payment check: need ${blockCardValue}, have ${payment.total}`);
    
    if (payment.total < blockCardValue) {
      socket.emit("errorMessage", `Need ${blockCardValue} payment to block, have ${payment.total}`);
      return;
    }
    
    saveUndoSnapshot(roomState, playerNum, isLaneBlock ? `blocked lane ${laneIndex + 1}` : "blocked from hand");

    const blockEntries = blockCards.map((blockCard) => {
      const blockInfo = applyBlockBonuses(player, blockCard);
      return {
        player: playerNum,
        card: blockCard,
        source: isLaneBlock ? "lane" : "hand",
        effectiveValue: blockInfo.effectiveValue,
        notes: blockInfo.notes,
        payment: {
          player: playerNum,
          cards: paymentCards,
          total: payment.total,
          required: blockCardValue,
          heraUsed: payment.heraUsedNow
        }
      };
    });

    // Process block only after the blocker values have been captured.
    if (isLaneBlock) {
      removeIndexesFromHandToDiscard(player, paymentValidation.indexes);
      laneState.facedown[playerNum] = null;
    } else {
      removeSelectedCardsAndPayments(player, selectedBlockIndexes, paymentValidation.indexes);
    }
    if (payment.heraUsedNow) player.turnData.heraUsed = true;
    addAccelerationIfOverpaid(player, payment.total, blockCardValue);
    finalizeBlockDeclaration(player);
    
    if (isLaneBlock) laneState.block.push(...blockEntries);
    else attack.block.push(...blockEntries);
    recordPaymentLog(game, {
      type: "block",
      player: playerNum,
      cards: paymentCards,
      total: payment.total,
      required: blockCardValue,
      label: `Player ${playerNum} paid ${payment.total}/${blockCardValue} with ${describeCardList(paymentCards)} to block with ${blockEntries.map((entry) => entry.card?.name || "card").join(", ")}.`
    });
    
    if (game.gameMode === "basic") {
      await resolveCombatAndResumePriority(roomState);
    } else {
      // The attack remains pending until damage resolution. Priority returns to
      // the attacker, who can pass to move combat toward damage.
      resetPriorityPassed(game);
      game.priorityPassed[playerNum] = true;
      game.priority = attack.player;
      game.message = `Player ${playerNum} blocked with ${blockEntries.map((entry) => describeCardValue(entry.card, entry.effectiveValue, entry.notes)).join(", ")} (paid ${payment.total}, blocker cost ${blockCardValue}). Player ${attack.player} has priority.`;
    }
    
    emitState(roomState);
    scheduleTrainingAi(roomState);
  });

  socket.on("usePolea", ({ mode, handIndex, lane, laneA, laneB, targetPlayer, targetType, handAttackId }) => {
    console.log(`[Socket] usePolea: mode=${mode}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];

    if (!canUsePriorityAbility(socket, game, playerNum, "frumo")) return;
    if (player.turnData.poleaUsed) {
      socket.emit("errorMessage", "Polea already used this turn");
      return;
    }

    const selectedMode = Number(mode);
    if (selectedMode === 1) {
      const selectedHandIndex = Number(handIndex);
      const laneIndex = Number(lane);
      if (!Number.isInteger(selectedHandIndex) || !player.hand[selectedHandIndex]) {
        socket.emit("errorMessage", "Invalid hand card");
        return;
      }
      if (!Number.isInteger(laneIndex) || laneIndex < 0 || laneIndex >= game.lanes.length || game.lanes[laneIndex].facedown[playerNum]) {
        socket.emit("errorMessage", "Invalid empty lane");
        return;
      }
      saveUndoSnapshot(roomState, playerNum, `used Polea to place a card in lane ${laneIndex + 1}`);
      const [card] = player.hand.splice(selectedHandIndex, 1);
      game.lanes[laneIndex].facedown[playerNum] = card;
      player.turnData.poleaUsed = true;
      resetPriorityPassed(game);
      recordPaymentLog(game, {
        type: "ability",
        player: playerNum,
        cards: [card],
        total: 0,
        required: 0,
        label: `Player ${playerNum} used Polea to put ${card.name || "a hand card"} into lane ${laneIndex + 1}.`
      });
      game.message = `Player ${playerNum} used Polea to put a card into lane ${laneIndex + 1}.`;
      emitState(roomState);
      return;
    }

    if (selectedMode === 2) {
      const firstLane = Number(laneA);
      const secondLane = Number(laneB);
      if (
        !Number.isInteger(firstLane) ||
        !Number.isInteger(secondLane) ||
        firstLane < 0 ||
        secondLane < 0 ||
        firstLane >= game.lanes.length ||
        secondLane >= game.lanes.length ||
        firstLane === secondLane ||
        !game.lanes[firstLane].facedown[playerNum] ||
        !game.lanes[secondLane].facedown[playerNum]
      ) {
        socket.emit("errorMessage", "Choose two occupied lanes you control");
        return;
      }
      saveUndoSnapshot(roomState, playerNum, `used Polea to switch lanes ${firstLane + 1} and ${secondLane + 1}`);
      [game.lanes[firstLane].facedown[playerNum], game.lanes[secondLane].facedown[playerNum]] = [game.lanes[secondLane].facedown[playerNum], game.lanes[firstLane].facedown[playerNum]];
      player.turnData.poleaUsed = true;
      resetPriorityPassed(game);
      recordPaymentLog(game, {
        type: "ability",
        player: playerNum,
        cards: [game.lanes[firstLane].facedown[playerNum], game.lanes[secondLane].facedown[playerNum]].filter(Boolean),
        total: 0,
        required: 0,
        label: `Player ${playerNum} used Polea to switch lanes ${firstLane + 1} and ${secondLane + 1}.`
      });
      game.message = `Player ${playerNum} used Polea to switch lanes ${firstLane + 1} and ${secondLane + 1}.`;
      emitState(roomState);
      return;
    }

    if (selectedMode === 3) {
      const peekPlayer = Number(targetPlayer);
      const laneIndex = Number(lane);
      if (![1, 2].includes(peekPlayer) || !Number.isInteger(laneIndex) || laneIndex < 0 || laneIndex >= game.lanes.length || !game.lanes[laneIndex].facedown[peekPlayer]) {
        socket.emit("errorMessage", "Invalid face-down target");
        return;
      }
      const card = game.lanes[laneIndex].facedown[peekPlayer];
      saveUndoSnapshot(roomState, playerNum, "used Polea to peek");
      player.turnData.poleaUsed = true;
      resetPriorityPassed(game);
      socket.emit("peekResult", `Player ${peekPlayer} lane ${laneIndex + 1}: ${card.name}`);
      recordPaymentLog(game, {
        type: "ability",
        player: playerNum,
        cards: [],
        total: 0,
        required: 0,
        label: `Player ${playerNum} used Polea to look at Player ${peekPlayer}'s lane ${laneIndex + 1}.`
      });
      game.message = `Player ${playerNum} used Polea to look at a face-down card.`;
      emitState(roomState);
      return;
    }

    if (selectedMode === 4) {
      const target = getControlledTargetCard(game, playerNum, targetType, lane, handAttackId);
      if (!target) {
        socket.emit("errorMessage", "Invalid target");
        return;
      }
      saveUndoSnapshot(roomState, playerNum, "used Polea to buff a card");
      target.tempBuff = (target.tempBuff || 0) + 1;
      player.turnData.poleaUsed = true;
      resetPriorityPassed(game);
      recordPaymentLog(game, {
        type: "ability",
        player: playerNum,
        cards: [target],
        total: 0,
        required: 0,
        label: `Player ${playerNum} used Polea to give ${target.name || "a card"} +1.`
      });
      game.message = `Player ${playerNum} used Polea to give ${describeCardValue(target, getCardCurrentValue(target), ["Polea +1"])} this turn.`;
      emitState(roomState);
      return;
    }

    socket.emit("errorMessage", "Invalid Polea mode");
  });

  socket.on("useLafayette", ({ lane, handIndex }) => {
    console.log(`[Socket] useLafayette: lane=${lane}, handIndex=${handIndex}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];

    if (!canUsePriorityAbility(socket, game, playerNum, "frumo")) return;
    if (player.turnData.lafayetteUsed) {
      socket.emit("errorMessage", "Lafayette already used this turn");
      return;
    }

    const laneIndex = Number(lane);
    const selectedHandIndex = Number(handIndex);
    if (!Number.isInteger(laneIndex) || laneIndex < 0 || laneIndex >= game.lanes.length || !game.lanes[laneIndex].facedown[playerNum]) {
      socket.emit("errorMessage", "Invalid lane card");
      return;
    }
    if (!Number.isInteger(selectedHandIndex) || !player.hand[selectedHandIndex]) {
      socket.emit("errorMessage", "Invalid hand card");
      return;
    }

    const handCard = player.hand[selectedHandIndex];
    saveUndoSnapshot(roomState, playerNum, `used Lafayette on lane ${laneIndex + 1}`);
    player.hand[selectedHandIndex] = game.lanes[laneIndex].facedown[playerNum];
    game.lanes[laneIndex].facedown[playerNum] = handCard;
    player.turnData.lafayetteUsed = true;
    resetPriorityPassed(game);
    recordPaymentLog(game, {
      type: "ability",
      player: playerNum,
      cards: [handCard],
      total: 0,
      required: 0,
      label: `Player ${playerNum} used Lafayette to swap ${handCard.name || "a hand card"} into lane ${laneIndex + 1}.`
    });
    game.message = `Player ${playerNum} used Lafayette to swap a lane card with a hand card.`;
    emitState(roomState);
  });

  socket.on("useFocusBuff", ({ targetType, lane, handAttackId }) => {
    console.log(`[Socket] useFocusBuff: targetType=${targetType}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];

    if (!canUsePriorityAbility(socket, game, playerNum, "bizi")) return;
    if (player.turnData.focusBuffUsed) {
      socket.emit("errorMessage", "Focus already used this turn");
      return;
    }
    if ((player.accelerationCounters || 0) <= 0) {
      socket.emit("errorMessage", "No acceleration counters");
      return;
    }

    const target = getControlledTargetCard(game, playerNum, targetType, lane, handAttackId);
    if (!target) {
      socket.emit("errorMessage", "Invalid target");
      return;
    }

    saveUndoSnapshot(roomState, playerNum, "used Focus Buff");
    player.accelerationCounters -= 1;
    player.turnData.focusBuffUsed = true;
    target.tempBuff = (target.tempBuff || 0) + 1;
    resetPriorityPassed(game);
    recordPaymentLog(game, {
      type: "ability",
      player: playerNum,
      cards: [target],
      total: 1,
      required: 1,
      label: `Player ${playerNum} spent 1 acceleration counter with Focus to give ${target.name || "a card"} +1.`
    });
    game.message = `Player ${playerNum} removed an acceleration counter to give ${describeCardValue(target, getCardCurrentValue(target), ["Focus +1"])} this turn.`;
    emitState(roomState);
  });

  socket.on("placeFacedown", async ({ lane, handIndex }) => {
    console.log(`[Socket] placeFacedown: lane ${lane}, handIndex ${handIndex}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];
    
    if (game.phase !== "end") {
      socket.emit("errorMessage", "Not in end phase");
      return;
    }
    
    if (lane !== game.endPlacementLaneIndex) {
      socket.emit("errorMessage", "Wrong lane");
      return;
    }
    
    const currentPlayer = getCurrentEndPlacementPlayer(game);
    if (playerNum !== currentPlayer) {
      socket.emit("errorMessage", "Not your turn to place");
      return;
    }
    
    if (game.endPlaced[playerNum][lane]) {
      socket.emit("errorMessage", "Already placed in this lane");
      return;
    }
    
    if (!player.hand[handIndex]) {
      socket.emit("errorMessage", "Invalid card");
      return;
    }
    
    saveUndoSnapshot(roomState, playerNum, `placed a face-down card in lane ${lane + 1}`);
    const card = player.hand.splice(handIndex, 1)[0];
    game.lanes[lane].facedown[playerNum] = card;
    saveUndoSnapshot(roomState, playerNum, `skipped lane ${lane + 1}`);
    game.endPlaced[playerNum][lane] = true;
    game.message = `Player ${playerNum} placed a card in lane ${lane + 1}`;
    
    await advanceEndPlacement(roomState);
    emitState(roomState);
    scheduleTrainingAi(roomState);
  });

  socket.on("skipEndPlacement", async ({ lane }) => {
    console.log(`[Socket] skipEndPlacement: lane ${lane}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    
    if (game.phase !== "end") {
      socket.emit("errorMessage", "Not in end phase");
      return;
    }
    
    if (lane !== game.endPlacementLaneIndex) {
      socket.emit("errorMessage", "Wrong lane");
      return;
    }
    
    const currentPlayer = getCurrentEndPlacementPlayer(game);
    if (playerNum !== currentPlayer) {
      socket.emit("errorMessage", "Not your turn to skip");
      return;
    }
    
    if (game.endPlaced[playerNum][lane]) {
      socket.emit("errorMessage", "Already processed");
      return;
    }
    
    game.endPlaced[playerNum][lane] = true;
    game.message = `Player ${playerNum} skipped lane ${lane + 1}`;
    
    await advanceEndPlacement(roomState);
    emitState(roomState);
    scheduleTrainingAi(roomState);
  });

  socket.on("leaveRoom", () => {
    console.log("[Socket] leaveRoom");
    removeFromMatchmaking(socket.id);
    const roomState = getRoomForSocket(socket);
    if (!roomState) return;
    detachSocketFromRoom(roomState, socket);
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    removeFromMatchmaking(socket.id);
    const roomState = getRoomForSocket(socket);
    if (roomState) {
      detachSocketFromRoom(roomState, socket, { leaveSocket: false });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
