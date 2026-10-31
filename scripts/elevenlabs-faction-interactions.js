const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { getPublicGameContent } = require("../server/gameContent");

const API_BASE_URL = "https://api.elevenlabs.io/v1";
const DEFAULT_MANIFEST = "scripts/elevenlabs-faction-interactions.json";

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator > 0 && line.slice(0, separator).trim() === "ELEVENLABS_API_KEY" && !process.env.ELEVENLABS_API_KEY) {
      process.env.ELEVENLABS_API_KEY = line.slice(separator + 1).trim();
    }
  }
}

function parseArgs(argv) {
  const args = { command: "plan", manifest: DEFAULT_MANIFEST, confirmCost: false, force: false };
  const rest = [...argv];
  if (rest[0] && !rest[0].startsWith("--")) args.command = rest.shift();
  while (rest.length) {
    const token = rest.shift();
    if (token === "--confirm-cost") args.confirmCost = true;
    else if (token === "--force") args.force = true;
    else if (token === "--manifest") args.manifest = rest.shift();
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function hash(buffer) { return crypto.createHash("sha256").update(buffer).digest("hex"); }
function writeJson(filePath, value) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`); }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")); }

function voiceKeyFor(manifest, factionId, role) {
  return manifest.speakerVoices?.[factionId]?.[role] || null;
}

function buildPlan(manifest) {
  const available = getPublicGameContent().factions;
  // Generation scope is explicit so adding playable factions never silently
  // expands a previously approved voice-production batch or its cost.
  const selected = manifest.factionIds || available.map(faction => faction.id);
  if (!Array.isArray(selected) || !selected.length || new Set(selected).size !== selected.length) throw new Error("Choose distinct faction IDs for voice production.");
  const factions = selected.map(id => {
    const faction = available.find(row => row.id === id);
    if (!faction) throw new Error(`Unknown playable faction: ${id}.`);
    return faction;
  });
  const lines = [];
  for (const faction of factions) {
    const commanderVoiceKey = voiceKeyFor(manifest, faction.id, "commander");
    const generalVoiceKey = voiceKeyFor(manifest, faction.id, "general") || commanderVoiceKey;
    const voiceId = manifest.voiceIds?.[faction.id];
    if (!voiceId && (!commanderVoiceKey || !generalVoiceKey)) throw new Error(`Missing ElevenLabs voice for ${faction.id}.`);
    for (const [event, text] of Object.entries(faction.commander.announcements)) {
      lines.push({ factionId: faction.id, role: "commander", event, text, voiceId, voiceKey: commanderVoiceKey, fileName: `faction-${faction.id}-commander-${event}.mp3` });
    }
    lines.push({ factionId: faction.id, role: "general", event: "clicked", text: faction.general.clickedAnnouncement, voiceId, voiceKey: generalVoiceKey, fileName: `faction-${faction.id}-general-clicked.mp3` });
  }
  return lines;
}

async function apiResponse(url, options, apiKey) {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", "xi-api-key": apiKey } });
  if (!response.ok) throw new Error(`ElevenLabs API ${response.status}: ${await response.text()}`);
  return response;
}

async function designVoices(manifest, root, { confirmCost }) {
  if (!confirmCost) throw new Error("Voice Design may spend ElevenLabs credits. Re-run with --confirm-cost.");
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is required.");
  const staging = path.resolve(root, manifest.stagingDirectory);
  const statePath = path.join(staging, "state.json");
  const state = fs.existsSync(statePath) ? readJson(statePath) : { schemaVersion: 1, voices: {}, lines: {} };
  state.voices ||= {};
  for (const [voiceKey, definition] of Object.entries(manifest.voices || {})) {
    if (state.voices[voiceKey]?.voiceId) continue;
    const libraryVoiceId = manifest.libraryVoiceIds?.[voiceKey];
    if (libraryVoiceId) {
      state.voices[voiceKey] = { voiceId: libraryVoiceId, name: definition.name, source: "existing-library", adoptedAt: new Date().toISOString() };
      writeJson(statePath, state);
      continue;
    }
    const request = { voice_description: definition.description, text: definition.previewText, model_id: manifest.voiceDesignModelId };
    const designedResponse = await apiResponse(`${API_BASE_URL}/text-to-voice/design?output_format=${encodeURIComponent(manifest.outputFormat)}`, { method: "POST", body: JSON.stringify(request) }, apiKey);
    const designed = await designedResponse.json();
    const selected = designed.previews?.[definition.previewIndex || 0];
    if (!selected) throw new Error(`${voiceKey}: Voice Design returned no selected preview.`);
    const previewDirectory = path.join(staging, "previews", voiceKey);
    fs.mkdirSync(previewDirectory, { recursive: true });
    designed.previews.forEach((preview, index) => fs.writeFileSync(path.join(previewDirectory, `${index + 1}.mp3`), Buffer.from(preview.audio_base_64, "base64")));
    const createdResponse = await apiResponse(`${API_BASE_URL}/text-to-voice`, { method: "POST", body: JSON.stringify({ voice_name: definition.name, voice_description: definition.description, generated_voice_id: selected.generated_voice_id }) }, apiKey);
    const created = await createdResponse.json();
    if (!created.voice_id) throw new Error(`${voiceKey}: ElevenLabs did not return a voice_id.`);
    state.voices[voiceKey] = { voiceId: created.voice_id, name: definition.name, designedAt: new Date().toISOString() };
    writeJson(statePath, state);
  }
  return state;
}

async function generate(manifest, root, { confirmCost, force }) {
  if (!confirmCost) throw new Error("Speech generation may spend ElevenLabs credits. Re-run with --confirm-cost.");
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is required.");
  const staging = path.resolve(root, manifest.stagingDirectory);
  const statePath = path.join(staging, "state.json");
  const state = fs.existsSync(statePath) ? readJson(statePath) : { schemaVersion: 1, voices: {}, lines: {} };
  state.voices ||= {};
  state.lines ||= {};
  for (const line of buildPlan(manifest)) {
    const id = `${line.factionId}-${line.role}-${line.event}`;
    const request = { text: line.text, model_id: manifest.speechModelId, voice_settings: { stability: 0.58, similarity_boost: 0.78, style: 0.28, use_speaker_boost: true } };
    const voiceId = line.voiceKey ? state.voices[line.voiceKey]?.voiceId : line.voiceId;
    if (!voiceId) throw new Error(`${line.voiceKey || line.factionId}: no designed voice is available. Run design first.`);
    const requestHash = hash(Buffer.from(JSON.stringify({ voiceId, outputFormat: manifest.outputFormat, request })));
    const outputPath = path.join(staging, "lines", line.fileName);
    if (!force && state.lines[id]?.requestHash === requestHash && fs.existsSync(outputPath)) continue;
    const response = await apiResponse(`${API_BASE_URL}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(manifest.outputFormat)}`, { method: "POST", body: JSON.stringify(request) }, apiKey);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buffer);
    state.lines[id] = { ...line, requestHash, bytes: buffer.length, sha256: hash(buffer), generatedAt: new Date().toISOString() };
    writeJson(statePath, state);
  }
  return state;
}

function publish(manifest, root, { force }) {
  const staging = path.resolve(root, manifest.stagingDirectory);
  const state = readJson(path.join(staging, "state.json"));
  const registry = { schemaVersion: 1, factions: {} };
  for (const line of buildPlan(manifest)) {
    const id = `${line.factionId}-${line.role}-${line.event}`;
    const record = state.lines[id];
    if (!record) throw new Error(`Missing generated interaction: ${id}`);
    const source = path.join(staging, "lines", line.fileName);
    const destination = path.resolve(root, manifest.publicDirectory, line.fileName);
    if (fs.existsSync(destination) && !force) throw new Error(`${line.fileName} already exists. Use --force to replace it.`);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
    registry.factions[line.factionId] ||= { commander: {}, general: {} };
    registry.factions[line.factionId][line.role][line.event] = `/assets/gauntlet/voices/${line.fileName}`;
    writeJson(path.resolve(root, manifest.provenanceDirectory, `${id}.json`), {
      schemaVersion: 1,
      status: "candidate",
      creator: "ElevenLabs Text to Speech API",
      factionId: line.factionId,
      role: line.role,
      event: line.event,
      line: line.text,
      modelId: manifest.speechModelId,
      outputFormat: manifest.outputFormat,
      clientOutput: path.relative(root, destination).replaceAll(path.sep, "/"),
      generatedAt: record.generatedAt,
      publishedAt: new Date().toISOString(),
      bytes: record.bytes,
      sha256: record.sha256
    });
  }
  writeJson(path.resolve(root, manifest.contentRegistry), registry);
  return buildPlan(manifest).length;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(__dirname, "..");
  loadEnv(path.join(root, ".env"));
  const manifest = readJson(path.resolve(root, args.manifest));
  if (![1, 2].includes(manifest.schemaVersion)) throw new Error("Faction interaction manifest schemaVersion must be 1 or 2.");
  const plan = buildPlan(manifest);
  if (args.command === "plan") return console.log(`Faction interaction voice plan: ${plan.length} lines across ${manifest.factionIds.length} factions, with ${Object.keys(manifest.voices || {}).length} custom voices.`);
  if (args.command === "design" || args.command === "all") await designVoices(manifest, root, args);
  if (args.command === "generate" || args.command === "all") await generate(manifest, root, args);
  if (args.command === "publish" || args.command === "all") console.log(`Published ${publish(manifest, root, args)} faction interaction voice files.`);
  if (!["plan", "design", "generate", "publish", "all"].includes(args.command)) throw new Error(`Unknown command: ${args.command}`);
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { buildPlan, designVoices, parseArgs, voiceKeyFor };
