const WEEKLY_ACTIVITY_TIERS = Object.freeze([
  Object.freeze({ id: "three-games", games: 3, packs: 1, label: "3 games" }),
  Object.freeze({ id: "seven-games", games: 7, packs: 1, label: "7 games" }),
  Object.freeze({ id: "twelve-games", games: 12, packs: 2, label: "12 games" })
]);

function isoWeekId(value = new Date()) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) return isoWeekId(new Date());
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function normalizeWeeklyActivity(value = {}) {
  const claimedTierIds = Array.isArray(value?.claimedTierIds)
    ? [...new Set(value.claimedTierIds.map(String).filter((id) => WEEKLY_ACTIVITY_TIERS.some((tier) => tier.id === id)))]
    : [];
  return {
    weekId: typeof value?.weekId === "string" ? value.weekId : null,
    gamesPlayed: Math.max(0, Math.floor(Number(value?.gamesPlayed || 0))),
    bonusPackCredits: Math.max(0, Math.floor(Number(value?.bonusPackCredits || 0))),
    claimedTierIds,
    updatedAt: value?.updatedAt || null
  };
}

function advanceWeeklyActivity(value, completedAt = new Date().toISOString()) {
  const weekId = isoWeekId(completedAt);
  const stored = normalizeWeeklyActivity(value);
  const activity = stored.weekId === weekId
    ? stored
    : { weekId, gamesPlayed: 0, bonusPackCredits: 0, claimedTierIds: [], updatedAt: null };
  activity.gamesPlayed += 1;
  const newlyClaimedTiers = WEEKLY_ACTIVITY_TIERS.filter((tier) => (
    activity.gamesPlayed >= tier.games && !activity.claimedTierIds.includes(tier.id)
  ));
  const bonusPackCredits = newlyClaimedTiers.reduce((total, tier) => total + tier.packs, 0);
  activity.claimedTierIds.push(...newlyClaimedTiers.map((tier) => tier.id));
  activity.bonusPackCredits += bonusPackCredits;
  activity.updatedAt = completedAt;
  return {
    activity,
    bonusPackCredits,
    newlyClaimedTiers,
    nextTier: WEEKLY_ACTIVITY_TIERS.find((tier) => !activity.claimedTierIds.includes(tier.id)) || null
  };
}

module.exports = {
  WEEKLY_ACTIVITY_TIERS,
  advanceWeeklyActivity,
  isoWeekId,
  normalizeWeeklyActivity
};
