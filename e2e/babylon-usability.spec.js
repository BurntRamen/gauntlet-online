const { test, expect } = require("@playwright/test");

function currentAction(page) {
  return page.getByRole("region", { name: "Current match action" });
}

async function revealPerspectiveIfNeeded(page) {
  const reveal = page.getByRole("button", { name: "Reveal my hand" });
  if (await reveal.isVisible().catch(() => false)) {
    await reveal.click();
  }
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "h" })));
}

async function selectPaymentUntilEnabled(page, confirmationName) {
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "h" })));
  const confirmation = currentAction(page).getByRole("button", { name: confirmationName });
  const hand = page.locator('[data-match-zone="hand"]:not(:disabled)');
  const count = await hand.count();
  for (let index = 0; index < count && await confirmation.isDisabled(); index += 1) {
    await hand.nth(index).click();
  }
  await expect(confirmation).toBeEnabled();
}

test("visible Babylon cards and placed lanes support direct canvas manipulation", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/?babylon-test=1&seed=canvas-direct-manipulation`);
  const canvas = page.locator("canvas.babylon-match-canvas");
  await expect(canvas).toBeVisible();
  const openingBox = await canvas.boundingBox();
  expect(openingBox).not.toBeNull();
  await canvas.click({
    position: {
      x: Math.round(openingBox.width * 0.35),
      y: Math.round(openingBox.height * 0.875)
    }
  });
  await expect(currentAction(page)).toContainText(/Choose \d+ payment for this independent hand attack/);
  await currentAction(page).getByRole("button", { name: "Cancel" }).click();

  await page.goto(`${baseURL}/?babylon-test=1&fixture=populated-priority`);
  await expect(canvas).toBeVisible();
  const populatedBox = await canvas.boundingBox();
  expect(populatedBox).not.toBeNull();
  await canvas.click({
    position: {
      x: Math.round(populatedBox.width * 0.28),
      y: Math.round(populatedBox.height * 0.67)
    }
  });
  await expect(currentAction(page)).toContainText(/Lane 1 attack · choose \d+ payment/);
});

test("touch input directly stages a visible Babylon hand card without hover", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 844, height: 390 }
  });
  const page = await context.newPage();
  try {
    await page.goto(`${baseURL}/?babylon-test=1&seed=touch-direct-manipulation`);
    const canvas = page.locator("canvas.babylon-match-canvas");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    await page.touchscreen.tap(
      box.x + Math.round(box.width * 0.5),
      box.y + Math.round(box.height * 0.875)
    );

    await expect(currentAction(page)).toContainText(
      /Choose \d+ payment for this independent hand attack/
    );
    await expect(currentAction(page).getByRole("button", { name: "Cancel" })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("constructed payment and weapon choices are operable in the production Play-mode shell", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/?babylon-test=1&fixture=constructed-choice`);

  await expect(page.getByTestId("production-babylon-match")).toBeVisible();
  await expect(page.getByText("Developer tools")).toHaveCount(0);
  const contextualActions = page.getByRole("region", { name: "Faction abilities" });
  const forum = contextualActions.getByRole("button", { name: /Forum Ledger Runner/i });
  const weapon = contextualActions.getByRole("button", { name: /Arm Coin-Scale Spear/i });
  await expect(forum).toBeVisible();
  await expect(weapon).toBeVisible();
  await expect(currentAction(page)).toContainText("Payment 2 / 3");

  await forum.click();
  await weapon.click();
  await expect(forum).toHaveAttribute("aria-pressed", "true");
  await expect(weapon).toHaveAttribute("aria-pressed", "true");
  await expect(currentAction(page)).toContainText("Payment 3 / 3");
  await currentAction(page).getByRole("button", { name: "Confirm Attack" }).click();

  await revealPerspectiveIfNeeded(page);
  await expect(currentAction(page)).toContainText(/may block or decline/i);
  await expect(contextualActions).toHaveCount(0);
});

test("the direct faction fixture exposes and resolves a real faction ability", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/?babylon-test=1&fixture=faction-ability`);

  await expect(page.getByLabel(/Player 1, 34 life, has priority/)).toContainText("Frumo");
  const abilities = page.getByRole("region", { name: "Faction abilities" }).last();
  await expect(abilities.getByRole("button", { name: /Polea · move or switch lanes/i })).toBeVisible();
  await expect(currentAction(page)).toContainText("Choose two lanes (0 / 2)");

  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "l" })));
  const controls = page.getByRole("region", { name: "Keyboard match controls" });
  await controls.getByRole("button", { name: "Lane 1", exact: true }).click();
  await controls.getByRole("button", { name: "Lane 2", exact: true }).click();
  await expect(currentAction(page)).toContainText("Choose two lanes (2 / 2)");
  const confirm = currentAction(page).getByRole("button", { name: "Confirm Lane Move" });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(currentAction(page)).not.toContainText("Choose two lanes (2 / 2)");
});

test("an unaided player can complete the core Basic Play-mode sequence", async ({ page, baseURL }) => {
  test.setTimeout(60000);
  await page.goto(`${baseURL}/?babylon-test=1&seed=ordinary-player-audit-1`);

  await expect(page.getByTestId("production-babylon-match")).toBeVisible();
  await expect(page.getByText("Developer tools")).toHaveCount(0);
  await expect(currentAction(page)).toContainText(
    /Player 2 has priority: select a hand card for an independent attack, or pass\./
  );

  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "h" })));
  await page.getByRole("button", { name: "4♥, value 4" }).click();
  await expect(currentAction(page)).toContainText("independent hand attack");
  await page.getByRole("button", { name: "4♠, value 4" }).click();
  await expect(currentAction(page)).toContainText("Payment 4 / 4");
  await currentAction(page).getByRole("button", { name: "Confirm Attack" }).click();

  await revealPerspectiveIfNeeded(page);
  await expect(currentAction(page)).toContainText(/may block or decline/i);
  await page.getByRole("button", { name: "7♦, value 7" }).click();
  await currentAction(page).getByRole("button", { name: "Choose Payment" }).click();
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "h" })));
  await page.getByRole("button", { name: "7♥, value 7" }).click();
  await expect(currentAction(page)).toContainText("Payment 7 / 7");
  await currentAction(page).getByRole("button", { name: "Confirm Block" }).click();

  await currentAction(page).getByRole("button", { name: "Pass Priority" }).click();
  await revealPerspectiveIfNeeded(page);
  await currentAction(page).getByRole("button", { name: "Pass Priority" }).click();

  for (let opportunity = 1; opportunity <= 6; opportunity += 1) {
    await revealPerspectiveIfNeeded(page);
    const lane = Math.ceil(opportunity / 2);
    await expect(currentAction(page)).toContainText(
      new RegExp(`Placement ${opportunity} of 6 · Player [12]: choose a hand card for Lane ${lane}, or skip\\.`)
    );
    await page.locator('[data-match-zone="hand"]:not(:disabled)').first().click();
    await currentAction(page).getByRole("button", { name: "Place Facedown" }).click();
  }

  await revealPerspectiveIfNeeded(page);
  await expect(currentAction(page)).toContainText(
    /Player [12] has priority: select a hand card for an independent attack, choose one of your occupied lanes for a lane attack, or pass\./
  );
  await expect(page.locator(".production-turn-marker")).toContainText("Turn 2");

  await expect(page.getByRole("button", { name: "Lane 1" })).toBeEnabled();
  await page.getByRole("button", { name: "Lane 1" }).click();
  await expect(currentAction(page)).toContainText(/Lane 1 attack · choose \d+ payment/);
  await selectPaymentUntilEnabled(page, "Confirm Attack");
  await currentAction(page).getByRole("button", { name: "Confirm Attack" }).click();

  await revealPerspectiveIfNeeded(page);
  await expect(currentAction(page)).toContainText(/attacked from Lane 1.*may block or decline/i);
  await expect(page.getByRole("button", { name: "Lane 1" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Lane 2" })).toBeDisabled();
  await page.getByRole("button", { name: "Lane 1" }).click();
  await expect(currentAction(page)).toContainText(/Same-lane blocker · choose \d+ payment/);
  await selectPaymentUntilEnabled(page, "Confirm Block");
  await currentAction(page).getByRole("button", { name: "Confirm Block" }).click();
  await expect(page.locator(".production-turn-marker")).toContainText("Priority");
  await expect(currentAction(page)).toContainText(
    /Player [12] has priority: select a hand card for an independent attack, choose one of your occupied lanes for a lane attack, or pass\./
  );

  await page.getByText("Match", { exact: true }).click();
  await page.getByRole("button", { name: "Concede" }).click();
  const concession = page.getByRole("group", { name: "Confirm concession" });
  await expect(concession).toBeVisible();
  await concession.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible();
  await page.getByRole("button", { name: "Start New Match" }).click();
  await expect(page.locator(".production-turn-marker")).toContainText("Turn 1");
  await expect(page.getByText("Developer tools")).toHaveCount(0);
});
