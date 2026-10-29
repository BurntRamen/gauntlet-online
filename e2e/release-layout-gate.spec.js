const { test, expect } = require("@playwright/test");
const { navigatePlayer } = require("./player-navigation");

test("release menus ignore saved layouts without reading storage or requesting account layouts", async ({ page, request, baseURL }) => {
  const server = process.env.E2E_SERVER_URL || "http://127.0.0.1:4110";
  const existingName = process.env.E2E_EXISTING_ACCOUNT;
  const response = await request.post(server + (existingName ? "/api/auth/login" : "/api/auth/register"), { data: { name: existingName || "Release " + Date.now(), password: process.env.E2E_EXISTING_PASSWORD || "Local-Release-Check-42" } });
  expect(response.ok(), await response.text()).toBeTruthy();
  const { token } = await response.json();
  const requests = [];
  page.on("request", request => { if (/\/api\/account\/layouts(?:\?|$)/.test(request.url())) requests.push(request.method()); });
  await page.addInitScript(token => {
    localStorage.setItem("gauntlet_auth_token", token);
    localStorage.setItem("gauntlet_player_layouts_guest_v1", JSON.stringify({ version: 1, pages: { play: { order: ["draft", "ranked"], hidden: ["basic-ai", "campaign"] } } }));
    window.layoutStorageReads = [];
    window.layoutStorageWrites = [];
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key) { if (String(key).includes("player_layout")) window.layoutStorageReads.push(key); return get.call(this, key); };
    Storage.prototype.setItem = function(key, value) { if (String(key).includes("player_layout")) window.layoutStorageWrites.push(key); return set.call(this, key, value); };
  }, token);
  await page.goto(baseURL);
  for (const [destination, expected] of [
    ["play", ["basic-ai", "faction-ai", "private-duel", "join-table", "ranked", "draft", "campaign", "competition", "active-deck", "recent-matches"]],
    ["decks", ["editor", "collection", "packs", "draft-library"]],
    ["compete", ["ranked", "events", "para", "standings"]],
    ["matches", ["recent", "replays", "record"]],
    ["community", ["friends", "challenges", "messages"]],
    ["learn", ["tutorial", "rulebook", "practice", "formats", "lore"]],
    ["profile", ["record", "library"]],
  ]) {
    await navigatePlayer(page, destination);
    await expect(page.locator("[data-layout-module]")).toHaveCount(expected.length);
    expect(await page.locator("[data-layout-module]").evaluateAll(nodes => nodes.map(node => node.dataset.layoutModule))).toEqual(expected);
    await expect(page.getByText("Customize menu layouts", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "More", exact: true }).filter({ visible: true }).click();
    await expect(page.getByRole("button", { name: "Customize this page", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Close More menu" }).click();
  }
  await navigatePlayer(page, "campaign");
  const factionIds = await page.locator('[data-layout-module^="faction-"]').evaluateAll(nodes => nodes.map(node => node.dataset.layoutModule));
  expect(factionIds.length).toBeGreaterThan(0);
  expect((await page.locator("[data-layout-module]").evaluateAll(nodes => nodes.map(node => node.dataset.layoutModule))).slice(-3)).toEqual(["tutorial", "lore", "rulebook"]);
  await navigatePlayer(page, "settings");
  await expect(page.getByRole("heading", { name: "Page Layouts", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open Page Layout Preferences" })).toHaveCount(0);
  await expect(page.getByRole("switch", { name: "Customize Mode" })).toHaveCount(0);
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => window.layoutStorageReads)).toEqual([]);
  expect(await page.evaluate(() => window.layoutStorageWrites)).toEqual([]);
});

