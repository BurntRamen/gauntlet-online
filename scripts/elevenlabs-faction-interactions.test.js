const test = require("node:test");
const assert = require("node:assert/strict");

const manifest = require("./elevenlabs-faction-interactions.json");
const { buildPlan, parseArgs } = require("./elevenlabs-faction-interactions");

test("faction interaction manifest covers every playable faction event", () => {
  const plan = buildPlan(manifest);
  assert.equal(Object.keys(manifest.voiceIds).length, 10);
  assert.equal(plan.length, 60);
  for (const factionId of Object.keys(manifest.voiceIds)) {
    const lines = plan.filter((line) => line.factionId === factionId);
    assert.deepEqual(lines.map((line) => `${line.role}:${line.event}`).sort(), [
      "commander:clicked",
      "commander:critical",
      "commander:denied",
      "commander:selected",
      "commander:wounded",
      "general:clicked"
    ]);
  }
});

test("faction interaction CLI defaults to a non-billing plan", () => {
  assert.deepEqual(parseArgs([]), {
    command: "plan",
    manifest: "scripts/elevenlabs-faction-interactions.json",
    confirmCost: false,
    force: false
  });
});
