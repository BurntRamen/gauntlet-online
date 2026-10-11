const DAILY_QUEST_DEFINITIONS = Object.freeze([
  { id: "play-two", name: "Take the Field", description: "Complete 2 games.", metric: "games", target: 2, gold: 250 },
  { id: "win-one", name: "Claim Victory", description: "Win a game.", metric: "wins", target: 1, gold: 500 },
  { id: "faction-one", name: "Represent Your Faction", description: "Complete a game with a faction deck.", metric: "factionGames", target: 1, gold: 500 }
]);

const TIMETWISTER_PRODUCTS = Object.freeze([
  { id: "timetwisters-750", name: "750 Timetwisters", amount: 750, priceUsd: 4.99 },
  { id: "timetwisters-1600", name: "1,600 Timetwisters", amount: 1600, priceUsd: 9.99 },
  { id: "timetwisters-3400", name: "3,400 Timetwisters", amount: 3400, priceUsd: 19.99 }
]);

const GAMEPLAY_PACK_PRICES = Object.freeze({ gold: 1000, timetwisters: 200 });

function dayKey(value = new Date()) {
  const parsed = value instanceof Date ? value : new Date(value);
  const safe = Number.isFinite(parsed.getTime()) ? parsed : new Date();
  return safe.toISOString().slice(0, 10);
}

function freshDailyQuests(date) {
  return DAILY_QUEST_DEFINITIONS.map((quest) => ({
    ...quest,
    progress: 0,
    completedAt: null,
    rewardClaimedAt: null
  }));
}

function normalizeEconomy(stats = {}, options = {}) {
  const source = stats.economy && typeof stats.economy === "object" ? stats.economy : {};
  const today = dayKey(options.now);
  const sourceDaily = source.daily && source.daily.date === today ? source.daily : null;
  const storedQuests = new Map((sourceDaily?.quests || []).map((quest) => [quest.id, quest]));
  const quests = freshDailyQuests(today).map((definition) => {
    const stored = storedQuests.get(definition.id) || {};
    return {
      ...definition,
      progress: Math.min(definition.target, Math.max(0, Math.floor(Number(stored.progress || 0)))),
      completedAt: stored.completedAt || null,
      rewardClaimedAt: stored.rewardClaimedAt || null
    };
  });
  return {
    schemaVersion: 1,
    gold: Math.max(0, Math.floor(Number(source.gold || 0))),
    timetwisters: Math.max(0, Math.floor(Number(source.timetwisters || 0))),
    daily: { date: today, quests },
    purchaseReceipts: source.purchaseReceipts && typeof source.purchaseReceipts === "object" ? { ...source.purchaseReceipts } : {},
    totals: {
      goldEarned: Math.max(0, Math.floor(Number(source.totals?.goldEarned || 0))),
      goldSpent: Math.max(0, Math.floor(Number(source.totals?.goldSpent || 0))),
      timetwistersPurchased: Math.max(0, Math.floor(Number(source.totals?.timetwistersPurchased || 0))),
      timetwistersSpent: Math.max(0, Math.floor(Number(source.totals?.timetwistersSpent || 0)))
    }
  };
}

function applyDailyQuestProgress(stats = {}, result, context = {}) {
  const economy = normalizeEconomy(stats, { now: context.completedAt });
  const increments = {
    games: 1,
    wins: result === "win" ? 1 : 0,
    factionGames: context.factionId && context.factionId !== "basic" ? 1 : 0
  };
  const completed = [];
  for (const quest of economy.daily.quests) {
    quest.progress = Math.min(quest.target, quest.progress + (increments[quest.metric] || 0));
    if (quest.progress >= quest.target && !quest.rewardClaimedAt) {
      const completedAt = context.completedAt || new Date().toISOString();
      quest.completedAt = quest.completedAt || completedAt;
      quest.rewardClaimedAt = completedAt;
      economy.gold += quest.gold;
      economy.totals.goldEarned += quest.gold;
      completed.push({ id: quest.id, name: quest.name, gold: quest.gold });
    }
  }
  stats.economy = economy;
  return completed;
}

function buyGameplayPackCredit(stats = {}, currency, options = {}) {
  if (!Object.hasOwn(GAMEPLAY_PACK_PRICES, currency)) throw new Error("Choose gold or Timetwisters.");
  const economy = normalizeEconomy(stats, options);
  const price = GAMEPLAY_PACK_PRICES[currency];
  if (economy[currency] < price) throw new Error(`You need ${price.toLocaleString()} ${currency === "gold" ? "gold" : "Timetwisters"}.`);
  economy[currency] -= price;
  if (currency === "gold") economy.totals.goldSpent += price;
  else economy.totals.timetwistersSpent += price;
  stats.economy = economy;
  return { currency, price, economy };
}

function resolveTimetwisterProduct(productId) {
  return TIMETWISTER_PRODUCTS.find((product) => product.id === productId) || null;
}

function grantTimetwisters(stats = {}, productId, transactionId, options = {}) {
  const product = resolveTimetwisterProduct(productId);
  if (!product) throw new Error("Unknown Timetwister bundle.");
  const receiptId = String(transactionId || "").trim();
  if (!receiptId) throw new Error("A payment transaction ID is required.");
  const economy = normalizeEconomy(stats, options);
  if (economy.purchaseReceipts[receiptId]) return { alreadyGranted: true, product, economy };
  const grantedAt = options.now || new Date().toISOString();
  economy.timetwisters += product.amount;
  economy.totals.timetwistersPurchased += product.amount;
  economy.purchaseReceipts[receiptId] = { transactionId: receiptId, productId: product.id, amount: product.amount, grantedAt };
  stats.economy = economy;
  return { alreadyGranted: false, product, economy };
}

module.exports = {
  DAILY_QUEST_DEFINITIONS,
  GAMEPLAY_PACK_PRICES,
  TIMETWISTER_PRODUCTS,
  applyDailyQuestProgress,
  buyGameplayPackCredit,
  dayKey,
  grantTimetwisters,
  normalizeEconomy,
  resolveTimetwisterProduct
};
