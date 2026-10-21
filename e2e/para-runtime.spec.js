const { origin, clientOrigin } = require("./admin-urls");
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const fs = require("node:fs"), path = require("node:path");

test("Admin publication becomes a free human event with durable Prestige and inspectable evidence", async ({ page, request, browser }) => {
  test.setTimeout(180000);
  async function login(target, name, admin = false) {
    // Real server-signed sessions from the isolated fixture; auth rate-limit
    // behavior is tested separately and remains enabled in this server.
    const token = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../.playwright-data/admin/sessions.json"), "utf8"))[name];
    await target.goto(`${clientOrigin}${admin ? "/admin/gauntlet" : "/"}`);
    await target.evaluate((token) => localStorage.setItem("gauntlet_auth_token", token), token); await target.reload();
    return token;
  }
  const token = await login(page, "simply", true), headers = { Authorization: `Bearer ${token}` };
  const get = async (route) => (await (await request.get(`${origin}${route}`, { headers, maxRetries: 2 })).json());
  const nav = page.getByRole("navigation", { name: "Administration sections" });
  await nav.getByRole("button", { name: "Para League & Economy", exact: true }).click();
  const tabs = page.getByRole("navigation", { name: "Para workspaces" });
  const choose = (name) => tabs.getByRole("button", { name, exact: true }).click();
  const save = async () => {
    const saved = page.waitForResponse(response => response.url().endsWith("/authoring/para-draft") && response.request().method() === "POST", { timeout: 15000 });
    await page.getByRole("button", { name: "Save definition to draft" }).click();
    expect((await saved).ok()).toBeTruthy();
    await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
  };
  const preview = async () => {
    const pending = page.waitForResponse(response => response.url().endsWith("/authoring/preview") && response.request().method() === "POST", { timeout: 15000 });
    await page.getByRole("button", { name: "Preview saved draft", exact: true }).click();
    const response = await pending; expect(response.ok()).toBeTruthy(); await response.finished();
    await expect(page.getByText("Saved draft preview is ready.", { exact: true })).toBeVisible();
  };
  const dates = async (registration = false) => {
    await page.getByLabel("Start (UTC)", { exact: true }).fill("2026-01-01T00:00");
    await page.getByLabel("End (UTC)", { exact: true }).fill("2099-01-01T00:00");
    if (registration) { await page.getByLabel("Registration opens (UTC)").fill("2026-01-01T00:00"); await page.getByLabel("Registration closes (UTC)").fill("2099-01-01T00:00"); }
  };
  await choose("Seasons"); await page.getByRole("button", { name: "New season", exact: true }).click();
  await page.getByLabel("ID", { exact: true }).fill("runtime-season"); await page.getByLabel("Name", { exact: true }).fill("Runtime qualification season");
  await page.getByLabel("State", { exact: true }).selectOption("active"); await dates();
  await page.getByLabel("classic", { exact: true }).check(); await page.getByLabel("Public rules version").fill("runtime-rules-v1");
  await page.getByLabel("Invitational Prestige threshold").fill("12"); await page.getByLabel("Championship Prestige threshold").fill("20"); await save();
  async function createEvent(id, name, week, type) {
    await choose("Events"); await page.getByRole("button", { name: "New event", exact: true }).click();
    await page.getByLabel("ID", { exact: true }).fill(id); await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("Season", { exact: true }).selectOption("runtime-season"); await page.getByLabel("State", { exact: true }).selectOption("scheduled");
    await page.getByLabel("Event type", { exact: true }).selectOption(type); await page.getByLabel("Planned format", { exact: true }).selectOption("classic");
    await page.getByLabel("Week", { exact: true }).fill(String(week)); await dates(true);
    await page.getByLabel("Win target", { exact: true }).selectOption("5"); await page.getByLabel("Prestige for 0 wins", { exact: true }).fill("12"); await save();
  }
  await createEvent("runtime-qualifier", "Runtime Classic Trial", 1, "qualifier");
  await createEvent("runtime-invitational", "Runtime Invitational", 2, "invitational");
  await page.getByRole("button", { name: "Validate draft", exact: true }).click();
  await preview();
  const publish = async (name) => { await nav.getByRole("button", { name: "Publishing", exact: true }).click(); await page.getByLabel("Release name").fill(name); await page.getByRole("button", { name: "Publish release", exact: true }).click(); await page.getByRole("button", { name: "Confirm publish", exact: true }).click(); await expect(page.getByText("Live content · no draft", { exact: true })).toBeVisible(); };
  await publish("Browser official runtime event"); const release = (await get("/api/admin/authoring")).activeReleaseId;
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  try {
    const players = await Promise.all(contexts.map((context) => context.newPage()));
    await login(players[0], "Visitor"); await login(players[1], "Burnt Ramen");
    const hub = async (p) => { await p.locator('button[data-area="play"]').click(); await p.getByRole("tab", { name: "Para League", exact: true }).click(); await p.getByRole("combobox", { name: "Official event", exact: true }).selectOption("runtime-qualifier"); };
    for (const p of players) {
      await hub(p); await expect(p.getByText(/Invitational not yet eligible/)).toBeVisible();
      await p.getByRole("checkbox", { name: /I accept these published rules/ }).check(); await p.getByRole("button", { name: "Enter free", exact: true }).click(); await expect(p.getByText(/Official run: 0 wins/)).toBeVisible();
    }
    for (let round = 0; round < 2; round++) {
      for (const p of players) await p.getByRole("button", { name: "Find official opponent" }).click();
      for (const p of players) await expect(p.getByTestId("production-babylon-match")).toBeVisible();
      await players[0].getByText("Match", { exact: true }).click(); await players[0].getByRole("button", { name: "Concede", exact: true }).click();
      await players[0].getByRole("group", { name: "Confirm concession" }).getByRole("button", { name: "Confirm", exact: true }).click();
      await expect.poll(async () => (await get("/api/admin/para")).receipts.length).toBe(round + 1);
      for (const p of players) { await p.getByRole("button", { name: "Main Menu", exact: true }).click(); await hub(p); }
    }
    await expect(players[0].getByText("Lifetime Prestige: 12", { exact: true })).toBeVisible();
    await expect(players[0].getByText(/Invitational eligible/)).toBeVisible();
    await players[0].getByRole("checkbox", { name: /I accept these published rules/ }).check(); await players[0].getByRole("button", { name: "Enter free", exact: true }).click();
    await expect(players[0].getByRole("alert")).toContainText("Official attempt limit reached");
    await players[0].getByRole("combobox", { name: "Official event", exact: true }).selectOption("runtime-invitational"); await expect(players[0].getByText("Eligible for free entry.", { exact: true })).toBeVisible();
    await players[0].setViewportSize({ width: 390, height: 844 });
    expect((await new AxeBuilder({ page: players[0] }).include(".para-hub").analyze()).violations).toEqual([]);
    expect(await players[0].evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await players[0].screenshot({ path: "artifacts/para-runtime-player-mobile.png", fullPage: true });
    await players[0].locator('button[data-area="identity"]').click();
    await players[0].getByRole("tab", { name: "Record", exact: true }).click();
    await expect(players[0].getByText("Para member · 12 lifetime Prestige · Official runs completed: 1", { exact: true })).toBeVisible();
    await players[0].getByRole("button", { name: "Public Profile", exact: true }).click();
    await expect(players[0].getByText("Para member · 12 lifetime Prestige · Official runs completed: 1", { exact: true })).toBeVisible();
    const before = (await get("/api/admin/para")).awards;
    expect(before).toHaveLength(1); expect(before[0].releaseId).toBe(release); expect(before[0].evidence).toHaveLength(2);
    await nav.getByRole("button", { name: "Para League & Economy", exact: true }).click(); await choose("Events");
    await page.getByRole("button", { name: /^Runtime Classic Trial runtime-qualifier/ }).click(); await page.getByLabel("Prestige for 0 wins", { exact: true }).fill("99"); await save();
    await preview(); await publish("Later scoring definition");
    expect((await get("/api/admin/para")).awards).toEqual(before);
    await nav.getByRole("button", { name: "Competition", exact: true }).click();
    await expect(page.getByText(/12 Prestige/)).toBeVisible();
    await expect(page.getByText("Published definition differs; pinned rules retained.")).toBeVisible();
    await expect(page.getByText(before[0].evidence[0].matchId, { exact: true })).toBeVisible();
    await page.screenshot({ path: "artifacts/para-runtime-admin-evidence.png", fullPage: true });
  } finally { await Promise.all(contexts.map((c) => c.close())); }
});
