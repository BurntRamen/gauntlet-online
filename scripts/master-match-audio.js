const fs = require("node:fs");
const path = require("node:path");

const { analyzeWave, readWavePcm16 } = require("./report-match-audio");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_ROOT = path.join(
  ROOT,
  "client/public/assets/gauntlet/match/kits/gauntlet-core-v1/audio/elevenlabs/sonic-identity-v2"
);
const OUTPUT_ROOT = path.join(SOURCE_ROOT, "mastered");

const MASTERS = Object.freeze([
  { source: "card_seat_apparatus_b.wav", output: "card_seat_apparatus_b_master.wav", thresholdDb: -30, ratio: 5, targetPeakDb: -8 },
  { source: "payment_commit_apparatus_b.wav", output: "payment_commit_apparatus_b_master.wav", thresholdDb: -28, ratio: 5, targetPeakDb: -6 },
  { source: "block_commit_apparatus_b.wav", output: "block_commit_apparatus_b_master.wav", thresholdDb: -28, ratio: 5, targetPeakDb: -5 },
  { source: "fully_blocked_absorption_b.wav", output: "fully_blocked_absorption_b_master.wav", thresholdDb: -24, ratio: 3, targetPeakDb: -5 },
  { source: "damage_consequence_apparatus_a.wav", output: "damage_consequence_apparatus_a_master.wav", thresholdDb: -28, ratio: 5, targetPeakDb: -4 },
  { source: "major_damage_consequence_b.wav", output: "major_damage_consequence_b_master.wav", thresholdDb: -24, ratio: 4, targetPeakDb: -3 },
  { source: "match_victory_apparatus_b.wav", output: "match_victory_apparatus_b_master.wav", thresholdDb: -32, ratio: 6, targetPeakDb: -3 },
  { source: "match_defeat_apparatus_a.wav", output: "match_defeat_apparatus_a_master.wav", thresholdDb: -22, ratio: 3, targetPeakDb: -4 },
  { source: "match_draw_apparatus_b.wav", output: "match_draw_apparatus_b_master.wav", thresholdDb: -34, ratio: 8, targetPeakDb: -3 }
]);

function decibelsToLinear(decibels) {
  return Math.pow(10, Number(decibels) / 20);
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
  samples.forEach((sample, index) => {
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sample * 32767))), 44 + index * 2);
  });
  return buffer;
}

function compressAndNormalize(samples, sampleRate, {
  thresholdDb,
  ratio,
  targetPeakDb,
  releaseMs = 90
}) {
  const input = Array.from(samples, (sample) => sample / 32768);
  const threshold = decibelsToLinear(thresholdDb);
  const release = Math.exp(-1 / Math.max(1, sampleRate * releaseMs / 1000));
  let envelope = 0;
  let peak = 0;
  const compressed = input.map((sample) => {
    const magnitude = Math.abs(sample);
    envelope = magnitude > envelope
      ? magnitude
      : release * envelope + (1 - release) * magnitude;
    let gain = 1;
    if (envelope > threshold) {
      const envelopeDb = 20 * Math.log10(Math.max(envelope, 1e-9));
      const compressedDb = thresholdDb + ((envelopeDb - thresholdDb) / ratio);
      gain = decibelsToLinear(compressedDb - envelopeDb);
    }
    const output = sample * gain;
    peak = Math.max(peak, Math.abs(output));
    return output;
  });
  const targetPeak = decibelsToLinear(targetPeakDb);
  const makeup = peak > 0 ? targetPeak / peak : 1;
  return compressed.map((sample) => sample * makeup);
}

function masterFile(inputPath, outputPath, settings) {
  const wave = readWavePcm16(inputPath);
  if (wave.channels !== 1 || wave.sampleRate !== 48000) {
    throw new Error(`${inputPath} must be 48 kHz mono PCM before mastering.`);
  }
  const mastered = compressAndNormalize(wave.samples, wave.sampleRate, settings);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, writeWavePcm16Mono(mastered, wave.sampleRate));
  return outputPath;
}

function masterMatchAudio(logger = console.log) {
  const rows = MASTERS.map((entry) => {
    const inputPath = path.join(SOURCE_ROOT, entry.source);
    const outputPath = path.join(OUTPUT_ROOT, entry.output);
    masterFile(inputPath, outputPath, entry);
    return {
      ...entry,
      before: analyzeWave(inputPath),
      after: analyzeWave(outputPath),
      outputPath
    };
  });
  logger("Gauntlet offline match-audio mastering");
  rows.forEach((row) => logger(
    `${row.output.padEnd(48)} active ${String(row.before.activeRmsDbfs).padStart(5)} -> ${String(row.after.activeRmsDbfs).padStart(5)} dBFS, peak ${row.after.peakDbfs} dBFS`
  ));
  return rows;
}

if (require.main === module) masterMatchAudio();

module.exports = {
  MASTERS,
  compressAndNormalize,
  masterFile,
  masterMatchAudio,
  writeWavePcm16Mono
};
