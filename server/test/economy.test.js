const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyDailyQuestProgress,
  buyGameplayPackCredit,
  grantTimetwisters,
  normalizeEconomy
} = require("../economy");

test("daily quests award gold once and reset on a new UTC day", () => {
  const stats = {};
  const first = applyDailyQuestProgress(stats, "win", { factionId: "rumin", completedAt: "2026-10-07T12:00:00.000Z" });
  assert.deepEqual(first.map((quest) => quest.id), ["win-one", "faction-one"]);
  assert.equal(stats.economy.gold, 1000);
  const second = applyDailyQuestProgress(stats, "loss", { factionId: "basic", completedAt: "2026-10-07T12:30:00.000Z" });
  assert.deepEqual(second.map((quest) => quest.id), ["play-two"]);
  assert.equal(stats.economy.gold, 1250);
  applyDailyQuestProgress(stats, "win", { factionId: "rumin", completedAt: "2026-10-07T13:00:00.000Z" });
  assert.equal(stats.economy.gold, 1250);
  assert.equal(normalizeEconomy(stats, { now: "2026-10-08T00:00:00.000Z" }).daily.quests.every((quest) => quest.progress === 0), true);
});

test("gameplay pack credits can be bought with either currency", () => {
  const stats = { economy: { gold: 1200, timetwisters: 250 } };
  buyGameplayPackCredit(stats, "gold", { now: "2026-10-07T12:00:00.000Z" });
  assert.equal(stats.economy.gold, 200);
  buyGameplayPackCredit(stats, "timetwisters", { now: "2026-10-07T12:00:00.000Z" });
  assert.equal(stats.economy.timetwisters, 50);
  assert.throws(() => buyGameplayPackCredit(stats, "gold"), /need 1,000 gold/i);
});

test("Timetwister purchase fulfillment is idempotent", () => {
  const stats = {};
  const first = grantTimetwisters(stats, "timetwisters-750", "payment-1", { now: "2026-10-07T12:00:00.000Z" });
  const repeated = grantTimetwisters(stats, "timetwisters-750", "payment-1", { now: "2026-10-07T12:01:00.000Z" });
  assert.equal(first.alreadyGranted, false);
  assert.equal(repeated.alreadyGranted, true);
  assert.equal(stats.economy.timetwisters, 750);
});
