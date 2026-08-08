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
const MATCH_DATA_FILE = process.env.MATCH_DATA_FILE || `${__dirname}/matches.json`;
const ROOM_STATE_DATA_FILE = process.env.ROOM_STATE_DATA_FILE || `${__dirname}/rooms.json`;
const DEFAULT_ACCOUNT_AUTH_SECRET = "dev-gauntlet-auth-secret-change-me";
const DEVELOPMENT_AUTH_SECRETS = new Set([
  DEFAULT_ACCOUNT_AUTH_SECRET,
  "local-development-secret-change-me"
]);
const ACCOUNT_AUTH_SECRET = process.env.ACCOUNT_AUTH_SECRET || DEFAULT_ACCOUNT_AUTH_SECRET;
const ACCOUNT_SESSION_TTL_MS = Math.max(60 * 1000, Number(process.env.ACCOUNT_SESSION_TTL_MS) || 7 * 24 * 60 * 60 * 1000);
const OWNER_STATS_TOKEN = process.env.OWNER_STATS_TOKEN || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const PACK_PURCHASE_URL = process.env.PACK_PURCHASE_URL || "";
const FRIEND_CHALLENGE_TTL_MS = 15 * 60 * 1000;

function validateAuthConfiguration(nodeEnv = process.env.NODE_ENV, authSecret = ACCOUNT_AUTH_SECRET) {
  if (nodeEnv === "production" && DEVELOPMENT_AUTH_SECRETS.has(authSecret)) {
    throw new Error("ACCOUNT_AUTH_SECRET must be set to a non-default value in production.");
  }
}

validateAuthConfiguration();

const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cors = require("cors");
const { Server } = require("socket.io");
const {
  CARD_CONTENT_VERSION: DUEL_CARD_CONTENT_VERSION,
  COMMAND_SCHEMA_VERSION: DUEL_COMMAND_SCHEMA_VERSION,
  EVENT_SCHEMA_VERSION: DUEL_EVENT_SCHEMA_VERSION,
  HAND_SIZE: BASIC_HAND_SIZE,
  RULES_VERSION: DUEL_RULES_VERSION,
  SCHEMA_VERSION: DUEL_SCHEMA_VERSION,
  STARTING_LIFE: BASIC_STARTING_LIFE,
  applyCommand: applySharedDuelCommand,
  cardValue: getSharedBasicCardValue,
  createSeededRandom: createSharedSeededRandom,
  getActionAvailability: getSharedActionAvailability,
  getLegalActions: getSharedLegalActions,
  projectForPerspective: projectSharedDuelForPerspective
} = require("../shared/duel-rules");
const {
  buildAccountMatchIndexEntry,
  buildParaMatchExport,
  buildMatchRecord,
  captureAuditEvent,
  captureLeagueEvidence,
  createLocalMatchStore,
  createMatchMetadata,
  publicMatchRecord,
  publicMatchSummary,
  projectMatchPerspective,
  recordCombatResolution
} = require("./matchRecords");
const {
  buildReplayTimeline,
  replayAvailability
} = require("./matchReplay");
const {
  buildCompletionEnvelope,
  createFinalizeCompletedMatch,
  receiptKey
} = require("./matchCompletion");
const { createMatchPersistence } = require("./matchPersistence");
const {
  createRoomLifecycle,
  getRoomLifecycleAction,
  getRoomLifecycleConfig,
  markRoomCompleted,
  syncRoomPresence,
  touchRoom
} = require("./roomLifecycle");
const { createRoomStateStore, isRoomRecoveryEnabled } = require("./roomStateStore");
const {
  ACTIVE_SEASON,
  applySeasonResult,
  buildSeasonMatchIdentity,
  buildSeasonProfile,
  buildSeasonStandings,
  getActiveSeason,
  normalizeSeasonStats,
  publicSeasonDefinition
} = require("./seasons");
const {
  BASE_PLAYING_DECK_SIZE,
  BIZI_COLLECTION_CARDS,
  CAMPAIGN_NARRATION,
  COLLECTOR_VARIANTS,
  COLLECTION_CARDS,
  DRAFT_CARD_SUITS,
  FREE_GAMEPLAY_ACQUISITION,
  FRUMO_COLLECTION_CARDS,
  MAX_CONSTRUCTED_ADDITIONS,
  MAX_CONSTRUCTED_DECK_SIZE,
  MAX_CONSTRUCTED_REPLACEMENTS,
  MAX_REPLACEMENTS_PER_VALUE,
  PLAYING_DECK_VALUES,
  PAID_COLLECTOR_ACQUISITION,
  RUMIN_COLLECTION_CARDS,
  SHEEN_COLLECTION_CARDS,
  campaignChapters,
  factionsData,
  getCollectorVariantById,
  getFactionById,
  getGameplayCardById,
  getPublicGameContent,
  listFactions
} = require("./gameContent");
const {
  COLLECTOR_REDEMPTION_RECEIPT_VERSION,
  PHYSICAL_COLLECTOR_PRODUCT_TYPE,
  issueCollectorEntitlement,
  publicCollectorEntitlementProduct,
  resolveCollectorEntitlementProduct,
  verifyCollectorEntitlement
} = require("./collectorEntitlements");

const COLLECTOR_ENTITLEMENT_SECRET = process.env.COLLECTOR_ENTITLEMENT_SECRET
  || crypto.createHmac("sha256", ACCOUNT_AUTH_SECRET).update("gauntlet.collector-entitlement.v1 signing key").digest("hex");
const PUBLIC_CLIENT_URL = process.env.PUBLIC_CLIENT_URL
  || (CLIENT_URL.startsWith("https://") ? CLIENT_URL : "https://gauntlet-online.vercel.app");

const localMatchStore = createLocalMatchStore(MATCH_DATA_FILE);
const roomLifecycleConfig = getRoomLifecycleConfig();
const roomStateStore = createRoomStateStore(ROOM_STATE_DATA_FILE, {
  enabled: isRoomRecoveryEnabled(process.env.ROOM_STATE_RECOVERY_ENABLED)
});
let roomLifecycleTimer = null;
let roomLifecycleSweepRunning = false;

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
app.set("trust proxy", 1);
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

function getRequestAddress(req) {
  return String(req.ip || req.socket?.remoteAddress || "unknown").slice(0, 80);
}

function accountFingerprint(name) {
  const key = accountNameKey(name);
  return key ? crypto.createHash("sha256").update(key).digest("hex").slice(0, 12) : null;
}

function logAuthFailure(event, req, details = {}) {
  console.warn("[AuthSecurity]", JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    path: req.path,
    address: getRequestAddress(req),
    account: accountFingerprint(details.accountName),
    reason: details.reason || null
  }));
}

function createAuthRateLimiter({ event, windowMs, maxAttempts }) {
  const attempts = new Map();
  return function authRateLimiter(req, res, next) {
    const now = Date.now();
    const key = getRequestAddress(req);
    if (!attempts.has(key) && attempts.size >= 10000) {
      for (const [storedKey, storedEntry] of attempts) {
        if (storedEntry.resetAt <= now) attempts.delete(storedKey);
      }
      if (attempts.size >= 10000) attempts.delete(attempts.keys().next().value);
    }
    const current = attempts.get(key);
    const entry = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;
    entry.count += 1;
    attempts.set(key, entry);
    if (entry.count <= maxAttempts) {
      next();
      return;
    }
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    res.set("Retry-After", String(retryAfterSeconds));
    logAuthFailure(event, req, { accountName: req.body?.name, reason: "rate_limited" });
    res.status(429).json({ error: "Too many attempts. Please try again later." });
  };
}

const registerRateLimit = createAuthRateLimiter({ event: "register_rejected", windowMs: 15 * 60 * 1000, maxAttempts: 5 });
const loginRateLimit = createAuthRateLimiter({ event: "login_rejected", windowMs: 15 * 60 * 1000, maxAttempts: 10 });

app.get("/", (_req, res) => {
  res.send("Gauntlet server is running.");
});

app.get("/api/storage-status", async (_req, res) => {
  try {
    const matchStorage = await matchPersistence.getMode();
    const matchStorageStatus = publicMatchStorageStatus();
    res.json({
      accountStorage: SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? "supabase-configured" : "local-json",
      matchStorage,
      matchStorageCapabilities: matchStorageStatus.capabilities,
      supabaseConfigured: !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
    });
  } catch (error) {
    console.error("[Storage] Failed to determine match storage capability", error);
    res.status(503).json({
      accountStorage: SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? "supabase-configured" : "local-json",
      matchStorage: "unavailable",
      supabaseConfigured: !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
    });
  }
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

function verifyAuthToken(token, now = Date.now()) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", ACCOUNT_AUTH_SECRET).update(body).digest("base64url");
  const signatureBuffer = Buffer.from(signature || "");
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.id || !payload.name || !Number.isFinite(payload.iat) || !Number.isFinite(payload.exp)) return null;
    if (payload.exp <= now || payload.iat > now + 60 * 1000 || payload.exp <= payload.iat) return null;
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

function getDraftCardSuit() {
  return DRAFT_CARD_SUITS[crypto.randomInt(DRAFT_CARD_SUITS.length)];
}

function getPlayableCollectionCard(card, overrides = {}) {
  const factionName = getFactionById(card.factionId)?.name || card.factionId;
  return {
    ...card,
    ...overrides,
    rulesText: card.rulesText || card.text || `Draft ${card.type}. Value ${card.value}.`,
    text: card.text || `Draft ${card.type}. Value ${card.value}.`
  };
}

const BOOSTER_PRODUCTS = {
  "rumin-foundation": {
    id: "rumin-foundation",
    name: "Rumin Foundation Pack",
    productType: "earned-gameplay-pack",
    factionId: "rumin",
    cardCount: 8,
    slots: ["common", "common", "common", "common", "uncommon", "uncommon", "rare", "wild"],
    description: "A free-play reward containing gameplay unlocks. Earn credits through first-time campaign clears."
  },
  "sheen-foundation": {
    id: "sheen-foundation",
    name: "Sheen Foundation Pack",
    productType: "earned-gameplay-pack",
    factionId: "sheen",
    cardCount: 8,
    slots: ["common", "common", "common", "common", "uncommon", "uncommon", "rare", "wild"],
    description: "A free-play reward containing gameplay unlocks. Earn credits through first-time campaign clears."
  },
  "frumo-foundation": {
    id: "frumo-foundation",
    name: "Frumo Foundation Pack",
    productType: "earned-gameplay-pack",
    factionId: "frumo",
    cardCount: 8,
    slots: ["common", "common", "common", "common", "uncommon", "uncommon", "rare", "wild"],
    description: "A free-play reward containing gameplay unlocks. Earn credits through first-time campaign clears."
  },
  "bizi-foundation": {
    id: "bizi-foundation",
    name: "Bizi Foundation Pack",
    productType: "earned-gameplay-pack",
    factionId: "bizi",
    cardCount: 8,
    slots: ["common", "common", "common", "common", "uncommon", "uncommon", "rare", "wild"],
    description: "A free-play reward containing gameplay unlocks. Earn credits through first-time campaign clears."
  }
};

const COLLECTOR_PACK_PRODUCTS = Object.fromEntries(Object.values(BOOSTER_PRODUCTS).map((pack) => {
  const id = `${pack.factionId}-collector`;
  return [id, {
    id,
    legacyPackId: pack.id,
    name: `${getFactionById(pack.factionId)?.name || pack.factionId} Collector Pack`,
    productType: PAID_COLLECTOR_ACQUISITION,
    factionId: pack.factionId,
    variantCount: pack.cardCount,
    priceUsd: 1,
    description: "Collector variants only. Does not unlock gameplay cards, deck copies, abilities, or competitive actions."
  }];
}));

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
    schemaVersion: 2,
    cards: {},
    gameplayEntitlements: {},
    collectorVariants: {},
    selectedVariants: {},
    packCredits: 0,
    earnedPackCredits: 0,
    purchasedPacks: 0,
    purchasedCollectorPacks: 0,
    openedPacks: 0,
    openedGameplayPacks: 0,
    openedCollectorPacks: 0,
    collectorRedemptionReceipts: {},
    collectorVariantProvenance: {},
    lastPack: null,
    lastGameplayPack: null,
    lastCollectorPack: null
  };
}

function normalizeCollectorRedemptionReceipts(value = {}) {
  const receipts = {};
  for (const [entitlementId, receipt] of Object.entries(value || {})) {
    if (!receipt || typeof receipt !== "object" || String(receipt.entitlementId || "") !== String(entitlementId)) continue;
    const variantIds = Array.isArray(receipt.grantedVariantIds)
      ? receipt.grantedVariantIds.map(String).filter((variantId) => !!getCollectorVariantById(variantId))
      : [];
    receipts[String(entitlementId)] = {
      receiptVersion: Number(receipt.receiptVersion || COLLECTOR_REDEMPTION_RECEIPT_VERSION),
      entitlementId: String(entitlementId),
      productId: String(receipt.productId || ""),
      productType: String(receipt.productType || PHYSICAL_COLLECTOR_PRODUCT_TYPE),
      redeemedAt: receipt.redeemedAt || null,
      grantedVariantIds: variantIds,
      acquisition: String(receipt.acquisition || PHYSICAL_COLLECTOR_PRODUCT_TYPE),
      issuanceSource: String(receipt.issuanceSource || "owner-manual-fulfillment"),
      externalReferenceHash: String(receipt.externalReferenceHash || "")
    };
  }
  return receipts;
}

function buildCollectorVariantProvenance(receipts = {}) {
  const provenance = {};
  for (const receipt of Object.values(receipts)) {
    for (const variantId of receipt.grantedVariantIds || []) {
      provenance[variantId] = provenance[variantId] || [];
      provenance[variantId].push({
        entitlementId: receipt.entitlementId,
        productId: receipt.productId,
        acquisition: receipt.acquisition,
        issuanceSource: receipt.issuanceSource,
        acquiredAt: receipt.redeemedAt
      });
    }
  }
  return provenance;
}

function normalizeOwnershipCounts(value = {}) {
  return Object.fromEntries(Object.entries(value || {})
    .map(([id, count]) => [String(id), Math.max(0, Math.floor(Number(count || 0)))])
    .filter(([, count]) => count > 0));
}

function normalizeCollection(stats = {}) {
  const base = emptyCollection();
  const collection = stats.collection || {};
  const legacyCards = normalizeOwnershipCounts(collection.cards);
  const gameplayEntitlements = normalizeOwnershipCounts(collection.gameplayEntitlements);
  for (const [gameplayCardId, count] of Object.entries(legacyCards)) {
    gameplayEntitlements[gameplayCardId] = Math.max(gameplayEntitlements[gameplayCardId] || 0, count);
  }
  const collectorVariants = normalizeOwnershipCounts(collection.collectorVariants);
  for (const [gameplayCardId, count] of Object.entries(gameplayEntitlements)) {
    const gameplayCard = getGameplayCardById(gameplayCardId);
    if (!gameplayCard) continue;
    collectorVariants[gameplayCard.defaultVariantId] = Math.max(
      collectorVariants[gameplayCard.defaultVariantId] || 0,
      count
    );
  }
  const selectedVariants = {};
  for (const [gameplayCardId, variantId] of Object.entries(collection.selectedVariants || {})) {
    const variant = getCollectorVariantById(String(variantId));
    if (!variant || variant.gameplayCardId !== gameplayCardId) continue;
    if (variant.paid && !collectorVariants[variant.variantId]) continue;
    selectedVariants[gameplayCardId] = variant.variantId;
  }
  const openedGameplayPacks = Math.max(0, Number(collection.openedGameplayPacks ?? collection.openedPacks ?? 0));
  const purchasedCollectorPacks = Math.max(0, Number(collection.purchasedCollectorPacks ?? collection.purchasedPacks ?? 0));
  const lastGameplayPack = collection.lastGameplayPack || collection.lastPack || null;
  const collectorRedemptionReceipts = normalizeCollectorRedemptionReceipts(collection.collectorRedemptionReceipts);
  return {
    schemaVersion: 2,
    cards: { ...base.cards, ...gameplayEntitlements },
    gameplayEntitlements,
    collectorVariants,
    selectedVariants,
    packCredits: Math.max(0, Number(collection.packCredits || 0)),
    earnedPackCredits: Math.max(0, Number(collection.earnedPackCredits || 0)),
    purchasedPacks: purchasedCollectorPacks,
    purchasedCollectorPacks,
    openedPacks: openedGameplayPacks,
    openedGameplayPacks,
    openedCollectorPacks: Math.max(0, Number(collection.openedCollectorPacks || 0)),
    collectorRedemptionReceipts,
    collectorVariantProvenance: buildCollectorVariantProvenance(collectorRedemptionReceipts),
    lastPack: lastGameplayPack,
    lastGameplayPack,
    lastCollectorPack: collection.lastCollectorPack || null
  };
}

function publicCollectorVariant(variant) {
  const gameplayCard = getGameplayCardById(variant.gameplayCardId);
  return {
    ...variant,
    gameplay: gameplayCard ? {
      gameplayCardId: gameplayCard.gameplayCardId,
      name: gameplayCard.name,
      factionId: gameplayCard.factionId
    } : null
  };
}

function collectionSummary(stats = {}) {
  return {
    ...normalizeCollection(stats),
    catalog: {
      rumin: COLLECTION_CARDS.filter((card) => card.factionId === "rumin").map(getPlayableCollectionCard),
      sheen: COLLECTION_CARDS.filter((card) => card.factionId === "sheen").map(getPlayableCollectionCard),
      frumo: COLLECTION_CARDS.filter((card) => card.factionId === "frumo").map(getPlayableCollectionCard),
      bizi: COLLECTION_CARDS.filter((card) => card.factionId === "bizi").map(getPlayableCollectionCard)
    },
    collectorCatalog: COLLECTOR_VARIANTS.map(publicCollectorVariant),
    boosters: BOOSTER_PRODUCTS,
    collectorPacks: COLLECTOR_PACK_PRODUCTS
  };
}

const DRAFT_PACKS_PER_PLAYER = 3;
const DRAFT_PACK_SLOTS = ["common", "common", "common", "common", "uncommon", "uncommon", "rare", "wild"];
const DRAFT_BOT_NAMES = [
  "Atlas Surveyor",
  "Copperline Drafter",
  "Grove Analyst",
  "Ristus Picker",
  "Marble Seat",
  "Signal Adept",
  "Canopy Scout"
];

function createDraftPlayerSeat() {
  return {
    socket: null,
    connected: false,
    reconnectToken: null,
    accountId: null,
    accountName: null,
    isGuest: false,
    readyToStart: false
  };
}

function createDraftPack(ownerPlayer) {
  return {
    id: crypto.randomUUID(),
    ownerPlayer,
    cards: DRAFT_PACK_SLOTS.map((slot) => {
      const factionIds = ["rumin", "sheen", "frumo", "bizi"];
      const factionId = factionIds[crypto.randomInt(factionIds.length)];
      const rarity = resolveBoosterSlot(slot);
      return { ...pickCollectionCard(factionId, rarity), suit: getDraftCardSuit(), draftCopyId: crypto.randomUUID() };
    }).filter(Boolean)
  };
}

function createBaseDeckSummary() {
  return {
    name: "Standard 52-card Gauntlet deck",
    cardCount: 52,
    note: "Drafted or constructed faction cards replace same-value cards in this 52-card deck."
  };
}

function getReplacementCardValue(card) {
  const value = Number(card?.value);
  return PLAYING_DECK_VALUES.includes(value) ? value : null;
}

function normalizeDeckSuit(suit) {
  const key = String(suit || "").toLowerCase();
  const map = {
    "♠": "spades",
    "â™ ": "spades",
    spade: "spades",
    spades: "spades",
    "♥": "hearts",
    "â™¥": "hearts",
    heart: "hearts",
    hearts: "hearts",
    "♦": "diamonds",
    "â™¦": "diamonds",
    diamond: "diamonds",
    diamonds: "diamonds",
    "♣": "clubs",
    "â™£": "clubs",
    club: "clubs",
    clubs: "clubs"
  };
  return map[key] || (DRAFT_CARD_SUITS.includes(key) ? key : null);
}

function normalizeReplacementSuit(card) {
  return normalizeDeckSuit(card?.replacementSuit || card?.suit) || getDraftCardSuit();
}

function getReplacementValueCounts(cards = []) {
  return cards.reduce((counts, card) => {
    const value = getReplacementCardValue(card);
    if (value == null) return counts;
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function getReplacementSlotCounts(cards = []) {
  return cards.reduce((counts, card) => {
    const value = getReplacementCardValue(card);
    const suit = normalizeReplacementSuit(card);
    if (value == null || !suit) return counts;
    const key = `${value}:${suit}`;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function filterValidReplacementCards(cards = [], factionId = null) {
  const valueCounts = {};
  return (Array.isArray(cards) ? cards : []).filter((card) => {
    if (!card) return false;
    if (factionId && card.factionId !== factionId) return false;
    const value = getReplacementCardValue(card);
    if (value == null) return false;
    valueCounts[value] = (valueCounts[value] || 0) + 1;
    return valueCounts[value] <= MAX_REPLACEMENTS_PER_VALUE;
  });
}

function validateReplacementCardSet(cards = [], { factionId = null, requireOneFaction = true } = {}) {
  const selectedCards = Array.isArray(cards) ? cards.filter(Boolean) : [];
  const factionIds = [...new Set(selectedCards.map((card) => card.factionId).filter(Boolean))];
  if (requireOneFaction && factionIds.length > 1) {
    throw new Error("Decks can only include cards from one faction.");
  }
  if (factionId && factionIds.some((id) => id !== factionId)) {
    throw new Error("Decks can only include cards from the chosen faction.");
  }
  const valueCounts = getReplacementValueCounts(selectedCards);
  const slotCounts = getReplacementSlotCounts(selectedCards);
  for (const [value, count] of Object.entries(valueCounts)) {
    if (count > MAX_REPLACEMENTS_PER_VALUE) {
      throw new Error(`You can only swap up to ${MAX_REPLACEMENTS_PER_VALUE} cards of value ${value}.`);
    }
  }
  for (const [slot, count] of Object.entries(slotCounts)) {
    if (count > 1) {
      const [value, suit] = slot.split(":");
      throw new Error(`Only one card can replace the ${value} of ${suit}.`);
    }
  }
  if (selectedCards.some((card) => getReplacementCardValue(card) == null)) {
    throw new Error("Every deck card must have a value from 2 through Ace.");
  }
  return {
    factionIds,
    valueCounts,
    slotCounts,
    replacementCount: selectedCards.length
  };
}

function applyDeckReplacements(deck, replacementCards, faction, createReplacementCard) {
  const validReplacements = filterValidReplacementCards(replacementCards, faction?.id);
  for (const card of validReplacements) {
    const value = getReplacementCardValue(card);
    const targetSuit = normalizeReplacementSuit(card);
    const baseIndex = deck.findIndex((entry) => (
      !entry.draftCard &&
      getBaseCardValue(entry) === value &&
      normalizeDeckSuit(entry.suit) === targetSuit
    ));
    const fallbackIndex = baseIndex >= 0 ? baseIndex : deck.findIndex((entry) => !entry.draftCard && getBaseCardValue(entry) === value);
    if (fallbackIndex < 0) continue;
    const replacementCard = { ...card, suit: targetSuit, replacementSuit: targetSuit };
    deck.splice(fallbackIndex, 1);
    deck.push(createReplacementCard(replacementCard, faction));
  }
}

const DECK_LIBRARY_SCHEMA_VERSION = 2;

function getLegacyDeckIdentity(deck, format) {
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify({
    format,
    factionId: deck?.factionId || null,
    draftType: deck?.draftType || null,
    savedAt: deck?.savedAt || null,
    gameplayCardQuantities: deck?.gameplayCardQuantities || deck?.cardQuantities || null,
    cardSuitChoices: deck?.cardSuitChoices || null,
    collectorVariantSelections: deck?.collectorVariantSelections || null,
    cards: (deck?.cards || []).map((card) => ({ id: card.id, value: card.value, suit: card.suit }))
  })).digest("hex").slice(0, 24);
  return {
    deckId: `legacy-deck-${fingerprint}`,
    versionId: `legacy-version-${fingerprint}`
  };
}

function normalizeDeckVersion(version = {}) {
  const gameplayCardQuantities = normalizeOwnershipCounts(version.gameplayCardQuantities || version.cardQuantities);
  const collectorVariantSelections = Object.fromEntries(Object.entries(version.collectorVariantSelections || {})
    .map(([gameplayCardId, variantId]) => [String(gameplayCardId), String(variantId || "")])
    .filter(([, variantId]) => !!variantId));
  const normalized = {
    ...version,
    cardQuantities: gameplayCardQuantities,
    gameplayCardQuantities,
    collectorVariantSelections
  };
  if (Array.isArray(version.cards)) return normalized;
  const mechanicalConfiguration = {
    factionId: version.factionId || null,
    gameplayCardQuantities,
    cardSuitChoices: clonePlain(version.cardSuitChoices || {})
  };
  const presentationConfiguration = { collectorVariantSelections };
  return {
    ...normalized,
    mechanicalConfiguration,
    presentationConfiguration,
    gameplayConfigurationHash: version.gameplayConfigurationHash
      || crypto.createHash("sha256").update(stableJson(mechanicalConfiguration)).digest("hex"),
    collectorConfigurationHash: version.collectorConfigurationHash
      || crypto.createHash("sha256").update(stableJson(presentationConfiguration)).digest("hex")
  };
}

function createDeckRecordFromLegacy(deck, format, ownerId = null) {
  if (!deck) return null;
  const legacyIdentity = getLegacyDeckIdentity(deck, format);
  const identity = {
    deckId: deck.deckId || legacyIdentity.deckId,
    versionId: deck.versionId || legacyIdentity.versionId
  };
  const createdAt = deck.savedAt || new Date(0).toISOString();
  return {
    id: identity.deckId,
    ownerId,
    name: deck.name || `${deck.factionName || deck.factionId || "Gauntlet"} ${format === "draft" ? "Draft" : "Constructed"} Deck`,
    factionId: deck.factionId || "basic",
    factionName: deck.factionName || getFactionById(deck.factionId)?.name || deck.factionId || "Basic",
    format,
    source: format === "draft" ? "draft" : "legacy-migration",
    draftType: format === "draft" ? (deck.draftType === "bot" ? "bot" : "player") : null,
    coverId: deck.factionId || "basic",
    archived: false,
    featured: false,
    createdAt,
    updatedAt: createdAt,
    currentVersionId: identity.versionId,
    versions: [normalizeDeckVersion({
      ...clonePlain(deck),
      id: identity.versionId,
      createdAt,
      source: format === "draft" ? "draft" : "legacy-migration"
    })],
    record: { wins: 0, losses: 0, draws: 0, recentMatchIds: [] }
  };
}

function normalizeDeckRecord(record, ownerId = null) {
  if (!record?.id || !record.format) return null;
  const versions = Array.isArray(record.versions)
    ? record.versions.filter((version) => version?.id).map(normalizeDeckVersion)
    : [];
  if (versions.length === 0) return null;
  const currentVersionId = versions.some((version) => version.id === record.currentVersionId)
    ? record.currentVersionId
    : versions[versions.length - 1].id;
  return {
    ...record,
    ownerId: record.ownerId || ownerId,
    source: record.source || getDeckRecordVersion(record)?.source || "unknown",
    archived: !!record.archived,
    featured: !!record.featured,
    versions,
    currentVersionId,
    record: {
      wins: Number(record.record?.wins || 0),
      losses: Number(record.record?.losses || 0),
      draws: Number(record.record?.draws || 0),
      recentMatchIds: Array.isArray(record.record?.recentMatchIds) ? record.record.recentMatchIds.slice(0, 10) : []
    }
  };
}

function normalizeDeckLibrary(stats = {}, ownerId = null) {
  const raw = stats.deckLibrary || {};
  const decks = (Array.isArray(raw.decks) ? raw.decks : [])
    .map((deck) => normalizeDeckRecord(deck, ownerId))
    .filter(Boolean);
  const addLegacyDeck = (legacyDeck, format) => {
    if (!legacyDeck) return;
    if (legacyDeck.deckId && decks.some((deck) => deck.id === legacyDeck.deckId)) return;
    const migrated = createDeckRecordFromLegacy(legacyDeck, format, ownerId);
    if (migrated && !decks.some((deck) => deck.id === migrated.id)) decks.push(migrated);
  };
  addLegacyDeck(stats.savedConstructedDeck, "constructed");
  addLegacyDeck(stats.savedDraftDeck, "draft");

  const activeConstructedDeckId = decks.some((deck) => deck.id === raw.activeConstructedDeckId && deck.format === "constructed" && !deck.archived)
    ? raw.activeConstructedDeckId
    : decks.find((deck) => deck.format === "constructed" && !deck.archived)?.id || null;
  const activeDraftDeckIds = {
    player: decks.some((deck) => deck.id === raw.activeDraftDeckIds?.player && deck.format === "draft" && deck.draftType !== "bot" && !deck.archived)
      ? raw.activeDraftDeckIds.player
      : decks.find((deck) => deck.format === "draft" && deck.draftType !== "bot" && !deck.archived)?.id || null,
    bot: decks.some((deck) => deck.id === raw.activeDraftDeckIds?.bot && deck.format === "draft" && deck.draftType === "bot" && !deck.archived)
      ? raw.activeDraftDeckIds.bot
      : decks.find((deck) => deck.format === "draft" && deck.draftType === "bot" && !deck.archived)?.id || null
  };
  const library = {
    schemaVersion: DECK_LIBRARY_SCHEMA_VERSION,
    decks,
    activeConstructedDeckId,
    activeDraftDeckIds,
    featuredDeckIds: decks.filter((deck) => deck.featured && !deck.archived).map((deck) => deck.id).slice(0, 3)
  };
  stats.deckLibrary = library;
  return library;
}

function getDeckRecordVersion(record) {
  return record?.versions?.find((version) => version.id === record.currentVersionId) || record?.versions?.[record.versions.length - 1] || null;
}

function getActiveDeckRecord(stats = {}, format, draftType = "player") {
  const library = normalizeDeckLibrary(stats);
  const deckId = format === "constructed"
    ? library.activeConstructedDeckId
    : library.activeDraftDeckIds[draftType === "bot" ? "bot" : "player"];
  return library.decks.find((deck) => deck.id === deckId && !deck.archived) || null;
}

function getSavedDraftDeck(stats = {}, requestedDraftType = null) {
  const libraryRecord = requestedDraftType
    ? getActiveDeckRecord(stats, "draft", requestedDraftType)
    : getActiveDeckRecord(stats, "draft", stats.savedDraftDeck?.draftType || "player") || getActiveDeckRecord(stats, "draft", "bot");
  const libraryVersion = getDeckRecordVersion(libraryRecord);
  const deck = libraryVersion ? {
    ...libraryVersion,
    name: libraryRecord.name,
    factionId: libraryRecord.factionId,
    factionName: libraryRecord.factionName,
    draftType: libraryRecord.draftType,
    deckId: libraryRecord.id,
    versionId: libraryVersion.id
  } : stats.savedDraftDeck;
  if (!deck || !Array.isArray(deck.cards) || deck.cards.length === 0 || !deck.factionId) return null;
  const cards = filterValidReplacementCards(deck.cards, deck.factionId)
    .filter((card) => card && card.factionId === deck.factionId && Number.isFinite(Number(card.value)))
    .map((card) => getPlayableCollectionCard(card, {
      suit: normalizeReplacementSuit(card),
      replacementSuit: normalizeReplacementSuit(card)
    }));
  if (cards.length === 0) return null;
  return {
    name: deck.name || `${deck.factionName || deck.factionId} Draft Deck`,
    factionId: deck.factionId,
    factionName: deck.factionName || getFactionById(deck.factionId)?.name || deck.factionId,
    draftType: deck.draftType === "bot" ? "bot" : "player",
    baseCardCount: BASE_PLAYING_DECK_SIZE,
    maxCardCount: BASE_PLAYING_DECK_SIZE,
    cardCount: BASE_PLAYING_DECK_SIZE,
    replacementCount: cards.length,
    additionCount: cards.length,
    valueCounts: getReplacementValueCounts(cards),
    savedAt: deck.savedAt || null,
    deckId: deck.deckId || null,
    versionId: deck.versionId || null,
    cards
  };
}

function getCollectionCatalogCard(cardId) {
  return getGameplayCardById(cardId);
}

function resolveCollectorVariantSelections(collection, gameplayCardQuantities, requestedSelections = {}) {
  const selections = {};
  for (const gameplayCardId of Object.keys(gameplayCardQuantities || {})) {
    const gameplayCard = getGameplayCardById(gameplayCardId);
    if (!gameplayCard) continue;
    const requestedVariantId = requestedSelections[gameplayCardId]
      || collection.selectedVariants?.[gameplayCardId]
      || gameplayCard.defaultVariantId;
    const variant = getCollectorVariantById(requestedVariantId);
    if (!variant || variant.gameplayCardId !== gameplayCardId) {
      throw new Error(`Choose a collector variant made for ${gameplayCard.name}.`);
    }
    if (variant.paid && !collection.collectorVariants?.[variant.variantId]) {
      throw new Error(`You do not own the ${variant.name} collector variant.`);
    }
    selections[gameplayCardId] = variant.variantId;
  }
  return selections;
}

function expandConstructedCardQuantities(gameplayCardQuantities = {}, factionId, cardSuitChoices = {}, collectorVariantSelections = {}) {
  return Object.entries(gameplayCardQuantities)
    .flatMap(([cardId, quantity]) => {
      const count = Math.max(0, Math.floor(Number(quantity || 0)));
      const card = getCollectionCatalogCard(cardId);
      if (!card || card.factionId !== factionId || count <= 0) return [];
      const suitChoices = Array.isArray(cardSuitChoices?.[cardId]) ? cardSuitChoices[cardId] : [];
      const variant = getCollectorVariantById(collectorVariantSelections[cardId] || card.defaultVariantId);
      return Array.from({ length: count }, (_, index) => {
        const suit = normalizeDeckSuit(suitChoices[index]) || DRAFT_CARD_SUITS[index % DRAFT_CARD_SUITS.length];
        return getPlayableCollectionCard(card, {
          gameplayCardId: card.gameplayCardId,
          variantId: variant?.variantId || card.defaultVariantId,
          collector: variant ? {
            edition: variant.edition,
            finish: variant.finish,
            frame: variant.frame,
            border: variant.border,
            art: variant.art
          } : null,
          suit,
          replacementSuit: suit
        });
      });
    });
}

function getSavedConstructedDeck(stats = {}) {
  const libraryRecord = getActiveDeckRecord(stats, "constructed");
  const libraryVersion = getDeckRecordVersion(libraryRecord);
  const deck = libraryVersion ? {
    ...libraryVersion,
    name: libraryRecord.name,
    factionId: libraryRecord.factionId,
    factionName: libraryRecord.factionName,
    deckId: libraryRecord.id,
    versionId: libraryVersion.id
  } : stats.savedConstructedDeck;
  const gameplayCardQuantities = deck?.gameplayCardQuantities || deck?.cardQuantities;
  if (!deck || !deck.factionId || !gameplayCardQuantities || typeof gameplayCardQuantities !== "object") return null;
  const collection = normalizeCollection(stats);
  let collectorVariantSelections;
  try {
    collectorVariantSelections = resolveCollectorVariantSelections(
      collection,
      gameplayCardQuantities,
      deck.collectorVariantSelections || {}
    );
  } catch (error) {
    collectorVariantSelections = resolveCollectorVariantSelections(collection, gameplayCardQuantities, {});
  }
  const cards = expandConstructedCardQuantities(
    gameplayCardQuantities,
    deck.factionId,
    deck.cardSuitChoices,
    collectorVariantSelections
  );
  try {
    validateReplacementCardSet(cards, { factionId: deck.factionId });
  } catch (error) {
    return null;
  }
  if (cards.length > MAX_CONSTRUCTED_REPLACEMENTS) return null;
  return {
    name: deck.name || `${deck.factionName || deck.factionId} Constructed Deck`,
    deckType: "constructed",
    factionId: deck.factionId,
    factionName: deck.factionName || getFactionById(deck.factionId)?.name || deck.factionId,
    baseCardCount: BASE_PLAYING_DECK_SIZE,
    maxCardCount: MAX_CONSTRUCTED_DECK_SIZE,
    cardCount: BASE_PLAYING_DECK_SIZE,
    replacementCount: cards.length,
    additionCount: cards.length,
    valueCounts: getReplacementValueCounts(cards),
    cardQuantities: { ...gameplayCardQuantities },
    gameplayCardQuantities: { ...gameplayCardQuantities },
    cardSuitChoices: { ...(deck.cardSuitChoices || {}) },
    collectorVariantSelections,
    gameplayConfigurationHash: deck.gameplayConfigurationHash || null,
    collectorConfigurationHash: deck.collectorConfigurationHash || null,
    savedAt: deck.savedAt || null,
    deckId: deck.deckId || null,
    versionId: deck.versionId || null,
    cards
  };
}

function validateConstructedDeckPayload(stats = {}, payload = {}) {
  const factionId = String(payload.factionId || "");
  const faction = getFactionById(factionId);
  if (!faction) throw new Error("Choose a valid faction for the constructed deck.");
  const requestedQuantities = payload.gameplayCardQuantities || payload.cardQuantities;
  const requested = requestedQuantities && typeof requestedQuantities === "object" ? requestedQuantities : {};
  const requestedSuitChoices = payload.cardSuitChoices && typeof payload.cardSuitChoices === "object" ? payload.cardSuitChoices : {};
  const requestedVariantSelections = payload.collectorVariantSelections && typeof payload.collectorVariantSelections === "object"
    ? payload.collectorVariantSelections
    : {};
  const collection = normalizeCollection(stats);
  const sanitized = {};
  const sanitizedSuitChoices = {};
  let totalReplacements = 0;
  const valueCounts = {};
  const slotCounts = {};

  for (const [cardId, rawQuantity] of Object.entries(requested)) {
    const quantity = Math.max(0, Math.floor(Number(rawQuantity || 0)));
    if (quantity <= 0) continue;
    const card = getCollectionCatalogCard(cardId);
    if (!card || card.factionId !== factionId) throw new Error("Constructed decks can only include cards from one faction.");
    const value = getReplacementCardValue(card);
    if (value == null) throw new Error(`${card.name} cannot be used in a 52-card deck because it does not have a valid playing-card value.`);
    const entitled = Math.max(0, Math.floor(Number(collection.gameplayEntitlements?.[cardId] || 0)));
    if (quantity > entitled) {
      throw new Error(`You have earned ${entitled} gameplay cop${entitled === 1 ? "y" : "ies"} of ${card.name}.`);
    }
    valueCounts[value] = (valueCounts[value] || 0) + quantity;
    if (valueCounts[value] > MAX_REPLACEMENTS_PER_VALUE) {
      throw new Error(`Your 52-card deck can only have ${MAX_REPLACEMENTS_PER_VALUE} cards with value ${value}. Swap fewer cards at that value.`);
    }
    totalReplacements += quantity;
    if (totalReplacements > MAX_CONSTRUCTED_REPLACEMENTS) {
      throw new Error(`Constructed decks stay at ${BASE_PLAYING_DECK_SIZE} cards total.`);
    }
    sanitized[cardId] = quantity;
    const rawSuitChoices = Array.isArray(requestedSuitChoices[cardId]) ? requestedSuitChoices[cardId] : [];
    sanitizedSuitChoices[cardId] = Array.from({ length: quantity }, (_, index) => (
      normalizeDeckSuit(rawSuitChoices[index]) || DRAFT_CARD_SUITS[index % DRAFT_CARD_SUITS.length]
    ));
    for (const suit of sanitizedSuitChoices[cardId]) {
      const slotKey = `${value}:${suit}`;
      slotCounts[slotKey] = (slotCounts[slotKey] || 0) + 1;
      if (slotCounts[slotKey] > 1) {
        throw new Error(`Only one card can replace the ${value} of ${suit}. Choose a different suit for one of those cards.`);
      }
    }
  }

  const collectorVariantSelections = resolveCollectorVariantSelections(
    collection,
    sanitized,
    requestedVariantSelections
  );

  return {
    name: String(payload.name || `${faction.name} Constructed Deck`).slice(0, 80),
    factionId,
    factionName: faction.name,
    baseCardCount: BASE_PLAYING_DECK_SIZE,
    maxCardCount: MAX_CONSTRUCTED_DECK_SIZE,
    cardCount: BASE_PLAYING_DECK_SIZE,
    replacementCount: totalReplacements,
    additionCount: totalReplacements,
    valueCounts,
    slotCounts,
    legality: {
      valid: true,
      errors: [],
      replacementCount: totalReplacements,
      cardCount: BASE_PLAYING_DECK_SIZE
    },
    cardQuantities: sanitized,
    gameplayCardQuantities: sanitized,
    cardSuitChoices: sanitizedSuitChoices,
    collectorVariantSelections,
    savedAt: new Date().toISOString()
  };
}

function makeDeckVersion(deck, source = "constructed-editor") {
  const createdAt = new Date().toISOString();
  return normalizeDeckVersion({
    ...clonePlain(deck),
    id: crypto.randomUUID(),
    createdAt,
    source,
    savedAt: createdAt
  });
}

function syncLegacyDeckPointers(stats = {}) {
  const library = normalizeDeckLibrary(stats);
  const constructedRecord = library.decks.find((deck) => deck.id === library.activeConstructedDeckId && !deck.archived);
  const constructedVersion = getDeckRecordVersion(constructedRecord);
  stats.savedConstructedDeck = constructedRecord && constructedVersion ? {
    ...clonePlain(constructedVersion),
    name: constructedRecord.name,
    factionId: constructedRecord.factionId,
    factionName: constructedRecord.factionName,
    deckId: constructedRecord.id,
    versionId: constructedVersion.id
  } : null;

  const activeDraftRecords = Object.values(library.activeDraftDeckIds || {})
    .map((deckId) => library.decks.find((deck) => deck.id === deckId && !deck.archived))
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const draftRecord = activeDraftRecords[0] || null;
  const draftVersion = getDeckRecordVersion(draftRecord);
  stats.savedDraftDeck = draftRecord && draftVersion ? {
    ...clonePlain(draftVersion),
    name: draftRecord.name,
    factionId: draftRecord.factionId,
    factionName: draftRecord.factionName,
    draftType: draftRecord.draftType,
    deckId: draftRecord.id,
    versionId: draftVersion.id
  } : null;
  return library;
}

function saveConstructedDeckToLibrary(stats = {}, payload = {}, ownerId = null) {
  const validated = validateConstructedDeckPayload(stats, payload);
  const library = normalizeDeckLibrary(stats, ownerId);
  const existing = payload.deckId
    ? library.decks.find((deck) => deck.id === payload.deckId && deck.format === "constructed" && !deck.archived)
    : null;
  if (payload.deckId && !existing) throw new Error("That constructed deck could not be found.");
  const version = makeDeckVersion(validated);
  const now = version.createdAt;
  let record;
  if (existing) {
    existing.name = validated.name;
    existing.factionId = validated.factionId;
    existing.factionName = validated.factionName;
    existing.coverId = payload.coverId || existing.coverId || validated.factionId;
    existing.updatedAt = now;
    existing.currentVersionId = version.id;
    existing.versions = [...existing.versions, version];
    record = existing;
  } else {
    record = {
      id: crypto.randomUUID(),
      ownerId,
      name: validated.name,
      factionId: validated.factionId,
      factionName: validated.factionName,
      format: "constructed",
      source: "constructed-editor",
      draftType: null,
      coverId: payload.coverId || validated.factionId,
      archived: false,
      featured: false,
      createdAt: now,
      updatedAt: now,
      currentVersionId: version.id,
      versions: [version],
      record: { wins: 0, losses: 0, draws: 0, recentMatchIds: [] }
    };
    library.decks.push(record);
  }
  library.activeConstructedDeckId = record.id;
  stats.deckLibrary = library;
  syncLegacyDeckPointers(stats);
  return { record, playableDeck: getSavedConstructedDeck(stats) };
}

function saveDraftDeckToLibrary(stats = {}, savedDraftDeck, ownerId = null) {
  const library = normalizeDeckLibrary(stats, ownerId);
  const version = makeDeckVersion(savedDraftDeck, "draft");
  const now = version.createdAt;
  const record = {
    id: crypto.randomUUID(),
    ownerId,
    name: savedDraftDeck.name,
    factionId: savedDraftDeck.factionId,
    factionName: savedDraftDeck.factionName,
    format: "draft",
    source: "draft",
    draftType: savedDraftDeck.draftType === "bot" ? "bot" : "player",
    coverId: savedDraftDeck.factionId,
    archived: false,
    featured: false,
    createdAt: now,
    updatedAt: now,
    currentVersionId: version.id,
    versions: [version],
    record: { wins: 0, losses: 0, draws: 0, recentMatchIds: [] }
  };
  library.decks.push(record);
  library.activeDraftDeckIds[record.draftType] = record.id;
  stats.deckLibrary = library;
  syncLegacyDeckPointers(stats);
  return record;
}

function updateDeckLibraryRecord(stats = {}, deckId, patch = {}) {
  const library = normalizeDeckLibrary(stats);
  const record = library.decks.find((deck) => deck.id === deckId);
  if (!record) throw new Error("Deck not found.");
  const action = patch.action;
  if (action === "duplicate") {
    const version = getDeckRecordVersion(record);
    const duplicateVersion = makeDeckVersion(version, "duplicate");
    const now = duplicateVersion.createdAt;
    const duplicate = {
      ...clonePlain(record),
      id: crypto.randomUUID(),
      name: String(patch.name || `${record.name} Copy`).trim().slice(0, 80),
      source: "duplicate",
      archived: false,
      featured: false,
      createdAt: now,
      updatedAt: now,
      currentVersionId: duplicateVersion.id,
      versions: [duplicateVersion],
      record: { wins: 0, losses: 0, draws: 0, recentMatchIds: [] }
    };
    library.decks.push(duplicate);
    stats.deckLibrary = library;
    syncLegacyDeckPointers(stats);
    return duplicate;
  }
  if (action === "archive") {
    record.archived = true;
    record.featured = false;
  } else if (action === "restore") {
    record.archived = false;
  } else if (action === "activate") {
    if (record.archived) throw new Error("Restore this deck before activating it.");
    if (record.format === "constructed") library.activeConstructedDeckId = record.id;
    else library.activeDraftDeckIds[record.draftType === "bot" ? "bot" : "player"] = record.id;
  } else if (action === "feature") {
    if (record.archived) throw new Error("Restore this deck before featuring it.");
    const featuredCount = library.decks.filter((deck) => deck.featured && !deck.archived && deck.id !== record.id).length;
    if (!record.featured && featuredCount >= 3) throw new Error("You can feature up to three decks.");
    record.featured = !record.featured;
  } else if (action === "rename") {
    const name = String(patch.name || "").trim().slice(0, 80);
    if (!name) throw new Error("Deck name is required.");
    record.name = name;
  } else {
    throw new Error("Unknown deck action.");
  }
  record.updatedAt = new Date().toISOString();
  stats.deckLibrary = library;
  syncLegacyDeckPointers(stats);
  return record;
}

function applyDeckResult(stats = {}, deckVersionId, result, matchId) {
  if (!deckVersionId || !["win", "loss", "draw"].includes(result)) return;
  const library = normalizeDeckLibrary(stats);
  const record = library.decks.find((deck) => deck.versions.some((version) => version.id === deckVersionId));
  if (!record) return;
  const field = result === "win" ? "wins" : result === "loss" ? "losses" : "draws";
  record.record[field] = (record.record[field] || 0) + 1;
  if (matchId) record.record.recentMatchIds = [matchId, ...(record.record.recentMatchIds || []).filter((id) => id !== matchId)].slice(0, 10);
  stats.deckLibrary = library;
}

function normalizeProgression(stats = {}) {
  const base = emptyProgression();
  const progression = stats.progression || {};
  return {
    achievements: { ...base.achievements, ...(progression.achievements || {}) },
    campaign: { ...base.campaign, ...(progression.campaign || {}) },
    // Durable compatibility index only. These references intentionally do not
    // duplicate result, opponent, faction, life, or campaign facts from record v2.
    matchHistory: [...new Map((Array.isArray(progression.matchHistory) ? progression.matchHistory : [])
      .map((entry) => {
        const matchId = entry?.matchId || entry?.id || null;
        if (!matchId) return null;
        return [matchId, {
          matchId,
          recordVersion: Number(entry.recordVersion || 2),
          completedAt: entry.completedAt || null,
          deckVersionId: entry.deckVersionId || null
        }];
      })
      .filter(Boolean)).values()].slice(0, 30),
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
  const stats = account.stats || {};
  normalizeDeckLibrary(stats, account.id);
  return {
    id: account.id,
    name: account.name,
    createdAt: account.createdAt,
    lastLoginAt: account.lastLoginAt || null,
    stats,
    progression: progressionSummary(stats),
    collection: collectionSummary(stats)
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

function issueAccountSession(account, now = Date.now()) {
  return {
    token: signAuthPayload({ id: account.id, name: account.name, iat: now, exp: now + ACCOUNT_SESSION_TTL_MS }),
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
    const error = new Error(message);
    error.name = "SupabaseRequestError";
    error.status = response.status;
    error.code = data?.code || null;
    error.details = data?.details || null;
    error.hint = data?.hint || null;
    error.pathname = pathname;
    throw error;
  }
  return data;
}

function buildPublicPlayerProfile(account, matchRecords = [], options = {}) {
  const stats = account?.stats || {};
  const library = normalizeDeckLibrary(stats, account?.id);
  const ranked = {
    wins: Number(stats.rankedGamesWon || 0),
    losses: Number(stats.rankedGamesLost || 0),
    draws: Number(stats.rankedGamesDrawn || 0)
  };
  ranked.gamesPlayed = ranked.wins + ranked.losses + ranked.draws;
  ranked.winRate = ranked.wins + ranked.losses > 0 ? Math.round((ranked.wins / (ranked.wins + ranked.losses)) * 1000) / 10 : 0;
  const all = {
    wins: Number(stats.gamesWon || 0),
    losses: Number(stats.gamesLost || 0),
    draws: Number(stats.gamesDrawn || 0)
  };
  all.gamesPlayed = all.wins + all.losses + all.draws;
  all.winRate = all.wins + all.losses > 0 ? Math.round((all.wins / (all.wins + all.losses)) * 1000) / 10 : 0;

  const factionRecords = {};
  let largestAttack = null;
  let totalDamageDealt = 0;
  let totalDamagePrevented = 0;
  for (const record of matchRecords) {
    const participant = record.participants?.find((entry) => entry.accountId === account.id);
    if (!participant) continue;
    const factionId = participant.faction?.id || "basic";
    factionRecords[factionId] = factionRecords[factionId] || {
      factionId,
      factionName: participant.faction?.name || factionId,
      wins: 0,
      losses: 0,
      draws: 0
    };
    const resultField = participant.result === "win" ? "wins" : participant.result === "loss" ? "losses" : participant.result === "draw" ? "draws" : null;
    if (resultField) factionRecords[factionId][resultField] += 1;
    const playerCombat = record.combatStats?.byPlayer?.[String(participant.playerNum)] || {};
    totalDamageDealt += Number(playerCombat.damageDealt || 0);
    totalDamagePrevented += Number(playerCombat.damagePrevented || 0);
    if (record.notableMoments?.largestAttack?.playerNum === participant.playerNum) {
      const candidate = { ...record.notableMoments.largestAttack, matchId: record.matchId };
      if (!largestAttack || candidate.value > largestAttack.value) largestAttack = candidate;
    }
  }

  const progression = normalizeProgression(stats);
  const cosmetics = progression.cosmetics || {};
  return {
    profileVersion: 1,
    accountId: account.id,
    displayName: account.name,
    memberSince: account.createdAt,
    lastSeenAt: account.lastSeenAt || null,
    identity: {
      selectedTitle: cosmetics.selectedTitle || "recruit",
      selectedFactionBadge: cosmetics.selectedFactionBadge || "none",
      selectedCardBack: cosmetics.selectedCardBack || "classic"
    },
    competitiveRecord: {
      ranked,
      all,
      activeSeason: buildSeasonProfile(stats, options.seasonStanding || null, options.season || ACTIVE_SEASON)
    },
    verifiedMatchCount: matchRecords.length,
    factionRecords: Object.values(factionRecords).sort((a, b) => b.wins - a.wins || a.factionName.localeCompare(b.factionName)),
    notableStats: { largestAttack, totalDamageDealt, totalDamagePrevented },
    achievements: Object.values(progression.achievements || {}).map((achievement) => ({
      id: achievement.id,
      name: achievement.name,
      description: achievement.description,
      unlockedAt: achievement.unlockedAt
    })),
    featuredDecks: library.decks.filter((deck) => deck.featured && !deck.archived).slice(0, 3).map((deck) => ({
      id: deck.id,
      name: deck.name,
      factionId: deck.factionId,
      factionName: deck.factionName,
      format: deck.format,
      draftType: deck.draftType,
      coverId: deck.coverId,
      currentVersionId: deck.currentVersionId,
      updatedAt: deck.updatedAt,
      record: clonePlain(deck.record || { wins: 0, losses: 0, draws: 0, recentMatchIds: [] })
    })),
    recentMatches: matchRecords.slice(0, 12).map((record) => ({
      ...publicMatchSummary(record, { accountId: account.id }),
      replay: replayAvailability(record, publicMatchStorageStatus())
    })),
    unavailableMatchReferences: normalizeProgression(stats).matchHistory
      .filter((reference) => !matchRecords.some((record) => record.matchId === reference.matchId))
      .slice(0, 12)
  };
}

function normalizeFriendChallenges(stats = {}, now = Date.now()) {
  const challenges = Array.isArray(stats.friendChallenges) ? stats.friendChallenges : [];
  const normalized = challenges
    .filter((challenge) => challenge?.id && challenge?.roomCode && challenge?.fromId && challenge?.toId)
    .map((challenge) => {
      const next = { ...challenge };
      if (next.status === "pending" && Date.parse(next.expiresAt || 0) <= now) next.status = "expired";
      return next;
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 30);
  stats.friendChallenges = normalized;
  return normalized;
}

function publicFriendChallenge(challenge) {
  return {
    id: challenge.id,
    fromId: challenge.fromId,
    fromName: challenge.fromName,
    toId: challenge.toId,
    toName: challenge.toName,
    roomCode: challenge.roomCode,
    mode: challenge.mode || "factions",
    bestOf: challenge.bestOf === 3 ? 3 : 1,
    status: challenge.status,
    createdAt: challenge.createdAt,
    expiresAt: challenge.expiresAt,
    respondedAt: challenge.respondedAt || null
  };
}

function addFriendChallenge(stats = {}, challenge) {
  const challenges = normalizeFriendChallenges(stats).filter((entry) => entry.id !== challenge.id);
  stats.friendChallenges = [clonePlain(challenge), ...challenges].slice(0, 30);
  return challenge;
}

function setFriendChallengeStatus(stats = {}, challengeId, status, respondedAt = new Date().toISOString()) {
  const challenge = normalizeFriendChallenges(stats).find((entry) => entry.id === challengeId);
  if (!challenge) return null;
  challenge.status = status;
  challenge.respondedAt = respondedAt;
  return challenge;
}

function matchRecordToSupabaseRow(record) {
  return {
    id: record.matchId,
    series_id: record.seriesId,
    mode: record.mode,
    rules_version: record.rulesVersion,
    content_version: record.contentVersion,
    ranked: record.ranked,
    started_at: record.startedAt,
    completed_at: record.completedAt,
    completion_reason: record.completionReason,
    winner_player_num: record.winnerPlayerNum,
    participant_account_ids: record.participants.map((participant) => participant.accountId).filter(Boolean),
    record
  };
}

async function persistMatchRecord(record, options = {}) {
  return matchPersistence.persist(record, options);
}

async function findMatchRecordById(matchId) {
  return matchPersistence.findById(matchId);
}

async function listMatchRecordsByAccount(accountId, limit = 30) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 30, 100));
  const mode = await matchPersistence.getMode();
  let indexedMatchIds = [];
  if (mode === "compatibility") {
    const account = await findSupabaseAccountById(accountId);
    indexedMatchIds = normalizeProgression(account?.stats || {}).matchHistory.map((entry) => entry.matchId || entry.id);
  }
  const records = await matchPersistence.listByAccount(accountId, safeLimit, indexedMatchIds);
  return records.filter((record) => record && (!record.completion || record.completion.status === "finalized"));
}

async function commitCompatibilityAccountApplications(_matchId, accountApplications = []) {
  for (const application of accountApplications) {
    await recordAccountGameResult(application.accountId, application.result, {
      ...(application.context || {}),
      compatibilityPersistence: true,
      deferPersistence: false
    });
  }
}

const matchPersistence = createMatchPersistence({
  useSupabaseStore,
  supabaseRequest,
  localStore: localMatchStore,
  toPreferredRow: matchRecordToSupabaseRow,
  commitCompatibilityApplications: commitCompatibilityAccountApplications
});

function publicMatchStorageStatus() {
  const { mode, capabilities } = matchPersistence.status();
  return { mode, capabilities };
}

function getNextCampaignMission(account, factionId, chapterId, result) {
  if (result !== "win" || !factionId || !chapterId) return null;
  const chapters = campaignChapters[factionId] || [];
  const completed = account?.progression?.campaign?.[factionId]
    || normalizeProgression(account?.stats || {}).campaign[factionId]
    || [];
  const next = chapters.find((chapter) => !completed.includes(chapter.id));
  if (!next) return { status: "complete", factionId, chapterId: null, title: "Campaign complete" };
  const enriched = getCampaignChapter(factionId, next.id);
  return {
    status: "available",
    factionId,
    chapterId: next.id,
    title: enriched?.title || next.title,
    opponentName: enriched?.opponentName || next.opponentName,
    chapterNumber: chapters.findIndex((entry) => entry.id === next.id) + 1
  };
}

const finalizeCompletedMatch = createFinalizeCompletedMatch({
  findMatchRecord: findMatchRecordById,
  persistMatchRecord,
  applyAccountConsequence: async (consequence) => {
    const storageMode = await matchPersistence.getMode();
    return recordAccountGameResult(
      consequence.accountId,
      consequence.result,
      {
        ...consequence.context,
        // The preferred schema commits prepared account applications in the
        // authoritative finalization RPC. Compatibility storage commits the
        // updated account projection and embedded receipt in one PATCH.
        deferPersistence: storageMode === "preferred",
        compatibilityPersistence: useSupabaseStore() && storageMode !== "preferred"
      }
    );
  },
  buildEnvelope: buildCompletionEnvelope,
  buildNextMission: async ({ account, factionId, chapterId, result }) => getNextCampaignMission(account, factionId, chapterId, result)
});

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

async function getAccountStatsById(accountId) {
  if (!accountId) return {};
  if (useSupabaseStore()) return (await findSupabaseAccountById(accountId))?.stats || {};
  return loadAccountStore().accounts.find((entry) => entry.id === accountId)?.stats || {};
}

async function requireAccountRecord(req, res) {
  const authHeader = req.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const payload = verifyAuthToken(token);
  if (!payload) {
    logAuthFailure("session_rejected", req, { reason: "invalid_or_expired" });
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
  const challenges = normalizeFriendChallenges(account.stats || {}).map(publicFriendChallenge);
  return { friends, messages, challenges };
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

  const challenges = normalizeFriendChallenges(account.stats || {}).map(publicFriendChallenge);
  return { friends, messages, challenges };
}

async function getFriendPayload(context) {
  if (context.source === "supabase") return getSupabaseFriendPayload(context.account);
  return getLocalFriendPayload(context.store, context.account);
}

async function persistFriendChallenge(challenge) {
  if (useSupabaseStore()) {
    const [sender, recipient] = await Promise.all([
      findSupabaseAccountById(challenge.fromId),
      findSupabaseAccountById(challenge.toId)
    ]);
    if (!sender || !recipient) throw new Error("Friend account not found.");
    const senderStats = sender.stats || {};
    const recipientStats = recipient.stats || {};
    addFriendChallenge(senderStats, challenge);
    addFriendChallenge(recipientStats, challenge);
    await Promise.all([
      patchSupabaseAccount(sender.id, { stats: senderStats }),
      patchSupabaseAccount(recipient.id, { stats: recipientStats })
    ]);
    return challenge;
  }

  const store = loadAccountStore();
  const sender = store.accounts.find((account) => account.id === challenge.fromId);
  const recipient = store.accounts.find((account) => account.id === challenge.toId);
  if (!sender || !recipient) throw new Error("Friend account not found.");
  sender.stats = sender.stats || {};
  recipient.stats = recipient.stats || {};
  addFriendChallenge(sender.stats, challenge);
  addFriendChallenge(recipient.stats, challenge);
  saveAccountStore(store);
  return challenge;
}

async function updateFriendChallengeStatus(challengeId, actorId, status) {
  const allowedStatuses = new Set(["accepted", "declined", "cancelled"]);
  if (!allowedStatuses.has(status)) throw new Error("Unknown challenge response.");
  const respondedAt = new Date().toISOString();

  if (useSupabaseStore()) {
    const actor = await findSupabaseAccountById(actorId);
    const challenge = normalizeFriendChallenges(actor?.stats || {}).find((entry) => entry.id === challengeId);
    if (!challenge || challenge.status !== "pending") throw new Error("That challenge is no longer available.");
    if (status === "cancelled" ? challenge.fromId !== actorId : challenge.toId !== actorId) throw new Error("That challenge is not yours to update.");
    const [sender, recipient] = await Promise.all([
      findSupabaseAccountById(challenge.fromId),
      findSupabaseAccountById(challenge.toId)
    ]);
    for (const account of [sender, recipient]) {
      if (!account) continue;
      account.stats = account.stats || {};
      setFriendChallengeStatus(account.stats, challengeId, status, respondedAt);
    }
    await Promise.all([sender, recipient].filter(Boolean).map((account) => patchSupabaseAccount(account.id, { stats: account.stats })));
    return { ...challenge, status, respondedAt };
  }

  const store = loadAccountStore();
  const actor = store.accounts.find((account) => account.id === actorId);
  const challenge = normalizeFriendChallenges(actor?.stats || {}).find((entry) => entry.id === challengeId);
  if (!challenge || challenge.status !== "pending") throw new Error("That challenge is no longer available.");
  if (status === "cancelled" ? challenge.fromId !== actorId : challenge.toId !== actorId) throw new Error("That challenge is not yours to update.");
  for (const account of store.accounts.filter((entry) => entry.id === challenge.fromId || entry.id === challenge.toId)) {
    account.stats = account.stats || {};
    setFriendChallengeStatus(account.stats, challengeId, status, respondedAt);
  }
  saveAccountStore(store);
  return { ...challenge, status, respondedAt };
}

async function acceptFriendChallengeForRoom(roomCode, accountId) {
  if (!accountId) return null;
  const account = useSupabaseStore()
    ? await findSupabaseAccountById(accountId)
    : loadAccountStore().accounts.find((entry) => entry.id === accountId);
  const challenge = normalizeFriendChallenges(account?.stats || {}).find((entry) => (
    entry.roomCode === roomCode && entry.toId === accountId && entry.status === "pending"
  ));
  return challenge ? updateFriendChallengeStatus(challenge.id, accountId, "accepted") : null;
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

  // Compatibility/account index only: immutable match facts remain in record
  // v2. Keep the smallest useful durable reference, keyed by match ID.
  if (context.matchId) {
    progression.matchHistory = progression.matchHistory.filter((entry) => entry.matchId !== context.matchId);
    progression.matchHistory.unshift({
      matchId: context.matchId,
      recordVersion: Number(context.matchIndex?.recordVersion || 2),
      completedAt: context.matchIndex?.completedAt || now,
      deckVersionId: context.matchIndex?.deckVersionId || context.deckVersionId || null
    });
  }
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
    const firstChapterClear = !completed.includes(context.campaign.chapterId);
    if (firstChapterClear) {
      completed.push(context.campaign.chapterId);
      const collection = normalizeCollection(stats);
      collection.packCredits += 1;
      collection.earnedPackCredits += 1;
      stats.collection = collection;
    }
    progression.campaign[campaignFaction] = completed;
    awardAchievement(progression, "first-campaign-clear", "Campaigner", "Clear a campaign chapter.", now);
    unlockProgressionItem(progression, "titles", "campaigner");
    unlockProgressionItem(progression, "cardBacks", "campaignMap");
  }

  stats.progression = progression;
}

function accountConsequenceFacts(beforeStats, afterStats, result, context = {}) {
  const beforeProgression = normalizeProgression(beforeStats);
  const afterProgression = normalizeProgression(afterStats);
  const beforeCollection = normalizeCollection(beforeStats);
  const afterCollection = normalizeCollection(afterStats);
  const achievementsUnlocked = Object.keys(afterProgression.achievements)
    .filter((id) => !beforeProgression.achievements[id])
    .map((id) => afterProgression.achievements[id]);
  const cosmeticsUnlocked = [
    ["titles", afterProgression.cosmetics.unlockedTitles, beforeProgression.cosmetics.unlockedTitles],
    ["cardBacks", afterProgression.cosmetics.unlockedCardBacks, beforeProgression.cosmetics.unlockedCardBacks],
    ["factionBadges", afterProgression.cosmetics.unlockedFactionBadges, beforeProgression.cosmetics.unlockedFactionBadges]
  ].flatMap(([bucket, after, before]) => after.filter((id) => !before.includes(id)).map((id) => ({ bucket, id })));
  const firstClear = Boolean(
    context.campaign
    && result === "win"
    && !((beforeProgression.campaign[context.campaign.factionId] || []).includes(context.campaign.chapterId))
  );
  const beforeSeason = context.season ? normalizeSeasonStats(beforeStats, context.season) : null;
  const afterSeason = context.season ? normalizeSeasonStats(afterStats, context.season) : null;
  const seasonMatch = context.matchId
    ? afterSeason?.recentMatches?.find((entry) => entry.matchId === context.matchId) || null
    : null;
  return {
    result,
    boosterCreditDelta: afterCollection.packCredits - beforeCollection.packCredits,
    boosterCreditReason: firstClear ? "campaign_first_clear" : null,
    achievementsUnlocked,
    cosmeticsUnlocked,
    campaign: context.campaign ? {
      factionId: context.campaign.factionId,
      chapterId: context.campaign.chapterId,
      title: context.campaign.title,
      outcome: result === "win" ? "cleared" : "not-cleared",
      clearType: result === "win" ? (firstClear ? "first-clear" : "repeat-clear") : null,
      firstClear
    } : null,
    season: context.season ? {
      season: clonePlain(context.season),
      result,
      seriesResult: seasonMatch?.seriesResult || null,
      pointsDelta: Number(afterSeason?.points || 0) - Number(beforeSeason?.points || 0),
      record: buildSeasonProfile(afterStats, null, context.season).record
    } : null,
    progression: { campaign: afterProgression.campaign }
  };
}

function publicAccountProjection(account) {
  if (!account) return null;
  return {
    id: account.id,
    name: account.name,
    stats: account.stats || {},
    progression: progressionSummary(account.stats || {}),
    collection: collectionSummary(account.stats || {})
  };
}

async function recordAccountGameResult(accountId, result, context = {}) {
  if (!accountId || !["win", "loss", "draw"].includes(result)) return null;
  const matchId = context.matchId || null;
  const key = matchId ? receiptKey(matchId, accountId) : null;
  if (useSupabaseStore()) {
    const account = await findSupabaseAccountById(accountId);
    if (!account) return null;
    const stats = account.stats || {};
    const receipts = stats.matchConsequenceReceipts || {};
    if (key && receipts[key]) return { alreadyApplied: true, account: publicAccountProjection(account), ...receipts[key] };
    const beforeStats = JSON.parse(JSON.stringify(stats));
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
    if (context.draftLeague) {
      stats.draftLeagueGamesPlayed = (stats.draftLeagueGamesPlayed || 0) + 1;
      if (result === "win") stats.draftLeagueGamesWon = (stats.draftLeagueGamesWon || 0) + 1;
      if (result === "loss") stats.draftLeagueGamesLost = (stats.draftLeagueGamesLost || 0) + 1;
      if (result === "draw") stats.draftLeagueGamesDrawn = (stats.draftLeagueGamesDrawn || 0) + 1;
    }
    applySeasonResult(stats, result, context);
    applyDeckResult(stats, context.deckVersionId, result, context.matchId);
    applyProgressionForResult(stats, result, context);
    const facts = accountConsequenceFacts(beforeStats, stats, result, context);
    if (key && context.compatibilityPersistence) {
      stats.matchConsequenceReceipts = { ...receipts, [key]: facts };
      await patchSupabaseAccount(accountId, { stats, last_seen_at: new Date().toISOString() });
    } else if (key && !context.deferPersistence) {
      stats.matchConsequenceReceipts = { ...receipts, [key]: facts };
      const rpcResult = await supabaseRequest("rpc/apply_gauntlet_account_consequence", {
        method: "POST",
        body: JSON.stringify({
          p_match_id: matchId,
          p_account_id: accountId,
          p_result: result,
          p_consequence: facts,
          p_next_stats: stats
        })
      });
      if (rpcResult?.alreadyApplied) {
        const receiptRows = await supabaseRequest(`gauntlet_match_consequence_receipts?match_id=eq.${encodeURIComponent(matchId)}&account_id=eq.${encodeURIComponent(accountId)}&select=consequence`);
        const currentAccount = await findSupabaseAccountById(accountId);
        return { alreadyApplied: true, account: publicAccountProjection(currentAccount), ...(receiptRows?.[0]?.consequence || facts) };
      }
    } else if (!context.deferPersistence) {
      await patchSupabaseAccount(accountId, { stats, last_seen_at: new Date().toISOString() });
    }
    return {
      alreadyApplied: false,
      account: publicAccountProjection({ ...account, stats }),
      ...(context.deferPersistence ? { nextStats: stats } : {}),
      ...facts
    };
  }

  const store = loadAccountStore();
  const account = store.accounts.find((entry) => entry.id === accountId);
  if (!account) return null;

  account.stats = account.stats || {};
  const receipts = account.stats.matchConsequenceReceipts || {};
  if (key && receipts[key]) return { alreadyApplied: true, account: publicAccountProjection(account), ...receipts[key] };
  const beforeStats = JSON.parse(JSON.stringify(account.stats));
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
  if (context.draftLeague) {
    account.stats.draftLeagueGamesPlayed = (account.stats.draftLeagueGamesPlayed || 0) + 1;
    if (result === "win") account.stats.draftLeagueGamesWon = (account.stats.draftLeagueGamesWon || 0) + 1;
    if (result === "loss") account.stats.draftLeagueGamesLost = (account.stats.draftLeagueGamesLost || 0) + 1;
    if (result === "draw") account.stats.draftLeagueGamesDrawn = (account.stats.draftLeagueGamesDrawn || 0) + 1;
  }
  applySeasonResult(account.stats, result, context);
  applyDeckResult(account.stats, context.deckVersionId, result, context.matchId);
  applyProgressionForResult(account.stats, result, context);
  const facts = accountConsequenceFacts(beforeStats, account.stats, result, context);
  if (key) account.stats.matchConsequenceReceipts = { ...receipts, [key]: facts };
  account.lastSeenAt = new Date().toISOString();
  saveAccountStore(store);
  return { alreadyApplied: false, account: publicAccountProjection(account), ...facts };
}

async function saveAccountDraftDeck(accountId, draftDeck) {
  if (!accountId || !draftDeck) return null;
  const draftLegality = validateReplacementCardSet(draftDeck.cards, { factionId: draftDeck.factionId });
  const savedDraftDeck = {
    name: draftDeck.name,
    factionId: draftDeck.factionId,
    factionName: draftDeck.factionName,
    draftType: draftDeck.draftType === "bot" ? "bot" : "player",
    baseCardCount: BASE_PLAYING_DECK_SIZE,
    maxCardCount: BASE_PLAYING_DECK_SIZE,
    cardCount: BASE_PLAYING_DECK_SIZE,
    replacementCount: draftDeck.cards.length,
    additionCount: draftDeck.cards.length,
    valueCounts: getReplacementValueCounts(draftDeck.cards),
    slotCounts: draftLegality.slotCounts,
    legality: {
      valid: true,
      errors: [],
      replacementCount: draftLegality.replacementCount,
      cardCount: BASE_PLAYING_DECK_SIZE
    },
    savedAt: new Date().toISOString(),
    cards: draftDeck.cards.map((card) => ({
      id: card.id,
      name: card.name,
      type: card.type,
      rarity: card.rarity,
      value: card.value,
      suit: normalizeReplacementSuit(card),
      replacementSuit: normalizeReplacementSuit(card),
      factionId: card.factionId,
      text: card.text || "",
      rulesText: card.rulesText || card.text || ""
    }))
  };

  if (useSupabaseStore()) {
    const account = await findSupabaseAccountById(accountId);
    if (!account) return null;
    const stats = account.stats || {};
    saveDraftDeckToLibrary(stats, savedDraftDeck, accountId);
    await patchSupabaseAccount(accountId, { stats, last_seen_at: savedDraftDeck.savedAt });
    return publicAccount(await findSupabaseAccountById(accountId));
  }

  const store = loadAccountStore();
  const account = store.accounts.find((entry) => entry.id === accountId);
  if (!account) return null;
  account.stats = account.stats || {};
  saveDraftDeckToLibrary(account.stats, savedDraftDeck, accountId);
  account.lastSeenAt = savedDraftDeck.savedAt;
  saveAccountStore(store);
  return publicAccount(account);
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

function getDraftLeagueProfile(account) {
  const wins = account.stats?.draftLeagueGamesWon || 0;
  const losses = account.stats?.draftLeagueGamesLost || 0;
  const draws = account.stats?.draftLeagueGamesDrawn || 0;
  const gamesPlayed = account.stats?.draftLeagueGamesPlayed || wins + losses + draws;
  const decidedGames = wins + losses;
  const winRatio = decidedGames > 0 ? wins / decidedGames : 0.5;
  return { wins, losses, draws, gamesPlayed, winRatio };
}

function pickCollectionCard(factionId, rarity) {
  const cardPool = COLLECTION_CARDS.filter((card) => card.factionId === factionId && card.rarity === rarity);
  if (cardPool.length === 0) return null;
  return getPlayableCollectionCard(cardPool[crypto.randomInt(cardPool.length)]);
}

function resolveBoosterSlot(slot) {
  if (slot !== "wild") return slot;
  return crypto.randomInt(100) < 20 ? "mythic" : "rare";
}

function openCollectionBooster(stats, packId) {
  const pack = BOOSTER_PRODUCTS[packId];
  if (!pack) throw new Error("Unknown earned gameplay pack.");

  const collection = normalizeCollection(stats);
  if (collection.packCredits <= 0) {
    throw new Error("You need an earned gameplay-pack credit. Clear a new campaign chapter to earn one.");
  }
  const openedCards = pack.slots
    .map((slot) => pickCollectionCard(pack.factionId, resolveBoosterSlot(slot)))
    .filter(Boolean);

  openedCards.forEach((card) => {
    collection.gameplayEntitlements[card.gameplayCardId] = (collection.gameplayEntitlements[card.gameplayCardId] || 0) + 1;
    collection.collectorVariants[card.defaultVariantId] = (collection.collectorVariants[card.defaultVariantId] || 0) + 1;
  });

  collection.packCredits -= 1;
  collection.openedGameplayPacks += 1;
  collection.openedPacks = collection.openedGameplayPacks;
  collection.cards = { ...collection.gameplayEntitlements };
  collection.lastGameplayPack = {
    packId,
    productType: FREE_GAMEPLAY_ACQUISITION,
    openedAt: new Date().toISOString(),
    gameplayCardIds: openedCards.map((card) => card.gameplayCardId),
    variantIds: openedCards.map((card) => card.defaultVariantId),
    cardIds: openedCards.map((card) => card.gameplayCardId)
  };
  collection.lastPack = collection.lastGameplayPack;
  stats.collection = collection;

  const progression = normalizeProgression(stats);
  awardAchievement(progression, "first-booster", "First Pack", "Open your first earned gameplay pack.", collection.lastGameplayPack.openedAt);
  stats.progression = progression;

  return openedCards.map((card) => ({
    ...card,
    variantId: card.defaultVariantId,
    acquisition: FREE_GAMEPLAY_ACQUISITION
  }));
}

function resolveCollectorPackProduct(productId) {
  if (COLLECTOR_PACK_PRODUCTS[productId]) return COLLECTOR_PACK_PRODUCTS[productId];
  const legacyPack = BOOSTER_PRODUCTS[productId];
  return legacyPack ? COLLECTOR_PACK_PRODUCTS[`${legacyPack.factionId}-collector`] : null;
}

function grantPurchasedCollectorPack(stats, productId, options = {}) {
  const product = resolveCollectorPackProduct(productId);
  if (!product) throw new Error("Unknown collector pack.");
  const eligibleVariants = COLLECTOR_VARIANTS.filter((variant) => (
    variant.paid
    && variant.acquisition === PAID_COLLECTOR_ACQUISITION
    && getGameplayCardById(variant.gameplayCardId)?.factionId === product.factionId
  ));
  const requestedVariantIds = Array.isArray(options.variantIds) ? options.variantIds.map(String) : null;
  if (requestedVariantIds && requestedVariantIds.length !== product.variantCount) {
    throw new Error(`${product.name} must grant exactly ${product.variantCount} collector variants.`);
  }
  const grantedVariants = requestedVariantIds
    ? requestedVariantIds.map((variantId) => {
        const variant = getCollectorVariantById(variantId);
        if (!variant || !eligibleVariants.some((candidate) => candidate.variantId === variant.variantId)) {
          throw new Error(`Collector variant ${variantId} is not valid for ${product.name}.`);
        }
        return variant;
      })
    : Array.from({ length: product.variantCount }, () => eligibleVariants[crypto.randomInt(eligibleVariants.length)]);
  const collection = normalizeCollection(stats);
  for (const variant of grantedVariants) {
    collection.collectorVariants[variant.variantId] = (collection.collectorVariants[variant.variantId] || 0) + 1;
  }
  collection.purchasedCollectorPacks += 1;
  collection.purchasedPacks = collection.purchasedCollectorPacks;
  collection.openedCollectorPacks += 1;
  collection.lastCollectorPack = {
    productId: product.id,
    productType: PAID_COLLECTOR_ACQUISITION,
    openedAt: options.openedAt || new Date().toISOString(),
    variantIds: grantedVariants.map((variant) => variant.variantId),
    provenance: options.provenance || "purchase-fulfillment"
  };
  collection.cards = { ...collection.gameplayEntitlements };
  stats.collection = collection;
  return grantedVariants.map(publicCollectorVariant);
}

function redemptionVariants(receipt) {
  return (receipt?.grantedVariantIds || [])
    .map((variantId) => getCollectorVariantById(variantId))
    .filter(Boolean)
    .map(publicCollectorVariant);
}

function redeemCollectorEntitlementStats(stats, entitlement, options = {}) {
  const collection = normalizeCollection(stats);
  const existing = collection.collectorRedemptionReceipts?.[entitlement.entitlementId];
  if (existing) {
    stats.collection = collection;
    return { alreadyRedeemed: true, receipt: existing, grantedVariants: redemptionVariants(existing) };
  }

  const product = resolveCollectorEntitlementProduct(entitlement.productId);
  if (!product || product.productType !== entitlement.productType) throw new Error("Unknown physical collector product.");
  const redeemedAt = options.redeemedAt || new Date().toISOString();
  const grantedVariants = grantPurchasedCollectorPack(stats, product.collectorPackId, {
    variantIds: [...product.variantIds],
    openedAt: redeemedAt,
    provenance: `${PHYSICAL_COLLECTOR_PRODUCT_TYPE}:${entitlement.issuanceSource}`
  });
  const nextCollection = normalizeCollection(stats);
  const receipt = {
    receiptVersion: COLLECTOR_REDEMPTION_RECEIPT_VERSION,
    entitlementId: entitlement.entitlementId,
    productId: product.id,
    productType: product.productType,
    redeemedAt,
    grantedVariantIds: grantedVariants.map((variant) => variant.variantId),
    acquisition: PHYSICAL_COLLECTOR_PRODUCT_TYPE,
    issuanceSource: entitlement.issuanceSource,
    externalReferenceHash: entitlement.externalReferenceHash
  };
  nextCollection.collectorRedemptionReceipts = {
    ...nextCollection.collectorRedemptionReceipts,
    [receipt.entitlementId]: receipt
  };
  nextCollection.collectorVariantProvenance = buildCollectorVariantProvenance(nextCollection.collectorRedemptionReceipts);
  nextCollection.lastCollectorPack = {
    ...nextCollection.lastCollectorPack,
    physicalProductId: product.id,
    entitlementId: entitlement.entitlementId,
    productType: product.productType,
    provenance: receipt.acquisition,
    issuanceSource: receipt.issuanceSource
  };
  stats.collection = nextCollection;
  return { alreadyRedeemed: false, receipt, grantedVariants };
}

function buildCompetitiveCapabilitySnapshot(stats = {}) {
  const collection = normalizeCollection(stats);
  return {
    rulesVersion: DUEL_RULES_VERSION,
    startingLife: BASIC_STARTING_LIFE,
    deckLimits: {
      basePlayingDeckSize: BASE_PLAYING_DECK_SIZE,
      maxConstructedDeckSize: MAX_CONSTRUCTED_DECK_SIZE,
      maxConstructedReplacements: MAX_CONSTRUCTED_REPLACEMENTS,
      maxReplacementsPerValue: MAX_REPLACEMENTS_PER_VALUE
    },
    winConditions: {
      lifeDepletion: "a player with zero or less life loses",
      simultaneousLifeDepletion: "higher remaining life wins; equal life draws",
      concession: "the conceding player loses"
    },
    gameplayPool: COLLECTION_CARDS
      .filter((card) => Number(collection.gameplayEntitlements[card.gameplayCardId] || 0) > 0)
      .map((card) => ({
        gameplayCardId: card.gameplayCardId,
        copies: Number(collection.gameplayEntitlements[card.gameplayCardId]),
        factionId: card.factionId,
        type: card.type,
        value: card.value,
        rulesText: card.text
      }))
      .sort((left, right) => left.gameplayCardId.localeCompare(right.gameplayCardId)),
    factions: listFactions().map((faction) => ({
      id: faction.id,
      commander: faction.commander.text,
      general: faction.general.text,
      city: faction.city.text
    }))
  };
}

app.get("/api/matches/:matchId", async (req, res) => {
  const matchId = String(req.params.matchId || "");
  if (!/^[0-9a-f-]{36}$/i.test(matchId)) {
    res.status(400).json({ error: "Invalid match ID." });
    return;
  }
  try {
    const record = await findMatchRecordById(matchId);
    if (!record || record.completion?.status === "pending") {
      res.status(404).json({ error: "Match not found." });
      return;
    }
    res.json({
      match: {
        ...publicMatchRecord(record),
        replay: replayAvailability(record, publicMatchStorageStatus())
      }
    });
  } catch (error) {
    console.error("[Matches] Failed to load public match", error);
    res.status(503).json({ error: "Match records are temporarily unavailable." });
  }
});

app.get("/api/matches/:matchId/replay", async (req, res) => {
  const matchId = String(req.params.matchId || "");
  if (!/^[0-9a-f-]{36}$/i.test(matchId)) {
    res.status(400).json({ error: "Invalid match ID." });
    return;
  }
  try {
    const record = await findMatchRecordById(matchId);
    if (!record || record.completion?.status === "pending") {
      res.status(404).json({ error: "Match replay not found." });
      return;
    }
    const replay = buildReplayTimeline(record, publicMatchStorageStatus());
    res.json({ replay });
  } catch (error) {
    if (error?.name === "MatchReplayIntegrityError") {
      console.error("[Replay] Authoritative evidence failed closed", { matchId, code: error.code, message: error.message });
      res.status(422).json({ error: "Authoritative replay evidence failed integrity validation.", code: error.code });
      return;
    }
    console.error("[Replay] Failed to load match replay", error);
    res.status(503).json({ error: "Match replay is temporarily unavailable." });
  }
});

app.get("/api/matches/:matchId/completion", async (req, res) => {
  const matchId = String(req.params.matchId || "");
  if (!/^[0-9a-f-]{36}$/i.test(matchId)) {
    res.status(400).json({ error: "Invalid match ID." });
    return;
  }
  try {
    const record = await findMatchRecordById(matchId);
    if (!record?.completion || record.completion.status !== "finalized") {
      res.status(404).json({ error: "Completed match not found." });
      return;
    }
    const authHeader = req.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const account = token ? await getAccountFromToken(token) : null;
    let accountConsequence = account
      ? record.completion.consequences?.find((entry) => entry.accountId === account.id) || null
      : record.completion.consequences?.[0] || null;
    if (account && record.season && accountConsequence?.season) {
      const accounts = useSupabaseStore()
        ? (await supabaseRequest("gauntlet_accounts?select=*")).map(accountFromSupabaseRow)
        : loadAccountStore().accounts;
      const standing = buildSeasonStandings(accounts, record.season).find((entry) => entry.accountId === account.id) || null;
      accountConsequence = {
        ...accountConsequence,
        season: { ...accountConsequence.season, rank: standing?.rank || null }
      };
    }
    const participant = account
      ? record.participants?.find((entry) => entry.accountId === account.id)
      : record.participants?.[0];
    const envelope = buildCompletionEnvelope({
      record,
      playerNum: participant?.playerNum || accountConsequence?.playerNum || 1,
      consequence: accountConsequence,
      account: account ? publicAccountProjection(account) : null,
      nextMission: accountConsequence?.nextMission || null
    });
    res.json({ completion: envelope });
  } catch (error) {
    console.error("[Matches] Failed to load completion envelope", error);
    res.status(503).json({ error: "Match completion is temporarily unavailable." });
  }
});

app.get("/api/game-content", (_req, res) => {
  res.json({ content: getPublicGameContent() });
});

app.get("/api/matches/:matchId/export/para", async (req, res) => {
  const matchId = String(req.params.matchId || "");
  if (!/^[0-9a-f-]{36}$/i.test(matchId)) {
    res.status(400).json({ error: "Invalid match ID." });
    return;
  }
  try {
    const record = await findMatchRecordById(matchId);
    if (!record || record.completion?.status === "pending") {
      res.status(404).json({ error: "Match not found." });
      return;
    }
    const version = req.query.version == null ? "1" : String(req.query.version).toLowerCase();
    if (!["1", "2", "v1", "v2"].includes(version)) {
      res.status(400).json({ error: "Unsupported Para export version." });
      return;
    }
    const matchUrl = `${CLIENT_URL.replace(/\/$/, "")}/?match=${encodeURIComponent(matchId)}`;
    res.json(buildParaMatchExport(record, matchUrl, new Date().toISOString(), {
      version,
      storage: publicMatchStorageStatus()
    }));
  } catch (error) {
    console.error("[Matches] Failed to export match", error);
    res.status(503).json({ error: "Match export is temporarily unavailable." });
  }
});

app.get("/api/account/matches", async (req, res) => {
  try {
    const context = await requireAccountRecord(req, res);
    if (!context) return;
    const records = await listMatchRecordsByAccount(context.account.id, req.query.limit);
    const safeLimit = Math.max(1, Math.min(Number(req.query.limit) || 30, 100));
    const references = normalizeProgression(context.account.stats || {}).matchHistory.slice(0, safeLimit);
    const availableIds = new Set(records.map((record) => record.matchId));
    res.json({
      matches: records.map((record) => ({
        ...publicMatchSummary(record, { accountId: context.account.id }),
        replay: replayAvailability(record, publicMatchStorageStatus())
      })),
      unavailableMatchReferences: references.filter((reference) => !availableIds.has(reference.matchId)),
      storage: publicMatchStorageStatus()
    });
  } catch (error) {
    console.error("[Matches] Failed to load account matches", error);
    res.status(503).json({ error: "Match records are temporarily unavailable." });
  }
});

app.get("/api/profiles/:accountId", async (req, res) => {
  const accountId = String(req.params.accountId || "");
  if (!/^[0-9a-f-]{36}$/i.test(accountId)) {
    res.status(400).json({ error: "Invalid profile ID." });
    return;
  }
  try {
    const account = useSupabaseStore()
      ? await findSupabaseAccountById(accountId)
      : loadAccountStore().accounts.find((entry) => entry.id === accountId);
    if (!account) {
      res.status(404).json({ error: "Profile not found." });
      return;
    }
    const records = await listMatchRecordsByAccount(account.id, 100);
    const season = getActiveSeason() || ACTIVE_SEASON;
    const accounts = useSupabaseStore()
      ? (await supabaseRequest("gauntlet_accounts?select=*")).map(accountFromSupabaseRow)
      : loadAccountStore().accounts;
    const seasonStanding = buildSeasonStandings(accounts, season).find((entry) => entry.accountId === account.id) || null;
    res.json({
      profile: buildPublicPlayerProfile(account, records, { season, seasonStanding }),
      storage: publicMatchStorageStatus()
    });
  } catch (error) {
    console.error("[Profiles] Failed to load public profile", error);
    res.status(503).json({ error: "Player profiles are temporarily unavailable." });
  }
});

app.post("/api/auth/register", registerRateLimit, async (req, res) => {
  const name = normalizeAccountName(req.body?.name);
  const password = String(req.body?.password || "");

  if (!isValidAccountName(name)) {
    logAuthFailure("register_rejected", req, { accountName: name, reason: "invalid_name" });
    res.status(400).json({ error: "Account name must be 3-24 characters using letters, numbers, spaces, hyphens, or underscores." });
    return;
  }
  if (password.length < 8) {
    logAuthFailure("register_rejected", req, { accountName: name, reason: "invalid_password_length" });
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
        logAuthFailure("register_rejected", req, { accountName: name, reason: "name_taken" });
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
        logAuthFailure("register_rejected", req, { accountName: name, reason: "name_taken" });
        res.status(409).json({ error: "That account name is already taken." });
        return;
      }
      store.accounts.push(account);
      saveAccountStore(store);
    }

    res.json(issueAccountSession(account));
  } catch (error) {
    logAuthFailure("register_failed", req, { accountName: name, reason: "storage_error" });
    console.error("[Accounts] Register failed", error);
    res.status(500).json({ error: "Could not create account." });
  }
});

app.post("/api/auth/login", loginRateLimit, async (req, res) => {
  const name = normalizeAccountName(req.body?.name);
  const password = String(req.body?.password || "");

  try {
    const account = useSupabaseStore()
      ? await findSupabaseAccountByName(name)
      : findAccountByName(loadAccountStore(), name);

    if (!account || !verifyPassword(password, account)) {
      logAuthFailure("login_rejected", req, { accountName: name, reason: "invalid_credentials" });
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
    logAuthFailure("login_failed", req, { accountName: name, reason: "storage_error" });
    console.error("[Accounts] Login failed", error);
    res.status(500).json({ error: "Could not sign in." });
  }
});

app.get("/api/auth/me", async (req, res) => {
  const authHeader = req.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const account = await getAccountFromToken(token);
  if (!account) {
    logAuthFailure("session_rejected", req, { reason: "invalid_or_expired" });
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

async function sendCollectorPackPurchaseLink(req, res) {
  const context = await requireAccountRecord(req, res);
  if (!context) return;

  const requestedProductId = String(req.body?.productId || req.body?.packId || "rumin-collector");
  const product = resolveCollectorPackProduct(requestedProductId);
  if (!product) {
    res.status(400).json({ error: "Unknown collector pack." });
    return;
  }
  if (!PACK_PURCHASE_URL) {
    res.status(400).json({ error: "Collector-pack purchases are not configured yet. Add PACK_PURCHASE_URL on the server to connect the $1 collector checkout link." });
    return;
  }

  const separator = PACK_PURCHASE_URL.includes("?") ? "&" : "?";
  res.json({
    product,
    checkoutUrl: `${PACK_PURCHASE_URL}${separator}pack=${encodeURIComponent(product.id)}&product=${encodeURIComponent(product.id)}&productType=${encodeURIComponent(PAID_COLLECTOR_ACQUISITION)}&account=${encodeURIComponent(context.account.id)}`
  });
}

app.post("/api/collection/collector-pack-purchase-link", sendCollectorPackPurchaseLink);
app.post("/api/collection/pack-purchase-link", sendCollectorPackPurchaseLink);

const collectorRedemptionQueues = new Map();

function ownerTokenFromRequest(req) {
  const authHeader = req.get("authorization") || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : req.get("x-owner-token");
}

function requireOwnerAuthorization(req, res) {
  if (!OWNER_STATS_TOKEN || ownerTokenFromRequest(req) !== OWNER_STATS_TOKEN) {
    res.status(403).json({ error: "Owner authorization required." });
    return false;
  }
  return true;
}

async function findCollectorFulfillmentAccount(input = {}) {
  const accountId = String(input.accountId || "").trim();
  const accountName = normalizeAccountName(input.accountName || input.account || "");
  if (useSupabaseStore()) {
    if (accountId) return findSupabaseAccountById(accountId);
    if (accountName) return findSupabaseAccountByName(accountName);
    return null;
  }
  const store = loadAccountStore();
  if (accountId) return store.accounts.find((account) => account.id === accountId) || null;
  return accountName ? findAccountByName(store, accountName) : null;
}

function verifyCollectorClaimToken(token, res) {
  const verification = verifyCollectorEntitlement(token, COLLECTOR_ENTITLEMENT_SECRET);
  if (!verification.valid) {
    res.status(400).json({ code: verification.code, error: verification.message });
    return null;
  }
  const product = resolveCollectorEntitlementProduct(verification.payload.productId);
  if (!product || product.productType !== verification.payload.productType) {
    res.status(400).json({ code: "UNKNOWN_COLLECTOR_PRODUCT", error: "Unknown physical collector product." });
    return null;
  }
  return { entitlement: verification.payload, product };
}

function collectorClaimResponse(account, entitlement, product, receipt = null) {
  return {
    entitlement: {
      schemaVersion: entitlement.schemaVersion,
      entitlementId: entitlement.entitlementId,
      productId: entitlement.productId,
      productType: entitlement.productType,
      issuanceSource: entitlement.issuanceSource,
      issuedAt: entitlement.issuedAt,
      expiresAt: entitlement.expiresAt
    },
    boundAccount: { id: account.id, name: account.name },
    product: publicCollectorEntitlementProduct(product),
    status: receipt ? "already-redeemed" : "available",
    receipt
  };
}

async function withCollectorAccountLock(accountId, task) {
  const previous = collectorRedemptionQueues.get(accountId) || Promise.resolve();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const tail = previous.catch(() => {}).then(() => gate);
  collectorRedemptionQueues.set(accountId, tail);
  await previous.catch(() => {});
  try {
    return await task();
  } finally {
    release();
    if (collectorRedemptionQueues.get(accountId) === tail) collectorRedemptionQueues.delete(accountId);
  }
}

async function persistCollectorEntitlementRedemption(accountId, entitlement, redeemedAt = new Date().toISOString()) {
  return withCollectorAccountLock(accountId, async () => {
    if (useSupabaseStore()) {
      const account = await findSupabaseAccountById(accountId);
      if (!account) throw new Error("Gauntlet account was not found.");
      const stats = account.stats || {};
      const result = redeemCollectorEntitlementStats(stats, entitlement, { redeemedAt });
      if (!result.alreadyRedeemed) {
        await patchSupabaseAccount(accountId, { stats, last_seen_at: redeemedAt });
      }
      const updated = result.alreadyRedeemed ? account : await findSupabaseAccountById(accountId);
      return { ...result, account: publicAccount(updated) };
    }

    const store = loadAccountStore();
    const account = store.accounts.find((entry) => entry.id === accountId);
    if (!account) throw new Error("Gauntlet account was not found.");
    account.stats = account.stats || {};
    const result = redeemCollectorEntitlementStats(account.stats, entitlement, { redeemedAt });
    if (!result.alreadyRedeemed) {
      account.lastSeenAt = redeemedAt;
      saveAccountStore(store);
    }
    return { ...result, account: publicAccount(account) };
  });
}

app.post("/api/admin/collector-entitlements/issue", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!requireOwnerAuthorization(req, res)) return;
  try {
    const account = await findCollectorFulfillmentAccount(req.body || {});
    if (!account) {
      res.status(404).json({ error: "Gauntlet account was not found." });
      return;
    }
    const issued = issueCollectorEntitlement({
      accountId: account.id,
      productId: req.body?.productId,
      issuanceSource: req.body?.issuanceSource || req.body?.source,
      externalReference: req.body?.externalReference || req.body?.orderReference,
      expiresAt: req.body?.expiresAt || null
    }, COLLECTOR_ENTITLEMENT_SECRET);
    res.json({
      entitlement: collectorClaimResponse(account, issued.payload, resolveCollectorEntitlementProduct(issued.payload.productId)).entitlement,
      product: publicCollectorEntitlementProduct(resolveCollectorEntitlementProduct(issued.payload.productId)),
      token: issued.token,
      claimUrl: `${PUBLIC_CLIENT_URL.replace(/\/$/, "")}/?claim=${encodeURIComponent(issued.token)}`,
      nonTransferable: true
    });
  } catch (error) {
    res.status(400).json({ error: error.message || "Could not issue collector entitlement." });
  }
});

app.post("/api/collection/collector-entitlement/preview", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const context = await requireAccountRecord(req, res);
  if (!context) return;
  const verified = verifyCollectorClaimToken(req.body?.token, res);
  if (!verified) return;
  if (verified.entitlement.accountId !== context.account.id) {
    res.status(403).json({
      code: "ENTITLEMENT_ACCOUNT_MISMATCH",
      error: "This collector entitlement belongs to another Gauntlet account."
    });
    return;
  }
  const collection = normalizeCollection(context.account.stats || {});
  const receipt = collection.collectorRedemptionReceipts?.[verified.entitlement.entitlementId] || null;
  res.json(collectorClaimResponse(context.account, verified.entitlement, verified.product, receipt));
});

app.post("/api/collection/collector-entitlement/redeem", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const context = await requireAccountRecord(req, res);
  if (!context) return;
  const verified = verifyCollectorClaimToken(req.body?.token, res);
  if (!verified) return;
  if (verified.entitlement.accountId !== context.account.id) {
    res.status(403).json({
      code: "ENTITLEMENT_ACCOUNT_MISMATCH",
      error: "This collector entitlement belongs to another Gauntlet account."
    });
    return;
  }
  try {
    const result = await persistCollectorEntitlementRedemption(context.account.id, verified.entitlement);
    res.json({
      ...collectorClaimResponse(result.account, verified.entitlement, verified.product, result.receipt),
      alreadyRedeemed: result.alreadyRedeemed,
      grantedVariants: result.grantedVariants,
      account: result.account
    });
  } catch (_error) {
    res.status(500).json({ error: "Could not redeem collector entitlement." });
  }
});

app.post("/api/collection/save-constructed-deck", async (req, res) => {
  const context = await requireAccountRecord(req, res);
  if (!context) return;

  try {
    const stats = context.account.stats || {};
    const { record, playableDeck: savedConstructedDeck } = saveConstructedDeckToLibrary(stats, req.body || {}, context.account.id);

    if (context.source === "supabase") {
      await patchSupabaseAccount(context.account.id, { stats, last_seen_at: savedConstructedDeck.savedAt });
      const updated = await findSupabaseAccountById(context.account.id);
      res.json({ account: publicAccount(updated), savedConstructedDeck, deck: record });
      return;
    }

    context.account.stats = stats;
    context.account.lastSeenAt = savedConstructedDeck.savedAt;
    saveAccountStore(context.store);
    res.json({ account: publicAccount(context.account), savedConstructedDeck, deck: record });
  } catch (error) {
    res.status(400).json({ error: error.message || "Could not save constructed deck." });
  }
});

app.patch("/api/decks/:deckId", async (req, res) => {
  const context = await requireAccountRecord(req, res);
  if (!context) return;
  try {
    const stats = context.account.stats || {};
    const deck = updateDeckLibraryRecord(stats, String(req.params.deckId || ""), req.body || {});
    const updatedAt = new Date().toISOString();
    if (context.source === "supabase") {
      await patchSupabaseAccount(context.account.id, { stats, last_seen_at: updatedAt });
      const updated = await findSupabaseAccountById(context.account.id);
      res.json({ account: publicAccount(updated), deck });
      return;
    }
    context.account.stats = stats;
    context.account.lastSeenAt = updatedAt;
    saveAccountStore(context.store);
    res.json({ account: publicAccount(context.account), deck });
  } catch (error) {
    res.status(400).json({ error: error.message || "Could not update deck." });
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

app.patch("/api/friend-challenges/:challengeId", async (req, res) => {
  const context = await requireAccountRecord(req, res);
  if (!context) return;
  try {
    const status = req.body?.action === "cancel" ? "cancelled" : req.body?.action === "decline" ? "declined" : "";
    if (!status) {
      res.status(400).json({ error: "Choose decline or cancel." });
      return;
    }
    const challenge = await updateFriendChallengeStatus(req.params.challengeId, context.account.id, status);
    const roomState = getRoom(challenge.roomCode);
    if (roomState?.friendChallengeId === challenge.id) {
      roomState.invitedAccountId = null;
      io.to(roomState.roomCode).emit("friendChallengeStatus", {
        challengeId: challenge.id,
        status,
        message: status === "declined" ? `${challenge.toName} declined the challenge.` : `${challenge.fromName} cancelled the challenge.`
      });
    }
    res.json({ challenge });
  } catch (error) {
    res.status(400).json({ error: error.message || "Could not update challenge." });
  }
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

app.get("/api/leaderboard", async (req, res) => {
  const accounts = useSupabaseStore()
    ? (await supabaseRequest("gauntlet_accounts?select=*")).map(accountFromSupabaseRow)
    : loadAccountStore().accounts;
  const lifetimeLeaderboard = accounts
    .map((account) => {
      const hasRankedStats =
        (account.stats?.rankedGamesPlayed || 0) > 0 ||
        (account.stats?.rankedGamesWon || 0) > 0 ||
        (account.stats?.rankedGamesLost || 0) > 0 ||
        (account.stats?.rankedGamesDrawn || 0) > 0;
      const wins = hasRankedStats ? account.stats?.rankedGamesWon || 0 : account.stats?.gamesWon || 0;
      const losses = hasRankedStats ? account.stats?.rankedGamesLost || 0 : account.stats?.gamesLost || 0;
      const draws = hasRankedStats ? account.stats?.rankedGamesDrawn || 0 : account.stats?.gamesDrawn || 0;
      const gamesPlayed = wins + losses + draws;
      const decidedGames = wins + losses;
      const winRate = decidedGames > 0 ? Math.round((wins / decidedGames) * 1000) / 10 : 0;
      return {
        accountId: account.id,
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

  const season = getActiveSeason() || ACTIVE_SEASON;
  const standings = buildSeasonStandings(accounts, season);
  const authHeader = req.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const viewer = token ? await getAccountFromToken(token) : null;
  res.json({
    season: publicSeasonDefinition(season),
    standings: standings.slice(0, 25),
    playerStanding: viewer ? standings.find((entry) => entry.accountId === viewer.id) || null : null,
    leaderboard: standings.slice(0, 25),
    lifetimeLeaderboard
  });
});

function getCampaignNarration(chapterId) {
  return CAMPAIGN_NARRATION[chapterId] || {};
}

function getCampaignChapter(factionId, chapterId) {
  const chapter = (campaignChapters[factionId] || []).find((entry) => entry.id === chapterId) || null;
  return chapter ? { ...chapter, ...getCampaignNarration(chapter.id) } : null;
}

function buildCampaignEndDialogue(chapter = {}, faction = null) {
  if (Array.isArray(chapter.endDialogue) && chapter.endDialogue.length > 0) {
    return chapter.endDialogue;
  }
  const playableName = chapter.playableName || faction?.commander?.name || faction?.name || "Commander";
  const opponentName = chapter.opponentName || "Opponent";
  const lines = [];
  if (chapter.afterBattle) lines.push(`Narrator: ${chapter.afterBattle}`);
  lines.push(`${playableName}: This victory will shape what comes next.`);
  lines.push(`${opponentName}: Then carry it carefully. The next battle will remember this one.`);
  return lines;
}

function getCampaignChapterIndex(factionId, chapterId) {
  return (campaignChapters[factionId] || []).findIndex((chapter) => chapter.id === chapterId);
}

function isCampaignChapterUnlocked(stats = {}, factionId, chapterId) {
  const chapters = campaignChapters[factionId] || [];
  const chapterIndex = getCampaignChapterIndex(factionId, chapterId);
  if (chapterIndex <= 0) return chapterIndex === 0;
  const progression = normalizeProgression(stats);
  const completed = Array.isArray(progression.campaign[factionId]) ? progression.campaign[factionId] : [];
  return completed.includes(chapters[chapterIndex - 1]?.id);
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
  if (factionId === "xendra") {
    return {
      bossLife: Math.min(48, 16 + chapterIndex * 4),
      attacksPerTurn: Math.min(4, 1 + Math.floor((chapterIndex + 1) / 2)),
      minAttackValue: 2 + Math.floor(chapterIndex / 3),
      maxAttackValue: 4 + Math.floor(chapterIndex / 2),
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

const CAMPAIGN_CARD_PLAN = {
  rumin: {
    player: ["rumin-gilded-scale-legionary", "rumin-forum-ledger-runner", "rumin-tax-road-scout", "rumin-coin-scale-spear", "rumin-vault-shield-bearer", "rumin-marble-phalanx", "rumin-senate-vault-guard", "rumin-marble-market-tribune", "rumin-counting-house-aegis", "rumin-rumie-vault-shield", "rumin-imperial-scale-pike", "rumin-triumphal-ram"],
    boss: ["rumin-vault-shield-bearer", "rumin-marble-phalanx", "rumin-coin-scale-spear", "rumin-senate-vault-guard", "rumin-imperial-scale-pike", "rumin-marble-market-tribune", "rumin-edict-of-the-vault"]
  },
  sheen: {
    player: ["sheen-rootwatch-initiate", "sheen-seedwall-acolyte", "sheen-living-bark-guard", "sheen-mossbound-staff", "sheen-quiet-grove-sentinel", "sheen-raincall-mender", "sheen-beli-vinebinder", "sheen-harmony-ward", "sheen-ringroot-bastion", "sheen-thornroot-counterstroke", "sheen-beli-canopy-shield", "sheen-sapling-chorus"],
    boss: ["sheen-rootwatch-initiate", "sheen-seedwall-acolyte", "sheen-living-bark-guard", "sheen-harmony-ward", "sheen-ringroot-bastion", "sheen-beli-canopy-shield", "sheen-roots-that-remember"]
  },
  frumo: {
    player: ["frumo-deckhand-diver", "frumo-kelpcloak-trickster", "frumo-sunken-coin", "frumo-tideglass-cutlass", "frumo-ballast-hook", "frumo-coral-hull-guard", "frumo-riptide-smuggler", "frumo-lafayettes-chart", "frumo-tide-debt-ledger", "frumo-pressure-lock-pistol", "frumo-ristus-blackwake", "frumo-abyssal-switchboard"],
    boss: ["frumo-sunken-coin", "frumo-ballast-hook", "frumo-coral-hull-guard", "frumo-riptide-smuggler", "frumo-pressure-lock-pistol", "frumo-captains-bad-wager", "frumo-poleas-moonlit-map"]
  },
  bizi: {
    player: ["bizi-copperline-technician", "bizi-brass-spark", "bizi-voltage-ration", "bizi-dune-circuit-runner", "bizi-railspike-marshal", "bizi-gearplate-shield", "bizi-heat-sink-matrix", "bizi-heras-calibration", "bizi-solar-array-adept", "bizi-constanti-conduit", "bizi-sandstorm-processor", "bizi-clockwork-caravan"],
    boss: ["bizi-copperline-technician", "bizi-dune-circuit-runner", "bizi-railspike-marshal", "bizi-gearplate-shield", "bizi-heat-sink-matrix", "bizi-heras-calibration", "bizi-solar-array-adept"]
  }
};

function getCampaignAddedCardCount(chapterIndex, side = "player") {
  if (side === "player") {
    if (chapterIndex < 2) return 0;
    if (chapterIndex < 5) return 2;
    if (chapterIndex < 8) return 4;
    return 6;
  }
  if (chapterIndex < 4) return 0;
  if (chapterIndex < 8) return 2;
  return 4;
}

function getCampaignDeckAdditions(factionId, chapterIndex, side = "player") {
  const plan = CAMPAIGN_CARD_PLAN[factionId]?.[side] || [];
  const count = Math.min(plan.length, getCampaignAddedCardCount(chapterIndex, side));
  return plan.slice(0, count)
    .map((cardId) => getCollectionCatalogCard(cardId))
    .filter(Boolean)
    .map((card) => getPlayableCollectionCard(card, { suit: getDraftCardSuit() }));
}

function getCampaignBossAbility(factionId, chapterIndex, chapter = {}) {
  const opponentName = chapter.opponentName || "Campaign Boss";
  const tier = chapterIndex >= 9 ? 3 : chapterIndex >= 6 ? 2 : 1;
  const earlyBonus = tier >= 3 ? 2 : 1;
  const profileByFaction = {
    rumin: [
      { id: "first-strike", title: "Fortified Claim", text: "The boss's first scripted attack each turn gets +1 value." },
      { id: "final-push", title: "Senate Pressure", text: `The boss's final scripted attack each turn gets +${earlyBonus} value.` },
      { id: "late-pressure", title: "Imperial Doctrine", text: tier >= 3 ? "The boss's last two scripted attacks each turn get +1 value." : "The boss's final scripted attack each turn gets +1 value." }
    ],
    sheen: [
      { id: "odd-pressure", title: "Ironroot Pressure", text: "Odd-numbered boss attacks get +1 value." },
      { id: "first-strike", title: "Thorned Advance", text: "The boss's first scripted attack each turn gets +1 value." },
      { id: "odd-pressure", title: "Living Siege", text: tier >= 3 ? "Odd-numbered boss attacks get +1 value, and the boss restores 1 life at the start of each turn." : "Odd-numbered boss attacks get +1 value.", healAtTurnStart: tier >= 3 ? 1 : 0 }
    ],
    frumo: [
      { id: "even-feint", title: "Tide Feint", text: "Even-numbered boss attacks get +1 value." },
      { id: "final-push", title: "Boarding Rush", text: `The boss's final scripted attack each turn gets +${earlyBonus} value.` },
      { id: "even-feint", title: "Admiral's Ruse", text: tier >= 3 ? "Even-numbered boss attacks get +2 value." : "Even-numbered boss attacks get +1 value.", evenBonus: tier >= 3 ? 2 : 1 }
    ],
    bizi: [
      { id: "final-push", title: "Prototype Surge", text: "The boss's final scripted attack each turn gets +1 value." },
      { id: "late-pressure", title: "Overclock Directive", text: "The boss's last two scripted attacks each turn get +1 value." },
      {
        id: tier >= 3 ? "first-and-final" : "final-push",
        title: "Machine Logic",
        text: tier >= 3
          ? "The boss's first and final scripted attacks each turn get +1 value."
          : "The boss's final scripted attack each turn gets +1 value."
      }
    ],
    xendra: [
      { id: "first-strike", title: "Unreliable Perception", text: "The boss's first scripted attack each turn gets +1 value." },
      { id: "even-feint", title: "Hallucination Loop", text: "Even-numbered boss attacks get +1 value." },
      { id: "first-and-final", title: "Ritual Completion", text: "The boss's first and final scripted attacks each turn get +1 value." }
    ]
  };
  const options = profileByFaction[factionId] || profileByFaction.rumin;
  const selected = options[Math.min(options.length - 1, Math.floor(chapterIndex / 4))];
  return {
    ...selected,
    tier,
    name: `${opponentName}: ${selected.title}`,
    text: selected.text
  };
}

function getCampaignBossPowerProfile(faction, chapter = {}, bossAbility = null) {
  const opponentName = chapter.opponentName || "Campaign Boss";
  const title = chapter.title || "Campaign Battle";
  const factionName = faction?.name || "Faction";
  return {
    commander: {
      name: opponentName,
      image: faction?.commander?.image || faction?.cardImage || null,
      text: bossAbility?.text || "This opponent uses scripted campaign attacks."
    },
    city: {
      name: `${title} Battlefield`,
      image: faction?.city?.image || faction?.cardImage || null,
      text: `Campaign arena for ${opponentName}. The boss follows the ${factionName} story battle script instead of the normal player city ability.`
    },
    general: {
      name: `${opponentName} Tactics`,
      image: faction?.general?.image || faction?.cardImage || null,
      text: `At the start of the boss turn, ${opponentName} may launch up to ${getCampaignDifficulty(faction?.id, chapter.id).attacksPerTurn} scripted attacks if combat is clear.`
    }
  };
}

function applyCampaignBossAbilityToAttack(campaign, attackNumber, value, notes) {
  const ability = campaign?.bossAbility;
  if (!ability) return value;
  let bonus = 0;
  if (ability.id === "first-strike") {
    bonus = attackNumber === 1 ? 1 : 0;
  } else if (ability.id === "odd-pressure") {
    bonus = attackNumber % 2 === 1 ? 1 : 0;
  } else if (ability.id === "even-feint") {
    bonus = attackNumber % 2 === 0 ? (ability.evenBonus || 1) : 0;
  } else if (ability.id === "final-push") {
    bonus = attackNumber === campaign.attacksPerTurn ? (ability.tier >= 3 ? 2 : 1) : 0;
  } else if (ability.id === "late-pressure") {
    bonus = attackNumber >= Math.max(1, campaign.attacksPerTurn - 1) ? 1 : 0;
  } else if (ability.id === "first-and-final") {
    bonus = attackNumber === 1 || attackNumber === campaign.attacksPerTurn ? 1 : 0;
  }
  if (bonus > 0) notes.push(`${ability.name} +${bonus}`);
  return value + bonus;
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
  if (roomState.lobby.gameMode === "draft") return "draft";
  if (roomState.lobby.gameMode === "freeForAll") return "freeForAll";
  return roomState.lobby.gameMode === "basic" ? "basic" : "factions";
}

function normalizeDuelPlayerIds(game) {
  if (!game || !["basic", "factions"].includes(game.gameMode)) return game;
  for (const playerNum of [1, 2]) {
    if (game.players?.[playerNum]) game.players[playerNum].id = playerNum;
  }
  return game;
}

// ============ GAME STATE STORAGE ============
const rooms = new Map();
let roomStatePersistTimer = null;
let roomRecoveryInitialized = false;
const matchmakingQueue = [];
const draftLeagueQueues = {
  player: [],
  bot: []
};

function listSpectatableSeasonMatches(season = getActiveSeason()) {
  if (!season) return [];
  return [...rooms.values()]
    .filter((roomState) => roomState.ranked
      && !roomState.draftLeague
      && roomState.season?.seasonId === season.seasonId
      && roomState.game
      && roomState.game.phase !== "gameOver"
      && roomState.lifecycle?.status !== "completed")
    .map((roomState) => {
      const game = roomState.game;
      const series = roomState.bestOf3Series || game.bestOf3Series || null;
      return {
        roomCode: roomState.roomCode,
        matchId: game.matchId || roomState.matchMetadata?.matchId || null,
        season: clonePlain(roomState.season),
        mode: game.gameMode || roomState.lobby.gameMode || "factions",
        format: roomState.season.format,
        bestOf: Number(series?.bestOf || 1),
        seriesScore: series ? clonePlain(series.scores || {}) : null,
        turn: Number(game.turn || 1),
        spectatorCount: roomState.lobby.spectators.length,
        players: [1, 2].map((playerNum) => ({
          playerNum,
          displayName: game.players?.[playerNum]?.accountName
            || roomState.lobby.players?.[playerNum]?.accountName
            || `Player ${playerNum}`,
          factionId: game.players?.[playerNum]?.faction?.id
            || roomState.lobby.players?.[playerNum]?.factionId
            || null,
          factionName: game.players?.[playerNum]?.faction?.name || null
        }))
      };
    })
    .sort((a, b) => a.roomCode.localeCompare(b.roomCode));
}

app.get("/api/seasons/active", (_req, res) => {
  const season = getActiveSeason();
  if (!season) {
    res.status(404).json({ error: "No competitive season is active." });
    return;
  }
  res.json({ season: publicSeasonDefinition(season) });
});

app.get("/api/seasons/active/matches", (_req, res) => {
  const season = getActiveSeason();
  if (!season) {
    res.json({ season: null, matches: [] });
    return;
  }
  res.json({ season: publicSeasonDefinition(season), matches: listSpectatableSeasonMatches(season) });
});

function persistRoomsNow(now = Date.now()) {
  if (roomStatePersistTimer) {
    clearTimeout(roomStatePersistTimer);
    roomStatePersistTimer = null;
  }
  return roomStateStore.saveRooms(rooms.values(), now);
}

function scheduleRoomStatePersist() {
  if (!roomRecoveryInitialized || !roomStateStore.enabled || roomStatePersistTimer) return;
  roomStatePersistTimer = setTimeout(() => {
    roomStatePersistTimer = null;
    try {
      roomStateStore.saveRooms(rooms.values());
    } catch (error) {
      console.error("[Rooms] Could not persist active-room state", error);
    }
  }, 50);
  roomStatePersistTimer.unref?.();
}

function initializeRoomRecovery(now = Date.now()) {
  if (roomRecoveryInitialized) return { enabled: roomStateStore.enabled, restored: 0, alreadyInitialized: true };
  roomRecoveryInitialized = true;
  const recoveredRooms = roomStateStore.loadRooms(now);
  for (const roomState of recoveredRooms) {
    normalizeDuelPlayerIds(roomState.game);
    if (!rooms.has(roomState.roomCode)) rooms.set(roomState.roomCode, roomState);
  }
  return { enabled: roomStateStore.enabled, restored: recoveredRooms.length, alreadyInitialized: false };
}

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
    lifecycle: createRoomLifecycle(),
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

function createDraftRoom(options = {}) {
  let roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  while (rooms.has(roomCode)) {
    roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  const players = {};
  for (let playerNum = 1; playerNum <= 8; playerNum++) {
    players[playerNum] = createDraftPlayerSeat();
  }

  const roomState = {
    roomCode,
    lifecycle: createRoomLifecycle(),
    lobby: {
      gameMode: "draft",
      players,
      spectators: []
    },
    game: null,
    draft: {
      status: "lobby",
      maxPlayers: 8,
      packsPerPlayer: DRAFT_PACKS_PER_PLAYER,
      packSize: DRAFT_PACK_SLOTS.length,
      activePlayers: [],
      round: 0,
      pickNumber: 0,
      direction: "left",
      unopenedPacks: {},
      currentPacks: {},
      draftedPools: {},
      deckAdditions: {},
      completedAt: null,
      baseDeck: createBaseDeckSummary(),
      botDraft: !!options.botDraft,
      botPickLog: []
    },
    damageConfirmed: { 1: false, 2: false }
  };
  if (options.botDraft) {
    for (let playerNum = 2; playerNum <= 8; playerNum++) {
      const bot = roomState.lobby.players[playerNum];
      bot.connected = true;
      bot.accountId = null;
      bot.accountName = DRAFT_BOT_NAMES[playerNum - 2] || `Draft Bot ${playerNum - 1}`;
      bot.isGuest = false;
      bot.isAI = true;
      bot.reconnectToken = `BOT-${roomCode}-${playerNum}`;
    }
  }
  rooms.set(roomCode, roomState);
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

function isDraftRoom(roomState) {
  return roomState?.lobby?.gameMode === "draft" || !!roomState?.draft;
}

function removeFromMatchmaking(socketId) {
  const index = matchmakingQueue.findIndex((entry) => entry.socketId === socketId);
  if (index >= 0) matchmakingQueue.splice(index, 1);
}

function removeFromDraftLeague(socketId) {
  for (const queue of Object.values(draftLeagueQueues)) {
    const index = queue.findIndex((entry) => entry.socketId === socketId);
    if (index >= 0) queue.splice(index, 1);
  }
}

function getMatchTolerance(waitMs) {
  return Math.min(1, 0.35 + Math.floor(waitMs / 20000) * 0.15);
}

function findMatchForEntryInQueue(entry, queue) {
  const now = Date.now();
  let best = null;
  let bestScore = Infinity;

  for (const candidate of queue) {
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

function findMatchForEntry(entry) {
  return findMatchForEntryInQueue(entry, matchmakingQueue.filter((candidate) => (candidate.bestOf || 1) === (entry.bestOf || 1)));
}

function findDraftLeagueMatchForEntry(entry) {
  const queue = draftLeagueQueues[entry.draftType] || draftLeagueQueues.player;
  return findMatchForEntryInQueue(entry, queue.filter((candidate) => candidate.bestOf === entry.bestOf));
}

function createMatchedRoom(entryA, entryB) {
  const roomState = createRoom();
  roomState.ranked = true;
  roomState.season = buildSeasonMatchIdentity(getActiveSeason(), entryA.bestOf || 1);
  if ((entryA.bestOf || 1) === 3) {
    roomState.seriesId = crypto.randomUUID();
    roomState.bestOf3Series = {
      bestOf: 3,
      targetWins: 2,
      gameNumber: 1,
      scores: { 1: 0, 2: 0 }
    };
  }
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
      playerSocket.emit("matchmakingStatus", {
        inQueue: false,
        message: `${roomState.season?.displayName || "Ranked"} ${entryA.bestOf === 3 ? "best-of-3 m" : "m"}atch found. Room ${roomState.roomCode}.`,
        bestOf: entryA.bestOf || 1,
        season: clonePlain(roomState.season)
      });
    }
  }

  emitLobbyState(roomState);
  return roomState;
}

function createDraftLeagueRoom(entryA, entryB) {
  const roomState = createRoom();
  roomState.ranked = true;
  roomState.draftLeague = true;
  roomState.draftLeagueMatch = {
    matchedAt: new Date().toISOString(),
    playerAccountIds: [entryA.accountId, entryB.accountId],
    draftType: entryA.draftType,
    bestOf: entryA.bestOf || 1
  };
  if ((entryA.bestOf || 1) === 3) {
    roomState.seriesId = crypto.randomUUID();
    roomState.bestOf3Series = {
      bestOf: 3,
      targetWins: 2,
      gameNumber: 1,
      scores: { 1: 0, 2: 0 }
    };
  }

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
    lobbyPlayer.factionId = assignment.entry.savedDraftDeck.factionId;
    lobbyPlayer.savedDraftDeck = assignment.entry.savedDraftDeck;
  }

  for (const assignment of assignments) {
    const playerSocket = io.sockets.sockets.get(assignment.entry.socketId);
    if (playerSocket) {
      attachPlayerSocket(roomState, playerSocket, assignment.playerNum);
      playerSocket.emit("draftLeagueStatus", {
        inQueue: false,
        message: `${entryA.bestOf === 3 ? "Best-of-3 d" : "D"}raft league match found. Using your saved ${assignment.entry.savedDraftDeck.factionName} deck.`,
        roomCode: roomState.roomCode
      });
    }
  }

  createGameFromLobby(roomState);
  roomState.game.draftLeague = true;
  if (roomState.bestOf3Series) roomState.game.bestOf3Series = clonePlain(roomState.bestOf3Series);
  roomState.game.message = `${roomState.bestOf3Series ? "Best-of-3 d" : "D"}raft league match started. Player ${roomState.game.priority} has priority.`;
  emitState(roomState);
  return roomState;
}

function getRoom(roomCode) {
  return rooms.get(roomCode);
}

function deleteRoom(roomCode) {
  const roomState = rooms.get(roomCode);
  if (!roomState) return false;
  if (roomState.aiMoveTimer) clearTimeout(roomState.aiMoveTimer);
  const socketIds = [
    ...getLobbyPlayerNumbers(roomState).map((playerNum) => roomState.lobby.players[playerNum].socket),
    ...(roomState.lobby.spectators || [])
  ].filter(Boolean);
  for (const socketId of socketIds) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) continue;
    socket.leave(roomCode);
    if (socket.data.roomCode === roomCode) {
      socket.data.roomCode = null;
      socket.data.role = null;
      socket.data.playerNum = null;
    }
  }
  rooms.delete(roomCode);
  scheduleRoomStatePersist();
  return true;
}

function canOfferRematch(roomState) {
  const players = roomState?.lobby?.players || {};
  return !!roomState?.game
    && (roomState.game.phase === "gameOver" || roomState.game.winner != null)
    && !roomState.draft
    && !roomState.lobby.campaign
    && roomState.lobby.gameMode !== "freeForAll"
    && !players[1]?.isAI
    && !players[2]?.isAI
    && !!players[1]?.accountName
    && !!players[2]?.accountName;
}

function emitRematchStatus(roomState, message = "") {
  scheduleRoomStatePersist();
  io.to(roomState.roomCode).emit("rematchStatus", {
    available: canOfferRematch(roomState),
    requestedBy: roomState.rematch?.requestedBy || null,
    message
  });
}

function resetRoomForRematch(roomState) {
  roomState.game = null;
  roomState.damageConfirmed = { 1: false, 2: false };
  roomState.lifecycle = createRoomLifecycle();
  roomState.rematch = null;
  roomState.bestOf3Series = null;
  for (const playerNum of [1, 2]) {
    const lobbyPlayer = roomState.lobby.players[playerNum];
    lobbyPlayer.connected = !!lobbyPlayer.socket;
    lobbyPlayer.readyToStart = false;
  }
  io.to(roomState.roomCode).emit("rematchStarted", { roomCode: roomState.roomCode });
  emitLobbyState(roomState);
}

async function abandonActiveRoom(roomState, reason = "reconnect_timeout", now = Date.now()) {
  const game = roomState?.game;
  if (!game || game.phase === "gameOver") return null;
  game.phase = "gameOver";
  game.winner = null;
  game.drawOfferBy = null;
  game.message = reason === "server_shutdown"
    ? "Match abandoned because the game server shut down before completion."
    : "Match abandoned after every human player exceeded the reconnect grace period.";
  const completedAt = new Date(now).toISOString();
  await recordFinalGameStats(roomState, {
    completionReason: "abandoned",
    abandonmentReason: reason,
    completedAt
  });
  markRoomCompleted(roomState, completedAt, reason);
  emitState(roomState);
  return roomState.matchMetadata?.recordedMatchId || roomState.matchMetadata?.matchId || null;
}

async function sweepRoomLifecycle(options = {}) {
  if (roomLifecycleSweepRunning) return { skipped: true, abandoned: 0, deleted: 0 };
  roomLifecycleSweepRunning = true;
  const now = options.now ?? Date.now();
  const config = options.config || roomLifecycleConfig;
  const result = { skipped: false, abandoned: 0, deleted: 0, actions: [] };
  try {
    for (const roomState of [...rooms.values()]) {
      const action = getRoomLifecycleAction(roomState, now, config);
      if (action === "abandon_match") {
        await abandonActiveRoom(roomState, "reconnect_timeout", now);
        result.abandoned += 1;
        result.actions.push({ roomCode: roomState.roomCode, action });
      } else if (action.startsWith("delete_")) {
        deleteRoom(roomState.roomCode);
        result.deleted += 1;
        result.actions.push({ roomCode: roomState.roomCode, action });
      }
    }
    return result;
  } finally {
    roomLifecycleSweepRunning = false;
  }
}

function startRoomLifecycleSweep() {
  if (roomLifecycleTimer) return roomLifecycleTimer;
  roomLifecycleTimer = setInterval(() => {
    sweepRoomLifecycle().catch((error) => console.error("[Rooms] Lifecycle sweep failed", error));
  }, roomLifecycleConfig.sweepIntervalMs);
  roomLifecycleTimer.unref?.();
  return roomLifecycleTimer;
}

function stopRoomLifecycleSweep() {
  if (!roomLifecycleTimer) return;
  clearInterval(roomLifecycleTimer);
  roomLifecycleTimer = null;
}

function persistActiveRoomsForShutdown(now = Date.now()) {
  return persistRoomsNow(now);
}

async function attachSavedConstructedDeckForLobbyPlayer(roomState, playerNum) {
  const lobbyPlayer = roomState?.lobby?.players?.[playerNum];
  if (!lobbyPlayer?.accountId || lobbyPlayer.isGuest || !lobbyPlayer.factionId) {
    if (lobbyPlayer) lobbyPlayer.savedConstructedDeck = null;
    return;
  }
  const savedConstructedDeck = getSavedConstructedDeck(await getAccountStatsById(lobbyPlayer.accountId));
  lobbyPlayer.savedConstructedDeck = savedConstructedDeck?.factionId === lobbyPlayer.factionId ? savedConstructedDeck : null;
}

async function attachSavedConstructedDecksForLobby(roomState) {
  if (!roomState || getLobbyGameMode(roomState) === "basic") return;
  await Promise.all(getLobbyPlayerNumbers(roomState).map((playerNum) => (
    attachSavedConstructedDeckForLobbyPlayer(roomState, playerNum)
  )));
}

function getRoomForSocket(socket) {
  for (const [code, room] of rooms) {
    if (getLobbyPlayerNumbers(room).some((playerNum) => room.lobby.players[playerNum].socket === socket.id) ||
        room.lobby.spectators.includes(socket.id)) {
      touchRoom(room);
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
  touchRoom(roomState);
  scheduleRoomStatePersist();
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

function sanitizeDraftForViewer(roomState, viewerPlayerNum = null) {
  const draft = roomState.draft;
  if (!draft) return null;
  const players = {};
  getLobbyPlayerNumbers(roomState).forEach((playerNum) => {
    players[playerNum] = sanitizeLobbyPlayer(roomState.lobby.players[playerNum]);
  });
  const playerKey = viewerPlayerNum ? String(viewerPlayerNum) : null;
  const myCurrentPack = playerKey ? draft.currentPacks[playerKey] || null : null;
  const myPool = playerKey ? draft.draftedPools[playerKey] || [] : [];
  const myDeckAdditions = playerKey ? draft.deckAdditions[playerKey] || [] : [];

  const poolCounts = {};
  Object.keys(draft.draftedPools || {}).forEach((key) => {
    poolCounts[key] = draft.draftedPools[key]?.length || 0;
  });

  return {
    roomCode: roomState.roomCode,
    status: draft.status,
    league: !!draft.league,
    botDraft: !!draft.botDraft,
    maxPlayers: draft.maxPlayers,
    packsPerPlayer: draft.packsPerPlayer,
    packSize: draft.packSize,
    activePlayers: draft.activePlayers,
    round: draft.round,
    pickNumber: draft.pickNumber,
    direction: draft.direction,
    players,
    spectatorCount: roomState.lobby.spectators.length,
    baseDeck: draft.baseDeck,
    myCurrentPack,
    myPool,
    myDeckAdditions,
    poolCounts,
    botPickLog: draft.botDraft ? (draft.botPickLog || []).slice(-12) : [],
    deckAdditionCounts: Object.fromEntries(Object.entries(draft.deckAdditions || {}).map(([key, cards]) => [key, cards.length])),
    completedAt: draft.completedAt
  };
}

function emitDraftState(roomState) {
  if (!roomState.draft) return;
  touchRoom(roomState);
  scheduleRoomStatePersist();
  for (const playerNum of getLobbyPlayerNumbers(roomState)) {
    const socketId = roomState.lobby.players[playerNum].socket;
    if (socketId) io.to(socketId).emit("draftState", sanitizeDraftForViewer(roomState, playerNum));
  }
  for (const socketId of roomState.lobby.spectators) {
    io.to(socketId).emit("draftState", sanitizeDraftForViewer(roomState, null));
  }
}

function sanitizeGameForViewer(game, viewerPlayerNum, spectatorCount) {
  const visibleGame = projectSharedDuelForPerspective(game, viewerPlayerNum);
  delete visibleGame.serverAuditEvents;
  delete visibleGame.serverCombatStats;
  for (const [rawPlayerNum, playerState] of Object.entries(visibleGame.players || {})) {
    const playerNum = Number(rawPlayerNum);
    const realPlayer = game.players?.[playerNum];
    playerState.handCount = realPlayer?.hand?.length || 0;
    playerState.deckCount = realPlayer?.deck?.length || 0;
    playerState.discardCount = realPlayer?.discard?.length || 0;
    if (viewerPlayerNum !== playerNum) playerState.hand = [];
    playerState.deck = [];
  }
  for (const [laneIndex, lane] of (visibleGame.lanes || []).entries()) {
    for (const playerNum of [1, 2]) {
      if (viewerPlayerNum !== playerNum && lane.facedown?.[playerNum]) {
        lane.facedown[playerNum] = {
          id: `hidden-lane-${laneIndex}-p${playerNum}`,
          hidden: true
        };
      }
    }
  }
  visibleGame.legalActions = viewerPlayerNum
    ? getSharedLegalActions(game, viewerPlayerNum)
    : [];
  visibleGame.actionAvailability = viewerPlayerNum
    ? getSharedActionAvailability(game, viewerPlayerNum)
    : { laneAttacks: [], factionAbilities: [], handAttack: { available: false, unavailableReason: "Spectators cannot act." } };
  visibleGame.snapshotSchemaVersion = Number(game.snapshotSchemaVersion || game.schemaVersion || DUEL_SCHEMA_VERSION);
  visibleGame.commandSchemaVersion = Number(game.commandSchemaVersion || DUEL_COMMAND_SCHEMA_VERSION);
  visibleGame.eventSchemaVersion = Number(game.eventSchemaVersion || DUEL_EVENT_SCHEMA_VERSION);
  visibleGame.rulesVersion = game.rulesVersion || DUEL_RULES_VERSION;
  visibleGame.cardContentVersion = game.cardContentVersion || DUEL_CARD_CONTENT_VERSION;
  visibleGame.spectatorCount = spectatorCount;
  return visibleGame;
}

function acknowledgeMatchControl(ack, roomState, {
  accepted = true,
  code = null,
  message = "Match control accepted."
} = {}) {
  if (typeof ack !== "function") return;
  const result = {
    accepted,
    revision: Number(roomState?.game?.revision || 0),
    snapshotSequence: Number(roomState?.game?.snapshotSequence || 0),
    message
  };
  if (!accepted) result.rejection = { code: code || "CONTROL_REJECTED", message };
  ack(result);
}

function emitState(roomState, { incrementRevision = true } = {}) {
  if (!roomState.game) return;
  if (incrementRevision) {
    roomState.game.revision = Number(roomState.game.revision || 0) + 1;
  }
  roomState.game.snapshotSequence = Number(roomState.game.snapshotSequence || 0) + 1;
  touchRoom(roomState);
  captureGameEvent(roomState.game);
  scheduleRoomStatePersist();
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
  touchRoom(roomState);

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
  touchRoom(roomState);

  if (roomState.draft) {
    emitLobbyState(roomState);
    emitDraftState(roomState);
    return;
  }
  if (roomState.game) emitState(roomState, { incrementRevision: false });
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

function getConnectedDraftPlayers(roomState) {
  const connected = getConnectedLobbyPlayerNumbers(roomState);
  if (roomState.draft?.botDraft) return connected;
  return connected.filter((playerNum) => !roomState.lobby.players[playerNum].isAI);
}

function startDraft(roomState) {
  const draft = roomState.draft;
  const activePlayers = getConnectedDraftPlayers(roomState);
  draft.status = "drafting";
  draft.activePlayers = activePlayers;
  draft.round = 1;
  draft.pickNumber = 1;
  draft.direction = "left";
  draft.unopenedPacks = {};
  draft.currentPacks = {};
  draft.draftedPools = {};
  draft.deckAdditions = {};
  draft.completedAt = null;

  activePlayers.forEach((playerNum) => {
    const key = String(playerNum);
    draft.unopenedPacks[key] = [];
    draft.draftedPools[key] = [];
    draft.deckAdditions[key] = [];
    for (let packIndex = 0; packIndex < DRAFT_PACKS_PER_PLAYER; packIndex++) {
      draft.unopenedPacks[key].push(createDraftPack(playerNum));
    }
    draft.currentPacks[key] = draft.unopenedPacks[key].shift();
  });
}

function advanceDraftAfterPick(roomState) {
  const draft = roomState.draft;
  const activeKeys = draft.activePlayers.map(String);
  const allPicked = activeKeys.every((key) => !draft.currentPacks[key] || draft.currentPacks[key].pickedThisPass);
  if (!allPicked) return;

  const packsWithCards = activeKeys.filter((key) => (draft.currentPacks[key]?.cards || []).length > 0);
  if (packsWithCards.length > 0) {
    const previousPacks = {};
    activeKeys.forEach((key) => {
      if (draft.currentPacks[key]) {
        draft.currentPacks[key].pickedThisPass = false;
        previousPacks[key] = draft.currentPacks[key];
      }
    });

    activeKeys.forEach((key, index) => {
      const fromIndex = draft.direction === "left"
        ? (index + 1) % activeKeys.length
        : (index - 1 + activeKeys.length) % activeKeys.length;
      draft.currentPacks[key] = previousPacks[activeKeys[fromIndex]] || null;
    });
    draft.pickNumber += 1;
    return;
  }

  const nextRound = draft.round + 1;
  if (nextRound > DRAFT_PACKS_PER_PLAYER) {
    draft.status = "building";
    draft.completedAt = new Date().toISOString();
    activeKeys.forEach((key) => {
      draft.currentPacks[key] = null;
    });
    return;
  }

  draft.round = nextRound;
  draft.pickNumber = 1;
  draft.direction = nextRound % 2 === 0 ? "right" : "left";
  activeKeys.forEach((key) => {
    draft.currentPacks[key] = draft.unopenedPacks[key]?.shift() || null;
  });
}

function getDraftBotPreferredFaction(pool = []) {
  const counts = pool.reduce((acc, card) => {
    if (card?.factionId) acc[card.factionId] = (acc[card.factionId] || 0) + 1;
    return acc;
  }, {});
  let bestFaction = null;
  let bestCount = 0;
  for (const [factionId, count] of Object.entries(counts)) {
    if (count > bestCount) {
      bestFaction = factionId;
      bestCount = count;
    }
  }
  return bestCount >= 2 ? bestFaction : null;
}

function scoreDraftBotCard(card, pool = []) {
  const rarityScore = { common: 1, uncommon: 4, rare: 9, mythic: 14 }[card?.rarity] || 2;
  const preferredFaction = getDraftBotPreferredFaction(pool);
  const factionScore = preferredFaction && card?.factionId === preferredFaction ? 8 : 0;
  const earlyFlexScore = !preferredFaction && pool.length < 4 ? (card?.rarity === "rare" || card?.rarity === "mythic" ? 4 : 0) : 0;
  const curveScore = Math.max(0, 8 - Math.abs((Number(card?.value) || 5) - 5));
  const typeScore = card?.type === "unit" ? 2 : card?.type === "weapon" ? 1 : 0;
  return rarityScore * 10 + factionScore + earlyFlexScore + curveScore + typeScore + crypto.randomInt(5);
}

function makeBotDraftPick(roomState, playerNum) {
  const draft = roomState.draft;
  const key = String(playerNum);
  const pack = draft.currentPacks[key];
  if (!pack || pack.pickedThisPass || !pack.cards?.length) return false;
  const pool = draft.draftedPools[key] || [];
  let bestIndex = 0;
  let bestScore = -Infinity;
  pack.cards.forEach((card, index) => {
    const score = scoreDraftBotCard(card, pool);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  const [card] = pack.cards.splice(bestIndex, 1);
  draft.draftedPools[key].push(card);
  pack.pickedThisPass = true;
  draft.botPickLog = draft.botPickLog || [];
  draft.botPickLog.push(`${roomState.lobby.players[playerNum].accountName || `Bot ${playerNum}`} picked a ${card.rarity || "draft"} ${card.factionId || "neutral"} card.`);
  return true;
}

function runBotDraftPicks(roomState) {
  const draft = roomState.draft;
  if (!draft?.botDraft || draft.status !== "drafting") return;
  let guard = 0;
  while (draft.status === "drafting" && guard < 200) {
    guard++;
    let pickedAny = false;
    for (const playerNum of draft.activePlayers || []) {
      if (!roomState.lobby.players[playerNum]?.isAI) continue;
      pickedAny = makeBotDraftPick(roomState, playerNum) || pickedAny;
    }
    const activeKeys = draft.activePlayers.map(String);
    const waitingOnHuman = activeKeys.some((key) => {
      const playerNum = Number(key);
      const pack = draft.currentPacks[key];
      return !roomState.lobby.players[playerNum]?.isAI && pack && !pack.pickedThisPass && (pack.cards || []).length > 0;
    });
    advanceDraftAfterPick(roomState);
    if (waitingOnHuman || !pickedAny) break;
  }
}

async function getFriendAccountForChallenge(accountId, friendId) {
  if (useSupabaseStore()) {
    const friendship = await supabaseRequest(`gauntlet_friends?account_id=eq.${encodeURIComponent(accountId)}&friend_id=eq.${encodeURIComponent(friendId)}&select=friend_id`);
    return friendship.length > 0 ? findSupabaseAccountById(friendId) : null;
  }
  const store = loadAccountStore();
  const account = store.accounts.find((entry) => entry.id === accountId);
  return account?.friends?.includes(friendId) ? store.accounts.find((entry) => entry.id === friendId) || null : null;
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
  const event = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    turn: game.turn || 1,
    phase: game.phase || "setup",
    text: game.message,
    createdAt: new Date().toISOString()
  };
  game.eventLog.push(event);
  captureAuditEvent(game, event.createdAt);
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
  const currentRevision = Number(roomState.game?.revision || 0);
  const currentSnapshotSequence = Number(roomState.game?.snapshotSequence || 0);
  roomState.game = normalizeDuelPlayerIds(clonePlain(snapshot.game));
  roomState.game.revision = currentRevision;
  roomState.game.snapshotSequence = currentSnapshotSequence;
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
    damageTakenThisTurn: 0,
    previousAttackSuit: null,
    previousPlayedValue: null,
    suitsPlayedThisTurn: [],
    paymentSuitsThisTurn: [],
    ruminSharedSuitBuffsUsed: 0,
    ruminSenateVaultGuardUsed: false,
    ruminCountingHouseAegisUsed: false,
    biziDifferentSuitBuffsUsed: 0,
    meerusFreeAttackAvailable: false,
    beliHighCostAttackBuffAvailable: false,
    sheenNextAttackBonus: 0,
    sheenNextBlockBonus: 0,
    sheenEndTurnDraws: 0,
    beliCanopyShieldUsed: false,
    beliAwakenedReady: false,
    ruminNextWeaponArmBonus: 0,
    ruminJewelBankUsed: false,
    frumoLaneSwappedThisTurn: false,
    frumoNextPaymentBonus: 0,
    frumoNextActionBonus: 0,
    frumoRiptideSmugglerUsed: false,
    poleaSunkenOrderUsed: false,
    biziVoltageBonusUsed: false,
    biziFirstOverpayRewardUsed: false,
    biziClockworkCaravanUsed: false,
    biziEndTurnDraws: 0,
    biziPrimeSignalBonus: 0,
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
    if (cardIs(card, "frumo-poleas-moonlit-map")) {
      card.tempBuff += 1;
      notes.push("Polea's Moonlit Map +1");
    }
    player.turnData.ristusConsecutiveBuffUsed = true;
    notes.push("Ristus +2 consecutive value");
  }

  registerCardPlayed(player, card);
  return notes;
}

function getCardCurrentValue(card) {
  return getBaseCardValue(card) + (card?.tempBuff || 0);
}

function cardIs(card, id) {
  return card?.definitionId === id || card?.id === id;
}

function cardHasType(card, type) {
  return String(card?.type || "").toLowerCase() === type;
}

function getPlayerControlledLaneCards(game, playerNum) {
  return (game?.lanes || [])
    .map((lane, laneIndex) => ({ lane, laneIndex, card: lane.facedown?.[playerNum] }))
    .filter((entry) => entry.card);
}

function getPlayerVisibleCards(game, playerNum) {
  const player = game.players[playerNum];
  return [
    ...(player.hand || []),
    ...(player.discard || []),
    ...getPlayerControlledLaneCards(game, playerNum).map((entry) => entry.card),
    ...(game.handAttacks || []).filter((attack) => attack.player === playerNum).map((attack) => attack.card),
    ...(game.lanes || []).filter((lane) => lane.attack?.player === playerNum).map((lane) => lane.attack.card)
  ].filter(Boolean);
}

function playerHasVisibleCard(game, playerNum, id) {
  return getPlayerVisibleCards(game, playerNum).some((card) => cardIs(card, id));
}

function getPlayerSupportCards(game, playerNum) {
  return [
    ...getPlayerControlledLaneCards(game, playerNum).map((entry) => entry.card),
    ...(game.handAttacks || []).filter((attack) => attack.player === playerNum).map((attack) => attack.card),
    ...(game.lanes || []).filter((lane) => lane.attack?.player === playerNum).map((lane) => lane.attack.card)
  ].filter(Boolean);
}

function playerControlsCard(game, playerNum, id) {
  return getPlayerSupportCards(game, playerNum).some((card) => cardIs(card, id));
}

function addPaymentSuits(player, paymentCards) {
  for (const card of paymentCards || []) {
    if (card?.suit && !player.turnData.paymentSuitsThisTurn.includes(card.suit)) {
      player.turnData.paymentSuitsThisTurn.push(card.suit);
    }
  }
}

function drawCards(player, count) {
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    if (!player.deck?.length) break;
    player.hand.push(player.deck.pop());
    drawn++;
  }
  return drawn;
}

function gainLifeFromBlocking(game, playerNum, amount, notes = []) {
  const player = game.players[playerNum];
  player.life += amount;
  if (playerControlsCard(game, playerNum, "sheen-roots-that-remember")) {
    player.turnData.sheenNextBlockBonus = (player.turnData.sheenNextBlockBonus || 0) + 1;
    notes.push("Roots That Remember next block +1");
  }
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

function armRuminWeaponsForAttack(game, playerNum, attackCard, attackNumber, source, notes) {
  const player = game.players[playerNum];
  if (player.faction?.id !== "rumin" || source !== "hand") return { value: 0, armedCards: [] };

  const weaponEntries = getPlayerControlledLaneCards(game, playerNum)
    .filter((entry) => entry.card.factionId === "rumin" && cardHasType(entry.card, "weapon"));
  if (weaponEntries.length === 0) return { value: 0, armedCards: [] };

  const shouldArmAll = cardIs(attackCard, "rumin-rumie-market-colossus");
  const entriesToArm = shouldArmAll ? weaponEntries : weaponEntries.slice(0, 1);
  let value = 0;
  const armedCards = [];

  for (const entry of entriesToArm) {
    const weapon = entry.card;
    let bonus = 0;
    if (cardIs(weapon, "rumin-coin-scale-spear")) bonus = 2;
    else if (cardIs(weapon, "rumin-rumie-vault-shield")) bonus = 3;
    else if (cardIs(weapon, "rumin-imperial-scale-pike")) bonus = player.turnData.previousAttackSuit && player.turnData.previousAttackSuit === attackCard.suit ? 4 : 2;
    else if (cardIs(weapon, "rumin-aurelian-clawblade")) bonus = 4;
    else if (cardIs(weapon, "rumin-triumphal-ram")) bonus = getBaseCardValue(attackCard) >= 8 ? 5 : 4;
    else if (cardIs(weapon, "rumin-kaisers-gold-claw")) bonus = attackNumber === 4 ? 6 : 5;
    else bonus = Math.max(1, Math.floor(getBaseCardValue(weapon) / 2));

    if (player.turnData.ruminNextWeaponArmBonus) {
      bonus += player.turnData.ruminNextWeaponArmBonus;
      notes.push(`Marble Market Tribune armed weapon +${player.turnData.ruminNextWeaponArmBonus}`);
      player.turnData.ruminNextWeaponArmBonus = 0;
    }
    if (shouldArmAll) bonus += 1;
    if (attackNumber === 4 && playerControlsCard(game, playerNum, "rumin-basilisk-standard")) {
      bonus += 2;
      notes.push("Basilisk Standard +2");
    }

    value += bonus;
    armedCards.push(weapon);
    game.lanes[entry.laneIndex].facedown[playerNum] = null;
    notes.push(`${weapon.name} armed +${bonus}`);
  }

  return { value, armedCards };
}

function calculateAttackBonuses(game, playerNum, card, source) {
  const player = game.players[playerNum];
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
  if (player.turnData.sheenNextAttackBonus) {
    value += player.turnData.sheenNextAttackBonus;
    notes.push(`Sheen next attack +${player.turnData.sheenNextAttackBonus}`);
    player.turnData.sheenNextAttackBonus = 0;
  }
  if (cardIs(card, "sheen-thornroot-counterstroke") && (player.turnData.damageTakenThisTurn || 0) === 0) {
    value += 2;
    notes.push("Thornroot Counterstroke no damage +2");
  }
  if (cardIs(card, "sheen-nus-calm-command") && player.turnData.blocksDeclaredThisTurn >= 3) {
    value += 3;
    notes.push("Nu's Calm Command +3");
  }
  if (cardIs(card, "sheen-beli-awakened") && player.turnData.beliAwakenedReady) {
    value += 3;
    notes.push("Beli Awakened +3");
    player.turnData.beliAwakenedReady = false;
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
    if (playerControlsCard(game, playerNum, "bizi-constanti-conduit")) {
      value += 1;
      notes.push("Constanti Conduit +1");
    }
    if (cardIs(card, "bizi-dune-circuit-runner")) {
      value += 1;
      notes.push("Dune Circuit Runner +1");
    }
    if (cardIs(card, "bizi-railspike-marshal")) {
      value += 1;
      notes.push("Railspike Marshal +1");
    }
    if (playerControlsCard(game, playerNum, "bizi-desert-logic-engine")) {
      value += 2;
      notes.push("Desert Logic Engine +2");
    }
  }
  if (player.faction?.id === "bizi" && cardIs(card, "bizi-sandstorm-processor") && (player.accelerationCounters || 0) >= 2) {
    value += 2;
    notes.push("Sandstorm Processor +2");
  }
  if (player.faction?.id === "bizi" && cardIs(card, "bizi-constanti-sunforge") && (player.accelerationCounters || 0) > 0) {
    const spent = Math.min(3, player.accelerationCounters || 0);
    player.accelerationCounters = Math.max(0, (player.accelerationCounters || 0) - spent);
    value += spent * 2;
    notes.push(`Constanti Sunforge spent ${spent} counter${spent === 1 ? "" : "s"} +${spent * 2}`);
  }
  if (player.faction?.id === "bizi" && cardIs(card, "bizi-voltaric-ultimatum") && (player.accelerationCounters || 0) >= 2) {
    player.accelerationCounters -= 2;
    value += 5;
    notes.push("Voltaric Ultimatum spent 2 acceleration +5");
  }
  if (player.faction?.id === "bizi" && player.turnData.biziPrimeSignalBonus) {
    value += player.turnData.biziPrimeSignalBonus;
    notes.push(`Focus Prime Signal +${player.turnData.biziPrimeSignalBonus}`);
    player.turnData.biziPrimeSignalBonus = 0;
  }

  if (player.faction?.id === "frumo") {
    if (source === "lane" && cardIs(card, "frumo-tideglass-cutlass") && player.turnData.frumoLaneSwappedThisTurn) {
      value += 1;
      notes.push("Tideglass Cutlass swapped lane +1");
    }
    if (cardIs(card, "frumo-pressure-lock-pistol") && player.turnData.previousPlayedValue != null && Math.abs(cardBaseValue - player.turnData.previousPlayedValue) === 1) {
      value += 2;
      notes.push("Pressure-Lock Pistol consecutive +2");
    }
    if (source === "lane" && cardIs(card, "frumo-ristus-blackwake") && game.lanes.some((lane) => !lane.facedown[playerNum])) {
      value += 1;
      notes.push("Ristus Blackwake empty lane +1");
    }
    if (source === "lane" && cardIs(card, "frumo-ballast-hook") && game.lanes.some((lane) => !lane.facedown[playerNum])) {
      value += 1;
      notes.push("Ballast Hook empty lane +1");
    }
    if (source === "lane" && cardIs(card, "frumo-captains-bad-wager") && player.turnData.previousPlayedValue != null && player.turnData.previousPlayedValue % 2 === 0) {
      value += 3;
      notes.push("Captain's Bad Wager previous even value +3");
    }
    if (player.turnData.frumoNextActionBonus) {
      value += player.turnData.frumoNextActionBonus;
      notes.push(`Frumo next action +${player.turnData.frumoNextActionBonus}`);
      player.turnData.frumoNextActionBonus = 0;
    }
  }

  const armed = armRuminWeaponsForAttack(game, playerNum, card, attackNumber, source, notes);
  value += armed.value;
  return { value, notes, armedCards: armed.armedCards };
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
  if (player.faction?.id === "rumin" && attackNumber === 1 && cardIs(card, "rumin-tax-road-scout")) {
    return { required: Math.max(0, required - 1), freeAttackUsed: false };
  }

  return { required, freeAttackUsed: false };
}

function getPaymentTotal(player, paymentIndexes, useHeraBonus, context = {}) {
  let total = 0;
  const paymentCards = paymentIndexes.map((idx) => player.hand[idx]).filter(Boolean);
  for (const idx of paymentIndexes) {
    if (player.hand[idx]) total += getBaseCardValue(player.hand[idx]);
  }
  const notes = [];
  const consume = {
    ruminJewelBank: false,
    frumoNextPaymentBonus: false,
    biziVoltageBonus: false
  };

  if (context.action === "attack" && cardIs(context.card, "rumin-forum-ledger-runner") && player.turnData.attacksDeclaredThisTurn === 0 && paymentCards.length > 0) {
    total += 1;
    notes.push("Forum Ledger Runner payment +1");
  }
  if (context.action === "attack" && context.card?.factionId === "rumin" && !player.turnData.ruminJewelBankUsed && paymentCards.some((card) => cardIs(card, "rumin-jewel-bank-contract"))) {
    total += 2;
    consume.ruminJewelBank = true;
    notes.push("Jewel-Bank Contract payment +2");
  }
  if (context.action === "attack" && player.faction?.id === "rumin" && player.turnData.attacksDeclaredThisTurn === 3 && paymentCards.some((card) => cardIs(card, "rumin-edict-of-the-vault"))) {
    total += 3;
    notes.push("Edict of the Vault payment +3");
  }
  if (context.action === "block" && context.blockCards?.length >= 2 && paymentCards.some((card) => cardIs(card, "sheen-harmony-ward"))) {
    total += 1;
    notes.push("Harmony Ward payment +1");
  }
  if (paymentCards.some((card) => cardIs(card, "frumo-sunken-coin")) && context.game?.lanes?.some((lane) => !lane.facedown?.[context.playerNum])) {
    total += 1;
    notes.push("Sunken Coin payment +1");
  }
  if (player.turnData.frumoNextPaymentBonus) {
    total += player.turnData.frumoNextPaymentBonus;
    notes.push(`Lafayette's Chart payment +${player.turnData.frumoNextPaymentBonus}`);
    consume.frumoNextPaymentBonus = true;
  }
  if (!player.turnData.biziVoltageBonusUsed && context.card?.factionId === "bizi" && paymentCards.some((card) => cardIs(card, "bizi-voltage-ration"))) {
    total += 1;
    consume.biziVoltageBonus = true;
    notes.push("Voltage Ration payment +1");
  }
  if (!player.turnData.biziVoltageBonusUsed && context.card?.factionId === "bizi" && paymentCards.some((card) => cardIs(card, "bizi-brass-spark"))) {
    total += 1;
    consume.biziVoltageBonus = true;
    notes.push("Brass Spark payment +1");
  }
  if (context.card?.factionId === "bizi" && paymentCards.some((card) => cardIs(card, "bizi-heras-calibration"))) {
    total += 2;
    notes.push("Hera's Calibration payment +2");
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
  return { total, heraUsedNow, notes, consume };
}

function consumePaymentBonuses(player, payment) {
  if (!payment?.consume) return;
  if (payment.consume.ruminJewelBank) player.turnData.ruminJewelBankUsed = true;
  if (payment.consume.frumoNextPaymentBonus) player.turnData.frumoNextPaymentBonus = 0;
  if (payment.consume.biziVoltageBonus) player.turnData.biziVoltageBonusUsed = true;
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

function applyBlockBonuses(game, playerNum, card, context = {}) {
  const player = game.players[playerNum];
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
  if (player.turnData.sheenNextBlockBonus) {
    effectiveValue += player.turnData.sheenNextBlockBonus;
    notes.push(`Sheen next block +${player.turnData.sheenNextBlockBonus}`);
    player.turnData.sheenNextBlockBonus = 0;
  }
  if (cardIs(card, "sheen-rootwatch-initiate") && player.turnData.blocksDeclaredThisTurn > 0) {
    effectiveValue += 1;
    notes.push("Rootwatch Initiate +1");
  }
  if (cardIs(card, "sheen-living-bark-guard") && context.attack?.source === "hand") {
    effectiveValue += 1;
    notes.push("Living Bark Guard +1");
  }
  if (cardIs(card, "sheen-seedwall-acolyte") && player.turnData.blocksDeclaredThisTurn === 0) {
    effectiveValue += 1;
    notes.push("Seedwall Acolyte first block +1");
  }
  if (cardIs(card, "sheen-ringroot-bastion") && context.isLaneBlock) {
    effectiveValue += 2;
    notes.push("Ringroot Bastion lane block +2");
  }
  if (cardIs(card, "sheen-nus-verdant-edict") && player.turnData.blocksDeclaredThisTurn === 2) {
    effectiveValue += 1;
    notes.push("Nu's Verdant Edict third block upgrade +1");
  }
  if (playerControlsCard(game, playerNum, "sheen-emperors-heartwood")) {
    effectiveValue += 1;
    notes.push("Emperor's Heartwood +1");
  }
  if (cardIs(card, "bizi-gearplate-shield") && (player.accelerationCounters || 0) > 0) {
    player.accelerationCounters -= 1;
    effectiveValue += 2;
    notes.push("Gearplate Shield spent 1 acceleration +2");
  }
  if (cardIs(card, "bizi-heat-sink-matrix") && (player.accelerationCounters || 0) > 0) {
    player.accelerationCounters -= 1;
    effectiveValue += 2;
    notes.push("Heat-Sink Matrix spent 1 acceleration +2");
  }
  if (context.isLaneBlock && cardIs(card, "frumo-coral-hull-guard")) {
    effectiveValue += 1;
    player.turnData.frumoLaneSwappedThisTurn = true;
    notes.push("Coral-Hull Guard lane feint +1");
  }
  if (player.turnData.frumoNextActionBonus) {
    effectiveValue += player.turnData.frumoNextActionBonus;
    notes.push(`Frumo next action +${player.turnData.frumoNextActionBonus}`);
    player.turnData.frumoNextActionBonus = 0;
  }
  return { effectiveValue, notes };
}

function applyBlockPaymentCardEffects(game, playerNum, blockEntries, paymentCards = []) {
  if (!blockEntries.length) return;
  if (paymentCards.some((card) => cardIs(card, "sheen-mossbound-staff"))) {
    blockEntries[0].effectiveValue += 1;
    blockEntries[0].notes.push("Mossbound Staff block +1");
  }
  if (blockEntries.length >= 2 && paymentCards.some((card) => cardIs(card, "sheen-sapling-chorus"))) {
    blockEntries[0].effectiveValue += 1;
    blockEntries[0].notes.push("Sapling Chorus block +1");
  }
}

function finalizeBlockDeclaration(game, playerNum, blockEntries = []) {
  const player = game.players[playerNum];
  player.turnData.blocksDeclaredThisTurn++;
  if (player.faction?.id === "sheen" && player.turnData.blocksDeclaredThisTurn === 2) {
    if (!player.turnData.tangLifeGainUsed) {
      const notes = blockEntries[0]?.notes || [];
      gainLifeFromBlocking(game, playerNum, 2, notes);
      player.turnData.tangLifeGainUsed = true;
    }
    player.turnData.beliHighCostAttackBuffAvailable = true;
  }
  if (blockEntries.some((entry) => cardIs(entry.card, "sheen-beli-vinebinder")) && player.turnData.blocksDeclaredThisTurn >= 2) {
    player.turnData.sheenNextAttackBonus = (player.turnData.sheenNextAttackBonus || 0) + 1;
    blockEntries[0]?.notes.push("Beli Vinebinder next attack +1");
  }
  if (blockEntries.some((entry) => cardIs(entry.card, "sheen-tangs-patient-hand")) && player.turnData.blocksDeclaredThisTurn >= 2) {
    gainLifeFromBlocking(game, playerNum, 2, blockEntries[0]?.notes || []);
    player.turnData.sheenEndTurnDraws = (player.turnData.sheenEndTurnDraws || 0) + 1;
    blockEntries[0]?.notes.push("Tang's Patient Hand draw at end of turn");
  }
  if (blockEntries.some((entry) => cardIs(entry.card, "sheen-emperors-heartwood")) && player.turnData.blocksDeclaredThisTurn >= 3) {
    gainLifeFromBlocking(game, playerNum, 1, blockEntries[0]?.notes || []);
    blockEntries[0]?.notes.push("Emperor's Heartwood +1 life");
  }
}

function addAccelerationIfOverpaid(game, playerNum, paid, required, card = null, notes = []) {
  const player = game.players[playerNum];
  if (player.faction?.id === "bizi" && paid - required >= 2) {
    let gained = 1;
    if (cardIs(card, "bizi-copperline-technician")) gained += 1;
    if (playerControlsCard(game, playerNum, "bizi-regnum-voltage-bank") && !player.turnData.biziFirstOverpayRewardUsed) {
      gained += 1;
      player.life += 1;
      player.turnData.biziFirstOverpayRewardUsed = true;
      notes.push("Regnum Voltage Bank +1 life and +1 counter");
    }
    player.accelerationCounters = (player.accelerationCounters || 0) + gained;
    notes.push(`Bizi overpay +${gained} acceleration`);
    for (const visibleCard of getPlayerSupportCards(game, playerNum)) {
      if (cardIs(visibleCard, "bizi-solar-array-adept")) {
        visibleCard.tempBuff = (visibleCard.tempBuff || 0) + 1;
        notes.push("Solar Array Adept +1");
      }
    }
  }
}

function applyOverpayCardRewards(game, playerNum, paid, required, card = null, notes = []) {
  const player = game.players[playerNum];
  if (paid - required < 2) return;
  if (cardIs(card, "rumin-senate-vault-guard") && !player.turnData.ruminSenateVaultGuardUsed) {
    player.life += 1;
    player.turnData.ruminSenateVaultGuardUsed = true;
    notes.push("Senate Vault Guard overpay +1 life");
  }
  if (card?.factionId === "rumin" && playerControlsCard(game, playerNum, "rumin-counting-house-aegis") && !player.turnData.ruminCountingHouseAegisUsed) {
    player.life += 1;
    player.turnData.ruminCountingHouseAegisUsed = true;
    notes.push("Counting-House Aegis overpay +1 life");
  }
  if (cardIs(card, "bizi-clockwork-caravan") && !player.turnData.biziClockworkCaravanUsed) {
    player.turnData.biziEndTurnDraws = (player.turnData.biziEndTurnDraws || 0) + 1;
    player.turnData.biziClockworkCaravanUsed = true;
    notes.push("Clockwork Caravan draw at end of turn");
  }
}

function applyAfterAttackDeclared(game, playerNum, attack, payment) {
  const player = game.players[playerNum];
  const card = attack.card;
  const notes = attack.notes || [];

  if (cardIs(card, "rumin-marble-market-tribune")) {
    player.turnData.ruminNextWeaponArmBonus = (player.turnData.ruminNextWeaponArmBonus || 0) + 1;
    notes.push("Marble Market Tribune next armed weapon +1");
  }
  if ((attack.attachedCards || []).some((weapon) => cardIs(weapon, "rumin-aurelian-clawblade")) && (payment.total || 0) - (payment.required || 0) >= 2) {
    player.life += 1;
    notes.push("Aurelian Clawblade overpay +1 life");
  }
  if (cardIs(card, "bizi-focus-prime-signal")) {
    player.accelerationCounters = (player.accelerationCounters || 0) + 2;
    player.turnData.biziPrimeSignalBonus = Math.min(4, player.accelerationCounters || 0);
    notes.push(`Focus Prime Signal +2 acceleration; next card +${player.turnData.biziPrimeSignalBonus}`);
  }
  if (cardIs(card, "frumo-leviathan-salvage") && notes.some((note) => /Ristus|consecutive/i.test(note))) {
    player.life += 1;
    notes.push("Leviathan Salvage +1 life");
  }
}

function applyLaneEntryTriggers(game, playerNum, card, laneIndex, socket = null) {
  const player = game.players[playerNum];
  const notes = [];
  if (cardIs(card, "frumo-deckhand-diver")) {
    const top = player.deck[player.deck.length - 1];
    if (socket) socket.emit("peekResult", top ? `Top deck card: ${top.name}` : "Your deck is empty.");
    notes.push("Deckhand Diver peeked at top deck card");
  }
  if (cardIs(card, "frumo-ristus-rises")) {
    card.tempBuff = (card.tempBuff || 0) + 1;
    player.turnData.frumoLaneSwappedThisTurn = true;
    notes.push("Ristus Rises +1");
  }
  if (cardIs(card, "frumo-kelpcloak-trickster")) {
    player.turnData.frumoLaneSwappedThisTurn = true;
    notes.push("Kelpcloak Trickster enabled lane-swap bonuses");
  }
  if (cardIs(card, "frumo-abyssal-switchboard")) {
    player.turnData.frumoNextActionBonus = (player.turnData.frumoNextActionBonus || 0) + 1;
    notes.push("Abyssal Switchboard next action +1");
  }
  if (cardIs(card, "frumo-riptide-smuggler") && !player.turnData.frumoRiptideSmugglerUsed) {
    card.tempBuff = (card.tempBuff || 0) + 1;
    player.turnData.frumoRiptideSmugglerUsed = true;
    notes.push("Riptide Smuggler +1");
  }
  if (notes.length > 0) {
    game.message = `Player ${playerNum} placed ${card.name || "a card"} in lane ${laneIndex + 1}. ${notes.join(", ")}.`;
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
  return getSharedBasicCardValue(card);
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
  await recordFinalGameStats(roomState, { completionReason: "life_total" });
  if (continueBestOf3Series(roomState)) {
    emitState(roomState);
    return true;
  }
  io.to(roomState.roomCode).emit("gameEnded", { winner: game.winner, tie: game.winner == null });
  return true;
}

function continueBestOf3Series(roomState) {
  const completedGame = roomState.game;
  const series = roomState.bestOf3Series;
  if (!completedGame || !series || completedGame.gameMode === "freeForAll") return false;
  const isDraftLeagueSeries = !!completedGame.draftLeague || !!roomState.draftLeague;

  if (completedGame.winner != null) {
    const key = String(completedGame.winner);
    series.scores[key] = (series.scores[key] || 0) + 1;
  }

  const p1Score = series.scores[1] || series.scores["1"] || 0;
  const p2Score = series.scores[2] || series.scores["2"] || 0;
  if (p1Score >= series.targetWins || p2Score >= series.targetWins) {
    const seriesWinner = p1Score > p2Score ? 1 : 2;
    completedGame.bestOf3Series = clonePlain(series);
    completedGame.message = `${completedGame.message} Best-of-3 complete: Player ${seriesWinner} wins the series ${p1Score}-${p2Score}.`;
    return false;
  }

  const priorMessage = completedGame.message;
  series.gameNumber = (series.gameNumber || 1) + 1;
  roomState.lifecycle = createRoomLifecycle();
  createGameFromLobby(roomState);
  if (isDraftLeagueSeries) roomState.game.draftLeague = true;
  roomState.game.bestOf3Series = clonePlain(series);
  roomState.game.message = `${priorMessage} Best-of-3 score is ${p1Score}-${p2Score}. Starting game ${series.gameNumber}. Player ${roomState.game.priority} has priority.`;
  return true;
}

function buildAccountResultContext(roomState, matchRecord, playerNum) {
  const perspective = projectMatchPerspective(matchRecord, { playerNum });
  return {
    ranked: matchRecord.ranked,
    draftLeague: !!roomState.draft?.league || !!roomState.draftLeague,
    matchId: matchRecord.matchId,
    deckVersionId: perspective?.player?.deck?.deckVersionId || null,
    completedAt: matchRecord.completedAt,
    mode: matchRecord.mode,
    factionId: perspective?.player?.faction?.id || "basic",
    factionName: perspective?.player?.faction?.name || "Basic",
    opponentName: perspective?.opponent?.displayName || "Opponent",
    life: perspective?.player?.finalLife ?? null,
    opponentLife: perspective?.opponent?.finalLife ?? null,
    campaign: matchRecord.campaign ? clonePlain(matchRecord.campaign) : null,
    season: matchRecord.season ? clonePlain(matchRecord.season) : null,
    series: matchRecord.series ? clonePlain(matchRecord.series) : null,
    playerNum,
    matchIndex: buildAccountMatchIndexEntry(matchRecord, { playerNum })
  };
}

async function recordFinalGameStats(roomState, options = {}) {
  const game = roomState.game;
  if (!game || game.statsRecorded) return;
  if (game.phase !== "gameOver") return;
  const completedAt = options.completedAt || new Date().toISOString();
  const completionReason = options.completionReason || "life_total";
  if (!(game.serverLeagueEvidence || []).some((entry) => ["match.ended", "match.abandoned"].includes(entry.eventType))) {
    captureLeagueEvidence(game, {
      command: { type: "finalizeMatch" },
      events: [{
        id: `${game.matchId}:final:${completionReason}`,
        type: completionReason === "abandoned" ? "match.abandoned" : "match.ended",
        winner: game.winner ?? null,
        completionReason,
        abandonmentReason: options.abandonmentReason || null
      }],
      timestamp: completedAt
    });
  }
  captureGameEvent(game);
  const matchRecord = buildMatchRecord(roomState, {
    completedAt,
    completionReason,
    abandonmentReason: options.abandonmentReason || null
  });

  const consequences = [];
  const shouldApplyAccountConsequences = completionReason !== "abandoned" && (!isTrainingAiRoom(roomState) || !!game.campaign);
  if (shouldApplyAccountConsequences) {
    for (const playerNum of getLobbyPlayerNumbers(roomState)) {
      const accountId = roomState.lobby.players[playerNum].accountId;
      if (!accountId) continue;
      const result = projectMatchPerspective(matchRecord, { playerNum })?.outcome || "unknown";
      consequences.push({
        accountId,
        playerNum,
        result,
        context: buildAccountResultContext(roomState, matchRecord, playerNum)
      });
    }
  }

  const finalized = await finalizeCompletedMatch.finalizeCompletedMatch({
    record: matchRecord,
    consequences,
    playerNum: 1
  });
  roomState.matchMetadata.recordedMatchId = finalized.record.matchId;
  markRoomCompleted(roomState, completedAt, options.abandonmentReason || completionReason);
  if (!finalized.alreadyFinalized && completionReason !== "abandoned" && !isTrainingAiRoom(roomState)) {
    await recordFactionGameStats(game);
  }
  game.statsRecorded = true;
  return finalized.envelope;
}

function resolveDamage(game, roomState) {
  if (game.gameMode === "freeForAll") {
    resolveFreeForAllDamage(game, roomState);
    return;
  }
  const damageMessages = [];

  function resolveAttackDamage(attack, laneLabel = "") {
    const totalBlock = (attack.block || []).reduce((sum, block) => sum + (block.effectiveValue || 0), 0);
    const totalPrevent = (attack.block || []).reduce((sum, block) => sum + (block.preventDamage || 0), 0);
    const rawDamage = Math.max(0, (attack.effectiveValue || 0) - totalBlock);
    const damage = Math.max(0, rawDamage - totalPrevent);
    const defender = getAttackDefender(game, attack);
    const blockedText = totalBlock > 0 ? ` after ${totalBlock} block${totalPrevent ? ` and ${totalPrevent} prevention` : ""}` : "";
    recordCombatResolution(game, {
      attackerPlayerNum: attack.player,
      defenderPlayerNum: defender,
      attackValue: attack.effectiveValue,
      blockValue: totalBlock,
      preventionValue: totalPrevent,
      damage
    });

    if (damage > 0) {
      game.players[defender].life -= damage;
      game.players[defender].turnData.damageTakenThisTurn = (game.players[defender].turnData.damageTakenThisTurn || 0) + damage;
      damageMessages.push(`${laneLabel}${describeCardValue(attack.card, attack.effectiveValue, attack.notes)}${blockedText} = ${damage} damage to Player ${defender}`);
    } else {
      damageMessages.push(`${laneLabel}${describeCardValue(attack.card, attack.effectiveValue, attack.notes)} was fully blocked by ${totalBlock}${totalPrevent ? ` with ${totalPrevent} prevention` : ""}`);
      for (const block of attack.block || []) {
        if (cardIs(block.card, "sheen-quiet-grove-sentinel")) gainLifeFromBlocking(game, block.player, 1, block.notes || []);
        if (cardIs(block.card, "sheen-raincall-mender")) gainLifeFromBlocking(game, block.player, 1, block.notes || []);
        if (cardIs(block.card, "sheen-beli-awakened")) game.players[block.player].turnData.beliAwakenedReady = true;
      }
    }

    game.players[attack.player].discard.push(attack.card);
    (attack.attachedCards || []).forEach((card) => game.players[attack.player].discard.push(card));
    for (const block of attack.block || []) {
      game.players[block.player].discard.push(block.card);
    }
  }

  for (const attack of game.handAttacks) {
    resolveAttackDamage(attack, "Hand attack ");
  }
  
  for (let i = 0; i < game.lanes.length; i++) {
    const lane = game.lanes[i];
    if (lane.attack) {
      lane.attack.block = lane.block || [];
      resolveAttackDamage(lane.attack, `Lane ${i + 1} attack `);
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
    recordCombatResolution(game, {
      attackerPlayerNum: attack.player,
      defenderPlayerNum: defender,
      attackValue: attack.effectiveValue,
      blockValue: totalBlock,
      preventionValue: 0,
      damage
    });
    if (damage > 0) {
      game.players[defender].life -= damage;
      damageMessages.push(`Player ${attack.player} hit Player ${defender} for ${damage}.`);
    } else {
      damageMessages.push(`Player ${defender} fully blocked Player ${attack.player}'s attack.`);
      for (const block of attack.block || []) {
        if (cardIs(block.card, "sheen-quiet-grove-sentinel")) gainLifeFromBlocking(game, block.player, 1, block.notes || []);
        if (cardIs(block.card, "sheen-raincall-mender")) gainLifeFromBlocking(game, block.player, 1, block.notes || []);
        if (cardIs(block.card, "sheen-beli-awakened")) game.players[block.player].turnData.beliAwakenedReady = true;
      }
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
    const endTurnMessages = [];
    for (const p of playerNumbers) {
      const player = game.players[p];
      if (player.turnData.sheenEndTurnDraws) {
        const drawn = drawCards(player, player.turnData.sheenEndTurnDraws);
        if (drawn > 0) endTurnMessages.push(`Player ${p} drew ${drawn} extra card${drawn === 1 ? "" : "s"} from Sheen draft cards.`);
      }
      if (player.turnData.biziEndTurnDraws) {
        const drawn = drawCards(player, player.turnData.biziEndTurnDraws);
        if (drawn > 0) endTurnMessages.push(`Player ${p} drew ${drawn} extra card${drawn === 1 ? "" : "s"} from Bizi draft cards.`);
      }
      while (player.hand.length < BASIC_HAND_SIZE && player.deck.length > 0) {
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
    if (game.campaign) {
      game.campaign.bossAttacksThisTurn = 0;
      const bossHealing = Number(game.campaign.bossAbility?.healAtTurnStart || 0);
      if (bossHealing > 0 && game.players[2]) {
        game.players[2].life += bossHealing;
        endTurnMessages.push(`${game.campaign.bossAbility.name} restored ${bossHealing} life.`);
      }
    }
    game.message = `${endTurnMessages.length > 0 ? `${endTurnMessages.join(" ")} ` : ""}Turn ${game.turn} - Player ${game.priority} has priority`;
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

function legacyDeclareAiHandAttack(roomState) {
  const game = roomState.game;
  const ai = game.players[2];
  const options = ai.hand
    .map((card, index) => ({ card, index, value: getBaseCardValue(card) }))
    .sort((a, b) => a.value - b.value);

  for (const option of options) {
    const paymentIndexes = findAiPaymentIndexes(ai.hand, option.value, [option.index]);
    if (!paymentIndexes) continue;

    const attackCard = ai.hand[option.index];
    const payment = getPaymentTotal(ai, paymentIndexes, false, { game, playerNum: 2, action: "attack", card: option.card });
    const paymentCards = getHandCardsByIndexes(ai, paymentIndexes);
    consumePaymentBonuses(ai, payment);
    removeSelectedCardAndPayments(ai, option.index, paymentIndexes);
    addPaymentSuits(ai, paymentCards);
    const attackBonus = calculateAttackBonuses(game, 2, attackCard, "hand");
    attackBonus.notes.push(...(payment.notes || []));
    addAccelerationIfOverpaid(game, 2, payment.total, option.value, attackCard, attackBonus.notes);
    applyOverpayCardRewards(game, 2, payment.total, option.value, attackCard, attackBonus.notes);
    const attackInfo = finalizeAttackDeclaration(ai, attackCard, attackBonus, false);
    const attack = {
      id: `attack-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      player: 2,
      card: attackCard,
      source: "hand",
      effectiveValue: attackInfo.effectiveValue,
      block: [],
      attachedCards: attackBonus.armedCards || [],
      notes: attackInfo.notes
    };
    attack.payment = { player: 2, cards: paymentCards, total: payment.total, required: option.value };
    applyAfterAttackDeclared(game, 2, attack, attack.payment);

    game.handAttacks.push(attack);
    resetPriorityPassed(game);
    game.priority = 1;
    game.mostRecentAttackDefender = 1;
    game.message = `Training AI attacked with ${describeCardValue(attackCard, attackInfo.effectiveValue, attackInfo.notes)} from hand. Player 1 can block or pass.`;
    return true;
  }

  return false;
}

function legacyDeclareCampaignBossAttack(roomState) {
  const game = roomState.game;
  const ai = game.players[2];
  const campaign = game.campaign;
  if (!campaign) return false;

  const attackNumber = (campaign.bossAttacksThisTurn || 0) + 1;
  const minValue = campaign.minAttackValue || 5;
  const maxValue = campaign.maxAttackValue || 8;
  const valueRange = Math.max(1, maxValue - minValue + 1);
  const baseValue = minValue + ((game.turn + attackNumber + (campaign.chapterNumber || 1)) % valueRange);
  const notes = [`Boss strike ${attackNumber}/${campaign.attacksPerTurn}`];
  const value = applyCampaignBossAbilityToAttack(campaign, attackNumber, baseValue, notes);
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
    notes,
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

function findSemanticAiPaymentCardIds(hand, required, excludedCardIds = []) {
  const excluded = new Set(excludedCardIds);
  const candidates = (hand || [])
    .filter((card) => !excluded.has(card.id))
    .map((card) => ({ card, value: getSharedBasicCardValue(card) }))
    .sort((left, right) => left.value - right.value);
  const cardIds = [];
  let total = 0;
  for (const candidate of candidates) {
    if (total >= Number(required || 0)) break;
    cardIds.push(candidate.card.id);
    total += candidate.value;
  }
  return total >= Number(required || 0) ? cardIds : null;
}

function campaignBossCanUseBlockerValue(game, card) {
  if (!game?.campaign || !card) return true;
  const value = getSharedBasicCardValue(card);
  const minValue = Number(game.campaign.minAttackValue || 1);
  const maxValue = Number(game.campaign.maxAttackValue || 14);
  return value >= minValue && value <= maxValue;
}

function chooseSemanticTrainingAiCommand(game) {
  const legalActions = getSharedLegalActions(game, 2);
  if (legalActions.length === 0) return null;
  const ai = game.players[2];
  const pending = getPendingAttackList(game)[0] || null;

  if (game.phase === "end") {
    const placement = legalActions.find((action) => action.type === "placeFacedown");
    return placement
      ? { type: "placeFacedown", laneIndex: placement.laneIndex, cardId: placement.cardId }
      : { type: "skipPlacement", laneIndex: game.endPlacementLaneIndex };
  }

  if (pending?.targetPlayer === 2) {
    const laneBlock = legalActions.find((action) => action.type === "declareLaneBlock");
    if (laneBlock) {
      const blocker = game.lanes[laneBlock.laneIndex]?.facedown?.[2];
      const paymentCardIds = blocker
        && campaignBossCanUseBlockerValue(game, blocker)
        ? findSemanticAiPaymentCardIds(ai.hand, getSharedBasicCardValue(blocker))
        : null;
      if (paymentCardIds) {
        return {
          type: "declareLaneBlock",
          laneIndex: laneBlock.laneIndex,
          paymentCardIds
        };
      }
    }
    const handBlock = legalActions.find((action) => action.type === "declareHandBlock");
    if (handBlock) {
      const blockers = [...ai.hand]
        .filter((card) => campaignBossCanUseBlockerValue(game, card))
        .sort((left, right) => getSharedBasicCardValue(left) - getSharedBasicCardValue(right));
      for (const blocker of blockers) {
        const paymentCardIds = findSemanticAiPaymentCardIds(
          ai.hand,
          getSharedBasicCardValue(blocker),
          [blocker.id]
        );
        if (paymentCardIds) {
          return {
            type: "declareHandBlock",
            attackId: pending.id,
            blockerCardIds: [blocker.id],
            paymentCardIds
          };
        }
      }
    }
    return { type: "declineBlock", attackId: pending.id };
  }

  if (pending) {
    return legalActions.some((action) => action.type === "passPriority")
      ? { type: "passPriority" }
      : null;
  }

  if (
    game.campaign
    && Number(game.campaign.bossAttacksThisTurn || 0) < Number(game.campaign.attacksPerTurn || 0)
  ) {
    return { type: "declareCampaignBossAttack", system: true };
  }

  if (aiNeedsLaneSetup(game)) return { type: "passPriority" };

  const attacks = legalActions
    .filter((action) => ["declareLaneAttack", "declareHandAttack"].includes(action.type))
    .sort((left, right) => {
      if (left.type !== right.type) return left.type === "declareLaneAttack" ? -1 : 1;
      return Number(left.requiredPayment || 0) - Number(right.requiredPayment || 0);
    });
  for (const action of attacks) {
    const excludedCardIds = action.type === "declareHandAttack" ? [action.cardId] : [];
    const paymentCardIds = findSemanticAiPaymentCardIds(
      ai.hand,
      action.requiredPayment,
      excludedCardIds
    );
    if (!paymentCardIds) continue;
    return action.type === "declareLaneAttack"
      ? { type: "declareLaneAttack", laneIndex: action.laneIndex, paymentCardIds }
      : {
          type: "declareHandAttack",
          cardId: action.cardId,
          attackerCardId: action.cardId,
          paymentCardIds
        };
  }
  return { type: "passPriority" };
}

async function applySemanticAutomatedCommand(roomState, selectedCommand) {
  const game = roomState.game;
  const isSystem = selectedCommand.system === true;
  const source = isSystem ? "campaign" : "training-ai";
  const command = { ...selectedCommand };
  delete command.system;
  const result = await executeSemanticDuelCommand(roomState, 2, {
    commandId: `${game.matchId}-${source}-${Number(game.revision || 0) + 1}`,
    baseRevision: Number(game.revision || 0),
    commandSchemaVersion: DUEL_COMMAND_SCHEMA_VERSION,
    eventSchemaVersion: DUEL_EVENT_SCHEMA_VERSION,
    rulesVersion: game.rulesVersion || DUEL_RULES_VERSION,
    command
  }, {
    system: isSystem,
    authority: "server",
    saveUndo: false
  });
  if (!result.accepted) {
    console.error(`[${source}] Shared command rejected: ${result.rejection?.message || command.type}`);
    return null;
  }
  return result;
}

async function aiResolveDamageIfReady(roomState) {
  const game = roomState.game;
  if (game.phase !== "damage") return false;
  await resolveCombatAndResumePriority(roomState);
  return true;
}

async function legacyAiPassPriority(roomState) {
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

async function legacyAiEndPlacement(roomState) {
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
  if (
    roomState.game.phase !== "end"
    && (roomState.game.phase !== "priority" || roomState.game.priority !== 2)
  ) return;

  const selectedCommand = chooseSemanticTrainingAiCommand(roomState.game);
  if (!selectedCommand) return;
  await applySemanticAutomatedCommand(roomState, selectedCommand);
}

function scheduleTrainingAi(roomState) {
  if (!isTrainingAiRoom(roomState) || roomState.aiMoveTimer) return;
  roomState.aiMoveTimer = setTimeout(() => {
    roomState.aiMoveTimer = null;
    runTrainingAi(roomState).catch((error) => console.error("[TrainingAI] Failed", error));
  }, 650);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function duelCommandFingerprint(playerNum, envelope, authority = "player") {
  const command = clonePlain(envelope.command || {});
  if (command.targets && typeof command.targets === "object") {
    for (const [key, value] of Object.entries(command.targets)) {
      if (command[key] != null && stableJson(command[key]) === stableJson(value)) delete command.targets[key];
    }
    if (Object.keys(command.targets).length === 0) delete command.targets;
  }
  return crypto.createHash("sha256").update(stableJson({
    actorPlayerId: Number(playerNum),
    baseRevision: Number(envelope.baseRevision),
    commandSchemaVersion: Number(envelope.commandSchemaVersion || DUEL_COMMAND_SCHEMA_VERSION),
    rulesVersion: envelope.rulesVersion || DUEL_RULES_VERSION,
    authority,
    command
  })).digest("hex");
}

function getCachedDuelCommand(roomState, commandId) {
  const cached = commandId ? roomState.duelCommandResults?.[commandId] : null;
  if (!cached) return null;
  if (cached.result) return cached;
  return { fingerprint: null, result: cached };
}

function cacheDuelCommand(roomState, commandId, fingerprint, result) {
  if (!commandId) return;
  roomState.duelCommandResults = roomState.duelCommandResults || {};
  roomState.duelCommandResults[commandId] = { fingerprint, result };
  const cachedIds = Object.keys(roomState.duelCommandResults);
  if (cachedIds.length > 100) {
    cachedIds.slice(0, cachedIds.length - 100)
      .forEach((cachedCommandId) => delete roomState.duelCommandResults[cachedCommandId]);
  }
}

function rejectDuelCommand(roomState, envelope, code, message) {
  return {
    commandId: envelope.commandId || null,
    accepted: false,
    revision: Number(roomState?.game?.revision || 0),
    snapshotSequence: Number(roomState?.game?.snapshotSequence || 0),
    rejection: { code, message }
  };
}

async function executeSemanticDuelCommand(roomState, playerNum, envelope = {}, internal = {}) {
  if (!roomState?.game || !playerNum) {
    return rejectDuelCommand(roomState, envelope, "MATCH_UNAVAILABLE", "The match is not available.");
  }
  if (!["basic", "factions"].includes(roomState.game.gameMode)) {
    return rejectDuelCommand(
      roomState,
      envelope,
      "COMPATIBILITY_REQUIRED",
      "This match mode still uses the compatibility socket adapter."
    );
  }
  if (!envelope.command || typeof envelope.command.type !== "string") {
    return rejectDuelCommand(roomState, envelope, "INVALID_COMMAND", "A semantic duel command is required.");
  }
  if (
    envelope.commandSchemaVersion != null
    && Number(envelope.commandSchemaVersion) !== DUEL_COMMAND_SCHEMA_VERSION
  ) {
    return rejectDuelCommand(roomState, envelope, "COMMAND_SCHEMA_MISMATCH", "Reload before submitting another match action.");
  }
  if (envelope.rulesVersion && envelope.rulesVersion !== roomState.game.rulesVersion) {
    return rejectDuelCommand(roomState, envelope, "RULES_VERSION_MISMATCH", "This match uses a different rules version. Reload to continue.");
  }

  const commandId = envelope.commandId || `${roomState.game.matchId}-server-${crypto.randomUUID()}`;
  const normalizedEnvelope = { ...envelope, commandId };
  const authority = internal.authority === "server" ? "server" : "player";
  const cacheKey = authority === "server" ? `server:${commandId}` : commandId;
  const fingerprint = duelCommandFingerprint(playerNum, normalizedEnvelope, authority);
  const cached = getCachedDuelCommand(roomState, cacheKey);
  if (cached) {
    if (cached.fingerprint && cached.fingerprint !== fingerprint) {
      return rejectDuelCommand(
        roomState,
        normalizedEnvelope,
        "COMMAND_ID_CONFLICT",
        "That command identifier was already used for a different action."
      );
    }
    return cached.result;
  }

  const applied = applySharedDuelCommand(roomState.game, {
    commandId,
    baseRevision: Number(envelope.baseRevision),
    actorPlayerId: playerNum,
    system: internal.system === true,
    command: envelope.command
  });
  if (!applied.accepted) {
    const rejected = {
      commandId: applied.commandId,
      accepted: false,
      revision: applied.revision,
      snapshotSequence: Number(roomState.game.snapshotSequence || 0),
      rejection: applied.rejection
    };
    cacheDuelCommand(roomState, cacheKey, fingerprint, rejected);
    scheduleRoomStatePersist();
    return rejected;
  }

  if (internal.saveUndo !== false) {
    saveUndoSnapshot(roomState, playerNum, applied.actionLogEntry?.label || envelope.command.type);
  }
  roomState.game = applied.state;
  captureLeagueEvidence(roomState.game, {
    commandId,
    actorPlayerNum: playerNum,
    command: envelope.command,
    events: applied.animationEvents,
    timestamp: new Date().toISOString()
  });
  if (roomState.game.phase === "gameOver") {
    await recordFinalGameStats(roomState, {
      completionReason: envelope.command.type === "concede" ? "concession" : "life"
    });
    if (!continueBestOf3Series(roomState)) {
      io.to(roomState.roomCode).emit("gameEnded", {
        winner: roomState.game.winner,
        tie: roomState.game.winner == null,
        concededBy: envelope.command.type === "concede" ? playerNum : null
      });
    }
  }

  const accepted = {
    commandId,
    accepted: true,
    revision: Number(roomState.game.revision || 0),
    snapshotSequence: Number(roomState.game.snapshotSequence || 0) + 1
  };
  cacheDuelCommand(roomState, cacheKey, fingerprint, accepted);
  emitState(roomState, { incrementRevision: false });
  accepted.snapshotSequence = Number(roomState.game.snapshotSequence || accepted.snapshotSequence);
  const stored = getCachedDuelCommand(roomState, cacheKey);
  if (stored) stored.result.snapshotSequence = accepted.snapshotSequence;
  scheduleTrainingAi(roomState);
  return accepted;
}

const LEGACY_SEMANTIC_CHOICE_FIELDS = [
  "forumLedgerPaymentCardId",
  "useJewelBankBonus",
  "armWeaponCardIds",
  "useBeliAwakenedBonus",
  "useSandstormProcessor",
  "sunforgeAccelerationToSpend",
  "useVoltaricUltimatum",
  "primeSignalBonus",
  "accelerationBlockerCardIds",
  "useDeckhandDiverPeek",
  "lastGambleChoice",
  "useMeerusFreeAttack"
];

function copyLegacySemanticChoices(payload = {}) {
  return Object.fromEntries(
    LEGACY_SEMANTIC_CHOICE_FIELDS
      .filter((field) => payload[field] !== undefined)
      .map((field) => [field, clonePlain(payload[field])])
  );
}

function legacyHandCardIds(player, indexes = [], field = "payment") {
  return (Array.isArray(indexes) ? indexes : [])
    .map((index) => {
      const normalized = Number(index);
      return player?.hand?.[normalized]?.id || `invalid-${field}-index-${index}`;
    });
}

async function executeLegacySemanticDuelCommand(roomState, socket, playerNum, command, label) {
  const result = await executeSemanticDuelCommand(roomState, playerNum, {
    commandId: `${roomState.game.matchId}-legacy-${label}-${crypto.randomUUID()}`,
    baseRevision: Number(roomState.game.revision || 0),
    commandSchemaVersion: DUEL_COMMAND_SCHEMA_VERSION,
    eventSchemaVersion: DUEL_EVENT_SCHEMA_VERSION,
    rulesVersion: roomState.game.rulesVersion || DUEL_RULES_VERSION,
    command
  });
  if (!result.accepted) {
    socket.emit("errorMessage", result.rejection?.message || "That action is unavailable.");
  }
  return result;
}

function createGameFromLobby(roomState, options = {}) {
  if (isFreeForAllRoom(roomState)) {
    createFreeForAllGameFromLobby(roomState);
    return;
  }
  roomState.matchMetadata = options.matchMetadata
    ? clonePlain(options.matchMetadata)
    : createMatchMetadata({
        seriesId: roomState.seriesId || null,
        gameNumber: roomState.bestOf3Series?.gameNumber || 1
      });
  const gameMode = getLobbyGameMode(roomState);
  const faction1 = gameMode === "basic" ? basicGameProfile : getFactionById(roomState.lobby.players[1].factionId);
  const faction2 = gameMode === "basic" ? basicGameProfile : getFactionById(roomState.lobby.players[2].factionId);
  const matchId = roomState.matchMetadata?.matchId || `room-${roomState.roomCode}`;
  const seed = String(options.seed || `${matchId}:game:${roomState.bestOf3Series?.gameNumber || 1}`);
  const random = createSharedSeededRandom(seed);
  const startingPriority = random() < 0.5 ? 1 : 2;
  
  const suits = ["♠", "♥", "♦", "♣"];
  const values = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const rankNames = { 11: "J", 12: "Q", 13: "K", 14: "A" };
  
  function createDraftCardForDeck(card, faction, playerNum, replacementIndex) {
    const definitionId = card.gameplayCardId || card.definitionId || card.id || card.draftCopyId || `replacement-${replacementIndex}`;
    return {
      id: `${matchId}-p${playerNum}-replacement-${replacementIndex}-${definitionId}`,
      definitionId,
      gameplayCardId: definitionId,
      variantId: card.variantId || `${definitionId}:standard`,
      collector: clonePlain(card.collector || null),
      value: Number(card.value),
      suit: DRAFT_CARD_SUITS.includes(card.suit)
        ? card.suit
        : DRAFT_CARD_SUITS[Math.floor(random() * DRAFT_CARD_SUITS.length)],
      name: card.name,
      rank: String(card.value),
      faction: faction.name,
      factionId: faction.id,
      image: card.image || faction.cardImage,
      rarity: card.rarity || "common",
      type: card.type || "draft",
      text: card.text || "",
      rulesText: card.rulesText || card.text || "",
      draftCard: true
    };
  }

  function createDeck(playerNum, faction, replacementCards = []) {
    const deck = [];
    for (let suitIndex = 0; suitIndex < suits.length; suitIndex += 1) {
      const suit = suits[suitIndex];
      for (const value of values) {
        deck.push({
          id: `${matchId}-p${playerNum}-${suitIndex}-${rankNames[value] || value}`,
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
    let replacementIndex = 0;
    applyDeckReplacements(
      deck,
      replacementCards,
      faction,
      (card, replacementFaction) => createDraftCardForDeck(
        card,
        replacementFaction,
        playerNum,
        replacementIndex++
      )
    );
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function getLobbyDeckReplacements(playerNum) {
    const lobbyPlayer = roomState.lobby.players[playerNum];
    const replacements = [];
    if (lobbyPlayer.savedDraftDeck?.cards?.length) replacements.push(...lobbyPlayer.savedDraftDeck.cards);
    else if (lobbyPlayer.savedConstructedDeck?.cards?.length) replacements.push(...lobbyPlayer.savedConstructedDeck.cards);
    if (lobbyPlayer.campaignDeckAdditions?.length) replacements.push(...lobbyPlayer.campaignDeckAdditions);
    return replacements;
  }
  
  const game = {
    schemaVersion: DUEL_SCHEMA_VERSION,
    snapshotSchemaVersion: DUEL_SCHEMA_VERSION,
    commandSchemaVersion: DUEL_COMMAND_SCHEMA_VERSION,
    eventSchemaVersion: DUEL_EVENT_SCHEMA_VERSION,
    rulesVersion: DUEL_RULES_VERSION,
    cardContentVersion: DUEL_CARD_CONTENT_VERSION,
    matchId,
    seed,
    revision: 0,
    snapshotSequence: 0,
    lastCommandId: null,
    lastEvents: [],
    eventSequence: 0,
    actionHistory: [],
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
        id: 1,
        accountName: roomState.lobby.players[1].accountName || null,
        faction: faction1,
        life: BASIC_STARTING_LIFE,
        hand: [],
        deck: createDeck(1, faction1, getLobbyDeckReplacements(1)),
        discard: [],
        lanes: [null, null, null],
        connected: true,
        turnData: createTurnData(),
        accelerationCounters: 0
      },
      2: {
        id: 2,
        accountName: roomState.lobby.players[2].accountName || null,
        faction: faction2,
        life: BASIC_STARTING_LIFE,
        hand: [],
        deck: createDeck(2, faction2, getLobbyDeckReplacements(2)),
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
    for (let i = 0; i < BASIC_HAND_SIZE; i++) {
      if (game.players[p].deck.length > 0) {
        game.players[p].hand.push(game.players[p].deck.pop());
      }
    }
  }
  
  roomState.game = game;
  captureLeagueEvidence(game, {
    command: { type: "matchStarted" },
    events: [
      { id: `${matchId}:match-started`, type: "match.started" },
      { id: `${matchId}:initial-draw:p1`, type: "cards.drawn", player: 1, count: BASIC_HAND_SIZE },
      { id: `${matchId}:initial-draw:p2`, type: "cards.drawn", player: 2, count: BASIC_HAND_SIZE },
      { id: `${matchId}:initial-priority`, type: "priority.granted", player: startingPriority }
    ],
    timestamp: roomState.matchMetadata?.startedAt || new Date().toISOString()
  });
  roomState.damageConfirmed = { 1: false, 2: false };
}

function createFreeForAllGameFromLobby(roomState) {
  roomState.matchMetadata = createMatchMetadata();
  const seatedPlayers = getConnectedLobbyPlayerNumbers(roomState).filter((playerNum) => roomState.lobby.players[playerNum].factionId);
  const startingPriority = seatedPlayers[Math.floor(Math.random() * seatedPlayers.length)];
  const suits = ["â™ ", "â™¥", "â™¦", "â™£"];
  const values = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const rankNames = { 11: "J", 12: "Q", 13: "K", 14: "A" };

  function createAddedCardForDeck(card, faction) {
    return {
      id: `constructed-${card.id || card.draftCopyId}-${Math.random().toString(36).slice(2)}-${Date.now()}`,
      definitionId: card.gameplayCardId || card.definitionId || card.id || null,
      gameplayCardId: card.gameplayCardId || card.definitionId || card.id || null,
      variantId: card.variantId || `${card.gameplayCardId || card.definitionId || card.id}:standard`,
      collector: clonePlain(card.collector || null),
      value: Number(card.value),
      suit: DRAFT_CARD_SUITS.includes(card.suit) ? card.suit : getDraftCardSuit(),
      name: card.name,
      rank: String(card.value),
      faction: faction.name,
      factionId: faction.id,
      image: card.image || faction.cardImage,
      rarity: card.rarity || "common",
      type: card.type || "constructed",
      text: card.text || "",
      rulesText: card.rulesText || card.text || "",
      draftCard: true
    };
  }

  function createDeck(faction, replacementCards = []) {
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
    applyDeckReplacements(deck, replacementCards, faction, createAddedCardForDeck);
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
    const addedCards = roomState.lobby.players[playerNum].savedConstructedDeck?.cards || [];
    players[playerNum] = {
      accountName: roomState.lobby.players[playerNum].accountName || null,
      faction,
      life: 42,
      hand: [],
      deck: createDeck(faction, addedCards),
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

  // Deterministic browser qualification setup. This hook is unavailable in
  // normal server runs and only moves an already-started campaign to the
  // final authoritative life check; the browser still submits passPriority.
  if (process.env.E2E_TEST === "true") {
    socket.on("e2ePrepareCampaignCompletion", (ack) => {
      const roomState = getRoomForSocket(socket);
      if (!roomState?.game?.campaign) {
        if (typeof ack === "function") ack({ ok: false, error: "Campaign test state unavailable." });
        return;
      }
      if (roomState.aiMoveTimer) {
        clearTimeout(roomState.aiMoveTimer);
        roomState.aiMoveTimer = null;
      }
      roomState.game.players[2].life = 0;
      roomState.game.priority = 1;
      roomState.game.priorityPassed = { 1: false, 2: true };
      roomState.game.handAttacks = [];
      roomState.game.lanes.forEach((lane) => {
        lane.attack = null;
        lane.block = [];
      });
      roomState.damageConfirmed = { 1: false, 2: false };
      roomState.game.message = "Qualification state prepared. Player 1 must pass priority to finish.";
      emitState(roomState);
      if (typeof ack === "function") ack({ ok: true });
    });
  }

  socket.on("joinMatchmaking", async ({ authToken, bestOf = 1 } = {}) => {
    console.log("[Socket] joinMatchmaking");
    const requestedBestOf = Number(bestOf) === 3 ? 3 : 1;
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
    removeFromDraftLeague(socket.id);
    const profile = getAccountMatchProfile(account);
    const entry = {
      socketId: socket.id,
      accountId: account.id,
      accountName: account.name,
      bestOf: requestedBestOf,
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
    const queueSize = matchmakingQueue.filter((candidate) => (candidate.bestOf || 1) === requestedBestOf).length;
    socket.emit("matchmakingStatus", {
      inQueue: true,
      message: `Searching ${ACTIVE_SEASON.displayName} for a similar record${requestedBestOf === 3 ? " best-of-3" : ""} opponent... ${queueSize} player${queueSize === 1 ? "" : "s"} in this queue.`,
      queueSize,
      bestOf: requestedBestOf,
      season: buildSeasonMatchIdentity(getActiveSeason(), requestedBestOf)
    });
  });

  socket.on("leaveMatchmaking", () => {
    removeFromMatchmaking(socket.id);
    socket.emit("matchmakingStatus", { inQueue: false, message: "Left matchmaking queue." });
  });

  socket.on("joinDraftLeague", async ({ authToken, draftType = "player", bestOf = 1 } = {}) => {
    console.log("[Socket] joinDraftLeague");
    const requestedDraftType = draftType === "bot" ? "bot" : "player";
    const requestedBestOf = Number(bestOf) === 3 ? 3 : 1;
    const account = await getAccountRecordFromToken(authToken || socket.data.authToken);
    if (!account) {
      socket.emit("draftLeagueStatus", { inQueue: false, message: "Sign in to use draft league matchmaking." });
      return;
    }
    if (socket.data.roomCode) {
      socket.emit("draftLeagueStatus", { inQueue: false, message: "Leave your current room before entering the draft league queue." });
      return;
    }
    const savedDraftDeck = getSavedDraftDeck(account.stats || {}, requestedDraftType);
    if (!savedDraftDeck) {
      socket.emit("draftLeagueStatus", { inQueue: false, message: "Save a one-faction draft deck before entering the draft league queue." });
      return;
    }
    if ((savedDraftDeck.draftType || "player") !== requestedDraftType) {
      socket.emit("draftLeagueStatus", {
        inQueue: false,
        message: `Your saved deck is from a ${savedDraftDeck.draftType === "bot" ? "bot" : "player"} draft. Save a ${requestedDraftType} draft deck before entering this queue.`
      });
      return;
    }

    removeFromMatchmaking(socket.id);
    removeFromDraftLeague(socket.id);
    const profile = getDraftLeagueProfile(account);
    const entry = {
      socketId: socket.id,
      accountId: account.id,
      accountName: account.name,
      savedDraftDeck,
      draftType: requestedDraftType,
      bestOf: requestedBestOf,
      winRatio: profile.winRatio,
      gamesPlayed: profile.gamesPlayed,
      joinedAt: Date.now()
    };

    const match = findDraftLeagueMatchForEntry(entry);
    if (match) {
      removeFromDraftLeague(match.socketId);
      createDraftLeagueRoom(entry, match);
      return;
    }

    const queue = draftLeagueQueues[requestedDraftType] || draftLeagueQueues.player;
    queue.push(entry);
    socket.data.authToken = authToken || socket.data.authToken;
    socket.emit("draftLeagueStatus", {
      inQueue: true,
      message: `Searching for a ${requestedBestOf === 3 ? "best-of-3 " : ""}${requestedDraftType} draft league opponent... ${queue.length} player${queue.length === 1 ? "" : "s"} in this queue.`,
      queueSize: queue.length,
      draftType: requestedDraftType,
      bestOf: requestedBestOf
    });
  });

  socket.on("leaveDraftLeague", () => {
    removeFromDraftLeague(socket.id);
    socket.emit("draftLeagueStatus", { inQueue: false, message: "Left draft league queue." });
  });
  
  socket.on("createRoom", async ({ authToken, guestName } = {}) => {
    console.log("[Socket] createRoom");
    removeFromMatchmaking(socket.id);
    removeFromDraftLeague(socket.id);
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

  socket.on("createFriendChallenge", async ({ authToken, friendId } = {}, ack) => {
    console.log("[Socket] createFriendChallenge");
    removeFromMatchmaking(socket.id);
    removeFromDraftLeague(socket.id);
    if (getRoomForSocket(socket)) {
      if (typeof ack === "function") ack({ ok: false, error: "Leave your current room before challenging a friend." });
      return;
    }
    const identity = await requirePlayerIdentity(socket, authToken, "");
    if (!identity || identity.type !== "account") {
      if (typeof ack === "function") ack({ ok: false, error: "Sign in to challenge a friend." });
      return;
    }
    const friend = await getFriendAccountForChallenge(identity.id, String(friendId || ""));
    if (!friend) {
      if (typeof ack === "function") ack({ ok: false, error: "Friend not found." });
      return;
    }

    const roomState = createRoom();
    const lobbyPlayer = roomState.lobby.players[1];
    lobbyPlayer.socket = socket.id;
    lobbyPlayer.connected = true;
    lobbyPlayer.reconnectToken = makeReconnectToken();
    lobbyPlayer.accountId = identity.id;
    lobbyPlayer.accountName = identity.name;
    lobbyPlayer.isGuest = false;
    const createdAt = new Date();
    const challenge = {
      id: crypto.randomUUID(),
      fromId: identity.id,
      fromName: identity.name,
      toId: friend.id,
      toName: friend.name,
      roomCode: roomState.roomCode,
      mode: "factions",
      bestOf: 1,
      status: "pending",
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + FRIEND_CHALLENGE_TTL_MS).toISOString(),
      respondedAt: null
    };
    roomState.friendChallengeId = challenge.id;
    roomState.invitedAccountId = friend.id;
    roomState.friendChallengeExpiresAt = challenge.expiresAt;
    try {
      await touchAccountStats(identity.id, "gamesCreated");
      await persistFriendChallenge(challenge);
      attachPlayerSocket(roomState, socket, 1);
      emitLobbyState(roomState);
      if (typeof ack === "function") ack({ ok: true, roomCode: roomState.roomCode, challenge: publicFriendChallenge(challenge) });
    } catch (error) {
      rooms.delete(roomState.roomCode);
      if (typeof ack === "function") ack({ ok: false, error: error.message || "Could not create friend challenge." });
    }
  });

  socket.on("createFreeForAllRoom", async ({ authToken, guestName } = {}, ack) => {
    console.log("[Socket] createFreeForAllRoom");
    removeFromMatchmaking(socket.id);
    removeFromDraftLeague(socket.id);
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

  socket.on("createDraftRoom", async ({ authToken, guestName } = {}, ack) => {
    console.log("[Socket] createDraftRoom");
    removeFromMatchmaking(socket.id);
    removeFromDraftLeague(socket.id);
    const identity = await requirePlayerIdentity(socket, authToken, guestName);
    if (!identity) {
      if (typeof ack === "function") ack({ ok: false, error: "Sign in or enter a guest name first." });
      return;
    }
    const roomState = createDraftRoom();
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
    emitDraftState(roomState);
    if (typeof ack === "function") ack({ ok: true, roomCode: roomState.roomCode, gameMode: "draft" });
  });

  socket.on("createBotDraftRoom", async ({ authToken, guestName } = {}, ack) => {
    console.log("[Socket] createBotDraftRoom");
    removeFromMatchmaking(socket.id);
    removeFromDraftLeague(socket.id);
    const identity = await requirePlayerIdentity(socket, authToken, guestName);
    if (!identity) {
      if (typeof ack === "function") ack({ ok: false, error: "Sign in or enter a guest name first." });
      return;
    }
    const roomState = createDraftRoom({ botDraft: true });
    const lobbyPlayer = roomState.lobby.players[1];
    lobbyPlayer.socket = socket.id;
    lobbyPlayer.connected = true;
    lobbyPlayer.reconnectToken = makeReconnectToken();
    lobbyPlayer.accountId = identity.id;
    lobbyPlayer.accountName = identity.name;
    lobbyPlayer.isGuest = identity.type === "guest";
    await touchAccountStats(identity.id, "gamesCreated");
    attachPlayerSocket(roomState, socket, 1);
    startDraft(roomState);
    runBotDraftPicks(roomState);
    emitLobbyState(roomState);
    emitDraftState(roomState);
    if (typeof ack === "function") ack({ ok: true, roomCode: roomState.roomCode, gameMode: "draft", botDraft: true });
  });

  socket.on("createAiTutorialRoom", async ({ authToken, guestName, mode } = {}) => {
    console.log("[Socket] createAiTutorialRoom");
    removeFromMatchmaking(socket.id);
    removeFromDraftLeague(socket.id);
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
    removeFromDraftLeague(socket.id);
    const identity = await requirePlayerIdentity(socket, authToken, guestName);
    if (!identity) return;

    const faction = getFactionById(factionId);
    const chapter = getCampaignChapter(factionId, chapterId);
    if (!faction || !chapter) {
      socket.emit("errorMessage", "Choose a valid campaign chapter.");
      return;
    }
    const accountStats = identity.type === "account"
      ? (useSupabaseStore()
          ? (await findSupabaseAccountById(identity.id))?.stats || {}
          : (loadAccountStore().accounts.find((entry) => entry.id === identity.id)?.stats || {}))
      : {};
    if (!isCampaignChapterUnlocked(accountStats, factionId, chapterId)) {
      socket.emit("errorMessage", "Complete the previous chapter with this account to unlock that battle.");
      return;
    }

    const difficulty = getCampaignDifficulty(factionId, chapterId);
    const chapterIndex = Math.max(0, getCampaignChapterIndex(factionId, chapterId));
    const playerCampaignCards = getCampaignDeckAdditions(factionId, chapterIndex, "player");
    const bossCampaignCards = getCampaignDeckAdditions(factionId, chapterIndex, "boss");
    const bossAbility = getCampaignBossAbility(factionId, chapterIndex, chapter);
    const bossPowerProfile = getCampaignBossPowerProfile(faction, chapter, bossAbility);
    const roomState = createRoom();
    roomState.lobby.gameMode = "factions";
    roomState.lobby.campaign = {
      factionId,
      chapterId,
      title: chapter.title,
      story: chapter.story,
      beforeBattle: chapter.beforeBattle || chapter.story,
      afterBattle: chapter.afterBattle || "",
      opponentName: chapter.opponentName,
      playableName: chapter.playableName || faction.commander?.name || faction.name,
      dialogue: chapter.dialogue || [],
      startDialogue: chapter.dialogue || [],
      dialogueAudio: chapter.dialogueAudio || [],
      startDialogueAudio: chapter.dialogueAudio || [],
      endDialogue: buildCampaignEndDialogue(chapter, faction),
      endDialogueAudio: chapter.endDialogueAudio || [],
      playerCampaignCardCount: playerCampaignCards.length,
      bossCampaignCardCount: bossCampaignCards.length,
      bossAbility,
      bossPowerProfile,
      ...difficulty,
      bossAttacksThisTurn: 0
    };
    roomState.lobby.players[1].socket = socket.id;
    roomState.lobby.players[1].connected = true;
    roomState.lobby.players[1].reconnectToken = makeReconnectToken();
    roomState.lobby.players[1].accountId = identity.id;
    roomState.lobby.players[1].accountName = identity.name;
    roomState.lobby.players[1].factionId = factionId;
    roomState.lobby.players[1].isGuest = identity.type === "guest";
    const campaignConstructedDeck = getSavedConstructedDeck(accountStats);
    roomState.lobby.players[1].savedConstructedDeck = campaignConstructedDeck?.factionId === factionId ? campaignConstructedDeck : null;
    roomState.lobby.players[1].campaignDeckAdditions = playerCampaignCards;
    roomState.lobby.players[2].connected = true;
    roomState.lobby.players[2].accountId = null;
    roomState.lobby.players[2].accountName = chapter.opponentName;
    roomState.lobby.players[2].factionId = factionId;
    roomState.lobby.players[2].isGuest = false;
    roomState.lobby.players[2].isAI = true;
    roomState.lobby.players[2].campaignDeckAdditions = bossCampaignCards;
    await touchAccountStats(identity.id, "gamesCreated");
    attachPlayerSocket(roomState, socket, 1);

    createGameFromLobby(roomState);
    roomState.game.campaign = roomState.lobby.campaign;
    roomState.game.players[2].connected = true;
    roomState.game.players[2].accountName = chapter.opponentName;
    roomState.game.players[2].faction = {
      ...roomState.game.players[2].faction,
      commander: bossPowerProfile.commander,
      city: bossPowerProfile.city,
      general: bossPowerProfile.general
    };
    roomState.game.players[2].life = difficulty.bossLife;
    roomState.game.message = `${chapter.title}: ${chapter.beforeBattle || chapter.story} ${chapter.opponentName} starts at ${difficulty.bossLife} life and can launch ${difficulty.attacksPerTurn} scripted attacks per turn.${bossAbility ? ` Boss ability: ${bossAbility.text}` : ""} Player ${roomState.game.priority} has priority.`;
    emitState(roomState);
    scheduleTrainingAi(roomState);
  });

  socket.on("joinRoom", async ({ roomCode, asSpectator = false, authToken, guestName, reconnectToken } = {}) => {
    console.log(`[Socket] joinRoom: ${roomCode}, spectator: ${asSpectator}`);
    removeFromMatchmaking(socket.id);
    removeFromDraftLeague(socket.id);
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
      if (roomState.draft) {
        emitLobbyState(roomState);
        emitDraftState(roomState);
        return;
      }
      if (roomState.game) emitState(roomState, { incrementRevision: false });
      else emitLobbyState(roomState);
      return;
    }
    const identity = await requirePlayerIdentity(socket, authToken, guestName);
    if (!identity) return;
    const reconnectSeat = getDisconnectedSeatForIdentity(roomState, identity, reconnectToken);
    if (reconnectSeat) {
      attachPlayerSocket(roomState, socket, reconnectSeat);
      if (roomState.draft) {
        emitLobbyState(roomState);
        emitDraftState(roomState);
        if (roomState.draft.botDraft) runBotDraftPicks(roomState);
        return;
      }
      if (roomState.game) {
        emitState(roomState, { incrementRevision: false });
        scheduleTrainingAi(roomState);
      } else emitLobbyState(roomState);
      return;
    }
    if (roomState.invitedAccountId) {
      if (Date.parse(roomState.friendChallengeExpiresAt || 0) <= Date.now()) {
        socket.emit("errorMessage", "That friend challenge has expired.");
        return;
      }
      if (identity.type !== "account" || identity.id !== roomState.invitedAccountId) {
        socket.emit("errorMessage", "That player seat is reserved for the invited friend.");
        return;
      }
    }
    const openSeat = getLobbyPlayerNumbers(roomState).find((seat) => !roomState.lobby.players[seat].socket && !roomState.lobby.players[seat].reconnectToken);
    if (openSeat) {
      if (roomState.lobby.players[openSeat].isAI) {
        socket.emit("errorMessage", "That seat is reserved.");
        return;
      }
      roomState.lobby.players[openSeat].reconnectToken = makeReconnectToken();
      roomState.lobby.players[openSeat].accountId = identity.id;
      roomState.lobby.players[openSeat].accountName = identity.name;
      roomState.lobby.players[openSeat].isGuest = identity.type === "guest";
      await touchAccountStats(identity.id, "gamesJoined");
      attachPlayerSocket(roomState, socket, openSeat);
      if (identity.type === "account") await acceptFriendChallengeForRoom(roomState.roomCode, identity.id);
      roomState.invitedAccountId = null;
      emitLobbyState(roomState);
      if (roomState.draft) emitDraftState(roomState);
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
      if (roomState.draft) {
        emitLobbyState(roomState);
        emitDraftState(roomState);
        if (roomState.draft.botDraft) runBotDraftPicks(roomState);
        return;
      }
      if (roomState.game) {
        emitState(roomState, { incrementRevision: false });
        scheduleTrainingAi(roomState);
      } else emitLobbyState(roomState);
      return;
    }

    const requestedRole = role || socket.data.role;
    if (requestedRole === "spectator") {
      if (!roomState.lobby.spectators.includes(socket.id)) roomState.lobby.spectators.push(socket.id);
      socket.join(normalized);
      socket.data.roomCode = normalized;
      socket.data.role = "spectator";
      socket.emit("assignSpectator", { role: "spectator", roomCode: normalized });
      if (roomState.draft) {
        emitLobbyState(roomState);
        emitDraftState(roomState);
        return;
      }
      if (roomState.game) emitState(roomState, { incrementRevision: false });
      else emitLobbyState(roomState);
      return;
    }

    socket.emit("errorMessage", "Could not reconnect to that player seat.");
  });

  socket.on("requestRematch", (ack) => {
    const roomState = getRoomForSocket(socket);
    const playerNum = roomState ? getPlayerNumberBySocket(roomState, socket.id) : null;
    if (!roomState || !playerNum || !canOfferRematch(roomState)) {
      const message = "Rematch is available after a completed two-player duel.";
      socket.emit("errorMessage", message);
      acknowledgeMatchControl(ack, roomState, { accepted: false, code: "REMATCH_UNAVAILABLE", message });
      return;
    }
    if (!roomState.rematch) {
      roomState.rematch = { requestedBy: playerNum, requestedAt: new Date().toISOString() };
      const message = `${roomState.lobby.players[playerNum].accountName} requested a rematch.`;
      emitRematchStatus(roomState, message);
      acknowledgeMatchControl(ack, roomState, { message });
      return;
    }
    if (roomState.rematch.requestedBy === playerNum) {
      acknowledgeMatchControl(ack, roomState, { message: "Rematch already requested." });
      return;
    }
    acknowledgeMatchControl(ack, roomState, { message: "Rematch accepted." });
    resetRoomForRematch(roomState);
  });

  socket.on("declineRematch", (ack) => {
    const roomState = getRoomForSocket(socket);
    const playerNum = roomState ? getPlayerNumberBySocket(roomState, socket.id) : null;
    if (!roomState || !playerNum || !roomState.rematch || roomState.rematch.requestedBy === playerNum) {
      acknowledgeMatchControl(ack, roomState, {
        accepted: false,
        code: "REMATCH_RESPONSE_UNAVAILABLE",
        message: "There is no opponent rematch request to decline."
      });
      return;
    }
    const playerName = roomState.lobby.players[playerNum].accountName || `Player ${playerNum}`;
    roomState.rematch = null;
    const message = `${playerName} declined the rematch.`;
    emitRematchStatus(roomState, message);
    acknowledgeMatchControl(ack, roomState, { message });
  });

  socket.on("selectFaction", async ({ factionId }) => {
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
    await attachSavedConstructedDeckForLobbyPlayer(roomState, playerNum);
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

  socket.on("startDraft", () => {
    console.log("[Socket] startDraft");
    const roomState = getRoomForSocket(socket);
    if (!roomState?.draft || roomState.draft.status !== "lobby") return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (playerNum !== 1) {
      socket.emit("errorMessage", "Only Player 1 can start the draft.");
      return;
    }
    const seated = getConnectedDraftPlayers(roomState);
    if (seated.length < 2) {
      socket.emit("errorMessage", "Draft needs at least 2 connected players. It supports up to 8.");
      return;
    }
    startDraft(roomState);
    emitLobbyState(roomState);
    emitDraftState(roomState);
  });

  socket.on("draftPick", ({ cardCopyId } = {}) => {
    console.log("[Socket] draftPick");
    const roomState = getRoomForSocket(socket);
    if (!roomState?.draft || roomState.draft.status !== "drafting") return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum || !roomState.draft.activePlayers.includes(playerNum)) return;
    const key = String(playerNum);
    const currentPack = roomState.draft.currentPacks[key];
    if (!currentPack || currentPack.pickedThisPass) {
      socket.emit("errorMessage", "You have already picked from this pack.");
      return;
    }
    const cardIndex = currentPack.cards.findIndex((card) => card.draftCopyId === cardCopyId);
    if (cardIndex < 0) {
      socket.emit("errorMessage", "Choose a card from your current pack.");
      return;
    }
    const [card] = currentPack.cards.splice(cardIndex, 1);
    roomState.draft.draftedPools[key].push(card);
    currentPack.pickedThisPass = true;
    if (roomState.draft.botDraft) runBotDraftPicks(roomState);
    advanceDraftAfterPick(roomState);
    emitDraftState(roomState);
  });

  socket.on("setDraftDeckAdditions", ({ cardCopyIds, selections } = {}) => {
    console.log("[Socket] setDraftDeckAdditions");
    const roomState = getRoomForSocket(socket);
    if (!roomState?.draft || roomState.draft.status !== "building") return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const key = String(playerNum);
    const normalizedSelections = Array.isArray(selections)
      ? selections.map((selection) => ({
        cardCopyId: String(selection?.cardCopyId || ""),
        suit: normalizeDeckSuit(selection?.suit)
      })).filter((selection) => selection.cardCopyId)
      : [];
    const selectedIds = new Set(normalizedSelections.length > 0 ? normalizedSelections.map((selection) => selection.cardCopyId) : (Array.isArray(cardCopyIds) ? cardCopyIds.map(String) : []));
    const suitByCardCopyId = Object.fromEntries(normalizedSelections.map((selection) => [selection.cardCopyId, selection.suit]));
    const pool = roomState.draft.draftedPools[key] || [];
    const selectedCards = pool
      .filter((card) => selectedIds.has(card.draftCopyId))
      .map((card) => {
        const suit = suitByCardCopyId[card.draftCopyId] || normalizeReplacementSuit(card);
        return { ...card, suit, replacementSuit: suit };
      });
    try {
      validateReplacementCardSet(selectedCards);
    } catch (error) {
      socket.emit("errorMessage", error.message || "Draft decks must be one faction and keep four cards per value.");
      return;
    }
    roomState.draft.deckAdditions[key] = selectedCards;
    emitDraftState(roomState);
  });

  socket.on("saveDraftDeck", async () => {
    console.log("[Socket] saveDraftDeck");
    const roomState = getRoomForSocket(socket);
    if (!roomState?.draft || roomState.draft.status !== "building") return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const lobbyPlayer = roomState.lobby.players[playerNum];
    if (!lobbyPlayer.accountId || lobbyPlayer.isGuest) {
      socket.emit("errorMessage", "Sign in with an account to save a draft deck.");
      return;
    }
    const key = String(playerNum);
    const selectedCards = roomState.draft.deckAdditions[key] || [];
    if (selectedCards.length === 0) {
      socket.emit("errorMessage", "Choose at least one drafted card before saving.");
      return;
    }
    let validation;
    try {
      validation = validateReplacementCardSet(selectedCards);
    } catch (error) {
      socket.emit("errorMessage", error.message || "Save a one-faction deck with no more than four cards of any value.");
      return;
    }
    const factionIds = validation.factionIds;
    if (factionIds.length !== 1) {
      socket.emit("errorMessage", "Save a deck with cards from exactly one faction.");
      return;
    }
    const faction = getFactionById(factionIds[0]);
    const savedAccount = await saveAccountDraftDeck(lobbyPlayer.accountId, {
      name: `${faction?.name || factionIds[0]} Draft Deck`,
      factionId: factionIds[0],
      factionName: faction?.name || factionIds[0],
      draftType: roomState.draft.botDraft ? "bot" : "player",
      cards: selectedCards
    });
    if (!savedAccount) {
      socket.emit("errorMessage", "Could not save draft deck.");
      return;
    }
    socket.emit("accountUpdated", savedAccount);
    socket.emit("draftDeckSaved", {
      message: `Saved ${selectedCards.length} ${faction?.name || "draft"} swap${selectedCards.length === 1 ? "" : "s"} for ${roomState.draft.botDraft ? "Bot Draft" : "Player Draft"} League.`
    });
  });

  socket.on("startGame", async () => {
    console.log(`[Socket] startGame`);
    const roomState = getRoomForSocket(socket);
    if (!roomState || roomState.game) return;
    if (roomState.draft) {
      socket.emit("errorMessage", "Draft rooms use the draft controls instead of Start Game.");
      return;
    }
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
    await attachSavedConstructedDecksForLobby(roomState);
    createGameFromLobby(roomState);
    if (roomState.bestOf3Series) {
      roomState.game.bestOf3Series = clonePlain(roomState.bestOf3Series);
      roomState.game.message = `Best-of-3 match started. Player ${roomState.game.priority} has priority.`;
    }
    emitState(roomState);
    scheduleTrainingAi(roomState);
  });

  socket.on("duelCommand", async (envelope = {}, ack) => {
    const roomState = getRoomForSocket(socket);
    const playerNum = roomState ? getPlayerNumberBySocket(roomState, socket.id) : null;
    const result = await executeSemanticDuelCommand(roomState, playerNum, envelope);
    if (typeof ack === "function") ack(result);
  });

  socket.on("requestMatchState", ({ commandId = null } = {}, ack) => {
    const roomState = getRoomForSocket(socket);
    const playerNum = roomState ? getPlayerNumberBySocket(roomState, socket.id) : null;
    const spectator = roomState?.lobby?.spectators?.includes(socket.id);
    if (!roomState?.game || (!playerNum && !spectator)) {
      if (typeof ack === "function") {
        ack({ accepted: false, rejection: { code: "MATCH_UNAVAILABLE", message: "The match is not available." } });
      }
      return;
    }
    const snapshot = sanitizeGameForViewer(
      roomState.game,
      playerNum || null,
      roomState.lobby.spectators.length
    );
    socket.emit("state", snapshot);
    const cached = getCachedDuelCommand(roomState, commandId);
    if (typeof ack === "function") {
      ack({
        accepted: true,
        snapshot,
        commandResult: cached?.result || null,
        revision: Number(snapshot.revision || 0),
        snapshotSequence: Number(snapshot.snapshotSequence || 0)
      });
    }
  });

  socket.on("passPriority", async () => {
    console.log(`[Socket] passPriority`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;

    if (["basic", "factions"].includes(game.gameMode)) {
      const result = await executeSemanticDuelCommand(roomState, playerNum, {
        commandId: `${game.matchId}-legacy-pass-${crypto.randomUUID()}`,
        baseRevision: Number(game.revision || 0),
        commandSchemaVersion: DUEL_COMMAND_SCHEMA_VERSION,
        rulesVersion: game.rulesVersion || DUEL_RULES_VERSION,
        command: { type: "passPriority" }
      });
      if (!result.accepted) socket.emit("errorMessage", result.rejection?.message || "Unable to pass priority.");
      return;
    }
    
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

  socket.on("concedeGame", async (ack) => {
    console.log("[Socket] concedeGame");
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) {
      acknowledgeMatchControl(ack, roomState, { accepted: false, code: "MATCH_UNAVAILABLE", message: "The match is not available." });
      return;
    }
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) {
      acknowledgeMatchControl(ack, roomState, { accepted: false, code: "PLAYER_REQUIRED", message: "Spectators cannot concede a match." });
      return;
    }
    const game = roomState.game;

    if (game.phase === "gameOver") {
      const message = "Game is already over";
      socket.emit("errorMessage", message);
      acknowledgeMatchControl(ack, roomState, { accepted: false, code: "MATCH_COMPLETE", message });
      return;
    }

    if (["basic", "factions"].includes(game.gameMode)) {
      const result = await executeLegacySemanticDuelCommand(
        roomState,
        socket,
        playerNum,
        { type: "concede" },
        "concede"
      );
      if (typeof ack === "function") ack(result);
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
        await recordFinalGameStats(roomState, { completionReason: "concession" });
        io.to(roomState.roomCode).emit("gameEnded", { winner, tie: winner == null, concededBy: playerNum });
      } else {
        if (game.priority === playerNum) game.priority = activePlayers[0];
        game.message = `Player ${playerNum} conceded and is eliminated. ${activePlayers.length} players remain.`;
      }
      emitState(roomState);
      scheduleTrainingAi(roomState);
      acknowledgeMatchControl(ack, roomState, { message: "Concession accepted." });
      return;
    }

    const winner = getOtherPlayer(playerNum);
    game.phase = "gameOver";
    game.winner = winner;
    game.drawOfferBy = null;
    game.message = `Player ${playerNum} conceded. Player ${winner} wins!`;
    await recordFinalGameStats(roomState, { completionReason: "concession" });
    if (continueBestOf3Series(roomState)) {
      emitState(roomState);
      scheduleTrainingAi(roomState);
      acknowledgeMatchControl(ack, roomState, { message: "Concession accepted. The next series game is ready." });
      return;
    }
    io.to(roomState.roomCode).emit("gameEnded", { winner, tie: false, concededBy: playerNum });
    emitState(roomState);
    scheduleTrainingAi(roomState);
    acknowledgeMatchControl(ack, roomState, { message: "Concession accepted." });
  });

  socket.on("offerDraw", async (ack) => {
    console.log("[Socket] offerDraw");
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) {
      acknowledgeMatchControl(ack, roomState, { accepted: false, code: "MATCH_UNAVAILABLE", message: "The match is not available." });
      return;
    }
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) {
      acknowledgeMatchControl(ack, roomState, { accepted: false, code: "PLAYER_REQUIRED", message: "Spectators cannot offer a draw." });
      return;
    }
    const game = roomState.game;

    if (game.phase === "gameOver") {
      const message = "Game is already over";
      socket.emit("errorMessage", message);
      acknowledgeMatchControl(ack, roomState, { accepted: false, code: "MATCH_COMPLETE", message });
      return;
    }

    if (game.gameMode === "freeForAll") {
      const message = "Intentional draws are only available in two-player games.";
      socket.emit("errorMessage", message);
      acknowledgeMatchControl(ack, roomState, { accepted: false, code: "DRAW_UNAVAILABLE", message });
      return;
    }

    if (game.drawOfferBy && game.drawOfferBy !== playerNum) {
      game.phase = "gameOver";
      game.winner = null;
      game.drawOfferBy = null;
      game.message = "Players agreed to an intentional draw.";
      await recordFinalGameStats(roomState, { completionReason: "intentional_draw" });
      if (continueBestOf3Series(roomState)) {
        emitState(roomState);
        acknowledgeMatchControl(ack, roomState, { message: "Draw accepted. The next series game is ready." });
        return;
      }
      io.to(roomState.roomCode).emit("gameEnded", { winner: null, tie: true, intentionalDraw: true });
      emitState(roomState);
      acknowledgeMatchControl(ack, roomState, { message: "Draw accepted." });
      return;
    }

    if (game.drawOfferBy === playerNum) {
      const message = "You already offered an intentional draw";
      socket.emit("errorMessage", message);
      acknowledgeMatchControl(ack, roomState, { accepted: false, code: "DRAW_ALREADY_OFFERED", message });
      return;
    }

    game.drawOfferBy = playerNum;
    game.message = `Player ${playerNum} offered an intentional draw. Player ${getOtherPlayer(playerNum)} may accept.`;
    emitState(roomState);
    scheduleTrainingAi(roomState);
    acknowledgeMatchControl(ack, roomState, { message: "Draw offer sent." });
  });

  socket.on("respondDraw", async ({ accept } = {}, ack) => {
    console.log("[Socket] respondDraw");
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) {
      acknowledgeMatchControl(ack, roomState, { accepted: false, code: "MATCH_UNAVAILABLE", message: "The match is not available." });
      return;
    }
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) {
      acknowledgeMatchControl(ack, roomState, { accepted: false, code: "PLAYER_REQUIRED", message: "Spectators cannot answer a draw offer." });
      return;
    }
    const game = roomState.game;
    if (!game.drawOfferBy || game.drawOfferBy === playerNum) {
      const message = "There is no opponent draw offer to answer.";
      socket.emit("errorMessage", message);
      acknowledgeMatchControl(ack, roomState, { accepted: false, code: "DRAW_RESPONSE_UNAVAILABLE", message });
      return;
    }
    if (!accept) {
      const offerPlayer = game.drawOfferBy;
      game.drawOfferBy = null;
      game.message = `Player ${playerNum} declined Player ${offerPlayer}'s draw offer.`;
      emitState(roomState);
      acknowledgeMatchControl(ack, roomState, { message: "Draw offer declined." });
      return;
    }
    game.phase = "gameOver";
    game.winner = null;
    game.drawOfferBy = null;
    game.message = "Players agreed to an intentional draw.";
    await recordFinalGameStats(roomState, { completionReason: "intentional_draw" });
    io.to(roomState.roomCode).emit("gameEnded", {
      winner: null,
      tie: true,
      intentionalDraw: true
    });
    emitState(roomState);
    acknowledgeMatchControl(ack, roomState, { message: "Draw accepted." });
  });

  socket.on("requestUndo", (ack) => {
    console.log("[Socket] requestUndo");
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) {
      acknowledgeMatchControl(ack, roomState, { accepted: false, code: "MATCH_UNAVAILABLE", message: "The match is not available." });
      return;
    }
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) {
      acknowledgeMatchControl(ack, roomState, { accepted: false, code: "PLAYER_REQUIRED", message: "Spectators cannot request an undo." });
      return;
    }
    const snapshot = getUndoSnapshots(roomState)[playerNum];
    if (!snapshot || snapshot.requester !== playerNum) {
      const message = "No recent move available to undo.";
      socket.emit("errorMessage", message);
      acknowledgeMatchControl(ack, roomState, { accepted: false, code: "UNDO_UNAVAILABLE", message });
      return;
    }

    const approvalPlayers = getUndoApprovalPlayers(roomState, playerNum);
    if (approvalPlayers.length === 0) {
      if (restoreUndoSnapshot(roomState, playerNum)) emitState(roomState);
      scheduleTrainingAi(roomState);
      acknowledgeMatchControl(ack, roomState, { message: "Undo completed." });
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
    acknowledgeMatchControl(ack, roomState, { message: "Undo request sent." });
  });

  socket.on("respondUndo", ({ approve } = {}, ack) => {
    console.log("[Socket] respondUndo");
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game?.undoRequest) {
      acknowledgeMatchControl(ack, roomState, { accepted: false, code: "UNDO_RESPONSE_UNAVAILABLE", message: "There is no undo request to answer." });
      return;
    }
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) {
      acknowledgeMatchControl(ack, roomState, { accepted: false, code: "PLAYER_REQUIRED", message: "Spectators cannot answer an undo request." });
      return;
    }
    const request = roomState.game.undoRequest;
    if (!request.approvalsNeeded?.includes(playerNum)) {
      const message = "You are not the player who can approve this undo.";
      socket.emit("errorMessage", message);
      acknowledgeMatchControl(ack, roomState, { accepted: false, code: "UNDO_RESPONSE_FORBIDDEN", message });
      return;
    }

    if (!approve) {
      roomState.game.message = `Player ${playerNum} declined Player ${request.requester}'s undo request.`;
      roomState.game.undoRequest = null;
      emitState(roomState);
      acknowledgeMatchControl(ack, roomState, { message: "Undo request declined." });
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
    acknowledgeMatchControl(ack, roomState, { message: allApproved ? "Undo completed." : "Undo approved." });
  });

  socket.on("confirmAttack", async (payload = {}) => {
    const { from, lane, attackCardIndex, paymentIndexes, useHeraBonus, targetPlayer } = payload;
    console.log(`[Socket] confirmAttack: from=${from}, lane=${lane}, idx=${attackCardIndex}, payments=${paymentIndexes}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];

    if (["basic", "factions"].includes(game.gameMode)) {
      const laneIndex = Number(lane);
      const selectedAttackIndex = Number(attackCardIndex);
      const targetPlayerId = Number(targetPlayer) || getOtherPlayer(playerNum);
      const command = from === "lane"
        ? {
            type: "declareLaneAttack",
            laneIndex,
            paymentCardIds: legacyHandCardIds(player, paymentIndexes),
            targetPlayerId,
            useHeraBonus: !!useHeraBonus,
            ...copyLegacySemanticChoices(payload)
          }
        : {
            type: "declareHandAttack",
            cardId: player.hand[selectedAttackIndex]?.id || `invalid-attacker-index-${attackCardIndex}`,
            paymentCardIds: legacyHandCardIds(player, paymentIndexes),
            targetPlayerId,
            useHeraBonus: !!useHeraBonus,
            ...copyLegacySemanticChoices(payload)
          };
      await executeLegacySemanticDuelCommand(roomState, socket, playerNum, command, "attack");
      return;
    }
    
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
    const payment = getPaymentTotal(player, paymentValidation.indexes, useHeraBonus, { game, playerNum, action: "attack", card: attackCard });
    const required = attackPayment.required;
    const paymentCards = getHandCardsByIndexes(player, paymentValidation.indexes);
    
    if (payment.total < required) {
      socket.emit("errorMessage", `Need ${required} payment, have ${payment.total}`);
      return;
    }
    consumePaymentBonuses(player, payment);

    saveUndoSnapshot(roomState, playerNum, from === "lane" ? `attacked from lane ${laneIndex + 1}` : "attacked from hand");

    if (from === "hand") {
      removeSelectedCardAndPayments(player, selectedAttackIndex, paymentValidation.indexes);
    } else {
      removeIndexesFromHandToDiscard(player, paymentValidation.indexes);
      game.lanes[laneIndex].facedown[playerNum] = null;
    }
    if (payment.heraUsedNow) player.turnData.heraUsed = true;
    addPaymentSuits(player, paymentCards);
    const attackBonus = calculateAttackBonuses(game, playerNum, attackCard, from);
    attackBonus.notes.push(...(payment.notes || []));
    addAccelerationIfOverpaid(game, playerNum, payment.total, required, attackCard, attackBonus.notes);
    applyOverpayCardRewards(game, playerNum, payment.total, required, attackCard, attackBonus.notes);
    const attackInfo = finalizeAttackDeclaration(player, attackCard, attackBonus, attackPayment.freeAttackUsed);
    
    const attackId = `attack-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const attack = {
      id: attackId,
      player: playerNum,
      card: attackCard,
      source: from,
      effectiveValue: attackInfo.effectiveValue,
      block: [],
      targetPlayer: defender,
      notes: attackInfo.notes,
      attachedCards: attackBonus.armedCards || []
    };
    attack.payment = {
      player: playerNum,
      cards: paymentCards,
      total: payment.total,
      required,
      heraUsed: payment.heraUsedNow
    };
    applyAfterAttackDeclared(game, playerNum, attack, attack.payment);
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

  socket.on("confirmBlock", async (payload = {}) => {
    const { lane, handAttackId, blockCardIndex, blockCardIndexes, paymentIndexes, useHeraBonus } = payload;
    console.log(`[Socket] confirmBlock: lane=${lane}, attackId=${handAttackId}, blockIdx=${blockCardIndex}, payments=${paymentIndexes}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];

    if (["basic", "factions"].includes(game.gameMode)) {
      const laneIndex = lane === undefined || lane === null ? null : Number(lane);
      const laneAttack = Number.isInteger(laneIndex) ? game.lanes?.[laneIndex]?.attack : null;
      const pendingAttackId = laneAttack?.id || handAttackId || null;
      const selectedBlockIndexes = Array.isArray(blockCardIndexes)
        ? blockCardIndexes
        : blockCardIndex === undefined || blockCardIndex === null
          ? []
          : [blockCardIndex];
      const explicitlyDeclined = Number(blockCardIndex) === -1
        && selectedBlockIndexes.filter((index) => Number(index) >= 0).length === 0;
      let command;
      if (explicitlyDeclined) {
        command = { type: "declineBlock", attackId: pendingAttackId };
      } else if (Number.isInteger(laneIndex)) {
        command = {
          type: "declareLaneBlock",
          laneIndex,
          paymentCardIds: legacyHandCardIds(player, paymentIndexes),
          useHeraBonus: !!useHeraBonus,
          ...copyLegacySemanticChoices(payload)
        };
      } else if (selectedBlockIndexes.length === 0) {
        command = { type: "declineBlock", attackId: pendingAttackId };
      } else {
        command = {
          type: "declareHandBlock",
          attackId: pendingAttackId,
          blockerCardIds: legacyHandCardIds(player, selectedBlockIndexes, "blocker"),
          paymentCardIds: legacyHandCardIds(player, paymentIndexes),
          useHeraBonus: !!useHeraBonus,
          ...copyLegacySemanticChoices(payload)
        };
      }
      await executeLegacySemanticDuelCommand(roomState, socket, playerNum, command, "block");
      return;
    }
    
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
    const payment = getPaymentTotal(player, paymentValidation.indexes, useHeraBonus, { game, playerNum, action: "block", card: blockCards[0], blockCards });
    const paymentCards = getHandCardsByIndexes(player, paymentValidation.indexes);
    
    console.log(`[Socket] Block payment check: need ${blockCardValue}, have ${payment.total}`);
    
    if (payment.total < blockCardValue) {
      socket.emit("errorMessage", `Need ${blockCardValue} payment to block, have ${payment.total}`);
      return;
    }
    consumePaymentBonuses(player, payment);
    
    saveUndoSnapshot(roomState, playerNum, isLaneBlock ? `blocked lane ${laneIndex + 1}` : "blocked from hand");

    const blockEntries = blockCards.map((blockCard) => {
      const blockInfo = applyBlockBonuses(game, playerNum, blockCard, { attack, isLaneBlock });
      let preventDamage = 0;
      if (cardIs(blockCard, "rumin-vault-shield-bearer") && payment.total - blockCardValue >= 1) {
        preventDamage += 1;
        blockInfo.notes.push("Vault Shield Bearer prevents 1");
      }
      if (cardIs(blockCard, "sheen-beli-canopy-shield") && !player.turnData.beliCanopyShieldUsed) {
        preventDamage += 1;
        player.turnData.beliCanopyShieldUsed = true;
        blockInfo.notes.push("Beli Canopy Shield prevents 1");
      }
      return {
        player: playerNum,
        card: blockCard,
        source: isLaneBlock ? "lane" : "hand",
        effectiveValue: blockInfo.effectiveValue,
        preventDamage,
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
    applyBlockPaymentCardEffects(game, playerNum, blockEntries, paymentCards);

    // Process block only after the blocker values have been captured.
    if (isLaneBlock) {
      removeIndexesFromHandToDiscard(player, paymentValidation.indexes);
      laneState.facedown[playerNum] = null;
    } else {
      removeSelectedCardsAndPayments(player, selectedBlockIndexes, paymentValidation.indexes);
    }
    if (payment.heraUsedNow) player.turnData.heraUsed = true;
    addPaymentSuits(player, paymentCards);
    blockEntries.forEach((entry) => entry.notes.push(...(payment.notes || [])));
    addAccelerationIfOverpaid(game, playerNum, payment.total, blockCardValue, blockCards[0], blockEntries[0]?.notes || []);
    applyOverpayCardRewards(game, playerNum, payment.total, blockCardValue, blockCards[0], blockEntries[0]?.notes || []);
    finalizeBlockDeclaration(game, playerNum, blockEntries);
    
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

  socket.on("usePolea", async (payload = {}) => {
    const { mode, handIndex, lane, laneA, laneB, targetPlayer, targetType, handAttackId } = payload;
    console.log(`[Socket] usePolea: mode=${mode}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];

    if (game.gameMode === "factions") {
      const selectedMode = Number(mode);
      const laneIndex = Number(lane);
      const abilityId = {
        1: "polea-place",
        2: "polea-swap",
        3: "polea-peek",
        4: "polea-buff"
      }[selectedMode] || "polea-invalid";
      const cardId = player.hand?.[Number(handIndex)]?.id || null;
      const command = {
        type: "useFactionAbility",
        abilityId,
        cardId,
        laneIndex,
        laneA: Number(laneA),
        laneB: Number(laneB),
        targetPlayerId: Number(targetPlayer),
        targetType: targetType || "laneCard",
        attackId: handAttackId || null,
        targets: {
          cardId,
          laneIndex,
          laneA: Number(laneA),
          laneB: Number(laneB),
          targetPlayerId: Number(targetPlayer),
          targetType: targetType || "laneCard",
          attackId: handAttackId || null
        },
        ...copyLegacySemanticChoices(payload)
      };
      await executeLegacySemanticDuelCommand(roomState, socket, playerNum, command, "polea");
      return;
    }

    if (!canUsePriorityAbility(socket, game, playerNum, "frumo")) return;
    if (player.turnData.poleaUsed) {
      const canUseSunkenOrder = playerControlsCard(game, playerNum, "frumo-poleas-sunken-order") && !player.turnData.poleaSunkenOrderUsed;
      if (canUseSunkenOrder) {
        player.turnData.poleaSunkenOrderUsed = true;
      } else {
      socket.emit("errorMessage", "Polea already used this turn");
      return;
      }
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
      applyLaneEntryTriggers(game, playerNum, card, laneIndex, socket);
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
      player.turnData.frumoLaneSwappedThisTurn = true;
      if (playerControlsCard(game, playerNum, "frumo-tide-debt-ledger")) {
        player.turnData.frumoNextPaymentBonus = (player.turnData.frumoNextPaymentBonus || 0) + 1;
      }
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
      if (playerControlsCard(game, playerNum, "frumo-the-last-gamble")) {
        player.turnData.frumoNextActionBonus = (player.turnData.frumoNextActionBonus || 0) + 4;
      }
      for (const visibleCard of getPlayerSupportCards(game, playerNum)) {
        if (cardIs(visibleCard, "frumo-riptide-smuggler") && !player.turnData.frumoRiptideSmugglerUsed) {
          visibleCard.tempBuff = (visibleCard.tempBuff || 0) + 1;
          player.turnData.frumoRiptideSmugglerUsed = true;
        }
      }
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

  socket.on("useLafayette", async (payload = {}) => {
    const { lane, handIndex } = payload;
    console.log(`[Socket] useLafayette: lane=${lane}, handIndex=${handIndex}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];

    if (game.gameMode === "factions") {
      const laneIndex = Number(lane);
      const cardId = player.hand?.[Number(handIndex)]?.id || null;
      await executeLegacySemanticDuelCommand(roomState, socket, playerNum, {
        type: "useFactionAbility",
        abilityId: "lafayette-swap",
        cardId,
        laneIndex,
        targets: { cardId, laneIndex },
        ...copyLegacySemanticChoices(payload)
      }, "lafayette");
      return;
    }

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
    player.turnData.frumoLaneSwappedThisTurn = true;
    if (playerControlsCard(game, playerNum, "frumo-lafayettes-chart")) {
      player.turnData.frumoNextPaymentBonus = (player.turnData.frumoNextPaymentBonus || 0) + 1;
    }
    if (playerControlsCard(game, playerNum, "frumo-tide-debt-ledger")) {
      player.turnData.frumoNextPaymentBonus = (player.turnData.frumoNextPaymentBonus || 0) + 1;
    }
    applyLaneEntryTriggers(game, playerNum, handCard, laneIndex, socket);
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

  socket.on("useFocusBuff", async (payload = {}) => {
    const { targetType, lane, handAttackId } = payload;
    console.log(`[Socket] useFocusBuff: targetType=${targetType}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];

    if (game.gameMode === "factions") {
      const laneIndex = Number(lane);
      await executeLegacySemanticDuelCommand(roomState, socket, playerNum, {
        type: "useFactionAbility",
        abilityId: "focus-buff",
        laneIndex,
        targetType: targetType || "laneCard",
        attackId: handAttackId || null,
        targets: {
          laneIndex,
          targetType: targetType || "laneCard",
          attackId: handAttackId || null
        },
        ...copyLegacySemanticChoices(payload)
      }, "focus");
      return;
    }

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
    const focusBonus = playerControlsCard(game, playerNum, "bizi-focus-overclock") ? 3 : 1;
    target.tempBuff = (target.tempBuff || 0) + focusBonus;
    resetPriorityPassed(game);
    recordPaymentLog(game, {
      type: "ability",
      player: playerNum,
      cards: [target],
      total: 1,
      required: 1,
      label: `Player ${playerNum} spent 1 acceleration counter with Focus to give ${target.name || "a card"} +${focusBonus}.`
    });
    game.message = `Player ${playerNum} removed an acceleration counter to give ${describeCardValue(target, getCardCurrentValue(target), [`Focus +${focusBonus}`])} this turn.`;
    emitState(roomState);
  });

  socket.on("placeFacedown", async (payload = {}) => {
    const { lane, handIndex } = payload;
    console.log(`[Socket] placeFacedown: lane ${lane}, handIndex ${handIndex}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];

    if (["basic", "factions"].includes(game.gameMode)) {
      const laneIndex = Number(lane);
      await executeLegacySemanticDuelCommand(roomState, socket, playerNum, {
        type: "placeFacedown",
        laneIndex,
        cardId: player.hand?.[Number(handIndex)]?.id || `invalid-placement-index-${handIndex}`,
        ...copyLegacySemanticChoices(payload)
      }, "placement");
      return;
    }
    
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
    game.endPlaced[playerNum][lane] = true;
    game.message = `Player ${playerNum} placed a card in lane ${lane + 1}`;
    applyLaneEntryTriggers(game, playerNum, card, lane, socket);
    
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

    if (["basic", "factions"].includes(game.gameMode)) {
      await executeLegacySemanticDuelCommand(roomState, socket, playerNum, {
        type: "skipPlacement",
        laneIndex: Number(lane)
      }, "skip-placement");
      return;
    }
    
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
    removeFromDraftLeague(socket.id);
    const roomState = getRoomForSocket(socket);
    if (!roomState) return;
    detachSocketFromRoom(roomState, socket);
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    removeFromMatchmaking(socket.id);
    removeFromDraftLeague(socket.id);
    const roomState = getRoomForSocket(socket);
    if (roomState) {
      detachSocketFromRoom(roomState, socket, { leaveSocket: false });
    }
  });
});

let shutdownStarted = false;

async function shutdownServer(signal = "shutdown") {
  if (shutdownStarted) return;
  shutdownStarted = true;
  console.log(`[Server] ${signal} received; preserving active rooms.`);
  stopRoomLifecycleSweep();
  server.close();
  try {
    const result = persistActiveRoomsForShutdown();
    console.log(`[Server] Preserved ${result.saved} active room${result.saved === 1 ? "" : "s"}.`);
  } catch (error) {
    console.error("[Server] Failed to preserve active rooms", error);
  }
  io.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

if (require.main === module) {
  const recovery = initializeRoomRecovery();
  server.listen(PORT, () => {
    startRoomLifecycleSweep();
    if (recovery.enabled) console.log(`[Rooms] Restored ${recovery.restored} active room${recovery.restored === 1 ? "" : "s"}.`);
    console.log(`Server running on port ${PORT}`);
  });
  process.once("SIGTERM", () => shutdownServer("SIGTERM"));
  process.once("SIGINT", () => shutdownServer("SIGINT"));
}

module.exports = {
  app,
  server,
  __test: {
    applyBlockBonuses,
    applyGameOverState,
    applyDeckResult,
    addFriendChallenge,
    applyProgressionForResult,
    buildPublicPlayerProfile,
    buildAccountResultContext,
    listSpectatableSeasonMatches,
    calculateAttackBonuses,
    canOfferRematch,
    abandonActiveRoom,
    createFreeForAllGameFromLobby,
    createGameFromLobby,
    createMatchedRoom,
    createDraftLeagueRoom,
    continueBestOf3Series,
    createRoom,
    createTurnData,
    chooseSemanticTrainingAiCommand,
    applySemanticAutomatedCommand,
    executeSemanticDuelCommand,
    getCampaignDeckAdditions,
    getCampaignBossAbility,
    getCampaignDifficulty,
    getBaseCardValue,
    getPaymentTotal,
    buildCompletionEnvelope,
    buildCompetitiveCapabilitySnapshot,
    buildCollectorVariantProvenance,
    finalizeCompletedMatch,
    issueAccountSession,
    initializeRoomRecovery,
    getSavedConstructedDeck,
    getSavedDraftDeck,
    normalizeDeckLibrary,
    normalizeCollection,
    normalizeFriendChallenges,
    persistActiveRoomsForShutdown,
    persistRoomsNow,
    signAuthPayload,
    saveConstructedDeckToLibrary,
    saveDraftDeckToLibrary,
    setFriendChallengeStatus,
    updateDeckLibraryRecord,
    recordAccountGameResult,
    recordFinalGameStats,
    resolveDamage,
    sanitizeGameForViewer,
    sweepRoomLifecycle,
    deleteRoom,
    rooms,
    startEndPhase,
    advanceEndPlacement,
    validateAuthConfiguration,
    validateConstructedDeckPayload,
    grantPurchasedCollectorPack,
    normalizeCollectorRedemptionReceipts,
    persistCollectorEntitlementRedemption,
    redeemCollectorEntitlementStats,
    resetCollectorEntitlementRuntimeState: () => collectorRedemptionQueues.clear(),
    openCollectionBooster,
    resolveCollectorVariantSelections,
    verifyAuthToken,
    validateHandIndexes
  }
};
