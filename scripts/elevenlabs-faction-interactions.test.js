const test = require("node:test");
const assert = require("node:assert/strict");

const manifest = require("./elevenlabs-faction-interactions.json");
const { buildPlan, parseArgs } = require("./elevenlabs-faction-interactions");

test("faction interaction manifest covers every event in its explicitly approved roster", () => {
  const plan = buildPlan(manifest);
  assert.equal(Object.keys(manifest.voiceIds).length, 16);
  assert.deepEqual([...manifest.factionIds].sort(), Object.keys(manifest.voiceIds).sort());
  assert.equal(plan.length, 96);
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

test("voice plans reject missing mappings, duplicate selections and unknown factions", () => {
  assert.throws(() => buildPlan({ ...manifest, voiceIds: { ...manifest.voiceIds, ingles: undefined }, factionIds: ["ingles"] }), /Missing ElevenLabs voice/);
  assert.throws(() => buildPlan({ ...manifest, factionIds: ["rumin", "rumin"] }), /distinct/);
  assert.throws(() => buildPlan({ ...manifest, factionIds: ["unknown"] }), /Unknown playable/);
  assert.throws(() => buildPlan({ ...manifest, voiceIds: { ...manifest.voiceIds, xendra: undefined }, factionIds: undefined }), /Missing ElevenLabs voice/);
});

test("faction interaction CLI defaults to a non-billing plan", () => {
  assert.deepEqual(parseArgs([]), {
    command: "plan",
    manifest: "scripts/elevenlabs-faction-interactions.json",
    confirmCost: false,
    force: false
  });
});
