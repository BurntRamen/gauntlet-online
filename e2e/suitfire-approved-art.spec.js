const { test, expect } = require("@playwright/test");
const { navigatePlayer, openCollection } = require("./player-navigation");

test("opt-in art stays legible on desktop and phone and GO stays public", async ({ page, request }, testInfo) => {
  const base = "http://127.0.0.1:4161";
  await page.goto("/");
  await expect(page).toHaveTitle("Gauntlet Online");
  await navigatePlayer(page, "settings");
  await expect(page.getByRole("group", { name: "Game appearance" })).toHaveCount(0);
  expect(await page.evaluate(() => performance.getEntriesByType("resource").some(e => e.name.includes("/brand/suitfire-art/manifest.json")))).toBe(false);
  const result = await request.post(base + "/api/auth/register", { data: { name: "ArtPreview" + Date.now(), password: "Local-Preview-Only-42" } });
  expect(result.ok()).toBeTruthy();
  const { token } = await result.json();
  // Isolated fixture response only: never grant eligibility to a real account.
  await page.route(base + "/api/auth/me", async route => {
    const response = await route.fetch();
    const body = await response.json();
    body.account = { ...body.account, brandPreview: "suitfire" };
    await route.fulfill({ response, json: body });
  });
  await page.addInitScript(token => localStorage.setItem("gauntlet_auth_token", token), token);
  await page.goto("/");
  await navigatePlayer(page, "settings");
  await expect(page.getByRole("radio", { name: "Gauntlet Online", exact: true })).toBeChecked();
  await page.getByRole("radio", { name: "SuitFire preview" }).check();
  await expect(page).toHaveTitle("SuitFire");
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType("resource").some(e => e.name.includes("/brand/suitfire-art/manifest.json")))).toBeTruthy();
  for (const [name, viewport] of [["desktop", { width: 1440, height: 1000 }], ["phone", { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport);
    await openCollection(page, "packs");
    const pack = page.locator(".preview-pack-art").first();
    await expect(pack).toBeVisible();
    await expect(pack.locator(".preview-pack-crest")).toHaveJSProperty("naturalWidth", 1254);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
    await page.screenshot({ path: testInfo.outputPath(`preview-packs-${name}.png`), fullPage: true });
    await navigatePlayer(page, "learn");
    await page.locator('.cd-action-tile[data-action-id="lore"]').click();
    await expect(page.locator(".faction-lore-page")).toBeVisible();
    await page.getByRole("button", { name: /Sheen/ }).first().click();
    await expect(page.locator(".faction-lore-hero-art")).toBeVisible();
    await expect.poll(() => page.locator(".faction-lore-hero-art").evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByRole("button", { name: "SuitFire — open Play" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
    await page.screenshot({ path: testInfo.outputPath(`preview-lore-${name}.png`), fullPage: true });
  }
  await navigatePlayer(page, "settings");
  await page.getByRole("radio", { name: "Gauntlet Online", exact: true }).check();
  await expect(page).toHaveTitle("Gauntlet Online");
  await openCollection(page, "packs");
  await expect(page.locator(".preview-pack-art")).toHaveCount(0);
});
