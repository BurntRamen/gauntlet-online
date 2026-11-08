const { test, expect } = require("./admin-release-test");
const { waitForBufferedAdminResponse } = require("./buffered-admin-response");
const AxeBuilder = require("@axe-core/playwright").default;
const fs = require("node:fs");
const path = require("node:path");

const fixtureRoot = path.resolve(__dirname, "../.playwright-data/admin-redesign");
const origin = `http://127.0.0.1:${process.env.GAUNTLET_ADMIN_FIXTURE_PORT || "4188"}`;
const evidence = path.resolve(__dirname, process.env.GAUNTLET_ADMIN_EVIDENCE_DIR || "../docs/reviews/admin-workspace/after");
const cardId = "rumin-coin-scale-spear";
const sessions = () => JSON.parse(fs.readFileSync(path.join(fixtureRoot, "sessions.json"), "utf8"));
const headers = name => ({ Authorization: `Bearer ${sessions()[name || "simply"]}` });
// Retry only transport resets on fixture reads; mutations and HTTP assertions remain strict.
const api = (request, route, options = {}) => request.get(origin + route, { headers: headers(), maxRetries: 2, ...options });
async function state(request) { const response = await api(request, "/api/admin/authoring"); expect(response.ok()).toBeTruthy(); return response.json(); }
async function discard(request) { const current = await state(request); if (current.draft) expect((await request.post(origin + "/api/admin/authoring/discard", { headers: headers(), data: { expectedRevision: current.revision } })).ok()).toBeTruthy(); }
async function openCard(page, id = cardId) { await page.goto(`/admin/gauntlet?workshop=cards&object=${id}`); await expect(page.getByRole("region", { name: "Card Workshop", exact: true })).toBeVisible(); await expect(page.getByLabel("Draft name", { exact: true })).toBeVisible(); }
async function section(page, name, workshop = "Card Workshop") { const select = page.getByRole("combobox", { name: `${workshop} section`, exact: true }); const nav = page.getByRole("navigation", { name: `${workshop} sections`, exact: true }); await expect(select.or(nav)).toBeVisible(); if (await select.isVisible()) await select.selectOption({ label: name }); else await nav.getByRole("button", { name, exact: true }).click(); }
async function area(page, name) { await expect(page.locator(".admin-workspace")).toBeVisible(); const nav = page.getByRole("navigation", { name: "Administration sections" }); if (!await nav.isVisible()) await page.getByRole("button", { name: "Navigation", exact: true }).click(); await nav.getByRole("button", { name, exact: true }).click(); }
const saveRecord = page => page.getByRole("region", { name: "Save record changes" }).getByRole("button", { name: /^Save changes to/ });
async function save(page) { const response = page.waitForResponse(r => r.url().endsWith("/authoring/record") && r.request().method() === "PATCH"); await saveRecord(page).click(); expect((await response).ok()).toBeTruthy(); }
async function image(page, name) {
  fs.mkdirSync(evidence, { recursive: true });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter(img => {
      const box = img.getBoundingClientRect();
      return box.width && box.height && box.top < innerHeight && box.bottom > 0 && box.left < innerWidth && box.right > 0;
    }).map(img => img.decode().catch(() => {})));
  });
  await page.screenshot({ path: path.join(evidence, name + ".png"), fullPage: false, animations: "disabled" });
}

test.beforeEach(async ({ page, context, request, baseURL }) => {
  await discard(request);
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    // Even a mistaken build cannot contact a production API from this suite.
    if (["http:", "https:"].includes(url.protocol) && ![origin, new URL(baseURL).origin].includes(url.origin)) return route.abort("blockedbyclient");
    return route.continue();
  });
  await context.addInitScript(token => { if (!localStorage.getItem("gauntlet_auth_token")) localStorage.setItem("gauntlet_auth_token", token); }, sessions().simply);
});
test.afterEach(async ({ request }) => { await discard(request); });

test("card fields stay local across sections and browser Back, then save together to the shared draft", async ({ page, request }) => {
  await openCard(page);
  const before = await state(request), original = before.live.domains.cards.find(row => row.id === cardId);
  const name = original.name + " · multi-field fixture", wording = "A focused wording review. " + original.text;
  const writes = [];
  page.on("request", req => { if (req.method() === "PATCH" && req.url().includes("/authoring/")) writes.push({ url: req.url(), body: req.postDataJSON() }); });
  await page.getByLabel("Draft name", { exact: true }).fill(name);
  await page.getByLabel("Draft displayed rules text", { exact: true }).fill(wording);
  await section(page, "Mechanics");
  await expect(page.getByRole("dialog", { name: "Unsaved local changes" })).toHaveCount(0);
  await section(page, "Artwork");
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "Unsaved local changes" })).toHaveCount(0);
  await section(page, "Details");
  await expect(page.getByLabel("Draft name", { exact: true })).toHaveValue(name);
  await expect(page.getByLabel("Draft displayed rules text", { exact: true })).toHaveValue(wording);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Unsaved local changes" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Card Workshop preview and test" })).toContainText(/Live content|Saved draft/);
  await page.getByRole("button", { name: "Editor", exact: true }).click();
  await expect(page.getByLabel("Draft name", { exact: true })).toHaveValue(name);
  expect(writes).toHaveLength(0);
  expect((await state(request)).revision).toBe(before.revision);
  await save(page);
  await expect(saveRecord(page)).toHaveCount(0);
  expect(writes).toHaveLength(1);
  expect(writes[0].url).toBe(origin + "/api/admin/authoring/record");
  expect(writes[0].body.changes.map(change => change.field).sort()).toEqual(["name", "text"]);
  const saved = (await state(request)).draft.snapshot.domains.cards.find(row => row.id === cardId);
  expect(saved.name).toBe(name); expect(saved.text).toBe(wording);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByText(/saved to the shared draft/i).first()).toBeVisible();
});

test("failed saves preserve input and two operators deliberately reconcile a stale record", async ({ page, request }) => {
  await openCard(page);
  const before = await state(request), original = before.live.domains.cards.find(row => row.id === cardId);
  const localName = original.name + " · local", remoteName = original.name + " · other operator";
  await page.getByLabel("Draft name", { exact: true }).fill(localName);
  await page.route("**/api/admin/authoring/record", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Fixture connection interruption. Retry when available." }) }), { times: 1 });
  await saveRecord(page).click();
  await expect(page.getByRole("alert").filter({ hasText: "Fixture connection interruption" })).toBeVisible();
  await expect(page.getByLabel("Draft name", { exact: true })).toHaveValue(localName);
  expect((await state(request)).revision).toBe(before.revision);
  const other = await request.patch(origin + "/api/admin/authoring/record", { headers: headers("Burnt Ramen"), data: { expectedRevision: before.revision, domain: "cards", id: cardId, changes: [{ field: "name", value: remoteName }] } });
  expect(other.ok()).toBeTruthy();
  await saveRecord(page).click();
  const conflict = page.getByRole("region", { name: "Reconcile shared changes" });
  await expect(conflict).toBeVisible();
  await expect(conflict).toContainText(localName); await expect(conflict).toContainText(remoteName); await expect(conflict).toContainText(original.name);
  await expect(page.getByLabel("Draft name", { exact: true })).toHaveValue(localName);
  await conflict.getByRole("button", { name: "Keep my name", exact: true }).click();
  await conflict.getByRole("button", { name: "Use latest revision for retry", exact: true }).click();
  await save(page);
  expect((await state(request)).draft.snapshot.domains.cards.find(row => row.id === cardId).name).toBe(localName);
});

test("genuine departure offers keep, discard, and save-and-continue only after acknowledgement", async ({ page, request }) => {
  await openCard(page);
  const original = (await state(request)).live.domains.cards.find(row => row.id === cardId);
  await page.getByLabel("Draft name", { exact: true }).fill(original.name + " · resume");
  await area(page, "Home");
  const dialog = page.getByRole("dialog", { name: "Unsaved local changes" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.getByLabel("Draft name", { exact: true })).toHaveValue(original.name + " · resume");
  await area(page, "Home");
  await page.route("**/api/admin/authoring/record", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Fixture departure save failed" }) }), { times: 1 });
  await dialog.getByRole("button", { name: "Save and continue", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Administration sections" }).getByRole("button", { name: "Content", exact: true })).toHaveAttribute("aria-current", "page");
  await dialog.getByRole("button", { name: "Save and continue", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Administration sections" }).getByRole("button", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
  expect((await state(request)).draft.snapshot.domains.cards.find(row => row.id === cardId).name).toBe(original.name + " · resume");
  await openCard(page);
  await page.getByLabel("Draft name", { exact: true }).fill("Discard this browser buffer");
  await area(page, "Home");
  await dialog.getByRole("button", { name: "Discard local edits and continue", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await openCard(page);
  await expect(page.getByLabel("Draft name", { exact: true })).toHaveValue(original.name + " · resume");
});

test("creation selects the new record and printing comparison retains the selected version", async ({ page, request }) => {
  await page.goto("/admin/gauntlet?workshop=decks");
  await page.getByRole("button", { name: "Create deck", exact: true }).click();
  await page.getByLabel("New content name", { exact: true }).fill("Redesign working deck");
  const createdResponse = waitForBufferedAdminResponse(page, r => r.url().endsWith("/authoring/create") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Save new deck to draft", exact: true }).click();
  const created = await (await createdResponse).json(), deck = created.draft.snapshot.domains.decks.find(row => row.name === "Redesign working deck");
  expect(deck).toBeTruthy();
  await expect(page.getByRole("heading", { name: deck.name, exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp("object=" + deck.id));
  await section(page, "Composition", "Deck Workshop");
  await expect(page.getByRole("region", { name: "Deck Workshop", exact: true })).toContainText("52");
  await image(page, "deck-composition-1366");
  await page.getByRole("button", { name: "Back to list", exact: true }).click();
  await page.getByRole("button", { name: "Duplicate deck", exact: true }).click();
  await page.getByLabel("New content name", { exact: true }).fill("Redesign copied deck");
  await page.getByRole("button", { name: "Save new deck to draft", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Redesign copied deck", exact: true })).toBeVisible();
  const current = await state(request), domains = current.draft.snapshot.domains;
  const card = domains.cards.find(row => domains.assets.filter(printing => printing.gameplayCardId === row.id && printing.status !== "archived").length > 1);
  expect(card).toBeTruthy();
  const printing = domains.assets.filter(row => row.gameplayCardId === card.id && row.status !== "archived").find(row => row.id !== card.defaultVariantId);
  await openCard(page, card.id); await section(page, "Artwork");
  const printings = page.getByRole("region", { name: "Card printings", exact: true });
  await printings.getByRole("group", { name: "Printing results" }).getByRole("button").filter({ hasText: printing.name }).first().click();
  await expect(printings.getByRole("heading", { name: "Editing printing: " + printing.name, exact: true })).toBeVisible();
  await printings.getByText("Compare with default printing", { exact: true }).click();
  await expect(printings.getByText("Selected printing · Saved content", { exact: true })).toBeVisible();
  await printings.getByText("Printing identity and captured revision", { exact: true }).click();
  await expect(printings.locator("pre")).toContainText(printing.id);
});

test("keyboard search is a modal extension, restores focus and opens exact editable text", async ({ page, request }) => {
  await openCard(page);
  const name = (await state(request)).live.domains.cards.find(row => row.id === cardId).name;
  const input = page.getByLabel("Draft name", { exact: true }); await input.focus();
  const before = await page.locator(".design-workspace-header").boundingBox();
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Search Admin", exact: true }); await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("searchbox")).toBeFocused();
  const after = await page.locator(".design-workspace-header").boundingBox(); expect(after.y).toBe(before.y);
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(input).toBeFocused();
  await page.keyboard.press("Control+k");
  await dialog.getByRole("searchbox").fill(name);
  await expect(dialog.locator(".admin-search-results button").first()).toBeVisible();
  await page.keyboard.press("ArrowDown"); await expect(dialog.locator(".admin-search-results button").first()).toBeFocused();
  await page.keyboard.press("Enter"); await expect(dialog).toHaveCount(0); await expect(page).toHaveURL(new RegExp("object=" + cardId));
  await expect(page.getByRole("navigation", { name: "Content destinations" }).getByRole("button", { name: "Cards", exact: true })).toHaveAttribute("aria-current", "page");
});

test("operator preferences are scoped and private recent work clears when accounts change", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openCard(page);
  const browser = page.locator(".admin-content-browser");
  await browser.evaluate(element => element.scrollTo(0, 400));
  await expect.poll(() => browser.evaluate(element => element.scrollTop)).toBe(400);
  const destinations = page.getByRole("navigation", { name: "Content destinations" });
  await destinations.getByRole("button", { name: "Decks", exact: true }).click();
  await expect(page.getByRole("region", { name: "Deck Workshop", exact: true })).toBeVisible();
  await destinations.getByRole("button", { name: "Cards", exact: true }).click();
  await expect(page.getByRole("region", { name: "Card Workshop", exact: true })).toBeVisible();
  await expect.poll(() => browser.evaluate(element => element.scrollTop)).toBe(400);
  await page.getByRole("button", { name: "☆ Pin item", exact: true }).click();
  await page.getByLabel("Workspace options", { exact: true }).click();
  await page.getByRole("combobox", { name: "Density", exact: true }).selectOption("compact");
  await expect(page.locator(".admin-workspace")).toHaveAttribute("data-density", "compact");
  const firstScope = await page.evaluate(() => sessionStorage.getItem("gauntlet-admin-operator")); expect(firstScope).toBeTruthy();
  await page.reload();
  await expect(page.locator(".admin-workspace")).toHaveAttribute("data-density", "compact");
  // List position is per-domain session context; persistent preferences are separate.
  await expect.poll(() => browser.evaluate(element => element.scrollTop)).toBe(0);
  await page.evaluate(token => localStorage.setItem("gauntlet_auth_token", token), sessions()["Burnt Ramen"]);
  await page.reload();
  await expect(page.locator(".admin-workspace")).toHaveAttribute("data-density", "comfortable");
  await expect.poll(() => browser.evaluate(element => element.scrollTop)).toBe(0);
  expect(await page.evaluate(scope => localStorage.getItem(`gauntlet-admin:${scope}`), firstScope)).toBeNull();
  await expect(page.getByRole("button", { name: "☆ Pin item", exact: true })).toBeVisible();
  await page.getByLabel("Workspace options", { exact: true }).click();
  await page.getByRole("combobox", { name: "Density", exact: true }).selectOption("compact");
  await page.getByRole("button", { name: "Reset preferences", exact: true }).click();
  await expect(page.locator(".admin-workspace")).toHaveAttribute("data-density", "comfortable");
  // The separate unfinished player layout feature must remain uninitialized.
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => /menu.layout|command.deck.layout/i.test(key)))).toBe(false);
});

test("player support and match evidence retain their readable authoritative detail", async ({ page }) => {
  await page.goto("/admin/gauntlet"); await area(page, "Players");
  await page.getByRole("button", { name: "View player simply", exact: true }).click();
  const profile = page.getByRole("region", { name: "Selected player" });
  await expect(profile.getByRole("heading", { name: "simply", exact: true })).toBeVisible();
  const details = page.getByRole("navigation", { name: "Player details" });
  await details.getByRole("button", { name: "Campaigns", exact: true }).click();
  await profile.locator("summary").filter({ hasText: "Rumin" }).click();
  await expect(profile).toContainText("Brothers of Destiny");
  await details.getByRole("button", { name: "Decks", exact: true }).click();
  await expect(profile.getByRole("heading", { name: "Saved decks", exact: true })).toBeVisible();
  await area(page, "Operations");
  await page.getByRole("navigation", { name: "Operations workspaces" }).getByRole("button", { name: "Match evidence", exact: true }).click();
  await page.getByRole("button", { name: "Inspect match dddddddd-dddd-4ddd-8ddd-dddddddddddd", exact: true }).click();
  const match = page.getByRole("region", { name: "Match design inspection", exact: true });
  await expect(match.getByRole("heading", { name: /Authoritative audit history/ })).toBeVisible();
  await expect(match.getByRole("link", { name: "Open recorded replay" })).toHaveAttribute("href", "/?match=dddddddd-dddd-4ddd-8ddd-dddddddddddd&replay=1");
});

test("browser Back from player corrections resumes the requested content destination after a deliberate choice", async ({ page, request }) => {
  await openCard(page);
  const initial = await state(request);
  await section(page, "Artwork");
  await area(page, "Players");
  await page.getByRole("button", { name: "View player simply", exact: true }).click();
  await page.getByRole("button", { name: "Edit player name", exact: true }).click();
  await page.getByLabel("Player name", { exact: true }).fill("Local unsaved correction");
  await page.goBack();
  const dialog = page.getByRole("dialog", { name: "Unsaved local changes" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.getByLabel("Player name", { exact: true })).toHaveValue("Local unsaved correction");
  await page.goBack();
  await dialog.getByRole("button", { name: "Discard local edits and continue", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Card Workshop", exact: true })).toBeVisible();
  await expect(page.getByLabel("Draft name", { exact: true })).toBeVisible();
  await section(page, "Artwork");
  await area(page, "Players");
  await page.getByRole("button", { name: "View player simply", exact: true }).click();
  await page.getByRole("button", { name: "Edit player name", exact: true }).click();
  // A real acknowledged account operation, retaining the fixture's display name.
  await page.getByLabel("Correction reason", { exact: true }).fill("Isolated fixture: confirmed existing player name");
  await page.goBack();
  await expect(dialog).toContainText("immediately");
  const saved = page.waitForResponse(response => /\/api\/admin\/players\/[^/]+\/metadata$/.test(response.url()) && response.request().method() === "PATCH");
  await dialog.getByRole("button", { name: "Save and continue", exact: true }).click();
  expect((await saved).ok()).toBeTruthy();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Card Workshop", exact: true })).toBeVisible();
  expect((await state(request)).revision).toBe(initial.revision);
});

test("saved-draft preview and fixture publication verify active without claiming local values are live", async ({ page, request }) => {
  await openCard(page);
  const original = (await state(request)).live.domains.cards.find(row => row.id === cardId);
  const name = original.name + " · fixture publication";
  await page.getByLabel("Draft name", { exact: true }).fill(name); await save(page);
  await page.getByRole("button", { name: "Validate draft", exact: true }).click();
  await expect(page.getByText("Draft validation completed.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Preview saved draft", exact: true }).click();
  await expect(page.getByText("Saved draft preview is ready.", { exact: true })).toBeVisible();
  await area(page, "Publishing");
  const review = page.getByRole("region", { name: "Shared release review", exact: true });
  await expect(review).toContainText("One release, across all workshops");
  await expect(review).toContainText(name);
  await image(page, "publishing-1366");
  const publicationA11y = await new AxeBuilder({ page }).include(".gauntlet-admin").analyze();
  expect(publicationA11y.violations).toEqual([]);
  await page.getByLabel("Release name", { exact: true }).fill("Isolated workspace review");
  await page.getByRole("button", { name: "Publish release", exact: true }).click();
  await expect(page.getByRole("region", { name: "Confirm content operation" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm publish", exact: true }).click();
  await expect(page.getByText("Live content · no draft", { exact: true })).toBeVisible();
  const active = await state(request); expect(active.draft).toBeNull();
  expect(active.live.domains.cards.find(row => row.id === cardId).name).toBe(name);
  const publicContent = await (await request.get(origin + "/api/game-content")).json();
  expect(publicContent.content.cards.find(row => row.id === cardId).name).toBe(name);
  expect(publicContent.content.contentVersion).toBe(active.activeReleaseId);
  const baseline = active.releases.find(release => release.label === "Deployed source baseline");
  expect(baseline).toBeTruthy();
  const restore = await request.post(origin + "/api/admin/authoring/rollback", { headers: headers(), data: { expectedRevision: active.revision, releaseId: baseline.id } });
  expect(restore.ok()).toBeTruthy();
});

test("release blockers open the exact field and the corrected record returns to review", async ({ page, request }) => {
  const before = await state(request), original = before.live.domains.cards.find(row => row.id === cardId);
  // Existing single-field contract permits an invalid saved draft for review;
  // publication remains blocked by the authoritative snapshot validator.
  const invalid = await request.patch(origin + "/api/admin/authoring/draft", { headers: headers(), data: { expectedRevision: before.revision, domain: "cards", id: cardId, field: "name", value: "" } });
  expect(invalid.ok()).toBeTruthy();
  expect((await state(request)).validation.valid).toBe(false);
  await page.goto("/admin/gauntlet?area=Publishing");
  const review = page.getByRole("region", { name: "Shared release review", exact: true });
  await review.getByRole("button", { name: "Fix name", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("object=" + cardId));
  await expect(page.getByLabel("Draft name", { exact: true })).toBeFocused();
  await page.getByLabel("Draft name", { exact: true }).fill(original.name);
  await save(page);
  await page.getByRole("button", { name: "Review release", exact: true }).click();
  await expect(review).toBeVisible();
  await expect(review.getByRole("button", { name: "Fix name", exact: true })).toHaveCount(0);
  expect((await state(request)).validation.valid).toBe(true);
});

test("encounter setup earns exact-draft engine evidence and a later change invalidates it", async ({ page, request }) => {
  test.setTimeout(150000);
  const before = await state(request), encounter = before.live.domains.encounters.find(row => row.id === "brothers-of-destiny");
  await page.goto(`/admin/gauntlet?workshop=encounters&object=${encounter.id}`);
  await expect(page.getByRole("region", { name: "Encounter Workshop", exact: true })).toBeVisible();
  await section(page, "Opponent / Setup", "Encounter Workshop");
  await page.getByLabel("Boss Life", { exact: true }).fill(String(encounter.setup.bossLife + 1));
  await save(page);
  let saved = await state(request); expect(saved.draft.playtestedHash).not.toBe(saved.draft.hash);
  await section(page, "Playtest", "Encounter Workshop");
  const harness = page.getByRole("region", { name: "Real engine playtest" });
  await harness.getByRole("combobox", { name: "Test content", exact: true }).selectOption("draft");
  let response = waitForBufferedAdminResponse(page, r => r.url().endsWith("/authoring/playtest") && r.request().method() === "POST");
  await harness.getByRole("button", { name: `Start ${encounter.title} playtest`, exact: true }).click();
  const session = (await (await response).json()).playtest;
  expect(session.game.players[2].life).toBe(encounter.setup.bossLife + 1);
  const pass = session.legalActions.find(action => action.type === "passPriority"); expect(pass).toBeTruthy();
  await harness.getByRole("combobox", { name: "Action", exact: true }).selectOption(pass.id);
  response = waitForBufferedAdminResponse(page, r => r.url().endsWith("/playtest/command"));
  await harness.getByRole("button", { name: "Execute selected action", exact: true }).click();
  const executed = (await (await response).json()).playtest; expect(executed.acceptedCommands).toBe(1);
  await expect(harness.getByRole("region", { name: "Executed command result" })).toContainText("Accepted by the engine");
  saved = await state(request); expect(saved.draft.playtestedHash).toBe(saved.draft.hash);
  await image(page, "encounter-tested");
  await section(page, "Opponent / Setup", "Encounter Workshop");
  await page.getByLabel("Boss Life", { exact: true }).fill(String(encounter.setup.bossLife + 2));
  await save(page);
  saved = await state(request); expect(saved.draft.playtestedHash).not.toBe(saved.draft.hash);
  await area(page, "Publishing");
  await expect(page.getByRole("region", { name: "Shared release review" })).toContainText("engine");
  await expect(page.getByRole("button", { name: "Publish release", exact: true })).toBeDisabled();
});

test("review screenshots and responsive workspace preserve usable content and keyboard access", async ({ page, request }) => {
  test.setTimeout(240000);
  await page.goto("/admin/gauntlet");
  await expect(page.getByRole("heading", { name: "Needs attention", exact: true })).toBeVisible();
  await image(page, "home-1366");
  await openCard(page); await image(page, "card-1366");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByRole("region", { name: "Card Workshop preview and test" })).toBeVisible();
  await image(page, "card-preview-1366");
  await page.getByRole("button", { name: "Editor", exact: true }).click();
  const current = await state(request), deck = current.live.domains.decks.find(row => row.composition) || current.live.domains.decks[0];
  await page.goto(`/admin/gauntlet?workshop=decks&object=${deck.id}`);
  await expect(page.getByRole("region", { name: "Deck Workshop", exact: true })).toBeVisible(); await image(page, "deck-1366");
  await page.goto("/admin/gauntlet?workshop=encounters&object=brothers-of-destiny");
  await expect(page.getByLabel("Draft story", { exact: true })).toBeVisible(); await image(page, "encounter-1366");
  await area(page, "Players"); await page.getByRole("button", { name: "View player simply", exact: true }).click(); await image(page, "players-1366");
  for (const [name, width, height] of [["desktop", 1920, 1080], ["laptop", 1280, 720], ["tablet", 768, 1024], ["phone", 390, 844], ["zoom-reflow", 683, 384]]) {
    await page.setViewportSize({ width, height }); await openCard(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator(".admin-location")).toBeVisible();
    await expect(page.getByLabel("Draft name", { exact: true })).toBeVisible();
    await image(page, `card-${name}`);
    if (width <= 768) {
      const navButton = page.getByRole("button", { name: "Navigation", exact: true });
      await navButton.click(); const drawer = page.getByRole("dialog", { name: "Workspace navigation" }); await expect(drawer).toBeVisible();
      await page.keyboard.press("Escape"); await expect(drawer).toHaveCount(0); await expect(navButton).toBeFocused();
    }
    if (name === "phone") {
      const field = page.getByLabel("Draft name", { exact: true });
      const mobileName = (await field.inputValue()) + " · mobile review";
      await field.fill(mobileName);
      await section(page, "Artwork"); await section(page, "Details");
      await expect(page.getByRole("dialog", { name: "Unsaved local changes" })).toHaveCount(0);
      await page.getByRole("button", { name: "Preview", exact: true }).click();
      await expect(page.getByRole("region", { name: "Card Workshop preview and test" })).toBeVisible();
      await page.getByRole("button", { name: "Editor", exact: true }).click();
      await expect(field).toHaveValue(mobileName);
      await save(page);
      expect((await state(request)).draft.snapshot.domains.cards.find(row => row.id === cardId).name).toBe(mobileName);
      await discard(request);
    }
    const a11y = await new AxeBuilder({ page }).include(".gauntlet-admin").analyze();
    // Collect every responsive view before reporting independent accessibility failures.
    expect.soft(a11y.violations, `${name} accessibility`).toEqual([]);
  }
  const manifestPath = path.resolve(__dirname, "../client/build/asset-manifest.json");
  fs.writeFileSync(path.join(evidence, "capture.json"), JSON.stringify({
    fixture: "e2e/admin-server.js", backend: origin, client: new URL(page.url()).origin,
    capturedAt: new Date().toISOString(), browser: "Playwright Chromium", reducedMotion: "reduce",
    reviewViewport: "1366x768", responsiveViewports: ["1920x1080", "1280x720", "768x1024", "390x844", "683x384"],
    zoomReflow: "683x384 is the CSS viewport equivalent of a 1366x768 screen at 200%; this does not claim native browser zoom was exercised.",
    externalNetwork: "All non-loopback HTTP(S) origins blocked by the test context.",
    buildAssets: fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")).entrypoints : null
  }, null, 2) + "\n");
});
