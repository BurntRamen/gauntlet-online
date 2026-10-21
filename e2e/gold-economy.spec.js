const { origin, clientOrigin } = require("./admin-urls");
const { test, expect } = require("@playwright/test"), AxeBuilder = require("@axe-core/playwright").default;
const fs = require("node:fs"), path = require("node:path");
test("Admin authors and publishes a usable Gold product; player earns, buys, reads, retains retired access and receives an audited refund", async ({ page, request, browser }) => {
  test.setTimeout(180000);
  const token = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../.playwright-data/admin/sessions.json"), "utf8")).simply;
  const headers = { Authorization: `Bearer ${token}` };
  const get = async (route) => (await (await request.get(origin + route, { headers, maxRetries: 2 })).json());
  async function login(p, admin) { await p.goto(admin ? "/admin/gauntlet" : clientOrigin + "/"); await p.evaluate((t) => localStorage.setItem("gauntlet_auth_token", t), token); await p.reload(); }
  await login(page, true); const before = await get("/api/admin/authoring");
  const nav = page.getByRole("navigation", { name: "Administration sections" });
  const area = () => nav.getByRole("button", { name: "Para League & Economy", exact: true }).click();
  const choose = (name) => page.getByRole("navigation", { name: "Para workspaces" }).getByRole("button", { name, exact: true }).click();
  const fill = (name, value) => page.getByLabel(name, { exact: true }).fill(value);
  const select = (name, value) => page.getByLabel(name, { exact: true }).selectOption(value);
  const dates = async () => { await fill("Start (UTC)", "2026-01-01T00:00"); await fill("End (UTC)", "2099-01-01T00:00"); };
  const save = async () => {
    const saved = page.waitForResponse(response => response.url().endsWith("/authoring/para-draft") && response.request().method() === "POST", { timeout: 15000 });
    await page.getByRole("button", { name: "Save definition to draft" }).click();
    expect((await saved).ok()).toBeTruthy();
    await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
  };
  const publish = async (name) => {
    await page.getByRole("button", { name: "Validate draft", exact: true }).click(); await page.getByRole("button", { name: "Preview saved draft", exact: true }).click(); await expect(page.getByText("Saved draft preview is ready.", { exact: true })).toBeVisible();
    await nav.getByRole("button", { name: "Publishing", exact: true }).click(); await fill("Release name", name);
    await page.getByRole("button", { name: "Publish release", exact: true }).click(); await page.getByRole("button", { name: "Confirm publish", exact: true }).click();
    await expect(page.getByText("Live content · no draft", { exact: true })).toBeVisible();
  };
  await area(); await choose("Seasons"); await page.getByRole("button", { name: "New season", exact: true }).click();
  await fill("ID", "gold-browser-season"); await fill("Name", "Gold release test season"); await dates();
  await page.getByLabel("classic", { exact: true }).check(); await fill("Public rules version", "gold-browser-v1"); await fill("Gold cap per eligible account", "1000"); await save();
  for (const [id, name, condition, gold] of [["gold-browser-welcome", "Welcome to Gold", "welcome", "700"], ["gold-browser-training", "Verified training", "faction-training", "300"]]) {
    await choose("Gold Awards"); await page.getByRole("button", { name: "New Gold award", exact: true }).click();
    await fill("ID", id); await fill("Name", name); await select("Season", "gold-browser-season"); await select("State", "active"); await select("Verified milestone", condition); await fill("Gold amount", gold); await dates(); await save();
  }
  await choose("Entitlements"); await page.getByRole("button", { name: "New entitlement", exact: true }).click();
  await fill("ID", "gold-browser-analysis-access"); await fill("Name", "Personal match analysis"); await select("Category", "analytics"); await select("Acquisition provenance", "commercial");
  await select("Existing content asset", "service:match-analysis-v1"); await fill("Rights evidence reference", "First-party service using this account's canonical match records"); await select("Fulfillment availability", "available"); await save();
  await choose("Marketplace"); await page.getByRole("button", { name: "New product", exact: true }).click();
  await fill("ID", "gold-browser-analysis"); await fill("Name", "Personal match analysis"); await select("Category", "analytics"); await select("Availability", "active"); await dates();
  await page.getByLabel("Personal match analysis (gold-browser-analysis-access)", { exact: true }).check(); await fill("Gold price", "200"); await save();
  await publish("Operational Gold and match analysis"); const release = (await get("/api/admin/authoring")).activeReleaseId;
  const context = await browser.newContext({ baseURL: clientOrigin }); const player = await context.newPage();
  try {
    await login(player, false); await player.locator('button[data-area="identity"]').click(); await player.getByRole("tab", { name: "Gold & Library", exact: true }).click();
    const library = player.getByRole("region", { name: "Gold & Library", exact: true });
    await library.getByRole("button", { name: "Claim Welcome to Gold · 700 Gold", exact: true }).click(); await expect(library).toContainText("700 Gold · Published");
    await library.getByRole("button", { name: "Claim Verified training · 300 Gold", exact: true }).click(); await expect(library).toContainText("1000 Gold · Published");
    await expect(library.getByRole("button", { name: /^Claim / })).toHaveCount(0);
    await library.getByRole("button", { name: "Review Personal match analysis · 200 Gold", exact: true }).click();
    await expect(library).toContainText(release); await library.getByRole("button", { name: "Confirm purchase · 200 Gold", exact: true }).click(); await expect(library).toContainText("800 Gold · Published");
    await library.screenshot({ path: "artifacts/gold-player-purchase.png" });
    await library.getByRole("button", { name: "Open Personal match analysis", exact: true }).click();
    await expect(library).toContainText("1 finalized matches"); await expect(library).toContainText("Faction comparison"); await expect(library).toContainText("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    expect((await new AxeBuilder({ page: player }).include(".economy-console").analyze()).violations).toEqual([]);
    await library.screenshot({ path: "artifacts/gold-analysis-desktop.png" });
    await area(); await choose("Marketplace"); await page.getByRole("button", { name: /^Personal match analysis gold-browser-analysis/ }).click(); await page.getByRole("button", { name: "Archive definition", exact: true }).click(); await publish("Retire offer, preserve permanent library access");
    await player.reload(); await player.locator('button[data-area="identity"]').click(); await player.getByRole("tab", { name: "Gold & Library", exact: true }).click();
    // Publishing refreshes the full Admin catalog while the player session is
    // restored. Wait for the resulting wallet view, including on loaded runners.
    await expect(library).toContainText("800 Gold · Published", { timeout: 15000 }); await expect(library.getByRole("button", { name: /^Review Personal/ })).toHaveCount(0);
    await library.getByRole("button", { name: "Open Personal match analysis", exact: true }).click(); await expect(library).toContainText("1 finalized matches");
    await player.setViewportSize({ width: 390, height: 844 });
    expect((await new AxeBuilder({ page: player }).include(".economy-console").analyze()).violations).toEqual([]);
    expect(await player.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy(); await player.screenshot({ path: "artifacts/gold-analysis-mobile.png", fullPage: true });
    await area(); const operations = page.getByRole("region", { name: "Economy operations", exact: true });
    await operations.getByRole("button", { name: "Refresh Gold & Library" }).click(); await expect(operations).toContainText("Issued 1000 · Retired 200");
    const data = (await get("/api/admin/economy")).view, receipt = data.tables.find((t) => t.title === "Purchase receipts").rows.find((r) => r[4] === release)[0];
    await operations.getByLabel("Search economy records").fill(receipt); await operations.screenshot({ path: "artifacts/gold-admin-receipt.png" });
    await operations.getByLabel("Search economy records").fill(""); await operations.getByLabel("Purchase receipt ID", { exact: true }).fill(receipt); await operations.getByLabel("Refund reason", { exact: true }).fill("Isolated browser refund verification");
    page.once("dialog", (d) => d.accept()); await operations.getByRole("button", { name: "Refund purchase and revoke its grants", exact: true }).click(); await expect(operations).toContainText("Refunds restored 200");
    expect((await new AxeBuilder({ page }).include(".economy-console").analyze()).violations).toEqual([]);
    await library.getByRole("button", { name: "Refresh Gold & Library" }).click(); await expect(library).toContainText("1000 Gold · Published"); await expect(library.getByRole("button", { name: /^Open Personal/ })).toHaveCount(0);
  } finally {
    await context.close();
    // Restore the configuration baseline so the pre-existing Para browser suite
    // continues to prove the inactive-seed flow against its original context.
    const state = await get("/api/admin/authoring"); const r = await request.post(origin + "/api/admin/authoring/rollback", { headers, data: { expectedRevision: state.revision, releaseId: before.activeReleaseId } }); expect(r.ok()).toBeTruthy();
  }
});
