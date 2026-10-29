const { workshopSession } = require("./workshop-session");
const { test, expect } = require("@playwright/test");
const { openCollection } = require("./player-navigation");

test("deck card backs and boxes remain selectable and persist after reload on desktop and mobile", async ({ page, baseURL }) => {
  test.setTimeout(90000);
  const session = workshopSession("cosmetics");
  await page.addInitScript(token => localStorage.setItem("gauntlet_auth_token", token), session.token);
  await page.goto(baseURL);
  await openCollection(page, "decks");
  await expect(page.getByLabel("Deck card back", { exact: true })).toBeVisible();
  await page.getByLabel("Deck card back", { exact: true }).selectOption("classic");
  await page.getByLabel("Deck name", { exact: true }).fill("Cosmetic persistence");
  await page.locator(".deck-settings > summary").click();
  await page.getByRole("button", { name: "Obsidian deck box", exact: true }).click();
  await page.getByRole("button", { name: "Create Deck", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save New Version", exact: true })).toBeEnabled();
  await page.reload();
  await openCollection(page, "decks");
  await expect(page.getByLabel("Deck card back", { exact: true })).toHaveValue("classic");
  await page.locator(".deck-settings > summary").click();
  await expect(page.getByRole("button", { name: "Obsidian deck box", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Faction deck box", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Faction deck box", exact: true }).click();
  await page.getByLabel("Deck card back", { exact: true }).selectOption("");
  await page.getByRole("button", { name: "Save New Version", exact: true }).click();
  await expect(page.locator(".collection-workspace").getByRole("status")).toContainText("Constructed deck saved.");
  await expect(page.getByRole("button", { name: "Save New Version", exact: true })).toBeEnabled();
  await page.reload();
  await openCollection(page, "decks");
  await expect(page.getByLabel("Deck card back", { exact: true })).toHaveValue("");
  await page.locator(".deck-settings > summary").click();
  await expect(page.getByRole("button", { name: "Faction deck box", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "artifacts/command-deck/deck-cosmetics-mobile.png", fullPage: true });
});

