const fs = require("node:fs");
const path = require("node:path");

const SAMPLE_RATE = 48000;
const TAU = Math.PI * 2;

function seededNoise(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state / 0xffffffff) * 2 - 1;
  };
}

function envelope(time, duration, attack = 0.012, release = 0.7) {
  const inGain = Math.min(1, time / Math.max(attack, 0.001));
  const outStart = duration * (1 - release);
  const outGain = time < outStart ? 1 : Math.max(0, 1 - ((time - outStart) / Math.max(duration - outStart, 0.001)));
  return inGain * outGain * outGain;
}

function tone(time, frequency, duration, options = {}) {
  const endFrequency = options.endFrequency ?? frequency;
  const progress = Math.min(1, time / duration);
  const current = frequency + ((endFrequency - frequency) * progress);
  const harmonic = options.harmonic || 0;
  const base = Math.sin(TAU * current * time);
  const overtone = harmonic ? Math.sin(TAU * current * 2.01 * time) * harmonic : 0;
  return (base + overtone) * envelope(time, duration, options.attack, options.release);
}

function eventAt(time, start, duration, render) {
  if (time < start || time > start + duration) return 0;
  return render(time - start, duration);
}

function normalize(samples, peak = 0.78) {
  const maximum = samples.reduce((value, sample) => Math.max(value, Math.abs(sample)), 0) || 1;
  return samples.map((sample) => (sample / maximum) * peak);
}

function renderSound(duration, seed, render) {
  const noise = seededNoise(seed);
  const count = Math.ceil(duration * SAMPLE_RATE);
  const samples = Array.from({ length: count }, (_, index) => render(index / SAMPLE_RATE, noise));
  return normalize(samples);
}

function writeWave24(filePath, samples) {
  const bytesPerSample = 3;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(24, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  samples.forEach((sample, index) => {
    const value = Math.max(-8388608, Math.min(8388607, Math.round(sample * 8388607)));
    buffer.writeUIntLE(value < 0 ? value + 0x1000000 : value, 44 + (index * bytesPerSample), 3);
  });
  fs.writeFileSync(filePath, buffer);
}

const SOUNDS = {
  "ui-select": [0.075, 11, (t) => tone(t, 430, 0.075, { endFrequency: 610, harmonic: 0.14, release: 0.85 })],
  "ui-confirm": [0.13, 12, (t) => eventAt(t, 0, 0.1, (x, d) => tone(x, 560, d, { endFrequency: 720, harmonic: 0.2 })) + eventAt(t, 0.045, 0.085, (x, d) => tone(x, 820, d, { harmonic: 0.12 }))],
  "ui-cancel": [0.11, 13, (t) => tone(t, 330, 0.11, { endFrequency: 170, harmonic: 0.25, release: 0.8 })],
  "priority-pass": [0.12, 14, (t, noise) => tone(t, 470, 0.12, { endFrequency: 650, harmonic: 0.08 }) + noise() * envelope(t, 0.12, 0.005, 0.95) * 0.09],
  "payment-discard": [0.52, 15, (t, noise) => [820, 680, 540].reduce((sum, f, i) => sum + eventAt(t, i * 0.065, 0.3, (x, d) => tone(x, f, d, { endFrequency: f * 0.72, harmonic: 0.38, release: 0.88 })), 0) + tone(t, 135, 0.48, { endFrequency: 92, harmonic: 0.18, attack: 0.002 }) * 0.22 + noise() * envelope(t, 0.34, 0.003, 0.95) * 0.12],
  "attack-declare": [0.68, 16, (t, noise) => tone(t, 145, 0.62, { endFrequency: 430, harmonic: 0.32, attack: 0.018, release: 0.72 }) + eventAt(t, 0.22, 0.4, (x, d) => tone(x, 510, d, { endFrequency: 980, harmonic: 0.14, attack: 0.008, release: 0.86 })) + noise() * envelope(t, 0.52, 0.012, 0.78) * Math.min(0.5, 0.08 + t * 0.8)],
  "block-declare": [0.64, 17, (t, noise) => tone(t, 245, 0.58, { endFrequency: 190, harmonic: 0.62, attack: 0.002, release: 0.9 }) + tone(t, 490, 0.48, { endFrequency: 405, harmonic: 0.3, attack: 0.001, release: 0.92 }) + eventAt(t, 0.14, 0.46, (x, d) => tone(x, 760, d, { endFrequency: 610, harmonic: 0.2, release: 0.94 })) + noise() * envelope(t, 0.18, 0.001, 0.97) * 0.24],
  "damage-impact": [0.78, 18, (t, noise) => tone(t, 92, 0.76, { endFrequency: 48, harmonic: 0.78, attack: 0.001, release: 0.92 }) + eventAt(t, 0.06, 0.32, (x, d) => tone(x, 176, d, { endFrequency: 72, harmonic: 0.55, attack: 0.001, release: 0.92 })) + noise() * envelope(t, 0.34, 0.001, 0.98) * 0.82],
  "priority-transfer": [0.7, 19, (t) => tone(t, 390, 0.66, { endFrequency: 820, harmonic: 0.24, attack: 0.025, release: 0.82 }) + eventAt(t, 0.28, 0.4, (x, d) => tone(x, 960, d, { endFrequency: 1180, harmonic: 0.12, release: 0.9 }))],
  "turn-start": [0.95, 20, (t) => [392, 523.25, 659.25, 880].reduce((sum, f, i) => sum + eventAt(t, i * 0.14, 0.5, (x, d) => tone(x, f, d, { harmonic: 0.2, release: 0.88 })), 0) + tone(t, 98, 0.9, { endFrequency: 74, harmonic: 0.18, attack: 0.01 }) * 0.18],
  "card-place": [0.32, 21, (t, noise) => tone(t, 155, 0.3, { endFrequency: 92, harmonic: 0.45, attack: 0.001, release: 0.9 }) + eventAt(t, 0.055, 0.24, (x, d) => tone(x, 310, d, { endFrequency: 190, harmonic: 0.28, release: 0.92 })) + noise() * envelope(t, 0.14, 0.001, 0.96) * 0.24],
  "card-draw": [0.38, 22, (t, noise) => tone(t, 470, 0.36, { endFrequency: 790, harmonic: 0.12, attack: 0.035, release: 0.84 }) + eventAt(t, 0.12, 0.25, (x, d) => tone(x, 740, d, { endFrequency: 980, harmonic: 0.08, release: 0.9 })) + noise() * envelope(t, 0.22, 0.005, 0.86) * 0.16],
  "ability-activate": [0.9, 23, (t) => tone(t, 275, 0.86, { endFrequency: 760, harmonic: 0.3, attack: 0.035, release: 0.82 }) + tone(t, 412.5, 0.78, { endFrequency: 1140, harmonic: 0.12, attack: 0.045, release: 0.88 }) + eventAt(t, 0.42, 0.46, (x, d) => tone(x, 920, d, { endFrequency: 1320, harmonic: 0.09, release: 0.92 }))],
  victory: [1.65, 24, (t) => [392, 523.25, 659.25, 783.99, 1046.5].reduce((sum, f, i) => sum + eventAt(t, i * 0.18, 0.86, (x, d) => tone(x, f, d, { harmonic: 0.22, release: 0.9 })), 0)],
  defeat: [1.65, 25, (t) => [392, 329.63, 261.63, 220, 164.81].reduce((sum, f, i) => sum + eventAt(t, i * 0.18, 0.86, (x, d) => tone(x, f, d, { harmonic: 0.3, release: 0.92 })), 0)]
};

function generateMatchSfx(outputDirectory = path.resolve("client/public/assets/gauntlet/match/sfx")) {
  fs.mkdirSync(outputDirectory, { recursive: true });
  Object.entries(SOUNDS).forEach(([name, [duration, seed, render]]) => {
    writeWave24(path.join(outputDirectory, `${name}.wav`), renderSound(duration, seed, render));
  });
  return Object.keys(SOUNDS);
}

if (require.main === module) {
  const generated = generateMatchSfx();
  console.log(`Generated ${generated.length} match SFX masters at ${SAMPLE_RATE} Hz / 24-bit mono.`);
}

module.exports = { generateMatchSfx, SOUNDS, SAMPLE_RATE };
