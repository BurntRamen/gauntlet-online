const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const { io } = require("socket.io-client");
const fs = require("node:fs/promises");
const { navigatePlayer, setGuestName } = require("./player-navigation");
const SERVER_URL = "http://127.0.0.1:4100";
const PASSWORD = "Flow-Test-Password-42";

test("primary menu navigation preserves history without an uncaught error", async ({ page, baseURL }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(baseURL);
  await navigatePlayer(page, "decks");
  await expect(page.getByRole("heading", { name: "Decks & Cards", exact: true, level: 1 })).toBeVisible();
  await navigatePlayer(page, "play");
  await expect(page.getByRole("heading", { name: "Ready to play?", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Decks & Cards", exact: true, level: 1 })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Ready to play?", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("a stalled startup becomes retryable and recovers when the server returns", async ({ page, baseURL }) => {
  const { getPublicGameContent } = require("../server/gameContent");
  let attempts = 0;
  let serverAvailable = false;
  await page.route("**/api/game-content", async (route) => {
    attempts += 1;
    if (!serverAvailable) return;
    await route.fulfill({ json: { content: getPublicGameContent() } });
  });
  await page.goto(baseURL);
  await expect(page.getByRole("heading", { name: "Loading Gauntlet" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unable to connect" })).toBeVisible({ timeout: 25000 });
  await expect(page.getByRole("status")).toContainText("taking too long");
  const stalledAttempts = attempts;
  serverAvailable = true;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ready to play?", exact: true })).toBeVisible();
  expect(attempts).toBe(stalledAttempts + 1);
});

test("an invitation opens room entry and a new guest joins without signing in", async ({ page, baseURL }) => {
  const host = io(SERVER_URL, { autoConnect: false, transports: ["websocket"] });
  try {
    const connected = waitEvent(host, "connect"); host.connect(); await connected;
    const assigned = waitEvent(host, "assign"); host.emit("createRoom", { guestName: "Invitation Host" });
    const { roomCode } = await assigned;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseURL}?join=${roomCode}`);
    await expect(page.getByRole("heading", { name: "Private Tables", exact: true })).toBeVisible();
    await expect(page.getByLabel("Room code")).toHaveValue(roomCode);
    await setGuestName(page, "Invited Newcomer");
    await navigatePlayer(page, "play", "tables");
    await expect(page.getByLabel("Room code")).toHaveValue(roomCode);
    await page.getByRole("button", { name: "Join as Player", exact: true }).click();
    await expect(page.getByText("Table Command")).toBeVisible();
    await expect(page.getByText("Invited Newcomer", { exact: true })).toBeVisible();
  } finally { host.disconnect(); }
});

test("fresh visitors can enter practice directly and each destination explains its next action", async ({ page, baseURL }) => {
  await page.goto(baseURL);
  await expect(page.getByRole("region", { name: "Suggested next action" })).toContainText("Your first match is one click away.");
  await setGuestName(page, "New Practice Player");
  await expect(page.getByRole("heading", { name: "Your Profile", exact: true })).toBeVisible();
  await navigatePlayer(page, "decks");
  await expect(page.getByRole("button", { name: /Browse Collection/ })).toHaveAttribute("aria-description", "Sign in to browse");
  await navigatePlayer(page, "play");
  await page.getByRole("button", { name: "Start Basic vs AI", exact: true }).click();
  await expect(page.getByTestId("production-babylon-match")).toBeVisible();
});

test("draft explains saving before picks and returns to Draft after sign-in", async ({ page, request, baseURL }) => {
  const credentials = await account(request, "DraftEntry", "192.0.2.46");
  await page.goto(baseURL);
  await navigatePlayer(page, "draft", "bot");
  await expect(page.getByText(/Guests can play Draft and Sealed as practice/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Bot Draft", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Sign in to save your deck", exact: true }).click();
  await page.getByPlaceholder("Account name").fill(credentials.account.name);
  await page.getByPlaceholder("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Draft & Sealed", exact: true, level: 1 })).toBeVisible();
  await expect(page.getByText("Saved decks stay with your account.", { exact: true })).toBeVisible();
  await expect(page.getByText(/Guests can play Draft and Sealed as practice/)).toHaveCount(0);
});

test("direct practice preserves a saved account while its profile is unavailable", async ({ page, request, baseURL }) => {
  const credentials = await account(request, "ProfileEntry", "192.0.2.47");
  await page.addInitScript((token) => localStorage.setItem("gauntlet_auth_token", token), credentials.token);
  await page.route("**/api/auth/me", (route) => route.fulfill({
    status: 503, contentType: "application/json", body: JSON.stringify({ error: "Temporarily unavailable" })
  }));
  await page.goto(baseURL);
  await page.getByRole("button", { name: "Start Basic vs AI", exact: true }).click();
  await expect(page.getByTestId("production-babylon-match")).toBeVisible();
  await expect(page.locator(".production-player-plate-bottom .production-player-copy strong")).toHaveText(credentials.account.name);
});

async function account(request, prefix, address = "192.0.2.42") {
  const name = `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  const response = await request.post(`${SERVER_URL}/api/auth/register`, {
    headers: { "X-Forwarded-For": address },
    data: { name, password: PASSWORD }
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}
async function signedIn(page, baseURL, credentials) {
  await page.addInitScript((token) => localStorage.setItem("gauntlet_auth_token", token), credentials.token);
  await page.goto(baseURL);
  await navigatePlayer(page, "profile");
  await expect(page.getByText(`Signed in as ${credentials.account.name}`)).toBeVisible();
}
function waitEvent(socket, name) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, receive); reject(new Error(`Missing ${name}`)); }, 5000);
    function receive(value) { clearTimeout(timer); resolve(value); }
    socket.once(name, receive);
  });
}

test("outer menus are accessible on phones and the draft shortcut opens Draft", async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(baseURL);
  for (const [area, title] of [["play", "Ready to play?"], ["campaign", "Campaign"], ["matches", "Matches"], ["decks", "Decks & Cards"], ["profile", "Your Profile"]]) {
    await navigatePlayer(page, area);
    await expect(page.getByRole("heading", { name: title, exact: true, level: 1 })).toBeVisible();
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations, `${area} accessibility`).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await navigatePlayer(page, "play");
  const draftShortcut = page.getByRole("button", { name: "Draft & Sealed", exact: true });
  await expect(draftShortcut).toHaveAttribute("aria-description", "Choose format");
  await draftShortcut.click();
  await expect(page.getByRole("heading", { name: "Draft & Sealed", exact: true, level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Draft Room", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("active deck leads Decks & Cards and Profile keeps picture editing available", async ({ page, request, baseURL }, testInfo) => {
  test.setTimeout(90000);
  const credentials = await account(request, "MenuLayout", "192.0.2.48");
  const saved = await request.post(`${SERVER_URL}/api/collection/save-constructed-deck`, {
    headers: { Authorization: `Bearer ${credentials.token}` },
    data: { name: "The Copper Guard", factionId: "rumin", cardQuantities: {} }
  });
  expect(saved.ok()).toBeTruthy();
  await signedIn(page, baseURL, credentials);
  const settleMenu = async () => {
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.querySelectorAll(".cd-shell img")].map(img => img.decode().catch(() => {})));
    });
  };
  for (const [width, height, label] of [[1366, 900, "desktop"], [768, 1024, "tablet"], [390, 844, "phone"]]) {
    await page.setViewportSize({ width, height });
    await navigatePlayer(page, "decks");
    await settleMenu();
    const primary = page.locator('.cd-action-tile[data-action-id="editor"]');
    await expect(primary).toBeEnabled();
    await expect(primary).toContainText("Edit Active Deck");
    await expect(page.locator(".cd-panel").filter({ has: page.getByRole("heading", { name: "Current deck", exact: true }) })).toContainText("The Copper Guard");
    await expect(page.locator("[data-layout-module]").first()).toHaveAttribute("data-layout-module", "editor");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`build-${label}.png`), fullPage: true });
    await navigatePlayer(page, "profile");
    await settleMenu();
    await expect(page.getByRole("heading", { name: "Your Profile", exact: true })).toBeVisible();
    await expect(page.getByText("Customize menu layouts", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("switch", { name: "Customize Mode" })).toHaveCount(0);
    await page.getByText("Portrait, featured decks & campaign achievements", { exact: true }).click();
    const hero = page.locator(".identity-dossier-hero");
    await expect(hero.getByRole("img", { name: `${credentials.account.name} portrait` })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Guest Identity", exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Upload profile portrait")).not.toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`profile-${label}.png`), fullPage: true });
    const pictureSettings = page.getByText("Edit profile picture", { exact: true });
    await pictureSettings.focus();
    await pictureSettings.press("Enter");
    await expect(page.getByLabel("Upload profile portrait")).toBeVisible();
    await pictureSettings.press("Enter");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await navigatePlayer(page, "decks");
  await page.locator('.cd-action-tile[data-action-id="editor"]').click();
  await expect(page.getByLabel("Deck name", { exact: true })).toHaveValue("The Copper Guard");
});

test("sign-out cancels ranked matchmaking and a new identity cannot inherit the old queue", async ({ page, request, baseURL }) => {
  const old = await account(request, "LogoutA");
  const opponent = await account(request, "LogoutB");
  const next = await account(request, "LogoutC");
  let releaseOldFriends;
  await page.route("**/api/friends", async (route) => {
    if (route.request().headers().authorization !== `Bearer ${old.token}`) return route.continue();
    await new Promise((resolve) => { releaseOldFriends = resolve; });
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Expired old session" }) });
  });
  await signedIn(page, baseURL, old);
  await navigatePlayer(page, "compete", "ranked");
  await page.getByRole("button", { name: "Find Ranked Match", exact: true }).click();
  await expect(page.getByRole("region", { name: "Ranked queue" })).toContainText(/Searching Season Zero/);
  await navigatePlayer(page, "profile");
  await page.getByRole("button", { name: "Sign Out" }).click();
  await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("gauntlet_auth_token"))).toBeNull();
  const socket = io(SERVER_URL, { autoConnect: false, transports: ["websocket"] });
  try {
    const connected = waitEvent(socket, "connect");
    socket.connect();
    await connected;
    const status = waitEvent(socket, "matchmakingStatus");
    socket.emit("joinMatchmaking", { authToken: opponent.token });
    expect(await status).toMatchObject({ inQueue: true, queueSize: 1 });
    await page.getByPlaceholder("Account name").fill(next.account.name);
    await page.getByPlaceholder("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page.getByText(`Signed in as ${next.account.name}`)).toBeVisible();
    expect(releaseOldFriends).toBeTruthy();
    const oldResponse = page.waitForResponse((response) => response.url().endsWith("/api/friends") && response.status() === 401);
    releaseOldFriends();
    await oldResponse;
    await navigatePlayer(page, "compete", "ranked");
    await page.getByRole("button", { name: "Find Ranked Match", exact: true }).click();
    await expect(page.getByText("Table Command")).toBeVisible();
    await expect(page.getByText(next.account.name, { exact: true })).toBeVisible();
    await expect(page.getByText(old.account.name, { exact: true })).toHaveCount(0);
  } finally { releaseOldFriends?.(); socket.disconnect(); }
});

test("expired saved rooms recover to the menu and disconnected room entry reports a usable error", async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    localStorage.setItem("gauntlet_room_code", "EXPIREDROOM");
    localStorage.setItem("gauntlet_reconnect_token", "expired-test-token");
    localStorage.setItem("gauntlet_role", "player");
  });
  await page.goto(baseURL);
  await expect(page.getByText(/This table is no longer available/)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("gauntlet_room_code"))).toBeNull();
  await setGuestName(page, "Recovery Guest");
  await navigatePlayer(page, "play", "tables");
  await page.context().setOffline(true);
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /^Create Duel/ }).click();
  await expect(page.getByText(/Connecting to the server|table did not respond/)).toBeVisible({ timeout: 12000 });
  await page.context().setOffline(false);
});

test("a full bot draft can be saved and found in the deck library", async ({ page, request, baseURL }) => {
  test.setTimeout(120000);
  const credentials = await account(request, "DraftFlow", "192.0.2.43");
  await signedIn(page, baseURL, credentials);
  await navigatePlayer(page, "draft", "bot");
  await page.getByRole("button", { name: "Start Bot Draft", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Gauntlet Bot Draft" })).toBeVisible();
  for (let pick = 0; pick < 60; pick++) {
    if (await page.getByRole("heading", { name: /Build Draft Deck/ }).count()) break;
    const pack = page.locator(".menu-card").filter({ has: page.getByRole("heading", { name: /Current Pack/ }) });
    const card = pack.getByRole("button").first();
    await expect(card).toBeEnabled();
    const progress = page.getByRole("progressbar", { name: /Draft progress:|Draft complete/ });
    const previous = Number(await progress.getAttribute("value"));
    await card.click();
    await expect(progress).toHaveAttribute("value", String(previous + 1));
  }
  await expect(page.getByRole("heading", { name: /Build Draft Deck/ })).toBeVisible();
  const build = page.locator(".menu-card").filter({ has: page.getByRole("heading", { name: /Build Draft Deck/ }) });
  await build.getByRole("button").filter({ hasText: /Swap In$/ }).first().click();
  await page.getByRole("button", { name: "Save Deck for Draft League" }).click();
  await expect(page.getByText(/saved.*draft league|draft deck saved/i)).toBeVisible();
  const result = await request.get(`${SERVER_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${credentials.token}` } });
  const saved = (await result.json()).account.stats.savedDraftDeck;
  expect(saved.draftType).toBe("bot");
  expect(saved.cards.length).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Main Menu" }).click();
  await navigatePlayer(page, "decks", "library");
  await expect(page.getByText(saved.name, { exact: true })).toBeVisible();
});

test("completed match exports, imports on another device, replays, and rejects malformed JSON", async ({ browser, page, request, baseURL }) => {
  test.setTimeout(90000);
  const credentials = await account(request, "History", "192.0.2.44");
  await signedIn(page, baseURL, credentials);
  await navigatePlayer(page, "play");
  await page.getByRole("button", { name: "Start Basic vs AI", exact: true }).click();
  await expect(page.getByTestId("production-babylon-match")).toBeVisible();
  await page.getByText("Match", { exact: true }).click();
  await page.getByRole("button", { name: "Concede", exact: true }).click();
  await page.getByRole("group", { name: "Confirm concession" }).getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Matches", exact: true }).click();
  const row = page.locator('.matches-row[data-local-match="true"]').first();
  await expect(row).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await row.getByRole("button", { name: "Export Match File", exact: true }).click();
  const download = await downloaded;
  const bytes = await fs.readFile(await download.path());
  const context = await browser.newContext();
  try {
    const other = await context.newPage();
    await other.goto(baseURL);
    await navigatePlayer(other, "matches", "replays");
    const input = other.locator('.match-importer input[type="file"]');
    await input.setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from("{bad") });
    await expect(other.locator(".match-importer [role=alert]")).toBeVisible();
    await input.setInputFiles({ name: "match.json", mimeType: "application/json", buffer: bytes });
    await expect(other.getByText("Valid Gauntlet match file")).toBeVisible();
    await other.getByRole("button", { name: "Save to My Matches" }).click();
    await expect(other.getByText("Saved to My Matches.")).toBeVisible();
    await other.getByRole("button", { name: "Save to My Matches" }).click();
    await expect(other.getByText("This match is already saved on this device.")).toBeVisible();
    await other.locator(".match-import-preview").getByRole("button", { name: "Watch Replay" }).click();
    await expect(other.getByTestId("replay-transport")).toBeVisible();
    await other.getByRole("button", { name: "Next action" }).click();
    await expect(other.getByRole("slider", { name: "Replay action timeline" })).not.toHaveValue("0");
    await other.goBack();
    await expect(other.getByRole("heading", { name: "Replay Library", exact: true })).toBeVisible();
  } finally { await context.close(); }
});

test("four guests can start free-for-all, reconnect, and finish by elimination", async ({ browser, baseURL }) => {
  test.setTimeout(120000);
  const contexts = [];
  const pages = [];
  try {
    for (let index = 0; index < 4; index++) {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      contexts.push(context);
      const page = await context.newPage();
      pages.push(page);
      page.on("dialog", (dialog) => dialog.accept());
      await page.goto(baseURL);
      await setGuestName(page, `FFA Flow ${index + 1}`);
      await navigatePlayer(page, "play", "tables");
      if (index === 0) {
        await page.getByRole("button", { name: /^Create Free-for-All/ }).click();
      } else {
        const code = await pages[0].getByLabel("Room code").inputValue();
        await page.getByLabel("Room code").fill(code);
        await page.getByRole("button", { name: "Join as Player" }).click();
      }
      await expect(page.getByText("Table Command")).toBeVisible();
      await page.getByRole("tab", { name: /^Rumin\b/ }).click();
      await page.getByRole("button", { name: "Choose Rumin" }).click();
    }
    for (const page of pages) await page.getByRole("button", { name: "Confirm Start" }).click();
    for (const page of pages) await expect(page.locator(".ffa-root")).toBeVisible();
    await pages[3].reload();
    await expect(pages[3].locator(".ffa-root")).toBeVisible();
    async function actingPage(candidates, name) {
      let found;
      await expect.poll(async () => {
        for (const page of candidates) if (await page.getByRole("button", { name, exact: true }).isVisible()) { found = page; return true; }
        return false;
      }).toBe(true);
      return found;
    }
    for (let step = 0; step < 4; step++) {
      const actor = await actingPage(pages, "Pass / Continue");
      await actor.getByRole("button", { name: "Pass / Continue", exact: true }).click();
      await expect(actor.getByRole("button", { name: "Pass / Continue", exact: true })).toHaveCount(0);
    }
    const departing = await actingPage(pages, "Skip Lane 1");
    await departing.getByRole("button", { name: "Concede", exact: true }).click();
    const remaining = pages.filter((page) => page !== departing);
    await expect(remaining[0].getByText(/3 players remain/).first()).toBeVisible();
    for (let lane = 1; lane <= 3; lane++) {
      for (let seat = 0; seat < 3; seat++) {
        const actor = await actingPage(remaining, `Skip Lane ${lane}`);
        await actor.getByRole("button", { name: `Skip Lane ${lane}`, exact: true }).click();
        await expect(actor.getByRole("button", { name: `Skip Lane ${lane}`, exact: true })).toHaveCount(0);
      }
    }
    await actingPage(remaining, "Pass / Continue");
    for (const page of remaining.slice(0, 2)) await page.getByRole("button", { name: "Concede", exact: true }).click();
    await expect(remaining[2].locator(".ffa-root")).toHaveCount(0);
    await expect(remaining[2].getByRole("button", { name: "Main Menu", exact: true })).toBeVisible();
    await expect(remaining[2].getByText(/victory|you win/i).first()).toBeVisible();
  } finally {
    for (const context of contexts) await context.close();
  }
});

test("a disconnected human draft explains recovery and can be cancelled", async ({ page, baseURL }) => {
  const guest = io(SERVER_URL, { autoConnect: false, transports: ["websocket"] });
  try {
    await page.goto(baseURL);
    await setGuestName(page, "Draft Recovery Host");
    await navigatePlayer(page, "draft", "live");
    await page.getByRole("button", { name: "Create Draft Room", exact: true }).click();
    const code = await page.getByLabel("Room code").inputValue();
    const connected = waitEvent(guest, "connect"); guest.connect(); await connected;
    const assigned = waitEvent(guest, "assign"); guest.emit("joinRoom", { roomCode: code, guestName: "Draft Recovery Guest" }); await assigned;
    await expect(page.getByText("Draft Recovery Guest", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Start Draft", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Current Pack/ })).toBeVisible();
    guest.disconnect();
    await expect(page.getByRole("heading", { name: "Waiting for a player to reconnect" })).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Cancel Draft", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Draft cancelled", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Current Pack/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Main Menu", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Draft & Sealed", exact: true, level: 1 })).toBeVisible();
  } finally { guest.disconnect(); }
});


test("a temporary account-service failure preserves the session and reload recovers", async ({ page, request, baseURL }) => {
  const credentials = await account(request, "Transient", "192.0.2.45");
  await page.addInitScript((token) => localStorage.setItem("gauntlet_auth_token", token), credentials.token);
  await page.route("**/api/auth/me", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Temporarily unavailable" }) }));
  const failed = page.waitForResponse((response) => response.url().endsWith("/api/auth/me") && response.status() === 503);
  await page.goto(baseURL);
  await failed;
  await navigatePlayer(page, "profile");
  await expect(page.getByText("Temporarily unavailable")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("gauntlet_auth_token"))).toBe(credentials.token);
  await page.unroute("**/api/auth/me");
  await page.reload();
  await navigatePlayer(page, "profile");
  await expect(page.getByText("Signed in as " + credentials.account.name)).toBeVisible();
});
