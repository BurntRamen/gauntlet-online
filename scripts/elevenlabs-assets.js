const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_MANIFEST = "scripts/elevenlabs-assets.json";
const API_BASE_URL = "https://api.elevenlabs.io/v1";
const TERMINAL_STATUSES = new Set(["completed", "failed"]);
const REFERENCE_FIELDS = new Set([
  "start_frame", "end_frame", "image", "audio", "mask", "images", "videos", "audios"
]);
const MIME_EXTENSIONS = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav"
};
const INPUT_MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm"
};

function parseArgs(argv) {
  const args = { command: "plan", only: [] };
  const rest = [...argv];
  if (rest[0] && !rest[0].startsWith("--")) args.command = rest.shift();
  while (rest.length) {
    const token = rest.shift();
    if (token === "--confirm-cost") args.confirmCost = true;
    else if (token === "--force") args.force = true;
    else if (token === "--force-generation") args.forceGeneration = true;
    else if (token === "--retry-failed") args.retryFailed = true;
    else if (token === "--manifest") args.manifest = rest.shift();
    else if (token === "--only") args.only.push(...String(rest.shift() || "").split(",").filter(Boolean));
    else if (token.startsWith("--manifest=")) args.manifest = token.slice(11);
    else if (token.startsWith("--only=")) args.only.push(...token.slice(7).split(",").filter(Boolean));
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadLocalEnv(filePath, environment = process.env) {
  if (!fs.existsSync(filePath)) return environment;
  fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) return;
    const name = trimmed.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || environment[name]) return;
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    environment[name] = value;
  });
  return environment;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function resolveWorkspacePath(workspaceRoot, value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty path.`);
  const resolved = path.resolve(workspaceRoot, value);
  if (!isWithin(workspaceRoot, resolved)) throw new Error(`${label} must stay inside the workspace: ${value}`);
  return resolved;
}

function referenceDependencies(job) {
  const dependencies = [];
  Object.values(job.references || {}).flat().forEach((reference) => {
    if (reference && reference.job) dependencies.push(reference.job);
  });
  return dependencies;
}

function validateManifest(manifest, workspaceRoot) {
  if (manifest.schemaVersion !== 1) throw new Error("ElevenLabs asset manifest schemaVersion must be 1.");
  if (!Array.isArray(manifest.jobs) || manifest.jobs.length === 0) throw new Error("Manifest jobs must be a non-empty array.");
  resolveWorkspacePath(workspaceRoot, manifest.stagingDirectory, "stagingDirectory");
  resolveWorkspacePath(workspaceRoot, manifest.provenanceDirectory, "provenanceDirectory");
  const ids = new Set();
  for (const job of manifest.jobs) {
    if (!job.id || !/^[a-z0-9][a-z0-9-]*$/.test(job.id)) throw new Error(`Invalid job id: ${job.id || "(missing)"}`);
    if (ids.has(job.id)) throw new Error(`Duplicate job id: ${job.id}`);
    ids.add(job.id);
    if (!new Set(["image", "video", "sound-effect"]).has(job.kind)) throw new Error(`${job.id}: kind must be image, video, or sound-effect.`);
    if (!job.modelId || !job.prompt) throw new Error(`${job.id}: modelId and prompt are required.`);
    if (job.reviewStatus && !new Set(["provisional", "candidate", "approved"]).has(job.reviewStatus)) {
      throw new Error(`${job.id}: reviewStatus must be provisional, candidate, or approved.`);
    }
    const output = resolveWorkspacePath(workspaceRoot, job.clientOutput, `${job.id}.clientOutput`);
    const publicRoot = path.resolve(workspaceRoot, "client/public");
    if (!isWithin(publicRoot, output)) throw new Error(`${job.id}: clientOutput must be inside client/public.`);
    for (const [field, rawReference] of Object.entries(job.references || {})) {
      if (job.kind === "sound-effect") throw new Error(`${job.id}: sound-effect jobs do not accept media references.`);
      if (!REFERENCE_FIELDS.has(field)) throw new Error(`${job.id}: unsupported reference field ${field}.`);
      for (const reference of [rawReference].flat()) {
        if (!reference || Boolean(reference.job) === Boolean(reference.path)) {
          throw new Error(`${job.id}.${field}: reference must set exactly one of job or path.`);
        }
        if (reference.path) resolveWorkspacePath(workspaceRoot, reference.path, `${job.id}.${field}.path`);
      }
    }
  }
  for (const job of manifest.jobs) {
    for (const dependency of referenceDependencies(job)) {
      if (!ids.has(dependency)) throw new Error(`${job.id}: unknown referenced job ${dependency}.`);
      if (dependency === job.id) throw new Error(`${job.id}: a job cannot reference itself.`);
    }
  }
  topologicalJobs(manifest.jobs);
  return manifest;
}

function topologicalJobs(jobs, selectedIds = []) {
  const byId = new Map(jobs.map((job) => [job.id, job]));
  const requested = selectedIds.length ? selectedIds : jobs.map((job) => job.id);
  for (const id of requested) if (!byId.has(id)) throw new Error(`Unknown job selected by --only: ${id}`);
  const result = [];
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Circular job reference involving ${id}.`);
    visiting.add(id);
    referenceDependencies(byId.get(id)).forEach(visit);
    visiting.delete(id);
    visited.add(id);
    result.push(byId.get(id));
  }
  requested.forEach(visit);
  return result;
}

function selectedJobs(jobs, selectedIds = []) {
  if (!selectedIds.length) return jobs;
  const byId = new Map(jobs.map((job) => [job.id, job]));
  return selectedIds.map((id) => {
    const job = byId.get(id);
    if (!job) throw new Error(`Unknown job selected by --only: ${id}`);
    return job;
  });
}

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function writeWavePcm16Mono(samples, sampleRate) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  samples.forEach((sample, index) => buffer.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sample))), 44 + index * 2));
  return buffer;
}

function convertPcm16ToMonoWave(rawPcm, inputSampleRate, outputSampleRate = 48000, targetPeakDbfs = -6, inputChannels = 1) {
  if (rawPcm.length % 2 !== 0) throw new Error("Raw PCM response has an incomplete 16-bit sample.");
  if (!Number.isInteger(inputChannels) || inputChannels < 1) throw new Error("Raw PCM channel count must be a positive integer.");
  const interleavedSampleCount = rawPcm.length / 2;
  if (interleavedSampleCount % inputChannels !== 0) throw new Error("Raw PCM response has an incomplete audio frame.");
  const frameCount = interleavedSampleCount / inputChannels;
  const input = new Float64Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    let sum = 0;
    for (let channel = 0; channel < inputChannels; channel += 1) {
      sum += rawPcm.readInt16LE((frame * inputChannels + channel) * 2);
    }
    input[frame] = sum / inputChannels;
  }
  const outputLength = Math.max(1, Math.round(frameCount * outputSampleRate / inputSampleRate));
  const output = new Float64Array(outputLength);
  let peak = 0;
  for (let index = 0; index < outputLength; index += 1) {
    const sourcePosition = index * inputSampleRate / outputSampleRate;
    const left = Math.min(input.length - 1, Math.floor(sourcePosition));
    const right = Math.min(input.length - 1, left + 1);
    const fraction = sourcePosition - left;
    output[index] = input[left] + ((input[right] - input[left]) * fraction);
    peak = Math.max(peak, Math.abs(output[index]));
  }
  const targetPeak = 32767 * Math.pow(10, Number(targetPeakDbfs) / 20);
  const gain = peak > 0 ? Math.min(4, targetPeak / peak) : 1;
  return writeWavePcm16Mono(Array.from(output, (sample) => sample * gain), outputSampleRate);
}

function convertPcm16MonoToWave(rawPcm, inputSampleRate, outputSampleRate = 48000, targetPeakDbfs = -6) {
  return convertPcm16ToMonoWave(rawPcm, inputSampleRate, outputSampleRate, targetPeakDbfs, 1);
}

function mimeTypeForPath(filePath) {
  const mimeType = INPUT_MIME_TYPES[path.extname(filePath).toLowerCase()];
  if (!mimeType) throw new Error(`Unsupported local reference type: ${filePath}`);
  return mimeType;
}

function resolveReference(reference, workspaceRoot, state) {
  if (reference.job) {
    const dependency = state.jobs?.[reference.job];
    if (!dependency?.generationId || dependency.status !== "completed") {
      throw new Error(`Referenced job ${reference.job} has no completed generation.`);
    }
    return { type: "generation", generation_id: dependency.generationId };
  }
  const filePath = resolveWorkspacePath(workspaceRoot, reference.path, "reference.path");
  if (!fs.existsSync(filePath)) throw new Error(`Local reference does not exist: ${reference.path}`);
  const size = fs.statSync(filePath).size;
  if (size > 25 * 1024 * 1024) throw new Error(`Local inline reference exceeds ElevenLabs' 25 MB limit: ${reference.path}`);
  return {
    type: "inline_base64",
    content_base64: fs.readFileSync(filePath).toString("base64"),
    mime_type: reference.mimeType || mimeTypeForPath(filePath)
  };
}

function buildRequest(job, workspaceRoot, state) {
  const request = job.kind === "sound-effect"
    ? { text: job.prompt, model_id: job.modelId, ...(job.parameters || {}) }
    : { model_id: job.modelId, prompt: job.prompt, ...(job.parameters || {}) };
  for (const [field, value] of Object.entries(job.references || {})) {
    request[field] = Array.isArray(value)
      ? value.map((reference) => resolveReference(reference, workspaceRoot, state))
      : resolveReference(value, workspaceRoot, state);
  }
  return request;
}

async function apiJson(fetchImpl, url, options, apiKey) {
  const response = await fetchImpl(url, {
    ...options,
    headers: { "Content-Type": "application/json", "xi-api-key": apiKey, ...(options.headers || {}) }
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!response.ok) {
    const detail = body.detail || body.error_message || body.message || response.statusText;
    throw new Error(`ElevenLabs API ${response.status}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  }
  return body;
}

async function waitForGeneration({ fetchImpl, sleep, apiKey, apiBaseUrl, job, generationId, timeoutMs }) {
  const startedAt = Date.now();
  let interval = job.kind === "image" ? 2000 : 10000;
  while (Date.now() - startedAt < timeoutMs) {
    let result;
    try {
      result = await apiJson(fetchImpl, `${apiBaseUrl}/flows/${job.kind}/${generationId}`, { method: "GET" }, apiKey);
    } catch (error) {
      if (!/^ElevenLabs API 429:/.test(error.message)) throw error;
      await sleep(interval);
      interval = Math.min(60000, interval * 2);
      continue;
    }
    if (TERMINAL_STATUSES.has(result.status)) return result;
    await sleep(interval);
    interval = Math.min(60000, interval * 2);
  }
  throw new Error(`${job.id}: timed out waiting for generation ${generationId}. Run collect later to resume.`);
}

function extensionForResult(job, mimeType) {
  const extension = MIME_EXTENSIONS[mimeType];
  if (!extension) throw new Error(`${job.id}: unsupported result MIME type ${mimeType}.`);
  if (job.kind === "image" && !mimeType.startsWith("image/")) throw new Error(`${job.id}: expected image output, received ${mimeType}.`);
  if (job.kind === "video" && !mimeType.startsWith("video/")) throw new Error(`${job.id}: expected video output, received ${mimeType}.`);
  if (job.kind === "sound-effect" && !mimeType.startsWith("audio/")) throw new Error(`${job.id}: expected audio output, received ${mimeType}.`);
  return extension;
}

async function downloadResult(fetchImpl, job, result, stagingDirectory) {
  if (!result.content_url || !result.content_mime_type) throw new Error(`${job.id}: completed result is missing content metadata.`);
  const response = await fetchImpl(result.content_url);
  if (!response.ok) throw new Error(`${job.id}: result download failed with HTTP ${response.status}.`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error(`${job.id}: downloaded result was empty.`);
  const stagedPath = path.join(stagingDirectory, `${job.id}${extensionForResult(job, result.content_mime_type)}`);
  fs.mkdirSync(path.dirname(stagedPath), { recursive: true });
  fs.writeFileSync(stagedPath, buffer);
  return { stagedPath, sha256: sha256(buffer), bytes: buffer.length };
}

async function generateSoundEffect({ fetchImpl, apiKey, apiBaseUrl, job, request, stagingDirectory }) {
  const outputFormat = job.outputFormat || "mp3_44100_192";
  const url = `${apiBaseUrl}/sound-generation?output_format=${encodeURIComponent(outputFormat)}`;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
    body: JSON.stringify(request)
  });
  if (!response.ok) {
    const text = await response.text();
    let detail = text;
    try {
      const body = JSON.parse(text);
      detail = body.detail || body.error_message || body.message || text;
    } catch {
      // Retain the response text when the API does not return JSON.
    }
    throw new Error(`ElevenLabs API ${response.status}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  }
  let contentMimeType = String(response.headers.get("content-type") || "audio/mpeg").split(";")[0].trim().toLowerCase();
  let buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error(`${job.id}: generated sound effect was empty.`);
  if (outputFormat.startsWith("pcm_")) {
    const inputSampleRate = Number(outputFormat.split("_")[1]);
    if (!Number.isFinite(inputSampleRate)) throw new Error(`${job.id}: cannot determine PCM sample rate from ${outputFormat}.`);
    buffer = convertPcm16ToMonoWave(
      buffer,
      inputSampleRate,
      48000,
      job.postProcess?.targetPeakDbfs ?? -6,
      job.postProcess?.inputChannels ?? 2
    );
    contentMimeType = "audio/wav";
  }
  const stagedPath = path.join(stagingDirectory, `${job.id}${extensionForResult(job, contentMimeType)}`);
  fs.mkdirSync(path.dirname(stagedPath), { recursive: true });
  fs.writeFileSync(stagedPath, buffer);
  return {
    stagedPath,
    contentMimeType,
    sha256: sha256(buffer),
    bytes: buffer.length,
    characterCost: response.headers.get("character-cost") || null,
    requestId: response.headers.get("request-id") || response.headers.get("x-request-id") || null
  };
}

async function generateJobs({ manifest, workspaceRoot, selectedIds = [], apiKey, confirmCost, forceGeneration, retryFailed, fetchImpl = fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), apiBaseUrl = API_BASE_URL, timeoutByKind = { image: 300000, video: 1800000 } }) {
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is required for generation and collection.");
  const stagingDirectory = resolveWorkspacePath(workspaceRoot, manifest.stagingDirectory, "stagingDirectory");
  const statePath = path.join(stagingDirectory, "state.json");
  const state = fs.existsSync(statePath) ? readJson(statePath) : { schemaVersion: 1, jobs: {} };
  const jobs = topologicalJobs(manifest.jobs, selectedIds);
  for (const job of jobs) {
    const request = buildRequest(job, workspaceRoot, state);
    const requestHash = hashJson({ request, outputFormat: job.outputFormat || null });
    let jobState = state.jobs[job.id];
    const reusable = jobState?.requestHash === requestHash && !forceGeneration;
    if (reusable && jobState.status === "completed" && jobState.stagedPath && fs.existsSync(jobState.stagedPath)) continue;
    if (reusable && jobState.status === "failed" && !retryFailed) {
      throw new Error(`${job.id}: previous generation failed. Use --retry-failed --confirm-cost to submit it again.`);
    }
    if (job.kind === "sound-effect") {
      if (!confirmCost) throw new Error(`${job.id}: generation may spend ElevenLabs credits. Re-run with --confirm-cost.`);
      try {
        const generated = await generateSoundEffect({ fetchImpl, apiKey, apiBaseUrl, job, request, stagingDirectory });
        state.jobs[job.id] = {
          generationId: generated.requestId || `sound-effect:${requestHash.slice(0, 16)}`,
          requestId: generated.requestId,
          status: "completed",
          kind: job.kind,
          modelId: job.modelId,
          requestHash,
          submittedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          contentMimeType: generated.contentMimeType,
          stagedPath: generated.stagedPath,
          sha256: generated.sha256,
          bytes: generated.bytes,
          characterCost: generated.characterCost
        };
        writeJson(statePath, state);
      } catch (error) {
        state.jobs[job.id] = {
          generationId: null,
          status: "failed",
          kind: job.kind,
          modelId: job.modelId,
          requestHash,
          submittedAt: new Date().toISOString(),
          errorMessage: error.message
        };
        writeJson(statePath, state);
        throw error;
      }
      continue;
    }
    let generationId = reusable && ["pending", "generating", "completed"].includes(jobState?.status)
      ? jobState.generationId
      : null;
    if (!generationId) {
      if (!confirmCost) throw new Error(`${job.id}: generation may spend ElevenLabs credits. Re-run with --confirm-cost.`);
      const created = await apiJson(fetchImpl, `${apiBaseUrl}/flows/${job.kind}`, {
        method: "POST",
        body: JSON.stringify(request)
      }, apiKey);
      generationId = created.id;
      jobState = { generationId, status: created.status, kind: job.kind, modelId: job.modelId, requestHash, submittedAt: new Date().toISOString() };
      state.jobs[job.id] = jobState;
      writeJson(statePath, state);
    }
    const result = await waitForGeneration({ fetchImpl, sleep, apiKey, apiBaseUrl, job, generationId, timeoutMs: timeoutByKind[job.kind] });
    if (result.status === "failed") {
      Object.assign(jobState, { status: "failed", failureReason: result.failure_reason, errorMessage: result.error_message });
      writeJson(statePath, state);
      throw new Error(`${job.id}: ${result.failure_reason || "generation_failed"}: ${result.error_message || "Generation failed."}`);
    }
    const downloaded = await downloadResult(fetchImpl, job, result, stagingDirectory);
    Object.assign(jobState, {
      status: "completed",
      contentMimeType: result.content_mime_type,
      stagedPath: downloaded.stagedPath,
      sha256: downloaded.sha256,
      bytes: downloaded.bytes,
      completedAt: new Date().toISOString()
    });
    writeJson(statePath, state);
  }
  return state;
}

function publishJobs({ manifest, workspaceRoot, selectedIds = [], force = false }) {
  const stagingDirectory = resolveWorkspacePath(workspaceRoot, manifest.stagingDirectory, "stagingDirectory");
  const provenanceDirectory = resolveWorkspacePath(workspaceRoot, manifest.provenanceDirectory, "provenanceDirectory");
  const statePath = path.join(stagingDirectory, "state.json");
  if (!fs.existsSync(statePath)) throw new Error("No ElevenLabs staging state found. Generate an asset first.");
  const state = readJson(statePath);
  const jobs = selectedJobs(manifest.jobs, selectedIds);
  const prepared = jobs.map((job) => {
    const jobState = state.jobs?.[job.id];
    if (jobState?.status !== "completed" || !jobState.stagedPath) {
      throw new Error(`${job.id}: no completed staged asset is available.`);
    }
    const stagedPath = path.resolve(jobState.stagedPath);
    if (!isWithin(stagingDirectory, stagedPath) || !fs.existsSync(stagedPath)) {
      throw new Error(`${job.id}: staged asset is missing or outside the staging directory.`);
    }
    const outputPath = resolveWorkspacePath(workspaceRoot, job.clientOutput, `${job.id}.clientOutput`);
    if (fs.existsSync(outputPath) && !force) throw new Error(`${job.id}: ${job.clientOutput} already exists. Use --force to replace it.`);
    const expectedExtension = MIME_EXTENSIONS[jobState.contentMimeType];
    const outputExtension = path.extname(outputPath).toLowerCase();
    const extensionMatches = expectedExtension === outputExtension
      || (expectedExtension === ".jpg" && outputExtension === ".jpeg");
    if (!expectedExtension || !extensionMatches) {
      throw new Error(`${job.id}: clientOutput extension ${outputExtension || "(none)"} does not match ${jobState.contentMimeType}.`);
    }
    return { job, jobState, stagedPath, outputPath };
  });
  const published = [];
  for (const { job, jobState, stagedPath, outputPath } of prepared) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.copyFileSync(stagedPath, outputPath);
    const outputBuffer = fs.readFileSync(outputPath);
    const provenance = {
      schemaVersion: 1,
      status: job.reviewStatus || "provisional",
      approvalRequired: job.reviewStatus !== "approved",
      creator: job.kind === "sound-effect" ? "ElevenLabs Sound Effects API" : "ElevenLabs Image & Video API",
      jobId: job.id,
      kind: job.kind,
      modelId: job.modelId,
      prompt: job.prompt,
      parameters: job.parameters || {},
      references: job.references || {},
      generationId: jobState.generationId,
      generatedAt: jobState.completedAt,
      publishedAt: new Date().toISOString(),
      clientOutput: path.relative(workspaceRoot, outputPath).replaceAll(path.sep, "/"),
      contentMimeType: jobState.contentMimeType,
      bytes: outputBuffer.length,
      sha256: sha256(outputBuffer)
    };
    writeJson(path.join(provenanceDirectory, `${job.id}.json`), provenance);
    published.push({ jobId: job.id, outputPath, provenance });
  }
  return published;
}

function printPlan(manifest, jobs, workspaceRoot, logger = console.log) {
  logger("ElevenLabs development asset plan (no API calls made):");
  for (const job of jobs) {
    const dependencies = referenceDependencies(job);
    logger(`- ${job.id} [${job.kind}] ${job.modelId}`);
    logger(`  output: ${path.relative(workspaceRoot, resolveWorkspacePath(workspaceRoot, job.clientOutput, "clientOutput"))}`);
    if (dependencies.length) logger(`  depends on: ${dependencies.join(", ")}`);
  }
}

function usage() {
  return [
    "Usage: npm run assets:elevenlabs -- <plan|generate|collect|publish> [options]",
    "",
    "  plan                         Validate and display jobs; makes no API calls (default)",
    "  generate --confirm-cost      Submit/resume selected jobs and download to ignored staging",
    "  collect                      Resume polling already-submitted jobs; never submits a new job",
    "  publish                      Copy completed staging files into client/public with provenance",
    "",
    "Options: --only <id[,id]> --manifest <path> --force --force-generation --retry-failed"
  ].join("\n");
}

async function main(argv = process.argv.slice(2), dependencies = {}) {
  const workspaceRoot = dependencies.workspaceRoot || path.resolve(__dirname, "..");
  loadLocalEnv(path.join(workspaceRoot, ".env"));
  const args = parseArgs(argv);
  if (args.command === "help" || args.command === "--help") return console.log(usage());
  const manifestPath = resolveWorkspacePath(workspaceRoot, args.manifest || DEFAULT_MANIFEST, "manifest");
  const manifest = validateManifest(readJson(manifestPath), workspaceRoot);
  const jobs = topologicalJobs(manifest.jobs, args.only);
  if (args.command === "plan") return printPlan(manifest, jobs, workspaceRoot);
  if (args.command === "publish") {
    const published = publishJobs({ manifest, workspaceRoot, selectedIds: args.only, force: args.force });
    published.forEach(({ jobId, outputPath }) => console.log(`Published ${jobId} -> ${path.relative(workspaceRoot, outputPath)}`));
    return;
  }
  if (!new Set(["generate", "collect"]).has(args.command)) throw new Error(`Unknown command: ${args.command}\n\n${usage()}`);
  if (args.command === "collect") {
    const stagingDirectory = resolveWorkspacePath(workspaceRoot, manifest.stagingDirectory, "stagingDirectory");
    const statePath = path.join(stagingDirectory, "state.json");
    if (!fs.existsSync(statePath)) throw new Error("No ElevenLabs staging state found. Nothing can be collected.");
    const state = readJson(statePath);
    for (const job of jobs) {
      const current = state.jobs?.[job.id];
      if (!current?.generationId || !["pending", "generating", "completed"].includes(current.status)) {
        throw new Error(`${job.id}: collect only resumes an existing generation.`);
      }
    }
  }
  const state = await generateJobs({
    manifest,
    workspaceRoot,
    selectedIds: args.only,
    apiKey: process.env.ELEVENLABS_API_KEY,
    confirmCost: args.command === "generate" && args.confirmCost,
    forceGeneration: args.forceGeneration,
    retryFailed: args.retryFailed,
    ...dependencies
  });
  jobs.forEach((job) => console.log(`${job.id}: ${state.jobs[job.id].status} (${state.jobs[job.id].stagedPath || "not downloaded"})`));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  buildRequest,
  convertPcm16MonoToWave,
  convertPcm16ToMonoWave,
  generateJobs,
  loadLocalEnv,
  parseArgs,
  publishJobs,
  topologicalJobs,
  validateManifest
};
