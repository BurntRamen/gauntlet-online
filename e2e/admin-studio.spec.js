const { test, expect } = require('./admin-release-test');
const { area, saveRecord, previewSavedDraft } = require('./admin-navigation');
const { navigatePlayer } = require('./player-navigation');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path');
const origin = `http://127.0.0.1:${process.env.GAUNTLET_ADMIN_FIXTURE_PORT || '4188'}`;
const sessions = () => JSON.parse(fs.readFileSync(path.resolve(__dirname, '../.playwright-data/admin-redesign/sessions.json'), 'utf8'));
const headers = () => ({ Authorization: `Bearer ${sessions().simply}` });
async function state(request) { const r = await request.get(origin + '/api/admin/authoring', { headers: headers(), maxRetries: 2 }); expect(r.ok()).toBeTruthy(); return r.json(); }
async function clean(request) { const current = await state(request); if (current.draft) expect((await request.post(origin + '/api/admin/authoring/discard', { headers: headers(), data: { expectedRevision: current.revision } })).ok()).toBeTruthy(); }
test.beforeEach(async ({ context, request, baseURL }) => {
  await clean(request);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['http:', 'https:'].includes(url.protocol) && ![origin, new URL(baseURL).origin].includes(url.origin) ? route.abort('blockedbyclient') : route.continue();
  });
  await context.addInitScript(token => localStorage.setItem('gauntlet_auth_token', token), sessions().simply);
});
test.afterEach(async ({ request }) => clean(request));

test('Home stays compact and six destinations lead directly to the owning workspace', async ({ page }) => {
  const reads = [];
  page.on('request', r => { if (r.url().includes('/api/admin/')) reads.push(new URL(r.url()).pathname); });
  await page.goto('/admin/gauntlet');
  await expect(page.getByRole('heading', { name: 'Create something' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Administration sections' });
  await expect(nav.getByRole('button')).toHaveCount(6);
  expect(reads).not.toContain('/api/admin/authoring');
  expect(reads).not.toContain('/api/admin/catalog');
  expect(reads).not.toContain('/api/admin/system');
  expect(reads).not.toContain('/api/admin/overview');
  for (const [label, ready] of [['Website', '.admin-website-preview'], ['Create & Edit', '.design-workshop'], ['Events & Commerce', '.para-workspace'], ['Publishing', '[aria-label="Shared release review"]'], ['Operations', '[aria-label="Operations workspaces"]']]) {
    await area(page, label); await expect(page.locator(ready).first()).toBeVisible();
    await expect(nav.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
  }
});

test('website artwork and card edits share a release, reach the actual player and roll back together', async ({ page, request }) => {
  test.setTimeout(180000);
  const original = await state(request);
  await page.goto('/admin/gauntlet?workshop=cards&object=rumin-coin-scale-spear');
  await page.getByLabel('Draft name', { exact: true }).fill('Studio release blade');
  await saveRecord(page);
  await expect(page.locator('.admin-record-save')).toHaveCount(0);
  await area(page, 'Website');
  await page.getByLabel('Draft play landing · heading', { exact: true }).fill('Welcome to the studio fixture');
  await expect(page.locator('.website-render h1')).toHaveText('Welcome to the studio fixture');
  await expect(page.getByText('Local preview · unsaved changes')).toBeVisible();
  await page.getByRole('button', { name: 'Browse images', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Choose artwork' });
  await picker.getByLabel('Search assets').fill('rumin');
  await picker.locator('.asset-picker-tile').first().click();
  await picker.getByRole('button', { name: 'Use selected artwork', exact: true }).click();
  await expect(page.locator('.website-render .cd-page-artwork')).toBeVisible();
  await saveRecord(page);
  await expect(page.locator('.admin-record-save')).toHaveCount(0);
  expect((await (await request.get(origin + '/api/game-content')).json()).content.websiteProse.play.title).not.toBe('Welcome to the studio fixture');
  await area(page, 'Publishing');
  const review = page.getByRole('region', { name: 'Shared release review' });
  await expect(review).toContainText('Studio release blade');
  await expect(review).toContainText('Welcome to the studio fixture');
  await expect(review).toContainText('header image');
  await page.getByRole('button', { name: 'Validate draft', exact: true }).click();
  await expect(page.getByText('Draft validation completed.', { exact: true })).toBeVisible();
  await previewSavedDraft(page);
  await page.getByLabel('Release name').fill('Studio shared fixture');
  await page.getByRole('button', { name: 'Publish release', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm publish', exact: true }).click();
  await expect(page.getByText('No saved changes to review.', { exact: true })).toBeVisible();
  const player = await page.context().newPage();
  await player.goto('/'); await navigatePlayer(player, 'play');
  await expect(player.locator('.cd-page-header h1')).toHaveText('Welcome to the studio fixture');
  await expect(player.locator('.cd-page-header .cd-page-artwork')).toBeVisible();
  await player.screenshot({ path: 'artifacts/studio-published-website.png' });
  await player.close();
  const baseline = original.releases.find(row => row.id === original.activeReleaseId);
  await page.getByRole('button', { name: 'Restore ' + baseline.label, exact: true }).click();
  await page.getByRole('button', { name: 'Confirm rollback', exact: true }).click();
  await expect(page.getByText('Previous release restored for future games.', { exact: true })).toBeVisible();
  const restored = await state(request);
  expect(restored.activeReleaseId).toBe(original.activeReleaseId);
  expect(restored.live).toEqual(original.live);
});

test('phone website editing and keyboard search stay accessible with a protected local buffer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/gauntlet?workshop=modes&object=practice&section=play');
  const name = page.getByLabel('Draft play landing · heading', { exact: true });
  await name.fill('A local mobile heading');
  await page.keyboard.press('Control+k');
  const search = page.getByRole('dialog', { name: 'Search Admin' });
  await expect(search.getByRole('searchbox')).toBeFocused();
  await search.getByRole('searchbox').fill('Dividend Yield Blade');
  await search.getByLabel('Search in').selectOption('records');
  await expect(search.locator('.admin-search-results button').first()).toBeVisible();
  await search.getByRole('searchbox').press('ArrowDown');
  await page.keyboard.press('Enter');
  const guard = page.getByRole('dialog', { name: 'Unsaved local changes' });
  await expect(guard).toBeVisible();
  await guard.getByRole('button', { name: 'Keep editing', exact: true }).click();
  if (await search.isVisible()) await search.getByRole('button', { name: 'Close search' }).click();
  await expect(name).toHaveValue('A local mobile heading');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect((await new AxeBuilder({ page }).include('.gauntlet-admin').analyze()).violations).toEqual([]);
});


test('season eligibility, event rewards and product terms save through their owning editors', async ({ page, request }) => {
  test.setTimeout(180000);
  const { paraTab, saveDefinition, destination } = require('./admin-navigation');
  await page.goto('/admin/gauntlet');
  await area(page, 'Events & Commerce');
  await paraTab(page, 'Seasons');
  await page.getByRole('button', { name: 'New season', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Studio season');
  await page.getByLabel('faction-constructed', { exact: true }).check();
  await page.getByLabel('Public rules version', { exact: true }).fill('studio-review-v1');
  await page.getByLabel('Invitational Prestige threshold', { exact: true }).fill('75');
  await page.getByLabel('Gold cap per eligible account', { exact: true }).fill('4000');
  await saveDefinition(page);
  const season = (await state(request)).draft.snapshot.paraLeague.seasons.find(row => row.name === 'Studio season');
  expect(season.formats).toContain('faction-constructed');
  expect(season.publicRulesVersion).toBe('studio-review-v1');
  expect(season.invitationalThreshold).toBe(75);
  expect(season.goldBudget).toBe(4000);
  await paraTab(page, 'Events');
  await page.getByRole('button', { name: 'New event', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Studio open');
  await page.getByLabel('Season', { exact: true }).selectOption(season.id);
  await page.getByLabel('Prestige for 7 wins', { exact: true }).fill('35');
  await saveDefinition(page);
  await destination(page, 'Decks');
  await page.getByRole('button', { name: 'Create deck', exact: true }).click();
  await page.getByLabel('New content name', { exact: true }).fill('Studio recipe');
  await page.getByRole('button', { name: 'Save new deck to draft', exact: true }).click();
  await expect(page.getByLabel('Draft template name', { exact: true })).toHaveValue('Studio recipe');
  await destination(page, 'Store');
  await page.getByRole('button', { name: 'Create offer', exact: true }).click();
  await page.getByLabel('New content name', { exact: true }).fill('Studio starter offer');
  await page.getByRole('button', { name: 'Save new offer to draft', exact: true }).click();
  await page.getByLabel('Price in gold', { exact: true }).fill('30');
  await page.getByLabel('Draft store availability', { exact: true }).selectOption('available');
  await saveRecord(page); await expect(page.locator('.admin-record-save')).toHaveCount(0);
  const saved = await state(request), offer = saved.draft.snapshot.domains.offers.find(row => row.name === 'Studio starter offer');
  expect(offer.prices.gold).toBe(30); expect(offer.status).toBe('available');
  expect((saved.live.domains.offers || []).some(row => row.id === offer.id)).toBe(false);
  expect(saved.draft.snapshot.paraLeague.events.find(row => row.name === 'Studio open').seasonId).toBe(season.id);
  expect(saved.draft.snapshot.paraLeague.events.find(row => row.name === 'Studio open').prestige[7]).toBe(35);
  await page.reload(); await expect(page.getByLabel('Price in gold', { exact: true })).toHaveValue('30');
  await area(page, 'Publishing');
  await expect(page.getByRole('region', { name: 'Shared release review' })).toContainText('Studio starter offer');
  await expect(page.getByRole('region', { name: 'Shared release review' })).toContainText('Studio open');
  await expect(page.getByRole('button', { name: 'Publish release', exact: true })).toBeDisabled();
});
