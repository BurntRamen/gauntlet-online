const { test, expect } = require("@playwright/test");
const path = require("node:path");

async function enterDraftMenu(page, baseURL, name = "Draft Tester") {
  await page.goto(baseURL);
  await page.locator('button[data-area="identity"]').click();
  await page.getByLabel("Play as guest").check();
  await page.getByPlaceholder("Guest name").fill(name);
  await page.locator('button[data-area="play"]').click();
  await page.getByRole("tab", { name: /^Draft\b/ }).click();
}

test("a fresh visitor sees loading until the draft table is ready after seat assignment", async ({ page, baseURL }) => {
  let assigned = false;
  let hold = true;
  let release;
  await page.routeWebSocket(/socket\.io/, (client) => {
    const server = client.connectToServer();
    const queued = [];
    server.onMessage(message => {
      if (String(message).includes('"assign"')) assigned = true;
      if (hold && (String(message).includes('"lobbyState"') || String(message).includes('"draftState"') || String(message).startsWith("43"))) queued.push(message);
      else client.send(message);
    });
    release = () => { hold = false; queued.forEach(message => client.send(message)); };
  });
  await page.goto(baseURL);
  await page.locator('button[data-area="play"]').click();
  await page.getByRole("tab", { name: "Draft", exact: true }).click();
  await page.getByRole("button", { name: /Draft against bots/ }).click();
  await expect.poll(() => assigned).toBe(true);
  await expect(page.getByRole("heading", { name: "Opening your table" })).toBeVisible();
  await expect(page.getByRole("progressbar")).toBeVisible();
  await expect(page.getByText("Table Command", { exact: true })).toHaveCount(0);
  release();
  await expect(page.getByRole("heading", { name: "Gauntlet Bot Draft", exact: true })).toBeVisible();
});

test("entry failures are visible and Sealed can be retried", async ({ page, baseURL }) => {
  let rejected = false;
  await page.routeWebSocket(/socket\.io/, (client) => {
    const server = client.connectToServer();
    client.onMessage((message) => {
      if (!rejected && String(message).includes('"createSealedRoom"')) {
        rejected = true;
        const [, id] = String(message).match(/^42(\d+)\[/);
        client.send(`43${id}[${JSON.stringify({ ok: false, error: "That set is temporarily unavailable." })}]`);
      } else server.send(message);
    });
  });
  await enterDraftMenu(page, baseURL);
  await page.getByRole("button", { name: /Open a Sealed pool/ }).click();
  await expect(page.getByText("That set is temporarily unavailable.")).toBeVisible();
  await page.getByRole("button", { name: /Open a Sealed pool/ }).click();
  await expect(page.getByRole("heading", { name: "Gauntlet Sealed", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your Sealed Pool (48)", exact: true })).toBeVisible();
});

test("bot draft opens, survives reload, and completes all 24 picks", async ({ page, baseURL }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await enterDraftMenu(page, baseURL);
  await page.getByRole("button", { name: /Solo Table/i }).click();
  await expect(page.getByRole("heading", { name: "Gauntlet Bot Draft" })).toBeVisible();
  for (let pick = 0; pick < 24; pick++) {
    await expect(page.getByRole("heading", { name: `Your Draft Pool (${pick})`, exact: true })).toBeVisible();
    await page.getByRole("button").filter({ has: page.locator("span", { hasText: /^Pick$/ }) }).first().click();
    if (pick === 2) {
      await expect(page.getByRole("heading", { name: "Your Draft Pool (3)", exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByRole("heading", { name: "Gauntlet Bot Draft" })).toBeVisible();
    }
  }
  await expect(page.getByRole("heading", { name: "Build Draft Deck (0 swaps)", exact: true })).toBeVisible();
  await page.getByRole("button").filter({ has: page.locator("span", { hasText: /^Swap In$/ }) }).first().click();
  await expect(page.getByRole("heading", { name: "Build Draft Deck (1 swaps)", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("draft entry shows loading, saves an account deck, and opens the correct mode from Build", async ({ page, request, baseURL }) => {
  const registered = await request.post(`${process.env.DRAFT_SERVER_URL || "http://127.0.0.1:4145"}/api/auth/register`, { data: { name: `Draft${Date.now().toString(36)}`, password: "Draft-Test-Password-42" } });
  expect(registered.ok()).toBeTruthy();
  const { token } = await registered.json();
  await page.addInitScript((value) => localStorage.setItem("gauntlet_auth_token", value), token);
  let releaseEntry;
  let rejectSave = true;
  await page.routeWebSocket(/socket\.io/, (client) => {
    const server = client.connectToServer();
    client.onMessage((message) => {
      if (String(message).includes('"createBotDraftRoom"')) releaseEntry = () => server.send(message);
      else if (rejectSave && String(message).includes('"saveDraftDeck"')) {
        rejectSave = false;
        const [, id] = String(message).match(/^42(\d+)\[/);
        client.send(`43${id}[${JSON.stringify({ ok: false, error: "Could not save draft deck. Please retry." })}]`);
      }
      else server.send(message);
    });
  });
  await page.goto(baseURL);
  await page.locator('button[data-area="build"]').click();
  await page.getByRole("button", { name: "Open Draft Modes" }).click();
  await expect(page.getByRole("tab", { name: /^Draft\b/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: /Solo Table/i }).click();
  await expect(page.getByRole("heading", { name: "Opening your table" })).toBeVisible();
  await expect(page.getByRole("progressbar")).toBeVisible();
  await page.screenshot({ path: path.join(__dirname, "../artifacts/draft-review/loading.png") });
  await expect.poll(() => typeof releaseEntry).toBe("function");
  releaseEntry();
  await expect(page.getByRole("heading", { name: "Gauntlet Bot Draft" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: path.join(__dirname, "../artifacts/draft-review/mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1366, height: 768 });
  for (let pick = 0; pick < 24; pick++) {
    await expect(page.getByRole("heading", { name: `Your Draft Pool (${pick})`, exact: true })).toBeVisible();
    await page.getByRole("button").filter({ has: page.locator("span", { hasText: /^Pick$/ }) }).first().click();
  }
  await page.getByRole("button").filter({ has: page.locator("span", { hasText: /^Swap In$/ }) }).first().click();
  await page.getByRole("button", { name: "Save Deck for Draft League" }).click();
  await expect(page.getByRole("alert")).toHaveText("Could not save draft deck. Please retry.");
  await page.getByRole("button", { name: "Save Deck for Draft League" }).click();
  await expect(page.getByText(/Saved 1 .* Bot Draft League/)).toBeVisible();
  await page.screenshot({ path: path.join(__dirname, "../artifacts/draft-review/deck-saved.png"), fullPage: true });
  await page.getByRole("button", { name: "Main Menu", exact: true }).click();
  await page.getByRole("button", { name: "Play saved bot-draft deck", exact: true }).click();
  await expect(page.getByRole("button", { name: "Leave Draft Queue" })).toBeVisible();
  await page.getByRole("button", { name: "Leave Draft Queue" }).click();
});

test("expired drafts recover to the menu", async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    localStorage.setItem("gauntlet_room_code", "MISSING");
    localStorage.setItem("gauntlet_reconnect_token", "expired");
    localStorage.setItem("gauntlet_role", "player");
  });
  await page.goto(`${baseURL}/?join=NEW123`);
  await expect(page.getByText("This table is no longer available. You can start or join another game.")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("gauntlet_reconnect_token"))).toBeNull();
});

test("live draft joins from Draft, reconnects a waiting player, and blocks late entrants", async ({ browser, page, baseURL }) => {
  const guestContext = await browser.newContext();
  const lateContext = await browser.newContext();
  try {
    const guest = await guestContext.newPage();
    const late = await lateContext.newPage();
    await enterDraftMenu(page, baseURL, "Host");
    await page.getByRole("button", { name: /Draft with friends/i }).click();
    await expect(page.getByRole("button", { name: "Start Draft" })).toBeDisabled();
    const roomCode = await page.getByLabel("Room code").inputValue();
    await enterDraftMenu(guest, baseURL, "Partner");
    await guest.getByRole("tab", { name: "Tables", exact: true }).click();
    await guest.getByLabel("Room code").fill(roomCode);
    await guest.getByRole("button", { name: "Join as Player" }).click();
    await expect(page.getByRole("button", { name: "Start Draft" })).toBeEnabled();
    await guestContext.setOffline(true);
    await expect(page.getByText("Disconnected", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start Draft" })).toBeDisabled();
    await guestContext.setOffline(false);
    await expect(page.getByRole("button", { name: "Start Draft" })).toBeEnabled();
    await page.getByRole("button", { name: "Start Draft" }).click();
    await page.getByRole("button").filter({ has: page.locator("span", { hasText: /^Pick$/ }) }).first().click();
    await expect(page.getByText("Pick locked in. Waiting for the other players before the next pack.")).toBeVisible();
    await guest.reload();
    await guest.getByRole("button").filter({ has: guest.locator("span", { hasText: /^Pick$/ }) }).first().click();
    await expect(page.getByRole("heading", { name: "Current Pack (7 cards)" })).toBeVisible();
    await enterDraftMenu(late, baseURL, "Late Player");
    await late.getByRole("tab", { name: "Tables", exact: true }).click();
    await late.getByLabel("Room code").fill(roomCode);
    await late.getByRole("button", { name: "Join as Player" }).click();
    await expect(late.getByText(/This table has already started/)).toBeVisible();
    await late.getByRole("button", { name: "Spectate", exact: true }).click();
    await expect(late.getByRole("heading", { name: "Gauntlet Draft", exact: true })).toBeVisible();
    await expect(late.getByRole("heading", { name: /Current Pack/ })).toHaveCount(0);
  } finally {
    await guestContext.close();
    await lateContext.close();
  }
});
