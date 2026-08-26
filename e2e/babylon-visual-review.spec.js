const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const { io } = require("socket.io-client");

const SERVER_URL = "http://127.0.0.1:4100";
const OUTPUT_DIRECTORY = path.resolve(
  process.env.BABYLON_REVIEW_OUTPUT || "artifacts/babylon-visual-review/current"
);
const VIEWPORTS = [
  { id: "desktop", width: 1366, height: 768 },
  { id: "ultrawide", width: 2560, height: 1080 },
  { id: "tablet-landscape", width: 1180, height: 820 },
  { id: "tablet-portrait", width: 820, height: 1180 },
  { id: "phone-landscape", width: 844, height: 390 },
  { id: "phone-portrait", width: 390, height: 844 }
];

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

async function seedBasicDuel() {
  const host = await connectSeedClient();
  const hostAssignmentPromise = waitForEvent(host, "assign");
  host.emit("createRoom", { guestName: "Visual Host" });
  const hostAssignment = await hostAssignmentPromise;

  const basicLobbyPromise = waitForEvent(host, "lobbyState", (state) => state.gameMode === "basic");
  host.emit("setGameMode", { mode: "basic" });
  await basicLobbyPromise;

  const guest = await connectSeedClient();
  const guestAssignmentPromise = waitForEvent(guest, "assign");
  const joinedPromise = waitForEvent(host, "lobbyState", (state) => state.players[2]?.accountName === "Visual Guest");
  guest.emit("joinRoom", { roomCode: hostAssignment.roomCode, guestName: "Visual Guest" });
  const guestAssignment = await guestAssignmentPromise;
  await joinedPromise;

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

async function openPlayer(browser, baseURL, duel, playerNumber) {
  const context = await browser.newContext({ viewport: VIEWPORTS[0] });
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
  await expect(page.getByTestId("production-babylon-match")).toBeVisible();
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

async function waitForMotionRole(page, role) {
  const match = page.getByTestId("production-babylon-match");
  await expect.poll(async () => {
    const roles = JSON.parse(await match.getAttribute("data-active-motions-by-role") || "{}");
    return Number(roles[role] || 0);
  }, { timeout: 8000 }).toBeGreaterThan(0);
}

async function waitForActiveEvent(page, eventType) {
  await expect(page.getByTestId("production-babylon-match"))
    .toHaveAttribute("data-active-event-type", eventType, { timeout: 10000 });
}

function expectedLayoutProfile(viewport) {
  const aspect = viewport.width / Math.max(1, viewport.height);
  if (viewport.height <= 520 && aspect > 1) return "short-landscape";
  if (aspect <= 0.72) return "portrait";
  return "desktop";
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
  await expect(page.getByTestId("production-babylon-match"))
    .toHaveAttribute("data-layout-profile", expectedLayoutProfile(surface), { timeout: 10000 });
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
  const match = page.getByTestId("production-babylon-match");
  await expect(match).toHaveAttribute("data-active-event-type", "", { timeout: 20000 });
  await expect.poll(async () => {
    const state = await match.evaluate((element) => ({
      active: Number(element.dataset.activeTransitionCount || 0),
      queued: Number(element.dataset.queuedTransitionCount || 0),
      departing: Number(element.dataset.departingActorCount || 0),
      motions: Object.values(JSON.parse(element.dataset.activeMotionsByRole || "{}"))
        .reduce((total, count) => total + Number(count || 0), 0)
    }));
    return state.active + state.queued + state.departing + state.motions;
  }, { timeout: 20000 }).toBe(0);
  await page.waitForTimeout(120);
  await expect(match).toHaveAttribute("data-active-event-type", "");
}

async function captureDiagnostics(page) {
  const match = page.getByTestId("production-babylon-match");
  const attributes = await match.evaluate((element) => ({
    sceneContract: element.dataset.sceneContract || null,
    boardModuleCount: Number(element.dataset.boardModuleCount || 0),
    duplicateVisibleIdentityCount: Number(element.dataset.duplicateVisibleIdentityCount || 0),
    structuralCompositeRasterCount: Number(element.dataset.structuralCompositeRasterCount || 0),
    actorCount: Number(element.dataset.cardActorCount || 0),
    actorsByZone: JSON.parse(element.dataset.actorsByZone || "{}"),
    knownActorCount: Number(element.dataset.knownActorCount || 0),
    anonymousActorCount: Number(element.dataset.anonymousActorCount || 0),
    departingActorCount: Number(element.dataset.departingActorCount || 0),
    activeTransitionCount: Number(element.dataset.activeTransitionCount || 0),
    activeMotionsByRole: JSON.parse(element.dataset.activeMotionsByRole || "{}"),
    activeMotionPaths: JSON.parse(element.dataset.activeMotionPaths || "[]"),
    queuedTransitionCount: Number(element.dataset.queuedTransitionCount || 0),
    activeEffects: Number(element.dataset.activeEffects || 0),
    activeEventType: element.dataset.activeEventType || null,
    layoutProfile: element.dataset.layoutProfile || null,
    canvasWidth: element.querySelector("canvas.babylon-match-canvas")?.clientWidth || 0,
    canvasHeight: element.querySelector("canvas.babylon-match-canvas")?.clientHeight || 0
  }));
  expect(attributes.sceneContract).toBe("gauntlet.board-stage.native.v1");
  expect(attributes.boardModuleCount).toBe(10);
  expect(attributes.duplicateVisibleIdentityCount).toBe(0);
  expect(attributes.structuralCompositeRasterCount).toBe(0);
  expect(attributes.actorCount).toBe(attributes.knownActorCount + attributes.anonymousActorCount);
  return attributes;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildIndex(manifest) {
  const states = manifest.states.map((state) => `
    <section><h2>${htmlEscape(state.id)}</h2><div>${state.captures.map((capture) => `
      <figure><a href="${capture.file}"><img src="${capture.file}" alt="${htmlEscape(state.id)} at ${capture.viewport}"></a>
      <figcaption>${htmlEscape(capture.viewport)} · ${capture.width}×${capture.height}</figcaption></figure>
    `).join("")}</div></section>
  `).join("");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Gauntlet visual review</title>
    <style>body{margin:0 auto;max-width:1800px;padding:24px;background:#080c11;color:#e6e1d1;font-family:system-ui}section{margin:20px 0;padding:16px;border:1px solid #35404b;background:#12161d}section>div{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}figure{margin:0}img{width:100%;display:block}figcaption{padding:6px;color:#aeb8c2}</style>
    <body><h1>Production-path Babylon visual review</h1><p>Generated ${manifest.generatedAt}. Every state was produced through a real room and the tracked live/replay routes.</p>${states}</body></html>`;
}

async function captureState(page, manifest, id, viewports = VIEWPORTS) {
  const record = { id, captures: [] };
  await page.evaluate(() => document.activeElement?.blur());
  for (const viewport of viewports) {
    await setReviewViewport(page, viewport);
    await page.waitForTimeout(80);
    const diagnostics = await captureDiagnostics(page);
    const file = `${id}--${viewport.id}.jpg`;
    await page.screenshot({ path: path.join(OUTPUT_DIRECTORY, file), type: "jpeg", quality: 86 });
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

test("capture real live and replay match presentation states", async ({ browser, baseURL }) => {
  test.setTimeout(900000);
  fs.rmSync(OUTPUT_DIRECTORY, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  const manifest = { generatedAt: new Date().toISOString(), states: [] };
  const duel = await seedBasicDuel();
  const opened = {
    1: await openPlayer(browser, baseURL, duel, 1),
    2: await openPlayer(browser, baseURL, duel, 2)
  };
  const attackerNumber = duel.players[1].state.priority;
  const defenderNumber = attackerNumber === 1 ? 2 : 1;
  const attacker = opened[attackerNumber].page;
  const defender = opened[defenderNumber].page;

  await captureState(attacker, manifest, "live-priority");
  if (process.env.BABYLON_IDLE_ONLY === "true") {
    fs.writeFileSync(path.join(OUTPUT_DIRECTORY, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    fs.writeFileSync(path.join(OUTPUT_DIRECTORY, "index.html"), buildIndex(manifest));
    await Promise.all(Object.values(opened).map(({ context }) => context.close()));
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
  const attackPaymentMotionReady = waitForMotionRole(attacker, "payment-enter");
  const attackMotionReady = waitForMotionRole(attacker, "attack-enter");
  const attackEventReady = waitForActiveEvent(attacker, "attack.declared");
  await currentAction(attacker).getByRole("button", { name: "Confirm Attack" }).click();

  await attackPaymentMotionReady;
  const attackPaymentStart = await pageMotionCapture(attacker, manifest, "payment-transition-start", 40);
  expect(attackPaymentStart.activeTransitionCount).toBeGreaterThan(0);
  if (attackPaymentStart.activeTransitionCount > (attackPaymentStart.actorsByZone.payment || 0)) {
    throw new Error(`Unexpected payment motion fan-out: ${JSON.stringify(attackPaymentStart)}`);
  }
  expect(attackPaymentStart.activeTransitionCount).toBeLessThanOrEqual(attackPaymentStart.actorsByZone.payment || 0);
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
  const blockPaymentMotionReady = waitForMotionRole(defender, "payment-enter");
  const blockMotionReady = waitForMotionRole(defender, "block-enter");
  const blockEventReady = waitForActiveEvent(defender, "block.declared");
  const damageEventReady = waitForActiveEvent(defender, "damage.calculated");
  await currentAction(defender).getByRole("button", { name: "Confirm Block" }).click();
  await blockPaymentMotionReady;
  const blockPaymentStart = await pageMotionCapture(defender, manifest, "block-payment-transition-start", 40);
  expect(blockPaymentStart.activeTransitionCount).toBeGreaterThan(0);
  expect(blockPaymentStart.activeTransitionCount).toBeLessThanOrEqual(blockPaymentStart.actorsByZone.payment || 0);
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
  await currentAction(laneAttacker).getByRole("button", { name: "Confirm Attack" }).click();
  await waitForMotionRole(laneAttacker, "attack-enter");
  await pageMotionCapture(laneAttacker, manifest, "lane-attack-transition-start", 60);
  await pageMotionCapture(laneAttacker, manifest, "lane-attack-transition-midpoint", 420);
  await expect(currentAction(laneDefender)).toContainText(/attacked from Lane 1.*may block or decline/i);
  await currentAction(laneDefender).getByRole("button", { name: "Take Damage" }).click();
  await pageMotionCapture(laneDefender, manifest, "lane-damage-resolution", 100);
  await waitForMotionRole(laneDefender, "discard-exit");
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
  await currentAction(secondLaneDefender).getByRole("button", { name: "Confirm Block" }).click();
  await waitForMotionRole(secondLaneDefender, "block-enter");
  await pageMotionCapture(secondLaneDefender, manifest, "lane-block-transition-start", 60);
  await pageMotionCapture(secondLaneDefender, manifest, "lane-block-transition-midpoint", 450);
  await waitForPlaybackSettled(secondLaneDefender);
  const laneBlockFinal = await captureState(secondLaneDefender, manifest, "lane-block-final", [VIEWPORTS[0], VIEWPORTS[4], VIEWPORTS[5]]);
  expectZonesEmpty(laneBlockFinal, ["payment", "combat"]);

  const matchId = await defender.getByTestId("production-babylon-match").getAttribute("data-match-id");
  await defender.locator(".production-match-utilities > summary").click();
  await defender.getByRole("button", { name: "Concede", exact: true }).click();
  await defender.getByRole("group", { name: "Confirm concession" }).getByRole("button", { name: "Confirm" }).click();
  await expect(defender.locator(".production-match-result")).toBeVisible();

  const replayContext = await browser.newContext({ viewport: VIEWPORTS[0] });
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

  const localContext = await browser.newContext({ viewport: VIEWPORTS[0] });
  const localPage = await localContext.newPage();
  await localPage.goto(baseURL, { waitUntil: "domcontentloaded" });
  await localPage.locator('button[data-area="identity"]').click();
  await localPage.getByLabel("Play as guest").check();
  await localPage.getByPlaceholder("Guest name").fill("Visual Local");
  await localPage.locator('button[data-area="play"]').click();
  await localPage.getByRole("tab", { name: "Practice" }).click();
  await localPage.getByRole("button", { name: /Basic vs AI/ }).click();
  await expect(localPage.getByTestId("production-babylon-match")).toBeVisible();
  await captureState(localPage, manifest, "local-training-native", VIEWPORTS);

  fs.writeFileSync(path.join(OUTPUT_DIRECTORY, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(OUTPUT_DIRECTORY, "index.html"), buildIndex(manifest));
  await replayContext.close();
  await localContext.close();
  await Promise.all(Object.values(opened).map(({ context }) => context.close()));
});

async function pageMotionCapture(page, manifest, id, delayMs = 0) {
  await setReviewViewport(page, VIEWPORTS[0]);
  if (delayMs > 0) await page.waitForTimeout(delayMs);
  const diagnostics = await captureDiagnostics(page);
  const file = `${id}--desktop.jpg`;
  await page.screenshot({ path: path.join(OUTPUT_DIRECTORY, file), type: "jpeg", quality: 90 });
  const dimensions = { width: diagnostics.canvasWidth, height: diagnostics.canvasHeight };
  manifest.states.push({ id, captures: [{ file, viewport: "desktop-motion", ...dimensions, diagnostics }] });
  return diagnostics;
}
