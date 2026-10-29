const { navigatePlayer, openProfileExtras } = require("./player-navigation");
const { test, expect } = require("./admin-release-test"), { area, paraTab, identity } = require("./admin-navigation"), { origin } = require("./admin-urls");
const fs = require("node:fs"), path = require("node:path"), AxeBuilder = require("@axe-core/playwright").default;
test("operator publishes alternative and split prices; player purchases exact terms and operator refunds Gems", async ({ page, request }) => {
  test.setTimeout(180000); const token = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../.playwright-data/admin/sessions.json"))).simply, headers = { Authorization: `Bearer ${token}` };
  await page.goto("/admin/gauntlet"); await page.evaluate(t => localStorage.setItem("gauntlet_auth_token", t), token); await page.reload();
  const fill = (label, value) => page.getByLabel(label, { exact: true }).fill(value), select = (label, value) => page.getByLabel(label, { exact: true }).selectOption(value);
  const save = async () => { await page.getByRole("button", { name: "Save definition to draft" }).click(); await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0); };
  await paraTab(page, "Entitlements"); await page.getByRole("button", { name: "New entitlement", exact: true }).click(); await identity(page, "gem-browser-title");
  await fill("Name", "Crystal Keeper"); await select("Category", "profile-title"); await select("Acquisition provenance", "commercial"); await select("Duration", "days"); await fill("Duration in days", "1");
  await select("Existing content asset", "service:profile-title-v1"); await fill("Rights evidence reference", "Isolated title and payment option qualification"); await select("Fulfillment availability", "available"); await save();
  for (const [id, name, mode, gold, gems] of [["gem-browser-choice", "Flexible title", "Gold or Gems", "10", "7"], ["gem-browser-split", "Shared payment title", "Gold and Gems", "6", "3"]]) {
    await paraTab(page, "Marketplace"); await page.getByRole("button", { name: "New product", exact: true }).click(); await identity(page, id); await fill("Name", name); await select("Category", "profile-title");
    await select("Pricing", { label: mode }); await fill("Gold price", gold); await fill("Gem price", gems); await select("Availability", "active"); await fill("Start", "2020-01-01T00:00"); await fill("End", "2099-01-01T00:00"); await page.getByLabel("Crystal Keeper", { exact: true }).check(); await save();
  }
  await page.getByRole("button", { name: "Validate draft", exact: true }).click(); await page.getByRole("button", { name: "Preview saved draft", exact: true }).click(); await expect(page.getByText("Saved draft preview is ready.", { exact: true })).toBeVisible();
  await area(page, "Publishing"); await fill("Release name", "Qualified alternative and split currency terms"); await page.getByRole("button", { name: "Publish release", exact: true }).click(); await page.getByRole("button", { name: "Confirm publish", exact: true }).click(); await expect(page.getByText("Live content · no draft", { exact: true })).toBeVisible();
  await page.goto("/"); await navigatePlayer(page, "profile", "library");
  const library = page.getByRole("region", { name: "Gold & Library", exact: true });
  await expect(library.getByRole("button", { name: "Review Flexible title · 10 Gold", exact: true })).toBeVisible();
  await library.getByRole("button", { name: "Review Flexible title · 7 Gems", exact: true }).click(); await expect(library).toContainText("7 Gems · Quote expires"); await library.getByRole("button", { name: "Confirm purchase · 7 Gems", exact: true }).click();
  await expect(library).toContainText("33 Gems (enabled)");
  await library.getByRole("button", { name: "Review Shared payment title · 6 Gold + 3 Gems", exact: true }).click(); await expect(library).toContainText("6 Gold + 3 Gems · Quote expires"); await library.getByRole("button", { name: "Confirm purchase · 6 Gold + 3 Gems", exact: true }).click();
  await expect(library).toContainText("94 Gold · Published"); await expect(library).toContainText("30 Gems (enabled)");
  expect((await new AxeBuilder({ page }).include(".economy-console").analyze()).violations).toEqual([]); await library.screenshot({ path: "artifacts/phase2-gems-player.png" });
  await openProfileExtras(page);
  await expect(page.getByLabel("Currency balances").getByText("Gems").locator("..")).toContainText("30");
  await expect(page.getByLabel("Currency balances").getByText("Timetwisters").locator("..")).toContainText("10");
  const data = await (await request.get(origin + "/api/admin/economy", { headers })).json(), purchase = data.view.tables.find(t => t.title === "Purchase receipts").rows.find(r => r[2] === "Flexible title");
  expect(purchase[3]).toBe("7 Gems");
  await page.goto("/admin/gauntlet"); await paraTab(page, "Marketplace"); const operations = page.getByRole("region", { name: "Economy operations", exact: true });
  const form = operations.locator("form").filter({ has: page.getByRole("button", { name: "Refund purchase and revoke its grants", exact: true }) });
  await form.getByRole("combobox", { name: "Purchase to refund", exact: true }).selectOption(purchase[0]); await form.getByRole("textbox", { name: "Refund reason", exact: true }).fill("Refund exact Gem choice for isolated browser qualification");
  page.once("dialog", dialog => dialog.accept()); await form.getByRole("button", { name: "Refund purchase and revoke its grants", exact: true }).click(); await expect(operations.getByRole("status")).toContainText("Operator receipt");
  const account = await (await request.get(origin + "/api/auth/me", { headers })).json(); expect(account.account.economy.gems).toBe(37); expect(account.account.economy.gold).toBe(94); expect(account.account.economy.timetwisters).toBe(10);
  await operations.getByRole("textbox", { name: "Search economy records" }).fill(purchase[0]); await operations.screenshot({ path: "artifacts/phase2-gems-refund.png" });
});
