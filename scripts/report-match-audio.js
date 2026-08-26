const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const KIT_PATH = path.join(ROOT, "client/public/assets/gauntlet/match/kits/gauntlet-core-v1/kit.json");

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
  const frames = wave.samples.length / wave.channels;
  const durationSeconds = frames / wave.sampleRate;
  return {
    durationMs: Math.round(durationSeconds * 1000),
    sampleRate: wave.sampleRate,
    channels: wave.channels,
    peakDbfs: Number(dbfs(peak).toFixed(1)),
    rmsDbfs: Number(dbfs(rms).toFixed(1)),
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
  const assets = Object.values(kit.assets?.audio || {});
  const pathUseCounts = new Map();
  assets.forEach((asset) => pathUseCounts.set(asset.path, (pathUseCounts.get(asset.path) || 0) + 1));
  const rows = assets.map((asset) => {
    const filePath = runtimePath(asset.path);
    return {
      cue: asset.id,
      file: path.basename(filePath),
      uses: pathUseCounts.get(asset.path),
      ...analyzeWave(filePath)
    };
  });
  logger("Gauntlet production match-audio report");
  logger("cue                     file                     ms  peak    rms  crest lead tail uses");
  rows.forEach((row) => logger(
    `${row.cue.padEnd(23)} ${row.file.padEnd(23)} ${String(row.durationMs).padStart(4)} ${String(row.peakDbfs).padStart(5)} ${String(row.rmsDbfs).padStart(6)} ${String(row.crestDb).padStart(6)} ${String(row.leadingSilenceMs).padStart(4)} ${String(row.trailingSilenceMs).padStart(4)} ${String(row.uses).padStart(4)}`
  ));
  return rows;
}

if (require.main === module) reportMatchAudio();

module.exports = { analyzeWave, readWavePcm16, reportMatchAudio };
