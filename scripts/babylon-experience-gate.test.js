const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  evaluateExperienceGate,
  REQUIRED_PLAYTEST_TASKS,
  VISUAL_CATEGORIES
} = require("./babylon-experience-gate");
const { prepareQualificationPacket } = require("./prepare-babylon-qualification");
const os = require("node:os");

function loadTemplate() {
  return JSON.parse(fs.readFileSync(
    path.resolve(__dirname, "../client/src/babylon/EXPERIENCE_GATE_TEMPLATE.json"),
    "utf8"
  ));
}

test("the untouched experience record cannot pass qualification", () => {
  const result = evaluateExperienceGate(loadTemplate());
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((failure) => failure.includes("Five moderated playtests")));
  assert.ok(result.failures.some((failure) => failure.includes("desktop target-device")));
});

test("complete independent evidence passes the experience gate", () => {
  const record = loadTemplate();
  record.rendererVersion = "test-renderer";
  record.visualStates = record.visualStates.map((state, index) => ({
    ...state,
    reviewer: `reviewer-${index}`,
    date: "2026-07-31",
    categories: Object.fromEntries(VISUAL_CATEGORIES.map((category) => [category, "pass"]))
  }));
  record.playtests = Array.from({ length: 5 }, (_, index) => ({
    participantId: `anonymous-${index + 1}`,
    date: "2026-07-31",
    observer: "moderator",
    involvedInImplementation: false,
    usedDeveloperSandbox: index >= 3,
    inputKind: index === 4 ? "touch" : "desktop",
    facilitatorIntervention: false,
    unresolvedCriticalConfusion: false,
    tasks: Object.fromEntries(REQUIRED_PLAYTEST_TASKS.map((task) => [task, true]))
  }));
  record.manualZoom = record.manualZoom.map((entry) => ({
    ...entry,
    passed: true,
    reviewer: "zoom-reviewer",
    date: "2026-07-31"
  }));
  record.targetDevices = [
    {
      kind: "desktop",
      reviewer: "device-reviewer",
      date: "2026-07-31",
      p95UsableSceneMs: 1800,
      minimumFps: 60,
      memoryStable: true
    },
    {
      kind: "mobile",
      reviewer: "device-reviewer",
      date: "2026-07-31",
      p95UsableSceneMs: 3600,
      minimumFps: 30,
      memoryStable: true
    }
  ];

  const result = evaluateExperienceGate(record);
  assert.equal(result.passed, true, result.failures.join("\n"));
  assert.equal(result.summary.visualStatesPassed, 18);
  assert.equal(result.summary.newToSandbox, 3);
});

test("qualification packet preparation creates missing forms without overwriting evidence", () => {
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-qualification-"));
  const sourceDirectory = path.resolve(__dirname, "../client/src/babylon");

  try {
    const first = prepareQualificationPacket({ sourceDirectory, outputDirectory });
    assert.equal(first.results.length, 7);
    assert.ok(first.results.every((entry) => entry.created));
    assert.ok(fs.existsSync(path.join(outputDirectory, "experience-gate.json")));
    assert.ok(fs.existsSync(path.join(outputDirectory, "README.md")));
    assert.ok(fs.existsSync(path.join(outputDirectory, "playtest-session-5.md")));

    const evidencePath = path.join(outputDirectory, "playtest-session-1.md");
    fs.writeFileSync(evidencePath, "recorded evidence\n");
    const second = prepareQualificationPacket({ sourceDirectory, outputDirectory });
    assert.ok(second.results.every((entry) => !entry.created));
    assert.equal(fs.readFileSync(evidencePath, "utf8"), "recorded evidence\n");
  } finally {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  }
});
