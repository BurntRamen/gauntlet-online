const { test, expect } = require("./admin-release-test");
const fs = require("node:fs"), path = require("node:path"), { spawn } = require("node:child_process");
const endpoint = `http://127.0.0.1:${process.env.GAUNTLET_ADMIN_FIXTURE_PORT || 4117}`, artifacts = path.resolve(__dirname, "../artifacts/purpose/browser");
let root, child;
async function start() {
  child = spawn(process.execPath, [path.join(__dirname, "admin-server.js")], { cwd: path.resolve(__dirname, ".."), windowsHide: true, env: { ...process.env, GAUNTLET_ASSET_FIXTURE_ROOT: root, GAUNTLET_PURPOSE_FIXTURE: "true" }, stdio: ["ignore", "pipe", "pipe", "ipc"] });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("Fixture timeout")), 30000); child.once("exit", code => { clearTimeout(timer); reject(new Error(`Fixture exit ${code}`)); }); child.stderr.on("data", bytes => fs.appendFileSync(path.join(artifacts, "server.log"), bytes)); child.stdout.on("data", bytes => { fs.appendFileSync(path.join(artifacts, "server.log"), bytes); if (String(bytes).includes("fixture server ready")) { clearTimeout(timer); resolve(); } }); });
}
async function stop() { if (child && child.exitCode === null) await new Promise((resolve, reject) => { child.once("exit", code => code === 0 ? resolve() : reject(new Error(`Fixture shutdown failed: ${code}`))); child.send("shutdown"); }); }
test.beforeAll(async () => { fs.mkdirSync(artifacts, { recursive: true }); root = fs.mkdtempSync(path.resolve(__dirname, "../.playwright-data/purpose-")); await start(); });
test.afterAll(stop);
test("author, reopen, test, publish and buy a deck product; retain it across restart and a fresh browser", async ({ page, request, browser }) => {
  const login = async name => (await (await request.post(endpoint + "/api/auth/login", { headers: { Connection: "close" }, data: { name, password: "test-password" } })).json()).token;
  const token = await login("simply"), playerToken = await login("Visitor"), headers = { Authorization: `Bearer ${token}`, Connection: "close" };
  await page.addInitScript(token => localStorage.setItem("gauntlet_auth_token", token), token);
  const status = async () => (await (await request.get(endpoint + "/api/admin/authoring", { headers })).json());
  await page.goto("/admin/gauntlet?workshop=decks");
  await page.getByRole("button", { name: "Create deck", exact: true }).click();
  await page.getByLabel("New content name").fill("Browser recipe"); await page.getByRole("button", { name: "Save new deck to draft" }).click();
  await expect(page.getByRole("heading", { name: "Browser recipe", exact: true })).toBeVisible();
  await page.getByLabel("Find deck cards").fill("Rumin Sentry"); await page.getByRole("checkbox", { name: /Rumin Sentry/ }).check();
  let state = await status(); const id = state.draft.snapshot.domains.decks.at(-1).id;
  const printing = state.draft.snapshot.domains.assets.find(row => row.gameplayCardId === "rumin-vault-shield-bearer" && row.paid).id;
  await page.getByLabel("Printing for Rumin Sentry").selectOption(printing);
  await page.getByRole("button", { name: "Save deck composition to draft" }).click();
  await page.getByRole("checkbox", { name: "Supported campaign opponents", exact: true }).check();
  await page.getByRole("button", { name: "Save allowed destinations to draft" }).click();
  await page.getByText("Private authoring notes", { exact: true }).click(); await page.getByLabel("Private deck notes").fill("Private browser note"); const notesSaved = page.waitForResponse(r => r.url().endsWith("/authoring/notes")); await page.getByRole("button", { name: "Save private notes" }).click(); expect((await notesSaved).ok()).toBeTruthy();
  await page.reload(); await expect(page.getByRole("heading", { name: "Browser recipe", exact: true })).toBeVisible();
  await page.getByText("Private authoring notes", { exact: true }).click(); await expect(page.getByLabel("Private deck notes")).toHaveValue("Private browser note");
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390); await page.screenshot({ path: path.join(artifacts, "deck-mobile.png") }); await page.setViewportSize({ width: 1440, height: 1000 });
  const testDeck = async () => {
    const harness = page.getByRole("region", { name: "Real engine playtest" }); await harness.getByLabel("Test content").selectOption("draft");
    const started = page.waitForResponse(r => r.url().endsWith("/authoring/playtest")); await harness.getByRole("button", { name: "Start draft duel playtest" }).click(); const session = (await (await started).json()).playtest;
    expect(session.subject.kind).toBe("deck"); expect(session.context.template.id).toBe(id);
    const pass = session.legalActions.find(action => action.type === "passPriority"); await harness.getByRole("combobox", { name: /^Action/ }).selectOption(pass.id);
    const executed = page.waitForResponse(r => r.url().endsWith("/playtest/command")); await harness.getByRole("button", { name: "Execute selected action" }).click(); expect((await executed).ok()).toBeTruthy();
  };
  await testDeck();
  await page.getByRole("navigation", { name: "Design workshops" }).getByRole("button", { name: "Store", exact: true }).click();
  await page.getByRole("button", { name: "Create offer", exact: true }).click(); await page.getByLabel("New content name").fill("Browser product"); await page.getByRole("button", { name: "Save new offer to draft" }).click();
  await page.getByLabel("Price in gold").fill("30"); await page.getByLabel("Price in timetwisters").fill("5"); await page.getByRole("button", { name: "Save prices to draft" }).click();
  await page.getByLabel("Draft card back", { exact: true }).selectOption("campaignMap"); await page.getByRole("button", { name: "Save card back to draft" }).click();
  await page.getByLabel("Draft store availability", { exact: true }).selectOption("available"); await page.getByRole("button", { name: "Save store availability to draft" }).click();
  await expect(page.getByText("Saved store presentation", { exact: true })).toBeVisible(); await page.screenshot({ path: path.join(artifacts, "store-preview.png") });
  state = await status(); const encounter = state.draft.snapshot.domains.encounters.find(row => row.factionId === "rumin" && !row.setup.bossAdditions.length);
  await page.goto(`/admin/gauntlet?workshop=encounters&object=${encounter.id}&section=setup`);
  await page.getByLabel("Draft authored opponent deck").selectOption(id); await page.getByRole("button", { name: "Save authored opponent deck to draft" }).click();
  await page.getByRole("button", { name: "Inspect assigned opponent recipe" }).click(); await testDeck();
  await page.getByRole("button", { name: "Preview saved draft", exact: true }).click(); await page.getByRole("button", { name: "Review release", exact: true }).click(); await page.getByLabel("Release name").fill("Browser deck R1"); await page.getByRole("button", { name: "Publish release", exact: true }).click(); await page.getByRole("button", { name: "Confirm publish", exact: true }).click(); await expect(page.getByText("Live content · no draft", { exact: true })).toBeVisible();
  const buyer = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    await buyer.addInitScript(token => localStorage.setItem("gauntlet_auth_token", token), playerToken); const p = await buyer.newPage(); await p.goto("/"); await p.locator('button[data-area="build"]').click(); await p.getByRole("button", { name: "Open Collection Workshop" }).click(); await p.getByRole("tab", { name: "Shop", exact: true }).click();
    const products = p.getByRole("region", { name: "Deck products", exact: true }); await products.getByRole("button", { name: "30 Gold", exact: true }).click();
    const paid = p.waitForResponse(r => r.url().endsWith("/buy-deck-product")); await p.getByRole("button", { name: "Confirm purchase", exact: true }).click(); const result = await (await paid).json(); expect(result.account.economy.gold).toBe(70); expect(result.account.stats.savedConstructedDeck.collectorVariantSelections["rumin-vault-shield-bearer"]).toBe(printing);
    await expect(p.getByText(/Purchased Browser recipe/)).toBeVisible(); await p.getByRole("tab", { name: "Decks", exact: true }).click(); await p.getByLabel("Saved deck", { exact: true }).selectOption(result.receipt.deckId); await expect(p.getByLabel("Deck card back")).toHaveValue("campaignMap"); await p.screenshot({ path: path.join(artifacts, "purchased-deck.png") });
    await stop(); await start();
    const fresh = await browser.newContext(); try { await fresh.addInitScript(token => localStorage.setItem("gauntlet_auth_token", token), playerToken); const f = await fresh.newPage(); await f.goto("/"); await f.locator('button[data-area="build"]').click(); await f.getByRole("button", { name: "Open Collection Workshop" }).click(); await f.getByRole("tab", { name: "Shop", exact: true }).click(); await expect(f.getByText("Your deck purchase receipts", { exact: true })).toBeVisible(); } finally { await fresh.close(); }
    const stored = JSON.parse(fs.readFileSync(path.join(root, "accounts.json"))).accounts[2]; expect(stored.stats.economy.gold).toBe(70); expect(stored.stats.deckLibrary.decks).toHaveLength(1);
    fs.writeFileSync(path.join(artifacts, "journey.json"), JSON.stringify({ templateId: id, offerId: result.receipt.offerId, printing, receipt: result.receipt, restart: true }, null, 2));
  } finally { await buyer.close(); }
});
