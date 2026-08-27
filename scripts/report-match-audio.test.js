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
  assert.ok(result.activeRmsDbfs >= result.rmsDbfs);
  assert.ok(result.activeDurationMs > 0);
  assert.ok(result.maxWindowRmsDbfs >= result.activeRmsDbfs);
});

test("production kit audio report covers every semantic cue", () => {
  const rows = reportMatchAudio(() => {});
  assert.equal(rows.length, 25);
  assert.ok(rows.some((row) => row.cue === "attack.declare"));
  assert.ok(rows.some((row) => row.cue === "combat.blocked"));
  assert.ok(rows.some((row) => row.cue === "damage.major"));
  assert.ok(rows.some((row) => row.cue === "match.defeat"));
  assert.equal(rows.find((row) => row.cue === "ui.hover").silent, true);
  assert.equal(rows.find((row) => row.cue === "attack.declare").tier, "commitment");
  const mixed = (cue) => rows.find((row) => row.cue === cue).postMixActiveRmsDbfs;
  assert.ok(mixed("attack.declare") > mixed("card.place"));
  assert.ok(mixed("combat.blocked") > mixed("attack.declare"));
  assert.ok(mixed("damage.major") > mixed("damage.impact"));
  assert.ok(mixed("match.victory") > mixed("damage.major"));
  rows.filter((row) => !row.silent).forEach((row) => {
    assert.ok(row.runtimeGain <= 1);
    assert.ok(row.postMixPeakDbfs < 0);
  });
  assert.match(
    rows.find((row) => row.cue === "card.place").file,
    /card_seat_apparatus_b_master\.wav$/
  );
  assert.match(
    rows.find((row) => row.cue === "attack.declare").file,
    /attack_commit_apparatus_b\.wav$/
  );
});
