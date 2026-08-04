const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

async function prepareGuest(page, baseURL, name, playTab = "Tables") {
  await page.goto(baseURL);
  await page.locator('button[data-area="identity"]').click();
  await page.getByLabel("Play as guest").check();
  await page.getByPlaceholder("Guest name").fill(name);
  await page.locator('button[data-area="play"]').click();
  await page.getByRole("tab", { name: playTab }).click();
}

async function createBasicRoom(hostPage) {
  await hostPage.getByRole("button", { name: /Duel/ }).click();
  await expect(hostPage.getByText("Table Command")).toBeVisible();
  await hostPage.getByRole("button", { name: "Basic Mode" }).click();
  return hostPage.getByLabel("Room code").inputValue();
}

async function createFactionRoom(hostPage) {
  await hostPage.getByRole("button", { name: /Duel/ }).click();
  await expect(hostPage.getByText("Table Command")).toBeVisible();
  return hostPage.getByLabel("Room code").inputValue();
}

async function chooseLobbyFaction(page, factionName) {
  await page.getByRole("tab", { name: new RegExp(`^${factionName}\\b`) }).click();
  await page.getByRole("button", { name: `Choose ${factionName}` }).click();
}

async function joinRoom(guestPage, roomCode) {
  await guestPage.getByLabel("Room code").fill(roomCode);
  await guestPage.getByRole("button", { name: "Join as Player" }).click();
  await expect(guestPage.getByText("Table Command")).toBeVisible();
}

function currentAction(page) {
  return page.getByRole("region", { name: "Current match action" });
}

async function openAccessibleControls(page) {
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
    const value = Number(label.match(/value\s+(\d+)/i)?.[1] || 0);
    candidates.push({ button, value });
  }
  expect(candidates.length).toBeGreaterThan(0);
  candidates.sort((left, right) => direction === "highest"
    ? right.value - left.value
    : left.value - right.value);
  // Hand controls are the semantic keyboard/screen-reader mirror for Babylon
  // meshes. Focus and activate them as a keyboard user would; pointer clicks
  // belong to the visible card meshes on the canvas.
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
  for (let selection = 0; selection < 8 && await confirmation.isDisabled(); selection += 1) {
    await clickHandCardByValue(page, "highest");
  }
  await expect(confirmation).toBeEnabled();
}

async function localLife(page) {
  return Number(await page.locator(".production-player-plate-bottom .production-life strong").textContent());
}

async function registerTestAccount(request, name) {
  const response = await request.post("http://127.0.0.1:4100/api/auth/register", {
    data: { name, password: "Babylon-Test-Password-42" }
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function prepareAccount(page, token, baseURL, playTab = "Ranked") {
  await page.addInitScript((authToken) => {
    window.localStorage.setItem("gauntlet_auth_token", authToken);
  }, token);
  await page.goto(baseURL);
  await page.locator('button[data-area="play"]').click();
  await page.getByRole("tab", { name: playTab }).click();
}

function seedDraftDecks(accounts) {
  const accountFile = path.resolve(__dirname, "../.playwright-data/accounts.json");
  const store = JSON.parse(fs.readFileSync(accountFile, "utf8"));
  accounts.forEach(({ account }, index) => {
    const stored = store.accounts.find((candidate) => candidate.id === account.id);
    if (!stored) throw new Error(`Could not seed draft deck for ${account.name}.`);
    stored.stats = stored.stats || {};
    stored.stats.savedDraftDeck = {
      name: `${account.name} Browser Draft`,
      factionId: "rumin",
      factionName: "Rumin",
      draftType: "player",
      cards: [{
        id: `browser-draft-${index}`,
        definitionId: "rumin-browser-draft-scout",
        name: "Browser Draft Scout",
        factionId: "rumin",
        value: 3,
        suit: index === 0 ? "hearts" : "spades",
        replacementSuit: index === 0 ? "hearts" : "spades",
        type: "unit",
        text: "Browser-seeded finalized draft card."
      }]
    };
  });
  fs.writeFileSync(accountFile, JSON.stringify(store, null, 2));
}

test("normal browser lobby flow starts and finishes a live Babylon Basic match", async ({ browser, baseURL }) => {
  test.setTimeout(90000);
  const hostContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const guestContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const spectatorContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();
  const spectatorPage = await spectatorContext.newPage();

  await prepareGuest(hostPage, baseURL, "Lobby Host");
  const roomCode = await createBasicRoom(hostPage);
  expect(roomCode).toMatch(/^[A-Z0-9]+$/);

  await prepareGuest(guestPage, baseURL, "Lobby Guest");
  await joinRoom(guestPage, roomCode);
  await expect(hostPage.getByText("Lobby Guest")).toBeVisible();

  await hostPage.getByRole("button", { name: "Confirm Start" }).click();
  await expect(hostPage.getByRole("button", { name: "Waiting for Other Player" })).toBeVisible();
  await guestPage.getByRole("button", { name: "Confirm Start" }).click();

  for (const page of [hostPage, guestPage]) {
    await expect(page.getByTestId("production-babylon-match")).toBeVisible();
    await expect(page.locator("canvas.babylon-match-canvas")).toBeVisible();
    await expect(page.getByTestId("production-babylon-match")).toHaveAttribute("data-ruleset", "basic");
    await expect(page.getByTestId("production-babylon-match")).toHaveAttribute("data-opponent-kind", "human");
    await expect(page.getByText("Developer tools")).toHaveCount(0);
  }

  await prepareGuest(spectatorPage, baseURL, "Lobby Spectator");
  await spectatorPage.getByLabel("Room code").fill(roomCode);
  await spectatorPage.getByRole("button", { name: "Spectate" }).click();
  await expect(spectatorPage.getByText("Spectator view")).toBeVisible();
  await expect(spectatorPage.locator('[data-match-zone="hand"]')).toHaveCount(0);
  await expect(spectatorPage.getByRole("button", { name: "Pass Priority" })).toHaveCount(0);

  const priorityPage = await hostPage.locator(".production-player-plate-bottom.has-priority").isVisible()
    ? hostPage
    : guestPage;
  const waitingPage = priorityPage === hostPage ? guestPage : hostPage;
  await currentAction(priorityPage).getByRole("button", { name: "Pass Priority" }).click();
  await expect(waitingPage.locator(".production-player-plate-bottom.has-priority")).toBeVisible();

  await waitingPage.getByText("Match", { exact: true }).click();
  await waitingPage.getByRole("button", { name: "Match log" }).click();
  await expect(waitingPage.getByRole("dialog", { name: "Match log" })).toBeVisible();
  await waitingPage.getByRole("button", { name: "Close" }).click();
  await waitingPage.getByRole("button", { name: "Mute sound" }).click();
  await expect(waitingPage.getByRole("button", { name: "Enable sound" })).toBeVisible();
  await waitingPage.getByRole("button", { name: "Offer draw" }).click();

  await expect(priorityPage.getByText("Opponent offered a draw")).toBeVisible();
  await priorityPage.getByRole("button", { name: "Decline" }).click();
  await expect(currentAction(priorityPage)).toContainText("Draw offer declined.");

  await waitingPage.getByRole("button", { name: "Concede" }).click();
  const confirmation = waitingPage.getByRole("group", { name: "Confirm concession" });
  await confirmation.getByRole("button", { name: "Confirm" }).click();

  await expect(waitingPage.getByRole("heading", { name: "Defeat" })).toBeVisible();
  await expect(priorityPage.getByRole("heading", { name: "Victory" })).toBeVisible();

  await priorityPage.getByRole("button", { name: "Request Rematch" }).click();
  await expect(waitingPage.getByRole("button", { name: "Accept Rematch" })).toBeVisible();
  await waitingPage.getByRole("button", { name: "Decline Rematch" }).click();
  await expect(priorityPage.getByRole("dialog").getByText(/declined the rematch/i)).toBeVisible();

  await hostContext.close();
  await guestContext.close();
  await spectatorContext.close();
});

test("live Basic undo, draw, and accepted rematch reconcile through the production experience", async ({ browser, baseURL }) => {
  test.setTimeout(90000);
  const hostContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const guestContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  await prepareGuest(hostPage, baseURL, "Utility Host");
  const roomCode = await createBasicRoom(hostPage);
  await prepareGuest(guestPage, baseURL, "Utility Guest");
  await joinRoom(guestPage, roomCode);
  await hostPage.getByRole("button", { name: "Confirm Start" }).click();
  await guestPage.getByRole("button", { name: "Confirm Start" }).click();
  await expect(hostPage.getByTestId("production-babylon-match")).toBeVisible();
  await expect(guestPage.getByTestId("production-babylon-match")).toBeVisible();

  const originalMatchId = await hostPage.getByTestId("production-babylon-match").getAttribute("data-match-id");
  const priorityPage = await hostPage.locator(".production-player-plate-bottom.has-priority").isVisible()
    ? hostPage
    : guestPage;
  const otherPage = priorityPage === hostPage ? guestPage : hostPage;

  await priorityPage.getByText("Match", { exact: true }).click();
  await priorityPage.getByRole("button", { name: "Request undo" }).click();
  await expect(currentAction(priorityPage)).toContainText("No recent move available to undo.");

  await currentAction(priorityPage).getByRole("button", { name: "Pass Priority" }).click();
  await expect(otherPage.locator(".production-player-plate-bottom.has-priority")).toBeVisible();
  const revisionAfterPass = Number(
    await priorityPage.getByTestId("production-babylon-match").getAttribute("data-revision")
  );
  await priorityPage.getByRole("button", { name: "Request undo" }).click();
  const undoRequest = otherPage.getByRole("status", { name: "Undo request" });
  await expect(undoRequest).toBeVisible();
  await undoRequest.getByRole("button", { name: "Approve" }).click();
  await expect(priorityPage.locator(".production-player-plate-bottom.has-priority")).toBeVisible();
  await expect.poll(async () => Number(
    await priorityPage.getByTestId("production-babylon-match").getAttribute("data-revision")
  )).toBeGreaterThan(revisionAfterPass);

  await priorityPage.getByRole("button", { name: "Offer draw" }).click();
  const drawOffer = otherPage.getByRole("status", { name: "Draw offer" });
  await expect(drawOffer).toBeVisible();
  await drawOffer.getByRole("button", { name: "Accept" }).click();
  await expect(priorityPage.getByRole("heading", { name: "Draw" })).toBeVisible();
  await expect(otherPage.getByRole("heading", { name: "Draw" })).toBeVisible();

  await priorityPage.getByRole("button", { name: "Request Rematch" }).click();
  await otherPage.getByRole("button", { name: "Accept Rematch" }).click();
  await expect(hostPage.getByTestId("production-babylon-match")).toHaveCount(0);
  await expect(hostPage.getByRole("button", { name: "Confirm Start" })).toBeVisible();
  await expect(guestPage.getByRole("button", { name: "Confirm Start" })).toBeVisible();
  await hostPage.getByRole("button", { name: "Confirm Start" }).click();
  await guestPage.getByRole("button", { name: "Confirm Start" }).click();
  await expect(hostPage.getByTestId("production-babylon-match")).toBeVisible();
  await expect(hostPage.getByTestId("production-babylon-match")).not.toHaveAttribute("data-match-id", originalMatchId);

  await hostContext.close();
  await guestContext.close();
});

test("two ordinary browser clients complete live Basic combat and placement through semantic commands", async ({ browser, baseURL }) => {
  test.setTimeout(120000);
  const hostContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const guestContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  await prepareGuest(hostPage, baseURL, "Combat Host");
  const roomCode = await createBasicRoom(hostPage);
  await prepareGuest(guestPage, baseURL, "Combat Guest");
  await joinRoom(guestPage, roomCode);
  await expect(hostPage.getByText("Combat Guest")).toBeVisible();

  await hostPage.getByRole("button", { name: "Confirm Start" }).click();
  await guestPage.getByRole("button", { name: "Confirm Start" }).click();
  await expect(hostPage.getByTestId("production-babylon-match")).toBeVisible();
  await expect(guestPage.getByTestId("production-babylon-match")).toBeVisible();
  await openAccessibleControls(hostPage);
  await openAccessibleControls(guestPage);

  const startingPage = await hostPage.locator(".production-player-plate-bottom.has-priority").isVisible()
    ? hostPage
    : guestPage;
  const otherPage = startingPage === hostPage ? guestPage : hostPage;

  await currentAction(startingPage).getByRole("button", { name: "Pass Priority" }).click();
  await expect(otherPage.locator(".production-player-plate-bottom.has-priority")).toBeVisible();
  await currentAction(otherPage).getByRole("button", { name: "Pass Priority" }).click();

  for (let opportunity = 1; opportunity <= 6; opportunity += 1) {
    const actingPage = opportunity % 2 === 1 ? startingPage : otherPage;
    const lane = Math.ceil(opportunity / 2);
    await expect(currentAction(actingPage)).toContainText(
      new RegExp(`Placement ${opportunity} of 6.*Lane ${lane}`)
    );
    if (opportunity === 6) {
      await currentAction(actingPage).getByRole("button", { name: "Skip Lane" }).click();
    } else {
      await clickHandCardByValue(actingPage, "lowest");
      await currentAction(actingPage).getByRole("button", { name: "Place Facedown" }).click();
    }
  }

  await expect(otherPage.locator(".production-turn-marker")).toContainText("Turn 2");
  await expect(otherPage.locator(".production-player-plate-bottom.has-priority")).toBeVisible();
  await expect(otherPage.getByRole("button", { name: "Lane 3" })).toBeDisabled();
  await expect(otherPage.getByRole("list", { name: "Unavailable lane reasons" }))
    .toContainText("Lane 3 has no face-down card available to attack.");

  // Independent hand combat with a paid hand block.
  await clickHandCardByValue(otherPage, "lowest");
  await expect(currentAction(otherPage)).toContainText("independent hand attack");
  await payUntilEnabled(otherPage, "Confirm Attack");
  await currentAction(otherPage).getByRole("button", { name: "Confirm Attack" }).click();

  await expect(currentAction(startingPage)).toContainText(/may block or decline/i);
  await clickHandCardByValue(startingPage, "lowest");
  await currentAction(startingPage).getByRole("button", { name: "Choose Payment" }).click();
  await payUntilEnabled(startingPage, "Confirm Block");
  await currentAction(startingPage).getByRole("button", { name: "Confirm Block" }).click();
  await expect(startingPage.locator(".production-player-plate-bottom.has-priority")).toBeVisible();

  // Lane 1 resolves unblocked and visibly changes life.
  const lifeBeforeDamage = await localLife(otherPage);
  await activateLaneButton(startingPage, "Lane 1");
  await expect(currentAction(startingPage)).toContainText(/Lane 1 attack/i);
  await payUntilEnabled(startingPage, "Confirm Attack");
  await currentAction(startingPage).getByRole("button", { name: "Confirm Attack" }).click();
  await expect(currentAction(otherPage)).toContainText(/attacked from Lane 1.*may block or decline/i);
  await currentAction(otherPage).getByRole("button", { name: "Take Damage" }).click();
  await expect.poll(() => localLife(otherPage)).toBeLessThan(lifeBeforeDamage);
  await expect(otherPage.locator(".production-player-plate-bottom.has-priority")).toBeVisible();

  // Lane 2 proves that a placed lane can attack and only its same-lane card can block.
  await activateLaneButton(otherPage, "Lane 2");
  await expect(currentAction(otherPage)).toContainText(/Lane 2 attack/i);
  await payUntilEnabled(otherPage, "Confirm Attack");
  await currentAction(otherPage).getByRole("button", { name: "Confirm Attack" }).click();
  await expect(currentAction(startingPage)).toContainText(/attacked from Lane 2.*may block or decline/i);
  await expect(startingPage.getByRole("button", { name: "Lane 1" })).toBeDisabled();
  await expect(startingPage.getByRole("button", { name: "Lane 2" })).toBeEnabled();
  await activateLaneButton(startingPage, "Lane 2");
  await expect(currentAction(startingPage)).toContainText(/Same-lane blocker/i);
  await payUntilEnabled(startingPage, "Confirm Block");
  await currentAction(startingPage).getByRole("button", { name: "Confirm Block" }).click();
  await expect(startingPage.locator(".production-player-plate-bottom.has-priority")).toBeVisible();

  await hostContext.close();
  await guestContext.close();
});

test("normal faction lobby entry executes Polea and Lafayette through live semantic commands", async ({ browser, baseURL }) => {
  test.setTimeout(90000);
  const hostContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const guestContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  await prepareGuest(hostPage, baseURL, "Faction Host");
  const roomCode = await createFactionRoom(hostPage);
  await prepareGuest(guestPage, baseURL, "Faction Guest");
  await joinRoom(guestPage, roomCode);
  await chooseLobbyFaction(hostPage, "Frumo");
  await chooseLobbyFaction(guestPage, "Frumo");
  await hostPage.getByRole("button", { name: "Confirm Start" }).click();
  await guestPage.getByRole("button", { name: "Confirm Start" }).click();
  await expect(hostPage.getByTestId("production-babylon-match")).toHaveAttribute("data-ruleset", "factions");
  await expect(guestPage.getByTestId("production-babylon-match")).toHaveAttribute("data-ruleset", "factions");

  const priorityPage = await hostPage.locator(".production-player-plate-bottom.has-priority").isVisible()
    ? hostPage
    : guestPage;
  await openAccessibleControls(priorityPage);
  const revisionBeforePolea = Number(
    await priorityPage.getByTestId("production-babylon-match").getAttribute("data-revision")
  );
  await priorityPage.locator(".production-faction-actions")
    .getByRole("button", { name: /Polea.*place a hand card/i })
    .click();
  await priorityPage.locator('[data-match-zone="hand"]:not(:disabled)').first().focus();
  await priorityPage.locator('[data-match-zone="hand"]:not(:disabled)').first().press("Enter");
  await activateLaneButton(priorityPage, "Lane 1");
  await currentAction(priorityPage).getByRole("button", { name: "Confirm Placement" }).click();
  await expect.poll(async () => Number(
    await priorityPage.getByTestId("production-babylon-match").getAttribute("data-revision")
  )).toBeGreaterThan(revisionBeforePolea);
  await expect(priorityPage.getByRole("button", { name: "Lane 1" })).toBeEnabled();

  const revisionBeforeLafayette = Number(
    await priorityPage.getByTestId("production-babylon-match").getAttribute("data-revision")
  );
  await priorityPage.locator(".production-faction-actions")
    .getByRole("button", { name: /Lafayette.*switch hand and lane/i })
    .click();
  await priorityPage.locator('[data-match-zone="hand"]:not(:disabled)').first().focus();
  await priorityPage.locator('[data-match-zone="hand"]:not(:disabled)').first().press("Enter");
  await activateLaneButton(priorityPage, "Lane 1");
  await currentAction(priorityPage).getByRole("button", { name: "Confirm Swap" }).click();
  await expect.poll(async () => Number(
    await priorityPage.getByTestId("production-babylon-match").getAttribute("data-revision")
  )).toBeGreaterThan(revisionBeforeLafayette);
  await priorityPage.getByText("Match", { exact: true }).click();
  await priorityPage.getByRole("button", { name: "Match log" }).click();
  const matchLog = priorityPage.getByRole("dialog", { name: "Match log" });
  await expect(matchLog).toContainText(/used Polea/i);
  await expect(matchLog).toContainText(/used Lafayette/i);

  await hostContext.close();
  await guestContext.close();
});

test("normal Training Grounds entry uses the shared Babylon match and semantic AI", async ({ page, baseURL }) => {
  test.setTimeout(60000);
  await prepareGuest(page, baseURL, "AI Trainee", "Practice");
  await page.getByRole("button", { name: /Basic vs AI/ }).click();

  const match = page.getByTestId("production-babylon-match");
  await expect(match).toBeVisible();
  await expect(match).toHaveAttribute("data-ruleset", "basic");
  await expect(match).toHaveAttribute("data-opponent-kind", "trainingAi");
  await expect(page.locator(".production-player-plate-top")).toContainText("Training AI");

  const initialRevision = Number(await match.getAttribute("data-revision"));
  const pass = page.getByRole("region", { name: "Current match action" })
    .getByRole("button", { name: "Pass Priority" });
  if (await pass.isEnabled()) await pass.click();

  await expect.poll(async () => Number(
    await page.getByTestId("production-babylon-match").getAttribute("data-revision")
  )).toBeGreaterThan(initialRevision);
  await expect(page.locator("canvas.babylon-match-canvas")).toBeVisible();
});

test("normal Faction Training Grounds entry uses the same production match and semantic AI", async ({ page, baseURL }) => {
  test.setTimeout(60000);
  await prepareGuest(page, baseURL, "Faction Trainee", "Practice");
  await page.getByRole("button", { name: /Factions vs AI/ }).click();
  await expect(page.getByText("Table Command")).toBeVisible();
  await chooseLobbyFaction(page, "Rumin");
  await page.getByRole("button", { name: "Confirm Start" }).click();

  const match = page.getByTestId("production-babylon-match");
  await expect(match).toBeVisible();
  await expect(match).toHaveAttribute("data-ruleset", "factions");
  await expect(match).toHaveAttribute("data-opponent-kind", "trainingAi");
  await expect(page.locator(".production-player-plate-top")).toContainText("Training AI");
  await expect(page.locator("canvas.babylon-match-canvas")).toBeVisible();

  const initialRevision = Number(await match.getAttribute("data-revision"));
  const pass = page.getByRole("region", { name: "Current match action" })
    .getByRole("button", { name: "Pass Priority" });
  if (await pass.isEnabled()) await pass.click();
  await expect.poll(async () => Number(
    await page.getByTestId("production-babylon-match").getAttribute("data-revision")
  )).toBeGreaterThan(initialRevision);
});

test("normal campaign entry presents the campaign boss through the shared Babylon match", async ({ page, baseURL }) => {
  test.setTimeout(60000);
  await page.goto(baseURL);
  await page.locator('button[data-area="identity"]').click();
  await page.getByLabel("Play as guest").check();
  await page.getByPlaceholder("Guest name").fill("Campaign Trainee");
  await page.locator('button[data-area="play"]').click();
  await page.locator('button[data-area="journey"]').click();
  await page.getByRole("button", { name: "Choose a Faction" }).click();
  await expect(page.getByRole("heading", { name: "Faction Campaigns" })).toBeVisible();
  await page.getByRole("button", { name: "Begin Battle" }).first().click();

  const match = page.getByTestId("production-babylon-match");
  await expect(match).toBeVisible();
  await expect(match).toHaveAttribute("data-ruleset", "factions");
  await expect(match).toHaveAttribute("data-deck-format", "campaign");
  await expect(match).toHaveAttribute("data-opponent-kind", "campaignBoss");
  await expect(page.locator("canvas.babylon-match-canvas")).toBeVisible();

  await expect.poll(async () => Number(
    await page.getByTestId("production-babylon-match").getAttribute("data-revision")
  )).toBeGreaterThan(0);
  const currentAction = page.getByRole("region", { name: "Current match action" });
  const passPriority = currentAction.getByRole("button", { name: "Pass Priority" });
  if (await passPriority.count() && await passPriority.isEnabled()) await passPriority.click();
  await expect(currentAction)
    .toContainText(/launched scripted attack/i);
  await expect(currentAction.getByRole("button", { name: "Take Damage" })).toBeVisible();
});

test("normal ranked best-of-three entry advances to game two inside the same Babylon experience", async ({
  browser,
  request,
  baseURL
}) => {
  test.setTimeout(120000);
  const unique = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  const firstAccount = await registerTestAccount(request, `SeriesA${unique}`);
  const secondAccount = await registerTestAccount(request, `SeriesB${unique}`);
  const firstContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const secondContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  await prepareAccount(firstPage, firstAccount.token, baseURL);
  await prepareAccount(secondPage, secondAccount.token, baseURL);
  await expect(firstPage.getByRole("button", { name: "Find Ranked BO3" })).toBeEnabled();
  await expect(secondPage.getByRole("button", { name: "Find Ranked BO3" })).toBeEnabled();
  await firstPage.getByRole("button", { name: "Find Ranked BO3" }).click();
  await secondPage.getByRole("button", { name: "Find Ranked BO3" }).click();
  await expect(firstPage.getByText("Table Command")).toBeVisible();
  await expect(secondPage.getByText("Table Command")).toBeVisible();

  for (const page of [firstPage, secondPage]) {
    await page.getByRole("tab", { name: /Rumin/ }).click();
    const chooseRumin = page.getByRole("button", { name: "Choose Rumin" });
    if (await chooseRumin.isVisible()) await chooseRumin.click();
  }
  await firstPage.getByRole("button", { name: "Confirm Start" }).click();
  await secondPage.getByRole("button", { name: "Confirm Start" }).click();

  for (const page of [firstPage, secondPage]) {
    const match = page.getByTestId("production-babylon-match");
    await expect(match).toBeVisible();
    await expect(page.getByText("Game 1 · 0–0")).toBeVisible();
  }

  const firstMatchId = await firstPage.getByTestId("production-babylon-match").getAttribute("data-match-id");
  await firstPage.getByText("Match", { exact: true }).click();
  await firstPage.getByRole("button", { name: "Concede" }).click();
  await firstPage.getByRole("group", { name: "Confirm concession" })
    .getByRole("button", { name: "Confirm" }).click();

  for (const page of [firstPage, secondPage]) {
    await expect.poll(async () => (
      page.getByTestId("production-babylon-match").getAttribute("data-match-id")
    )).not.toBe(firstMatchId);
    await expect(page.getByText(/Game 2 · (0–1|1–0)/)).toBeVisible();
    await expect(page.locator("canvas.babylon-match-canvas")).toBeVisible();
  }

  await firstContext.close();
  await secondContext.close();
});

test("normal draft-league entry uses finalized draft decks and preserves them across game two", async ({
  browser,
  request,
  baseURL
}) => {
  test.setTimeout(120000);
  const unique = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  const firstAccount = await registerTestAccount(request, `DraftA${unique}`);
  const secondAccount = await registerTestAccount(request, `DraftB${unique}`);
  seedDraftDecks([firstAccount, secondAccount]);

  const firstContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const secondContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();
  await prepareAccount(firstPage, firstAccount.token, baseURL, "Draft");
  await prepareAccount(secondPage, secondAccount.token, baseURL, "Draft");
  await expect(firstPage.getByRole("button", { name: "Player Draft BO3" })).toBeEnabled();
  await expect(secondPage.getByRole("button", { name: "Player Draft BO3" })).toBeEnabled();

  await firstPage.getByRole("button", { name: "Player Draft BO3" }).click();
  await secondPage.getByRole("button", { name: "Player Draft BO3" }).click();
  for (const page of [firstPage, secondPage]) {
    const match = page.getByTestId("production-babylon-match");
    await expect(match).toBeVisible();
    await expect(match).toHaveAttribute("data-deck-format", "draft");
    await expect(page.getByText("Draft-deck match")).toBeVisible();
    await expect(page.getByText("Game 1 · 0–0")).toBeVisible();
  }

  const firstMatchId = await firstPage.getByTestId("production-babylon-match").getAttribute("data-match-id");
  await firstPage.getByText("Match", { exact: true }).click();
  await firstPage.getByRole("button", { name: "Concede" }).click();
  await firstPage.getByRole("group", { name: "Confirm concession" })
    .getByRole("button", { name: "Confirm" }).click();

  for (const page of [firstPage, secondPage]) {
    await expect.poll(async () => (
      page.getByTestId("production-babylon-match").getAttribute("data-match-id")
    )).not.toBe(firstMatchId);
    await expect(page.getByText(/Game 2 · (0–1|1–0)/)).toBeVisible();
    await expect(page.getByTestId("production-babylon-match")).toHaveAttribute("data-deck-format", "draft");
  }

  await firstContext.close();
  await secondContext.close();
});
