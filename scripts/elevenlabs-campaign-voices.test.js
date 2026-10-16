const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { buildLinePlan, designVoices, generateLines, parseDialogueLine, publishLines } = require("./elevenlabs-campaign-voices");
const manifest = require("./elevenlabs-frumo-campaign.json");
const biziManifest = require("./elevenlabs-bizi-campaign.json");
const xendraManifest = require("./elevenlabs-xendra-campaign.json");

test("Frumo manifest covers every scripted campaign speaker and line", () => {
  const plan = buildLinePlan(manifest);
  assert.equal(plan.length, 120);
  assert.equal(new Set(plan.map((line) => line.chapterId)).size, 12);
  assert.equal(new Set(plan.map((line) => line.voiceKey)).size, 15);
  assert.equal(plan[0].fileName, "frumo-ch01-before-01-narrator.mp3");
  assert.equal(plan.at(-1).fileName, "frumo-ch12-after-05-polea.mp3");
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
  assert.equal(plan.length, 92);
  assert.equal(new Set(plan.map((line) => line.chapterId)).size, 10);
  assert.equal(new Set(plan.map((line) => line.voiceKey)).size, 12);
  assert.equal(plan[0].fileName, "xendra-ch01-before-01-narrator.mp3");
  assert.equal(plan.at(-1).fileName, "xendra-ch10-after-06-mara.mp3");
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
  assert.equal(generations, 120);
  assert.equal(publishLines({ manifest: tiny, workspaceRoot }), 120);
  assert.ok(fs.existsSync(path.join(workspaceRoot, "public", "frumo-ch01-before-01-narrator.mp3")));
  const registry = JSON.parse(fs.readFileSync(path.join(workspaceRoot, "server", "frumoCampaignVoiceAssets.json"), "utf8"));
  assert.equal(registry.chapters["tax-of-tides"].dialogueAudio.length, 5);
  assert.equal(registry.chapters["last-tide"].endDialogueAudio.length, 5);
});
