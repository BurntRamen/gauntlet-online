const test = require("node:test");
const assert = require("node:assert/strict");

const {
  WEEKLY_ACTIVITY_TIERS,
  advanceWeeklyActivity,
  isoWeekId
} = require("../activityPackRewards");

test("uses a stable Monday UTC activity week", () => {
  assert.equal(isoWeekId("2026-11-16T00:00:00.000Z"), "2026-11-16");
  assert.equal(isoWeekId("2026-11-22T23:59:59.999Z"), "2026-11-16");
  assert.equal(isoWeekId("2026-11-23T00:00:00.000Z"), "2026-11-23");
});

test("awards weekly pack bonuses once at 3, 7, and 12 completed games", () => {
  let activity = null;
  const bonuses = [];
  for (let game = 1; game <= 12; game += 1) {
    const result = advanceWeeklyActivity(activity, `2026-11-${String(16 + Math.floor((game - 1) / 4)).padStart(2, "0")}T12:00:00.000Z`);
    activity = result.activity;
    bonuses.push(result.bonusPackCredits);
  }
  assert.deepEqual(bonuses, [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 2]);
  assert.equal(activity.gamesPlayed, 12);
  assert.equal(activity.bonusPackCredits, 4);
  assert.deepEqual(activity.claimedTierIds, WEEKLY_ACTIVITY_TIERS.map((tier) => tier.id));
});

test("starts a fresh activity track in a new week", () => {
  const first = advanceWeeklyActivity(null, "2026-11-22T23:00:00.000Z");
  const next = advanceWeeklyActivity(first.activity, "2026-11-23T01:00:00.000Z");
  assert.equal(first.activity.weekId, "2026-11-16");
  assert.equal(next.activity.weekId, "2026-11-23");
  assert.equal(next.activity.gamesPlayed, 1);
  assert.equal(next.activity.bonusPackCredits, 0);
  assert.deepEqual(next.activity.claimedTierIds, []);
});
