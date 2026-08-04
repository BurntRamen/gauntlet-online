const fs = require("node:fs");
const path = require("node:path");

const REQUIRED_VISUAL_STATES = [
  "neutral-battlefield",
  "local-priority",
  "attack-selection",
  "payment-selection",
  "hand-attack",
  "lane-attack",
  "multiple-hand-blockers",
  "same-lane-block",
  "damage",
  "placement",
  "draw",
  "priority-transfer",
  "faction-ability",
  "disconnect",
  "reconnect-restored",
  "victory",
  "defeat",
  "draw-result"
];
const VISUAL_CATEGORIES = [
  "ruleClarity",
  "spacing",
  "cardReadability",
  "visualHierarchy",
  "interactionFeedback",
  "brandIdentity",
  "animationQuality"
];
const REQUIRED_PLAYTEST_TASKS = [
  "identifyPriority",
  "distinguishHandAndLaneAttack",
  "identifyAttackersBlockersPayment",
  "completeAttack",
  "completeBlock",
  "completePass",
  "completePlacement",
  "understandUnavailableAction",
  "followDamageAndMovement",
  "finishMatchWithoutDeveloperTools"
];
const REQUIRED_ZOOM_LEVELS = [80, 100, 125, 150, 175, 200];

function hasEvidenceOwner(entry) {
  return Boolean(String(entry?.reviewer || "").trim() && String(entry?.date || "").trim());
}

function evaluateExperienceGate(record = {}) {
  const failures = [];
  if (!String(record.rendererVersion || "").trim()) {
    failures.push("rendererVersion is required to identify the reviewed build.");
  }
  if (!String(record.rulesVersion || "").trim()) {
    failures.push("rulesVersion is required to identify the reviewed rules.");
  }
  const visualStates = new Map((record.visualStates || []).map((entry) => [entry.id, entry]));
  for (const stateId of REQUIRED_VISUAL_STATES) {
    const state = visualStates.get(stateId);
    if (!state) {
      failures.push(`Visual state "${stateId}" is missing.`);
      continue;
    }
    if (!hasEvidenceOwner(state)) {
      failures.push(`Visual state "${stateId}" needs a reviewer and date.`);
    }
    for (const category of VISUAL_CATEGORIES) {
      if (state.categories?.[category] !== "pass") {
        failures.push(`Visual state "${stateId}" has not passed ${category}.`);
      }
    }
  }

  const playtests = record.playtests || [];
  if (playtests.length < 5) {
    failures.push(`Five moderated playtests are required; found ${playtests.length}.`);
  }
  let newToSandbox = 0;
  let desktopParticipants = 0;
  let touchParticipants = 0;
  for (const [index, session] of playtests.entries()) {
    const label = session.participantId || `session ${index + 1}`;
    if (!session.participantId || !session.date || !session.observer) {
      failures.push(`Playtest ${label} needs participantId, date, and observer.`);
    }
    if (session.involvedInImplementation !== false) {
      failures.push(`Playtest ${label} must use a participant outside implementation.`);
    }
    if (session.usedDeveloperSandbox === false) newToSandbox += 1;
    if (session.inputKind === "desktop") desktopParticipants += 1;
    if (session.inputKind === "touch") touchParticipants += 1;
    if (session.facilitatorIntervention) {
      failures.push(`Playtest ${label} required facilitator intervention.`);
    }
    if (session.unresolvedCriticalConfusion) {
      failures.push(`Playtest ${label} has unresolved critical workflow confusion.`);
    }
    for (const task of REQUIRED_PLAYTEST_TASKS) {
      if (session.tasks?.[task] !== true) {
        failures.push(`Playtest ${label} did not pass ${task}.`);
      }
    }
  }
  if (newToSandbox < 3) {
    failures.push(`Three participants must be new to the developer sandbox; found ${newToSandbox}.`);
  }
  if (desktopParticipants < 1) failures.push("At least one desktop playtest is required.");
  if (touchParticipants < 1) failures.push("At least one touch playtest is required.");

  const zoomResults = new Map((record.manualZoom || []).map((entry) => [Number(entry.percent), entry]));
  for (const percent of REQUIRED_ZOOM_LEVELS) {
    const result = zoomResults.get(percent);
    if (!result?.passed || !hasEvidenceOwner(result)) {
      failures.push(`Manual browser zoom at ${percent}% has not passed with reviewer evidence.`);
    }
  }

  const deviceResults = record.targetDevices || [];
  const desktop = deviceResults.find((entry) => entry.kind === "desktop");
  const mobile = deviceResults.find((entry) => entry.kind === "mobile");
  const devicePasses = (entry, maximumLoadMs, minimumFps) => (
    Boolean(entry)
    && hasEvidenceOwner(entry)
    && Number.isFinite(Number(entry.p95UsableSceneMs))
    && Number(entry.p95UsableSceneMs) < maximumLoadMs
    && Number.isFinite(Number(entry.minimumFps))
    && Number(entry.minimumFps) >= minimumFps
    && entry.memoryStable === true
  );
  const desktopPassed = devicePasses(desktop, 3000, 60);
  const mobilePassed = devicePasses(mobile, 5000, 30);
  if (!desktopPassed) {
    failures.push("A passing desktop target-device result is required.");
  }
  if (!mobilePassed) {
    failures.push("A passing mobile target-device result is required.");
  }

  return {
    passed: failures.length === 0,
    failures,
    summary: {
      visualStatesPassed: REQUIRED_VISUAL_STATES.filter((stateId) => {
        const state = visualStates.get(stateId);
        return hasEvidenceOwner(state)
          && VISUAL_CATEGORIES.every((category) => state.categories?.[category] === "pass");
      }).length,
      requiredVisualStates: REQUIRED_VISUAL_STATES.length,
      playtestsRecorded: playtests.length,
      newToSandbox,
      desktopParticipants,
      touchParticipants,
      zoomLevelsPassed: REQUIRED_ZOOM_LEVELS.filter((percent) => {
        const result = zoomResults.get(percent);
        return result?.passed && hasEvidenceOwner(result);
      }).length,
      targetDeviceProfilesPassed: Number(desktopPassed) + Number(mobilePassed)
    }
  };
}

function runCli() {
  const defaultPath = path.resolve("artifacts/babylon-qualification/experience-gate.json");
  const recordPath = path.resolve(process.argv[2] || defaultPath);
  if (!fs.existsSync(recordPath)) {
    console.error(`Qualification record not found: ${recordPath}`);
    console.error(
      "Copy client/src/babylon/EXPERIENCE_GATE_TEMPLATE.json to that location "
      + "and record real review evidence."
    );
    process.exitCode = 1;
    return;
  }
  const result = evaluateExperienceGate(JSON.parse(fs.readFileSync(recordPath, "utf8")));
  console.log(JSON.stringify(result.summary, null, 2));
  if (!result.passed) {
    console.error(`Babylon experience gate failed with ${result.failures.length} finding(s):`);
    result.failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }
  console.log("Babylon human and target-device experience gate passed.");
}

if (require.main === module) runCli();

module.exports = {
  evaluateExperienceGate,
  REQUIRED_PLAYTEST_TASKS,
  REQUIRED_VISUAL_STATES,
  REQUIRED_ZOOM_LEVELS,
  VISUAL_CATEGORIES
};
