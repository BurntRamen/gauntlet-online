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

function buildPlan(manifest) {
  const factions = getPublicGameContent().factions;
  const lines = [];
  for (const faction of factions) {
    const voiceId = manifest.voiceIds[faction.id];
    if (!voiceId) throw new Error(`Missing ElevenLabs voice for ${faction.id}.`);
    for (const [event, text] of Object.entries(faction.commander.announcements)) {
      lines.push({ factionId: faction.id, role: "commander", event, text, voiceId, fileName: `faction-${faction.id}-commander-${event}.mp3` });
    }
    lines.push({ factionId: faction.id, role: "general", event: "clicked", text: faction.general.clickedAnnouncement, voiceId, fileName: `faction-${faction.id}-general-clicked.mp3` });
  }
  return lines;
}

async function apiResponse(url, options, apiKey) {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", "xi-api-key": apiKey } });
  if (!response.ok) throw new Error(`ElevenLabs API ${response.status}: ${await response.text()}`);
  return response;
}

async function generate(manifest, root, { confirmCost, force }) {
  if (!confirmCost) throw new Error("Speech generation may spend ElevenLabs credits. Re-run with --confirm-cost.");
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is required.");
  const staging = path.resolve(root, manifest.stagingDirectory);
  const statePath = path.join(staging, "state.json");
  const state = fs.existsSync(statePath) ? readJson(statePath) : { schemaVersion: 1, lines: {} };
  for (const line of buildPlan(manifest)) {
    const id = `${line.factionId}-${line.role}-${line.event}`;
    const request = { text: line.text, model_id: manifest.speechModelId, voice_settings: { stability: 0.58, similarity_boost: 0.78, style: 0.28, use_speaker_boost: true } };
    const requestHash = hash(Buffer.from(JSON.stringify({ voiceId: line.voiceId, outputFormat: manifest.outputFormat, request })));
    const outputPath = path.join(staging, "lines", line.fileName);
    if (!force && state.lines[id]?.requestHash === requestHash && fs.existsSync(outputPath)) continue;
    const response = await apiResponse(`${API_BASE_URL}/text-to-speech/${encodeURIComponent(line.voiceId)}?output_format=${encodeURIComponent(manifest.outputFormat)}`, { method: "POST", body: JSON.stringify(request) }, apiKey);
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
  if (manifest.schemaVersion !== 1) throw new Error("Faction interaction manifest schemaVersion must be 1.");
  const plan = buildPlan(manifest);
  if (args.command === "plan") return console.log(`Faction interaction voice plan: ${plan.length} lines across ${Object.keys(manifest.voiceIds).length} factions.`);
  if (args.command === "generate" || args.command === "all") await generate(manifest, root, args);
  if (args.command === "publish" || args.command === "all") console.log(`Published ${publish(manifest, root, args)} faction interaction voice files.`);
  if (!["plan", "generate", "publish", "all"].includes(args.command)) throw new Error(`Unknown command: ${args.command}`);
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { buildPlan, parseArgs };
