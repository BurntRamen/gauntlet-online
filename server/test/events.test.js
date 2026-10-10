const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyEventResult,
  createEventDefinitions,
  eventAvailability,
  eventById,
  listEventDefinitions,
  normalizeEventProgress,
  resignEventRun,
  startEventRun
} = require("../events");

test("events are free now and can be priced later", () => {
  assert.ok(createEventDefinitions({ entryCredits: 0 }).every((event) => event.entryCost.amount === 0));
  assert.ok(createEventDefinitions({ entryCredits: 2 }).every((event) => event.entryCost.amount === 2));
});

test("major events publish their calendar and enforce entry windows", () => {
  const event = eventById("fall-grand-gauntlet-2026");
  assert.equal(event.scale, "major");
  assert.equal(eventAvailability(event, "2026-10-09T12:00:00.000Z").state, "upcoming");
  assert.equal(eventAvailability(event, "2026-10-24T12:00:00.000Z").state, "live");
  assert.equal(eventAvailability(event, "2026-10-26T02:00:00.000Z").state, "entry-closed");
  assert.equal(eventAvailability(event, "2026-10-27T12:00:00.000Z").state, "ended");
  assert.throws(() => startEventRun({}, event.id, { now: "2026-10-09T12:00:00.000Z" }), /not open yet/);
  assert.equal(startEventRun({}, event.id, { now: "2026-10-24T12:00:00.000Z", runId: "major-run" }).run.id, "major-run");
  const published = listEventDefinitions({ now: "2026-10-24T12:00:00.000Z" }).find((entry) => entry.id === event.id);
  assert.deepEqual(published.availability, {
    state: "live", label: "Entry open", canEnter: true, canPlay: true, nextTransitionAt: event.schedule.entryClosesAt
  });
});

test("major event rewards include gold, boosters and collector styles", () => {
  const started = startEventRun({}, "fall-grand-gauntlet-2026", { runId: "major-rewards", now: "2026-10-24T12:00:00.000Z" });
  const result = applyEventResult({ events: started.progress }, started.event.id, started.run.id, "win");
  assert.deepEqual(result.rewards, [{ wins: 1, gold: 500, boosterCredits: 1 }]);
});

test("event runs award each win tier once and end at the loss cap", () => {
  const started = startEventRun({}, "open-gauntlet", { runId: "run-1", now: "2026-10-06T12:00:00.000Z" });
  let stats = { events: started.progress };
  const first = applyEventResult(stats, "open-gauntlet", "run-1", "win");
  assert.deepEqual(first.rewards.map((reward) => reward.wins), [1]);
  stats.events = first.progress;
  const second = applyEventResult(stats, "open-gauntlet", "run-1", "win");
  assert.deepEqual(second.rewards, []);
  stats.events = second.progress;
  const third = applyEventResult(stats, "open-gauntlet", "run-1", "win");
  assert.deepEqual(third.rewards.map((reward) => reward.wins), [3]);
  stats.events = third.progress;
  for (let index = 0; index < 3; index += 1) stats.events = applyEventResult(stats, "open-gauntlet", "run-1", "loss").progress;
  assert.equal(stats.events.runs["open-gauntlet"].status, "complete");
  assert.equal(stats.events.history.length, 1);
});

test("joining is idempotent while active and resigning permits a fresh run", () => {
  const first = startEventRun({}, "classic-trial", { runId: "classic-a" });
  const repeated = startEventRun({ events: first.progress }, "classic-trial", { runId: "classic-b" });
  assert.equal(repeated.created, false);
  assert.equal(repeated.run.id, "classic-a");
  const resigned = resignEventRun({ events: repeated.progress }, "classic-trial");
  const restarted = startEventRun({ events: resigned.progress }, "classic-trial", { runId: "classic-b" });
  assert.equal(restarted.created, true);
  assert.equal(restarted.run.id, "classic-b");
  assert.equal(normalizeEventProgress({ events: restarted.progress }).entries, 2);
});
