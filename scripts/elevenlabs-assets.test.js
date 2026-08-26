const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  buildRequest,
  convertPcm16MonoToWave,
  convertPcm16ToMonoWave,
  generateJobs,
  loadLocalEnv,
  publishJobs,
  topologicalJobs,
  validateManifest
} = require("./elevenlabs-assets");

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-elevenlabs-"));
  fs.mkdirSync(path.join(root, "client/public"), { recursive: true });
  return root;
}

function manifest() {
  return {
    schemaVersion: 1,
    stagingDirectory: "artifacts/elevenlabs",
    provenanceDirectory: "docs/generated-assets/elevenlabs",
    jobs: [
      {
        id: "still",
        kind: "image",
        modelId: "gpt-image-2",
        prompt: "A still",
        parameters: { aspect_ratio: "16:9" },
        clientOutput: "client/public/generated/still.png"
      },
      {
        id: "motion",
        kind: "video",
        modelId: "veo-3.1-fast-generate-001",
        prompt: "Animate it",
        references: { start_frame: { job: "still" } },
        clientOutput: "client/public/generated/motion.mp4"
      }
    ]
  };
}

test("validation and selection include dependencies in order", () => {
  const root = workspace();
  const value = validateManifest(manifest(), root);
  assert.deepEqual(topologicalJobs(value.jobs, ["motion"]).map((job) => job.id), ["still", "motion"]);
});

test("buildRequest resolves a generated image reference", () => {
  const root = workspace();
  const job = manifest().jobs[1];
  const request = buildRequest(job, root, { jobs: { still: { status: "completed", generationId: "image-123" } } });
  assert.deepEqual(request.start_frame, { type: "generation", generation_id: "image-123" });
  assert.equal(request.model_id, "veo-3.1-fast-generate-001");
});

test("sound effect requests use the ElevenLabs sound-generation shape", () => {
  const root = workspace();
  const request = buildRequest({
    id: "impact",
    kind: "sound-effect",
    modelId: "eleven_text_to_sound_v2",
    prompt: "Restrained physical impact",
    parameters: { duration_seconds: 0.6, prompt_influence: 0.7 }
  }, root, { jobs: {} });
  assert.deepEqual(request, {
    text: "Restrained physical impact",
    model_id: "eleven_text_to_sound_v2",
    duration_seconds: 0.6,
    prompt_influence: 0.7
  });
});

test("raw ElevenLabs PCM is resampled and wrapped as a 48 kHz mono WAV", () => {
  const raw = Buffer.alloc(44100 * 2);
  for (let index = 0; index < 44100; index += 1) raw.writeInt16LE(Math.round(Math.sin(index / 12) * 12000), index * 2);
  const wave = convertPcm16MonoToWave(raw, 44100);
  assert.equal(wave.toString("ascii", 0, 4), "RIFF");
  assert.equal(wave.readUInt32LE(24), 48000);
  assert.equal(wave.readUInt16LE(22), 1);
  assert.equal(wave.readUInt16LE(34), 16);
  assert.equal(wave.length, 44 + 48000 * 2);
});

test("interleaved stereo PCM is downmixed before resampling", () => {
  const raw = Buffer.alloc(44100 * 2 * 2);
  for (let frame = 0; frame < 44100; frame += 1) {
    raw.writeInt16LE(12000, frame * 4);
    raw.writeInt16LE(6000, frame * 4 + 2);
  }
  const wave = convertPcm16ToMonoWave(raw, 44100, 48000, -6, 2);
  assert.equal(wave.readUInt32LE(24), 48000);
  assert.equal(wave.readUInt16LE(22), 1);
  assert.equal(wave.length, 44 + 48000 * 2);
  assert.ok(wave.readInt16LE(44) > 9000);
});

test("local env loading does not overwrite an existing process value", () => {
  const root = workspace();
  const envPath = path.join(root, ".env");
  fs.writeFileSync(envPath, "ELEVENLABS_API_KEY=file-key\nSECOND=value\n");
  const environment = { ELEVENLABS_API_KEY: "process-key" };
  loadLocalEnv(envPath, environment);
  assert.equal(environment.ELEVENLABS_API_KEY, "process-key");
  assert.equal(environment.SECOND, "value");
});

test("generation refuses to spend credits without explicit confirmation", async () => {
  const root = workspace();
  const value = validateManifest(manifest(), root);
  await assert.rejects(
    generateJobs({ manifest: value, workspaceRoot: root, selectedIds: ["still"], apiKey: "test-key", confirmCost: false }),
    /--confirm-cost/
  );
});

test("generation downloads output and publish records provenance", async () => {
  const root = workspace();
  const value = validateManifest(manifest(), root);
  const responses = [
    new Response(JSON.stringify({ id: "image-123", status: "pending" }), { status: 200 }),
    new Response(JSON.stringify({ id: "image-123", status: "completed", content_url: "https://download.test/image", content_mime_type: "image/png" }), { status: 200 }),
    new Response(Buffer.from("png-result"), { status: 200, headers: { "Content-Type": "image/png" } })
  ];
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return responses.shift();
  };
  const state = await generateJobs({
    manifest: value,
    workspaceRoot: root,
    selectedIds: ["still"],
    apiKey: "test-key",
    confirmCost: true,
    fetchImpl,
    sleep: async () => {},
    timeoutByKind: { image: 1000, video: 1000 }
  });
  assert.equal(state.jobs.still.status, "completed");
  assert.equal(calls[0].options.headers["xi-api-key"], "test-key");
  assert.equal(calls[2].options, undefined);

  const [published] = publishJobs({ manifest: value, workspaceRoot: root, selectedIds: ["still"] });
  assert.equal(fs.readFileSync(published.outputPath, "utf8"), "png-result");
  const provenance = JSON.parse(fs.readFileSync(path.join(root, "docs/generated-assets/elevenlabs/still.json"), "utf8"));
  assert.equal(provenance.generationId, "image-123");
  assert.equal(provenance.status, "provisional");
  assert.equal(provenance.approvalRequired, true);
});

test("publish records explicit review status without changing generation behavior", async () => {
  const root = workspace();
  const value = manifest();
  value.jobs = [{ ...value.jobs[0], reviewStatus: "approved" }];
  const validated = validateManifest(value, root);
  const fetchImpl = async (url) => {
    if (String(url).includes("download.test")) return new Response(Buffer.from("png-result"), { status: 200, headers: { "Content-Type": "image/png" } });
    if (String(url).includes("/flows/")) return new Response(JSON.stringify({ id: "image-reviewed", status: "completed", content_url: "https://download.test/image", content_mime_type: "image/png" }), { status: 200 });
    return new Response(JSON.stringify({ id: "image-reviewed", status: "pending" }), { status: 200 });
  };
  await generateJobs({
    manifest: validated,
    workspaceRoot: root,
    apiKey: "test-key",
    confirmCost: true,
    fetchImpl,
    sleep: async () => {},
    timeoutByKind: { image: 1000, video: 1000 }
  });
  publishJobs({ manifest: validated, workspaceRoot: root });
  const provenance = JSON.parse(fs.readFileSync(path.join(root, "docs/generated-assets/elevenlabs/still.json"), "utf8"));
  assert.equal(provenance.status, "approved");
  assert.equal(provenance.approvalRequired, false);
});

test("sound effect generation downloads the synchronous MP3 response", async () => {
  const root = workspace();
  const value = validateManifest({
    schemaVersion: 1,
    stagingDirectory: "artifacts/elevenlabs",
    provenanceDirectory: "docs/generated-assets/elevenlabs",
    jobs: [{
      id: "impact",
      kind: "sound-effect",
      modelId: "eleven_text_to_sound_v2",
      prompt: "Restrained impact",
      parameters: { duration_seconds: 0.6 },
      outputFormat: "mp3_44100_192",
      clientOutput: "client/public/generated/impact.mp3"
    }]
  }, root);
  const fetchImpl = async (url, options) => {
    assert.match(url, /\/sound-generation\?output_format=mp3_44100_192$/);
    assert.equal(JSON.parse(options.body).text, "Restrained impact");
    return new Response(Buffer.from("mp3-result"), {
      status: 200,
      headers: { "Content-Type": "audio/mpeg", "character-cost": "24" }
    });
  };
  const state = await generateJobs({
    manifest: value,
    workspaceRoot: root,
    apiKey: "test-key",
    confirmCost: true,
    fetchImpl
  });
  assert.equal(state.jobs.impact.contentMimeType, "audio/mpeg");
  assert.equal(state.jobs.impact.characterCost, "24");
  assert.equal(fs.readFileSync(state.jobs.impact.stagedPath, "utf8"), "mp3-result");
});

test("manifest rejects client output paths outside client/public", () => {
  const root = workspace();
  const value = manifest();
  value.jobs[0].clientOutput = "server/leaked.png";
  assert.throws(() => validateManifest(value, root), /inside client\/public/);
});
