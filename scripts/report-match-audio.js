const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const KIT_PATH = path.join(ROOT, "client/public/assets/gauntlet/match/kits/gauntlet-core-v1/kit.json");
const POLICY_PATH = path.join(ROOT, "client/src/babylon/matchAudioPolicy.json");

function dbfs(value) {
  return value > 0 ? 20 * Math.log10(value) : -Infinity;
}

function readWavePcm16(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error(`${filePath} is not a RIFF/WAVE file.`);
  }
  let offset = 12;
  let format = null;
  let data = null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === "fmt ") {
      format = {
        audioFormat: buffer.readUInt16LE(start),
        channels: buffer.readUInt16LE(start + 2),
        sampleRate: buffer.readUInt32LE(start + 4),
        bitsPerSample: buffer.readUInt16LE(start + 14)
      };
    }
    if (id === "data") data = buffer.subarray(start, start + size);
    offset = start + size + (size % 2);
  }
  if (!format || !data || format.audioFormat !== 1 || format.bitsPerSample !== 16) {
    throw new Error(`${filePath} must be 16-bit PCM WAV.`);
  }
  const samples = new Int16Array(data.length / 2);
  for (let index = 0; index < samples.length; index += 1) samples[index] = data.readInt16LE(index * 2);
  return { ...format, samples };
}

function analyzeWave(filePath) {
  const wave = readWavePcm16(filePath);
  let peak = 0;
  let sumSquares = 0;
  let differenceSquares = 0;
  let zeroCrossings = 0;
  const silenceThreshold = 32767 * Math.pow(10, -50 / 20);
  let firstAudible = wave.samples.length;
  let lastAudible = -1;
  for (let index = 0; index < wave.samples.length; index += 1) {
    const sample = wave.samples[index] / 32768;
    const magnitude = Math.abs(wave.samples[index]);
    peak = Math.max(peak, Math.abs(sample));
    sumSquares += sample * sample;
    if (magnitude >= silenceThreshold) {
      firstAudible = Math.min(firstAudible, index);
      lastAudible = index;
    }
    if (index > 0) {
      const prior = wave.samples[index - 1] / 32768;
      const difference = sample - prior;
      differenceSquares += difference * difference;
      if ((sample >= 0) !== (prior >= 0)) zeroCrossings += 1;
    }
  }
  const rms = Math.sqrt(sumSquares / Math.max(1, wave.samples.length));
  const derivativeRms = Math.sqrt(differenceSquares / Math.max(1, wave.samples.length - 1));
  const windowSamples = Math.max(wave.channels, Math.round(wave.sampleRate * 0.02) * wave.channels);
  let gatedSumSquares = 0;
  let gatedSampleCount = 0;
  let activeWindows = 0;
  let maxWindowRms = 0;
  for (let start = 0; start < wave.samples.length; start += windowSamples) {
    let windowSumSquares = 0;
    const end = Math.min(wave.samples.length, start + windowSamples);
    for (let index = start; index < end; index += 1) {
      const sample = wave.samples[index] / 32768;
      windowSumSquares += sample * sample;
    }
    const sampleCount = Math.max(1, end - start);
    const windowRms = Math.sqrt(windowSumSquares / sampleCount);
    maxWindowRms = Math.max(maxWindowRms, windowRms);
    if (dbfs(windowRms) >= -42) {
      gatedSumSquares += windowSumSquares;
      gatedSampleCount += sampleCount;
      activeWindows += 1;
    }
  }
  const activeRms = Math.sqrt(gatedSumSquares / Math.max(1, gatedSampleCount));
  const frames = wave.samples.length / wave.channels;
  const durationSeconds = frames / wave.sampleRate;
  return {
    durationMs: Math.round(durationSeconds * 1000),
    sampleRate: wave.sampleRate,
    channels: wave.channels,
    peakDbfs: Number(dbfs(peak).toFixed(1)),
    rmsDbfs: Number(dbfs(rms).toFixed(1)),
    activeRmsDbfs: Number(dbfs(activeRms).toFixed(1)),
    maxWindowRmsDbfs: Number(dbfs(maxWindowRms).toFixed(1)),
    activeDurationMs: activeWindows * 20,
    crestDb: Number((dbfs(peak) - dbfs(rms)).toFixed(1)),
    leadingSilenceMs: firstAudible === wave.samples.length ? Math.round(durationSeconds * 1000) : Math.round((firstAudible / wave.channels / wave.sampleRate) * 1000),
    trailingSilenceMs: lastAudible < 0 ? Math.round(durationSeconds * 1000) : Math.round(((wave.samples.length - lastAudible - 1) / wave.channels / wave.sampleRate) * 1000),
    zeroCrossingsPerSecond: Math.round(zeroCrossings / Math.max(durationSeconds, 0.001)),
    brightnessProxy: Number((derivativeRms / Math.max(rms, 1e-9)).toFixed(3))
  };
}

function runtimePath(assetPath) {
  return path.join(ROOT, "client/public", String(assetPath).replace(/^\//, ""));
}

function reportMatchAudio(logger = console.log) {
  const kit = JSON.parse(fs.readFileSync(KIT_PATH, "utf8"));
  const policyDocument = JSON.parse(fs.readFileSync(POLICY_PATH, "utf8"));
  const tierNames = Object.fromEntries(Object.entries(policyDocument.tiers).map(([name, value]) => [value, name.toLowerCase()]));
  const assets = Object.values(kit.assets?.audio || {});
  const pathUseCounts = new Map();
  assets.forEach((asset) => pathUseCounts.set(asset.path, (pathUseCounts.get(asset.path) || 0) + 1));
  const rows = assets.map((asset) => {
    const filePath = runtimePath(asset.path);
    const analysis = analyzeWave(filePath);
    const policy = policyDocument.policies[asset.id] || {};
    const referenceGain = Number(policy.referenceGain || 0);
    const runtimeGain = Math.max(0, Math.min(1, referenceGain * Math.pow(
      10,
      Number(policy.gainTrimDb || 0) / 20
    )));
    return {
      cue: asset.id,
      file: path.basename(filePath),
      uses: pathUseCounts.get(asset.path),
      ...analysis,
      tier: tierNames[policy.tier] || "unclassified",
      silent: policy.silent === true,
      runtimeGain: Number(runtimeGain.toFixed(3)),
      postMixActiveRmsDbfs: policy.silent === true || referenceGain <= 0
        ? null
        : Number((analysis.activeRmsDbfs + dbfs(runtimeGain)).toFixed(1)),
      postMixPeakDbfs: policy.silent === true || referenceGain <= 0
        ? null
        : Number((analysis.peakDbfs + dbfs(runtimeGain)).toFixed(1))
    };
  });
  logger("Gauntlet production match-audio report");
  logger("cue                     tier         file                     ms  peak active mixed mixPeak gain activeMs uses");
  rows.forEach((row) => logger(
    `${row.cue.padEnd(23)} ${row.tier.padEnd(12)} ${row.file.padEnd(23)} ${String(row.durationMs).padStart(4)} ${String(row.peakDbfs).padStart(5)} ${String(row.activeRmsDbfs).padStart(6)} ${String(row.silent ? "silent" : row.postMixActiveRmsDbfs ?? "n/a").padStart(6)} ${String(row.silent ? "silent" : row.postMixPeakDbfs ?? "n/a").padStart(7)} ${String(row.runtimeGain).padStart(4)} ${String(row.activeDurationMs).padStart(8)} ${String(row.uses).padStart(4)}`
  ));
  return rows;
}

if (require.main === module) reportMatchAudio();

module.exports = { analyzeWave, readWavePcm16, reportMatchAudio };
