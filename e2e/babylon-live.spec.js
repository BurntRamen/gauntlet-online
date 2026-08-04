const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const { io } = require("socket.io-client");

const SERVER_URL = "http://127.0.0.1:4100";

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

async function seedDuel({ mode = "basic", factionId = "frumo" } = {}) {
  const host = await connectSeedClient();
  const hostAssignmentPromise = waitForEvent(host, "assign");
  const hostLobbyPromise = waitForEvent(host, "lobbyState");
  host.emit("createRoom", { guestName: "Browser One" });
  const hostAssignment = await hostAssignmentPromise;
  await hostLobbyPromise;

  if (mode === "basic") {
    const basicLobbyPromise = waitForEvent(host, "lobbyState", (state) => state.gameMode === "basic");
    host.emit("setGameMode", { mode: "basic" });
    await basicLobbyPromise;
  }

  const guest = await connectSeedClient();
  const guestAssignmentPromise = waitForEvent(guest, "assign");
  const joinedLobbyPromise = waitForEvent(
    host,
    "lobbyState",
    (state) => state.players[2]?.accountName === "Browser Two"
  );
  guest.emit("joinRoom", {
    roomCode: hostAssignment.roomCode,
    guestName: "Browser Two"
  });
  const guestAssignment = await guestAssignmentPromise;
  await joinedLobbyPromise;

  if (mode === "factions") {
    const factionLobbyPromise = waitForEvent(
      host,
      "lobbyState",
      (state) => (
        state.players[1]?.factionId === factionId
        && state.players[2]?.factionId === factionId
      )
    );
    host.emit("selectFaction", { factionId });
    guest.emit("selectFaction", { factionId });
    await factionLobbyPromise;
  }

  const hostReadyPromise = waitForEvent(host, "lobbyState", (state) => state.players[1].readyToStart);
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
      1: {
        assignment: hostAssignment,
        state: hostState
      },
      2: {
        assignment: guestAssignment,
        state: guestState
      }
    }
  };
}

async function openPlayer(context, baseURL, duel, playerNumber, location = "", expectProduction = true) {
  const player = duel.players[playerNumber];
  await context.addInitScript(({ roomCode, reconnectToken }) => {
    localStorage.setItem("gauntlet_room_code", roomCode);
    localStorage.setItem("gauntlet_reconnect_token", reconnectToken);
    localStorage.setItem("gauntlet_role", "player");
    localStorage.setItem("gauntlet_guest_name", `Browser ${reconnectToken.slice(0, 4)}`);
  }, {
    roomCode: duel.roomCode,
    reconnectToken: player.assignment.reconnectToken
  });
  const page = await context.newPage();
  await page.goto(`${baseURL}${location}`);
  if (expectProduction) await expect(page.getByTestId("production-babylon-match")).toBeVisible();
  return page;
}

test("two real browser clients share the live Babylon engine and reconnect safely", async ({ browser, baseURL }) => {
  const duel = await seedDuel({ mode: "basic" });
  const contexts = {
    1: await browser.newContext({ viewport: { width: 1366, height: 768 } }),
    2: await browser.newContext({ viewport: { width: 1366, height: 768 } })
  };
  const pages = {
    1: await openPlayer(contexts[1], baseURL, duel, 1),
    2: await openPlayer(contexts[2], baseURL, duel, 2)
  };

  for (const playerNumber of [1, 2]) {
    await expect(pages[playerNumber].locator("canvas.babylon-match-canvas")).toBeVisible();
    const dimensions = await pages[playerNumber].locator("canvas.babylon-match-canvas").evaluate((canvas) => ({
      width: canvas.clientWidth,
      height: canvas.clientHeight
    }));
    expect(dimensions.width).toBeGreaterThan(600);
    expect(dimensions.height).toBeGreaterThan(400);
    await expect(pages[playerNumber].locator(".production-player-plate")).toHaveCount(2);
  }

  const priority = duel.players[1].state.priority;
  const waiting = priority === 1 ? 2 : 1;
  await expect(pages[priority].locator(".production-player-plate-bottom.has-priority")).toBeVisible();
  await pages[priority]
    .getByRole("region", { name: "Current match action" })
    .getByRole("button", { name: "Pass Priority" })
    .click();
  await expect(pages[waiting].locator(".production-player-plate-bottom.has-priority")).toBeVisible();

  await pages[waiting].evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "h" })));
  const stagedCard = pages[waiting].locator('[data-match-zone="hand"]:not(:disabled)').first();
  await stagedCard.focus();
  await stagedCard.press("Enter");
  await expect(pages[waiting].locator('[data-match-zone="hand"][aria-pressed="true"]')).toHaveCount(1);

  await contexts[waiting].setOffline(true);
  await expect(pages[waiting].locator(".production-connection-banner")).toBeVisible();
  const contextualPass = pages[waiting]
    .getByLabel("Current match action")
    .getByRole("button", { name: /Pass Priority|Take Damage/ });
  await expect(contextualPass).toBeDisabled();
  await expect(pages[waiting].locator('[data-match-zone="hand"][aria-pressed="true"]')).toHaveCount(0);
  await contexts[waiting].setOffline(false);
  await expect(pages[waiting].locator(".production-connection-banner")).toHaveCount(0);
  await expect(pages[waiting].getByTestId("production-babylon-match")).toBeVisible();
  await expect(pages[waiting].locator("canvas.babylon-match-canvas")).toBeVisible();
  await expect(contextualPass).toBeEnabled();
  await contextualPass.click();
  await expect(pages[priority].locator(".production-player-plate-bottom.has-priority")).toBeVisible();

  await contexts[1].close();
  await contexts[2].close();
});

test("faction abilities, spectator privacy, responsive layout, and accessibility use the same renderer", async ({ browser, baseURL }) => {
  const duel = await seedDuel({ mode: "factions", factionId: "frumo" });
  const priority = duel.players[1].state.priority;
  const playerContext = await browser.newContext({ viewport: { width: 1536, height: 864 } });
  const playerPage = await openPlayer(playerContext, baseURL, duel, priority);

  await expect(playerPage.locator(".production-faction-actions")
    .getByRole("button", { name: /Polea.*place a hand card/i })).toBeVisible();
  await expect(playerPage.locator("canvas.babylon-match-canvas")).toBeVisible();

  const spectatorContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await spectatorContext.addInitScript(({ roomCode }) => {
    localStorage.setItem("gauntlet_room_code", roomCode);
    localStorage.setItem("gauntlet_role", "spectator");
  }, { roomCode: duel.roomCode });
  const spectatorPage = await spectatorContext.newPage();
  await spectatorPage.goto(baseURL);
  await expect(spectatorPage.getByText("Spectator view")).toBeVisible();
  await expect(spectatorPage.getByRole("button", { name: "Pass Priority" })).toHaveCount(0);
  await expect(spectatorPage.locator("[data-match-zone='hand']")).toHaveCount(0);

  const accessibility = await new AxeBuilder({ page: playerPage })
    .exclude("canvas")
    .analyze();
  expect(accessibility.violations).toEqual([]);

  await playerPage.setViewportSize({ width: 844, height: 390 });
  await expect(playerPage.locator("canvas.babylon-match-canvas")).toBeVisible();
  await expect(playerPage.locator(".production-context-panel")).toBeVisible();

  await playerContext.close();
  await spectatorContext.close();
});

test("WebGL context loss falls back to React and persists for the current match", async ({ browser, baseURL }) => {
  const duel = await seedDuel({ mode: "basic" });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const activePlayer = duel.players[1].state.priority;
  const page = await openPlayer(context, baseURL, duel, activePlayer);
  const matchId = duel.players[1].state.matchId;
  const fallbackLogs = [];
  page.on("console", (message) => {
    if (message.text().includes("[MatchRendererFallback]")) fallbackLogs.push(message.text());
  });

  await page.locator("canvas.babylon-match-canvas").evaluate((canvas) => {
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  });
  await expect(page.getByTestId("production-babylon-match")).toHaveCount(0);
  const reactMatch = page.locator(".focused-match-screen");
  await expect(reactMatch).toBeVisible();
  await expect(reactMatch).toContainText(`Browser ${activePlayer === 1 ? "One" : "Two"}`);
  await reactMatch.getByRole("button", { name: "Pass / Continue" }).click();
  await expect(reactMatch.getByText("Opponent Acting")).toBeVisible();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("gauntlet_babylon_failed_match")))
    .toBe(matchId);
  expect(fallbackLogs.some((message) => message.includes("legacy React match renderer"))).toBe(true);

  await page.reload();
  await expect(page.getByTestId("production-babylon-match")).toHaveCount(0);
  await expect(page.locator("canvas.babylon-match-canvas")).toHaveCount(0);
  await expect(page.locator(".focused-match-screen")).toBeVisible();
  await context.close();
});

test("the explicit React emergency flag bypasses Babylon without changing the live session", async ({ browser, baseURL }) => {
  const duel = await seedDuel({ mode: "basic" });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const activePlayer = duel.players[1].state.priority;
  const page = await openPlayer(context, baseURL, duel, activePlayer, "/?renderer=react", false);

  await expect(page.getByTestId("production-babylon-match")).toHaveCount(0);
  await expect(page.locator("canvas.babylon-match-canvas")).toHaveCount(0);
  await expect(page.locator(".focused-match-screen")).toBeVisible();
  await expect(page.locator(".focused-match-screen")).toContainText(`Browser ${activePlayer === 1 ? "One" : "Two"}`);

  await context.close();
});

test("resets, reduced motion, and portrait accessibility preserve one Babylon scene", async ({ page, baseURL }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${baseURL}/?babylon-test=1&babylon-dev=1`);
  await expect(page.getByTestId("production-babylon-match")).toBeVisible();
  await expect(page.getByTestId("production-babylon-match")).toHaveClass(/reduced-motion/);

  await page.getByText("Developer tools").click();
  const scenes = page.locator(".babylon-developer-status span").filter({ hasText: /^Scenes/ }).locator("strong");
  const meshes = page.locator(".babylon-developer-status span").filter({ hasText: /^Meshes/ }).locator("strong");
  const materials = page.locator(".babylon-developer-status span").filter({ hasText: /^Materials/ }).locator("strong");
  const textures = page.locator(".babylon-developer-status span").filter({ hasText: /^Textures/ }).locator("strong");
  const fps = page.locator(".babylon-developer-status span").filter({ hasText: /^FPS/ }).locator("strong");
  const initialization = page.locator(".babylon-developer-status span").filter({ hasText: /^Initialization/ }).locator("strong");
  await expect(scenes).toHaveText("1");
  const initialMeshes = await meshes.textContent();
  const initialMaterials = await materials.textContent();
  const initialTextures = Number(await textures.textContent());
  expect(Number(initialMeshes)).toBeLessThanOrEqual(150);
  expect(Number(initialMaterials)).toBeLessThanOrEqual(26);
  // The approved table/card-back asset adds one retained texture over the
  // earlier placeholder fixture. The stability assertion below remains the
  // important leak guard across resets and consecutive matches.
  expect(initialTextures).toBeLessThanOrEqual(26);
  await expect.poll(async () => Number(await fps.textContent())).toBeGreaterThan(0);
  expect(Number.parseInt(await initialization.textContent(), 10)).toBeLessThan(1000);
  const initialHeap = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0);

  const matchSurface = page.getByTestId("production-babylon-match");
  const matchIds = new Set([await matchSurface.getAttribute("data-match-id")]);
  for (let index = 0; index < 5; index += 1) {
    await page.getByLabel("Seed").fill(`qualification-match-${index}`);
    await page.getByRole("button", { name: "New Match" }).click();
    await expect.poll(async () => matchSurface.getAttribute("data-match-id"))
      .not.toBe([...matchIds].at(-1));
    matchIds.add(await matchSurface.getAttribute("data-match-id"));
  }
  expect(matchIds.size).toBe(6);
  await expect(scenes).toHaveText("1");
  await expect(meshes).toHaveText(initialMeshes);
  await expect(materials).toHaveText(initialMaterials);

  for (let index = 0; index < 10; index += 1) {
    await page.getByRole("button", { name: "Reset Default Match" }).click();
  }
  await expect(scenes).toHaveText("1");
  await expect(meshes).toHaveText(initialMeshes);
  await expect(materials).toHaveText(initialMaterials);
  const finalTextures = Number(await textures.textContent());
  expect(finalTextures).toBeLessThanOrEqual(26);
  expect(finalTextures).toBeLessThanOrEqual(initialTextures + 1);
  const finalHeap = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0);
  if (initialHeap > 0 && finalHeap > 0) {
    expect(finalHeap).toBeLessThan(initialHeap + 64 * 1024 * 1024);
  }

  const visualFixture = page.getByLabel("Visual fixture");
  for (const fixture of ["damage-resolution", "priority-change", "lane-attack", "victory"]) {
    await visualFixture.selectOption(fixture);
    await page.getByRole("button", { name: "Load Fixture" }).click();
  }
  const matchResult = page.getByRole("dialog").filter({ hasText: "Gauntlet Match Complete" });
  await expect(matchResult).toBeVisible();
  await expect(matchResult.getByRole("heading", { name: /Victory|Defeat/ })).toBeVisible();
  await expect(matchResult).toContainText(/Player [12] wins the fixture match\./);
  await page.waitForTimeout(900);
  await expect(matchResult).toBeVisible();
  await expect(scenes).toHaveText("1");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("Rotate to landscape for the 3D battlefield")).toBeVisible();
  await expect(page.getByRole("region", { name: "Keyboard match controls" })).toBeAttached();
});

test("responsive, keyboard, focus, zoom, target-size, and high-contrast contracts remain usable", async ({ page, baseURL }) => {
  test.setTimeout(90000);
  await page.goto(`${baseURL}/?babylon-test=1&seed=production-qualification`);
  await expect(page.getByTestId("production-babylon-match")).toBeVisible();

  const viewports = [
    { width: 2560, height: 1080, portraitGuard: false },
    { width: 1180, height: 820, portraitGuard: false },
    { width: 820, height: 1180, portraitGuard: false },
    { width: 844, height: 390, portraitGuard: false },
    { width: 390, height: 844, portraitGuard: true }
  ];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expect(page.locator("canvas.babylon-match-canvas")).toBeAttached();
    if (viewport.portraitGuard) {
      await expect(page.getByText("Rotate to landscape for the 3D battlefield")).toBeVisible();
      await expect(page.getByRole("region", { name: "Keyboard match controls" })).toBeAttached();
    } else {
      await expect(page.locator("canvas.babylon-match-canvas")).toBeVisible();
      await expect(page.locator(".production-context-panel")).toBeVisible();
      await expect(page.locator(".production-player-plate")).toHaveCount(2);
    }
  }

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "h" })));
  const handButtons = page.locator('[data-match-zone="hand"]:not(:disabled)');
  await expect(handButtons.first()).toBeVisible();
  await handButtons.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(handButtons.nth(1)).toBeFocused();
  await page.keyboard.press("End");
  await expect(handButtons.last()).toBeFocused();
  await page.keyboard.press("Home");
  await expect(handButtons.first()).toBeFocused();

  await handButtons.first().click({ button: "right" });
  await expect(page.getByRole("dialog", { name: /Inspect/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /Inspect/ })).toHaveCount(0);
  await expect(handButtons.first()).toBeFocused();

  await page.evaluate(() => document.activeElement?.blur());
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "h" })));
  await expect(handButtons.first()).toBeFocused();
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" })));
  await expect(page.locator('[data-match-zone="actions"]:not(:disabled)').first()).toBeFocused();

  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "d" })));
  await expect(page.getByRole("dialog", { name: "Discard piles" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Discard piles" })).toHaveCount(0);

  const undersizedTargets = await page.locator(
    ".babylon-accessible-control-row button:visible, "
    + ".production-action-buttons button:visible, "
    + ".production-match-utilities > summary:visible, "
    + ".production-match-utilities-panel button:visible"
  ).evaluateAll((targets) => targets
    .map((target) => {
      const rect = target.getBoundingClientRect();
      return {
        label: target.textContent?.trim() || target.getAttribute("aria-label") || target.tagName,
        width: rect.width,
        height: rect.height
      };
    })
    .filter(({ width, height }) => width < 44 || height < 44));
  expect(undersizedTargets).toEqual([]);

  for (const zoom of [0.8, 1, 1.25, 1.5, 1.75, 2]) {
    await page.evaluate((value) => {
      document.documentElement.style.zoom = String(value);
    }, zoom);
    await expect(page.getByTestId("production-babylon-match")).toBeVisible();
    await expect(page.locator(".production-context-panel")).toBeVisible();
    await expect(page.getByRole("region", { name: "Keyboard match controls" })).toBeAttached();
  }
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });

  await page.emulateMedia({ forcedColors: "active" });
  await expect(page.locator(".production-context-panel")).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .exclude("canvas")
    .analyze();
  expect(accessibility.violations).toEqual([]);
});
