const { chromium, expect: rawExpect } = require('../node_modules/@playwright/test');
const AxeBuilder = require('../node_modules/@axe-core/playwright').default;
const fs = require('node:fs');
const path = require('node:path');
const expect = rawExpect.configure({ timeout: 30000 });
const base = `http://127.0.0.1:${process.env.GAUNTLET_ADMIN_CLIENT_PORT || '3188'}`;
const backend = `http://127.0.0.1:${process.env.GAUNTLET_ADMIN_FIXTURE_PORT || '4188'}`;
const evidence = process.env.GAUNTLET_NATIVE_EVIDENCE_DIR || path.resolve(__dirname, '../docs/reviews/admin-workspace/after');
const profileDirectory = path.resolve(__dirname, '../artifacts');
fs.mkdirSync(profileDirectory, { recursive: true });
fs.mkdirSync(evidence, { recursive: true });
const profile = fs.mkdtempSync(path.join(profileDirectory, 'native-zoom-profile-'));
const fixtureRoot = process.env.GAUNTLET_NATIVE_FIXTURE_ROOT || path.resolve(__dirname, '../.playwright-data/admin-redesign');
const sessions = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'sessions.json'), 'utf8'));
const metrics = page => page.evaluate(() => ({ innerWidth, innerHeight, outerWidth, outerHeight, devicePixelRatio, visualScale: visualViewport.scale, documentWidth: document.documentElement.scrollWidth }));
(async () => {
  const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, viewport: null, reducedMotion: 'reduce', args: ['--window-size=1366,855', '--force-device-scale-factor=1'] });
  // Leave loopback requests on Chromium's native network path while blocking every external HTTP(S) origin.
  await context.route(url => ['http:', 'https:'].includes(url.protocol) && ![base, backend].includes(url.origin), route => route.abort());
  await context.addInitScript(({token, origin}) => { if (location.origin === origin) localStorage.setItem('gauntlet_auth_token', token); }, { token: sessions.simply, origin: base });
  const page = context.pages()[0];
  try {
    await page.goto(base + '/admin/gauntlet?workshop=cards&object=rumin-coin-scale-spear');
    await expect(page.getByLabel('Draft name', { exact: true })).toBeVisible();
    let initial = await metrics(page);
    if (initial.innerWidth !== 1366 || initial.innerHeight !== 768) {
      const cdp = await context.newCDPSession(page);
      const { windowId } = await cdp.send('Browser.getWindowForTarget');
      await cdp.send('Browser.setWindowBounds', { windowId, bounds: { width: initial.outerWidth + 1366 - initial.innerWidth, height: initial.outerHeight + 768 - initial.innerHeight } });
      await expect.poll(() => page.evaluate(() => innerWidth)).toBe(1366);
      await expect.poll(() => page.evaluate(() => innerHeight)).toBe(768);
      await cdp.detach();
      initial = await metrics(page);
    }
    expect(initial.devicePixelRatio).toBe(1);
    const settings = await context.newPage();
    await settings.goto('chrome://settings/appearance');
    const zoom = settings.locator('#zoomLevel');
    await expect(zoom).toBeVisible();
    await zoom.selectOption('2');
    await expect(zoom).toHaveValue('2');
    await settings.close();
    await page.reload();
    await expect(page.getByLabel('Draft name', { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => devicePixelRatio)).toBe(2);
    const doubled = await metrics(page);
    expect(doubled.innerWidth).toBe(683);
    expect(doubled.innerHeight).toBe(384);
    expect(doubled.visualScale).toBe(1);
    expect(doubled.documentWidth).toBeLessThanOrEqual(doubled.innerWidth);
    const field = page.getByLabel('Draft name', { exact: true });
    await field.focus(); await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog', { name: 'Search Admin', exact: true })).toBeVisible();
    await page.keyboard.press('Escape'); await expect(field).toBeFocused();
    const navigation = page.getByRole('button', { name: 'Navigation', exact: true });
    await navigation.click(); await expect(page.getByRole('dialog', { name: 'Workspace navigation' })).toBeVisible();
    await page.keyboard.press('Escape'); await expect(navigation).toBeFocused();
    await page.evaluate(() => scrollTo(0, 0));
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].filter(img => { const box = img.getBoundingClientRect(); return box.width && box.height && box.top < innerHeight && box.bottom > 0; }).map(img => img.decode().catch(() => {}))); });
    // Playwright's screenshot clip uses CSS metrics and crops native-zoom views.
    // Capture the whole compositor surface without supplying a CSS clip.
    const captureSession = await context.newCDPSession(page);
    const capture = await captureSession.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    await captureSession.detach();
    const pixels = Buffer.from(capture.data, 'base64');
    fs.writeFileSync(path.join(evidence, 'card-native-200-percent.png'), pixels);
    const a11y = await new AxeBuilder({ page }).include('.gauntlet-admin').analyze();
    const result = { capturedAt: new Date().toISOString(), browser: 'Playwright Chromium persistent isolated profile', profile: 'Fresh temporary profile under ignored artifacts; no user browser profile reused.', method: 'chrome://settings/appearance Page zoom control selected 200%; no CSS zoom, page scale emulation, or viewport emulation.', capture: { method: 'CDP compositor surface, no clip', width: pixels.readUInt32BE(16), height: pixels.readUInt32BE(20) }, baseline: initial, zoom200: doubled, keyboardSearch: 'pass', navigationDrawer: 'pass', axeViolations: a11y.violations, client: base, backend };
    fs.writeFileSync(path.join(evidence, 'native-zoom.json'), JSON.stringify(result, null, 2) + '\n');
    expect(result.capture.width).toBe(initial.innerWidth);
    expect(result.capture.height).toBe(initial.innerHeight);
    expect(a11y.violations).toEqual([]);
    if (process.env.GAUNTLET_NATIVE_MATRIX === 'true') {
      const headers = { Authorization: `Bearer ${sessions.simply}` };
      const api = async (method, route, data) => {
        const response = await context.request[method](backend + '/api/admin/authoring' + route, { headers, ...(data ? { data } : {}) });
        expect(response.ok()).toBe(true); return response.json();
      };
      const before = await api('get', '');
      expect(before.draft).toBeFalsy(); // Matrix mutations require a clean owned fixture.
      let createdDraft = false;
      result.views = {};
      const captureView = async name => {
        const measure = await metrics(page);
        expect(measure.devicePixelRatio).toBe(2); expect(measure.visualScale).toBe(1);
        expect(measure.documentWidth).toBeLessThanOrEqual(measure.innerWidth);
        await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].filter(img => { const b = img.getBoundingClientRect(); return b.width && b.height && b.top < innerHeight && b.bottom > 0; }).map(img => img.decode().catch(() => {}))); });
        const session = await context.newCDPSession(page);
        const image = await session.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
        await session.detach(); fs.writeFileSync(path.join(evidence, `${name}-native-200-percent.png`), Buffer.from(image.data, 'base64'));
        const axe = await new AxeBuilder({ page }).include('.gauntlet-admin').analyze(); expect(axe.violations).toEqual([]);
        result.views[name] = { ...measure, axeViolations: axe.violations };
      };
      try {
        await page.goto(base + '/admin/gauntlet'); const task = page.getByRole('button', { name: 'Build a card set', exact: true }); await expect(task).toBeVisible(); await task.scrollIntoViewIfNeeded(); await captureView('home');
        await page.goto(base + '/admin/gauntlet?workshop=cards'); const search = page.getByLabel('Search cards', { exact: true }); await expect(search).toBeVisible(); await search.scrollIntoViewIfNeeded(); await captureView('collection');
        await page.goto(base + '/admin/gauntlet?workshop=cards&object=rumin-coin-scale-spear'); await expect(page.getByLabel('Draft name', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Preview', exact: true }).click(); const preview = page.getByRole('region', { name: 'Card Workshop preview and test', exact: true }); const card = preview.getByRole('img', { name: /Dividend Yield Blade/ }).first(); await expect(card).toBeVisible(); await card.scrollIntoViewIfNeeded(); await captureView('editor-preview');
        await api('patch', '/draft', { expectedRevision: before.revision, domain: 'cards', id: 'rumin-coin-scale-spear', field: 'name', value: '' }); createdDraft = true;
        await page.goto(base + '/admin/gauntlet?area=Publishing'); const fix = page.getByRole('region', { name: 'Shared release review', exact: true }).getByRole('button', { name: 'Fix name', exact: true }); await expect(fix).toBeVisible(); await fix.scrollIntoViewIfNeeded(); await expect(fix).toBeInViewport(); await captureView('validation');
        const invalid = await api('get', ''); await api('patch', '/draft', { expectedRevision: invalid.revision, domain: 'cards', id: 'rumin-coin-scale-spear', field: 'name', value: 'Native zoom review candidate' });
        await page.reload(); await expect(page.getByRole('region', { name: 'Shared release review', exact: true })).toContainText('Native zoom review candidate'); const release = page.getByLabel('Release name', { exact: true }); await release.scrollIntoViewIfNeeded(); await release.fill('Native zoom review'); await expect(release).toBeInViewport(); await captureView('review');
      } finally { if (createdDraft) { const current = await api('get', ''); await api('post', '/discard', { expectedRevision: current.revision }); } }
      fs.writeFileSync(path.join(evidence, 'native-zoom.json'), JSON.stringify(result, null, 2) + '\n');
    }
    console.log(JSON.stringify(result, null, 2));
  } finally { await context.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
