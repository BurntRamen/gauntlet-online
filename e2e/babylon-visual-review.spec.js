const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { test, expect } = require("@playwright/test");
const { io } = require("socket.io-client");

const SERVER_URL = "http://127.0.0.1:4100";
const REPOSITORY_ROOT = path.resolve(__dirname, "..");
const OUTPUT_ROOT = path.resolve(REPOSITORY_ROOT, "artifacts/babylon-visual-review");
const OUTPUT_DIRECTORY = path.resolve(
  process.env.BABYLON_REVIEW_OUTPUT || "artifacts/babylon-visual-review/current"
);
const REVIEW_REDUCED_MOTION = process.env.BABYLON_REVIEW_REDUCED_MOTION === "true"
  ? "reduce"
  : "no-preference";
const MATCH_RENDER_TIMEOUT_MS = 30000;
const PROTECTED_OUTPUT_DIRECTORIES = new Set([
  path.resolve(OUTPUT_ROOT, "full-babylon-2026-08-26")
]);
const VIEWPORTS = [
  { id: "desktop", width: 1366, height: 768 },
  { id: "ultrawide", width: 2560, height: 1080 },
  { id: "tablet-landscape", width: 1180, height: 820 },
  { id: "tablet-portrait", width: 820, height: 1180 },
  { id: "phone-landscape", width: 844, height: 390 },
  { id: "phone-portrait", width: 390, height: 844 }
];

function gitOutput(args, fallback = null) {
  try {
    return execFileSync("git", args, {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
  } catch {
    return fallback;
  }
}

function gitValue(args, fallback = null) {
  return String(gitOutput(args, "") || "").trim() || fallback;
}

function outputPathWithinReviewRoot(outputDirectory) {
  const relative = path.relative(OUTPUT_ROOT, outputDirectory);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function prepareOutputDirectory() {
  if (!outputPathWithinReviewRoot(OUTPUT_DIRECTORY)) {
    throw new Error(`BABYLON_REVIEW_OUTPUT must be inside ${OUTPUT_ROOT}. Received ${OUTPUT_DIRECTORY}.`);
  }
  if (PROTECTED_OUTPUT_DIRECTORIES.has(OUTPUT_DIRECTORY)) {
    throw new Error(`Refusing to overwrite preserved Babylon review evidence: ${OUTPUT_DIRECTORY}.`);
  }
  const namedOutput = Boolean(process.env.BABYLON_REVIEW_OUTPUT);
  if (namedOutput && fs.existsSync(OUTPUT_DIRECTORY) && process.env.BABYLON_REVIEW_OVERWRITE !== "true") {
    throw new Error(
      `Named Babylon review output already exists: ${OUTPUT_DIRECTORY}. `
      + "Choose a new name or explicitly set BABYLON_REVIEW_OVERWRITE=true."
    );
  }
  fs.rmSync(OUTPUT_DIRECTORY, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
}

function createReviewManifest() {
  const dirtyPaths = String(gitOutput(["status", "--porcelain"], ""))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((entry) => entry.slice(3));
  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    metadata: {
      revision: gitValue(["rev-parse", "HEAD"]),
      shortRevision: gitValue(["rev-parse", "--short=12", "HEAD"]),
      branch: gitValue(["branch", "--show-current"], "detached"),
      workingTreeDirty: dirtyPaths.length > 0,
      dirtyPaths,
      rulesVersion: "gauntlet-duel-v2",
      reducedMotion: REVIEW_REDUCED_MOTION,
      requestedSeed: process.env.BABYLON_REVIEW_SEED || null,
      outputDirectory: path.relative(REPOSITORY_ROOT, OUTPUT_DIRECTORY).replaceAll(path.sep, "/"),
      routePolicy: "tracked production routes and real socket rooms; no query fixtures"
    },
    scenarios: [],
    states: []
  };
}

function registerScenario(manifest, id, state, details = {}) {
  const scenario = {
    id,
    source: details.source || "real-socket-room",
    mode: state?.gameMode || details.mode || null,
    matchId: state?.matchId || details.matchId || null,
    seed: state?.seed || details.seed || null,
    rulesVersion: state?.rulesVersion || details.rulesVersion || "gauntlet-duel-v2",
    reducedMotion: REVIEW_REDUCED_MOTION
  };
  if (!manifest.scenarios.some((entry) => entry.id === scenario.id)) manifest.scenarios.push(scenario);
  return scenario;
}

function waitForEvent(socket, eventName, predicate = () => true, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`Timed out waiting for ${eventName}.`));
    }, timeoutMs);
    function onEvent(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timeout);
      socket.off(eventName, onEvent);
      resolve(payload);
    }
    socket.on(eventName, onEvent);
  });
}

async function connectSeedClient() {
  const socket = io(SERVER_URL, {
    autoConnect: false,
    forceNew: true,
    transports: ["websocket"]
  });
  const connected = waitForEvent(socket, "connect");
  socket.connect();
  await connected;
  return socket;
}

async function seedDuel({
  mode = "basic",
  factionId = "frumo",
  hostName = "Visual Host",
  guestName = "Visual Guest"
} = {}) {
  const host = await connectSeedClient();
  const hostAssignmentPromise = waitForEvent(host, "assign");
  host.emit("createRoom", { guestName: hostName });
  const hostAssignment = await hostAssignmentPromise;

  if (mode === "basic") {
    const basicLobbyPromise = waitForEvent(host, "lobbyState", (state) => state.gameMode === "basic");
    host.emit("setGameMode", { mode: "basic" });
    await basicLobbyPromise;
  }

  const guest = await connectSeedClient();
  const guestAssignmentPromise = waitForEvent(guest, "assign");
  const joinedPromise = waitForEvent(host, "lobbyState", (state) => state.players[2]?.accountName === guestName);
  guest.emit("joinRoom", { roomCode: hostAssignment.roomCode, guestName });
  const guestAssignment = await guestAssignmentPromise;
  await joinedPromise;

  if (mode === "factions") {
    const factionLobbyPromise = waitForEvent(host, "lobbyState", (state) => (
      state.players[1]?.factionId === factionId && state.players[2]?.factionId === factionId
    ));
    host.emit("selectFaction", { factionId });
    guest.emit("selectFaction", { factionId });
    await factionLobbyPromise;
  }

  const hostReadyPromise = waitForEvent(host, "lobbyState", (state) => state.players[1]?.readyToStart);
  host.emit("startGame");
  await hostReadyPromise;
  const hostStatePromise = waitForEvent(host, "state", (state) => state.phase === "priority");
  const guestStatePromise = waitForEvent(guest, "state", (state) => state.phase === "priority");
  guest.emit("startGame");
  const hostState = await hostStatePromise;
  const guestState = await guestStatePromise;
  host.disconnect();
  guest.disconnect();
  return {
    roomCode: hostAssignment.roomCode,
    players: {
      1: { assignment: hostAssignment, state: hostState },
      2: { assignment: guestAssignment, state: guestState }
    }
  };
}

async function seedBasicDuel(options = {}) {
  return seedDuel({ ...options, mode: "basic" });
}

async function openPlayer(browser, baseURL, duel, playerNumber) {
  const context = await browser.newContext({
    viewport: VIEWPORTS[0],
    reducedMotion: REVIEW_REDUCED_MOTION
  });
  try {
    const player = duel.players[playerNumber];
    await context.addInitScript(({ roomCode, reconnectToken, guestName }) => {
      localStorage.setItem("gauntlet_room_code", roomCode);
      localStorage.setItem("gauntlet_reconnect_token", reconnectToken);
      localStorage.setItem("gauntlet_role", "player");
      localStorage.setItem("gauntlet_guest_name", guestName);
    }, {
      roomCode: duel.roomCode,
      reconnectToken: player.assignment.reconnectToken,
      guestName: playerNumber === 1 ? "Visual Host" : "Visual Guest"
    });
    const page = await context.newPage();
    await page.goto(baseURL);
    await expect(page.getByTestId("production-babylon-match")).toBeVisible({ timeout: MATCH_RENDER_TIMEOUT_MS });
    return { context, page };
  } catch (error) {
    await context.close();
    throw error;
  }
}

async function openSpectator(browser, baseURL, duel, viewport = VIEWPORTS[4]) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: REVIEW_REDUCED_MOTION
  });
  try {
    await context.addInitScript(({ roomCode }) => {
      localStorage.setItem("gauntlet_room_code", roomCode);
      localStorage.setItem("gauntlet_role", "spectator");
    }, { roomCode: duel.roomCode });
    const page = await context.newPage();
    await page.goto(baseURL);
    await expect(page.getByTestId("production-babylon-match")).toBeVisible({ timeout: MATCH_RENDER_TIMEOUT_MS });
    return { context, page };
  } catch (error) {
    await context.close();
    throw error;
  }
}

function currentAction(page) {
  return page.getByRole("region", { name: "Current match action" });
}

async function openHandControls(page) {
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "h" })));
  await expect(page.getByRole("region", { name: "Keyboard match controls" })).toBeAttached();
}

async function clickHandCardByValue(page, direction = "lowest") {
  const buttons = page.locator('[data-match-zone="hand"]:not(:disabled)');
  const candidates = [];
  for (let index = 0; index < await buttons.count(); index += 1) {
    const button = buttons.nth(index);
    if (await button.getAttribute("aria-pressed") === "true") continue;
    const label = await button.getAttribute("aria-label") || "";
    candidates.push({ button, value: Number(label.match(/value\s+(\d+)/i)?.[1] || 0) });
  }
  candidates.sort((left, right) => direction === "highest"
    ? right.value - left.value
    : left.value - right.value);
  expect(candidates.length).toBeGreaterThan(0);
  await candidates[0].button.focus();
  await candidates[0].button.press("Enter");
  return candidates[0].value;
}

async function activateLaneButton(page, name) {
  const button = page.getByRole("button", { name, exact: true });
  await button.focus();
  await button.press("Enter");
}

async function payUntilEnabled(page, confirmationName) {
  const confirmation = currentAction(page).getByRole("button", { name: confirmationName });
  for (let count = 0; count < 8 && await confirmation.isDisabled(); count += 1) {
    await clickHandCardByValue(page, "highest");
  }
  await expect(confirmation).toBeEnabled();
}

async function pageWithBottomPriority(pages) {
  for (const page of pages) {
    if (await page.locator(".production-player-plate-bottom.has-priority").isVisible()) return page;
  }
  throw new Error("No live player page currently owns priority.");
}

async function pageWithBottomAction(pages, pattern) {
  let matchingIndex = -1;
  await expect.poll(async () => {
    matchingIndex = -1;
    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index];
      const ownsAction = await page.locator(".production-player-plate-bottom.has-priority").isVisible();
      const text = await currentAction(page).textContent();
      const turnMarkerText = await page.locator(".production-turn-marker").textContent();
      if (ownsAction && (pattern.test(text || "") || pattern.test(turnMarkerText || ""))) {
        matchingIndex = index;
        break;
      }
    }
    return matchingIndex;
  }, { timeout: 20000 }).toBeGreaterThanOrEqual(0);
  return pages[matchingIndex];
}

async function waitForMotionRole(
  page,
  role,
  {
    latch = false,
    latchDelayMs = 0,
    latchProgress = null,
    eventType = null,
    occurrenceIds = null
  } = {}
) {
  const canvas = page.locator("canvas.babylon-match-canvas");
  return canvas.evaluate((element, {
    expectedRole,
    timeoutMs,
    shouldLatch,
    requestedLatchDelayMs,
    requestedLatchProgress,
    requiredEventType,
    requiredOccurrenceIds
  }) => new Promise((resolve, reject) => {
    const captureControl = element.__gauntletCaptureControl;
    if (typeof captureControl?.snapshot !== "function") {
      reject(new Error(`The Babylon renderer-frame capture control is unavailable for ${expectedRole}.`));
      return;
    }
    let frameRequest = null;
    let settled = false;
    let firstObservedAtMs = null;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      if (frameRequest != null) cancelAnimationFrame(frameRequest);
      clearTimeout(timer);
      callback(value);
    };
    const observedDiagnostics = (metrics = {}) => {
      const roles = metrics.activeMotionsByRole || {};
      const activeEventId = metrics.activeEventId || null;
      const activeEventType = metrics.activeEventType || null;
      const eventMatches = !requiredEventType || (
        activeEventType === requiredEventType && Boolean(activeEventId)
      );
      const rolePaths = eventMatches
        ? (metrics.activeMotionPaths || []).filter((motion) => (
            motion.role === expectedRole
            && (!requiredEventType || motion.sourceEventId === activeEventId)
            && (
              !Array.isArray(requiredOccurrenceIds)
              || requiredOccurrenceIds.includes(motion.occurrenceId)
            )
          ))
        : [];
      const occurrenceMatches = !Array.isArray(requiredOccurrenceIds)
        || (
          requiredOccurrenceIds.length > 0
          && requiredOccurrenceIds.every((occurrenceId) => (
            rolePaths.some((motion) => motion.occurrenceId === occurrenceId)
          ))
        );
      return {
        observedMotionRole: expectedRole,
        observedAtMs: performance.now(),
        activeCount: occurrenceMatches ? rolePaths.length : 0,
        activeTransitionCount: Number(metrics.activeTransitionCount || 0),
        activeMotionsByRole: roles,
        activeMotionPaths: metrics.activeMotionPaths || [],
        motionProgress: Math.max(0, ...rolePaths.map((motion) => Number(motion.progress || 0))),
        matchedMotionActorIds: rolePaths.map((motion) => motion.actorId),
        matchedMotionOccurrenceIds: rolePaths.map((motion) => motion.occurrenceId),
        matchedMotionSourceEventIds: rolePaths.map((motion) => motion.sourceEventId),
        motionMatchPolicy: requiredEventType && Array.isArray(requiredOccurrenceIds)
          ? "role-source-event-and-occurrence-identity"
          : requiredEventType
            ? "role-source-event-identity"
            : Array.isArray(requiredOccurrenceIds)
              ? "role-occurrence-identity"
              : "any-active-role-actor",
        requiredEventType,
        requiredOccurrenceIds,
        eventCorrelationVerified: eventMatches && (
          !requiredEventType
          || rolePaths.every((motion) => motion.sourceEventId === activeEventId)
        ),
        occurrenceCorrelationVerified: occurrenceMatches,
        actorsByZone: metrics.actorsByZone || {},
        activeEventId,
        activeEventType,
        focusRegion: metrics.boardPresentation?.focus?.region || null,
        rendererRevision: metrics.revision ?? null,
        rendererFrameSnapshot: true
      };
    };
    const sample = () => {
      let metrics;
      try {
        metrics = captureControl.snapshot() || {};
      } catch {
        frameRequest = requestAnimationFrame(sample);
        return;
      }
      const diagnostics = observedDiagnostics(metrics);
      if (diagnostics.activeCount <= 0) {
        if (shouldLatch && firstObservedAtMs != null) {
          const target = Number.isFinite(requestedLatchProgress)
            ? `progress ${requestedLatchProgress}`
            : `delay ${requestedLatchDelayMs}ms`;
          finish(reject, new Error(`${expectedRole} ended before its renderer-frame latch ${target}.`));
          return;
        }
        frameRequest = requestAnimationFrame(sample);
        return;
      }
      if (!shouldLatch) {
        finish(resolve, diagnostics);
        return;
      }
      if (firstObservedAtMs == null) firstObservedAtMs = performance.now();
      if (
        Number.isFinite(requestedLatchProgress)
        && diagnostics.motionProgress < requestedLatchProgress
      ) {
        frameRequest = requestAnimationFrame(sample);
        return;
      }
      if (performance.now() - firstObservedAtMs < requestedLatchDelayMs) {
        frameRequest = requestAnimationFrame(sample);
        return;
      }
      let capturePauseResult;
      try {
        capturePauseResult = captureControl.pause();
      } catch (error) {
        finish(reject, error);
        return;
      }
      const pausedDiagnostics = observedDiagnostics(capturePauseResult?.metrics || {});
      if (
        Number(capturePauseResult?.depth || 0) < 1
        || Number(capturePauseResult?.playbackDepth || 0) < 1
        || pausedDiagnostics.activeCount < 1
      ) {
        if (
          Number(capturePauseResult?.depth || 0) > 0
          || Number(capturePauseResult?.playbackDepth || 0) > 0
        ) captureControl.resume?.();
        finish(reject, new Error(`${expectedRole} could not be frozen on its observed renderer frame.`));
        return;
      }
      finish(resolve, {
        ...pausedDiagnostics,
        firstObservedAtMs,
        requestedLatchDelayMs,
        requestedLatchProgress,
        capturePauseResult
      });
    };
    const timer = setTimeout(() => {
      finish(reject, new Error(`Timed out waiting for ${expectedRole} motion in renderer-frame metrics.`));
    }, timeoutMs);
    sample();
  }), {
    expectedRole: role,
    timeoutMs: 8000,
    shouldLatch: latch,
    requestedLatchDelayMs: Math.max(0, Number(latchDelayMs || 0)),
    requestedLatchProgress: Number.isFinite(latchProgress)
      ? Math.max(0, Math.min(0.95, Number(latchProgress)))
      : null,
    requiredEventType: eventType || null,
    requiredOccurrenceIds: Array.isArray(occurrenceIds) ? occurrenceIds : null
  });
}

async function waitForEventEffect(page, eventTypes, { latchProgress = 0.22 } = {}) {
  const canvas = page.locator("canvas.babylon-match-canvas");
  const expectedTypes = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
  return canvas.evaluate((element, {
    requiredEventTypes,
    requiredEffectProgress,
    timeoutMs
  }) => new Promise((resolve, reject) => {
    const captureControl = element.__gauntletCaptureControl;
    if (typeof captureControl?.snapshot !== "function") {
      reject(new Error(`The Babylon renderer-frame capture control is unavailable for ${requiredEventTypes.join("/")}.`));
      return;
    }
    let frameRequest = null;
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      if (frameRequest != null) cancelAnimationFrame(frameRequest);
      clearTimeout(timer);
      callback(value);
    };
    const observedDiagnostics = (metrics = {}) => {
      const activeEventType = metrics.activeEventType || null;
      const activeEventId = metrics.activeEventId || null;
      const activeEffectEventType = metrics.activeEffectEventType || null;
      const activeEffectOccurrenceId = metrics.activeEffectOccurrenceId || null;
      const activeEffectSourceEventId = metrics.activeEffectSourceEventId || null;
      const activeEffectProgress = Number(metrics.activeEffectProgress || 0);
      const eventMatches = Boolean(activeEventId) && requiredEventTypes.includes(activeEventType);
      const effectMatches = Number(metrics.activeEffects || 0) > 0
        && Boolean(metrics.activeEffectVisible)
        && requiredEventTypes.includes(activeEffectEventType)
        && Boolean(activeEffectOccurrenceId)
        && activeEffectSourceEventId === activeEventId
        && activeEffectProgress >= requiredEffectProgress;
      return {
        observedEventType: activeEventType,
        observedEventId: activeEventId,
        observedEffectEventType: activeEffectEventType,
        observedEffectOccurrenceId: activeEffectOccurrenceId,
        observedEffectSourceEventId: activeEffectSourceEventId,
        observedEffectProgress: activeEffectProgress,
        observedAtMs: performance.now(),
        activeEffects: Number(metrics.activeEffects || 0),
        eventEffectCorrelationVerified: eventMatches && effectMatches,
        requiredEventTypes,
        requiredEffectProgress,
        rendererRevision: metrics.revision ?? null,
        rendererFrameSnapshot: true
      };
    };
    const sample = () => {
      let metrics;
      try {
        metrics = captureControl.snapshot() || {};
      } catch {
        frameRequest = requestAnimationFrame(sample);
        return;
      }
      const diagnostics = observedDiagnostics(metrics);
      if (!diagnostics.eventEffectCorrelationVerified) {
        frameRequest = requestAnimationFrame(sample);
        return;
      }
      let capturePauseResult;
      try {
        capturePauseResult = captureControl.pause();
      } catch (error) {
        finish(reject, error);
        return;
      }
      const pausedDiagnostics = observedDiagnostics(capturePauseResult?.metrics || {});
      if (
        Number(capturePauseResult?.depth || 0) !== 1
        || Number(capturePauseResult?.playbackDepth || 0) !== 1
        || !pausedDiagnostics.eventEffectCorrelationVerified
        || pausedDiagnostics.observedEventId !== diagnostics.observedEventId
        || pausedDiagnostics.observedEffectOccurrenceId !== diagnostics.observedEffectOccurrenceId
        || pausedDiagnostics.observedEffectSourceEventId !== diagnostics.observedEffectSourceEventId
      ) {
        if (
          Number(capturePauseResult?.depth || 0) > 0
          || Number(capturePauseResult?.playbackDepth || 0) > 0
        ) captureControl.resume?.();
        finish(reject, new Error(`${requiredEventTypes.join("/")} could not be frozen on its renderer effect frame.`));
        return;
      }
      finish(resolve, {
        ...pausedDiagnostics,
        capturePauseResult
      });
    };
    const timer = setTimeout(() => {
      finish(reject, new Error(`Timed out waiting for ${requiredEventTypes.join("/")} renderer effect.`));
    }, timeoutMs);
    sample();
  }), {
    requiredEventTypes: expectedTypes.filter(Boolean),
    requiredEffectProgress: Math.max(0.01, Math.min(0.95, Number(latchProgress) || 0.22)),
    timeoutMs: 10000
  });
}

async function waitForActiveEvent(page, eventType) {
  const match = page.getByTestId("production-babylon-match");
  return match.evaluate((element, { expectedEventType, timeoutMs }) => new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      callback(value);
    };
    const sample = () => {
      const activeEventType = element.dataset.activeEventType || null;
      if (activeEventType === expectedEventType) {
        finish(resolve, {
          activeEventType,
          revision: Number(element.dataset.revision || 0),
          observedAtMs: performance.now()
        });
      }
    };
    const observer = new MutationObserver(sample);
    observer.observe(element, {
      attributes: true,
      attributeFilter: ["data-active-event-type"]
    });
    const timer = setTimeout(() => {
      finish(reject, new Error(`Timed out waiting for ${expectedEventType} playback presentation.`));
    }, timeoutMs);
    sample();
  }), { expectedEventType: eventType, timeoutMs: 10000 });
}

function expectedLayoutProfile(viewport) {
  const aspect = viewport.width / Math.max(1, viewport.height);
  if (viewport.height <= 420 && aspect > 1.45) return "short-landscape";
  if (aspect >= 2.7) return "ultrawide";
  if (aspect <= 0.72 || (viewport.width <= 920 && viewport.height >= 560 && aspect <= 1.25)) {
    return "portrait";
  }
  return "desktop";
}

async function captureLiveSceneSample(page) {
  const canvas = page.locator("canvas.babylon-match-canvas");
  return canvas.evaluate((element) => {
    const match = element.closest('[data-testid="production-babylon-match"]');
    const captureControl = element.__gauntletCaptureControl;
    if (!match) throw new Error("The Babylon match root is unavailable for capture diagnostics.");
    if (!captureControl?.snapshot) {
      throw new Error("The Babylon renderer snapshot control is unavailable for capture diagnostics.");
    }
    return {
      rendererMetrics: captureControl.snapshot(),
      attributes: {
        sceneContract: match.dataset.sceneContract || null,
        matchId: match.dataset.matchId || null,
        revision: Number(match.dataset.revision || 0),
        boardModuleCount: Number(match.dataset.boardModuleCount || 0),
        duplicateVisibleIdentityCount: Number(match.dataset.duplicateVisibleIdentityCount || 0),
        missingFaceArtCount: Number(match.dataset.missingFaceArtCount || 0),
        faceArtActorCount: Number(match.dataset.faceArtActorCount || 0),
        basicFaceArtActorCount: Number(match.dataset.basicFaceArtActorCount || 0),
        structuralCompositeRasterCount: Number(match.dataset.structuralCompositeRasterCount || 0),
        actorCount: Number(match.dataset.cardActorCount || 0),
        actorsByZone: JSON.parse(match.dataset.actorsByZone || "{}"),
        knownActorCount: Number(match.dataset.knownActorCount || 0),
        anonymousActorCount: Number(match.dataset.anonymousActorCount || 0),
        departingActorCount: Number(match.dataset.departingActorCount || 0),
        activeTransitionCount: Number(match.dataset.activeTransitionCount || 0),
        activeMotionsByRole: JSON.parse(match.dataset.activeMotionsByRole || "{}"),
        activeMotionPaths: JSON.parse(match.dataset.activeMotionPaths || "[]"),
        queuedTransitionCount: Number(match.dataset.queuedTransitionCount || 0),
        activeEffects: Number(match.dataset.activeEffects || 0),
        activeEventId: match.dataset.activeEventId || null,
        activeEventType: match.dataset.activeEventType || null,
        playbackCatchingUp: match.dataset.playbackCatchingUp === "true",
        playbackQueuedFrames: Number(match.dataset.playbackQueuedFrames || 0),
        rulesVersion: match.dataset.rulesVersion || null,
        ruleset: match.dataset.ruleset || null,
        reducedMotion: match.classList.contains("reduced-motion")
          || window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        layoutProfile: match.dataset.layoutProfile || null,
        focusRegion: match.dataset.focusRegion || null,
        handCombatModuleActive: match.dataset.handCombatModuleActive === "true",
        canvasWidth: element.clientWidth,
        canvasHeight: element.clientHeight
      }
    };
  });
}

function liveSceneSampleIsSettled(sample) {
  const renderer = sample?.rendererMetrics || {};
  const playback = sample?.attributes || {};
  const activeMotions = Object.values(renderer.activeMotionsByRole || {})
    .reduce((total, count) => total + Number(count || 0), 0);
  return (
    playback.playbackCatchingUp === false
    && playback.playbackQueuedFrames === 0
    && !playback.activeEventType
    && !renderer.activeEventType
    && !renderer.activeEffectEventType
    && Number(renderer.activeEffects || 0) === 0
    && Number(renderer.activeTransitionCount || 0) === 0
    && Number(renderer.queuedTransitionCount || 0) === 0
    && Number(renderer.departingActorCount || 0) === 0
    && activeMotions === 0
    && renderer.matchId === playback.matchId
    && Number(renderer.revision || 0) === Number(playback.revision || 0)
  );
}

async function setReviewViewport(page, viewport) {
  await page.setViewportSize(viewport);
  const canvas = page.locator("canvas.babylon-match-canvas");
  await expect(canvas).toBeVisible();
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  const surface = await canvas.evaluate((element) => ({
    width: element.clientWidth,
    height: element.clientHeight
  }));
  await expect.poll(async () => (
    await captureLiveSceneSample(page)
  ).rendererMetrics?.layoutProfile, { timeout: 10000 }).toBe(expectedLayoutProfile(surface));
}

async function expectNativeSceneDiagnostics(page) {
  const match = page.getByTestId("production-babylon-match");
  await expect(match).toHaveAttribute("data-scene-contract", "gauntlet.board-stage.native.v1");
  await expect(match).toHaveAttribute("data-board-module-count", "10");
  await expect(match).toHaveAttribute("data-duplicate-visible-identity-count", "0");
  await expect(match).toHaveAttribute("data-missing-face-art-count", "0");
  await expect(match).toHaveAttribute("data-structural-composite-raster-count", "0");
  return match;
}

async function waitForPlaybackSettled(page) {
  await expect.poll(async () => {
    const first = await captureLiveSceneSample(page);
    if (!liveSceneSampleIsSettled(first)) return false;
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    const second = await captureLiveSceneSample(page);
    return liveSceneSampleIsSettled(second)
      && second.rendererMetrics.matchId === first.rendererMetrics.matchId
      && Number(second.rendererMetrics.revision || 0) === Number(first.rendererMetrics.revision || 0);
  }, { timeout: 20000 }).toBe(true);
}

function mergeRendererDiagnostics(attributes, rendererMetrics) {
  if (!rendererMetrics) return attributes;
  const rendererValue = (key, fallback) => (
    Object.prototype.hasOwnProperty.call(rendererMetrics, key) ? rendererMetrics[key] : fallback
  );
  return {
    ...attributes,
    sceneContract: rendererValue("sceneContract", attributes.sceneContract),
    matchId: rendererValue("matchId", attributes.matchId),
    boardModuleCount: rendererValue("boardModuleCount", attributes.boardModuleCount),
    duplicateVisibleIdentityCount: rendererValue(
      "duplicateVisibleIdentityCount",
      attributes.duplicateVisibleIdentityCount
    ),
    missingFaceArtCount: rendererValue("missingFaceArtCount", attributes.missingFaceArtCount),
    faceArtActorCount: rendererValue("faceArtActorCount", attributes.faceArtActorCount),
    basicFaceArtActorCount: rendererValue("basicFaceArtActorCount", attributes.basicFaceArtActorCount),
    structuralCompositeRasterCount: rendererValue(
      "structuralCompositeRasterCount",
      attributes.structuralCompositeRasterCount
    ),
    actorCount: rendererValue("cardActorCount", attributes.actorCount),
    actorsByZone: rendererValue("actorsByZone", attributes.actorsByZone),
    knownActorCount: rendererValue("knownActorCount", attributes.knownActorCount),
    anonymousActorCount: rendererValue("anonymousActorCount", attributes.anonymousActorCount),
    departingActorCount: rendererValue("departingActorCount", attributes.departingActorCount),
    activeTransitionCount: rendererValue("activeTransitionCount", attributes.activeTransitionCount),
    activeMotionsByRole: rendererValue("activeMotionsByRole", attributes.activeMotionsByRole),
    activeMotionPaths: rendererValue("activeMotionPaths", attributes.activeMotionPaths),
    queuedTransitionCount: rendererValue("queuedTransitionCount", attributes.queuedTransitionCount),
    activeEffects: rendererValue("activeEffects", attributes.activeEffects),
    activeEventId: rendererValue("activeEventId", attributes.activeEventId),
    activeEventType: rendererValue("activeEventType", attributes.activeEventType),
    activeEffectEventType: rendererValue("activeEffectEventType", null),
    activeEffectOccurrenceId: rendererValue("activeEffectOccurrenceId", null),
    activeEffectSourceEventId: rendererValue("activeEffectSourceEventId", null),
    activeEffectCueId: rendererValue("activeEffectCueId", null),
    activeEffectElapsedMs: rendererValue("activeEffectElapsedMs", 0),
    activeEffectDelayMs: rendererValue("activeEffectDelayMs", 0),
    activeEffectDurationMs: rendererValue("activeEffectDurationMs", 0),
    activeEffectProgress: rendererValue("activeEffectProgress", 0),
    activeEffectVisible: rendererValue("activeEffectVisible", false),
    rulesVersion: rendererValue("rulesVersion", attributes.rulesVersion),
    layoutProfile: rendererValue("layoutProfile", attributes.layoutProfile),
    focusRegion: Object.prototype.hasOwnProperty.call(rendererMetrics, "boardPresentation")
      ? rendererMetrics.boardPresentation?.focus?.region || null
      : attributes.focusRegion,
    handCombatModuleActive: rendererValue(
      "handCombatModuleActive",
      attributes.handCombatModuleActive
    ),
    rendererRevision: rendererValue("revision", null),
    rootRevision: attributes.revision,
    playbackCatchingUp: attributes.playbackCatchingUp,
    playbackQueuedFrames: attributes.playbackQueuedFrames,
    rendererFrameSnapshot: true
  };
}

async function captureDiagnostics(page, rendererMetrics = null) {
  const sample = await captureLiveSceneSample(page);
  const diagnostics = mergeRendererDiagnostics(
    sample.attributes,
    rendererMetrics || sample.rendererMetrics
  );
  expect(diagnostics.sceneContract).toBe("gauntlet.board-stage.native.v1");
  expect(diagnostics.boardModuleCount).toBe(10);
  expect(diagnostics.duplicateVisibleIdentityCount).toBe(0);
  expect(diagnostics.missingFaceArtCount).toBe(0);
  expect(diagnostics.structuralCompositeRasterCount).toBe(0);
  expect(diagnostics.actorCount).toBe(diagnostics.knownActorCount + diagnostics.anonymousActorCount);
  return diagnostics;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildIndex(manifest) {
  const metadata = manifest.metadata || {};
  const scenarios = (manifest.scenarios || []).map((scenario) => `
    <li><strong>${htmlEscape(scenario.id)}</strong> · ${htmlEscape(scenario.mode || scenario.source)} ·
    seed <code>${htmlEscape(scenario.seed || "unavailable")}</code></li>
  `).join("");
  const states = manifest.states.map((state) => `
    <section><h2>${htmlEscape(state.id)}</h2><div>${state.captures.map((capture) => `
      <figure><a href="${capture.file}"><img src="${capture.file}" alt="${htmlEscape(state.id)} at ${capture.viewport}"></a>
      <figcaption>${htmlEscape(capture.viewport)} · ${capture.width}×${capture.height}</figcaption></figure>
    `).join("")}</div></section>
  `).join("");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Gauntlet visual review</title>
    <style>body{margin:0 auto;max-width:1800px;padding:24px;background:#080c11;color:#e6e1d1;font-family:system-ui}section{margin:20px 0;padding:16px;border:1px solid #35404b;background:#12161d}section>div{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}figure{margin:0}img{width:100%;display:block}figcaption{padding:6px;color:#aeb8c2}code{color:#d9b86c}li{margin:.35rem 0}</style>
    <body><h1>Production-path Babylon visual review</h1>
    <p>Generated ${htmlEscape(manifest.generatedAt)} from <code>${htmlEscape(metadata.branch || "unknown")}</code>
    at <code>${htmlEscape(metadata.shortRevision || metadata.revision || "unknown")}</code> · rules
    <code>${htmlEscape(metadata.rulesVersion || "unknown")}</code> · reduced motion
    <code>${htmlEscape(metadata.reducedMotion || "unknown")}</code>${metadata.workingTreeDirty ? " · working tree dirty (see manifest)" : ""}.</p>
    <p>Every state was produced through a real room and tracked live/replay/training routes. No query fixture route was used.</p>
    <h2>Scenarios</h2><ul>${scenarios}</ul>${states}</body></html>`;
}

async function captureState(page, manifest, id, viewports = VIEWPORTS) {
  const record = { id, captures: [] };
  await page.evaluate(() => document.activeElement?.blur());
  for (const viewport of viewports) {
    await setReviewViewport(page, viewport);
    await page.waitForTimeout(80);
    const diagnostics = await captureDiagnostics(page);
    expect(diagnostics.layoutProfile).toBe(expectedLayoutProfile({
      width: diagnostics.canvasWidth,
      height: diagnostics.canvasHeight
    }));
    const file = `${id}--${viewport.id}.jpg`;
    const capturePath = path.join(OUTPUT_DIRECTORY, file);
    if (fs.existsSync(capturePath)) throw new Error(`Duplicate Babylon review capture path: ${file}`);
    await page.screenshot({ path: capturePath, type: "jpeg", quality: 86 });
    const dimensions = { width: diagnostics.canvasWidth, height: diagnostics.canvasHeight };
    expect(dimensions.width).toBeGreaterThan(300);
    expect(dimensions.height).toBeGreaterThan(200);
    record.captures.push({ file, viewport: viewport.id, ...dimensions, diagnostics });
  }
  manifest.states.push(record);
  return record;
}

function expectZonesEmpty(record, zones) {
  record.captures.forEach((capture) => {
    zones.forEach((zone) => {
      expect(capture.diagnostics.actorsByZone[zone] || 0).toBe(0);
    });
  });
}

function highestPrivateHandValue(duel) {
  const priority = Number(duel.players[1].state.priority);
  const hand = duel.players[priority]?.state?.players?.[priority]?.hand || [];
  return Math.max(0, ...hand.map((card) => Number(card.value || 0)));
}

async function seedMajorDamageDuel() {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const duel = await seedBasicDuel({
      hostName: `Major Host ${attempt}`,
      guestName: `Major Guest ${attempt}`
    });
    if (highestPrivateHandValue(duel) >= 8) return duel;
  }
  throw new Error("Could not seed a real Basic room with an opening major-damage attacker.");
}

async function captureMajorDamageScenario(browser, baseURL, manifest) {
  const duel = await seedMajorDamageDuel();
  registerScenario(manifest, "major-damage-live", duel.players[1].state);
  const opened = {
    1: await openPlayer(browser, baseURL, duel, 1),
    2: await openPlayer(browser, baseURL, duel, 2)
  };
  const attackerNumber = Number(duel.players[1].state.priority);
  const defenderNumber = attackerNumber === 1 ? 2 : 1;
  const attacker = opened[attackerNumber].page;
  const defender = opened[defenderNumber].page;

  await expect(attacker.getByTestId("production-babylon-match"))
    .toHaveAttribute("data-basic-face-art-actor-count", /^[1-9]\d*$/);
  const mobileSpectator = await openSpectator(browser, baseURL, duel, VIEWPORTS[4]);
  try {
    await openHandControls(attacker);
    const attackValue = await clickHandCardByValue(attacker, "highest");
    expect(attackValue).toBeGreaterThanOrEqual(8);
    await payUntilEnabled(attacker, "Confirm Attack");
    await currentAction(attacker).getByRole("button", { name: "Confirm Attack" }).click();
    await expect(currentAction(defender)).toContainText(/may block or decline/i);
    const lifeBefore = Number(
      await defender.locator(".production-player-plate-bottom .production-life strong").textContent()
    );
    const majorEventReady = waitForActiveEvent(defender, "damage.calculated");
    const mobileMajorEventReady = waitForActiveEvent(mobileSpectator.page, "damage.calculated");
    const majorDiscardReady = waitForMotionRole(defender, "discard-exit", {
      latch: true,
      latchProgress: 0.22,
      eventType: "damage.calculated"
    });
    const mobileMajorDiscardReady = waitForMotionRole(mobileSpectator.page, "discard-exit", {
      latch: true,
      latchProgress: 0.22,
      eventType: "damage.calculated"
    });
    await currentAction(defender).getByRole("button", { name: "Take Damage" }).click();
    const [, , observedMajorDiscard, observedMobileMajorDiscard] = await Promise.all([
      majorEventReady,
      mobileMajorEventReady,
      majorDiscardReady,
      mobileMajorDiscardReady
    ]);
    await pageMotionCapture(
      mobileSpectator.page,
      manifest,
      "mobile-major-damage-motion",
      0,
      VIEWPORTS[4],
      "phone-landscape-motion",
      observedMobileMajorDiscard
    );
    await pageMotionCapture(
      defender,
      manifest,
      "major-damage-resolution",
      0,
      VIEWPORTS[0],
      "desktop-motion",
      observedMajorDiscard
    );
    await expect.poll(async () => Number(
      await defender.locator(".production-player-plate-bottom .production-life strong").textContent()
    )).toBeLessThanOrEqual(lifeBefore - 8);
    await waitForPlaybackSettled(defender);
    await captureState(defender, manifest, "major-damage-final", [VIEWPORTS[0], VIEWPORTS[4], VIEWPORTS[5]]);
  } finally {
    await mobileSpectator.context.close();
    await Promise.all(Object.values(opened).map(({ context }) => context.close()));
  }
}

async function captureConcessionResult(attacker, defender, manifest) {
  const matchId = await defender.getByTestId("production-babylon-match").getAttribute("data-match-id");
  await setReviewViewport(attacker, VIEWPORTS[0]);
  const victoryEffectReady = waitForEventEffect(attacker, "match.ended");
  await defender.locator(".production-match-utilities > summary").click();
  await defender.getByRole("button", { name: "Concede", exact: true }).click();
  await defender.getByRole("group", { name: "Confirm concession" })
    .getByRole("button", { name: "Confirm" }).click();
  const observedVictoryEffect = await victoryEffectReady;
  await pageMotionCapture(
    attacker,
    manifest,
    "victory-result-transition",
    0,
    VIEWPORTS[0],
    "desktop-motion",
    observedVictoryEffect
  );
  await waitForPlaybackSettled(attacker);
  await captureState(attacker, manifest, "victory-result", [VIEWPORTS[0], VIEWPORTS[4], VIEWPORTS[5]]);
  await captureState(defender, manifest, "defeat-result", [VIEWPORTS[0]]);
  await expect(defender.locator(".production-match-result")).toBeVisible();
  return matchId;
}

async function captureFactionAbilityScenario(browser, baseURL, manifest) {
  const duel = await seedDuel({
    mode: "factions",
    factionId: "frumo",
    hostName: "Ability Host",
    guestName: "Ability Guest"
  });
  registerScenario(manifest, "faction-ability-live", duel.players[1].state);
  const playerNumber = Number(duel.players[1].state.priority);
  const opened = {};
  try {
    opened[1] = await openPlayer(browser, baseURL, duel, 1);
    opened[2] = await openPlayer(browser, baseURL, duel, 2);
    const page = opened[playerNumber].page;
    await expect(page.locator(".production-player-plate-top")).not.toContainText(/Disconnected/i);
    await openHandControls(page);
    const polea = page.locator(".production-faction-actions")
      .getByRole("button", { name: /Polea.*place a hand card/i });
    await expect(polea).toBeVisible();
    await polea.click();
    await clickHandCardByValue(page, "lowest");
    await activateLaneButton(page, "Lane 1");
    await captureState(page, manifest, "ability-activation-staged", [VIEWPORTS[0], VIEWPORTS[4]]);
    await page.setViewportSize(VIEWPORTS[0]);
    const placementMotionReady = waitForMotionRole(page, "placement-enter", {
      latch: true,
      latchProgress: 0.38
    });
    await currentAction(page).getByRole("button", { name: "Confirm Placement" }).click();
    const observedPlacement = await placementMotionReady;
    await pageMotionCapture(
      page,
      manifest,
      "ability-activation",
      0,
      VIEWPORTS[0],
      "desktop-motion",
      observedPlacement
    );
    await waitForPlaybackSettled(page);
    await captureState(page, manifest, "ability-activation-settled", [VIEWPORTS[0], VIEWPORTS[4], VIEWPORTS[5]]);
  } finally {
    await Promise.all(Object.values(opened).map(({ context }) => context.close()));
  }
}

test("capture real live and replay match presentation states", async ({ browser, baseURL }) => {
  test.setTimeout(900000);
  prepareOutputDirectory();
  const manifest = createReviewManifest();
  const duel = await seedBasicDuel();
  registerScenario(manifest, "basic-live", duel.players[1].state);
  const opened = {
    1: await openPlayer(browser, baseURL, duel, 1),
    2: await openPlayer(browser, baseURL, duel, 2)
  };
  const mobileSpectator = await openSpectator(browser, baseURL, duel, VIEWPORTS[4]);
  const attackerNumber = duel.players[1].state.priority;
  const defenderNumber = attackerNumber === 1 ? 2 : 1;
  const attacker = opened[attackerNumber].page;
  const defender = opened[defenderNumber].page;

  await expect(attacker.getByTestId("production-babylon-match"))
    .toHaveAttribute("data-basic-face-art-actor-count", /^[1-9]\d*$/);
  await waitForPlaybackSettled(defender);
  const neutralRest = await captureState(defender, manifest, "neutral-rest", [VIEWPORTS[0], VIEWPORTS[4], VIEWPORTS[5]]);
  neutralRest.captures.forEach((capture) => expect(capture.diagnostics.handCombatModuleActive).toBe(false));
  await captureState(attacker, manifest, "attack-available", [VIEWPORTS[0], VIEWPORTS[4], VIEWPORTS[5]]);
  await captureState(attacker, manifest, "live-priority");
  if (process.env.BABYLON_IDLE_ONLY === "true") {
    fs.writeFileSync(path.join(OUTPUT_DIRECTORY, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    fs.writeFileSync(path.join(OUTPUT_DIRECTORY, "index.html"), buildIndex(manifest));
    await mobileSpectator.context.close();
    await Promise.all(Object.values(opened).map(({ context }) => context.close()));
    return;
  }
  if (process.env.BABYLON_REVIEW_SUPPLEMENT_ONLY === "true") {
    await captureConcessionResult(attacker, defender, manifest);
    await mobileSpectator.context.close();
    await Promise.all(Object.values(opened).map(({ context }) => context.close()));
    await captureMajorDamageScenario(browser, baseURL, manifest);
    await captureFactionAbilityScenario(browser, baseURL, manifest);
    fs.writeFileSync(path.join(OUTPUT_DIRECTORY, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    fs.writeFileSync(path.join(OUTPUT_DIRECTORY, "index.html"), buildIndex(manifest));
    return;
  }
  await attacker.setViewportSize(VIEWPORTS[0]);
  await openHandControls(attacker);
  await clickHandCardByValue(attacker, "lowest");
  await attacker.waitForTimeout(720);
  await captureState(attacker, manifest, "attack-selected", VIEWPORTS.slice(0, 4));
  await attacker.setViewportSize(VIEWPORTS[0]);
  await payUntilEnabled(attacker, "Confirm Attack");
  await attacker.waitForTimeout(720);
  await captureState(attacker, manifest, "payment-staged");
  await setReviewViewport(attacker, VIEWPORTS[0]);
  const attackPaymentMotionReady = waitForMotionRole(attacker, "payment-enter", { latch: true });
  const attackEventReady = waitForActiveEvent(attacker, "attack.declared");
  await currentAction(attacker).getByRole("button", { name: "Confirm Attack" }).click();

  const observedAttackPayment = await attackPaymentMotionReady;
  const attackPaymentStart = await pageMotionCapture(
    attacker,
    manifest,
    "payment-transition-start",
    0,
    VIEWPORTS[0],
    "desktop-motion",
    observedAttackPayment
  );
  const activeAttackPayments = Number(attackPaymentStart.activeMotionsByRole["payment-enter"] || 0);
  expect(activeAttackPayments).toBeGreaterThan(0);
  if (activeAttackPayments > (attackPaymentStart.actorsByZone.payment || 0)) {
    throw new Error(`Unexpected payment motion fan-out: ${JSON.stringify(attackPaymentStart)}`);
  }
  expect(activeAttackPayments).toBeLessThanOrEqual(attackPaymentStart.actorsByZone.payment || 0);
  const attackPaymentPath = attackPaymentStart.activeMotionPaths.find((motion) => motion.role === "payment-enter")?.path || [];
  expect(attackPaymentPath.length).toBeGreaterThanOrEqual(2);
  expect(
    Math.max(...attackPaymentPath.map((point) => point.z)),
    JSON.stringify(attackPaymentStart.activeMotionPaths)
  ).toBeLessThan(0);
  const observedAttackPaymentMidpoint = await waitForMotionRole(attacker, "payment-enter", {
    latch: true,
    latchProgress: 0.55,
    occurrenceIds: observedAttackPayment.matchedMotionOccurrenceIds
  });
  await pageMotionCapture(
    attacker,
    manifest,
    "payment-transition-midpoint",
    0,
    VIEWPORTS[0],
    "desktop-motion",
    observedAttackPaymentMidpoint
  );
  const attackMotionReady = waitForMotionRole(attacker, "attack-enter", {
    latch: true,
    latchProgress: 0.12,
    eventType: "attack.declared"
  });
  await attackEventReady;
  const observedAttackStart = await attackMotionReady;
  await pageMotionCapture(
    attacker,
    manifest,
    "attack-transition-start",
    0,
    VIEWPORTS[0],
    "desktop-motion",
    observedAttackStart
  );
  const observedAttackMidpoint = await waitForMotionRole(attacker, "attack-enter", {
    latch: true,
    latchProgress: 0.55,
    eventType: "attack.declared",
    occurrenceIds: observedAttackStart.matchedMotionOccurrenceIds
  });
  await pageMotionCapture(
    attacker,
    manifest,
    "attack-transition-midpoint",
    0,
    VIEWPORTS[0],
    "desktop-motion",
    observedAttackMidpoint
  );

  await expect(currentAction(defender)).toContainText(/may block or decline/i);
  await waitForPlaybackSettled(attacker);
  const settledAttack = await captureState(attacker, manifest, "attack-settled", [VIEWPORTS[0]]);
  expectZonesEmpty(settledAttack, ["payment"]);
  const incomingHandAttack = await captureState(defender, manifest, "incoming-hand-attack", VIEWPORTS.slice(0, 4));
  incomingHandAttack.captures.forEach((capture) => expect(capture.diagnostics.handCombatModuleActive).toBe(true));
  await defender.setViewportSize(VIEWPORTS[0]);
  await openHandControls(defender);
  await clickHandCardByValue(defender, "lowest");
  await clickHandCardByValue(defender, "lowest");
  await expect(defender.locator('[data-match-zone="hand"][aria-pressed="true"]')).toHaveCount(2);
  const continueButton = currentAction(defender).getByRole("button", { name: /Choose Payment|Continue to Payment/ });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await payUntilEnabled(defender, "Confirm Block");
  await defender.waitForTimeout(720);
  await captureState(defender, manifest, "block-and-payment-staged");
  await setReviewViewport(defender, VIEWPORTS[0]);
  const blockPaymentMotionReady = waitForMotionRole(defender, "payment-enter", { latch: true });
  const blockEventReady = waitForActiveEvent(defender, "block.declared");
  const damageEventReady = waitForActiveEvent(defender, "damage.calculated");
  await currentAction(defender).getByRole("button", { name: "Confirm Block" }).click();
  const observedBlockPayment = await blockPaymentMotionReady;
  const blockPaymentStart = await pageMotionCapture(
    defender,
    manifest,
    "block-payment-transition-start",
    0,
    VIEWPORTS[0],
    "desktop-motion",
    observedBlockPayment
  );
  const activeBlockPayments = Number(blockPaymentStart.activeMotionsByRole["payment-enter"] || 0);
  expect(activeBlockPayments).toBeGreaterThan(0);
  expect(activeBlockPayments).toBeLessThanOrEqual(blockPaymentStart.actorsByZone.payment || 0);
  const blockPaymentPath = blockPaymentStart.activeMotionPaths.find((motion) => motion.role === "payment-enter")?.path || [];
  expect(blockPaymentPath.length).toBeGreaterThanOrEqual(2);
  expect(
    Math.max(...blockPaymentPath.map((point) => point.z)),
    JSON.stringify(blockPaymentStart.activeMotionPaths)
  ).toBeLessThan(0);
  const observedBlockPaymentMidpoint = await waitForMotionRole(defender, "payment-enter", {
    latch: true,
    latchProgress: 0.55,
    occurrenceIds: observedBlockPayment.matchedMotionOccurrenceIds
  });
  await pageMotionCapture(
    defender,
    manifest,
    "block-payment-transition-midpoint",
    0,
    VIEWPORTS[0],
    "desktop-motion",
    observedBlockPaymentMidpoint
  );
  const blockMotionReady = waitForMotionRole(defender, "block-enter", {
    latch: true,
    latchProgress: 0.12,
    eventType: "block.declared"
  });
  await blockEventReady;
  const observedBlockStart = await blockMotionReady;
  await pageMotionCapture(
    defender,
    manifest,
    "block-transition-start",
    0,
    VIEWPORTS[0],
    "desktop-motion",
    observedBlockStart
  );
  const observedBlockMidpoint = await waitForMotionRole(defender, "block-enter", {
    latch: true,
    latchProgress: 0.55,
    eventType: "block.declared",
    occurrenceIds: observedBlockStart.matchedMotionOccurrenceIds
  });
  await pageMotionCapture(
    defender,
    manifest,
    "block-transition-midpoint",
    0,
    VIEWPORTS[0],
    "desktop-motion",
    observedBlockMidpoint
  );
  const combatDiscardReady = waitForMotionRole(defender, "discard-exit", {
    latch: true,
    latchProgress: 0.2,
    eventType: "damage.calculated"
  });
  await damageEventReady;
  const observedCombatDiscard = await combatDiscardReady;
  await pageMotionCapture(
    defender,
    manifest,
    "combat-resolution",
    0,
    VIEWPORTS[0],
    "desktop-motion",
    observedCombatDiscard
  );
  await waitForPlaybackSettled(defender);
  const combatFinal = await captureState(defender, manifest, "combat-final", [VIEWPORTS[0]]);
  expectZonesEmpty(combatFinal, ["payment", "combat"]);
  if (process.env.BABYLON_REVIEW_COMBAT_ONLY === "true") {
    await mobileSpectator.context.close();
    await Promise.all(Object.values(opened).map(({ context }) => context.close()));
    fs.writeFileSync(path.join(OUTPUT_DIRECTORY, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    fs.writeFileSync(path.join(OUTPUT_DIRECTORY, "index.html"), buildIndex(manifest));
    return;
  }

  await defender.reload();
  await expect(defender.getByTestId("production-babylon-match")).toBeVisible();
  await openHandControls(defender);
  await waitForPlaybackSettled(defender);
  await captureState(defender, manifest, "reconnect-canonical", [VIEWPORTS[0]]);

  const livePages = [attacker, defender];
  const firstPassPage = await pageWithBottomPriority(livePages);
  const secondPassPage = firstPassPage === attacker ? defender : attacker;
  const priorityEffectReady = waitForEventEffect(secondPassPage, ["priority.granted", "priority.passed"]);
  await currentAction(firstPassPage).getByRole("button", { name: "Pass Priority" }).click();
  const observedPriorityEffect = await priorityEffectReady;
  await pageMotionCapture(
    secondPassPage,
    manifest,
    "priority-transfer",
    0,
    VIEWPORTS[0],
    "desktop-motion",
    observedPriorityEffect
  );
  await expect(secondPassPage.locator(".production-player-plate-bottom.has-priority")).toBeVisible();
  await currentAction(secondPassPage).getByRole("button", { name: "Pass Priority" }).click();

  let drawMotionPage = null;
  let drawMotionReady = null;
  for (let opportunity = 1; opportunity <= 6; opportunity += 1) {
    const actingPage = await pageWithBottomAction(livePages, new RegExp(`Placement ${opportunity} of 6`, "i"));
    await actingPage.setViewportSize(VIEWPORTS[0]);
    if (opportunity === 6) {
      drawMotionPage = actingPage;
      drawMotionReady = waitForMotionRole(drawMotionPage, "draw-enter", {
        latch: true,
        latchProgress: 0.35
      });
      await currentAction(actingPage).getByRole("button", { name: "Skip Lane" }).click();
      continue;
    }
    await clickHandCardByValue(actingPage, "lowest");
    if (opportunity === 1) {
      await captureState(actingPage, manifest, "placement-selected", [VIEWPORTS[0], VIEWPORTS[4], VIEWPORTS[5]]);
      await actingPage.setViewportSize(VIEWPORTS[0]);
    }
    const placementMotionReady = opportunity === 1
      ? waitForMotionRole(actingPage, "placement-enter", {
          latch: true,
          latchProgress: 0.12,
          eventType: "card.placedFacedown"
        })
      : null;
    await currentAction(actingPage).getByRole("button", { name: "Place Facedown" }).click();
    if (opportunity === 1) {
      const observedPlacementStart = await placementMotionReady;
      await pageMotionCapture(
        actingPage,
        manifest,
        "placement-transition-start",
        0,
        VIEWPORTS[0],
        "desktop-motion",
        observedPlacementStart
      );
      const observedPlacementMidpoint = await waitForMotionRole(actingPage, "placement-enter", {
        latch: true,
        latchProgress: 0.55,
        eventType: "card.placedFacedown",
        occurrenceIds: observedPlacementStart.matchedMotionOccurrenceIds
      });
      await pageMotionCapture(
        actingPage,
        manifest,
        "placement-transition-midpoint",
        0,
        VIEWPORTS[0],
        "desktop-motion",
        observedPlacementMidpoint
      );
      await waitForPlaybackSettled(actingPage);
      await captureState(actingPage, manifest, "placement-settled", [VIEWPORTS[0], VIEWPORTS[4], VIEWPORTS[5]]);
    }
  }

  const observedDrawMidpoint = await drawMotionReady;
  await pageMotionCapture(
    drawMotionPage,
    manifest,
    "draw-and-turn-transition",
    0,
    VIEWPORTS[0],
    "desktop-motion",
    observedDrawMidpoint
  );
  const turnTwoPage = await pageWithBottomAction(livePages, /Turn 2/i);
  await waitForPlaybackSettled(turnTwoPage);
  await captureState(turnTwoPage, manifest, "turn-two-draw-settled", [VIEWPORTS[0], VIEWPORTS[4], VIEWPORTS[5]]);

  const laneAttacker = await pageWithBottomPriority(livePages);
  const laneDefender = laneAttacker === attacker ? defender : attacker;
  await laneAttacker.setViewportSize(VIEWPORTS[0]);
  await activateLaneButton(laneAttacker, "Lane 1");
  await captureState(laneAttacker, manifest, "lane-attack-selected", [VIEWPORTS[0], VIEWPORTS[4], VIEWPORTS[5]]);
  await laneAttacker.setViewportSize(VIEWPORTS[0]);
  await payUntilEnabled(laneAttacker, "Confirm Attack");
  const laneAttackMotionReady = waitForMotionRole(laneAttacker, "attack-enter", {
    latch: true,
    latchProgress: 0.12,
    eventType: "attack.declared"
  });
  await currentAction(laneAttacker).getByRole("button", { name: "Confirm Attack" }).click();
  const observedLaneAttackStart = await laneAttackMotionReady;
  await pageMotionCapture(
    laneAttacker,
    manifest,
    "lane-attack-transition-start",
    0,
    VIEWPORTS[0],
    "desktop-motion",
    observedLaneAttackStart
  );
  const observedLaneAttackMidpoint = await waitForMotionRole(laneAttacker, "attack-enter", {
    latch: true,
    latchProgress: 0.55,
    eventType: "attack.declared",
    occurrenceIds: observedLaneAttackStart.matchedMotionOccurrenceIds
  });
  await pageMotionCapture(
    laneAttacker,
    manifest,
    "lane-attack-transition-midpoint",
    0,
    VIEWPORTS[0],
    "desktop-motion",
    observedLaneAttackMidpoint
  );
  await expect(currentAction(laneDefender)).toContainText(/attacked from Lane 1.*may block or decline/i);
  const laneDiscardMotionReady = waitForMotionRole(laneDefender, "discard-exit", {
    latch: true,
    latchProgress: 0.18,
    eventType: "damage.calculated"
  });
  const mobileDamageEventReady = waitForActiveEvent(mobileSpectator.page, "damage.calculated");
  const mobileDiscardCaptureReady = waitForMotionRole(mobileSpectator.page, "discard-exit", {
    latch: true,
    latchProgress: 0.18,
    eventType: "damage.calculated"
  })
    .then((observedMobileDiscard) => pageMotionCapture(
      mobileSpectator.page,
      manifest,
      "mobile-combat-motion",
      0,
      VIEWPORTS[4],
      "phone-landscape-motion",
      observedMobileDiscard
    ));
  await currentAction(laneDefender).getByRole("button", { name: "Take Damage" }).click();
  const [observedLaneDiscard] = await Promise.all([
    laneDiscardMotionReady,
    mobileDamageEventReady,
    mobileDiscardCaptureReady
  ]);
  await pageMotionCapture(
    laneDefender,
    manifest,
    "lane-damage-resolution",
    0,
    VIEWPORTS[0],
    "desktop-motion",
    observedLaneDiscard
  );
  const observedLaneDiscardDeparture = await waitForMotionRole(laneDefender, "discard-exit", {
    latch: true,
    latchProgress: 0.62,
    eventType: "damage.calculated",
    occurrenceIds: observedLaneDiscard.matchedMotionOccurrenceIds
  });
  await pageMotionCapture(
    laneDefender,
    manifest,
    "lane-discard-departure",
    0,
    VIEWPORTS[0],
    "desktop-motion",
    observedLaneDiscardDeparture
  );
  await waitForPlaybackSettled(laneDefender);
  const laneDamageFinal = await captureState(laneDefender, manifest, "lane-damage-final", [VIEWPORTS[0], VIEWPORTS[4], VIEWPORTS[5]]);
  expectZonesEmpty(laneDamageFinal, ["payment", "combat"]);

  const secondLaneAttacker = await pageWithBottomPriority(livePages);
  const secondLaneDefender = secondLaneAttacker === attacker ? defender : attacker;
  await secondLaneAttacker.setViewportSize(VIEWPORTS[0]);
  await activateLaneButton(secondLaneAttacker, "Lane 2");
  await payUntilEnabled(secondLaneAttacker, "Confirm Attack");
  await currentAction(secondLaneAttacker).getByRole("button", { name: "Confirm Attack" }).click();
  await expect(currentAction(secondLaneDefender)).toContainText(/attacked from Lane 2.*may block or decline/i);
  await activateLaneButton(secondLaneDefender, "Lane 2");
  await captureState(secondLaneDefender, manifest, "lane-block-selected", [VIEWPORTS[0], VIEWPORTS[4], VIEWPORTS[5]]);
  await secondLaneDefender.setViewportSize(VIEWPORTS[0]);
  await payUntilEnabled(secondLaneDefender, "Confirm Block");
  const laneBlockMotionReady = waitForMotionRole(secondLaneDefender, "block-enter", {
    latch: true,
    latchProgress: 0.12,
    eventType: "block.declared"
  });
  await currentAction(secondLaneDefender).getByRole("button", { name: "Confirm Block" }).click();
  const observedLaneBlockStart = await laneBlockMotionReady;
  await pageMotionCapture(
    secondLaneDefender,
    manifest,
    "lane-block-transition-start",
    0,
    VIEWPORTS[0],
    "desktop-motion",
    observedLaneBlockStart
  );
  const observedLaneBlockMidpoint = await waitForMotionRole(secondLaneDefender, "block-enter", {
    latch: true,
    latchProgress: 0.55,
    eventType: "block.declared",
    occurrenceIds: observedLaneBlockStart.matchedMotionOccurrenceIds
  });
  await pageMotionCapture(
    secondLaneDefender,
    manifest,
    "lane-block-transition-midpoint",
    0,
    VIEWPORTS[0],
    "desktop-motion",
    observedLaneBlockMidpoint
  );
  await waitForPlaybackSettled(secondLaneDefender);
  const laneBlockFinal = await captureState(secondLaneDefender, manifest, "lane-block-final", [VIEWPORTS[0], VIEWPORTS[4], VIEWPORTS[5]]);
  expectZonesEmpty(laneBlockFinal, ["payment", "combat"]);

  const matchId = await captureConcessionResult(attacker, defender, manifest);

  const replayContext = await browser.newContext({
    viewport: VIEWPORTS[0],
    reducedMotion: REVIEW_REDUCED_MOTION
  });
  const replayPage = await replayContext.newPage();
  await replayPage.goto(`${baseURL}/?match=${encodeURIComponent(matchId)}&replay=1`);
  await expect(replayPage.locator(".match-replay-page")).toBeVisible();
  await expect(replayPage.getByTestId("production-babylon-match")).toBeVisible();
  await expect(replayPage.getByTestId("production-babylon-match")).toHaveAttribute("data-presentation-status", "approved");
  await captureState(replayPage, manifest, "replay-action", VIEWPORTS.slice(0, 4));
  await replayPage.getByRole("button", { name: "Next action" }).click();
  await captureState(replayPage, manifest, "replay-next-action", VIEWPORTS.slice(0, 4));
  await replayPage.setViewportSize(VIEWPORTS[0]);
  await replayPage.getByRole("button", { name: "Next action" }).click();
  await captureState(replayPage, manifest, "replay-block-action", VIEWPORTS.slice(0, 4));
  for (let index = 0; index < 20; index += 1) {
    const actionText = await replayPage.locator(".replay-action-layer").textContent();
    if (/Lane [12]/i.test(actionText || "")) break;
    const nextAction = replayPage.getByRole("button", { name: "Next action" });
    if (await nextAction.isDisabled()) break;
    await nextAction.click();
  }
  await expect(replayPage.locator(".replay-action-layer")).toContainText(/Lane [12]/i);
  await captureState(replayPage, manifest, "replay-lane-action", [VIEWPORTS[0], VIEWPORTS[4], VIEWPORTS[5]]);
  await replayPage.setViewportSize(VIEWPORTS[0]);
  await replayPage.getByRole("button", { name: "Previous action" }).click();
  await expectNativeSceneDiagnostics(replayPage);
  await replayPage.getByRole("button", { name: "Next action" }).click();
  await expectNativeSceneDiagnostics(replayPage);
  await captureState(replayPage, manifest, "replay-seek-restored", [VIEWPORTS[0]]);

  const localContext = await browser.newContext({
    viewport: VIEWPORTS[0],
    reducedMotion: REVIEW_REDUCED_MOTION
  });
  const localPage = await localContext.newPage();
  await localPage.goto(baseURL, { waitUntil: "domcontentloaded" });
  await localPage.locator('button[data-area="identity"]').click();
  await localPage.getByLabel("Play as guest").check();
  await localPage.getByPlaceholder("Guest name").fill("Visual Local");
  await localPage.locator('button[data-area="play"]').click();
  await localPage.getByRole("tab", { name: "Practice" }).click();
  await localPage.getByRole("button", { name: /Basic vs AI/ }).click();
  await expect(localPage.getByTestId("production-babylon-match")).toBeVisible();
  const localMatch = localPage.getByTestId("production-babylon-match");
  registerScenario(manifest, "local-training", null, {
    source: "/training local adapter",
    mode: await localMatch.getAttribute("data-ruleset"),
    matchId: await localMatch.getAttribute("data-match-id"),
    seed: "gauntlet-demo-01",
    rulesVersion: await localMatch.getAttribute("data-rules-version")
  });
  await captureState(localPage, manifest, "local-training-native", VIEWPORTS);

  await replayContext.close();
  await localContext.close();
  await mobileSpectator.context.close();
  await Promise.all(Object.values(opened).map(({ context }) => context.close()));
  await captureMajorDamageScenario(browser, baseURL, manifest);
  await captureFactionAbilityScenario(browser, baseURL, manifest);
  fs.writeFileSync(path.join(OUTPUT_DIRECTORY, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(OUTPUT_DIRECTORY, "index.html"), buildIndex(manifest));
});

async function pageMotionCapture(
  page,
  manifest,
  id,
  delayMs = 0,
  viewport = VIEWPORTS[0],
  viewportId = "desktop-motion",
  observedMotion = null
) {
  const observedRole = observedMotion?.observedMotionRole || null;
  const observedEventType = observedMotion?.observedEventType || null;
  const hasAtomicObservation = Boolean(observedRole || observedEventType);
  const canvas = page.locator("canvas.babylon-match-canvas");
  let pauseResult = observedMotion?.capturePauseResult || null;
  let capturePaused = Number(pauseResult?.depth || 0) > 0;
  let playbackCapturePaused = Number(pauseResult?.playbackDepth || 0) > 0;
  try {
    const currentViewport = page.viewportSize();
    const viewportChanged = currentViewport?.width !== viewport.width
      || currentViewport?.height !== viewport.height;
    if ((capturePaused || playbackCapturePaused) && viewportChanged) {
      throw new Error(`A latched Babylon capture cannot change viewport for ${id}.`);
    }
    if (viewportChanged) {
      await setReviewViewport(page, viewport);
    } else {
      await expect(canvas).toBeVisible();
    }
    if ((capturePaused || playbackCapturePaused) && delayMs > 0) {
      throw new Error(`A latched Babylon capture cannot apply a second delay for ${id}.`);
    }
    if (delayMs > 0) await page.waitForTimeout(delayMs);
    const file = `${id}--${viewport.id}.jpg`;
    const capturePath = path.join(OUTPUT_DIRECTORY, file);
    if (fs.existsSync(capturePath)) throw new Error(`Duplicate Babylon review capture path: ${file}`);
    if (hasAtomicObservation && !capturePaused) {
      pauseResult = await canvas.evaluate((element) => element.__gauntletCaptureControl?.pause?.() || null);
      capturePaused = Number(pauseResult?.depth || 0) > 0;
      playbackCapturePaused = Number(pauseResult?.playbackDepth || 0) > 0;
    }
    if (hasAtomicObservation && (!capturePaused || !playbackCapturePaused)) {
      throw new Error(`The Babylon capture latch was unavailable for ${file}.`);
    }
    const matchesObservedPath = (motion) => (
      motion.role === observedRole
      && (
        !observedMotion?.requiredEventType
        || motion.sourceEventId === observedMotion.activeEventId
      )
      && (
        !Array.isArray(observedMotion?.requiredOccurrenceIds)
        || observedMotion.requiredOccurrenceIds.includes(motion.occurrenceId)
      )
    );
    const beforeCaptureDiagnostics = await captureDiagnostics(page, pauseResult?.metrics || null);
    const matchesObservedEventEffect = (diagnostics) => (
      !observedEventType
      || (
        diagnostics.activeEventId === observedMotion.observedEventId
        && diagnostics.activeEventType === observedMotion.observedEventType
        && diagnostics.activeEffectEventType === observedMotion.observedEffectEventType
        && diagnostics.activeEffectOccurrenceId === observedMotion.observedEffectOccurrenceId
        && diagnostics.activeEffectSourceEventId === observedMotion.observedEffectSourceEventId
        && diagnostics.activeEffectSourceEventId === diagnostics.activeEventId
        && diagnostics.activeEffectVisible === true
        && Number(diagnostics.activeEffectProgress || 0) >= Number(observedMotion.requiredEffectProgress || 0)
        && Number(diagnostics.activeEffects || 0) > 0
      )
    );
    const beforeObservedPaths = observedRole
      ? beforeCaptureDiagnostics.activeMotionPaths.filter(matchesObservedPath)
      : [];
    const requiredOccurrenceIds = Array.isArray(observedMotion?.requiredOccurrenceIds)
      ? observedMotion.requiredOccurrenceIds
      : [];
    const requiredOccurrencesPresent = (paths) => (
      requiredOccurrenceIds.length === 0
      || requiredOccurrenceIds.every((occurrenceId) => (
        paths.some((motion) => motion.occurrenceId === occurrenceId)
      ))
    );
    const activeBeforeCapture = observedRole
      ? beforeObservedPaths.length
      : 0;
    if (observedRole && (activeBeforeCapture < 1 || !requiredOccurrencesPresent(beforeObservedPaths))) {
      throw new Error(`Observed ${observedRole} ended before ${file} could be captured.`);
    }
    if (!matchesObservedEventEffect(beforeCaptureDiagnostics)) {
      throw new Error(`Observed ${observedEventType} effect ended before ${file} could be captured.`);
    }
    await page.screenshot({ path: capturePath, type: "jpeg", quality: 90 });
    const afterRendererMetrics = observedRole
      ? await canvas.evaluate((element) => element.__gauntletCaptureControl?.snapshot?.() || null)
      : null;
    const afterCaptureDiagnostics = await captureDiagnostics(page, afterRendererMetrics);
    const afterObservedPaths = observedRole
      ? afterCaptureDiagnostics.activeMotionPaths.filter(matchesObservedPath)
      : [];
    const activeAfterCapture = observedRole
      ? afterObservedPaths.length
      : 0;
    if (observedRole && (activeAfterCapture < 1 || !requiredOccurrencesPresent(afterObservedPaths))) {
      throw new Error(`Observed ${observedRole} ended while ${file} was being captured.`);
    }
    if (!matchesObservedEventEffect(afterCaptureDiagnostics)) {
      throw new Error(`Observed ${observedEventType} effect ended while ${file} was being captured.`);
    }
    if (observedRole && JSON.stringify(beforeObservedPaths) !== JSON.stringify(afterObservedPaths)) {
      throw new Error(`Observed ${observedRole} path changed while ${file} was being captured.`);
    }
    const diagnostics = observedMotion
      ? {
          ...afterCaptureDiagnostics,
          observedAtMs: observedMotion.observedAtMs,
          captureObservationPreserved: true,
          captureObservationBracketed: true,
          rendererCapturePaused: capturePaused,
          playbackCapturePaused,
          captureLatchAtomic: Boolean(observedMotion.capturePauseResult),
          ...(observedRole ? {
            observedMotionRole: observedRole,
            firstObservedAtMs: observedMotion.firstObservedAtMs ?? observedMotion.observedAtMs,
            activeCount: activeAfterCapture,
            motionObservationPreserved: true,
            motionObservationBracketed: true,
            motionCapturePaused: capturePaused,
            motionLatchAtomic: Boolean(observedMotion.capturePauseResult),
            motionLatchDelayMs: Number(observedMotion.requestedLatchDelayMs || 0),
            motionLatchProgress: observedMotion.requestedLatchProgress,
            observedMotionProgress: observedMotion.motionProgress,
            motionMatchPolicy: observedMotion.motionMatchPolicy,
            motionRequiredEventType: observedMotion.requiredEventType,
            motionEventCorrelationVerified: observedMotion.eventCorrelationVerified,
            motionRequiredOccurrenceIds: observedMotion.requiredOccurrenceIds,
            motionOccurrenceCorrelationVerified: observedMotion.occurrenceCorrelationVerified,
            motionActiveEventId: observedMotion.activeEventId,
            matchedMotionActorIds: observedMotion.matchedMotionActorIds,
            matchedMotionOccurrenceIds: observedMotion.matchedMotionOccurrenceIds,
            matchedMotionSourceEventIds: observedMotion.matchedMotionSourceEventIds,
            motionObservationSource: "renderer-frame-snapshot",
            activeBeforeCapture,
            activeAfterCapture
          } : {}),
          ...(observedEventType ? {
            observedEventType,
            observedEventId: observedMotion.observedEventId,
            observedEffectEventType: observedMotion.observedEffectEventType,
            observedEffectOccurrenceId: observedMotion.observedEffectOccurrenceId,
            observedEffectSourceEventId: observedMotion.observedEffectSourceEventId,
            observedEffectProgress: observedMotion.observedEffectProgress,
            eventRequiredEffectProgress: observedMotion.requiredEffectProgress,
            eventEffectCorrelationVerified: observedMotion.eventEffectCorrelationVerified,
            eventRequiredTypes: observedMotion.requiredEventTypes,
            eventObservationPreserved: true,
            eventObservationBracketed: true,
            eventCapturePaused: capturePaused,
            eventLatchAtomic: Boolean(observedMotion.capturePauseResult),
            eventObservationSource: "renderer-frame-snapshot"
          } : {})
        }
      : afterCaptureDiagnostics;
    const dimensions = { width: diagnostics.canvasWidth, height: diagnostics.canvasHeight };
    manifest.states.push({ id, captures: [{ file, viewport: viewportId, ...dimensions, diagnostics }] });
    return diagnostics;
  } finally {
    if (capturePaused || playbackCapturePaused) {
      const resumeResult = await canvas.evaluate(
        (element) => element.__gauntletCaptureControl?.resume?.() || null
      );
      if (
        hasAtomicObservation
        && (
          Number(resumeResult?.depth || 0) !== 0
          || Number(resumeResult?.playbackDepth || 0) !== 0
        )
      ) {
        throw new Error(`The Babylon capture latch did not fully release after ${id}.`);
      }
    }
  }
}
