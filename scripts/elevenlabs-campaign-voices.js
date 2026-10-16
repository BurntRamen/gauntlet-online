const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const { campaignChapters } = require("../server/gameContent");

const API_BASE_URL = "https://api.elevenlabs.io/v1";
const DEFAULT_MANIFEST = "scripts/elevenlabs-frumo-campaign.json";

function parseArgs(argv) {
  const args = { command: null, onlyVoices: [] };
  const rest = [...argv];
  if (rest[0] && !rest[0].startsWith("--")) args.command = rest.shift();
  while (rest.length) {
    const token = rest.shift();
    if (token === "--confirm-cost") args.confirmCost = true;
    else if (token === "--force") args.force = true;
    else if (token === "--manifest") args.manifest = rest.shift();
    else if (token === "--only-voice") args.onlyVoices.push(...String(rest.shift() || "").split(",").filter(Boolean));
    else if (token.startsWith("--manifest=")) args.manifest = token.slice(11);
    else if (token.startsWith("--only-voice=")) args.onlyVoices.push(...token.slice(13).split(",").filter(Boolean));
    else if (!token.startsWith("--") && !args.command) args.command = token;
    else throw new Error(`Unknown argument: ${token}`);
  }
  args.command ||= "plan";
  return args;
}

function loadLocalEnv(filePath, environment = process.env) {
  if (!fs.existsSync(filePath)) return environment;
  for (const line of fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const name = trimmed.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || environment[name]) continue;
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    environment[name] = value;
  }
  return environment;
}

function slug(value) {
  return String(value).normalize("NFKD").replace(/[’']/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function parseDialogueLine(line) {
  const separator = String(line).indexOf(":");
  if (separator <= 0) throw new Error(`Dialogue line is missing a speaker prefix: ${line}`);
  return { speaker: line.slice(0, separator).trim(), text: line.slice(separator + 1).trim() };
}

function campaignFileName(factionId, chapterIndex, phase, lineIndex, speaker) {
  return `${factionId}-ch${String(chapterIndex + 1).padStart(2, "0")}-${phase}-${String(lineIndex + 1).padStart(2, "0")}-${slug(speaker)}.mp3`;
}

function validateManifest(manifest) {
  if (manifest.schemaVersion !== 1) throw new Error("Campaign voice manifest schemaVersion must be 1.");
  if (!manifest.factionId || !campaignChapters[manifest.factionId]) throw new Error(`Unknown campaign faction: ${manifest.factionId || "(missing)"}`);
  for (const field of ["voiceDesignModelId", "speechModelId", "outputFormat", "stagingDirectory", "publicDirectory", "provenanceDirectory", "contentRegistry"]) {
    if (!manifest[field]) throw new Error(`Campaign voice manifest is missing ${field}.`);
  }
  if (!manifest.voices || !manifest.speakerVoices) throw new Error("Campaign voice manifest must define voices and speakerVoices.");
  for (const [id, voice] of Object.entries(manifest.voices)) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id) || !voice.name || !voice.description || !voice.previewText) throw new Error(`Invalid voice definition: ${id}`);
  }
  return manifest;
}

function buildLinePlan(manifest) {
  const lines = [];
  campaignChapters[manifest.factionId].forEach((chapter, chapterIndex) => {
    for (const [field, phase] of [["dialogue", "before"], ["endDialogue", "after"]]) {
      (chapter[field] || []).forEach((rawLine, lineIndex) => {
        const { speaker, text } = parseDialogueLine(rawLine);
        const voiceKey = manifest.speakerVoices[speaker];
        if (!voiceKey || !manifest.voices[voiceKey]) throw new Error(`No voice mapping for ${speaker} in ${chapter.id}.`);
        lines.push({
          id: `${manifest.factionId}-${chapter.id}-${phase}-${String(lineIndex + 1).padStart(2, "0")}`,
          chapterId: chapter.id,
          chapterIndex,
          field,
          phase,
          lineIndex,
          speaker,
          text,
          voiceKey,
          fileName: campaignFileName(manifest.factionId, chapterIndex, phase, lineIndex, speaker)
        });
      });
    }
  });
  return lines;
}

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function writeJson(filePath, value) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`); }
function sha256(buffer) { return crypto.createHash("sha256").update(buffer).digest("hex"); }
function requestHash(value) { return sha256(Buffer.from(JSON.stringify(value))); }

function applyAudioTreatment(filePath, treatment, ffmpegPath = process.env.FFMPEG_PATH) {
  if (!treatment) return;
  if (!ffmpegPath) throw new Error("FFMPEG_PATH is required for configured voice post-processing.");
  const processedPath = `${filePath}.processed.mp3`;
  try {
    execFileSync(ffmpegPath, ["-y", "-hide_banner", "-loglevel", "error", "-i", filePath, "-af", treatment, processedPath]);
    fs.renameSync(processedPath, filePath);
  } finally {
    if (fs.existsSync(processedPath)) fs.rmSync(processedPath, { force: true });
  }
}

async function apiResponse(fetchImpl, url, options, apiKey) {
  const response = await fetchImpl(url, { ...options, headers: { "Content-Type": "application/json", "xi-api-key": apiKey, ...(options.headers || {}) } });
  if (!response.ok) {
    const raw = await response.text();
    let detail = raw;
    try { const parsed = JSON.parse(raw); detail = parsed.detail || parsed.error_message || parsed.message || raw; } catch { /* retain raw response */ }
    throw new Error(`ElevenLabs API ${response.status}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  }
  return response;
}

async function apiJson(fetchImpl, url, options, apiKey) {
  const response = await apiResponse(fetchImpl, url, options, apiKey);
  return response.json();
}

function statePaths(workspaceRoot, manifest) {
  const staging = path.resolve(workspaceRoot, manifest.stagingDirectory);
  const publicDirectory = path.resolve(workspaceRoot, manifest.publicDirectory);
  const provenance = path.resolve(workspaceRoot, manifest.provenanceDirectory);
  return { staging, publicDirectory, provenance, state: path.join(staging, "state.json") };
}

function loadState(filePath) {
  return fs.existsSync(filePath) ? readJson(filePath) : { schemaVersion: 1, voices: {}, lines: {} };
}

async function designVoices({ manifest, workspaceRoot, apiKey, confirmCost, onlyVoices = [], fetchImpl = fetch }) {
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is required to design voices.");
  if (!confirmCost) throw new Error("Voice Design may spend ElevenLabs credits. Re-run with --confirm-cost.");
  const paths = statePaths(workspaceRoot, manifest);
  const state = loadState(paths.state);
  const used = new Set(buildLinePlan(manifest).map((line) => line.voiceKey));
  const voiceKeys = onlyVoices.length ? onlyVoices : [...used];
  for (const voiceKey of voiceKeys) {
    const definition = manifest.voices[voiceKey];
    if (!definition || !used.has(voiceKey)) throw new Error(`Unknown or unused ${manifest.factionId} voice: ${voiceKey}`);
    if (state.voices[voiceKey]?.voiceId) continue;
    const libraryVoiceId = manifest.libraryVoiceIds?.[voiceKey];
    if (libraryVoiceId) {
      state.voices[voiceKey] = { voiceId: libraryVoiceId, name: definition.name, source: "existing-library", adoptedAt: new Date().toISOString() };
      writeJson(paths.state, state);
      continue;
    }
    const designRequest = { voice_description: definition.description, text: definition.previewText, model_id: manifest.voiceDesignModelId };
    const designed = await apiJson(fetchImpl, `${API_BASE_URL}/text-to-voice/design?output_format=${encodeURIComponent(manifest.outputFormat)}`, { method: "POST", body: JSON.stringify(designRequest) }, apiKey);
    if (!designed.previews?.length) throw new Error(`${voiceKey}: Voice Design returned no previews.`);
    const previewDirectory = path.join(paths.staging, "previews", voiceKey);
    fs.mkdirSync(previewDirectory, { recursive: true });
    designed.previews.forEach((preview, index) => fs.writeFileSync(path.join(previewDirectory, `${index + 1}.mp3`), Buffer.from(preview.audio_base_64, "base64")));
    const selected = designed.previews[definition.previewIndex || 0];
    if (!selected) throw new Error(`${voiceKey}: previewIndex is outside the returned preview list.`);
    const created = await apiJson(fetchImpl, `${API_BASE_URL}/text-to-voice`, {
      method: "POST",
      body: JSON.stringify({ voice_name: definition.name, voice_description: definition.description, generated_voice_id: selected.generated_voice_id })
    }, apiKey);
    if (!created.voice_id) throw new Error(`${voiceKey}: ElevenLabs did not return a voice_id.`);
    state.voices[voiceKey] = { voiceId: created.voice_id, name: definition.name, descriptionHash: requestHash(designRequest), designedAt: new Date().toISOString() };
    writeJson(paths.state, state);
  }
  return state;
}

async function generateLines({ manifest, workspaceRoot, apiKey, confirmCost, onlyVoices = [], force = false, fetchImpl = fetch }) {
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is required to generate campaign speech.");
  if (!confirmCost) throw new Error("Speech generation may spend ElevenLabs credits. Re-run with --confirm-cost.");
  const paths = statePaths(workspaceRoot, manifest);
  const state = loadState(paths.state);
  const selectedVoices = new Set(onlyVoices);
  for (const line of buildLinePlan(manifest)) {
    if (selectedVoices.size && !selectedVoices.has(line.voiceKey)) continue;
    const voiceId = state.voices[line.voiceKey]?.voiceId;
    if (!voiceId) throw new Error(`${line.voiceKey}: no designed voice is available. Run design first.`);
    const request = {
      text: line.text,
      model_id: manifest.speechModelId,
      voice_settings: manifest.voices[line.voiceKey].settings || { stability: 0.58, similarity_boost: 0.78, style: 0.28, use_speaker_boost: true }
    };
    const treatment = manifest.voices[line.voiceKey].postProcess || "";
    const hash = requestHash({ voiceId, outputFormat: manifest.outputFormat, request, treatment });
    const stagedPath = path.join(paths.staging, "lines", line.fileName);
    if (!force && state.lines[line.id]?.requestHash === hash && fs.existsSync(stagedPath)) continue;
    const response = await apiResponse(fetchImpl, `${API_BASE_URL}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(manifest.outputFormat)}`, { method: "POST", body: JSON.stringify(request) }, apiKey);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new Error(`${line.id}: generated speech was empty.`);
    fs.mkdirSync(path.dirname(stagedPath), { recursive: true });
    fs.writeFileSync(stagedPath, buffer);
    applyAudioTreatment(stagedPath, treatment);
    const treatedBuffer = fs.readFileSync(stagedPath);
    state.lines[line.id] = { ...line, requestHash: hash, bytes: treatedBuffer.length, sha256: sha256(treatedBuffer), generatedAt: new Date().toISOString() };
    writeJson(paths.state, state);
  }
  return state;
}

function publishLines({ manifest, workspaceRoot, onlyVoices = [], force = false }) {
  const paths = statePaths(workspaceRoot, manifest);
  const state = loadState(paths.state);
  const selectedVoices = new Set(onlyVoices);
  const plan = buildLinePlan(manifest).filter((line) => !selectedVoices.size || selectedVoices.has(line.voiceKey));
  const prepared = plan.map((line) => {
    const record = state.lines[line.id];
    const stagedPath = path.join(paths.staging, "lines", line.fileName);
    if (!record || !fs.existsSync(stagedPath)) throw new Error(`${line.id}: no generated speech is staged.`);
    const outputPath = path.join(paths.publicDirectory, line.fileName);
    if (fs.existsSync(outputPath) && !force) throw new Error(`${line.fileName} already exists. Use --force to replace it.`);
    return { line, record, stagedPath, outputPath };
  });
  for (const item of prepared) {
    fs.mkdirSync(path.dirname(item.outputPath), { recursive: true });
    fs.copyFileSync(item.stagedPath, item.outputPath);
    writeJson(path.join(paths.provenance, `${item.line.id}.json`), {
      schemaVersion: 1,
      status: "candidate",
      creator: "ElevenLabs Text to Speech API",
      factionId: manifest.factionId,
      modelId: manifest.speechModelId,
      outputFormat: manifest.outputFormat,
      voiceKey: item.line.voiceKey,
      voiceName: manifest.voices[item.line.voiceKey].name,
      audioTreatment: manifest.voices[item.line.voiceKey].postProcess || null,
      line: item.line.text,
      clientOutput: path.relative(workspaceRoot, item.outputPath).replaceAll(path.sep, "/"),
      generatedAt: item.record.generatedAt,
      publishedAt: new Date().toISOString(),
      bytes: item.record.bytes,
      sha256: item.record.sha256
    });
  }
  if (!selectedVoices.size) {
    const chapters = {};
    for (const line of plan) {
      chapters[line.chapterId] ||= { dialogueAudio: [], endDialogueAudio: [] };
      chapters[line.chapterId][line.field === "dialogue" ? "dialogueAudio" : "endDialogueAudio"][line.lineIndex] = `/assets/gauntlet/voices/${line.fileName}`;
    }
    writeJson(path.resolve(workspaceRoot, manifest.contentRegistry), { schemaVersion: 1, factionId: manifest.factionId, chapters });
  }
  return prepared.length;
}

function printPlan(manifest, logger = console.log) {
  const lines = buildLinePlan(manifest);
  const voiceKeys = [...new Set(lines.map((line) => line.voiceKey))];
  logger(`${manifest.factionId} campaign voice plan: ${lines.length} lines, ${voiceKeys.length} fictional character voices, ${lines.reduce((sum, line) => sum + line.text.length, 0)} dialogue characters.`);
  campaignChapters[manifest.factionId].forEach((chapter, index) => {
    const chapterLines = lines.filter((line) => line.chapterId === chapter.id);
    logger(`- Chapter ${index + 1}: ${chapter.title} (${chapterLines.length} lines)`);
  });
}

function usage() {
  return [
    "Usage: node scripts/elevenlabs-campaign-voices.js <plan|design|generate|publish|all> [options]",
    "",
    "  plan                    Validate scripts and show the cost-bearing scope without API calls",
    "  design --confirm-cost   Design and save original fictional character voices",
    "  generate --confirm-cost Generate each campaign line into ignored staging",
    "  publish                 Copy a complete staged batch into client/public with provenance",
    "  all --confirm-cost      Design, generate, and publish in one resumable run",
    "",
    "Options: --only-voice <id[,id]> --manifest <path> --force --confirm-cost"
  ].join("\n");
}

async function main(argv = process.argv.slice(2), dependencies = {}) {
  const workspaceRoot = dependencies.workspaceRoot || path.resolve(__dirname, "..");
  loadLocalEnv(path.join(workspaceRoot, ".env"));
  const args = parseArgs(argv);
  if (["help", "--help"].includes(args.command)) return console.log(usage());
  const manifestPath = path.resolve(workspaceRoot, args.manifest || DEFAULT_MANIFEST);
  const manifest = validateManifest(readJson(manifestPath));
  if (args.command === "plan") return printPlan(manifest);
  const common = { manifest, workspaceRoot, apiKey: process.env.ELEVENLABS_API_KEY, confirmCost: args.confirmCost, onlyVoices: args.onlyVoices, force: args.force, ...dependencies };
  if (args.command === "design") return designVoices(common);
  if (args.command === "generate") return generateLines(common);
  if (args.command === "publish") return console.log(`Published ${publishLines(common)} ${manifest.factionId} campaign voice files.`);
  if (args.command === "all") {
    await designVoices(common);
    await generateLines(common);
    return console.log(`Published ${publishLines(common)} ${manifest.factionId} campaign voice files.`);
  }
  throw new Error(`Unknown command: ${args.command}\n\n${usage()}`);
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { buildLinePlan, campaignFileName, designVoices, generateLines, parseArgs, parseDialogueLine, publishLines, validateManifest };
