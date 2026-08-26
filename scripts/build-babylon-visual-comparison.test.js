const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildComparisonPackage,
  parseArgs,
  pickCapture
} = require("./build-babylon-visual-comparison");

function writeReview(directory, states, revision) {
  fs.mkdirSync(directory, { recursive: true });
  for (const state of states) {
    for (const capture of state.captures) {
      fs.writeFileSync(path.join(directory, capture.file), `fake image ${state.id} ${capture.viewport}`);
    }
  }
  fs.writeFileSync(path.join(directory, "manifest.json"), JSON.stringify({
    schemaVersion: 2,
    generatedAt: "2026-08-26T00:00:00.000Z",
    metadata: { branch: "codex/full-babylon-visuals", revision, shortRevision: revision.slice(0, 8) },
    states
  }));
}

test("comparison package pairs explicit mappings and reports unavailable baseline evidence", (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "babylon-comparison-"));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const before = path.join(temporaryRoot, "before");
  const after = path.join(temporaryRoot, "after");
  const outputRoot = path.join(temporaryRoot, "comparisons");
  const output = path.join(outputRoot, "candidate");
  writeReview(before, [{
    id: "live-priority",
    captures: [{ file: "live-priority--desktop.jpg", viewport: "desktop", width: 100, height: 50 }]
  }], "before-revision");
  writeReview(after, [
    {
      id: "live-priority",
      captures: [{ file: "live-priority--desktop.jpg", viewport: "desktop", width: 100, height: 50 }]
    },
    {
      id: "major-damage-resolution",
      captures: [{ file: "major-damage--desktop.jpg", viewport: "desktop-motion", width: 100, height: 50 }]
    }
  ], "after-revision");

  const result = buildComparisonPackage({
    before,
    after,
    output,
    outputRoot,
    mappings: [
      { id: "priority", label: "Priority", states: ["live-priority"], viewports: ["desktop"] },
      { id: "major", label: "Major", states: ["major-damage-resolution"], viewports: ["desktop-motion"] }
    ]
  });

  assert.equal(result.comparison.pairs[0].before.unavailable, false);
  assert.equal(result.comparison.pairs[0].after.unavailable, false);
  assert.equal(result.comparison.pairs[1].before.unavailable, true);
  assert.match(result.comparison.pairs[1].before.reason, /Baseline unavailable/);
  assert.equal(result.comparison.pairs[1].after.stateId, "major-damage-resolution");
  assert.ok(fs.existsSync(path.join(output, "index.html")));
  assert.ok(fs.existsSync(path.join(output, "comparison.json")));
  assert.match(fs.readFileSync(path.join(output, "index.html"), "utf8"), /Missing qualified frames are stated explicitly/);
});

test("comparison output is non-destructive and must remain inside its allowed root", (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "babylon-comparison-safe-"));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const before = path.join(temporaryRoot, "before");
  const after = path.join(temporaryRoot, "after");
  const outputRoot = path.join(temporaryRoot, "comparisons");
  const states = [{
    id: "state",
    captures: [{ file: "state.jpg", viewport: "desktop", width: 100, height: 50 }]
  }];
  writeReview(before, states, "before");
  writeReview(after, states, "after");
  const mappings = [{ id: "state", label: "State", states: ["state"], viewports: ["desktop"] }];
  assert.throws(() => buildComparisonPackage({
    before,
    after,
    output: path.join(temporaryRoot, "outside"),
    outputRoot,
    mappings
  }), /must be inside/);
  const output = path.join(outputRoot, "candidate");
  buildComparisonPackage({ before, after, output, outputRoot, mappings });
  assert.throws(() => buildComparisonPackage({ before, after, output, outputRoot, mappings }), /already exists/);
});

test("capture selection follows state and viewport preference order", () => {
  const manifest = {
    states: [{
      id: "fallback",
      captures: [
        { file: "portrait.jpg", viewport: "phone-portrait" },
        { file: "desktop.jpg", viewport: "desktop" }
      ]
    }]
  };
  assert.deepEqual(
    pickCapture(manifest, {
      states: ["missing", "fallback"],
      viewports: ["desktop", "phone-portrait"]
    }),
    { stateId: "fallback", capture: { file: "desktop.jpg", viewport: "desktop" } }
  );
});

test("CLI parsing requires named values", () => {
  assert.deepEqual(parseArgs(["--before", "a", "--after", "b", "--output", "c"]), {
    before: "a",
    after: "b",
    output: "c"
  });
  assert.throws(() => parseArgs(["--before"]), /Missing value/);
});
