const { test, expect } = require("./admin-release-test");
const { origin } = require("./admin-urls");
const { saveRecord, area, searchCollection } = require("./admin-navigation");
const { navigatePlayer } = require("./player-navigation");
const AxeBuilder = require("@axe-core/playwright").default;
const fs = require("node:fs"), path = require("node:path");
const sessions = () => JSON.parse(fs.readFileSync(path.join(__dirname, "../.playwright-data/admin/sessions.json"), "utf8"));
const nav = page => page.getByRole("navigation", { name: "Administration sections", exact: true });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(token => localStorage.setItem("gauntlet_auth_token", token), sessions().simply);
});

test("production links guard edits and resume the selected card, filter and section", async ({ page }) => {
  await page.goto("/admin/gauntlet?workshop=cards&object=rumin-vault-shield-bearer&section=identity");
  await searchCollection(page, "Search cards", "Sentry");
  if (await page.getByRole("button", { name: "Return to editor", exact: true }).isVisible()) await page.getByRole("button", { name: "Return to editor", exact: true }).click();
  const name = page.getByLabel("Draft name", { exact: true });
  const original = await name.inputValue();
  await name.fill("Unsubmitted fixture name");
  const guide = page.locator(".admin-production-guide");
  await guide.locator("summary").first().click();
  await expect(guide).toContainText("Player destination");
  const printing = guide.locator("li").filter({ has: page.getByRole("heading", { name: /Artwork and printings/ }) }).getByRole("button").first();
  await printing.click();
  await page.getByRole("dialog", { name: "Unsaved local changes" }).getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(name).toHaveValue("Unsubmitted fixture name");
  await printing.click();
  await page.getByRole("dialog", { name: "Unsaved local changes" }).getByRole("button", { name: "Discard local edits and continue", exact: true }).click();
  await expect(page).toHaveURL(/workshop=assets/);
  await page.getByRole("button", { name: "Back to previous view", exact: true }).click();
  await expect(name).toHaveValue(original);
  await expect(page.getByLabel("Search cards")).toHaveValue("Sentry");
  await page.reload();
  await expect(name).toHaveValue(original);
  await expect(page.getByLabel("Search cards")).toHaveValue("Sentry");
  await expect(page).toHaveURL(/section=identity/);
  await guide.locator("summary").first().click();
  await page.screenshot({ path: "artifacts/admin-production-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect((await new AxeBuilder({ page }).include(".admin-production-guide").analyze()).violations).toEqual([]);
  await page.screenshot({ path: "artifacts/admin-production-phone.png", fullPage: true });
});

test("a registered website header is previewed, published to the player menu and rolled back", async ({ page, request }) => {
  await page.goto("/admin/gauntlet?workshop=modes&object=practice&section=play");
  await page.getByLabel("Draft play landing · heading", { exact: true }).fill("Isolated production heading");
  await saveRecord(page);
  await expect(page.getByRole("region", { name: "Saved prose preview" })).toContainText("Isolated production heading");
  await area(page, "Publishing");
  await page.getByRole("button", { name: "Preview saved draft", exact: true }).click();
  await expect(page.getByText("Saved draft preview is ready.", { exact: true })).toBeVisible();

  await page.getByLabel("Release name").fill("Isolated website header");
  await page.getByRole("button", { name: "Publish release", exact: true }).click();
  await page.getByRole("button", { name: "Confirm publish", exact: true }).click();
  await expect(page.getByText("Live content · no draft", { exact: true })).toBeVisible();
  const player = await page.context().newPage();
  await player.goto("/"); await navigatePlayer(player, "play");
  await expect(player.getByRole("heading", { name: "Isolated production heading", exact: true })).toBeVisible();
  await player.screenshot({ path: "artifacts/admin-production-player-prose.png" });
  await player.close();
  await page.getByRole("button", { name: "Restore Deployed source baseline", exact: true }).click();
  await page.getByRole("button", { name: "Confirm rollback", exact: true }).click();
  await expect(page.getByText("Previous release restored for future games.", { exact: true })).toBeVisible();
  const content = (await (await request.get(origin + "/api/game-content")).json()).content;
  expect(content.websiteProse.play.title).not.toBe("Isolated production heading");
});

test("only an admin can restore reviewed progress, with a reason and retained audit evidence", async ({ page, request }) => {
  const endpoint = origin + "/api/admin/players/cccccccc-cccc-4ccc-8ccc-cccccccccccc/repair";
  for (const headers of [{}, { Authorization: `Bearer ${sessions().Visitor}` }]) {
    expect((await request.get(endpoint, { headers })).status()).toBe(headers.Authorization ? 403 : 401);
    expect((await request.post(endpoint, { headers, data: {} })).status()).toBe(headers.Authorization ? 403 : 401);
  }
  await page.goto("/admin/gauntlet");
  await nav(page).getByRole("button", { name: "Players", exact: true }).click();
  await page.getByRole("button", { name: "View player Visitor", exact: true }).click();
  const profile = page.getByRole("region", { name: "Selected player" });
  await profile.getByRole("button", { name: "Review missing progress", exact: true }).click();
  await expect(page.getByLabel("Correction reason")).toBeFocused();
  await expect(page.getByRole("region", { name: "Proposed account repair" })).toContainText("1 missing fact");
  await expect(page.getByRole("region", { name: "Proposed account repair" })).toContainText("Campaign clears · Rumin");
  await page.getByLabel("Correction reason").fill("Restore the recorded isolated campaign clear");
  await nav(page).getByRole("button", { name: "Content", exact: true }).click();
  await page.getByRole("dialog", { name: "Unsaved local changes" }).getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.getByLabel("Correction reason")).toHaveValue("Restore the recorded isolated campaign clear");
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await new AxeBuilder({ page }).include(".admin-player-profile").analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: "artifacts/admin-production-progress-repair.png", fullPage: true });
  await page.getByRole("button", { name: "Apply reviewed repair now", exact: true }).click();
  await expect(page.getByText("Player metadata saved.", { exact: true })).toBeVisible();
  await profile.getByRole("button", { name: "Support history", exact: true }).click();
  await expect(profile).toContainText("Restore the recorded isolated campaign clear");
  await profile.getByRole("button", { name: "Review missing progress", exact: true }).click();
  await expect(page.getByText("No repair is needed from the available evidence.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply reviewed repair now" })).toBeDisabled();
});
