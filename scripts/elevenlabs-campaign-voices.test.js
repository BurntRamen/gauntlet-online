const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { buildLinePlan, designVoices, generateLines, parseDialogueLine, publishLines } = require("./elevenlabs-campaign-voices");
const { campaignChapters } = require("../server/gameContent");
const manifest = require("./elevenlabs-frumo-campaign.json");
const biziManifest = require("./elevenlabs-bizi-campaign.json");
const xendraManifest = require("./elevenlabs-xendra-campaign.json");
const zynarthManifest = require("./elevenlabs-zynarth-campaign.json");
const { TARGETS: refinedTargets } = require("./build-campaign-voice-manifests");

test("Frumo manifest covers every scripted campaign speaker and line", () => {
  const plan = buildLinePlan(manifest);
  assert.equal(plan.length, 122);
  assert.equal(new Set(plan.map((line) => line.chapterId)).size, 12);
  assert.equal(new Set(plan.map((line) => line.voiceKey)).size, 15);
  assert.equal(plan[0].fileName, "frumo-ch01-before-01-narrator.mp3");
  assert.equal(plan.at(-1).fileName, "frumo-ch12-after-07-lafayette.mp3");
  assert.equal(plan.find(line => line.speaker === "Epilogue").voiceKey, "narrator");
});

test("Bizi manifest covers every scripted campaign speaker and line", () => {
  const plan = buildLinePlan(biziManifest);
  assert.equal(plan.length, 169);
  assert.equal(new Set(plan.map((line) => line.chapterId)).size, 12);
  assert.equal(new Set(plan.map((line) => line.voiceKey)).size, 21);
  assert.equal(plan[0].fileName, "bizi-ch01-before-01-narrator.mp3");
  assert.equal(plan.at(-1).fileName, "bizi-ch12-after-08-defender.mp3");
});

test("XenDra manifest covers every scripted campaign speaker and line", () => {
  const plan = buildLinePlan(xendraManifest);
  assert.equal(plan.length, 24);
  assert.equal(new Set(plan.map((line) => line.chapterId)).size, 8);
  assert.equal(new Set(plan.map((line) => line.voiceKey)).size, 10);
  assert.equal(plan[0].fileName, "xendra-ch01-before-01-narrator.mp3");
  assert.equal(plan.at(-1).fileName, "xendra-ch08-before-03-narrator.mp3");
});

test("Zynarth manifest covers every campaign line with insectoid-specific roles", () => {
  const plan = buildLinePlan(zynarthManifest);
  assert.equal(plan.length, 120);
  assert.equal(new Set(plan.map((line) => line.chapterId)).size, 12);
  assert.equal(new Set(plan.map((line) => line.voiceKey)).size, 6);
  assert.equal(plan[0].fileName, "zynarth-ch01-before-01-narrator.mp3");
  assert.equal(plan.at(-1).fileName, "zynarth-ch12-after-05-narrator.mp3");
  assert.match(zynarthManifest.voices.broodmother.description, /mandible|stridulation/i);
  assert.match(zynarthManifest.voices.broodmother.description, /never shrill.*never.*human/i);
});

test("refined manifests cover every speaker in each campaign without browser-voice fallbacks", () => {
  for (const factionId of refinedTargets) {
    const refined = require(`./elevenlabs-${factionId}-campaign-refined.json`);
    const plan = buildLinePlan(refined);
    assert.ok(plan.length >= 120, `${factionId} should map its complete campaign`);
    assert.ok(new Set(plan.map((line) => line.voiceKey)).size >= 3, `${factionId} should not collapse to one generic voice`);
    assert.match(refined.voices.protagonist.description, /never an imitation of a real performer/i);
  }
  assert.match(require("./elevenlabs-voltari-campaign-refined.json").voices.protagonist.description, /not robotic/i);
  assert.match(require("./elevenlabs-morphlings-campaign-refined.json").voices.protagonist.description, /recognizable personality/i);
});

test("Frontier and Crossroads campaigns speak in faction-specific language", () => {
  const factions = ["ingles", "mercaw", "mtano", "russo", "khevar", "vardun", "qhantari", "sahravi", "intari", "thalassari"];
  const combined = Object.fromEntries(factions.map((factionId) => [
    factionId,
    campaignChapters[factionId].flatMap((chapter) => [...chapter.dialogue, ...chapter.endDialogue]).join(" ")
  ]));
  for (const dialogue of Object.values(combined)) {
    assert.doesNotMatch(dialogue, /Your principles are delays dressed as courage|A fast answer can still leave the wrong people carrying its cost/);
  }
  assert.match(combined.ingles, /crown|chronicle|Parliament/i);
  assert.match(combined.mercaw, /aerie|federation|signal/i);
  assert.match(combined.mtano, /ancestor|memory|Veil/i);
  assert.match(combined.russo, /winter|hearth|reserve/i);
  assert.match(combined.khevar, /verdict|scale|witness/i);
  assert.match(combined.vardun, /oath|saga|clan/i);
  assert.match(combined.qhantari, /relay|station|road/i);
  assert.match(combined.sahravi, /contract|ledger|promise/i);
  assert.match(combined.intari, /Mita|quipu|terrace/i);
  assert.match(combined.thalassari, /harbor|route|convoy/i);
});

test("refined Astral Vanguard lines override the legacy combined track", () => {
  for (const chapter of campaignChapters["astral-vanguard"]) {
    assert.equal(chapter.dialogueTrack, null);
    assert.equal(chapter.endDialogueTrack, null);
    assert.equal(chapter.dialogueAudio.length, chapter.dialogue.length);
    assert.equal(chapter.endDialogueAudio.length, chapter.endDialogue.length);
  }
});

test("dialogue parsing preserves colons inside spoken text", () => {
  assert.deepEqual(parseDialogueLine("Narrator: The ledger reads: paid in full."), { speaker: "Narrator", text: "The ledger reads: paid in full." });
});

test("voice design, generation, and publication are resumable", async () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "frumo-voices-"));
  const tiny = {
    ...manifest,
    stagingDirectory: "staging",
    publicDirectory: "public",
    provenanceDirectory: "provenance",
    contentRegistry: "server/frumoCampaignVoiceAssets.json",
    voices: { narrator: manifest.voices.narrator },
    speakerVoices: Object.fromEntries(Object.keys(manifest.speakerVoices).map((speaker) => [speaker, "narrator"]))
  };
  let designs = 0;
  let generations = 0;
  const fetchImpl = async (url) => {
    if (url.includes("/text-to-voice/design")) {
      designs += 1;
      return new Response(JSON.stringify({ previews: [{ generated_voice_id: "preview-1", audio_base_64: Buffer.from("preview").toString("base64") }] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/text-to-voice")) return new Response(JSON.stringify({ voice_id: "voice-1" }), { status: 200, headers: { "content-type": "application/json" } });
    generations += 1;
    return new Response(Buffer.from("fake-mp3"), { status: 200, headers: { "content-type": "audio/mpeg" } });
  };
  await designVoices({ manifest: tiny, workspaceRoot, apiKey: "test", confirmCost: true, fetchImpl });
  await designVoices({ manifest: tiny, workspaceRoot, apiKey: "test", confirmCost: true, fetchImpl });
  assert.equal(designs, 1);
  await generateLines({ manifest: tiny, workspaceRoot, apiKey: "test", confirmCost: true, fetchImpl });
  await generateLines({ manifest: tiny, workspaceRoot, apiKey: "test", confirmCost: true, fetchImpl });
  assert.equal(generations, 122);
  assert.equal(publishLines({ manifest: tiny, workspaceRoot }), 122);
  assert.ok(fs.existsSync(path.join(workspaceRoot, "public", "frumo-ch01-before-01-narrator.mp3")));
  const registry = JSON.parse(fs.readFileSync(path.join(workspaceRoot, "server", "frumoCampaignVoiceAssets.json"), "utf8"));
  assert.equal(registry.chapters["tax-of-tides"].dialogueAudio.length, 5);
  assert.equal(registry.chapters["last-tide"].endDialogueAudio.length, 7);
});
