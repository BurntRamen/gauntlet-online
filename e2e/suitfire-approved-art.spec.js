const { test, expect } = require("@playwright/test");
const { navigatePlayer, openCollection, openCampaign } = require("./player-navigation");
const artManifest = require("../client/public/brand/suitfire-art/manifest.json");
const reviewedCards = require("../docs/branding/suitfire-art-audit-inventory.json").cards;

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
    await openCollection(page, "catalog");
    for (const factionId of ["sheen", "frumo", "bizi"]) {
      await page.locator(".collection-view-heading select").first().selectOption(factionId);
      const expected = reviewedCards.filter(card => card.factionId === factionId);
      await expect(page.locator(".catalog-card-tile")).toHaveCount(expected.length);
      for (const card of expected) {
        const tile = page.locator(".catalog-card-tile").filter({ has: page.getByText(card.currentName, { exact: true }) });
        await expect(tile).toHaveCount(1);
        await expect(tile.locator(".special-card-face img")).toHaveAttribute("src", card.target);
        await expect.poll(() => tile.locator(".special-card-face img").evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
      }
      const firstTile = page.locator(".catalog-card-tile").first();
      expect(await firstTile.locator(".special-card-presentation").evaluate(art => art.getBoundingClientRect().width)).toBeGreaterThanOrEqual(74);
      await firstTile.click();
      const inspector = page.locator(".card-art-inspector");
      await expect(inspector).toBeVisible();
      await inspector.screenshot({ path: testInfo.outputPath(`preview-inspector-${factionId}-${name}.png`) });
      await page.locator(".app-layout-61").screenshot({ path: testInfo.outputPath(`preview-cards-${factionId}-${name}.png`) });
    }
    await navigatePlayer(page, "learn");
    await page.locator('.cd-action-tile[data-action-id="lore"]').click();
    await expect(page.locator(".faction-lore-page")).toBeVisible();
    for (const faction of ["Sheen", "Frumo", "Rumin", "Bizi"]) {
      await page.locator(".faction-lore-index").getByRole("button", { name: new RegExp("^" + faction) }).click();
      const hero = page.locator(".faction-lore-hero-art");
      await expect(hero).toBeVisible();
      await expect.poll(() => hero.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
      const approvedCover = artManifest.covers?.[faction.toLowerCase()];
      if (approvedCover?.status === "approved") await expect(hero).toHaveAttribute("src", approvedCover.target);
      await expect(page.getByRole("button", { name: "SuitFire — open Play" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
      await page.locator(".faction-lore-hero").screenshot({ path: testInfo.outputPath(`preview-hero-${faction}-${name}.png`) });
      const figures = page.locator(".faction-lore-figures");
      await figures.scrollIntoViewIfNeeded();
      for (const portrait of await figures.locator("img").all()) {
        await portrait.scrollIntoViewIfNeeded();
        await expect.poll(() => portrait.evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
      }
      await figures.screenshot({ path: testInfo.outputPath(`preview-portraits-${faction}-${name}.png`) });
    }
  }
  await navigatePlayer(page, "settings");
  await page.getByRole("radio", { name: "Gauntlet Online", exact: true }).check();
  await expect(page).toHaveTitle("Gauntlet Online");
  await openCollection(page, "packs");
  await expect(page.locator(".preview-pack-art")).toHaveCount(0);
  await openCollection(page, "catalog");
  expect(await page.locator(".catalog-card-tile .special-card-presentation").first().evaluate(art => art.getBoundingClientRect().width)).toBeGreaterThanOrEqual(74);
  await navigatePlayer(page, "settings");
  await page.getByRole("radio", { name: "SuitFire preview" }).check();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openCampaign(page, "Sheen");
  await page.getByRole("button", { name: "Begin Battle", exact: true }).first().click();
  const match = page.getByTestId("production-babylon-match");
  await expect(match).toBeVisible();
  await expect(match).toHaveAttribute("data-ruleset", "factions");
  await expect(page.locator("canvas.babylon-match-canvas")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("preview-campaign-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(match).toHaveAttribute("data-hand-presentation", "rail");
  await expect.poll(() => page.locator(".phone-hand-card img").evaluateAll(images => images.length > 0 && images.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("preview-campaign-phone.png"), fullPage: true });
});
