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

async function payUntilEnabled(page, confirmationName) {
  const confirmation = currentAction(page).getByRole("button", { name: confirmationName });
  for (let count = 0; count < 8 && await confirmation.isDisabled(); count += 1) {
    await clickHandCardByValue(page, "highest");
  }
  await expect(confirmation).toBeEnabled();
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
    await page.setViewportSize(viewport);
    await expect(page.locator("canvas.babylon-match-canvas")).toBeVisible();
    await page.waitForTimeout(80);
    const file = `${id}--${viewport.id}.jpg`;
    await page.screenshot({ path: path.join(OUTPUT_DIRECTORY, file), type: "jpeg", quality: 86 });
    const dimensions = await page.locator("canvas.babylon-match-canvas").evaluate((canvas) => ({
      width: canvas.clientWidth,
      height: canvas.clientHeight
    }));
    expect(dimensions.width).toBeGreaterThan(300);
    expect(dimensions.height).toBeGreaterThan(200);
    record.captures.push({ file, viewport: viewport.id, ...dimensions });
  }
  manifest.states.push(record);
}

test("capture real live and replay match presentation states", async ({ browser, baseURL }) => {
  test.setTimeout(300000);
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
  await attacker.setViewportSize(VIEWPORTS[0]);
  await openHandControls(attacker);
  await clickHandCardByValue(attacker, "lowest");
  await attacker.waitForTimeout(720);
  await captureState(attacker, manifest, "attack-selected", VIEWPORTS.slice(0, 4));
  await attacker.setViewportSize(VIEWPORTS[0]);
  await payUntilEnabled(attacker, "Confirm Attack");
  await attacker.waitForTimeout(720);
  await captureState(attacker, manifest, "payment-staged");
  await attacker.setViewportSize(VIEWPORTS[0]);
  await currentAction(attacker).getByRole("button", { name: "Confirm Attack" }).click();

  await expect(currentAction(defender)).toContainText(/may block or decline/i);
  await captureState(defender, manifest, "incoming-hand-attack", VIEWPORTS.slice(0, 4));
  await defender.setViewportSize(VIEWPORTS[0]);
  await openHandControls(defender);
  await clickHandCardByValue(defender, "lowest");
  const continueButton = currentAction(defender).getByRole("button", { name: /Choose Payment|Continue to Payment/ });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await payUntilEnabled(defender, "Confirm Block");
  await defender.waitForTimeout(720);
  await captureState(defender, manifest, "block-and-payment-staged");
  await defender.setViewportSize(VIEWPORTS[0]);
  await currentAction(defender).getByRole("button", { name: "Confirm Block" }).click();
  await pageMotionCapture(defender, manifest, "resolved-block-motion");

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

  fs.writeFileSync(path.join(OUTPUT_DIRECTORY, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(OUTPUT_DIRECTORY, "index.html"), buildIndex(manifest));
  await replayContext.close();
  await Promise.all(Object.values(opened).map(({ context }) => context.close()));
});

async function pageMotionCapture(page, manifest, id) {
  await page.setViewportSize(VIEWPORTS[0]);
  await page.waitForTimeout(140);
  const file = `${id}--desktop.jpg`;
  await page.screenshot({ path: path.join(OUTPUT_DIRECTORY, file), type: "jpeg", quality: 90 });
  manifest.states.push({ id, captures: [{ file, viewport: "desktop-motion", width: 1366, height: 768 }] });
}
