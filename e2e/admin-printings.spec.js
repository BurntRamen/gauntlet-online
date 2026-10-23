const { test, expect } = require("./admin-release-test");
const { waitForBufferedAdminResponse } = require("./buffered-admin-response");
const fs = require("node:fs"), path = require("node:path"), { spawn } = require("node:child_process"), sharp = require("sharp");
const serverUrl = `http://127.0.0.1:${process.env.GAUNTLET_ADMIN_FIXTURE_PORT || 4117}`, cardId = "rumin-vault-shield-bearer", artifactRoot = path.resolve(__dirname, "../artifacts/printings/browser");
let child, root;
async function start() {
  child = spawn(process.execPath, [path.join(__dirname, "admin-server.js")], { cwd: path.resolve(__dirname, ".."), env: { ...process.env, GAUNTLET_ASSET_FIXTURE_ROOT: root, GAUNTLET_PRINTING_FIXTURE: "true" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"] });
  await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error("Fixture startup timed out")), 30000); child.once("exit", code => { clearTimeout(timeout); reject(new Error("Fixture exited: " + code)); }); child.stderr.on("data", bytes => fs.appendFileSync(path.join(artifactRoot, "server.log"), bytes)); child.stdout.on("data", bytes => { fs.appendFileSync(path.join(artifactRoot, "server.log"), bytes); if (String(bytes).includes("fixture server ready")) { clearTimeout(timeout); resolve(); } }); });
}
async function stop() { if (child && child.exitCode === null) await new Promise((resolve, reject) => { child.once("exit", code => code === 0 ? resolve() : reject(new Error(`Fixture shutdown failed: ${code}`))); child.send("shutdown"); }); }
test.beforeAll(async () => { fs.mkdirSync(artifactRoot, { recursive: true }); root = fs.mkdtempSync(path.resolve(__dirname, "../.playwright-data/printings-")); await start(); });
test.afterAll(stop);
async function section(page, label) { const select = page.getByRole("combobox", { name: "Card Workshop section", exact: true }); if (await select.isVisible()) await select.selectOption({ label }); else await page.getByRole("navigation", { name: "Card Workshop sections", exact: true }).getByRole("button", { name: label, exact: true }).click(); }
test("create, upload, organize, publish, own, save, play, revise and recover a printing through the real UI", async ({ page, browser, request, baseURL }) => {
  const login = async name => (await (await request.post(serverUrl + "/api/auth/login", { data: { name, password: "test-password" } })).json()).token;
  const token = await login("simply"), headers = { Authorization: `Bearer ${token}` };
  await page.addInitScript(token => localStorage.setItem("gauntlet_auth_token", token), token);
  const open = async p => { await p.goto(`/admin/gauntlet?workshop=cards&object=${cardId}`); await section(p, "Artwork"); };
  const selected = async (p, id) => { await p.getByLabel("Collector version", { exact: true }).selectOption(id); };
  const status = async () => (await (await request.get(serverUrl + "/api/admin/authoring", { headers })).json());
  const capture = async () => { const response = await request.post(serverUrl + "/api/admin/fixture/capture-printing-match", { headers }); expect(response.ok()).toBeTruthy(); return (await response.json()).game; };
  await open(page); const source = await status(), p1 = `${cardId}:standard`;
  await expect(page.locator(".admin-card-preview img").first()).toBeVisible();
  await page.getByRole("button", { name: "Create set", exact: true }).click();
  await page.getByLabel("New content name").fill("Printing Browser Edition");
  await page.getByRole("button", { name: "Save new set to draft", exact: true }).click();
  await expect(page.getByLabel("Selected content", { exact: true }).getByRole("heading", { name: "Printing Browser Edition", exact: true })).toBeVisible();
  const edition = (await status()).draft.snapshot.domains.sets[0].id;
  await open(page); await page.getByRole("button", { name: "Duplicate selected printing" }).click();
  await page.getByLabel("New content name").fill("Rumin Sentry alternate");
  await page.getByLabel("New printing edition").selectOption(edition); await page.getByLabel("New collector identifier").fill("002");
  const created = waitForBufferedAdminResponse(page, r => r.url().endsWith("/authoring/create")); await page.getByRole("button", { name: "Save new printing to draft" }).click();
  const result = await (await created).json(), p2 = result.draft.snapshot.domains.assets.at(-1).id; expect(p2).not.toBe(p1);
  await expect(page.getByRole("heading", { name: "Editing printing: Rumin Sentry alternate", exact: true })).toBeVisible();
  const upload = async color => {
    await page.getByRole("button", { name: "Browse images", exact: true }).click(); const picker = page.getByRole("dialog", { name: "Choose artwork" });
    await expect(picker.getByText(/Upload capacity/)).toBeVisible(); await picker.getByText("Upload artwork", { exact: true }).click();
    await picker.getByLabel("Artwork title", { exact: true }).fill("Alternate printing art");
    await picker.getByLabel("Image file").setInputFiles({ name: "printing.png", mimeType: "image/png", buffer: await sharp({ create: { width: 240, height: 320, channels: 3, background: color } }).png().toBuffer() });
    const response = waitForBufferedAdminResponse(page, r => r.url().endsWith("/assets/upload")); await picker.getByRole("button", { name: "Upload new artwork", exact: true }).click(); const uploaded = (await (await response).json()).uploaded;
    await picker.getByRole("button", { name: "Use selected artwork", exact: true }).click(); const saved = page.waitForResponse(r => r.url().endsWith("/authoring/draft")); await page.getByRole("button", { name: "Save artwork reference to draft", exact: true }).click(); expect((await saved).ok()).toBeTruthy(); await expect(page.getByRole("button", { name: "Save artwork reference to draft", exact: true })).toBeDisabled(); return uploaded;
  };
  const b = await upload("#265ed8"); await open(page); await selected(page, p2);
  await expect(page.getByLabel("Draft digital set / edition", { exact: true })).toHaveValue(edition);
  await page.getByText("Compare with default printing", { exact: true }).click(); await expect(page.locator(".admin-printing-comparison img")).toHaveCount(2);
  await expect.poll(() => page.locator(".admin-printing-comparison img").last().evaluate(img => img.naturalWidth)).toBe(240);
  await page.screenshot({ path: path.join(artifactRoot, "compare.png") });
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390); await page.screenshot({ path: path.join(artifactRoot, "mobile.png") }); await page.setViewportSize({ width: 1440, height: 1000 });
  const publish = async (label, testRequired = false) => {
    if (testRequired) {
      await section(page, "Test"); const harness = page.getByRole("region", { name: "Real engine playtest" }); await harness.getByRole("button", { name: "Configure custom starting state" }).click();
      const started = waitForBufferedAdminResponse(page, r => r.url().endsWith("/authoring/playtest")); await harness.getByRole("button", { name: "Start draft duel playtest", exact: true }).click(); const session = (await (await started).json()).playtest;
      expect(session.subject.printingId).toBe(p2); expect(session.game.players[1].hand[0].presentation.printingId).toBe(p2);
      const pass = session.legalActions.find(action => action.type === "passPriority"); await harness.getByRole("combobox", { name: /^Action/ }).selectOption(pass.id);
      const executed = page.waitForResponse(r => r.url().endsWith("/playtest/command")); await harness.getByRole("button", { name: "Execute selected action" }).click(); expect((await executed).ok()).toBeTruthy();
    }
    await page.getByRole("button", { name: "Preview saved draft", exact: true }).click(); await page.getByRole("button", { name: "Review release", exact: true }).click();
    await page.getByLabel("Release name").fill(label); await page.getByRole("button", { name: "Publish release", exact: true }).click(); const response = page.waitForResponse(r => r.url().endsWith("/authoring/publish"), { timeout: 60000 }); await page.getByRole("button", { name: "Confirm publish", exact: true }).click(); expect((await response).ok()).toBeTruthy(); await expect(page.getByText("Live content · no draft", { exact: true })).toBeVisible();
  };
  await publish("Printing browser R1", true); const r1 = (await status()).activeReleaseId;
  // Explicit isolated fixture ownership; Admin creation itself grants nothing.
  const accountFile = path.join(root, "accounts.json"), store = JSON.parse(fs.readFileSync(accountFile, "utf8")), account = store.accounts[0];
  expect(account.stats.collection.collectorVariants?.[p2]).toBeUndefined(); account.stats.collection.collectorVariants = { ...account.stats.collection.collectorVariants, [p2]: 1 }; fs.writeFileSync(accountFile, JSON.stringify(store));
  await page.goto(baseURL); await page.locator('button[data-area="build"]').click(); await page.getByRole("button", { name: "Open Collection Workshop" }).click(); await page.getByRole("tab", { name: "Decks", exact: true }).click(); await page.getByLabel("Deck faction", { exact: true }).selectOption("rumin");
  await page.getByRole("button", { name: "4 of diamonds — Standard playing card", exact: true }).click(); await page.getByRole("button", { name: "Swap 4 of diamonds for Rumin Sentry", exact: true }).click();
  await page.getByLabel("Rumin Sentry card version", { exact: true }).selectOption(p2); await page.getByLabel("Deck name", { exact: true }).fill("Printing journey deck"); await page.getByRole("button", { name: "Create Deck", exact: true }).click(); await expect(page.getByRole("button", { name: "Save New Version", exact: true })).toBeEnabled();
  const savedDeck = () => JSON.parse(fs.readFileSync(accountFile, "utf8")).accounts[0].stats.savedConstructedDeck; expect(savedDeck().collectorVariantSelections[cardId]).toBe(p2);
  await page.locator(".deck-slot.is-replaced").click(); await expect(page.locator(".deck-slot-preview img")).toHaveAttribute("src", serverUrl + `/api/content-assets/${b.id}/${b.sha256}.webp`); await page.screenshot({ path: path.join(artifactRoot, "saved-deck.png") });
  const oldGame = await capture(); expect(oldGame.handAttacks[0].card.presentation.printingId).toBe(p2); expect(oldGame.handAttacks[0].card.presentation.illustrationAssetId).toBe(b.id);
  await open(page); await selected(page, p2); const c = await upload("#a337dd"); await publish("Printing browser R2"); const nextGame = await capture(); expect(nextGame.handAttacks[0].card.presentation.illustrationAssetId).toBe(c.id); expect(nextGame.handAttacks[0].card.presentation.printingRevision).not.toBe(oldGame.handAttacks[0].card.presentation.printingRevision);
  await open(page); await page.getByRole("button", { name: "Review release", exact: true }).click(); await page.getByRole("button", { name: "Restore Printing browser R1", exact: true }).click(); await page.getByRole("button", { name: "Confirm rollback", exact: true }).click(); await expect(page.getByText("Previous release restored for future games.", { exact: true })).toBeVisible();
  await stop(); await start(); const fresh = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    await fresh.addInitScript(token => localStorage.setItem("gauntlet_auth_token", token), token); const p = await fresh.newPage(); await open(p); await selected(p, p2); await expect(p.locator(".admin-card-preview img").first()).toHaveAttribute("src", serverUrl + `/api/content-assets/${b.id}/${b.sha256}.webp`);
    expect(savedDeck().collectorVariantSelections[cardId]).toBe(p2); expect((await capture()).handAttacks[0].card.presentation.illustrationAssetId).toBe(b.id);
    const rooms = (await (await request.get(serverUrl + "/api/admin/fixture/image-matches", { headers })).json()).rooms;
    for (const [index, version] of [b, c].entries()) {
      const state = rooms[index].publicState; expect(state.handAttacks[0].card.presentation.illustrationAssetId).toBe(version.id); const matchId = `eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee${index}`;
      const replay = { matchId, availability: { available: true, mode: "public-state-frames" }, participants: [{ playerNum: 1, displayName: "Rumin" }, { playerNum: 2, displayName: "Sheen" }], frames: [{ frameIndex: 1, publicState: state }], steps: [{ index: 0, evidenceSequence: 1, evidenceId: "printing-attack", eventType: "attack.declared", turn: 1, phase: "priority", label: "Captured printing attack", frameIndex: 1, publicPayload: {} }], notableMoments: [] };
      await p.route(`**/api/matches/${matchId}/replay`, route => route.fulfill({ json: { replay } })); const image = p.waitForResponse(r => r.url().includes(version.id) && r.status() === 200); await p.goto(`${baseURL}/?match=${matchId}&replay=1`); await image; await expect(p.locator("canvas.babylon-match-canvas")).toBeVisible(); await p.screenshot({ path: path.join(artifactRoot, `replay-${index}.png`) });
    }
  } finally { await fresh.close(); }
  fs.writeFileSync(path.join(artifactRoot, "journey.json"), JSON.stringify({ p1, p2, edition, b, c, r1, baseline: source.activeReleaseId, persistentStore: root, restarted: true }, null, 2));
});
