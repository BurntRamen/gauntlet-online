const test = require("node:test");
const assert = require("node:assert/strict");

const manifest = require("./elevenlabs-faction-interactions.json");
const { buildPlan, parseArgs } = require("./elevenlabs-faction-interactions");

test("faction interaction manifest covers every event in its explicitly approved roster", () => {
  const plan = buildPlan(manifest);
  assert.equal(Object.keys(manifest.voiceIds).length, 16);
  assert.deepEqual([...manifest.factionIds].sort(), Object.keys(manifest.voiceIds).sort());
  assert.equal(plan.length, 98);
  for (const factionId of Object.keys(manifest.voiceIds)) {
    const lines = plan.filter((line) => line.factionId === factionId);
    const expected = [
      "commander:clicked",
      "commander:critical",
      "commander:denied",
      "commander:selected",
      "commander:wounded",
      "general:clicked"
    ];
    if (factionId === "rumin") expected.push("general:clicked-2", "general:clicked-3");
    assert.deepEqual(lines.map((line) => `${line.role}:${line.event}`).sort(), expected.sort());
  }
  for (const factionId of ["zynarth", "astral-vanguard", "voltari", "xendra"]) {
    const lines = plan.filter((line) => line.factionId === factionId);
    assert.equal(new Set(lines.filter((line) => line.role === "commander").map((line) => line.voiceKey)).size, 1);
    assert.notEqual(lines.find((line) => line.role === "commander").voiceKey, lines.find((line) => line.role === "general").voiceKey);
  }
  assert.equal(Object.keys(manifest.voices).length, 9);
  assert.deepEqual(Object.keys(manifest.libraryVoiceIds).sort(), Object.keys(manifest.voices).filter((key) => key !== "rumin-meerus").sort());
  Object.values(manifest.voices).forEach((voice) => assert.ok(voice.previewText.length >= 100, `${voice.name}: Voice Design preview minimum`));
});

test("voice plans reject missing mappings, duplicate selections and unknown factions", () => {
  assert.throws(() => buildPlan({ ...manifest, voiceIds: { ...manifest.voiceIds, ingles: undefined }, factionIds: ["ingles"] }), /Missing ElevenLabs voice/);
  assert.throws(() => buildPlan({ ...manifest, factionIds: ["rumin", "rumin"] }), /distinct/);
  assert.throws(() => buildPlan({ ...manifest, factionIds: ["unknown"] }), /Unknown playable/);
  assert.throws(() => buildPlan({ ...manifest, voiceIds: { ...manifest.voiceIds, xendra: undefined }, speakerVoices: { ...manifest.speakerVoices, xendra: undefined }, factionIds: undefined }), /Missing ElevenLabs voice/);
});

test("faction interaction CLI defaults to a non-billing plan", () => {
  assert.deepEqual(parseArgs([]), {
    command: "plan",
    manifest: "scripts/elevenlabs-faction-interactions.json",
    confirmCost: false,
    force: false
  });
});
