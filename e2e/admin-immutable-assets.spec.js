const { test, expect } = require("./admin-release-test");
const { waitForBufferedAdminResponse } = require("./buffered-admin-response");
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), { spawn } = require("node:child_process"), sharp = require("sharp");
const serverUrl = `http://127.0.0.1:${process.env.GAUNTLET_ADMIN_FIXTURE_PORT || 4117}`, cardId = "rumin-vault-shield-bearer";
const artifactRoot = path.resolve(__dirname, "../artifacts/immutable-assets");
let child, root;
async function start() {
  child = spawn(process.execPath, [path.join(__dirname, "admin-server.js")], { cwd: path.resolve(__dirname, ".."), env: { ...process.env, GAUNTLET_ASSET_FIXTURE_ROOT: root }, windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"] });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Fixture startup timed out")), 30000);
    child.once("exit", code => { clearTimeout(timeout); reject(new Error("Fixture exited: " + code)); });
    child.stderr.on("data", bytes => fs.appendFileSync(path.join(artifactRoot, "server.log"), bytes));
    child.stdout.on("data", bytes => { fs.appendFileSync(path.join(artifactRoot, "server.log"), bytes); if (String(bytes).includes("fixture server ready")) { clearTimeout(timeout); resolve(); } });
  });
}
async function stop() { if (child && child.exitCode === null) await new Promise((resolve, reject) => { child.once("exit", code => code === 0 ? resolve() : reject(new Error(`Fixture shutdown failed: ${code}`))); child.send("shutdown"); }); }
test.beforeAll(async () => { fs.mkdirSync(artifactRoot, { recursive: true }); const parent = path.resolve(__dirname, "../.playwright-data"); fs.mkdirSync(parent, { recursive: true }); root = fs.mkdtempSync(path.join(parent, "immutable-assets-")); await start(); });
test.afterAll(async () => { await stop(); });
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
async function section(page, label) {
  const select = page.getByRole("combobox", { name: "Card Workshop section", exact: true });
  if (await select.isVisible()) await select.selectOption({ label });
  else await page.getByRole("navigation", { name: "Card Workshop sections", exact: true }).getByRole("button", { name: label, exact: true }).click();
}
test("Admin uploads A/B, publishes, renders pinned matches, rolls back, restarts and serves retained bytes", async ({ browser, page, request, baseURL }) => {
  const login = async name => { const response = await request.post(serverUrl + "/api/auth/login", { data: { name, password: "test-password" } }); expect(response.ok()).toBeTruthy(); return (await response.json()).token; };
  const token = await login("simply"), headers = { Authorization: `Bearer ${token}`, Connection: "close" };
  await page.addInitScript(token => localStorage.setItem("gauntlet_auth_token", token), token);
  const open = async p => { await p.goto(`/admin/gauntlet?workshop=cards&object=${cardId}`); await section(p, "Artwork"); };
  await open(page);
  const upload = async (color, replacement = false) => {
    await page.getByRole("button", { name: "Browse images", exact: true }).click();
    const picker = page.getByRole("dialog", { name: "Choose artwork" });
    await picker.getByText("Upload artwork", { exact: true }).click();
    if (replacement) await picker.getByRole("checkbox", { name: /New version of/ }).check();
    await picker.getByLabel("Artwork title", { exact: true }).fill("Local artwork journey");
    await picker.getByLabel("Description", { exact: true }).fill("Actual upload byte and renderer fixture");
    await picker.getByLabel("Attribution / source notes", { exact: true }).fill("Private fixture notes");
    const data = await sharp({ create: { width: 240, height: 320, channels: 3, background: color } }).png().toBuffer();
    await picker.getByLabel("Image file").setInputFiles({ name: "original.png", mimeType: "image/png", buffer: data });
    const pending = waitForBufferedAdminResponse(page, r => r.url().endsWith("/assets/upload"));
    await picker.getByRole("button", { name: replacement ? "Upload new version" : "Upload new artwork", exact: true }).click();
    const response = await pending; expect(response.ok()).toBeTruthy(); const result = await response.json(), version = result.uploaded;
    expect(version.originalSha256).toBe(hash(data));
    await expect(picker.getByText(/Uploaded · Select this exact version/)).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await picker.screenshot({ path: path.join(artifactRoot, replacement ? "replacement-mobile.png" : "upload-mobile.png") });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await picker.getByRole("button", { name: "Use selected artwork", exact: true }).click();
    const saving = page.waitForResponse(r => r.url().endsWith("/authoring/draft"));
    await page.getByRole("button", { name: "Save artwork reference to draft", exact: true }).click();
    expect((await saving).ok()).toBeTruthy();
    await expect(page.getByRole("button", { name: "Save artwork reference to draft", exact: true })).toBeDisabled();
    return version;
  };
  const a = await upload("#da321e");
  const aPath = `/api/content-assets/${a.id}/${a.sha256}.webp`;
  expect((await request.get(serverUrl + aPath)).status()).toBe(404);
  for (const auth of [null, await login("Visitor")]) {
    expect((await request.get(serverUrl + `/api/admin/authoring/assets/${a.id}`, { headers: auth ? { Authorization: `Bearer ${auth}` } : {} })).status()).toBe(auth ? 403 : 401);
  }
  const peer = await request.get(serverUrl + `/api/admin/authoring/assets/${a.id}`, { headers: { Authorization: `Bearer ${await login("Burnt Ramen")}` } }); expect(peer.ok()).toBeTruthy();
  expect(hash(Buffer.from((await peer.json()).data, "base64"))).toBe(a.sha256);
  await open(page); // close/reopen saved field, no browser object URL identity
  const preview = page.locator(".admin-card-preview img").first();
  await expect(preview).toHaveAttribute("src", /^data:image\/webp;base64,/);
  expect(hash(Buffer.from((await preview.getAttribute("src")).split(",")[1], "base64"))).toBe(a.sha256);
  await expect.poll(() => preview.evaluate(img => img.naturalWidth)).toBe(240);
  await section(page, "Test");
  const harness = page.getByRole("region", { name: "Real engine playtest" });
  await harness.getByRole("button", { name: "Configure custom starting state" }).click();
  const pending = waitForBufferedAdminResponse(page, r => r.url().endsWith("/authoring/playtest"));
  await harness.getByRole("button", { name: "Start draft duel playtest", exact: true }).click();
  const draftSession = (await (await pending).json()).playtest;
  expect(draftSession.game.players[1].hand[0].presentation.illustrationAssetId).toBe(a.id);
  await harness.getByText("Hands and remaining decks", { exact: true }).click();
  const draftImage = harness.locator(".admin-playtest-hand img").first(); await expect.poll(() => draftImage.evaluate(img => img.naturalWidth)).toBe(240);
  expect(hash(Buffer.from((await draftImage.getAttribute("src")).split(",")[1], "base64"))).toBe(a.sha256);
  await page.screenshot({ path: path.join(artifactRoot, "draft-match.png") });
  const publish = async label => {
    await page.getByRole("button", { name: "Preview saved draft", exact: true }).click();
    await page.getByRole("button", { name: "Review release", exact: true }).click();
    await page.getByLabel("Release name").fill(label);
    await page.getByRole("button", { name: "Publish release", exact: true }).click();
    const publication = page.waitForResponse(r => r.url().endsWith("/authoring/publish"), { timeout: 30000 });
    await page.getByRole("button", { name: "Confirm publish", exact: true }).click();
    expect((await publication).ok()).toBeTruthy();
    await expect(page.getByText("Live content · no draft", { exact: true })).toBeVisible();
  };
  const capture = async () => { const response = await request.post(serverUrl + "/api/admin/fixture/capture-image-match", { headers }); expect(response.ok()).toBeTruthy(); return response.json(); };
  const delivered = async version => { const response = await request.get(serverUrl + `/api/content-assets/${version.id}/${version.sha256}.webp`); expect(response.ok()).toBeTruthy(); expect(response.headers()["cache-control"]).toContain("immutable"); expect(hash(await response.body())).toBe(version.sha256); };
  await publish("Artwork R1"); const r1 = await capture(); await delivered(a);
  await open(page); const b = await upload("#245cdd", true); expect(b.assetId).toBe(a.assetId); expect(b.version).toBe(2);
  expect(r1.game.handAttacks[0].card.presentation.illustrationAssetId).toBe(a.id); await delivered(a);
  await publish("Artwork R2"); const r2 = await capture(); expect(r2.game.handAttacks[0].card.presentation.illustrationAssetId).toBe(b.id); await delivered(b);
  await page.goto(baseURL);
  await page.locator('button[data-area="build"]').click();
  await page.getByRole("button", { name: "Open Collection Workshop" }).click();
  await page.getByRole("tab", { name: "Cards", exact: true }).click();
  await page.getByPlaceholder("Search cards", { exact: true }).fill("Rumin Sentry");
  const bUrl = serverUrl + `/api/content-assets/${b.id}/${b.sha256}.webp`;
  await expect(page.locator(".catalog-card-tile img").first()).toHaveAttribute("src", bUrl);
  await page.locator(".catalog-card-tile").first().click();
  await expect(page.locator(".card-art-inspector img").first()).toHaveAttribute("src", bUrl);
  await page.getByRole("tab", { name: "Decks", exact: true }).click();
  await page.getByLabel("Deck faction", { exact: true }).selectOption("rumin");
  await page.getByRole("button", { name: "4 of diamonds — Standard playing card", exact: true }).click();
  await page.getByRole("button", { name: "Swap 4 of diamonds for Rumin Sentry", exact: true }).click();
  await expect(page.locator(".deck-slot-preview img").first()).toHaveAttribute("src", bUrl);
  await page.screenshot({ path: path.join(artifactRoot, "published-deck.png") });
  // Render actual accepted engine snapshots through the production replay adapter
  // and WebGL table. Only the replay envelope is a fixture; byte delivery is real.
  const renderRecovered = async (p, index, version) => {
    const rooms = (await (await request.get(serverUrl + "/api/admin/fixture/image-matches", { headers })).json()).rooms;
    const state = rooms[index].publicState, matchId = `eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee${index}`;
    expect(state.handAttacks[0].card.presentation.illustrationAssetId).toBe(version.id);
    const replay = { matchId, availability: { available: true, mode: "public-state-frames" }, participants: [{ playerNum: 1, displayName: "Rumin" }, { playerNum: 2, displayName: "Sheen" }], frames: [{ frameIndex: 1, publicState: state }], steps: [{ index: 0, evidenceSequence: 1, evidenceId: "art-attack", eventType: "attack.declared", turn: 1, phase: "priority", label: "Captured attack", frameIndex: 1, publicPayload: {} }], notableMoments: [] };
    await p.route(`**/api/matches/${matchId}/replay`, route => route.fulfill({ json: { replay } }));
    const imageResponse = p.waitForResponse(r => r.url().includes(version.id) && r.status() === 200);
    await p.goto(`${baseURL}/?match=${matchId}&replay=1`);
    const response = await imageResponse; expect(hash(await response.body())).toBe(version.sha256);
    await expect(p.locator("canvas.babylon-match-canvas")).toBeVisible();
    await p.screenshot({ path: path.join(artifactRoot, `recovered-${index}-${version.version}.png`) });
  };
  await renderRecovered(page, 0, a); await renderRecovered(page, 1, b);
  await open(page); await page.getByRole("button", { name: "Review release", exact: true }).click();
  await page.getByRole("button", { name: "Restore Artwork R1", exact: true }).click();
  await page.getByRole("button", { name: "Confirm rollback", exact: true }).click();
  await expect(page.getByText("Previous release restored for future games.", { exact: true })).toBeVisible();
  expect((await capture()).game.handAttacks[0].card.presentation.illustrationAssetId).toBe(a.id); await delivered(b);
  expect((await request.delete(serverUrl + `/api/admin/authoring/assets/${a.id}`, { headers })).status()).toBe(409);
  await stop(); await start();
  const fresh = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), freshPage = await fresh.newPage();
  try {
    await fresh.addInitScript(token => localStorage.setItem("gauntlet_auth_token", token), token);
    await freshPage.goto(baseURL + `/admin/gauntlet?workshop=cards&object=${cardId}`); await section(freshPage, "Artwork");
    await expect(freshPage.locator(".admin-card-preview img").first()).toHaveAttribute("src", serverUrl + aPath);
    await expect.poll(() => freshPage.locator(".admin-card-preview img").first().evaluate(img => img.naturalWidth)).toBe(240);
    await renderRecovered(freshPage, 0, a); await delivered(b);
  } finally { await fresh.close(); }
  fs.writeFileSync(path.join(artifactRoot, "journey.json"), JSON.stringify({ a, b, r1: r1.game.contentVersion, r2: r2.game.contentVersion, persistentStore: root, restarted: true }, null, 2));
});
