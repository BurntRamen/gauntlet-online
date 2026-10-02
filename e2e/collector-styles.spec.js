const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const { COLLECTION_CARDS } = require("../server/gameContent");

test("choose an in-game card version, save it, reload it, and render its foil on the match table", async ({ page, request, baseURL }) => {
  test.setTimeout(180000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error" && /shader|compile|WebGL/i.test(message.text())) errors.push(message.text());
  });
  const response = await request.post("http://127.0.0.1:4107/api/auth/register", {
    data: { name: "Collector " + Date.now(), password: "Local-Collector-Review-42" }
  });
  expect(response.ok()).toBeTruthy();
  const session = await response.json();
  const card = COLLECTION_CARDS.find(entry => entry.id === "sheen-rootwatch-initiate");
  const foilId = card.id + ":collector-foil";
  const storePath = path.resolve(__dirname, "../.playwright-data/collector-styles/accounts.json");
  const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
  const account = store.accounts.find(entry => entry.id === session.account.id);
  account.stats.collection.gameplayEntitlements = { [card.id]: 1 };
  fs.writeFileSync(storePath, JSON.stringify(store));
  const saved = () => JSON.parse(fs.readFileSync(storePath, "utf8")).accounts.find(entry => entry.id === account.id).stats.savedConstructedDeck;
  await page.addInitScript(token => localStorage.setItem("gauntlet_auth_token", token), session.token);
  const openWorkshop = async () => {
    await page.goto(baseURL);
    await page.locator('button[data-area="build"]').click();
    await page.getByRole("button", { name: "Open Collection Workshop" }).click();
  };
  await openWorkshop();
  await page.getByRole("tab", { name: "Collector Styles", exact: true }).click();
  await page.locator(".collector-library-card").filter({ hasText: card.name }).click();
  await page.getByRole("button", { name: "Enlarge " + card.name }).click();
  await expect(page.getByRole("dialog").locator(".is-animated-collector")).toHaveAttribute("data-collector-style", "living-canopy");
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("tab", { name: "Decks", exact: true }).click();
  await page.getByLabel("Deck faction", { exact: true }).selectOption("sheen");
  const slotName = card.value + " of " + card.suit;
  await page.getByRole("button", { name: slotName + " — Standard playing card", exact: true }).click();
  await page.getByRole("button", { name: "Swap " + slotName + " for " + card.name, exact: true }).click();
  const selector = page.getByLabel(card.name + " card version", { exact: true });
  await expect(selector).toBeVisible();
  await selector.selectOption(foilId);
  await expect(page.locator(".deck-slot-preview .collector-card-sheen")).toHaveCSS("animation-name", "collector-foil-orbit");
  await page.getByLabel("Deck name", { exact: true }).fill("Canopy foil deck");
  await page.getByRole("button", { name: "Create Deck", exact: true }).click();
  await expect.poll(() => saved()?.collectorVariantSelections[card.id]).toBe(foilId);
  await openWorkshop();
  await page.getByRole("tab", { name: "Decks", exact: true }).click();
  await page.getByRole("button", { name: slotName + " — " + card.name, exact: true }).click();
  await expect(selector).toHaveValue(foilId);
  await page.getByRole("button", { name: "Cards", exact: true }).click();
  await expect(page.locator(".deck-slot.is-replaced .is-animated-collector")).toHaveCount(1);
  const output = path.resolve(__dirname, "../artifacts/collector-styles");
  fs.mkdirSync(output, { recursive: true });
  await page.locator(".deck-workshop").screenshot({ path: path.join(output, "deck-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await selector.scrollIntoViewIfNeeded();
  await expect(selector).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: path.join(output, "deck-mobile.png") });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".deck-slot-preview .collector-card-sheen")).toHaveCSS("animation-name", "none");
  await selector.selectOption(card.defaultVariantId);
  await expect(page.locator(".deck-workshop .is-animated-collector")).toHaveCount(0);
  await page.getByRole("button", { name: "Save New Version", exact: true }).click();
  await expect.poll(() => saved()?.collectorVariantSelections[card.id]).toBe(card.defaultVariantId);
  await selector.selectOption(foilId);
  await page.getByRole("button", { name: "Save New Version", exact: true }).click();
  await expect.poll(() => saved()?.collectorVariantSelections[card.id]).toBe(foilId);

  // Feed the saved presentation through the real replay adapter and WebGL table.
  // Only the network response is a fixture; no alternate rendering route is used.
  const { content } = await (await request.get("http://127.0.0.1:4107/api/game-content")).json();
  const chosen = {
    ...content.cards.find(entry => entry.id === card.id), id: "foil-in-play",
    gameplayCardId: card.id, variantId: saved().collectorVariantSelections[card.id],
    collector: content.collectorVariants.find(entry => entry.variantId === saved().collectorVariantSelections[card.id])
  };
  expect(chosen.collector.animationStyle).toBe("living-canopy");
  const matchId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const state = {
    matchId, gameMode: "factions", phase: "priority", turn: 1, revision: 1, priority: 2,
    priorityPassed: { 1: false, 2: false },
    players: {
      1: { accountName: "Collector", life: 20, faction: { id: "sheen", name: "Sheen" }, hand: [], deck: [], discard: [chosen], handCount: 4, deckCount: 40 },
      2: { accountName: "Opponent", life: 20, faction: { id: "rumin", name: "Rumin" }, hand: [], deck: [], discard: [], handCount: 5, deckCount: 40 }
    },
    lanes: [0, 1, 2].map(() => ({ facedown: { 1: null, 2: null }, attack: null, block: [] })),
    handAttacks: [{ id: "foil-attack", player: 1, targetPlayer: 2, effectiveValue: chosen.value, card: chosen, block: [] }],
    lastEvents: [], message: "Collector foil in play"
  };
  const replay = {
    matchId, availability: { available: true, mode: "public-state-frames" },
    participants: [{ playerNum: 1, displayName: "Collector" }, { playerNum: 2, displayName: "Opponent" }],
    frames: [{ frameIndex: 1, publicState: state }],
    steps: [{ index: 0, evidenceSequence: 1, evidenceId: "foil-start", eventType: "match.started", turn: 1, phase: "priority", label: "Collector foil in play", frameIndex: 1, publicPayload: {} }],
    notableMoments: []
  };
  await page.route("**/api/matches/" + matchId + "/replay", route => route.fulfill({ json: { replay } }));
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(baseURL + "/?match=" + matchId + "&replay=1");
  const canvas = page.locator("canvas.babylon-match-canvas");
  await expect(canvas).toBeVisible();
  if (process.env.GAUNTLET_E2E_COMPILED !== "true") {
    await expect.poll(() => canvas.evaluate(element => element.__gauntletCaptureControl?.snapshot().collectorFoilReadyCount)).toBeGreaterThan(0);
    await expect.poll(() => canvas.evaluate(element => element.__gauntletCaptureControl.snapshot().pendingTextures)).toBe(0);
    const styles = await canvas.evaluate(element => element.__gauntletCaptureControl.snapshot().collectorFoilStyles);
    expect(styles).toContain("living-canopy");
  }
  // This fixed fixture places its only face-up table card here. Inspect the
  // card's interior, excluding moving borders and the rest of the interface.
  const cardPixels = async () => sharp(await page.screenshot({ clip: { x: 558, y: 180, width: 65, height: 70 } })).removeAlpha().raw().toBuffer();
  const firstFrame = await cardPixels();
  await expect.poll(async () => {
    const nextFrame = await cardPixels();
    return nextFrame.reduce((sum, channel, index) => sum + Math.abs(channel - firstFrame[index]), 0) / nextFrame.length;
  }, { message: "The table foil should visibly animate", timeout: 12000, intervals: [800] }).toBeGreaterThan(2);
  await page.screenshot({ path: path.join(output, "table-foil.png") });
  expect(errors).toEqual([]);
});
