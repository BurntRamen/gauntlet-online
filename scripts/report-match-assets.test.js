const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { evaluateMatchAssets } = require("./report-match-assets");
const { generateMatchIcons } = require("./generate-match-icons");
const { generateMatchSfx, SAMPLE_RATE } = require("./generate-match-sfx");

test("asset report separates integrated and cutover-required missing files", () => {
  const publicDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-assets-"));
  try {
    const presentPath = path.join(publicDirectory, "assets/gauntlet/present.svg");
    fs.mkdirSync(path.dirname(presentPath), { recursive: true });
    fs.writeFileSync(presentPath, "<svg />");
    const result = evaluateMatchAssets({
      integrated: [{ id: "present", kind: "icon", path: "/assets/gauntlet/present.svg" }],
      cutoverRequired: [{ id: "missing", kind: "audio", path: "/assets/gauntlet/missing.ogg" }]
    }, publicDirectory);
    assert.equal(result.missingIntegrated.length, 0);
    assert.equal(result.missingCutover.length, 1);
    assert.equal(result.missingCutover[0].id, "missing");
  } finally {
    fs.rmSync(publicDirectory, { recursive: true, force: true });
  }
});

test("icon generator creates the complete editable SVG set", () => {
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-icons-"));
  try {
    const generated = generateMatchIcons(outputDirectory);
    assert.equal(generated.length, 14);
    const attack = fs.readFileSync(path.join(outputDirectory, "attack.svg"), "utf8");
    assert.match(attack, /viewBox="0 0 24 24"/);
    assert.match(attack, /#1E6BFF/);
  } finally {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  }
});

test("sound generator creates 48 kHz 24-bit mono PCM masters", () => {
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-sfx-"));
  try {
    const generated = generateMatchSfx(outputDirectory);
    assert.equal(generated.length, 15);
    const attack = fs.readFileSync(path.join(outputDirectory, "attack-declare.wav"));
    assert.equal(attack.toString("ascii", 0, 4), "RIFF");
    assert.equal(attack.toString("ascii", 8, 12), "WAVE");
    assert.equal(attack.readUInt16LE(22), 1);
    assert.equal(attack.readUInt32LE(24), SAMPLE_RATE);
    assert.equal(attack.readUInt16LE(34), 24);
  } finally {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  }
});
