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
}

async function openSpectator(browser, baseURL, duel, viewport = VIEWPORTS[4]) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: REVIEW_REDUCED_MOTION
  });
  await context.addInitScript(({ roomCode }) => {
    localStorage.setItem("gauntlet_room_code", roomCode);
    localStorage.setItem("gauntlet_role", "spectator");
  }, { roomCode: duel.roomCode });
  const page = await context.newPage();
  await page.goto(baseURL);
  await expect(page.getByTestId("production-babylon-match")).toBeVisible({ timeout: MATCH_RENDER_TIMEOUT_MS });
  return { context, page };
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
      if (ownsAction && pattern.test(text || "")) {
        matchingIndex = index;
        break;
      }
    }
    return matchingIndex;
  }, { timeout: 20000 }).toBeGreaterThanOrEqual(0);
  return pages[matchingIndex];
}

async function waitForMotionRole(page, role, { latch = false, latchDelayMs = 0 } = {}) {
  const canvas = page.locator("canvas.babylon-match-canvas");
  return canvas.evaluate((element, {
    expectedRole,
    timeoutMs,
    shouldLatch,
    requestedLatchDelayMs
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
      return {
        observedMotionRole: expectedRole,
        observedAtMs: performance.now(),
        activeCount: Number(roles[expectedRole] || 0),
        activeTransitionCount: Number(metrics.activeTransitionCount || 0),
        activeMotionsByRole: roles,
        activeMotionPaths: metrics.activeMotionPaths || [],
        actorsByZone: metrics.actorsByZone || {},
        activeEventType: metrics.activeEventType || null,
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
          finish(reject, new Error(`${expectedRole} ended before its renderer-frame latch delay elapsed.`));
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
    requestedLatchDelayMs: Math.max(0, Number(latchDelayMs || 0))
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
        activeEventType: match.dataset.activeEventType || null,
        playbackCatchingUp: match.dataset.playbackCatchingUp === "true",
        playbackQueuedFrames: Number(match.dataset.playbackQueuedFrames || 0),
        rulesVersion: match.dataset.rulesVersion || null,
        ruleset: match.dataset.ruleset || null,
        reducedMotion: match.classList.contains("reduced-motion")
          || window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        layoutProfile: match.dataset.layoutProfile || null,
        focusRegion: match.dataset.focusRegion || null,
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
    activeEventType: rendererValue("activeEventType", attributes.activeEventType),
    activeEffectEventType: rendererValue("activeEffectEventType", null),
    rulesVersion: rendererValue("rulesVersion", attributes.rulesVersion),
    layoutProfile: rendererValue("layoutProfile", attributes.layoutProfile),
    focusRegion: Object.prototype.hasOwnProperty.call(rendererMetrics, "boardPresentation")
      ? rendererMetrics.boardPresentation?.focus?.region || null
      : attributes.focusRegion,
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
    await currentAction(defender).getByRole("button", { name: "Take Damage" }).click();
    await Promise.all([majorEventReady, mobileMajorEventReady]);
    await pageMotionCapture(
      mobileSpectator.page,
      manifest,
      "mobile-major-damage-motion",
      80,
      VIEWPORTS[4],
      "phone-landscape-motion"
    );
    await pageMotionCapture(defender, manifest, "major-damage-resolution", 120);
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
  const victoryEventReady = waitForActiveEvent(attacker, "match.ended");
  await defender.locator(".production-match-utilities > summary").click();
  await defender.getByRole("button", { name: "Concede", exact: true }).click();
  await defender.getByRole("group", { name: "Confirm concession" })
    .getByRole("button", { name: "Confirm" }).click();
  await victoryEventReady;
  await pageMotionCapture(attacker, manifest, "victory-result-transition", 120);
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
  const opened = await openPlayer(browser, baseURL, duel, playerNumber);
  const { context, page } = opened;
  try {
    await openHandControls(page);
    const polea = page.locator(".production-faction-actions")
      .getByRole("button", { name: /Polea.*place a hand card/i });
    await expect(polea).toBeVisible();
    await polea.click();
    await clickHandCardByValue(page, "lowest");
    await activateLaneButton(page, "Lane 1");
    await captureState(page, manifest, "ability-activation-staged", [VIEWPORTS[0], VIEWPORTS[4]]);
    await page.setViewportSize(VIEWPORTS[0]);
    const placementMotionReady = waitForMotionRole(page, "placement-enter");
    await currentAction(page).getByRole("button", { name: "Confirm Placement" }).click();
    await placementMotionReady;
    await pageMotionCapture(page, manifest, "ability-activation", 160);
    await waitForPlaybackSettled(page);
    await captureState(page, manifest, "ability-activation-settled", [VIEWPORTS[0], VIEWPORTS[4], VIEWPORTS[5]]);
  } finally {
    await context.close();
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

  await waitForPlaybackSettled(defender);
  await captureState(defender, manifest, "neutral-rest", [VIEWPORTS[0], VIEWPORTS[4], VIEWPORTS[5]]);
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
  const attackMotionReady = waitForMotionRole(attacker, "attack-enter");
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
  await pageMotionCapture(attacker, manifest, "payment-transition-midpoint", 140);
  await attackEventReady;
  await attackMotionReady;
  await pageMotionCapture(attacker, manifest, "attack-transition-start", 0);
  await pageMotionCapture(attacker, manifest, "attack-transition-midpoint", 220);

  await expect(currentAction(defender)).toContainText(/may block or decline/i);
  await waitForPlaybackSettled(attacker);
  const settledAttack = await captureState(attacker, manifest, "attack-settled", [VIEWPORTS[0]]);
  expectZonesEmpty(settledAttack, ["payment"]);
  await captureState(defender, manifest, "incoming-hand-attack", VIEWPORTS.slice(0, 4));
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
  const blockMotionReady = waitForMotionRole(defender, "block-enter");
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
  await pageMotionCapture(defender, manifest, "block-payment-transition-midpoint", 140);
  await blockEventReady;
  await blockMotionReady;
  await pageMotionCapture(defender, manifest, "block-transition-start", 0);
  await pageMotionCapture(defender, manifest, "block-transition-midpoint", 220);
  await damageEventReady;
  await pageMotionCapture(defender, manifest, "combat-resolution", 0);
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
  await currentAction(firstPassPage).getByRole("button", { name: "Pass Priority" }).click();
  await expect(secondPassPage.locator(".production-player-plate-bottom.has-priority")).toBeVisible();
  await pageMotionCapture(secondPassPage, manifest, "priority-transfer", 80);
  await currentAction(secondPassPage).getByRole("button", { name: "Pass Priority" }).click();

  let drawMotionPagePromise = null;
  for (let opportunity = 1; opportunity <= 6; opportunity += 1) {
    const actingPage = await pageWithBottomAction(livePages, new RegExp(`Placement ${opportunity} of 6`, "i"));
    await actingPage.setViewportSize(VIEWPORTS[0]);
    if (opportunity === 6) {
      drawMotionPagePromise = Promise.any(livePages.map(async (page) => {
        await waitForMotionRole(page, "draw-enter");
        return page;
      }));
      await currentAction(actingPage).getByRole("button", { name: "Skip Lane" }).click();
      continue;
    }
    await clickHandCardByValue(actingPage, "lowest");
    if (opportunity === 1) {
      await captureState(actingPage, manifest, "placement-selected", [VIEWPORTS[0], VIEWPORTS[4], VIEWPORTS[5]]);
      await actingPage.setViewportSize(VIEWPORTS[0]);
    }
    await currentAction(actingPage).getByRole("button", { name: "Place Facedown" }).click();
    if (opportunity === 1) {
      await waitForMotionRole(actingPage, "placement-enter");
      await pageMotionCapture(actingPage, manifest, "placement-transition-start", 40);
      await pageMotionCapture(actingPage, manifest, "placement-transition-midpoint", 360);
      await waitForPlaybackSettled(actingPage);
      await captureState(actingPage, manifest, "placement-settled", [VIEWPORTS[0], VIEWPORTS[4], VIEWPORTS[5]]);
    }
  }

  const turnTwoPage = await pageWithBottomAction(livePages, /Turn 2/i);
  const drawMotionPage = await drawMotionPagePromise;
  await pageMotionCapture(drawMotionPage, manifest, "draw-and-turn-transition", 0);
  await waitForPlaybackSettled(turnTwoPage);
  await captureState(turnTwoPage, manifest, "turn-two-draw-settled", [VIEWPORTS[0], VIEWPORTS[4], VIEWPORTS[5]]);

  const laneAttacker = await pageWithBottomPriority(livePages);
  const laneDefender = laneAttacker === attacker ? defender : attacker;
  await laneAttacker.setViewportSize(VIEWPORTS[0]);
  await activateLaneButton(laneAttacker, "Lane 1");
  await captureState(laneAttacker, manifest, "lane-attack-selected", [VIEWPORTS[0], VIEWPORTS[4], VIEWPORTS[5]]);
  await laneAttacker.setViewportSize(VIEWPORTS[0]);
  await payUntilEnabled(laneAttacker, "Confirm Attack");
  const laneAttackMotionReady = waitForMotionRole(laneAttacker, "attack-enter");
  await currentAction(laneAttacker).getByRole("button", { name: "Confirm Attack" }).click();
  await laneAttackMotionReady;
  await pageMotionCapture(laneAttacker, manifest, "lane-attack-transition-start", 60);
  await pageMotionCapture(laneAttacker, manifest, "lane-attack-transition-midpoint", 420);
  await expect(currentAction(laneDefender)).toContainText(/attacked from Lane 1.*may block or decline/i);
  const laneDiscardMotionReady = waitForMotionRole(laneDefender, "discard-exit");
  const mobileDamageEventReady = waitForActiveEvent(mobileSpectator.page, "damage.calculated");
  const mobileDiscardCaptureReady = waitForMotionRole(mobileSpectator.page, "discard-exit", {
    latch: true,
    latchDelayMs: 80
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
  await Promise.all([
    laneDiscardMotionReady,
    mobileDamageEventReady,
    mobileDiscardCaptureReady
  ]);
  await pageMotionCapture(laneDefender, manifest, "lane-damage-resolution", 100);
  await pageMotionCapture(laneDefender, manifest, "lane-discard-departure", 120);
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
  const laneBlockMotionReady = waitForMotionRole(secondLaneDefender, "block-enter");
  await currentAction(secondLaneDefender).getByRole("button", { name: "Confirm Block" }).click();
  await laneBlockMotionReady;
  await pageMotionCapture(secondLaneDefender, manifest, "lane-block-transition-start", 60);
  await pageMotionCapture(secondLaneDefender, manifest, "lane-block-transition-midpoint", 450);
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
    if (observedRole && !capturePaused) {
      pauseResult = await canvas.evaluate((element) => element.__gauntletCaptureControl?.pause?.() || null);
      capturePaused = Number(pauseResult?.depth || 0) > 0;
      playbackCapturePaused = Number(pauseResult?.playbackDepth || 0) > 0;
    }
    if (observedRole && (!capturePaused || !playbackCapturePaused)) {
      throw new Error(`The Babylon capture latch was unavailable for ${file}.`);
    }
    const beforeCaptureDiagnostics = await captureDiagnostics(page, pauseResult?.metrics || null);
    const activeBeforeCapture = observedRole
      ? Number(beforeCaptureDiagnostics.activeMotionsByRole?.[observedRole] || 0)
      : 0;
    if (observedRole && activeBeforeCapture < 1) {
      throw new Error(`Observed ${observedRole} ended before ${file} could be captured.`);
    }
    await page.screenshot({ path: capturePath, type: "jpeg", quality: 90 });
    const afterRendererMetrics = observedRole
      ? await canvas.evaluate((element) => element.__gauntletCaptureControl?.snapshot?.() || null)
      : null;
    const afterCaptureDiagnostics = await captureDiagnostics(page, afterRendererMetrics);
    const activeAfterCapture = observedRole
      ? Number(afterCaptureDiagnostics.activeMotionsByRole?.[observedRole] || 0)
      : 0;
    if (observedRole && activeAfterCapture < 1) {
      throw new Error(`Observed ${observedRole} ended while ${file} was being captured.`);
    }
    const beforeObservedPaths = observedRole
      ? beforeCaptureDiagnostics.activeMotionPaths.filter((motion) => motion.role === observedRole)
      : [];
    const afterObservedPaths = observedRole
      ? afterCaptureDiagnostics.activeMotionPaths.filter((motion) => motion.role === observedRole)
      : [];
    if (observedRole && JSON.stringify(beforeObservedPaths) !== JSON.stringify(afterObservedPaths)) {
      throw new Error(`Observed ${observedRole} path changed while ${file} was being captured.`);
    }
    const diagnostics = observedMotion
      ? {
          ...afterCaptureDiagnostics,
          observedMotionRole: observedRole,
          observedAtMs: observedMotion.observedAtMs,
          firstObservedAtMs: observedMotion.firstObservedAtMs ?? observedMotion.observedAtMs,
          activeCount: activeAfterCapture,
          motionObservationPreserved: true,
          motionObservationBracketed: true,
          motionCapturePaused: capturePaused,
          playbackCapturePaused,
          motionLatchAtomic: Boolean(observedMotion.capturePauseResult),
          motionLatchDelayMs: Number(observedMotion.requestedLatchDelayMs || 0),
          motionObservationSource: "renderer-frame-snapshot",
          activeBeforeCapture,
          activeAfterCapture
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
        observedRole
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
