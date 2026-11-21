// Isolated review only. Fixture-only drafts; never permits a remote request or publication.
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
async function run() {
  const phase = process.argv[2] || 'after';
  const root = path.resolve(__dirname, '../docs/reviews/admin-studio', phase);
  fs.mkdirSync(root, { recursive: true });
  const origin = 'http://127.0.0.1:3188', api = 'http://127.0.0.1:4188';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['http:', 'https:'].includes(url.protocol) && ![origin, api].includes(url.origin) ? route.abort() : route.continue();
  });
  const token = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../.playwright-data/studio/sessions.json'))).simply;
  await context.addInitScript(token => localStorage.setItem('gauntlet_auth_token', token), token);
  const headers = { Authorization: `Bearer ${token}` };
  let state = await (await context.request.get(api + '/api/admin/authoring', { headers })).json();
  const seedFile = path.resolve(__dirname, '../.playwright-data/studio/capture-fixtures.json');
  let fixture;
  if (fs.existsSync(seedFile)) fixture = JSON.parse(fs.readFileSync(seedFile));
  else {
    async function save(action, data = {}) {
      const result = await context.request.post(api + '/api/admin/authoring/' + action, { headers, data: { expectedRevision: state.revision, ...data }, timeout: 90000 });
      if (!result.ok()) throw new Error(await result.text());
      state = await result.json(); return state;
    }
    if (state.draft) await save('discard');
    await save('studio-draft', { operation: 'create', interpreter: 2 });
    const mechanic = state.draft.snapshot.studio.mechanics.at(-1);
    mechanic.name = 'Ember cadence';
    await save('studio-draft', { operation: 'update', id: mechanic.id, value: mechanic });
    await save('create', { domain: 'decks', name: 'Ember starter', factionId: 'rumin' });
    const deck = state.draft.snapshot.domains.decks.at(-1);
    await save('create', { domain: 'offers', name: 'Ember starter collection', templateId: deck.id });
    const offer = state.draft.snapshot.domains.offers.at(-1);
    await save('competition-draft', { domain: 'events', operation: 'create' });
    fixture = { mechanic: mechanic.id, offer: offer.id, event: state.draft.snapshot.competition.events.at(-1).id };
    fs.writeFileSync(seedFile, JSON.stringify(fixture));
  }
  const page = await context.newPage();
  const entries = [
    ['home', '', '.admin-home-welcome'], ['content', 'workshop=cards', '.design-workshop'],
    ['card', 'workshop=cards&object=rumin-coin-scale-spear', '.design-workshop'],
    ['mechanic', 'workshop=mechanics&object=' + fixture.mechanic, '.mechanic-studio .admin-editor'],
    ['website', 'workshop=modes&object=practice&section=play', '.design-workshop'],
    ['assets', 'workshop=asset-library&object=' + state.assetLibrary.find(row => row.mediaType.startsWith('image/')).id, '.design-workshop'],
    ['events', 'workshop=competition:events&object=' + fixture.event, '[aria-label="Managed competition definitions"] .admin-editor'],
    ['commerce', 'area=Store+%26+Economy&workshop=offers&object=' + fixture.offer, '.design-workshop'],
    ['publishing', 'area=Publishing', '[aria-label="Shared release review"]'],
    ['operations', 'area=Players', '.admin-subnav, .admin-player-workspace, .admin-search']
  ];
  for (const [name, query, ready] of entries.filter(([name]) => !process.env.CAPTURE_FILTER || process.env.CAPTURE_FILTER.split(",").includes(name))) {
    await page.goto(origin + '/admin/gauntlet?' + query);
    await page.locator(ready).first().waitFor({ timeout: 90000 });
    if (!['home', 'operations'].includes(name)) await page.locator('.admin-save-context').filter({ hasText: /Loading authoring/ }).waitFor({ state: 'hidden', timeout: 90000 });
    if (name === 'card') await page.locator('.admin-card-preview').first().waitFor({ timeout: 90000 });
    if (name === 'operations') { await page.getByRole('button', { name: 'View player simply', exact: true }).click(); await page.getByRole('heading', { name: 'simply', exact: true }).waitFor(); }
    if (name === 'assets') { const editor = page.getByRole('button', { name: 'Editor', exact: true }); if (await editor.isVisible()) await editor.click(); await page.locator('.admin-art-preview').first().waitFor(); }
    if (name === 'publishing') await page.getByText('Ember cadence', { exact: true }).first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(root, name + '-desktop.png'), animations: 'disabled' });
    if (['home', 'card', 'website'].includes(name)) for (const [size, width, height] of [['laptop', 1280, 800], ['phone', 390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.screenshot({ path: path.join(root, name + '-' + size + '.png'), animations: 'disabled' });
    }
    if (name === 'home') {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('button', { name: 'Navigation', exact: true }).click();
      await page.screenshot({ path: path.join(root, 'navigation-phone.png'), animations: 'disabled' });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    console.log('Captured ' + name);
  }
  fs.writeFileSync(path.join(root, 'capture.json'), JSON.stringify({ phase, client: origin, backend: api, externalRequests: 'blocked', baseline: '41d8801f', fixture, viewport: '1440 × 1000', capturedAt: new Date().toISOString() }, null, 2));
  await browser.close();
}
run().catch(error => { console.error(error); process.exit(1); });
