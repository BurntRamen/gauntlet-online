const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { evaluateMatchAssets, evaluatePresentationKitAssets } = require("./report-match-assets");
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

test("presentation kit report distinguishes fallbacks from production cutover approval", () => {
  const publicDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-kit-"));
  try {
    const presentPath = path.join(publicDirectory, "assets/board.glb");
    fs.mkdirSync(path.dirname(presentPath), { recursive: true });
    fs.writeFileSync(presentPath, "glTF");
    const result = evaluatePresentationKitAssets({
      schemaVersion: "gauntlet.match-presentation.v1",
      kitId: "test-kit",
      assets: {
        modules: {
          board: { id: "board", path: "/assets/board.glb", status: "approved", requiredForCutover: true },
          lane: { id: "lane", path: "/assets/lane.glb", status: "provisional", requiredForCutover: true, fallback: "procedural.lane" }
        }
      }
    }, publicDirectory);
    assert.equal(result.entries.length, 2);
    assert.equal(result.missing.length, 1);
    assert.equal(result.approved.length, 1);
    assert.equal(result.provisional.length, 1);
    assert.equal(result.candidate.length, 0);
    assert.equal(result.cutoverBlockers.length, 1);
    assert.equal(result.cutoverBlockers[0].id, "lane");
    assert.equal(result.runtimeStructuralComposites.length, 0);
  } finally {
    fs.rmSync(publicDirectory, { recursive: true, force: true });
  }
});

test("presentation kit report verifies candidate file checksums", () => {
  const publicDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-kit-integrity-"));
  try {
    const presentPath = path.join(publicDirectory, "assets/board.webp");
    fs.mkdirSync(path.dirname(presentPath), { recursive: true });
    fs.writeFileSync(presentPath, "candidate-board");
    const result = evaluatePresentationKitAssets({
      assets: {
        materials: {
          board: {
            id: "board",
            path: "/assets/board.webp",
            checksum: "sha256:0000",
            status: "candidate",
            requiredForCutover: false
          }
        }
      }
    }, publicDirectory);
    assert.equal(result.entries[0].present, true);
    assert.equal(result.entries[0].checksumValid, false);
    assert.equal(result.integrityFailures.length, 1);
  } finally {
    fs.rmSync(publicDirectory, { recursive: true, force: true });
  }
});

test("the selected production kit has approved, present, checksum-valid cutover assets", () => {
  const repositoryRoot = path.resolve(__dirname, "..");
  const publicDirectory = path.join(repositoryRoot, "client/public");
  const kit = JSON.parse(fs.readFileSync(
    path.join(publicDirectory, "assets/gauntlet/match/kits/gauntlet-core-v1/kit.json"),
    "utf8"
  ));
  const requirements = JSON.parse(fs.readFileSync(
    path.join(repositoryRoot, "client/src/babylon/MATCH_ASSET_REQUIREMENTS.json"),
    "utf8"
  ));
  const kitResult = evaluatePresentationKitAssets(kit, publicDirectory);
  const requirementResult = evaluateMatchAssets(requirements, publicDirectory);

  assert.equal(kit.status, "approved");
  assert.equal(kitResult.cutoverBlockers.length, 0);
  assert.equal(kitResult.integrityFailures.length, 0);
  assert.equal(requirementResult.missingCutover.length, 0);
  assert.equal(kit.assets.modules["board.base"].requiredForCutover, false);
  assert.equal(kit.assets.materials["board.surface-overlay"].requiredForCutover, false);
  assert.equal(kit.assets.materials["board.surface-overlay"].referenceOnly, true);
  assert.equal(kit.assets.materials["board.surface-overlay"].runtimeSelectable, false);
  assert.equal(kit.assets.materials["board.surface-overlay"].structuralComposite, true);
  assert.equal(kitResult.runtimeStructuralComposites.length, 0);
  assert.equal(kit.assets.masks["lane.resolving"].status, "approved");
  assert.equal(kit.assets.effects["payment.release"].status, "approved");
  assert.equal(kit.assets.audio["attack.declare"].status, "approved");
});

test("strict reporting identifies a runtime structural board composite", () => {
  const result = evaluatePresentationKitAssets({
    assets: {
      materials: {
        board: {
          id: "board",
          role: "full-board-layout",
          format: "webp",
          path: "/assets/board.webp",
          status: "provisional",
          structuralComposite: true,
          runtimeSelectable: true,
          requiredForCutover: false
        }
      }
    }
  }, process.cwd());
  assert.equal(result.runtimeStructuralComposites.length, 1);
  assert.equal(result.runtimeStructuralComposites[0].id, "board");
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
