const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { analyzeWave, reportMatchAudio } = require("./report-match-audio");

const ROOT = path.resolve(__dirname, "..");

test("production match WAV analysis reports timing and level", () => {
  const result = analyzeWave(path.join(ROOT, "client/public/assets/gauntlet/match/kits/gauntlet-core-v1/audio/card_settle.wav"));
  assert.equal(result.sampleRate, 48000);
  assert.equal(result.channels, 1);
  assert.ok(result.durationMs > 100);
  assert.ok(result.peakDbfs <= 0);
  assert.ok(result.rmsDbfs < result.peakDbfs);
});

test("production kit audio report covers every semantic cue", () => {
  const rows = reportMatchAudio(() => {});
  assert.equal(rows.length, 25);
  assert.ok(rows.some((row) => row.cue === "attack.declare"));
  assert.ok(rows.some((row) => row.cue === "combat.blocked"));
  assert.ok(rows.some((row) => row.cue === "damage.major"));
  assert.ok(rows.some((row) => row.cue === "match.defeat"));
});
