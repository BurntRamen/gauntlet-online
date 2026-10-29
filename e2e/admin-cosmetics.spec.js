const { navigatePlayer, openProfileExtras, openCollection, openCampaign } = require("./player-navigation");
const { test, expect } = require("./admin-release-test"), { area, paraTab, identity } = require("./admin-navigation");
const { origin } = require("./admin-urls"), fs = require("node:fs"), path = require("node:path"), AxeBuilder = require("@axe-core/playwright").default;
test("operator publishes owned equipment; player acquires, equips and sees profile, deck and actual match appearance", async ({ page, request }) => {
  test.setTimeout(180000);
  const token = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../.playwright-data/admin/sessions.json"))).simply;
  const headers = { Authorization: `Bearer ${token}` };
  await page.goto("/admin/gauntlet"); await page.evaluate(t => localStorage.setItem("gauntlet_auth_token", t), token); await page.reload();
  const state = await (await request.get(origin + "/api/admin/authoring", { headers })).json();
  const images = state.assetLibrary.filter(a => a.mediaType.startsWith("image/")), sound = state.assetLibrary.find(a => a.mediaType.startsWith("audio/"));
  const choices = [["card-back", "Museum card back", images[0].id, "Match card back"], ["deck-box", "Museum box", images[1].id, "Deck Library box cover"], ["faction-banner", "Museum banner", images[2].id, "Profile faction banner"], ["profile-music", "Museum theme", sound.id, "Profile soundtrack"], ["profile-title", "Museum Keeper", "service:profile-title-v1", "Profile title"]];
  const fill = (label, value) => page.getByLabel(label, { exact: true }).fill(value);
  const select = (label, value) => page.getByLabel(label, { exact: true }).selectOption(value);
  const save = async () => { await page.getByRole("button", { name: "Save definition to draft" }).click(); await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0); };
  for (const [category, name, asset] of choices) {
    await paraTab(page, "Entitlements"); await page.getByRole("button", { name: "New entitlement", exact: true }).click(); await identity(page, `museum-${category}`);
    await fill("Name", name); await select("Category", category); await select("Acquisition provenance", "commercial"); await select("Existing content asset", asset);
    await fill("Rights evidence reference", "Isolated first party equipment qualification"); await select("Fulfillment availability", "available"); await save();
  }
  await paraTab(page, "Marketplace"); await page.getByRole("button", { name: "New product", exact: true }).click(); await identity(page, "museum-collection"); await fill("Name", "Museum collection");
  await select("Category", "bundle"); await select("Pricing", "free"); await select("Availability", "active"); await fill("Start", "2020-01-01T00:00"); await fill("End", "2099-01-01T00:00");
  for (const [, name] of choices) await page.getByLabel(name, { exact: true }).check(); await save();
  await page.getByRole("button", { name: "Validate draft", exact: true }).click(); await page.getByRole("button", { name: "Preview saved draft", exact: true }).click();
  await expect(page.getByText("Saved draft preview is ready.", { exact: true })).toBeVisible(); await area(page, "Publishing"); await fill("Release name", "Owned equipment destinations");
  await page.getByRole("button", { name: "Publish release", exact: true }).click(); await page.getByRole("button", { name: "Confirm publish", exact: true }).click(); await expect(page.getByText("Live content · no draft", { exact: true })).toBeVisible();
  const saveDeck = await request.post(origin + "/api/collection/save-constructed-deck", { headers, data: { name: "Museum recipe", factionId: "rumin", cardQuantities: {} } }); expect(saveDeck.status()).toBe(200);
  await page.goto("/"); await navigatePlayer(page, "profile", "library");
  const library = page.getByRole("region", { name: "Gold & Library", exact: true });
  await library.getByRole("button", { name: "Review Museum collection · 0 Gold", exact: true }).click(); await library.getByRole("button", { name: "Confirm purchase · 0 Gold", exact: true }).click();
  for (const [, name, , destination] of choices) {
    await library.getByRole("combobox", { name: destination, exact: true }).selectOption({ label: `${name} · Permanent` });
    await library.getByRole("button", { name: `Set ${destination.toLowerCase()}`, exact: true }).click(); await expect(library.getByRole("status")).toContainText("Appearance saved");
  }
  expect((await new AxeBuilder({ page }).include(".economy-console").analyze()).violations).toEqual([]);
  await openProfileExtras(page);
  await expect(page.locator(".identity-dossier-hero")).toContainText("Museum Keeper"); await expect(page.getByRole("img", { name: "Museum banner", exact: true })).toBeVisible();
  await expect(page.getByLabel("Museum theme", { exact: true })).toHaveAttribute("controls");
  expect(await page.getByLabel("Museum theme", { exact: true }).evaluate(async audio => { await audio.play(); const duration = audio.duration; audio.pause(); return duration > 0; })).toBeTruthy();
  await page.locator(".identity-dossier-hero").screenshot({ path: "artifacts/phase2-cosmetics-profile.png", animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(await page.getByLabel("Museum theme", { exact: true }).evaluate(audio => audio.getBoundingClientRect().right <= audio.parentElement.getBoundingClientRect().right + 1)).toBeTruthy();
  await page.locator(".identity-dossier-hero").screenshot({ path: "artifacts/phase2-cosmetics-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload(); await openProfileExtras(page); await expect(page.locator(".identity-dossier-hero")).toContainText("Museum Keeper");
  await openCollection(page, "decks"); await page.locator(".deck-library-drawer > summary").click(); await expect(page.getByRole("img", { name: "Museum box deck box for Rumin", exact: true }).first()).toBeVisible(); await page.locator(".deck-library").screenshot({ path: "artifacts/phase2-cosmetics-deck.png", animations: "disabled" });
  await openCampaign(page, "Rumin");
  await page.getByRole("button", { name: "Begin Battle", exact: true }).first().click(); await expect(page.getByTestId("production-babylon-match")).toBeVisible(); await expect(page.locator("canvas.babylon-match-canvas")).toBeVisible();
  await page.screenshot({ path: "artifacts/phase2-cosmetics-match.png" });
});
