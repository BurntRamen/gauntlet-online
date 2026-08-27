const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { analyzeWave } = require("./report-match-audio");
const { compressAndNormalize, masterFile, writeWavePcm16Mono } = require("./master-match-audio");

test("offline mastering reaches its requested peak without clipping", () => {
  const sampleRate = 48000;
  const samples = Array.from({ length: sampleRate / 2 }, (_, index) => {
    const carrier = Math.sin(index * Math.PI * 2 * 180 / sampleRate) * 0.08;
    return carrier + (index % 8000 === 0 ? 0.9 : 0);
  });
  const mastered = compressAndNormalize(samples.map((sample) => sample * 32767), sampleRate, {
    thresholdDb: -28,
    ratio: 5,
    targetPeakDb: -4
  });
  const peak = Math.max(...mastered.map(Math.abs));
  assert.ok(Math.abs((20 * Math.log10(peak)) - (-4)) < 0.1);
});

test("masterFile preserves browser-ready mono PCM timing", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-master-audio-"));
  const inputPath = path.join(directory, "input.wav");
  const outputPath = path.join(directory, "output.wav");
  const samples = Array.from({ length: 4800 }, (_, index) => Math.sin(index * Math.PI * 2 * 220 / 48000) * 0.4);
  fs.writeFileSync(inputPath, writeWavePcm16Mono(samples, 48000));
  masterFile(inputPath, outputPath, { thresholdDb: -24, ratio: 4, targetPeakDb: -5 });
  const result = analyzeWave(outputPath);
  assert.equal(result.sampleRate, 48000);
  assert.equal(result.channels, 1);
  assert.equal(result.durationMs, 100);
  assert.ok(Math.abs(result.peakDbfs - (-5)) < 0.2);
});
