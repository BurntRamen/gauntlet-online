const { test, expect } = require('./admin-release-test');
const fs = require('node:fs');
const path = require('node:path');
const AxeBuilder = require('@axe-core/playwright').default;
const origin = `http://127.0.0.1:${process.env.GAUNTLET_ADMIN_FIXTURE_PORT || '4188'}`;
const phase = process.env.ADMIN_REFINEMENT_PHASE || 'after';
const root = path.resolve(__dirname, '../docs/reviews/admin-refinement', phase);
const sessions = () => JSON.parse(fs.readFileSync(path.resolve(__dirname, '../.playwright-data/admin-redesign/sessions.json'), 'utf8'));
const headers = () => ({ Authorization: `Bearer ${sessions().simply}` });
const cardId = 'rumin-vault-shield-bearer';
async function state(request) { const r = await request.get(origin + '/api/admin/authoring', { headers: headers() }); expect(r.ok()).toBeTruthy(); return r.json(); }
async function mutate(request, operation, data) {
  const current = await state(request);
  const r = await request[operation === 'draft' ? 'patch' : 'post'](origin + '/api/admin/authoring/' + operation, { headers: headers(), data: { expectedRevision: current.revision, ...data } });
  expect(r.ok()).toBeTruthy(); return r.json();
}
async function clean(request) { if ((await state(request)).draft) await mutate(request, 'discard', {}); }
async function capture(page, name) {
  fs.mkdirSync(root, { recursive: true });
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(img => img.decode().catch(() => {}))); });
  await page.screenshot({ path: path.join(root, name + '.png'), animations: 'disabled' });
  if (phase === 'after') {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} overflow`).toBeTruthy();
    expect((await new AxeBuilder({ page }).include('.gauntlet-admin').analyze()).violations, `${name} accessibility`).toEqual([]);
  }
}
test.beforeEach(async ({ context, request, baseURL }) => {
  await clean(request);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['http:', 'https:'].includes(url.protocol) && ![origin, new URL(baseURL).origin].includes(url.origin) ? route.abort('blockedbyclient') : route.continue();
  });
  await context.addInitScript(token => localStorage.setItem('gauntlet_auth_token', token), sessions().simply);
});
test.afterEach(async ({ request }) => { await clean(request); });

test('validation repair returns to its issue list with keyboard focus and stales old evidence', async ({ page, request }) => {
  await mutate(request, 'draft', { domain: 'cards', id: cardId, field: 'name', value: '' });
  await page.goto('/admin/gauntlet?area=Publishing');
  const review = page.getByRole('region', { name: 'Shared release review', exact: true });
  await expect(review.getByRole('button', { name: 'Fix name', exact: true })).toBeInViewport();
  await review.getByRole('button', { name: 'Fix name', exact: true }).click();
  const input = page.getByLabel('Draft name', { exact: true });
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(input).toHaveAccessibleDescription(/Up to 160 characters.*Blocking error.*Use nonempty text/i);
  await input.fill('Repaired Sentry');
  await page.getByRole('button', { name: /^Save changes to/ }).click();
  await expect(page.locator('.admin-record-save')).toHaveCount(0);
  await page.getByRole('button', { name: 'Return to release issues', exact: true }).click();
  await expect(page.locator('#review-blockers')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Publish release', exact: true })).toBeDisabled();
  await expect(review).toContainText('Preview this saved revision');
  await review.getByRole('button', { name: 'Preview saved draft', exact: true }).click();
  await page.getByLabel('Release name', { exact: true }).fill('Repaired candidate');
  await expect(page.getByRole('button', { name: 'Publish release', exact: true })).toBeEnabled();
  await expect(page.getByRole('list', { name: 'Release readiness' })).toContainText('Unverified');
});

test('review loading and failed responses are distinct and retry is read-only', async ({ page, request }) => {
  await mutate(request, 'draft', { domain: 'cards', id: cardId, field: 'name', value: 'Retry candidate' });
  let releaseRequest;
  await page.route('**/api/admin/workshops/review', route => new Promise(resolve => { releaseRequest = () => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Isolated unavailable response' }) }).then(resolve); }));
  await page.goto('/admin/gauntlet?area=Publishing');
  await expect(page.getByText('Loading release comparison…', { exact: true })).toBeVisible();
  await releaseRequest();
  await expect(page.getByRole('alert').filter({ hasText: 'Release review unavailable:' })).toBeVisible();
  const revision = (await state(request)).revision;
  await page.unroute('**/api/admin/workshops/review');
  await page.getByRole('button', { name: 'Retry release review', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Retry candidate', exact: true })).toBeVisible();
  expect((await state(request)).revision).toBe(revision);
});

test('mobile record actions remain visible without covering the focused field', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/gauntlet?workshop=cards&object=' + cardId);
  await page.getByLabel('Draft name', { exact: true }).fill('Local mobile draft');
  const field = page.getByLabel('Draft displayed rules text', { exact: true });
  await field.scrollIntoViewIfNeeded();
  await field.focus();
  const save = page.getByRole('button', { name: /^Save changes to/ });
  await expect(save).toBeInViewport();
  const fieldBox = await field.boundingBox(), barBox = await page.locator('.admin-record-save').boundingBox();
  expect(fieldBox.y).toBeGreaterThanOrEqual(barBox.y + barBox.height);
  await expect(field).toBeFocused();
  await capture(page, 'mobile-save-focus');
});

for (const [label, width, height] of [['laptop', 1366, 768], ['desktop', 1920, 1080], ['phone', 390, 844]]) {
  test(`visual baseline and release surfaces · ${label}`, async ({ page, request }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/admin/gauntlet');
    await expect(page.getByRole('heading', { name: 'Needs attention', exact: true })).toBeVisible();
    await capture(page, `home-${label}`);
    await page.goto('/admin/gauntlet?workshop=cards');
    await expect(page.getByRole('button', { name: 'Inspect Rumin Sentry', exact: true })).toBeVisible();
    await capture(page, `collection-${label}`);
    await page.getByLabel('Search cards', { exact: true }).fill('Rumin Sentry');
    await page.getByRole('button', { name: 'Inspect Rumin Sentry', exact: true }).click();
    await expect(page.getByLabel('Draft name', { exact: true })).toBeVisible();
    await expect(page.getByText('Loading production steps…')).toHaveCount(0);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.getByRole('img', { name: 'Rumin Sentry, 4 spades', exact: true })).toBeVisible();
    await capture(page, `editor-preview-${label}`);
    await mutate(request, 'draft', { domain: 'cards', id: cardId, field: 'name', value: '' });
    await page.goto('/admin/gauntlet?area=Publishing');
    const fix = page.getByRole('region', { name: 'Shared release review', exact: true }).getByRole('button', { name: 'Fix name', exact: true });
    await expect(fix).toBeVisible();
    if (phase === 'after') await expect(fix).toBeInViewport();
    await capture(page, `validation-${label}`);
    await mutate(request, 'draft', { domain: 'cards', id: cardId, field: 'name', value: 'Rumin Sentry · reviewed wording' });
    await mutate(request, 'preview', {});
    await page.reload();
    await expect(page.getByLabel('Release name', { exact: true })).toBeVisible();
    await page.getByLabel('Release name', { exact: true }).fill('Sentry presentation review');
    await expect(page.getByRole('button', { name: 'Publish release', exact: true })).toBeEnabled();
    await capture(page, `review-${label}`);
  });
}
